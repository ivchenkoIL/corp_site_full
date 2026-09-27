/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «24. Тени, маркеры и отрисовка кадра», строки 10785–11781.
   ===================================================================== */
import { Q, QCFG } from '../core/quality.js';
import { D2R, clamp, dist, dist2, m4, m4compose, m4id, m4invRT, m4look, m4mul, m4ortho, mulberry32 } from '../core/util.js';
import { charPose } from '../game/npcs.js';
import { EGG, EGG_MAT } from '../game/phone.js';
import { S, hour } from '../game/state.js';
import { BONEBUF, BONES, CHAR_MESHES, SCRATCH, drawCharacter } from './characters.js';
import { GL } from './gl.js';
import { Cull, Env, EnvMap, HDR, Perf, R3, beginMain, drawGlow, drawMesh, drawSky, drawStatic, hex2rgb, needDepthTex, setCamera } from './renderer.js';
import { Static } from './static.js';
import { TX } from './textures.js';
import { VEH, drawBike, drawVehicle } from './vehicles.js';
import { CHARS } from '../ui/dialog.js';
import { HUD2, bubble3, label3, project } from '../ui/overlay2d.js';
import { POLES, surfY } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 24. Тени, маркеры и отрисовка кадра                                  */
/* ------------------------------------------------------------------ */
/* Насколько подложка нужна в этой точке: 1 — настоящей тени тут нет
   (ночь или дальше каскадов с динамикой), 0 — есть и подложка лишняя. */
export function blobK(x, z) {
  const SH = QCFG.light.shadow;
  if (!SHADOW.on) return 1;
  const far = QCFG.shadow.splits[Math.min(QCFG.shadow.dynCascades, SHADOW.n) - 1] || 0;
  const d = Math.hypot(x - R3.eye[0], z - R3.eye[2]);
  return SH.csmFade + (1 - SH.csmFade) * clamp((d - far) / SH.csmBlend, 0, 1);
}

export function drawShadow(x, z, size, alpha) {
  const gl = GL.gl, P = R3.glow;
  alpha *= blobK(x, z);
  if (alpha < 0.01) return;
  gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uProj, false, R3.proj);
  gl.uniformMatrix4fv(P.u.uView, false, R3.view);
  gl.uniform3f(P.u.uRight, 1, 0, 0);
  gl.uniform3f(P.u.uUp, 0, 0, 1);
  gl.uniform3f(P.u.uPos, x, surfY(x, z) + QCFG.light.shadow.lift, z);
  gl.uniform2f(P.u.uSize, size, size);
  gl.uniform4f(P.u.uColor, 0, 0, 0, alpha);
  gl.uniform1f(P.u.uHard, QCFG.light.shadow.hard);
  gl.uniform1f(P.u.uMode, 1);
  gl.bindVertexArray(R3.glowVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.uniform1f(P.u.uMode, 0);
}
export function pedMesh(i) { return CHAR_MESHES.peds[i % CHAR_MESHES.peds.length]; }

export function drawDynamic() {
  const gl = GL.gl, p = S.player;
  const camx = S.cam.x, camz = S.cam.z;
  const vk = Q.vis;
  const vis = (x, z, r) => { const rr = (r || 95) * vk; return dist2(x, z, camx, camz) < rr * rr; };

  /* тени — отдельным проходом, с альфа-смешиванием */
  const SH = QCFG.light.shadow, sh = (x, z, k) => drawShadow(x, z, k[0], k[1]);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  if (vis(p.x, p.z)) sh(p.x, p.z, p.onBike ? SH.olegBike : SH.oleg);
  for (const q of S.peds) if (vis(q.x, q.z, 55)) sh(q.x, q.z, SH.ped);
  for (const h of S.hools) if (vis(h.x, h.z, 55)) sh(h.x, h.z, SH.ped);
  for (const g of S.grans) if (vis(g.x, g.z, 55)) sh(g.x, g.z, SH.ped);
  for (const n of S.npcs) if (vis(n.x, n.z, 55)) sh(n.x, n.z, SH.ped);
  for (const d of S.dogs) if (vis(d.x, d.z, 45)) sh(d.x, d.z, SH.dog);
  for (const g of S.guards) if (vis(g.x, g.z, 70)) sh(g.x, g.z, SH.guard);
  for (const c of S.cars) if (vis(c.x, c.z)) sh(c.x, c.z, SH.car);
  if (!p.onBike && vis(S.bike.x, S.bike.z, 55)) sh(S.bike.x, S.bike.z, SH.bike);
  const M = S.mission;
  if (M && M.data && M.data.raiders && M.data.step === 5)
    for (const r of M.data.raiders) if (!r.done && vis(r.x, r.z, 60)) sh(r.x, r.z, SH.ped);
  gl.depthMask(true); gl.disable(gl.BLEND);

  beginMainLights();
  drawDynamicGeom();
}

/* Геометрия жителей и техники отдельно от блобов и от установки света: проход
   глубины и проход теней зовут её со своей программой, а тени-подложки и
   освещение им ни к чему. */
