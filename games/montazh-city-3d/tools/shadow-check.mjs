#!/usr/bin/env node
/* =====================================================================
   shadow-check.mjs — две проверки каскадных теней, обе счётом, не на глаз.

   1) СТАБИЛИЗАЦИЯ (--stab). Каскад ставится так, будто камера сдвинулась на
      полметра, а сам вид остаётся прежним (SHADOW.fitOffset). Если центр
      каскада привязан к сетке с шагом в тексель, содержимое теневой карты
      сдвигается на целое число текселей и картинка не меняется вовсе.
      Без привязки сдвиг получается дробным, край тени переползает и кадры
      расходятся. Печатается доля разошедшихся пикселей — с привязкой и без,
      чтобы было видно, что мерялось не «ничего не произошло».

   2) ОКНО СМЕЩЕНИЯ (--bias). Смещение перебирается, и на каждом значении
      считаются две противоположные беды:
        рябь    — одинокие тёмные пиксели на освещённой поверхности: доля
                  точек, которые сами в тени, а их четыре соседа на свету;
        отрыв   — тень уползает из-под подошвы, и общая площадь тени падает.
      Окно — там, где ряби уже нет, а площадь ещё не просела.

   Кадры снимаются в отладочном показе множителя тени (shadow.debug = 1):
   в нём нет ни текстур, ни тумана, ни свечений — только сама тень.

     node tools/shadow-check.mjs --stab
     node tools/shadow-check.mjs --bias --out=/tmp/bias
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { SCENES, saveFor, optsFor, SAVE_KEY, OPT_KEY } from './scenes.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { writePNG } from './shot-stats.mjs';

let playwright;
try { playwright = loadPlaywright().pw; } catch (e) { console.error(e.message); process.exit(2); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const sc = SCENES[argv.scene || 'traffic'];
const HOUR = +(argv.hour || 10);
const W = +(argv.width || 900), H = +(argv.height || 560);

const browser = await playwright.chromium.launch({
  headless: argv.headed !== 'true',
  args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});

async function boot(cfg) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  const save = saveFor(sc); save.clock = HOUR * 3600;
  await page.addInitScript(({ save, opts, keys }) => {
    try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
  }, { save, opts: optsFor(argv.quality || 'high', false), keys: { save: SAVE_KEY, opt: OPT_KEY } });
  const qs = '?mc3d-test' + (cfg ? '&mc3d-cfg=' + encodeURIComponent(JSON.stringify(cfg)) : '');
  await page.goto(pathToFileURL(GAME).href + qs, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });
  await page.click('#bCont');
  await page.waitForTimeout(4500);
  return { ctx, page, errs };
}

/* Снять несколько вариантов ВНУТРИ ОДНОГО кадра: между вызовами renderFrame
   мир не двигается, поэтому кадры отличаются ровно тем, что мы меняли.
   По отдельным кадрам сравнивать нечего — жители ходят, зелень качается. */
async function grabMany(page, setups) {
  return await page.evaluate((list) => {
    const M = window.__MC3D, gl = M.GL.gl;
    const shoot = (s) => {
      if (s.offset) M.SHADOW.fitOffset = s.offset;
      if (s.snap !== undefined) M.SHADOW.snap = s.snap;
      if (s.bias) { M.QCFG.shadow.depthBias = s.bias.d; M.QCFG.shadow.slopeBias = s.bias.s; M.QCFG.shadow.normalBias = s.bias.n; }
      M.renderFrame();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { px: Array.from(px), w, h };
    };
    return new Promise(res => requestAnimationFrame(() => res(list.map(shoot))));
  }, setups);
}

const diffPct = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) > 8) n++;
  return 100 * n / (a.w * a.h);
};

/* Рябь считается по частоте переходов свет↔тень, а не по одиноким тёмным
   точкам: акне самозатенения выходит ПОЛОСАМИ в несколько пикселей, и у
   такой полосы соседи слева и справа тоже тёмные — счёт одиночек её не
   видит вовсе (первая версия этой проверки на явном акне давала ноль).
   У настоящей тени переходов единицы на строку, у ряби — сотни. */
function speckle(img) {
  const { px, w, h } = img;
  let tr = 0, shadow = 0, tot = 0;
  const L = (x, y) => px[(y * w + x) * 4];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 2; x++) {
    tot++;
    if (L(x, y) < 128) shadow++;
    if (Math.abs(L(x + 1, y) - L(x, y)) > 100) tr++;
  }
  return { speckle: 100 * tr / tot, coverage: 100 * shadow / tot };
}

/* readPixels отдаёт строки снизу вверх, PNG пишется сверху вниз. */
function flipY(img) {
  const { px, w, h } = img, out = new Uint8Array(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) for (let i = 0; i < st; i++) out[y * st + i] = px[(h - 1 - y) * st + i];
  return out;
}

