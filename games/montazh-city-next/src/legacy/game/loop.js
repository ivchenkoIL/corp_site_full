/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «28. Мир, цикл и запуск», строки 12365–12649.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { Q, QCFG } from '../core/quality.js';
import { $, clamp, dist2, pick } from '../core/util.js';
import { updateCamera } from './camera.js';
import { buildSolids } from './collision.js';
import { offerMission, updateMission } from './crew.js';
import { addHeat, floater, toast } from './effects.js';
import { Input, K, exitLock } from './input.js';
import { currentInteraction, handleAction, useTool } from './interaction.js';
import { MOTTO } from './missions.js';
import { moveBike, movePlayerOnFoot } from './movement.js';
import { callPartner, spawnDogs, spawnGrans, spawnHools, spawnPeds, spawnTraffic, tickAct, updateCars, updateDogs, updateGrans, updateHeat, updateHools, updatePartner, updatePeds } from './npcs.js';
import { CREW_LINES, PHONE, callContact, eggRing } from './phone.js';
import { BAL, DAY_LEN, S, START_HOUR, newBike, newPlayer } from './state.js';
import { buildCharacters } from '../render/characters.js';
import { BLOOM, SHADOW, SSAO, SSR, renderFrame } from '../render/frame.js';
import { GL, GLSL_SKY, SkyJS } from '../render/gl.js';
import { Cull, Env, EnvMap, HDR, Perf, R3, applyProfile, initRenderer, resizeGL } from '../render/renderer.js';
import { buildSignsAsync, buildTexturesAsync } from '../render/textures.js';
import { buildWorld } from '../render/vegetation.js';
import { buildVehicles } from '../render/vehicles.js';
import { TUTORIAL, loadOpts, saveGame, saveOpts, updateTutorial } from '../save/savegame.js';
import { Dlg } from '../ui/dialog.js';
import { __set_hudToolSig, hudToolSig, updateHud } from '../ui/hud.js';
import { Mini } from '../ui/minigames.js';
import { initHud2, resizeHud2 } from '../ui/overlay2d.js';
import { Radio, updateRadio } from '../ui/radio.js';
import { closeSheet, resumeFromPause, screenJournal, screenMap, screenMenu, screenPause, screenPhone } from '../ui/screens.js';
import { KIOSKS, POLES, PROPS } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 28. Мир, цикл и запуск                                               */
/* ------------------------------------------------------------------ */
export function resetWorld(fresh) {
  S.player = newPlayer(); S.bike = newBike();
  S.heat = 0; S.fx.length = 0; S.npcs.length = 0; S.guards.length = 0;
  S.mission = null; S.missionIndex = 0; S.missionsDone = []; S.free = false; S.freeCount = 0;
  S.partner = { cooldown: 0, eta: 0, active: 0, forgot: false }; S.partnerBonus = false;
  S.clock = START_HOUR * 3600; S.day = 1; S.ended = null; S.phoneRing = 0; S.autosave = 0;
  S.stats = { earned: 0, crashes: 0, fixed: 0, sober: 0, bestQ: 0, fines: 0, dist: 0 };
  S.flags = {}; S.upgrades = {}; S.phone = { calls: {} };
  S.egg = { stage: 'none', ring: 0, burnt: 0 };
  spawnTraffic(); spawnDogs(); spawnHools(); spawnGrans(); spawnPeds();
  for (const p of POLES) p.installed = false;
  for (const k of KIOSKS) k.broken = false;
  for (const p of PROPS) p.broken = false;
  __set_hudToolSig('');
  S.cam.tx = S.player.x; S.cam.tz = S.player.z; S.cam.x = S.player.x; S.cam.z = S.player.z + 5; S.cam.y = 3;
  if (fresh) S.tutorial = null;
}
/* Развод у конторы. Смена начинается не с пустого двора, а с того, что вся
   бригада стоит вместе, Ваня делит объекты, а дальше все расходятся — и
   переспрашивать, по девизу, никто уже не будет. */
