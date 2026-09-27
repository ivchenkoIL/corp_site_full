/* =====================================================================
   ground.js — земля района: дворы, дороги, тротуары, бордюры, отмостки,
   разметка. Высоты те же, что у старой логики (surfY): иначе ноги Олега
   ушли бы в тротуар, а колёса — под асфальт.
     дорога 0.031 · тротуар 0.161 · отмостка у дома 0.186 · двор 0.013
   ===================================================================== */
import { Batch, fbm, rng } from './geo.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const Y_ROAD = 0.031, Y_SIDE = 0.161, Y_APRON = 0.186, Y_YARD = 0.013, Y_PARK = 0.051;

export function buildGround(scene, mats, W, ROADS_X, ROADS_Z, ROAD_W, SIDE_W, BUILDINGS, shadows) {
  const hw = ROAD_W / 2;
  const asphalt = mats.surface('asphalt_02', { tile: 5, name: 'asphalt', tint: [0.92, 0.92, 0.94] });
  const pavers = mats.surface('concrete_pavers', { tile: 2.2, name: 'pavers', tint: [0.9, 0.89, 0.86] });
  const yard = mats.terrain('brown_mud_leaves_01', 'sparse_grass', { tile: 4.6, tile2: 3.2, name: 'yard' });
  const curbM = mats.surface('concrete_floor_worn_001', { tile: 1.6, name: 'curb', tint: [0.86, 0.85, 0.82] });
  const apronM = mats.surface('dirty_concrete', { tile: 2.4, name: 'apron', tint: [0.78, 0.77, 0.75] });
  const paint = mats.surface('concrete_floor_worn_001', { tile: 1.4, name: 'roadPaint', tint: [1.05, 1.05, 1.0] });

  const road = new Batch('roads'), side = new Batch('sidewalks'), curb = new Batch('curbs'), apron = new Batch('aprons'), marks = new Batch('marks');
  const up = [0, 1, 0], X = [1, 0, 0], Zn = [0, 0, 1];
  const flat = (b, x0, z0, x1, z1, y) => b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], up, [x0, z1, x1, z1, x1, z0, x0, z0]);

  /* --- дороги: восток-запад целиком, север-юг кусками между ними --- */
  for (const r of ROADS_Z) flat(road, -420, r - hw, W.x + 420, r + hw, Y_ROAD);
  const zCuts = [...ROADS_Z].sort((a, b) => a - b);
  for (const r of ROADS_X) {
    let z0 = -420;
    for (const zr of zCuts) { flat(road, r - hw, z0, r + hw, zr - hw, Y_ROAD); z0 = zr + hw; }
    flat(road, r - hw, z0, r + hw, W.z + 420, Y_ROAD);
  }

  /* --- тротуары с бордюром: полоса вдоль каждой дороги, прерывается на перекрёстках --- */
  const crossX = ROADS_X.map(r => [r - hw, r + hw]), crossZ = ROADS_Z.map(r => [r - hw, r + hw]);
  const spans = (a, b, cuts) => {         /* отрезок [a,b] минус проезжие части */
    const out = []; let s = a;
    for (const [c0, c1] of [...cuts].sort((p, q) => p[0] - q[0])) { if (c1 <= s || c0 >= b) continue; if (c0 > s) out.push([s, c0]); s = Math.max(s, c1); }
    if (s < b) out.push([s, b]);
    return out;
  };
  const curbH = Y_SIDE - Y_ROAD, curbW = 0.16;
  for (const r of ROADS_Z) for (const sgn of [-1, 1]) {
    const zEdge = r + sgn * hw, zOut = zEdge + sgn * SIDE_W;
    for (const [a, b] of spans(-420, W.x + 420, crossX)) {
      flat(side, a, Math.min(zEdge, zOut), b, Math.max(zEdge, zOut), Y_SIDE);
      /* бордюрный камень: лицевая грань к дороге и верх */
      const zc = zEdge + sgn * curbW / 2;
      curb.box((a + b) / 2, Y_ROAD - 0.02, zc, b - a, curbH + 0.035, curbW, 0, { faces: 'tnsew', uvScale: 1 });
    }
  }
  for (const r of ROADS_X) for (const sgn of [-1, 1]) {
    const xEdge = r + sgn * hw, xOut = xEdge + sgn * SIDE_W;
    for (const [a, b] of spans(-420, W.z + 420, crossZ)) {
      /* углы у перекрёстков уже покрыты тротуаром поперечной улицы */
      const segs = spans(a, b, ROADS_Z.map(z => [z - hw - SIDE_W, z + hw + SIDE_W]));
      for (const [s0, s1] of segs) flat(side, Math.min(xEdge, xOut), s0, Math.max(xEdge, xOut), s1, Y_SIDE);
      const xc = xEdge + sgn * curbW / 2;
      curb.box(xc, Y_ROAD - 0.02, (a + b) / 2, curbW, curbH + 0.035, b - a, 0, { faces: 'tnsew', uvScale: 1 });
    }
  }

  /* --- отмостка вокруг домов: бетонная плита на 1.45 м --- */
  for (const b of BUILDINGS) {
    const m = 1.45;
    apron.box(b.x + b.w / 2, Y_YARD - 0.05, b.z + b.d / 2, b.w + 2 * m, Y_APRON - Y_YARD + 0.05, b.d + 2 * m, 0, { uvScale: 1, faces: 'tnsew' });
  }

  /* --- разметка: осевая пунктиром, зебры у перекрёстков --- */
  const dash = (x0, z0, x1, z1) => flat(marks, x0, z0, x1, z1, Y_ROAD + 0.004);
  for (const r of ROADS_Z) for (const [a, b] of spans(-420, W.x + 420, crossX))
    for (let x = a + 2; x + 3 < b - 1; x += 9) dash(x, r - 0.06, x + 3, r + 0.06);
  for (const r of ROADS_X) for (const [a, b] of spans(-420, W.z + 420, crossZ))
    for (let z = a + 2; z + 3 < b - 1; z += 9) dash(r - 0.06, z, r + 0.06, z + 3);
  for (const rz of ROADS_Z) for (const rx of ROADS_X) {
    for (const sg of [-1, 1]) {
      const z0 = rz + sg * (hw + 1.2);           /* зебра через дорогу x=rx, чуть в стороне от перекрёстка */
      for (let k = -4; k <= 4; k++) { const x = rx + k * 1.1; dash(x - 0.25, Math.min(z0, z0 + sg * 3.2), x + 0.25, Math.max(z0, z0 + sg * 3.2)); }
      const x0 = rx + sg * (hw + 1.2);
      for (let k = -4; k <= 4; k++) { const z = rz + k * 1.1; dash(Math.min(x0, x0 + sg * 3.2), z - 0.25, Math.max(x0, x0 + sg * 3.2), z + 0.25); }
    }
  }

  /* --- двор и пустыри: одна сетка на весь район и поле вокруг, с крупными
         пятнами цвета по шуму, чтобы земля не была ровной «плиткой» --- */
  const g = new Batch('yardGround');
  const S = 6, x0 = -420, z0 = -420, x1 = W.x + 420, z1 = W.z + 420;
  const nx = Math.round((x1 - x0) / S), nz = Math.round((z1 - z0) / S);
  const base = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * S, z = z0 + j * S;
    const n = fbm(x * 0.045, z * 0.045), m = fbm(x * 0.21 + 7, z * 0.21 - 3, 2);
    const k = 0.78 + 0.36 * n + 0.1 * m;
    /* под дорогами земля уходит вниз: иначе вдали асфальт и земля мерцают */
    const underRoad = ROADS_X.some(r => Math.abs(x - r) < hw - 0.4) || ROADS_Z.some(r => Math.abs(z - r) < hw - 0.4);
    g.p.push(x, underRoad ? -0.12 : Y_YARD, z); g.n.push(0, 1, 0); g.uv.push(x, z);
    g.c.push(k * (0.98 + 0.06 * m), k, k * (0.93 - 0.05 * n), 1);
  }
  g.useColor = true;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    g.i.push(a, c, d, a, d, b);
  }

  const out = [];
  const yardMat = yard; yardMat.useVertexColors = true;
  out.push(g.build(scene, yardMat, { name: 'yardGround' }));
  out.push(road.build(scene, asphalt));
  out.push(side.build(scene, pavers));
  out.push(curb.build(scene, curbM));
  out.push(apron.build(scene, apronM));
  const mk = marks.build(scene, paint); if (mk) { mk.material.zOffset = -2; out.push(mk); }
  for (const m of out) if (m) m.receiveShadows = true;
  return out.filter(Boolean);
}
