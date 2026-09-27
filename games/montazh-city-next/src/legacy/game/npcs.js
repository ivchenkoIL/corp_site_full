/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «21. Жители района», строки 9453–10014.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { TAU, angLerp, clamp, dist, dist2, lerp, mulberry32, pick, rnd } from '../core/util.js';
import { circleRect, freeSpot, solidsNear } from './collision.js';
import { addHeat, addMoney, addRep, floater, hurt, shake, toast, witnessed } from './effects.js';
import { damageBike } from './movement.js';
import { CREW_LINES } from './phone.js';
import { BAL, S, TOOLS } from './state.js';
import { GAIT, GAITS, IDLES } from '../render/characters.js';
import { CAR_SPEC } from '../render/vehicles.js';
import { Dlg } from '../ui/dialog.js';
import { __set_hudToolSig, hudToolSig } from '../ui/hud.js';
import { ROADS_X, ROADS_Z, ROAD_W, W, surfY } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 21. Жители района                                                    */
/* ------------------------------------------------------------------ */
export const CAR_TINTS = [[.78,.24,.26],[.28,.46,.72],[.86,.84,.78],[.34,.34,.4],[.8,.62,.26],[.28,.6,.42],[.5,.32,.7]];
export const CAR_KINDS = ['sedan','sedan','van','pickup','sedan'];
/* Ближайшая точка кузова к точке (x, z) и вектор наружу. */
export function carHit(c, x, z, r) {
  const dx = x - c.x, dz = z - c.z;
  const box = CAR_BOX[c.kind] || [2.1, 0.9];
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const lo = dx * fx + dz * fz, la = -dx * fz + dz * fx;      /* вдоль и поперёк кузова */
  const cl = clamp(lo, -box[0], box[0]), ca = clamp(la, -box[1], box[1]);
  let ex = lo - cl, ez = la - ca, d = Math.hypot(ex, ez);
  if (d < 1e-4) {                                             /* центр внутри — выходим по ближней грани */
    const pl = box[0] - Math.abs(lo), pa = box[1] - Math.abs(la);
    if (pl < pa) { ex = lo >= 0 ? 1 : -1; ez = 0; d = -pl; }
    else { ex = 0; ez = la >= 0 ? 1 : -1; d = -pa; }
  } else { ex /= d; ez /= d; }
  if (d >= r) return null;
  return { push: r - d, nx: ex * fx - ez * fz, nz: ex * fz + ez * fx };
}
export function spawnTraffic() {
  S.cars.length = 0;
  const R = mulberry32(4242);
  /* Раскладываем по полосе с равным шагом и небольшим разбросом: при случайных
     координатах две машины одной полосы стартовали в полуметре друг от друга
     и весь проезд ехали слипшись. */
  const lane = (n, span, put) => {
    for (let i = 0; i < n; i++) put((i + 0.15 + R() * 0.7) * (span / n));
  };
  for (const z of ROADS_Z) for (const east of [true, false])
    lane(east ? 3 : 2, W.x, s0 => S.cars.push({
      x: s0, z: z + (east ? 2.6 : -2.6), yaw: east ? Math.PI / 2 : -Math.PI / 2,
      sp: 7 + R() * 4, base: 0, wheel: 0, horn: 0,
      kind: CAR_KINDS[Math.floor(R() * CAR_KINDS.length)], tint: CAR_TINTS[Math.floor(R() * CAR_TINTS.length)] }));
  for (const x of ROADS_X) for (const south of [true, false])
    lane(2, W.z, s0 => S.cars.push({
      z: s0, x: x + (south ? -2.6 : 2.6), yaw: south ? 0 : Math.PI,
      sp: 7 + R() * 4, base: 0, wheel: 0, horn: 0,
      kind: CAR_KINDS[Math.floor(R() * CAR_KINDS.length)], tint: CAR_TINTS[Math.floor(R() * CAR_TINTS.length)] }));
  for (const c of S.cars) c.base = c.sp;
}
export function spawnDogs() {
  S.dogs.length = 0;
  /* Третье число — характер: злая собака кусается, остальные только лают и
     виляют хвостом. Кусачих на район две из шести. */
  const spots = [[55,56,0],[81,54,1],[125,62,0],[51,109,0],[144,107,1],[31,134,0]];
  for (const [x, z, cross] of spots) S.dogs.push({ x, z, hx: x, hz: z, vx: 0, vz: 0, yaw: 0, state: 'wander', t: rnd(0,3), bite: 0, scare: 0, bark: rnd(2,8), phase: 0,
    wag: 0, barkK: 0, pant: 0, hy: 0, hp: 0, cross: !!cross, warn: 0, growl: 0 });
}
export const HOOL_LINES = {
  beggar: ['Слышь, монтажник, мелочь есть? На проезд.', 'Дай полтинник — я тебе опору покараулю.', 'Тут проход платный, я сам вчера узнал.'],
  thief:  ['Красивый шуруповёрт. Дай подержать.', 'Я только посмотрю. Издалека. В другом дворе.', 'Это не кража, это тест-драйв.'],
  rocker: ['Опора-то шатается! Смотри как!', 'А если так? А если вот так?', 'Я проверяю крепёж. Бесплатно.']
};
export function spawnHools() {
  S.hools.length = 0;
  const defs = [
    { type: 'beggar', x: 63, z: 56, name: 'Клянчила' },
    { type: 'thief',  x: 75, z: 49, name: 'Щипач' },
    { type: 'rocker', x: 156, z: 91, name: 'Качала' },
    { type: 'beggar', x: 75, z: 112, name: 'Клянчила-2' },
    { type: 'thief',  x: 136, z: 55, name: 'Щипач-2' },
    { type: 'rocker', x: 122, z: 95, name: 'Качала-2' }
  ];
  for (const d of defs) S.hools.push({ type: d.type, name: d.name, x: d.x, z: d.z, hx: d.x, hz: d.z,
    vx: 0, vz: 0, state: 'idle', t: rnd(0,3), cool: 0, say: 0, line: '', phase: 0, yaw: 0, holds: null, flee: 0, contact: 0,
    gait: 'hool', seed: Math.random() });
}
export function spawnGrans() {
  S.grans.length = 0;
  const spots = [[41,35.6],[63,35.6],[83,35.6],[62.5,110],[138,119]];
  /* бабушки смотрят во двор и ходят мелким шагом — если вдруг встанут */
  for (const [x, z] of spots) S.grans.push({ x, z, say: 0, line: '', yaw: Math.PI, phase: 0, gait: 'gran', seed: Math.random() });
}
export const PED_LINES = ['Молодой человек, тут вообще-то люди ходят.', 'Опять провода тянут…', 'А интернет когда починят?',
  'Осторожнее, я с пакетами!', 'Камера смотрит? А то у меня велосипед увели.', 'Здрасьте. До свидания.', 'Вы из ЖЭКа? Нет? Жаль.',
  /* телефон есть у всех, и половина двора вечно с кем-то разговаривает */
  '…да не ору я! Это ты орёшь!', '…алло? Алло! Ничего не слышно, я во дворе.',
  '…сказали, придут. Сказали — придут, я жду.', '…Егорову звонила. Он сказал, у него ТикТок.',
  '…передай Косте, что он опять уехал.'];
