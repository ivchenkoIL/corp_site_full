/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «Растительность: атлас, карты, ветер», строки 4461–5345.
   ===================================================================== */
import { Q, QCFG } from '../core/quality.js';
import { TAU, lerp, mulberry32, rnd } from '../core/util.js';
import { Mesh } from './mesh.js';
import { Static } from './static.js';
import { LY, curbRun, emitArrow, emitBuilding, emitInlet, emitManhole, emitPatch, emitPuddle, emitSign, roadPlate } from './street.js';
import { BUILDINGS, KIOSKS, POLES, POTHOLES, PROPS, ROADS_X, ROADS_Z, ROAD_W, SIDE_W, W } from '../world/district.js';
export const cellUV = c => [c.u0, c.vB, c.u1, c.vB, c.u1, c.vT, c.u0, c.vT];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
/* Множитель плотности зелени. Берётся из профиля качества (Q.veg) в начале
   buildWorld; перестройка мира не удаляет старые GPU-буферы, поэтому на лету
   не меняется — только при следующем запуске. */
export const VEG = { grass: 1, cards: 1 };

/* Карта зелени. p0,p1 — нижняя пара вершин (тёмный цвет, свой вес ветра),
   p2,p3 — верхняя (светлее, качается сильнее). Пишем вершины напрямую:
   quad даёт один цвет на всю карту, quadC — один вес ветра. */
export function swayCard(m, p0, p1, p2, p3, n, uv, cLo, cHi, wLo, wHi) {
  const a = m.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0], uv[1], cLo[0], cLo[1], cLo[2], 0, wLo);
  const b = m.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv[2], uv[3], cLo[0], cLo[1], cLo[2], 0, wLo);
  const c = m.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[4], uv[5], cHi[0], cHi[1], cHi[2], 0, wHi);
  const d = m.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv[6], uv[7], cHi[0], cHi[1], cHi[2], 0, wHi);
  m.i.push(a, b, c, a, c, d);
}
/* Карта кроны: прямоугольник в вертикальной плоскости, развёрнутой на угол a,
   с завалом tilt — верх уходит наружу, и крона перестаёт быть «жалюзи». */
export function leafCard(m, px, py, pz, a, w, hgt, tilt, cLo, cHi, cell, wind) {
  const ux = Math.cos(a), uz = Math.sin(a), hw = w / 2, hh = hgt / 2;
  const ty = Math.cos(tilt) * hh, tr = Math.sin(tilt) * hh;
  const ax = ux * hw, az = uz * hw;                 /* половина ширины */
  const bx = -uz * tr, by = ty, bz = ux * tr;       /* половина высоты с завалом */
  swayCard(m, [px - ax - bx, py - by, pz - az - bz], [px + ax - bx, py - by, pz + az - bz],
    [px + ax + bx, py + by, pz + az + bz], [px - ax + bx, py + by, pz - az + bz],
    [uz, 0.30, -ux], cellUV(cell), cLo, cHi, wind * 0.35, wind);
}
/* Карта, растущая от земли: низ прибит (вес 0), верх качается. */
export function groundCard(m, x, y, z, a, w, hgt, cLo, cHi, cell, wind) {
  const ux = Math.cos(a) * w * 0.5, uz = Math.sin(a) * w * 0.5;
  swayCard(m, [x - ux, y, z - uz], [x + ux, y, z + uz],
    [x + ux, y + hgt, z + uz], [x - ux, y + hgt, z - uz],
    [Math.sin(a), 0.34, -Math.cos(a)], cellUV(cell), cLo, cHi, 0, wind);
}
/* Еловая лапа: почти горизонтальная карта от ствола наружу. Ось U идёт вдоль
   луча, поэтому перо хвои на текстуре смотрит от ствола к кончику. Вес ветра
   растёт к концу лапы, у ствола он нулевой. */
export function firFrond(m, x, y, z, a, len, wid, droop, cLo, cHi, wind) {
  const ux = Math.cos(a), uz = Math.sin(a);
  const ex = x + ux * len, ey = y - droop * len, ez = z + uz * len;
  const sx = -uz * wid * 0.5, sz = ux * wid * 0.5, C = CELL.fir;
  const nx = ux * droop, nz = uz * droop;
  const A = m.vert(x - sx, y, z - sz, nx, 1, nz, C.u0, C.vB, cLo[0], cLo[1], cLo[2], 0, 0);
  const B = m.vert(ex - sx, ey, ez - sz, nx, 1, nz, C.u1, C.vB, cHi[0], cHi[1], cHi[2], 0, wind);
  const D = m.vert(ex + sx, ey, ez + sz, nx, 1, nz, C.u1, C.vT, cHi[0], cHi[1], cHi[2], 0, wind);
  const E = m.vert(x + sx, y, z + sz, nx, 1, nz, C.u0, C.vT, cLo[0], cLo[1], cLo[2], 0, 0);
  m.i.push(A, B, D, A, D, E);
}

/* Породы. h — высота ствола, cr — радиус кроны, lean — разброс наклона,
   trunk.top — доля высоты, до которой доходит ствол (у ели до макушки,
   у клёна обрывается развилкой), branches.from — на сколько узлов ниже
   верхушки могут отходить ветви, droop — насколько конец ветви клонится. */
export const TREE_SP = {
  poplar: {                          /* тополь: свеча вдоль дороги */
    h: [7.4, 10.6], cr: [1.5, 2.1], lean: 0.30, bark: 'bark',
    trunk: { r0: 0.28, r1: 0.075, seg: 6, ring: 7, top: 0.86, col: [.80, .78, .72] },
    branches: { n: [5, 8], from: 3, out: [0.30, 0.50], up: [1.1, 2.1], arc: 0.18, droop: 0, r: [0.07, 0.05, 0.026] },
    crown: 'column', cell: 'veil', leaf: [[.52, .68, .34], [.74, .86, .46]],
    litter: [.74, .72, .34], solid: 0.72
  },
  birch: {                           /* берёза: белый ствол, поникшая крона */
    h: [6.0, 8.4], cr: [2.1, 3.0], lean: 0.55, bark: 'birch',
    trunk: { r0: 0.21, r1: 0.065, seg: 6, ring: 7, top: 0.80, col: [1, 1, 1] },
    branches: { n: [4, 6], from: 2, out: [0.72, 1.10], up: [0.55, 1.10], arc: 0.30, droop: 0.45, r: [0.055, 0.038, 0.018] },
    crown: 'drop', cell: 'veil', leaf: [[.56, .74, .36], [.82, .92, .52]],
    litter: [.90, .80, .38], solid: 0.60
  },
  spruce: {                          /* ель: конус из лап, ствол до макушки */
    h: [5.6, 9.2], cr: [1.9, 2.8], lean: 0.08, bark: 'bark',
    trunk: { r0: 0.26, r1: 0.035, seg: 6, ring: 6, top: 1.0, col: [.56, .46, .42] },
    branches: null,                  /* их роль играют мутовки лап */
    crown: 'cone', cell: 'fir', leaf: [[.28, .44, .30], [.44, .62, .40]],
    litter: [.42, .40, .28], solid: 0.90
  },
  maple: {                           /* клён: низкая развилка, шатёр */
    h: [4.2, 5.8], cr: [3.0, 4.2], lean: 0.60, bark: 'bark',
    trunk: { r0: 0.34, r1: 0.14, seg: 5, ring: 8, top: 0.78, col: [.78, .72, .66] },
    branches: { n: [3, 5], from: 2, out: [0.80, 1.25], up: [0.70, 1.35], arc: 0.22, droop: 0.05, r: [0.11, 0.075, 0.038] },
    crown: 'dome', cell: 'broad', leaf: [[.62, .74, .30], [.92, .88, .44]],
    litter: [.95, .72, .28], solid: 0.85
  }
};
export const TREE_KEYS = ['poplar', 'birch', 'spruce', 'maple'];
/* Порода — детерминированно от координат: emitTree и buildSolids обязаны
   договориться, иначе коллизия не совпадёт с деревом. Первый бросок RNG
   в emitTree тратится ровно на это, поэтому здесь тот же первый бросок. */
export function treeSpecies(x, z, p) {
  if (p && p.sp) return p.sp;
  const R = mulberry32(((Math.floor(x * 16) * 73856093) ^ (Math.floor(z * 16) * 19349663)) >>> 0);
  return TREE_KEYS[Math.floor(R() * TREE_KEYS.length)];
}

/* Дерево: ствол-труба со сбегом, скелет ветвей и крона из карт. Порода берётся
   из PROPS (p.sp) или из координатного семени — поток seedProps при этом не
   сдвигается, все посадки остаются на прежних местах. */