export const BRIEF = {
  oleg:   { x: 12.0, z: 51.4, yaw: 0 },
  vanya:  { x: 12.2, z: 54.8, yaw: Math.PI },
  kostya: { x: 14.4, z: 53.9, yaw: Math.PI * 0.86 },
  sanya:  { x: 9.9,  z: 54.0, yaw: Math.PI * 1.16 },
  bike:   { x: 15.6, z: 53.4, yaw: 0.62 }
};
export function spawnBrigade() {
  const p = S.player, b = BRIEF;
  p.x = b.oleg.x; p.z = b.oleg.z; p.yaw = b.oleg.yaw; p.vx = p.vz = 0;
  S.bike.x = b.bike.x; S.bike.z = b.bike.z; S.bike.yaw = b.bike.yaw; S.bike.parked = true;
  for (const k of ['vanya', 'kostya', 'sanya'])
    S.npcs.push({ kind: k, who: k, x: b[k].x, z: b[k].z, yaw: b[k].yaw, vx: 0, vz: 0,
      phase: 0, say: 0, line: '', gait: k, seed: Math.random(), brief: 1, leave: 0,
      time: 0, sp: 0, acc: 0, act: '', actK: 0, idle: 0, idleP: 1, lkY: 0, lkP: 0 });
  /* камера сразу за спиной Олега, чтобы бригада была в кадре с первого кадра */
  S.cam.yaw = p.yaw + Math.PI; S.cam.pitch = 0.24; S.cam.dist = 6.0; S.cam.manual = 0;
  S.cam.tx = p.x; S.cam.tz = p.z; S.cam.ty = 1.35;
  S.cam.x = p.x - Math.sin(p.yaw) * 6; S.cam.z = p.z - Math.cos(p.yaw) * 6; S.cam.y = 3;
}
export function briefingScene(after) {
  Dlg.seq([
    { who: 'vanya',  text: 'Так, бригада. Пять вечера, объектов больше, чем нас, велосипед один. Слушаем один раз.' },
    { who: 'vanya',  text: 'Костя — на дальние точки. Ставишь и не переставляешь. Саня — на телефоне и на подстраховке. Олег — всё остальное.' },
    { who: 'oleg',   text: 'А почему опять всё остальное?' },
    { who: 'vanya',  text: 'Потому что ты единственный, кто доезжает.' },
    { who: 'kostya', text: 'Понял, не дурак. Был бы дурак — не понял.' },
    { who: 'sanya',  text: 'Я на связи. Если что — приеду. Может быть.' },
    { who: 'vanya',  text: 'И чтобы потом никто не переспрашивал. ' + MOTTO },
    { who: 'kostya', text: 'Вот именно. Я поехал, мне ещё на два адреса.' },
    { who: 'sanya',  text: 'Олег, если Костя где-то был — проверь за ним. По-доброму говорю.' },
    { who: 'oleg',   text: 'Проверю. Как всегда за всеми проверяю.' },
    { who: 'vanya',  text: 'Тамара скинет заявку. Велосипед твой у стены. Работаем.' }
  ], () => {
    const go = (k, yaw, t) => { const n = S.npcs.find(o => o.brief && o.kind === k); if (n) { n.yaw = yaw; n.leave = t; } };
    go('kostya', Math.PI * 0.5, 8);       /* Костя уезжает первым — он всегда первым */
    go('sanya', Math.PI * 1.45, 9);
    go('vanya', Math.PI * 0.02, 11);
    if (after) after();
  });
}
export function startNewGame(withTutorial) {
  Mini.close(); Dlg.closeAll(); resetWorld(true); closeSheet();
  S.screen = 'play'; Audio2.init(); Audio2.resume();
  spawnBrigade();
  if (withTutorial) {
    S.tutorial = { step: 0, moved: 0, sprint: 0, rode: 0, braked: false, mapOpened: false, wait: 0, looked: 0, turned: 0 };
    briefingScene(() => toast('Обучение: ' + TUTORIAL[0].text, 'info', 3000));
  } else briefingScene(() => { S.phoneRing = 1.5; });
  saveGame(true);
}
export function updatePrompt() {
  const it = currentInteraction(), el = $('prompt');
  if (it && !Dlg.open) { el.style.display = 'block'; $('promptText').innerHTML = '<b>E</b> — ' + it.label; }
  else el.style.display = 'none';
}
export function updateFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i];
    f.life -= dt;
    if (f.life <= 0) { S.fx.splice(i, 1); continue; }
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    if (f.kind !== 'text') { f.vx *= Math.exp(-2.6 * dt); f.vz *= Math.exp(-2.6 * dt); f.vy -= 7 * dt; }
  }
}
export function updateWorld(dt) {
  const p = S.player;
  S.clock += dt * (86400 / DAY_LEN);
  if (S.clock >= 86400) { S.clock -= 86400; S.day++; toast('Новый день. День ' + S.day, 'info', 2200); }
  p.invuln = Math.max(0, p.invuln - dt); p.hurt = Math.max(0, p.hurt - dt);
  p.swing = Math.max(0, p.swing - dt); p.swingCd = Math.max(0, p.swingCd - dt);
  /* Олег у объекта заявки не стоит столбом, а ковыряется отвёрткой */
  tickAct(p, dt, !p.onBike && S.mission && S.mission.stage === 'work' && Math.hypot(p.vx, p.vz) < 0.4
    && dist2(p.x, p.z, S.mission.def.site.x, S.mission.def.site.z) < 16 ? 'work' : '');
  const wasDrunk = p.drunk;
  p.drunk = clamp(p.drunk - BAL.soberRate * dt, 0, 100);
  if (wasDrunk > 0 && p.drunk <= 0) toast('Голова прояснилась. Работать можно', 'good', 2400);
  if (p.drunk > 60 && Math.random() < 0.35 * dt) floater(p.x, 2.2, p.z, pick(['…', 'Оп', 'Куда руль?']), '#8a2be2');
  /* Бубнит себе под нос, стоя на месте. Чем пьянее, тем чаще и тем убеждённее
     он не пьёт. */
  p.say = Math.max(0, p.say - dt);
  if (p.say <= 0 && !Dlg.open && !p.onBike &&
      Math.random() < (0.09 + p.drunk * 0.002) * dt) {
    p.say = 3.4; p.line = pick(CREW_LINES.oleg);
  }
  if (p.drunk > 45) addHeat(0.5 * dt);            /* внимание района растёт само, молча */
  if (p.onBike) moveBike(dt); else movePlayerOnFoot(dt);
  updateCars(dt); updateDogs(dt); updateHools(dt); updatePeds(dt); updatePartner(dt); updateHeat(dt);
  updateGrans(dt);
  updateMission(dt);
  if (!S.mission && S.phoneRing > 0 && !Dlg.open) { S.phoneRing -= dt; if (S.phoneRing <= 0) offerMission(S.missionIndex); }
  /* Личная история: если заявки нет и Олег просто ходит, Ваня звонит сам. */
  if (!S.flags.aznetDone && S.egg.stage === 'none' && !S.mission && !Dlg.open) {
    S.egg.ring += dt;
    if (S.egg.ring > 70) eggRing();
  }
  S.autosave += dt;
  if (S.autosave > 20) { S.autosave = 0; saveGame(true); }
  if (S.tutorial && !S.tutorial.done) updateTutorial(dt);
  updatePrompt();
}
export function handleKeys() {
  if (Input.anyHit(K.pause)) {
    if (Dlg.open && Dlg.opts) { }
    else if (S.screen === 'menu' || S.screen === 'win' || S.screen === 'lose') { }
    else if (S.screen === 'pause') resumeFromPause();
    else if ($('screens').classList.contains('show')) closeSheet();
    else if (Input.locked) exitLock();
    else if (S.screen === 'play' || S.screen === 'mini') screenPause();
    Audio2.click();
    return;
  }
  if (Dlg.open) return;
  if (S.screen === 'map' && Input.anyHit(K.map)) { closeSheet(); return; }
  if (S.screen === 'journal' && Input.anyHit(K.phone)) { closeSheet(); return; }
  if (S.screen === 'phone') {
    if (Input.anyHit(K.myphone)) { closeSheet(); return; }
    /* цифрами звоним по порядку из книжки — как на кнопочном */
    const book = PHONE.book('oleg');
    for (let i = 0; i < book.length && i < 9; i++)
      if (Input.pressed('Digit' + (i + 1))) { callContact(book[i]); return; }
    return;
  }
  if (S.screen !== 'play') return;
  if (Input.anyHit(K.map)) { screenMap(); return; }
  if (Input.anyHit(K.phone)) { screenJournal(); return; }
  if (Input.anyHit(K.myphone)) { screenPhone(); return; }
  if (Input.anyHit(K.radio)) { toast('Радио: ' + Audio2.nextStation(), 'info', 1600); Radio.timer = 0; }
  if (Input.anyHit(K.partner)) callPartner();
  if (Input.anyHit(K.act)) handleAction();
  if (Input.anyHit(K.tool)) useTool();
  for (let i = 0; i < 8; i++) if (Input.pressed('Digit' + (i + 1)) && S.player.tools[i]) { S.player.tool = i; __set_hudToolSig(''); Audio2.click(); }
}
export function resizeAll() {
  resizeGL(); resizeHud2();
  if (Mini.g) Mini.resize();
}
export let lastTs = 0, crashed = false, hardErrors = 0;
export function frame(ts) {
  requestAnimationFrame(frame);
  if (crashed) return;
  Perf.frameTs(ts);
  const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
  lastTs = ts;
  try { step(dt || 0.016); Perf.tick(ts); Perf.readout(ts); } catch (e) { fatal(e, true); }
}
export function step(dt) {
  S.t += dt;
  Dlg.update(dt);
  updateRadio(dt);
  if (S.screen === 'play' && !Dlg.open) updateWorld(dt);
  else if (S.screen === 'mini' && !Dlg.open) Mini.update(dt);
  else if (Dlg.open) $('prompt').style.display = 'none';
  updateFx(dt);
  updateCamera(dt);
  renderFrame();
  if (S.screen === 'mini' || Mini.g) Mini.draw();
  updateHud();
  handleKeys();
  Input.endFrame();
}
export function fatal(err, hard) {
  const msg = (err && (err.stack || err.message)) || String(err);
  if (hard) { hardErrors++; if (hardErrors > 40) crashed = true; }
  $('errtext').textContent = msg + (crashed ? '\n\nИгра остановлена. Перезапусти — сохранение обычно цело.' : '\n\nИгра продолжает работать.');
  $('errbox').style.display = 'block';
  if (!$('errRestart')) {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '10px';
    const b = document.createElement('button');
    b.id = 'errRestart'; b.className = 'btn sm y'; b.textContent = 'Перезапустить игру';
    b.addEventListener('click', () => location.reload());
    const h = document.createElement('button');
    h.className = 'btn sm'; h.textContent = 'Скрыть'; h.style.marginLeft = '8px';
    h.addEventListener('click', () => { $('errbox').style.display = 'none'; });
    wrap.appendChild(b); wrap.appendChild(h);
    $('errbox').appendChild(wrap);
  }
  try { console.error('[Монтаж-Сити 3D]', err); } catch (e) { }
}
/* Заставка загрузки. Генерация текстур и сборка района идут порциями между
   кадрами: полоса прогресса перерисовывается, вкладка не «зависает». */