/* разные характеры в толпе — двор перестаёт ходить строем */
export const PED_GAITS = ['norm', 'norm', 'norm', 'vanya', 'kostya', 'boris', 'gran'];
export function spawnPeds() {
  S.peds.length = 0;
  const R = mulberry32(31337);
  const spots = [];
  for (const z of ROADS_Z) for (let i = 0; i < 7; i++) spots.push([10 + R() * (W.x - 20), z + (R() < .5 ? -1 : 1) * (ROAD_W / 2 + 1.3)]);
  for (const x of ROADS_X) for (let i = 0; i < 5; i++) spots.push([x + (R() < .5 ? -1 : 1) * (ROAD_W / 2 + 1.3), 10 + R() * (W.z - 20)]);
  spots.push([56,54],[68,56],[47,40],[78,55],[62,106],[74,94],[134,109],[122,91],[128,56],[40,94],[55,124],[150,106]);
  for (const [x, z] of spots) {
    if (!freeSpot(x, z, 0.6)) continue;
    /* walk — скорость блуждания; поле sp занято нормировкой скорости в tickGait */
    S.peds.push({ x, z, hx: x, hz: z, vx: 0, vz: 0, yaw: R() * TAU, phase: R() * 6, t: R() * 3,
      say: 0, line: '', down: 0, hop: 0, mesh: Math.floor(R() * 8), walk: 0.95 + R() * 0.75,
      gait: PED_GAITS[Math.floor(R() * PED_GAITS.length)], seed: R() });
    if (S.peds.length >= 30) break;
  }
}
/* Один шаг «жизни» пешего: фаза шага, сглаженные скорость и поворот,
   продольное ускорение, время для покоя и запуск холостых движений.
   Заменяет пары строк «phase += ...; yaw = atan2(...)» во всех апдейтах.
   keepYaw — для игрока и для тех, кто рулит корпусом сам.                */
export function tickGait(e, dt, g, keepYaw) {
  g = g || GAIT(e.gait);
  if (e.seed === undefined) e.seed = Math.random();          /* личный сдвиг фаз */
  e.time = (e.time || 0) + dt;
  const v = Math.hypot(e.vx || 0, e.vz || 0);
  e.phase = ((e.phase || 0) + v * dt * g.cad) % 1e4;
  e.sp = lerp(e.sp || 0, clamp(v / g.vmax, 0, 1), 1 - Math.exp(-5.5 * dt));   /* поза догоняет скорость */
  e.acc = lerp(e.acc || 0, (v - (e.v0 || 0)) / Math.max(dt, 1e-3), 1 - Math.exp(-7 * dt));
  e.v0 = v;
  if (!keepYaw && v > 0.1) e.yaw = angLerp(e.yaw || 0, Math.atan2(e.vx, e.vz), 1 - Math.exp(-g.turn * dt));
  /* холостое движение — только когда человек реально стоит */
  if (e.idleP !== undefined && e.idleP < 1) e.idleP = Math.min(1, e.idleP + dt / IDLES[e.idle || 0].len);
  if (e.sp < 0.05) {
    e.idleT = (e.idleT === undefined ? rnd(2, 7) : e.idleT) - dt;
    if (e.idleT <= 0) { e.idleT = rnd(5, 12); e.idle = Math.floor(Math.random() * IDLES.length); e.idleP = 0; }
  } else { e.idleT = rnd(3, 8); e.idleP = 1; }
}

/* Взгляд: раз в 0.25..0.5 с выбираем, на что смотреть, дальше голова
   доворачивается и так же плавно возвращается вперёд. За спину не выворачиваемся. */
