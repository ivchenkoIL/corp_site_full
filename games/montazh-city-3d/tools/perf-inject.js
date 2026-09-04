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
      var kind = all.indexOf('uBones') >= 0 ? 'main'
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

    /* Запасной способ разобрать кадр по проходам, когда
       EXT_disjoint_timer_query_webgl2 недоступен.

       ВАЖНО про выбор синхронизации. Проверено замером на этом же стеке:
       gl.finish() возвращается за 0 мс на отрисовке, которая реально занимает
       350 мс, и fenceSync + clientWaitSync(SYNC_FLUSH_COMMANDS_BIT) — тоже за
       0 мс. То есть в Chrome ни то ни другое не дожидается GPU, и мерить ими
       проход бессмысленно: получишь глубину очереди, а не работу. Реально
       дожидается только readPixels — те же 350 мс он и показывает. Поэтому
       границу прохода отбиваем чтением одного пикселя.

       Плата за это — постоянная надбавка на каждую синхронизацию (при
       antialias:true readPixels ещё и разрешает мультисэмпл). Надбавку
       калибруем в начале профилировки и вычитаем. Числа остаются оценочными:
       это распределение стоимости между проходами, а не абсолютная цена. Если
       таймер-запросы есть — верить надо им, а не этому. */
    P._segStart = 0;
    P._segKind = null;
    P.segments = [];
    P._segBuf = null;
    P.syncOverheadMs = 0;
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
    function closeSegment(nextKind) {
      var now;
      syncGPU();
      now = performance.now();
      if (P._segKind !== null && P._segBuf) {
        P._segBuf.push({ kind: P._segKind, ms: +Math.max(0, now - P._segStart - P.syncOverheadMs).toFixed(3),
                         raw: +(now - P._segStart).toFixed(3),
                         draws: P._segDraws, tris: Math.round(P._segTris) });
      }
      P._segKind = nextKind;
      P._segStart = now;
      P._segDraws = 0;
      P._segTris = 0;
    }
    P._closeSegment = closeSegment;
    P._openSegments = function () {
      if (!P.syncOverheadMs) P._calibrateSync(5);
      P._segBuf = [];
      P._segKind = null; P._segDraws = 0; P._segTris = 0;
      syncGPU();
      P._segStart = performance.now();
      P._segKind = 'clear';
    };
    P._finishSegments = function () {
      closeSegment(null);
      var b = P._segBuf; P._segBuf = null; P._segKind = null;
      return b || [];
    };

    /* --- счётчики кадра --- */
    var f = P.cur = newCounters();
    function newCounters() {
      return { draws: 0, tris: 0, verts: 0, byKind: { sky: 0, main: 0, glow: 0, other: 0 },
               trisByKind: { sky: 0, main: 0, glow: 0, other: 0 },
               progSwitch: 0, vaoBind: 0, texBind: 0, uniformCalls: 0 };
    }
    P._newCounters = newCounters;
    P._reset = function () { P.cur = f = newCounters(); };

    var _drawElements = gl.drawElements.bind(gl);
    gl.drawElements = function (mode, count) {
      f.draws++; f.byKind[curKind]++; f.verts += count;
      var t = count / 3; f.tris += t; f.trisByKind[curKind] += t;
      if (P._segBuf) { P._segDraws++; P._segTris += t; }
      return _drawElements.apply(null, arguments);
    };
    var _drawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = function (mode, first, count) {
      f.draws++; f.byKind[curKind]++; f.verts += count;
      var t = count / 3; f.tris += t; f.trisByKind[curKind] += t;
      if (P._segBuf) { P._segDraws++; P._segTris += t; }
      return _drawArrays.apply(null, arguments);
    };
    if (gl.drawElementsInstanced) {
      var _dei = gl.drawElementsInstanced.bind(gl);
      gl.drawElementsInstanced = function (mode, count, type, off, inst) {
        f.draws++; f.byKind[curKind]++; f.verts += count * inst;
        var t = count / 3 * inst; f.tris += t; f.trisByKind[curKind] += t;
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
      if (level === 0 && w && h) {
        var t = bound[target];
        var rec = { w: w, h: h, bytes: bytes, mips: false };
        texInfo.set(t || {}, rec);
        if (t) texInfo.set(t, rec);
        P.mem.textures.push(rec);
        P.mem.texCount++;
        P.mem.texBytesL0 += bytes;
        P.mem.texBytesWithMips += bytes;      /* мипы добавит generateMipmap */
      }
      return _texImage2D.apply(null, arguments);
    };
    var _generateMipmap = gl.generateMipmap.bind(gl);
    gl.generateMipmap = function (target) {
      var t = bound[target], rec = t && texInfo.get(t);
      if (rec && !rec.mips) { rec.mips = true; P.mem.texBytesWithMips += Math.round(rec.bytes / 3); }
      return _generateMipmap(target);
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

      /* запрос таймера GPU вокруг всей работы кадра */
      if (P.sampling && gl && TQ) {
        try {
          if (gl.getParameter(TQ.GPU_DISJOINT_EXT)) P.gpu.disjoint++;
          qLive = qPool.pop() || gl.createQuery();
          gl.beginQuery(TQ.TIME_ELAPSED_EXT, qLive);
        } catch (e) { qLive = null; }
      }

      /* кадр под профилировку проходов — каждый N-й, если включено */
      var prof = false;
      if (P.sampling && P.finishEvery > 0 && P._openSegments && (P._frameNo++ % P.finishEvery) === 0) {
        prof = true; P.finishActive = true; P._openSegments();
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
          P.frames.push({
            ts: +ts.toFixed(3),
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
    P.finishEvery = finishEvery | 0;
    P.sampling = true;
  };
  P.stop = function () { P.sampling = false; return P.frames.slice(); };

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
    return {
      frames: fr.length,
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
  P.passReport = function () {
    if (!P.profFrames.length) return { available: false, reason: 'профилировка проходов не включена' };
    var names = ['clear:очистка+служебное', 'sky:небо', 'main:статика района',
                 'glow:тени под объектами', 'main:персонажи и техника', 'glow:свечения и маркеры'];
    var acc = [];
    for (var i = 0; i < P.profFrames.length; i++) {
      var segs = P.profFrames[i];
      for (var j = 0; j < segs.length; j++) {
        if (!acc[j]) acc[j] = { name: names[j] || ('#' + j + ':' + segs[j].kind), kind: segs[j].kind, ms: [], draws: [], tris: [] };
        acc[j].ms.push(segs[j].ms); acc[j].draws.push(segs[j].draws); acc[j].tris.push(segs[j].tris);
      }
    }
    function med(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? +s[s.length >> 1].toFixed(3) : 0; }
    var rows = acc.map(function (r) {
      return { pass: r.name, kind: r.kind, msMedian: med(r.ms), drawsMedian: med(r.draws), trisMedian: med(r.tris) };
    });
    var total = rows.reduce(function (a, r) { return a + r.msMedian; }, 0);
    rows.forEach(function (r) { r.share = total ? +(r.msMedian / total * 100).toFixed(1) : 0; });
    rows.sort(function (a, b) { return b.msMedian - a.msMedian; });
    return {
      available: true,
      method: P.gpu.available
        ? 'readPixels на границах проходов (сверить с EXT_disjoint_timer_query_webgl2)'
        : 'readPixels на границах проходов; таймер-запросов в этом браузере нет',
      syncOverheadMs: P.syncOverheadMs,
      note: 'Оценка распределения, не абсолютная цена: каждая граница стоит одной синхронизации, надбавка вычтена по калибровке.',
      profiledFrames: P.profFrames.length, totalMsMedian: +total.toFixed(3), rows: rows
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
        biggest: P.mem.textures.slice().sort(function (a, b) { return b.bytes - a.bytes; }).slice(0, 12)
          .map(function (t) { return { size: t.w + 'x' + t.h, kiB: Math.round(t.bytes / 1024) }; })
      }
    };
  };
})();
