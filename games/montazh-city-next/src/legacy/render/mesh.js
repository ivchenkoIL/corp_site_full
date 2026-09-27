/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «2. Меши: сборка геометрии», строки 2148–2675.
   ===================================================================== */
import { D2R, TAU, clamp, lerp } from '../core/util.js';
import { W } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 2. Меши: сборка геометрии                                            */
/* ------------------------------------------------------------------ */
export const STRIDE = 14;                       /* pos3 nor3 uv2 col3 emis1 part1 gloss1 */

/* Замкнутый контур скруглённого прямоугольника в плоскости XZ.
   Точки идут так, чтобы боковые четырёхугольники и верхняя крышка
   получались лицевой стороной наружу (обход против часовой сверху). */
export function rrLoop(w, d, r, cs) {
  r = clamp(r, 0.0015, Math.max(0.0015, Math.min(w, d) / 2 - 1e-4));
  cs = Math.max(1, cs | 0);
  const hw = w / 2 - r, hd = d / 2 - r;
  const corners = [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]];
  const pts = [];
  let per = 0;
  for (let ci = 0; ci < 4; ci++) {
    const [cx, cz] = corners[ci];
    for (let s = 0; s <= cs; s++) {
      const a = (ci + s / cs) * (Math.PI / 2);
      const nx = Math.cos(a), nz = Math.sin(a);
      pts.push({ x: cx + nx * r, z: cz + nz * r, nx, nz, u: 0 });
    }
  }
  pts.reverse();
  for (let i = 0; i < pts.length; i++) {
    pts[i].u = per;
    const j = (i + 1) % pts.length;
    per += Math.hypot(pts[j].x - pts[i].x, pts[j].z - pts[i].z);
  }
  pts.per = per;
  return pts;
}

