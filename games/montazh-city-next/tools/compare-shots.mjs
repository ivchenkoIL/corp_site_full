#!/usr/bin/env node
/* =====================================================================
   compare-shots.mjs — «было / стало»: одни и те же точки района в старой
   игре (монолит, свой WebGL) и в новой (Babylon). Точка задаётся штатным
   файлом сохранения, камера у обеих версий — одна и та же логика
   (game/camera.js), поэтому кадры совпадают по ракурсу.

     npm run dev   (в другом окне; или --new http://localhost:5180/index.html)
     node tools/compare-shots.mjs [--out docs/compare] [--w 1280 --h 720]
   ===================================================================== */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LEGACY = path.resolve(ROOT, '..', 'montazh-city-3d');
const { loadPlaywright } = await import(pathToFileURL(path.join(LEGACY, 'tools', 'find-playwright.mjs')).href);
const { saveFor, optsFor, SAVE_KEY, OPT_KEY } = await import(pathToFileURL(path.join(LEGACY, 'tools', 'scenes.mjs')).href);
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { argv[a.slice(2)] = process.argv[i + 1]; i++; } }
const W = +(argv.w || 1280), H = +(argv.h || 720);
const OUT = path.resolve(ROOT, argv.out || 'docs/compare');
const NEW = argv.new || 'http://localhost:5178/index.html';
const OLD = pathToFileURL(path.join(LEGACY, 'index.html')).href;

/* точки: x, z, куда смотрит Олег, где велосипед */
const SCENES = [
  { id: 'office', title: 'Контора «Монтаж-Сервис»', p: { x: 21.0, z: 54.2, yaw: -2.2 }, bike: { x: 15.6, z: 53.4 } },
  { id: 'yard', title: 'Двор конторы', p: { x: 10.0, z: 53.4, yaw: -2.0 }, bike: { x: 15.6, z: 53.4 } },
  { id: 'courtyard', title: 'Двор «Три Колена»', p: { x: 50, z: 45, yaw: Math.PI }, bike: { x: 52.5, z: 46.5 } },
  { id: 'street', title: 'Северная магистраль', p: { x: 90, z: 12.25, yaw: Math.PI / 2 }, bike: { x: 86, z: 12.6 } },
  { id: 'crossing', title: 'Перекрёсток у складов', p: { x: 93, z: 70.5, yaw: 1.05 }, bike: { x: 91, z: 66 } }
];

const { pw } = loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
fs.mkdirSync(OUT, { recursive: true });

async function shot(url, sc, file, isNew) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.addInitScript(({ save, opts, keys }) => {
    try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
  }, { save: saveFor({ ...sc, hour: 17 }), opts: optsFor('high', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  const t0 = Date.now();
  while (!(await page.evaluate(() => { const b = document.getElementById('bCont'); const l = document.getElementById('loading'); return !!b && (!l || getComputedStyle(l).display === 'none'); }))) {
    if (Date.now() - t0 > 120000) { errors.push('меню не появилось'); break; }
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.getElementById('bCont')?.click());
  /* кадр без интерфейса: только сцена */
  await page.waitForTimeout(isNew ? 6500 : 5000);
  await page.evaluate(() => {
    for (const id of ['hud', 'hud2d', 'radio', 'toasts', 'prompt', 'dialog', 'screens', 'crosshair', 'errbox']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  await ctx.close();
  return errors;
}

const meta = [];
for (const sc of SCENES) {
  const a = path.join(OUT, sc.id + '-old.jpg'), b = path.join(OUT, sc.id + '-new.jpg');
  const e1 = await shot(OLD, sc, a, false);
  const e2 = await shot(NEW, sc, b, true);
  meta.push({ id: sc.id, title: sc.title, old: path.basename(a), new: path.basename(b), errorsOld: e1, errorsNew: e2 });
  console.log(sc.id.padEnd(10), 'старая:', e1.length ? e1.join('; ') : 'без ошибок', '| новая:', e2.length ? e2.join('; ') : 'без ошибок');
}
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1) + '\n');
await browser.close();
