/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «Дорога: бордюрный камень, чугун, разметка и обстановка», строки 3977–4460.
   ===================================================================== */
import { TAU, mulberry32 } from '../core/util.js';
import { Mesh } from './mesh.js';
import { KIND_TEX, Static, UVS } from './static.js';
import { ROADS_X, ROADS_Z, ROAD_W } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* Дорога: бордюрный камень, чугун, разметка и обстановка               */
/* ------------------------------------------------------------------ */
/* Высоты слоёв. Земля 0, дорога 0.02, асфальт перекрёстков 0.03,
   тротуар 0.16. Всё новое живёт в этих зазорах, чтобы ничего не мерцало. */
export const LY = { patch: 0.028, wet: 0.034, mark: 0.046, iron: 0.056, walk: 0.16 };

/* Бордюрный камень отдельными блоками со швами: сплошная коробка читается
   как плинтус, а камни — как камни. У переходов бортик занижен. */
export function curbRun(M, along, road, side, s0, s1) {
  const STONE = 1.9, GAP = 0.055;
  /* Камень стоит на проезжей части и заходит краем под плиту тротуара: раньше
     он лежал ровно по её кромке и верхом совпадал с ней по высоте — две
     копланарные грани мерцали на любом движении камеры. */
  const off = ROAD_W / 2 - 0.06;
  for (let s = s0; s < s1 - 0.2; s += STONE) {
    const len = Math.min(STONE, s1 - s) - GAP;
    if (len < 0.5) break;
    /* занижение у пешеходных переходов */
    const mid = s + len / 2;
    const cross = along === 'x' ? ROADS_X.some(r => Math.abs(mid - r) < ROAD_W / 2 + 2.4)
                                : ROADS_Z.some(r => Math.abs(mid - r) < ROAD_W / 2 + 2.4);
    const h = cross ? 0.055 : 0.19;      /* бортик на 3 см выше тротуара */
    const k = 0.80 + ((Math.floor(mid * 7) % 5) * 0.035);     /* камни чуть разного тона */
    const col = [.80 * k, .79 * k, .84 * k];
    if (along === 'x') M.sidewalk.box(mid, 0, road + side * off, len, h, 0.22, col, { uv: 1 });
    else               M.sidewalk.box(road + side * off, 0, mid, 0.22, h, len, col, { uv: 1 });
  }
}

/* Люк колодца: чугунный круг с ремонтным швом вокруг. */
export function emitManhole(M, x, z, onWalk) {
  const y = onWalk ? LY.walk : 0;
  if (!onWalk) {
    const n = 10, ry = y + LY.patch, ring = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      ring.push([[x + Math.cos(a) * 0.66, z + Math.sin(a) * 0.66],
                 [x + Math.cos(a) * 1.05, z + Math.sin(a) * 1.05]]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, A = ring[i], B = ring[j];
      M.asphalt.quad([B[0][0], ry, B[0][1]], [A[0][0], ry, A[0][1]],
                     [A[1][0], ry, A[1][1]], [B[1][0], ry, B[1][1]], 0, 1, 0,
        [B[0][0]/2, B[0][1]/2, A[0][0]/2, A[0][1]/2, A[1][0]/2, A[1][1]/2, B[1][0]/2, B[1][1]/2],
        [.44, .42, .48], 0, 0);
    }
  }
  M.metal.cyl(x, y + LY.iron - 0.035, z, 0.36, 0.035, 12, [.26, .26, .29], { gloss: 0.28 });
  M.metal.cyl(x, y + LY.iron - 0.006, z, 0.30, 0.008, 12, [.20, .20, .23], { gloss: 0.35 });
}

/* Дождеприёмник у бордюра: рама, рёбра решётки и тёмный колодец под ними. */
export function emitInlet(M, x, z, along) {
  const y = LY.iron;
  const w = along === 'x' ? 0.72 : 0.48, d = along === 'x' ? 0.48 : 0.72;
  M.asphalt.plate(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y - 0.05, [.05, .05, .07], 2);
  M.metal.box(x, y - 0.04, z, w, 0.04, d, [.30, .30, .34], { uv: .5, gloss: 0.3, skipTop: true });
  for (let i = 0; i < 5; i++) {
    const o = -0.16 + i * 0.08;
    if (along === 'x') M.metal.box(x, y - 0.04, z + o, w - 0.06, 0.035, 0.035, [.28, .28, .32], { uv: .4, gloss: 0.3 });
    else M.metal.box(x + o, y - 0.04, z, 0.035, 0.035, d - 0.06, [.28, .28, .32], { uv: .4, gloss: 0.3 });
  }
}