export function emitTree(x, z, M, p) {
  const R = mulberry32(((Math.floor(x * 16) * 73856093) ^ (Math.floor(z * 16) * 19349663)) >>> 0);
  const key = (p && p.sp) ? p.sp : TREE_KEYS[Math.floor(R() * TREE_KEYS.length)];
  const sp = TREE_SP[key], B = M[sp.bark];
  const h = lerp(sp.h[0], sp.h[1], R()), cr = lerp(sp.cr[0], sp.cr[1], R());
  const bend = (R() - 0.5) * sp.lean, bendZ = (R() - 0.5) * sp.lean;
  /* ствол со сбегом */
  const trunk = [], rad = [], seg = sp.trunk.seg, th = h * sp.trunk.top;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    trunk.push([x + bend * t * t, t * th, z + bendZ * t * t]);
    rad.push(lerp(sp.trunk.r0, sp.trunk.r1, t) * (0.88 + R() * 0.26));
  }
  B.tube(trunk, rad, sp.trunk.ring, sp.trunk.col, { gloss: 0.05 });
  /* корневые наплывы */
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + R(), r0 = sp.trunk.r0;
    B.tube([[x + Math.cos(a) * r0 * 1.4, 0.02, z + Math.sin(a) * r0 * 1.4],
            [x + Math.cos(a) * r0 * 0.3, r0 * 2.2, z + Math.sin(a) * r0 * 0.3]],
      [r0 * 0.44, r0 * 0.26], 5, shade(sp.trunk.col, 0.92), { gloss: 0.05 });
  }
  /* ветви */
  const tips = [];
  if (sp.branches) {
    const br = sp.branches, nb = br.n[0] + Math.floor(R() * (br.n[1] - br.n[0] + 1));
    for (let i = 0; i < nb; i++) {
      const a = i / nb * TAU + R() * 0.9;
      const t0 = trunk[Math.max(1, seg - Math.floor(R() * br.from) - 1)];
      const out = cr * lerp(br.out[0], br.out[1], R()), up = lerp(br.up[0], br.up[1], R());
      const tip = [t0[0] + Math.cos(a) * out, t0[1] + up * (1 - br.droop), t0[2] + Math.sin(a) * out];
      const mid = [(t0[0] + tip[0]) / 2, t0[1] + up * (0.55 + br.arc), (t0[2] + tip[2]) / 2];
      B.tube([t0, mid, tip], br.r, 5, shade(sp.trunk.col, 0.94), { gloss: 0.05 });
      tips.push(tip);
    }
  }
  /* крона */
  const col = t => [lerp(sp.leaf[0][0], sp.leaf[1][0], t), lerp(sp.leaf[0][1], sp.leaf[1][1], t), lerp(sp.leaf[0][2], sp.leaf[1][2], t)];
  const cell = CELL[sp.cell];
  if (sp.crown === 'column') crownColumn(M.leaves, R, x, z, th, cr, col, cell, tips);
  else if (sp.crown === 'drop') crownDrop(M.leaves, R, x, z, th, cr, tips, col, cell);
  else if (sp.crown === 'cone') crownCone(M.leaves, R, x, z, h, cr, col);
  else crownDome(M.leaves, R, x, z, th, cr, tips, col, cell);
  /* палая листва: пятна под кроной, тот же альфа-тест, что и у карт.
     Веса ветра не даём — иначе листья поедут по земле. */
  for (let i = 0, n = 4 + Math.floor(R() * 4); i < n; i++) {
    const a = R() * TAU, rr = cr * (0.2 + R() * 0.9), s = 0.24 + R() * 0.30;
    const lx = x + Math.cos(a) * rr, lz = z + Math.sin(a) * rr;
    const c = shade(sp.litter, 0.50 + R() * 0.30);
    M.leaves.quad([lx - s, 0.035, lz + s], [lx + s, 0.035, lz + s], [lx + s, 0.035, lz - s], [lx - s, 0.035, lz - s],
      0, 1, 0, UVC.broad, c, 0, 0);
  }
}

/* Пучок листвы: несколько карт крест-накрест вокруг одной точки. Одна карта
   с любого ракурса читается фанеркой, а крест держит объём — крона перестаёт
   быть жалюзи, с какой стороны на неё ни смотри. */
export function leafClump(m, R, x, y, z, r, col, cell, wind, n) {
  n = n || 2;
  const a0 = R() * TAU;
  for (let k = 0; k < n; k++) {
    const c = col(0.30 + R() * 0.70);
    leafCard(m, x + (R() - .5) * r * 0.55, y + (R() - .5) * r * 0.55, z + (R() - .5) * r * 0.55,
      a0 + k * (Math.PI / n) + (R() - .5) * 0.30,
      r * (1.55 + R() * 0.55), r * (1.35 + R() * 0.55), (R() - .5) * 0.55,
      shade(c, 0.56), c, cell, wind);
  }
}

/* колонна: узкое веретено пучков — тополь */
export function crownColumn(m, R, x, z, th, cr, col, cell, tips) {
  const tiers = 6;
  for (let t = 0; t < tiers; t++) {
    const v = t / (tiers - 1);
    const y = th * 0.40 + v * th * 0.68;
    const rr = cr * (0.36 + Math.sin((0.14 + v * 0.82) * Math.PI) * 0.72);
    const n = Math.max(2, Math.round((t === tiers - 1 ? 2 : 4) * VEG.cards));
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + t * 0.80 + R() * 0.5;
      leafClump(m, R, x + Math.cos(a) * rr * 0.60, y, z + Math.sin(a) * rr * 0.60,
        cr * (0.34 + R() * 0.16), col, cell, 0.10 + v * 0.16);
    }
  }
  /* пучки на концах ветвей: иначе листва висит отдельно от скелета */
  for (const t of tips || []) leafClump(m, R, t[0], t[1] + 0.14, t[2], cr * 0.28, col, cell, 0.22);
}
/* капля с поникшими концами — берёза (19–25 карт) */
export function crownDrop(m, R, x, z, th, cr, tips, col, cell) {
  /* Крона тянется по верхней трети ствола, а не висит шариком на макушке:
     иначе берёза читается голой палкой с комком зелени наверху. */
  const cy = th * 0.80;
  for (let i = 0, n = Math.max(5, Math.round(13 * VEG.cards)); i < n; i++) {
    const v = i / n;
    const a = R() * TAU, rr = cr * (0.08 + R() * 0.46) * (1 - v * 0.35);
    leafClump(m, R, x + Math.cos(a) * rr, cy + (v - 0.42) * th * 0.44, z + Math.sin(a) * rr,
      cr * (0.26 + R() * 0.16), col, cell, 0.14 + v * 0.12);
  }
  for (const t of tips) for (let k = 0; k < 2; k++) {   /* занавеси у концов ветвей */
    const s = cr * (0.22 + R() * 0.16);
    leafClump(m, R, t[0] + (R() - .5) * 0.7, t[1] - s * 1.3 - R() * 0.5, t[2] + (R() - .5) * 0.7,
      s, col, cell, 0.32);
  }
}
/* шатёр по сплюснутому эллипсоиду — клён (~27 карт) */
export function crownDome(m, R, x, z, th, cr, tips, col, cell) {
  const cy = th + cr * 0.22;
  const cs = [[x, cy, z]].concat(tips.map(t => [t[0] * 0.86 + x * 0.14, t[1] + 0.16, t[2] * 0.86 + z * 0.14]));
  for (const c0 of cs) {
    const n = Math.max(2, Math.round((3 + Math.floor(R() * 2)) * VEG.cards));
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, rr = cr * (0.08 + R() * 0.32);
      leafClump(m, R, c0[0] + Math.cos(a) * rr, c0[1] + (R() - 0.45) * cr * 0.42, c0[2] + Math.sin(a) * rr,
        cr * (0.28 + R() * 0.14), col, cell, 0.16);
    }
    /* горизонтальная шапка: крона не просвечивает сверху, а камера часто выше */
    const c = col(0.7), s = cr * 0.62, y = c0[1] + cr * 0.24;
    m.quad([c0[0] - s, y, c0[2] + s], [c0[0] + s, y, c0[2] + s], [c0[0] + s, y, c0[2] - s], [c0[0] - s, y, c0[2] - s],
      0, 1, 0, UVC.broad, shade(c, 0.92), 0, 0.12);
  }
}
/* конус из мутовок — ель (~36 карт, зато без ветвей-труб) */
export function crownCone(m, R, x, z, h, cr, col) {
  const whorls = 7 + Math.floor(R() * 3);
  for (let w = 0; w < whorls; w++) {
    const v = w / (whorls - 1);
    const y = 0.75 + v * (h - 1.1);
    const len = cr * (1 - v * 0.88) + 0.22;
    const n = Math.max(3, Math.round((4 + Math.floor((1 - v) * 3)) * VEG.cards));
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + w * 0.7 + R() * 0.3, c = col(0.3 + R() * 0.7);
      firFrond(m, x, y, z, a, len * (0.85 + R() * 0.3), len * 0.66, 0.16 + R() * 0.14,
        shade(c, 0.62), c, 0.05 + v * 0.10);
      /* вертикальная карта в конце лапы: горизонтальные перья с уровня глаз
         почти не видны, и без этого ель выглядит голой палкой */
      const c2 = col(0.25 + R() * 0.6);
      leafCard(m, x + Math.cos(a) * len * 0.52, y + len * 0.16, z + Math.sin(a) * len * 0.52,
        a + Math.PI / 2, len * 1.15, len * 0.95, 0.10, shade(c2, 0.55), c2, CELL.fir, 0.05 + v * 0.08);
    }
  }
  const c = col(0.8);
  leafCard(m, x, h - cr * 0.18, z, R() * TAU, cr * 0.5, cr * 0.95, 0, shade(c, 0.6), c, CELL.fir, 0.16);
}

