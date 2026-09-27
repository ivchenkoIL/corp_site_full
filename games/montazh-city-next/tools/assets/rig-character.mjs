#!/usr/bin/env node
/* =====================================================================
   rig-character.mjs — из неподвижной модели персонажа (GLB из генератора)
   делает игрового: скелет в именах Mixamo, веса кожи, анимации.

     node tools/assets/rig-character.mjs --cfg assets-src/oleg/rig.json

   Что внутри.
   1. Модель ставится на ноги: ось Y вверх, рост в метрах, ступни на нуле,
      лицом на +Z (как принято в glTF).
   2. Суставы. Сначала оцениваются сами по срезам сетки (промежность, ось
      руки, колени по пропорциям), потом их можно поправить руками в rig.json.
      Для проверки на глаз пишется PNG: вид спереди и сбоку с крестиками.
   3. Веса. Вершина достаётся той кости, до которой ближе всего идти по
      поверхности (не по прямой — иначе внутренняя сторона руки прилипла бы
      к груди), потом веса размываются по сетке, чтобы суставы гнулись мягко.
   4. Анимации переносятся с любого скелета Mixamo: для каждой кости берётся
      её поворот относительно позы покоя источника и доворачивается так, чтобы
      направления костей в покое совпали. Поэтому A-поза модели и T-поза
      источника не мешают друг другу. Для шага и бега заодно считается
      «родная» скорость — чтобы в игре ноги не скользили.
   5. Текстуры ужимаются под веб, шероховатость поднимается до правдоподобной
      для ткани (генератор делает всё полированным).
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { Document } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { io, worldMatrix, xformPoint, pointViews, trsMatrix, mulMat } from './lib-mesh.mjs';
import * as Q from './lib-quat.mjs';

const argv = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'] : null).filter(Boolean));
const CFG_PATH = argv.cfg;
if (!CFG_PATH) { console.error('Нужен --cfg путь/к/rig.json'); process.exit(2); }
const CFG = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const BASE = path.dirname(CFG_PATH);
const rel = p => path.resolve(BASE, p);
const H = CFG.height || 1.78;

/* ------------------------------------------------------------------ */
/* Скелет: имя → родитель. Концевые кости (…_End, HandMiddle1) весов не   */
/* получают, они задают направление последней кости цепочки.             */
const SKEL = [
  ['Hips', null], ['Spine', 'Hips'], ['Spine1', 'Spine'], ['Spine2', 'Spine1'], ['Neck', 'Spine2'],
  ['Head', 'Neck'], ['HeadTop_End', 'Head'],
  ['LeftShoulder', 'Spine2'], ['LeftArm', 'LeftShoulder'], ['LeftForeArm', 'LeftArm'], ['LeftHand', 'LeftForeArm'], ['LeftHandMiddle1', 'LeftHand'],
  ['RightShoulder', 'Spine2'], ['RightArm', 'RightShoulder'], ['RightForeArm', 'RightArm'], ['RightHand', 'RightForeArm'], ['RightHandMiddle1', 'RightHand'],
  ['LeftUpLeg', 'Hips'], ['LeftLeg', 'LeftUpLeg'], ['LeftFoot', 'LeftLeg'], ['LeftToeBase', 'LeftFoot'], ['LeftToe_End', 'LeftToeBase'],
  ['RightUpLeg', 'Hips'], ['RightLeg', 'RightUpLeg'], ['RightFoot', 'RightLeg'], ['RightToeBase', 'RightFoot'], ['RightToe_End', 'RightToeBase']
];
const PARENT = Object.fromEntries(SKEL);
/* кость → сустав, куда она смотрит (для направлений и отрезков весов) */
const TIP = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', Head: 'HeadTop_End',
  LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandMiddle1',
  RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandMiddle1',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', LeftToeBase: 'LeftToe_End',
  RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase', RightToeBase: 'RightToe_End'
};
const DEFORM = Object.keys(TIP);
const MIX = n => 'mixamorig:' + n;