export function drawDynamicGeom() {
  const gl = GL.gl, p = S.player;
  const camx = S.cam.x, camz = S.cam.z;
  const vk = Q.vis;
  const vis = (x, z, r) => { const rr = (r || 95) * vk; return dist2(x, z, camx, camz) < rr * rr; };
  const M = S.mission;
  /* машины */
  for (const c of S.cars) if (vis(c.x, c.z)) drawVehicle(c.kind, c.x, surfY(c.x, c.z), c.z, c.yaw, c.wheel, [c.tint[0], c.tint[1], c.tint[2], 1], c);
  /* прохожие и жители */
  for (const q of S.peds) if (vis(q.x, q.z, 60)) drawCharacter(pedMesh(q.mesh), charPose(q));
  for (const h of S.hools) if (vis(h.x, h.z, 60)) drawCharacter(CHAR_MESHES.hool, charPose(h));
  for (const g of S.grans) if (vis(g.x, g.z, 60)) drawCharacter(CHAR_MESHES.gran, charPose(g));
  for (const n of S.npcs) if (vis(n.x, n.z, 70))
    drawCharacter(n.kind === 'sanya' ? CHAR_MESHES.sanya : (CHAR_MESHES[n.who] || CHAR_MESHES.client), charPose(n));
  for (const g of S.guards) if (vis(g.x, g.z, 90)) {
    drawVehicle('sedan', g.x, surfY(g.x, g.z), g.z, g.yaw, g.wheel || 0, [.55, .12, .16, 1],
      { pitch: g.pitch, roll: g.roll, steer: clamp((g.roll || 0) * -4, -0.5, 0.5) });
    drawCharacter(CHAR_MESHES.guard, charPose(g));
  }
  if (M && M.data && M.data.raiders && M.data.step === 5)
    for (const r of M.data.raiders) if (!r.done && vis(r.x, r.z, 70))
      drawCharacter(CHAR_MESHES.hool, charPose(r));
  /* собаки — маленькие «персонажи» на четырёх костях */
  for (const d of S.dogs) if (vis(d.x, d.z, 50)) drawDog3(d);
  /* Олег и велосипед */
  if (p.onBike) {
    const by = surfY(p.x, p.z), bph = S.bike.wheel * 0.8;
    drawBike(p.x, by, p.z, S.bike.yaw, S.bike.wheel, S.bike.lean, S.bike.steer, bph * 1.4);
    /* седло стоит на 0.26 позади оси велосипеда — иначе Олег висит перед ним */
    const sx = p.x - Math.sin(S.bike.yaw) * 0.26, sz = p.z - Math.cos(S.bike.yaw) * 0.26;
    drawCharacter(CHAR_MESHES.oleg, charPose(p, { x: sx, z: sz, y: by + 0.53, yaw: S.bike.yaw, phase: bph,
      speed: clamp(Math.abs(S.bike.speed) / 6, 0, 1), sit: true, roll: (S.bike.lean || 0) * 0.85,
      lean: 0.34 + clamp(Math.abs(S.bike.speed) / 26, 0, .3), drunk: p.drunk / 100, act: '', idleP: 1 }));
  } else {
    drawBike(S.bike.x, surfY(S.bike.x, S.bike.z), S.bike.z, S.bike.yaw + 0.4, 0, 0.6, 0, 0.4);
    drawCharacter(CHAR_MESHES.oleg, charPose(p, { yaw: p.yaw, lean: p.hurt > 0 ? 0.25 : 0, drunk: p.drunk / 100 }));
  }
  /* установленные камеры на опорах */
  const gl2 = GL.gl, PP = R3.main;
  /* Периметральный прибор появляется вместе с историей и остаётся стоять
     после неё — уже с копотью. */
  if (S.egg.stage !== 'none' && VEH.aznet && vis(EGG.dev.x, EGG.dev.z, 90)) {
    m4compose(EGG_MAT, EGG.dev.x, EGG.dev.y, EGG.dev.z, 0, 0, 0, 1);
    drawMesh(VEH.aznet, TX.paint, EGG_MAT, S.egg.burnt ? { tint: [0.42, 0.38, 0.36, 1] } : null);
  }
  for (const pole of POLES) {
    if (!pole.installed || !vis(pole.x, pole.z, 70)) continue;
    m4compose(BONES[0], pole.x - 0.7, (pole.lamp ? 7.2 : 6.2) - 0.5, pole.z, 0, (pole.camYaw || 0) + Math.PI, 0, 1);
    BONEBUF.set(BONES[0], 0);
    gl2.uniformMatrix4fv(PP.u.uBones, false, BONEBUF);
    drawMesh(VEH.cam, TX.paint, BONES[0], { skin: true });
  }
}
export function drawDog3(d) {
  const gl = GL.gl, P = R3.main;
  const v = Math.hypot(d.vx, d.vz), sp = clamp(v / 5.2, 0, 1);
  /* Размах привязан к скорости: стоящая собака стоит на прямых ногах, а не
     раскорячившись — раньше в размах входила постоянная добавка. */
  const ph = d.phase * 2, amp = 0.05 + sp * 0.66;
  const be = Math.sin(Math.PI * clamp(d.barkK || 0, 0, 1));      /* колокол лая */
  /* корпус пружинит на бегу и приседает на лае */
  m4compose(BONES[0], d.x, surfY(d.x, d.z) + 0.42 + Math.sin(ph * 2) * 0.03 * sp - be * 0.02, d.z,
    -sp * 0.06 + Math.sin(ph * 2) * 0.04 * sp, d.yaw, Math.sin(ph) * 0.05 * sp, 1);
  /* голова: смотрит на цель, задирается на лае, опускается на бегу.
     Сустав вынесен на конец шеи — раньше он стоял в холке, и череп уезжал
     внутрь груди: наружу торчала одна морда, а шеи не было вовсе. */
  m4mul(BONES[1], BONES[0], m4compose(SCRATCH[6], 0, 0.088, 0.272,
    -0.10 * sp - be * 0.45 + (d.hp || 0), d.hy || 0, Math.sin(S.t * 1.7 + d.x) * 0.05 * (1 - sp), 1));
  /* челюсть: лай и одышка после пробежки */
  m4mul(BONES[2], BONES[1], m4compose(SCRATCH[6], 0, -0.030, 0.100,
    be * 0.55 + (d.pant || 0) * (0.10 + Math.sin(S.t * 9) * 0.06), 0, 0, 1));
  /* Лапы рысью: диагонали работают вместе. Плечо машет, а сустав ниже (у
     передних запястье, у задних скакательный) подламывается назад в фазе
     выноса — без него нога так и остаётся палкой. sh0 и kn0 — постоянный
     излом стойки: передние почти прямые, задние зигзагом, бедро вперёд и
     голень назад. На четырёх прямых ногах собака стояла столом. */
  for (const [b, lb, ox, oy, oz, off, kn, sh0, kn0] of [
        [3, 8, -0.060, -0.100, 0.152, 0, 0.85, 0.00, 0.10],
        [4, 9, 0.060, -0.100, 0.152, Math.PI, 0.85, 0.00, 0.10],
        [5, 10, -0.076, -0.107, -0.168, Math.PI, 1.30, -0.22, 0.40],
        [6, 11, 0.076, -0.107, -0.168, 0, 1.30, -0.22, 0.40]]) {
    m4mul(BONES[b], BONES[0], m4compose(SCRATCH[6], ox, oy, oz, sh0 - Math.sin(ph + off) * amp, 0, 0, 1));
    const bend = kn0 + (0.5 - 0.5 * Math.cos(ph + off)) * amp * kn;
    m4mul(BONES[lb], BONES[b], m4compose(SCRATCH[6], 0, -0.175, 0, bend, 0, 0, 1));
  }
  /* хвост: виляет тем шире, чем добрее настроение, и поджимается со страху */
  const wg = clamp(d.wag || 0, 0, 1);
  m4mul(BONES[7], BONES[0], m4compose(SCRATCH[6], 0, -0.008, -0.292,
    0.15 + wg * 0.55 - (d.scare > 0 ? 1.1 : 0), Math.sin(S.t * (6 + wg * 10)) * (0.12 + wg * 0.55), 0, 1));
  for (let i = 0; i < 12; i++) BONEBUF.set(BONES[i], i * 16);
  gl.uniformMatrix4fv(P.u.uBones, false, BONEBUF);
  drawMesh(VEH.dog, TX.paint, BONES[0], { skin: true });
}
export function beginMainLights() {
  const p = S.player, lamps = [];
  if (Env.night > 0.04) {
    const LP = QCFG.light.lamp;
    const all = Static.lamps.slice().sort((a, b) => dist2(a.x, a.z, p.x, p.z) - dist2(b.x, b.z, p.x, p.z));
    for (let i = 0; i < Math.min(Q.lampPick, all.length); i++)
      lamps.push({ x: all[i].x, y: all[i].y, z: all[i].z, c: LP.warm, k: Env.night * (all[i].small ? LP.kSmall : LP.kBig) });
    /* собственный свет Олега, чтобы ночью не идти вслепую */
    lamps.push({ x: p.x, y: 1.6, z: p.z, c: LP.oleg, k: Env.night * LP.kOleg });
    if (p.lampOn) lamps.push({ x: p.x + Math.sin(p.yaw) * 2.6, y: 1.3, z: p.z + Math.cos(p.yaw) * 2.6, c: LP.torch, k: Env.night * LP.kTorch });
    if (p.onBike && S.upgrades.light) lamps.push({ x: p.x + Math.sin(S.bike.yaw) * 4, y: 1, z: p.z + Math.cos(S.bike.yaw) * 4, c: LP.bike, k: Env.night * LP.kBike });
  }
  beginMain(lamps);
}
export function drawGlows() {
  if (!QCFG.glow.on) return;             /* абляция: проход не исполняется вовсе */
  const gl = GL.gl, p = S.player;
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
  if (Env.night > 0.04) {
    const vk = Q.vis, lampR = Q.glowR * vk, nearR = QCFG.glow.lampNear * vk, signR = QCFG.glow.signR * vk, carR = QCFG.glow.carR * vk;
    const G = QCFG.glow, LC = QCFG.light.lamp;
    for (const l of Static.lamps) {
      const dd = dist2(l.x, l.z, S.cam.x, S.cam.z);
      if (dd > lampR * lampR) continue;
      const k = l.small ? G.lampSmall : G.lampBig;
      drawGlow([l.x, l.y, l.z], k[0], LC.warm, k[1] * Env.night, k[2]);
      if (!l.small && dd < nearR * nearR)
        drawGlow([l.x, l.y - 0.4, l.z], G.lampHalo[0], LC.warm, G.lampHalo[1] * Env.night, G.lampHalo[2]);
    }
    for (const s of Static.signs) {
      if (dist2(s.pos[0], s.pos[2], S.cam.x, S.cam.z) > signR * signR) continue;
      drawGlow(s.pos, G.sign[0], hex2rgb(s.color), G.sign[1] * Env.night, G.sign[2]);
    }
    for (const c of S.cars) {
      if (dist2(c.x, c.z, S.cam.x, S.cam.z) > carR * carR) continue;
      drawGlow([c.x + Math.sin(c.yaw) * 2.1, 0.55, c.z + Math.cos(c.yaw) * 2.1], G.head[0], LC.torch, G.head[1] * Env.night, G.head[2]);
      drawGlow([c.x - Math.sin(c.yaw) * 2.1, 0.55, c.z - Math.cos(c.yaw) * 2.1], G.tail[0], [1, .25, .2], G.tail[1] * Env.night, G.tail[2]);
    }
    if (p.lampOn) drawGlow([p.x + Math.sin(p.yaw) * 0.5, 1.35, p.z + Math.cos(p.yaw) * 0.5], G.torch[0], LC.torch, G.torch[1], G.torch[2]);
  }
  /* Лампа прибора: emis в шейдере включается только ночью, поэтому днём
     подсвечиваем отдельно — иначе щиток не найти на фоне забора. */
  if (S.egg.stage !== 'none' && dist2(EGG.dev.x, EGG.dev.z, S.cam.x, S.cam.z) < 60 * 60) {
    if (S.egg.burnt) {
      drawGlow([EGG.dev.x, EGG.dev.y + 0.30, EGG.dev.z + 0.12], 0.9, [.35, .32, .30], 0.30, 2.2);
    } else {
      const pulse = 0.55 + 0.45 * Math.sin(S.t * 2.4);
      drawGlow([EGG.dev.x - 0.14, EGG.dev.y + 0.16, EGG.dev.z + 0.14], 0.30, [1, .22, .2], 0.75 * pulse, 2.4);
    }
  }
  /* маркер цели: у заявки свой, у личной истории — свой */
  const t = (S.mission && S.mission.target) || (S.egg.stage === 'go' ? EGG.mark : null);
  if (t) {
    const G = QCFG.glow, pulse = 0.55 + 0.45 * Math.sin(S.t * 3);
    for (let i = 0; i < 5; i++)
      drawGlow([t.x, 0.6 + i * 1.1, t.z], G.marker[0] - i * 0.16, [1, .82, .25], G.marker[1] * pulse, G.marker[2]);
    drawGlow([t.x, 0.15, t.z], G.markerBase[0], [1, .82, .25], G.markerBase[1] * pulse, G.markerBase[2]);
  }
  /* искры и пыль */
  if (Q.sparks > 0) for (const f of S.fx) {
    if (f.kind === 'text') continue;
    const a = clamp(f.life / f.max, 0, 1), k = f.kind === 'spark' ? QCFG.glow.spark : QCFG.glow.dust;
    drawGlow([f.x, f.y, f.z], f.s * k[0], f.color, a * k[1], k[2]);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
}
export function drawOverlay2D() {
  const c = HUD2.c;
  c.clearRect(0, 0, HUD2.w, HUD2.h);
  if (S.screen !== 'play' && S.screen !== 'pause') return;
  const p = S.player;
  /* Олег всегда в середине кадра и близко к камере, поэтому его реплику вешаем
     ниже прочих: на 2.3 м она уезжала под бегущую строку радио. */
  if (p.say > 0 && p.line) bubble3(p.x, 1.95, p.z, p.line, 'rgba(255,138,31,.82)');
  for (const q of S.peds) if (q.say > 0 && dist2(q.x, q.z, p.x, p.z) < 30 * 30) bubble3(q.x, 2.1, q.z, q.line);
  for (const h of S.hools) if (h.say > 0 && dist2(h.x, h.z, p.x, p.z) < 30 * 30) bubble3(h.x, 2.1, h.z, h.line, 'rgba(138,43,226,.8)');
  for (const g of S.grans) if (g.say > 0) bubble3(g.x, 2.1, g.z, g.line, 'rgba(75,227,107,.8)');
  for (const n of S.npcs) {
    if (n.say > 0) bubble3(n.x, 2.15, n.z, n.line, 'rgba(37,232,220,.8)');
    if (n.kind === 'client' || n.kind === 'kostya' || n.kind === 'vanya')
      label3(n.x, 2.35, n.z, (CHARS[n.who] ? CHARS[n.who].name : 'КЛИЕНТ'),
        (CHARS[n.who] && CHARS[n.who].c) || '#25e8dc', 12);
  }
  /* точки поиска и тёмные опоры */
  const M = S.mission;
  if (M && M.stage === 'work' && M.def.kind === 'search' && M.data.spots)
    for (const sp of M.data.spots) label3(sp.x, 1.4, sp.z, sp.searched ? '· осмотрено ·' : '⌕ ' + sp.label, sp.searched ? '#9a8fb0' : '#25e8dc', 12);
  if (M && M.def.kind === 'final' && M.data.coils)
    for (const coil of M.data.coils)
      label3(coil.x, 1.2, coil.z, coil.lost ? 'УНЕСЛИ' : coil.saved ? 'ЦЕЛА' : 'КАБЕЛЬ ' + Math.round((1 - coil.prog) * 100) + '%',
        coil.lost ? '#ff4d5e' : coil.saved ? '#4be36b' : '#ffd23f', 13);
  /* всплывающий текст */
  for (const f of S.fx) if (f.kind === 'text') {
    const pr = project(f.x, f.y, f.z);
    if (!pr) continue;
    c.save(); c.globalAlpha = clamp(f.life / f.max, 0, 1);
    c.font = '900 16px "Arial Black",sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(8,4,18,.85)';
    c.strokeText(f.text, pr[0], pr[1]); c.fillStyle = f.color; c.fillText(f.text, pr[0], pr[1]);
    c.restore();
  }
  /* указатель на цель */
  const t = (M && M.target) || (S.egg.stage === 'go' ? EGG.mark : null);
  if (t) {
    const d = dist(t.x, t.z, p.x, p.z);
    const pr = project(t.x, 3.2, t.z);
    const onScreen = pr && pr[0] > 40 && pr[0] < HUD2.w - 40 && pr[1] > 40 && pr[1] < HUD2.h - 40;
    if (onScreen) label3(t.x, 3.6, t.z, t.label.toUpperCase() + ' · ' + Math.round(d) + ' м', '#ffd23f', 13);
    else {
      const ang = Math.atan2(t.x - p.x, t.z - p.z) - S.cam.yaw + Math.PI;
      const cx = HUD2.w / 2, cy = HUD2.h / 2, rr = Math.min(HUD2.w, HUD2.h) * 0.34;
      const sx = cx + Math.sin(ang) * rr, sy = cy - Math.cos(ang) * rr * 0.62;
      c.save(); c.translate(sx, sy); c.rotate(ang);
      c.fillStyle = 'rgba(255,210,63,.92)';
      c.beginPath(); c.moveTo(0, -14); c.lineTo(10, 8); c.lineTo(0, 3); c.lineTo(-10, 8); c.closePath(); c.fill();
      c.restore();
      c.save(); c.font = '900 12px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(8,4,18,.8)';
      c.strokeText(Math.round(d) + ' м · ' + t.label, sx, sy + 26);
      c.fillStyle = '#ffd23f'; c.fillText(Math.round(d) + ' м · ' + t.label, sx, sy + 26);
      c.restore();
    }
  }
}

/* --- Затенение в складках: буферы и проход --------------------------- */
export const SSAO = {
  fb: null, fb2: null, tex: null, tex2: null, dummy: null,
  w: 0, h: 0, on: false, bytes: 0,
  kernel: null, projInfo: new Float32Array(4),

  init(gl) {
    this.fb = gl.createFramebuffer();
    this.fb2 = gl.createFramebuffer();
    this.tex = gl.createTexture();
    this.tex2 = gl.createTexture();
    for (const t of [this.tex, this.tex2]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      /* LINEAR: половинный буфер растягивается на полный при выборке в
         главном проходе, и растягивать его должен семплер, а не отдельный
         проход увеличения. */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    /* Заглушка 1×1 «затенения нет»: юниформ обязан указывать на живую
       текстуру всегда, иначе повторится история с теневым семплером на
       нулевом слоте — драйвер молча отвергал весь вызов. */
    this.dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, 1, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    /* Ядро: точки в полусфере вокруг нормали, сгущённые к началу — близкие
       складки важнее далёких, а дальние всё равно отсеет проверка дальности. */
    const n = QCFG.ssao.samples, k = new Float32Array(n * 3);
    const rnd = mulberry32(20260905);
    for (let i = 0; i < n; i++) {
      let x, y, z, l;
      do {
        x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd();
        l = Math.hypot(x, y, z);
      } while (l < 1e-3 || l > 1);
      const t = i / n, sc = 0.25 + 0.75 * t * t;   /* сгущение к центру */
      k[i*3] = x / l * sc; k[i*3+1] = y / l * sc; k[i*3+2] = z / l * sc;
    }
    this.kernel = k;
  },

  resize(gl, w, h) {
    const on = needDepthTex();
    const half = QCFG.ssao.half ? 2 : 1;
    const nw = Math.max(1, Math.floor(w / half)), nh = Math.max(1, Math.floor(h / half));
    if (this.on === on && this.w === nw && this.h === nh) return;
    this.on = on; this.w = nw; this.h = nh; this.bytes = on ? nw * nh * 2 : 0;
    if (!on) return;
    for (const [t, fb] of [[this.tex, this.fb], [this.tex2, this.fb2]]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, nw, nh, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) console.warn('буфер затенения неполон: 0x' + st.toString(16));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  /* Два прохода на половинном разрешении: сам расчёт и размытие с
     сохранением краёв. Возвращает текстуру, из которой читает главный проход. */
  draw(gl) {
    if (!this.on) return this.dummy;
    const K = QCFG.ssao;
    const tanY = Math.tan(62 * D2R / 2), tanX = tanY * (HDR.w / Math.max(1, HDR.h));
    this.projInfo[0] = tanX; this.projInfo[1] = tanY; this.projInfo[2] = 0.12; this.projInfo[3] = 460;

    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(R3.skyVAO);
    gl.viewport(0, 0, this.w, this.h);

    let P = R3.ssao;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, HDR.depthTex);
    gl.uniform1i(P.u.uDepth, 0);
    gl.uniform4fv(P.u.uProjInfo, this.projInfo);
    gl.uniform2f(P.u.uTexel, 1 / this.w, 1 / this.h);
    gl.uniform4f(P.u.uParams, K.radius, K.bias, K.strength, K.power);
    gl.uniform1f(P.u.uMaxDist, K.maxDist);
    gl.uniform3fv(P.u.uKernel, this.kernel);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.DEPTH_ATTACHMENT, gl.STENCIL_ATTACHMENT]);

    const sep = !!K.blurSep;
    P = sep ? R3.ssaoBlurSep : R3.ssaoBlur;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, HDR.depthTex);
    gl.uniform1i(P.u.uDepth, 1);
    gl.uniform1i(P.u.uAO, 0);
    gl.uniform2f(P.u.uTexel, 1 / this.w, 1 / this.h);
    gl.uniform3f(P.u.uBlur, K.blur, 1 / Math.max(0.01, K.depthSigma), 0.12);
    gl.uniform4fv(P.u.uProjInfo, this.projInfo);
    /* Разделяемое размытие: сначала поперёк, потом вдоль, пинг-понг между
       теми же двумя буферами — третьего заводить не пришлось. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (sep) gl.uniform2f(P.u.uDir, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    let out = this.tex2;
    if (sep) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.bindTexture(gl.TEXTURE_2D, this.tex2);
      gl.uniform2f(P.u.uDir, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      out = this.tex;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
    R3.curGrp = null;
    return out;
  }
};

/* --- Свечение вокруг яркого: буфер с мип-цепочкой и проход порога -------- */
export const BLOOM = {
  fb: null, tex: null, dummy: null, w: 0, h: 0, on: false, levels: 0, bytes: 0,

  init(gl) {
    this.fb = gl.createFramebuffer();
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    /* LINEAR_MIPMAP_LINEAR: уровни складываются textureLod'ом, и между
       уровнями тоже нужна линейная выборка — иначе широкое свечение идёт
       ступеньками по яркости. */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    /* Заглушка «свечения нет». Юниформ-семплер обязан указывать на живую
       текстуру всегда — история с теневым семплером на нулевом слоте стоила
       этапу 04 выброшенных ночных замеров. */
    this.dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  },

  /* Уровень 0 — сторона буфера сцены, делённая на scale. Уровней столько,
     сколько задано, но не больше, чем помещается в текстуру. */
  resize(gl, w, h) {
    const K = QCFG.bloom, on = !!(Q.bloom && K.on);
    const sc = Math.max(1, K.scale | 0);
    const nw = Math.max(1, Math.floor(w / sc)), nh = Math.max(1, Math.floor(h / sc));
    const lv = Math.max(1, Math.min(K.levels | 0, 1 + Math.floor(Math.log2(Math.max(nw, nh)))));
    if (this.on === on && this.w === nw && this.h === nh && this.levels === lv) return;
    this.on = on; this.w = nw; this.h = nh; this.levels = lv;
    this.bytes = on ? Math.round(nw * nh * HDR.px * 4 / 3) : 0;
    if (!on) return;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    /* MAX_LEVEL режет цепочку: generateMipmap строит ровно те уровни, что
       складываются, а не всю лестницу до одного текселя. */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, lv - 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, HDR.fmt, nw, nh, 0, HDR.extFmt, HDR.type, null);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) { console.warn('буфер свечения неполон: 0x' + st.toString(16)); this.on = false; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  /* Один проход с порогом и уменьшением вдвое, потом мип-цепочка. Смена
     буфера отрисовки в кадре ровно одна. */
  draw(gl) {
    if (!this.on) return this.dummy;
    const K = QCFG.bloom, P = R3.bloom;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, HDR.tex);
    gl.uniform1i(P.u.uHDR, 0);
    /* Шаг отсчётов растёт вместе с шагом уменьшения: при scale 4 тринадцать
       отсчётов должны накрыть вчетверо больший квадрат исходника, иначе
       уменьшение недосэмплено и свечение мерцает на движении. */
    const st = Math.max(1, K.scale | 0) / 2;
    gl.uniform2f(P.u.uTexel, st / Math.max(1, HDR.w), st / Math.max(1, HDR.h));
    const knee = Math.max(1e-4, K.threshold * K.knee);
    gl.uniform3f(P.u.uThr, K.threshold, knee, 1 / (4 * knee));
    gl.bindVertexArray(R3.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    /* Отвязываем буфер ДО построения цепочки: текстура висит его вложением,
       и строить по ней мипы, не отцепив, — читать то, во что пишешь. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.enable(gl.DEPTH_TEST);
    R3.curGrp = null;
    return this.tex;
  }
};

/* Прицелить программу глубины и прогнать по ней геометрию. Программа несёт
   подмножество юниформ главной, поэтому вся обвязка отрисовки (drawStatic,
   drawDynamic, отсев по клеткам, альфа-тест зелени) работает без изменений:
   неизвестные юниформы дают null-локацию, а запись в неё GL игнорирует. */
export function beginDepthProgram(P, proj, view, vis) {
  const gl = GL.gl;
  R3.main = P;
  gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uProj, false, proj);
  gl.uniformMatrix4fv(P.u.uView, false, view);
  gl.uniform1i(P.u.uTex, 0);
  gl.uniform1f(P.u.uAlphaMode, 0);
  gl.uniform1f(P.u.uCut, QCFG.tex.cutSign);
  gl.uniform1f(P.u.uSkin, 0);
  gl.uniform3f(P.u.uWind, Env.windX * Env.windAmp, Env.windZ * Env.windAmp, R3.time);
  gl.uniform4f(P.u.uTint, 1, 1, 1, 1);
  gl.uniform1f(P.u.uGlossMul, Env.glossMul);
  R3.curGrp = null;
  R3.depthVis = vis;
}

/* Отдельный проход глубины (вариант «prepass» развилки этапа 04). */
export function drawDepthPrepass() {
  const gl = GL.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.preFb);
  gl.viewport(0, 0, HDR.w, HDR.h);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  Cull.gate = 0;
  beginDepthProgram(R3.depth, R3.proj, R3.view, Cull.on ? Cull.vis : null);
  drawStatic();
  drawDynamicGeom();
  Cull.gate = 1;
  R3.depthVis = null;
  R3.main = R3.mainDay;
}

/* Тонмаппинг: единственный проход, который пишет в холст. */
export function drawTone() {
  const gl = GL.gl;
  /* Постфильтр сглаживания нужен ровно там, где нет мультисэмплинга;
     свечение — там, где его посчитали. Четыре сборки, а не юниформ-ветка. */
  const fx = HDR.samples === 0 && QCFG.post.fxaa, bl = BLOOM.on;
  R3.tone = fx ? (bl ? R3.toneFxaaB : R3.toneFxaa) : (bl ? R3.tonePlainB : R3.tonePlain);
  const P = R3.tone;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, GL.canvas.width, GL.canvas.height);
  gl.useProgram(P.p);
  gl.disable(gl.DEPTH_TEST);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, HDR.tex);
  gl.uniform1i(P.u.uHDR, 0);
  if (bl) {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R3.bloomTex || BLOOM.dummy);
    gl.uniform1i(P.u.uBloom, 1);
    gl.uniform1f(P.u.uBloomK, QCFG.bloom.strength);
    gl.activeTexture(gl.TEXTURE0);
  }
  gl.uniform1f(P.u.uExposure, Env.exposure);
  gl.uniform1f(P.u.uSat, QCFG.post.sat);
  gl.uniform1f(P.u.uDither, QCFG.post.dither);
  gl.uniform2f(P.u.uTexel, 1 / Math.max(1, HDR.w), 1 / Math.max(1, HDR.h));
  gl.bindVertexArray(R3.skyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST);
  R3.curGrp = null;                    /* тонмаппинг сбил привязки текстур */
}

