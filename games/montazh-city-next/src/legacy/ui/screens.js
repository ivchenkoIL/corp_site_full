/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «26. Экраны», строки 11878–12268.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { Q, QCFG } from '../core/quality.js';
import { $, clamp, fmtMoney, pick } from '../core/util.js';
import { taskText } from '../game/crew.js';
import { addMoney, addRep, bagCapacity, toast } from '../game/effects.js';
import { exitLock } from '../game/input.js';
import { startNewGame } from '../game/loop.js';
import { MISSIONS } from '../game/missions.js';
import { PHONE, callContact, phoneBattery, phoneSignal } from '../game/phone.js';
import { S, TOOLS, clockStr, repTitle, setHour } from '../game/state.js';
import { Perf, setQuality } from '../render/renderer.js';
import { loadGame, saveGame, saveOpts, skipTutorial } from '../save/savegame.js';
import { Save } from '../save/storage.js';
import { CHARS, Dlg } from './dialog.js';
import { __set_hudToolSig, drawMiniWorld, hudToolSig } from './hud.js';
import { Mini } from './minigames.js';
import { Radio } from './radio.js';
import { POIS } from '../world/district.js';

/* ------------------------------------------------------------------ */
/* 26. Экраны                                                           */
/* ------------------------------------------------------------------ */
export function showSheet(html, screen) {
  $('sheet').innerHTML = html;
  $('screens').classList.add('show');
  $('screens').scrollTop = 0;
  exitLock();
  if (screen) { if (S.screen !== 'pause' && S.screen !== screen) S.prevScreen = S.screen; S.screen = screen; }
  Audio2.select();
}
export function closeSheet() { $('screens').classList.remove('show'); S.screen = Mini.g ? 'mini' : 'play'; }
export function wire(id, fn) { const el = $(id); if (el) el.addEventListener('click', e => { e.preventDefault(); Audio2.click(); fn(); }); }
export const DISCLAIMER = '<div class="disclaimer">Главный герой, организации и события полностью вымышлены. Любые совпадения случайны. Игра — сатира; в ней нет реальных людей, фотографий и персональных данных, а схемы монтажа условны и служат головоломкой. Вся графика, модели, текстуры и звуки созданы для этой игры программно.</div>';

