/* =====================================================================
   actors.js — люди района: загрузка персонажей, скелетная анимация,
   смешивание шага и бега, жесты, поза на велосипеде.

   Анимации Babylon здесь не крутит: ключи клипов достаются из GLB один раз,
   а поза собирается своей математикой — так проще смешивать шаг с бегом
   по скорости (фаза общая, ноги не проскальзывают), класть жесты только на
   верх тела, а поверх — процедурные действия старой игры (отвёртка,
   лестница, замах) и посадку на велосипед с IK рук и ног.

   Скелет у всех персонажей один — в именах Mixamo, собранный
   tools/assets/rig-character.mjs: в покое все повороты единичные, поэтому
   локальный поворот кости — это прямо её поворот относительно родителя.
   ===================================================================== */
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/loaders/glTF';

const PARENT = {
  Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', HeadTop_End: 'Head',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm', LeftHandMiddle1: 'LeftHand',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', RightHandMiddle1: 'RightHand',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot', LeftToe_End: 'LeftToeBase',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot', RightToe_End: 'RightToeBase'
};
const BONES = Object.keys(PARENT);
const UPPER = new Set(['Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']);
const strip = n => n.replace(/^mixamorig:/, '');

/* ------------------------------------------------------------------ */
/* кватернионы массивами [x,y,z,w] — быстрее объектов в горячем цикле   */
const qmul = (a, b, o = [0, 0, 0, 1]) => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  o[0] = aw * bx + ax * bw + ay * bz - az * by; o[1] = aw * by - ax * bz + ay * bw + az * bx;
  o[2] = aw * bz + ax * by - ay * bx + az * bw; o[3] = aw * bw - ax * bx - ay * by - az * bz; return o;
};
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q; };
const qaxis = (ax, a) => { const s = Math.sin(a / 2), l = Math.hypot(...ax) || 1; return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(a / 2)]; };
function qfromto(a, b) {
  const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
  const ax = a[0] / la, ay = a[1] / la, az = a[2] / la, bx = b[0] / lb, by = b[1] / lb, bz = b[2] / lb;
  const d = ax * bx + ay * by + az * bz;
  if (d < -0.999999) { let c = [0, -az, ay]; if (Math.hypot(...c) < 1e-6) c = [az, 0, -ax]; return qaxis(c, Math.PI); }
  return qnorm([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx, 1 + d]);
}
function qslerp(a, b, t, o = [0, 0, 0, 1]) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0 = 1 - t, k1 = t;
  if (c < 0.9995) { const om = Math.acos(c), s = Math.sin(om); k0 = Math.sin((1 - t) * om) / s; k1 = Math.sin(t * om) / s; }
  o[0] = a[0] * k0 + bx * k1; o[1] = a[1] * k0 + by * k1; o[2] = a[2] * k0 + bz * k1; o[3] = a[3] * k0 + bw * k1;
  return qnorm(o);
}
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (a, b, k) => a + (b - a) * k;

