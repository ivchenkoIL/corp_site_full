#!/usr/bin/env node
/* =====================================================================
   optimize-glb.mjs — ужимает готовые GLB в public/assets без потери вида:
   координаты и нормали хранятся целыми числами (KHR_mesh_quantization,
   Babylon читает их сам), индексы — 16-битными там, где вершин меньше
   65 536. Персонаж худеет с 2.7 до ~1.6 МБ, машина и реквизит — так же.

     node tools/assets/optimize-glb.mjs            все GLB в public/assets
     node tools/assets/optimize-glb.mjs --only oleg
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantize, dedup, prune } from '@gltf-transform/functions';
import { io } from './lib-mesh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
const only = (process.argv.find(a => a.startsWith('--only')) || '').split('=')[1]?.split(',') || null;
const files = [];
for (const d of ['characters', 'props', 'vehicles']) for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.glb')) files.push(path.join(ROOT, d, f));
let before = 0, after = 0;
for (const f of files) {
  if (only && !only.some(o => path.basename(f, '.glb') === o)) continue;
  const b0 = fs.statSync(f).size;
  const doc = await io.read(f);
  if (doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'KHR_mesh_quantization')) { before += b0; after += b0; continue; }
  await doc.transform(dedup(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), prune());
  /* индексы: 16 бит, если хватает */
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const ind = p.getIndices(), n = p.getAttribute('POSITION').getCount();
    if (ind && n < 65536 && !(ind.getArray() instanceof Uint16Array)) ind.setArray(new Uint16Array(ind.getArray()));
  }
  await io.write(f, doc);
  const b1 = fs.statSync(f).size; before += b0; after += b1;
  console.log(path.relative(ROOT, f).padEnd(40) + (b0 / 1048576).toFixed(2) + ' → ' + (b1 / 1048576).toFixed(2) + ' МБ');
}
console.log('Итого ' + (before / 1048576).toFixed(1) + ' → ' + (after / 1048576).toFixed(1) + ' МБ');
