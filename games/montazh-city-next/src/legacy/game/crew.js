/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «Бригада: Ваня объясняет один раз, Костя делает на глаз и уезжает», строки 10266–10723.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { clamp, dist, dist2, pick, rnd } from '../core/util.js';
import { addHeat, addMoney, addRep, bagCapacity, floater, fx3, toast, witnessed } from './effects.js';
import { Input, K } from './input.js';
import { MISSIONS, MOTTO, makeFreeMission } from './missions.js';
import { callPartner, tickGait } from './npcs.js';
import { S, TOOLS, clockStr, setHour } from './state.js';
import { GAITS } from '../render/characters.js';
import { saveGame } from '../save/savegame.js';
import { Dlg } from '../ui/dialog.js';
import { __set_hudToolSig, hudToolSig } from '../ui/hud.js';
import { startCameraGame, startDoorGame } from '../ui/minigame-door.js';
import { endGame } from '../ui/screens.js';
import { POIS, POLES } from '../world/district.js';
/* ------------------------------------------------------------------ */
/* Бригада: Ваня объясняет один раз, Костя делает на глаз и уезжает     */
/* ------------------------------------------------------------------ */
/* Реплики Вани идут перед вводной Тамары — отдельного этапа нет,
   это тот же brief, автомат этапов не меняется. */
export function briefLines(def) { return (def.vanya || []).concat(def.brief); }

/* Финал арки: девиз возвращается, но произносит его уже Олег. */
export function finalWords(kept) {
  return [
    { who: 'vanya', text: kept >= 2
      ? 'Объект принят. Правда, местами ты сделал ровно как Костя — не спорь, я смотрел. Но принят.'
      : 'Объект принят. С третьего раза. Костя, слышишь? С третьего.' },
    { who: 'kostya', text: 'Так а я что. Я же говорю: нам два раза повторять не надо.' },
    { who: 'oleg', text: 'Не надо, Костя. ' + MOTTO + ' Только деньги почему-то платят за третий.' },
    { who: 'vanya', text: 'Всё, бригада. Завтра новая задача. Объясняю один раз.' }
  ];
}

/* Костя уходит первым — он всегда уходит первым */
export function kostyaLeaves(line) {
  const n = S.npcs.find(o => o.kind === 'kostya');
  if (!n) return;
  n.say = 4; n.line = line || pick(['Ну я поехал.', 'Мне ещё на два адреса.', 'Там всё понятно было.']);
  n.leave = 9;
}

/* Костя вспоминает подробности: сужает круг поиска или круг опор */
export function applyKostyaHint() {
  const m = S.mission; if (!m) return;
  const D = m.data, k = m.def.kostya;
  if (!k || !k.hint || D.kostyaHinted) return;
  D.kostyaHinted = true;
  if (k.hint === 'spots' && D.spots) {
    let n = 0;
    for (let i = 0; i < D.spots.length && n < 2; i++)
      if (i !== D.hidden && !D.spots[i].searched) { D.spots[i].searched = true; n++; }
    toast('Костя вспомнил, где точно не был. Минус два места', 'good', 2800);
  }
  if (k.hint === 'poles' && D.poles) {
    for (let i = 0; i < D.poles.length; i++)
      if (i !== D.broken && !D.poles[i].checked) { D.poles[i].checked = true; break; }
    toast('Одну опору можно не обходить. Уже что-то', 'good', 2800);
  }
}

/* Разговор с Костей: подсказка, а не вежливость */
export function askKostya() {
  const m = S.mission; if (!m) return;
  const k = m.def.kostya;
  if (!k || !k.ask || m.data.kostyaTold) return;
  m.data.kostyaTold = true;
  Dlg.seq(k.ask.map(l => ({ who: l.who, text: l.text })), () => {
    applyKostyaHint();
    if (k.invite) { kostyaInvite(); return; }
    kostyaLeaves(); saveGame(true);
  });
}

