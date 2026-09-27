/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «12а. Личный телефон: книжка и звонки», строки 7552–7956.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $, TAU, clamp, fmtMoney, m4, pick } from '../core/util.js';
import { taskText } from './crew.js';
import { addMoney, floater, fx3, shake, toast } from './effects.js';
import { MOTTO } from './missions.js';
import { callPartner } from './npcs.js';
import { S, START_HOUR, hour } from './state.js';
import { saveGame } from '../save/savegame.js';
import { Dlg } from '../ui/dialog.js';
import { closeSheet, showSheet, wire } from '../ui/screens.js';
import { W } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 12а. Личный телефон: книжка и звонки                                 */
/* ------------------------------------------------------------------ */
/* Телефон в районе есть у каждого, и в книжке у каждого записаны все
   остальные: свой номер себе не пишут. Тамара, скорая и ПНД стоят у всех
   без исключения. Игроку доступна книжка Олега, остальные книжки нужны,
   чтобы жители звонили друг другу — это слышно репликами во дворе. */
export const PHONE = {
  people: ['vanya', 'kostya', 'sanya', 'oleg', 'egorov'],
  services: ['tamara', 'ambul', 'pnd'],
  book(who) { return this.people.filter(p => p !== who).concat(this.services); },
  /* У каждого свой аппарат — в книжке он подписан, как в жизни. */
  model: {
    vanya:  'iPhone 15 Pro Max',
    kostya: 'iPhone 13 Pro',
    sanya:  'iPhone 17 Pro Max',
    oleg:   'Xiaomi · Android',
    egorov: 'Samsung Galaxy A55',
    tamara: 'рабочий, с проводом',
    ambul:  'единый номер',
    pnd:    'городской'
  },
  short: {
    vanya: 'Ваня', kostya: 'Костя', sanya: 'Саня', oleg: 'Олег',
    egorov: 'Егоров Сергей', tamara: 'Тамара', ambul: 'Скорая помощь', pnd: 'ПНД'
  },
  note: {
    vanya:  'бригадир · объясняет один раз',
    kostya: 'монтажник · уже уехал',
    sanya:  'напарник · приедет, может быть',
    oleg:   'это ты',
    egorov: 'ставил тут всё до нас',
    tamara: 'диспетчер · заявки и адреса',
    ambul:  'вызов на адрес · платный',
    pnd:    'дежурный · круглосуточно'
  }
};

/* --------------------------------------------------------------------
   Личная история Олега. Ваня звонит и гонит на периметр, на объекте стоит
   прибор, у прибора две клеммы, и Олег честно выбирает, какую проверить.
   Выбор ни на что не влияет: и там и там он подаёт 220, прибор уходит с
   дымом, а Олег уходит в запой. Провалить это нельзя — это не задание, а
   то, что случается. Названия выдуманы, как и всё остальное в районе.  */
export const EGG = {
  mark: { x: 118, z: 66.2, label: 'база «Заводская», периметр' },
  dev:  { x: 118, y: 1.18, z: 67.5 }
};

/* Заряд садится за смену: в пять вечера полный, к глубокой ночи треть. */
export function phoneBattery() {
  const spent = ((hour() - START_HOUR + 24) % 24) / 12;
  return Math.round(clamp(100 - spent * 68, 12, 100));
}
/* Связь: в промзоне железо и бетон, по краям района — просто никому не надо. */
export function phoneSignal() {
  const p = S.player;
  if (p.x > 100 && p.z < 70) return 1;
  if (p.x < 12 || p.x > W.x - 12 || p.z < 10 || p.z > W.z - 10) return 2;
  return 4;
}

/* Что бригада роняет в эфир между делом. Эти же реплики всплывают пузырями
   над Ваней, Костей и Саней, когда они стоят рядом, и над самим Олегом. */
