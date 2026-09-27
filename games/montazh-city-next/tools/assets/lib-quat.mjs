/* Кватернионы [x, y, z, w] и векторы — ровно то, что нужно для переноса
   анимаций между скелетами. Без зависимостей. */
export const qId = () => [0, 0, 0, 1];
export function qMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
          aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
export const qConj = q => [-q[0], -q[1], -q[2], q[3]];
export function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
export function qRot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
export function qSlerp(a, b, t) {
  let [bx, by, bz, bw] = b;
  let c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0 = 1 - t, k1 = t;
  if (c < 0.9995) { const o = Math.acos(c), s = Math.sin(o); k0 = Math.sin((1 - t) * o) / s; k1 = Math.sin(t * o) / s; }
  return qNorm([a[0] * k0 + bx * k1, a[1] * k0 + by * k1, a[2] * k0 + bz * k1, a[3] * k0 + bw * k1]);
}
export function qAxisAngle(ax, ang) { const s = Math.sin(ang / 2), l = Math.hypot(...ax) || 1; return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(ang / 2)]; }
/* кратчайший поворот, переводящий направление a в b */
export function qFromTo(a, b) {
  a = vNorm(a); b = vNorm(b);
  const d = vDot(a, b);
  if (d > 0.999999) return qId();
  if (d < -0.999999) { let ax = vCross([1, 0, 0], a); if (vLen(ax) < 1e-6) ax = vCross([0, 1, 0], a); return qAxisAngle(ax, Math.PI); }
  const c = vCross(a, b);
  return qNorm([c[0], c[1], c[2], 1 + d]);
}
export const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vLen = a => Math.hypot(a[0], a[1], a[2]);
export const vNorm = a => { const l = vLen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vLerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/* кватернион из 3×3 части column-major матрицы (масштаб снимается) */
export function qFromMat(m) {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const a = m[0] / sx, b = m[4] / sy, c = m[8] / sz, d = m[1] / sx, e = m[5] / sy, f = m[9] / sz, g = m[2] / sx, h = m[6] / sy, i = m[10] / sz;
  const tr = a + e + i;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (h - f) * s; y = (c - g) * s; z = (d - b) * s; }
  else if (a > e && a > i) { const s = 2 * Math.sqrt(1 + a - e - i); w = (h - f) / s; x = 0.25 * s; y = (b + d) / s; z = (c + g) / s; }
  else if (e > i) { const s = 2 * Math.sqrt(1 + e - a - i); w = (c - g) / s; x = (b + d) / s; y = 0.25 * s; z = (f + h) / s; }
  else { const s = 2 * Math.sqrt(1 + i - a - e); w = (d - b) / s; x = (c + g) / s; y = (f + h) / s; z = 0.25 * s; }
  return qNorm([x, y, z, w]);
}
