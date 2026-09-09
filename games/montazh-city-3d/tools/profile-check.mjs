#!/usr/bin/env node
/* =====================================================================
   profile-check.mjs — переключение качества на лету, настоящим путём.

   Не через внутренности: скрипт открывает паузу, заходит в настройки и
   жмёт ту же кнопку «Качество», что и игрок. После каждого нажатия
   рисуется кадр и проверяются gl.getError, ошибки страницы и то, что
   профиль действительно поменял буфер, каскады и эффекты.

     node tools/profile-check.mjs
     node tools/profile-check.mjs --scene=street --rounds=9
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { SCENES, saveFor, optsFor, SAVE_KEY, OPT_KEY } from './scenes.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

let playwright;
try { playwright = loadPlaywright().pw; } catch (e) { console.error(e.message); process.exit(2); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const sc = SCENES[argv.scene || 'shops'];
const ROUNDS = +(argv.rounds || 7);

const browser = await playwright.chromium.launch({
  headless: argv.headed !== 'true',
  args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [], warns = [];
page.on('pageerror', e => errs.push(String(e && e.message || e)));
page.on('console', m => {
  const t = m.text();
  if ((m.type() === 'warning' || m.type() === 'error') && !/Autoplay|AudioContext|favicon/i.test(t)) warns.push(t);
});
await page.addInitScript(({ save, opts, keys }) => {
  try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
}, { save: saveFor(sc), opts: optsFor(argv.quality || 'high', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
await page.goto(pathToFileURL(GAME).href + '?mc3d-test', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });
await page.click('#bCont');
await page.waitForTimeout(4000);
for (let i = 0; i < 40; i++) {
  const open = await page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d.style.display === 'block'); });
  if (!open) break;
  await page.keyboard.press('Space'); await page.waitForTimeout(120);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.evaluate(() => { const b = document.getElementById('bSet'); if (b) b.click(); });
await page.waitForTimeout(500);

const rows = await page.evaluate(async (rounds) => {
  const M = window.__MC3D, gl = M.GL.gl, out = [];
  for (let i = 0; i < rounds; i++) {
    const b = document.getElementById('bQual');
    if (!b) { out.push({ bad: 'кнопки «Качество» нет — настройки не открылись' }); break; }
    b.click();
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    M.renderFrame();
    out.push({ q: M.S.quality, err: gl.getError(), w: M.HDR.w, h: M.HDR.h, msaa: M.HDR.samples,
               csm: M.SHADOW.n, ssao: !!M.SSAO.on, bloom: !!M.BLOOM.on, ssr: !!M.SSR.on });
  }
  return out;
}, ROUNDS);

let bad = 0;
console.log('переключение качества на лету, сцена ' + sc.id + '\n');
console.log('  профиль  буфер        мсэмпл  каскадов  затенение  свечение  отражения  gl');
for (const r of rows) {
  if (r.bad) { console.log('  ' + r.bad); bad++; continue; }
  if (r.err !== 0) bad++;
  console.log('  ' + r.q.padEnd(8) + (r.w + '×' + r.h).padEnd(12) +
    String(r.msaa).padStart(5) + String(r.csm).padStart(10) +
    String(r.ssao).padStart(11) + String(r.bloom).padStart(10) + String(r.ssr).padStart(11) +
    (r.err === 0 ? '  ок' : '  0x' + r.err.toString(16)));
}
if (errs.length) { console.log('\nошибки страницы: ' + errs.join(' | ')); bad++; }
if (warns.length) { console.log('\nпредупреждения: ' + warns.slice(0, 8).join(' | ')); bad++; }
console.log(bad ? '\nесть замечания' : '\nвсе три профиля переключаются без ошибок');
await browser.close();
process.exit(bad ? 1 : 0);
