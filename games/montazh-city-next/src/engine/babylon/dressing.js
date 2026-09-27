/* =====================================================================
   dressing.js — мелкая обстановка района из данных старой игры (PROPS):
   лавки, урны, кусты и живые изгороди, клумбы-покрышки, доски объявлений,
   бетонные блоки, бочки, поддоны, кабельные барабаны, конусы, детская
   площадка, памятник у вокзала. Что есть на Poly Haven — ставится моделью,
   остальное строится кодом из простых форм с нормальными материалами.
   Позиции те же, что у старой логики: столкновения с ними уже посчитаны.
   ===================================================================== */
import { Batch, rng } from './geo.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

export async function buildDressing(scene, mats, lib, PROPS, surfY, shadows) {
  const M = {
    wood: mats.color('benchWood', [0.3, 0.18, 0.1], 0.62, 0),
    paintG: mats.color('benchPaint', [0.1, 0.24, 0.15], 0.5, 0),
    iron: mats.color('castIron', [0.08, 0.08, 0.085], 0.55, 0.7),
    conc: mats.surface('concrete_floor_worn_001', { tile: 1.2, name: 'dressConcrete', tint: [0.85, 0.84, 0.8] }),
    rust: mats.surface('green_metal_rust', { tile: 1, name: 'dressRust', tint: [0.9, 0.6, 0.45] }),
    pallet: mats.color('palletWood', [0.52, 0.4, 0.28], 0.85, 0),
    cone: mats.color('coneOrange', [0.95, 0.32, 0.05], 0.5, 0),
    white: mats.color('coneWhite', [0.9, 0.9, 0.88], 0.5, 0),
    sand: mats.color('sand', [0.62, 0.52, 0.36], 0.95, 0),
    toy: mats.color('toyPaint', [0.75, 0.2, 0.16], 0.45, 0.2),
    toy2: mats.color('toyPaint2', [0.9, 0.7, 0.12], 0.45, 0.2)
  };
  const B = {};
  const get = k => B[k] || (B[k] = new Batch(k));
  const jobs = [];
  const R = rng(9090);
  const rot = (x, z, a, lx, lz) => [x + lx * Math.cos(a) + lz * Math.sin(a), z - lx * Math.sin(a) + lz * Math.cos(a)];
  for (const p of PROPS) {
    const y = surfY(p.x, p.z), a = p.a || 0;
    switch (p.kind) {
      case 'bench': {
        /* советская лавка: чугунные боковины, брусья сиденья и спинки */
        for (const s of [-0.85, 0.85]) {
          const [x, z] = rot(p.x, p.z, a, s, 0);
          get('iron').box(x, y, z, 0.06, 0.45, 0.5, a, { uvScale: 1 });
          const [xb, zb] = rot(p.x, p.z, a, s, -0.26);
          get('iron').box(xb, y + 0.42, zb, 0.06, 0.5, 0.06, a, { uvScale: 1 });
        }
        for (let i = 0; i < 4; i++) { const [x, z] = rot(p.x, p.z, a, 0, -0.18 + i * 0.13); get('paintG').box(x, y + 0.43, z, 1.9, 0.035, 0.1, a, { uvScale: 1 }); }
        for (let i = 0; i < 3; i++) { const [x, z] = rot(p.x, p.z, a, 0, -0.27); get('paintG').box(x, y + 0.56 + i * 0.12, z, 1.9, 0.09, 0.03, a, { uvScale: 1 }); }
        break;
      }
      case 'bin': jobs.push(lib.place('metal_trash_can', { nodes: ['metal_trash_can', 'metal_trash_can_lid', 'metal_trash_can_handle_left', 'metal_trash_can_handle_right'], x: p.x, y, z: p.z, yaw: R() * 6.28, cull: 90 })); break;
      case 'bush': jobs.push(lib.place('shrub_02', { nodes: ['shrub_02_' + 'abcd'[Math.floor(R() * 4)]], x: p.x, y, z: p.z, yaw: R() * 6.28, scale: 1.1 + R() * 0.4, cull: 90 })); break;
      case 'hedge': {
        const n = Math.max(2, Math.round(p.len / 1.3));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5, [x, z] = rot(p.x, p.z, a, t * p.len, 0);
          jobs.push(lib.place('shrub_02', { nodes: ['shrub_02_' + 'abcd'[i % 4]], x, y, z, yaw: R() * 6.28, scale: 0.9 + R() * 0.25, cull: 80 }));
        }
        break;
      }
      case 'flowerbed':
        jobs.push(lib.place('old_tyre', { x: p.x, y: y + 0.02, z: p.z, pitch: Math.PI / 2, scale: 1.15, cull: 70 }));
        jobs.push(lib.place('celandine_01', { nodes: ['celandine_01_c_LOD0'], x: p.x, y: y + 0.05, z: p.z, scale: 0.8, shadow: false, cull: 45 }));
        break;
      case 'board': {
        /* доска объявлений на двух столбиках, с надписью */
        for (const s of [-0.8, 0.8]) { const [x, z] = rot(p.x, p.z, a, s, 0); get('iron').box(x, y, z, 0.06, 2.0, 0.06, a, { uvScale: 1 }); }
        get('wood').box(p.x, y + 1.0, p.z, 1.8, 1.0, 0.05, a, { uvScale: 1 });
        if (p.t) signBoard(scene, p, y, a);
        break;
      }
      case 'carcass': jobs.push(lib.place('covered_car', { x: p.x, y, z: p.z, yaw: R() * 6.28, cull: 120 })); break;
      case 'pipe': {
        /* бетонное кольцо колодца на боку */
        const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2; pts.push([p.x + Math.cos(t) * 0.7, y + 0.72 + Math.sin(t) * 0.7, p.z]); }
        get('conc').tube(pts, 0.1, 8, { uvScale: 1 });
        break;
      }
      case 'block': jobs.push(lib.place('concrete_road_barrier', { x: p.x, y, z: p.z, yaw: R() * 0.6, cull: 110 })); break;
      case 'barrel': get('rust').cylinder(p.x, y, p.z, 0.3, 0.88, 14, { uvScale: 1 }); break;
      case 'pallet': {
        const yaw = R() * 3;
        for (let i = 0; i < 3; i++) { const [x, z] = rot(p.x, p.z, yaw, 0, -0.5 + i * 0.5); get('pallet').box(x, y, z, 1.2, 0.1, 0.1, yaw, { uvScale: 1 }); }
        for (let i = 0; i < 5; i++) { const [x, z] = rot(p.x, p.z, yaw, -0.55 + i * 0.275, 0); get('pallet').box(x, y + 0.1, z, 0.12, 0.025, 1.1, yaw, { uvScale: 1 }); }
        break;
      }
      case 'coil': {
        /* кабельный барабан: две щеки и бухта кабеля */
        for (const s of [-0.35, 0.35]) { const ring = []; for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2; ring.push([p.x + s, y + 0.62 + Math.sin(t) * 0.55, p.z + Math.cos(t) * 0.55]); } get('pallet').tube(ring, 0.05, 6); }
        get('iron').tube([[p.x - 0.32, y + 0.62, p.z], [p.x + 0.32, y + 0.62, p.z]], 0.38, 16);
        break;
      }
      case 'fence': {
        const n = Math.round(p.len / 0.93);
        for (let i = 0; i < n; i++) { const [x, z] = rot(p.x, p.z, a, -p.len / 2 + (i + 0.5) * 0.93, 0); jobs.push(lib.place('modular_chainlink_fence', { nodes: ['modular_chainlink_fence'], x, y, z, yaw: a, cull: 90 })); }
        break;
      }
      case 'cone':
        get('cone').tube([[p.x, y + 0.03, p.z], [p.x, y + 0.7, p.z]], [0.16, 0.02], 12);
        get('white').tube([[p.x, y + 0.35, p.z], [p.x, y + 0.47, p.z]], [0.1, 0.075], 12, { cap: false });
        get('cone').box(p.x, y, p.z, 0.38, 0.03, 0.38, 0);
        break;
      case 'monument':
        get('conc').box(p.x, y, p.z, 1.6, 1.4, 1.6, 0, { uvScale: 1 });
        get('iron').box(p.x, y + 1.4, p.z, 0.7, 1.8, 0.5, 0.3, { uvScale: 1 });
        break;
      case 'sandbox':
        for (const [dx, dz, w, d] of [[0, -1.5, 3.2, 0.12], [0, 1.5, 3.2, 0.12], [-1.5, 0, 0.12, 3.2], [1.5, 0, 0.12, 3.2]]) get('pallet').box(p.x + dx, y, p.z + dz, w, 0.3, d, 0, { uvScale: 1 });
        get('sand').box(p.x, y, p.z, 2.9, 0.18, 2.9, 0, { uvScale: 1, faces: 't' });
        break;
      case 'swing':
        for (const s of [-1.2, 1.2]) { get('toy').tube([[p.x + s, y, p.z - 0.8], [p.x + s, y + 2.2, p.z], [p.x + s, y, p.z + 0.8]], 0.05, 8); }
        get('toy').tube([[p.x - 1.2, y + 2.2, p.z], [p.x + 1.2, y + 2.2, p.z]], 0.05, 8);
        for (const s of [-0.25, 0.25]) get('iron').tube([[p.x + s, y + 2.2, p.z], [p.x + s, y + 0.5, p.z]], 0.012, 4);
        get('toy2').box(p.x, y + 0.45, p.z, 0.6, 0.05, 0.3, 0, { uvScale: 1 });
        break;
      case 'carousel':
        get('toy2').cylinder(p.x, y + 0.25, p.z, 1.1, 0.08, 20);
        get('iron').cylinder(p.x, y, p.z, 0.08, 0.3, 8);
        for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI * 2; get('toy').tube([[p.x + Math.cos(t) * 0.95, y + 0.33, p.z + Math.sin(t) * 0.95], [p.x + Math.cos(t) * 0.5, y + 0.95, p.z + Math.sin(t) * 0.5], [p.x, y + 1.0, p.z]], 0.035, 6); }
        break;
    }
  }
  const out = [];
  for (const [k, b] of Object.entries(B)) {
    const m = b.build(scene, M[k], { name: 'dress_' + k });
    if (m) { out.push(m); if (shadows) shadows.addShadowCaster(m, false); }
  }
  await Promise.all(jobs);
  return out;
}

