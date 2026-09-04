#!/usr/bin/env node
/* =====================================================================
   perf-probe.mjs — базовый замер «Монтаж-Сити 3D».

   Игру не трогает: вся телеметрия ставится через perf-inject.js до загрузки
   страницы. Сцена задаётся через штатное сохранение игры (localStorage),
   поэтому каждый прогон попадает ровно в ту же точку района, в то же время
   суток и с тем же посевом случайных чисел.

   Запуск:
     node tools/perf-probe.mjs                          # chromium, три сцены
     node tools/perf-probe.mjs --browser=webkit         # движок Safari
     node tools/perf-probe.mjs --scene=dense            # одна сцена
     node tools/perf-probe.mjs --width=1440 --height=900 --dpr=2
     node tools/perf-probe.mjs --warmup=6 --measure=12  # секунды
     node tools/perf-probe.mjs --shots=docs/shots/00-base
     node tools/perf-probe.mjs --quality=high --dynamic=1  # профиль и авто-масштаб

   Если playwright лежит не рядом, укажи путь:
     NODE_PATH=/usr/lib/node_modules node tools/perf-probe.mjs
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { SCENES, saveFor, optsFor, SAVE_KEY, OPT_KEY } from './scenes.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

let playwright, playwrightFrom;
try { const r = loadPlaywright(); playwright = r.pw; playwrightFrom = r.from; }
catch (e) { console.error(e.message); process.exit(2); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const INJECT = path.resolve(HERE, 'perf-inject.js');
const REPO = path.resolve(HERE, '..', '..', '..');

/* ------------------------------- аргументы ------------------------------- */
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? 'true' : m[2]] : [a, 'true'];
}));
const OPT = {
  browser: argv.browser || 'chromium',
  scene: argv.scene || 'all',
  width: +(argv.width || 1440),
  height: +(argv.height || 900),
  dpr: +(argv.dpr || 2),
  warmup: +(argv.warmup || 6) * 1000,
  measure: +(argv.measure || 12) * 1000,
  profile: +(argv.profile || 6) * 1000,
  minFrames: +(argv.minFrames || 60),
  shots: argv.shots ? path.resolve(REPO, argv.shots) : null,
  out: argv.out ? path.resolve(REPO, argv.out) : null,
  headed: argv.headed === 'true',
  /* профиль качества (low | medium | high) и авто-масштаб; по умолчанию
     авто-масштаб выключен — иначе цифры не сравнить между прогонами */
  quality: argv.quality || 'medium',
  dynamic: argv.dynamic === '1' || argv.dynamic === 'true'
};

/* сцены, сохранение и настройки — в scenes.mjs, общие для всех инструментов */
const OPTS = optsFor(OPT.quality, OPT.dynamic);