/* ------------------------------------------------------------------ */
/* 1. сетка, поставленная на ноги                                      */
const raw = await io.read(rel(CFG.input));
const rawRoot = raw.getRoot();
const meshNodes = rawRoot.listNodes().filter(n => n.getMesh());
if (meshNodes.length !== 1 || meshNodes[0].getMesh().listPrimitives().length !== 1) throw new Error('Жду один узел с одной сеткой');
const srcNode = meshNodes[0], srcPrim = srcNode.getMesh().listPrimitives()[0];
const WM = worldMatrix(srcNode);
const posA = srcPrim.getAttribute('POSITION'), nrmA = srcPrim.getAttribute('NORMAL'), uvA = srcPrim.getAttribute('TEXCOORD_0');
const NV = posA.getCount();
let P = [], N = [];
{
  const e = [];
  const R = [WM[0], WM[1], WM[2], WM[4], WM[5], WM[6], WM[8], WM[9], WM[10]];
  for (let i = 0; i < NV; i++) {
    P.push(xformPoint(WM, posA.getElement(i, e)));
    const n = nrmA ? nrmA.getElement(i, e) : [0, 1, 0];
    N.push(Q.vNorm([R[0] * n[0] + R[3] * n[1] + R[6] * n[2], R[1] * n[0] + R[4] * n[1] + R[7] * n[2], R[2] * n[0] + R[5] * n[1] + R[8] * n[2]]));
  }
  if (CFG.flipZ) { P = P.map(p => [-p[0], p[1], -p[2]]); N = N.map(n => [-n[0], n[1], -n[2]]); }
  let minY = Infinity, maxY = -Infinity;
  for (const p of P) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const s = H / (maxY - minY);
  P = P.map(p => [p[0] * s, (p[1] - minY) * s, p[2] * s]);
  /* по x центрируем по ногам (сумка на боку сбила бы рамку), по z — по голеням */
  const legs = P.filter(p => p[1] > 0.1 * H && p[1] < 0.4 * H);
  const cx = legs.reduce((a, p) => a + p[0], 0) / legs.length;
  let zmin = Infinity, zmax = -Infinity; for (const p of legs) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); }
  const cz = (zmin + zmax) / 2;
  P = P.map(p => [p[0] - cx, p[1], p[2] - cz]);
}
let TRI = srcPrim.getIndices().getArray();
/* генератор иногда подкладывает под ноги плоскую «подставку» — отдельный
   кусок сетки толщиной в миллиметры. С ногами её связывать нельзя: она
   поедет за ступнёй и будет волочиться по земле. Такие куски выкидываем. */
{
  const parent = new Int32Array(NV).map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const key = i => P[i].map(v => Math.round(v * 1e5)).join(',');
  const first = new Map();
  for (let i = 0; i < NV; i++) { const k = key(i); if (first.has(k)) parent[find(i)] = find(first.get(k)); else first.set(k, i); }
  for (let t = 0; t < TRI.length; t += 3) { parent[find(TRI[t + 1])] = find(TRI[t]); parent[find(TRI[t + 2])] = find(TRI[t]); }
  const box = new Map();
  for (let i = 0; i < NV; i++) {
    const r = find(i); let b = box.get(r);
    if (!b) box.set(r, b = { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity], n: 0 });
    for (let k = 0; k < 3; k++) { b.mn[k] = Math.min(b.mn[k], P[i][k]); b.mx[k] = Math.max(b.mx[k], P[i][k]); } b.n++;
  }
  const drop = new Set();
  for (const [r, b] of box) {
    const hgt = b.mx[1] - b.mn[1], wide = Math.max(b.mx[0] - b.mn[0], b.mx[2] - b.mn[2]);
    if (hgt < 0.012 * H && b.mn[1] < 0.02 * H && wide > 0.12 * H) drop.add(r);
  }
  if (drop.size) {
    const keep = [];
    for (let t = 0; t < TRI.length; t += 3) if (!drop.has(find(TRI[t]))) keep.push(TRI[t], TRI[t + 1], TRI[t + 2]);
    console.log('Убрана подставка под ногами: ' + (TRI.length - keep.length) / 3 + ' треугольников');
    TRI = new Uint32Array(keep);
  }
  /* подставка бывает и сросшейся с подошвами: тогда режем тонкий слой у
     земли везде, кроме следа ботинок (он виден по срезу чуть выше) */
  const low = P.filter(p => p[1] < 0.004 * H);
  let lx0 = Infinity, lx1 = -Infinity; for (const p of low) { lx0 = Math.min(lx0, p[0]); lx1 = Math.max(lx1, p[0]); }
  if (lx1 - lx0 > 0.45 * H) {
    const cell = 0.02, occ = new Set();
    for (const p of P) if (p[1] > 0.02 * H && p[1] < 0.05 * H) occ.add(Math.round(p[0] / cell) + ',' + Math.round(p[2] / cell));
    const inBoot = (x, z) => { const i = Math.round(x / cell), j = Math.round(z / cell); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (occ.has((i + a) + ',' + (j + b))) return true; return false; };
    const slab = 0.012 * H, keep = [];
    for (let t = 0; t < TRI.length; t += 3) {
      const a = P[TRI[t]], b = P[TRI[t + 1]], c = P[TRI[t + 2]];
      const flat = a[1] < slab && b[1] < slab && c[1] < slab;
      if (flat && !inBoot((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3)) continue;
      keep.push(TRI[t], TRI[t + 1], TRI[t + 2]);
    }
    console.log('Срезана сросшаяся подставка: ' + (TRI.length - keep.length) / 3 + ' треугольников');
    TRI = new Uint32Array(keep);
  }
}

