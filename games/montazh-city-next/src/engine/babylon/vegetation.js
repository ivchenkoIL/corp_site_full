/* =====================================================================
   vegetation.js — деревья двора и улиц.

   Готовые деревья Poly Haven весят по сто мегабайт (каждый лист — сетка),
   поэтому деревья здесь строятся кодом, как строят их в играх: ствол и
   ветви — трубками с корой, крона — «карточками» с текстурой пучка листьев
   и альфа-срезом. Нормали карточек смотрят наружу из центра кроны: так
   крона освещается как объём, а не как россыпь плоскостей. Листья
   просвечивают на солнце (translucency у PBR).

   Породы — те же, что в старой игре: берёза, тополь, клён, ель. На каждую
   собирается три варианта, по району ставятся их копии с поворотом.
   ===================================================================== */
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Batch, rng } from './geo.js';

const SPECIES = {
  birch:  { h: [7.5, 9.5], trunkR: 0.17, crown: 'weep', crownR: 2.3, crownY: [0.35, 1.0], leaf: 'birch', bark: 'birch', cards: 300, card: 1.25 },
  poplar: { h: [10, 13], trunkR: 0.24, crown: 'column', crownR: 1.9, crownY: [0.22, 1.0], leaf: 'poplar', bark: 'grey', cards: 320, card: 1.35 },
  maple:  { h: [7, 9], trunkR: 0.2, crown: 'round', crownR: 3.0, crownY: [0.35, 1.0], leaf: 'maple', bark: 'grey', cards: 280, card: 1.35 },
  spruce: { h: [8, 11], trunkR: 0.2, crown: 'cone', crownR: 2.4, crownY: [0.12, 1.0], leaf: 'spruce', bark: 'dark', cards: 240, card: 1.4 }
};

function leafTexture(scene, kind) {
  const S = 512;
  const dt = new DynamicTexture('leaves_' + kind, { width: S, height: S }, scene, true);
  dt.hasAlpha = true;
  const c = dt.getContext();
  c.clearRect(0, 0, S, S);
  const R = rng(kind.length * 97 + 13);
  const greens = kind === 'spruce' ? [[34, 58, 38], [28, 50, 34], [44, 70, 44]] :
    kind === 'birch' ? [[112, 150, 62], [96, 138, 54], [132, 164, 74], [84, 120, 50]] :
    kind === 'poplar' ? [[82, 118, 56], [70, 106, 50], [98, 132, 64]] : [[88, 126, 52], [104, 140, 58], [120, 150, 60], [76, 110, 44]];
  /* веточки */
  c.strokeStyle = 'rgba(70,52,38,1)'; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    c.lineWidth = 2 + R() * 3;
    c.beginPath(); const x0 = S / 2 + (R() - 0.5) * 60, y0 = S - 10; c.moveTo(x0, y0);
    c.quadraticCurveTo(S / 2 + (R() - 0.5) * 300, S / 2, S / 2 + (R() - 0.5) * 420, 40 + R() * 120); c.stroke();
  }
  if (kind === 'spruce') {
    /* хвоя: частые тёмные иголки по веточкам */
    for (let b = 0; b < 16; b++) {
      const x0 = R() * S, y0 = R() * S, a = R() * Math.PI * 2, len = 90 + R() * 140;
      for (let t = 0; t < len; t += 3) {
        const x = x0 + Math.cos(a) * t, y = y0 + Math.sin(a) * t;
        for (const sgn of [-1, 1]) {
          const g = greens[Math.floor(R() * greens.length)];
          c.strokeStyle = 'rgb(' + g.join(',') + ')'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + sgn * 1.1) * 14, y + Math.sin(a + sgn * 1.1) * 14); c.stroke();
        }
      }
    }
  } else {
    const n = kind === 'birch' ? 260 : 170;
    for (let i = 0; i < n; i++) {
      const x = 30 + R() * (S - 60), y = 30 + R() * (S - 60);
      const r0 = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      if (r0 > 0.98 && R() < 0.7) continue;
      const g = greens[Math.floor(R() * greens.length)], k = 0.78 + R() * 0.4;
      const w = kind === 'birch' ? 13 + R() * 7 : kind === 'maple' ? 26 + R() * 12 : 20 + R() * 10;
      c.save(); c.translate(x, y); c.rotate(R() * Math.PI * 2);
      c.fillStyle = 'rgb(' + g.map(v => Math.min(255, Math.round(v * k))).join(',') + ')';
      c.beginPath();
      if (kind === 'maple') {
        for (let j = 0; j <= 10; j++) { const a = j / 10 * Math.PI * 2, rr = w * (j % 2 ? 0.5 : 1); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9); }
      } else {
        c.moveTo(0, -w); c.quadraticCurveTo(w * 0.62, -w * 0.25, 0, w * 0.55); c.quadraticCurveTo(-w * 0.62, -w * 0.25, 0, -w);
      }
      c.fill();
      c.strokeStyle = 'rgba(40,60,20,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -w * 0.9); c.lineTo(0, w * 0.5); c.stroke();
      c.restore();
    }
  }
  dt.update(true);
  dt.wrapU = dt.wrapV = Texture.CLAMP_ADDRESSMODE;
  return dt;
}

