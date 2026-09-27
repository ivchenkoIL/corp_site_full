#!/usr/bin/env node
/* =====================================================================
   split-legacy.mjs — режет монолит games/montazh-city-3d/index.html на
   ES-модули в src/legacy/ и собирает для них HTML-оболочку legacy.html.

   Зачем. Пока монолит остаётся источником правды (его правят другие
   сессии), модули не пишутся руками, а нарезаются из него заново одной
   командой: `npm run split`. Семантика сохраняется точно, поэтому собранная
   из модулей игра ведёт себя так же, как исходный файл, — это проверяет
   tools/legacy-parity.mjs.

   Как устроена нарезка.
   1. Разделы берутся из рамок в самом файле (те же, что у tools/toc.mjs),
      каждый раздел — отдельный модуль; куда какой кладётся — таблица MODULES.
   2. Верхний уровень IIFE разбирается Babel'ем, для каждого имени верхнего
      уровня известны все чтения и записи.
   3. Порядок исполнения. В монолите верхний уровень выполнялся строго сверху
      вниз, а у модулей порядок задаёт граф импортов, и в циклах он другой.
      Поэтому на верхнем уровне модуля остаются только объявления функций и
      «чистые» данные (литералы, которые ничего не вызывают и не читают чужих
      констант). Всё остальное — вызовы, циклы, присваивания — переносится в
      __init() модуля, а main.js зовёт все __init в исходном порядке разделов.
      Функции поднимаются (hoisting) и между модулями, поэтому вызывать их
      можно откуда угодно, как и раньше.
   4. Запись в чужую переменную (x = … из другого модуля) в ES-модулях
      запрещена, поэтому такие места переписываются на __set_x(…), а сеттер
      экспортирует модуль-владелец.

   Запуск:  node tools/split-legacy.mjs [--check]
            --check — ничего не пишет, код возврата 1, если модули устарели.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import MagicString from 'magic-string';

const traverse = _traverse.default || _traverse;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC_HTML = path.resolve(ROOT, '..', 'montazh-city-3d', 'index.html');
const OUT_DIR = path.join(ROOT, 'src', 'legacy');
const OUT_HTML = path.join(ROOT, 'legacy.html');
const OUT_REPORT = path.join(ROOT, 'docs', 'LEGACY-MODULES.md');
const CHECK = process.argv.includes('--check');

/* Раздел монолита → модуль. Ключ — начало заголовка раздела; сравниваются
   от длинного к короткому, чтобы «23. Мини-игра» не попала в «23.». Роль —
   для отчёта о связях: логика не должна знать о графике. */
const MODULES = [
  ['Конфигурация',        'core/quality.js',      'основа'],
  ['0.',                  'core/util.js',         'основа'],
  ['1.',                  'render/gl.js',         'рендер'],
  ['2.',                  'render/mesh.js',       'рендер'],
  ['3.',                  'render/textures.js',   'рендер'],
  ['4.',                  'world/district.js',    'данные'],
  ['5.',                  'game/collision.js',    'логика'],
  ['6.',                  'render/static.js',     'рендер'],
  ['Дорога',              'render/street.js',     'рендер'],
  ['Растительность',      'render/vegetation.js', 'рендер'],
  ['7.',                  'render/renderer.js',   'рендер'],
  ['8.',                  'render/characters.js', 'рендер'],
  ['9.',                  'render/vehicles.js',   'рендер'],
  ['10.',                 'audio/audio.js',       'звук'],
  ['11.',                 'save/storage.js',      'сохранение'],
  ['12а.',                'game/phone.js',        'логика'],
  ['12.',                 'ui/dialog.js',         'интерфейс'],
  ['13.',                 'ui/minigames.js',      'интерфейс'],
  ['23. Мини-игра',       'ui/minigame-door.js',  'интерфейс'],
  ['14.',                 'ui/radio.js',          'интерфейс'],
  ['15.',                 'game/input.js',        'логика'],
  ['16.',                 'game/state.js',        'логика'],
  ['17.',                 'game/effects.js',      'логика'],
  ['18.',                 'game/movement.js',     'логика'],
  ['19.',                 'game/camera.js',       'логика'],
  ['20.',                 'ui/overlay2d.js',      'интерфейс'],
  ['21.',                 'game/npcs.js',         'логика'],
  ['22.',                 'game/missions.js',     'логика'],
  ['Бригада',             'game/crew.js',         'логика'],
  ['23. Взаимодействие',  'game/interaction.js',  'логика'],
  ['24.',                 'render/frame.js',      'рендер'],
  ['25.',                 'ui/hud.js',            'интерфейс'],
  ['26.',                 'ui/screens.js',        'интерфейс'],
  ['27.',                 'save/savegame.js',     'сохранение'],
  ['28.',                 'game/loop.js',         'цикл']
].sort((a, b) => b[0].length - a[0].length);

