/* =====================================================================
   props.js — реквизит района из моделей Poly Haven (CC0): фонари,
   электрощитки, камеры видеонаблюдения, кондиционеры, скамейки, бочки,
   сорняки. Каждая модель грузится один раз, дальше ставятся её копии
   (InstancedMesh) — одна отрисовка на все копии сразу.

   Модули-наборы (опоры ЛЭП, сетка-рабица, водостоки) приходят «россыпью»:
   в одном файле десятки деталей рядом. Нужные детали выбираются по имени
   узла и центрируются по своим габаритам.
   ===================================================================== */
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Batch, rng } from './geo.js';
import '@babylonjs/loaders/glTF';
import { glbSource } from './source.js';

export class PropLib {
  constructor(scene, base, shadows) {
    this.scene = scene; this.base = base; this.shadows = shadows;
    this.loading = new Map(); this.catalog = null;
  }
  async init() { this.catalog = await (await fetch(this.base + 'props/catalog.json')).json(); }
  load(id) {
    if (!this.loading.has(id)) this.loading.set(id, (async () => {
      const c = await LoadAssetContainerAsync(await glbSource(this.base + 'props/' + id + '.glb'), this.scene, { pluginExtension: '.glb' });
      c.addAllToScene();
      const parts = [];
      for (const m of c.meshes) {
        if (!m.getTotalVertices || m.getTotalVertices() === 0) continue;
        m.computeWorldMatrix(true);
        m.isVisible = false; m.isPickable = false; m.receiveShadows = true;
        if (m.material) { m.material.freeze?.(); }
        /* имя детали — у glTF-узла; у примитива суффикс _primitiveN */
        const name = (m.parent && !/^__root__$/.test(m.parent.name) && m.name.includes('_primitive') ? m.parent.name : m.name).replace(/_primitive\d+$/, '');
        const wm = m.getWorldMatrix().clone();
        const bb = m.getBoundingInfo().boundingBox;
        parts.push({ mesh: m, name, wm, min: bb.minimumWorld.clone(), max: bb.maximumWorld.clone() });
      }
      if (this.shadows) for (const p of parts) this.shadows.addShadowCaster(p.mesh, false);
      return { container: c, parts };
    })());
    return this.loading.get(id);
  }
  /* поставить копию: nodes — список имён деталей (или все), center — сдвинуть
     так, чтобы центр выбранного по x/z и низ по y пришлись в точку */
  async place(id, o = {}) {
    const P = await this.load(id);
    const want = o.nodes ? (n => o.nodes.some(k => n === k || n.startsWith(k + '.'))) : () => true;
    const sel = P.parts.filter(p => want(p.name));
    if (!sel.length) { console.warn('нет деталей', id, o.nodes); return null; }
    const root = new TransformNode(id, this.scene);
    root.rotationQuaternion = null;
    /* дальше этого расстояния деталь не рисуется (для мелочи и травы) */
    if (o.cull) for (const p of sel) if (!p.culled) { p.mesh.addLODLevel(o.cull, null); p.culled = true; }
    let off = Vector3.Zero();
    if (o.center !== false) {
      const mn = new Vector3(Infinity, Infinity, Infinity), mx = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const p of sel) { mn.minimizeInPlace(p.min); mx.maximizeInPlace(p.max); }
      off = new Vector3((mn.x + mx.x) / 2, o.keepY ? 0 : mn.y, (mn.z + mx.z) / 2);
    }
    for (const p of sel) {
      const inst = p.mesh.createInstance(id + '_i');
      inst.parent = root;
      const s = new Vector3(), q = new Quaternion(), t = new Vector3();
      p.wm.decompose(s, q, t);
      inst.scaling.copyFrom(s); inst.rotationQuaternion = q; inst.position.copyFrom(t.subtract(off));
      inst.isPickable = false;
      if (this.shadows && o.shadow !== false) this.shadows.addShadowCaster(inst, false);
    }
    root.position.set(o.x || 0, o.y || 0, o.z || 0);
    root.rotation.set(o.pitch || 0, o.yaw || 0, o.roll || 0);
    if (o.scale) root.scaling.setAll(o.scale);
    if (o.freeze !== false) { root.computeWorldMatrix(true); for (const c of root.getChildMeshes()) c.freezeWorldMatrix(); root.freezeWorldMatrix(); }
    return root;
  }
}