/* Порядок проходов кадра. Смен буфера ровно три: сцена в HDR, разрешение
   мультисэмпла, тонмаппинг в холст. После сцены глубина больше не нужна, а
   после разрешения не нужен мультисэмпловый цвет — говорим об этом драйверу
   через invalidateFramebuffer: на тайловом GPU это прямая экономия обмена с
   памятью, а не микрооптимизация. */
export function renderFrame() {
  const gl = GL.gl;
  Perf.beginFrame(gl);
  Cull.stats.calls = 0; Cull.stats.tris = 0; Cull.stats.sCalls = 0; Cull.stats.sTris = 0; Cull.stats.full = 0;
  Env.update(hour());
  R3.time = S.t;                       /* облака медленно плывут */
  setCamera([S.cam.x, S.cam.y, S.cam.z], [S.cam.tx, S.cam.ty, S.cam.tz]);

  /* Окружение: по грани кубмапы за кадр и только когда солнце сдвинулось. */
  EnvMap.check();
  EnvMap.update(gl, false);

  /* Тени от солнца: n слоёв массива с глубиной, буфер один, слой
     переключается framebufferTextureLayer. Ночью не исполняется вовсе. */
  SHADOW.draw(gl);

  /* Глубина и затенение в складках.

     В прямом рендере затенение нужно ДО того, как пиксель затенён, а глубина
     сцены появляется только после. Отсюда проход глубины вперёд. Но раз
     мультисэмплинга в буфере сцены нет, он пишет в ТУ ЖЕ текстуру глубины,
     которой пользуется сцена: она не считает глубину заново, а получает
     готовый ранний z, и проход наполовину окупает сам себя. С мультисэмплом
     так нельзя — там глубина многосэмпловая и общей быть не может. */
  R3.aoTex = null; R3.ssrTex = null;
  const wantDepth = HDR.depthMode === 'direct' && (SSAO.on || SSR.on);
  if (wantDepth) {
    /* Проход глубины пишет заодно маску отражающего — в буфер, у которого та
       же самая текстура глубины. Смен буфера от этого не прибавляется, а
       второй проход по всей геометрии не нужен. Когда отражений нет, цвет
       просто замаскирован, как и было. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, SSR.on ? SSR.maskFb : HDR.fb);
    gl.viewport(0, 0, HDR.w, HDR.h);
    if (SSR.on) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    else { gl.colorMask(false, false, false, false); gl.clear(gl.DEPTH_BUFFER_BIT); }
    Cull.gate = 0;
    beginDepthProgram(R3.depth, R3.proj, R3.view, Cull.on ? Cull.vis : null);
    drawStatic();
    drawDynamicGeom();
    Cull.gate = 1;
    if (!SSR.on) gl.colorMask(true, true, true, true);
    R3.depthVis = null;
    if (SSAO.on) R3.aoTex = SSAO.draw(gl);   /* два прохода на половинном разрешении */
    /* Отражения читают ПРОШЛЫЙ кадр: главный проход чистит цвет ниже. */
    R3.ssrTex = SSR.draw(gl);
  } else if (HDR.depthMode === 'prepass') {
    drawDepthPrepass();
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.fb);
  gl.viewport(0, 0, HDR.w, HDR.h);
  if (wantDepth) {
    /* Глубина уже посчитана проходом выше — чистим только цвет, а сравнение
       ведём на «не дальше»: повторной записи нет, ранний z отбрасывает всё
       закрытое до фрагментного шейдера. */
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.depthFunc(gl.LEQUAL);
  } else {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  beginMainLights();
  drawStatic();
  drawDynamic();
  drawSky();                           /* последним из непрозрачного, с проверкой глубины */
  drawGlows();
  if (wantDepth) gl.depthFunc(gl.LESS);
  /* Глубина больше не нужна никому: затенение прочитало её до сцены. */
  gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.DEPTH_ATTACHMENT]);

  if (HDR.samples > 0) {
    /* В режиме blit цвет и глубина разрешаются ОДНИМ вызовом: у буфера
       разрешения оба вложения на месте. Задание этапа считало, что глубину
       блитом не разрешить; на ANGLE/Metal это не так — см. QCFG.post.depthMS. */
    const mask = gl.COLOR_BUFFER_BIT | (HDR.depthMode === 'blit' ? gl.DEPTH_BUFFER_BIT : 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, HDR.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, HDR.resolveFb);
    gl.blitFramebuffer(0, 0, HDR.w, HDR.h, 0, 0, HDR.w, HDR.h, mask, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, HDR.fb);
    gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER, HDR.depthMode === 'blit'
      ? [gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT] : [gl.COLOR_ATTACHMENT0]);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
  /* Свечение вокруг яркого: читает готовый кадр (то есть ПРЕДЫДУЩИЙ проход, а
     не тот, что рисует), кладёт порог в свой буфер и строит мип-цепочку.
     Складывает уровни обратно проход тонмаппинга — отдельного прохода
     «поверх кадра» нет. */
  R3.bloomTex = BLOOM.draw(gl);
  drawTone();
  SSR.keep();                          /* матрица кадра — для перепроекции в следующем */

  Perf.endFrame(gl);
  drawOverlay2D();
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let SHADOW, SSR;
export function __init() {
  /* --- Каскадные теневые карты от солнца --------------------------------
     Каскады лежат слоями одного TEXTURE_2D_ARRAY с глубиной; слой выбирается
     framebufferTextureLayer на одном и том же буфере. Заводить буфер на каскад
     нельзя: на тайловом GPU смена буфера дороже самой отрисовки.

     Каскад накрывает срез пирамиды видимости, и накрывает его ШАРОМ, а не
     коробкой. Шар не зависит от того, куда повёрнута камера, поэтому при
     развороте размер каскада не дышит и тень не переливается. Центр шара
     привязан к сетке в пространстве света с шагом ровно в тексель каскада —
     это убирает дрожание при ходьбе: тень стоит на месте, пока камера едет
     внутри одного текселя.

     Ночью прохода нет вовсе: солнце ниже minAlt — SHADOW.on = false. */
  SHADOW = {
    fb: null, tex: null, dummy: null, n: 0, size: 0, on: false, fitOffset: [0, 0, 0], snap: true,
    mat: null,                        /* матрицы каскадов подряд, 16·n чисел */
    texel: new Float32Array(4),       /* мировых метров на тексель по каскадам */
    far: new Float32Array(4),         /* дальние границы каскадов, м */
    bytes: 0, casters: 0, calls: 0, skipped: 0,
    /* Каскады считаются ВСЕ до того, как нарисован первый: отбраковка перекрытия
       сверяет клетку с уже посчитанными каскадами, а не с нарисованными. */
    cas: [], reach: 0,
    _c: [0, 0, 0], _lr: [0, 0, 0], _lu: [0, 0, 0], _lf: [0, 0, 0],
    _view: m4(), _proj: m4(), _vp: m4(), _bias: m4(),

    init(gl) {
      this.fb = gl.createFramebuffer();
      /* Заглушка 1×1 на случай, когда каскадов нет вовсе. Юниформ uCsm обязан
         указывать на слот с массивом глубины ВСЕГДА: если оставить его на нуле,
         там окажется обычный sampler2DArray с albedo, и драйвер отвергнет весь
         вызов — «two textures of different types use the same sampler location».
         Ночью это выражалось не в ошибке на экране, а в том, что кадр молча не
         рисовался, и замер показывал вчетверо меньшее время. */
      this.dummy = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.dummy);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, 1, 1, 1);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      /* матрица сдвига из NDC [-1,1] в координаты выборки [0,1]: складываем её
         в матрицу каскада, чтобы шейдер не делал этого на каждый пиксель */
      m4id(this._bias);
      this._bias[0] = 0.5; this._bias[5] = 0.5; this._bias[10] = 0.5;
      this._bias[12] = 0.5; this._bias[13] = 0.5; this._bias[14] = 0.5;
    },

    /* Пересобрать массив слоёв. texStorage3D — хранилище неизменяемое, поэтому
       при смене профиля текстура создаётся заново, а не переспецифицируется. */
    resize(gl) {
      const n = Math.max(0, Math.min(4, Q.csm | 0));
      const size = Math.max(64, (Q.csmSize || QCFG.shadow.size) | 0);
      if (this.n === n && this.size === size && this.tex) return;
      if (this.tex) gl.deleteTexture(this.tex);
      this.n = n; this.size = size; this.tex = null; this.bytes = 0;
      this.mat = new Float32Array(16 * Math.max(1, n));
      if (!n) return;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, size, size, n);
      /* Сравнивающая выборка: семплер сам сравнивает глубину с эталоном и с
         LINEAR отдаёт долю прошедших из четырёх текселей — аппаратный PCF 2×2
         в одной выборке. Без COMPARE_REF_TO_TEXTURE sampler2DArrayShadow
         возвращал бы мусор. */
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.tex, 0, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) console.warn('буфер теней неполон: 0x' + st.toString(16));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.bytes = size * size * n * 4;
    },

    /* Матрица одного каскада. near/far — границы среза по глубине вида. */
    /* Базис света и предельная длина тени. Считается один раз на кадр: он один
       и тот же для всех каскадов, а отбраковка перекрытия сверяет каскады
       между собой именно в нём. */
    basis() {
      const K = QCFG.shadow, L = Env.sun;
      /* Вверх берём тот, что не сонаправлен с лучом, иначе m4look вырождается
         и каскад схлопывается в полосу. */
      this._upx = Math.abs(L[1]) > 0.98 ? 1 : 0; this._upy = Math.abs(L[1]) > 0.98 ? 0 : 1;
      /* правый = up × (-L), вверх = (-L) × правый — тот же базис, что построит
         m4look, но нужен здесь заранее, чтобы привязать центр к сетке */
      const ux0 = this._upx, uy0 = this._upy;
      let rx = uy0 * (-L[2]) - 0 * (-L[1]), ry = 0 * (-L[0]) - ux0 * (-L[2]), rz = ux0 * (-L[1]) - uy0 * (-L[0]);
      const l = Math.hypot(rx, ry, rz) || 1; rx /= l; ry /= l; rz /= l;
      this._lr[0] = rx; this._lr[1] = ry; this._lr[2] = rz;
      this._lu[0] = (-L[1]) * rz - (-L[2]) * ry;
      this._lu[1] = (-L[2]) * rx - (-L[0]) * rz;
      this._lu[2] = (-L[0]) * ry - (-L[1]) * rx;
      /* Насколько далеко вниз по лучу может уйти тень от того, что стоит НАД
         каскадом: та же величина, на которую отодвигается «глаз света». Ниже
         неё теней от этого каскада нет вовсе — на этом стоит отбраковка. */
      const alt = Math.max(Math.sin(Env.alt), Math.sin(K.minAlt * D2R));
      this.invSin = 1 / alt;
      this.reach = Math.min(K.casterMax, K.casterH / alt);
    },

    /* Шар каскада: центр, радиус и координаты в пространстве света. Матриц ещё
       не строит — они нужны только в момент отрисовки, а координаты нужны всем
       каскадам сразу. */
    fitSphere(i, near, far) {
      const size = this.size;
      /* Центр лежит на оси вида: приравняв расстояния до ближнего и дальнего
         углов, получаем zc; если он ушёл за дальнюю границу, срез широкий и
         шар садится на дальний круг. */
      const tanY = Math.tan(62 * D2R / 2), tanX = tanY * (HDR.w / Math.max(1, HDR.h));
      const k2 = tanX * tanX + tanY * tanY;
      let zc = (far + near) * (1 + k2) * 0.5;
      if (zc > far) zc = far;
      if (zc < near) zc = near;
      const rn = Math.hypot(near * tanX, near * tanY), rf = Math.hypot(far * tanX, far * tanY);
      const r = Math.max(Math.hypot(zc - near, rn), Math.hypot(far - zc, rf));

      /* fitOffset — только для проверки стабилизации (tools/shadow-check.mjs):
         каскад ставится так, будто камера сдвинулась, а вид остаётся прежним.
         Тогда любое дрожание тени видно прямым сравнением двух кадров. */
      const e = R3.eye, f = R3.fwd, fo = this.fitOffset;
      let cx = e[0] + f[0] * zc + fo[0], cy = e[1] + f[1] * zc + fo[1], cz = e[2] + f[2] * zc + fo[2];

      /* Привязка центра к сетке с шагом в тексель — в пространстве света и
         только по двум осям, поперёк луча. Вдоль луча квантовать нечего. */
      const L = Env.sun, R_ = this._lr, U = this._lu;
      const texel = 2 * r / size;
      let a = cx * R_[0] + cy * R_[1] + cz * R_[2];
      let b = cx * U[0] + cy * U[1] + cz * U[2];
      const c = cx * (-L[0]) + cy * (-L[1]) + cz * (-L[2]);
      if (this.snap) {                   /* snap = false — только для проверки */
        a = Math.round(a / texel) * texel;
        b = Math.round(b / texel) * texel;
      }
      cx = R_[0] * a + U[0] * b + (-L[0]) * c;
      cy = R_[1] * a + U[1] * b + (-L[1]) * c;
      cz = R_[2] * a + U[2] * b + (-L[2]) * c;

      /* Отодвигаем «глаз света» так, чтобы в объём попало всё, что может
         бросить сюда тень. Чем ниже солнце, тем длиннее тень — но не бесконечно:
         за casterMax считать уже незачем, а глубина каскада не бесплатна. */
      const back = this.reach + r;
      const cc = this.cas[i] || (this.cas[i] = {});
      cc.r = r; cc.texel = texel; cc.far = far; cc.back = back;
      cc.cx = cx; cc.cy = cy; cc.cz = cz;
      cc.a = a; cc.b = b;                             /* координаты центра поперёк луча */
      cc.s = cx * L[0] + cy * L[1] + cz * L[2];       /* и вдоль него */
      return r;
    },

    /* Матрицы каскада. Объём: квадрат 2r поперёк луча и глубина от «глаза
       света» до дальней стороны шара. Приёмники каскада лежат в шаре — шар
       строился вокруг среза пирамиды, — а тенеобразующие могут стоять выше,
       на что и отодвинут глаз (back = reach + r). */
    buildMat(i) {
      const c = this.cas[i], L = Env.sun;
      const farPlane = c.back + c.r;
      m4look(this._view, c.cx + L[0] * c.back, c.cy + L[1] * c.back, c.cz + L[2] * c.back,
             c.cx, c.cy, c.cz, this._upx, this._upy, 0);
      m4ortho(this._proj, -c.r, c.r, -c.r, c.r, 0.02, farPlane);
      m4mul(this._vp, this._proj, this._view);
      m4mul(R3.tmp, this._bias, this._vp);
      this.mat.set(R3.tmp, i * 16);
      this.texel[i] = c.texel;
      this.far[i] = c.far;
      this._c[0] = c.cx; this._c[1] = c.cy; this._c[2] = c.cz;
    },

    /* Проход теней целиком. Возвращает false, если он не исполнялся. */
    draw(gl) {
      const K = QCFG.shadow;
      this.on = false; this.casters = 0; this.calls = 0;
      /* Профиль мог смениться между кадрами (или примениться уже после
         initRenderer, как на загрузке): resize сам ничего не делает, когда
         число каскадов и размер те же. */
      this.resize(gl);
      if (!this.n || !this.tex) return false;
      /* Ночью солнца нет — и прохода нет. Не «тень нулевой силы», а не
         исполняется вовсе: ни отрисовки, ни смены буфера. */
      if (Env.alt < K.minAlt * D2R) return false;

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.viewport(0, 0, this.size, this.size);
      /* Отсекаем передние грани: акне самозатенения на плоских стенах уходит
         вместе с ними, а замкнутая геометрия района от этого не страдает. */
      if (K.frontCull) gl.cullFace(gl.FRONT);
      const c0 = Cull.stats.calls, prevSt = Cull.st, prevGate = Cull.gate;
      Cull.st = 0; Cull.gate = 0;

      /* Сначала считаются ВСЕ каскады, и только потом рисуется первый: без этого
         отбраковке перекрытия не с чем сверяться. */
      this.basis();
      let near = 0.12;
      for (let i = 0; i < this.n; i++) {
        const far = K.splits[i] !== undefined ? K.splits[i] : K.splits[K.splits.length - 1];
        this.fitSphere(i, near, far);
        near = far;
      }
      near = 0.12;
      this.skipped = 0;
      for (let i = 0; i < this.n; i++) {
        const far = this.cas[i].far;
        this.buildMat(i);
        /* Клетки, попадающие в этот каскад: по световым осям с запасом, минус
           те, что целиком уместились в один из предыдущих каскадов. */
        if (Cull.n) this.skipped += Cull.markShadow(this._lr, this._lu, Env.sun, this.cas, i,
                                                    QCFG.cull.shadowPad, K.casterCull, this.invSin, this.reach);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.tex, 0, i);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        beginDepthProgram(R3.shadow, this._proj, this._view, null);
        const vis = Cull.on && Cull.n ? Cull.visSh : null;
        const idm = m4id(R3.model);
        for (const bt of Static.batches) {
          if (bt.alpha) continue;
          drawMesh(bt.gpu, TX[bt.name], idm, { cells: vis });
        }
        /* Зелень и знаки — двусторонние: у кроны нет изнанки, и с отсечением
           граней она бросала бы тень наполовину. */
        gl.disable(gl.CULL_FACE);
        gl.uniform1f(R3.main.u.uCut, QCFG.tex.cutVeg);
        for (const bt of Static.batches) if (bt.alpha)
          drawMesh(bt.gpu, TX[bt.name], idm, { alpha: true, cells: vis });
        gl.uniform1f(R3.main.u.uCut, QCFG.tex.cutSign);
        gl.enable(gl.CULL_FACE);
        /* Жители и техника бросают тень только в ближние каскады: в дальнем
           человек занимает полтекселя, а стоит целого прохода по скелету. */
        if (i < K.dynCascades) drawDynamicGeom();
        near = far;
      }

      if (K.frontCull) gl.cullFace(gl.BACK);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      R3.main = R3.mainDay;
      R3.depthVis = null;
      Cull.st = prevSt; Cull.gate = prevGate;
      this.calls = Cull.stats.calls - c0;
      this.on = true;
      return true;
    }
  };

  /* --- Отражения в экранном пространстве: маска, буфер и марш по лучу ------ */
  SSR = {
    fb: null, tex: null, dummy: null, maskFb: null, maskTex: null,
    w: 0, h: 0, mw: 0, mh: 0, on: false, bytes: 0, hasPrev: false,
    prevVP: m4(), reproj: m4(), _inv: m4(), projInfo: new Float32Array(4),

    init(gl) {
      this.fb = gl.createFramebuffer();
      this.maskFb = gl.createFramebuffer();
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.maskTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      /* Заглушка «отражений нет»: альфа ноль — уверенность ноль. */
      this.dummy = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.dummy);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    },

    /* Буфер отражений — половина стороны буфера сцены; маска — полная, потому
       что делит вложение глубины с проходом глубины, а вложения одного буфера
       обязаны совпадать по размеру. */
    resize(gl, w, h) {
      const on = !!(Q.ssr && QCFG.ssr.on && HDR.depthMode === 'direct');
      const half = QCFG.ssr.half ? 2 : 1;
      const nw = Math.max(1, Math.floor(w / half)), nh = Math.max(1, Math.floor(h / half));
      if (this.on === on && this.w === nw && this.h === nh && this.mw === w && this.mh === h) return;
      this.on = on; this.w = nw; this.h = nh; this.mw = w; this.mh = h; this.hasPrev = false;
      this.bytes = on ? nw * nh * 8 + w * h : 0;
      if (!on) return;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, nw, nh, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      const st1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      /* Маска и глубина — на одном буфере: проход глубины пишет их одним
         заходом, и лишней смены буфера отрисовки в кадре не появляется. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.maskTex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, HDR.depthTex, 0);
      const st2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st1 !== gl.FRAMEBUFFER_COMPLETE || st2 !== gl.FRAMEBUFFER_COMPLETE) {
        console.warn('буфер отражений неполон: 0x' + st1.toString(16) + ' / 0x' + st2.toString(16));
        this.on = false;
      }
    },

    /* Марш по лучу. Идёт ДО главного прохода: глубина уже посчитана, а в
       HDR.tex ещё лежит прошлый кадр — его-то отражение и читает. */
    draw(gl) {
      if (!this.on || !this.hasPrev) return null;
      const K = QCFG.ssr, P = R3.ssr;
      const tanY = Math.tan(62 * D2R / 2), tanX = tanY * (HDR.w / Math.max(1, HDR.h));
      this.projInfo[0] = tanX; this.projInfo[1] = tanY; this.projInfo[2] = 0.12; this.projInfo[3] = 460;
      /* Из вида ЭТОГО кадра в клип ПРОШЛОГО. Третий столбец обратной матрицы
         вида меняет знак: у восстановленной позиции ось z смотрит вперёд, а у
         вида GL — назад. */
      m4invRT(this._inv, R3.view);
      this._inv[8] = -this._inv[8]; this._inv[9] = -this._inv[9]; this._inv[10] = -this._inv[10];
      m4mul(this.reproj, this.prevVP, this._inv);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.viewport(0, 0, this.w, this.h);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, HDR.depthTex);
      gl.uniform1i(P.u.uDepth, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, HDR.tex);
      gl.uniform1i(P.u.uColor, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.uniform1i(P.u.uMask, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform4fv(P.u.uProjInfo, this.projInfo);
      gl.uniform2f(P.u.uTexel, 1 / this.w, 1 / this.h);
      gl.uniform4f(P.u.uParams, K.maxDist, K.thickness, K.edge, K.mask);
      gl.uniformMatrix4fv(P.u.uReproj, false, this.reproj);
      gl.bindVertexArray(R3.skyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
      R3.curGrp = null;
      return this.tex;
    },

    /* Матрица кадра запоминается в конце: следующий кадр перепроецирует ею
       точку попадания. */
    keep() { if (this.on) { this.prevVP.set(R3.viewProj); this.hasPrev = true; } }
  };
}