export const CREW_LINES = {
  vanya: [
    'Ой, да там хуйня делов.',
    'Да, мы это сделаем.',
    'А мы зарабатываем не на работе, а на монтажниках.',
    'Меня опять наебали.',
    'Какие деньги? У меня их никогда нет.',
    'Ты чё, не видел мои долги?',
    'Ребят, может уже работать будем?'
  ],
  kostya: [
    'Ой да ладно, чё ты? Я просто тебя проверял.',
    'А чё я? Я лысый, что ли?',
    'Ну что за негатив.',
    'Что, блядь, опять на Ишим?'
  ],
  sanya: [
    'Щас бы лучше на Мириады поехать работать.',
    'Куда угодно, только не на Ишим.',
    'Нет-нет, я же сказал: на Ишим я не поеду.',
    'Пойдёмте сходим за пивом.',
    'Что-то пива не хватило. Надо больше пива.'
  ],
  oleg: [
    'Водка? Да нет, я не пью.',
    'Давай меня закодируем.',
    'Да нет, я тебе говорю: вообще больше не пью.',
    'Я всё. Теперь только работать. Пить не буду.'
  ]
};
/* Отдельно и редко — та самая, ради которой всё и затевалось. */
export const OLEG_VANYA_LINE = 'Ты гандон, Ваня. Понял? Ты гандон.';

/* Егоров Сергей монтировал этот район до бригады и убеждён, что делал это
   безупречно. Отвечает по кругу, а на четвёртый звонок подряд перестаёт. */
export const EGOROV_LINES = [
  'Да чё вы там не можете? Я это всё вот этими руками делал.',
  'Отвалите, я вообще-то сейчас ТикТок смотрю.',
  'Опять опоздали. С вас бутылка коньяка. Или виски, я не гордый.',
  'С вас пачка синих с кнопкой — и тогда, может, вспомню, где там щиток.',
  'Я на этом объекте работал, когда ты изоленту от стяжки не отличал.',
  'Всё там держалось двенадцать лет. Пришли вы — перестало.'
];

/* Олег думает вслух. Пузырь над головой — тот же, что у жителей. */
export function olegMutter(text) {
  const p = S.player;
  p.say = 3.6; p.line = text;
}

/* Ваня звонит сам. Один раз за сохранение, когда заявки нет и есть минута. */
export function eggRing() {
  S.egg.stage = 'call';
  Audio2.phone();
  toast('Звонит Ваня', 'info', 2200);
  Dlg.seq([
    { who: 'vanya', text: 'Олег. Бросай что делаешь.' },
    { who: 'vanya', text: 'На базе периметр лёг. Весь. Езжай и почини, там делов на пять минут.' },
    { who: 'oleg',  text: 'А что там стоит-то?' },
    { who: 'vanya', text: 'Да прибор какой-то. Ты разберёшься, ты же умный. ' + MOTTO },
    { who: 'oleg',  text: 'Понял. Еду.' }
  ], () => {
    S.egg.stage = 'go';
    toast('Периметр на базе «Заводская». Метка на карте', 'info', 3200);
  });
}

/* Развилка, у которой один исход. Обе клеммы ведут в одно и то же место —
   в этом вся шутка, и провалить это невозможно. */
export function eggOpenDevice() {
  const ask = () => Dlg.one('oleg',
    'Так. Периметральный прибор «АЗИМУТ-НЕТ», завод «Метеорит». Крышка вскрыта, внутри две пары клемм. ' +
    'Подписи стёрлись. Проверять чем-то надо.',
    [
      { label: 'Проверить питание 12 В', hint: 'шлейф, как положено', fn: () => eggBurn('12') },
      { label: 'Проверить 220', hint: 'сеть, чтоб наверняка', fn: () => eggBurn('220') }
    ]);
  Dlg.seq([
    { who: 'oleg', text: 'База. Забор. Прибор висит, лампочка не горит. Всё как обещали.' }
  ], ask);
}