/* точки, по которым ищем суставы: только те, что остались в треугольниках */
const PE = (() => { const used = new Uint8Array(NV); for (const t of TRI) used[t] = 1; return P.filter((_, i) => used[i]); })();
/* ------------------------------------------------------------------ */
/* 2. суставы                                                          */
const slice = (y, h = 0.006 * H) => PE.filter(p => Math.abs(p[1] - y) < h);
function clusters1D(vals, gap) {
  const s = [...vals].sort((a, b) => a - b), out = [];
  let cur = [s[0]];
  for (let i = 1; i < s.length; i++) { if (s[i] - s[i - 1] > gap) { out.push(cur); cur = []; } cur.push(s[i]); }
  if (cur.length) out.push(cur);
  return out.map(c => ({ min: c[0], max: c[c.length - 1], n: c.length }));
}
const mid = pts => { let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity]; for (const p of pts) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], p[k]); b[k] = Math.max(b[k], p[k]); } return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);

function estimateJoints() {
  const J = {};
  /* промежность: самый низкий срез, выше которого ноги слиты хотя бы на 6 см
     (широкие штаны могут касаться друг друга и ниже — это не промежность) */
  const merged = y => {
    const s = slice(y, 0.003 * H).filter(p => Math.abs(p[0]) < 0.13 * H);
    if (!s.length) return false;
    return clusters1D(s.map(p => p[0]), 0.008 * H).some(c => c.min < -0.004 * H && c.max > 0.004 * H);
  };
  let crotch = 0.47 * H;
  for (let y = 0.3 * H; y < 0.6 * H; y += 0.002 * H) {
    let ok = true;
    for (let d = 0; d <= 0.035 * H && ok; d += 0.004 * H) ok = merged(y + d);
    if (ok) { crotch = y; break; }
  }
  const pelvis = slice(crotch + 0.05 * H, 0.02 * H).filter(p => Math.abs(p[0]) < 0.12 * H);
  const pz = mid(pelvis)[2];
  J.Hips = [0, crotch + 0.058 * H, pz];
  const kneeY = 0.63 * crotch;
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const leg = y => slice(y, 0.01 * H).filter(p => p[0] * sx > 0.003 * H && Math.abs(p[0]) < 0.2 * H);
    const thigh = leg(crotch - 0.05 * H);
    J[side + 'UpLeg'] = [centroid(thigh)[0], crotch + 0.036 * H, pz];
    const knee = leg(kneeY);
    J[side + 'Leg'] = [mid(knee)[0], kneeY, mid(knee)[2]];
    const shin = leg(0.1 * H);
    const ank = [centroid(shin)[0], 0.052 * H, mid(shin)[2]];
    J[side + 'Foot'] = ank;
    const foot = PE.filter(p => p[1] < 0.05 * H && p[0] * sx > 0 && Math.abs(p[0] - ank[0]) < 0.07 * H);
    let front = -Infinity; for (const p of foot) front = Math.max(front, p[2]);
    J[side + 'ToeBase'] = [ank[0], 0.018 * H, ank[2] + 0.62 * (front - ank[2])];
    J[side + 'Toe_End'] = [ank[0], 0.018 * H, front];
  }
  /* плечи: верх плечевого пояса — самый высокий срез, где ширина ещё плечевая */
  let shTop = 0.82 * H;
  for (let y = 0.7 * H; y < 0.92 * H; y += 0.003 * H) {
    const s = slice(y, 0.003 * H); if (!s.length) continue;
    let w = 0; for (const p of s) w = Math.max(w, Math.abs(p[0]));
    if (w > 0.09 * H) shTop = y;
  }
  const hy = J.Hips[1], neckY = shTop + 0.006 * H;
  const torsoZ = y => { const s = slice(y, 0.01 * H).filter(p => Math.abs(p[0]) < 0.1 * H); const m = mid(s); let a = Infinity, b = -Infinity; for (const p of s) { a = Math.min(a, p[2]); b = Math.max(b, p[2]); } return m[2] - 0.1 * (b - a); };
  for (const [n, f] of [['Spine', 0.19], ['Spine1', 0.42], ['Spine2', 0.67]]) { const y = hy + f * (neckY - hy); J[n] = [0, y, torsoZ(y)]; }
  const neckPts = slice(neckY + 0.02 * H, 0.008 * H).filter(p => Math.abs(p[0]) < 0.06 * H);
  J.Neck = [0, neckY, mid(neckPts)[2]];
  const headY = neckY + 0.05 * H;
  J.Head = [0, headY, mid(slice(headY, 0.008 * H).filter(p => Math.abs(p[0]) < 0.08 * H))[2]];
  J.HeadTop_End = [0, H, J.Head[2]];
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    /* плечевой сустав: на 4.5 см внутрь от внешнего края дельты, на 3 см ниже верха */
    const shY = shTop - 0.017 * H;
    const s = slice(shY, 0.006 * H).filter(p => p[0] * sx > 0);
    let edge = 0; for (const p of s) edge = Math.max(edge, p[0] * sx);
    const jx = edge - 0.026 * H;
    const around = s.filter(p => Math.abs(p[0] * sx - jx) < 0.02 * H);
    const sh = [sx * jx, shY, mid(around)[2]];
    /* кончик пальцев: самая дальняя точка вдоль «вниз-наружу» */
    const dirGuess = Q.vNorm([sx, -1.1, 0]);
    let tip = sh, best = -Infinity;
    for (const p of PE) { if (p[0] * sx < 0.1 * H || p[1] < 0.4 * H) continue; const t = Q.vDot(Q.vSub(p, sh), dirGuess); if (t > best) { best = t; tip = p; } }
    const L = Q.vLen(Q.vSub(tip, sh)), v = Q.vNorm(Q.vSub(tip, sh));
    /* средняя линия руки: центры поперечных срезов у прямой плечо—пальцы */
    const center = t => {
      const q = Q.vAdd(sh, Q.vScale(v, t));
      const near = PE.filter(p => Math.abs(Q.vDot(Q.vSub(p, q), v)) < 0.008 * H && Q.vLen(Q.vSub(Q.vSub(p, q), Q.vScale(v, Q.vDot(Q.vSub(p, q), v)))) < 0.045 * H);
      return near.length > 8 ? mid(near) : q;
    };
    J[side + 'Arm'] = sh;
    J[side + 'ForeArm'] = center(0.43 * L);
    J[side + 'Hand'] = center(0.745 * L);
    J[side + 'HandMiddle1'] = center(0.88 * L);
    J[side + 'Shoulder'] = [sx * 0.028 * H, J.Spine2[1] + 0.6 * (neckY - J.Spine2[1]), J.Spine2[2] + 0.025 * H];
  }
  return J;
}
const J = estimateJoints();
for (const [k, v] of Object.entries(CFG.joints || {})) {
  if (!J[k]) throw new Error('Неизвестный сустав в rig.json: ' + k);
  J[k] = v.length === 3 ? v : J[k].map((x, i) => x + (v[i] || 0));
}
for (const k of Object.keys(PARENT)) if (!J[k]) throw new Error('Не нашёл сустав ' + k);
const round3 = v => v.map(x => Math.round(x * 1000) / 1000);
console.log('Суставы (м):'); for (const [k] of SKEL) console.log('  ' + k.padEnd(18) + JSON.stringify(round3(J[k])));

