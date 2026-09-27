/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «5. Столкновения: список AABB + равномерная сетка», строки 3886–3969.
   ===================================================================== */
import { clamp } from '../core/util.js';
import { TREE_SP, treeSpecies } from '../render/vegetation.js';
import { BUILDINGS, KIOSKS, POLES, PROPS, W } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 5. Столкновения: список AABB + равномерная сетка                     */
/* ------------------------------------------------------------------ */
export const Solids = { list: [], grid: null, cell: 8, cols: 0, rows: 0 };
export function addSolid(x, z, w, d, kind, ref, extra) {
  Solids.list.push(Object.assign({ x, z, w, d, kind, ref }, extra || {}));
}
export function buildSolids() {
  Solids.list.length = 0;
  for (const b of BUILDINGS) addSolid(b.x, b.z, b.w, b.d, 'building', b);
  for (const k of KIOSKS) addSolid(k.x, k.z, k.w, k.d, 'kiosk', k, { fragile: true });
  for (const p of PROPS) {
    if (p.kind === 'fence') addSolid(p.x, p.z - 0.2, p.len || 12, 0.4, 'fence', p, { fragile: true });
    else if (p.kind === 'block') addSolid(p.x - 1.4, p.z - 0.9, 2.8, 1.8, 'prop', p);
    else if (p.kind === 'sandbox') addSolid(p.x - 2.9, p.z - 1.9, 5.8, 3.8, 'soft', p, { soft: true });
    else if (p.kind === 'carcass') addSolid(p.x - 2.5, p.z - 1.2, 5, 2.4, 'prop', p);
    else if (p.kind === 'tree') {
      const s = TREE_SP[treeSpecies(p.x, p.z, p)].solid;
      addSolid(p.x - s / 2, p.z - s / 2, s, s, 'prop', p);
    }
    else if (p.kind === 'bush') addSolid(p.x - 0.6, p.z - 0.6, 1.2, 1.2, 'soft', p, { soft: true });
    else if (p.kind === 'hedge') {
      const L = p.len || 6, along = Math.abs(Math.cos(p.a || 0)) > 0.5;
      const w = along ? L : 0.8, d = along ? 0.8 : L;
      addSolid(p.x - w / 2, p.z - d / 2, w, d, 'soft', p, { soft: true });
    }
    else if (p.kind === 'flowerbed') {
      const w = (p.w || 2.6) + 0.4, d = (p.d || 1.5) + 0.4;
      addSolid(p.x - w / 2, p.z - d / 2, w, d, 'soft', p, { soft: true });
    }
    else if (p.kind === 'pipe') addSolid(p.x - 2.8, p.z - 0.7, 5.6, 1.4, 'prop', p);
    else if (p.kind === 'barrel') addSolid(p.x - 0.45, p.z - 0.45, 0.9, 0.9, 'prop', p, { fragile: true });
    else if (p.kind === 'bin') addSolid(p.x - 0.6, p.z - 0.45, 1.2, 0.9, 'prop', p, { fragile: true });
    else if (p.kind === 'bench') addSolid(p.x - 1, p.z - 0.35, 2, 0.7, 'prop', p);
    else if (p.kind === 'carousel') addSolid(p.x - 1.5, p.z - 1.5, 3, 3, 'prop', p);
  }
  for (const p of POLES) addSolid(p.x - 0.28, p.z - 0.28, 0.56, 0.56, 'pole', p);
  const T = 4;
  addSolid(-T, -T, W.x + T * 2, T, 'edge'); addSolid(-T, W.z, W.x + T * 2, T, 'edge');
  addSolid(-T, 0, T, W.z, 'edge'); addSolid(W.x, 0, T, W.z, 'edge');

  Solids.cols = Math.ceil(W.x / Solids.cell) + 2;
  Solids.rows = Math.ceil(W.z / Solids.cell) + 2;
  Solids.grid = new Array(Solids.cols * Solids.rows);
  for (let i = 0; i < Solids.grid.length; i++) Solids.grid[i] = [];
  for (const s of Solids.list) {
    const x0 = Math.max(0, Math.floor((s.x + Solids.cell) / Solids.cell));
    const x1 = Math.min(Solids.cols - 1, Math.floor((s.x + s.w + Solids.cell) / Solids.cell));
    const z0 = Math.max(0, Math.floor((s.z + Solids.cell) / Solids.cell));
    const z1 = Math.min(Solids.rows - 1, Math.floor((s.z + s.d + Solids.cell) / Solids.cell));
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) Solids.grid[gz * Solids.cols + gx].push(s);
  }
}
export function solidsNear(x, z, r) {
  const out = [], c = Solids.cell;
  const x0 = Math.max(0, Math.floor((x - r + c) / c)), x1 = Math.min(Solids.cols - 1, Math.floor((x + r + c) / c));
  const z0 = Math.max(0, Math.floor((z - r + c) / c)), z1 = Math.min(Solids.rows - 1, Math.floor((z + r + c) / c));
  for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
    const arr = Solids.grid[gz * Solids.cols + gx];
    for (const s of arr) if (out.indexOf(s) < 0) out.push(s);
  }
  return out;
}
export function circleRect(cx, cz, r, s) {
  const nx = clamp(cx, s.x, s.x + s.w), nz = clamp(cz, s.z, s.z + s.d);
  const dx = cx - nx, dz = cz - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return null;
  const d = Math.sqrt(d2);
  if (d < 0.0001) {
    const left = cx - s.x, right = s.x + s.w - cx, top = cz - s.z, bot = s.z + s.d - cz;
    const m = Math.min(left, right, top, bot);
    if (m === left) return { nx: -1, nz: 0, push: left + r };
    if (m === right) return { nx: 1, nz: 0, push: right + r };
    if (m === top) return { nx: 0, nz: -1, push: top + r };
    return { nx: 0, nz: 1, push: bot + r };
  }
  return { nx: dx / d, nz: dz / d, push: r - d };
}
export function freeSpot(x, z, r) {
  for (const s of solidsNear(x, z, r + 1)) if (circleRect(x, z, r, s)) return false;
  return true;
}