/* Встроенные функции, вызов которых ничего не меняет и не зависит от порядка
   исполнения. Math.random сюда нарочно не входит: перестановка его вызовов
   поменяла бы случайную последовательность. */
const PURE_CALLS = new Set([
  'Math.abs', 'Math.acos', 'Math.asin', 'Math.atan', 'Math.atan2', 'Math.ceil', 'Math.cos',
  'Math.exp', 'Math.floor', 'Math.hypot', 'Math.log', 'Math.log2', 'Math.max', 'Math.min',
  'Math.pow', 'Math.round', 'Math.sign', 'Math.sin', 'Math.sqrt', 'Math.tan', 'Math.trunc',
  'Math.fround', 'Object.freeze', 'String.fromCharCode', 'Number.isFinite', 'Array.isArray'
]);
const PURE_NEW = new Set(['Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray', 'Map', 'Set', 'WeakMap', 'Array']);
const PURE_GLOBALS = new Set(['undefined', 'NaN', 'Infinity', 'Math', 'Object', 'Number', 'String',
  'Array', 'JSON', 'Symbol']);

/* ------------------------------------------------------------------ */
function sections(lines) {
  const marks = [];
  for (let i = 0; i < lines.length; i++) if (/^\/\* -{10,}/.test(lines[i])) marks.push(i + 1);
  const secs = [];
  for (let i = 0; i < marks.length - 1;) {
    if (marks[i + 1] === marks[i] + 2) {
      secs.push({ line: marks[i], title: lines[marks[i]].replace(/^\/\*\s*/, '').replace(/\s*\*\/\s*$/, '').trim() });
      i += 2;
    } else i++;
  }
  return secs;
}

function moduleFor(title) {
  for (const [prefix, file, role] of MODULES) if (title.startsWith(prefix)) return { file, role };
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  console.warn('! раздел без места в таблице MODULES: «' + title + '» → misc/' + slug + '.js');
  return { file: 'misc/' + slug + '.js', role: '—' };
}

const isFnNode = n => n && /^(FunctionExpression|ArrowFunctionExpression|FunctionDeclaration|ObjectMethod|ClassMethod|ClassPrivateMethod)$/.test(n.type);