export function eggBurn(choice) {
  const p = S.player;
  S.egg.stage = 'burn'; S.egg.burnt = 1;
  const lines = choice === '12'
    ? [
        { who: 'oleg', text: 'Двенадцать вольт. Ставлю щупы на нижнюю пару.' },
        { who: 'oleg', text: 'Так. А почему тестер показывает двести двадцать.' },
        { who: 'oleg', text: 'А, это верхняя пара. Я на верхней.' }
      ]
    : [
        { who: 'oleg', text: 'Ладно. Двести двадцать так двести двадцать, чего мелочиться.' },
        { who: 'oleg', text: 'Ставлю щупы. Всё правильно ставлю.' },
        { who: 'oleg', text: 'Только это не клеммы. Это шлейф.' }
      ];
  Dlg.seq(lines, () => {
    /* Прибор уходит с дымом. Дальше уже ничего не решается. */
    Audio2.crash(); shake(11);
    for (let i = 0; i < 3; i++) fx3(EGG.dev.x, EGG.dev.y, EGG.dev.z, 'spark', 12);
    floater(EGG.dev.x, EGG.dev.y + 0.5, EGG.dev.z, 'ПФ-Ф-Ф', '#ff8a1f');
    Dlg.seq([
      { who: 'oleg',  text: 'Пфф. Дым. Из прибора идёт дым.' },
      { who: 'oleg',  text: 'Он не должен так делать. Он вообще не должен дымить.' },
      { who: 'vanya', text: 'Олег? Ты чего трубку не берёшь? Олег!' },
      { who: 'oleg',  text: 'Меня тут нет.' }
    ], eggBender);
  });
}

/* Запой. Пять дней проходят сами, смена начинается заново, и никто ничего
   не спрашивает — прибор списали как сгоревший сам. */
export function eggBender() {
  const p = S.player;
  S.egg.stage = 'done';
  S.flags.aznetDone = true;
  const spent = Math.min(p.money, 1200 + Math.floor(Math.random() * 1800));
  S.day += 5;
  S.clock = 9 * 3600;
  p.money = Math.max(0, p.money - spent);
  p.drunk = 100;
  p.health = clamp(p.health - 18, 12, 100);
  p.stamina = 30;
  p.x = 12; p.z = 52; p.vx = p.vz = 0; p.onBike = false;
  S.bike.x = 15; S.bike.z = 52; S.bike.parked = true;
  S.cam.tx = p.x; S.cam.tz = p.z;
  Audio2.lose();
  showSheet('<h1>Пять дней</h1><div class="sub">периметр · база «Заводская»</div>' +
    '<p>Олег не помнит, как доехал до дома. Помнит только дым и то, что дым шёл не оттуда, откуда должен.</p>' +
    '<p>Прибор списали как сгоревший сам по себе: на «Заводской» и до Олега всё горело регулярно. ' +
    'Ваня звонил четыре раза, потом перестал. Тамара заявку закрыла с формулировкой «оборудование исчерпало ресурс».</p>' +
    '<div class="stats">' +
    '<i>Прошло дней</i><b>5</b>' +
    '<i>Пропито</i><b>' + fmtMoney(spent) + '</b>' +
    '<i>В кармане осталось</i><b>' + fmtMoney(p.money) + '</b>' +
    '<i>Состояние</i><b>тяжёлое</b>' +
    '</div>' +
    '<div class="note">Это не провал. Провалить это было нельзя: обе клеммы вели в одно и то же место. ' +
    'Смена продолжается, только теперь с похмелья.</div>' +
    '<div class="btns"><button class="btn p" id="bWake">Встать и пойти работать</button></div>', 'egg');
  wire('bWake', () => {
    closeSheet();
    toast('День ' + S.day + '. Голова гудит, но руки помнят', 'info', 3200);
    saveGame(true);
  });
}

