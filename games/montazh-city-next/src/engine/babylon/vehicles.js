/* =====================================================================
   vehicles.js — машины района и велосипед Олега.

   Машина — «семёрка» из генератора (tools/assets/build-car.mjs): кузов
   и четыре колеса отдельными узлами. Цвет задаётся маской краски: шейдер
   PBR получает вставку (плагин материала), которая перекрашивает эмаль в
   цвет машины и не трогает хром, стекло и резину.

   Велосипед собирается кодом: рама трубами, колёса со спицами, шатуны
   с педалями, руль. Так у него честно крутятся колёса и педали, а руль
   доворачивается — и те же точки (седло, грипсы, педали) нужны позе Олега.
   ===================================================================== */
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Batch } from './geo.js';
import '@babylonjs/loaders/glTF';
import { glbSource } from './source.js';

/* --- краска по маске ---------------------------------------------------- */
class PaintPlugin extends MaterialPluginBase {
  constructor(material, mask, color) {
    super(material, 'McPaint', 200, { MC_PAINT: false });
    this.mask = mask; this.color = color;
    this._enable(true);
  }
  prepareDefines(defines) { defines.MC_PAINT = true; }
  getClassName() { return 'McPaintPlugin'; }
  getSamplers(samplers) { samplers.push('mcPaintMask'); }
  getUniforms() { return { ubo: [{ name: 'mcPaintColor', size: 3, type: 'vec3' }], fragment: '#ifdef MC_PAINT\nuniform vec3 mcPaintColor;\n#endif' }; }
  bindForSubMesh(ubo) { ubo.updateColor3('mcPaintColor', this.color); ubo.setTexture('mcPaintMask', this.mask); }
  getCustomCode(type) {
    if (type !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: '#ifdef MC_PAINT\nuniform sampler2D mcPaintMask;\n#endif',
      CUSTOM_FRAGMENT_UPDATE_ALBEDO: `#ifdef MC_PAINT
        float mcM = texture2D(mcPaintMask, vAlbedoUV).r;
        float mcL = dot(surfaceAlbedo, vec3(0.3, 0.59, 0.11));
        surfaceAlbedo = mix(surfaceAlbedo, mcPaintColor * min(1.35, mcL * 1.55), mcM);
      #endif`
    };
  }
}

export class CarModel {
  static async load(scene, url, metaUrl, maskUrl) {
    const m = new CarModel();
    m.container = await LoadAssetContainerAsync(await glbSource(url), scene, { pluginExtension: '.glb' });
    m.meta = await (await fetch(metaUrl)).json();
    m.mask = new Texture(maskUrl, scene, { noMipmap: false, invertY: false });
    m.mats = new Map();
    return m;
  }
  material(tint) {
    const key = tint.join(',');
    if (this.mats.has(key)) return this.mats.get(key);
    const base = this.container.materials[0];
    const mat = base.clone('lada_' + key);
    new PaintPlugin(mat, this.mask, new Color3(...tint));
    this.mats.set(key, mat);
    return mat;
  }
}

export class Car {
  constructor(scene, model, tint, shadows) {
    const inst = model.container.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    this.root = new TransformNode('car', scene);
    this.root.rotationQuaternion = null;
    for (const r of inst.rootNodes) r.parent = this.root;
    const mat = model.material(tint);
    this.wheels = [];
    for (const r of inst.rootNodes) for (const n of [r, ...r.getDescendants(false)]) {
      if (n.material) n.material = mat;
      if (/^wheel_/.test(n.name)) { n.rotationQuaternion = null; this.wheels.push(n); }
      if (n.getTotalVertices && n.getTotalVertices() > 0) { n.isPickable = false; n.receiveShadows = true; if (shadows) shadows.addShadowCaster(n, false); }
    }
    this.r = model.meta.wheels[0].r;
    const all = inst.rootNodes.flatMap(r => [r, ...r.getDescendants(false)]);
    const body = all.find(n => n.name === 'body'), lod = all.find(n => n.name === 'body_lod1');
    if (body && lod) body.addLODLevel(28, lod);
  }
  update(c, y) {
    this.root.position.set(c.x, y, c.z);
    this.root.rotation.y = c.yaw;
    /* колесо: путь / радиус; в старой логике c.wheel уже копит путь */
    const a = (c.wheel || 0) / this.r;
    for (const w of this.wheels) w.rotation.x = a;
  }
  setVisible(v) { this.root.setEnabled(v); }
}

/* --- велосипед ------------------------------------------------------------ */
/* Размеры под Олега (tools/assets/rig-character.mjs даёт длину ног): 24",
   рама невысокая, руль «городской» — высоко и близко. Оси: x вправо,
   y вверх, z вперёд, ноль — точка касания земли под кареткой. */
export const BIKE = {
  wheelR: 0.31, rear: [0, 0.31, -0.5], front: [0, 0.31, 0.52], bb: [0, 0.29, -0.02], crank: 0.16,
  seatTop: [0, 0.8, -0.24], head: [[0, 0.62, 0.37], [0, 0.82, 0.31]], bar: 0.36, grip: [0.26, 1.0, 0.2]
};