/* ------------------------------------------------------------------ */
/* 3. веса                                                             */
const segs = DEFORM.map(b => {
  let a = J[b], c = J[TIP[b]];
  if (b.endsWith('Hand')) c = Q.vAdd(a, Q.vScale(Q.vSub(c, a), 2.2));     /* кисть целиком, до кончиков пальцев */
  if (b === 'Head') c = J.HeadTop_End;
  return { b, a, c };
});
function segDist(p, s) {
  const ab = Q.vSub(s.c, s.a), t = Math.max(0, Math.min(1, Q.vDot(Q.vSub(p, s.a), ab) / Q.vDot(ab, ab)));
  return Q.vLen(Q.vSub(p, Q.vAdd(s.a, Q.vScale(ab, t))));
}
/* сварка по координате: швы UV не должны рвать граф */
const keyOf = p => p.map(v => Math.round(v * 1e5)).join(',');
const weldId = new Int32Array(NV), reps = [];
{ const m = new Map(); for (let i = 0; i < NV; i++) { const k = keyOf(P[i]); if (!m.has(k)) { m.set(k, reps.length); reps.push(i); } weldId[i] = m.get(k); } }
const NW = reps.length;
const adj = Array.from({ length: NW }, () => new Map());
for (let t = 0; t < TRI.length; t += 3) for (let e = 0; e < 3; e++) {
  const a = weldId[TRI[t + e]], b = weldId[TRI[t + (e + 1) % 3]];
  if (a === b) continue;
  const d = Q.vLen(Q.vSub(P[reps[a]], P[reps[b]]));
  adj[a].set(b, d); adj[b].set(a, d);
}
const label = new Int32Array(NW).fill(-1), dist = new Float64Array(NW).fill(Infinity);
const heap = [];
const push = (d, v, l) => { heap.push([d, v, l]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
/* затравки. Позвоночник — горизонтальными полосами по середине торса: отрезок
   кости сидит у спины, и по прямой грудь оказалась бы ближе к ключицам.
   Конечности — вершины, про которые по прямой всё ясно. Области force из
   rig.json (сумка, ремни) отдаются заданной кости целиком. */
const SPINE_BANDS = {
  Hips: [J.LeftUpLeg[1] - 0.03 * H, J.Spine[1]], Spine: [J.Spine[1], J.Spine1[1]], Spine1: [J.Spine1[1], J.Spine2[1]],
  Spine2: [J.Spine2[1], J.Neck[1]], Neck: [J.Neck[1], J.Head[1]], Head: [J.Head[1], H + 1]
};
const halfW = new Map();
const torsoHalf = y => {
  const k = Math.round(y / (0.005 * H));
  if (!halfW.has(k)) {
    const sl = slice(k * 0.005 * H, 0.004 * H);
    const cl = sl.length ? clusters1D(sl.map(p => p[0]), 0.012 * H).find(c => c.min <= 0 && c.max >= 0) : null;
    halfW.set(k, cl ? Math.min(-cl.min, cl.max) : 0);
  }
  return halfW.get(k);
};
const forced = (CFG.force || []).map(f => ({ bone: DEFORM.indexOf(f.bone), min: f.min, max: f.max }));
for (const f of forced) if (f.bone < 0) throw new Error('force: неизвестная кость');
const euclid = new Array(NW);
let nForced = 0;
for (let w = 0; w < NW; w++) {
  const p = P[reps[w]];
  const fz = forced.find(f => p.every((v, k) => v >= f.min[k] && v <= f.max[k]));
  if (fz) { push(0, w, fz.bone); euclid[w] = fz.bone; nForced++; continue; }
  let b1 = -1, d1 = Infinity, d2 = Infinity;
  segs.forEach((s, k) => { const d = segDist(p, s); if (d < d1) { d2 = d1; d1 = d; b1 = k; } else if (d < d2) d2 = d; });
  euclid[w] = b1;
  let banded = false;
  for (const [b, [y0, y1]] of Object.entries(SPINE_BANDS)) {
    if (p[1] < y0 || p[1] >= y1) continue;
    if (b === 'Head' || Math.abs(p[0]) < 0.55 * torsoHalf(p[1])) { push(0, w, DEFORM.indexOf(b)); banded = true; }
    break;
  }
  if (banded) continue;
  const bn = DEFORM[b1];
  if (/Arm|Hand|Leg|UpLeg|Foot|Toe/.test(bn) && d1 < 0.7 * d2) push(0, w, b1);
  else if (/Shoulder/.test(bn) && d1 < 0.7 * d2 && p[1] > J.Spine2[1] + 0.5 * (J.Neck[1] - J.Spine2[1])) push(0, w, b1);
}
if (nForced) console.log('Принудительно отдано костям: ' + nForced + ' вершин');
while (heap.length) {
  const [d, v, l] = pop();
  if (d >= dist[v]) continue;
  dist[v] = d; label[v] = l;
  for (const [u, e] of adj[v]) if (d + e < dist[u]) push(d + e, u, l);
}
let orphans = 0;
for (let w = 0; w < NW; w++) if (label[w] < 0) { label[w] = euclid[w]; orphans++; }
/* размытие: веса как тепло, растекающееся по сетке */
let W = Array.from({ length: NW }, (_, w) => new Map([[label[w], 1]]));
const ITER = CFG.smooth ?? 24, LAM = 0.5;
for (let it = 0; it < ITER; it++) {
  const next = new Array(NW);
  for (let v = 0; v < NW; v++) {
    const acc = new Map();
    let n = 0;
    for (const u of adj[v].keys()) { for (const [b, x] of W[u]) acc.set(b, (acc.get(b) || 0) + x); n++; }
    const out = new Map();
    for (const [b, x] of W[v]) out.set(b, (1 - LAM) * x);
    if (n) for (const [b, x] of acc) out.set(b, (out.get(b) || 0) + LAM * x / n);
    else for (const [b, x] of W[v]) out.set(b, x);
    /* держим не больше шести костей, мелочь отбрасываем */
    const top = [...out].filter(e => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const s = top.reduce((a, e) => a + e[1], 0);
    next[v] = new Map(top.map(([b, x]) => [b, x / s]));
  }
  W = next;
}
const jointIndex = Object.fromEntries(SKEL.map(([n], i) => [n, i]));
const JOINTS = new Uint16Array(NV * 4), WEIGHTS = new Float32Array(NV * 4);
for (let i = 0; i < NV; i++) {
  const top = [...W[weldId[i]]].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = top.reduce((a, e) => a + e[1], 0);
  top.forEach(([b, x], k) => { JOINTS[i * 4 + k] = jointIndex[DEFORM[b]]; WEIGHTS[i * 4 + k] = x / s; });
}
console.log('Веса: ' + NW + ' сваренных вершин из ' + NV + ', без пути по поверхности ' + orphans + ', размытие ' + ITER + ' шагов');

/* проверочные виды: цвет — главная кость вершины */
if (argv.views || CFG.views) {
  const pal = DEFORM.map((b, k) => { const h = (k * 0.618034) % 1; const c = [0, 1, 2].map(i => Math.round(127 + 110 * Math.cos(6.283 * (h + i / 3)))); return c; });
  const cols = P.map((p, i) => pal[DEFORM.indexOf(SKEL[JOINTS[i * 4]][0])]);
  const marks = SKEL.map(([n]) => ({ p: J[n], c: n.startsWith('Left') ? [220, 30, 30] : n.startsWith('Right') ? [30, 60, 220] : [20, 150, 20] }));
  await pointViews(rel(argv.views || CFG.views), P, cols, marks);
  console.log('Виды для проверки: ' + rel(argv.views || CFG.views));
}

/* ------------------------------------------------------------------ */
/* 4. новый документ: сетка + скелет                                   */
const doc = new Document();
const buffer = doc.createBuffer('main');
const root = doc.getRoot();
const mat = doc.createMaterial(CFG.name).setMetallicFactor(1).setRoughnessFactor(1).setDoubleSided(false);
const srcMat = srcPrim.getMaterial();
async function packTex(tex, kind) {
  if (!tex) return null;
  let img = sharp(Buffer.from(tex.getImage()));
  const size = kind === 'base' ? (CFG.texBase || 2048) : (CFG.texMR || 1024);
  if (kind === 'mr') {
    /* G — шероховатость: генератор делает всё полированным, поднимаем до ткани */
    const { data, info } = await img.resize(size, size).raw().toBuffer({ resolveWithObject: true });
    const [rMin, rScale] = CFG.roughRemap || [0.45, 0.55];
    const out = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0, j = 0; i < data.length; i += info.channels, j += 3) {
      out[j] = 255;
      out[j + 1] = Math.round(255 * Math.min(1, rMin + rScale * data[i + 1] / 255));
      out[j + 2] = data[i + 2] > 128 ? data[i + 2] : Math.round(data[i + 2] * 0.5);
    }
    img = sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
  } else img = img.resize(size, size);
  const jpg = await img.jpeg({ quality: kind === 'base' ? 88 : 90, mozjpeg: true }).toBuffer();
  return doc.createTexture(CFG.name + '_' + kind).setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
}
mat.setBaseColorTexture(await packTex(srcMat.getBaseColorTexture(), 'base'));
mat.setMetallicRoughnessTexture(await packTex(srcMat.getMetallicRoughnessTexture(), 'mr'));

const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', new Float32Array(P.flat())))
  .setAttribute('NORMAL', acc('VEC3', new Float32Array(N.flat())))
  .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uvA.getArray())))
  .setAttribute('JOINTS_0', acc('VEC4', JOINTS))
  .setAttribute('WEIGHTS_0', acc('VEC4', WEIGHTS))
  .setIndices(acc('SCALAR', new Uint32Array(TRI)))
  .setMaterial(mat);