export function callContact(who) {
  if (Dlg.open) return;
  closeSheet();
  /* Плохая связь — звонок просто не проходит. Неудачную попытку не считаем:
     Егоров и так не бесконечно терпеливый. */
  if (phoneSignal() <= 1 && Math.random() < 0.34) {
    Audio2.nope();
    toast('Связь пропала. Промзона', 'bad', 2200);
    return;
  }
  const n = (S.phone.calls[who] = (S.phone.calls[who] || 0) + 1);
  const say = (w, t) => ({ who: w, text: t });
  const M = S.mission;
  let seq = [];
  let after = null;

  switch (who) {
    case 'vanya':
      seq.push(say('vanya', pick(CREW_LINES.vanya)));
      seq.push(say('vanya', 'А, Олег. Слушаю.'));
      after = () => { if (Math.random() < 0.5) olegMutter(OLEG_VANYA_LINE); };
      if (M) {
        seq.push(say('oleg', 'По «' + M.def.title + '» вопрос…'));
        seq.push(say('vanya', 'Я объяснял. ' + MOTTO));
        seq.push(say('vanya', 'Ладно. ' + taskText().step + '. Всё, работаем.'));
      } else if (!S.flags.aznetDone && S.egg.stage === 'none') {
        seq.push(say('vanya', 'О, кстати. Раз ты всё равно свободен — есть дело.'));
        after = () => eggRing();
      } else {
        seq.push(say('vanya', 'Заявки нет — значит, отдыхай. Появится — Тамара позвонит.'));
      }
      break;

    case 'kostya':
      seq.push(say('kostya', pick(CREW_LINES.kostya)));
      seq.push(say('kostya', 'О, Олег! Я там уже всё посмотрел, всё нормально.'));
      seq.push(say('oleg', 'Костя, ты вообще на каком объекте?'));
      seq.push(say('kostya', 'На нужном. Ты главное не переделывай, а то опять скажут, что я криво.'));
      break;

    case 'sanya':
      seq.push(say('sanya', pick(CREW_LINES.sanya)));
      if (callPartner()) {
        seq.push(say('sanya', 'Еду. Пять минут.'));
        seq.push(say('oleg', 'Саня, твои пять минут — это сколько?'));
        seq.push(say('sanya', 'Десять. Но еду же.'));
      } else {
        seq.push(say('sanya', 'Не могу сейчас. Совсем. Правда.'));
      }
      break;

    case 'tamara':
      seq.push(say('tamara', 'Диспетчерская. Тамара.'));
      if (M) {
        const t = taskText();
        seq.push(say('tamara', t.title + '. ' + t.step + '.'));
        if (t.hint) seq.push(say('tamara', t.hint));
      } else {
        seq.push(say('tamara', 'Заявок на тебя пока нет. Отдыхай, пока дают.'));
      }
      break;

    case 'egorov': {
      if (n > 3) {
        Audio2.nope();
        toast('Егоров сбросил. Гудки', 'bad', 2200);
        return;
      }
      seq.push(say('oleg', 'Сергей, здравствуйте. По объекту вопрос.'));
      /* Вторая реплика заведомо не совпадает с первой: сдвиг никогда не кратен длине. */
      const i0 = (n - 1 + S.day) % EGOROV_LINES.length;
      seq.push(say('egorov', EGOROV_LINES[i0]));
      seq.push(say('egorov', EGOROV_LINES[(i0 + 2 + (n % 3)) % EGOROV_LINES.length]));
      break;
    }

    case 'ambul': {
      const p = S.player;
      seq.push(say('ambul', 'Скорая. Что у вас?'));
      if (p.health < 55) {
        const fee = 900;
        if (p.money >= fee) {
          seq.push(say('oleg', 'Упал с велосипеда. Бордюр оказался быстрее.'));
          seq.push(say('ambul', 'Подъедем. Перевязка, зелёнка, счёт.'));
          after = () => {
            p.health = clamp(p.health + 40, 0, 100);
            addMoney(-fee, 'Выезд скорой');
            toast('Перевязали. Ездить аккуратнее не научили', 'good', 2600);
          };
        } else {
          seq.push(say('ambul', 'Выезд платный. У вас на него не хватает. Дойдите до чайной, съешьте пирожок.'));
        }
      } else {
        seq.push(say('oleg', 'Да я так, узнать.'));
        seq.push(say('ambul', 'Здоровы. Не занимайте линию.'));
      }
      break;
    }

    case 'pnd':
      seq.push(say('pnd', 'Психоневрологический диспансер, дежурный слушает.'));
      if (S.player.drunk > 45) {
        seq.push(say('oleg', 'А вы… это… работаете?'));
        seq.push(say('pnd', 'Работаем. Но вам, судя по голосу, не к нам, а поспать.'));
      } else {
        seq.push(say('oleg', 'Мне бригадир объясняет один раз.'));
        seq.push(say('pnd', 'Это не по нашей части. Это по части бригадира.'));
      }
      break;

    default:
      seq.push(say(who, 'Абонент не отвечает.'));
  }

  Audio2.phone();
  Dlg.seq(seq, after);
}