export function screenMenu() {
  const has = Save.has();
  showSheet('<h1>Монтаж-Сити 3D</h1><div class="sub">Трудная смена · вид от третьего лица</div>' +
    '<p>Вымышленный монтажник <b>Олег Левинцов</b> ставит СКУД и камеры в районе «Заводская Слобода». ' +
    'Трёхмерный район, велосипед, дворовые хулиганы, бабушки-свидетели и вечный дефицит нужного инструмента.</p>' +
    '<div class="btns"><button class="btn p" id="bNew">Новая смена</button>' +
    (has ? '<button class="btn c" id="bCont">Продолжить</button>' : '') +
    '<button class="btn" id="bCtl">Управление</button><button class="btn" id="bSet">Настройки</button>' +
    '<button class="btn" id="bAbout">Об игре</button></div>' +
    (Save.available ? '' : '<div class="note">localStorage недоступен — прогресс не сохранится.</div>') +
    '<div class="cols" style="margin-top:18px">' +
    '<div><h3>Что делать</h3><p>Получить заявку → забрать комплект на складе → доехать → смонтировать в мини-игре → проверить → сдать заказчику → купить улучшения.</p></div>' +
    '<div><h3>Камера</h3><p>Камера едет за спиной: <b>A/D</b> разворачивают Олега, и обзор поворачивается вместе с ним. <b>W/S</b> — вперёд и назад, колесо — приближение. Мышь осматривается вручную, потом камера сама возвращается за спину.</p></div>' +
    '</div>' + DISCLAIMER, 'menu');
  wire('bNew', () => { if (Save.has()) confirmSheet('Начать новую смену? Старое сохранение будет стёрто.', () => { Save.wipe(); startNewGame(true); }, screenMenu); else startNewGame(true); });
  wire('bCont', () => { if (loadGame()) { closeSheet(); S.screen = 'play'; toast('Смена продолжается', 'good'); } else startNewGame(true); });
  wire('bCtl', () => screenControls(screenMenu));
  wire('bSet', () => screenSettings(screenMenu));
  wire('bAbout', () => screenAbout(screenMenu));
}
export function confirmSheet(text, yes, no) {
  showSheet('<h2>Минуточку</h2><p>' + text + '</p><div class="btns"><button class="btn p" id="cY">Да</button><button class="btn" id="cN">Нет</button></div>');
  wire('cY', yes); wire('cN', no || closeSheet);
}
export function screenControls(back) {
  showSheet('<h2>Управление</h2><div class="cols"><div class="keys">' +
    '<kbd>W / S</kbd><span>идти вперёд и назад</span>' +
    '<kbd>A / D</kbd><span>повернуть Олега; камера сама едет за спину</span>' +
    '<kbd>Мышь</kbd><span>осмотреться вручную (клик — захват курсора или зажать правую кнопку); через секунду камера возвращается за спину</span>' +
    '<kbd>Колесо</kbd><span>приблизить / отдалить камеру</span>' +
    '<kbd>Shift</kbd><span>ускорение / разгон</span>' +
    '<kbd>Space</kbd><span>тормоз на велосипеде, рывок пешком</span>' +
    '<kbd>E</kbd><span>действие: сесть на велосипед, начать монтаж, говорить</span>' +
    '</div><div class="keys">' +
    '<kbd>F</kbd><span>инструмент: отмахнуться сумкой, фонарик, цепь</span>' +
    '<kbd>1 … 8</kbd><span>выбрать инструмент в сумке</span>' +
    '<kbd>M</kbd><span>карта района</span>' +
    '<kbd>R</kbd><span>рабочий телефон: журнал заявок</span>' +
    '<kbd>T</kbd><span>личный телефон: позвонить бригаде, Тамаре, в скорую</span>' +
    '<kbd>Q</kbd><span>переключить радиостанцию</span>' +
    '<kbd>C</kbd><span>вызвать напарника Саню</span>' +
    '<kbd>Esc</kbd><span>пауза / отпустить курсор</span>' +
    '</div></div>' +
    '<div class="note">В мини-игре камеры: <b>A/D</b> — поворот, <b>W/S</b> — наклон, <b>Z/X</b> — зум, <b>F</b> — отогнать того, кто раскачивает опору, <b>E</b> — подтвердить ракурс.</div>' +
    '<div class="note">В настройках можно переключить обзор на <b>свободную камеру</b>: тогда <b>WASD</b> двигают относительно взгляда, а камеру крутите только мышью.</div>' +
    '<div class="btns"><button class="btn c" id="bBack">Назад</button></div>');
  wire('bBack', back || closeSheet);
}
export function screenSettings(back) {
  showSheet('<h2>Настройки</h2>' +
    '<div class="slider"><span>Звуки</span><input type="range" id="sSfx" min="0" max="100" value="' + Math.round(Audio2.sfxVol * 100) + '"><b id="vSfx">' + Math.round(Audio2.sfxVol * 100) + '</b></div>' +
    '<div class="slider"><span>Радио</span><input type="range" id="sMus" min="0" max="100" value="' + Math.round(Audio2.musVol * 100) + '"><b id="vMus">' + Math.round(Audio2.musVol * 100) + '</b></div>' +
    '<div class="btns">' +
    '<button class="btn ' + (Audio2.muted ? 'p' : '') + '" id="bMute">' + (Audio2.muted ? 'Включить звук' : 'Выключить звук') + '</button>' +
    '<button class="btn" id="bStation">Станция: ' + Audio2.stations[Audio2.station].name + '</button>' +
    '<button class="btn" id="bCam">Камера: ' + (S.camFollow ? 'за спиной' : 'свободная') + '</button>' +
    '<button class="btn" id="bQual">Качество: ' + Q.title + '</button>' +
    '<button class="btn' + (S.dynamic ? '' : ' p') + '" id="bDyn">Авто-масштаб: ' + (S.dynamic ? 'вкл' : 'выкл') + '</button>' +
    '<button class="btn" id="bWipe">Стереть сохранение</button>' +
    '<button class="btn c" id="bBack">Назад</button></div>' +
    '<p style="color:#b9a6d6;font-size:12px"><b>За спиной</b> — A/D разворачивают Олега, камера следует сама. <b>Свободная</b> — WASD относительно взгляда, камера только мышью.</p>' +
    '<p style="color:#b9a6d6;font-size:12px"><b>Качество.</b> Низкое — плотность 1×, текстуры вдвое мельче, без сглаживания и с редкой зеленью (эти два — после перезапуска). Среднее — 1.25×. Высокое — полная Retina и анизотропия 16. <b>Авто-масштаб</b> держит кадр в бюджете монитора, снижая разрешение сцены; интерфейс всегда чёткий.</p>' +
    '<p id="qualInfo" style="color:#8d7cab;font:600 11px/1.5 var(--mono)"></p>');
  const sfx = $('sSfx'), mus = $('sMus');
  sfx.addEventListener('input', () => { Audio2.setSfx(sfx.value / 100); $('vSfx').textContent = sfx.value; saveOpts(); });
  mus.addEventListener('input', () => { Audio2.setMus(mus.value / 100); $('vMus').textContent = mus.value; saveOpts(); });
  wire('bMute', () => { Audio2.mute(!Audio2.muted); saveOpts(); screenSettings(back); });
  wire('bStation', () => { Audio2.nextStation(); Radio.timer = 0; saveOpts(); screenSettings(back); });
  wire('bCam', () => { S.camFollow = !S.camFollow; S.cam.manual = 0; saveOpts(); screenSettings(back); });
  wire('bQual', () => { const names = Object.keys(QCFG.profiles); setQuality(names[(names.indexOf(S.quality) + 1) % names.length]); screenSettings(back); });
  wire('bDyn', () => { S.dynamic = !S.dynamic; if (!S.dynamic) Perf.setScale(Q.scale); Perf.reset(); saveOpts(); screenSettings(back); });
  wire('bWipe', () => confirmSheet('Стереть сохранение полностью?', () => { Save.wipe(); toast('Сохранение стёрто', 'info'); screenSettings(back); }, () => screenSettings(back)));
  wire('bBack', back || closeSheet);
}
export function screenAbout(back) {
  showSheet('<h2>Об игре</h2>' +
    '<p><b>«Монтаж-Сити 3D: Трудная смена»</b> — самостоятельная сатирическая игра об одной рабочей смене вымышленного монтажника систем контроля доступа и видеонаблюдения.</p>' +
    '<h3>Как это сделано</h3><p>Собственный рендерер на WebGL2 без единой внешней библиотеки: геометрия района, домов, машин и людей строится кодом, все текстуры (асфальт, панели, кирпич, профлист, витрины, листва, вывески) рисуются на canvas при запуске. Звуки и три радиостанции синтезируются через Web Audio API.</p>' +
    '<h3>Оригинальность</h3><p>Названия, персонажи, вывески, радиостанции и реклама придуманы для этой игры. Никакие сторонние бренды, карты, модели, текстуры и материалы не используются.</p>' +
    '<h3>О вредных привычках</h3><p>Разливная в игре есть, и зайти туда можно. Но «сто грамм для настроения» — это минус к управлению, точности монтажа, оплате и репутации. Трезвая смена приносит бонус.</p>' +
    DISCLAIMER + '<div class="btns"><button class="btn c" id="bBack">Назад</button></div>');
  wire('bBack', back || closeSheet);
}
export function screenPause() {
  S.prevScreen = Mini.g ? 'mini' : 'play';
  const t = taskText();
  showSheet('<h2>Пауза</h2><p><b>' + t.title + '</b><br>' + t.step + '</p>' +
    '<div class="stats">' +
    '<i>Деньги</i><b>' + fmtMoney(S.player.money) + '</b>' +
    '<i>Репутация</i><b>' + S.player.rep + ' (' + repTitle(S.player.rep) + ')</b>' +
    '<i>Заявок сдано</i><b>' + S.missionsDone.length + '</b>' +
    '<i>Время</i><b>' + clockStr() + ', день ' + S.day + '</b></div>' +
    '<div class="btns"><button class="btn p" id="bRes">Продолжить</button>' +
    (S.tutorial && !S.tutorial.done ? '<button class="btn y" id="bSkipTut">Пропустить обучение</button>' : '') +
    '<button class="btn c" id="bMap">Карта</button><button class="btn" id="bJour">Журнал заявок</button>' +
    '<button class="btn" id="bCtl">Управление</button><button class="btn" id="bSet">Настройки</button>' +
    '<button class="btn y" id="bSave">Сохранить</button><button class="btn" id="bRestart">Начать заново</button>' +
    '<button class="btn" id="bMenu">В главное меню</button></div>', 'pause');
  wire('bRes', resumeFromPause);
  wire('bSkipTut', () => { skipTutorial(); resumeFromPause(); });
  wire('bMap', () => screenMap(screenPause));
  wire('bJour', () => screenJournal(screenPause));
  wire('bCtl', () => screenControls(screenPause));
  wire('bSet', () => screenSettings(screenPause));
  wire('bSave', () => { saveGame(); screenPause(); });
  wire('bRestart', () => confirmSheet('Начать смену заново? Текущий прогресс будет потерян.', () => { Save.wipe(); startNewGame(true); }, screenPause));
  wire('bMenu', () => { Mini.close(); Dlg.closeAll(); screenMenu(); });
}
export function resumeFromPause() { $('screens').classList.remove('show'); S.screen = Mini.g ? 'mini' : 'play'; }
export function screenMap(back) {
  showSheet('<h2>Район «Заводская Слобода»</h2><canvas id="mapCanvas" width="900" height="675"></canvas>' +
    '<div class="legend" id="mapLegend"></div>' +
    '<div class="btns"><button class="btn c" id="bBack">Закрыть (M / Esc)</button></div>', 'map');
  const cv = $('mapCanvas');
  drawMiniWorld(cv.getContext('2d'), cv.width, cv.height, true);
  $('mapLegend').innerHTML = POIS.map(poi => '<span><i style="background:' + poi.color + '"></i>' + poi.name + '</span>').join('') +
    '<span><i style="background:#fff"></i>Олег</span><span><i style="background:#ffd23f"></i>Текущая цель</span>';
  wire('bBack', back || closeSheet);
}
export function screenJournal(back) {
  const rows = MISSIONS.map((m, i) => {
    const done = S.missionsDone.find(d => d.id === m.id);
    const cur = S.mission && S.mission.def.id === m.id;
    return '<div class="job ' + (done ? 'done' : cur ? 'cur' : '') + '"><b>' + m.title + '</b>' +
      (done ? '<small>сдано · качество ' + done.q + '% · ' + fmtMoney(done.pay) + (done.late ? ' · с опозданием' : '') + '</small>'
        : cur ? '<small>в работе — ' + taskText().step + '</small>'
        : i <= S.missionIndex ? '<small>ожидает звонка</small>' : '<small>ещё не открыта</small>') + '</div>';
  }).join('');
  const freeDone = S.missionsDone.filter(d => String(d.id).indexOf('free') === 0);
  const freeRows = freeDone.length ? '<div class="job done"><b>Свободные заявки</b><small>сдано ' + freeDone.length +
    ' · заработано ' + fmtMoney(freeDone.reduce((a, b) => a + b.pay, 0)) +
    ' · среднее качество ' + Math.round(freeDone.reduce((a, b) => a + b.q, 0) / freeDone.length) + '%</small></div>' : '';
  showSheet('<h2>Рабочий телефон</h2><div class="sub">журнал заявок · «Монтаж-Сервис»</div>' +
    '<div class="jobList">' + rows + freeRows + '</div>' +
    '<h3>Статистика смены</h3><div class="stats">' +
    '<i>Заработано всего</i><b>' + fmtMoney(S.stats.earned) + '</b>' +
    '<i>Лучшее качество монтажа</i><b>' + Math.round(S.stats.bestQ) + '%</b>' +
    '<i>Костиных узлов оставлено</i><b>' + S.missionsDone.filter(d => d.kept).length + '</b>' +
    '<i>Трезвых сдач</i><b>' + S.stats.sober + '</b>' +
    '<i>Аварий на велосипеде</i><b>' + S.stats.crashes + '</b>' +
    '<i>Штрафов от ЧОП</i><b>' + S.stats.fines + '</b>' +
    '<i>Накатано</i><b>' + Math.round(S.stats.dist) + ' м</b></div>' +
    '<div class="btns"><button class="btn c" id="bBack">Закрыть (R / Esc)</button></div>', 'journal');
  wire('bBack', back || closeSheet);
}
export function screenPhone(back) {
  const book = PHONE.book('oleg');
  const bat = phoneBattery(), sig = phoneSignal();
  const bars = [3, 5, 7, 9].map((h, i) =>
    '<s class="' + (i < sig ? 'on' : '') + '" style="height:' + h + 'px"></s>').join('');
  const rows = book.map((w, i) => {
    const c = CHARS[w] || { name: w, c: '#25e8dc' };
    const nm = PHONE.short[w] || c.name;
    const off = w === 'egorov' && (S.phone.calls[w] || 0) > 3;
    return '<div class="phRow' + (off ? ' off' : '') + '">' +
      '<span class="phAv" style="background:' + c.c + '">' + nm.charAt(0) + '</span>' +
      '<span class="phWho"><b>' + nm + '</b><span>' + (i + 1) + ' · ' + (PHONE.model[w] || '') +
      (off ? ' · сбрасывает' : '') + '</span></span>' +
      '<button class="phDial" id="call_' + w + '" title="Позвонить">✆</button></div>';
  }).join('');
  showSheet('<h2>Личный телефон</h2><div class="sub">Олег · записная книжка</div>' +
    '<div class="phone"><div class="phScreen">' +
      '<div class="phNotch"><i></i></div>' +
      '<div class="phBar"><span>' + clockStr() + '</span><span class="sp"></span>' +
        '<span class="phSig">' + bars + '</span><span>' + (sig > 1 ? 'LTE' : 'E') + '</span>' +
        '<span class="phBat' + (bat < 20 ? ' dead' : bat < 40 ? ' low' : '') +
          '"><i style="width:' + bat + '%"></i></span><span>' + bat + '</span></div>' +
      '<div class="phTitle">Контакты</div>' +
      '<div class="phList">' + rows + '</div>' +
      '<div class="phFoot">' + PHONE.model.oleg + ' · мышью или цифрами 1–' + Math.min(9, book.length) + '</div>' +
    '</div></div>' +
    '<div class="note">Телефон есть у каждого в районе, и в книжке у каждого записаны все остальные — ' +
    'свой номер себе не пишут. Тамара, скорая и ПНД стоят у всех без исключения. ' +
    'В промзоне связь пропадает, и звонок иногда не проходит.</div>' +
    '<div class="btns"><button class="btn c" id="bBack">Закрыть (T / Esc)</button></div>', 'phone');
  for (const w of book) wire('call_' + w, () => callContact(w));
  wire('bBack', back || closeSheet);
}
export const SHOP_ITEMS = [
  { id: 'screw2', shop: 'toolshop', name: 'Шуруповёрт (запасной)', price: 700, desc: 'На случай, если первый «сам кого-то выбрал».', can: () => S.player.tools.indexOf('screw') < 0 && S.player.tools.length < bagCapacity(), buy: () => { S.player.tools.push('screw'); __set_hudToolSig(''); } },
  { id: 'lampBuy', shop: 'toolshop', name: 'Фонарик', price: 600, desc: 'Ночью в промзоне — единственный друг.', can: () => S.player.tools.indexOf('lamp') < 0 && S.player.tools.length < bagCapacity(), buy: () => { S.player.tools.push('lamp'); __set_hudToolSig(''); } },
  { id: 'medkit', shop: 'toolshop', name: 'Аптечка', price: 350, desc: 'Зелёнка, пластырь и уверенность. +45 здоровья.', can: () => S.player.health < 100, buy: () => { S.player.health = clamp(S.player.health + 45, 0, 100); } },
  { id: 'water', shop: 'toolshop', name: 'Бутылка воды', price: 120, desc: 'Снимает хмель на 40.', can: () => S.player.drunk > 0, buy: () => { S.player.drunk = clamp(S.player.drunk - 40, 0, 100); } },
  { id: 'consum', shop: 'toolshop', name: 'Расходники (стяжки, дюбели)', price: 300, desc: '+6 к качеству следующего монтажа.', up: true, can: () => !S.upgrades.consum, buy: () => { S.upgrades.consum = true; } },
  { id: 'bag', shop: 'toolshop', name: 'Усиленная сумка', price: 1300, desc: 'Инструмент увести труднее.', up: true, can: () => !S.upgrades.bag, buy: () => { S.upgrades.bag = true; } },
  { id: 'thermos', shop: 'toolshop', name: 'Термос «Вечный чай»', price: 900, desc: 'Выносливость восстанавливается быстрее.', up: true, can: () => !S.upgrades.thermos, buy: () => { S.upgrades.thermos = true; } },
  { id: 'tires', shop: 'workshop', name: 'Новые покрышки', price: 1500, desc: 'Держат поворот и не сдаются на ямах.', up: true, can: () => !S.upgrades.tires, buy: () => { S.upgrades.tires = true; } },
  { id: 'frame', shop: 'workshop', name: 'Лёгкая рама', price: 2600, desc: 'Разгон и максимальная скорость выше.', up: true, can: () => !S.upgrades.frame, buy: () => { S.upgrades.frame = true; } },
  { id: 'rack', shop: 'workshop', name: 'Багажник', price: 1100, desc: '+2 места в сумке для инструмента.', up: true, can: () => !S.upgrades.rack, buy: () => { S.upgrades.rack = true; __set_hudToolSig(''); } },
  { id: 'light', shop: 'workshop', name: 'Фара на руль', price: 800, desc: 'Ночью видно дорогу и чужие намерения.', up: true, can: () => !S.upgrades.light, buy: () => { S.upgrades.light = true; } },
  { id: 'saddle', shop: 'workshop', name: 'Мягкое седло', price: 700, desc: 'Меньше устаёшь на длинных перегонах.', up: true, can: () => !S.upgrades.saddle, buy: () => { S.upgrades.saddle = true; } }
];
export function shopSheet(shopId, title, subtitle, extra, back) {
  const items = SHOP_ITEMS.filter(i => i.shop === shopId);
  const cards = items.map(i => {
    const owned = i.up && S.upgrades[i.id];
    const canBuy = !owned && i.can() && S.player.money >= i.price;
    return '<div class="card' + (owned ? ' owned' : '') + '"><b>' + i.name + '</b><span>' + i.desc + '</span>' +
      '<div class="price">' + fmtMoney(i.price) + '</div>' +
      '<button class="btn sm ' + (canBuy ? 'c' : '') + '" id="buy_' + i.id + '"' + (canBuy ? '' : ' disabled') + '>' +
      (owned ? 'Уже есть' : !i.can() ? 'Не нужно' : S.player.money < i.price ? 'Не хватает денег' : 'Купить') + '</button></div>';
  }).join('');
  showSheet('<h2>' + title + '</h2><div class="sub">' + subtitle + '</div>' +
    '<p>В кармане: <b style="color:#ffd23f">' + fmtMoney(S.player.money) + '</b></p>' + (extra || '') +
    '<div class="shopGrid">' + cards + '</div>' +
    '<div class="btns"><button class="btn c" id="bBack">Выйти (Esc)</button></div>', 'shop');
  items.forEach(i => wire('buy_' + i.id, () => {
    if (S.player.money < i.price || !i.can()) return;
    addMoney(-i.price); i.buy(); Audio2.cash();
    toast('Куплено: ' + i.name, 'good'); saveGame(true);
    shopSheet(shopId, title, subtitle, extra, back);
  }));
  wire('bBack', back || closeSheet);
}
export function openPoi(id) {
  const p = S.player;
  if (id === 'toolshop') { shopSheet('toolshop', 'Крепёж и Совесть', 'магазин инструмента и мелкой надежды',
      '<div class="note">Продавец: «Берите стяжки. Стяжки берут все. Потом возвращаются за ещё».</div>'); return; }
  if (id === 'workshop') {
    const cost = Math.round((100 - S.bike.cond) * 9);
    const extra = '<div class="card" style="margin-bottom:12px"><b>Ремонт велосипеда</b>' +
      '<span>Состояние: ' + Math.round(S.bike.cond) + '%. Мастер обещает «сделать как было, только тише».</span>' +
      '<div class="price">' + (cost > 0 ? fmtMoney(cost) : 'не требуется') + '</div>' +
      '<button class="btn sm ' + (cost > 0 && p.money >= cost ? 'c' : '') + '" id="bFix"' + (cost > 0 && p.money >= cost ? '' : ' disabled') + '>' +
      (cost <= 0 ? 'Всё в порядке' : p.money < cost ? 'Не хватает денег' : 'Починить') + '</button></div>';
    shopSheet('workshop', 'Мастерская «Восьмёрка»', 'ремонт и апгрейд служебного велосипеда', extra);
    wire('bFix', () => {
      const c2 = Math.round((100 - S.bike.cond) * 9);
      if (c2 <= 0 || p.money < c2) return;
      addMoney(-c2); S.bike.cond = 100; S.bike.chain = 0;
      Audio2.ok(); toast('Велосипед как новый. Почти', 'good'); saveGame(true); openPoi('workshop');
    });
    return;
  }
  if (id === 'rest') {
    showSheet('<h2>Чайная «Термос»</h2><div class="sub">точка отдыха · тепло, сухо, без последствий</div>' +
      '<p>Пахнет пирожками и чужими рабочими историями. Здесь можно перевести дух — и это единственный способ отдохнуть без минусов.</p>' +
      '<div class="shopGrid">' +
      '<div class="card"><b>Чай с пирожком — 150 ₽</b><span>+45 выносливости, +12 здоровья, −25 хмеля.</span><button class="btn sm c" id="bTea"' + (p.money >= 150 ? '' : ' disabled') + '>' + (p.money >= 150 ? 'Взять' : 'Не хватает денег') + '</button></div>' +
      '<div class="card"><b>Просто посидеть — бесплатно</b><span>+25 выносливости.</span><button class="btn sm" id="bSit">Посидеть</button></div>' +
      '<div class="card"><b>Уехать спать до утра</b><span>Полное восстановление, новый день, хмель уходит.</span><button class="btn sm y" id="bSleep">Спать</button></div>' +
      '</div><div class="btns"><button class="btn c" id="bBack">Выйти (Esc)</button></div>', 'rest');
    wire('bTea', () => {
      if (p.money < 150) return;
      addMoney(-150);
      p.stamina = clamp(p.stamina + 45, 0, 100); p.health = clamp(p.health + 12, 0, 100);
      p.drunk = clamp(p.drunk - 25, 0, 100);
      Audio2.ok(); toast('Чай, пирожок и минута тишины', 'good'); saveGame(true); openPoi('rest');
    });
    wire('bSit', () => { p.stamina = clamp(p.stamina + 25, 0, 100); Audio2.click(); toast('Посидели. Уже легче', 'info'); openPoi('rest'); });
    wire('bSleep', () => {
      S.day++; setHour(8); p.stamina = 100; p.health = clamp(p.health + 40, 0, 100);
      p.drunk = 0; S.heat = clamp(S.heat - 40, 0, 100);
      Audio2.ok(); toast('Новый день, старые заявки', 'good'); saveGame(true); closeSheet();
    });
    wire('bBack', closeSheet);
    return;
  }
  if (id === 'bar') {
    showSheet('<h2>Разливная «Три Гвоздя»</h2><div class="sub">соблазн · плохая идея посреди смены</div>' +
      '<p>Внутри тепло, шумно и очень понимающе. Олег знает, чем это заканчивается: руль ведёт, руки дрожат, качество падает, Борисыч звонит.</p>' +
      '<div class="note">Хмель ухудшает управление и точность монтажа, режет оплату на 30%, роняет репутацию и ограничивает качество работы 62%. Трезвая сдача, наоборот, даёт +12% к оплате.</div>' +
      '<div class="shopGrid">' +
      '<div class="card"><b>«Сто грамм для настроения» — 120 ₽</b><span>+30 выносливости сейчас, много минусов потом.</span><button class="btn sm" id="bDrink"' + (p.money >= 120 ? '' : ' disabled') + '>' + (p.money >= 120 ? 'Взять (плохая идея)' : 'Не хватает денег') + '</button></div>' +
      '<div class="card"><b>Квас — 80 ₽</b><span>+20 выносливости, −15 хмеля. Никаких последствий.</span><button class="btn sm c" id="bKvas"' + (p.money >= 80 ? '' : ' disabled') + '>' + (p.money >= 80 ? 'Взять квас' : 'Не хватает денег') + '</button></div>' +
      '<div class="card"><b>Развернуться и уйти</b><span>Олег борется. Иногда даже выигрывает.</span><button class="btn sm y" id="bLeave">Уйти на объект</button></div>' +
      '</div><div class="btns"><button class="btn c" id="bBack">Выйти (Esc)</button></div>', 'bar');
    wire('bDrink', () => {
      if (p.money < 120) return;
      addMoney(-120); p.drunk = clamp(p.drunk + 35, 0, 100); p.stamina = clamp(p.stamina + 30, 0, 100);
      addRep(-2, 'Смена «после обеда»'); Audio2.gulp(); closeSheet();
      const say = [{ who: 'oleg', text: 'Ну одну. Для настроения. Настроение сразу стало ярче, а мир — шатче.' },
        { who: 'tamara', text: 'Олег. Я по дыханию в трубку всё поняла. Объект от этого лучше не станет, а премия — точно нет.' }];
      /* если позвал Костя — счёт выставляют оба сразу */
      if (S.flags.kostyaInvite) {
        S.flags.kostyaInvite = false; addRep(-2, 'Посидел с Костей посреди смены');
        say.push({ who: 'vanya', text: 'Олег. Я один раз объяснил: пить — после смены. Ты в этот момент слушал Костю.' });
      }
      Dlg.seq(say);
      saveGame(true);
    });
    wire('bKvas', () => {
      if (p.money < 80) return;
      addMoney(-80); p.stamina = clamp(p.stamina + 20, 0, 100); p.drunk = clamp(p.drunk - 15, 0, 100);
      Audio2.ok(); toast('Квас. Взрослое решение', 'good'); saveGame(true); openPoi('bar');
    });
    wire('bLeave', () => {
      closeSheet();
      if (!S.flags.leftBar) { S.flags.leftBar = true; addRep(2, 'Прошёл мимо'); }
      Dlg.one('oleg', pick(['Нет. У меня объект, лестница и совесть. Ну хотя бы объект и лестница.', 'В другой раз. И в другой тоже.']));
    });
    wire('bBack', closeSheet);
    return;
  }
  if (id === 'warehouse') {
    const M = S.mission;
    if (M && (M.stage === 'tools' || M.stage === 'travel' || M.stage === 'work')) {
      const need = M.def.tools.filter(t => p.tools.indexOf(t) < 0);
      if (!need.length) { Dlg.one('sklad', 'Всё уже у тебя в сумке, Олег. Езжай, не задерживай склад.'); if (M.stage === 'tools') M.stage = 'travel'; return; }
      const back = [];
      for (let i = p.tools.length - 1; i >= 0 && need.length > bagCapacity() - p.tools.length; i--)
        if (M.def.tools.indexOf(p.tools[i]) < 0) back.push(p.tools.splice(i, 1)[0]);
      if (back.length) p.tool = clamp(p.tool, 0, Math.max(0, p.tools.length - 1));
      if (need.length > bagCapacity() - p.tools.length) { Dlg.one('sklad', 'Столько в сумку не влезет. Возьми багажник в мастерской «Восьмёрка».'); __set_hudToolSig(''); return; }
      need.forEach(t => p.tools.push(t));
      __set_hudToolSig('');
      if (M.stage === 'tools') M.stage = 'travel';
      Audio2.ok(); saveGame(true);
      Dlg.one('sklad', 'Держи: ' + need.map(t => TOOLS[t].name).join(', ') + '.' +
        (back.length ? ' Лишнее забираю обратно: ' + back.map(t => TOOLS[t].name).join(', ') + '.' : '') + ' Распишись мысленно. И верни, Олег. Верни.');
      return;
    }
    showSheet('<h2>Склад «Ящик и Ко»</h2><div class="sub">выдача комплектов под заявку</div>' +
      '<p>Кладовщик смотрит поверх очков: «Заявки нет — комплекта нет. Такой порядок, Олег».</p>' +
      '<p>В сумке: ' + (p.tools.length ? p.tools.map(t => TOOLS[t].name).join(', ') : 'пусто') + ' (мест: ' + bagCapacity() + ')</p>' +
      '<div class="btns"><button class="btn c" id="bBack">Выйти (Esc)</button></div>', 'shop');
    wire('bBack', closeSheet);
    return;
  }
  if (id === 'base') {
    showSheet('<h2>Контора «Монтаж-Сервис»</h2><div class="sub">диспетчерская, чайник и вечный сквозняк</div>' +
      '<p>Тамара за перегородкой, Борисыч где-то «на объекте», на стене — график, который никто не соблюдает.</p>' +
      '<div class="shopGrid">' +
      '<div class="card"><b>Сохранить прогресс</b><span>Записать смену в журнал.</span><button class="btn sm c" id="bSave2">Сохранить</button></div>' +
      '<div class="card"><b>Передохнуть 10 минут</b><span>+30 выносливости, −10 внимания района.</span><button class="btn sm" id="bRest2">Передохнуть</button></div>' +
      '<div class="card"><b>Журнал заявок</b><span>Что сделано и что ещё висит.</span><button class="btn sm" id="bJ2">Открыть</button></div>' +
      '</div><div class="btns"><button class="btn c" id="bBack">Выйти (Esc)</button></div>', 'shop');
    wire('bSave2', () => { saveGame(); openPoi('base'); });
    wire('bRest2', () => { p.stamina = clamp(p.stamina + 30, 0, 100); S.heat = clamp(S.heat - 10, 0, 100); Audio2.ok(); toast('Передохнули', 'good'); openPoi('base'); });
    wire('bJ2', () => screenJournal(() => openPoi('base')));
    wire('bBack', closeSheet);
    return;
  }
}
export function endGame(win, reason) {
  if (S.ended) return;
  S.ended = win ? 'win' : 'lose';
  Mini.close(); Dlg.closeAll();
  if (win) Audio2.win(); else Audio2.lose();
  const avgQ = S.missionsDone.length ? Math.round(S.missionsDone.reduce((a, b) => a + b.q, 0) / S.missionsDone.length) : 0;
  const rank = avgQ >= 88 ? 'МАСТЕР УЧАСТКА' : avgQ >= 72 ? 'КРЕПКИЙ МОНТАЖНИК' : avgQ >= 55 ? 'РАБОТАЕТ — И ЛАДНО' : 'ЕСТЬ КУДА РАСТИ';
  const stats = '<div class="stats">' +
    '<i>Заявок сдано</i><b>' + S.missionsDone.length + '</b>' +
    '<i>Среднее качество</i><b>' + avgQ + '%</b>' +
    '<i>Заработано</i><b>' + fmtMoney(S.stats.earned) + '</b>' +
    '<i>В кармане осталось</i><b>' + fmtMoney(S.player.money) + '</b>' +
    '<i>Репутация</i><b>' + S.player.rep + ' — ' + repTitle(S.player.rep) + '</b>' +
    '<i>Трезвых сдач</i><b>' + S.stats.sober + '</b>' +
    '<i>Аварий</i><b>' + S.stats.crashes + '</b>' +
    '<i>Штрафов от ЧОП</i><b>' + S.stats.fines + '</b></div>';
  if (win) {
    showSheet('<h1>Смена сдана</h1><div class="sub">звание по итогам: ' + rank + '</div>' +
      '<p><b>Борисыч:</b> «Олег. Объект работает, заказчик доволен, кабель на месте. Иди домой, завтра новая заявка».</p>' +
      '<p><b>Ваня:</b> «Бригада отработала. Кто-то с первого раза, кто-то с третьего. Главное — отработала».</p>' +
      '<p><b>Тамара:</b> «И телефон не выключай. Я всё равно дозвонюсь».</p>' + stats +
      '<div class="note">Сюжет пройден. Можно остаться в районе: Тамара будет присылать бесконечные заявки, оплата растёт с каждой.</div>' +
      '<div class="btns"><button class="btn c" id="bFree">Остаться на смене</button>' +
      '<button class="btn p" id="bAgain">Новая смена</button><button class="btn" id="bMenu">В меню</button></div>' + DISCLAIMER, 'win');
    wire('bFree', startFreeMode);
  } else {
    showSheet('<h1>Смена сорвана</h1><div class="sub">' + rank + '</div>' +
      '<p>' + (reason || 'Что-то пошло не так, как обычно — просто чуть сильнее.') + '</p>' +
      '<p><b>Тамара:</b> «Олег, отдохни. И завтра без самодеятельности».</p>' + stats +
      '<div class="btns"><button class="btn p" id="bAgain">Попробовать заново</button><button class="btn c" id="bMenu">В меню</button></div>', 'lose');
  }
  wire('bAgain', () => startNewGame(true));
  wire('bMenu', screenMenu);
  if (win) { S.flags.won = true; saveGame(true); } else Save.wipe();
}
export function startFreeMode() {
  S.free = true; S.ended = null;
  closeSheet(); S.screen = 'play'; S.phoneRing = 2.5; saveGame(true);
  Dlg.one('tamara', 'Олег, раз ты не ушёл — работаем дальше. Заявки не кончаются, они просто ждут своей очереди.');
  toast('Свободные заявки: Тамара скоро позвонит', 'good', 3000);
}