function barkTexture(scene, kind) {
  const W = 256, H = 512;
  const dt = new DynamicTexture('bark_' + kind, { width: W, height: H }, scene, true);
  const c = dt.getContext();
  const R = rng(kind.length * 31 + 7);
  if (kind === 'birch') {
    c.fillStyle = '#e8e4da'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = 'rgba(' + (R() < 0.5 ? '30,28,26' : '70,66,60') + ',' + (0.5 + R() * 0.5) + ')';
      const w = 8 + R() * 50, h = 1.5 + R() * 5;
      c.fillRect(R() * W - w / 2, R() * H, w, h);
    }
    for (let i = 0; i < 25; i++) { c.fillStyle = 'rgba(40,36,32,' + (0.3 + R() * 0.5) + ')'; c.beginPath(); c.ellipse(R() * W, R() * H, 4 + R() * 18, 3 + R() * 10, 0, 0, Math.PI * 2); c.fill(); }
  } else {
    const base = kind === 'dark' ? [58, 48, 40] : [96, 90, 82];
    c.fillStyle = 'rgb(' + base.join(',') + ')'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const k = 0.6 + R() * 0.7;
      c.strokeStyle = 'rgb(' + base.map(v => Math.round(v * k)).join(',') + ')'; c.lineWidth = 2 + R() * 5;
      const x = R() * W; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (R() - 0.5) * 30, H / 3, x + (R() - 0.5) * 30, H * 2 / 3, x + (R() - 0.5) * 20, H); c.stroke();
    }
  }
  dt.update(true);
  dt.wrapU = dt.wrapV = Texture.WRAP_ADDRESSMODE;   /* кора повторяется вдоль ствола */
  return dt;
}

