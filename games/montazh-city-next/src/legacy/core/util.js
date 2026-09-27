/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «0. Утилиты и математика», строки 870–959.
   ===================================================================== */
import { QCFG } from './quality.js';

/* ------------------------------------------------------------------ */
/* 0. Утилиты и математика                                              */
/* ------------------------------------------------------------------ */
export const TAU = Math.PI * 2, D2R = Math.PI / 180;
export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; };
export const fmtMoney = v => Math.round(v).toLocaleString('ru-RU') + ' ₽';
export const pad2 = n => (n < 10 ? '0' : '') + n;
export const $ = id => document.getElementById(id);
/* sRGB → линейный свет: палитры и вершинные цвета авторские, шейдер считает в линейном */
export const lin1 = v => Math.pow(Math.max(v, 0), QCFG.color.gamma);
export const lin3 = (o, c, k) => { k = k === undefined ? 1 : k; o[0] = lin1(c[0]) * k; o[1] = lin1(c[1]) * k; o[2] = lin1(c[2]) * k; return o; };
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* --- матрицы 4x4 (column-major, как ждёт GL) --- */
export function m4() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
export function m4id(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; }
export function m4mul(o, a, b) {
  const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
        a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  for (let i = 0; i < 4; i++) {
    const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
    o[i*4]   = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    o[i*4+1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    o[i*4+2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    o[i*4+3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
  }
  return o;
}
export function m4persp(o, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  o.fill(0);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
  return o;
}
export function m4ortho(o, l, r, b, t, n, f) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[15] = 1;
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  return o;
}
export function m4look(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0]=xx; o[1]=yx; o[2]=zx; o[3]=0;
  o[4]=xy; o[5]=yy; o[6]=zy; o[7]=0;
  o[8]=xz; o[9]=yz; o[10]=zz; o[11]=0;
  o[12]=-(xx*ex+xy*ey+xz*ez); o[13]=-(yx*ex+yy*ey+yz*ez); o[14]=-(zx*ex+zy*ey+zz*ez); o[15]=1;
  return o;
}
/* модельная матрица: T * Ry * Rx * Rz * S (масштаб равномерный, чтобы нормали не плыли) */
export function m4compose(o, px, py, pz, rx, ry, rz, s) {
  s = s === undefined ? 1 : s;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const m00 = cy * cz + sy * sx * sz, m01 = cx * sz, m02 = -sy * cz + cy * sx * sz;
  const m10 = -cy * sz + sy * sx * cz, m11 = cx * cz, m12 = sy * sz + cy * sx * cz;
  const m20 = sy * cx, m21 = -sx, m22 = cy * cx;
  o[0]=m00*s; o[1]=m01*s; o[2]=m02*s; o[3]=0;
  o[4]=m10*s; o[5]=m11*s; o[6]=m12*s; o[7]=0;
  o[8]=m20*s; o[9]=m21*s; o[10]=m22*s; o[11]=0;
  o[12]=px; o[13]=py; o[14]=pz; o[15]=1;
  return o;
}
export function m4invRT(o, m) {              /* инверсия для матрицы вида «поворот+сдвиг» */
  o[0]=m[0]; o[1]=m[4]; o[2]=m[8]; o[3]=0;
  o[4]=m[1]; o[5]=m[5]; o[6]=m[9]; o[7]=0;
  o[8]=m[2]; o[9]=m[6]; o[10]=m[10]; o[11]=0;
  o[12]=-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]);
  o[13]=-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]);
  o[14]=-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14]);
  o[15]=1; return o;
}