/* ------------------------------------------------------------------ */
/* Столбы: опоры со светильником «кобра», перекладины с изоляторами и
   провода между опорами вдоль улиц — без них русская улица не читается. */
export async function buildPoles(scene, lib, mats, POLES, surfY, shadows) {
  const wires = new Batch('wires');
  const wood = mats.surface('tree_bark_03', { tile: 1.2, name: 'poleWood', tint: [0.55, 0.5, 0.45] });
  const conc = mats.surface('concrete_floor_worn_001', { tile: 1.5, name: 'poleConcrete', tint: [0.8, 0.8, 0.78] });
  const cable = mats.color('cable', [0.04, 0.04, 0.045], 0.6, 0);
  const poleB = new Batch('poleShafts'), woodB = new Batch('poleWood');
  const tops = [];
  for (const p of POLES) {
    const y0 = surfY(p.x, p.z);
    const H = p.lamp ? 8.2 : 6.6;
    /* железобетонная опора: сужение к верху */
    poleB.tube([[p.x, y0 - 0.2, p.z], [p.x, y0 + H, p.z]], [0.14, 0.09], 10, { uvScale: 0.5 });
    /* перекладина с изоляторами */
    const yaw = p.lamp ? 0 : Math.PI / 2;
    await lib.place('modular_electricity_poles', { nodes: ['support_large_01'], x: p.x, y: y0 + H - 0.9, z: p.z, yaw, shadow: false, cull: 140 });
    await lib.place('modular_electricity_poles', { nodes: ['insulators_large'], x: p.x, y: y0 + H - 0.62, z: p.z, yaw, shadow: false, cull: 90 });
    if (p.lamp) {
      /* кронштейн к дороге и светильник */
      const dir = lampDir(p);
      const ax = p.x + dir[0] * 1.45, az = p.z + dir[1] * 1.45;
      poleB.tube([[p.x, y0 + H - 0.5, p.z], [p.x + dir[0] * 0.8, y0 + H - 0.2, p.z + dir[1] * 0.8], [ax, y0 + H - 0.28, az]], 0.035, 6);
      await lib.place('security_light', { x: ax, y: y0 + H - 0.62, z: az, yaw: Math.atan2(dir[0], dir[1]), shadow: false, cull: 160 });
    }
    tops.push({ p, x: p.x, z: p.z, y: y0 + H - 0.72 });
  }
  /* провода: соединяем соседние опоры вдоль одной улицы, с провисом */
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
    const a = tops[i], b = tops[j];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    const aligned = Math.abs(a.x - b.x) < 0.8 || Math.abs(a.z - b.z) < 0.8;
    if (!aligned || d > 60 || d < 6) continue;
    for (const off of [-0.55, 0, 0.55]) {
      const pts = [];
      const nx = (b.z - a.z) / d, nz = -(b.x - a.x) / d;
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, sag = 4 * t * (1 - t) * (0.35 + d * 0.012);
        pts.push([a.x + (b.x - a.x) * t + nx * off, a.y + (b.y - a.y) * t - sag, a.z + (b.z - a.z) * t + nz * off]);
      }
      wires.tube(pts, 0.009, 4);
    }
  }
  const out = [poleB.build(scene, conc), woodB.build(scene, wood), wires.build(scene, cable)].filter(Boolean);
  for (const m of out) if (shadows) shadows.addShadowCaster(m, false);
  return out;
}
function lampDir(p) {
  /* светильник смотрит на ближайшую проезжую часть */
  const roadsX = [25, 100, 175], roadsZ = [18.75, 75, 131.25];
  let best = [0, 1], bd = Infinity;
  for (const r of roadsX) { const d = Math.abs(p.x - r); if (d < bd) { bd = d; best = [Math.sign(r - p.x) || 1, 0]; } }
  for (const r of roadsZ) { const d = Math.abs(p.z - r); if (d < bd) { bd = d; best = [0, Math.sign(r - p.z) || 1]; } }
  return best;
}

