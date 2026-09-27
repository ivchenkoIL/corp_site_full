/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «27. Сохранение и обучение», строки 12269–12364.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { QCFG } from '../core/quality.js';
import { clamp } from '../core/util.js';
import { toast } from '../game/effects.js';
import { Input, K } from '../game/input.js';
import { resetWorld } from '../game/loop.js';
import { S, TOOLS } from '../game/state.js';
import { Save } from './storage.js';
import { __set_hudToolSig, hudToolSig } from '../ui/hud.js';
import { POLES } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 27. Сохранение и обучение                                            */
/* ------------------------------------------------------------------ */
/* Настройки интерфейса: живут отдельно от прогресса смены. */
export function saveOpts() {
  Save.writeOpts({ camFollow: !!S.camFollow, quality: S.quality, dynamic: !!S.dynamic, station: Audio2.station,
                   sfx: Audio2.sfxVol, mus: Audio2.musVol, muted: !!Audio2.muted });
}
export function loadOpts() {
  const o = Save.readOpts();
  if (!o) return;
  if (typeof o.camFollow === 'boolean') S.camFollow = o.camFollow;
  if (typeof o.quality === 'string' && QCFG.profiles[o.quality]) S.quality = o.quality;
  else if (o.lowFx === true) S.quality = 'low';          /* прежний режим «экономно» */
  if (typeof o.dynamic === 'boolean') S.dynamic = o.dynamic;
  if (typeof o.sfx === 'number') Audio2.setSfx(clamp(o.sfx, 0, 1));
  if (typeof o.mus === 'number') Audio2.setMus(clamp(o.mus, 0, 1));
  if (typeof o.station === 'number' && Audio2.stations[o.station]) Audio2.station = o.station | 0;
  if (o.muted) Audio2.mute(true);
}

export function saveGame(silent) {
  const p = S.player;
  const data = {
    v: 1, ts: Date.now(),
    p: { x: p.x, z: p.z, yaw: p.yaw, health: p.health, stamina: p.stamina, drunk: p.drunk, money: p.money, rep: p.rep, tools: p.tools.slice(), tool: p.tool },
    bike: { x: S.bike.x, z: S.bike.z, cond: S.bike.cond },
    clock: S.clock, day: S.day, heat: S.heat,
    missionIndex: S.missionIndex, missionsDone: S.missionsDone.slice(),
    free: S.free, freeCount: S.freeCount,
    upgrades: Object.assign({}, S.upgrades), stats: Object.assign({}, S.stats), flags: Object.assign({}, S.flags),
    poles: POLES.map(pl => !!pl.installed), station: Audio2.station
  };
  const ok = Save.write(data);
  if (!ok && !silent) toast('Не удалось сохранить: ' + (Save.lastError || 'localStorage недоступен'), 'bad', 4000);
  else if (!silent) toast('Прогресс сохранён', 'good', 1400);
  return ok;
}
export function loadGame() {
  const d = Save.read();
  if (!d) return false;
  try {
    resetWorld(false);
    const p = S.player;
    Object.assign(p, { x: d.p.x, z: d.p.z, yaw: d.p.yaw || 0, health: d.p.health, stamina: d.p.stamina,
      drunk: d.p.drunk || 0, money: d.p.money, rep: d.p.rep, tools: (d.p.tools || []).filter(t => TOOLS[t]), tool: d.p.tool || 0 });
    S.bike.x = d.bike.x; S.bike.z = d.bike.z; S.bike.cond = d.bike.cond;
    S.clock = d.clock; S.day = d.day || 1; S.heat = d.heat || 0;
    S.missionIndex = d.missionIndex || 0; S.missionsDone = d.missionsDone || [];
    S.free = !!d.free; S.freeCount = d.freeCount || 0;
    S.upgrades = d.upgrades || {};
    S.stats = Object.assign(S.stats, d.stats || {});
    S.flags = Object.assign(S.flags, d.flags || {});
    if (Array.isArray(d.poles)) d.poles.forEach((v, i) => { if (POLES[i]) POLES[i].installed = v; });
    if (typeof d.station === 'number') Audio2.station = clamp(d.station, 0, Audio2.stations.length - 1);
    S.flags.tutorialDone = true; S.tutorial = null; S.mission = null; S.phoneRing = 2.5;
    S.cam.tx = p.x; S.cam.tz = p.z; __set_hudToolSig('');
    return true;
  } catch (e) { toast('Сохранение повреждено, начинаем заново', 'bad', 3600); Save.wipe(); return false; }
}
export const TUTORIAL = [
  { text: 'Повернись: A и D — камера едет за спиной сама', check: t => t.turned > 1.1 },
  { text: 'Пройдись вперёд: W', check: t => t.moved > 6 },
  { text: 'Ускорься: зажми Shift на ходу', check: t => t.sprint > 0.9 },
  { text: 'Велосипед рядом — подойди и нажми E', check: () => S.player.onBike },
  { text: 'Прокатись немного вперёд', check: t => t.rode > 25 },
  { text: 'Притормози: Space', check: t => t.braked },
  { text: 'Открой карту района: M', check: t => t.mapOpened },
  { text: 'Всё. Сейчас позвонит Ваня — объяснит один раз', check: t => t.wait > 1.6 }
];
export function updateTutorial(dt) {
  const T = S.tutorial, p = S.player;
  T.wait = (T.wait || 0) + dt;
  T.looked = (T.looked || 0) + (Math.abs(Input.dx) + Math.abs(Input.dy) > 2 ? dt : 0);
  T.turned = (T.turned || 0) + ((Input.any(K.left) || Input.any(K.right)) ? dt : 0);
  const sp = Math.hypot(p.vx, p.vz);
  if (!p.onBike) T.moved += sp * dt;
  if (Input.any(K.sprint) && sp > 1) T.sprint += dt;
  if (p.onBike) T.rode += Math.abs(S.bike.speed) * dt;
  if (p.onBike && Input.any(K.brake) && Math.abs(S.bike.speed) > 1) T.braked = true;
  if (S.screen === 'map') T.mapOpened = true;
  if (TUTORIAL[T.step].check(T)) {
    T.step++; T.wait = 0; Audio2.ok();
    if (T.step >= TUTORIAL.length) {
      T.done = true; S.tutorial = null; S.flags.tutorialDone = true; S.phoneRing = 1.4;
      toast('Обучение пройдено. Смена начинается', 'good', 2600); saveGame(true);
    } else toast('Дальше: ' + TUTORIAL[T.step].text, 'info', 2400);
  }
}
export function skipTutorial() {
  if (!S.tutorial) return false;
  S.tutorial = null; S.flags.tutorialDone = true; S.phoneRing = 1.2;
  toast('Обучение пропущено', 'info');
  return true;
}