export const Loader = {
  show(title) { $('loadTitle').textContent = title; $('loading').style.display = 'flex'; this.set('', 0); },
  set(text, frac) {
    if (text !== undefined && text !== null) $('loadStep').textContent = text;
    if (frac !== undefined) $('loadBar').firstElementChild.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%';
  },
  hide() { $('loading').style.display = 'none'; },
  /* Отдать кадр браузеру, чтобы полоса перерисовалась. В скрытой вкладке
     rAF не приходит, а таймеры зажаты до секунды — там не ждём вовсе и
     собираем всё подряд, как раньше: прогресс показывать некому. */
  yield() {
    if (document.hidden) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const go = () => { if (!done) { done = true; res(); } };
      requestAnimationFrame(go); setTimeout(go, 60);
    });
  }
};
export async function boot() {
  try {
    loadOpts();
    const gl = initRenderer($('gl'));
    if (!S.quality) S.quality = QCFG.pickDefault(GL.renderer, window.devicePixelRatio || 1);
    applyProfile(S.quality, false);
    initHud2();
    resizeAll();
    Loader.set('генерируем текстуры', 0);
    await buildTexturesAsync(gl, (f, job) => Loader.set(job ? 'генерируем текстуры · ' + job : null, f * 0.55));
    Loader.set('строим район', 0.57); await Loader.yield();
    buildSolids();
    buildWorld(gl);
    Cull.init(gl);                     /* коробки клеток — после сборки батчей */
    Loader.set('рисуем вывески', 0.72); await Loader.yield();
    await buildSignsAsync(gl, (f, job) => Loader.set(job ? 'рисуем вывески · ' + job : null, 0.72 + f * 0.10));
    Loader.set('собираем жителей и технику', 0.84); await Loader.yield();
    buildCharacters(gl);
    buildVehicles(gl);
    /* Окружение собираем целиком один раз при загрузке: по грани за кадр оно
       набралось бы только к шестому кадру, и первый кадр смены был бы без
       неба и без рассеянного света. */
    Env.update(12);
    EnvMap.dirty = true; EnvMap.job = 0;
    EnvMap.update(gl, true);
    Loader.set(null, 1);
    Input.init();
    resetWorld(true);
    saveOpts();                        /* закрепить профиль, выбранный по умолчанию */
    window.addEventListener('resize', resizeAll);
    window.addEventListener('orientationchange', () => setTimeout(resizeAll, 300));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (S.screen === 'play') saveGame(true); }
      else lastTs = performance.now();
    });
    window.addEventListener('beforeunload', () => { if (S.screen === 'play' && !S.ended) saveGame(true); });
    window.addEventListener('error', e => fatal(e.error || e.message, false));
    window.addEventListener('unhandledrejection', e => fatal(e.reason || 'unhandled rejection', false));
    const kick = () => { Audio2.init(); Audio2.resume(); };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    /* Крючок только для оснастки: tools/sky-test.mjs сверяет GLSL-модель неба
       с её JS-двойником, а для этого ему нужны обе. Ставится исключительно
       при запуске с ?mc3d-test — при обычном открытии из file:// в window
       по-прежнему не торчит ничего. */
    if (location.search.indexOf('mc3d-test') >= 0) window.__MC3D = { QCFG, SkyJS, Env, EnvMap, GL, R3, GLSL_SKY, Perf, S, Cull, HDR, SHADOW, SSAO, SSR, BLOOM, renderFrame, get Q() { return Q; } };
    Loader.hide();
    screenMenu();
    requestAnimationFrame(frame);
  } catch (e) {
    $('loading').innerHTML = '<div style="max-width:640px;text-align:center;font:600 14px/1.5 var(--ui);color:#f7ecff;text-transform:none;letter-spacing:0">' +
      '<b style="display:block;font:900 20px var(--head);color:#ff2d95;margin-bottom:10px">Не удалось запустить 3D</b>' +
      (e && e.message ? String(e.message) : String(e)) +
      '<br><br>Нужен браузер с WebGL2 и аппаратным ускорением (актуальный Chrome). Проверь chrome://gpu.</div>';
    try { console.error(e); } catch (er) { }
  }
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export function __init() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