const mesh = doc.createMesh(CFG.name).addPrimitive(prim);
/* дальний уровень детализации: те же вершины, в четыре раза меньше
   треугольников — в толпе за 15 метров разницы не видно, а видеокарте легче */
await MeshoptSimplifier.ready;
const [lodIdx] = MeshoptSimplifier.simplify(new Uint32Array(TRI), new Float32Array(P.flat()), 3, Math.floor(TRI.length * (CFG.lodRatio || 0.22) / 3) * 3, 0.02, []);
const primLod = doc.createPrimitive();
for (const sem of prim.listSemantics()) primLod.setAttribute(sem, prim.getAttribute(sem));
primLod.setIndices(acc('SCALAR', new Uint32Array(lodIdx))).setMaterial(mat);
const meshLod = doc.createMesh(CFG.name + '_lod1').addPrimitive(primLod);

const jnode = {};
for (const [n, par] of SKEL) {
  const t = par ? Q.vSub(J[n], J[par]) : J[n];
  jnode[n] = doc.createNode(MIX(n)).setTranslation(t);
  if (par) jnode[par].addChild(jnode[n]);
}
const ibm = new Float32Array(SKEL.length * 16);
SKEL.forEach(([n], i) => { const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -J[n][0], -J[n][1], -J[n][2], 1]; ibm.set(m, i * 16); });
const skin = doc.createSkin(CFG.name + 'Skin').setSkeleton(jnode.Hips).setInverseBindMatrices(acc('MAT4', ibm));
for (const [n] of SKEL) skin.addJoint(jnode[n]);
const meshNode = doc.createNode(CFG.name + 'Mesh').setMesh(mesh).setSkin(skin);
const lodNode = doc.createNode(CFG.name + 'Mesh_lod1').setMesh(meshLod).setSkin(skin);
const top = doc.createNode(CFG.name).addChild(jnode.Hips).addChild(meshNode).addChild(lodNode);
doc.createScene(CFG.name).addChild(top);