export function buildTrees(scene, list, surfY, shadows) {
  const mats = {}, barks = {};
  const leafMat = kind => mats[kind] || (mats[kind] = (() => {
    const m = new PBRMaterial('leaf_' + kind, scene);
    m.albedoTexture = leafTexture(scene, kind);
    m.albedoTexture.hasAlpha = true;
    m.useAlphaFromAlbedoTexture = true;
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
    m.alphaCutOff = 0.42;
    m.backFaceCulling = false; m.twoSidedLighting = true;
    m.metallic = 0; m.roughness = 0.72;
    m.subSurface.isTranslucencyEnabled = true;
    m.subSurface.translucencyIntensity = 0.55;
    m.subSurface.tintColor = new Color3(0.55, 0.75, 0.25);
    m.environmentIntensity = 0.8;
    return m;
  })());
  const barkMat = kind => barks[kind] || (barks[kind] = (() => {
    const m = new PBRMaterial('bark_' + kind, scene);
    m.albedoTexture = barkTexture(scene, kind);
    m.metallic = 0; m.roughness = 0.9;
    return m;
  })());

  /* шаблоны: по три на породу */
  const templates = {};
  for (const [sp, d] of Object.entries(SPECIES)) {
    templates[sp] = [];
    for (let v = 0; v < 3; v++) {
      const R = rng(sp.length * 1000 + v * 77 + 5);
      const H = d.h[0] + R() * (d.h[1] - d.h[0]);
      const trunk = new Batch('trunk'), leaves = new Batch('leaves');
      /* ствол с лёгким изгибом */
      const tp = [], tr = [];
      const lean = (R() - 0.5) * 0.5, lean2 = (R() - 0.5) * 0.5;
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        tp.push([Math.sin(t * 2.2) * lean * t, t * H * (d.crown === 'cone' ? 0.98 : 0.86), Math.sin(t * 1.7) * lean2 * t]);
        tr.push(d.trunkR * (1 - t * 0.78) + 0.02);
      }
      trunk.tube(tp, tr, 9, { uvScale: 0.9 });
      /* ветви: из верхней части ствола наружу и вверх */
      const nb = d.crown === 'cone' ? 18 : d.crown === 'column' ? 9 : 7;
      const tips = [];
      for (let i = 0; i < nb; i++) {
        const t0 = d.crownY[0] + (d.crownY[1] - d.crownY[0] - 0.1) * (i / nb) + R() * 0.05;
        const k = Math.min(7, Math.floor(t0 * 8));
        const base = tp[k];
        const a = i * 2.39996 + R() * 0.5;
        const len = d.crown === 'cone' ? d.crownR * (1.05 - t0) * 1.1 : d.crown === 'column' ? d.crownR * 0.7 : d.crownR * (0.75 + R() * 0.4);
        const up = d.crown === 'weep' ? 0.35 : d.crown === 'cone' ? -0.1 : d.crown === 'column' ? 1.3 : 0.6;
        const mid = [base[0] + Math.cos(a) * len * 0.55, base[1] + len * up * 0.6, base[2] + Math.sin(a) * len * 0.55];
        const end = [base[0] + Math.cos(a) * len, base[1] + len * up - (d.crown === 'weep' ? 0.4 : 0), base[2] + Math.sin(a) * len];
        trunk.tube([base, mid, end], [d.trunkR * 0.35, d.trunkR * 0.18, 0.02], 6, { uvScale: 1.2 });
        tips.push(end, mid);
      }
      /* крона: карточки вокруг кончиков ветвей и по объёму */
      const cy = H * (d.crownY[0] + d.crownY[1]) / 2 * (d.crown === 'column' ? 0.95 : 0.9);
      const center = [0, cy, 0];
      for (let i = 0; i < d.cards; i++) {
        let p;
        if (R() < 0.6 && tips.length) { const q = tips[Math.floor(R() * tips.length)]; p = [q[0] + (R() - 0.5) * 1.2, q[1] + (R() - 0.5) * 1.1, q[2] + (R() - 0.5) * 1.2]; }
        else {
          const u = R() * 2 - 1, th = R() * Math.PI * 2, rr = Math.cbrt(R());
          const ry = d.crown === 'column' ? H * 0.42 : d.crown === 'cone' ? H * 0.46 : d.crownR * 0.95;
          let rx = d.crownR * rr;
          const yy = center[1] + u * ry * rr;
          if (d.crown === 'cone') rx *= Math.max(0.05, 1 - (yy / H));
          p = [Math.cos(th) * rx * Math.sqrt(1 - u * u), yy, Math.sin(th) * rx * Math.sqrt(1 - u * u)];
        }
        const s = d.card * (0.75 + R() * 0.5);
        const ax = R() * Math.PI * 2, ay = R() * Math.PI, az = (R() - 0.5) * 0.8;
        const u1 = [Math.cos(ax), Math.sin(az), Math.sin(ax)], v1 = [-Math.sin(ax) * Math.cos(ay), Math.cos(ay), Math.cos(ax) * Math.sin(ay)];
        const nrm = norm3([p[0] - center[0], (p[1] - center[1]) * 0.6, p[2] - center[2]]);
        const a0 = [p[0] - u1[0] * s / 2 - v1[0] * s / 2, p[1] - u1[1] * s / 2 - v1[1] * s / 2, p[2] - u1[2] * s / 2 - v1[2] * s / 2];
        const b0 = [a0[0] + u1[0] * s, a0[1] + u1[1] * s, a0[2] + u1[2] * s];
        const c0 = [b0[0] + v1[0] * s, b0[1] + v1[1] * s, b0[2] + v1[2] * s];
        const d0 = [a0[0] + v1[0] * s, a0[1] + v1[1] * s, a0[2] + v1[2] * s];
        const shade = 0.72 + 0.28 * Math.max(0, (p[1] - center[1]) / (H * 0.5) + 0.5);
        leaves.quad(a0, b0, c0, d0, nrm, [0, 0, 1, 0, 1, 1, 0, 1], [shade, shade, shade, 1]);
      }
      const tm = trunk.build(scene, barkMat(d.bark), { freeze: false, name: 'tree_' + sp + v });
      const lm = leaves.build(scene, leafMat(d.leaf), { freeze: false, name: 'crown_' + sp + v });
      tm.isVisible = false; lm.isVisible = false;
      templates[sp].push({ tm, lm });
    }
  }
  /* копии по району */
  let n = 0;
  for (const t of list) {
    const sp = SPECIES[t.sp] ? t.sp : 'birch';
    const tpl = templates[sp][n % 3];
    const R = rng(Math.floor(t.x * 131 + t.z * 71));
    const y = surfY(t.x, t.z), yaw = R() * Math.PI * 2, s = 0.85 + R() * 0.3;
    for (const src of [tpl.tm, tpl.lm]) {
      const inst = src.createInstance(src.name + '_' + n);
      inst.position.set(t.x, y - 0.05, t.z); inst.rotation.y = yaw; inst.scaling.setAll(s);
      inst.isPickable = false; inst.freezeWorldMatrix();
      if (shadows) shadows.addShadowCaster(inst, false);
    }
    n++;
  }
  return templates;
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
