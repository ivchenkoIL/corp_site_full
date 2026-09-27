/* =====================================================================
   distance.js — даль за районом: лесополосы по краям и силуэты чужих
   микрорайонов у горизонта. Без них район кончался ровной коричневой
   плоскостью, а в тумане и на фоне неба это сразу выдавало декорацию.
   ===================================================================== */
import { Batch, rng } from './geo.js';

export function buildDistance(scene, mats, W, ROADS_X, ROADS_Z, treeTemplates, shadows) {
  const R = rng(20260927);
  const onRoad = (x, z) => ROADS_X.some(r => Math.abs(x - r) < 9) || ROADS_Z.some(r => Math.abs(z - r) < 9);
  /* лесополосы: пояс 12–110 м вокруг района, кучками */
  const kinds = ['poplar', 'birch', 'maple', 'spruce', 'birch', 'poplar'];
  let n = 0;
  for (let i = 0; i < 520; i++) {
    const side = Math.floor(R() * 4), d = 12 + Math.pow(R(), 1.6) * 100, t = -40 + R() * (Math.max(W.x, W.z) + 80);
    let x, z;
    if (side === 0) { x = t; z = -d; } else if (side === 1) { x = t; z = W.z + d; } else if (side === 2) { x = -d; z = t; } else { x = W.x + d; z = t; }
    if (onRoad(x, z) || x > W.x + 120 || z > W.z + 120) continue;
    const sp = kinds[Math.floor(R() * kinds.length)];
    const tpl = treeTemplates[sp][n % 3];
    const s = 0.9 + R() * 0.5, yaw = R() * 6.28;
    for (const src of [tpl.tm, tpl.lm]) {
      const inst = src.createInstance(src.name + '_far' + n);
      inst.position.set(x, -0.05, z); inst.rotation.y = yaw; inst.scaling.setAll(s);
      inst.isPickable = false; inst.freezeWorldMatrix();
    }
    n++;
  }
  /* силуэты: панельные дома за полями, 250–480 м от центра */
  const wall = mats.surface('concrete_wall_006', { tile: 6, name: 'farPanel', tint: [0.78, 0.8, 0.84] });
  const b = new Batch('farBlocks');
  const cx = W.x / 2, cz = W.z / 2;
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, r = 250 + R() * 230;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (onRoad(x, z)) continue;
    const w = 14 + R() * 60, d = 11 + R() * 4, h = 15 + Math.floor(R() * 3) * 12 + R() * 6;
    b.box(x, 0, z, w, h, d, a + Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI / 2), { uvScale: 1 });
  }
  const m = b.build(scene, wall);
  return { trees: n, blocks: m };
}