/* ------------------------------------------------------------------ */
/* 5. перенос анимаций                                                 */
const FPS = 30;
const tgtDir = {};
for (const b of DEFORM) tgtDir[b] = Q.vNorm(Q.vSub(J[TIP[b]], J[b]));
const clipsInfo = {};

for (const src of CFG.animations || []) {
  const sdoc = await io.read(rel(src.file));
  const sroot = sdoc.getRoot();
  const byName = new Map(sroot.listNodes().map(n => [n.getName().replace(/^mixamorig[:_]?/, ''), n]));
  const needed = new Set([...DEFORM, ...Object.values(TIP)]);
  for (const n of needed) if (!byName.has(n)) throw new Error(src.file + ': нет кости ' + n);
  /* глобальные повороты и позиции источника при данной локальной позе */
  const order = [];
  { const seen = new Set(); const visit = n => { if (!n || seen.has(n)) return; visit(n.getParentNode()); seen.add(n); order.push(n); }; for (const n of sroot.listNodes()) visit(n); }
  function globals(local) {
    const G = new Map();
    for (const n of order) {
      const l = local.get(n) || { t: n.getTranslation(), r: n.getRotation(), s: n.getScale() };
      const m = trsMatrix(l.t, l.r, l.s);
      const p = n.getParentNode();
      G.set(n, p ? mulMat(G.get(p), m) : m);
    }
    return G;
  }
  const rest = globals(new Map());
  const gRot = (G, name) => Q.qFromMat(G.get(byName.get(name)));
  const gPos = (G, name) => { const m = G.get(byName.get(name)); return [m[12], m[13], m[14]]; };
  const srcRestRot = {}, align = {};
  for (const b of DEFORM) {
    srcRestRot[b] = gRot(rest, b);
    const sd = Q.vNorm(Q.vSub(gPos(rest, TIP[b]), gPos(rest, b)));
    align[b] = Q.qFromTo(tgtDir[b], sd);
  }
  const srcHipsH = gPos(rest, 'Hips')[1], tgtHipsH = J.Hips[1];
  const hipsScale = tgtHipsH / srcHipsH;
  const srcHipsRest = gPos(rest, 'Hips');

  for (const [clipName, outName] of Object.entries(src.clips)) {
    const anim = sroot.listAnimations().find(a => a.getName() === clipName);
    if (!anim) throw new Error(src.file + ': нет клипа ' + clipName);
    const chans = anim.listChannels().map(c => ({ node: c.getTargetNode(), path: c.getTargetPath(), inp: c.getSampler().getInput().getArray(), out: c.getSampler().getOutput().getArray(), interp: c.getSampler().getInterpolation() }));
    let dur = 0; for (const c of chans) dur = Math.max(dur, c.inp[c.inp.length - 1]);
    const nFrames = Math.max(2, Math.round(dur * FPS) + 1);
    const sample = (c, t) => {
      const k = c.path === 'rotation' ? 4 : 3, inp = c.inp, out = c.out, stride = c.interp === 'CUBICSPLINE' ? k * 3 : k, off = c.interp === 'CUBICSPLINE' ? k : 0;
      if (t <= inp[0]) return Array.from(out.slice(off, off + k));
      if (t >= inp[inp.length - 1]) { const i = inp.length - 1; return Array.from(out.slice(i * stride + off, i * stride + off + k)); }
      let i = 0; while (inp[i + 1] < t) i++;
      const u = (t - inp[i]) / (inp[i + 1] - inp[i]);
      const a = Array.from(out.slice(i * stride + off, i * stride + off + k)), b = Array.from(out.slice((i + 1) * stride + off, (i + 1) * stride + off + k));
      if (c.interp === 'STEP') return a;
      return k === 4 ? Q.qSlerp(a, b, u) : Q.vLerp(a, b, u);
    };
    const tracks = Object.fromEntries(DEFORM.map(b => [b, []]));
    const hipsT = [], feet = [];
    for (let f = 0; f < nFrames; f++) {
      const t = Math.min(dur, f / FPS);
      const local = new Map();
      for (const c of chans) {
        if (!local.has(c.node)) local.set(c.node, { t: c.node.getTranslation(), r: c.node.getRotation(), s: c.node.getScale() });
        const l = local.get(c.node);
        if (c.path === 'rotation') l.r = sample(c, t);
        else if (c.path === 'translation') l.t = sample(c, t);
        else if (c.path === 'scale') l.s = sample(c, t);
      }
      const G = globals(local);
      const tg = {};
      for (const b of DEFORM) {
        const delta = Q.qMul(gRot(G, b), Q.qConj(srcRestRot[b]));
        tg[b] = Q.qNorm(Q.qMul(delta, align[b]));
      }
      for (const b of DEFORM) {
        const par = PARENT[b];
        let l = par ? Q.qMul(Q.qConj(tg[par]), tg[b]) : tg[b];
        const prev = tracks[b][tracks[b].length - 1];
        if (prev && Q.vDot(prev, l) + prev[3] * l[3] < 0) l = l.map(x => -x);
        tracks[b].push(l);
      }
      const hp = gPos(G, 'Hips');
      const off = Q.vScale(Q.vSub(hp, srcHipsRest), hipsScale);
      if (src.inPlace !== false) { off[0] *= src.keepSway ?? 1; off[2] *= src.keepSway ?? 1; }
      hipsT.push(Q.vAdd(J.Hips, off));
      /* ступни цели в системе бёдер — для «родной» скорости шага */
      const footPos = side => {
        let pos = [0, 0, 0], rot = Q.qId();
        const chain = ['Hips', side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase'];
        pos = hipsT[hipsT.length - 1]; rot = tg.Hips;
        for (let i = 1; i < chain.length; i++) {
          pos = Q.vAdd(pos, Q.qRot(rot, Q.vSub(J[chain[i]], J[chain[i - 1]])));
          rot = tg[chain[i]];
        }
        return pos;
      };
      feet.push({ L: footPos('Left'), R: footPos('Right'), hips: hipsT[hipsT.length - 1] });
    }
    /* родная скорость: опорная ступня (та, что ниже) едет назад относительно бёдер */
    let vs = 0, vn = 0, minFoot = Infinity;
    for (const f of feet) minFoot = Math.min(minFoot, f.L[1], f.R[1]);
    for (let f = 1; f < feet.length - 1; f++) {
      const side = feet[f].L[1] < feet[f].R[1] ? 'L' : 'R';
      if (feet[f][side][1] > minFoot + 0.03) continue;
      const dz = (feet[f + 1][side][2] - feet[f + 1].hips[2]) - (feet[f - 1][side][2] - feet[f - 1].hips[2]);
      vs += -dz / (2 / FPS); vn++;
    }
    const speed = vn ? vs / vn : 0;
    const times = new Float32Array(nFrames).map((_, f) => Math.min(dur, f / FPS));
    const input = acc('SCALAR', times);
    const out = doc.createAnimation(outName);
    for (const b of DEFORM) {
      const smp = doc.createAnimationSampler().setInput(input).setOutput(acc('VEC4', new Float32Array(tracks[b].flat()))).setInterpolation('LINEAR');
      out.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(jnode[b]).setTargetPath('rotation').setSampler(smp));
    }
    const smp = doc.createAnimationSampler().setInput(input).setOutput(acc('VEC3', new Float32Array(hipsT.flat()))).setInterpolation('LINEAR');
    out.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(jnode.Hips).setTargetPath('translation').setSampler(smp));
    clipsInfo[outName] = { duration: +dur.toFixed(4), speed: +Math.max(0, speed).toFixed(3), source: path.basename(src.file) + ':' + clipName };
    console.log('Анимация ' + outName.padEnd(10) + ' ← ' + path.basename(src.file) + ':' + clipName + '  ' + dur.toFixed(2) + ' с, ' + nFrames + ' кадров' + (speed > 0.05 ? ', родная скорость ' + speed.toFixed(2) + ' м/с' : ''));
  }
}

await doc.transform(dedup(), prune());
const OUT = rel(CFG.output);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const meta = {
  id: CFG.id, height: H, skeleton: 'mixamo', joints: Object.fromEntries(SKEL.map(([n]) => [n, round3(J[n])])),
  clips: clipsInfo, triangles: TRI.length / 3, lod1: { triangles: lodIdx.length / 3, from: 15 }, generatedBy: 'tools/assets/rig-character.mjs', source: CFG.source || null
};
fs.writeFileSync(OUT.replace(/\.glb$/, '.json'), JSON.stringify(meta, null, 1) + '\n');
console.log('Готово: ' + path.relative(process.cwd(), OUT) + ' (' + (fs.statSync(OUT).size / 1048576).toFixed(2) + ' МБ)');