export class Mesh {
  constructor() { this.v = []; this.i = []; this.n = 0; this.g = 0; }
  /* блеск — «состояние материала»: примитивы берут его из opt.gloss */
  _g(opt) { const p = this.g; if (opt && opt.gloss !== undefined) this.g = opt.gloss; return p; }
  vert(x, y, z, nx, ny, nz, u, vv, r, g, b, e, part) {
    this.v.push(x, y, z, nx, ny, nz, u, vv, r, g, b, e || 0, part || 0, this.g);
    return this.n++;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  /* четырёхугольник с разными нормалями в вершинах */
  quadN(p0, p1, p2, p3, n0, n1, n2, n3, uv, col, emis, part) {
    const [r, g, b] = col;
    const a = this.vert(p0[0], p0[1], p0[2], n0[0], n0[1], n0[2], uv[0], uv[1], r, g, b, emis, part);
    const bb = this.vert(p1[0], p1[1], p1[2], n1[0], n1[1], n1[2], uv[2], uv[3], r, g, b, emis, part);
    const c = this.vert(p2[0], p2[1], p2[2], n2[0], n2[1], n2[2], uv[4], uv[5], r, g, b, emis, part);
    const d = this.vert(p3[0], p3[1], p3[2], n3[0], n3[1], n3[2], uv[6], uv[7], r, g, b, emis, part);
    this.i.push(a, bb, c, a, c, d);
  }
  /* четырёхугольник с разными цветами в вершинах — мягкие переходы */
  quadC(p0, p1, p2, p3, nx, ny, nz, uv, c0, c1, c2, c3, emis, part) {
    const a = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, uv[0], uv[1], c0[0], c0[1], c0[2], emis, part);
    const b = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, uv[2], uv[3], c1[0], c1[1], c1[2], emis, part);
    const c = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, uv[4], uv[5], c2[0], c2[1], c2[2], emis, part);
    const d = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, uv[6], uv[7], c3[0], c3[1], c3[2], emis, part);
    this.i.push(a, b, c, a, c, d);
  }
  quad(p0, p1, p2, p3, nx, ny, nz, uv, col, emis, part) {
    const n = [nx, ny, nz];
    this.quadN(p0, p1, p2, p3, n, n, n, n, uv, col, emis, part);
  }
  /* коробка: центр по XZ, основание на y0; uvScale — метров на тайл */
  box(cx, y0, cz, w, h, d, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const s = opt.uv || 1, e = opt.emis || 0, part = opt.part || 0;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    const top = opt.topCol || col, side = col;
    const uw = w / s, ud = d / s, uh = h / s;
    const uo = opt.uvOff || [0, 0];
    if (opt.skipSides !== true) {
      this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], 0,0,1, [uo[0],ud+uo[1], uo[0]+uw,ud+uo[1], uo[0]+uw,uo[1], uo[0],uo[1]], side, e, part);
      this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], 0,0,-1, [uo[0],ud+uo[1], uo[0]+uw,ud+uo[1], uo[0]+uw,uo[1], uo[0],uo[1]], side, e, part);
      this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], 1,0,0, [uo[0],ud+uo[1], uo[0]+ud,ud+uo[1], uo[0]+ud,uo[1], uo[0],uo[1]], side, e, part);
      this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], -1,0,0, [uo[0],ud+uo[1], uo[0]+ud,ud+uo[1], uo[0]+ud,uo[1], uo[0],uo[1]], side, e, part);
      /* по вертикали растягиваем ровно по высоте */
      const base = this.v.length - 4 * 4 * STRIDE;
      for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) {
        const idx = base + (f * 4 + k) * STRIDE + 7;
        this.v[idx] = (k === 0 || k === 1) ? uh + uo[1] : uo[1];
      }
    }
    if (opt.skipTop !== true)
      this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], 0,1,0, [uo[0],uo[1], uo[0]+uw,uo[1], uo[0]+uw,uo[1]+ud, uo[0],uo[1]+ud], top, opt.topEmis || 0, part);
    if (opt.bottom === true)
      this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1], 0,-1,0, [0,0, uw,0, uw,ud, 0,ud], col, 0, part);
    this.g = gp;
  }
  /* Коробка с фасками (и, если нужно, сужением кверху).
     opt: bev — ширина фаски, r — радиус скругления углов в плане,
     cs — сегментов на угол, taper — [sx, sz] масштаб верхней грани. */
  bevelBox(cx, y0, cz, w, h, d, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const bev = Math.min(opt.bev === undefined ? Math.min(w, h, d) * 0.12 : opt.bev, h / 2 - 1e-3, Math.min(w, d) / 2 - 1e-3);
    const r = Math.max(opt.r || 0, 0.0015), cs = Math.max(1, opt.cs || 2);
    const tp = opt.taper || [1, 1];
    const uvS = opt.uv || 1, e = opt.emis || 0, part = opt.part || 0;
    const top = opt.topCol || col;
    /* профили колец: [доля высоты, вписка внутрь, признак фаски] */
    const rings = [
      { t: 0, in: bev, k: -1 },
      { t: bev / h, in: 0, k: 0 },
      { t: 1 - bev / h, in: 0, k: 0 },
      { t: 1, in: bev, k: 1 }
    ];
    const loops = rings.map(rg => {
      const sx = lerp(1, tp[0], rg.t), sz = lerp(1, tp[1], rg.t);
      const ww = Math.max(0.002, w * sx - rg.in * 2), dd = Math.max(0.002, d * sz - rg.in * 2);
      const lp = rrLoop(ww, dd, Math.min(r, Math.min(ww, dd) / 2 - 1e-4), cs);
      return { lp, y: y0 + h * rg.t, k: rg.k };
    });
    const N = loops[0].lp.length;
    const nrm = (p, k) => {
      if (!k) return [p.nx, 0, p.nz];
      const l = Math.hypot(p.nx * 0.62, 0.78, p.nz * 0.62);
      return [p.nx * 0.62 / l, k * 0.78 / l, p.nz * 0.62 / l];
    };
    for (let ri = 0; ri < 3; ri++) {
      const A = loops[ri], B = loops[ri + 1];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a0 = A.lp[i], a1 = A.lp[j], b0 = B.lp[i], b1 = B.lp[j];
        const u0 = a0.u / uvS, u1 = (j === 0 ? A.lp.per : a1.u) / uvS;
        const v0 = (A.y - y0) / uvS, v1 = (B.y - y0) / uvS;
        this.quadN([a0.x + cx, A.y, a0.z + cz], [a1.x + cx, A.y, a1.z + cz],
                   [b1.x + cx, B.y, b1.z + cz], [b0.x + cx, B.y, b0.z + cz],
                   nrm(a0, A.k), nrm(a1, A.k), nrm(b1, B.k), nrm(b0, B.k),
                   [u0, v0, u1, v0, u1, v1, u0, v1], col, e, part);
      }
    }
    if (opt.skipTop !== true) {
      const T = loops[3];
      const c = this.vert(cx, T.y, cz, 0, 1, 0, 0.5, 0.5, top[0], top[1], top[2], opt.topEmis || e, part);
      const idx = [];
      for (let i = 0; i < N; i++) {
        const p = T.lp[i];
        idx.push(this.vert(p.x + cx, T.y, p.z + cz, 0, 1, 0, (p.x + cx) / uvS, (p.z + cz) / uvS, top[0], top[1], top[2], opt.topEmis || e, part));
      }
      for (let i = 0; i < N; i++) this.tri(c, idx[(i + 1) % N], idx[i]);
    }
    if (opt.bottom === true) {
      const T = loops[0];
      const c = this.vert(cx, T.y, cz, 0, -1, 0, 0.5, 0.5, col[0], col[1], col[2], e, part);
      const idx = [];
      for (let i = 0; i < N; i++) {
        const p = T.lp[i];
        idx.push(this.vert(p.x + cx, T.y, p.z + cz, 0, -1, 0, (p.x + cx) / uvS, (p.z + cz) / uvS, col[0], col[1], col[2], e, part));
      }
      for (let i = 0; i < N; i++) this.tri(c, idx[i], idx[(i + 1) % N]);
    }
    this.g = gp;
  }
  /* горизонтальная площадка (дорога, тротуар, газон) */
  plate(x0, z0, x1, z1, y, col, uvScale, emis, rot, gloss) {
    const gp = this.g; if (gloss !== undefined) this.g = gloss;
    const s = uvScale || 1;
    const u0 = rot ? z0 / s : x0 / s, u1 = rot ? z1 / s : x1 / s;
    const v0 = rot ? x0 / s : z0 / s, v1 = rot ? x1 / s : z1 / s;
    this.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0], 0,1,0,
      [u0,v1, u1,v1, u1,v0, u0,v0], col, emis || 0, 0);
    this.g = gp;
  }
  cyl(cx, y0, cz, r, h, seg, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const part = opt.part || 0, e = opt.emis || 0;
    const rTop = opt.rTop === undefined ? r : opt.rTop;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quadN([cx+c0*r,y0,cz+s0*r],[cx+c1*r,y0,cz+s1*r],[cx+c1*rTop,y0+h,cz+s1*rTop],[cx+c0*rTop,y0+h,cz+s0*rTop],
        [c0,0,s0],[c1,0,s1],[c1,0,s1],[c0,0,s0],
        [i/seg*2,1, (i+1)/seg*2,1, (i+1)/seg*2,0, i/seg*2,0], col, e, part);
    }
    if (opt.cap !== false) {
      const cy = y0 + h;
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        const A = this.vert(cx, cy, cz, 0,1,0, .5,.5, col[0],col[1],col[2], e, part);
        const B = this.vert(cx+Math.cos(a0)*rTop, cy, cz+Math.sin(a0)*rTop, 0,1,0, .5+Math.cos(a0)*.5,.5+Math.sin(a0)*.5, col[0],col[1],col[2], e, part);
        const C = this.vert(cx+Math.cos(a1)*rTop, cy, cz+Math.sin(a1)*rTop, 0,1,0, .5+Math.cos(a1)*.5,.5+Math.sin(a1)*.5, col[0],col[1],col[2], e, part);
        this.i.push(A, C, B);          /* обход против часовой сверху */
      }
    }
    if (opt.capBottom) {
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        const A = this.vert(cx, y0, cz, 0,-1,0, .5,.5, col[0],col[1],col[2], e, part);
        const B = this.vert(cx+Math.cos(a1)*r, y0, cz+Math.sin(a1)*r, 0,-1,0, .5,.5, col[0],col[1],col[2], e, part);
        const C = this.vert(cx+Math.cos(a0)*r, y0, cz+Math.sin(a0)*r, 0,-1,0, .5,.5, col[0],col[1],col[2], e, part);
        this.i.push(A, B, C);
      }
    }
    this.g = gp;
  }
  /* эллипсоид: головы, плечи, кисти, кроны деревьев */
  ellipsoid(cx, cy, cz, rx, ry, rz, seg, rings, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const part = opt.part || 0, e = opt.emis || 0;
    const y0 = opt.cut === undefined ? -1 : opt.cut;   /* обрезка снизу, -1..1 */
    const grid = [];
    for (let r0 = 0; r0 <= rings; r0++) {
      const v = r0 / rings;
      const phi = Math.acos(clamp(lerp(1, y0, v), -1, 1));
      const sy = Math.cos(phi), sr = Math.sin(phi);
      const row = [];
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * TAU;
        const nx = Math.cos(a) * sr, nz = Math.sin(a) * sr;
        const px = cx + nx * rx, py = cy + sy * ry, pz = cz + nz * rz;
        let gx = nx / rx, gy = sy / ry, gz = nz / rz;
        const l = Math.hypot(gx, gy, gz) || 1;
        row.push(this.vert(px, py, pz, gx / l, gy / l, gz / l, s / seg * 2, v, col[0], col[1], col[2], e, part));
      }
      grid.push(row);
    }
    for (let r0 = 0; r0 < rings; r0++) for (let s = 0; s < seg; s++) {
      const a = grid[r0][s], b = grid[r0][s + 1], c = grid[r0 + 1][s + 1], d = grid[r0 + 1][s];
      if (r0 > 0) this.i.push(a, b, c);
      if (r0 < rings - 1 || y0 > -0.999) this.i.push(a, c, d);
    }
    this.g = gp;
  }
  /* Выдавливание замкнутого профиля (в плоскости XY) вдоль оси Z.
     profile: [[x,y], ...] против часовой при взгляде с +Z.
     slices:  [{z, sx, sy}] — сечения; масштаб относительно origin. */
  extrudeZ(profile, slices, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const part = opt.part || 0, e = opt.emis || 0, uvS = opt.uv || 1;
    const ox = opt.origin ? opt.origin[0] : 0, oy = opt.origin ? opt.origin[1] : 0;
    const N = profile.length;
    /* нормали рёбер профиля и их сглаживание по углу */
    const en = [];
    let per = 0; const arc = [];
    for (let i = 0; i < N; i++) {
      arc.push(per);
      const j = (i + 1) % N;
      const dx = profile[j][0] - profile[i][0], dy = profile[j][1] - profile[i][1];
      const l = Math.hypot(dx, dy) || 1;
      en.push([dy / l, -dx / l]);
      per += l;
    }
    const cosT = Math.cos((opt.smooth === undefined ? 62 : opt.smooth) * D2R);
    const vn = [];
    for (let i = 0; i < N; i++) {
      const a = en[(i - 1 + N) % N], b = en[i];
      if (a[0] * b[0] + a[1] * b[1] > cosT) {
        const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
        vn.push([[x / l, y / l], [x / l, y / l]]);
      } else vn.push([[a[0], a[1]], [b[0], b[1]]]);   /* острое ребро: своя нормаль */
    }
    const P = (s, i) => [ox + (profile[i][0] - ox) * s.sx, oy + (profile[i][1] - oy) * s.sy, s.z];
    for (let k = 0; k < slices.length - 1; k++) {
      const A = slices[k], B = slices[k + 1];
      const zt = Math.abs(B.z - A.z);
      const tap = Math.abs(B.sx - A.sx) + Math.abs(B.sy - A.sy);
      /* при сужении наклоняем нормаль наружу-вдоль Z */
      const zn = tap > 1e-4 ? clamp(tap * 1.6 / Math.max(zt, 0.02), 0, 2.2) : 0;
      const sgnA = A.z < B.z ? -1 : 1;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const na = vn[i][1], nb = vn[j][0];
        const mk = (n2, sgn) => {
          const l = Math.hypot(n2[0], n2[1], zn * sgn) || 1;
          return [n2[0] / l, n2[1] / l, zn * sgn / l];
        };
        const u0 = arc[i] / uvS, u1 = (j === 0 ? per : arc[j]) / uvS;
        this.quadN(P(A, i), P(A, j), P(B, j), P(B, i),
          mk(na, sgnA), mk(nb, sgnA), mk(nb, -sgnA), mk(na, -sgnA),
          [u0, A.z / uvS, u1, A.z / uvS, u1, B.z / uvS, u0, B.z / uvS], col, e, part);
      }
    }
    if (opt.caps !== false) {
      for (const [s, dir] of [[slices[0], -1], [slices[slices.length - 1], 1]]) {
        let cx2 = 0, cy2 = 0;
        for (let i = 0; i < N; i++) { const p = P(s, i); cx2 += p[0]; cy2 += p[1]; }
        cx2 /= N; cy2 /= N;
        const c = this.vert(cx2, cy2, s.z, 0, 0, dir, .5, .5, col[0], col[1], col[2], e, part);
        const idx = [];
        for (let i = 0; i < N; i++) {
          const p = P(s, i);
          idx.push(this.vert(p[0], p[1], p[2], 0, 0, dir, p[0] / uvS, p[1] / uvS, col[0], col[1], col[2], e, part));
        }
        for (let i = 0; i < N; i++) {
          const a = idx[i], b = idx[(i + 1) % N];
          if (dir > 0) this.i.push(c, a, b); else this.i.push(c, b, a);
        }
      }
    }
    this.g = gp;
  }
  /* труба вдоль ломаной: рамы, поручни, водостоки, кабели */
  tube(pts, r, seg, col, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const part = opt.part || 0, e = opt.emis || 0;
    let up = [0, 1, 0];
    const rings = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      let tl = Math.hypot(t[0], t[1], t[2]) || 1;
      t = [t[0] / tl, t[1] / tl, t[2] / tl];
      if (Math.abs(t[0] * up[0] + t[1] * up[1] + t[2] * up[2]) > 0.95) up = [1, 0, 0];
      let sx = [up[1] * t[2] - up[2] * t[1], up[2] * t[0] - up[0] * t[2], up[0] * t[1] - up[1] * t[0]];
      let sl = Math.hypot(sx[0], sx[1], sx[2]) || 1;
      sx = [sx[0] / sl, sx[1] / sl, sx[2] / sl];
      const sy = [t[1] * sx[2] - t[2] * sx[1], t[2] * sx[0] - t[0] * sx[2], t[0] * sx[1] - t[1] * sx[0]];
      const rr = Array.isArray(r) ? r[Math.min(i, r.length - 1)] : r;
      const row = [];
      for (let s = 0; s <= seg; s++) {
        const ang = s / seg * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = sx[0] * ca + sy[0] * sa, ny = sx[1] * ca + sy[1] * sa, nz = sx[2] * ca + sy[2] * sa;
        row.push(this.vert(pts[i][0] + nx * rr, pts[i][1] + ny * rr, pts[i][2] + nz * rr,
          nx, ny, nz, s / seg * 2, i * 0.5, col[0], col[1], col[2], e, part));
      }
      rings.push(row);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < seg; s++) {
      const a = rings[i][s], b = rings[i][s + 1], c = rings[i + 1][s + 1], d = rings[i + 1][s];
      this.i.push(a, b, c, a, c, d);
    }
    this.g = gp;
  }
  /* колесо: диск в плоскости XY, ось по Z (простая версия) */
  wheel(r, width, seg, col, rim, part) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        const z = side * width / 2;
        const A = this.vert(0, 0, z, 0, 0, side, .5, .5, rim[0], rim[1], rim[2], 0, part);
        const B = this.vert(Math.cos(a0) * r, Math.sin(a0) * r, z, 0, 0, side, .5 + Math.cos(a0) * .5, .5 + Math.sin(a0) * .5, col[0], col[1], col[2], 0, part);
        const C = this.vert(Math.cos(a1) * r, Math.sin(a1) * r, z, 0, 0, side, .5 + Math.cos(a1) * .5, .5 + Math.sin(a1) * .5, col[0], col[1], col[2], 0, part);
        if (side > 0) this.i.push(A, B, C); else this.i.push(A, C, B);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quadN([c0*r,s0*r,-width/2],[c1*r,s1*r,-width/2],[c1*r,s1*r,width/2],[c0*r,s0*r,width/2],
        [c0,s0,0],[c1,s1,0],[c1,s1,0],[c0,s0,0], [0,0, 1,0, 1,1, 0,1], col, 0, part);
    }
  }
  /* автомобильное колесо: шина с плечами и профилем + диск со спицами */
  wheelDetailed(r, width, seg, tyre, rim, part, opt) {
    opt = opt || {};
    const gp = this._g(opt);
    const hw = width / 2, sh = r * 0.16;              /* скругление плеча шины */
    const rimR = opt.rimR === undefined ? r * 0.62 : opt.rimR;
    const spokes = opt.spokes === undefined ? 6 : opt.spokes;
    const prof = [                                     /* [z, радиус, признак фаски] */
      [-hw * 0.66, rimR, 1], [-hw, r - sh, 1], [-hw * 0.92, r, 0],
      [hw * 0.92, r, 0], [hw, r - sh, 1], [hw * 0.66, rimR, 1]
    ];
    for (let k = 0; k < prof.length - 1; k++) {
      const [z0, r0] = prof[k], [z1, r1] = prof[k + 1];
      const dz = z1 - z0, dr = r1 - r0;
      const ln = Math.hypot(dz, dr) || 1;
      const nr = dz / ln, nz = -dr / ln;
      const dark = k === 0 || k === prof.length - 2 ? 0.65 : 1;
      const c = [tyre[0] * dark, tyre[1] * dark, tyre[2] * dark];
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        this.quadN([c0*r0,s0*r0,z0],[c1*r0,s1*r0,z0],[c1*r1,s1*r1,z1],[c0*r1,s0*r1,z1],
          [c0*nr,s0*nr,nz],[c1*nr,s1*nr,nz],[c1*nr,s1*nr,nz],[c0*nr,s0*nr,nz],
          [i/seg*3,0, (i+1)/seg*3,0, (i+1)/seg*3,1, i/seg*3,1], c, 0, part);
      }
    }
    /* диск: тарелка со спицами и ступицей */
    for (const side of [-1, 1]) {
      const z = side * hw * 0.66;
      const hub = this.vert(0, 0, z + side * 0.012, 0, 0, side, .5, .5, rim[0], rim[1], rim[2], 0, part);
      const ring = [];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU;
        const k = ((i % Math.max(1, Math.round(seg / spokes))) === 0) ? 1 : 0.55;
        ring.push(this.vert(Math.cos(a) * rimR, Math.sin(a) * rimR, z, 0, 0, side,
          .5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5, rim[0] * k, rim[1] * k, rim[2] * k, 0, part));
      }
      for (let i = 0; i < seg; i++) {
        if (side > 0) this.i.push(hub, ring[i], ring[i + 1]);
        else this.i.push(hub, ring[i + 1], ring[i]);
      }
    }
    this.g = gp;
  }
  /* поворот всей сетки вокруг Y: удобно собирать кузов «длиной по X»,
     а потом развернуть его носом по +Z */
  rotY(a) {
    const c = Math.cos(a), s2 = Math.sin(a);
    for (let i = 0; i < this.v.length; i += STRIDE) {
      const x = this.v[i], z = this.v[i + 2];
      this.v[i] = x * c + z * s2; this.v[i + 2] = -x * s2 + z * c;
      const nx = this.v[i + 3], nz = this.v[i + 5];
      this.v[i + 3] = nx * c + nz * s2; this.v[i + 5] = -nx * s2 + nz * c;
    }
    return this;
  }
  /* сглаживание нормалей: усредняем по совпадающим позициям, если рёбра
     сходятся под углом меньше порога */
  smoothNormals(maxDeg) {
    const cosT = Math.cos((maxDeg === undefined ? 55 : maxDeg) * D2R);
    const map = new Map();
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE;
      const key = (Math.round(this.v[o] * 900) + ',' + Math.round(this.v[o+1] * 900) + ',' + Math.round(this.v[o+2] * 900));
      let a = map.get(key); if (!a) { a = []; map.set(key, a); }
      a.push(i);
    }
    const out = new Float32Array(this.n * 3);
    for (const a of map.values()) {
      for (const i of a) {
        const o = i * STRIDE;
        let nx = 0, ny = 0, nz = 0;
        for (const j of a) {
          const q = j * STRIDE;
          if (this.v[o+3] * this.v[q+3] + this.v[o+4] * this.v[q+4] + this.v[o+5] * this.v[q+5] < cosT) continue;
          nx += this.v[q+3]; ny += this.v[q+4]; nz += this.v[q+5];
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        out[i*3] = nx / l; out[i*3+1] = ny / l; out[i*3+2] = nz / l;
      }
    }
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE;
      this.v[o+3] = out[i*3]; this.v[o+4] = out[i*3+1]; this.v[o+5] = out[i*3+2];
    }
    return this;
  }
  /* затемнение низа — дешёвое «затенение» без карт теней */
  aoByHeight(y0, y1, strength) {
    for (let i = 0; i < this.v.length; i += STRIDE) {
      const y = this.v[i + 1];
      const t = clamp((y - y0) / Math.max(0.01, y1 - y0), 0, 1);
      const k = lerp(1 - strength, 1, t);
      this.v[i + 8] *= k; this.v[i + 9] *= k; this.v[i + 10] *= k;
    }
  }
  merge(other, dx, dy, dz) {
    const base = this.n;
    for (let i = 0; i < other.v.length; i += STRIDE) {
      this.v.push(other.v[i] + (dx || 0), other.v[i+1] + (dy || 0), other.v[i+2] + (dz || 0));
      for (let k = 3; k < STRIDE; k++) this.v.push(other.v[i + k]);
      this.n++;
    }
    for (const idx of other.i) this.i.push(idx + base);
  }
  /* Разложить треугольники по клеткам сетки XZ и переставить индексы так,
     чтобы каждая клетка занимала непрерывный кусок буфера. Отсев тогда
     сводится к «нарисовать такие-то диапазоны», а буфер остаётся один.

     Клетка треугольника — по центру тяжести, а коробка клетки — по всем трём
     вершинам с запасом: длинный треугольник дороги торчит из своей клетки, и
     коробка обязана это учесть, иначе он пропадёт на краю кадра.

     Возвращает { n, start, count, box } — box по шесть чисел на клетку.
     Пустые клетки остаются с count = 0 и в кадре не рассматриваются. */
  cellify(cellSize, pad) {
    const C = Math.max(1, cellSize || 16), P = pad || 0;
    const nx = Math.ceil(W.x / C), nz = Math.ceil(W.z / C), n = nx * nz;
    const tri = this.i.length / 3;
    const of = new Int32Array(tri);                 /* клетка каждого треугольника */
    const count = new Int32Array(n), start = new Int32Array(n);
    const box = new Float32Array(n * 6);
    for (let c = 0; c < n; c++) {
      box[c*6] = box[c*6+1] = box[c*6+2] = 1e30;
      box[c*6+3] = box[c*6+4] = box[c*6+5] = -1e30;
    }
    for (let t = 0; t < tri; t++) {
      const a = this.i[t*3] * STRIDE, b = this.i[t*3+1] * STRIDE, c2 = this.i[t*3+2] * STRIDE;
      const cx = (this.v[a] + this.v[b] + this.v[c2]) / 3;
      const cz = (this.v[a+2] + this.v[b+2] + this.v[c2+2]) / 3;
      const gx = clamp(Math.floor(cx / C), 0, nx - 1), gz = clamp(Math.floor(cz / C), 0, nz - 1);
      const ci = gz * nx + gx;
      of[t] = ci; count[ci]++;
      const bb = ci * 6;
      for (const o of [a, b, c2]) {
        if (this.v[o]   < box[bb])   box[bb]   = this.v[o];
        if (this.v[o+1] < box[bb+1]) box[bb+1] = this.v[o+1];
        if (this.v[o+2] < box[bb+2]) box[bb+2] = this.v[o+2];
        if (this.v[o]   > box[bb+3]) box[bb+3] = this.v[o];
        if (this.v[o+1] > box[bb+4]) box[bb+4] = this.v[o+1];
        if (this.v[o+2] > box[bb+5]) box[bb+5] = this.v[o+2];
      }
    }
    let acc = 0;
    for (let c = 0; c < n; c++) {
      start[c] = acc; acc += count[c];
      if (count[c]) { const bb = c * 6; box[bb] -= P; box[bb+1] -= P; box[bb+2] -= P; box[bb+3] += P; box[bb+4] += P; box[bb+5] += P; }
    }
    const cur = start.slice(), out = new Array(this.i.length);
    for (let t = 0; t < tri; t++) {
      const d = cur[of[t]]++ * 3;
      out[d] = this.i[t*3]; out[d+1] = this.i[t*3+1]; out[d+2] = this.i[t*3+2];
    }
    this.i = out;
    /* start/count в треугольниках — в индексах умножим при отрисовке */
    this.cells = { n, nx, nz, cell: C, start, count, box };
    return this;
  }
  upload(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const big = this.n > 65535;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(this.i) : new Uint16Array(this.i), gl.STATIC_DRAW);
    const S = STRIDE * 4;
    const attrs = [[0,3,0],[1,3,12],[2,2,24],[3,3,32],[4,1,44],[5,1,48],[6,1,52]];
    for (const [loc, size, off] of attrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off);
    }
    gl.bindVertexArray(null);
    return { vao, count: this.i.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, verts: this.n, tris: this.i.length / 3,
             cells: this.cells || null, ibytes: big ? 4 : 2 };
  }
}
