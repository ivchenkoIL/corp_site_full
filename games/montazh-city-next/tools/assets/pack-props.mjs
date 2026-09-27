#!/usr/bin/env node
/* =====================================================================
   pack-props.mjs — модели Poly Haven (glTF + отдельные текстуры) в
   одиночные GLB для веба: текстуры ужимаются и перекодируются в WebP
   (EXT_texture_webp), геометрия чистится. Заодно пишется каталог
   public/assets/props/catalog.json: размеры, узлы, из чего собрано —
   по нему движок раскладывает реквизит, не открывая файлов.

     node tools/assets/pack-props.mjs                 все модели из sources.json
     node tools/assets/pack-props.mjs --only old_tyre
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { io, worldMatrix, xformPoint } from './lib-mesh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'assets-src', 'polyhaven', 'models');
const OUT = path.join(ROOT, 'public', 'assets', 'props');
const SOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets-src', 'sources.json'), 'utf8'));
const only = (process.argv.find(a => a.startsWith('--only')) || '').split('=')[1]?.split(',') || null;

/* мелочь видна с пары метров — ей хватит 512; крупному — 1024 */
/* из наборов оставляем только то, что ставит движок: остальное — лишние мегабайты */
const KEEP = {
  modular_electricity_poles: ['support_large_01', 'insulators_large'],
  modular_chainlink_fence: ['modular_chainlink_fence', 'modular_chainlink_fence_post'],
  grass_medium_01: ['grass_medium_01_tall_a_LOD0', 'grass_medium_01_tall_b_LOD0', 'grass_medium_01_tall_c_LOD0', 'grass_medium_01_mid_b_LOD0', 'grass_medium_01_small_a_LOD0'],
  grass_medium_02: ['grass_medium_02_a', 'grass_medium_02_c', 'grass_medium_02_e'],
  dandelion_01: ['dandelion_01_c_LOD0', 'dandelion_01_d_LOD0', 'dandelion_01_e_LOD0'],
  nettle_plant: ['nettle_plant_small_b_LOD0'],
  weed_plant_02: ['weed_plant_02_b_LOD0', 'weed_plant_02_c_LOD0', 'weed_plant_02_d_LOD0'],
  celandine_01: ['celandine_01_a_LOD0', 'celandine_01_b_LOD0', 'celandine_01_c_LOD0', 'celandine_01_e_LOD0']
};
const TEX = { covered_car: 1024, utility_box_02: 1024, concrete_road_barrier: 1024, modular_electricity_poles: 1024, rollershutter_door: 1024, painted_wooden_bench: 1024 };
fs.mkdirSync(OUT, { recursive: true });
const catPath = path.join(OUT, 'catalog.json');
const catalog = fs.existsSync(catPath) ? JSON.parse(fs.readFileSync(catPath, 'utf8')) : {};
for (const k of Object.keys(catalog)) if (!SOURCES.polyhaven.models[k]) delete catalog[k];
let total = 0;

for (const id of Object.keys(SOURCES.polyhaven.models)) {
  if (only && !only.includes(id)) continue;
  const file = path.join(SRC, id, id + '.gltf');
  if (!fs.existsSync(file)) { console.warn('нет ' + id + ' — сначала npm run assets'); continue; }
  const doc = await io.read(file);
  const root = doc.getRoot();
  const max = TEX[id] || 512;
  if (KEEP[id]) for (const n of root.listNodes()) if (n.getMesh() && !KEEP[id].includes(n.getName())) n.dispose();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const t of root.listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const meta = await sharp(Buffer.from(img)).metadata();
    const s = Math.min(max, meta.width || max);
    const isNormal = /nor/i.test(t.getName() || t.getURI() || '');
    const out = await sharp(Buffer.from(img)).resize(s, s, { fit: 'inside' }).webp({ quality: isNormal ? 90 : 84, effort: 5, alphaQuality: 90 }).toBuffer();
    t.setImage(new Uint8Array(out)).setMimeType('image/webp').setURI('');
  }
  await doc.transform(weld(), dedup(), prune());
  /* габариты и узлы с сетками — для раскладки */
  const nodes = [];
  let min = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], tris = 0;
  for (const n of root.listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const W = worldMatrix(n);
    let nmin = [Infinity, Infinity, Infinity], nmax = [-Infinity, -Infinity, -Infinity];
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION'), e = [];
      for (let i = 0; i < pos.getCount(); i++) {
        const v = xformPoint(W, pos.getElement(i, e));
        for (let k = 0; k < 3; k++) { nmin[k] = Math.min(nmin[k], v[k]); nmax[k] = Math.max(nmax[k], v[k]); }
      }
      tris += (p.getIndices() ? p.getIndices().getCount() : pos.getCount()) / 3;
    }
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], nmin[k]); mx[k] = Math.max(mx[k], nmax[k]); }
    nodes.push({ name: n.getName(), min: nmin.map(v => +v.toFixed(3)), max: nmax.map(v => +v.toFixed(3)) });
  }
  const outFile = path.join(OUT, id + '.glb');
  await io.write(outFile, doc);
  const size = fs.statSync(outFile).size;
  total += size;
  catalog[id] = {
    file: id + '.glb', source: 'https://polyhaven.com/a/' + id, license: 'CC0',
    min: min.map(v => +v.toFixed(3)), max: mx.map(v => +v.toFixed(3)), triangles: Math.round(tris),
    nodes: nodes.length > 1 ? nodes : undefined, kb: Math.round(size / 1024)
  };
  console.log(id.padEnd(28) + (size / 1048576).toFixed(2) + ' МБ  ' + Math.round(tris / 1000) + 'k треуг.  ' +
    (mx[0] - min[0]).toFixed(2) + '×' + (mx[1] - min[1]).toFixed(2) + '×' + (mx[2] - min[2]).toFixed(2) + ' м' + (nodes.length > 1 ? '  узлов ' + nodes.length : ''));
}
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 1) + '\n');
console.log('Итого ' + (total / 1048576).toFixed(1) + ' МБ, каталог: public/assets/props/catalog.json');
