/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «14. Радио и бегущая строка», строки 8815–8935.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $, TAU, pick } from '../core/util.js';
import { roundRect } from './minigames.js';


/* ------------------------------------------------------------------ */
/* 14. Радио и бегущая строка                                           */
/* ------------------------------------------------------------------ */
export const ADS = [
  'Реклама: «Гипсокартон Иваныча — стена, которая слушает».',
  'Объявление: «Сдаётся угол. Угол острый, зато свой».',
  'Реклама: «Замок „Три Оборота“ — открывается только при вас. Иногда даже при вас».',
  'Новости района: «Во дворе на Панельной снова передвинули лавочку. Следствие идёт».',
  'Реклама: «Кабель „Вечный“ — вечный, пока лежит в бухте».',
  'Объявление: «Ищу того, кто вчера чинил домофон. Он мне ещё нравится».',
  'Реклама: «Сигнализация „Сосед не спит“ — сосед действительно не спит».',
  'Прогноз: «Вечером закат, местами хулиганы, к ночи — понимание».',
  'Реклама: «Стяжки „Крепче слова“ — 100 штук в пачке, 3 останутся навсегда».',
  'Диспетчерская сообщает: «Заявки не заканчиваются. Это не баг».',
  'Реклама: «Чайная „Термос“: чай горячий, разговоры тёплые, счёт честный».',
  'Совет дня: «Если провод не звонится — виноват не провод. Но начните с провода».'
];
export const DJ = [
  'Вы слушаете волну, на которой всё держится на стяжках.',
  'Следующий трек — для тех, кто держит лестницу.',
  'Передаём привет монтажникам, электрикам и тем, кто «просто рядом стоял».',
  'В эфире — музыка для длинных дворов и коротких смен.'
];
export const Radio = { text: '', x: 0, w: 0, timer: 0 };
export function updateRadio(dt) {
  Radio.timer -= dt;
  if (Radio.timer <= 0 || !Radio.text) {
    Radio.timer = 13;
    const st = Audio2.stations[Audio2.station];
    Radio.text = (Math.random() < 0.45 ? pick(DJ) : pick(ADS)) + '   ///   ' + st.name + '   ///   ';
    $('tick').textContent = Radio.text + Radio.text;
    Radio.x = $('tickWrap').offsetWidth;
    Radio.w = $('tick').offsetWidth / 2;
  }
  Radio.x -= dt * 62;
  if (Radio.x < -Radio.w) Radio.x += Radio.w;
  $('tick').style.transform = 'translateX(' + Math.round(Radio.x) + 'px)';
  $('stationName').textContent = Audio2.stations[Audio2.station].name;
}


/* вспомогательная плоская отрисовка для мини-игр и интерфейса */
export function wrapText(c, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  c.fillText(line, x, yy);
}

