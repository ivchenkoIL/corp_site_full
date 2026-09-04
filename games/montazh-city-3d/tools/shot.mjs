#!/usr/bin/env node
/* =====================================================================
   shot.mjs — быстрый снимок контрольной сцены и проверка, что игра жива.

     node tools/shot.mjs --scene=dense --quality=high --out=/tmp/dense.png
     node tools/shot.mjs --scene=street --quality=medium --dynamic=1 --stats
     node tools/shot.mjs --browser=webkit --scene=traffic
     node tools/shot.mjs --scene=dense --x=44 --z=33 --yaw=3.14 --hour=12   # своя точка и час

   За десять-пятнадцать секунд: грузит игру с телеметрией perf-inject.js,
   входит в сцену, прокликивает брифинг, снимает кадр и печатает ошибки
   страницы, ошибку WebGL (gl.getError), фазы загрузки, инвентарь памяти под
   текстуры и размер буфера отрисовки. Для полного замера — perf-probe.mjs.
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { SCENES, saveFor, optsFor, SAVE_KEY, OPT_KEY } from './scenes.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

let playwright;
try { playwright = loadPlaywright().pw; } catch (e) { console.error(e.message); process.exit(2); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const INJECT = path.resolve(HERE, 'perf-inject.js');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const base = SCENES[argv.scene || 'dense'];
if (!base) { console.error('Сцена: street | dense | traffic'); process.exit(2); }
/* точку, поворот и час можно переопределить — для крупных планов материалов */
const sc = { ...base, p: { ...base.p }, bike: { ...base.bike } };
if (argv.x !== undefined) sc.p.x = +argv.x;
if (argv.z !== undefined) sc.p.z = +argv.z;
if (argv.yaw !== undefined) sc.p.yaw = +argv.yaw;
if (argv.hour !== undefined) sc.hour = +argv.hour;
if (argv.x !== undefined || argv.z !== undefined) { sc.bike.x = sc.p.x + 3; sc.bike.z = sc.p.z + 3; }
const W = +(argv.width || 1440), H = +(argv.height || 900), DPR = +(argv.dpr || 2);
const WARM = +(argv.warmup || 5) * 1000;
const browserName = argv.browser || 'chromium';
const out = argv.out ? path.resolve(argv.out) : null;

const type = playwright[browserName];
const browser = await type.launch({
  headless: argv.headed !== 'true',
  args: browserName === 'chromium' ? ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] : []
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e && e.message || e)));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.addInitScript({ path: INJECT });
await page.addInitScript(({ save, opts, keys }) => {
  try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
}, { save: saveFor(sc), opts: optsFor(argv.quality || 'medium', argv.dynamic === '1' || argv.dynamic === 'true'), keys: { save: SAVE_KEY, opt: OPT_KEY } });

const t0 = Date.now();
await page.goto(pathToFileURL(GAME).href, { waitUntil: 'load' });
try { await page.waitForSelector('#bCont', { timeout: +(argv.timeout || 60) * 1000 }); }
catch (e) {
  const seen = await page.evaluate(() => ({ step: document.getElementById('loadStep')?.textContent, loading: document.getElementById('loading')?.textContent?.slice(0, 400), err: document.getElementById('errtext')?.textContent }));
  console.log(JSON.stringify({ failed: 'меню не появилось', seen, errors }, null, 1));
  await browser.close(); process.exit(1);
}
const loadMs = Date.now() - t0;
const snap = await page.evaluate(() => window.__MCPERF.snapshot());
await page.click('#bCont');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dialogOpen = () => page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d.style.display === 'block'); });
const tW = Date.now(); let quiet = 0;
while (Date.now() - tW < WARM || quiet < 1200) {
  if (await dialogOpen()) { quiet = 0; await page.keyboard.press('Space'); } else quiet += 130;
  await sleep(130);
  if (Date.now() - tW > WARM + 60000) break;
}
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); await page.screenshot({ path: out, scale: 'css' }); }
const state = await page.evaluate(() => {
  const gl = window.__MCPERF.gl, cv = gl && gl.canvas;
  const names = { 0: 'NO_ERROR', 1280: 'INVALID_ENUM', 1281: 'INVALID_VALUE', 1282: 'INVALID_OPERATION', 1285: 'OUT_OF_MEMORY', 1286: 'INVALID_FRAMEBUFFER_OPERATION', 37442: 'CONTEXT_LOST' };
  const err = gl ? gl.getError() : -1;
  return { glError: names[err] || err, render: cv ? [cv.width, cv.height] : null, hud: document.getElementById('hudTL')?.offsetParent !== null };
});
console.log(JSON.stringify({
  scene: sc.id, browser: browserName, quality: argv.quality || 'medium', loadMs,
  renderer: snap.ctx.unmasked || snap.ctx.renderer, glError: state.glError, renderBuffer: state.render,
  boot: snap.boot.phases.filter(p => p.name.startsWith('load:')).map(p => p.name.slice(5) + '@' + p.t),
  mem: { textures: snap.mem.texCount, texMiBL0: snap.mem.texMiBL0, texMiBWithMips: snap.mem.texMiBWithMips, bufferMiB: snap.mem.bufferMiB, biggest: snap.mem.biggest.slice(0, 8) },
  errors, shot: out
}, null, 1));
if (argv.stats === 'true') console.log(JSON.stringify(snap, null, 1));
await browser.close();
process.exit(errors.some(e => !e.startsWith('warning')) || state.glError !== 'NO_ERROR' ? 1 : 0);