/* --------------------------------- прогон -------------------------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runScene(browser, sc, common) {
  const ctx = await browser.newContext({
    viewport: { width: OPT.width, height: OPT.height },
    deviceScaleFactor: OPT.dpr,
    reducedMotion: 'no-preference'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.addInitScript({ path: INJECT });
  await page.addInitScript(({ save, opts, keys }) => {
    try {
      localStorage.setItem(keys.save, JSON.stringify(save));
      localStorage.setItem(keys.opt, JSON.stringify(opts));
    } catch (e) { window.__MCPERF_STORAGE_FAIL = String(e); }
  }, { save: saveFor(sc), opts: OPTS, keys: { save: SAVE_KEY, opt: OPT_KEY } });

  const url = pathToFileURL(GAME).href;
  const tNav = Date.now();
  await page.goto(url, { waitUntil: 'load' });

  /* ждём, пока догрузится район и покажется меню */
  await page.waitForSelector('#bCont', { timeout: 120000 });
  const loadWallMs = Date.now() - tNav;

  const storageFail = await page.evaluate(() => window.__MCPERF_STORAGE_FAIL || null);
  const snap = await page.evaluate(() => window.__MCPERF.snapshot());

  /* входим в смену */
  await page.click('#bCont');
  await page.waitForTimeout(400);

  /* Прогрев. Заодно прокликиваем брифинг заявки: после загрузки сохранения
     Тамара звонит через 2.5 секунды, а пока открыт диалог, игра не считает
     мир — машины стоят и замер получился бы не про сцену. */
  const dialogOpen = () => page.evaluate(() => {
    const d = document.getElementById('dialog');
    return !!(d && d.style.display === 'block');
  });
  const tWarm = Date.now();
  let quiet = 0;
  while (Date.now() - tWarm < OPT.warmup || quiet < 1500) {
    if (await dialogOpen()) { quiet = 0; await page.keyboard.press('Space'); }
    else quiet += 130;
    await sleep(130);
    /* Реплика прокликивается по одной за кадр, поэтому длинный брифинг на
       медленной машине идёт десятки секунд — запас нужен щедрый. */
    if (Date.now() - tWarm > OPT.warmup + 120000) break;
  }

  /* Скриншот снимаем здесь: диалог уже прокликан, мир устоялся, а замер ещё
     не начат — кадр в кадре не сдвинут ничем посторонним. */
  let shot = null;
  if (OPT.shots) {
    fs.mkdirSync(OPT.shots, { recursive: true });
    shot = path.join(OPT.shots, `${sc.id}-${OPT.browser}.png`);
    await page.screenshot({ path: shot, scale: 'css' });
  }

  /* 1) чистый замер кадра.
        Пока идёт окно, приглядываем за диалогами: житель района может подойти
        познакомиться в любой момент, а с открытым диалогом игра не считает мир.
        Такие кадры инструментовка и так выбрасывает, но закрыть диалог надо —
        иначе окно целиком уйдёт в пустоту. */
  await page.evaluate(() => window.__MCPERF.start(0));
  const tM = Date.now();
  const hardCap = OPT.measure * 4;
  for (;;) {
    const el = Date.now() - tM;
    const clean = await page.evaluate(() => window.__MCPERF.cleanCount());
    if (el >= OPT.measure && clean >= OPT.minFrames) break;
    if (el >= hardCap) break;
    await sleep(200);
    if (await dialogOpen()) await page.keyboard.press('Space');
  }
  const measuredMs = Date.now() - tM;
  const report = await page.evaluate(() => { window.__MCPERF.stop(); return window.__MCPERF.report(); });
  report.windowMs = measuredMs;
  if (report.frameMsSamples < 20)
    process.stderr.write(`  ! интервалов всего ${report.frameMsSamples}, p95 на такой выборке шаткий ` +
                         `(выброшено ${report.droppedDialogFrames} кадров на диалогах).\n`);
  const frames = await page.evaluate(() => window.__MCPERF.frames.map(f => [f.ts, f.cpuMs, f.gpuMs, f.draws, f.tris, f.dlg ? 1 : 0]));

  /* 2) разбор кадра по проходам. Кадры с gl.finish() заведомо медленнее
        обычных, поэтому окно отдельное и короткое, а в FPS они не идут. */
  await page.evaluate(() => window.__MCPERF.start(1));
  const tP = Date.now();
  while (Date.now() - tP < OPT.profile) {
    await sleep(200);
    if (await dialogOpen()) await page.keyboard.press('Space');
  }
  const passes = await page.evaluate(() => { window.__MCPERF.stop(); return window.__MCPERF.passReport(); });

  await ctx.close();
  return {
    scene: sc.id, title: sc.title, where: sc.where, why: sc.why,
    loadWallMs, storageFail, snapshot: common ? undefined : snap, boot: snap.boot,
    report, passes, framesRaw: frames, errors, shot: shot ? path.relative(REPO, shot) : null
  };
}

/* --------------------------------- main ---------------------------------- */
const type = playwright[OPT.browser];
if (!type) { console.error('Неизвестный браузер: ' + OPT.browser); process.exit(2); }

const launchArgs = OPT.browser === 'chromium'
  ? ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
     '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required']
  : [];

const browser = await type.launch({ headless: !OPT.headed, args: launchArgs });
const list = OPT.scene === 'all' ? Object.values(SCENES) : [SCENES[OPT.scene]].filter(Boolean);
if (!list.length) { console.error('Нет такой сцены: ' + OPT.scene); process.exit(2); }

const out = {
  when: new Date().toISOString(),
  browser: OPT.browser,
  browserVersion: browser.version(),
  playwrightFrom,
  viewport: { css: [OPT.width, OPT.height], dpr: OPT.dpr },
  quality: OPT.quality, dynamic: OPT.dynamic,
  warmupMs: OPT.warmup, measureMs: OPT.measure, profileMs: OPT.profile, minFrames: OPT.minFrames,
  host: { platform: process.platform, arch: process.arch, cpus: (await import('node:os')).cpus().length },
  scenes: []
};

let first = true;
for (const sc of list) {
  process.stderr.write(`· ${sc.title} (${sc.id}) … `);
  const r = await runScene(browser, sc, !first);
  if (first) { out.common = r.snapshot; first = false; }
  delete r.snapshot;
  out.scenes.push(r);
  const rep = r.report;
  process.stderr.write(
    `fps≈${rep.fpsFromP50}  p50 ${rep.frameMs.p50}мс  p95 ${rep.frameMs.p95}мс  ` +
    `draw ${rep.draws.p50}  тр ${rep.tris.p50}  gpu ${rep.gpuMs.p50 ?? '—'}  ` +
    (rep.render ? `буфер ${rep.render.w}×${rep.render.h}${rep.render.wMin !== rep.render.wMax ? ' (' + rep.render.wMin + '…' + rep.render.wMax + ')' : ''}  ` : '') +
    `(${rep.frames} кадров, ${rep.frameMsSamples} интервалов, ${rep.droppedDialogFrames} выброшено)\n`);
  if (r.passes && r.passes.available)
    for (const row of r.passes.rows)
      process.stderr.write(`      ${String(row.share).padStart(5)}%  ${String(row.msMedian).padStart(8)}мс  ${row.pass}\n`);
}
await browser.close();

const dest = OPT.out || path.join(HERE, `perf-${OPT.browser}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
process.stderr.write('→ ' + path.relative(REPO, dest) + '\n');
