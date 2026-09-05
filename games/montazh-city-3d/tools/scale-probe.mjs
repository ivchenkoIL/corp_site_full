#!/usr/bin/env node
/* =====================================================================
   scale-probe.mjs — что на самом деле делает авто-масштаб.

   Обычный perf-probe для этого не годится: его обвязка держит единственный
   слот TIME_ELAPSED_EXT, игра своего запроса не открывает и остаётся без
   сигнала о времени GPU. Здесь наоборот — телеметрия не ставится вовсе,
   таймер отдан игре, а наблюдаем мы за её же состоянием через крючок
   ?mc3d-test: масштаб, размер буфера сцены, время GPU, бюджет, частота
   монитора, число шагов контроллера и доля пропущенных кадров.

     node tools/scale-probe.mjs --quality=high --seconds=40
     node tools/scale-probe.mjs --quality=high --headed
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
const sc = SCENES[argv.scene || 'street'];
const SEC = +(argv.seconds || 40);
const W = +(argv.width || 1440), H = +(argv.height || 900), DPR = +(argv.dpr || 2);

const browser = await playwright.chromium.launch({
  headless: argv.headed !== 'true',
  args: ['--use-angle=default', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e && e.message || e)));

/* Никакого perf-inject: таймер-запрос должен достаться игре. */
await page.addInitScript(({ save, opts, keys }) => {
  try { localStorage.setItem(keys.save, JSON.stringify(save)); localStorage.setItem(keys.opt, JSON.stringify(opts)); } catch (e) { }
}, { save: saveFor(sc), opts: optsFor(argv.quality || 'high', true), keys: { save: SAVE_KEY, opt: OPT_KEY } });

await page.goto(pathToFileURL(GAME).href + '?mc3d-test', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__MC3D, null, { timeout: 120000 });
await page.click('#bCont');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const dialogOpen = () => page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d.style.display === 'block'); });
/* прокликиваем брифинг */
for (let i = 0, quiet = 0; i < 400 && quiet < 12; i++) {
  if (await dialogOpen()) { quiet = 0; await page.keyboard.press('Space'); } else quiet++;
  await sleep(130);
}

const rows = [];
const t0 = Date.now();
while (Date.now() - t0 < SEC * 1000) {
  await sleep(500);
  if (await dialogOpen()) await page.keyboard.press('Space');
  rows.push(await page.evaluate(() => {
    const M = window.__MC3D, P = M.Perf, G = M.GL;
    return {
      t: +((performance.now()) / 1000).toFixed(1),
      scale: +G.scale.toFixed(3),
      buf: G.gl.drawingBufferWidth + '×' + G.gl.drawingBufferHeight,
      hdr: (window.__MC3D.HDR ? '' : ''),
      gpu: P.gpuMs === null ? null : +P.gpuMs.toFixed(2),
      gpuAvg: +P.gpuAvg.toFixed(2),
      hz: P.hz, budget: +P.budgetMs().toFixed(1),
      steps: P.steps, drops: P.drops, dropRate: +P.dropRate.toFixed(3),
      dt: +P.dtRaw.toFixed(1), dynamic: !!M.S.dynamic
    };
  }));
}
await browser.close();

const first = rows[0], last = rows[rows.length - 1];
const scales = rows.map(r => r.scale);
const gpus = rows.map(r => r.gpu).filter(v => v !== null);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
console.log('сцена ' + sc.id + ', профиль ' + (argv.quality || 'high') + ', ' +
            (argv.headed === 'true' ? 'headed' : 'headless') + ', авто-масштаб включён: ' + last.dynamic);
console.log('монитор по измерению игры: ' + last.hz + ' Гц, бюджет кадра ' + last.budget + ' мс');
console.log('время GPU по собственному таймеру игры: медиана ' + med(gpus) + ' мс, среднее скользящее ' + last.gpuAvg + ' мс');
console.log('масштаб: старт ' + first.scale + ', конец ' + last.scale + ', минимум ' + Math.min(...scales) + ', максимум ' + Math.max(...scales));
console.log('шагов контроллера за прогон: ' + (last.steps - first.steps) + ', пропущенных кадров ' + (last.drops - first.drops) + ', доля пропусков ' + last.dropRate);
console.log('интервал rAF в конце: ' + last.dt + ' мс');
console.log('\nвремя  масштаб  буфер        GPU    бюджет  шагов  пропусков');
for (const r of rows.filter((_, i) => i % 4 === 0))
  console.log(String(r.t).padStart(6), String(r.scale).padStart(7), r.buf.padStart(12),
              String(r.gpu ?? '—').padStart(6), String(r.budget).padStart(7), String(r.steps).padStart(6), String(r.drops).padStart(9));
if (errors.length) console.log('\nошибки страницы: ' + errors.join(' | '));
