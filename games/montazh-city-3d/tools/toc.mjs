#!/usr/bin/env node
/* =====================================================================
   toc.mjs — пересобирает оглавление в начале index.html.

   Границы разделов берутся из самого файла (рамки вида «/* ---- */ /* N. …»),
   подразделы — по именам функций-якорей. Поэтому после любой правки достаточно
   выполнить `node tools/toc.mjs`, и номера строк снова сойдутся.

   Проверить, не устарело ли оглавление, ничего не переписывая:
     node tools/toc.mjs --check     (код возврата 1, если разошлось)
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', 'index.html');
const CHECK = process.argv.includes('--check');

const BEGIN = '<!-- ОГЛАВЛЕНИЕ:НАЧАЛО (пересобирается: node tools/toc.mjs) -->';
const END = '<!-- ОГЛАВЛЕНИЕ:КОНЕЦ -->';

/* Роль раздела. Ключ — начало заголовка раздела в файле. */
const ROLE = {
  '0.': 'основа', '1.': 'рендер', '2.': 'геометрия', '3.': 'текстуры',
  '4.': 'данные мира', '5.': 'физика', '6.': 'геометрия', 'Дорога': 'геометрия',
  'Растительность': 'геометрия', '7.': 'рендер', '8.': 'геометрия+анимация',
  '9.': 'геометрия', '10.': 'звук', '11.': 'сохранение', '12.': 'интерфейс',
  '13.': 'интерфейс', '14.': 'интерфейс', '15.': 'ввод', '16.': 'состояние',
  '17.': 'состояние', '18.': 'физика', '19.': 'камера', '20.': 'интерфейс',
  '21.': 'жители+анимация', '22.': 'игровая логика', 'Бригада': 'игровая логика',
  '23.': 'интерфейс', '24.': 'рендер', '25.': 'интерфейс', '26.': 'интерфейс',
  '27.': 'сохранение', '28.': 'цикл'
};

/* Короткое пояснение к разделу — то, чего нет в его собственном заголовке. */
const NOTE = {
  '0.': 'мелочи и матрицы 4×4 в column-major, как их ждёт GL',
  '1.': 'GLSL целиком: VS/FS_MAIN, VS/FS_SKY, VS/FS_GLOW, компиляция и разбор юниформ',
  '2.': 'класс Mesh: box, bevelBox, cyl, ellipsoid, extrudeZ, tube, wheel, сглаживание нормалей, upload в VAO',
  '3.': 'весь canvas 2D: асфальт, панели, кирпич, профлист, витрины, атлас зелени, вывески',
  '4.': 'дома, киоски, опоры, точки интереса, реквизит, ямы; surfY и isRoad',
  '5.': 'равномерная сетка 8 м поверх списка AABB',
  '6.': 'Static.batches, Static.signs, Static.lamps — то, что рисуется каждый кадр',
  'Дорога': 'бордюр, люки, лужи, разметка, фасадный рельеф, кондиционеры, вывески',
  'Растительность': 'атлас листвы с альфа-тестом, кроны, ветер через атрибут aPart; в конце buildWorld собирает все батчи',
  '7.': 'R3, Env (солнце и время суток), initRenderer, setCamera, drawSky, beginMain, drawMesh, drawGlow, drawStatic',
  '8.': 'скелет на 20 костях, походки и позы; makeCharMesh строит, poseCharacter анимирует',
  '9.': 'кузова машин, велосипед, собака — те же кости, только меньше',
  '10.': 'осцилляторы, шумы и три радиостанции; ни одного загруженного файла',
  '11.': 'формат сохранения в localStorage; настройки лежат отдельным ключом',
  '12.': 'очередь реплик, портреты рисуются на canvas',
  '13.': 'общий каркас мини-игр поверх сцены',
  '14.': 'станции, диджей, объявления и бегущая строка',
  '15.': 'клавиатура, мышь, захват курсора; Input.hit — нажатия за кадр',
  '16.': 'S — всё изменяемое состояние смены; BAL — баланс; TOOLS — инструменты',
  '17.': 'искры, всплывающий текст, тосты, деньги, репутация, розыск',
  '18.': 'скольжение по AABB, велосипед с креном и заносом',
  '19.': 'камера за спиной с ручным осмотром и возвратом',
  '20.': 'реплики, метки и стрелка к цели рисуются на canvas 2D поверх WebGL',
  '21.': 'машины, собаки, хулиганы, бабушки, прохожие; charPose — общий сборщик позы',
  '22.': 'сценарные заявки и генератор свободных',
  'Бригада': 'ход заявки от брифинга до сдачи, мини-игры монтажа, финальная оборона кабеля',
  '23.': 'что происходит по E и по F рядом с объектом',
  '24.': 'drawDynamic, drawGlows, drawOverlay2D и renderFrame — порядок проходов кадра',
  '25.': 'HUD, миникарта',
  '26.': 'меню, пауза, карта, журнал, магазин, финал',
  '27.': 'saveGame/loadGame и обучение',
  '28.': 'resetWorld, updateWorld, step, frame, boot — точка входа внизу файла'
};

/* Подразделы: [заголовок раздела, якорь-функция, подпись]. */
const SUB = [
  ['Растительность', 'function buildWorld', 'сборка батчей района в Static.batches'],
  ['8.', 'function poseCharacter', 'позы и анимация скелета'],
  ['21.', 'function charPose', 'сборка позы жителя для рендера'],
  ['24.', 'function renderFrame', 'порядок проходов кадра']
];