/* Заплатка свежего асфальта — шов виден, потому что тон другой. */
export function emitPatch(M, x, z, w, d) {
  M.asphalt.plate(x - w / 2, z - d / 2, x + w / 2, z + d / 2, LY.patch, [.66, .64, .70], 2);
}

/* Лужа: неровное пятно с высоким блеском. Френель в шейдере делает остальное. */
export function emitPuddle(M, x, z, r, seed) {
  const RP = mulberry32(seed), n = 11, col = [.42, .44, .52];
  const gp = M.asphalt.g; M.asphalt.g = 0.72;
  const rim = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, rr = r * (0.62 + RP() * 0.6);
    rim.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
  }
  const c0 = M.asphalt.vert(x, LY.wet, z, 0, 1, 0, x / 2, z / 2, col[0], col[1], col[2], 0, 0);
  const idx = rim.map(p2 => M.asphalt.vert(p2[0], LY.wet, p2[1], 0, 1, 0, p2[0] / 2, p2[1] / 2, col[0], col[1], col[2], 0, 0));
  for (let i = 0; i < n; i++) M.asphalt.tri(c0, idx[(i + 1) % n], idx[i]);
  M.asphalt.g = gp;
}

/* Стрелка направления на полосе. */
export function emitArrow(M, x, z, yaw, turn) {
  const c = [.90, .90, .93];
  const ux = Math.sin(yaw), uz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const put = (ox, oy, w, l) => {
    const cx = x + ux * oy + rx * ox, cz = z + uz * oy + rz * ox;
    const hw = w / 2, hl = l / 2;
    M.white.quad([cx - ux * hl - rx * hw, LY.mark, cz - uz * hl - rz * hw],
                 [cx + ux * hl - rx * hw, LY.mark, cz + uz * hl - rz * hw],
                 [cx + ux * hl + rx * hw, LY.mark, cz + uz * hl + rz * hw],
                 [cx - ux * hl + rx * hw, LY.mark, cz - uz * hl + rz * hw],
                 0, 1, 0, [0, 1, 1, 1, 1, 0, 0, 0], c, 0, 0);
  };
  put(0, 0, 0.30, 2.4);                       /* стрела */
  put(0, 1.5, 0.86, 0.30);                    /* поперечина наконечника */
  put(0, 1.32, 0.62, 0.22);
  if (turn) put(turn * 0.55, -0.9, 1.1, 0.26);
}

export function roadPlate(m, x0, z0, x1, z1, y, along) {
  /* along = 'x' — полотно тянется по X; V-координата идёт поперёк дороги */
  const len = along === 'x' ? (x1 - x0) : (z1 - z0);
  const u1 = len / 12;
  if (along === 'x') m.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0], 0,1,0, [0,1, u1,1, u1,0, 0,0], [1,1,1], 0, 0);
  else m.quad([x1,y,z0],[x1,y,z1],[x0,y,z1],[x0,y,z0], 0,1,0, [0,1, u1,1, u1,0, 0,0], [1,1,1], 0, 0);
}

/* Доля окна внутри «клетки» текстуры (по X: слева/справа, по Y: сверху вниз).
   Нужна, чтобы подоконники и блоки кондиционеров вставали ровно под
   нарисованные окна, а не куда придётся. */
export const WIN_FRAC = {
  panel:  [0.203, 0.797, 0.203, 0.719],
  stucco: [0.234, 0.766, 0.234, 0.719],
  office: [0.234, 0.766, 0.234, 0.719]
};

/* Рельеф фасада: пояски между этажами, простенки, подоконники, кондиционеры,
   спутниковые тарелки и водосточные трубы по углам. Всё это ловит свет и
   даёт зданию объём — без него дом остаётся коробкой с картинкой. */