/* ------------------------------------------------------------------ */
/* Двор конторы: всё, чем живёт двор монтажной бригады. Координаты — в
   метрах района, контора стоит на x 2.5…15.7, z 38.7…48.1, дверь на юг. */
export const YARD = {
  bench: [{ x: 13.4, z: 48.95, yaw: 0 }],
  chairs: [{ x: 4.7, z: 52.9, yaw: 0.6 }, { x: 6.1, z: 53.5, yaw: -0.4 }],
  crate: [{ x: 5.4, z: 53.4, yaw: 0.2 }],
  tyres: [{ x: 3.4, z: 50.2 }, { x: 4.3, z: 50.4 }],
  trash: [{ x: 6.9, z: 49.0 }],
  boxes: [{ x: 7.6, z: 48.95, yaw: 0.3 }, { x: 7.9, z: 49.2, yaw: -0.2, y: 0.33 }],
  plastic: [{ x: 15.25, z: 48.6 }, { x: 15.3, z: 48.62, y: 0.26 }],
  ladder: [{ x: 16.05, z: 44.2 }],
  toolbox: [{ x: 13.0, z: 49.0, y: 0.47 }],
  coveredCar: [{ x: 8.2, z: 35.4, yaw: Math.PI / 2 }],
  manhole: [{ x: 6.2, z: 45.3 }]
};

export async function buildYard(scene, lib, anchors, surfY) {
  const Y = (x, z) => surfY(x, z);
  const jobs = [];
  for (const c of YARD.chairs) jobs.push(lib.place('plastic_monobloc_chair_01', { x: c.x, y: Y(c.x, c.z), z: c.z, yaw: c.yaw }));
  for (const c of YARD.crate) jobs.push(lib.place('wooden_crate_01', { nodes: ['wooden_crate_01', 'wooden_crate_01_lid', 'wooden_crate_01_latch'], x: c.x, y: Y(c.x, c.z), z: c.z, yaw: c.yaw, scale: 1.2 }));
  for (const t of YARD.tyres) jobs.push(lib.place('old_tyre', { x: t.x, y: Y(t.x, t.z) + 0.02, z: t.z, pitch: Math.PI / 2 }));
  for (const t of YARD.trash) jobs.push(lib.place('metal_trash_can', { nodes: ['metal_trash_can_rust', 'metal_trash_can_rust_lid', 'metal_trash_can_rust_handle_left', 'metal_trash_can_rust_handle_right'], x: t.x, y: Y(t.x, t.z), z: t.z, yaw: 0.4 }));
  for (const b of YARD.boxes) jobs.push(lib.place('cardboard_box_01', { x: b.x, y: Y(b.x, b.z) + (b.y || 0), z: b.z, yaw: b.yaw }));
  for (const b of YARD.plastic) jobs.push(lib.place('plastic_crate_01', { x: b.x, y: Y(b.x, b.z) + (b.y || 0), z: b.z, yaw: 0.1 }));
  for (const l of YARD.ladder) jobs.push(lib.place('ladder_sectioned_01', { x: l.x, y: Y(l.x, l.z), z: l.z, yaw: Math.PI / 2, pitch: 0 }).then(n => { if (n) { n.unfreezeWorldMatrix(); n.rotation.z = -0.28; n.position.x += 0.25; n.freezeWorldMatrix(); } }));
  for (const t of YARD.toolbox) jobs.push(lib.place('metal_toolbox', { x: t.x, y: Y(t.x, t.z) + t.y, z: t.z, yaw: 0.25 }));
  for (const c of YARD.coveredCar) jobs.push(lib.place('covered_car', { x: c.x, y: Y(c.x, c.z), z: c.z, yaw: c.yaw }));
  for (const m of YARD.manhole) jobs.push(lib.place('water_manhole_cover', { nodes: ['water_manhole_cover'], x: m.x, y: Y(m.x, m.z) + 0.005, z: m.z }));
  /* навесное на фасадах: кондиционеры, камеры, свет над дверью, щиток */
  for (const a of anchors.ac) {
    const yaw = Math.atan2(a.n[0], a.n[2]);
    const rusted = (Math.round(a.p[0] * 7 + a.p[2] * 3) % 3) === 0;
    jobs.push(lib.place('exterior_aircon_unit', { nodes: [rusted ? 'exterior_aircon_unit_rusted' : 'exterior_aircon_unit'], x: a.p[0] + a.n[0] * 0.2, y: a.p[1], z: a.p[2] + a.n[2] * 0.2, yaw, scale: 0.9 }));
  }
  for (const a of anchors.camera) {
    const yaw = Math.atan2(a.n[0], a.n[2]) + (a.yawOff || 0);
    jobs.push(lib.place('security_camera_02', { x: a.p[0], y: a.p[1], z: a.p[2], yaw, keepY: true, pitch: 0.25 }));
  }
  for (const a of anchors.lamp) jobs.push(lib.place('security_light', { x: a.p[0] + a.n[0] * 0.22, y: a.p[1], z: a.p[2] + a.n[2] * 0.22, yaw: Math.atan2(a.n[0], a.n[2]), keepY: true }));
  for (const a of anchors.box) jobs.push(lib.place('utility_box_02', { x: a.p[0] + a.n[0] * 0.22, y: 0.186, z: a.p[2] + a.n[2] * 0.22, yaw: Math.atan2(a.n[0], a.n[2]) }));
  await Promise.all(jobs);
}

