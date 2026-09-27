#!/usr/bin/env node
/* =====================================================================
   snap.mjs — снимок страницы новой игры или просмотрщика в Chromium.

     node tools/snap.mjs --url "http://localhost:5178/viewer.html?anim=walk&t=.3" --out /tmp/a.png
     node tools/snap.mjs --url ... --ready "window.__viewer.ready" --eval "window.__viewer.cam('side')" --wait 300

   Ждёт промис из --ready (по умолчанию __viewer.ready или __game.ready),
   выполняет --eval (можно несколько через ;;), ждёт --wait мс, снимает.
   Печатает ошибки страницы и консоли — их быть не должно.
   ===================================================================== */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { loadPlaywright } = await import(pathToFileURL(path.resolve(HERE, '..', '..', 'montazh-city-3d', 'tools', 'find-playwright.mjs')).href);
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) argv[a.slice(2)] = 'true'; else { argv[a.slice(2)] = n; i++; } } }
const W = +(argv.w || 1280), H = +(argv.h || 800);
const { pw } = loadPlaywright();
const extra = argv.uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [];
const browser = await pw.chromium.launch({ headless: argv.headed !== 'true', args: ['--use-angle=default', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required', ...extra] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +(argv.dpr || 1) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + (e && e.message || e)));
page.on('console', m => { if (m.type() === 'error' || (argv.log && m.type() === 'log')) errors.push(m.type() + ': ' + m.text()); });
await page.goto(argv.url, { waitUntil: 'load', timeout: 120000 });
const ready = argv.ready || '(window.__viewer && window.__viewer.ready) || (window.__game && window.__game.ready)';
/* опрос вместо waitForFunction: тот строит функцию из строки внутри страницы,
   а под строгой CSP (как у артефактов) это запрещено */
try {
  const t0 = Date.now();
  while (!(await page.evaluate('!!(' + ready + ')'))) { if (Date.now() - t0 > 120000) throw new Error('таймаут'); await page.waitForTimeout(250); }
  await page.evaluate('Promise.resolve(' + ready + ')');
} catch (e) { errors.push('не дождался готовности: ' + e.message.split('\n')[0]); }
for (const js of (argv.eval ? argv.eval.split(';;') : [])) { try { const r = await page.evaluate(js); if (r !== undefined) console.log('eval → ' + JSON.stringify(r)); } catch (e) { errors.push('eval: ' + e.message.split('\n')[0]); } }
/* --keys "KeyW:1500,ShiftLeft+KeyW:2000,KeyE:100" — зажать клавиши на время */
for (const item of (argv.keys ? argv.keys.split(',') : [])) {
  const [combo, ms] = item.split(':');
  const keys = combo.split('+');
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(+(ms || 100));
  for (const k of keys.reverse()) await page.keyboard.up(k);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(+(argv.wait || 400));
const outs = (argv.out || '/tmp/snap.png').split(',');
for (let k = 0; k < outs.length; k++) {
  if (k > 0) { if (argv.between) await page.evaluate(argv.between.split('|')[k - 1]); await page.waitForTimeout(+(argv.wait || 400)); }
  fs.mkdirSync(path.dirname(path.resolve(outs[k])), { recursive: true });
  await page.screenshot({ path: outs[k] });
}
if (argv.stats) console.log(JSON.stringify(await page.evaluate(argv.stats)));
console.log(errors.length ? errors.join('\n') : 'ошибок нет');
await browser.close();