/* ------------------------------------------------------------------ */
/* Модель персонажа: контейнер с сетками и разобранные клипы             */
export class CharacterModel {
  static async load(scene, url, metaUrl) {
    const m = new CharacterModel();
    m.container = await LoadAssetContainerAsync(url, scene);
    m.meta = metaUrl ? await (await fetch(metaUrl)).json() : { clips: {} };
    m.clips = {};
    for (const g of m.container.animationGroups) {
      const tracks = {};
      let dur = 0;
      for (const ta of g.targetedAnimations) {
        const name = strip(ta.target.name || '');
        const a = ta.animation, fps = a.framePerSecond || 60;
        const keys = a.getKeys();
        const t = new Float32Array(keys.length);
        const isRot = a.targetProperty === 'rotationQuaternion';
        const v = new Float32Array(keys.length * (isRot ? 4 : 3));
        keys.forEach((k, i) => {
          t[i] = k.frame / fps;
          if (isRot) { v[i * 4] = k.value.x; v[i * 4 + 1] = k.value.y; v[i * 4 + 2] = k.value.z; v[i * 4 + 3] = k.value.w; }
          else { v[i * 3] = k.value.x; v[i * 3 + 1] = k.value.y; v[i * 3 + 2] = k.value.z; }
        });
        dur = Math.max(dur, t[t.length - 1]);
        (tracks[name] ||= {})[isRot ? 'r' : 'p'] = { t, v };
      }
      m.clips[g.name] = { name: g.name, dur, tracks, speed: (m.meta.clips[g.name] || {}).speed || 0 };
      g.stop();
    }
    for (const g of [...m.container.animationGroups]) g.dispose();
    /* покой: локальные смещения костей (повороты в покое единичные) */
    m.rest = {};
    for (const n of m.container.transformNodes) {
      const b = strip(n.name);
      if (b in PARENT) m.rest[b] = [n.position.x, n.position.y, n.position.z];
    }
    for (const b of BONES) if (!m.rest[b]) m.rest[b] = [0, 0, 0];
    m.height = m.meta.height || 1.75;
    return m;
  }
  /* поворот кости и позиция бёдер клипа в момент t (с зацикливанием) */
  sample(clip, t, out, loop = true) {
    const c = this.clips[clip];
    if (!c) return false;
    const tt = loop ? ((t % c.dur) + c.dur) % c.dur : Math.min(t, c.dur);
    for (const b in c.tracks) {
      const tr = c.tracks[b];
      if (tr.r) out.r[b] = sampleTrack(tr.r, tt, 4, out.r[b] || [0, 0, 0, 1]);
      if (tr.p) out.p[b] = sampleTrack(tr.p, tt, 3, out.p[b] || [0, 0, 0]);
    }
    return true;
  }
}
function sampleTrack(tr, t, k, o) {
  const T = tr.t, V = tr.v, n = T.length;
  if (t <= T[0]) { for (let j = 0; j < k; j++) o[j] = V[j]; return o; }
  if (t >= T[n - 1]) { for (let j = 0; j < k; j++) o[j] = V[(n - 1) * k + j]; return o; }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; }
  const u = (t - T[lo]) / (T[hi] - T[lo]);
  if (k === 4) return qslerp([V[lo * 4], V[lo * 4 + 1], V[lo * 4 + 2], V[lo * 4 + 3]], [V[hi * 4], V[hi * 4 + 1], V[hi * 4 + 2], V[hi * 4 + 3]], u, o);
  for (let j = 0; j < 3; j++) o[j] = V[lo * 3 + j] + (V[hi * 3 + j] - V[lo * 3 + j]) * u;
  return o;
}

/* ------------------------------------------------------------------ */
/* Персонаж на сцене                                                    */
let uid = 0;
export class Actor {
  constructor(scene, model, opts = {}) {
    this.model = model; this.scene = scene;
    const id = ++uid;
    const inst = model.container.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    for (const g of inst.animationGroups) g.dispose();
    this.root = new TransformNode('actor' + id, scene);
    this.root.rotationQuaternion = null;
    for (const r of inst.rootNodes) r.parent = this.root;
    this.nodes = {};
    for (const r of inst.rootNodes) for (const n of [r, ...r.getDescendants(false)]) {
      const b = strip(n.name || '');
      if (b in PARENT && !this.nodes[b]) { this.nodes[b] = n; n.rotationQuaternion = n.rotationQuaternion || Quaternion.Identity(); }
    }
    this.meshes = inst.rootNodes.flatMap(r => r.getChildMeshes(false)).concat(inst.rootNodes.filter(r => r.getTotalVertices && r.getTotalVertices() > 0));
    for (const m of this.meshes) { m.isPickable = false; m.receiveShadows = true; m.alwaysSelectAsActiveMesh = false; }
    /* дальний уровень детализации (rig-character.mjs кладёт его рядом) */
    const lod = this.meshes.find(m => /_lod1$/.test(m.name)), main = this.meshes.find(m => m !== lod && m.skeleton);
    if (lod && main) { main.addLODLevel(15, lod); this.meshes = this.meshes.filter(m => m !== lod); this.lodMesh = lod; }
    if (opts.tint) this.setTint(opts.tint);
    /* состояние анимации */
    this.phase = Math.random(); this.idleT = Math.random() * 3; this.talkT = 0;
    this.w = { idle: 1, walk: 0, run: 0, talk: 0, work: 0, bike: 0 };
    this.pose = { r: {}, p: {} };
    this.tmp = [{ r: {}, p: {} }, { r: {}, p: {} }, { r: {}, p: {} }, { r: {}, p: {} }];
    this.idleClip = opts.idleClip || 'idle'; this.walkClip = opts.walkClip || 'walk'; this.runClip = opts.runClip || 'run';
    this.visible = true;
  }
  setTint(rgb) {
    const mat = this.meshes.find(m => m.material)?.material?.clone('tint_' + rgb.join('_'));
    if (!mat) return;
    mat.albedoColor.set(rgb[0], rgb[1], rgb[2]);
    for (const m of this.meshes) if (m.material) m.material = mat;
    if (this.lodMesh) this.lodMesh.material = mat;
  }
  setVisible(v) { if (v === this.visible) return; this.visible = v; this.root.setEnabled(v); }
  castShadows(gen) { if (gen) for (const m of this.meshes) gen.addShadowCaster(m, false); }