export function tickGaze(e, dt) {
  if (dist2(e.x, e.z, S.cam.x, S.cam.z) > 45 * 45) { e.lkY = 0; e.lkP = 0; e.gz = null; return; }
  e.gzT = (e.gzT || 0) - dt;
  if (e.gzT <= 0) { e.gzT = rnd(0.25, 0.5); e.gz = pickGaze(e); }
  let wy = 0, wp = 0;
  if (e.gz) {
    const d = ((Math.atan2(e.gz[0] - e.x, e.gz[1] - e.z) - (e.yaw || 0) + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(d) < 1.7) {
      wy = clamp(d, -1, 1);
      wp = clamp(Math.atan2((e.gz[2] || 1.5) - 1.56, Math.max(0.6, dist(e.x, e.z, e.gz[0], e.gz[1]))), -0.5, 0.55);
    }
  }
  const k = 1 - Math.exp(-5 * dt);
  e.lkY = angLerp(e.lkY || 0, wy, k);
  e.lkP = lerp(e.lkP || 0, wp, k);
}
/* Что интереснее: собеседник, потом Олег, потом собака, потом машина на ходу.
   Вес w делает объект «интереснее» при том же расстоянии.                */
export function pickGaze(e) {
  const p = S.player;
  let best = null, bw = 1e9;
  const see = (x, z, y, w) => { const d = dist2(e.x, e.z, x, z) * w; if (d < bw) { bw = d; best = [x, z, y]; } };
  see(p.x, p.z, p.onBike ? 1.45 : 1.60, e.say > 0 ? 0.25 : 1);
  for (const d of S.dogs) see(d.x, d.z, 0.55, 2.2);
  for (const c of S.cars) if (Math.abs(c.sp) > 4) see(c.x, c.z, 1.0, 3.2);
  for (const g of S.guards) see(g.x, g.z, 1.6, 1.4);
  return bw < 900 ? best : null;                     /* взвешенный радиус ≈ 30 м */
}

/* Действия. Одноразовые проигрываются по прогрессу и сами гаснут,
   длящиеся плавно набирают и теряют вес. want — что нужно прямо сейчас. */
export const ACT_ONCE = { swing: 0.55, scare: 0.50 };
export function startAct(e, name) { e.act = name; e.actK = 0; }
export function tickAct(e, dt, want) {
  if (e.act && ACT_ONCE[e.act]) {
    e.actK = (e.actK || 0) + dt / ACT_ONCE[e.act];
    if (e.actK >= 1) { e.act = ''; e.actK = 0; }
    return;
  }
  if (want && want !== e.act) { e.act = want; e.actK = e.actK || 0; }
  e.actK = lerp(e.actK || 0, e.act && e.act === want ? 1 : 0, 1 - Math.exp(-6 * dt));
  if (e.act !== want && e.actK < 0.02) { e.act = ''; e.actK = 0; }
}

/* Поза «как есть» из полей жителя: одно место, где логика связана с анимацией. */
export function charPose(e, extra) {
  const o = { x: e.x, y: surfY(e.x, e.z), z: e.z, yaw: e.yaw || 0, phase: e.phase || 0, speed: e.sp || 0,
    gait: e.gait, time: e.time, seed: e.seed, acc: e.acc, idle: e.idle, idleP: e.idleP,
    headYaw: e.lkY, headPitch: e.lkP, act: e.act, actK: e.actK, down: e.downK || 0 };
  if (extra) for (const k in extra) o[k] = extra[k];
  return o;
}

/* Бабушки у подъезда никуда не идут, но живут: переносят вес, смотрят по
   сторонам, а когда говорят — ещё и объясняют руками. */
export function updateGrans(dt) {
  for (const g of S.grans) {
    g.say = Math.max(0, g.say - dt);
    g.vx = 0; g.vz = 0;
    tickGait(g, dt, GAITS.gran, true);          /* фазу шага не крутим — стоит */
    tickGaze(g, dt);
    tickAct(g, dt, g.say > 0 ? 'talk' : '');
    /* корпус лениво доворачивается вслед за взглядом, но лавочка смотрит во двор */
    g.yaw = angLerp(g.yaw, Math.PI + clamp(g.lkY || 0, -0.5, 0.5) * 0.4, 1 - Math.exp(-1.6 * dt));
  }
}

export function updateCars(dt) {
  const p = S.player;
  for (const c of S.cars) {
    const dx = Math.sin(c.yaw), dz = Math.cos(c.yaw);
    const ahead = (p.x - c.x) * dx + (p.z - c.z) * dz;
    const side = Math.abs(-(p.x - c.x) * dz + (p.z - c.z) * dx);
    /* Впереди идущая машина: держим дистанцию. Без этого колонна в полосе
       съезжается и машины едут одна сквозь другую. Встречные не мешают —
       их полоса в 5,2 м, а поперечный допуск вдвое меньше. */
    let gap = 0;
    for (const o of S.cars) {
      if (o === c) continue;
      const ax = (o.x - c.x) * dx + (o.z - c.z) * dz;
      if (ax <= 0 || ax > 14) continue;
      if (Math.abs(-(o.x - c.x) * dz + (o.z - c.z) * dx) > 2.0) continue;
      if (!gap || ax < gap) gap = ax;
    }
    let want = c.base;
    if (gap) want = Math.min(want, Math.max(0, (gap - 5.2) * 2.4));
    if (ahead > 0 && ahead < 9 && side < 1.8) want = Math.min(want, c.base * 0.15);
    c.sp = lerp(c.sp, want, 1 - Math.exp(-(want < c.sp ? 5 : 1.6) * dt));
    c.x += dx * c.sp * dt; c.z += dz * c.sp * dt;
    c.wheel += c.sp * dt * 3;
    /* клевок на торможении и крен на повороте — по производным скорости и курса */
    const dv = (c.sp - (c.sp0 === undefined ? c.sp : c.sp0)) / Math.max(dt, 1e-3); c.sp0 = c.sp;
    const dyw = ((c.yaw - (c.yaw0 === undefined ? c.yaw : c.yaw0) + Math.PI) % TAU + TAU) % TAU - Math.PI; c.yaw0 = c.yaw;
    c.pitch = lerp(c.pitch || 0, clamp(-dv * 0.010, -0.028, 0.028), 1 - Math.exp(-9 * dt));
    c.roll = lerp(c.roll || 0, clamp(-(dyw / Math.max(dt, 1e-3)) * c.sp * 0.012, -0.07, 0.07), 1 - Math.exp(-6 * dt));
    if (c.x < -6) c.x = W.x + 4; if (c.x > W.x + 6) c.x = -4;
    if (c.z < -6) c.z = W.z + 4; if (c.z > W.z + 6) c.z = -4;
    const d = dist(c.x, c.z, p.x, p.z);
    if (d < 9 && c.horn <= 0 && Math.random() < 0.5 * dt) { c.horn = 0.7; Audio2.tone(rnd(300, 420), 0.24, 'square', 0.09); }
    c.horn = Math.max(0, c.horn - dt);
    if (Math.abs(c.sp) > 3.2 && p.invuln <= 0 && carHit(c, p.x, p.z, p.r + 0.1)) {
      const a = Math.atan2(p.x - c.x, p.z - c.z);
      p.vx = Math.sin(a) * 8; p.vz = Math.cos(a) * 8;
      hurt(p.onBike ? 20 : 14, 'Машина оказалась быстрее и тяжелее. Смена окончена.');
      if (p.onBike) { S.bike.speed = 0; damageBike(16); p.onBike = false; S.bike.parked = true; S.bike.x = p.x - 1.2; S.bike.z = p.z + 0.6; }
      Audio2.crash(); shake(14); S.stats.crashes++;
      toast(pick(['«Куда прёшь, монтаж!»', '«Я тут вообще-то еду»', 'Водитель показал жест из ПДД, которого нет в ПДД']), 'bad');
    }
  }
}
export function updateDogs(dt) {
  const p = S.player;
  for (const d of S.dogs) {
    d.t -= dt; d.bark -= dt; d.bite = Math.max(0, d.bite - dt); d.scare = Math.max(0, d.scare - dt);
    const dp = dist(d.x, d.z, p.x, p.z);
    if (d.scare > 0) {
      const a = Math.atan2(d.x - p.x, d.z - p.z);
      d.vx = Math.sin(a) * 5; d.vz = Math.cos(a) * 5;
    } else if (dp < (d.cross ? 11 : 8) && dist(d.hx, d.hz, d.x, d.z) < 40 && !Dlg.open) {
      /* Подбегает и лает, но у самых ног тормозит. Раньше собака упиралась в
         игрока вплотную на скорости 5.2 и кусала каждые полторы секунды —
         от неё нельзя было ни уйти, ни отделаться. */
      const a = Math.atan2(p.x - d.x, p.z - d.z);
      const spd = (p.onBike ? 5.4 : 4.4) * clamp((dp - 1.1) / 1.2, 0, 1);
      d.vx = Math.sin(a) * spd; d.vz = Math.cos(a) * spd;
      if (d.bark <= 0) { d.bark = rnd(1.8, 4.5); d.barkK = 1; if (dp < 26) Audio2.bark(); }
      /* Кусает только злая и только после рычания: секунда с лишним, чтобы
         отойти или замахнуться инструментом. Дальше — четверть минуты покоя. */
      d.warn = dp < 1.8 ? (d.warn || 0) + dt : 0;
      if (!d.warn) d.growl = 0;
      else if (d.cross && d.warn > 0.25 && !d.growl && d.bite <= 0) {
        d.growl = 1; floater(d.x, 0.95, d.z, 'Ррр…', '#ffd23f');
      }
      if (d.cross && dp < 1.05 && d.warn > 1.2 && d.bite <= 0 && p.invuln <= 0) {
        d.bite = 14; d.warn = 0; hurt(4, 'Собака оказалась принципиальной.');
        p.stamina = clamp(p.stamina - 5, 0, 100);
        floater(p.x, 1.9, p.z, 'Ай!', '#ff4d5e'); Audio2.bark(); addHeat(2);
      }
    } else {
      d.warn = 0; d.growl = 0;
      if (d.t <= 0) {
        d.t = rnd(1.4, 3.6);
        const far = dist(d.hx, d.hz, d.x, d.z) > 14;
        const a = far ? Math.atan2(d.hx - d.x, d.hz - d.z) : rnd(0, TAU);
        d.vx = Math.sin(a) * rnd(0.8, 2); d.vz = Math.cos(a) * rnd(0.8, 2);
      }
    }
    if (S.player.swing > 0 && dp < 4.5) { d.scare = 4.5; floater(d.x, 1.2, d.z, 'Тяв?!', '#ffd23f'); }
    d.x += d.vx * dt; d.z += d.vz * dt;
    d.phase += Math.hypot(d.vx, d.vz) * dt * 3;
    if (Math.hypot(d.vx, d.vz) > 0.1) d.yaw = angLerp(d.yaw, Math.atan2(d.vx, d.vz), 1 - Math.exp(-7 * dt));
    /* хвост, лай, одышка и взгляд — настроение видно без слов */
    d.barkK = Math.max(0, (d.barkK || 0) - dt * 2.4);
    d.pant = lerp(d.pant || 0, Math.hypot(d.vx, d.vz) > 2 ? 1 : 0, 1 - Math.exp(-1.5 * dt));
    d.wag = lerp(d.wag || 0, (d.scare > 0 || (d.cross && dp < 6)) ? 0 : clamp((14 - dp) / 10, 0, 1), 1 - Math.exp(-3 * dt));
    const rel = ((Math.atan2(p.x - d.x, p.z - d.z) - d.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const seen = dp < 16 ? 1 : 0;
    d.hy = angLerp(d.hy || 0, clamp(rel, -0.9, 0.9) * seen, 1 - Math.exp(-5 * dt));
    d.hp = lerp(d.hp || 0, seen ? clamp(0.95 / Math.max(1, dp), -0.3, 0.45) : 0, 1 - Math.exp(-4 * dt));
    for (const s of solidsNear(d.x, d.z, 0.8)) { const c = circleRect(d.x, d.z, 0.35, s); if (c && !s.soft) { d.x += c.nx * c.push; d.z += c.nz * c.push; d.vx *= .3; d.vz *= .3; } }
    d.x = clamp(d.x, 1, W.x - 1); d.z = clamp(d.z, 1, W.z - 1);
    d.vx *= Math.exp(-1.4 * dt); d.vz *= Math.exp(-1.4 * dt);
  }
}
export function updateHools(dt) {
  const p = S.player;
  for (const h of S.hools) {
    h.t -= dt; h.cool = Math.max(0, h.cool - dt); h.say = Math.max(0, h.say - dt); h.flee = Math.max(0, h.flee - dt);
    const dp = dist(h.x, h.z, p.x, p.z);
    if (h.gone) {
      h.x += h.vx * dt; h.z += h.vz * dt;
      tickGait(h, dt, GAITS.hool);
      if (dist(h.x, h.z, h.hx, h.hz) > 22) { h.x = h.hx; h.z = h.hz; h.gone = false; h.cool = 25; h.vx = h.vz = 0; }
      continue;
    }
    if (h.flee > 0) {
      const a = Math.atan2(h.x - p.x, h.z - p.z);
      h.vx = Math.sin(a) * 4; h.vz = Math.cos(a) * 4;
    } else if (h.state === 'chase' && dp < 26) {
      const a = Math.atan2(p.x - h.x, p.z - h.z);
      const sp = h.type === 'thief' ? 4 : 3.2;
      h.vx = Math.sin(a) * sp; h.vz = Math.cos(a) * sp;
    } else {
      if (h.t <= 0) {
        h.t = rnd(1.8, 4.2);
        const far = dist(h.hx, h.hz, h.x, h.z) > 9;
        const a = far ? Math.atan2(h.hx - h.x, h.hz - h.z) : rnd(0, TAU);
        h.vx = Math.sin(a) * rnd(0.5, 1.4); h.vz = Math.cos(a) * rnd(0.5, 1.4);
      }
      if (dp < 12 && h.cool <= 0 && !Dlg.open && S.screen === 'play') {
        if (h.type === 'thief' && p.tools.length > 0) h.state = 'chase';
        else if (h.type === 'beggar' && dp < 7.5) h.state = 'chase';
        if (h.say <= 0 && dp < 13) { h.say = 3; h.line = pick(HOOL_LINES[h.type]); }
      }
      if (dp > 27) h.state = 'idle';
    }
    if (dp < 1.9 && h.cool <= 0 && !Dlg.open && S.screen === 'play' && h.flee <= 0) {
      const fast = p.onBike && Math.abs(S.bike.speed) > 6;
      if (fast) { h.cool = 6; h.state = 'idle'; floater(h.x, 2, h.z, pick(['Э!', 'Куда!', 'Гони, гони...']), '#ff2d95'); Audio2.nope(); }
      else startEncounter(h);
    }
    if (p.swing > 0 && dp < 4.6 && h.flee <= 0) {
      h.flee = 5; h.cool = 8; h.state = 'idle'; startAct(h, 'scare');
      floater(h.x, 2, h.z, pick(['Ай!', 'Ладно-ладно!', 'Мы пошли']), '#ffd23f'); Audio2.thud();
    }
    if (h.type === 'thief' && !h.gone && !h.holds && dp < 2.1 && h.cool <= 0 && h.flee <= 0 && !Dlg.open && p.tools.length) {
      h.contact += dt * (S.upgrades.bag ? 0.55 : 1);
      if (h.contact > 1.6) { h.contact = 0; stealTool(h); }
    } else h.contact = 0;
    h.x += h.vx * dt; h.z += h.vz * dt;
    tickGait(h, dt, GAITS.hool);
    tickGaze(h, dt);
    tickAct(h, dt, h.say > 0 ? 'talk' : '');
    for (const s of solidsNear(h.x, h.z, 0.9)) { const c = circleRect(h.x, h.z, 0.4, s); if (c && !s.soft) { h.x += c.nx * c.push; h.z += c.nz * c.push; h.vx *= .4; h.vz *= .4; } }
    h.x = clamp(h.x, 1, W.x - 1); h.z = clamp(h.z, 1, W.z - 1);
    h.vx *= Math.exp(-1.1 * dt); h.vz *= Math.exp(-1.1 * dt);
  }
}
export function updatePeds(dt) {
  const p = S.player;
  const fast = p.onBike && Math.abs(S.bike.speed) > 4.5;
  for (const q of S.peds) {
    q.say = Math.max(0, q.say - dt); q.hop = Math.max(0, q.hop - dt);
    if (q.down > 0) {
      q.down -= dt;
      if (q.down <= 0) { q.say = 3; q.line = pick(['Ну спасибо.', 'Я это запомню.', 'Права купил?']); }
      continue;
    }
    const d = dist(q.x, q.z, p.x, p.z);
    if (d > 55) {
      q.t -= dt;
      if (q.t <= 0) { q.t = rnd(3, 7); const a = dist(q.x, q.z, q.hx, q.hz) > 16 ? Math.atan2(q.hx - q.x, q.hz - q.z) : rnd(0, TAU);
        q.vx = Math.sin(a) * q.walk; q.vz = Math.cos(a) * q.walk; }
      q.x = clamp(q.x + q.vx * dt, 1, W.x - 1); q.z = clamp(q.z + q.vz * dt, 1, W.z - 1);
      q.vx *= Math.exp(-1.6 * dt); q.vz *= Math.exp(-1.6 * dt);
      tickGait(q, dt, GAIT(q.gait));   /* дальние тоже шагают: их ещё видно до 60 м */
      continue;
    }
    if (fast && d < 5 && q.hop <= 0) {
      const a = Math.atan2(q.x - p.x, q.z - p.z);
      q.vx = Math.sin(a) * 5; q.vz = Math.cos(a) * 5; q.hop = 1.1;
      if (q.say <= 0) { q.say = 2; q.line = pick(['Э!', 'Куда несёшься!', 'Тут пешеходы!']); }
    } else if (q.hop <= 0) {
      q.t -= dt;
      if (q.t <= 0) { q.t = rnd(2.2, 5.5); const far = dist(q.x, q.z, q.hx, q.hz) > 16;
        const a = far ? Math.atan2(q.hx - q.x, q.hz - q.z) : rnd(0, TAU);
        q.vx = Math.sin(a) * q.walk; q.vz = Math.cos(a) * q.walk; }
      if (d < 9 && q.say <= 0 && Math.random() < 0.1 * dt * 60 / 60) { q.say = 3; q.line = pick(PED_LINES); }
    }
    if (d < 1.4 && fast && q.down <= 0) {
      q.down = 3.2;
      const a = Math.atan2(q.x - p.x, q.z - p.z);
      q.vx = Math.sin(a) * 3; q.vz = Math.cos(a) * 3;
      S.bike.speed *= 0.45;
      hurt(4, 'Олег сбил прохожего и сам не устоял.');
      shake(7); Audio2.thud();
      addHeat(20, 'Ты сбил прохожего — во дворе это обсудят');
      witnessed(q.x, q.z);
      floater(q.x, 1.8, q.z, pick(['Ой!', 'Ай!', 'Куда!']), '#ff4d5e');
      toast(pick(['«Я извинился. Мысленно»', '«Пешеход появился внезапно. Как всегда»']), 'bad', 2400);
    }
    q.x += q.vx * dt; q.z += q.vz * dt;
    tickGait(q, dt, GAIT(q.gait));
    tickGaze(q, dt);
    tickAct(q, dt, q.say > 0 ? 'talk' : '');
    /* падение: 0.25 с валится, лежит, за 0.8 с встаёт */
    q.downK = q.down <= 0 ? 0 : (q.down > 2.95 ? (3.2 - q.down) / 0.25 : Math.min(1, q.down / 0.8));
    for (const s of solidsNear(q.x, q.z, 0.9)) { const c = circleRect(q.x, q.z, 0.4, s); if (c && !s.soft) { q.x += c.nx * c.push; q.z += c.nz * c.push; q.vx *= .3; q.vz *= .3; } }
    q.x = clamp(q.x, 1, W.x - 1); q.z = clamp(q.z, 1, W.z - 1);
    q.vx *= Math.exp(-1.6 * dt); q.vz *= Math.exp(-1.6 * dt);
  }
}
export function startEncounter(h) {
  const p = S.player;
  h.state = 'talk'; h.vx = h.vz = 0; h.cool = 3;
  const partnerReady = S.partner.cooldown <= 0 && S.partner.active <= 0;
  const charm = clamp(20 + p.rep * 1.4 - p.drunk * 0.5, 5, 92);
  const opts = [
    { label: 'Поговорить по-человечески', hint: 'шанс ' + Math.round(charm) + '%', fn: () => {
        if (Math.random() * 100 < charm) {
          h.flee = 6; h.cool = 30; h.state = 'idle'; addRep(1, 'Разошлись словами');
          Dlg.one('oleg', pick(['Слушай, у меня смена. У тебя двор. Давай не мешать друг другу.',
            'Хочешь, покажу, как камера пишет? Вон та. Уже пишет.',
            'Я тут по заявке. Скажу Тамаре — она вас всех по именам знает.']));
        } else { h.cool = 4; addHeat(4); Dlg.one('hool', pick(['Не, ну ты не понял. Мелочь давай.', 'Слова — это хорошо. Полтинник — лучше.'])); }
      } },
    { label: 'Дать 50 ₽ и ехать дальше', hint: p.money >= 50 ? '−50 ₽' : 'нет денег', disabled: p.money < 50, fn: () => {
        addMoney(-50); h.flee = 7; h.cool = 45; h.state = 'idle';
        Dlg.one('hool', pick(['Уважаю. Опору покараулю.', 'Вот это по-соседски.', 'Ты нормальный. Камеру не трону.']));
      } },
    { label: 'Отмахнуться сумкой с инструментом', hint: 'шумно, внимание +', fn: () => {
        p.swing = 0.35; p.swingCd = 1; startAct(p, 'swing'); Audio2.thud(); shake(6);
        addHeat(16, 'Во дворе шумно — внимание растёт'); witnessed(p.x, p.z);
        if (Math.random() < 0.7) { h.flee = 7; h.cool = 30; h.state = 'idle'; Dlg.one('hool', 'Ты чего сумкой машешь, там же инструмент казённый!'); }
        else { hurt(9, 'Спор во дворе закончился не в пользу Олега.'); h.cool = 12; h.flee = 3; Dlg.one('oleg', 'Сумка тяжёлая. Но и они не картонные.'); }
      } },
    { label: 'Вызвать напарника Саню', hint: partnerReady ? 'приедет через ~10 с' : 'занят', disabled: !partnerReady,
      fn: () => { callPartner(); h.flee = 6; h.cool = 25; h.state = 'idle'; } },
    { label: 'Уехать / убежать', hint: 'быстро и без последствий', fn: () => {
        h.cool = 10; h.state = 'idle'; h.flee = 0; p.stamina = clamp(p.stamina - 10, 0, 100);
        Dlg.one('oleg', pick(['Отступление — это тоже маршрут.', 'У меня заявка, а не дискуссия.']));
      } }
  ];
  const intro = h.type === 'thief' && p.tools.length
    ? pick(HOOL_LINES.thief) + ' У тебя ' + TOOLS[p.tools[0]].name.toLowerCase() + ' лишний, смотрю.'
    : pick(HOOL_LINES[h.type]);
  Dlg.one('hool', intro, opts);
}
export function stealTool(h) {
  const p = S.player;
  if (!p.tools.length) return;
  const idx = Math.floor(Math.random() * p.tools.length);
  const t = p.tools.splice(idx, 1)[0];
  p.tool = clamp(p.tool, 0, Math.max(0, p.tools.length - 1));
  h.holds = t; h.gone = true; h.flee = 0;
  const a = Math.atan2(h.hx - h.x, h.hz - h.z) + rnd(-0.6, 0.6);
  h.vx = Math.sin(a) * 3; h.vz = Math.cos(a) * 3;
  __set_hudToolSig('');
  toast('Щипач увёл: ' + TOOLS[t].name + '!', 'bad', 3200);
  Audio2.nope();
  Dlg.one('oleg', '«' + TOOLS[t].name + ' положи! Он сам тебя выбрал неправильно».');
}
export function callPartner() {
  if (S.partner.cooldown > 0 || S.partner.active > 0) { toast('Саня пока недоступен', 'bad', 1600); return false; }
  S.partner.eta = 10; S.partner.cooldown = 150; S.partner.forgot = Math.random() < 0.45;
  Audio2.phone(); toast('Саня едет. Обещал 5 минут — значит 10', 'info', 2600);
  return true;
}
export function updatePartner(dt) {
  const P = S.partner;
  if (P.cooldown > 0) P.cooldown -= dt;
  if (P.eta > 0) {
    P.eta -= dt;
    if (P.eta <= 0) {
      P.active = 26;
      const p = S.player;
      let sx = p.x + rnd(-3, 3), sz = p.z + rnd(-3, 3);
      if (!freeSpot(sx, sz, 0.5)) { sx = p.x + 1.5; sz = p.z + 1.5; }
      S.npcs.push({ kind: 'sanya', x: sx, z: sz, vx: 0, vz: 0, phase: 0, yaw: 0, say: 4,
        gait: 'sanya', seed: Math.random(),
        line: P.forgot ? 'Приехал! Правда, стремянку забыл.' : 'Я тут. Держи лестницу, я подстрахую.' });
      for (const h of S.hools) if (dist2(h.x, h.z, p.x, p.z) < 19 * 19) { h.flee = 8; h.cool = 40; h.state = 'idle'; }
      Audio2.ok();
      Dlg.one('sanya', P.forgot ? 'Я приехал! Тестер взял, стремянку — нет. Зато настроение привёз.' : 'Готов. Что держим — лестницу или оборону?');
      if (!P.forgot) { S.partnerBonus = true; if (S.mission && S.mission.stage === 'work') toast('Саня страхует: качество монтажа +8', 'good'); }
    }
  }
  if (P.active > 0) { P.active -= dt; if (P.active <= 0) { S.partnerBonus = false; S.npcs = S.npcs.filter(n => n.kind !== 'sanya'); } }
  for (const n of S.npcs) {
    n.say = Math.max(0, n.say - dt);
    /* Бригада не молчит: пока стоят рядом, каждый роняет своё. */
    if (n.say <= 0 && n.leave <= 0 && !Dlg.open && CREW_LINES[n.kind] &&
        dist2(n.x, n.z, S.player.x, S.player.z) < 26 * 26 && Math.random() < 0.09 * dt) {
      n.say = 3.4; n.line = pick(CREW_LINES[n.kind]);
    }
    if (n.leave > 0) {                                /* расходятся; Костя, как обычно, первым */
      n.leave -= dt;
      n.vx = Math.sin(n.yaw) * 2.9; n.vz = Math.cos(n.yaw) * 2.9;
      n.x += n.vx * dt; n.z += n.vz * dt;
      tickGaze(n, dt); tickGait(n, dt, GAIT(n.gait), true);
      if (n.leave <= 0) S.npcs = S.npcs.filter(o => o !== n);
      continue;
    }
    tickGaze(n, dt);
    const dNear = dist(n.x, n.z, S.player.x, S.player.z);
    tickAct(n, dt, n.say > 0 || (Dlg.open && Dlg.who === (n.who || n.kind)) ? 'talk'
      : (n.kind === 'sanya' && S.partnerBonus && dNear < 3.5 ? 'hold' : ''));
    /* стоящие NPC не ходят, но живут: дыхание, перенос веса, холостые движения */
    if (n.kind !== 'sanya' || n.brief) { n.vx = 0; n.vz = 0; tickGait(n, dt, GAIT(n.gait), true); continue; }
    const p = S.player, d = dist(n.x, n.z, p.x, p.z);
    if (d > 4) { const a = Math.atan2(p.x - n.x, p.z - n.z); n.vx = Math.sin(a) * 3.4; n.vz = Math.cos(a) * 3.4; }
    else { n.vx *= 0.85; n.vz *= 0.85; }
    n.x += n.vx * dt; n.z += n.vz * dt;
    tickGait(n, dt, GAITS.sanya);
  }
}
export function updateHeat(dt) {
  S.heat = clamp(S.heat - BAL.heatDecay * dt * (S.player.onBike ? 0.8 : 1), 0, 100);
  const want = S.heat >= 70 ? 2 : S.heat >= 42 ? 1 : 0;
  while (S.guards.length < want) {
    const p = S.player;
    let gx = p.x, gz = p.z, best = -1;
    for (let i = 0; i < 10; i++) {
      const a = rnd(0, TAU), r = 40;
      const tx = clamp(p.x + Math.sin(a) * r, 3, W.x - 3), tz = clamp(p.z + Math.cos(a) * r, 3, W.z - 3);
      const d = dist(tx, tz, p.x, p.z);
      if (d > best) { best = d; gx = tx; gz = tz; }
      if (d > 33) break;
    }
    S.guards.push({ x: gx, z: gz, vx: 0, vz: 0, yaw: 0, phase: 0, wheel: 0, siren: 0, catchCd: 0, gait: 'guard', seed: Math.random() });
    toast('ЧОП «Бдительный сосед» выехал по вызову', 'bad', 3000); Audio2.siren();
  }
  while (S.guards.length > want) S.guards.pop();
  for (const g of S.guards) {
    const p = S.player;
    const a = Math.atan2(p.x - g.x, p.z - g.z);
    const sp = 5.5 + S.heat * 0.03;
    g.vx = lerp(g.vx, Math.sin(a) * sp, 1 - Math.exp(-2.4 * dt));
    g.vz = lerp(g.vz, Math.cos(a) * sp, 1 - Math.exp(-2.4 * dt));
    g.x += g.vx * dt; g.z += g.vz * dt;
    g.yaw = angLerp(g.yaw, a, 1 - Math.exp(-8 * dt));
    /* колесо машины — от скорости, шаг охранника — общим накопителем */
    const gv = Math.hypot(g.vx, g.vz);
    g.wheel = (g.wheel || 0) + gv * dt * 3;
    const gdy = ((g.yaw - (g.yaw0 === undefined ? g.yaw : g.yaw0) + Math.PI) % TAU + TAU) % TAU - Math.PI; g.yaw0 = g.yaw;
    g.roll = lerp(g.roll || 0, clamp(-(gdy / Math.max(dt, 1e-3)) * gv * 0.012, -0.07, 0.07), 1 - Math.exp(-6 * dt));
    g.pitch = lerp(g.pitch || 0, clamp(-(gv - (g.v1 === undefined ? gv : g.v1)) / Math.max(dt, 1e-3) * 0.010, -0.028, 0.028), 1 - Math.exp(-9 * dt)); g.v1 = gv;
    tickGait(g, dt, GAITS.guard, true);
    for (const s of solidsNear(g.x, g.z, 1)) { const c = circleRect(g.x, g.z, 0.5, s); if (c && !s.soft) { g.x += c.nx * c.push; g.z += c.nz * c.push; } }
    g.siren -= dt;
    if (g.siren <= 0 && dist(g.x, g.z, p.x, p.z) < 44) { g.siren = 1.6; Audio2.siren(); }
    g.catchCd = Math.max(0, g.catchCd - dt);
    if (dist(g.x, g.z, p.x, p.z) < 1.9 && g.catchCd <= 0 && !Dlg.open) {
      g.catchCd = 8;
      const fine = Math.round(clamp(120 + S.heat * 5, 120, 700));
      addMoney(-fine, 'Штраф от ЧОП'); S.stats.fines++; S.heat = 18;
      S.player.vx = -g.vx * 0.6; S.player.vz = -g.vz * 0.6;
      if (S.player.onBike) S.bike.speed *= 0.3;
      Dlg.one('guard', pick([
        'Вы кто? Монтажник? А наряд-допуск? А совесть? Штраф ' + fine + ' рублей, распишитесь мысленно.',
        'Бабушки жаловались. Бабушки не ошибаются. ' + fine + ' рублей.',
        'Я вас не задерживаю. Я вас штрафую. Это разные вещи.']));
    }
  }
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let CAR_BOX;
export function __init() {
  /* Габарит кузова в плане: половина длины берётся из силуэта (кузов строится
     «длиной по X», потом разворачивается носом по +Z), половина ширины — hw.
     Нужен и для столкновений с пешеходом, и чтобы машины не въезжали друг в друга. */
  CAR_BOX = (() => {
    const o = {};
    for (const k in CAR_SPEC) {
      let L = 0;
      for (const pt of CAR_SPEC[k].body) L = Math.max(L, Math.abs(pt[0]));
      o[k] = [L, CAR_SPEC[k].hw];
    }
    return o;
  })();
}
