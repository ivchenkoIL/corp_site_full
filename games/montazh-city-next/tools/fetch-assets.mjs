#!/usr/bin/env node
/* =====================================================================
   fetch-assets.mjs — скачивает сторонние ассеты по списку
   assets-src/sources.json в assets-src/polyhaven/ (в git не идут: их
   всегда можно скачать заново этой же командой). Сверяет md5 из API Poly
   Haven, уже скачанное и целое не трогает.

     node tools/fetch-assets.mjs            всё по списку
     node tools/fetch-assets.mjs --only asphalt_02,security_light
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets-src', 'sources.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets-src', 'polyhaven');
const only = (process.argv.find(a => a.startsWith('--only')) || '').split('=')[1]?.split(',') || null;
const API = 'https://api.polyhaven.com/files/';

async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('Не отвечает: ' + url);
}
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
let bytes = 0, files = 0, skipped = 0;
async function download(url, file, sum) {
  if (fs.existsSync(file) && (!sum || md5(file) === sum)) { skipped++; return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(file, buf);
      if (sum && md5(file) !== sum) throw new Error('md5');
      bytes += buf.length; files++;
      return;
    } catch (e) { if (i === 3) throw new Error('Не скачалось ' + url + ': ' + e.message); await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
}
const want = id => !only || only.includes(id);

for (const [id, resList] of Object.entries(SRC.polyhaven.hdris || {})) {
  if (!want(id)) continue;
  const j = await getJSON(API + id);
  for (const res of resList) { const f = j.hdri[res].hdr; await download(f.url, path.join(OUT, 'hdris', id + '_' + res + '.hdr'), f.md5); }
  console.log('HDRI     ' + id);
}
for (const [id, res] of Object.entries(SRC.polyhaven.textures || {})) {
  if (!want(id)) continue;
  const j = await getJSON(API + id);
  for (const [map, fmt] of [['Diffuse', 'jpg'], ['nor_gl', 'jpg'], ['arm', 'jpg']]) {
    const f = j[map] && j[map][res] && j[map][res][fmt];
    if (!f) { console.warn('  нет карты ' + map + ' у ' + id); continue; }
    await download(f.url, path.join(OUT, 'textures', id, map.toLowerCase() + '.' + fmt), f.md5);
  }
  console.log('текстура ' + id + ' ' + res);
}
for (const [id, res] of Object.entries(SRC.polyhaven.models || {})) {
  if (!want(id)) continue;
  const j = await getJSON(API + id);
  const g = j.gltf[res].gltf;
  const dir = path.join(OUT, 'models', id);
  await download(g.url, path.join(dir, id + '.gltf'), g.md5);
  for (const [rel, f] of Object.entries(g.include || {})) await download(f.url, path.join(dir, rel), f.md5);
  console.log('модель   ' + id + ' ' + res);
}
console.log('Скачано ' + files + ' файлов, ' + (bytes / 1048576).toFixed(1) + ' МБ; уже были на месте: ' + skipped + '.');