export function emitFacadeRelief(b, M, uv, tint) {
  const step = uv / 2;                       /* шаг этажа и окна в текстуре */
  if (b.w < step * 1.5 || b.d < step * 1.2 || b.h < step * 1.2) return;
  const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
  const con = M.sidewalk;
  const bandCol = [tint[0] * 0.92, tint[1] * 0.9, tint[2] * 0.94];
  const R = mulberry32(Math.floor(b.x * 977 + b.z * 131 + b.h * 7));
  const groundFree = (b.shop || b.entries || b.gate) ? 3.4 : 2.2;

  /* --- междуэтажные пояски: совпадают с нарисованными швами панелей --- */
  for (let y = b.h - step; y > groundFree; y -= step) {
    con.box(cx, y - 0.07, cz, b.w + 0.13, 0.14, b.d + 0.13, bandCol, { uv: 2 });
  }
  /* --- простенки между колоннами окон --- */
  const pw = Math.min(0.42, step * 0.16);
  for (let x = b.x + step; x < b.x + b.w - 0.2; x += step) {
    for (const sz of [b.z - 0.05, b.z + b.d + 0.05])
      con.box(x, groundFree, sz, pw, b.h - groundFree, 0.11, bandCol, { uv: 2, skipTop: true });
  }
  for (let z = b.z + step; z < b.z + b.d - 0.2; z += step) {
    for (const sx of [b.x - 0.05, b.x + b.w + 0.05])
      con.box(sx, groundFree, z, 0.11, b.h - groundFree, pw, bandCol, { uv: 2, skipTop: true });
  }

  /* --- подоконники, отливы, кондиционеры --- */
  const wf = WIN_FRAC[b.kind === 'garage' ? 'stucco' : b.kind];
  if (wf && !b.glassBand) {
    const [fx0, fx1, fy0, fy1] = wf;
    const faces = [
      { n: 'S', z: b.z + b.d, dz: 1, len: b.w, ax: 'x' },
      { n: 'N', z: b.z, dz: -1, len: b.w, ax: 'x' },
      { n: 'E', x: b.x + b.w, dx: 1, len: b.d, ax: 'z' },
      { n: 'W', x: b.x, dx: -1, len: b.d, ax: 'z' }
    ];
    for (const f of faces) {
      const cols = Math.floor(f.len / step);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; ; r++) {
          const yTop = b.h - step * (r + fy0), yBot = b.h - step * (r + fy1);
          if (yBot < groundFree) break;
          const w0 = step * (c + fx0), w1 = step * (c + fx1);
          const ww = w1 - w0, mid = (w0 + w1) / 2;
          const sill = [tint[0] * 0.98, tint[1] * 0.96, tint[2] * 0.99];
          if (f.ax === 'x') {
            const px = b.x + mid, pz = f.z + f.dz * 0.075;
            con.box(px, yBot - 0.05, pz, ww + 0.18, 0.08, 0.15, sill, { uv: 1.5 });
            con.box(px, yTop, pz - f.dz * 0.02, ww + 0.20, 0.10, 0.11, sill, { uv: 1.5 });
            if (R() < 0.14) emitAC(M, px + (R() - 0.5) * 0.4, yBot - 0.60, f.z + f.dz * 0.24, f.ax, f.dz);
            else if (R() < 0.05) emitDish(M, px, yTop + 0.34, f.z + f.dz * 0.20, f.ax, f.dz);
          } else {
            const pz = b.z + mid, px = f.x + f.dx * 0.075;
            con.box(px, yBot - 0.05, pz, 0.15, 0.08, ww + 0.18, sill, { uv: 1.5 });
            con.box(px - f.dx * 0.02, yTop, pz, 0.11, 0.10, ww + 0.20, sill, { uv: 1.5 });
            if (R() < 0.12) emitAC(M, f.x + f.dx * 0.24, yBot - 0.60, pz + (R() - 0.5) * 0.4, f.ax, f.dx);
          }
        }
      }
    }
  }

  /* --- водосточные трубы по углам --- */
  const pipeCol = [.62, .63, .68];
  for (const [px, pz] of [[b.x + 0.16, b.z + 0.16], [b.x + b.w - 0.16, b.z + 0.16],
                          [b.x + 0.16, b.z + b.d - 0.16], [b.x + b.w - 0.16, b.z + b.d - 0.16]]) {
    M.metal.tube([[px, 0.1, pz], [px, b.h + 0.3, pz]], 0.075, 6, pipeCol, { gloss: 0.35 });
    M.metal.box(px, 0.1, pz, 0.26, 0.16, 0.26, pipeCol, { uv: 1 });
  }
}

/* Отмостка: бетонная лента вокруг дома. Заодно даёт контактное притенение —
   у стены полоса темнее, к краю светлеет, и дом перестаёт «висеть» над землёй. */
