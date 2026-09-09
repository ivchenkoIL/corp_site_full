#!/usr/bin/env node
/* =====================================================================
   compare.mjs — сводит два прогона perf-probe в одну таблицу.

     node tools/compare.mjs docs/perf/mac-chromium.json docs/perf/mac-webkit.json
     node tools/compare.mjs a.json b.json --out=docs/perf/compare.md

   Печатает готовый markdown: по каждой сцене — время кадра, вызовы,
   треугольники, время на GPU (если есть таймер-запросы) и разница в
   процентах, плюс сравнение списка расширений.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const outArg = args.find(a => a.startsWith('--out='));
if (files.length !== 2) {
  console.error('Нужны два файла: node tools/compare.mjs первый.json второй.json [--out=файл.md]');
  process.exit(2);
}
const [A, B] = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const nameOf = d => `${d.browser} ${String(d.browserVersion || '').split(' ').pop() || ''}`.trim();
let NA = nameOf(A), NB = nameOf(B);
/* Два прогона одного браузера различаем по разрешению, а если и оно совпало —
   по имени файла. Иначе в шапке две одинаковые колонки. */
if (NA === NB) {
  const vp = d => `${d.viewport.css.join('×')}@${d.viewport.dpr}`;
  if (vp(A) !== vp(B)) { NA += ` ${vp(A)}`; NB += ` ${vp(B)}`; }
  else { NA += ` (${path.basename(files[0])})`; NB += ` (${path.basename(files[1])})`; }
}

const L = [];
const p = s => L.push(s);
const num = v => {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return v.toLocaleString('ru-RU');
  return v.toFixed(v < 10 ? 2 : 1);
};
/* «Быстрее» считаем по времени кадра: меньше — лучше. */
function delta(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || !a || !b) return '—';
  if (Math.abs(b - a) / a < 0.005) return 'поровну';
  const faster = b > a ? NA : NB;
  const ratio = b > a ? b / a : a / b;
  /* До полутора раз понятнее в процентах, дальше — в разах. */
  return ratio < 1.5
    ? `${faster} быстрее на ${((ratio - 1) * 100).toFixed(0)} %`
    : `${faster} быстрее в ${ratio.toFixed(1).replace('.', ',')} раза`;
}

p(`# Сравнение прогонов: ${NA} против ${NB}`);
p('');
p(`| | ${NA} | ${NB} |`);
p('| --- | --- | --- |');
p(`| Снято | ${A.when} | ${B.when} |`);
p(`| Рендерер | ${A.common?.ctx?.unmasked || A.common?.ctx?.renderer || '—'} | ${B.common?.ctx?.unmasked || B.common?.ctx?.renderer || '—'} |`);
p(`| Окно | ${A.viewport.css.join('×')} @ dpr ${A.viewport.dpr} | ${B.viewport.css.join('×')} @ dpr ${B.viewport.dpr} |`);
p(`| Профиль качества | ${A.quality ? A.quality + (A.dynamic ? ', авто-масштаб' : '') : '— (до этапа 02)'} | ${B.quality ? B.quality + (B.dynamic ? ', авто-масштаб' : '') : '— (до этапа 02)'} |`);
p(`| Ядер у хоста | ${A.host?.cpus ?? '—'} | ${B.host?.cpus ?? '—'} |`);
p('');