/* Вьюн на глухой стене: карты в плоскости стены, снизу сплошь, кверху плети
   редеют и рвут контур. Нормаль берём от стены наружу — иначе зелень окажется
   освещена с изнанки. Отрезок задаём так, чтобы (-dz, dx) смотрел от дома. */
export function emitVine(M, x0, z0, x1, z1, hgt, seed) {
  const R = mulberry32(seed);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len, nx = -dz, nz = dx;
  const cols = Math.max(2, Math.round(len / 0.85)), rows = Math.max(2, Math.round(hgt / 0.8));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const v = j / rows;
    if (R() < v * v * 0.9) continue;
    const u = (i + 0.5 + (R() - .5) * 0.5) / cols;
    const px = x0 + dx * len * u + nx * 0.08, pz = z0 + dz * len * u + nz * 0.08;
    const py = 0.15 + v * hgt, s = 0.55 + R() * 0.5, hw = s * 0.75;
    const c = [.30 + R() * .16, .48 + R() * .18, .24];
    swayCard(M.leaves, [px - dx * hw, py - hw, pz - dz * hw], [px + dx * hw, py - hw, pz + dz * hw],
      [px + dx * hw, py + hw, pz + dz * hw], [px - dx * hw, py + hw, pz - dz * hw],
      [nx, 0.25, nz], UVC.veil, shade(c, 0.55), shade(c, 1 + v * 0.2), 0.02, 0.03 + v * 0.06);
  }
}

