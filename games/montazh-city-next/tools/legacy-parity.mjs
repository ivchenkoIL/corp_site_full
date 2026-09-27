#!/usr/bin/env node
/* =====================================================================
   legacy-parity.mjs — доказывает, что игра, собранная из модулей
   (dist-legacy/legacy.html), ведёт себя так же, как исходный монолит.

   Обе версии открываются в одном и том же Chromium с подменённым временем:
   Math.random с фиксированным зерном, performance.now и requestAnimationFrame
   идут по виртуальным часам шагами по 1/60 с. Значит, при одинаковом коде
   состояние мира обязано совпасть точно, а картинка — с точностью до шума
   GPU (два запуска самого монолита тоже расходятся на единицы в младшем
   разряде цвета). Сравниваются:
     • ошибки страницы и консоли (их не должно быть ни там, ни там);
     • отпечаток состояния смены (Олег, велосипед, машины, прохожие, часы);
     • кадры — попиксельно, в нескольких точках района.

     node tools/legacy-parity.mjs                  все сцены
     node tools/legacy-parity.mjs --scene=dense    одна сцена
     node tools/legacy-parity.mjs --frames=600     дольше гонять мир
   ===================================================================== */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LEGACY_TOOLS = path.resolve(ROOT, '..', 'montazh-city-3d', 'tools');
const { loadPlaywright } = await import(pathToFileURL(path.join(LEGACY_TOOLS, 'find-playwright.mjs')).href);
const { SCENES, saveFor, optsFor, SAVE_KEY, OPT_KEY } = await import(pathToFileURL(path.join(LEGACY_TOOLS, 'scenes.mjs')).href);

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const TARGETS = {
  monolith: path.resolve(ROOT, argv.ref || path.join('..', 'montazh-city-3d', 'index.html')),
  modules: path.resolve(ROOT, argv.built || 'dist-legacy/legacy.html')
};
for (const [k, f] of Object.entries(TARGETS)) if (!fs.existsSync(f)) { console.error('Нет файла ' + k + ': ' + f + (k === 'modules' ? ' — сначала npm run build:legacy' : '')); process.exit(2); }
const FRAMES = +(argv.frames || 360);
const OUT = path.resolve(ROOT, argv.out || 'parity-shots');
const sceneIds = argv.scene ? [argv.scene] : ['street', 'dense', 'traffic', 'night'];
const W = 1280, H = 800;

const { pw } = loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

/* Виртуальное время. Ставится до кода игры. */
function clockInit() {
  let seed = 0x9e3779b9;
  Math.random = function () {                       /* mulberry32 */
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  let now = 1000;
  const base = 1700000000000;
  performance.now = () => now;
  Date.now = () => base + now;
  let q = [], id = 0;
  window.requestAnimationFrame = cb => { q.push([++id, cb]); return id; };
  window.cancelAnimationFrame = h => { q = q.filter(e => e[0] !== h); };
  window.__vset = t => { now = t; };
  window.__vstep = (n, dt) => {
    for (let i = 0; i < n; i++) {
      now += dt || 1000 / 60;
      const run = q; q = [];
      for (const [, cb] of run) cb(now);
    }
    return now;
  };
}

async function runOne(target, sc) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(clockInit);
  await page.addInitScript(({ save, opts, keys }) => {
    try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
  }, { save: saveFor(sc), opts: optsFor('medium', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
  await page.goto(pathToFileURL(target).href + '?mc3d-test', { waitUntil: 'load' });

  /* загрузка идёт заданиями между кадрами — крутим виртуальные кадры, пока не появится меню */
  let ok = false;
  for (let i = 0; i < 3000 && !ok; i++) {
    await page.evaluate(() => window.__vstep(2));
    ok = await page.evaluate(() => !!document.getElementById('bCont') && getComputedStyle(document.getElementById('loading')).display === 'none');
    if (!ok) await page.waitForTimeout(5);
  }
  if (!ok) { errors.push('меню не появилось'); await ctx.close(); return { errors }; }
  /* Сколько кадров заняла загрузка, зависит от того, как быстро браузер
     прожевал задания генерации, — в двух сборках по-разному. А часы игры S.t
     идут и в меню, и от них зависят решения жителей. Поэтому перед входом в
     смену часы обеих версий выставляются одинаково. */
  const loadFrames = await page.evaluate(() => { const t = window.__MC3D.S.t; window.__MC3D.S.t = 30; window.__vset(600000); window.__vstep(1); return t; });
  await page.evaluate(() => document.getElementById('bCont').click());

  /* мир живёт FRAMES кадров; реплики брифинга пролистываются одинаково в обеих версиях */
  for (let f = 0; f < FRAMES; f += 10) {
    await page.evaluate(() => {
      const d = document.getElementById('dialog');
      if (d && d.style.display === 'block') {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
      }
      window.__vstep(10);
    });
  }
  const digest = await page.evaluate(() => {
    const S = window.__MC3D && window.__MC3D.S;
    if (!S) return null;
    const r = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
    const pick = (o, keys) => o ? Object.fromEntries(keys.filter(k => k in o).map(k => [k, r(o[k])])) : null;
    const list = (arr, keys) => (arr || []).map(o => pick(o, keys));
    return {
      screen: S.screen, t: r(S.t), clock: r(S.clock), day: S.day,
      player: pick(S.player, ['x', 'z', 'yaw', 'vx', 'vz', 'health', 'stamina', 'money', 'rep', 'onBike']),
      bike: pick(S.bike, ['x', 'z', 'yaw', 'speed', 'cond']),
      cars: list(S.cars, ['x', 'z', 'yaw', 'speed', 'kind']),
      peds: list(S.peds, ['x', 'z', 'yaw']),
      npcs: list(S.npcs, ['x', 'z', 'yaw', 'id']),
      dogs: list(S.dogs, ['x', 'z', 'yaw']),
      mission: S.mission ? { id: S.mission.id, stage: S.mission.stage } : null
    };
  });
  const png = await page.screenshot({ type: 'png' });
  await ctx.close();
  return { errors, digest, png, loadFrames };
}

async function pixelDiff(a, b) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.evaluate(async ([a, b]) => {
    const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
    let diff = 0, maxd = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > 0) diff++;
      if (d > maxd) maxd = d;
    }
    return { pixels: da.length / 4, diff, maxd, sameSize: ia.width === ib.width && ia.height === ib.height };
  }, [a.toString('base64'), b.toString('base64')]);
  await ctx.close();
  return res;
}

fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const id of sceneIds) {
  const sc = SCENES[id];
  if (!sc) { console.error('Нет сцены ' + id); failed++; continue; }
  const a = await runOne(TARGETS.monolith, sc);
  const b = await runOne(TARGETS.modules, sc);
  const sameDigest = JSON.stringify(a.digest) === JSON.stringify(b.digest);
  let px = null;
  if (a.png && b.png) {
    fs.writeFileSync(path.join(OUT, sc.id + '-monolith.png'), a.png);
    fs.writeFileSync(path.join(OUT, sc.id + '-modules.png'), b.png);
    px = await pixelDiff(a.png, b.png);
  }
  /* Два запуска самого монолита расходятся на сотни пикселей с разницей до 3
     из 255 — это шум GPU (порядок заданий генерации текстур, таймеры). Поэтому
     кадр считается тем же, если отличий не больше этого шума. */
  const ok = !a.errors.length && !b.errors.length && sameDigest && px && px.sameSize &&
    px.maxd <= 4 && px.diff <= px.pixels * 0.01;
  if (!ok) failed++;
  console.log((ok ? 'СОВПАЛО ' : 'РАЗОШЛОСЬ ') + sc.id +
    ' | состояние: ' + (sameDigest ? 'одинаковое' : 'разное') +
    ' | пиксели: ' + (px ? px.diff + ' из ' + px.pixels + ' (макс. разница ' + px.maxd + ')' : '—') +
    ' | машин ' + (a.digest?.cars?.length ?? '?') + ', прохожих ' + (a.digest?.peds?.length ?? '?') +
    ', Олег ' + JSON.stringify(a.digest?.player ? [a.digest.player.x, a.digest.player.z] : null) +
    ' | часы меню ' + (a.loadFrames != null ? a.loadFrames.toFixed(2) : '?') + ' / ' + (b.loadFrames != null ? b.loadFrames.toFixed(2) : '?'));
  for (const e of a.errors) console.log('   монолит: ' + e);
  for (const e of b.errors) console.log('   модули:  ' + e);
  if (!sameDigest && a.digest && b.digest) {
    for (const k of Object.keys(a.digest)) if (JSON.stringify(a.digest[k]) !== JSON.stringify(b.digest[k]))
      console.log('   различие в ' + k + ':\n     монолит ' + JSON.stringify(a.digest[k]).slice(0, 300) + '\n     модули  ' + JSON.stringify(b.digest[k]).slice(0, 300));
  }
}
await browser.close();
console.log(failed ? 'Итог: есть расхождения (' + failed + ').' : 'Итог: собранная из модулей игра совпадает с монолитом.');
process.exit(failed ? 1 : 0);