  /* st: { x, y, z, yaw, speed, act, actK, talk, bike: {…} | null, drunk, lookYaw } */
  update(dt, st) {
    const M = this.model;
    this.root.position.set(st.x, st.y, st.z);
    this.root.rotation.y = st.yaw;
    const sp = st.speed || 0;
    const walkV = M.clips[this.walkClip]?.speed || 1.3, runV = M.clips[this.runClip]?.speed || 2.8;
    /* цели весов: стоим, идём, бежим; на велосипеде — своя поза */
    const bike = !!st.bike;
    let wi = 0, ww = 0, wr = 0;
    if (!bike) {
      if (sp < 0.12) wi = 1;
      else if (sp < walkV) { const k = (sp - 0.12) / (walkV - 0.12); wi = 1 - k; ww = k; }
      else if (sp < runV) { const k = (sp - walkV) / (runV - walkV); ww = 1 - k; wr = k; }
      else wr = 1;
    }
    const kk = 1 - Math.exp(-10 * dt);
    this.w.idle = smooth(this.w.idle, wi, kk); this.w.walk = smooth(this.w.walk, ww, kk); this.w.run = smooth(this.w.run, wr, kk);
    this.w.bike = smooth(this.w.bike, bike ? 1 : 0, 1 - Math.exp(-14 * dt));
    this.w.talk = smooth(this.w.talk, st.talk ? 1 : 0, 1 - Math.exp(-5 * dt));
    this.w.work = smooth(this.w.work, st.act === 'work' ? 1 : 0, 1 - Math.exp(-6 * dt));
    /* фаза шага: цикл клипа проходит свой путь, общая фаза держит ноги на земле */
    const dW = walkV * (M.clips[this.walkClip]?.dur || 1), dR = runV * (M.clips[this.runClip]?.dur || 0.7);
    const cyc = dW + (dR - dW) * (this.w.run / Math.max(1e-3, this.w.run + this.w.walk));
    this.phase = (this.phase + dt * Math.max(sp, 0.0) / Math.max(0.3, cyc)) % 1;
    this.idleT += dt; this.talkT += dt;

    /* сэмплы клипов и смесь */
    const P = this.pose;
    const parts = [];
    if (this.w.idle > 0.001) { M.sample(this.idleClip, this.idleT, this.tmp[0]); parts.push([this.tmp[0], this.w.idle]); }
    if (this.w.walk > 0.001) { M.sample(this.walkClip, this.phase * M.clips[this.walkClip].dur, this.tmp[1]); parts.push([this.tmp[1], this.w.walk]); }
    if (this.w.run > 0.001) { M.sample(this.runClip, this.phase * M.clips[this.runClip].dur, this.tmp[2]); parts.push([this.tmp[2], this.w.run]); }
    if (!parts.length) { M.sample(this.idleClip, this.idleT, this.tmp[0]); parts.push([this.tmp[0], 1]); }
    blend(parts, P);
    /* разговор: кивки и жесты только на верх тела */
    if (this.w.talk > 0.01 && M.clips.talkYes) {
      M.sample(st.talkNo ? 'talkNo' : 'talkYes', this.talkT, this.tmp[3]);
      for (const b of UPPER) if (this.tmp[3].r[b]) qslerp(P.r[b] || [0, 0, 0, 1], this.tmp[3].r[b], this.w.talk * 0.8, P.r[b] || (P.r[b] = [0, 0, 0, 1]));
    }
    /* процедурные слои поверх клипов */
    if (this.w.work > 0.01) this.layerWork(P, this.w.work);
    if (st.drunk > 0.05) this.layerDrunk(P, st.drunk);
    if (this.w.bike > 0.01 && st.bike) this.layerBike(P, st.bike, this.w.bike);
    if (st.lookYaw) { const q = qaxis([0, 1, 0], st.lookYaw * 0.6); qmul(P.r.Head || [0, 0, 0, 1], q, P.r.Head || (P.r.Head = [0, 0, 0, 1])); }
    this.apply(P);
  }
  apply(P) {
    for (const b of BONES) {
      const n = this.nodes[b]; if (!n) continue;
      const q = P.r[b];
      if (q) n.rotationQuaternion.set(q[0], q[1], q[2], q[3]);
      if (b === 'Hips' && P.p.Hips) n.position.set(P.p.Hips[0], P.p.Hips[1], P.p.Hips[2]);
    }
  }
  /* глобальные повороты и позиции костей по локальной позе — для IK */
  fk(P) {
    const R = this.model.rest, G = {};
    for (const b of BONES) {
      const par = PARENT[b], lq = P.r[b] || [0, 0, 0, 1];
      if (!par) { G[b] = { q: lq.slice(), p: (P.p.Hips || R.Hips).slice() }; continue; }
      const pg = G[par];
      G[b] = { q: qmul(pg.q, lq), p: vadd(pg.p, qrot(pg.q, R[b])) };
    }
    return G;
  }
  /* двухзвенное IK: кость a → b → c тянется концом c в точку t, колено/локоть к полюсу */
  ik2(P, a, b, c, target, pole, weight = 1) {
    const G = this.fk(P);
    const pa = G[a].p, pb = G[b].p, pc = G[c].p;
    const l1 = vlen(vsub(pb, pa)), l2 = vlen(vsub(pc, pb));
    const dv = vsub(target, pa);
    const d = Math.min(Math.max(vlen(dv), 1e-3), (l1 + l2) * 0.999);
    const dir = vnorm(dv);
    const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    let pol = vsub(pole, pa); pol = vsub(pol, vscale(dir, vdot(pol, dir))); pol = vnorm(pol);
    const knee = vadd(pa, vadd(vscale(dir, l1 * cosA), vscale(pol, l1 * Math.sqrt(1 - cosA * cosA))));
    const end = vadd(pa, vscale(dir, d));
    /* верхнее звено */
    const qa = qmul(qfromto(vsub(pb, pa), vsub(knee, pa)), G[a].q);
    const parA = PARENT[a];
    const la = qmul(qinv(G[parA].q), qa);
    /* нижнее звено: где оказался бы c после поворота a, и довернуть к цели */
    const pbN = knee, pcN = vadd(knee, qrot(qa, qrot(qinv(G[a].q), vsub(pc, pb))));
    const qbOld = qmul(qa, qmul(qinv(G[a].q), G[b].q));
    const qb = qmul(qfromto(vsub(pcN, pbN), vsub(end, pbN)), qbOld);
    const lb = qmul(qinv(qa), qb);
    P.r[a] = weight >= 1 ? la : qslerp(P.r[a] || [0, 0, 0, 1], la, weight);
    P.r[b] = weight >= 1 ? lb : qslerp(P.r[b] || [0, 0, 0, 1], lb, weight);
  }
  /* отвёртка у объекта: правая рука вперёд-вверх, кисть крутит */
  layerWork(P, k) {
    const t = this.idleT;
    const add = (b, ax, a) => { const q = qaxis(ax, a * k); P.r[b] = qmul(P.r[b] || [0, 0, 0, 1], q); };
    add('RightArm', [1, 0, 0], -1.05); add('RightArm', [0, 0, 1], 0.35);
    add('RightForeArm', [1, 0, 0], -0.9 + Math.sin(t * 2.1) * 0.08);
    add('RightHand', [0, 0, 1], Math.sin(t * 9) * 0.5);
    add('LeftArm', [1, 0, 0], -0.55); add('LeftForeArm', [1, 0, 0], -0.7);
    add('Spine1', [1, 0, 0], 0.12); add('Head', [1, 0, 0], 0.18);
  }
  layerDrunk(P, d) {
    const t = this.idleT;
    const q = qaxis([0, 0, 1], Math.sin(t * 1.3) * 0.12 * d);
    P.r.Spine = qmul(P.r.Spine || [0, 0, 0, 1], q);
    P.r.Head = qmul(P.r.Head || [0, 0, 0, 1], qaxis([1, 0, 1], Math.sin(t * 0.9) * 0.18 * d));
  }
  /* посадка на велосипед: таз на седло, руки на руль, ноги на педали.
     b: точки велосипеда в системе персонажа (x вправо, y вверх, z вперёд) */
  layerBike(P, b, k) {
    /* бёдра: на седло, чуть вперёд наклон корпуса */
    P.p.Hips = [0, b.saddle[1] + 0.07, b.saddle[2] + 0.02];
    P.r.Hips = qaxis([1, 0, 0], 0.18 + b.lean * 0.0);
    const lean = qaxis([0, 0, 1], -b.lean * 0.6);
    P.r.Hips = qmul(lean, P.r.Hips);
    P.r.Spine = qaxis([1, 0, 0], 0.16); P.r.Spine1 = qaxis([1, 0, 0], 0.14); P.r.Spine2 = qaxis([1, 0, 0], 0.08);
    P.r.Neck = qaxis([1, 0, 0], -0.2); P.r.Head = qmul(qaxis([1, 0, 0], -0.22), qaxis([0, 1, 0], b.steer * 0.5));
    /* ноги на педали: колени вперёд и чуть наружу */
    const side = s => (s === 'Left' ? 1 : -1);
    for (const s of ['Left', 'Right']) {
      const ped = b[s === 'Left' ? 'pedalL' : 'pedalR'];
      const target = [ped[0], ped[1] + 0.07, ped[2] - 0.06];
      this.ik2(P, s + 'UpLeg', s + 'Leg', s + 'Foot', target, [side(s) * 0.25, ped[1] + 0.6, ped[2] + 0.9]);
      /* стопа плашмя на педали */
      const G = this.fk(P);
      const want = qaxis([1, 0, 0], 0.1);
      P.r[s + 'Foot'] = qmul(qinv(G[s + 'Leg'].q), want);
      P.r[s + 'ToeBase'] = [0, 0, 0, 1];
    }
    /* руки на руль: локти в стороны и вниз, кисть продолжает предплечье */
    for (const s of ['Left', 'Right']) {
      const g = b[s === 'Left' ? 'gripL' : 'gripR'];
      P.r[s + 'Shoulder'] = [0, 0, 0, 1];
      this.ik2(P, s + 'Arm', s + 'ForeArm', s + 'Hand', g, [side(s) * 0.9, g[1] - 0.4, g[2] - 0.2]);
      P.r[s + 'Hand'] = qaxis([1, 0, 0], 0.25);
    }
  }
  dispose() { this.root.dispose(false, true); }
}

function blend(parts, out) {
  let wsum = 0;
  for (const [, w] of parts) wsum += w;
  const first = parts[0][0];
  for (const b of BONES) {
    let acc = null;
    for (const [pose, w0] of parts) {
      const q = pose.r[b]; if (!q) continue;
      const w = w0 / wsum;
      if (!acc) acc = [q[0] * w, q[1] * w, q[2] * w, q[3] * w];
      else { const s = acc[0] * q[0] + acc[1] * q[1] + acc[2] * q[2] + acc[3] * q[3] < 0 ? -w : w; acc[0] += q[0] * s; acc[1] += q[1] * s; acc[2] += q[2] * s; acc[3] += q[3] * s; }
    }
    if (acc) out.r[b] = qnorm(acc);
  }
  let hp = null;
  for (const [pose, w0] of parts) { const p = pose.p.Hips; if (!p) continue; const w = w0 / wsum; hp = hp ? [hp[0] + p[0] * w, hp[1] + p[1] * w, hp[2] + p[2] * w] : [p[0] * w, p[1] * w, p[2] * w]; }
  if (hp) out.p.Hips = hp; else if (first.p.Hips) out.p.Hips = first.p.Hips.slice();
}