function memberName(n) {
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') {
    const o = memberName(n.object);
    return o ? o + '.' + n.property.name : null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
function split() {
  const html = fs.readFileSync(SRC_HTML, 'utf8');
  const lines = html.split('\n');
  const sTag = html.indexOf('<script>'), eTag = html.lastIndexOf('</script>');
  if (sTag < 0 || eTag < 0) throw new Error('Не нашёл <script> в монолите');
  const codeStart = sTag + '<script>'.length;
  const code = html.slice(codeStart, eTag);
  const lineBase = html.slice(0, codeStart).split('\n').length - 1; /* строка кода 1 = строка файла lineBase+1 */

  const secs = sections(lines);
  secs.forEach(s => Object.assign(s, moduleFor(s.title)));
  const secOfLine = ln => { let k = -1; for (let i = 0; i < secs.length; i++) if (secs[i].line <= ln) k = i; return k; };

  const ast = parse(code, { sourceType: 'script', ranges: true, errorRecovery: false });
  const iifeStmt = ast.program.body.find(n => n.type === 'ExpressionStatement' && n.expression.type === 'CallExpression');
  const fnNode = iifeStmt.expression.callee;
  const body = fnNode.body.body;
  const dirs = fnNode.body.directives;
  const bodyStart = dirs.length ? dirs[dirs.length - 1].end : fnNode.body.start + 1, bodyEnd = fnNode.body.end - 1;

  /* --- области видимости --- */
  let fnScope = null;
  traverse(ast, {
    FunctionExpression(p) { if (p.node === fnNode) { fnScope = p.scope; p.stop(); } }
  });
  if (!fnScope) throw new Error('Не нашёл IIFE');

  /* индекс верхнеуровневого оператора для узла */
  const stmtIndex = new Map(body.map((st, i) => [st, i]));
  function topOf(p) {
    let eager = true, cur = p;
    while (cur && !stmtIndex.has(cur.node)) {
      if (isFnNode(cur.node)) eager = false;
      const par = cur.parentPath;
      /* поля класса без static вычисляются при создании экземпляра */
      if (par && par.node.type === 'ClassProperty' && !par.node.static && cur.key === 'value') eager = false;
      cur = par;
    }
    return cur ? { idx: stmtIndex.get(cur.node), eager } : null;
  }

  /* --- операторы, их разделы и объявленные имена --- */
  const stmts = body.map((st, i) => {
    const line = lineBase + code.slice(0, st.start).split('\n').length;
    const sec = secOfLine(line);
    if (sec < 0) throw new Error('Оператор на строке ' + line + ' раньше первого раздела');
    const names = [];
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') names.push(st.id.name);
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) collectPatternNames(d.id, names);
    return { i, node: st, line, sec, names, kind: st.type === 'FunctionDeclaration' ? 'fn' : null };
  });

  const bind = new Map();   /* имя → { stmt, sec, kind, reads:[{idx,eager,path}], writes:[path] } */
  for (const [name, b] of Object.entries(fnScope.bindings)) {
    const top = topOf(b.path);
    if (!top) continue;
    const st = stmts[top.idx];
    const rec = { name, stmt: top.idx, sec: st.sec, kind: b.kind, fn: st.node.type === 'FunctionDeclaration', reads: [], writes: [] };
    for (const r of b.referencePaths) { const t = topOf(r); if (t) rec.reads.push({ ...t, path: r }); }
    for (const w of b.constantViolations) { const t = topOf(w); if (t) rec.writes.push({ ...t, path: w }); }
    bind.set(name, rec);
  }

  /* --- что может остаться на верхнем уровне модуля --- */
  const isStatic = new Array(body.length).fill(false);
  function pure(n, st) {
    if (!n) return true;
    switch (n.type) {
      case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NullLiteral':
      case 'RegExpLiteral': case 'BigIntLiteral':
        return true;
      case 'TemplateLiteral': return n.expressions.every(e => pure(e, st));
      case 'Identifier': {
        const b = bind.get(n.name);
        if (!b) return PURE_GLOBALS.has(n.name);
        if (b.fn) return true;                             /* функции поднимаются и через модули */
        return b.sec === st.sec && b.stmt < st.i && isStatic[b.stmt];
      }
      case 'ArrayExpression': return n.elements.every(e => !e || pure(e, st));
      case 'ObjectExpression': return n.properties.every(pr =>
        pr.type === 'SpreadElement' ? pure(pr.argument, st)
        : pr.type === 'ObjectMethod' ? (!pr.computed || pure(pr.key, st))
        : (!pr.computed || pure(pr.key, st)) && pure(pr.value, st));
      case 'SpreadElement': return pure(n.argument, st);
      case 'UnaryExpression': return n.operator !== 'delete' && pure(n.argument, st);
      case 'BinaryExpression': case 'LogicalExpression': return pure(n.left, st) && pure(n.right, st);
      case 'ConditionalExpression': return pure(n.test, st) && pure(n.consequent, st) && pure(n.alternate, st);
      case 'SequenceExpression': return n.expressions.every(e => pure(e, st));
      case 'MemberExpression': return pure(n.object, st) && (!n.computed || pure(n.property, st));
      case 'FunctionExpression': case 'ArrowFunctionExpression': return true;
      case 'CallExpression': {
        const nm = memberName(n.callee);
        return !!nm && PURE_CALLS.has(nm) && n.arguments.every(a => pure(a, st));
      }
      case 'NewExpression': {
        const nm = memberName(n.callee);
        return !!nm && PURE_NEW.has(nm) && !fnScope.hasOwnBinding(nm) && n.arguments.every(a => pure(a, st));
      }
      default: return false;
    }
  }
  for (const st of stmts) {
    const n = st.node;
    if (n.type === 'FunctionDeclaration') { isStatic[st.i] = true; continue; }
    if (n.type === 'VariableDeclaration') { isStatic[st.i] = n.declarations.every(d => pure(d.init, st)); continue; }
    if (n.type === 'ClassDeclaration') {
      isStatic[st.i] = (!n.superClass || pure(n.superClass, st)) &&
        n.body.body.every(m => m.type !== 'StaticBlock' && (!m.computed || pure(m.key, st)) &&
          (!(m.type === 'ClassProperty' && m.static) || pure(m.value, st)));
      continue;
    }
    isStatic[st.i] = false;
  }

  /* --- кто кого читает и пишет --- */
  const modOf = sec => secs[sec].file;
  /* Экспортируется всё верхнего уровня: новый движок берёт из старых модулей
     и то, что внутри монолита было нужно только соседям по файлу (шаг кадра,
     обновление мира, отрисовку двумерного слоя). */
  const needExport = new Set(bind.keys());
  const imports = new Map();                    /* файл → Map(файл-источник → Set(имён)) */
  const setters = new Map();                    /* имя → true, если его пишут извне */
  const coupling = [];                          /* логика/интерфейс → рендер */
  const addImport = (file, from, name) => {
    if (!imports.has(file)) imports.set(file, new Map());
    const m = imports.get(file);
    if (!m.has(from)) m.set(from, new Set());
    m.get(from).add(name);
  };
  for (const b of bind.values()) {
    const home = modOf(b.sec);
    for (const r of b.reads) {
      const f = modOf(stmts[r.idx].sec);
      if (f === home) continue;
      needExport.add(b.name); addImport(f, home, b.name);
      const rr = secs[stmts[r.idx].sec].role, hr = secs[b.sec].role;
      if ((rr === 'логика' || rr === 'интерфейс' || rr === 'данные') && hr === 'рендер')
        coupling.push({ from: f, to: home, name: b.name });
    }
    for (const w of b.writes) {
      const f = modOf(stmts[w.idx].sec);
      if (f === home) continue;
      if (b.kind === 'const' && isStatic[b.stmt]) throw new Error('Запись в константу ' + b.name + ' из ' + f);
      setters.set(b.name, true);
      needExport.add('__set_' + b.name); addImport(f, home, '__set_' + b.name);
      needExport.add(b.name); addImport(f, home, b.name);
    }
  }

  /* --- переписываем запись в чужие переменные --- */
  const ms = new MagicString(code);
  for (const b of bind.values()) {
    if (!setters.has(b.name)) continue;
    const home = modOf(b.sec);
    for (const w of b.writes) {
      if (modOf(stmts[w.idx].sec) === home) continue;
      const n = w.path.node, set = '__set_' + b.name;
      if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
        const rhs = code.slice(n.right.start, n.right.end);
        let repl;
        if (n.operator === '=') repl = set + '(' + rhs + ')';
        else if (n.operator === '||=' || n.operator === '&&=' || n.operator === '??=')
          repl = '(' + b.name + ' ' + n.operator.slice(0, -1) + ' ' + set + '(' + rhs + '))';
        else repl = set + '(' + b.name + ' ' + n.operator.slice(0, -1) + ' (' + rhs + '))';
        ms.overwrite(n.start, n.end, repl);
      } else if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') {
        const op = n.operator === '++' ? '+' : '-';
        const used = w.path.parentPath.node.type !== 'ExpressionStatement';
        const repl = n.prefix || !used ? set + '(' + b.name + ' ' + op + ' 1)'
          : '(' + set + '(' + b.name + ' ' + op + ' 1) ' + (op === '+' ? '-' : '+') + ' 1)';
        ms.overwrite(n.start, n.end, repl);
      } else {
        throw new Error('Не умею переписать запись в ' + b.name + ': ' + n.type + ' на строке ' +
          (lineBase + code.slice(0, n.start).split('\n').length));
      }
    }
  }

  /* --- раскладка операторов по модулям --- */
  const files = new Map();   /* файл → { secs:[], statics:[], deferred:[], deferredNames:[], exportsHere:Set } */
  for (const s of secs) if (!files.has(s.file)) files.set(s.file, { secs: [], top: [], deferred: [], deferredNames: [], role: s.role });
  secs.forEach((s, k) => {
    const next = secs[k + 1];
    s.endLine = (next ? next.line : lineBase + code.split('\n').length) - 1;
    files.get(s.file).secs.push(s);
  });

  /* хвостовой комментарий на той же строке принадлежит оператору, а не следующему */
  const endExt = body.map(n => {
    const nl = code.indexOf('\n', n.end);
    const rest = code.slice(n.end, nl < 0 ? code.length : nl);
    return /^\s*(\/\*.*\*\/\s*|\/\/.*)?$/.test(rest) && rest.trim() ? (nl < 0 ? code.length : nl) : n.end;
  });
  for (const st of stmts) {
    const f = files.get(modOf(st.sec));
    const n = st.node;
    const prevEnd = st.i === 0 ? bodyStart : endExt[st.i - 1];
    const lead = ms.slice(prevEnd, n.start).replace(/^[ \t]*\n/, '');
    const trail = endExt[st.i] > n.end ? ms.slice(n.end, endExt[st.i]) : '';
    const exported = st.names.filter(nm => needExport.has(nm));
    if (isStatic[st.i]) {
      const text = ms.slice(n.start, n.end) + trail;
      const pre = exported.length ? 'export ' : '';
      f.top.push(lead + pre + text);
    } else if (n.type === 'VariableDeclaration') {
      const parts = [];
      for (const d of n.declarations) {
        const names = []; collectPatternNames(d.id, names);
        f.deferredNames.push(...names.map(nm => ({ nm, exported: needExport.has(nm) })));
        if (!d.init) continue;
        const lhs = ms.slice(d.id.start, d.id.end);
        const assign = lhs + ' = ' + ms.slice(d.init.start, d.init.end);
        parts.push(d.id.type === 'ObjectPattern' ? '(' + assign + ');' : assign + ';');
      }
      f.deferred.push(lead + parts.join('\n') + trail);
    } else if (n.type === 'ClassDeclaration') {
      f.deferredNames.push({ nm: n.id.name, exported: needExport.has(n.id.name) });
      f.deferred.push(lead + n.id.name + ' = ' + ms.slice(n.start, n.end) + ';' + trail);
    } else {
      f.deferred.push(lead + ms.slice(n.start, n.end) + trail);
    }
  }
  /* хвост после последнего оператора (комментарии) */
  const tail = ms.slice(endExt[body.length - 1], bodyEnd).trim();

  /* --- сеттеры --- */
  for (const name of setters.keys()) {
    const b = bind.get(name);
    files.get(modOf(b.sec)).top.push('\n/* Запись снаружи: ES-модуль не даёт присваивать импортированное имя. */\n' +
      'export function __set_' + name + '(v) { ' + name + ' = v; return v; }');
  }

  /* --- тексты модулей --- */
  const out = new Map();
  const indent = s => s.split('\n').map(l => l.length ? '  ' + l : l).join('\n');
  for (const [file, f] of files) {
    const rel = to => {
      let r = path.relative(path.dirname(file), to).split(path.sep).join('/');
      return r.startsWith('.') ? r : './' + r;
    };
    const head = [];
    head.push('/* =====================================================================');
    head.push('   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.');
    head.push('   Не править: при следующей нарезке файл перезапишется. Пока монолит —');
    head.push('   источник правды, правка вносится туда, потом `npm run split`.');
    head.push('');
    for (const s of f.secs) head.push('   Раздел «' + s.title + '», строки ' + s.line + '–' + s.endLine + '.');
    head.push('   ===================================================================== */');
    const imp = [];
    const im = imports.get(file);
    if (im) for (const [from, names] of [...im].sort((a, b) => a[0].localeCompare(b[0]))) {
      const list = [...names].sort();
      imp.push('import { ' + list.join(', ') + ' } from \'' + rel(from) + '\';');
    }
    let text = head.join('\n') + '\n' + (imp.length ? imp.join('\n') + '\n' : '');
    text += f.top.join('\n') + '\n';
    if (f.deferred.length) {
      const exp = f.deferredNames.filter(d => d.exported).map(d => d.nm);
      const loc = f.deferredNames.filter(d => !d.exported).map(d => d.nm);
      text += '\n/* ---------------------------------------------------------------------\n' +
        '   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с\n' +
        '   функциями выше; здесь они в __init(), который main.js зовёт в исходном\n' +
        '   порядке разделов, — так порядок исполнения остаётся прежним.\n' +
        '   --------------------------------------------------------------------- */\n';
      if (exp.length) text += 'export let ' + exp.join(', ') + ';\n';
      if (loc.length) text += 'let ' + loc.join(', ') + ';\n';
      text += 'export function __init() {\n' + indent(f.deferred.join('\n')) + '\n}\n';
    }
    if (file === secs[secs.length - 1].file && tail) text += '\n' + tail + '\n';
    out.set(file, text);
  }

  /* --- точка входа --- */
  const initOrder = [];
  for (const s of secs) if (files.get(s.file).deferred.length && !initOrder.includes(s.file)) initOrder.push(s.file);
  const mainLines = [
    '/* =====================================================================',
    '   СГЕНЕРИРОВАНО tools/split-legacy.mjs. Точка входа старой игры,',
    '   собранной из модулей: исполняемые части разделов в исходном порядке.',
    '   ===================================================================== */'
  ];
  initOrder.forEach((file, k) => mainLines.push('import { __init as init' + k + ' } from \'./' + file + '\';'));
  mainLines.push('');
  initOrder.forEach((file, k) => mainLines.push('init' + k + '();   /* ' + file + ' */'));
  out.set('main.js', mainLines.join('\n') + '\n');

  /* --- HTML-оболочка --- */
  const tocB = html.indexOf('<!-- ОГЛАВЛЕНИЕ:НАЧАЛО'), tocE = html.indexOf('<!-- ОГЛАВЛЕНИЕ:КОНЕЦ -->');
  let shell = html.slice(0, sTag) + '<script type="module" src="./src/legacy/main.js"></script>' + html.slice(eTag + '</script>'.length);
  if (tocB >= 0 && tocE > tocB) {
    const cut = shell.indexOf('<!-- ОГЛАВЛЕНИЕ:КОНЕЦ -->') + '<!-- ОГЛАВЛЕНИЕ:КОНЕЦ -->'.length + 1;
    shell = shell.slice(0, shell.indexOf('<!-- ОГЛАВЛЕНИЕ:НАЧАЛО')) + '<!-- Старая игра, собранная из модулей src/legacy/. Сгенерировано tools/split-legacy.mjs. -->\n' + shell.slice(cut);
  }

  /* --- стили и разметка отдельно: их берёт и новая игра (index.html) --- */
  const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
  const domStart = html.indexOf('<body>') + 6;
  const dom = html.slice(domStart, sTag).trim();

  /* --- отчёт --- */
  const rep = [];
  rep.push('# Модули старой игры (сгенерировано)');
  rep.push('');
  rep.push('Собирается командой `npm run split` из `games/montazh-city-3d/index.html`. Не править руками.');
  rep.push('');
  rep.push('| Модуль | Роль | Разделы монолита | Строк | На верхнем уровне | В `__init` | Импортирует из |');
  rep.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const [file, f] of files) {
    const im = imports.get(file);
    rep.push('| `' + file + '` | ' + f.role + ' | ' + f.secs.map(s => s.line + '–' + s.endLine).join(', ') + ' | ' +
      out.get(file).split('\n').length + ' | ' + f.top.length + ' | ' + f.deferred.length + ' | ' +
      (im ? [...im.keys()].map(k => '`' + k.replace(/\.js$/, '') + '`').join(', ') : '—') + ' |');
  }
  rep.push('');
  rep.push('## Где логика и интерфейс знают о рендере');
  rep.push('');
  rep.push('Это список мест, которые при переезде на новый движок должны пойти через мост рендера (`src/engine/bridge.js`), а не напрямую.');
  rep.push('');
  const byPair = new Map();
  for (const c of coupling) {
    const k = c.from + ' → ' + c.to;
    if (!byPair.has(k)) byPair.set(k, new Set());
    byPair.get(k).add(c.name);
  }
  rep.push('| Откуда | Куда | Имена |');
  rep.push('| --- | --- | --- |');
  for (const [k, names] of [...byPair].sort()) {
    const [a, b] = k.split(' → ');
    rep.push('| `' + a + '` | `' + b + '` | ' + [...names].sort().map(n => '`' + n + '`').join(', ') + ' |');
  }
  rep.push('');
  rep.push('## Запись в чужие переменные');
  rep.push('');
  rep.push(setters.size ? [...setters.keys()].map(n => '- `' + n + '` (живёт в `' + modOf(bind.get(n).sec) + '`) — пишется снаружи через `__set_' + n + '()`').join('\n') : 'Нет.');
  rep.push('');

  out.set('style.css', '/* СГЕНЕРИРОВАНО tools/split-legacy.mjs: стили интерфейса старой игры */\n' + css.trim() + '\n');
  out.set('dom.html', '<!-- СГЕНЕРИРОВАНО tools/split-legacy.mjs: разметка интерфейса старой игры -->\n' + dom + '\n');
  return { out, shell, report: rep.join('\n') + '\n', stats: { modules: files.size, statements: body.length, deferred: isStatic.filter(x => !x).length, setters: setters.size, coupling: coupling.length } };
}