export function emitProp(p, M) {
  const x = p.x, z = p.z;
  switch (p.kind) {
    case 'tree': emitTree(x, z, M, p); break;
    case 'bush': {
      const R = mulberry32(Math.floor(x * 37 + z * 71) >>> 0);
      const s0 = 0.9 + R() * 0.5, hgt = s0 * 1.5;
      const c = [.50 + R() * .18, .74 + R() * .14, .40];
      /* шесть карт по ПОЛНОМУ кругу: раньше был полувеер (a = i*PI/4), и куст
         был пустым с одной стороны */
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + R() * 0.35, s = s0 * (0.72 + R() * 0.4);
        leafCard(M.leaves, x + Math.cos(a) * s0 * 0.20, hgt * 0.52, z + Math.sin(a) * s0 * 0.20,
          a, s * 1.9, hgt * (0.9 + R() * 0.2), (R() - .5) * 0.2, shade(c, 0.40), c, CELL.veil, 0.09);
      }
      /* шапка сверху */
      M.leaves.quad([x - s0, hgt * 0.92, z + s0], [x + s0, hgt * 0.92, z + s0],
        [x + s0, hgt * 0.92, z - s0], [x - s0, hgt * 0.92, z - s0],
        0, 1, 0, UVC.veil, shade(c, 1.06), 0, 0.09);
      /* юбка травы у земли — куст перестаёт висеть над газоном */
      for (let i = 0; i < 3; i++)
        groundCard(M.leaves, x + (R() - .5) * s0 * 1.4, 0.014, z + (R() - .5) * s0 * 1.4,
          R() * Math.PI, 0.55, 0.34 + R() * 0.2, shade(c, 0.34), shade(c, 0.85), CELL.tuft, 0.05);
      break;
    }
    case 'hedge': {
      /* живая изгородь: стенка карт вдоль отрезка len по направлению a */
      const R = mulberry32(Math.floor(x * 53 + z * 29) >>> 0);
      const len = p.len || 6, ang = p.a || 0, hh = p.h || 0.95;
      const dx = Math.cos(ang), dz = Math.sin(ang), n = Math.max(2, Math.round(len / 0.5));
      for (let i = 0; i <= n; i++) {
        const t = i / n - 0.5, cx = x + dx * len * t, cz = z + dz * len * t;
        const c = [.40 + R() * .12, .60 + R() * .14, .32], hgt = hh * (0.92 + R() * 0.16);
        leafCard(M.leaves, cx, hgt * 0.52, cz, ang, 0.85, hgt, 0, shade(c, 0.38), c, CELL.veil, 0.05);
        if (i % 2) continue;
        leafCard(M.leaves, cx, hgt * 0.50, cz, ang + Math.PI / 2, 0.72, hgt * 0.92, 0, shade(c, 0.38), c, CELL.veil, 0.05);
        M.leaves.quad([cx - 0.36, hgt, cz + 0.36], [cx + 0.36, hgt, cz + 0.36],
          [cx + 0.36, hgt, cz - 0.36], [cx - 0.36, hgt, cz - 0.36],
          0, 1, 0, UVC.veil, shade(c, 1.08), 0, 0.05);   /* стриженый верх */
      }
      break;
    }
    case 'flowerbed': {
      /* клумба у подъезда: бортик из вкопанных покрышек, земля и цветы */
      const R = mulberry32(Math.floor(x * 61 + z * 43) >>> 0);
      const w = p.w || 2.6, d = p.d || 1.5;
      M.ground.plate(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.05, [.86, .74, .60], 2);
      const per = (w + d) * 2, nT = Math.max(6, Math.round(per / 0.62));
      for (let i = 0; i < nT; i++) {
        const u = i / nT * per;
        let px, pz;
        if (u < w) { px = x - w / 2 + u; pz = z - d / 2; }
        else if (u < w + d) { px = x + w / 2; pz = z - d / 2 + (u - w); }
        else if (u < w * 2 + d) { px = x + w / 2 - (u - w - d); pz = z + d / 2; }
        else { px = x - w / 2; pz = z + d / 2 - (u - w * 2 - d); }
        /* покрышка вкопана наполовину: 8 сегментов без крышек — 16 треугольников */
        M.metal.cyl(px, -0.10, pz, 0.30, 0.26, 8, i % 2 ? [.92, .90, .84] : [.20, .19, .21],
          { cap: false, gloss: 0.12 });
      }
      const pal = [[1.50, .62, .50], [1.32, 1.12, .48], [1.00, .66, 1.34], [1.44, .96, .52]];
      const fc = pal[Math.floor(R() * pal.length)];
      for (let i = 0; i < 16; i++) {
        const px = x + (R() - .5) * (w - 0.6), pz = z + (R() - .5) * (d - 0.6);
        const hgt = 0.30 + R() * 0.24;
        /* низ зелёный, верх — цвет соцветия: одна ячейка tuft работает и травой, и цветком */
        groundCard(M.leaves, px, 0.055, pz, R() * Math.PI, 0.42, hgt,
          [.30, .44, .24], shade(fc, 0.85 + R() * 0.3), CELL.tuft, 0.05);
      }
      break;
    }
    case 'bench': {
      /* чугунные боковины и деревянные рейки */
      for (const sx of [-0.86, 0.86]) {
        M.metal.tube([[x + sx, 0.02, z - 0.26], [x + sx, 0.44, z - 0.24], [x + sx, 0.46, z + 0.24], [x + sx, 0.02, z + 0.26]],
          0.035, 6, [.34, .36, .42], { gloss: 0.4 });
        M.metal.tube([[x + sx, 0.44, z - 0.25], [x + sx, 0.96, z - 0.36]], 0.032, 6, [.34, .36, .42], { gloss: 0.4 });
      }
      for (let i = 0; i < 4; i++)
        M.bark.bevelBox(x, 0.44, z - 0.24 + i * 0.16, 1.92, 0.045, 0.12, [.86, .62, .40],
          { bev: 0.012, r: 0.02, cs: 1, uv: 1, gloss: 0.14 });
      for (let i = 0; i < 3; i++)
        M.bark.bevelBox(x, 0.56 + i * 0.15, z - 0.30 - i * 0.028, 1.92, 0.12, 0.045, [.83, .58, .38],
          { bev: 0.012, r: 0.02, cs: 1, uv: 1, gloss: 0.14 });
      break;
    }
    case 'bin':
      M.metal.cyl(x, 0.06, z, 0.44, 0.94, 12, [.32, .52, .42], { rTop: 0.50, gloss: 0.3 });
      M.metal.cyl(x, 1.00, z, 0.54, 0.09, 12, [.24, .38, .32], { gloss: 0.35 });
      M.metal.cyl(x, 0, z, 0.30, 0.07, 8, [.28, .30, .34], { gloss: 0.3 });
      M.metal.tube([[x - 0.5, 0.62, z], [x - 0.56, 0.80, z], [x - 0.5, 0.96, z]], 0.028, 5, [.3, .32, .36], { gloss: 0.4 });
      break;
    case 'sandbox':
      for (const [ox, oz, w, d] of [[0, -1.6, 4.2, 0.24], [0, 1.6, 4.2, 0.24], [-2.1, 0, 0.24, 3.2], [2.1, 0, 0.24, 3.2]])
        M.bark.bevelBox(x + ox, 0, z + oz, w, 0.34, d, [.86, .62, .40], { bev: 0.03, r: 0.04, cs: 1, uv: 1.2, gloss: 0.1 });
      M.ground.plate(x - 2.0, z - 1.5, x + 2.0, z + 1.5, 0.22, [1.35, 1.2, .85], 3);
      break;
    case 'swing': {
      const C = [.82, .40, .30];
      for (const sx of [-1.6, 1.6]) {
        M.metal.tube([[x + sx - 0.55, 0.02, z - 0.5], [x + sx, 2.42, z], [x + sx - 0.55, 0.02, z + 0.5]], 0.055, 6, C, { gloss: 0.4 });
      }
      M.metal.tube([[x - 1.72, 2.42, z], [x + 1.72, 2.42, z]], 0.062, 6, C, { gloss: 0.4 });
      for (const sx of [-0.72, 0.72]) {
        M.metal.tube([[x + sx - 0.26, 2.38, z], [x + sx - 0.26, 1.06, z]], 0.018, 5, [.5, .5, .56], { gloss: 0.5 });
        M.metal.tube([[x + sx + 0.26, 2.38, z], [x + sx + 0.26, 1.06, z]], 0.018, 5, [.5, .5, .56], { gloss: 0.5 });
      }
      M.bark.bevelBox(x, 0.98, z, 1.5, 0.08, 0.36, [.86, .34, .32], { bev: 0.015, r: 0.03, cs: 1, uv: .6, gloss: 0.2 });
      break;
    }
    case 'carousel':
      M.metal.cyl(x, 0, z, 1.5, 0.30, 14, [.38, .40, .48], { gloss: 0.35 });
      M.metal.cyl(x, 0.30, z, 1.42, 0.08, 14, [.55, .58, .64], { gloss: 0.55 });
      M.metal.cyl(x, 0.30, z, 0.10, 1.0, 8, [.7, .7, .75], { gloss: 0.6 });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        M.metal.tube([[x + Math.cos(a) * 0.10, 1.26, z + Math.sin(a) * 0.10],
                      [x + Math.cos(a) * 1.32, 1.10, z + Math.sin(a) * 1.32],
                      [x + Math.cos(a) * 1.36, 0.42, z + Math.sin(a) * 1.36]], 0.036, 6, [.92, .72, .34], { gloss: 0.45 });
      }
      break;
    case 'pipe': {
      /* теплотрасса в изоляции на опорах */
      const c = [.66, .68, .74];
      M.metal.tube([[x - 6, 0.78, z], [x + 6, 0.78, z]], 0.42, 10, c, { gloss: 0.3 });
      M.metal.tube([[x - 6, 1.34, z], [x + 6, 1.34, z]], 0.34, 10, c, { gloss: 0.3 });
      for (const ox of [-4.2, 0, 4.2]) {
        M.metal.box(x + ox, 0, z, 0.28, 0.78, 0.9, [.55, .56, .60], { uv: .8 });
        M.metal.box(x + ox, 1.12, z, 0.30, 0.10, 0.9, [.5, .52, .56], { uv: .8 });
      }
      break;
    }
    case 'barrel':
      M.metal.cyl(x, 0.02, z, 0.42, 1.06, 12, [.82, .40, .26], { gloss: 0.35, rTop: 0.42 });
      for (const y of [0.28, 0.74]) M.metal.cyl(x, y, z, 0.445, 0.06, 12, [.66, .32, .22], { gloss: 0.4, cap: false });
      M.metal.cyl(x, 1.06, z, 0.44, 0.05, 12, [.7, .35, .24], { gloss: 0.45 });
      break;
    case 'pallet': {
      const w = [.86, .70, .48];
      for (let i = 0; i < 3; i++) M.bark.box(x, 0.10, z - 0.5 + i * 0.5, 1.6, 0.09, 0.16, w, { uv: .8 });
      for (let i = 0; i < 3; i++) M.bark.box(x - 0.6 + i * 0.6, 0, z, 0.16, 0.10, 1.2, [.78, .62, .42], { uv: .8 });
      for (let i = 0; i < 5; i++) M.bark.box(x, 0.19, z - 0.55 + i * 0.28, 1.6, 0.05, 0.18, w, { uv: .8 });
      break;
    }
    case 'coil':
      M.metal.cyl(x, 0, z, 0.98, 0.66, 16, [.22, .23, .27], { rTop: 0.98, gloss: 0.25 });
      M.metal.cyl(x, 0.66, z, 0.62, 0.04, 14, [.16, .17, .20], { gloss: 0.2 });
      M.metal.cyl(x, 0.70, z, 0.30, 0.05, 10, [.2, .9, .85], { gloss: 0.5 });
      break;
    case 'block':
      M.sidewalk.bevelBox(x, 0, z, 2.8, 1.2, 1.8, [.72, .72, .78], { bev: 0.06, r: 0.08, cs: 2, uv: 1.6 });
      break;
    case 'cone':
      M.metal.cyl(x, 0.05, z, 0.28, 0.72, 10, [.95, .42, .15], { rTop: 0.05, gloss: 0.3 });
      M.metal.cyl(x, 0.34, z, 0.20, 0.14, 10, [.95, .95, .97], { cap: false, gloss: 0.4 });
      M.metal.bevelBox(x, 0, z, 0.66, 0.06, 0.66, [.90, .38, .13], { bev: 0.015, r: 0.05, cs: 2, uv: .4, gloss: 0.3 });
      break;
    /* Памятник на привокзальной площади: гранитный стилобат, высокий
       постамент, тёмная фигура и кованая ограда по периметру. */
    case 'monument': {
      const GR = [.42, .40, .43], PED = [.34, .33, .36], BR = [.20, .17, .14];
      M.sidewalk.box(x, 0.02, z, 3.6, 0.22, 3.6, [.66, .64, .68], { uv: 1.4, skipTop: false });
      M.sidewalk.box(x, 0.24, z, 2.5, 0.20, 2.5, [.60, .58, .62], { uv: 1.2 });
      M.brick.bevelBox(x, 0.44, z, 1.30, 0.34, 1.30, GR, { bev: 0.04, r: 0.05, cs: 2, uv: 1, gloss: 0.3 });
      M.brick.bevelBox(x, 0.78, z, 1.00, 2.30, 1.00, PED, { bev: 0.05, r: 0.06, cs: 2, uv: 1.2, gloss: 0.28, taper: [0.92, 0.92] });
      M.brick.bevelBox(x, 3.08, z, 1.24, 0.22, 1.24, GR, { bev: 0.04, r: 0.05, cs: 2, uv: 1, gloss: 0.3 });
      /* фигура: пальто, плечи, голова — обобщённо, как и все люди в районе */
      M.metal.bevelBox(x, 3.30, z, 0.62, 1.10, 0.46, BR, { bev: 0.07, r: 0.10, cs: 2, uv: 1, gloss: 0.35, taper: [0.86, 0.86] });
      M.metal.ellipsoid(x, 4.52, z, 0.30, 0.20, 0.26, 9, 5, BR, { gloss: 0.35 });
      M.metal.ellipsoid(x, 4.80, z + 0.02, 0.16, 0.19, 0.17, 9, 6, BR, { gloss: 0.4 });
      M.metal.box(x, 3.34, z + 0.20, 0.44, 0.72, 0.10, [.17, .14, .12], { uv: .6, gloss: 0.3 });
      /* ограда: столбики по углам и пики между ними */
      const R2 = 1.75;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, px = x + Math.cos(a) * R2 * 1.41, pz = z + Math.sin(a) * R2 * 1.41;
        M.metal.cyl(px, 0.24, pz, 0.055, 0.95, 6, [.16, .16, .18], { gloss: 0.4 });
      }
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bx = x + ax * R2, bz = z + az * R2;
        for (const y of [0.42, 0.86])
          M.metal.tube([[bx - az * R2, y, bz - ax * R2], [bx + az * R2, y, bz + ax * R2]], 0.018, 5, [.16, .16, .18], { gloss: 0.4 });
        for (let k = -3; k <= 3; k++)
          M.metal.cyl(bx - az * (k * 0.44), 0.26, bz - ax * (k * 0.44), 0.016, 0.78, 4, [.16, .16, .18], { gloss: 0.4 });
      }
      break;
    }
    case 'board': {
      for (const sx of [-0.7, 0.7]) M.metal.tube([[x + sx, 0, z], [x + sx, 2.0, z]], 0.05, 6, [.48, .5, .56], { gloss: 0.4 });
      M.sidewalk.bevelBox(x, 1.28, z, 1.86, 1.24, 0.12, [.90, .88, .90], { bev: 0.02, r: 0.03, cs: 1, uv: 1 });
      M.metal.box(x, 2.50, z, 1.9, 0.08, 0.22, [.6, .62, .68], { uv: .8 });
      break;
    }
    case 'carcass':
      M.metal.bevelBox(x, 0.32, z, 4.0, 1.0, 1.8, [.48, .38, .38], { bev: 0.06, r: 0.10, cs: 2, uv: 2, gloss: 0.2 });
      M.metal.bevelBox(x - 0.3, 1.32, z, 2.1, 0.74, 1.62, [.40, .32, .33], { bev: 0.06, r: 0.10, cs: 2, uv: 1.6, gloss: 0.2 });
      for (const [ox, oz] of [[-1.4, -0.85], [-1.4, 0.85], [1.4, 0.85]])
        M.metal.cyl(x + ox, 0, z + oz, 0.32, 0.28, 10, [.18, .18, .20], { gloss: 0.2 });
      M.metal.box(x + 1.4, 0, z - 0.85, 0.5, 0.30, 0.4, [.35, .3, .3], { uv: .6 });
      break;
    case 'fence': {
      const len = p.len || 12;
      const C = [.55, .58, .64];
      for (let i = 0; i <= len; i += 2.2) M.metal.tube([[x + i, 0, z], [x + i, 1.62, z]], 0.055, 6, C, { gloss: 0.45 });
      for (const y of [1.22, 0.52]) M.metal.tube([[x, y, z], [x + len, y, z]], 0.035, 6, C, { gloss: 0.45 });
      for (let i = 0; i < len; i += 0.42) M.metal.tube([[x + i, 0.42, z], [x + i, 1.34, z]], 0.014, 4, [.5, .52, .58], { gloss: 0.4 });
      break;
    }
  }
}

