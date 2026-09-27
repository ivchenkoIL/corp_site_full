#!/usr/bin/env node
/* =====================================================================
   build-car.mjs — машина из генератора (одна сплошная сетка) в игровую:
   размер как у «седана» старой игры, нос на +Z, колёса отдельными узлами
   с осью в центре — чтобы крутились, маска краски — чтобы одна модель
   ездила по району разными цветами.

     node tools/assets/build-car.mjs --in assets-src/car/car_hy21_v1.glb --out public/assets/vehicles/lada.glb

   Колёса ищутся сами: пятна касания земли дают центры, радиус подбирается
   по тому, сколько вершин ложится на окружность шины снизу. Всё, что
   внутри цилиндра колеса, уходит в узел колеса, остальное — кузов.
   Краска — это светлые, неметаллические и глянцевые пиксели текстуры:
   белая эмаль «семёрки». В маске они белые; шейдер перекрашивает их в
   цвет машины, сохраняя грязь и свет.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { Document } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { io, worldMatrix, xformPoint } from './lib-mesh.mjs';

const argv = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : null).filter(Boolean));
const IN = argv.in, OUT = argv.out, LENGTH = +(argv.length || 4.2);
const raw = await io.read(IN);
const node = raw.getRoot().listNodes().find(n => n.getMesh());
const prim = node.getMesh().listPrimitives()[0];
const WM = worldMatrix(node);
const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL'), uvA = prim.getAttribute('TEXCOORD_0');
const NV = pos.getCount(), e = [];
let P = [], N = [];
const R3 = [WM[0], WM[1], WM[2], WM[4], WM[5], WM[6], WM[8], WM[9], WM[10]];
for (let i = 0; i < NV; i++) {
  P.push(xformPoint(WM, pos.getElement(i, e)));
  const n = nrm.getElement(i, e);
  const v = [R3[0] * n[0] + R3[3] * n[1] + R3[6] * n[2], R3[1] * n[0] + R3[4] * n[1] + R3[7] * n[2], R3[2] * n[0] + R3[5] * n[1] + R3[8] * n[2]];
  const l = Math.hypot(...v) || 1; N.push([v[0] / l, v[1] / l, v[2] / l]);
}
/* масштаб по длине, пол на нуле, по x — по центру */
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const p of P) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
const s = LENGTH / (mx[2] - mn[2]);
P = P.map(p => [(p[0] - (mn[0] + mx[0]) / 2) * s, (p[1] - mn[1]) * s, p[2] * s]);

/* пятна касания: самые нижние вершины, разложенные на четыре угла */
const low = P.filter(p => p[1] < 0.035);
const zMid = low.reduce((a, p) => a + p[2], 0) / low.length;
const wheels = [];
for (const [fz, name] of [[1, 'F'], [-1, 'R']]) for (const [fx, side] of [[1, 'L'], [-1, 'R']]) {
  const g = low.filter(p => Math.sign(p[2] - zMid) === fz && Math.sign(p[0]) === fx);
  const xc = g.reduce((a, p) => a + p[0], 0) / g.length, zc = g.reduce((a, p) => a + p[2], 0) / g.length;
  /* радиус: окружность шины снизу, где её не закрывает крыло */
  let best = 0, br = 0.3;
  for (let r = 0.22; r <= 0.42; r += 0.004) {
    let c = 0;
    for (const p of P) if (Math.abs(p[0] - xc) < 0.12 && p[1] < r && Math.abs(Math.hypot(p[2] - zc, p[1] - r) - r) < 0.012) c++;
    if (c > best) { best = c; br = r; }
  }
  wheels.push({ id: name + side, c: [xc, br, zc], r: br });
}
/* по z — середина между осями, чтобы машина стояла там же, где у старой логики */
const zAx = (wheels[0].c[2] + wheels[2].c[2]) / 2;
P = P.map(p => [p[0], p[1], p[2] - zAx]);
for (const w of wheels) w.c[2] -= zAx;
console.log('Колёса:', wheels.map(w => w.id + ' x' + w.c[0].toFixed(2) + ' z' + w.c[2].toFixed(2) + ' r' + w.r.toFixed(3)).join(' | '));

/* треугольники: в какое колесо, если в какое-то */
const idx = prim.getIndices().getArray();
const inWheel = (p, w) => Math.abs(p[0] - w.c[0]) < 0.15 && Math.hypot(p[2] - w.c[2], p[1] - w.c[1]) < w.r + 0.014 && p[1] < 2 * w.r - 0.03;
const parts = { body: [] }; for (const w of wheels) parts[w.id] = [];
for (let t = 0; t < idx.length; t += 3) {
  const a = P[idx[t]], b = P[idx[t + 1]], c = P[idx[t + 2]];
  let owner = 'body';
  for (const w of wheels) if (inWheel(a, w) && inWheel(b, w) && inWheel(c, w)) { owner = w.id; break; }
  parts[owner].push(idx[t], idx[t + 1], idx[t + 2]);
}

