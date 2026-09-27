/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «18. Движение Олега и велосипеда», строки 9132–9329.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { angLerp, clamp, dist2, lerp, pick, rnd } from '../core/util.js';
import { circleRect, freeSpot, solidsNear } from './collision.js';
import { addHeat, addMoney, floater, fx3, hurt, shake, staminaMult, toast, witnessed } from './effects.js';
import { Input, K } from './input.js';
import { carHit, tickGait, tickGaze } from './npcs.js';
import { BAL, S } from './state.js';
import { GAITS } from '../render/characters.js';
import { POTHOLES, W } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 18. Движение Олега и велосипеда                                      */
/* ------------------------------------------------------------------ */
export function moveWithCollision(e, dt, r, isBike) {
  e.x += e.vx * dt; e.z += e.vz * dt;
  let hard = null, impact = 0;
  for (const s of solidsNear(e.x, e.z, r + 1)) {
    const c = circleRect(e.x, e.z, r, s);
    if (!c || s.soft) continue;
    e.x += c.nx * c.push; e.z += c.nz * c.push;
    const vn = e.vx * c.nx + e.vz * c.nz;
    if (vn < 0) {
      const bounce = isBike ? 0.18 : 0.05;
      e.vx -= (1 + bounce) * vn * c.nx; e.vz -= (1 + bounce) * vn * c.nz;
      if (-vn > impact) { impact = -vn; hard = s; }
    }
  }
  if (hard && impact > 4.2) {
    if (isBike) {
      S.bike.speed *= 0.25;
      damageBike(impact * 0.9);
      hurt(impact * 0.5, 'Олег познакомился со стеной ближе, чем планировал.');
      S.stats.crashes++;
      Audio2.crash(); shake(9);
      fx3(e.x, 0.8, e.z, 'spark', 9);
      if (hard.fragile) breakProp(hard);
    } else { Audio2.thud(); shake(3); }
  } else if (hard && impact > 1.6 && isBike) {
    Audio2.thud(); shake(2);
    if (hard.fragile && impact > 3) breakProp(hard);
  }
  /* Кузов машины — тоже препятствие: раньше Олег проходил сквозь неё насквозь. */
  for (const c of S.cars) {
    if (dist2(e.x, e.z, c.x, c.z) > 49) continue;
    const h = carHit(c, e.x, e.z, r + 0.12);
    if (!h) continue;
    e.x += h.nx * h.push; e.z += h.nz * h.push;
    const vn = e.vx * h.nx + e.vz * h.nz;
    if (vn < 0) { e.vx -= vn * h.nx; e.vz -= vn * h.nz; }
  }
  e.x = clamp(e.x, 0.6, W.x - 0.6); e.z = clamp(e.z, 0.6, W.z - 0.6);
  return { impact, hit: hard };
}
export function damageBike(v) {
  S.bike.cond = clamp(S.bike.cond - v, 0, 100);
  if (S.bike.cond < 20) toast('Велосипед скрипит как обвинение', 'bad', 1800);
}
export function breakProp(s) {
  if (s.ref && s.ref.broken) return;
  if (s.ref) s.ref.broken = true;
  fx3(s.x + s.w / 2, 0.8, s.z + s.d / 2, 'spark', 12, [1, .55, .2]);
  Audio2.crash();
  addHeat(s.kind === 'kiosk' ? 26 : 12, s.kind === 'kiosk' ? 'Ты снёс киоск. Владелец уже звонит всем' : 'Порча чужого имущества');
  witnessed(s.x, s.z);
  addMoney(s.kind === 'kiosk' ? -45 : -15, 'Ущерб');
  toast(pick(['«Это был не я, это был бордюр»', '«Оно само стояло на пути»', '«Запишите на бригаду»']), 'bad', 2200);
}
export function inputVec() {
  let f = 0, r = 0;
  if (Input.any(K.up)) f += 1;
  if (Input.any(K.down)) f -= 1;
  if (Input.any(K.left)) r -= 1;
  if (Input.any(K.right)) r += 1;
  const p = S.player;
  if (p.drunk > 45 && Math.sin(S.t * 0.9) > 0.72) r *= -1;
  const l = Math.hypot(f, r);
  if (l > 0) { f /= l; r /= l; }
  return { f, r, len: l ? 1 : 0 };
}
export function movePlayerOnFoot(dt) {
  const p = S.player, v = inputVec();
  const drunkF = p.drunk / 100;
  let dx, dz;
  if (S.camFollow) {
    /* Руль у персонажа: A/D разворачивают Олега, камера сама едет за спину.
       W/S — вперёд и назад по его направлению, боком не ходим. */
    const turn = (3.4 - (Input.any(K.sprint) ? 0.9 : 0)) * (1 - drunkF * 0.3);
    /* Знак важен: рост yaw поворачивает взгляд влево (вперёд — (sin, cos),
       экранное «право» — (-cos, sin)), поэтому D должен yaw уменьшать. */
    p.yaw -= v.r * turn * dt;
    dx = Math.sin(p.yaw) * v.f; dz = Math.cos(p.yaw) * v.f;
  } else {
    /* Свободная камера: движение относительно взгляда. */
    const yaw = S.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    dx = fx * v.f + rx * v.r; dz = fz * v.f + rz * v.r;
  }
  const sprint = Input.any(K.sprint) && p.stamina > 3 && v.len > 0;
  let maxSp = (sprint ? BAL.sprint : BAL.walk) * (1 - drunkF * 0.22) * (p.stamina < 15 ? 0.72 : 1) * (p.health < 30 ? 0.85 : 1);

  if (Input.anyHit(K.brake) && p.dodgeCd <= 0 && p.stamina >= BAL.dodgeCost && v.len > 0) {
    p.dodge = 0.26; p.dodgeCd = 0.85; p.stamina -= BAL.dodgeCost; p.invuln = 0.34;
    let ddx = dx, ddz = dz;
    if (Math.hypot(ddx, ddz) < 0.2) { ddx = Math.sin(p.yaw); ddz = Math.cos(p.yaw); }
    p.vx = ddx * 9; p.vz = ddz * 9; Audio2.noise(0.12, 0.13, 300, 1800);
    fx3(p.x, 0.2, p.z, 'dust', 7);
  }
  const acc = BAL.walkAcc * (p.dodge > 0 ? 0.2 : 1);
  p.vx += dx * acc * dt; p.vz += dz * acc * dt;
  if (drunkF > 0.15) { p.vx += Math.sin(S.t * 3.1) * 1.6 * drunkF * dt; p.vz += Math.cos(S.t * 2.3) * 1.5 * drunkF * dt; }
  const sp = Math.hypot(p.vx, p.vz);
  const lim = p.dodge > 0 ? 10 : maxSp;
  if (sp > lim) { p.vx = p.vx / sp * lim; p.vz = p.vz / sp * lim; }
  const fr = Math.exp(-BAL.walkFric * dt);
  p.vx *= fr; p.vz *= fr;
  if (sprint) p.stamina = clamp(p.stamina - BAL.stamDrain * dt, 0, 100);
  else p.stamina = clamp(p.stamina + BAL.stamRegen * (v.len > 0 ? 0.45 : 1) * dt * staminaMult(), 0, 100);
  if (!S.camFollow && v.len > 0) p.yaw = angLerp(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-16 * dt));
  tickGait(p, dt, GAITS.oleg, true);       /* курс у Олега свой: рулит игрок */
  tickGaze(p, dt);
  moveWithCollision(p, dt, p.r, false);
  p.dodge = Math.max(0, p.dodge - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  S.bike.x = S.bike.x; /* велосипед стоит на месте */
}
export function moveBike(dt) {
  const p = S.player, b = S.bike;
  const drunkF = p.drunk / 100, cond = b.cond / 100;
  const boost = Input.any(K.sprint) && p.stamina > 2;
  let maxSp = (boost ? BAL.bikeBoost : BAL.bikeMax) * (0.62 + 0.38 * cond);
  if (S.upgrades.frame) maxSp *= 1.14;
  if (S.upgrades.tires) maxSp *= 1.05;
  maxSp *= (1 - drunkF * 0.18) * (p.stamina < 12 ? 0.75 : 1);

  let thr = 0;
  if (Input.any(K.up)) thr = 1;
  if (Input.any(K.down)) thr = -0.5;
  let steer = 0;
  if (Input.any(K.left)) steer -= 1;
  if (Input.any(K.right)) steer += 1;
  if (drunkF > 0.45 && Math.sin(S.t * 0.9) > 0.72) steer *= -1;

  b.speed += thr * BAL.bikeAcc * (0.6 + 0.4 * cond) * dt;
  if (Input.any(K.brake)) {
    const before = b.speed;
    b.speed -= Math.sign(b.speed) * BAL.bikeBrake * dt;
    if (Math.sign(before) !== Math.sign(b.speed)) b.speed = 0;
    if (Math.abs(before) > 4 && Math.random() < 0.25) Audio2.skid();
  }
  b.speed *= Math.exp(-BAL.bikeDrag * dt);
  b.speed = clamp(b.speed, -3, maxSp);
  const turn = BAL.bikeTurn * (S.upgrades.tires ? 1.16 : 1) * clamp(Math.abs(b.speed) / 4, 0, 1.25);
  b.yaw -= steer * turn * dt * Math.sign(b.speed || 1);
  b.yaw += Math.sin(S.t * 5.5) * (drunkF * 0.5 + (1 - cond) * 0.3) * 0.4 * dt;
  b.lean = lerp(b.lean, -steer * clamp(Math.abs(b.speed) / 8, 0, 1) * 0.32, dt * 6);
  /* угол руля: вилка доворачивается плавно, на скорости — меньше */
  b.steer = lerp(b.steer || 0, -steer * (0.42 - clamp(Math.abs(b.speed) / 14, 0, 0.28)), dt * 8);

  if (boost && Math.abs(b.speed) > 1.5) p.stamina = clamp(p.stamina - BAL.stamDrain * 0.85 * dt, 0, 100);
  else p.stamina = clamp(p.stamina + BAL.stamRegen * 0.55 * dt * staminaMult(), 0, 100);

  if (b.cond < 45 && b.chain <= 0 && Math.random() < 0.06 * dt * (1 - cond)) {
    b.chain = 1; toast('Слетела цепь! F — поправить', 'bad'); Audio2.nope();
  }
  if (b.chain > 0) {
    b.speed *= Math.exp(-3.4 * dt);
    if (Input.anyHit(K.tool)) {
      b.chain = 0; toast('Цепь на месте. «Она просто хотела внимания»', 'good');
      Audio2.screwdr(); p.stamina = clamp(p.stamina - 6, 0, 100);
    }
  }
  p.vx = Math.sin(b.yaw) * b.speed; p.vz = Math.cos(b.yaw) * b.speed;
  b.wheel += b.speed * dt * 2.6;
  S.stats.dist += Math.abs(b.speed) * dt;
  p.yaw = b.yaw;
  moveWithCollision(p, dt, p.r + 0.14, true);
  b.x = p.x; b.z = p.z;
  for (const h of POTHOLES) {
    if (dist2(p.x, p.z, h.x, h.z) < (h.r + 0.5) * (h.r + 0.5) && Math.abs(b.speed) > 3) {
      if (!h.cd || S.t - h.cd > 1.4) {
        h.cd = S.t;
        b.speed *= 0.55; damageBike(rnd(3, 8)); shake(7); Audio2.thud();
        p.stamina = clamp(p.stamina - 5, 0, 100);
        fx3(p.x, 0.2, p.z, 'dust', 8);
        if (Math.random() < 0.3) floater(p.x, 2, p.z, pick(['Ой', 'Яма!', 'Спасибо, город']), '#ff8a1f');
      }
    }
  }
}
export function tryMountBike() {
  const p = S.player, b = S.bike;
  if (p.onBike) {
    p.onBike = false; b.parked = true; b.speed = 0;
    let nx = p.x + Math.sin(p.yaw + 1.4) * 1.1, nz = p.z + Math.cos(p.yaw + 1.4) * 1.1;
    if (!freeSpot(nx, nz, 0.5)) { nx = p.x; nz = p.z; }
    b.x = nx; b.z = nz;
    Audio2.click(); toast('Слез с велосипеда', 'info', 1300);
    return true;
  }
  if (dist2(p.x, p.z, b.x, b.z) < 3.2 * 3.2) {
    p.onBike = true; b.parked = false; b.yaw = p.yaw; b.speed = 0; b.x = p.x; b.z = p.z;
    Audio2.select();
    toast(pick(['«Велосипед служебный. То есть мой, но используется по службе»', 'На колёсах веселее', 'Поехали']), 'info', 2000);
    return true;
  }
  return false;
}