/* Обстановка дороги. Пиктограммы обобщённые, без брендов и реальных
   организаций; текстовые щиты придуманы для этой игры. Ни один знак не
   стоит ровно — это тоже часть района. */
export const SIGN_CELL = {
  bump:    { c: 0, r: 0 }, limit20: { c: 1, r: 0 }, ped:  { c: 2, r: 0 }, yield: { c: 3, r: 0 },
  stop:    { c: 0, r: 1 }, noentry: { c: 1, r: 1 }, work: { c: 2, r: 1 }, hole:  { c: 3, r: 1 }
};
export const ROADSIDE = [];

export function emitRoadside(g, M) {
  const yaw = g.yawTo === undefined ? (g.yaw || 0) : g.yawTo + (g.yaw || 0);
  const tilt = g.tilt || 0;
  const base = LY.walk;
  switch (g.kind) {
    case 'sign': {
      const H = 2.25, sn = SIGN_CELL[g.sn] || SIGN_CELL.hole, q = 0.25, m = 6 / 512;
      const u0 = sn.c * q + m, u1 = (sn.c + 1) * q - m, v0 = sn.r * 0.5 + m, v1 = (sn.r + 1) * 0.5 - m;
      M.metal.cyl(g.x, base - 0.1, g.z, 0.045, H, 6, [.62, .64, .70], { gloss: 0.4 });
      const w = 0.74, hh = 0.74, y0 = base + H - hh;
      const dx = Math.cos(yaw) * w / 2, dz = Math.sin(yaw) * w / 2, dy = tilt * w;
      const p0 = [g.x - dx, y0 - dy, g.z - dz], p1 = [g.x + dx, y0 + dy, g.z + dz];
      const p2 = [g.x + dx, y0 + hh + dy, g.z + dz], p3 = [g.x - dx, y0 + hh - dy, g.z - dz];
      const nx = Math.sin(yaw + Math.PI / 2), nz = Math.cos(yaw + Math.PI / 2);
      M.roadsign.quad(p0, p1, p2, p3, nx, 0, nz, [u0, v1, u1, v1, u1, v0, u0, v0], [1, 1, 1], 0, 0);
      M.metal.quad(p1, p0, p3, p2, -nx, 0, -nz, [0, 1, 1, 1, 1, 0, 0, 0], [.60, .60, .64], 0, 0);
      break;
    }
    case 'signal': {
      const H = 3.4;
      M.metal.cyl(g.x, base - 0.1, g.z, 0.09, H, 8, [.36, .40, .36], { gloss: 0.35 });
      M.metal.bevelBox(g.x, base + H - 1.35, g.z, 0.34, 1.0, 0.30, [.22, .24, .22],
        { bev: 0.03, r: 0.05, cs: 2, uv: .6, gloss: 0.3 });
      const on = g.mode === 'work' ? 2 : 1;
      const cols = [[.95, .20, .18], [1, .78, .16], [.24, .86, .40]];
      for (let i = 0; i < 3; i++) {
        const lit = (g.mode === 'blink') ? i === 1 : i === on;
        const y = base + H - 1.22 + i * 0.30;
        M.metal.cyl(g.x + Math.sin(yaw) * 0.17, y, g.z + Math.cos(yaw) * 0.17, 0.11, 0.02, 10,
          lit ? cols[i] : [.14, .14, .16], { gloss: 0.5, emis: lit ? 1 : 0 });
        if (lit) Static.lamps.push({ x: g.x, y, z: g.z, small: true });
      }
      break;
    }
    case 'stub':
      M.metal.cyl(g.x, base - 0.1, g.z, 0.085, 1.5, 8, [.40, .42, .40], { gloss: 0.3 });
      M.metal.cyl(g.x, base + 1.4, g.z, 0.095, 0.03, 8, [.30, .24, .22], { gloss: 0.2 });
      break;
    case 'post':                                        /* сигнальный столбик */
      M.metal.cyl(g.x, 0.02, g.z, 0.055, 0.75, 5, [.92, .92, .94], { gloss: 0.3 });
      M.metal.cyl(g.x, 0.58, g.z, 0.058, 0.10, 5, [.90, .22, .20], { cap: false, gloss: 0.5, emis: 0.25 });
      break;
    case 'rail': {                                      /* отбойник: полосы и стойки */
      const L = g.len, C = [.66, .68, .72];
      for (let i = 0; i <= L; i += 2.5) M.metal.box(g.x, 0.02, g.z + i, 0.10, 0.68, 0.10, C, { uv: .5, gloss: 0.4 });
      for (const [y, hh] of [[0.44, 0.10], [0.56, 0.14], [0.70, 0.10]])
        M.metal.box(g.x - 0.04, y, g.z + L / 2, 0.06, hh, L, C, { uv: 2, gloss: 0.45 });
      break;
    }
    case 'busstop': {
      const ax = g.along === 'x', sg = g.side;
      const cx = ax ? g.x : g.x + sg * (ROAD_W / 2 + SIDE_W + 1.1);
      const cz = ax ? g.z + sg * (ROAD_W / 2 + SIDE_W + 1.1) : g.z;
      /* расширенная плита под павильоном */
      if (ax) M.sidewalk.plate(g.x - 6, g.z + sg * (ROAD_W / 2 + SIDE_W), g.x + 6, g.z + sg * (ROAD_W / 2 + SIDE_W + 2.4), LY.walk + 0.002, [1, 1, 1], 4);
      else M.sidewalk.plate(g.x + sg * (ROAD_W / 2 + SIDE_W), g.z - 6, g.x + sg * (ROAD_W / 2 + SIDE_W + 2.4), g.z + 6, LY.walk + 0.002, [1, 1, 1], 4);
      for (const oa of [-2.1, 2.1]) for (const ob of [-0.7, 0.7])
        M.metal.cyl(cx + (ax ? oa : ob), LY.walk, cz + (ax ? ob : oa), 0.05, 2.35, 6, [.52, .56, .60], { gloss: 0.45 });
      M.roof.bevelBox(cx, LY.walk + 2.35, cz, ax ? 4.9 : 2.0, 0.14, ax ? 2.0 : 4.9, [.72, .70, .76],
        { bev: 0.03, r: 0.06, cs: 2, uv: 1.4 });
      M.shopGlass.box(cx + (ax ? 0 : -sg * 0.75), LY.walk + 0.4, cz + (ax ? -sg * 0.75 : 0),
        ax ? 4.3 : 0.05, 1.9, ax ? 0.05 : 4.3, [1, 1, 1], { uv: 1.6, gloss: 0.6 });
      M.bark.bevelBox(cx, LY.walk + 0.44, cz, ax ? 3.4 : 0.42, 0.07, ax ? 0.42 : 3.4, [.82, .60, .40],
        { bev: 0.012, r: 0.02, cs: 1, uv: 1 });
      /* жёлтый зигзаг «остановка запрещена» */
      for (let i = 0; i < 14; i++) {
        const t = sg * (ROAD_W / 2 - 0.9 + (i % 2 ? 0.5 : -0.5));
        const s0 = (ax ? g.x : g.z) - 9.8 + i * 1.4;
        if (ax) M.white.plate(s0, g.z + t - 0.07, s0 + 1.3, g.z + t + 0.07, LY.mark, [1, .80, .24], 1);
        else M.white.plate(g.x + t - 0.07, s0, g.x + t + 0.07, s0 + 1.3, LY.mark, [1, .80, .24], 1);
      }
      break;
    }
  }
}