export function drawPortrait(who) {
  const cv = $('portrait'), x = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  x.clearRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1440'); g.addColorStop(1, '#12081f');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.save(); x.translate(w / 2, h / 2 + 6);
  const skin = '#e8b48a', dark = '#1b1226';
  const P = {
    oleg:     { hat: '#ff8a1f', hair: '#5a4230', body: '#ff8a1f', beard: 1, cap: 1, glass: 0 },
    tamara:   { hat: '#ff2d95', hair: '#b03a6a', body: '#3a1a52', beard: 0, cap: 0, glass: 1, tall: 1 },
    sanya:    { hat: '#25e8dc', hair: '#3a2a1f', body: '#1f6a66', beard: 0, cap: 1, glass: 0 },
    boris:    { hat: '#ffd23f', hair: '#8a8a8a', body: '#4a4055', beard: 1, cap: 0, glass: 1 },
    hool:     { hat: '#8a2be2', hair: '#20202a', body: '#2a2a3a', beard: 0, cap: 1, glass: 0 },
    gran:     { hat: '#4be36b', hair: '#d8d8e0', body: '#5a3a6a', beard: 0, cap: 0, glass: 1, scarf: 1 },
    guard:    { hat: '#ff4d5e', hair: '#2a2a2a', body: '#3a1a1a', beard: 0, cap: 1, glass: 1 },
    client:   { hat: '#25e8dc', hair: '#4a3a2a', body: '#2a4a5a', beard: 0, cap: 0, glass: 0 },
    ohran:    { hat: '#25e8dc', hair: '#332a22', body: '#22323f', beard: 1, cap: 1, glass: 0 },
    zaved:    { hat: '#ff2d95', hair: '#a02a5a', body: '#5a2a4a', beard: 0, cap: 0, glass: 1, scarf: 1 },
    sklad:    { hat: '#ff8a1f', hair: '#2a2a2a', body: '#4a3a2a', beard: 1, cap: 0, glass: 1 },
    predsed:  { hat: '#4be36b', hair: '#c8c8d0', body: '#2a4a3a', beard: 0, cap: 0, glass: 1, scarf: 1 },
    director: { hat: '#8a2be2', hair: '#1a1a22', body: '#241a3a', beard: 0, cap: 0, glass: 1 },
    kostya:   { hat: '#2a2a34', hair: '#4a4038', body: '#3d5a44', beard: 0, cap: 0, glass: 0, bald: 1, goggles: 1 },
    vanya:    { hat: '#4a76c8', hair: '#3a2c1e', body: '#3a3e46', beard: 2, cap: 1, glass: 0, short: 1 },
    egorov:   { hat: '#e8643c', hair: '#6a5a4a', body: '#4a4038', beard: 1, cap: 1, glass: 0 },
    ambul:    { hat: '#ff4d5e', hair: '#3a3a42', body: '#dfe4ea', beard: 0, cap: 1, glass: 0 },
    pnd:      { hat: '#8a2be2', hair: '#7a7a86', body: '#dfe4ea', beard: 0, cap: 0, glass: 1 }
  }[who] || { hat: '#888', hair: '#333', body: '#444' };
  if (P.short) { x.translate(0, 4); x.scale(1.06, 0.94); }   /* невысокий: лицо шире, плечи ближе к краю */

  x.fillStyle = P.body;                     // плечи
  x.beginPath(); x.moveTo(-32, 34); x.quadraticCurveTo(0, 6, 32, 34); x.lineTo(32, 40); x.lineTo(-32, 40); x.closePath(); x.fill();
  if (P.scarf) { x.fillStyle = P.hat; x.beginPath(); x.ellipse(0, 16, 18, 8, 0, 0, TAU); x.fill(); }
  x.fillStyle = skin;                        // шея + лицо
  x.fillRect(-7, 2, 14, 14);
  x.beginPath(); x.ellipse(0, -6, 19, 22, 0, 0, TAU); x.fill();
  if (P.bald) {                              // лысина: тёмный ободок на висках и блик на темени
    x.fillStyle = P.hair;
    x.beginPath(); x.ellipse(0, -14, 19, 13, 0, Math.PI, TAU); x.fill();
    x.fillStyle = skin;
    x.beginPath(); x.ellipse(0, -12, 15.5, 12, 0, Math.PI, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,.13)';
    x.beginPath(); x.ellipse(-5, -19, 6, 3.5, -0.5, 0, TAU); x.fill();
  } else {
    x.fillStyle = P.hair;                    // волосы
    x.beginPath(); x.ellipse(0, -18, 19, 13, 0, Math.PI, TAU); x.fill();
  }
  if (P.cap) { x.fillStyle = P.hat; x.beginPath(); x.ellipse(0, -20, 20, 12, 0, Math.PI, TAU); x.fill(); x.fillRect(-22, -21, 30, 5); }
  if (P.goggles) {                           // очки, сдвинутые на лоб
    x.fillStyle = 'rgba(198,222,176,.8)';
    x.beginPath(); x.ellipse(0, -19, 13.5, 4.6, 0, 0, TAU); x.fill();
    x.strokeStyle = P.hat; x.lineWidth = 2.6;
    x.beginPath(); x.moveTo(-18, -20); x.lineTo(-12, -19.5); x.moveTo(12, -19.5); x.lineTo(18, -20); x.stroke();
  }
  x.fillStyle = dark;                        // глаза
  x.beginPath(); x.ellipse(-7, -8, 2.6, 3.1, 0, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(7, -8, 2.6, 3.1, 0, 0, TAU); x.fill();
  if (P.glass) { x.strokeStyle = '#dfe6ff'; x.lineWidth = 1.6; x.beginPath(); x.arc(-7, -8, 6, 0, TAU); x.arc(7, -8, 6, 0, TAU); x.moveTo(-1, -8); x.lineTo(1, -8); x.stroke(); }
  x.strokeStyle = '#8a5a3a'; x.lineWidth = 2;  // брови/рот
  x.beginPath(); x.moveTo(-11, -15); x.lineTo(-3, -13); x.moveTo(3, -13); x.lineTo(11, -15); x.stroke();
  x.strokeStyle = '#7a3a3a'; x.beginPath(); x.moveTo(-6, 3); x.quadraticCurveTo(0, who === 'oleg' ? 1 : 6, 6, 3); x.stroke();
  if (P.beard) {                             // борода: у густой (beard: 2) плотнее, выше и с усами
    const th = P.beard > 1;
    x.fillStyle = P.hair; x.globalAlpha = th ? .82 : .55;
    x.beginPath(); x.ellipse(0, th ? 4 : 6, th ? 15 : 13, th ? 12 : 9, 0, 0, Math.PI); x.fill();
    if (th) x.fillRect(-6.5, -0.5, 13, 2.6);
    x.globalAlpha = 1;
  }
  x.restore();
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1; x.strokeRect(.5, .5, w - 1, h - 1);
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let EGG_MAT;
export function __init() {
  EGG_MAT = m4();
}
