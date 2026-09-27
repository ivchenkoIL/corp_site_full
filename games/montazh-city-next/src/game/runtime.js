/* =====================================================================
   runtime.js — запуск игры на новом движке.

   Вся игровая логика — из модулей старой игры (src/legacy/, нарезаны из
   монолита tools/split-legacy.mjs): смена, заявки, бригада, жители,
   физика Олега и велосипеда, камера, диалоги, телефон, мини-игры, HUD,
   сохранения. Здесь — ровно то, что в монолите было функциями boot() и
   step(), только вместо старого WebGL-рендера кадр рисует бэкенд моста
   (Babylon). Порядок шагов кадра тот же, что у старой игры.
   ===================================================================== */
import { __init as initQuality } from '../legacy/core/quality.js';
import { __init as initGL } from '../legacy/render/gl.js';
import { __init as initDistrict } from '../legacy/world/district.js';
import { __init as initVegetation } from '../legacy/render/vegetation.js';
import { __init as initRenderer } from '../legacy/render/renderer.js';
import { __init as initCharacters } from '../legacy/render/characters.js';
import { __init as initStorage } from '../legacy/save/storage.js';
import { __init as initPhone } from '../legacy/game/phone.js';
import { __init as initInput } from '../legacy/game/input.js';
import { __init as initNpcs } from '../legacy/game/npcs.js';
import { __init as initFrame } from '../legacy/render/frame.js';

import { S } from '../legacy/game/state.js';
import { $ } from '../legacy/core/util.js';
import { Audio2 } from '../legacy/audio/audio.js';
import { buildSolids } from '../legacy/game/collision.js';
import { Input } from '../legacy/game/input.js';
import { updateCamera } from '../legacy/game/camera.js';
import { resetWorld, updateWorld, handleKeys, updateFx, Loader, fatal } from '../legacy/game/loop.js';
import { loadOpts, saveOpts, saveGame } from '../legacy/save/savegame.js';
import { Dlg } from '../legacy/ui/dialog.js';
import { updateRadio } from '../legacy/ui/radio.js';
import { Mini } from '../legacy/ui/minigames.js';
import { updateHud } from '../legacy/ui/hud.js';
import { initHud2, resizeHud2 } from '../legacy/ui/overlay2d.js';
import { screenMenu, screenSettings } from '../legacy/ui/screens.js';
import { drawOverlay2D } from '../legacy/render/frame.js';
import { GL } from '../legacy/render/gl.js';
import * as R from '../legacy/render/renderer.js';
import * as world from '../legacy/world/district.js';
import { YARD_PROPS, isYardFree } from '../world/yard.js';

export async function start(backend, { base, quality }) {
  /* исполняемые части модулей старой игры — в исходном порядке, кроме
     запуска старого рендера (его __init в loop.js не зовём вовсе) */
  initQuality(); initGL(); initDistrict(); initVegetation(); initRenderer(); initCharacters();
  initStorage(); initPhone(); initInput(); initNpcs(); initFrame();
  /* двор конторы на новом движке богаче: деревья и лавка — ещё и препятствия */
  world.PROPS.push(...YARD_PROPS);

  loadOpts();
  if (!['high', 'medium', 'low'].includes(S.quality)) S.quality = quality || 'high';
  initHud2();
  for (const id of ['grade', 'scan']) { const el = $(id); if (el) el.style.display = 'none'; }

  Loader.show('Собираем район');
  await backend.init({
    canvas: $('gl'), base, quality: S.quality,
    legacy: { S, GL, get R3() { return R.R3; }, Dlg, world, isYardFree },
    progress: (text, f) => Loader.set(text, f)
  });
  resize();
  buildSolids();
  Input.init();
  resetWorld(true);
  saveOpts();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.screen === 'play') saveGame(true); });
  addEventListener('beforeunload', () => { if (S.screen === 'play' && !S.ended) saveGame(true); });
  addEventListener('error', e => fatal(e.error || e.message, false));
  const kick = () => { Audio2.init(); Audio2.resume(); };
  addEventListener('pointerdown', kick); addEventListener('keydown', kick);
  /* Качество в настройках старой игры переключало её рендер. Здесь кнопка та
     же, но переключает профиль Babylon (перезапуск страницы — самый честный
     способ пересобрать тени и постобработку). */
  document.addEventListener('click', e => {
    const q = e.target.closest && e.target.closest('#bQual, #bDyn');
    if (!q) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (q.id === 'bQual') {
      const order = ['high', 'medium', 'low'];
      S.quality = order[(order.indexOf(S.quality) + 1) % order.length];
      saveOpts(); if (S.screen === 'play') saveGame(true);
      location.reload();
    }
  }, true);
  window.__game = { S, backend, Dlg, ready: Promise.resolve(true) };
  Loader.hide();
  screenMenu();

  let last = performance.now();
  backend.runLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) || 0.016;
    last = now;
    try { step(dt); } catch (e) { fatal(e, true); }
  });

  function step(dt) {
    S.t += dt;
    Dlg.update(dt);
    updateRadio(dt);
    if (S.screen === 'play' && !Dlg.open) updateWorld(dt);
    else if (S.screen === 'mini' && !Dlg.open) Mini.update(dt);
    else if (Dlg.open) $('prompt').style.display = 'none';
    updateFx(dt);
    updateCamera(dt);
    backend.render(dt);
    drawOverlay2D();
    if (S.screen === 'mini' || Mini.g) Mini.draw();
    updateHud();
    handleKeys();
    Input.endFrame();
  }
  function resize() { backend.resize(); resizeHud2(); if (Mini.g) Mini.resize(); }
  void screenSettings;
}
