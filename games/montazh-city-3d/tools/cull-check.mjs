#!/usr/bin/env node
/* =====================================================================
   cull-check.mjs — отсев по клеткам не должен ничего убирать из кадра.

   Ставит камеру в контрольную сцену, снимает кадр с отсевом и без него и
   сравнивает попиксельно. Отсев обязан быть консервативным: если хоть один
   пиксель разошёлся, коробка клетки где-то мала и геометрия пропадает на
   краю кадра. Заодно печатает, что отсев дал по вызовам и треугольникам.

     node tools/cull-check.mjs --scene=street --quality=high
     node tools/cull-check.mjs --scene=dense --yaw=2.4
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

/* Несколько поворотов на сцену: отсев легче всего ломается на краю кадра,
   а стоя в одну сторону этого не увидишь. */
const YAWS = argv.yaw !== undefined ? [+argv.yaw] : [0, 1.05, Math.PI / 2, Math.PI, 4.019, 5.4];
const names = (argv.scene || 'street,dense,traffic').split(',');

const browser = await playwright.chromium.launch({
  headless: argv.headed !== 'true',
  args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});

let bad = 0;
for (const nm of names) {
  const sc = SCENES[nm];
  if (!sc) { console.error('нет сцены ' + nm); continue; }
  const ctx = await browser.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.addInitScript(({ save, opts, keys }) => {
    try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
  }, { save: saveFor(sc), opts: optsFor(argv.quality || 'high', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
  await page.goto(pathToFileURL(GAME).href + '?mc3d-test', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });
  await page.click('#bCont');
  await page.waitForTimeout(4000);

  for (const yaw of YAWS) {
    /* Оба варианта рисуются ВНУТРИ одного кадра: renderFrame зовётся дважды
       подряд, между вызовами мир не двигается. Иначе сравнивать нечего —
       жители ходят, машины едут, зелень качается на ветру, и за один кадр
       расходится восемьдесят процентов пикселей безо всякого отсева. */
    const r = await page.evaluate(async (y) => {
      const M = window.__MC3D, S = M.S, GL = M.GL, gl = GL.gl;
      S.player.yaw = y; S.cam.yaw = y; S.cam.manual = 0;
      /* камера идёт за игроком с задержкой — дать ей встать на место */
      await new Promise(r => { let k = 0; const f = () => (++k < 40 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
      const shoot = (on) => {
        M.Cull.on = on;
        M.renderFrame();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { buf: px, w, h, calls: M.Cull.stats.sCalls, tris: M.Cull.stats.sTris,
                 full: M.Cull.stats.full, vis: M.Cull.stats.vis, cells: M.Cull.stats.cells };
      };
      const [a, b] = await new Promise(res => requestAnimationFrame(() => res([shoot(true), shoot(false)])));
      M.Cull.on = true;
      let diff = 0, maxd = 0;
      for (let i = 0; i < a.buf.length; i += 4) {
        const d = Math.abs(a.buf[i] - b.buf[i]) + Math.abs(a.buf[i+1] - b.buf[i+1]) + Math.abs(a.buf[i+2] - b.buf[i+2]);
        if (d > 6) { diff++; if (d > maxd) maxd = d; }
      }
      return { diff, maxd, px: a.w * a.h,
               on: { calls: a.calls, tris: a.tris, vis: a.vis, cells: a.cells },
               off: { calls: b.calls, tris: b.tris } };
    }, yaw);
    const pct = (100 * r.diff / r.px).toFixed(3);
    const ok = r.diff === 0;
    if (!ok) bad++;
    console.log((ok ? '  ok ' : ' ПЛОХО ') + sc.id + ' yaw=' + yaw.toFixed(2) +
      ': разошлось ' + r.diff + ' пикселей (' + pct + ' %), макс ' + r.maxd +
      ' | вызовов ' + r.on.calls + ' против ' + r.off.calls +
      ', треугольников ' + r.on.tris + ' против ' + r.off.tris +
      ' (' + (100 * r.on.tris / Math.max(1, r.off.tris)).toFixed(0) + ' %)' +
      ', клеток ' + r.on.vis + '/' + r.on.cells);
  }
  if (errs.length) console.log('  ошибки страницы: ' + errs.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(bad ? '\nрасхождений: ' + bad + ' — коробки клеток малы' : '\nотсев консервативен: расхождений нет');
process.exit(bad ? 1 : 0);
