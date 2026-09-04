#!/usr/bin/env node
/* =====================================================================
   perf-trace.mjs — что делает главный поток внутри кадра.

   Берёт сэмплирующий профилировщик V8 через CDP (то же, что вкладка
   Performance в DevTools, только без ручной работы) и складывает собственное
   время по функциям. Сцена задаётся так же, как в perf-probe.mjs.

     node tools/perf-trace.mjs --scene=dense --seconds=12
     node tools/perf-trace.mjs --scene=traffic --out=docs/perf/trace-traffic.json
   ===================================================================== */
import { loadPlaywright } from './find-playwright.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

let playwright;
try { playwright = loadPlaywright().pw; }
catch (e) { console.error(e.message); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..', 'index.html');
const INJECT = path.resolve(HERE, 'perf-inject.js');
const REPO = path.resolve(HERE, '..', '..', '..');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const SCENES = {
  street: { p: { x: 90, z: 12.25, yaw: Math.PI / 2 }, bike: { x: 86, z: 12.6 } },
  dense: { p: { x: 55, z: 45, yaw: Math.PI }, bike: { x: 57.5, z: 46.5 } },
  traffic: { p: { x: 93.5, z: 68.5, yaw: Math.PI / 4 }, bike: { x: 91, z: 66 } }
};
const name = argv.scene || 'dense';
const sc = SCENES[name];
if (!sc) { console.error('Сцена: street | dense | traffic'); process.exit(2); }
const SECONDS = +(argv.seconds || 12);
const W = +(argv.width || 1440), H = +(argv.height || 900), DPR = +(argv.dpr || 2);

const save = {
  v: 1, ts: Date.now(),
  p: { x: sc.p.x, z: sc.p.z, yaw: sc.p.yaw, health: 100, stamina: 100, drunk: 0, money: 1500, rep: 30,
       tools: ['screw', 'tester', 'ties', 'lamp'], tool: 0 },
  bike: { x: sc.bike.x, z: sc.bike.z, cond: 100 },
  clock: 17 * 3600, day: 1, heat: 0, missionIndex: 0, missionsDone: [], free: false, freeCount: 0,
  upgrades: {}, stats: {}, flags: { tutorialDone: true }, poles: new Array(24).fill(false), station: 0
};

const browser = await playwright.chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
await page.addInitScript({ path: INJECT });
await page.addInitScript(s => {
  try {
    localStorage.setItem('montazh_city_3d_save_v1', JSON.stringify(s));
    localStorage.setItem('montazh_city_3d_save_v1_opt', JSON.stringify({ camFollow: true, lowFx: false, muted: false }));
  } catch (e) { }
}, save);

await page.goto(pathToFileURL(GAME).href, { waitUntil: 'load' });
await page.waitForSelector('#bCont', { timeout: 120000 });
await page.click('#bCont');

/* прокликиваем брифинг */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let quiet = 0;
for (let i = 0; i < 200 && quiet < 1500; i++) {
  const open = await page.evaluate(() => {
    const d = document.getElementById('dialog'); return !!(d && d.style.display === 'block');
  });
  if (open) { quiet = 0; await page.keyboard.press('Space'); } else quiet += 130;
  await sleep(130);
}

const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });   /* мкс */
await cdp.send('Profiler.start');
await page.evaluate(() => window.__MCPERF.start(0));
await sleep(SECONDS * 1000);
const report = await page.evaluate(() => { window.__MCPERF.stop(); return window.__MCPERF.report(); });
const { profile } = await cdp.send('Profiler.stop');

/* --- своё время по функциям --- */
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
const total = profile.samples.length;
for (const id of profile.samples) {
  const n = byId.get(id); if (!n) continue;
  const cf = n.callFrame;
  const key = (cf.functionName || '(аноним)') + '  [' + (cf.url ? path.basename(cf.url) : '—') +
              ':' + (cf.lineNumber + 1) + ']';
  self.set(key, (self.get(key) || 0) + 1);
}
const durMs = (profile.endTime - profile.startTime) / 1000;
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, c]) => ({
  what: k, samples: c, sharePct: +(c / total * 100).toFixed(2),
  msPerFrame: +(durMs * (c / total) / Math.max(1, report.frames)).toFixed(3)
}));

const out = {
  scene: name, seconds: SECONDS, viewport: { css: [W, H], dpr: DPR },
  profileMs: +durMs.toFixed(1), samples: total, frames: report.frames,
  frameMs: report.frameMs, cpuMs: report.cpuMs, draws: report.draws,
  top: rows
};
const dest = argv.out ? path.resolve(REPO, argv.out) : path.join(HERE, `trace-${name}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));

process.stderr.write(`сцена ${name}: кадр p50 ${report.frameMs.p50}мс, из них главный поток ${report.cpuMs.p50}мс\n`);
for (const r of rows.slice(0, 18))
  process.stderr.write(`  ${String(r.sharePct).padStart(6)}%  ${String(r.msPerFrame).padStart(7)}мс/кадр  ${r.what}\n`);
process.stderr.write('→ ' + path.relative(REPO, dest) + '\n');

await browser.close();