export function buildBike(scene, mats, shadows) {
  const paint = mats.color('bikePaint', [0.07, 0.2, 0.17], 0.32, 0.35);
  const chrome = mats.color('chrome', [0.86, 0.86, 0.88], 0.14, 1);
  const rubber = mats.color('rubber', [0.03, 0.03, 0.03], 0.82, 0);
  const saddleM = mats.color('saddle', [0.12, 0.08, 0.06], 0.55, 0);
  const B = BIKE;
  const root = new TransformNode('bike', scene); root.rotationQuaternion = null;
  const lean = new TransformNode('bikeLean', scene); lean.parent = root; lean.rotationQuaternion = null;

  /* рама: треугольники и перья */
  const f = new Batch('bikeFrame');
  const tube = (a, b, r) => f.tube([a, b], [r, r], 10);
  const seatT = [0, 0.74, -0.2], headB = B.head[0], headT = B.head[1];
  tube(B.bb, seatT, 0.018); tube(B.bb, headB, 0.021); tube(seatT, [0, 0.72, 0.33], 0.017);
  tube(B.bb, [0.06, B.rear[1], B.rear[2]], 0.011); tube(B.bb, [-0.06, B.rear[1], B.rear[2]], 0.011);
  tube(seatT, [0.06, B.rear[1] + 0.01, B.rear[2]], 0.01); tube(seatT, [-0.06, B.rear[1] + 0.01, B.rear[2]], 0.01);
  tube(headB, headT, 0.024);
  /* багажник над задним колесом — у советских велосипедов он был всегда */
  const rk = new Batch('bikeRack');
  rk.tube([[0.07, B.rear[1] + 0.02, B.rear[2]], [0.07, 0.66, -0.52], [0.07, 0.66, -0.2]], 0.006, 6);
  rk.tube([[-0.07, B.rear[1] + 0.02, B.rear[2]], [-0.07, 0.66, -0.52], [-0.07, 0.66, -0.2]], 0.006, 6);
  for (const z of [-0.5, -0.4, -0.3, -0.22]) rk.tube([[-0.07, 0.66, z], [0.07, 0.66, z]], 0.005, 6);
  /* щитки над колёсами */
  const fend = new Batch('bikeFenders');
  for (const c of [B.rear, B.front]) {
    const pts = [];
    for (let a = -0.25; a <= (c === B.rear ? 1.9 : 1.6); a += 0.12) {
      const ang = (c === B.rear ? Math.PI * 0.5 + a : Math.PI * 0.5 - a);
      pts.push([0, c[1] + Math.sin(ang) * (B.wheelR + 0.035), c[2] + Math.cos(ang) * (B.wheelR + 0.035) * (c === B.rear ? -1 : 1)]);
    }
    fend.tube(pts, 0.022, 6);
  }
  /* седло и подседельный штырь */
  const sd = new Batch('bikeSaddle');
  sd.tube([seatT, B.seatTop], 0.012, 8);
  sd.box(B.seatTop[0], B.seatTop[1], B.seatTop[2] + 0.03, 0.17, 0.055, 0.26, 0);
  sd.box(B.seatTop[0], B.seatTop[1] + 0.01, B.seatTop[2] + 0.17, 0.07, 0.045, 0.1, 0);

  const add = (batch, mat, parent) => { const m = batch.build(scene, mat, { freeze: false }); m.parent = parent; if (shadows) shadows.addShadowCaster(m, false); return m; };
  add(f, paint, lean); add(rk, chrome, lean); add(fend, paint, lean); add(sd, saddleM, lean);

  /* колесо: шина, обод, спицы, втулка */
  const wheel = name => {
    const n = new TransformNode(name, scene); n.rotationQuaternion = null;
    const tyre = new Batch(name + 'Tyre'), rim = new Batch(name + 'Rim');
    const R = B.wheelR, ring = [];
    for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2; ring.push([0, Math.sin(a) * (R - 0.018), Math.cos(a) * (R - 0.018)]); }
    tyre.tube(ring, 0.02, 8);
    const rring = ring.map(p => [0, p[1] * (R - 0.045) / (R - 0.018), p[2] * (R - 0.045) / (R - 0.018)]);
    rim.tube(rring, 0.008, 6);
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2, side = k % 2 ? 0.028 : -0.028;
      rim.tube([[side, Math.sin(a + 0.2) * 0.02, Math.cos(a + 0.2) * 0.02], [0, Math.sin(a) * (R - 0.05), Math.cos(a) * (R - 0.05)]], 0.0014, 3);
    }
    rim.tube([[-0.05, 0, 0], [0.05, 0, 0]], 0.018, 8);
    add(tyre, rubber, n); add(rim, chrome, n);
    return n;
  };
  const rearW = wheel('bikeRear'); rearW.parent = lean; rearW.position.set(...B.rear);
  /* вилка с рулём и передним колесом — поворачиваются вокруг рулевой колонки */
  const steerAxis = new TransformNode('bikeSteer', scene); steerAxis.rotationQuaternion = null;
  steerAxis.parent = lean; steerAxis.position.set(...headT);
  const tilt = Math.atan2(headT[2] - headB[2], headT[1] - headB[1]);
  steerAxis.rotation.x = tilt;                /* ось колонки наклонена назад */
  const steer = new TransformNode('bikeSteerYaw', scene); steer.rotationQuaternion = null; steer.parent = steerAxis;
  const fork = new Batch('bikeFork');
  const toLocal = p => { const dy = p[1] - headT[1], dz = p[2] - headT[2]; const c = Math.cos(-tilt), s = Math.sin(-tilt); return [p[0], dy * c - dz * s, dy * s + dz * c]; };
  const fl = toLocal(B.front);
  fork.tube([[0.05, 0, 0], [0.05, fl[1] * 0.5, fl[2] * 0.5 + 0.02], [0.05, fl[1], fl[2]]], 0.011, 6);
  fork.tube([[-0.05, 0, 0], [-0.05, fl[1] * 0.5, fl[2] * 0.5 + 0.02], [-0.05, fl[1], fl[2]]], 0.011, 6);
  fork.tube([[0, 0, 0], [0, 0.1, 0]], 0.02, 8);
  add(fork, paint, steer);
  const bar = new Batch('bikeBar');
  const gl = toLocal([B.grip[0], B.grip[1], B.grip[2]]), gr = toLocal([-B.grip[0], B.grip[1], B.grip[2]]);
  const stem = [0, 0.14, 0.04];
  bar.tube([[0, 0.02, 0], stem], 0.012, 8);
  bar.tube([gr, [-0.12, stem[1] + 0.02, stem[2] + 0.04], [0, stem[1], stem[2] + 0.05], [0.12, stem[1] + 0.02, stem[2] + 0.04], gl], 0.011, 8);
  add(bar, chrome, steer);
  const grips = new Batch('bikeGrips');
  grips.tube([gl, [gl[0] + 0.09, gl[1] - 0.01, gl[2] - 0.03]], 0.017, 8);
  grips.tube([gr, [gr[0] - 0.09, gr[1] - 0.01, gr[2] - 0.03]], 0.017, 8);
  add(grips, rubber, steer);
  const frontW = wheel('bikeFront'); frontW.parent = steer; frontW.position.set(...fl);
  /* шатуны и педали */
  const crank = new TransformNode('bikeCrank', scene); crank.rotationQuaternion = null; crank.parent = lean; crank.position.set(...B.bb);
  const cr = new Batch('bikeCranks');
  cr.tube([[0.07, 0, 0], [0.07, -B.crank, 0]], 0.009, 6);
  cr.tube([[-0.07, 0, 0], [-0.07, B.crank, 0]], 0.009, 6);
  cr.tube([[-0.07, 0, 0], [0.07, 0, 0]], 0.012, 8);
  const ringPts = []; for (let k = 0; k <= 30; k++) { const a = k / 30 * Math.PI * 2; ringPts.push([0.05, Math.sin(a) * 0.09, Math.cos(a) * 0.09]); }
  cr.tube(ringPts, 0.006, 5);
  add(cr, chrome, crank);
  const pedals = [];
  for (const [x, y] of [[0.13, -B.crank], [-0.13, B.crank]]) {
    const pn = new TransformNode('pedal', scene); pn.rotationQuaternion = null; pn.parent = crank; pn.position.set(x, y, 0);
    const pb = new Batch('pedal'); pb.box(0, -0.012, 0, 0.1, 0.024, 0.065, 0);
    add(pb, rubber, pn);
    pedals.push(pn);
  }
  return { root, lean, steer, crank, rearW, frontW, pedals, tilt };
}

