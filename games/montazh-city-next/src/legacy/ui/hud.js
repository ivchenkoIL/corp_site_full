/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «25. Интерфейс», строки 11782–11877.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $, TAU, fmtMoney, pad2 } from '../core/util.js';
import { taskText } from '../game/crew.js';
import { bagCapacity } from '../game/effects.js';
import { S, TOOLS, clockStr, dayPart, repTitle } from '../game/state.js';
import { TUTORIAL } from '../save/savegame.js';
import { drawToolIcon } from './radio.js';
import { BUILDINGS, POIS, ROADS_X, ROADS_Z, ROAD_W, W } from '../world/district.js';



/* ------------------------------------------------------------------ */
/* 25. Интерфейс                                                        */
/* ------------------------------------------------------------------ */
export let hudToolSig = '';
export function updateHud() {
  const p = S.player;
  $('barHp').style.width = p.health + '%'; $('numHp').textContent = Math.round(p.health);
  $('barSt').style.width = p.stamina + '%'; $('numSt').textContent = Math.round(p.stamina);
  $('barBk').style.width = S.bike.cond + '%'; $('numBk').textContent = Math.round(S.bike.cond);
  $('rowDrunk').style.display = p.drunk > 0.5 ? 'flex' : 'none';
  $('barDr').style.width = p.drunk + '%'; $('numDr').textContent = Math.round(p.drunk);
  const showQ = S.mission && (S.mission.stage === 'verify' || S.mission.stage === 'report' || (S.mission.stage === 'work' && S.mission.quality > 0));
  $('rowQual').style.display = showQ ? 'flex' : 'none';
  if (showQ) { $('barQa').style.width = S.mission.quality + '%'; $('numQa').textContent = Math.round(S.mission.quality); }
  $('numMoney').textContent = fmtMoney(p.money);
  $('numRep').textContent = 'Репутация: ' + p.rep + ' — ' + repTitle(p.rep);
  $('clock').textContent = clockStr() + '  · день ' + S.day;
  $('daypart').textContent = dayPart();
  const eyes = $('eyes').children, lvl = Math.ceil(S.heat / 20);
  for (let i = 0; i < eyes.length; i++) eyes[i].className = i < lvl ? 'on' : '';
  let t;
  if (S.tutorial && !S.tutorial.done) t = { title: 'ОБУЧЕНИЕ', step: TUTORIAL[S.tutorial.step].text, hint: 'Esc — меню, там же можно пропустить' };
  else t = taskText();
  $('taskTitle').textContent = t.title;
  $('taskStep').textContent = t.step;
  $('taskHint').textContent = t.hint || '';
  const M = S.mission;
  if (M && M.def.time && (M.stage === 'travel' || M.stage === 'work')) {
    $('taskTimer').style.display = 'block';
    const sec = Math.max(0, Math.ceil(M.timer));
    $('taskTimer').textContent = 'ОСТАЛОСЬ ' + pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
    $('taskTimer').style.color = sec < 45 ? '#ff4d5e' : '#ffd23f';
  } else $('taskTimer').style.display = 'none';

  const sig = p.tools.join(',') + '|' + p.tool + '|' + p.lampOn + '|' + bagCapacity();
  if (sig !== hudToolSig) {
    hudToolSig = sig;
    const box = $('hudBC'); box.innerHTML = '';
    for (let i = 0; i < bagCapacity(); i++) {
      const id = p.tools[i];
      const el = document.createElement('div');
      el.className = 'slot' + (i === p.tool && id ? ' on' : '') + (id ? '' : ' empty');
      el.innerHTML = '<em>' + (i + 1) + '</em>';
      if (id) {
        const cv = document.createElement('canvas');
        cv.width = 88; cv.height = 68;
        const cc = cv.getContext('2d'); cc.scale(2, 2);
        drawToolIcon(cc, 22, 18, id, id === 'lamp' && p.lampOn);
        el.appendChild(cv);
        const u = document.createElement('u'); u.textContent = TOOLS[id].short; el.appendChild(u);
      }
      el.addEventListener('click', () => { if (p.tools[i]) { p.tool = i; hudToolSig = ''; Audio2.click(); } });
      box.appendChild(el);
    }
  }
  drawMinimap();
}
export function drawMiniWorld(c, w, h, big) {
  const sx = w / W.x, sz = h / W.z;
  c.fillStyle = '#171225'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2f2b3d';
  for (const z of ROADS_Z) c.fillRect(0, (z - ROAD_W / 2) * sz, w, ROAD_W * sz);
  for (const x of ROADS_X) c.fillRect((x - ROAD_W / 2) * sx, 0, ROAD_W * sx, h);
  for (const b of BUILDINGS) {
    c.fillStyle = b.kind === 'panel' ? '#5a4a72' : b.kind === 'indust' ? '#4a5566' : b.kind === 'garage' ? '#4a4152' : '#6b4a7a';
    c.fillRect(b.x * sx, b.z * sz, b.w * sx, b.d * sz);
  }
  for (const poi of POIS) {
    c.fillStyle = poi.color;
    c.beginPath(); c.arc(poi.x * sx, poi.z * sz, big ? 7 : 2.6, 0, TAU); c.fill();
    if (big) {
      c.fillStyle = '#e9dcff'; c.font = '700 11px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
      c.fillText(poi.name, poi.x * sx, poi.z * sz - 12); c.textAlign = 'left';
    }
  }
  for (const g of S.guards) { c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(g.x * sx, g.z * sz, big ? 5 : 2.4, 0, TAU); c.fill(); }
  const t = S.mission && S.mission.target;
  if (t) {
    const pulse = 0.5 + 0.5 * Math.sin(S.t * 4);
    c.strokeStyle = '#ffd23f'; c.lineWidth = big ? 3 : 1.6;
    c.beginPath(); c.arc(t.x * sx, t.z * sz, (big ? 10 : 3) + pulse * (big ? 5 : 3), 0, TAU); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(t.x * sx, t.z * sz, big ? 5 : 2, 0, TAU); c.fill();
    if (big) { c.font = '900 12px "Arial Black",sans-serif'; c.textAlign = 'center'; c.fillText('ЦЕЛЬ: ' + t.label.toUpperCase(), t.x * sx, t.z * sz - 18); c.textAlign = 'left'; }
  }
  const p = S.player;
  c.save(); c.translate(p.x * sx, p.z * sz); c.rotate(-p.yaw + Math.PI);
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(0, -(big ? 9 : 5)); c.lineTo(big ? 6 : 3.4, big ? 6 : 3); c.lineTo(-(big ? 6 : 3.4), big ? 6 : 3); c.closePath(); c.fill();
  c.restore();
  if (big) { c.fillStyle = '#ff2d95'; c.font = '900 11px "Arial Black",sans-serif'; c.textAlign = 'center'; c.fillText('ОЛЕГ', p.x * sx, p.z * sz - 14); c.textAlign = 'left'; }
}
export function drawMinimap() {
  const cv = $('minimap'), c = cv.getContext('2d');
  drawMiniWorld(c, cv.width, cv.height, false);
}

/* Запись снаружи: ES-модуль не даёт присваивать импортированное имя. */
export function __set_hudToolSig(v) { hudToolSig = v; return v; }
