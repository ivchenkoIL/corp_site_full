#!/usr/bin/env node
/* =====================================================================
   pack-artifact.mjs — готовит сборку dist-game/ к публикации артефактом
   Claude. Артефакт раздаёт только веб-типы файлов (страницы, скрипты,
   JSON, картинки), GLB и HDR среди них нет. Поэтому они кладутся рядом
   текстом (base64, *.glb.txt), а страница ставит метку mc-packed — и
   движок (src/engine/babylon/source.js) читает их оттуда.

     npx vite build --config vite.game.config.js && node tools/pack-artifact.mjs

   На выходе dist-artifact/: page.html (без <html>/<head>/<body> — обёртку
   артефакт добавляет сам), файлы и files.json — карта для публикации.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'dist-game'), OUT = path.join(ROOT, 'dist-artifact');
if (!fs.existsSync(SRC)) { console.error('Нет dist-game — сначала npx vite build --config vite.game.config.js'); process.exit(2); }
fs.rmSync(OUT, { recursive: true, force: true });
const files = {};
let total = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name), rel = path.relative(SRC, p);
    if (e.isDirectory()) { walk(p); continue; }
    if (rel === 'index.html') continue;
    let outRel = rel, data = fs.readFileSync(p);
    if (/\.(glb|hdr)$/.test(rel)) { outRel = rel + '.txt'; data = Buffer.from(data.toString('base64')); }
    const o = path.join(OUT, outRel);
    fs.mkdirSync(path.dirname(o), { recursive: true });
    fs.writeFileSync(o, data);
    files[outRel] = o; total += data.length;
  }
}
walk(SRC);
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const title = /<title>([^<]*)<\/title>/.exec(html)[1];
const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '';
const js = /src="\.\/(js\/[^"]+\.js)"/.exec(html)[1], css = /href="\.\/(js\/[^"]+\.css)"/.exec(html)[1];
const page = `<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="mc-packed" content="1">
<link rel="stylesheet" href="./${css}">
<script type="module" src="./${js}"></script>
`;
fs.writeFileSync(path.join(OUT, 'page.html'), page);
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files));
console.log('Файлов ' + Object.keys(files).length + ', всего ' + (total / 1048576).toFixed(1) + ' МБ (лимит артефакта 64 МБ, 255 файлов)');