/* фаза текстур: от отметки «генерируем текстуры» до «строим район» */
function texPhaseMs(boot) {
  const ph = boot?.phases || [];
  const a = ph.find(p => p.name === 'load:генерируем текстуры'), b = ph.find(p => p.name === 'load:строим район');
  return a && b ? +(b.t - a.t).toFixed(1) : null;
}
const byId = d => Object.fromEntries(d.scenes.map(s => [s.scene, s]));
const sa = byId(A), sb = byId(B);
for (const id of Object.keys(sa)) {
  const x = sa[id], y = sb[id];
  if (!y) continue;
  p(`## ${x.title || id}`);
  p('');
  p(`| Метрика | ${NA} | ${NB} | Разница |`);
  p('| --- | ---: | ---: | --- |');
  const rows = [
    ['FPS (по медиане кадра)', x.report.fpsFromP50, y.report.fpsFromP50, null],
    ['Время кадра p50, мс', x.report.frameMs.p50, y.report.frameMs.p50, delta(x.report.frameMs.p50, y.report.frameMs.p50)],
    ['Время кадра p95, мс', x.report.frameMs.p95, y.report.frameMs.p95, delta(x.report.frameMs.p95, y.report.frameMs.p95)],
    ['Главный поток p50, мс', x.report.cpuMs.p50, y.report.cpuMs.p50, delta(x.report.cpuMs.p50, y.report.cpuMs.p50)],
    ['Draw call\'ов p50', x.report.draws.p50, y.report.draws.p50, null],
    ['Треугольников p50', x.report.tris.p50, y.report.tris.p50, null],
    ['Время GPU p50, мс', x.report.gpuMs?.p50 ?? null, y.report.gpuMs?.p50 ?? null,
      delta(x.report.gpuMs?.p50, y.report.gpuMs?.p50)],
    ['Буфер отрисовки', x.report.render ? x.report.render.w + '×' + x.report.render.h : null, y.report.render ? y.report.render.w + '×' + y.report.render.h : null, null],
    ['Интервалов в выборке', x.report.frameMsSamples, y.report.frameMsSamples, null],
    ['Загрузка до конца заставки, мс', x.boot?.doneAt, y.boot?.doneAt, delta(x.boot?.doneAt, y.boot?.doneAt)],
    ['— из них генерация текстур, мс', texPhaseMs(x.boot), texPhaseMs(y.boot), delta(texPhaseMs(x.boot), texPhaseMs(y.boot))]
  ];
  for (const [k, va, vb, d] of rows) p(`| ${k} | ${num(va)} | ${num(vb)} | ${d || ''} |`);
  p('');
  /* проходы */
  if (x.passes?.available && y.passes?.available) {
    const yb = Object.fromEntries(y.passes.rows.map(r => [r.pass, r]));
    p(`| Проход | ${NA}, мс | ${NB}, мс |`);
    p('| --- | ---: | ---: |');
    for (const r of x.passes.rows) p(`| ${r.pass} | ${num(r.msMedian)} | ${num(yb[r.pass]?.msMedian ?? null)} |`);
    p('');
  }
}

/* расширения */
const ea = A.common?.ext, eb = B.common?.ext;
if (ea && eb) {
  p('## Расширения WebGL2');
  p('');
  p(`| Расширение | ${NA} | ${NB} |`);
  p('| --- | :---: | :---: |');
  const keys = [...new Set([...Object.keys(ea.checked || {}), ...Object.keys(eb.checked || {})])];
  const mark = v => v ? 'есть' : '**нет**';
  for (const k of keys) p(`| \`${k}\` | ${mark(ea.checked?.[k])} | ${mark(eb.checked?.[k])} |`);
  p('');
  const onlyA = (ea.all || []).filter(x => !(eb.all || []).includes(x));
  const onlyB = (eb.all || []).filter(x => !(ea.all || []).includes(x));
  p(`Всего расширений: ${NA} — ${(ea.all || []).length}, ${NB} — ${(eb.all || []).length}.`);
  p('');
  if (onlyA.length) { p(`Только в ${NA}:`); p(''); p('```'); p(onlyA.join('\n')); p('```'); p(''); }
  if (onlyB.length) { p(`Только в ${NB}:`); p(''); p('```'); p(onlyB.join('\n')); p('```'); p(''); }
}

/* память и загрузка — берём из общего снимка первого прогона каждой стороны */
const ma = A.common?.mem, mb = B.common?.mem;
if (ma && mb) {
  p('## Память');
  p('');
  p(`| | ${NA} | ${NB} |`);
  p('| --- | ---: | ---: |');
  p(`| Текстур (объектов GL) | ${ma.texCount} | ${mb.texCount} |`);
  p(`| Нулевой уровень, МиБ | ${num(ma.texMiBL0)} | ${num(mb.texMiBL0)} |`);
  p(`| Текстуры с мипами, МиБ | ${num(ma.texMiBWithMips)} | ${num(mb.texMiBWithMips)} |`);
  p(`| Буферы, МиБ | ${num(ma.bufferMiB)} | ${num(mb.bufferMiB)} |`);
  p('');
}

const text = L.join('\n') + '\n';
if (outArg) {
  const dest = outArg.slice('--out='.length);
  fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
  fs.writeFileSync(dest, text);
  console.error('→ ' + dest);
} else process.stdout.write(text);