export function emitApron(b, M, width, y) {
  const m = M.sidewalk, w = width, ay = y;
  const x0 = b.x - 0.15, x1 = b.x + b.w + 0.15, z0 = b.z - 0.15, z1 = b.z + b.d + 0.15;
  const X0 = x0 - w, X1 = x1 + w, Z0 = z0 - w, Z1 = z1 + w;
  const dk = [.28, .27, .32], lt = [.88, .87, .91];
  m.box((X0 + X1) / 2, 0, (Z0 + Z1) / 2, X1 - X0, ay, Z1 - Z0, [.70, .69, .74], { uv: 2, skipTop: true });
  const U = (a, b2, c, d) => [a[0] / 2, a[1] / 2, b2[0] / 2, b2[1] / 2, c[0] / 2, c[1] / 2, d[0] / 2, d[1] / 2];
  /* четыре полосы */
  m.quadC([x0,ay,Z1],[x1,ay,Z1],[x1,ay,z1],[x0,ay,z1], 0,1,0, U([x0,Z1],[x1,Z1],[x1,z1],[x0,z1]), lt, lt, dk, dk, 0, 0);
  m.quadC([x0,ay,z0],[x1,ay,z0],[x1,ay,Z0],[x0,ay,Z0], 0,1,0, U([x0,z0],[x1,z0],[x1,Z0],[x0,Z0]), dk, dk, lt, lt, 0, 0);
  m.quadC([x1,ay,z1],[X1,ay,z1],[X1,ay,z0],[x1,ay,z0], 0,1,0, U([x1,z1],[X1,z1],[X1,z0],[x1,z0]), dk, lt, lt, dk, 0, 0);
  m.quadC([X0,ay,z1],[x0,ay,z1],[x0,ay,z0],[X0,ay,z0], 0,1,0, U([X0,z1],[x0,z1],[x0,z0],[X0,z0]), lt, dk, dk, lt, 0, 0);
  /* углы */
  m.quadC([x1,ay,Z1],[X1,ay,Z1],[X1,ay,z1],[x1,ay,z1], 0,1,0, U([x1,Z1],[X1,Z1],[X1,z1],[x1,z1]), lt, lt, lt, dk, 0, 0);
  m.quadC([X0,ay,Z1],[x0,ay,Z1],[x0,ay,z1],[X0,ay,z1], 0,1,0, U([X0,Z1],[x0,Z1],[x0,z1],[X0,z1]), lt, lt, dk, lt, 0, 0);
  m.quadC([x1,ay,z0],[X1,ay,z0],[X1,ay,Z0],[x1,ay,Z0], 0,1,0, U([x1,z0],[X1,z0],[X1,Z0],[x1,Z0]), dk, lt, lt, lt, 0, 0);
  m.quadC([X0,ay,z0],[x0,ay,z0],[x0,ay,Z0],[X0,ay,Z0], 0,1,0, U([X0,z0],[x0,z0],[x0,Z0],[X0,Z0]), lt, dk, lt, lt, 0, 0);
}

/* наружный блок кондиционера на кронштейне */
export function emitAC(M, x, y, z, ax, dir) {
  const body = [.86, .87, .88], grid = [.42, .44, .48];
  if (ax === 'x') {
    M.metal.bevelBox(x, y, z, 0.78, 0.52, 0.30, body, { bev: 0.03, r: 0.04, cs: 2, uv: 1, gloss: 0.3 });
    M.metal.cyl(x, y + 0.10, z + dir * 0.16, 0.19, 0.02, 12, grid, { gloss: 0.2 });
    M.metal.box(x, y - 0.06, z - dir * 0.16, 0.72, 0.05, 0.20, grid, { uv: 1 });
  } else {
    M.metal.bevelBox(x, y, z, 0.30, 0.52, 0.78, body, { bev: 0.03, r: 0.04, cs: 2, uv: 1, gloss: 0.3 });
    M.metal.cyl(x + dir * 0.16, y + 0.10, z, 0.19, 0.02, 12, grid, { gloss: 0.2 });
    M.metal.box(x - dir * 0.16, y - 0.06, z, 0.20, 0.05, 0.72, grid, { uv: 1 });
  }
}
/* спутниковая тарелка */
export function emitDish(M, x, y, z, ax, dir) {
  const col = [.88, .88, .9];
  if (ax === 'x') {
    M.metal.cyl(x, y, z + dir * 0.10, 0.30, 0.05, 12, col, { gloss: 0.4, rTop: 0.33 });
    M.metal.tube([[x, y + 0.02, z], [x, y + 0.02, z + dir * 0.34]], 0.022, 5, [.4, .4, .44], { gloss: 0.5 });
  } else {
    M.metal.cyl(x + dir * 0.10, y, z, 0.30, 0.05, 12, col, { gloss: 0.4, rTop: 0.33 });
    M.metal.tube([[x, y + 0.02, z], [x + dir * 0.34, y + 0.02, z]], 0.022, 5, [.4, .4, .44], { gloss: 0.5 });
  }
}