/* Костя зовёт в разливную. Соблазн честный: цена написана на ценнике */
export function kostyaInvite() {
  Dlg.one('kostya', 'Слушай, а чего вечера ждать. «Три Гвоздя» рядом, я угощаю. Работа не бухта кабеля, её никто не унесёт.', [
    { label: 'Сначала работа', hint: 'репутация +1', fn: () => {
        addRep(1, 'Отказался «посидеть» посреди смены'); kostyaLeaves('Ну как знаешь.');
        Dlg.one('oleg', 'После смены, Костя. У меня во дворе железка и остатки совести.');
      } },
    { label: 'Ладно, загляну', hint: 'хмель: −качество, −оплата, −репутация', fn: () => {
        S.flags.kostyaInvite = true; kostyaLeaves('Занимаю столик!');
        toast('«Три Гвоздя» ждут. Решать всё равно тебе', 'bad', 3000);
      } }
  ]);
}

/* Костин узел на объекте. Это не новый этап, а развилка перед мини-игрой:
   диалог возвращает true, игрок жмёт E ещё раз и уходит в монтаж. */
export function kostyaTrace() {
  const m = S.mission; if (!m) return false;
  const k = m.def.kostya, p = S.player;
  if (!k || !k.trace || m.data.kostyaDone) return false;
  m.data.kostyaDone = true;
  const told = !!m.data.kostyaTold;                       /* поговорил — знает, что искать */
  const cost = Math.round((k.cost || 0) * (told ? 0.5 : 1));
  const fixQ = (k.fixQ || 0) + (told ? 2 : 0), keepQ = k.keepQ || 0;
  const qh = v => (v > 0 ? '+' : '') + v + '% качества';
  Audio2.screwdr();
  Dlg.one('oleg', k.trace, [
    { label: k.fix, disabled: p.drunk > 20,
      hint: p.drunk > 20 ? 'руки не те' : qh(fixQ) + (cost ? ', −' + cost + ' с' : ''),
      fn: () => {
        m.data.kostyaMod = fixQ;
        if (m.def.time && cost) m.timer = Math.max(15, m.timer - cost);
        applyKostyaHint();
        const flag = 'kfix_' + m.def.id;                   /* репутацию дают один раз за заявку */
        if (!S.flags[flag]) { S.flags[flag] = true; addRep(1, 'Переделал за Костей'); }
        toast('Костин узел снят. Дальше — по-человечески', 'good', 2600);
      } },
    { label: k.keep, hint: qh(keepQ), fn: () => {
        m.data.kostyaMod = keepQ; m.data.kostyaKept = keepQ < 0;
        toast(keepQ < 0 ? 'Оставил как есть. «Работает же»' : 'Ладно, разберёмся сами', 'info', 2600);
      } }
  ]);
  return true;
}

