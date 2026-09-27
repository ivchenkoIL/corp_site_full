/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «16. Состояние игры», строки 9004–9058.
   ===================================================================== */
import { pad2 } from '../core/util.js';

/* ------------------------------------------------------------------ */
/* 16. Состояние игры                                                   */
/* ------------------------------------------------------------------ */
export const BAL = {
  /* Ход и бег заметно быстрее прежнего. Разгон и трение подняты вместе с ними:
     при старых 26/10 установившаяся скорость упиралась в 2,6 м/с, поэтому до
     предела бега дело просто не доходило и спринт почти не отличался от шага.
     Бег оставлен ниже велосипеда, иначе кататься было бы незачем. */
  walk: 3.8, sprint: 7.0, walkAcc: 68, walkFric: 6.4,
  bikeMax: 9.6, bikeBoost: 13.2, bikeAcc: 6.4, bikeDrag: 0.52, bikeBrake: 13, bikeTurn: 2.5,
  stamDrain: 17, stamRegen: 12, dodgeCost: 20, heatDecay: 1.35, soberRate: 0.85
};
export const TOOLS = {
  screw:  { name: 'Шуруповёрт',   short: 'Шуруп.',  icon: 'screw' },
  tester: { name: 'Тестер',       short: 'Тестер',  icon: 'tester' },
  ladder: { name: 'Стремянка',    short: 'Лестн.',  icon: 'ladder' },
  cable:  { name: 'Бухта кабеля', short: 'Кабель',  icon: 'cable' },
  drill:  { name: 'Перфоратор',   short: 'Перфор.', icon: 'drill' },
  ties:   { name: 'Стяжки',       short: 'Стяжки',  icon: 'ties' },
  lamp:   { name: 'Фонарик',      short: 'Фонарь',  icon: 'lamp' }
};
export const REP_TITLES = [[-999,'позор бригады'],[0,'стажёр'],[10,'подмастерье'],[25,'монтажник'],[45,'спец по СКУД'],[70,'мастер участка'],[95,'легенда района']];
export function repTitle(r) { let t = 'стажёр'; for (const [k, v] of REP_TITLES) if (r >= k) t = v; return t; }

export const DAY_LEN = 2400, START_HOUR = 17;
export const S = {
  screen: 'boot', t: 0, shake: 0, clock: START_HOUR * 3600, day: 1,
  player: null, bike: null,
  cars: [], dogs: [], hools: [], grans: [], guards: [], npcs: [], peds: [], fx: [],
  heat: 0, mission: null, missionIndex: 0, missionsDone: [],
  partner: { cooldown: 0, eta: 0, active: 0, forgot: false }, partnerBonus: false,
  stats: { earned: 0, crashes: 0, fixed: 0, sober: 0, bestQ: 0, fines: 0, dist: 0 },
  flags: {}, upgrades: {}, autosave: 0, phoneRing: 0, tutorial: null,
  phone: { calls: {} },                       /* счётчик звонков за смену: Егоров устаёт отвечать */
  egg: { stage: 'none', ring: 0, burnt: 0 },  /* личная история Олега про периметр */
  ended: null, free: false, freeCount: 0, quality: '', dynamic: true, camFollow: true,
  cam: { yaw: Math.PI * 0.5, pitch: 0.34, dist: 6.2, x: 0, y: 2, z: 0, tx: 0, ty: 1.4, tz: 0, manual: 0 }
};
export function newPlayer() {
  return {
    x: 12, z: 52, yaw: 0, vx: 0, vz: 0, r: 0.42, onBike: false,
    health: 100, stamina: 100, drunk: 0, money: 350, rep: 0,
    phase: 0, dodge: 0, dodgeCd: 0, hurt: 0, invuln: 0,
    tools: ['screw'], tool: 0, lampOn: false, swing: 0, swingCd: 0,
    gait: 'oleg', seed: 0.5, time: 0, sp: 0, acc: 0, act: '', actK: 0, idle: 0, idleP: 1, lkY: 0, lkP: 0,
    say: 0, line: ''
  };
}
export function newBike() { return { x: 15, z: 52, yaw: 0, speed: 0, cond: 100, wheel: 0, parked: true, chain: 0, lean: 0, steer: 0 }; }

export function hour() { return S.clock / 3600; }
export function clockStr() { const h = Math.floor(S.clock / 3600) % 24, m = Math.floor(S.clock / 60) % 60; return pad2(h) + ':' + pad2(m); }
export function dayPart() { const h = hour(); if (h < 5) return 'ночь'; if (h < 11) return 'утро'; if (h < 17) return 'день'; if (h < 21) return 'закат'; return 'ночь'; }
export function setHour(h) { S.clock = ((h % 24) + 24) % 24 * 3600; }
