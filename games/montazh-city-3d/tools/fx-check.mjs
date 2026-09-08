#!/usr/bin/env node
/* =====================================================================
   fx-check.mjs — что именно добавил эффект, снятое ЧЕСТНО.

   Два варианта кадра рисуются ВНУТРИ ОДНОГО кадра: между ними мир не
   двигается. Иначе сравнивать бесполезно — за кадр жители шагают, зелень
   качается, и расходится большая часть кадра безо всякого эффекта. Тот же
   приём, что в cull-check.mjs и shadow-check.mjs.

   Печатает долю разошедшихся пикселей и кладёт три PNG: «с», «без» и
   усиленную разность.

     node tools/fx-check.mjs --fx=ssr   --scene=street --x=90 --z=11 --yaw=0
     node tools/fx-check.mjs --fx=bloom --scene=shops
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
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const sc = SCENES[argv.scene || 'street'];
if (!sc) { console.error('нет сцены ' + argv.scene); process.exit(2); }
/* Точка и час задаются штатным файлом сохранения, как в shot.mjs: двигать
   игрока изнутри страницы нельзя — физика и камера вернут его обратно. */
if (argv.x !== undefined) sc.p.x = +argv.x;
if (argv.z !== undefined) sc.p.z = +argv.z;
if (argv.yaw !== undefined) sc.p.yaw = +argv.yaw;
if (argv.hour !== undefined) sc.hour = +argv.hour;
if (argv.x !== undefined || argv.z !== undefined) { sc.bike.x = sc.p.x + 3; sc.bike.z = sc.p.z + 3; }
const FX = argv.fx || 'ssr';
const OUT = argv.out || path.resolve(HERE, '..', '..', '..', 'docs', 'shots', '04-bloom');
const TAG = argv.tag || (FX + '-' + sc.id);
const W = +(argv.width || 1440), H = +(argv.height || 900), DPR = +(argv.dpr || 2);

const browser = await playwright.chromium.launch({
  headless: argv.headed !== 'true',
  args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.addInitScript(({ save, opts, keys }) => {
  try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
}, { save: saveFor(sc), opts: optsFor(argv.quality || 'high', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
const CFG = argv.cfg ? '&mc3d-cfg=' + encodeURIComponent(argv.cfg) : '';
await page.goto(pathToFileURL(GAME).href + '?mc3d-test' + CFG, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });
await page.click('#bCont');
await page.waitForTimeout(4500);

const r = await page.evaluate(async ({ fx }) => {
  const M = window.__MC3D, gl = M.GL.gl;
  /* камера идёт за игроком с задержкой — дать ей встать на место */
  await new Promise(res => { let k = 0; const f = () => (++k < 45 ? requestAnimationFrame(f) : res()); requestAnimationFrame(f); });
  /* Что именно выключается на «без»: у свечения и отражений — сила, у
     размытия затенения выключать нечего, там сравниваются два исполнения. */
  const K = fx === 'ssr' ? M.QCFG.ssr : fx === 'bloom' ? M.QCFG.bloom : M.QCFG.ssao;
  const flag = fx === 'ssaoblur';
  const keep = flag ? K.blurSep : K.strength;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const shoot = (on) => {
    if (flag) K.blurSep = on; else K.strength = on ? keep : 0;
    M.renderFrame();
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };
  const [A, B] = await new Promise(res => requestAnimationFrame(() => res([shoot(true), shoot(false)])));
  if (flag) K.blurSep = keep; else K.strength = keep;
  /* Кодируем прямо на странице: двадцать миллионов байт через мост
     инструмента не проходят, а холст 2D их сожмёт в PNG. */
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  const put = (src) => {                       /* readPixels отдаёт строки снизу вверх */
    const im = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) im.data.set(src.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    cx.putImageData(im, 0, 0);
    return cv.toDataURL('image/png');
  };
  const D = new Uint8Array(w * h * 4);
  let diff = 0, maxd = 0, sum = 0;
  for (let i = 0; i < w * h; i++) {
    const d = Math.max(Math.abs(A[i*4] - B[i*4]), Math.abs(A[i*4+1] - B[i*4+1]), Math.abs(A[i*4+2] - B[i*4+2]));
    if (d > 2) diff++;
    if (d > maxd) maxd = d;
    sum += d;
    const v = Math.min(255, d * 6);
    D[i*4] = D[i*4+1] = D[i*4+2] = v; D[i*4+3] = 255;
  }
  return { w, h, diff, maxd, mean: sum / (w * h), on: put(A), off: put(B), dif: put(D) };
}, { fx: FX });

fs.mkdirSync(OUT, { recursive: true });
const save = (name, url) => fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
save(TAG + '-on.png', r.on);
save(TAG + '-off.png', r.off);
save(TAG + '-diff.png', r.dif);
console.log(FX + ' · ' + sc.id + ': тронуто ' + (100 * r.diff / (r.w * r.h)).toFixed(2) +
            ' % пикселей, макс ' + r.maxd + ', среднее ' + r.mean.toFixed(2));
console.log('  → ' + path.join(OUT, TAG + '-{on,off,diff}.png'));
if (errs.length) console.log('  ошибки страницы: ' + errs.join(' | '));
await browser.close();