/* --------------------------------------------------------------------
   Вокзал «Верещагино». Длинный симметричный корпус с тремя ризалитами:
   два по краям и один посередине, повыше, с вывеской. Окна, пилястры,
   карниз и парапет собраны геометрией, а не нарисованы в текстуре: у
   штукатурки в атласе свои окна, и для вокзальных они не годятся.
   Главный фасад смотрит на запад, то есть в −X: длинная сторона идёт
   вдоль Z.                                                             */
export function emitStation(b, M) {
  const WH = M.white, S = M.stucco, R = M.roof, G = M.shopGlass, MT = M.metal;
  const wall = b.tint || [1, .94, .74];      /* тёплая охра, как на фотографии */
  const trim = [1, .99, .95];                /* белые тяги и наличники */
  const x0 = b.x, x1 = b.x + b.w, z0 = b.z, z1 = b.z + b.d;
  const cx = x0 + b.w / 2, cz = z0 + b.d / 2;
  const H = b.h;                             /* высота основного корпуса */
  const uv = 5;

  /* цоколь и отмостка */
  M.sidewalk.box(cx, 0, cz, b.w + 0.5, 0.62, b.d + 0.5, [.70, .68, .72], { uv: 2, skipTop: true });
  emitApron(b, M, 1.6, 0.185);

  /* основной корпус */
  S.box(cx, 0.62, cz, b.w, H - 0.62, b.d, wall, { uv, skipTop: true });

  /* три ризалита: по краям и в середине. dz — половина длины по Z. */
  const RIS = [
    { c: z0 + 3.2, dz: 3.2, h: H + 0.5 },
    { c: cz,       dz: 4.4, h: H + 1.8 },
    { c: z1 - 3.2, dz: 3.2, h: H + 0.5 }
  ];
  for (const r of RIS) {
    S.box(x0 - 0.28, 0.62, r.c, 0.56 + b.w * 0.06, r.h - 0.62, r.dz * 2, wall, { uv, skipTop: true });
    /* карниз ризалита */
    WH.box(x0 - 0.34, r.h, r.c, 0.9, 0.34, r.dz * 2 + 0.5, trim, { uv: 2 });
    /* парапет: столбики поверху */
    const n = Math.max(2, Math.round(r.dz * 2 / 1.5));
    for (let i = 0; i <= n; i++)
      WH.box(x0 - 0.28, r.h + 0.34, r.c - r.dz + i * (r.dz * 2 / n), 0.42, 0.62, 0.28, trim, { uv: 1 });
    WH.box(x0 - 0.28, r.h + 0.34, r.c, 0.34, 0.20, r.dz * 2, trim, { uv: 1 });
  }

  /* карниз и парапет основного корпуса */
  WH.box(cx, H, cz, b.w + 0.62, 0.30, b.d + 0.62, trim, { uv: 2 });
  R.box(cx, H + 0.30, cz, b.w + 0.34, 0.34, b.d + 0.34, [.46, .44, .48], { uv: 3 });

  /* пилястры по западному фасаду между окнами */
  const bays = 14, step = b.d / bays;
  for (let i = 0; i <= bays; i++) {
    const z = z0 + i * step;
    if (Math.abs(z - cz) < 4.6) continue;                 /* середину занимает ризалит */
    const inRis = z < z0 + 6.6 || z > z1 - 6.6;
    WH.box(x0 - (inRis ? 0.50 : 0.14), 0.62, z, 0.30, H - 1.0, 0.46, trim, { uv: 1, skipTop: true });
  }

  /* окна первого этажа: высокие, с белой перемычкой и подоконником */
  for (let i = 0; i < bays; i++) {
    const z = z0 + (i + 0.5) * step;
    if (Math.abs(z - cz) < 4.4) continue;
    const inRis = z < z0 + 6.6 || z > z1 - 6.6;
    const xf = x0 - (inRis ? 0.52 : 0.02);
    G.box(xf, 1.35, z, 0.16, 3.4, 1.35, [.42, .52, .62], { uv: 2, gloss: 0.75 });
    WH.box(xf - 0.06, 1.15, z, 0.22, 0.22, 1.75, trim, { uv: 1 });        /* подоконник */
    WH.box(xf - 0.06, 4.75, z, 0.26, 0.34, 1.85, trim, { uv: 1 });        /* перемычка */
  }
  /* окна второго света в среднем ризалите, над вывеской */
  for (const dz of [-2.7, -0.9, 0.9, 2.7])
    G.box(x0 - 0.56, 5.5, cz + dz, 0.16, 1.5, 0.7, [.42, .52, .62], { uv: 2, gloss: 0.75 });

  /* вход: двойные двери в среднем ризалите и козырёк над ними */
  G.box(x0 - 0.60, 0.62, cz, 0.14, 2.9, 2.5, [.30, .34, .40], { uv: 2, gloss: 0.6 });
  WH.box(x0 - 0.60, 0.62, cz, 0.20, 2.9, 0.16, trim, { uv: 1 });          /* средник */
  WH.box(x0 - 0.66, 3.52, cz, 1.30, 0.22, 3.2, trim, { uv: 2 });          /* козырёк */
  for (const dz of [-1.35, 1.35])
    MT.cyl(x0 - 1.16, 0.62, cz + dz, 0.05, 2.9, 6, [.55, .56, .60], { gloss: 0.5 });

  /* восточная сторона: глухая стена под будущие пути, только двери на перрон */
  for (const dz of [-6, 0, 6])
    G.box(x1 + 0.02, 0.62, cz + dz, 0.12, 2.6, 1.6, [.30, .34, .40], { uv: 2, gloss: 0.6 });

  /* вентиляция и мачта на кровле — как у соседей по промзоне */
  const RND = mulberry32(20260905);
  R.box(cx + 1.2, H + 0.64, cz - 6, 1.6, 1.1, 1.4, [.62, .62, .66], { uv: 2 });
  MT.cyl(cx - 2.2, H + 0.64, cz + 7, 0.05, 3.4, 5, [.72, .73, .78], {});
  for (let i = 0; i < 4; i++)
    MT.box(cx + (RND() - 0.5) * (b.w - 3), H + 0.64, cz + (RND() - 0.5) * (b.d - 4),
      0.6 + RND() * 0.5, 0.4 + RND() * 0.4, 0.6 + RND() * 0.5, [.68, .70, .74], { uv: 1 });
}

