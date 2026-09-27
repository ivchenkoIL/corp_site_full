/* =====================================================================
   bridge.js — мост между логикой игры и отрисовкой.

   Логика (модули src/legacy/game/*, перенесённые из монолита) ничего не
   знает о том, чем её рисуют: она меняет общее состояние S. Отрисовщик
   ничего не знает о правилах игры: он получает снимок — список сущностей
   с тем, что нужно для кадра. Этот файл — единственное место, где одно
   переводится в другое. Новый движок читает только снимок; старый
   рендер (src/legacy/render/*) по-прежнему читает S напрямую — он и есть
   «старый бэкенд», и сравнивать их можно на одной и той же логике.

   Снимок:
     people: [{ key, model, x, z, yaw, speed, act, talk, talkNo, drunk,
                onBike, hero, lookYaw }]
     cars:   [{ key, x, z, yaw, tint, kind, src }]
   key — сама сущность логики (объект), по нему бэкенд держит её модель
   между кадрами. model — идентификатор из манифеста ассетов
   (src/assets/manifest.js), у которого всегда есть запасной вариант.
   ===================================================================== */
import { modelFor } from '../assets/manifest.js';

export function collectEntities(S, L) {
  const people = [], cars = [];
  const speaking = L.Dlg && L.Dlg.open ? L.Dlg.who : '';
  const p = S.player;
  if (p) people.push({
    key: p, model: 'oleg', hero: true, x: p.x, z: p.z, yaw: p.yaw,
    speed: p.onBike ? 0 : Math.hypot(p.vx, p.vz), act: p.act, onBike: p.onBike,
    talk: speaking === 'oleg' || p.say > 0, drunk: (p.drunk || 0) / 100, lookYaw: p.lkY || 0
  });
  for (const n of S.npcs) people.push({
    key: n, model: modelFor(n.kind), x: n.x, z: n.z, yaw: n.yaw, speed: Math.hypot(n.vx || 0, n.vz || 0),
    act: n.act, talk: speaking === n.who || n.say > 0, talkNo: n.kind === 'vanya', lookYaw: n.lkY || 0
  });
  const add = (arr, kind) => { for (const e of arr) people.push({ key: e, model: modelFor(kind, e), x: e.x, z: e.z, yaw: e.yaw, speed: Math.hypot(e.vx || 0, e.vz || 0), act: e.act, talk: e.say > 0, lookYaw: e.lkY || 0 }); };
  add(S.peds, 'ped'); add(S.hools, 'hool'); add(S.grans, 'gran'); add(S.guards, 'guard');
  const M = S.mission;
  if (M && M.data && M.data.raiders) add(M.data.raiders.filter(r => !r.gone), 'hool');
  for (const c of S.cars) cars.push({ key: c, x: c.x, z: c.z, yaw: c.yaw, tint: c.tint || [0.8, 0.8, 0.8], kind: c.kind, src: c });
  return { people, cars };
}