if (argv.bias) {
  /* Перебор смещения: от заведомо малого (рябь) до заведомо большого (отрыв) */
  const OUT = argv.out || '/tmp/mc3d-bias';
  fs.mkdirSync(OUT, { recursive: true });
  const grid = argv.grid === 'low' ? [
    { name: 'a000', d: 0.00000, s: 0.00000, n: 0.00 },
    { name: 'a005', d: 0.00005, s: 0.00010, n: 0.02 },
    { name: 'a010', d: 0.00010, s: 0.00020, n: 0.05 },
    { name: 'a020', d: 0.00020, s: 0.00040, n: 0.10 },
    { name: 'a030', d: 0.00030, s: 0.00070, n: 0.15 },
    { name: 'a045', d: 0.00045, s: 0.00100, n: 0.22 },
    { name: 'a060', d: 0.00060, s: 0.00140, n: 0.30 },
    { name: 'a090', d: 0.00090, s: 0.00200, n: 0.45 }
  ] : argv.grid === 'fine' ? [
    { name: 'b000', d: 0.0000, s: 0.0000, n: 0.00 },
    { name: 'b025', d: 0.0002, s: 0.0004, n: 0.10 },
    { name: 'b050', d: 0.0004, s: 0.0008, n: 0.20 },
    { name: 'b075', d: 0.0006, s: 0.0012, n: 0.30 },
    { name: 'b100', d: 0.0008, s: 0.0016, n: 0.40 },
    { name: 'b150', d: 0.0012, s: 0.0024, n: 0.55 },
    { name: 'b200', d: 0.0016, s: 0.0032, n: 0.70 },
    { name: 'b300', d: 0.0024, s: 0.0048, n: 1.00 }
  ] : [
    { name: 'ноль',      d: 0.0,     s: 0.0,     n: 0.0 },
    { name: 'мало',      d: 0.0002,  s: 0.0004,  n: 0.05 },
    { name: 'нижний-край', d: 0.0006, s: 0.0012, n: 0.20 },
    { name: 'выбрано',   d: 0.0016,  s: 0.0032,  n: 0.55 },
    { name: 'много',     d: 0.006,   s: 0.012,   n: 2.0 },
    { name: 'верхний-край', d: 0.02, s: 0.04,    n: 6.0 }
  ];
  const { ctx, page, errs } = await boot({ shadow: { debug: 1 } });
  console.log('окно смещения, сцена ' + sc.id + ', ' + HOUR + ':00, высокий профиль\n');
  console.log('  вариант          постоянное  наклонное  нормальное |  рябь %  площадь тени %');
  const imgs = await grabMany(page, grid.map(g => ({ bias: { d: g.d, s: g.s, n: g.n } })));
  grid.forEach((g, i) => {
    const m = speckle(imgs[i]);
    console.log('  ' + g.name.padEnd(16) + String(g.d).padStart(10) + String(g.s).padStart(11) +
                String(g.n).padStart(12) + ' |' + m.speckle.toFixed(3).padStart(8) + m.coverage.toFixed(2).padStart(16));
    writePNG(path.join(OUT, 'bias-' + g.name + '.png'), imgs[i].w, imgs[i].h, flipY(imgs[i]));
  });
  if (errs.length) console.log('\nошибки страницы: ' + errs.join(' | '));
  console.log('\nснимки: ' + OUT);
  await ctx.close();
}

if (argv.stab || !argv.bias) {
  const { ctx, page, errs } = await boot({ shadow: { debug: 1 } });
  const SHIFT = +(argv.shift || 0.5);
  console.log('стабилизация каскадов, сцена ' + sc.id + ', ' + HOUR + ':00, сдвиг ' + SHIFT + ' м\n');
  const dirs = [[SHIFT, 0, 0], [0, 0, SHIFT], [SHIFT * 0.707, 0, SHIFT * 0.707]];
  for (const snap of [true, false]) {
    const set = [{ offset: [0, 0, 0], snap }].concat(dirs.map(d => ({ offset: d, snap })));
    const imgs = await grabMany(page, set);
    const out = imgs.slice(1).map(im => diffPct(imgs[0], im));
    console.log('  привязка к сетке ' + (snap ? 'ВКЛ ' : 'ВЫКЛ') + ': разошлось по краю тени ' +
                out.map(v => v.toFixed(3) + ' %').join(' / ') + '   (сдвиги по X, по Z, по диагонали)');
  }
  await grabMany(page, [{ offset: [0, 0, 0], snap: true }]);
  if (errs.length) console.log('\nошибки страницы: ' + errs.join(' | '));
  await ctx.close();
}

await browser.close();