/* --- текстуры и маска краски --- */
const mat = prim.getMaterial();
const baseImg = Buffer.from(mat.getBaseColorTexture().getImage()), mrImg = Buffer.from(mat.getMetallicRoughnessTexture().getImage());
const TS = 2048;
const base = await sharp(baseImg).resize(TS, TS).raw().toBuffer({ resolveWithObject: true });
const mr = await sharp(mrImg).resize(TS, TS).raw().toBuffer({ resolveWithObject: true });
const mask = Buffer.alloc(TS * TS);
for (let i = 0, j = 0; j < TS * TS; i += base.info.channels, j++) {
  const r = base.data[i] / 255, g = base.data[i + 1] / 255, b = base.data[i + 2] / 255;
  const mxc = Math.max(r, g, b), mnc = Math.min(r, g, b), lum = 0.3 * r + 0.59 * g + 0.11 * b;
  const sat = mxc > 0 ? (mxc - mnc) / mxc : 0;
  const rough = mr.data[j * mr.info.channels + 1] / 255, metal = mr.data[j * mr.info.channels + 2] / 255;
  const k = smooth(0.42, 0.55, lum) * (1 - smooth(0.1, 0.2, sat)) * (1 - smooth(0.3, 0.5, metal)) * (1 - smooth(0.5, 0.65, rough));
  mask[j] = Math.round(255 * k);
}
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
const outDir = path.dirname(OUT);
fs.mkdirSync(outDir, { recursive: true });
const maskFile = path.basename(OUT).replace(/\.glb$/, '_paint.webp');
await sharp(mask, { raw: { width: TS, height: TS, channels: 1 } }).blur(1.2).resize(1024, 1024).webp({ quality: 80 }).toFile(path.join(outDir, maskFile));

/* --- новый документ: кузов и четыре колеса --- */
const doc = new Document();
doc.createExtension(EXTTextureWebP).setRequired(true);
const buf = doc.createBuffer();
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const texB = doc.createTexture('lada_base').setImage(new Uint8Array(await sharp(baseImg).resize(TS, TS).webp({ quality: 84 }).toBuffer())).setMimeType('image/webp');
/* шероховатость: стекло и хром оставляем как есть, пластик и резину — матовее */
const mrOut = Buffer.alloc(1024 * 1024 * 3);
const mr1 = await sharp(mrImg).resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });
for (let j = 0; j < 1024 * 1024; j++) {
  const r = mr1.data[j * mr1.info.channels + 1], m = mr1.data[j * mr1.info.channels + 2];
  mrOut[j * 3] = 255; mrOut[j * 3 + 1] = Math.min(255, Math.round(r * 0.85 + 22)); mrOut[j * 3 + 2] = m;
}
const texMR = doc.createTexture('lada_mr').setImage(new Uint8Array(await sharp(mrOut, { raw: { width: 1024, height: 1024, channels: 3 } }).webp({ quality: 90 }).toBuffer())).setMimeType('image/webp');
const material = doc.createMaterial('lada').setBaseColorTexture(texB).setMetallicRoughnessTexture(texMR).setMetallicFactor(1).setRoughnessFactor(1);
const uvArr = uvA.getArray();
function makeMesh(name, tris, center) {
  /* только нужные вершины, с переиндексацией */
  const map = new Map(), p = [], n = [], u = [], ind = [];
  for (const i of tris) {
    if (!map.has(i)) { map.set(i, p.length / 3); const v = P[i]; p.push(v[0] - center[0], v[1] - center[1], v[2] - center[2]); n.push(...N[i]); u.push(uvArr[i * 2], uvArr[i * 2 + 1]); }
    ind.push(map.get(i));
  }
  const pr = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(p))).setAttribute('NORMAL', acc('VEC3', new Float32Array(n)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(u))).setIndices(acc('SCALAR', new Uint32Array(ind))).setMaterial(material);
  return doc.createMesh(name).addPrimitive(pr);
}
const root = doc.createNode('lada');
const bodyMesh = makeMesh('body', parts.body, [0, 0, 0]);
root.addChild(doc.createNode('body').setMesh(bodyMesh));
/* дальний уровень: кузов в пять раз проще, вершины те же */
{
  await MeshoptSimplifier.ready;
  const bp = bodyMesh.listPrimitives()[0];
  const [li] = MeshoptSimplifier.simplify(new Uint32Array(bp.getIndices().getArray()), new Float32Array(bp.getAttribute('POSITION').getArray()), 3, Math.floor(bp.getIndices().getCount() * 0.2 / 3) * 3, 0.01, []);
  const lp = doc.createPrimitive();
  for (const sem of bp.listSemantics()) lp.setAttribute(sem, bp.getAttribute(sem));
  lp.setIndices(acc('SCALAR', new Uint32Array(li))).setMaterial(material);
  root.addChild(doc.createNode('body_lod1').setMesh(doc.createMesh('body_lod1').addPrimitive(lp)));
}
for (const w of wheels) root.addChild(doc.createNode('wheel_' + w.id).setTranslation(w.c).setMesh(makeMesh('wheel_' + w.id, parts[w.id], w.c)));
doc.createScene('lada').addChild(root);
await io.write(OUT, doc);
const meta = {
  id: 'veh.sedan', length: LENGTH, wheels: wheels.map(w => ({ id: w.id, center: w.c.map(v => +v.toFixed(3)), r: +w.r.toFixed(3) })),
  paintMask: maskFile, triangles: idx.length / 3, source: 'Krea 2 Large (эскиз) → Hunyuan3D-2.1 через Krea; см. docs/ASSETS.md'
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.json'), JSON.stringify(meta, null, 1) + '\n');
console.log('Кузов ' + parts.body.length / 3 + ' треуг., колёса ' + wheels.map(w => parts[w.id].length / 3).join('/') + '; ' + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' МБ');