/* точки велосипеда для позы Олега, в системе велосипеда (без крена) */
export function bikePoints(b, crankAngle, steer) {
  const B = BIKE;
  const ped = sgn => {
    const a = crankAngle + (sgn > 0 ? 0 : Math.PI);
    return [sgn * 0.14, B.bb[1] - Math.cos(a) * B.crank, B.bb[2] - Math.sin(a) * B.crank];
  };
  const gy = B.grip[1], gz = B.grip[2];
  const sx = Math.sin(steer || 0) * 0.12;
  return {
    saddle: B.seatTop, pedalL: ped(1), pedalR: ped(-1),
    gripL: [B.grip[0] + 0.05, gy + 0.005, gz - 0.02 - sx], gripR: [-B.grip[0] - 0.05, gy + 0.005, gz - 0.02 + sx],
    lean: b.lean || 0, steer: steer || 0
  };
}

export function updateBike(v, b, y, riding, dt) {
  v.root.position.set(b.x, y, b.z);
  v.root.rotation.y = b.yaw;
  v.lean.rotation.z = riding ? -(b.lean || 0) : 0.26;     /* на стоянке — на подножке, с наклоном */
  v.steer.rotation.y = riding ? (b.steer || 0) : 0.35;
  const a = (b.wheel || 0) / BIKE.wheelR * 0.38;
  v.rearW.rotation.x = a; v.frontW.rotation.x = a;
  v.crankAngle = (b.wheel || 0) * 0.55;
  v.crank.rotation.x = v.crankAngle;
  for (const p of v.pedals) p.rotation.x = -v.crankAngle;
  void dt;
}