export function emitPole(p, M) {
  const h = p.lamp ? 7.4 : 6.2;
  const C = [.60, .62, .68];
  /* ствол со сбегом, фундаментный блок и фланец */
  M.metal.cyl(p.x, 0.18, p.z, 0.17, h, 10, C, { rTop: 0.105, gloss: 0.35 });
  M.sidewalk.bevelBox(p.x, 0, p.z, 0.72, 0.26, 0.72, [.70, .70, .75], { bev: 0.04, r: 0.05, cs: 2, uv: .6 });
  M.metal.cyl(p.x, 0.24, p.z, 0.24, 0.05, 10, [.5, .52, .58], { gloss: 0.4 });
  /* лючок и хомут кабеля */
  M.metal.box(p.x, 0.8, p.z + 0.16, 0.16, 0.36, 0.06, [.5, .52, .58], { uv: .4, gloss: 0.4 });
  M.metal.cyl(p.x, 3.4, p.z, 0.135, 0.07, 10, [.52, .54, .60], { gloss: 0.4 });
  if (p.lamp) {
    /* изогнутый кронштейн и светильник-«кобра» */
    M.metal.tube([[p.x, h - 0.05, p.z], [p.x + 0.55, h + 0.28, p.z], [p.x + 1.30, h + 0.30, p.z]], 0.065, 7, C, { gloss: 0.4 });
    M.metal.bevelBox(p.x + 1.52, h + 0.06, p.z, 0.86, 0.26, 0.40, [.48, .50, .56],
      { bev: 0.05, r: 0.08, cs: 2, uv: .6, gloss: 0.45, taper: [0.72, 0.8] });
    M.white.bevelBox(p.x + 1.52, h + 0.01, p.z, 0.72, 0.06, 0.34, [1, .92, .72],
      { bev: 0.015, r: 0.06, cs: 2, uv: 1, emis: 1, gloss: 0.8, skipTop: true, bottom: true });
    Static.lamps.push({ x: p.x + 1.52, y: h - 0.05, z: p.z });
  } else {
    M.metal.tube([[p.x, h - 0.55, p.z], [p.x + 0.46, h - 0.55, p.z]], 0.045, 6, [.55, .58, .64], { gloss: 0.4 });
    M.metal.box(p.x + 0.52, h - 0.72, p.z, 0.12, 0.34, 0.30, [.52, .54, .60], { uv: .5, gloss: 0.4 });
  }
}

export function emitKiosk(k, M) {
  const cx = k.x + k.w / 2, cz = k.z + k.d / 2, h = 2.9;
  /* корпус со скошенными углами и цоколем */
  M.stucco.bevelBox(cx, 0.12, cz, k.w, h - 0.12, k.d, [.80, .78, .85],
    { bev: 0.05, r: 0.10, cs: 2, uv: 2.5, skipTop: true });
  M.sidewalk.bevelBox(cx, 0, cz, k.w + 0.14, 0.16, k.d + 0.14, [.66, .66, .70], { bev: 0.03, r: 0.06, cs: 2, uv: 1 });
  /* карниз и вынос кровли */
  M.roof.bevelBox(cx, h - 0.06, cz, k.w + 0.42, 0.26, k.d + 0.42, [.74, .71, .79],
    { bev: 0.05, r: 0.10, cs: 2, uv: 1.6 });
  M.metal.box(cx, h + 0.20, cz, k.w + 0.10, 0.16, k.d + 0.10, [.55, .52, .60], { uv: 1.2, gloss: 0.3 });
  /* витрина с рамой и полкой-прилавком */
  const zf = k.z + k.d + 0.03;
  M.shopGlass.quad([k.x + 0.35, 0.95, zf], [k.x + k.w - 0.35, 0.95, zf],
    [k.x + k.w - 0.35, 2.20, zf], [k.x + 0.35, 2.20, zf],
    0, 0, 1, [0, 1, 1.2, 1, 1.2, 0, 0, 0], [1, 1, 1], 0, 0);
  for (const [y, hh] of [[0.88, 0.10], [2.18, 0.10]])
    M.metal.box(cx, y, zf + 0.02, k.w - 0.5, hh, 0.10, [.46, .48, .54], { uv: .8, gloss: 0.4 });
  for (const sx of [-1, 1])
    M.metal.box(cx + sx * (k.w / 2 - 0.36), 0.95, zf + 0.02, 0.09, 1.28, 0.10, [.46, .48, .54], { uv: .8, gloss: 0.4 });
  M.metal.bevelBox(cx, 0.80, zf + 0.16, k.w - 0.6, 0.09, 0.34, [.62, .60, .66],
    { bev: 0.02, r: 0.03, cs: 1, uv: .8, gloss: 0.35 });
  /* окошко выдачи */
  M.metal.box(cx + k.w * 0.28, 1.06, zf + 0.03, 0.44, 0.34, 0.05, [.30, .32, .38], { uv: .5, gloss: 0.5 });
  /* решётка на боковом окне и ящик кондиционера */
  M.metal.box(k.x - 0.04, 1.6, cz, 0.06, 0.7, 0.9, [.40, .42, .48], { uv: .6, gloss: 0.4 });
}