/* Вставка оглавления сдвигает все строки ниже, поэтому одного прохода мало:
   гоняем сборку до неподвижной точки. Блок фиксированной высоты, так что
   сходится за два прохода. */
function build(src) {
const L = src.split('\n');

/* --- структурные вехи --- */
const findLine = re => { for (let i = 0; i < L.length; i++) if (re.test(L[i])) return i + 1; return 0; };
const milestones = [
  [findLine(/^<style>/), findLine(/^<\/style>/), 'CSS: HUD, диалоги, экраны, мини-игры'],
  [findLine(/^<body>/), findLine(/^<script>/) - 1, 'разметка: canvas #gl, слой HUD, диалог, экраны, загрузка'],
];

/* --- разделы --- */
const marks = [];
for (let i = 0; i < L.length; i++) if (/^\/\* -{10,}/.test(L[i])) marks.push(i + 1);
const secs = [];
for (let i = 0; i < marks.length - 1;) {
  if (marks[i + 1] === marks[i] + 2) {
    secs.push({ line: marks[i], title: L[marks[i]].replace(/^\/\*\s*/, '').replace(/\s*\*\/\s*$/, '').trim() });
    i += 2;
  } else i++;
}
const scriptEnd = findLine(/^<\/script>/);
secs.forEach((s, k) => { s.end = (k + 1 < secs.length ? secs[k + 1].line : scriptEnd) - 1; });

const roleOf = t => { for (const k in ROLE) if (t.startsWith(k)) return ROLE[k]; return '—'; };
const noteOf = t => { for (const k in NOTE) if (t.startsWith(k)) return NOTE[k]; return ''; };

/* --- сборка текста --- */
const pad = (s, n) => String(s).padStart(n);
const out = [];
out.push(BEGIN);
out.push('<!--');
out.push('  МОНТАЖ-СИТИ 3D — карта файла. Один файл, ' + L.length + ' строк, без сборки и без');
out.push('  зависимостей. Целиком его читать не надо: ниже строки, по которым видно,');
out.push('  где что лежит. Диапазоны пересобираются командой `node tools/toc.mjs`,');
out.push('  проверить актуальность — `node tools/toc.mjs --check`.');
out.push('');
out.push('  Крупно:');
for (const [a, b, what] of milestones)
  out.push('    ' + pad(a, 5) + '-' + pad(b, 5) + '  ' + what);
out.push('    ' + pad(findLine(/^<script>/), 5) + '-' + pad(scriptEnd, 5) + '  вся игра: один IIFE, ничего не торчит в window');
out.push('');
out.push('  По ролям:');
const byRole = {};
for (const s of secs) (byRole[roleOf(s.title)] ||= []).push(s);
const ORDER = ['рендер', 'текстуры', 'геометрия', 'геометрия+анимация', 'жители+анимация',
               'физика', 'камера', 'данные мира', 'состояние', 'игровая логика',
               'интерфейс', 'ввод', 'звук', 'сохранение', 'основа', 'цикл'];
for (const role of ORDER) {
  const g = byRole[role]; if (!g) continue;
  out.push('    ' + (role + ' ').padEnd(21, '·') + ' ' + g.map(s => s.line + '-' + s.end).join(', '));
}
out.push('');
out.push('  Разделы подряд:');
for (const s of secs) {
  out.push('    ' + pad(s.line, 5) + '-' + pad(s.end, 5) + '  ' + s.title);
  const note = noteOf(s.title);
  if (note) out.push('                   ' + note);
  for (const [tit, anchor, label] of SUB) {
    if (!s.title.startsWith(tit)) continue;
    let ln = 0;
    for (let i = s.line; i <= s.end; i++) if (L[i - 1].startsWith(anchor)) { ln = i; break; }
    if (ln) out.push('                   └ ' + ln + '-' + s.end + '  ' + label);
  }
}
out.push('');
out.push('  Нумерация разделов в файле историческая и местами сбита (номер 23 занят');
out.push('  дважды, часть разделов без номера) — ориентируйся на строки, не на номер.');
out.push('');
out.push('  Замер производительности и контрольные сцены: docs/RENDER-STATE.md,');
out.push('  оснастка — games/montazh-city-3d/tools/perf-probe.mjs.');
out.push('-->');
out.push(END);
const block = out.join('\n');

/* --- вставка --- */
const i0 = src.indexOf(BEGIN), i1 = src.indexOf(END);
let next;
if (i0 >= 0 && i1 > i0) next = src.slice(0, i0) + block + src.slice(i1 + END.length);
else {
  const anchor = '<!DOCTYPE html>\n';
  if (!src.startsWith(anchor)) { console.error('Не нашёл <!DOCTYPE html> в начале файла.'); process.exit(2); }
  next = anchor + block + '\n' + src.slice(anchor.length);
}

return { text: next, secs: secs.length, lines: L.length };
}

const original = fs.readFileSync(FILE, 'utf8');
let cur = original, res = null;
for (let pass = 0; pass < 8; pass++) {
  res = build(cur);
  if (res.text === cur) break;
  cur = res.text;
}
if (build(cur).text !== cur) { console.error('Оглавление не сошлось за 8 проходов.'); process.exit(2); }

if (CHECK) {
  if (cur === original) { console.log('Оглавление актуально.'); process.exit(0); }
  console.error('Оглавление устарело — выполни: node tools/toc.mjs');
  process.exit(1);
}
if (cur === original) { console.log('Оглавление уже актуально, файл не тронут.'); process.exit(0); }
fs.writeFileSync(FILE, cur);
console.log('Оглавление обновлено: ' + res.secs + ' разделов, ' + res.lines + ' строк.');