export function emitBuilding(b, M) {
  if (b.kind === 'station') { emitStation(b, M); return; }
  const texKey = KIND_TEX[b.kind] || 'stucco';
  const m = M[texKey], uv = UVS[b.kind] || 5;
  const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
  const tint = b.tint || [1, 1, 1];
  const isGarage = b.kind === 'garage';
  const wallH = isGarage ? b.h : b.h;

  /* корпус */
  m.box(cx, 0, cz, b.w, wallH, b.d, tint, { uv, skipTop: true });

  /* цоколь */
  M.sidewalk.box(cx, 0, cz, b.w + 0.3, 0.55, b.d + 0.3, [.72,.7,.76], { uv: 2, skipTop: true });
  emitApron(b, M, isGarage ? 0.9 : 1.35, 0.185);
  if (!isGarage) emitFacadeRelief(b, M, uv, tint);

  /* кровля с парапетом */
  M.roof.box(cx, wallH, cz, b.w + 0.24, 0.42, b.d + 0.24, [.85,.85,.9], { uv: 3 });
  const pt = 0.28, py = wallH + 0.42;
  M.roof.box(cx, py, b.z + pt / 2, b.w + 0.24, 0.5, pt, [.7,.7,.76], { uv: 2 });
  M.roof.box(cx, py, b.z + b.d - pt / 2, b.w + 0.24, 0.5, pt, [.7,.7,.76], { uv: 2 });
  M.roof.box(b.x + pt / 2, py, cz, pt, 0.5, b.d + 0.24, [.7,.7,.76], { uv: 2 });
  M.roof.box(b.x + b.w - pt / 2, py, cz, pt, 0.5, b.d + 0.24, [.7,.7,.76], { uv: 2 });

  /* надстройки на крыше */
  if (b.h >= 7) {
    const R = mulberry32(Math.floor(b.x * 31 + b.z * 17));
    M.stucco.box(b.x + b.w * (0.2 + R() * 0.5), py, b.z + b.d * (0.3 + R() * 0.4), 2.6, 2.4, 2.2, [.8,.8,.84], { uv: 3 });
    for (let i = 0; i < 3; i++)
      M.metal.box(b.x + 1 + R() * (b.w - 2), py, b.z + 0.8 + R() * (b.d - 1.6), 0.7 + R(), 0.5 + R() * 0.7, 0.7 + R(), [.7,.72,.76], { uv: 1 });
    M.metal.cyl(b.x + b.w * 0.8, py, b.z + b.d * 0.25, 0.06, 3 + R() * 2.5, 5, [.75,.75,.8], {});
    if (b.h > 12) M.metal.cyl(b.x + b.w * 0.3, py, b.z + b.d * 0.7, 0.75, 1.3, 8, [.72,.74,.8], {});
  }

  /* ленточное остекление для «офисов» */
  if (b.glassBand) {
    for (let y = 2.4; y < b.h - 1.4; y += 3.4) {
      M.shopGlass.box(cx, y, cz, b.w + 0.06, 1.7, b.d + 0.06, [.85,.9,1], { uv: 4, skipTop: true, emis: 0.5 });
    }
  }

  /* балконы панелек */
  if (b.balcony) {
    const side = b.balcony;
    const n = Math.floor((side === 'S' || side === 'N' ? b.w : b.d) / 3.2);
    for (let f = 1; f * 3 < b.h - 1.5; f++) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        let bx, bz, bw, bd;
        if (side === 'S') { bx = b.x + t * b.w; bz = b.z + b.d + 0.5; bw = 2.4; bd = 1.0; }
        else if (side === 'N') { bx = b.x + t * b.w; bz = b.z - 0.5; bw = 2.4; bd = 1.0; }
        else if (side === 'E') { bx = b.x + b.w + 0.5; bz = b.z + t * b.d; bw = 1.0; bd = 2.4; }
        else { bx = b.x - 0.5; bz = b.z + t * b.d; bw = 1.0; bd = 2.4; }
        const y = f * 3;
        M.sidewalk.box(bx, y, bz, bw, 0.16, bd, [.78,.76,.8], { uv: 1.5 });
        const rc = [[.85,.72,.5], [.6,.72,.8], [.8,.6,.66], [.7,.78,.66]][(f + i) % 4];
        M.metal.box(bx, y + 0.16, bz, bw, 0.95, bd, rc, { uv: 1.2, skipTop: true });
      }
    }
  }

  /* ворота гаражей */
  if (isGarage) {
    const n = b.rows || 4;
    const doorCols = [[.72,.42,.32], [.35,.5,.62], [.62,.56,.34], [.45,.4,.58], [.3,.55,.48], [.66,.5,.6]];
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      if (b.vert) {
        const z0 = b.z + t0 * b.d + 0.25, z1 = b.z + t1 * b.d - 0.25;
        M.garage.quad([b.x + b.w + 0.03, 0.1, z1], [b.x + b.w + 0.03, 0.1, z0], [b.x + b.w + 0.03, b.h - 0.35, z0], [b.x + b.w + 0.03, b.h - 0.35, z1],
          1, 0, 0, [0,1, 1,1, 1,0, 0,0], doorCols[i % 6], 0, 0);
      } else {
        const x0 = b.x + t0 * b.w + 0.25, x1 = b.x + t1 * b.w - 0.25;
        M.garage.quad([x0, 0.1, b.z + b.d + 0.03], [x1, 0.1, b.z + b.d + 0.03], [x1, b.h - 0.35, b.z + b.d + 0.03], [x0, b.h - 0.35, b.z + b.d + 0.03],
          0, 0, 1, [0,1, 1,1, 1,0, 0,0], doorCols[i % 6], 0, 0);
      }
    }
  }

  /* витрина первого этажа + козырёк */
  if (b.shop) {
    const zf = b.z + b.d + 0.04;
    M.shopGlass.quad([b.x + 0.6, 0.55, zf], [b.x + b.w - 0.6, 0.55, zf], [b.x + b.w - 0.6, 3.0, zf], [b.x + 0.6, 3.0, zf],
      0, 0, 1, [0,1, (b.w - 1.2) / 3, 1, (b.w - 1.2) / 3, 0, 0,0], [1,1,1], 0, 0);
    M.metal.box(b.x + b.w / 2, 3.05, b.z + b.d + 0.5, b.w - 0.4, 0.16, 1.3, [.9,.55,.6], { uv: 2 });
    for (let i = -1; i <= 1; i += 2) {
      const lx = b.x + b.w / 2 + i * (b.w / 2 - 1.6);
      M.white.box(lx, 2.95, b.z + b.d + 0.75, 0.3, 0.1, 0.3, [1, .9, .7], { uv: 1, emis: 1 });
      Static.lamps.push({ x: lx, y: 2.9, z: b.z + b.d + 0.9, small: true });
    }
    M.metal.box(b.x + b.w / 2, 0, b.z + b.d + 1.1, 2.2, 0.12, 1.6, [.8,.8,.84], { uv: 1.5 });
  }

  /* подъезды */
  if (b.entries) for (const ex of b.entries) {
    const zf = b.z + b.d;
    M.metal.box(ex, 0, zf + 0.75, 2.2, 0.18, 1.6, [.76,.76,.8], { uv: 1.4 });
    M.metal.box(ex, 2.35, zf + 0.7, 2.6, 0.18, 1.7, [.55,.62,.7], { uv: 1.6 });
    M.metal.cyl(ex - 1.1, 0.18, zf + 1.4, 0.07, 2.2, 5, [.6,.6,.66], {});
    M.metal.cyl(ex + 1.1, 0.18, zf + 1.4, 0.07, 2.2, 5, [.6,.6,.66], {});
    M.shopGlass.quad([ex - 0.85, 0.2, zf + 0.05], [ex + 0.85, 0.2, zf + 0.05], [ex + 0.85, 2.3, zf + 0.05], [ex - 0.85, 2.3, zf + 0.05],
      0, 0, 1, [0,1, .55,1, .55,0, 0,0], [.6,.65,.7], 0, 0);
    M.white.box(ex, 2.52, zf + 0.28, 0.34, 0.16, 0.24, [1, .88, .62], { uv: 1, emis: 1 });
    Static.lamps.push({ x: ex, y: 2.5, z: zf + 0.5, small: true });
  }
  /* ворота склада */
  if (b.gate) {
    const zf = b.z + b.d + 0.04, gx = b.x + b.w / 2;
    M.metal.quad([gx - 3.2, 0.1, zf], [gx + 3.2, 0.1, zf], [gx + 3.2, 4.4, zf], [gx - 3.2, 4.4, zf],
      0, 0, 1, [0,1, 3,1, 3,0, 0,0], [.55,.6,.66], 0, 0);
  }
}