export function buildWorld(gl) {
  VEG.grass = Q.veg.grass; VEG.cards = Q.veg.cards;
  const keys = ['panel','stucco','brick','indust','garage','roof','metal','shopGlass','ground','grass','road','sidewalk','asphalt','bark','birch','leaves','roadsign','white'];
  const M = {};
  for (const k of keys) M[k] = new Mesh();

  /* --- земля --- */
  M.ground.plate(0, 0, W.x, W.z, 0, [1,1,1], 10);
  /* --- газоны во дворах ------------------------------------------------
     Плиты кладём аккуратно: отсев по ВСЕМ четырём углам (раньше проверялся
     только центр), без заезда под дом и без наложения друг на друга —
     иначе плиты на одной высоте дерутся за глубину. */
  const yards = [[28,22,92,70],[104,22,172,70],[28,78,96,128],[104,78,172,128]];
  const R = mulberry32(5150);
  const LAWNS = [];
  const roadBand = (a0, b0, a1, b1) => {
    const m = ROAD_W / 2 + SIDE_W + 0.8;
    return ROADS_Z.some(r => b0 < r + m && b1 > r - m) || ROADS_X.some(r => a0 < r + m && a1 > r - m);
  };
  const onBuilding = (a0, b0, a1, b1) =>
    BUILDINGS.some(b => a0 < b.x + b.w + 1 && a1 > b.x - 1 && b0 < b.z + b.d + 1 && b1 > b.z - 1);
  /* Кладём газоны по сетке, а не случайными прямоугольниками: во дворах
     свободных карманов между дорогами и домами мало, и случайный бросок
     почти всегда попадал в занятое. Сетка заодно исключает наложение плит,
     из-за которого они дерутся за глубину. */
  const CELL_M = 6.2, GAP = 0.5;
  for (const [x0, z0, x1, z1] of yards) {
    const nx = Math.floor((x1 - x0) / CELL_M), nz = Math.floor((z1 - z0) / CELL_M);
    const ox = x0 + ((x1 - x0) - nx * CELL_M) / 2, oz = z0 + ((z1 - z0) - nz * CELL_M) / 2;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a0 = ox + i * CELL_M + GAP, b0 = oz + j * CELL_M + GAP;
      const a1 = a0 + CELL_M - GAP * 2, b1 = b0 + CELL_M - GAP * 2;
      if (roadBand(a0, b0, a1, b1) || onBuilding(a0, b0, a1, b1)) continue;
      if (R() < 0.14) continue;                 /* кое-где газон просто вытоптан */
      LAWNS.push([a0, b0, a1, b1]);
      M.ground.plate(a0 - 0.3, b0 - 0.3, a1 + 0.3, b1 + 0.3, 0.008, [.94, .90, .84], 4);  /* вытоптанная кромка */
      M.grass.plate(a0, b0, a1, b1, 0.012, [1, 1, 1], 6);
    }
  }
  /* пучки травы: густо по кромке (там глаз ловит силуэт и переход к асфальту),
     реже внутри. Счётчик — единственный предохранитель: кончился, трава просто
     перестаёт ставиться, мир не ломается. */
  {
    const RG = mulberry32(8821);
    let left = Math.round(2600 * VEG.grass);
    const tuft = (px, pz, k) => {
      const c = [.34 + RG() * .18, .52 + RG() * .20, .22 + RG() * .12];
      const s = (0.22 + RG() * 0.16) * k, hgt = (0.17 + RG() * 0.15) * k, a = RG() * Math.PI;
      const lo = shade(c, 0.34), hi = shade(c, 1.15);
      groundCard(M.leaves, px, 0.014, pz, a, s, hgt, lo, hi, CELL.tuft, 0.05);
      groundCard(M.leaves, px, 0.014, pz, a + Math.PI / 2, s * 0.8, hgt * 0.85, lo, hi, CELL.tuft, 0.05);
    };
    for (const [a0, b0, a1, b1] of LAWNS) {
      const w = a1 - a0, d = b1 - b0, per = (w + d) * 2;
      for (let u = 0; u < per && left > 0; u += 0.72 + RG() * 0.4) {
        let px, pz;
        if (u < w) { px = a0 + u; pz = b0 + 0.10 + RG() * 0.45; }
        else if (u < w + d) { px = a1 - 0.10 - RG() * 0.45; pz = b0 + (u - w); }
        else if (u < w * 2 + d) { px = a1 - (u - w - d); pz = b1 - 0.10 - RG() * 0.45; }
        else { px = a0 + 0.10 + RG() * 0.45; pz = b1 - (u - w * 2 - d); }
        tuft(px, pz, 1.05); left--;
      }
      const nIn = Math.round(w * d * 0.55 * VEG.grass);
      for (let i = 0; i < nIn && left > 0; i++) { tuft(a0 + 0.4 + RG() * (w - 0.8), b0 + 0.4 + RG() * (d - 0.8), 0.9); left--; }
    }
  }
  /* сорняки в шве бордюра и по кромке ям — асфальт всегда зарастает с краёв */
  {
    const RW = mulberry32(4407);
    const weed = (px, pz, y) => {
      const c = [.42 + RW() * .22, .54 + RW() * .18, .20];
      groundCard(M.leaves, px, y, pz, RW() * Math.PI, 0.30 + RW() * 0.22, 0.20 + RW() * 0.24,
        shade(c, 0.4), c, CELL.tuft, 0.035);
    };
    for (const z of ROADS_Z) for (const s of [-1, 1])
      for (let px = 3; px < W.x - 3; px += 1.9 + RW() * 1.2) {
        if (RW() > 0.44 || ROADS_X.some(r => Math.abs(px - r) < ROAD_W / 2 + 3)) continue;
        weed(px, z + s * (ROAD_W / 2 - 0.10 - RW() * 0.2), 0.03);
      }
    for (const x of ROADS_X) for (const s of [-1, 1])
      for (let pz = 3; pz < W.z - 3; pz += 1.9 + RW() * 1.2) {
        if (RW() > 0.44 || ROADS_Z.some(r => Math.abs(pz - r) < ROAD_W / 2 + 3)) continue;
        weed(x + s * (ROAD_W / 2 - 0.10 - RW() * 0.2), pz, 0.03);
      }
    for (const p of POTHOLES) for (let i = 0, n = 1 + Math.floor(RW() * 2); i < n; i++) {
      const a = RW() * TAU;
      weed(p.x + Math.cos(a) * p.r * 1.05, p.z + Math.sin(a) * p.r * 1.05, 0.05);
    }
  }

  /* --- дороги --- */
  for (const z of ROADS_Z) roadPlate(M.road, 0, z - ROAD_W/2, W.x, z + ROAD_W/2, 0.02, 'x');
  for (const x of ROADS_X) roadPlate(M.road, x - ROAD_W/2, 0, x + ROAD_W/2, W.z, 0.02, 'z');
  /* перекрёстки — гладкий асфальт поверх разметки */
  for (const z of ROADS_Z) for (const x of ROADS_X)
    M.asphalt.plate(x - ROAD_W/2 - 0.02, z - ROAD_W/2 - 0.02, x + ROAD_W/2 + 0.02, z + ROAD_W/2 + 0.02, 0.03, [1,1,1], 6);
  /* зебры */
  for (const z of ROADS_Z) for (const x of ROADS_X) {
    for (let i = 0; i < 6; i++) {
      const o = -ROAD_W/2 + 0.9 + i * 1.6;
      M.white.plate(x - ROAD_W/2 - 2.2, z + o, x - ROAD_W/2 - 0.4, z + o + 0.8, 0.04, [.92,.92,.95], 1);
      M.white.plate(x + ROAD_W/2 + 0.4, z + o, x + ROAD_W/2 + 2.2, z + o + 0.8, 0.04, [.92,.92,.95], 1);
      M.white.plate(x + o, z - ROAD_W/2 - 2.2, x + o + 0.8, z - ROAD_W/2 - 0.4, 0.04, [.92,.92,.95], 1);
      M.white.plate(x + o, z + ROAD_W/2 + 0.4, x + o + 0.8, z + ROAD_W/2 + 2.2, 0.04, [.92,.92,.95], 1);
    }
  }
  /* --- тротуары и бордюры --- */
  const curb = (x0, z0, x1, z1) => {
    M.sidewalk.plate(x0, z0, x1, z1, 0.16, [1,1,1], 4);
    M.sidewalk.box((x0+x1)/2, 0, (z0+z1)/2, x1-x0, 0.16, z1-z0, [.85,.85,.88], { uv: 2, skipTop: true });
  };
  for (const z of ROADS_Z) {
    curb(0, z - ROAD_W/2 - SIDE_W, W.x, z - ROAD_W/2);
    curb(0, z + ROAD_W/2, W.x, z + ROAD_W/2 + SIDE_W);
  }
  for (const x of ROADS_X) {
    curb(x - ROAD_W/2 - SIDE_W, 0, x - ROAD_W/2, W.z);
    curb(x + ROAD_W/2, 0, x + ROAD_W/2 + SIDE_W, W.z);
  }
  /* --- бордюрный камень, чугун, разметка и лужи ------------------------ */
  for (const z of ROADS_Z) for (const side of [-1, 1]) curbRun(M, 'x', z, side, 0, W.x);
  for (const x of ROADS_X) for (const side of [-1, 1]) curbRun(M, 'z', x, side, 0, W.z);
  {
    const RR = mulberry32(77001);
    /* стоп-линии и стрелки на подходах к перекрёсткам */
    for (const z of ROADS_Z) for (const x of ROADS_X) {
      for (const s of [-1, 1]) {
        const sx = x + s * (ROAD_W / 2 + 3.2);
        M.white.plate(sx - 0.16, z - ROAD_W / 2 + 0.4, sx + 0.16, z - 0.35, LY.mark, [.9, .9, .93], 1);
        M.white.plate(sx - 0.16, z + 0.35, sx + 0.16, z + ROAD_W / 2 - 0.4, LY.mark, [.9, .9, .93], 1);
        emitArrow(M, x + s * (ROAD_W / 2 + 9), z + s * ROAD_W * 0.24, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        const sz = z + s * (ROAD_W / 2 + 3.2);
        M.white.plate(x - ROAD_W / 2 + 0.4, sz - 0.16, x - 0.35, sz + 0.16, LY.mark, [.9, .9, .93], 1);
        M.white.plate(x + 0.35, sz - 0.16, x + ROAD_W / 2 - 0.4, sz + 0.16, LY.mark, [.9, .9, .93], 1);
        emitArrow(M, x - s * ROAD_W * 0.24, z + s * (ROAD_W / 2 + 9), s > 0 ? 0 : Math.PI, 0);
      }
      /* дождеприёмники в лотке на четырёх углах перекрёстка */
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        emitInlet(M, x + sx * (ROAD_W / 2 - 0.45), z + sz * (ROAD_W / 2 - 2.6), 'z');
        emitInlet(M, x + sx * (ROAD_W / 2 - 2.6), z + sz * (ROAD_W / 2 - 0.45), 'x');
      }
      emitManhole(M, x + rnd(-2.5, 2.5), z + rnd(-2.5, 2.5), false);
    }
    /* люки, заплатки и лужи по перегонам */
    for (const z of ROADS_Z) for (let px = 12; px < W.x - 12; px += 17 + RR() * 12) {
      if (ROADS_X.some(r => Math.abs(px - r) < ROAD_W)) continue;
      emitManhole(M, px, z + (RR() - 0.5) * ROAD_W * 0.55, false);
      if (RR() < 0.55) emitPatch(M, px + rnd(-6, 6), z + (RR() - 0.5) * ROAD_W * 0.6, 1.8 + RR() * 3.4, 1.2 + RR() * 2.2);
      if (RR() < 0.42) emitPuddle(M, px + rnd(-7, 7), z + (RR() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 0.9), 0.8 + RR() * 0.9, 900 + px | 0);
    }
    for (const x of ROADS_X) for (let pz = 12; pz < W.z - 12; pz += 19 + RR() * 13) {
      if (ROADS_Z.some(r => Math.abs(pz - r) < ROAD_W)) continue;
      emitManhole(M, x + (RR() - 0.5) * ROAD_W * 0.55, pz, false);
      if (RR() < 0.5) emitPatch(M, x + (RR() - 0.5) * ROAD_W * 0.6, pz + rnd(-6, 6), 1.4 + RR() * 2.4, 1.8 + RR() * 3.2);
      if (RR() < 0.38) emitPuddle(M, x + (RR() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 0.9), pz + rnd(-7, 7), 0.8 + RR() * 0.9, 1700 + pz | 0);
    }
    /* люки и ливнёвки на тротуарах */
    for (const z of ROADS_Z) for (let px = 20; px < W.x - 20; px += 33 + RR() * 20)
      emitManhole(M, px, z + (RR() < 0.5 ? -1 : 1) * (ROAD_W / 2 + SIDE_W * 0.6), true);
  }
  /* парковка у БЦ */
  M.asphalt.plate(106.5, 93, 121, 119, 0.05, [1,1,1], 8);
  for (let i = 0; i <= 6; i++) M.white.plate(106.5, 93 + i * 4.3, 121, 93 + i * 4.3 + 0.16, 0.06, [.9,.9,.94], 1);
  /* спортплощадка */
  M.asphalt.plate(38, 47, 52, 57, 0.05, [.9,.95,1], 6);
  M.white.plate(38, 47, 52, 47.16, 0.06, [.4,.9,.88], 1);
  M.white.plate(38, 56.84, 52, 57, 0.06, [.4,.9,.88], 1);

  /* ямы: неровный контур, скошенные стенки и тёмное дно */
  for (const p of POTHOLES) {
    const RP = mulberry32(Math.floor(p.x * 71 + p.z * 137) >>> 0);
    const n = 10, rim = [], bot = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, rr = p.r * (0.74 + RP() * 0.46);
      rim.push([p.x + Math.cos(a) * rr, 0.064, p.z + Math.sin(a) * rr]);
      bot.push([p.x + Math.cos(a) * rr * 0.58, 0.042, p.z + Math.sin(a) * rr * 0.58]);
    }
    const wall = [.34, .32, .38], floor = [.10, .09, .13];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      M.asphalt.quad(rim[j], rim[i], bot[i], bot[j], 0, 1, 0,
        [rim[j][0]/2, rim[j][2]/2, rim[i][0]/2, rim[i][2]/2, bot[i][0]/2, bot[i][2]/2, bot[j][0]/2, bot[j][2]/2], wall, 0, 0);
    }
    const c0 = M.asphalt.vert(p.x, 0.042, p.z, 0, 1, 0, p.x / 2, p.z / 2, floor[0], floor[1], floor[2], 0, 0);
    const idx = bot.map(b2 => M.asphalt.vert(b2[0], b2[1], b2[2], 0, 1, 0, b2[0] / 2, b2[2] / 2, floor[0], floor[1], floor[2], 0, 0));
    for (let i = 0; i < n; i++) M.asphalt.tri(c0, idx[(i + 1) % n], idx[i]);
  }

  /* --- объекты --- */
  for (const b of BUILDINGS) emitBuilding(b, M);
  for (const k of KIOSKS) emitKiosk(k, M);
  for (const p of POLES) emitPole(p, M);
  for (const g of ROADSIDE) emitRoadside(g, M);
  for (const p of PROPS) emitProp(p, M);
  /* вьюн: стены выбраны глухие — ни окон, ни вывесок, ни ворот */
  emitVine(M, 67.7, 61.9, 43.7, 61.9, 2.6, 501);     /* задняя стена гаражей во дворе */
  emitVine(M, 76.3, 62.0, 70.6, 62.0, 3.0, 502);     /* торец ТП-4 */
  emitVine(M, 143.7, 25.0, 143.7, 35.7, 4.6, 503);   /* западная стена цеха №3 */
  emitVine(M, 48.9, 106.2, 32.5, 106.2, 2.6, 504);   /* гаражи сервисного квартала */

  /* Мягкое затемнение низа стен: контакт с землёй, которого карте AO взять
     неоткуда — та про мелкий рельеф материала. Числа в QCFG.light.groundAO. */
  const GA = QCFG.light.groundAO;
  for (const k of ['panel','stucco','brick','indust','garage']) M[k].aoByHeight(GA.y0, GA.y1, GA.k);

  /* Прозрачные батчи перечисляем явно. Батч хранит имя материала, а не
     текстуру: drawStatic берёт TX[name] при каждом вызове, поэтому при
     пересборке текстур в игре батчи ничего не замечают. Ключ обязан иметь
     одноимённый материал в SURF_DEFS, картах или SMALL_DEFS. */
  const ALPHA_KEYS = new Set(['leaves', 'roadsign']);
  Static.batches.length = 0;
  for (const k of keys) {
    if (!M[k].i.length) continue;
    /* индексы раскладываются по клеткам ДО выгрузки: в кадре рисуются только
       диапазоны видимых клеток, буфер при этом остаётся один */
    M[k].cellify(QCFG.cull.cell, QCFG.cull.pad);
    Static.batches.push({ name: k, gpu: M[k].upload(gl), alpha: ALPHA_KEYS.has(k) });
  }
  /* вывески: здесь только геометрия и текст; слои текстуры — buildSignsAsync */
  Static.signs.length = 0;
  for (const b of BUILDINGS) emitSign(gl, b);
  for (const k of KIOSKS) {
    const m = new Mesh();
    const cx = k.x + k.w / 2, z = k.z + k.d + 0.05;
    m.quad([cx - k.w/2 + .3, 2.3, z], [cx + k.w/2 - .3, 2.3, z], [cx + k.w/2 - .3, 2.85, z], [cx - k.w/2 + .3, 2.85, z],
      0, 0, 1, [0,1, 1,1, 1,0, 0,0], [1,1,1], 1, 0);
    Static.signs.push({ text: k.t, color: k.c, gpu: m.upload(gl), pos: [cx, 2.6, z + 0.3], mat: null });
  }
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let CELL, UVC;
export function __init() {

  /* ------------------------------------------------------------------ */
  /* Растительность: атлас, карты, ветер                                  */
  /* ------------------------------------------------------------------ */
  /* Ячейки атласа зелени в текстурных координатах. v растёт вниз по холсту —
     как у всех карт в файле (см. UV [0,1, 1,1, 1,0, 0,0]: верх квада получает
     v=0, то есть верх холста). Отступ 8/512 отрезает соседнюю ячейку на мипах. */
  CELL = (() => {
    const m = 8 / 512, h = 0.5;
    /* Атлас грузится с UNPACK_FLIP_Y_WEBGL, поэтому верхняя строка холста
       оказывается в верхней половине текстурных координат. Если считать
       строки «как нарисовано», крона возьмёт ячейку травы. */
    const mk = (cx, cy) => ({ u0: cx * h + m, u1: (cx + 1) * h - m,
                              vT: 1 - cy * h - m, vB: 1 - (cy + 1) * h + m });
    return { broad: mk(0, 0), veil: mk(1, 0), fir: mk(0, 1), tuft: mk(1, 1) };
  })();
  /* массивы считаем один раз: за сборку мира их читают тысячи раз */
  UVC = { broad: cellUV(CELL.broad), veil: cellUV(CELL.veil), fir: cellUV(CELL.fir), tuft: cellUV(CELL.tuft) };
  (function seedRoadside() {
    const add = (kind, x, z, o) => ROADSIDE.push(Object.assign({ kind, x, z }, o || {}));
    const R = mulberry32(8181);
    const jit = () => ({ yaw: (R() - 0.5) * 0.5, tilt: (R() - 0.5) * 0.12 });
    /* знаки у переходов и на подходах к перекрёсткам */
    for (const z of ROADS_Z) for (const x of ROADS_X) {
      const o = ROAD_W / 2 + 1.5;
      add('sign', x - o, z - o, Object.assign({ sn: 'ped', yawTo: 0 }, jit()));
      add('sign', x + o, z + o, Object.assign({ sn: 'ped', yawTo: Math.PI }, jit()));
    }
    add('sign', 32.4, 26.7, Object.assign({ sn: 'yield' }, jit()));
    add('sign', 167.5, 123.4, Object.assign({ sn: 'yield' }, jit()));
    add('sign', 32.6, 123.4, Object.assign({ sn: 'stop' }, jit()));
    add('sign', 118.7, 36.4, Object.assign({ sn: 'noentry' }, jit()));
    add('sign', 104.2, 60.1, Object.assign({ sn: 'work' }, jit()));
    add('sign', 58.4, 68.2, Object.assign({ sn: 'hole' }, jit()));
    add('sign', 141.9, 82.4, Object.assign({ sn: 'limit20' }, jit()));
    add('sign', 70.4, 137.6, Object.assign({ sn: 'bump' }, jit()));
    /* светофор на центральном перекрёстке и вечно-жёлтый на северном */
    add('signal', 94.0, 69.8, { yaw: 0, mode: 'work' });
    add('signal', 106.0, 80.2, { yaw: Math.PI, mode: 'work' });
    add('signal', 94.0, 13.5, { yaw: 0, mode: 'blink' });
    /* обрезанные мачты на прочих перекрёстках — «равнозначные» */
    for (const z of [18.75, 131.25]) for (const x of [25, 175]) add('stub', x - 7.2, z - 7.2, jit());
    /* отбойник у промзоны, столбики вокруг ям, остановки */
    add('rail', 104.0, 40.0, { len: 26, along: 'z' });
    for (const p of POTHOLES.slice(0, 4)) {
      add('post', p.x - p.r - 1.1, p.z);
      add('post', p.x + p.r + 1.1, p.z);
    }
    add('busstop', 60, 18.75, { along: 'x', side: 1 });
    add('busstop', 100, 96, { along: 'z', side: -1 });
  })();
}
