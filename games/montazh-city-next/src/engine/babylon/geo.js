/* =====================================================================
   geo.js — сборка статической геометрии пачками.

   Район состоит из тысяч мелких кусков (стены, откосы окон, бордюры), и
   если каждый делать отдельным мешем Babylon, вызовов отрисовки будет
   тысячи. Поэтому куски копятся в Batch — по одному на материал — и в конце
   превращаются в один меш через VertexData. Нормали и UV задаются явно;
   UV в метрах, масштаб текстуры решает материал.
   ===================================================================== */
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

export class Batch {
  constructor(name) { this.name = name; this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.useColor = false; }
  get vertexCount() { return this.p.length / 3; }
  /* четырёхугольник по четырём точкам (против часовой стрелки, если смотреть
     со стороны нормали), UV — по четырём парам */
  quad(a, b, c, d, n, uv, col) {
    const base = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    this.uv.push(...uv);
    this.pushColor(4, col);
    /* правая система координат: против часовой — лицом к наблюдателю */
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }
  pushColor(k, col) {
    if (col) this.useColor = true;
    const c = col || [1, 1, 1, 1];
    for (let j = 0; j < k; j++) this.c.push(c[0], c[1], c[2], c[3] ?? 1);
  }
  /* прямоугольник в плоскости с базисом: origin, ось u (единичная), ось v
     (единичная), размер su×sv; нормаль = u × v; UV в метрах со сдвигом */
  rect(o, u, v, su, sv, uvOff = [0, 0], uvScale = 1, col) {
    const n = cross(u, v);
    const a = o, b = add(o, mul(u, su)), c = add(b, mul(v, sv)), d = add(o, mul(v, sv));
    const u0 = uvOff[0] * uvScale, v0 = uvOff[1] * uvScale, u1 = (uvOff[0] + su) * uvScale, v1 = (uvOff[1] + sv) * uvScale;
    return this.quad(a, b, c, d, n, [u0, v0, u1, v0, u1, v1, u0, v1], col);
  }
  /* параллелепипед по осям: центр низа (x, y, z), размеры w (x), h (y), d (z),
     поворот вокруг Y. faces — какие грани нужны (по умолчанию все, кроме низа) */
  box(x, y, z, w, h, d, yaw = 0, opts = {}) {
    const s = opts.uvScale ?? 1, col = opts.color;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const R = v => [x + v[0] * cy + v[2] * sy, y + v[1], z - v[0] * sy + v[2] * cy];
    const RD = v => [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy];
    const hw = w / 2, hd = d / 2;
    const faces = opts.faces || 'tbnsew';
    const P = (a, b, c) => R([a, b, c]);
    const uvw = opts.worldUV ? [x, z] : [0, 0];
    if (faces.includes('t')) this.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), RD([0, 1, 0]), [0, 0, w * s, 0, w * s, d * s, 0, d * s], col);
    if (faces.includes('b')) this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), RD([0, -1, 0]), [0, 0, w * s, 0, w * s, d * s, 0, d * s], col);
    if (faces.includes('s')) this.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), RD([0, 0, 1]), [0, 0, w * s, 0, w * s, h * s, 0, h * s], col);
    if (faces.includes('n')) this.quad(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), RD([0, 0, -1]), [0, 0, w * s, 0, w * s, h * s, 0, h * s], col);
    if (faces.includes('e')) this.quad(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), RD([1, 0, 0]), [0, 0, d * s, 0, d * s, h * s, 0, h * s], col);
    if (faces.includes('w')) this.quad(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), RD([-1, 0, 0]), [0, 0, d * s, 0, d * s, h * s, 0, h * s], col);
    return this;
  }
  /* цилиндр по оси Y: низ в (x, y, z), радиус r, высота h */
  cylinder(x, y, z, r, h, seg = 12, opts = {}) {
    const s = opts.uvScale ?? 1, col = opts.color, base = this.p.length / 3;
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      this.p.push(x + cx * r, y, z + cz * r, x + cx * r, y + h, z + cz * r);
      this.n.push(cx, 0, cz, cx, 0, cz);
      this.uv.push(k / seg * 2 * Math.PI * r * s, 0, k / seg * 2 * Math.PI * r * s, h * s);
      this.pushColor(2, col);
    }
    for (let k = 0; k < seg; k++) { const a = base + k * 2; this.i.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    if (opts.cap !== false) {
      const c0 = this.p.length / 3;
      this.p.push(x, y + h, z); this.n.push(0, 1, 0); this.uv.push(0, 0); this.pushColor(1, col);
      for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; this.p.push(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r); this.n.push(0, 1, 0); this.uv.push(Math.cos(a) * r * s, Math.sin(a) * r * s); this.pushColor(1, col); }
      for (let k = 0; k < seg; k++) this.i.push(c0, c0 + 2 + k, c0 + 1 + k);
    }
    return this;
  }
  /* трубка по ломаной (для ветвей, перил, водостоков): точки, радиусы */
  tube(pts, radii, seg = 8, opts = {}) {
    const s = opts.uvScale ?? 1, col = opts.color;
    const base = this.p.length / 3;
    let along = 0;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k];
      const t = norm(sub(pts[Math.min(k + 1, pts.length - 1)], pts[Math.max(k - 1, 0)]));
      let a = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = norm(cross(a, t)), v = cross(t, u);
      const r = Array.isArray(radii) ? radii[k] : radii;
      if (k > 0) along += len(sub(p, pts[k - 1]));
      for (let j = 0; j <= seg; j++) {
        const ang = j / seg * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
        const nrm = [u[0] * c + v[0] * sn, u[1] * c + v[1] * sn, u[2] * c + v[2] * sn];
        this.p.push(p[0] + nrm[0] * r, p[1] + nrm[1] * r, p[2] + nrm[2] * r);
        this.n.push(...nrm);
        this.uv.push(j / seg * (opts.uWrap ?? 1), along * s);
        this.pushColor(1, col);
      }
    }
    for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < seg; j++) {
      const a = base + k * (seg + 1) + j, b = a + seg + 1;
      this.i.push(a, b + 1, b, a, a + 1, b + 1);
    }
    return this;
  }
  /* стена с проёмами: прямоугольник длиной L и высотой H в плоскости
     (origin, ось u вдоль стены, вверх), нормаль наружу = u × up.
     holes: [{x0, x1, y0, y1}] в метрах. Сетка по разломам, клетки вне
     проёмов сливаются по строкам. */
  wall(o, u, L, H, holes, uvScale = 1, uvOff = [0, 0], col) {
    const up = [0, 1, 0];
    const xs = new Set([0, L]), ys = new Set([0, H]);
    for (const h of holes) { xs.add(clamp(h.x0, 0, L)); xs.add(clamp(h.x1, 0, L)); ys.add(clamp(h.y0, 0, H)); ys.add(clamp(h.y1, 0, H)); }
    const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
    const inHole = (cx, cy) => holes.some(h => cx > h.x0 && cx < h.x1 && cy > h.y0 && cy < h.y1);
    for (let j = 0; j < Y.length - 1; j++) {
      const y0 = Y[j], y1 = Y[j + 1], cy = (y0 + y1) / 2;
      let start = -1;
      for (let i = 0; i <= X.length - 1; i++) {
        const solid = i < X.length - 1 && !inHole((X[i] + X[i + 1]) / 2, cy);
        if (solid && start < 0) start = i;
        if (!solid && start >= 0) {
          const x0 = X[start], x1 = X[i];
          const org = add(add(o, mul(u, x0)), mul(up, y0));
          this.rect(org, u, up, x1 - x0, y1 - y0, [uvOff[0] + x0, uvOff[1] + y0], uvScale, col);
          start = -1;
        }
      }
    }
    return this;
  }
  build(scene, material, opts = {}) {
    if (!this.i.length) return null;
    const m = new Mesh(opts.name || this.name, scene);
    const vd = new VertexData();
    /* Геометрия пишется против часовой стрелки (как glTF), а лицевой гранью
       Babylon считает обход по часовой — даже в правой системе координат.
       Поэтому при сборке порядок вершин в треугольниках разворачивается. */
    const idx = new Uint32Array(this.i.length);
    for (let k = 0; k < this.i.length; k += 3) { idx[k] = this.i[k]; idx[k + 1] = this.i[k + 2]; idx[k + 2] = this.i[k + 1]; }
    vd.positions = this.p; vd.normals = this.n; vd.uvs = this.uv; vd.indices = idx;
    if (this.useColor) vd.colors = this.c;
    vd.applyToMesh(m, false);
    m.material = material;
    if (this.useColor && material) material.useVertexColors = true;
    m.receiveShadows = opts.receiveShadows !== false;
    if (opts.freeze !== false) { m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; }
    m.isPickable = false;
    return m;
  }
}

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* детерминированный генератор — чтобы район выглядел одинаково при каждой загрузке */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/* гладкий шум для крупных пятен на земле и стенах */
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const h = (a, b) => { let n = a * 374761393 + b * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = t => t * t * (3 - 2 * t);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(zf) + (a - b - c + d) * s(xf) * s(zf);
}
export function fbm(x, z, oct = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * noise2(x * f, z * f); f *= 2.03; a *= 0.5; } return v; }