/* --- люди --- */
export function drawPerson(c, x, y, o) {
  const ph = o.phase || 0, dir = o.dir || 0;
  const facing = Math.cos(dir) >= 0 ? 1 : -1;
  const bob = Math.sin(ph * 2) * 1.4;
  const legA = Math.sin(ph * 2) * 6, legB = -legA;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(10,6,20,.38)';
  c.beginPath(); c.ellipse(3, 2, 11, 5, 0, 0, TAU); c.fill();
  c.strokeStyle = o.pants || '#2f3550'; c.lineWidth = 4.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-2, -12); c.lineTo(-2 + legA * 0.5, 0); c.moveTo(3, -12); c.lineTo(3 + legB * 0.5, 0); c.stroke();
  c.fillStyle = o.body || '#ff8a1f';
  roundRect(0, c, -8, -30 + bob, 17, 20, 4); c.fill();
  if (o.vest) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-8, -24 + bob, 17, 2.6); c.fillRect(-8, -19 + bob, 17, 2.6); }
  c.strokeStyle = o.body || '#ff8a1f'; c.lineWidth = 4;
  const armA = Math.sin(ph * 2 + Math.PI) * 5;
  c.beginPath(); c.moveTo(-6, -26 + bob); c.lineTo(-9 + armA * 0.4, -16 + bob); c.stroke();
  c.beginPath(); c.moveTo(7, -26 + bob); c.lineTo(10 - armA * 0.4, -16 + bob); c.stroke();
  if (o.bag) { c.fillStyle = '#3a2a22'; roundRect(0, c, 6 * facing, -22 + bob, 11, 12, 3); c.fill(); c.fillStyle = '#ffd23f'; c.fillRect(6 * facing + 2, -19 + bob, 7, 2); }
  c.fillStyle = o.skin || '#e8b48a';
  c.beginPath(); c.arc(0.5, -36 + bob, 8, 0, TAU); c.fill();
  c.fillStyle = o.hair || '#4a3a2a';
  c.beginPath(); c.arc(0.5, -38 + bob, 8, Math.PI, TAU); c.fill();
  if (o.cap) { c.fillStyle = o.cap; c.beginPath(); c.arc(0.5, -39 + bob, 8.4, Math.PI, TAU); c.fill(); c.fillRect(0.5 + (facing > 0 ? 0 : -10), -40 + bob, 10, 3); }
  c.fillStyle = '#1b1226';
  c.beginPath(); c.arc(0.5 + 2.6 * facing, -36 + bob, 1.4, 0, TAU); c.fill();
  if (o.tool) { c.fillStyle = '#ffd23f'; c.fillRect(9 * facing, -25 + bob, 8, 4); }
  c.restore();
}
export function drawToolIcon(c, x, y, id, on) {
  c.save(); c.translate(x, y);
  c.lineCap = 'round';
  switch (id) {
    case 'screw':
      c.fillStyle = '#ffd23f'; roundRect(0, c, -10, -6, 14, 12, 3); c.fill();
      c.fillStyle = '#8d8499'; c.fillRect(4, -3, 10, 6);
      c.fillStyle = '#3a3446'; c.fillRect(-8, 4, 8, 8); break;
    case 'tester':
      c.fillStyle = '#4be36b'; roundRect(0, c, -9, -9, 18, 18, 3); c.fill();
      c.fillStyle = '#0b0518'; c.fillRect(-6, -6, 12, 7);
      c.strokeStyle = '#ff4d5e'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, 6); c.lineTo(-12, 12); c.stroke();
      c.strokeStyle = '#25e8dc'; c.beginPath(); c.moveTo(6, 6); c.lineTo(12, 12); c.stroke(); break;
    case 'ladder':
      c.strokeStyle = '#c9a24f'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-7, -11); c.lineTo(-4, 11); c.moveTo(7, -11); c.lineTo(4, 11); c.stroke();
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const yy = -8 + i * 6; c.beginPath(); c.moveTo(-6.4 + i * 0.4, yy); c.lineTo(6.4 - i * 0.4, yy); c.stroke(); } break;
    case 'cable':
      c.strokeStyle = '#25e8dc'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, 0, 10, 7, 0, 0, TAU); c.stroke();
      c.strokeStyle = '#ff2d95'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, -3, 7, 5, 0, 0, TAU); c.stroke(); break;
    case 'drill':
      c.fillStyle = '#ff8a1f'; roundRect(0, c, -10, -8, 13, 11, 3); c.fill();
      c.fillStyle = '#8d8499'; c.fillRect(3, -4, 12, 3);
      c.fillStyle = '#3a3446'; c.fillRect(-8, 3, 7, 9); break;
    case 'ties':
      c.strokeStyle = '#e9dcff'; c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-10, i * 5); c.quadraticCurveTo(0, i * 5 - 5, 10, i * 5); c.stroke(); } break;
    case 'lamp':
      c.fillStyle = on ? '#ffd23f' : '#8d8499'; roundRect(0, c, -11, -5, 16, 10, 3); c.fill();
      c.fillStyle = on ? 'rgba(255,235,150,.95)' : '#3a3446';
      c.beginPath(); c.moveTo(5, -6); c.lineTo(15, -11); c.lineTo(15, 11); c.lineTo(5, 6); c.closePath(); c.fill(); break;
  }
  c.restore();
}