export function missingTools(list) { return (list || []).filter(t => S.player.tools.indexOf(t) < 0); }
export function offerMission(idx) {
  if (idx >= MISSIONS.length && !S.free) { endGame(true); return; }
  let def;
  if (idx >= MISSIONS.length) { S.freeCount++; def = makeFreeMission(S.freeCount); }
  else def = MISSIONS[idx];
  S.mission = { def, stage: 'brief', quality: 0, timer: def.time || 0, data: {}, target: null };
  S.phoneRing = 0; Audio2.phone();
  Dlg.seq(briefLines(def).map(b => ({ who: b.who, text: b.text })), () => {
    S.mission.stage = def.tools.length ? 'tools' : 'travel';
    if (def.kind === 'night') { setHour(22); toast('Тамара умеет включать ночь одним звонком', 'info', 2600); }
    spawnMissionActors(); saveGame(true);
  });
}
export function spawnMissionActors() {
  const def = S.mission && S.mission.def; if (!def) return;
  S.npcs = S.npcs.filter(n => n.kind === 'sanya' && !n.brief);
  if (def.client && def.client.who !== 'tamara')
    S.npcs.push({ kind: 'client', who: def.client.who, x: def.client.x, z: def.client.z, vx: 0, vz: 0, phase: 0, yaw: Math.PI, say: 0, line: '', gait: 'client', seed: Math.random() });
  /* Костя ещё на объекте — если не уехал раньше срока, стоит рядом и объясняет, что всё нормально */
  if (def.kostya && def.kostya.x !== undefined)
    S.npcs.push({ kind: 'kostya', who: 'kostya', x: def.kostya.x, z: def.kostya.z, vx: 0, vz: 0,
      phase: 0, yaw: Math.PI * 0.6, say: 6, line: def.kostya.bubble || 'Я тут уже всё посмотрел.', leave: 0 });
  /* бригадир приезжает лично — за смену такое случается один раз */
  if (def.vanyaAt)
    S.npcs.push({ kind: 'vanya', who: 'vanya', x: def.vanyaAt.x, z: def.vanyaAt.z, vx: 0, vz: 0,
      phase: 0, yaw: Math.PI, say: 5, line: 'Один раз объяснил — теперь просто смотрю.' });
  if (def.kind === 'search') {
    const spots = [
      { x: 58.7, z: 60.1, label: 'мусорные баки' },
      { x: 55, z: 50, label: 'песочница' },
      { x: 55.6, z: 62.5, label: 'ряд гаражей' },
      { x: 80.6, z: 63.1, label: 'ржавый каркас' },
      { x: 63.1, z: 47.5, label: 'качели' }
    ];
    spots.forEach(sp => { sp.searched = false; });
    S.mission.data.spots = spots;
    S.mission.data.hidden = Math.floor(Math.random() * spots.length);
    S.mission.data.found = false;
  }
  if (def.kind === 'night') {
    const dark = POLES.filter(p => p.dark);
    S.mission.data.poles = dark.map(p => ({ p, checked: false }));
    S.mission.data.broken = Math.floor(Math.random() * dark.length);
    S.mission.data.found = false;
  }
  if (def.kind === 'final') {
    S.mission.data.step = 0;
    S.mission.data.cams = POLES.filter(p => p.mount && !p.dark).slice(0, 4).map(p => ({ p, done: false, q: 0 }));
    S.mission.data.parts = []; S.mission.data.coils = null;
  }
}
export function taskText() {
  const m = S.mission; if (!m) return { title: 'Смена окончена', step: '—', hint: '' };
  const d = m.def, mt = missingTools(d.tools);
  switch (m.stage) {
    case 'brief': return { title: d.title, step: 'Слушаем Тамару…', hint: '' };
    case 'tools': return { title: d.title, step: 'Забрать комплект на складе «Ящик и Ко»', hint: 'Нужно: ' + d.tools.map(t => TOOLS[t].name).join(', ') };
    case 'travel': return { title: d.title, step: 'Доехать: ' + d.site.label, hint: mt.length ? 'Не хватает: ' + mt.map(t => TOOLS[t].name).join(', ') : 'E у объекта — начать работу' };
    case 'work': return { title: d.title, step: workStepText(), hint: workHintText() };
    case 'verify': return { title: d.title, step: 'Проверить оборудование (E у объекта)', hint: 'Качество: ' + Math.round(m.quality) + '%' };
    case 'report': return { title: d.title, step: 'Сдать работу: ' + (d.client ? d.client.name : 'заказчику'), hint: 'Качество: ' + Math.round(m.quality) + '%' };
    default: return { title: d.title, step: '—', hint: '' };
  }
}
export function workStepText() {
  const m = S.mission, d = m.def;
  if (d.kind === 'search') return m.data.found ? 'Забрать инструмент' : 'Обыскать двор (E у подозрительных мест)';
  if (d.kind === 'night') return m.data.found ? 'Чинить камеру' : 'Найти мёртвую камеру (E у опоры)';
  if (d.kind === 'final') {
    const st = m.data.step;
    if (st === 0) return 'Смонтировать СКУД на входе БЦ';
    if (st >= 1 && st <= 4) return 'Камера ' + st + ' из 4 (опора М' + st + ')';
    if (st === 5) return 'Отбить попытку украсть кабель!';
    return 'Сдать объект заказчику';
  }
  return 'Выполнить монтаж (E у объекта)';
}
export function workHintText() {
  const m = S.mission, d = m.def;
  if (d.kind === 'search') { const left = m.data.spots ? m.data.spots.filter(s => !s.searched).length : 0; return m.data.found ? 'Договорись по-хорошему' : 'Осталось мест: ' + left; }
  if (d.kind === 'night') return 'Фонарик: выбери его и жми F';
  if (d.kind === 'final' && m.data.step === 5) return 'Подъезжай к бухте и жми F — отогнать';
  return 'Качество: ' + Math.round(m.quality) + '%';
}
export function missionTarget() {
  const m = S.mission; if (!m) return null;
  const d = m.def;
  if (m.stage === 'tools') { const p = POIS.find(p => p.id === 'warehouse'); return { x: p.x, z: p.z, label: 'Склад' }; }
  if (m.stage === 'travel') return { x: d.site.x, z: d.site.z, label: 'Объект' };
  if (m.stage === 'work') {
    if (d.kind === 'final') {
      const st = m.data.step;
      if (st === 0) return { x: d.site.x, z: d.site.z, label: 'Вход' };
      if (st >= 1 && st <= 4) { const c = m.data.cams[st - 1]; return { x: c.p.x, z: c.p.z + 2, label: 'Опора М' + st }; }
      if (st === 5 && m.data.coils) { const c = m.data.coils.find(c => !c.saved && !c.lost); if (c) return { x: c.x, z: c.z, label: 'Кабель' }; }
      return { x: d.site.x, z: d.site.z, label: 'Объект' };
    }
    if (d.kind === 'night' && m.data.found) { const pl = m.data.poles[m.data.broken]; return { x: pl.p.x, z: pl.p.z + 2, label: 'Камера' }; }
    return { x: d.site.x, z: d.site.z, label: 'Объект' };
  }
  if (m.stage === 'verify') return { x: d.site.x, z: d.site.z, label: 'Проверка' };
  if (m.stage === 'report') return { x: d.client.x, z: d.client.z, label: 'Сдача' };
  return null;
}
export function updateMission(dt) {
  const m = S.mission; if (!m) return;
  if (m.def.time && (m.stage === 'travel' || m.stage === 'work')) {
    m.timer -= dt;
    if (m.timer <= 0 && !m.data.late) {
      m.data.late = true; Audio2.nope();
      Dlg.one('tamara', 'Олег, приёмка закончилась. Нина Пална сказала слово, которое я не буду повторять в эфир. Доделывай, но премии не будет.');
    }
  }
  m.target = missionTarget();
  if (m.def.kind === 'final' && m.stage === 'work' && m.data.step === 5) updateCableDefense(dt);
}
export function tryStartWork() {
  const m = S.mission; if (!m) return false;
  const d = m.def, p = S.player, mt = missingTools(d.tools);
  if (mt.length) {
    Dlg.one('oleg', 'Не хватает: ' + mt.map(t => TOOLS[t].name).join(', ') + '. Без этого — только вид сделать.', [
      { label: 'Съездить на склад', fn: () => { m.stage = 'tools'; } },
      { label: 'Вызвать Саню (вдруг привезёт)', hint: S.partner.cooldown <= 0 ? 'C' : 'занят', disabled: S.partner.cooldown > 0, fn: () => callPartner() },
      { label: 'Ладно, потом', fn: () => {} }
    ]);
    return true;
  }
  if (p.drunk > 20 && !m.data.drunkWarned) {
    m.data.drunkWarned = true;
    addRep(-3, 'Приехал на объект «после обеда»');
    Dlg.one(d.vanya ? 'vanya' : 'client', d.vanya
      ? pick(['Олег. Я объясняю один раз и спрашиваю один раз: ты в состоянии? По глазам вижу — в состоянии «примерно».',
              'Олег, от тебя пахнет вторым разом. Работай, но я это запомнил.'])
      : pick(['Молодой человек, вы дышите куда-то мимо. Работать-то будете?', 'От вас пахнет не монтажом. Я всё скажу вашему начальству.']));
  }
  /* на финальный объект — только трезвым: Ваня стоит у входа и считает это принципиальным */
  if (d.kind === 'final' && p.drunk > 20) {
    Dlg.one('vanya', 'Стой. На этот объект — трезвым. Вода в «Крепеже», чай в «Термосе». Объект подождёт: он и так третий раз ждёт.');
    return true;
  }
  /* след Кости разбираем до монтажа */
  if (kostyaTrace()) return true;
  if (d.kind === 'door') { startDoorGame(q => finishWork(q)); return true; }
  if (d.kind === 'camera') {
    startCameraGame({ zone: d.zone || 'контрольная зона' }, q => {
      const pole = POLES.filter(pl => pl.mount).sort((a, b) => dist2(a.x, a.z, d.site.x, d.site.z) - dist2(b.x, b.z, d.site.x, d.site.z))[0];
      if (pole) { pole.installed = true; pole.camYaw = rnd(-0.6, 0.6); }
      finishWork(q);
    });
    return true;
  }
  if (d.kind === 'search') { m.stage = 'work'; toast('Обыщи двор: E у подозрительных мест', 'info', 3000); return true; }
  if (d.kind === 'night') { m.stage = 'work'; toast('Ищи мёртвую камеру. Фонарик — F', 'info', 3000); return true; }
  if (d.kind === 'final') { m.stage = 'work'; startFinalStep(); return true; }
  return false;
}
export function finishWork(q) {
  const m = S.mission; if (!m) return;
  m.quality = clamp(q + (m.data.kostyaMod || 0), 0, 100);   /* костин узел добавляет или отнимает */
  S.stats.bestQ = Math.max(S.stats.bestQ, m.quality);
  m.stage = 'verify';
  toast('Монтаж завершён. Качество ' + Math.round(m.quality) + '%. Теперь проверка (E)', 'info', 3200);
  saveGame(true);
}
export function doVerify() {
  const m = S.mission, d = m.def, q = Math.round(m.quality), t = clockStr();
  Audio2.lock();
  if (d.kind === 'door' || d.kind === 'final') {
    Dlg.seq([
      { who: 'oleg', text: 'Проверка. Подношу карту…' },
      { who: 'client', text: q >= 70 ? 'Щёлкнуло! Открылась! Журнал: «' + t + ' — проход зафиксирован, карта №001». Вы гений, молодой человек.'
        : q >= 45 ? 'Открылась. Со второго раза. И скрипит. Журнал пишет, но как-то нехотя.'
        : 'Открывается, если толкнуть плечом и верить. Журнал пишет только хорошие новости.' }
    ], () => { m.stage = 'report'; saveGame(true); });
  } else {
    Dlg.seq([
      { who: 'oleg', text: 'Смотрим картинку…' },
      { who: 'client', text: q >= 70 ? 'Вот это кадр! ' + (d.zone || 'Зона') + ' целиком, ни одного лишнего облака.'
        : q >= 45 ? 'Видно. Частично. Угол я бы поправил, но пусть живёт.'
        : 'Видно небо, кусок трубы и чью-то бельевую верёвку. Зато красиво.' }
    ], () => { m.stage = 'report'; saveGame(true); });
  }
}
export function payoutMission() {
  const m = S.mission, d = m.def, p = S.player, q = m.quality;
  let pay = d.pay * (0.55 + 0.75 * q / 100);
  const lines = [];
  if (m.data.late) { pay *= 0.5; lines.push('Опоздание: −50%'); }
  if (p.drunk > 20) { pay *= 0.7; lines.push('Состояние «после обеда»: −30%'); }
  if (p.drunk <= 0.5) { pay *= 1.12; lines.push('Трезвая смена: +12%'); S.stats.sober++; }
  if (S.heat > 60) { pay *= 0.9; lines.push('Шум во дворе: −10%'); }
  pay = Math.round(pay);
  let rep = q >= 88 ? 6 : q >= 72 ? 4 : q >= 55 ? 2 : q >= 40 ? 0 : -3;
  if (m.data.late) rep -= 2;
  if (p.drunk > 20) rep -= 3;
  addMoney(pay, 'Оплата за «' + d.title + '»');
  addRep(rep, rep >= 0 ? 'Работа принята' : 'Работа принята с оговорками');
  S.missionsDone.push({ id: d.id, q: Math.round(q), pay, late: !!m.data.late, kept: !!m.data.kostyaKept });
  S.stats.fixed++;
  const bonus = q >= 90 && !m.data.late && p.drunk <= 0.5 ? Math.round(d.pay * 0.25) : 0;
  const summary = [
    { who: d.client && d.client.who !== 'tamara' ? d.client.who : 'tamara', text: d.done },
    { who: 'boris', text: (q >= 88 ? 'Смотрел объект. Придраться не к чему, а хочется. Молодец, Олег.'
      : q >= 60 ? 'Нормально. Не блестяще, но работает. Так и запишем: «работает».'
      : 'Олег. Оно работает, но как-то по-олеговски. Переделывать не заставлю, но ты подумай.')
      + (bonus ? ' Держи премию ' + bonus + ' ₽.' : '')
      + (lines.length ? '\n\nПо расчёту: ' + lines.join('; ') + '.' : '') }
  ];
  /* сюжет замыкается: девиз возвращается, но теперь его произносит Олег */
  if (d.id === 'final') finalWords(S.missionsDone.filter(x => x.kept).length).forEach(l => summary.push(l));
  if (bonus) addMoney(bonus, 'Премия от Борисыча');
  m.stage = 'done';
  Dlg.seq(summary, () => {
    S.missionIndex++; S.mission = null; saveGame(true);
    if (S.missionIndex >= MISSIONS.length && !S.free) { endGame(true); return; }
    S.phoneRing = rnd(6, 10);
    toast('Тамара скоро позвонит с новой заявкой (R — журнал)', 'info', 3400);
  });
}
export function searchSpot(spot) {
  const m = S.mission;
  spot.searched = true; Audio2.screwdr(); fx3(spot.x, 0.4, spot.z, 'dust', 8);
  const idx = m.data.spots.indexOf(spot);
  if (idx === m.data.hidden) {
    m.data.found = true;
    const thief = S.hools.find(h => h.type === 'thief') || S.hools[0];
    thief.x = spot.x + 2; thief.z = spot.z - 1.5; thief.gone = false; thief.flee = 0; thief.cool = 0; thief.holds = 'screw';
    Audio2.ok();
    const charm = Math.round(clamp(35 + S.player.rep * 1.6, 10, 92));
    Dlg.one('hool', 'О! А я как раз собирался вернуть. Честно. Через недельку.', [
      { label: 'Поговорить спокойно', hint: 'шанс ' + charm + '%', fn: () => {
          if (Math.random() * 100 < charm) recoverTool(thief, 2, 'Договорились словами');
          else Dlg.one('hool', 'Не-а. Он ко мне привязался.', [
            { label: 'Выкупить за 150 ₽', hint: S.player.money >= 150 ? '' : 'мало денег', disabled: S.player.money < 150, fn: () => { addMoney(-150); recoverTool(thief, 0, 'Выкупил'); } },
            { label: 'Вызвать Саню', disabled: S.partner.cooldown > 0, fn: () => { callPartner(); recoverTool(thief, 1, 'Саня подошёл — вопрос решился'); } },
            { label: 'Забрать сумкой', fn: () => { addHeat(18, 'Шум во дворе'); witnessed(S.player.x, S.player.z); recoverTool(thief, -2, 'Забрал силой'); } }
          ]);
        } },
      { label: 'Выкупить за 150 ₽', hint: S.player.money >= 150 ? '−150 ₽' : 'мало денег', disabled: S.player.money < 150, fn: () => { addMoney(-150); recoverTool(thief, 0, 'Выкупил'); } },
      { label: 'Вызвать напарника', hint: S.partner.cooldown <= 0 ? 'приедет' : 'занят', disabled: S.partner.cooldown > 0, fn: () => { callPartner(); recoverTool(thief, 1, 'Саня подошёл — вопрос решился'); } },
      { label: 'Забрать сумкой', hint: 'внимание +, репутация −', fn: () => { addHeat(18, 'Шум во дворе'); witnessed(S.player.x, S.player.z); recoverTool(thief, -2, 'Забрал силой'); } }
    ]);
  } else {
    const left = m.data.spots.filter(s => !s.searched).length;
    floater(spot.x, 1.2, spot.z, pick(['Пусто', 'Не тут', 'Только фантики', 'Чей-то носок']), '#b9a6d6');
    if (left === 0) { m.data.spots.forEach(s => { s.searched = false; }); toast('Круг замкнулся. Ищем заново', 'bad', 2400); }
  }
}
export function recoverTool(thief, rep, why) {
  const m = S.mission;
  thief.holds = null; thief.flee = 8; thief.cool = 60;
  if (S.player.tools.indexOf('screw') < 0 && S.player.tools.length < bagCapacity()) { S.player.tools.push('screw'); __set_hudToolSig(''); }
  m.quality = clamp(72 + rep * 9, 30, 100);
  if (rep) addRep(rep, why); else toast(why, 'info');
  Audio2.ok(); m.stage = 'report';
  toast('Шуруповёрт снова твой. Отчитайся в конторе', 'good', 3200);
  saveGame(true);
}
export function inspectPole(entry) {
  const m = S.mission;
  if (entry.checked) { floater(entry.p.x, 2.4, entry.p.z, 'Уже смотрел', '#b9a6d6'); return; }
  if (!S.player.lampOn) { toast('Тут темно. Возьми фонарик (выбери и жми F)', 'bad', 2600); return; }
  entry.checked = true; Audio2.screwdr();
  const idx = m.data.poles.indexOf(entry);
  if (idx === m.data.broken) {
    m.data.found = true; Audio2.ok();
    Dlg.one('oleg', 'Вот она. Объектив в паутине, кабель перекушен, а рядом — след от чьей-то заботы. Чиним.');
    toast('Нашёл! E у опоры — чинить', 'good', 3000);
  } else {
    floater(entry.p.x, 2.4, entry.p.z, 'Эта живая', '#4be36b');
    const left = m.data.poles.filter(e => !e.checked).length;
    if (left === 0) { m.data.poles.forEach(e => { e.checked = false; }); toast('Обошёл круг. Значит, ещё раз', 'bad', 2400); }
  }
}
export function startFinalStep() {
  const m = S.mission, st = m.data.step;
  if (st === 0) { startDoorGame(q => { m.data.parts.push(q); m.data.step = 1; toast('СКУД готов. Дальше — четыре камеры', 'good', 3000); saveGame(true); }); return; }
  if (st >= 1 && st <= 4) {
    startCameraGame({ zone: ['въезд', 'вход', 'парковка', 'чёрный ход'][st - 1], quick: st > 2 }, q => {
      const c = m.data.cams[st - 1];
      c.done = true; c.q = q; c.p.installed = true; c.p.camYaw = rnd(-0.6, 0.6);
      m.data.parts.push(q); m.data.step = st + 1;
      if (m.data.step === 5) startCableDefense();
      else toast('Камера ' + st + ' готова. Следующая опора', 'good', 2600);
      saveGame(true);
    });
  }
}
export function startCableDefense() {
  const m = S.mission;
  m.data.timer = 62;
  m.data.coils = [
    { x: 131.2, z: 118.7, saved: false, lost: false, prog: 0 },
    { x: 123.7, z: 101.2, saved: false, lost: false, prog: 0 },
    { x: 151.2, z: 120.6, saved: false, lost: false, prog: 0 }
  ];
  m.data.raiders = m.data.coils.map((c, i) => ({ gait: 'hool', seed: Math.random(), vx: 0, vz: 0,
    x: c.x + rnd(-26, 26), z: c.z + rnd(19, 29), target: i, speed: 2.7 + i * 0.45, phase: 0, yaw: 0, done: false, scared: 0,
    mesh: i % 3
  }));
  Audio2.siren();
  Dlg.one('sanya', 'Олег! К бухтам идут «оценщики»! Их трое, ты один, но у тебя велосипед!');
  toast('Отгони расхитителей: подъедь и жми F', 'bad', 3600);
}
export function updateCableDefense(dt) {
  const m = S.mission, p = S.player, D = m.data;
  if (!D.coils) return;
  D.timer -= dt;
  for (const r of D.raiders) {
    const c = D.coils[r.target];
    if (r.done || c.lost || c.saved) continue;
    if (r.scared > 0) {
      r.scared -= dt;
      const a = Math.atan2(r.x - p.x, r.z - p.z);
      r.x += Math.sin(a) * 5 * dt; r.z += Math.cos(a) * 5 * dt;
      r.yaw = a; r.vx = Math.sin(a) * 2.4; r.vz = Math.cos(a) * 2.4; tickGait(r, dt, GAITS.hool, true);
      if (r.scared <= 0) { r.done = true; c.saved = true; }
      continue;
    }
    const a = Math.atan2(c.x - r.x, c.z - r.z);
    const d = dist(r.x, r.z, c.x, c.z);
    if (d > 1) { r.x += Math.sin(a) * r.speed * dt; r.z += Math.cos(a) * r.speed * dt; r.yaw = a;
      r.vx = Math.sin(a) * r.speed; r.vz = Math.cos(a) * r.speed; }
    else {
      r.vx = 0; r.vz = 0;
      c.prog += dt * 0.2;
      if (c.prog >= 1) { c.lost = true; r.done = true; toast('Бухту унесли! «Это был не кабель, это была надежда»', 'bad', 3000); Audio2.nope(); }
    }
    tickGait(r, dt, GAITS.hool, true);
    if (dist(r.x, r.z, p.x, p.z) < 4.4 && (Input.anyHit(K.tool) || Input.anyHit(K.act))) {
      r.scared = 1.4; c.saved = true;
      delete Input.hit['KeyF']; delete Input.hit['KeyE'];
      Audio2.thud(); fx3(r.x, 0.8, r.z, 'dust', 8);
      floater(r.x, 2, r.z, pick(['Всё-всё!', 'Мы мимо шли', 'Тут не наше']), '#ffd23f');
      toast('Бухта спасена', 'good', 1800);
    }
  }
  const open = D.coils.filter(c => !c.saved && !c.lost).length;
  if (open === 0 || D.timer <= 0) {
    D.coils.forEach(c => { if (!c.saved && !c.lost) c.lost = true; });
    const saved = D.coils.filter(c => c.saved).length;
    D.step = 6;
    const base = D.parts.reduce((a, b) => a + b, 0) / Math.max(1, D.parts.length);
    m.quality = clamp(base * 0.8 + saved / D.coils.length * 20 + (D.kostyaMod || 0), 0, 100);
    S.stats.bestQ = Math.max(S.stats.bestQ, m.quality);
    m.stage = 'verify';
    Dlg.one('oleg', saved === 3 ? 'Кабель на месте. Все три бухты. Борисыч даже не поверит.'
      : saved > 0 ? 'Часть кабеля спасли. Часть ушла в народное хозяйство.'
      : 'Кабель ушёл. Скажу, что это был провод с неопределённым будущим.');
    saveGame(true);
  }
}