function signBoard(scene, p, y, a) {
  const dt = new DynamicTexture('board_' + p.t, { width: 512, height: 288 }, scene, true);
  const c = dt.getContext();
  c.fillStyle = '#d8d2c0'; c.fillRect(0, 0, 512, 288);
  c.fillStyle = '#20283a'; c.font = '900 34px Arial, sans-serif'; c.textAlign = 'center';
  c.fillText(p.t, 256, 70);
  c.font = '22px Arial, sans-serif'; c.fillStyle = '#39404e';
  for (let i = 0; i < 5; i++) c.fillRect(60 + (i % 2) * 20, 110 + i * 30, 392 - (i % 3) * 40, 6);
  dt.update(true);
  const m = new PBRMaterial('boardMat_' + p.t, scene);
  m.albedoTexture = dt; m.metallic = 0; m.roughness = 0.8;
  const b = new Batch('boardFace');
  const u = [Math.cos(a), 0, -Math.sin(a)], n = [Math.sin(a), 0, Math.cos(a)];
  const o = [p.x - u[0] * 0.85 + n[0] * 0.03, y + 1.05, p.z - u[2] * 0.85 + n[2] * 0.03];
  b.rect(o, u, [0, 1, 0], 1.7, 0.9, [0, 0], 1);
  b.uv = [0, 0, 1, 0, 1, 1, 0, 1];
  b.build(scene, m, { name: 'boardFace' });
  void Color3;
}
