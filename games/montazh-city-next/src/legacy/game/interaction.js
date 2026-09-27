/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «23. Взаимодействие», строки 10724–10784.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { clamp, dist2, pick } from '../core/util.js';
import { askKostya, doVerify, finishWork, inspectPole, payoutMission, searchSpot, startFinalStep, tryStartWork } from './crew.js';
import { floater, toast } from './effects.js';
import { tryMountBike } from './movement.js';
import { startAct } from './npcs.js';
import { EGG, eggOpenDevice } from './phone.js';
import { S } from './state.js';
import { __set_hudToolSig, hudToolSig } from '../ui/hud.js';
import { startCameraGame } from '../ui/minigame-door.js';
import { openPoi } from '../ui/screens.js';
import { POIS } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 23. Взаимодействие                                                   */
/* ------------------------------------------------------------------ */
export function currentInteraction() {
  const p = S.player, M = S.mission;
  const near = (x, z, r) => dist2(p.x, p.z, x, z) < r * r;
  const slow = !p.onBike || Math.abs(S.bike.speed) < 3;
  if (M && slow) {
    const d = M.def;
    /* Костя ещё не уехал — можно расспросить: это подсказка, а не вежливость */
    if (!M.data.kostyaTold && d.kostya && d.kostya.ask) {
      const kn = S.npcs.find(n => n.kind === 'kostya');
      if (kn && near(kn.x, kn.z, 4.2)) return { label: 'спросить Костю: что тут было', fn: () => askKostya() };
    }
    if (M.stage === 'travel' && near(d.site.x, d.site.z, 4.6)) return { label: 'начать работу: ' + d.site.label, fn: () => tryStartWork() };
    if (M.stage === 'verify' && near(d.site.x, d.site.z, 5.6)) return { label: 'проверить оборудование', fn: () => doVerify() };
    if (M.stage === 'report' && d.client && near(d.client.x, d.client.z, 5.2)) return { label: 'сдать работу: ' + d.client.name, fn: () => payoutMission() };
    if (M.stage === 'work') {
      if (d.kind === 'search' && M.data.spots)
        for (const sp of M.data.spots) if (near(sp.x, sp.z, 3.6) && !sp.searched) return { label: 'обыскать: ' + sp.label, fn: () => searchSpot(sp) };
      if (d.kind === 'night' && M.data.poles) {
        for (const e of M.data.poles) {
          if (!near(e.p.x, e.p.z, 4.6)) continue;
          const isBroken = M.data.poles.indexOf(e) === M.data.broken;
          if (M.data.found && isBroken) return { label: 'чинить камеру', fn: () => startCameraGame({ zone: d.zone || 'въезд' }, q => { e.p.installed = true; e.p.camYaw = 0.2; finishWork(q); }) };
          if (!M.data.found) return { label: 'осмотреть камеру', fn: () => inspectPole(e) };
        }
      }
      if (d.kind === 'final') {
        const st = M.data.step;
        if (st === 0 && near(d.site.x, d.site.z, 5)) return { label: 'монтаж СКУД на входе', fn: () => startFinalStep() };
        if (st >= 1 && st <= 4) { const cam = M.data.cams[st - 1]; if (near(cam.p.x, cam.p.z, 5)) return { label: 'ставить камеру на опору ' + cam.p.mount, fn: () => startFinalStep() }; }
      }
    }
  }
  if (S.egg.stage === 'go' && slow && near(EGG.dev.x, EGG.dev.z, 3.4))
    return { label: 'вскрыть прибор периметра', fn: () => eggOpenDevice() };
  for (const poi of POIS) if (near(poi.x, poi.z, poi.r) && slow) return { label: poi.act, fn: () => openPoi(poi.id) };
  if (!p.onBike && near(S.bike.x, S.bike.z, 3.2)) return { label: 'сесть на велосипед', fn: () => tryMountBike() };
  if (p.onBike) return { label: 'слезть с велосипеда', fn: () => tryMountBike() };
  return null;
}
export function handleAction() { const it = currentInteraction(); if (it) { it.fn(); return true; } return false; }
export function useTool() {
  const p = S.player;
  if (!p.tools.length) { toast('Сумка пуста. «Работать нечем, зато честно»', 'bad', 1800); return; }
  const t = p.tools[clamp(p.tool, 0, p.tools.length - 1)];
  if (t === 'lamp') {
    p.lampOn = !p.lampOn; __set_hudToolSig(''); Audio2.click();
    toast(p.lampOn ? 'Фонарик включён' : 'Фонарик выключен', 'info', 1200);
    return;
  }
  if (p.onBike && S.bike.chain > 0) return;
  if (p.swingCd > 0) return;
  p.swing = 0.35; p.swingCd = 0.7; startAct(p, 'swing');
  p.stamina = clamp(p.stamina - 4, 0, 100);
  Audio2.noise(0.12, 0.12, 200, 1200);
  const near = S.hools.some(h => dist2(h.x, h.z, p.x, p.z) < 25) || S.dogs.some(d => dist2(d.x, d.z, p.x, p.z) < 25);
  if (!near && Math.random() < 0.4) floater(p.x, 2.1, p.z, pick(['Вжух!', 'Ну-ка!', 'Кыш']), '#ffd23f');
}