function collectPatternNames(p, out) {
  if (!p) return;
  switch (p.type) {
    case 'Identifier': out.push(p.name); break;
    case 'ObjectPattern': for (const pr of p.properties) collectPatternNames(pr.type === 'RestElement' ? pr.argument : pr.value, out); break;
    case 'ArrayPattern': for (const e of p.elements) collectPatternNames(e, out); break;
    case 'AssignmentPattern': collectPatternNames(p.left, out); break;
    case 'RestElement': collectPatternNames(p.argument, out); break;
  }
}

/* ------------------------------------------------------------------ */
const res = split();
const want = new Map();
for (const [file, text] of res.out) want.set(path.join(OUT_DIR, file), text);
want.set(OUT_HTML, res.shell);
want.set(OUT_REPORT, res.report);

if (CHECK) {
  let stale = 0;
  for (const [p, t] of want) if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t) { console.error('устарел: ' + path.relative(ROOT, p)); stale++; }
  if (fs.existsSync(OUT_DIR)) for (const f of walk(OUT_DIR)) if (!want.has(f)) { console.error('лишний: ' + path.relative(ROOT, f)); stale++; }
  if (stale) { console.error('Модули отстали от монолита — выполни: npm run split'); process.exit(1); }
  console.log('Модули совпадают с монолитом.');
  process.exit(0);
}
fs.rmSync(OUT_DIR, { recursive: true, force: true });
for (const [p, t] of want) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); }
const s = res.stats;
console.log('Нарезано: ' + s.modules + ' модулей из ' + s.statements + ' операторов; в __init ушло ' + s.deferred +
  ', сеттеров ' + s.setters + ', обращений логики к рендеру ' + s.coupling + '.');

function walk(d) {
  const r = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) r.push(...walk(p)); else r.push(p);
  }
  return r;
}
