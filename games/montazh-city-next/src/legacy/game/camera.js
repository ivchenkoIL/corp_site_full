/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «19. Камера от третьего лица», строки 9330–9386.
   ===================================================================== */
import { angLerp, clamp, lerp, rnd } from '../core/util.js';
import { circleRect, solidsNear } from './collision.js';
import { Input } from './input.js';
import { S } from './state.js';

/* ------------------------------------------------------------------ */
/* 19. Камера от третьего лица                                          */
/* ------------------------------------------------------------------ */
export function updateCamera(dt) {
  const c = S.cam, p = S.player;
  if (Input.locked || Input.rdrag) {
    if (Math.abs(Input.dx) > 0.5 || Math.abs(Input.dy) > 0.5) c.manual = 1.6;
    c.yaw -= Input.dx * 0.0027;
    c.pitch = clamp(c.pitch + Input.dy * 0.0022, -0.35, 1.15);
  }
  if (Input.wheel) c.dist = clamp(c.dist + Input.wheel * 0.6, 2.6, 9);
  /* Камера за спиной: сама доворачивается туда, куда смотрит Олег.
     Мышь временно перехватывает управление, потом обзор плавно возвращается. */
  if (S.camFollow) {
    c.manual = Math.max(0, c.manual - dt);
    if (c.manual <= 0) {
      const speed = p.onBike ? Math.abs(S.bike.speed) : Math.hypot(p.vx, p.vz);
      const k = 5.0 + clamp(speed, 0, 8) * 0.55;
      c.yaw = angLerp(c.yaw, p.yaw + Math.PI, 1 - Math.exp(-k * dt));
      c.pitch = lerp(c.pitch, p.onBike ? 0.20 : 0.26, 1 - Math.exp(-2.2 * dt));
    }
  }

  const tgtDist = c.dist * (p.onBike ? 1.15 : 1);
  const ty = (p.onBike ? 1.25 : 1.35);
  c.tx = lerp(c.tx, p.x, 1 - Math.exp(-14 * dt));
  c.ty = lerp(c.ty, ty, 1 - Math.exp(-8 * dt));
  c.tz = lerp(c.tz, p.z, 1 - Math.exp(-14 * dt));
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  let ex = c.tx + Math.sin(c.yaw) * cp * tgtDist;
  let ez = c.tz + Math.cos(c.yaw) * cp * tgtDist;
  let ey = c.ty + sp * tgtDist + 0.5;
  /* не даём камере уехать в стену */
  let best = 1;
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    const px = lerp(c.tx, ex, t), pz = lerp(c.tz, ez, t);
    let blocked = false;
    for (const s of solidsNear(px, pz, 0.6)) {
      if (s.kind === 'edge') continue;
      const hh = s.kind === 'building' && s.ref ? s.ref.h : 3;
      if (lerp(c.ty, ey, t) > hh + 0.3) continue;
      if (circleRect(px, pz, 0.45, s)) { blocked = true; break; }
    }
    if (blocked) { best = Math.max(0.25, (i - 1) / 6); break; }
  }
  ex = lerp(c.tx, ex, best); ez = lerp(c.tz, ez, best); ey = lerp(c.ty + 0.4, ey, best);
  c.x = lerp(c.x, ex, 1 - Math.exp(-18 * dt));
  c.y = lerp(c.y, Math.max(0.6, ey), 1 - Math.exp(-14 * dt));
  c.z = lerp(c.z, ez, 1 - Math.exp(-18 * dt));
  if (S.shake > 0.001) {
    c.x += rnd(-S.shake, S.shake) * 0.4; c.y += rnd(-S.shake, S.shake) * 0.3; c.z += rnd(-S.shake, S.shake) * 0.4;
    S.shake *= Math.exp(-6 * dt);
  }
}