/* сетка-рабица по западной границе двора */
export async function buildFence(lib, x, z0, z1, surfY) {
  const jobs = [];
  let k = 0;
  for (let z = z0; z < z1 - 0.9; z += 0.93, k++) {
    jobs.push(lib.place('modular_chainlink_fence', { nodes: ['modular_chainlink_fence'], x, y: surfY(x, z), z: z + 0.465, yaw: Math.PI / 2, cull: 70 }));
    if (k % 2 === 0) jobs.push(lib.place('modular_chainlink_fence', { nodes: ['modular_chainlink_fence_post'], x, y: surfY(x, z), z, yaw: 0, cull: 70 }));
  }
  await Promise.all(jobs);
}

/* сорняки и трава по двору: вдоль отмосток, у гаражей и заборов, где не ходят */
export async function scatterWeeds(lib, surfY, isFree, seed, area, count) {
  const R = rng(seed);
  /* только лёгкие варианты: у одуванчика есть кусты по 23 тысячи треугольников */
  const kinds = [
    ['grass_medium_02', ['grass_medium_02_a', 'grass_medium_02_c', 'grass_medium_02_e'], 0.3],
    ['grass_medium_01', ['grass_medium_01_tall_a_LOD0', 'grass_medium_01_tall_b_LOD0', 'grass_medium_01_tall_c_LOD0', 'grass_medium_01_mid_b_LOD0', 'grass_medium_01_small_a_LOD0'], 0.3],
    ['weed_plant_02', ['weed_plant_02_b_LOD0', 'weed_plant_02_c_LOD0', 'weed_plant_02_d_LOD0'], 0.12],
    ['dandelion_01', ['dandelion_01_c_LOD0', 'dandelion_01_d_LOD0', 'dandelion_01_e_LOD0'], 0.12],
    ['celandine_01', ['celandine_01_a_LOD0', 'celandine_01_b_LOD0', 'celandine_01_e_LOD0'], 0.08]
  ];
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const x = area[0] + R() * (area[2] - area[0]), z = area[1] + R() * (area[3] - area[1]);
    if (!isFree(x, z)) continue;
    let r = R(), k = kinds[0];
    for (const c of kinds) { if (r < c[2]) { k = c; break; } r -= c[2]; }
    const nodes = k[1] ? [k[1][Math.floor(R() * k[1].length)]] : null;
    jobs.push(lib.place(k[0], { nodes, x, y: surfY(x, z), z, yaw: R() * 6.28, scale: 0.8 + R() * 0.5, shadow: false, cull: 42 }));
  }
  await Promise.all(jobs);
}
void Matrix;