export function emitSign(gl, b) {
  if (!b.sign) return;
  const s = b.sign;
  /* У западной и восточной стороны длина щита берётся по глубине дома: там
     фасад идёт вдоль Z. Высоту и ширину можно задать в самой вывеске — у
     вокзала щит висит между окнами второго света, а не под карнизом. */
  const along = (s.side === 'W' || s.side === 'E') ? b.d : b.w;
  const wsign = s.w || Math.min(along - 1.2, s.small ? 3 : 9);
  const hsign = s.h || wsign / 4;
  const y = s.y !== undefined ? s.y : (b.shop ? 3.35 : (b.h - hsign - 0.8));
  const m = new Mesh();
  const cx = b.x + b.w / 2;
  const czm = b.z + b.d / 2;
  /* Слои вывесок грузятся уже перевёрнутыми по строкам (flipRows заменяет
     UNPACK_FLIP_Y, которого у texSubImage3D нет), поэтому v=0 — это низ
     холста. Развёртка же осталась от старого порядка и отдавала верху квада
     v=0: текст на всех вывесках района стоял вверх ногами, отчего «Т»
     читалась как «⊥», «М» как «W», а «И» как «N». */
  const UV = [0,0, 1,0, 1,1, 0,1];
  if (s.side === 'W' || s.side === 'E') {
    /* Взгляд на западный фасад идёт в +X, и экранное «вправо» там — это +Z;
       на восточный наоборот. Отсюда порядок вершин. */
    const west = s.side === 'W';
    const x = west ? b.x - (s.out || 0.06) : b.x + b.w + (s.out || 0.06);
    const z0 = czm - wsign / 2, z1 = czm + wsign / 2;
    const a = west ? z0 : z1, c2 = west ? z1 : z0;
    m.quad([x, y, a], [x, y, c2], [x, y + hsign, c2], [x, y + hsign, a],
      west ? -1 : 1, 0, 0, UV, [1,1,1], 1, 0);
    Static.signs.push({ text: s.t, color: s.c, fill: s.fill, gpu: m.upload(gl),
      pos: [west ? b.x - 0.4 : b.x + b.w + 0.4, y + hsign / 2, czm], mat: null });
    return;
  }
  if (s.side === 'N') {
    const z = b.z - 0.06;
    m.quad([cx + wsign/2, y, z], [cx - wsign/2, y, z], [cx - wsign/2, y + hsign, z], [cx + wsign/2, y + hsign, z],
      0, 0, -1, UV, [1,1,1], 1, 0);
  } else {
    const z = b.z + b.d + 0.06;
    m.quad([cx - wsign/2, y, z], [cx + wsign/2, y, z], [cx + wsign/2, y + hsign, z], [cx - wsign/2, y + hsign, z],
      0, 0, 1, UV, [1,1,1], 1, 0);
  }
  Static.signs.push({ text: s.t, color: s.c, fill: s.fill, gpu: m.upload(gl), pos: [cx, y + hsign / 2, s.side === 'N' ? b.z - 0.4 : b.z + b.d + 0.4], mat: null });
}
