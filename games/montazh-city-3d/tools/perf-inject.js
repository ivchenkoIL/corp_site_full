/* =====================================================================
   perf-inject.js — измерительная обвязка для «Монтаж-Сити 3D».

   Ставится ДО загрузки игры (page.addInitScript) и не требует ни одной
   правки в index.html. Патчит только то, что нужно для замера:

     · Math.random          — детерминированный поток, чтобы спавн жителей,
                              собак и хулиганов повторялся от прогона к прогону;
     · getContext('webgl2') — счётчики draw call'ов, треугольников, памяти под
                              текстуры и буферы, классификация проходов по
                              программе (sky / main / glow);
     · requestAnimationFrame — время кадра на CPU и запросы таймера GPU
                              (EXT_disjoint_timer_query_webgl2);
     · #loadStep / #loading — границы фаз загрузки (текстуры / район / модели).

   Всё складывается в window.__MCPERF.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__MCPERF) return;

  var T0 = performance.now();

  var P = window.__MCPERF = {
    version: 1,
    t0: T0,
    boot: { phases: [], firstFrameAt: 0, doneAt: 0 },
    ext: { all: [], checked: {} },
    ctx: { attrs: null, vendor: '', renderer: '', unmasked: '', version: '', glsl: '', maxAniso: 0 },
    mem: { textures: [], texBytesL0: 0, texBytesWithMips: 0, bufferBytes: 0, texCount: 0 },
    shaders: { compileMs: 0, linkMs: 0, programs: [] },
    frames: [],
    sampling: false,
    gpu: { available: false, disjoint: 0, pending: 0, resolved: 0 }
  };

  /* ---------------- 1. детерминированный Math.random ---------------- */
  var seed = 0x9e3779b9 >>> 0;
  Math.random = function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    var t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  P.reseed = function (s) { seed = (s >>> 0) || 1; };

  /* ---------------- 2. фазы загрузки -------------------------------- */
  function mark(name) { P.boot.phases.push({ name: name, t: +(performance.now() - T0).toFixed(2) }); }
  mark('script-start');
  document.addEventListener('DOMContentLoaded', function () { mark('dom-ready'); });

  /* MutationObserver здесь бесполезен: boot() проходит все фазы за одну задачу,
     и колбэк наблюдателя срабатывает один раз уже в самом конце — видно только
     последнюю надпись. Поэтому перехватываем сам сеттер textContent. */
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('loadStep');
    if (!el) return;
    var d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    try {
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get: function () { return d.get.call(this); },
        set: function (v) { mark('load:' + v); d.set.call(this, v); }
      });
      mark('load:генерируем текстуры (начало boot)');
    } catch (e) { }
  });

  var mo = new MutationObserver(function () {
    var st = document.getElementById('loadStep');
    var ld = document.getElementById('loading');
    if (st && st.textContent && st.textContent !== P.boot._lastStep) {
      P.boot._lastStep = st.textContent;
      /* Наблюдатель срабатывает уже после всего boot(), поэтому его отметка
         значит «загрузка закончилась», а не «фаза началась» — помечаем иначе,
         чтобы не путать с точными отметками сеттера. */
      mark('obs:последняя надпись — ' + st.textContent);
    }
    if (ld && ld.style.display === 'none' && !P.boot.doneAt) {
      P.boot.doneAt = +(performance.now() - T0).toFixed(2);
      mark('load:done');
    }
  });
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('stage') ? document.body : document.documentElement;
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  });

  /* ---------------- 3. обвязка WebGL2 ------------------------------- */
  var origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    var gl = origGetContext.apply(this, arguments);
    if (type === 'webgl2' && gl && !gl.__mcperf) instrument(gl, arguments[1] || null);
    return gl;
  };

  function instrument(gl, attrs) {
    gl.__mcperf = true;
    P.gl = gl;
    P.ctx.attrs = attrs;
    P.ctx.vendor = gl.getParameter(gl.VENDOR);
    P.ctx.renderer = gl.getParameter(gl.RENDERER);
    P.ctx.version = gl.getParameter(gl.VERSION);
    P.ctx.glsl = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    try {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) P.ctx.unmasked = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
    } catch (e) { }

    P.ext.all = gl.getSupportedExtensions() || [];
    ['EXT_texture_filter_anisotropic', 'EXT_color_buffer_float',
     'EXT_disjoint_timer_query_webgl2', 'OES_texture_float_linear',
     'EXT_color_buffer_half_float', 'WEBGL_debug_renderer_info',
     'OVR_multiview2', 'WEBGL_multi_draw', 'KHR_parallel_shader_compile'
    ].forEach(function (n) { P.ext.checked[n] = P.ext.all.indexOf(n) >= 0; });

    var an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) P.ctx.maxAniso = gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT);

    P.limits = {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES)
    };

    /* --- таймер GPU --- */
    var TQ = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    P.gpu.available = !!TQ;
    P.tq = TQ;

    /* --- классификация программ по исходникам шейдеров --- */
    var srcOf = new WeakMap();      /* shader  -> исходник */
    var shOf = new WeakMap();       /* program -> [исходники] */
    var kindOf = new WeakMap();     /* program -> 'sky' | 'main' | 'glow' | '?' */

    var _shaderSource = gl.shaderSource.bind(gl);
    gl.shaderSource = function (sh, src) { srcOf.set(sh, src); return _shaderSource(sh, src); };

    var _attachShader = gl.attachShader.bind(gl);
    gl.attachShader = function (pr, sh) {
      var a = shOf.get(pr) || []; a.push(srcOf.get(sh) || ''); shOf.set(pr, a);
      return _attachShader(pr, sh);
    };

    var _compileShader = gl.compileShader.bind(gl);
    gl.compileShader = function (sh) {
      var t = performance.now(); var r = _compileShader(sh);
      P.shaders.compileMs += performance.now() - t; return r;
    };

    var _linkProgram = gl.linkProgram.bind(gl);
    gl.linkProgram = function (pr) {
      var t = performance.now(); var r = _linkProgram(pr);
      P.shaders.linkMs += performance.now() - t;
      var all = (shOf.get(pr) || []).join('\n');
      /* Вид программы. Основной признак — метка /*PASS:имя*\/ в исходнике
         шейдера: она не зависит от того, как названы юниформы, и новые
         программы (кубмапа неба, префильтр, BRDF, тонмаппинг) не попадают
         в «other» молча. Для сборок без меток — прежняя эвристика. */
      var tag = /PASS:([a-z0-9_]+)/i.exec(all);
      var kind = tag ? tag[1].toLowerCase()
               : all.indexOf('uBones') >= 0 ? 'main'
               : all.indexOf('uInvVP') >= 0 ? 'sky'
               : all.indexOf('uHard') >= 0 ? 'glow' : 'other';
      kindOf.set(pr, kind);
      P.shaders.programs.push({ kind: kind, chars: all.length, atMs: +(performance.now() - T0).toFixed(2) });
      return r;
    };

    var curKind = 'other';
    var _useProgram = gl.useProgram.bind(gl);
    gl.useProgram = function (pr) {
      var k = (pr && kindOf.get(pr)) || 'other';
      if (P.finishActive && k !== curKind) closeSegment(k);
      curKind = k;
      return _useProgram(pr);
    };

    /* ------------ Разбор кадра по проходам ---------------------------

       Прямой способ — по запросу TIME_ELAPSED_EXT на каждый проход — на M4
       не работает: замерено, шесть запросов в кадре дают сумму 32 мс там,
       где кадр целиком стоит 4.4 мс, а «очистка» из одного gl.clear —
       1.8 мс. Причина не в самих запросах: тайловый GPU на каждой границе
       запроса вынужден сохранить буфер в память и загрузить обратно, и при
       2880x1800 с мультисэмплингом это дороже самих проходов. Ровно та же
       беда, что у readPixels, только вместо синхронизации с CPU — обмен с
       памятью.

       Поэтому меряем префиксами: один запрос на кадр, от начала кадра до
       конца прохода k, а k перебирается по кадрам. Искусственная граница в
       каждом замере ровно одна и стоит примерно одинаково (сохранение
       буфера того же размера), поэтому в разности T(k) − T(k−1) она
       сокращается и остаётся цена самого прохода. Слот k = −1 (пустой
       префикс) даёт саму надбавку, а последний префикс — кадр целиком, и
       его можно сверить с обычным замером кадра: расхождение видно в
       отчёте.

       Запасной способ (WebKit, где EXT_disjoint_timer_query_webgl2 нет) —
       чтение одного пикселя на границе прохода. Проверено: ни gl.finish(),
       ни fenceSync+clientWaitSync в Chrome не дожидаются GPU (возвращаются
       за 0 мс на отрисовке в 350 мс), реально дожидается только readPixels.
       Надбавку калибруем и вычитаем, но на тайловом GPU она соизмерима с
       проходами, поэтому оттуда — только грубая пропорция. */
    P.passMethod = TQ ? 'timer' : 'sync';
    P._segStart = 0;
    P._segKind = null;
    P._segBuf = null;             /* запасной способ: сегменты текущего кадра */
    P.syncOverheadMs = 0;
    P._segAcc = {};               /* запасной способ: label -> {kind, ms:[], ...} */
    P._pfxAcc = {};               /* таймер: sig -> {k -> [ms]} */
    P._pfxSeq = {};               /* sig -> список ярлыков по порядку */
    P._segPend = [];
    P._segPool = [];
    P._segQLive = null;
    P._segLabel = null;
    P._segSeen = null;
    P._segSeq = null;             /* ярлыки проходов текущего кадра по порядку */
    P._segIdx = -1;               /* индекс текущего прохода в кадре */
    P._profK = -1;                /* до какого прохода включительно мерим этот кадр */
    P._profSlots = 2;             /* сколько слотов в переборе; растёт по факту */
    P._profRot = 0;
    P.segLost = 0;

    var px1 = new Uint8Array(4);
    function syncGPU() {
      try { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); } catch (e) { }
    }
    P._calibrateSync = function (n) {
      var a = [];
      for (var i = 0; i < (n || 5); i++) { var t = performance.now(); syncGPU(); a.push(performance.now() - t); }
      a.sort(function (x, y) { return x - y; });
      P.syncOverheadMs = +a[a.length >> 1].toFixed(3);
      return P.syncOverheadMs;
    };

    /* Ярлык прохода: вид программы плюс номер его появления в кадре
       (main#0 — статика района, main#1 — персонажи и техника). */
    function labelFor(kind) {
      var n = P._segSeen[kind] || 0;
      P._segSeen[kind] = n + 1;
      return kind + '#' + n;
    }
    function accPush(label, kind, ms, draws, tris) {
      var a = P._segAcc[label] || (P._segAcc[label] = { kind: kind, ms: [], draws: [], tris: [] });
      a.ms.push(ms); a.draws.push(draws); a.tris.push(tris);
    }

    function pfxEnd() {
      if (!P._segQLive) return;
      try {
        gl.endQuery(TQ.TIME_ELAPSED_EXT);
        P._segPend.push({ q: P._segQLive, k: P._profK, seq: P._segSeq });
      } catch (e) { P._segPool.push(P._segQLive); }
      P._segQLive = null;
    }
    function pfxBegin() {
      try {
        var q = P._segPool.pop() || gl.createQuery();
        gl.beginQuery(TQ.TIME_ELAPSED_EXT, q);
        P._segQLive = q;
      } catch (e) { P._segQLive = null; }
    }
    /* результаты приходят по порядку; читаем без ожидания */
    P._drainSegments = function () {
      if (P.passMethod !== 'timer' || !P._segPend.length) return;
      while (P._segPend.length) {
        var e = P._segPend[0], ok = false;
        try { ok = gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE); } catch (err) { P._segPend.shift(); continue; }
        if (!ok) break;
        var bad = false;
        try { bad = !!gl.getParameter(TQ.GPU_DISJOINT_EXT); } catch (err) { }
        P._segPend.shift();
        var ns = 0;
        try { ns = gl.getQueryParameter(e.q, gl.QUERY_RESULT); } catch (err) { bad = true; }
        P._segPool.push(e.q);
        if (bad) { P.segLost++; continue; }
        var sig = e.seq.join('|');
        var byK = P._pfxAcc[sig] || (P._pfxAcc[sig] = {});
        (byK[e.k] || (byK[e.k] = [])).push(ns / 1e6);
        P._pfxSeq[sig] = e.seq;
      }
    };

    function closeSegment(nextKind) {
      if (P.passMethod === 'timer') {
        /* граница прохода: если этот кадр мерит префикс, закрываем запрос
           ровно здесь, дальше кадр идёт без замера */
        if (nextKind !== null) {
          if (P._segIdx === P._profK) pfxEnd();   /* префикс кончается после прохода _profK */
          P._segIdx++;
          P._segSeq.push(labelFor(nextKind));
        }
        return;
      }
      syncGPU();
      var now = performance.now();
      if (P._segKind !== null && P._segBuf) {
        var label = P._segLabel;
        accPush(label, P._segKind, +Math.max(0, now - P._segStart - P.syncOverheadMs).toFixed(3),
                P._segDraws, Math.round(P._segTris));
        P._segBuf.push({ label: label, kind: P._segKind, ms: +(now - P._segStart).toFixed(3) });
      }
      P._segKind = nextKind;
      P._segLabel = nextKind === null ? null : labelFor(nextKind);
      P._segStart = now;
      P._segDraws = 0;
      P._segTris = 0;
    }
    P._closeSegment = closeSegment;

    P._openSegments = function () {
      P._segSeen = {};
      P._segDraws = 0; P._segTris = 0;
      if (P.passMethod === 'timer') {
        /* слот −1 меряет пустой префикс: это и есть надбавка за границу */
        P._profK = (P._profRot++ % P._profSlots) - 1;
        P._segIdx = 0;
        P._segSeq = ['clear#0'];       /* нулевой проход — до первой смены программы */
        P._segSeen['clear'] = 1;
        pfxBegin();
        if (P._profK < 0) pfxEnd();
        return;
      }
      if (!P.syncOverheadMs) P._calibrateSync(5);
      P._segBuf = [];
      P._segKind = null;
      syncGPU();
      P._segStart = performance.now();
      P._segKind = 'clear';
      P._segLabel = labelFor('clear');
    };
    P._finishSegments = function () {
      if (P.passMethod === 'timer') {
        pfxEnd();
        /* число слотов = проходов в кадре плюс слот надбавки */
        var n = P._segSeq.length + 1;
        if (n > P._profSlots) P._profSlots = n;
        return [];
      }
      closeSegment(null);
      var b = P._segBuf; P._segBuf = null; P._segKind = null;
      return b || [];
    };
    /* --- счётчики кадра --- */
    var f = P.cur = newCounters();
    function newCounters() {
      /* виды проходов не перечислены заранее: программы добавляются
         (кубмапа неба, префильтр, BRDF, тонмаппинг), и неизвестный вид
         должен считаться, а не превращать счётчик в NaN */
      return { draws: 0, tris: 0, verts: 0, byKind: { sky: 0, main: 0, glow: 0, other: 0 },
               trisByKind: { sky: 0, main: 0, glow: 0, other: 0 },
               progSwitch: 0, vaoBind: 0, texBind: 0, uniformCalls: 0 };
    }
    function bump(o, k, v) { o[k] = (o[k] || 0) + v; }
    P._newCounters = newCounters;
    P._reset = function () { P.cur = f = newCounters(); };

    var _drawElements = gl.drawElements.bind(gl);
    gl.drawElements = function (mode, count) {
      f.draws++; bump(f.byKind, curKind, 1); f.verts += count;
      var t = count / 3; f.tris += t; bump(f.trisByKind, curKind, t);
      if (P.finishActive) { P._segDraws++; P._segTris += t; }
      return _drawElements.apply(null, arguments);
    };
    var _drawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = function (mode, first, count) {
      f.draws++; bump(f.byKind, curKind, 1); f.verts += count;
      var t = count / 3; f.tris += t; bump(f.trisByKind, curKind, t);
      if (P.finishActive) { P._segDraws++; P._segTris += t; }
      return _drawArrays.apply(null, arguments);
    };
    if (gl.drawElementsInstanced) {
      var _dei = gl.drawElementsInstanced.bind(gl);
      gl.drawElementsInstanced = function (mode, count, type, off, inst) {
        f.draws++; bump(f.byKind, curKind, 1); f.verts += count * inst;
        var t = count / 3 * inst; f.tris += t; bump(f.trisByKind, curKind, t);
        if (P.finishActive) { P._segDraws++; P._segTris += t; }
        return _dei.apply(null, arguments);
      };
    }

    var _bindVertexArray = gl.bindVertexArray.bind(gl);
    gl.bindVertexArray = function (v) { f.vaoBind++; return _bindVertexArray(v); };

    /* --- память под текстуры --- */
    var bound = {};
    var texInfo = new WeakMap();
    var _bindTexture = gl.bindTexture.bind(gl);
    gl.bindTexture = function (target, tex) { bound[target] = tex; f.texBind++; return _bindTexture(target, tex); };

    function bpp(format, type) {
      var ch = format === gl.RGBA ? 4 : format === gl.RGB ? 3 : format === gl.RG ? 2 : 1;
      var sz = (type === gl.UNSIGNED_BYTE || type === gl.BYTE) ? 1
             : (type === gl.UNSIGNED_SHORT || type === gl.SHORT || type === gl.HALF_FLOAT) ? 2 : 4;
      return ch * sz;
    }
    /* байт на тексель по sized-формату (texStorage*, texImage3D) и его имя */
    var FMT = {};
    [['RGBA8', 4], ['SRGB8_ALPHA8', 4], ['RGB8', 3], ['SRGB8', 3], ['RG8', 2], ['R8', 1],
     ['RGBA4', 2], ['RGB5_A1', 2], ['RGB565', 2], ['RGBA16F', 8], ['RGBA32F', 16], ['RG16F', 4], ['R16F', 2],
     ['R32F', 4], ['DEPTH_COMPONENT16', 2], ['DEPTH_COMPONENT24', 4], ['DEPTH24_STENCIL8', 4],
     ['RGBA', 4], ['RGB', 3], ['LUMINANCE_ALPHA', 2], ['LUMINANCE', 1], ['ALPHA', 1],
     ['R11F_G11F_B10F', 4], ['RGB16F', 6], ['RG16F', 4], ['DEPTH_COMPONENT32F', 4]
    ].forEach(function (p) { if (gl[p[0]] !== undefined) FMT[gl[p[0]]] = { name: p[0], bpp: p[1] }; });
    function fmtOf(ifmt) { return FMT[ifmt] || { name: '0x' + Number(ifmt).toString(16), bpp: 4 }; }
    function levelsBytes(w, h, d, bpp, levels) {
      var total = 0;
      for (var l = 0; l < levels; l++) { total += Math.max(1, w >> l) * Math.max(1, h >> l) * d * bpp; }
      return total;
    }
    /* Учёт одной текстуры: L0 отдельно, с мипами отдельно; массивы — со всеми
       слоями. Пере-спецификация той же текстуры (texImage2D на каждом шаге
       авто-масштаба для HDR-буфера) заменяет прежнюю запись, а не добавляет
       новую: иначе инвентарь памяти растёт на пустом месте. */
    function account(target, w, h, layers, ifmt, levels) {
      var t = bound[target];
      var fi = fmtOf(ifmt), l0 = w * h * layers * fi.bpp;
      var withMips = levels > 1 ? levelsBytes(w, h, layers, fi.bpp, levels) : l0;
      var old = t ? texInfo.get(t) : null;
      if (old) {
        P.mem.texBytesL0 -= old.bytes;
        P.mem.texBytesWithMips -= old.bytesMips;
        var i = P.mem.textures.indexOf(old);
        if (i >= 0) P.mem.textures.splice(i, 1);
        P.mem.texCount--;
      }
      /* то же для случая без мультисэмплинга: сцена пишет прямо в текстуру */
      if (target === gl.TEXTURE_2D && layers === 1 && levels === 1 &&
          fi.name.indexOf('DEPTH') < 0 && w >= 320 && h >= 240) { P.sceneW = w; P.sceneH = h; }
      var rec = { w: w, h: h, layers: layers, fmt: fi.name, bytes: l0, bytesMips: withMips,
                  mips: levels > 1, target: target === gl.TEXTURE_CUBE_MAP ? 'cube' : target === gl.TEXTURE_2D_ARRAY ? '2d_array' : target === gl.TEXTURE_3D ? '3d' : '2d' };
      if (target === gl.TEXTURE_CUBE_MAP) { rec.bytes *= 6; rec.bytesMips *= 6; }
      if (t) texInfo.set(t, rec);
      P.mem.textures.push(rec);
      P.mem.texCount++;
      P.mem.texBytesL0 += rec.bytes;
      P.mem.texBytesWithMips += rec.bytesMips;
      return rec;
    }
    /* Буферы отрисовки: HDR-буфер сцены живёт в renderbuffer'ах, и без их
       учёта инвентарь памяти врал бы на сотню мегабайт. */
    P.mem.renderbuffers = [];
    P.mem.rbBytes = 0;
    var boundRB = null, rbInfo = new WeakMap();
    var _bindRenderbuffer = gl.bindRenderbuffer.bind(gl);
    gl.bindRenderbuffer = function (target, rb) { boundRB = rb; return _bindRenderbuffer(target, rb); };
    function accountRB(w, h, ifmt, samples) {
      var fi = fmtOf(ifmt), bytes = w * h * fi.bpp * Math.max(1, samples);
      /* Размер буфера сцены. С этапа 03 масштаб рендера живёт не на холсте, а
         на HDR-буфере: холст всегда в полной плотности, и gl.canvas.width
         авто-масштаба больше не показывает. Берём размер цветного вложения. */
      if (fi.name.indexOf('DEPTH') < 0 && fi.name.indexOf('STENCIL') < 0) { P.sceneW = w; P.sceneH = h; }
      var old = boundRB ? rbInfo.get(boundRB) : null;
      if (old) {
        P.mem.rbBytes -= old.bytes;
        var j = P.mem.renderbuffers.indexOf(old);
        if (j >= 0) P.mem.renderbuffers.splice(j, 1);
      }
      var rec = { w: w, h: h, fmt: fi.name, samples: samples, bytes: bytes };
      if (boundRB) rbInfo.set(boundRB, rec);
      P.mem.renderbuffers.push(rec);
      P.mem.rbBytes += bytes;
    }
    var _rbStorage = gl.renderbufferStorage.bind(gl);
    gl.renderbufferStorage = function (t, ifmt, w, h) { accountRB(w, h, ifmt, 0); return _rbStorage(t, ifmt, w, h); };
    var _rbStorageMS = gl.renderbufferStorageMultisample.bind(gl);
    gl.renderbufferStorageMultisample = function (t, s, ifmt, w, h) { accountRB(w, h, ifmt, s); return _rbStorageMS(t, s, ifmt, w, h); };
    var _texImage2D = gl.texImage2D.bind(gl);
    gl.texImage2D = function (target, level, internalformat, a, b, c, d, e, g) {
      var w, h, bytes;
      if (arguments.length >= 8) {                       /* явные ширина/высота */
        w = a; h = b; bytes = w * h * bpp(d, e);
      } else {                                           /* источник-картинка */
        var src = c;
        w = (src && (src.width || src.videoWidth)) || 0;
        h = (src && (src.height || src.videoHeight)) || 0;
        bytes = w * h * bpp(a, b);
      }
      /* Через общий учёт: он знает sized-форматы и заменяет прежнюю запись,
         если ту же текстуру пере-специфицируют (HDR-буфер сцены делает это на
         каждом шаге авто-масштаба). Мипы добавит generateMipmap. */
      if (level === 0 && w && h) account(target, w, h, 1, internalformat, 1);
      return _texImage2D.apply(null, arguments);
    };
    var _generateMipmap = gl.generateMipmap.bind(gl);
    gl.generateMipmap = function (target) {
      var t = bound[target], rec = t && texInfo.get(t);
      /* у immutable-хранилища (texStorage*) мипы уже посчитаны при выделении */
      if (rec && !rec.mips) { rec.mips = true; P.mem.texBytesWithMips += Math.round(rec.bytes / 3); }
      return _generateMipmap(target);
    };
    /* immutable-хранилище: 2D и массивы слоёв (этап 02 держит материалы в TEXTURE_2D_ARRAY) */
    if (gl.texStorage2D) {
      var _texStorage2D = gl.texStorage2D.bind(gl);
      gl.texStorage2D = function (target, levels, ifmt, w, h) {
        account(target, w, h, 1, ifmt, levels);
        return _texStorage2D.apply(null, arguments);
      };
    }
    if (gl.texStorage3D) {
      var _texStorage3D = gl.texStorage3D.bind(gl);
      gl.texStorage3D = function (target, levels, ifmt, w, h, depth) {
        account(target, w, h, depth, ifmt, levels);
        return _texStorage3D.apply(null, arguments);
      };
    }
    if (gl.texImage3D) {
      var _texImage3D = gl.texImage3D.bind(gl);
      gl.texImage3D = function (target, level, ifmt, w, h, depth) {
        if (level === 0 && w && h) account(target, w, h, depth, ifmt, 1);
        return _texImage3D.apply(null, arguments);
      };
    }
    var _deleteTexture = gl.deleteTexture.bind(gl);
    gl.deleteTexture = function (t) {
      var rec = t && texInfo.get(t);
      if (rec && !rec.deleted) {
        rec.deleted = true;
        P.mem.texCount--; P.mem.texBytesL0 -= rec.bytes;
        P.mem.texBytesWithMips -= rec.mips ? Math.round(rec.bytes * 4 / 3) : rec.bytes;
        var k = P.mem.textures.indexOf(rec); if (k >= 0) P.mem.textures.splice(k, 1);
      }
      return _deleteTexture(t);
    };

    /* --- память под буферы --- */
    var _bufferData = gl.bufferData.bind(gl);
    gl.bufferData = function (target, src) {
      var n = typeof src === 'number' ? src : (src && (src.byteLength || 0)) || 0;
      P.mem.bufferBytes += n;
      return _bufferData.apply(null, arguments);
    };
  }

  /* ---------------- 4. кадр: CPU и GPU ------------------------------ */
  var origRAF = window.requestAnimationFrame.bind(window);
  var qPool = [], qLive = null;

  window.requestAnimationFrame = function (cb) {
    return origRAF(function (ts) {
      if (!P.boot.firstFrameAt) P.boot.firstFrameAt = +(performance.now() - T0).toFixed(2);
      var gl = P.gl, TQ = P.tq;

      if (P.sampling && P._reset) P._reset();

      /* кадр под профилировку проходов — каждый N-й, если включено.
         Решаем это ДО запроса вокруг кадра: одновременно активным может быть
         только один TIME_ELAPSED_EXT, а профилируемый кадр открывает свой на
         каждый сегмент. Поэтому цену кадра целиком и разбор по проходам
         снимаем в разных кадрах — и в статистику кадра профилируемые не идут. */
      var prof = false;
      if (P.sampling && P.finishEvery > 0 && P._openSegments && (P._frameNo++ % P.finishEvery) === 0) {
        prof = true; P.finishActive = true; P._openSegments();
      }

      /* запрос таймера GPU вокруг всей работы кадра */
      if (P.sampling && !prof && gl && TQ) {
        try {
          if (gl.getParameter(TQ.GPU_DISJOINT_EXT)) P.gpu.disjoint++;
          qLive = qPool.pop() || gl.createQuery();
          gl.beginQuery(TQ.TIME_ELAPSED_EXT, qLive);
        } catch (e) { qLive = null; }
      }

      var c0 = performance.now();
      var r;
      try { r = cb(ts); } finally {
        if (prof) {
          var segs = P._finishSegments();
          P.finishActive = false;
          P.profFrames.push(segs);
        }
        var cpu = performance.now() - c0;
        if (P.sampling && gl && TQ && qLive) {
          try { gl.endQuery(TQ.TIME_ELAPSED_EXT); P.pendingQ.push({ q: qLive, i: P.frames.length }); P.gpu.pending++; }
          catch (e) { }
          qLive = null;
        }
        if (P.sampling) {
          var cur = P.cur || {};
          var cv = gl && gl.canvas;
          P.frames.push({
            ts: +ts.toFixed(3),
            rw: P.sceneW || (cv ? cv.width : 0), rh: P.sceneH || (cv ? cv.height : 0),
            cw: cv ? cv.width : 0, ch: cv ? cv.height : 0,
            cpuMs: +cpu.toFixed(3),
            gpuMs: null,
            draws: cur.draws | 0,
            tris: Math.round(cur.tris || 0),
            sky: (cur.byKind && cur.byKind.sky) | 0,
            main: (cur.byKind && cur.byKind.main) | 0,
            glow: (cur.byKind && cur.byKind.glow) | 0,
            mainTris: Math.round((cur.trisByKind && cur.trisByKind.main) || 0),
            glowTris: Math.round((cur.trisByKind && cur.trisByKind.glow) || 0),
            dlg: dlgOpen(),
            prof: prof
          });
          drainQueries();
        }
        /* результаты сегментов дочитываем всегда: последние запросы окна
           разрешаются уже после stop(), и без этого хвост окна пропал бы */
        if (P._drainSegments) P._drainSegments();
      }
      return r;
    });
  };

  var dlgEl = null;
  function dlgOpen() {
    if (!dlgEl) dlgEl = document.getElementById('dialog');
    return !!(dlgEl && dlgEl.style.display === 'block');
  }

  P.finishEvery = 0;        /* 0 — выключено; N — профилировать каждый N-й кадр */
  P.finishActive = false;
  P._frameNo = 0;
  P.profFrames = [];

  P.pendingQ = [];
  function drainQueries() {
    var gl = P.gl, TQ = P.tq;
    if (!gl || !TQ) return;
    for (var i = P.pendingQ.length - 1; i >= 0; i--) {
      var e = P.pendingQ[i];
      var avail = false, disjoint = false;
      try {
        avail = gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE);
        disjoint = gl.getParameter(TQ.GPU_DISJOINT_EXT);
      } catch (err) { P.pendingQ.splice(i, 1); continue; }
      if (disjoint) { P.gpu.disjoint++; qPool.push(e.q); P.pendingQ.splice(i, 1); continue; }
      if (!avail) continue;
      var ns = 0;
      try { ns = gl.getQueryParameter(e.q, gl.QUERY_RESULT); } catch (err) { }
      if (P.frames[e.i]) P.frames[e.i].gpuMs = +(ns / 1e6).toFixed(3);
      P.gpu.resolved++;
      qPool.push(e.q);
      P.pendingQ.splice(i, 1);
    }
  }

  /* ---------------- 5. управление замером --------------------------- */
  P.start = function (finishEvery) {
    P.frames.length = 0; P.profFrames.length = 0; P.pendingQ.length = 0;
    P.gpu.pending = 0; P.gpu.resolved = 0; P._frameNo = 0;
    P._segAcc = {}; P._pfxAcc = {}; P._pfxSeq = {}; P.segLost = 0; P._profRot = 0;
    P.finishEvery = finishEvery | 0;
    P.sampling = true;
  };
  P.stop = function () { P.sampling = false; return P.frames.slice(); };

  /* Дождаться, пока разрешатся последние запросы сегментов. Ждём кадрами, а
     не циклом: результат приходит через кадр-два, а занимать поток нельзя. */
  P.flushSegments = function (frames) {
    var left = frames || 8;
    return new Promise(function (done) {
      (function step() {
        if (P._drainSegments) P._drainSegments();
        if (--left <= 0 || !P._segPend || !P._segPend.length) return done(P._segPend ? P._segPend.length : 0);
        origRAF(step);
      })();
    });
  };

  /* Сколько кадров уже годится в статистику. Нужно, чтобы окно замера
     закрывалось по числу набранных кадров, а не по секундомеру: диалог
     прокликивается по одной реплике за кадр, и на медленной машине один
     разговор съедает окно целиком. */
  P.cleanCount = function () {
    var n = 0;
    for (var i = 1; i < P.frames.length; i++) if (!P.frames[i].dlg && !P.frames[i].prof) n++;
    return n;
  };

  P.report = function () {
    /* Кадры с открытым диалогом выбрасываем: игра в них не считает мир, машины
       стоят, и цифры получаются не про сцену, а про паузу. То же с кадрами под
       профилировкой — там принудительные синхронизации.

       Время кадра берём ТОЛЬКО между соседями по исходной последовательности.
       Если считать разность между уцелевшими, любой выброшенный кусок склеится
       в один «кадр» на всю паузу — и p95 покажет секунды там, где их не было. */
    var keep = [];
    for (var i = 0; i < P.frames.length; i++) {
      var f0 = P.frames[i];
      if (i === 0 || f0.dlg || f0.prof) continue;
      keep.push(f0);
      var prev = P.frames[i - 1];
      if (prev && !prev.dlg && !prev.prof) f0._dt = f0.ts - prev.ts;
    }
    var fr = keep;
    P.report_dropped = P.frames.length - 1 - fr.length;
    var dt = [];
    for (var k = 0; k < fr.length; k++) if (fr[k]._dt !== undefined) dt.push(fr[k]._dt);
    P.report_gaps = fr.length - dt.length;
    function pct(a, p) {
      if (!a.length) return null;
      var s = a.slice().sort(function (x, y) { return x - y; });
      var k = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
      return +s[k].toFixed(3);
    }
    function avg(a) { return a.length ? +(a.reduce(function (x, y) { return x + y; }, 0) / a.length).toFixed(3) : null; }
    var cpu = fr.map(function (x) { return x.cpuMs; });
    var gpu = fr.filter(function (x) { return x.gpuMs !== null; }).map(function (x) { return x.gpuMs; });
    var draws = fr.map(function (x) { return x.draws; });
    var tris = fr.map(function (x) { return x.tris; });
    var rw = fr.map(function (x) { return x.rw || 0; }), rh = fr.map(function (x) { return x.rh || 0; });
    return {
      frames: fr.length,
      /* буфер отрисовки: медиана и крайние значения — при авто-масштабе они расходятся */
      /* «render» — буфер сцены (его крутит авто-масштаб), «canvas» — холст,
         в который пишет тонмаппинг; он всегда в полной плотности */
      render: { w: pct(rw, 50), h: pct(rh, 50), wMin: pct(rw, 0), wMax: pct(rw, 100), hMin: pct(rh, 0), hMax: pct(rh, 100) },
      canvas: { w: pct(fr.map(function (x) { return x.cw || 0; }), 50), h: pct(fr.map(function (x) { return x.ch || 0; }), 50) },
      fpsMean: dt.length ? +(1000 / avg(dt)).toFixed(2) : null,
      fpsFromP50: dt.length ? +(1000 / pct(dt, 50)).toFixed(2) : null,
      frameMs: { p50: pct(dt, 50), p95: pct(dt, 95), p99: pct(dt, 99), min: pct(dt, 0), max: pct(dt, 100), mean: avg(dt) },
      cpuMs: { p50: pct(cpu, 50), p95: pct(cpu, 95), mean: avg(cpu), max: pct(cpu, 100) },
      gpuMs: gpu.length ? { p50: pct(gpu, 50), p95: pct(gpu, 95), mean: avg(gpu), max: pct(gpu, 100), samples: gpu.length }
                        : { available: false, reason: P.gpu.available ? 'нет разрешённых запросов' : 'EXT_disjoint_timer_query_webgl2 недоступен' },
      draws: { p50: pct(draws, 50), p95: pct(draws, 95), mean: avg(draws), max: pct(draws, 100) },
      tris: { p50: pct(tris, 50), p95: pct(tris, 95), mean: avg(tris), max: pct(tris, 100) },
      drawsByPass: {
        sky: avg(fr.map(function (x) { return x.sky; })),
        main: avg(fr.map(function (x) { return x.main; })),
        glow: avg(fr.map(function (x) { return x.glow; }))
      },
      disjoint: P.gpu.disjoint,
      droppedDialogFrames: P.report_dropped || 0,
      /* сколько кадров пришлось на разрывы (после диалога или профилировки):
         сам кадр в статистике остаётся, а его «время кадра» неизвестно */
      frameMsSamples: dt.length,
      gapsSkipped: P.report_gaps || 0
    };
  };

  /* Средняя стоимость каждого прохода кадра. Проходы идут в неизменном порядке
     (небо → статика → тени → динамика → свечения), поэтому опознаём их по
     порядковому номеру внутри кадра, а не только по программе. */
  /* Средняя стоимость каждого прохода кадра.

     Ярлык прохода — вид программы плюс номер его появления внутри кадра
     (main#0 — статика района, main#1 — персонажи и техника). Порядок
     проходов может меняться от кадра к кадру: грань кубмапы окружения
     обновляется не каждый кадр, ночью добавляются свечения. Поэтому копим
     по ярлыку, а не по позиции в списке. */
  P.PASS_NAMES = {
    /* Первый проход — остаток: очистка, установка камеры и разгон конвейера.
       Искусственная граница запроса попадает именно сюда и в разностях
       остальных проходов сокращается, поэтому цифра тут завышена. */
    'clear#0': 'очистка, камера и разгон конвейера',
    'env#0': 'окружение: небо в кубмапу',
    'env#1': 'окружение: префильтр и SH',
    'env#2': 'окружение: BRDF',
    'main#0': 'статика района',
    'glow#0': 'тени под объектами',
    'main#1': 'персонажи и техника',
    'sky#0': 'небо',
    'glow#1': 'свечения и маркеры',
    'tone#0': 'тонмаппинг в холст'
  };
  function medOf(a) { var s2 = a.slice().sort(function (x, y) { return x - y; }); return s2.length ? s2[s2.length >> 1] : 0; }
  /* межквартильный размах префикса — шумовой пол: проход дешевле него
     этим способом не разрешается, и отрицательная разность значит ровно это */
  function iqrOf(a) {
    if (a.length < 4) return 0;
    var s2 = a.slice().sort(function (x, y) { return x - y; });
    return s2[Math.floor(s2.length * 0.75)] - s2[Math.floor(s2.length * 0.25)];
  }

  /* Разбор кадра по проходам.

     Таймер: цена прохода = разность медиан соседних префиксов, надбавка за
     искусственную границу сокращается (слот −1 меряет её отдельно и
     печатается как overheadMs). Отрицательные разности означают, что шум
     превысил цену прохода, — так и пишем, не обнуляя.

     readPixels: как раньше, доля прохода в сумме. */
  P.passReport = function () {
    if (P.passMethod === 'timer') {
      var sigs = Object.keys(P._pfxAcc || {});
      if (!sigs.length) return { available: false, reason: 'профилировка проходов не включена или не дала результатов' };
      /* берём самую частую последовательность проходов: порядок может
         меняться (грань окружения обновляется не каждый кадр) */
      var best = null, bestN = -1;
      for (var i = 0; i < sigs.length; i++) {
        var n = 0, byK = P._pfxAcc[sigs[i]];
        for (var k in byK) n += byK[k].length;
        if (n > bestN) { bestN = n; best = sigs[i]; }
      }
      var acc = P._pfxAcc[best], seq = P._pfxSeq[best];
      var overhead = acc['-1'] ? medOf(acc['-1']) : 0;
      var rows = [], prev = overhead, total = 0;
      for (var j = 0; j < seq.length; j++) {
        var a = acc[String(j)];
        if (!a || !a.length) { prev = prev; continue; }
        var t = medOf(a), ms = t - prev;
        prev = t;
        total += ms;
        rows.push({ pass: seq[j] + ':' + (P.PASS_NAMES[seq[j]] || seq[j]), label: seq[j],
                    kind: seq[j].split('#')[0], msMedian: +ms.toFixed(4),
                    prefixMs: +t.toFixed(4), noiseMs: +iqrOf(a).toFixed(4), samples: a.length });
      }
      rows.forEach(function (r) { r.share = total ? +(r.msMedian / total * 100).toFixed(1) : 0; });
      var full = rows.length ? rows[rows.length - 1].prefixMs - overhead : 0;
      rows.sort(function (a, b) { return b.msMedian - a.msMedian; });
      return {
        available: true, method: 'EXT_disjoint_timer_query_webgl2, префиксы: один запрос на кадр от начала кадра до конца прохода k',
        note: 'Цена прохода — разность медиан соседних префиксов; надбавка за границу запроса сокращается в разности.',
        overheadMs: +overhead.toFixed(4),
        frameFromPrefixMs: +full.toFixed(4),
        variants: sigs.length, chosenSamples: bestN, lostQueries: P.segLost || 0,
        totalMsMedian: +total.toFixed(4), rows: rows
      };
    }
    var acc2 = P._segAcc || {};
    var labels = Object.keys(acc2);
    if (!labels.length) return { available: false, reason: 'профилировка проходов не включена' };
    var rows2 = labels.map(function (L) {
      var r = acc2[L];
      return { pass: L + ':' + (P.PASS_NAMES[L] || r.kind), label: L, kind: r.kind,
               msMedian: +medOf(r.ms).toFixed(4), drawsMedian: +medOf(r.draws).toFixed(1),
               trisMedian: Math.round(medOf(r.tris)), samples: r.ms.length };
    });
    var total2 = rows2.reduce(function (a, r) { return a + r.msMedian; }, 0);
    rows2.forEach(function (r) { r.share = total2 ? +(r.msMedian / total2 * 100).toFixed(1) : 0; });
    rows2.sort(function (a, b) { return b.msMedian - a.msMedian; });
    return {
      available: true,
      method: 'readPixels на границах проходов; таймер-запросов в этом браузере нет',
      syncOverheadMs: P.syncOverheadMs,
      note: 'Оценка распределения, не абсолютная цена: каждая граница стоит одной синхронизации, надбавка вычтена по калибровке.',
      profiledFrames: P.profFrames.length, totalMsMedian: +total2.toFixed(4), rows: rows2
    };
  };

  P.snapshot = function () {
    return {
      ctx: P.ctx, limits: P.limits || null, ext: P.ext, boot: P.boot,
      shaders: { compileMs: +P.shaders.compileMs.toFixed(2), linkMs: +P.shaders.linkMs.toFixed(2), programs: P.shaders.programs },
      mem: {
        texCount: P.mem.texCount,
        texMiBL0: +(P.mem.texBytesL0 / 1048576).toFixed(3),
        texMiBWithMips: +(P.mem.texBytesWithMips / 1048576).toFixed(3),
        bufferMiB: +(P.mem.bufferBytes / 1048576).toFixed(3),
        renderbufferMiB: +((P.mem.rbBytes || 0) / 1048576).toFixed(3),
        renderbuffers: (P.mem.renderbuffers || []).map(function (r) {
          return { size: r.w + 'x' + r.h + (r.samples ? '×' + r.samples : ''), fmt: r.fmt, kiB: Math.round(r.bytes / 1024) };
        }),
        biggest: P.mem.textures.slice().sort(function (a, b) { return b.bytes - a.bytes; }).slice(0, 12)
          .map(function (t) { return { size: t.w + 'x' + t.h + (t.layers > 1 ? 'x' + t.layers : ''), fmt: t.fmt || 'RGBA8', kiB: Math.round(t.bytes / 1024) }; })
      }
    };
  };
})();
