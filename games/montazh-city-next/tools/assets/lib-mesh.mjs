/* Общие мелочи для инструментов подготовки ассетов: чтение GLB с запечённой
   трансформацией узлов, точечные проекции для проверки на глаз. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/* 4×4 column-major из TRS узла */
export function trsMatrix(t, r, s) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1
  ];
}
export function mulMat(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}
export function xformPoint(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
export function worldMatrix(node) {
  let m = trsMatrix(node.getTranslation(), node.getRotation(), node.getScale());
  let p = node.getParentNode();
  while (p) { m = mulMat(trsMatrix(p.getTranslation(), p.getRotation(), p.getScale()), m); p = p.getParentNode(); }
  return m;
}

/* Точечная проекция вершин в PNG: вид спереди (x,y) и сбоку (z,y) рядом.
   marks: [{p:[x,y,z], c:[r,g,b], label}] — суставы и пр. */
export async function pointViews(file, pts, cols, marks = [], size = 900) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 1.08;
  const W = size * 2, H = size, buf = Buffer.alloc(W * H * 3, 235);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
  const proj = (p, view) => {
    const u = view === 0 ? p[0] - cx : p[2] - cz;
    return [Math.round(size * (view + 0.5) + u / span * size), Math.round(H / 2 - (p[1] - cy) / span * size)];
  };
  /* сначала дальние точки, чтобы ближние перекрывали */
  for (let view = 0; view < 2; view++) {
    const order = pts.map((p, i) => i).sort((a, b) => view === 0 ? pts[a][2] - pts[b][2] : pts[b][0] - pts[a][0]);
    for (const i of order) { const [x, y] = proj(pts[i], view); const c = cols ? cols[i] : [90, 90, 90]; put(x, y, c); put(x + 1, y, c); put(x, y + 1, c); put(x + 1, y + 1, c); }
  }
  for (const mk of marks) for (let view = 0; view < 2; view++) {
    const [x, y] = proj(mk.p, view);
    for (let d = -7; d <= 7; d++) { put(x + d, y, mk.c); put(x, y + d, mk.c); put(x + d, y + 1, mk.c); put(x + 1, y + d, mk.c); }
  }
  /* сетка через 10 см по высоте */
  for (let yv = Math.ceil(min[1] * 10) / 10; yv <= max[1]; yv += 0.1) {
    const y = Math.round(H / 2 - (yv - cy) / span * size);
    for (let x = 0; x < W; x += 6) put(x, y, Math.round(yv * 10) % 5 === 0 ? [200, 60, 60] : [180, 180, 200]);
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(file);
}
