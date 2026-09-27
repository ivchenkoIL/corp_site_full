/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «7. Рендерер», строки 5346–6369.
   ===================================================================== */
import { Q, QCFG, __set_Q } from '../core/quality.js';
import { $, D2R, clamp, lerp, lin1, m4, m4id, m4invRT, m4look, m4mul, m4persp } from '../core/util.js';
import { toast } from '../game/effects.js';
import { resizeAll } from '../game/loop.js';
import { S } from '../game/state.js';
import { BLOOM, SHADOW, SSAO, SSR } from './frame.js';
import { FS_BLOOM, FS_CUBE, FS_DEPTH, FS_GLOW, FS_MAIN, FS_PREF, FS_SHADOW, FS_SKY, FS_SSAO, FS_SSAO_BLUR, FS_SSR, FS_TONE, GL, SkyJS, VS_DEPTH, VS_FACE, VS_FULL, VS_GLOW, VS_MAIN, VS_SKY, VS_TONE, bloomGLSL, program } from './gl.js';
import { Static } from './static.js';
import { TX, Tex, TexReg, rebuildTextures } from './textures.js';
import { saveOpts } from '../save/savegame.js';

/* --- HDR-буфер сцены --------------------------------------------------
   Сцена, небо и свечения складываются в линейном свете в буфере RGBA16F, и
   уже он один раз проходит тонмаппинг в холст. Отсюда же берётся масштаб
   рендера: раньше уменьшался сам холст, теперь — этот буфер, а холст
   остаётся в полной плотности, чтобы тонмаппинг писал в чёткие пиксели.

   Мультисэмплинг наш собственный (renderbufferStorageMultisample), потому
   что мультисэмплинг контекста разрешается в холст, а нам нужно разрешить в
   текстуру. На M4 RGBA16F поддерживает 2 и 4 сэмпла в обоих движках,
   MAX_SAMPLES = 4. Если RGBA16F окажется недоступен, откатываемся на RGBA8:
   тонмаппинг остаётся одним проходом, но яркое обрезается до единицы. */
export const HDR = {
  fb: null, color: null, depth: null,      /* мультисэмпловый буфер сцены */
  resolveFb: null, tex: null,              /* одно-сэмпловый, из него читает тонмаппинг */
  depthTex: null, preFb: null,             /* глубина текстурой — для затенения по глубине */
  depthMode: 'none',                       /* none | direct | blit | prepass */
  w: 0, h: 0, samples: 0, fmt: 0, fmtName: '', px: 4, type: 0, extFmt: 0, ok: false, bytes: 0
};

/* Нужна ли в этом кадре глубина текстурой. Пока её единственный потребитель —
   затенение в складках: на низком и среднем профиле его нет, и всей возни с
   глубиной тоже нет. */
export function needDepthTex() { return !!((Q.ssao && QCFG.ssao.on) || (Q.ssr && QCFG.ssr.on)); }

/* Сколько сэмплов реально дают для этого формата. */
export function pickSamples(gl, ifmt, want) {
  if (want <= 0) return 0;
  let list = null;
  try { list = gl.getInternalformatParameter(gl.RENDERBUFFER, ifmt, gl.SAMPLES); } catch (e) { }
  if (!list || !list.length) return 0;
  let best = 0;
  for (const v of list) if (v <= want && v > best) best = v;
  return best;
}

export function initHDR(gl) {
  /* Оба расширения, а не первое сработавшее: half_float делает пригодным для
     отрисовки только *16F, а R11F_G11F_B10F — уже color_buffer_float. С
     коротким замыканием на || второе не запрашивалось, вложение выходило
     «not renderable», и сцена молча не рисовалась. */
  const half = gl.getExtension('EXT_color_buffer_half_float');
  const full = gl.getExtension('EXT_color_buffer_float');
  const can = { RGBA16F: !!(half || full), R11F_G11F_B10F: !!full, RGBA8: true };
  const want = can[QCFG.post.hdr] ? QCFG.post.hdr : 'RGBA8';
  HDR.fmt = gl[want] !== undefined ? gl[want] : gl.RGBA8;
  HDR.fmtName = want;
  HDR.px = want === 'RGBA16F' ? 8 : 4;
  /* у R11F_G11F_B10F внешний формат RGB, а не RGBA: с RGBA texImage2D даёт
     INVALID_OPERATION, буфер выходит неполным и сцена молча не рисуется */
  HDR.type = want === 'RGBA16F' ? gl.HALF_FLOAT : want === 'R11F_G11F_B10F' ? gl.UNSIGNED_INT_10F_11F_11F_REV : gl.UNSIGNED_BYTE;
  HDR.extFmt = want === 'R11F_G11F_B10F' ? gl.RGB : gl.RGBA;
  HDR.fb = gl.createFramebuffer();
  HDR.resolveFb = gl.createFramebuffer();
  HDR.color = gl.createRenderbuffer();
  HDR.depth = gl.createRenderbuffer();
  HDR.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, HDR.tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  /* Глубина текстурой. Фильтрация NEAREST: затенение читает глубину
     texelFetch'ем, а сравнивающей выборки здесь нет — она у каскадов. */
  HDR.depthTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, HDR.depthTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  HDR.preFb = gl.createFramebuffer();
}

/* Перевыделение под новый размер буфера сцены. Зовётся из applyRenderSize,
   то есть при смене окна, плотности и шага авто-масштаба. */
export function resizeHDR(gl, w, h) {
  const want = Math.min(Q.msaa | 0, QCFG.post.msaaMax);
  const samples = pickSamples(gl, HDR.fmt, want);
  /* Режим глубины входит в условие: переключение профиля меняет его, не меняя
     размера буфера, и без этого вложения остались бы от прошлого профиля. */
  const mode = !needDepthTex() ? 'none' : (samples === 0 ? 'direct' : (QCFG.post.depthMS === 'prepass' ? 'prepass' : 'blit'));
  if (HDR.w === w && HDR.h === h && HDR.samples === samples && HDR.depthMode === mode) return;
  HDR.w = w; HDR.h = h; HDR.samples = samples;
  const px = HDR.px;

  /* Текстура, из которой читает тонмаппинг. texImage2D, а не texStorage2D:
     буфер перевыделяется на каждом шаге авто-масштаба, а неизменяемое
     хранилище пришлось бы каждый раз пересоздавать. */
  gl.bindTexture(gl.TEXTURE_2D, HDR.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, HDR.fmt, w, h, 0, HDR.extFmt, HDR.type, null);

  gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.fb);
  if (samples > 0) {
    /* мультисэмпловый цвет в renderbuffer, разрешается блитом в текстуру */
    gl.bindRenderbuffer(gl.RENDERBUFFER, HDR.color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, HDR.fmt, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, HDR.color);
  } else {
    /* без мультисэмплинга сцена пишет прямо в текстуру: разрешать нечего,
       и смен буфера в кадре остаётся две вместо трёх */
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, HDR.tex, 0);
  }
  /* Как затенение получит глубину. Развилка этапа 04, решённая замером:
       direct  — мультисэмплинга нет, глубина сразу текстура (даром);
       blit    — глубина разрешается блитом вместе с цветом, одним вызовом;
       prepass — отдельный проход глубины по всей видимой геометрии.
     Когда затенения нет (низкий и средний профиль), глубина остаётся
     renderbuffer'ом и не стоит ничего. */
  const wantDepth = needDepthTex();
  HDR.depthMode = !wantDepth ? 'none' : (samples === 0 ? 'direct' : (QCFG.post.depthMS === 'prepass' ? 'prepass' : 'blit'));

  if (wantDepth) {
    gl.bindTexture(gl.TEXTURE_2D, HDR.depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.fb);
  if (HDR.depthMode === 'direct') {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, HDR.depthTex, 0);
  } else {
    gl.bindRenderbuffer(gl.RENDERBUFFER, HDR.depth);
    if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    else gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, HDR.depth);
  }
  const st1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  let st2 = gl.FRAMEBUFFER_COMPLETE, st3 = gl.FRAMEBUFFER_COMPLETE;
  if (samples > 0) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.resolveFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, HDR.tex, 0);
    /* В режиме blit глубина висит на том же буфере разрешения: цвет и глубина
       уходят одним blitFramebuffer, а не двумя. */
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D,
                            HDR.depthMode === 'blit' ? HDR.depthTex : null, 0);
    st2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  }
  if (HDR.depthMode === 'prepass') {
    /* Проход глубины: цвета нет вовсе, только вложение глубины. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, HDR.preFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, HDR.depthTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    st3 = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (SSAO.fb) SSAO.resize(gl, w, h);
  if (SSR.fb) SSR.resize(gl, w, h);
  if (BLOOM.fb) BLOOM.resize(gl, w, h);
  HDR.ok = st1 === gl.FRAMEBUFFER_COMPLETE && st2 === gl.FRAMEBUFFER_COMPLETE && st3 === gl.FRAMEBUFFER_COMPLETE;
  HDR.bytes = w * h * (px + 4) * Math.max(1, samples) + (samples > 0 ? w * h * px : 0)
            + (wantDepth && HDR.depthMode !== 'direct' ? w * h * 4 : 0);
  if (!HDR.ok) console.warn('HDR-буфер неполон: 0x' + st1.toString(16) + ' / 0x' + st2.toString(16) + ' / 0x' + st3.toString(16));
}

export const Env = {
  sun: [0.4, 0.6, 0.5], moon: [0, 1, 0], alt: 0,
  sunIrr: [0, 0, 0], sunTint: [0, 0, 0],   /* освещённость и цвет диска — из прозрачности атмосферы */
  fog: [.55, .42, .5], fogDens: 0.0075, night: 0,
  exposure: 2.0, cloud: 0.34, glossMul: 1,
  windX: 1, windZ: 0.3, windAmp: 0.12,
  _t: [0, 0, 0],
  update(hour) {
    const K = QCFG.sky;
    /* Высота солнца честно уходит в минус: раньше она зажималась снизу
       (Math.max(0.03, …)), солнце никогда не заходило, а «ночь» набиралась
       отдельными рампами по часам (18.4 + 2.2 и 6.6 − 1.6). Теперь и высота,
       и ночь — из одного положения светила. */
    const noon = (K.sunrise + K.sunset) / 2, halfDay = (K.sunset - K.sunrise) / 2;
    const alt = Math.asin(Math.cos((hour - noon) / halfDay * (Math.PI / 2)) * Math.sin(K.maxAlt * D2R));
    this.alt = alt;
    const az = (K.azStart + (K.azEnd - K.azStart) * (hour - K.sunrise) / (K.sunset - K.sunrise)) * D2R;
    const ca = Math.cos(alt);
    this.sun[0] = Math.cos(az) * ca; this.sun[1] = Math.sin(alt); this.sun[2] = Math.sin(az) * ca;
    /* Луна: то же небо, но отстаёт на полсуток — чтобы ночью было что
       отражать в стёклах и куда смотреть. */
    const mh = hour + K.moonLag;
    const malt = Math.asin(Math.cos((mh - noon) / halfDay * (Math.PI / 2)) * Math.sin(K.maxAlt * D2R));
    const maz = (K.azStart + (K.azEnd - K.azStart) * (mh - K.sunrise) / (K.sunset - K.sunrise)) * D2R;
    const mca = Math.cos(malt);
    this.moon[0] = Math.cos(maz) * mca; this.moon[1] = Math.sin(malt); this.moon[2] = Math.sin(maz) * mca;

    const aDeg = alt / D2R;
    this.night = 1 - clamp((aDeg - K.nightAlt[1]) / (K.nightAlt[0] - K.nightAlt[1]), 0, 1);
    const n = this.night;
    /* «Закатность» — для тумана и облачности; сам цвет заката берётся из
       модели рассеяния, а не из палитры. */
    const low = clamp(1 - Math.sin(Math.max(alt, 0)) * 2.1, 0, 1);

    /* Прямой свет: прозрачность атмосферы вдоль луча на солнце. Отсюда и
       красное низкое солнце, и то, что ниже горизонта оно гаснет само —
       палитра солнца день/закат/ночь больше не нужна.
       Множитель sunK — переводной коэффициент между условными единицами
       модели рассеяния и освещённостью сцены; калиброван по контрольным
       сценам, а не выведен из физики: у диска и у неба в этой модели разные
       единицы, и связать их честно можно только телесным углом солнца. */
    const T = SkyJS.transmittance(this._t, this.sun);
    const kI = QCFG.light.sunK;
    for (let i = 0; i < 3; i++) this.sunIrr[i] = T[i] * kI;
    /* тот же цвет, нормированный, — для диска и подсветки облаков */
    const mx = Math.max(T[0], T[1], T[2], 1e-4);
    for (let i = 0; i < 3; i++) this.sunTint[i] = T[i] / mx;

    this.fogDens = lerp(K.fogDens[0], K.fogDens[1], n) + low * K.fogSunset;
    /* Экспозиция — ключевые точки день/закат/ночь, без автоэкспозиции:
       глаз к смене освещения привыкает, а автоэкспозиция «дышала» бы на
       каждом повороте камеры. */
    const E = QCFG.post.exposure;
    this.exposure = lerp(lerp(E.day, E.sunset, low), E.night, n);
    this.cloud = K.cloud.cover[0] + low * K.cloud.cover[1];
    const wd = 0.7 + Math.sin(hour * 0.31) * 0.9;
    this.windX = Math.cos(wd); this.windZ = Math.sin(wd);
    this.windAmp = 0.09 + this.cloud * 0.13;
    this.glossMul = lerp(1, QCFG.light.glossNight, n);
  }
};

/* --- Окружение из неба ------------------------------------------------
   Кубмапа неба (RGBA16F с мипами) обновляется по грани за кадр и только
   когда солнце сдвинулось заметно. Из неё в кадре берутся: фон, цвет тумана
   по направлению взгляда, зеркальные отражения (через префильтр) и
   рассеянный свет (через сферические гармоники, посчитанные на CPU по той же
   формуле — обратно кубмапу никто не читает).

   Базис граней в порядке TEXTURE_CUBE_MAP_POSITIVE_X..NEGATIVE_Z. Для куба
   ось V направлена вниз, поэтому у всех граней, кроме ±Y, uFaceV = (0,−1,0). */
export const CUBE_FACES = [
  { o: [ 1, 0, 0], u: [0, 0, -1], v: [0, -1,  0] },
  { o: [-1, 0, 0], u: [0, 0,  1], v: [0, -1,  0] },
  { o: [0,  1, 0], u: [1, 0,  0], v: [0,  0,  1] },
  { o: [0, -1, 0], u: [1, 0,  0], v: [0,  0, -1] },
  { o: [0, 0,  1], u: [1, 0,  0], v: [0, -1,  0] },
  { o: [0, 0, -1], u: [-1, 0, 0], v: [0, -1,  0] }
];

export const EnvMap = {
  cube: null, pref: null, fb: null, size: 0, prefSize: 0, levels: 0,
  job: 0, jobs: 0, dirty: true, ready: false,
  lastSun: [0, 0, 0], bytes: 0, shMs: 0,
  sh: new Float32Array(27),          /* девять коэффициентов по три канала */
  _dir: [0, 0, 0], _col: [0, 0, 0],

  _makeCube(gl, size, levels) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
    gl.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, gl.RGBA16F, size, size);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  },

  init(gl) {
    const E = QCFG.env;
    this.size = E.cube; this.prefSize = E.pref; this.levels = E.prefLevels;
    const cubeLevels = Math.floor(Math.log2(this.size)) + 1;
    this.cube = this._makeCube(gl, this.size, cubeLevels);
    this.pref = this._makeCube(gl, this.prefSize, this.levels);
    this.fb = gl.createFramebuffer();
    /* заданий на пересборку: шесть граней неба плюс грань×уровень префильтра */
    this.jobs = 6 + 6 * this.levels;
    let b = 0;
    for (let l = 0; l < cubeLevels; l++) { const sz = Math.max(1, this.size >> l); b += sz * sz * 6 * 8; }
    for (let l = 0; l < this.levels; l++) { const sz = Math.max(1, this.prefSize >> l); b += sz * sz * 6 * 8; }
    this.bytes = b;
    this.dirty = true; this.job = 0;
  },

  /* солнце сдвинулось настолько, что окружение пора пересобрать? */
  check() {
    const s = Env.sun, l = this.lastSun;
    const cos = s[0] * l[0] + s[1] * l[1] + s[2] * l[2];
    if (cos < Math.cos(QCFG.env.sunStepDeg * D2R)) this.dirty = true;
    if (this.dirty && this.job === 0) { l[0] = s[0]; l[1] = s[1]; l[2] = s[2]; }
  },

  /* Одно задание за кадр: сначала шесть граней неба, потом мипы и
     сферические гармоники, потом грани префильтра по уровням. При загрузке
     всё прогоняется разом — иначе первый кадр смены будет без окружения. */
  update(gl, all) {
    if (!this.dirty) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(R3.skyVAO);
    const n = all ? this.jobs : 1;
    for (let k = 0; k < n; k++) {
      if (this.job < 6) this._skyFace(gl, this.job);
      else this._prefFace(gl, this.job - 6);
      this.job++;
      if (this.job === 6) {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        const t0 = performance.now();
        this.computeSH();
        this.shMs = performance.now() - t0;
        this.ready = true;                 /* небо готово, отражения догоняются */
      }
      if (this.job >= this.jobs) { this.job = 0; this.dirty = false; break; }
    }
    gl.enable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  _skyFace(gl, i) {
    const P = R3.cube, f = CUBE_FACES[i];
    gl.useProgram(P.p);
    gl.viewport(0, 0, this.size, this.size);
    gl.uniform3fv(P.u.uSunDir, Env.sun);
    gl.uniform1f(P.u.uNight, Env.night);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, this.cube, 0);
    gl.uniform3fv(P.u.uFaceO, f.o); gl.uniform3fv(P.u.uFaceU, f.u); gl.uniform3fv(P.u.uFaceV, f.v);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  _prefFace(gl, i) {
    const P = R3.pref, lvl = (i / 6) | 0, face = i % 6, f = CUBE_FACES[face];
    const sz = Math.max(1, this.prefSize >> lvl);
    gl.useProgram(P.p);
    gl.viewport(0, 0, sz, sz);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cube);
    gl.uniform1i(P.u.uSrc, 0);
    gl.uniform1f(P.u.uSrcSize, this.size);
    gl.uniform1f(P.u.uRough, this.levels > 1 ? lvl / (this.levels - 1) : 0);
    gl.uniform1i(P.u.uSamples, QCFG.env.prefSamples[Math.min(lvl, QCFG.env.prefSamples.length - 1)]);
    gl.uniform3fv(P.u.uFaceO, f.o); gl.uniform3fv(P.u.uFaceU, f.u); gl.uniform3fv(P.u.uFaceV, f.v);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, this.pref, lvl);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  /* Сферические гармоники L2 по той же аналитической функции неба. Считаются
     на CPU по сетке направлений: читать обратно кубмапу нельзя — откат на
     тайловом GPU дороже всего расчёта. Формула Рамамурти–Ханрахана даёт
     сразу освещённость, свёрнутую с косинусом. */
  computeSH() {
    const G = QCFG.env.shGrid, sh = this.sh, d = this._dir, c = this._col;
    sh.fill(0);
    let wsum = 0;
    for (let f = 0; f < 6; f++) {
      const F = CUBE_FACES[f];
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const u = (x + 0.5) / G * 2 - 1, v = (y + 0.5) / G * 2 - 1;
        d[0] = F.o[0] + F.u[0] * u + F.v[0] * v;
        d[1] = F.o[1] + F.u[1] * u + F.v[1] * v;
        d[2] = F.o[2] + F.u[2] * u + F.v[2] * v;
        const l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], il = 1 / Math.sqrt(l2);
        d[0] *= il; d[1] *= il; d[2] *= il;
        /* телесный угол текселя куба: 1/(l²·√l²) с точностью до общего множителя */
        const w = 1 / (l2 * Math.sqrt(l2));
        wsum += w;
        SkyJS.color(c, d, Env.sun, Env.night);
        const X = d[0], Y = d[1], Z = d[2];
        const B = [0.282095, 0.488603 * Y, 0.488603 * Z, 0.488603 * X,
                   1.092548 * X * Y, 1.092548 * Y * Z, 0.315392 * (3 * Z * Z - 1),
                   1.092548 * X * Z, 0.546274 * (X * X - Y * Y)];
        for (let k = 0; k < 9; k++) {
          const bw = B[k] * w;
          sh[k * 3] += c[0] * bw; sh[k * 3 + 1] += c[1] * bw; sh[k * 3 + 2] += c[2] * bw;
        }
      }
    }
    const norm = 4 * Math.PI / wsum;
    for (let i = 0; i < 27; i++) sh[i] *= norm;
  }
};

export function initRenderer(canvas) {
  /* Мультисэмплинг контекста больше не нужен: сцена идёт в свой HDR-буфер со
     своим мультисэмплингом, а в холст пишет тонмаппинг — сглаживать там
     нечего. Заодно профиль качества перестал требовать перезапуска. */
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('Нужен WebGL2. Обнови браузер или включи аппаратное ускорение в настройках Chrome.');
  GL.gl = gl; GL.canvas = canvas;
  GL.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (GL.aniso) GL.maxAniso = gl.getParameter(GL.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    GL.renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch (e) { GL.renderer = ''; }
  Perf.init(gl);
  /* Два варианта главной программы. Обе компилируются здесь: переключение в
     кадре должно быть выбором указателя, а не компиляцией на ходу. */
  /* Каскады компилируются по максимуму профилей, а сколько их на самом деле —
     говорит uCsmN: цикл выходит раньше. Пересобирать программу при смене
     профиля незачем, а мёртвых выборок это не создаёт. */
  const CSM = Math.max(0, ...Object.values(QCFG.profiles).map(p => p.csm | 0));
  R3.csmMax = CSM;
  R3.mainDay = program(gl, VS_MAIN, FS_MAIN(0, CSM), 'main-day');
  R3.mainNight = program(gl, VS_MAIN, FS_MAIN(QCFG.shader.maxLamps, CSM), 'main-night');
  R3.main = R3.mainDay;
  R3.sky = program(gl, VS_SKY, FS_SKY, 'sky');
  R3.glow = program(gl, VS_GLOW, FS_GLOW, 'glow');
  /* Тонмаппинг собирается в четырёх сборках: со сглаживанием и без, со
     свечением и без. Все четыре — крошечные, а выбирать ветку юниформом
     значило бы платить шесть выборок из мип-цепочки там, где свечения нет. */
  const BL = bloomGLSL();
  R3.tonePlain = program(gl, VS_TONE, FS_TONE(false, ''), 'tone');
  R3.toneFxaa = program(gl, VS_TONE, FS_TONE(true, ''), 'tone-fxaa');
  R3.tonePlainB = program(gl, VS_TONE, FS_TONE(false, BL), 'tone-bloom');
  R3.toneFxaaB = program(gl, VS_TONE, FS_TONE(true, BL), 'tone-fxaa-bloom');
  R3.bloom = program(gl, VS_FULL, FS_BLOOM, 'bloom');
  R3.tone = R3.tonePlain;
  R3.cube = program(gl, VS_FACE, FS_CUBE, 'cube');
  R3.pref = program(gl, VS_FACE, FS_PREF, 'pref');
  R3.depth = program(gl, VS_DEPTH, FS_DEPTH, 'depth');
  R3.shadow = program(gl, VS_DEPTH, FS_SHADOW, 'shadow');
  R3.ssao = program(gl, VS_FULL, FS_SSAO(QCFG.ssao.samples), 'ssao');
  R3.ssaoBlur = program(gl, VS_FULL, FS_SSAO_BLUR(false), 'ssao-blur');
  R3.ssaoBlurSep = program(gl, VS_FULL, FS_SSAO_BLUR(true), 'ssao-blur-sep');
  R3.ssr = program(gl, VS_FULL, FS_SSR(QCFG.ssr.steps, QCFG.ssr.refine), 'ssr');
  BLOOM.init(gl);
  SSR.init(gl);
  initHDR(gl);
  SHADOW.init(gl);
  SHADOW.resize(gl);
  SSAO.init(gl);
  EnvMap.init(gl);
  /* полноэкранный треугольник для неба */
  R3.skyVAO = gl.createVertexArray();
  gl.bindVertexArray(R3.skyVAO);
  const sb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  /* квад для свечения */
  R3.glowVAO = gl.createVertexArray();
  gl.bindVertexArray(R3.glowVAO);
  const gb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.05, 0.03, 0.12, 1);
  return gl;
}

export function resizeGL() {
  const r = $('stage').getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  GL.dpr = Math.min(Q.dprMax, dpr);
  GL.uiDpr = Math.min(QCFG.uiDprMax, dpr);
  GL.w = Math.max(320, Math.floor(r.width)); GL.h = Math.max(240, Math.floor(r.height));
  GL.canvas.style.width = GL.w + 'px'; GL.canvas.style.height = GL.h + 'px';
  applyRenderSize();
}
/* Масштаб рендера. Холст держим в полной плотности — в него пишет проход
   тонмаппинга, и растягивать его нечем; масштабируется буфер сцены (HDR), а
   тонмаппинг растягивает его до холста одной выборкой с линейной
   фильтрацией. Слой интерфейса (#hud2d, DOM, мини-игры) живёт в своей
   плотности (GL.uiDpr) и от масштаба не зависит. */
export function applyRenderSize() {
  const cw = Math.max(320, Math.round(GL.w * GL.dpr / 2) * 2), ch = Math.max(240, Math.round(GL.h * GL.dpr / 2) * 2);
  if (GL.canvas.width !== cw || GL.canvas.height !== ch) { GL.canvas.width = cw; GL.canvas.height = ch; }
  const rw = Math.max(320, Math.round(cw * GL.scale / 2) * 2), rh = Math.max(240, Math.round(ch * GL.scale / 2) * 2);
  if (GL.gl) resizeHDR(GL.gl, rw, rh);
}

/* --- Монитор, GPU и авто-масштаб -------------------------------------
   Perf измеряет три вещи и на их основе крутит GL.scale:
     · частоту монитора — по интервалам requestAnimationFrame (медиана,
       прижатая к известным частотам); бюджет кадра считается от неё;
     · время кадра на GPU — EXT_disjoint_timer_query_webgl2, где оно есть
       (Chrome). Результат приходит через кадр-два, читается без ожидания;
     · пропуски кадров — по интервалам rAF; там, где таймер-запросов нет
       (Safari), это единственный сигнал.
   Контроллер: несколько кадров подряд сверх бюджета — шаг вниз (крупнее при
   большом перерасходе), устойчивый запас — шаг вверх; между шагами пауза,
   а после «вверх и сразу вниз» планка запоминается на несколько секунд,
   чтобы масштаб не пилил туда-сюда. Все числа — в QCFG.dynamic. */
export const Perf = {
  hz: 60, interval: 1000 / 60, hzKnown: false, _hzBuf: [], _hzAt: 0,
  tq: null, _q: null, _pool: [], _pending: [], gpuMs: null, gpuAvg: 0, _gpuFresh: false, disjoint: 0,
  _lastTs: 0, dtRaw: 0, over: 0, underT: 0, lastChange: 0, lastUp: -1e9, ceil: 1, ceilUntil: 0,
  drops: 0, dropRate: 0, steps: 0, wasOver: false, wasUnder: false, _roEl: null, _roAt: 0,
  init(gl) { this.tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); },
  budgetMs() { return this.interval * QCFG.dynamic.budgetFrac; },
  /* из frame(ts), до обновления lastTs: интервал кадра и частота монитора */
  frameTs(ts) {
    const d = this._lastTs ? ts - this._lastTs : 0;
    this._lastTs = ts; this.dtRaw = d;
    if (d <= 0 || d > 100) return;
    const D = QCFG.display;
    if (this.hzKnown && ts - this._hzAt < D.remeasureSec * 1000) return;
    this._hzBuf.push(d);
    if (this._hzBuf.length < D.samples) return;
    const srt = this._hzBuf.slice().sort((a, b) => a - b);
    const med = srt[srt.length >> 1];
    let hz = 1000 / med, best = 60, bd = 1e9;
    for (const k of D.known) { const e = Math.abs(k - hz) / k; if (e < bd) { bd = e; best = k; } }
    hz = bd < 0.08 ? best : Math.round(hz);
    this.hz = clamp(hz, 24, 360); this.interval = 1000 / this.hz;
    this.hzKnown = true; this._hzAt = ts; this._hzBuf.length = 0;
  },
  beginFrame(gl) {
    this._q = null;
    if (!this.tq || !S.dynamic) return;
    try {
      if (gl.getParameter(this.tq.GPU_DISJOINT_EXT)) { this.disjoint++; for (const q of this._pending) this._pool.push(q); this._pending.length = 0; }
      /* оснастка замера может держать свой запрос — второй одновременно нельзя */
      if (gl.getQuery(this.tq.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      const q = this._pool.pop() || gl.createQuery();
      gl.beginQuery(this.tq.TIME_ELAPSED_EXT, q);
      this._q = q;
    } catch (e) { this._q = null; }
  },
  endFrame(gl) {
    if (this._q) { try { gl.endQuery(this.tq.TIME_ELAPSED_EXT); this._pending.push(this._q); } catch (e) { } this._q = null; }
    if (!this.tq) return;
    for (let i = 0; i < this._pending.length; i++) {
      const q = this._pending[i];
      let ok = false;
      try { ok = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); } catch (e) { ok = true; }
      if (!ok) break;                                    /* результаты приходят по порядку */
      let ns = 0; try { ns = gl.getQueryParameter(q, gl.QUERY_RESULT); } catch (e) { }
      this._pending.splice(i--, 1); this._pool.push(q);
      if (ns > 0) {
        this.gpuMs = ns / 1e6; this._gpuFresh = true;
        this.gpuAvg = this.gpuAvg ? this.gpuAvg * 0.9 + this.gpuMs * 0.1 : this.gpuMs;
      }
    }
  },
  /* контроллер масштаба; ts — метка кадра из requestAnimationFrame */
  tick(ts) {
    if (!S.dynamic || S.screen === 'boot') return;
    const D = QCFG.dynamic, budget = this.budgetMs(), d = this.dtRaw;
    if (d <= 0 || d > 250) return;                       /* пауза, свёрнутая вкладка, рывок */
    const dropped = d > this.interval * D.dropRatio;
    /* доля пропущенных кадров за последние ~60: один рывок сборщика мусора
       не должен обнулять накопленный запас */
    this.dropRate += ((dropped ? 1 : 0) - this.dropRate) / 60;
    if (dropped) this.drops++;
    let over = false, under = false, verdict = false;
    if (this.tq) {
      /* есть таймер: верим ему; интервалы rAF — только когда GPU и так занят
         хотя бы наполовину, иначе это планировщик браузера, а не наша нагрузка */
      if (this._gpuFresh) { this._gpuFresh = false; verdict = true; over = this.gpuMs > budget; under = this.gpuMs < budget * D.headroom; }
      if (dropped && this.gpuAvg > budget * 0.5) { verdict = true; over = true; under = false; }
    } else { verdict = true; over = dropped; under = !dropped && this.dropRate < D.dropTolerance; }
    /* результат запроса приходит не каждый кадр: без нового вердикта
       продолжаем прежний, иначе счётчики сбрасываются впустую */
    if (verdict) { this.wasOver = over; this.wasUnder = under; } else { over = this.wasOver; under = this.wasUnder; }
    if (over) { this.over++; this.underT = 0; }
    else { this.over = 0; if (under) this.underT += d / 1000; }
    const can = ts - this.lastChange > D.cooldownMs;
    if (this.over >= D.downFrames && can) {
      const k = this.tq && this.gpuMs ? clamp(this.gpuMs / budget, 1, 3) : 1.5;
      if (ts - this.lastUp < 4000) { this.ceil = GL.scale - 1e-4; this.ceilUntil = ts + D.ceilHoldSec * 1000; }
      this.setScale(GL.scale - D.step * k); this.over = 0; this.lastChange = ts;
    } else if (this.underT >= (this.tq ? D.upSeconds : D.upSecondsNoTimer) && can) {
      const cap = ts < this.ceilUntil ? this.ceil : Q.scale;
      if (GL.scale < cap - 1e-4) { this.setScale(Math.min(cap, GL.scale + D.step)); this.lastChange = ts; this.lastUp = ts; }
      this.underT = 0;
    }
  },
  setScale(sc) {
    const q = QCFG.dynamic.quantum;
    sc = clamp(Math.round(sc / q) * q, Q.scaleMin, Q.scale);
    if (Math.abs(sc - GL.scale) < 1e-4) return;
    GL.scale = sc; this.steps++; applyRenderSize();
  },
  reset() { this.over = 0; this.underT = 0; this.ceil = 1; this.ceilUntil = 0; this.lastUp = -1e9; this.wasOver = false; this.wasUnder = false; },
  /* строка состояния в настройках, раз в полсекунды */
  readout(now) {
    if (now - this._roAt < 500) return;
    this._roAt = now;
    const el = $('qualInfo');
    if (!el) return;
    el.textContent = 'Рендер ' + HDR.w + '×' + HDR.h + ' ' + HDR.fmtName + (HDR.samples ? '×' + HDR.samples : '') +
      ' · холст ' + GL.canvas.width + '×' + GL.canvas.height + ' · масштаб ' + GL.scale.toFixed(2) +
      ' · монитор ' + this.hz + ' Гц · бюджет ' + this.budgetMs().toFixed(1) + ' мс · GPU ' +
      (this.tq ? (this.gpuAvg ? this.gpuAvg.toFixed(1) + ' мс' : '…') : 'нет таймера') +
      ' · кадр ' + (this.dtRaw ? this.dtRaw.toFixed(1) : '—') + ' мс · шагов ' + this.steps;
  }
};

/* Профиль качества. live — применить к работающей игре: размер буфера,
   анизотропия, при смене texSS — перегенерация текстур с полосой прогресса. */
export const BootQ = { msaa: null, veg: null };
export function applyProfile(name, live) {
  if (!QCFG.profiles[name]) name = 'medium';
  const prev = Q;
  S.quality = name; __set_Q(QCFG.profiles[name]);
  GL.scale = Q.scale;
  Perf.reset();
  const sc = $('scan'); if (sc) sc.style.display = Q.scan ? 'block' : 'none';
  if (!live) { BootQ.msaa = Q.msaa; BootQ.veg = Q.veg; return; }
  resizeAll();
  SHADOW.resize(GL.gl);              /* число каскадов и их размер — из профиля */
  /* Свечение и отражения включаются профилем, а не размером буфера: resizeHDR
     до них не всегда доходит (он выходит рано, когда размер тот же). */
  BLOOM.resize(GL.gl, HDR.w, HDR.h);
  SSR.resize(GL.gl, HDR.w, HDR.h);
  if (prev.aniso !== Q.aniso) TexReg.setAniso(GL.gl, Q.aniso);
  if (prev.texSS !== Q.texSS) rebuildTextures();
  /* Мультисэмплинг теперь наш собственный (HDR-буфер) и применяется сразу;
     перезапуска требует только плотность зелени — VEG зашит в геометрию. */
  if (Q.veg.grass !== BootQ.veg.grass || Q.veg.cards !== BootQ.veg.cards)
    toast('Плотность зелени применится после перезапуска', 'info', 3200);
}
export function setQuality(name) { applyProfile(name, true); saveOpts(); }

export function setCamera(eye, target) {
  const gl = GL.gl;
  m4persp(R3.proj, 62 * D2R, HDR.w / HDR.h, 0.12, 460);
  m4look(R3.view, eye[0], eye[1], eye[2], target[0], target[1], target[2], 0, 1, 0);
  R3.eye = eye;
  R3.right = [R3.view[0], R3.view[4], R3.view[8]];
  R3.up = [R3.view[1], R3.view[5], R3.view[9]];
  R3.fwd = [-R3.view[2], -R3.view[6], -R3.view[10]];
  /* обратная матрица вида-проекции для неба */
  m4invRT(R3.tmp, R3.view);
  const p = R3.proj, inv = R3.tmp2;
  inv.fill(0);
  inv[0] = 1 / p[0]; inv[5] = 1 / p[5]; inv[11] = 1 / p[14]; inv[14] = -1; inv[15] = p[10] / p[14];
  m4mul(R3.invVP, R3.tmp, inv);
  /* пирамида видимости для отсева статики по клеткам */
  m4mul(R3.viewProj, R3.proj, R3.view);
  if (Cull.n) { Cull.setPlanes(R3.viewProj); Cull.markCamera(0); }
}

/* --- Отсев статики по клеткам ----------------------------------------
   Район — один меш на материал, и до этого этапа он рисовался целиком каждый
   кадр: 36 вызовов, около 99 тысяч треугольников, 43–54 % кадра. Проход теней
   умножил бы это на число каскадов.

   Индексы каждого батча разложены по клеткам сетки 16 м (Mesh.cellify), так
   что клетка — это непрерывный диапазон в буфере индексов. В кадре остаётся
   отметить видимые клетки и слить соседние диапазоны в один вызов; при
   наличии WEBGL_multi_draw все диапазоны батча уходят одним вызовом.

   Коробки клеток объединены по всем батчам: проверка пирамидой считается один
   раз на клетку, а не на каждый батч. Отсев от этого чуть мягче — зато 130
   проверок в кадре вместо четырёх с половиной тысяч. */
export const Cull = {
  n: 0, nx: 0, nz: 0, cell: 16,
  box: null,                         /* объединённая коробка клетки, 6 чисел */
  vis: null, visSh: null,            /* видимость камерой и светом каскада */
  planes: new Float32Array(24),
  ext: null, cnt: null, off: null,
  on: true,
  stats: { calls: 0, tris: 0, cells: 0, vis: 0, sCalls: 0, sTris: 0, full: 0 },
  st: 0,                             /* 1 — считаем в статический счётчик */
  gate: 1,                           /* 0 — проход служебный, в статистику не идёт */

  init(gl) {
    this.ext = gl.getExtension('WEBGL_multi_draw');
    const c0 = Static.batches.find(b => b.gpu.cells);
    if (!c0) { this.n = 0; return; }
    const C = c0.gpu.cells;
    this.n = C.n; this.nx = C.nx; this.nz = C.nz; this.cell = C.cell;
    this.vis = new Uint8Array(C.n); this.visSh = new Uint8Array(C.n);
    this.box = new Float32Array(C.n * 6);
    for (let i = 0; i < C.n; i++) {
      this.box[i*6] = this.box[i*6+1] = this.box[i*6+2] = 1e30;
      this.box[i*6+3] = this.box[i*6+4] = this.box[i*6+5] = -1e30;
    }
    for (const b of Static.batches) {
      const cc = b.gpu.cells; if (!cc) continue;
      for (let i = 0; i < C.n; i++) {
        if (!cc.count[i]) continue;
        for (let k = 0; k < 3; k++) {
          if (cc.box[i*6+k]   < this.box[i*6+k])   this.box[i*6+k]   = cc.box[i*6+k];
          if (cc.box[i*6+3+k] > this.box[i*6+3+k]) this.box[i*6+3+k] = cc.box[i*6+3+k];
        }
      }
    }
    let m = 0;
    for (const b of Static.batches) if (b.gpu.cells) m = Math.max(m, b.gpu.cells.n);
    this.cnt = new Int32Array(m + 1); this.off = new Int32Array(m + 1);
  },

  /* Шесть плоскостей пирамиды из матрицы вида-проекции (Гриббс–Хартманн).
     Матрица column-major, поэтому строка i — это m[i], m[4+i], m[8+i], m[12+i]. */
  setPlanes(m) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const r = i >> 1, s = (i & 1) ? -1 : 1;
      const a = m[3] + s * m[r], b = m[7] + s * m[4 + r], c = m[11] + s * m[8 + r], d = m[15] + s * m[12 + r];
      const l = Math.hypot(a, b, c) || 1;
      p[i*4] = a / l; p[i*4+1] = b / l; p[i*4+2] = c / l; p[i*4+3] = d / l;
    }
  },

  /* Отметить клетки, попавшие в пирамиду. Проверка по «положительной вершине»:
     коробка снаружи, если её самый дальний по плоскости угол всё равно за ней. */
  markCamera(maxDist) {
    const p = this.planes, box = this.box, out = this.vis;
    const ex = R3.eye[0], ez = R3.eye[2], md2 = maxDist ? maxDist * maxDist : 0;
    let vis = 0;
    for (let i = 0; i < this.n; i++) {
      const b = i * 6;
      if (box[b] > 1e29) { out[i] = 0; continue; }
      let inside = 1;
      for (let k = 0; k < 6 && inside; k++) {
        const a = p[k*4], bb = p[k*4+1], c = p[k*4+2], d = p[k*4+3];
        const px = a >= 0 ? box[b+3] : box[b], py = bb >= 0 ? box[b+4] : box[b+1], pz = c >= 0 ? box[b+5] : box[b+2];
        if (a * px + bb * py + c * pz + d < 0) inside = 0;
      }
      if (inside && md2) {
        /* расстояние до ближайшей точки коробки по XZ — для дальности теней */
        const dx = ex < box[b] ? box[b] - ex : (ex > box[b+3] ? ex - box[b+3] : 0);
        const dz = ez < box[b+2] ? box[b+2] - ez : (ez > box[b+5] ? ez - box[b+5] : 0);
        if (dx * dx + dz * dz > md2) inside = 0;
      }
      out[i] = inside; vis += inside;
    }
    this.stats.cells = this.n; this.stats.vis = vis;
  },

  /* Клетки, которые могут бросить тень в каскад i.

     Приёмники этого каскада лежат в ЕГО ШАРЕ: шар строился вокруг среза
     пирамиды, значит всё видимое на этой дистанции внутри него. Тень идёт
     строго вдоль луча, поэтому клетка нужна каскаду ровно тогда, когда её
     теневая шахта пересекает шар.

     Поперёк луча — как раньше: коробка против квадрата каскада.
     Вдоль луча раньше не проверялось вовсе: считалось, что стоящее между
     солнцем и каскадом бросает тень, как бы далеко оно ни было. Формально
     верно, но безмерно дорого: при солнце в 14° луч почти горизонтален, и
     ближний каскад радиусом 16 м отмечал 45 клеток из 130 — шахту через
     весь район. Длина тени конечна: точка на высоте y роняет тень на
     y/sin(высота солнца) вдоль луча, и высота КАЖДОЙ клетки уже есть в её
     коробке. Клетка из двухметровых оград роняет тень на восемь метров, а
     не на сто двадцать пять, и в дальний каскад не попадает.

     Отбраковка перекрытия («клетка целиком уместилась в предыдущий каскад»)
     здесь неприменима и снята: она верна только при выборе каскада по
     попаданию в квадрат, а каскад теперь выбирается по расстоянию, и шахта
     ближней клетки спокойно дотягивается до кольца дальнего каскада.
     Замер того, что она давала, — в docs/RENDER-CHANGELOG.md, этап 05.

     Возвращает, сколько клеток снято проверкой вдоль луча. */
  markShadow(LR, LU, L, cas, ci, pad, on, invSin, maxDrop) {
    const box = this.box, out = this.visSh, c = cas[ci], R = c.r + pad;
    let skipped = 0;
    for (let i = 0; i < this.n; i++) {
      const b = i * 6;
      if (box[b] > 1e29) { out[i] = 0; continue; }
      let lo0 = 1e30, hi0 = -1e30, lo1 = 1e30, hi1 = -1e30, lo2 = 1e30, hi2 = -1e30;
      for (let k = 0; k < 8; k++) {
        const x = box[b + (k & 1 ? 3 : 0)], y = box[b + 1 + (k & 2 ? 3 : 0)], z = box[b + 2 + (k & 4 ? 3 : 0)];
        const u = LR[0] * x + LR[1] * y + LR[2] * z, v = LU[0] * x + LU[1] * y + LU[2] * z;
        const w = L[0] * x + L[1] * y + L[2] * z;
        if (u < lo0) lo0 = u; if (u > hi0) hi0 = u;
        if (v < lo1) lo1 = v; if (v > hi1) hi1 = v;
        if (w < lo2) lo2 = w; if (w > hi2) hi2 = w;
      }
      let vis = (hi0 >= c.a - R && lo0 <= c.a + R && hi1 >= c.b - R && lo1 <= c.b + R) ? 1 : 0;
      if (vis && on) {
        /* сколько эта клетка роняет вдоль луча: её верх над землёй района */
        const drop = Math.min(maxDrop, box[b + 4] * invSin);
        if (hi2 < c.s - R || lo2 - drop > c.s + R) { vis = 0; skipped++; }
      }
      out[i] = vis;
    }
    return skipped;
  }
};

/* Нарисовать батч по маске видимых клеток, слив соседние диапазоны.
   Пустые клетки диапазон не рвут: они занимают ноль индексов. */
export function drawCells(gpu, vis) {
  const gl = GL.gl, c = gpu.cells;
  if (!c || !vis || !Cull.on) {
    gl.drawElements(gl.TRIANGLES, gpu.count, gpu.type, 0);
    Cull.stats.calls++; Cull.stats.tris += gpu.tris;
    return;
  }
  const cnt = Cull.cnt, off = Cull.off, ib = gpu.ibytes;
  let k = 0, rs = -1, re = -1, tris = 0;
  for (let i = 0; i < c.n; i++) {
    const q = c.count[i];
    if (!q) continue;
    if (!vis[i]) { if (rs >= 0) { cnt[k] = (re - rs) * 3; off[k] = rs * 3 * ib; k++; rs = -1; } continue; }
    const s = c.start[i];
    tris += q;
    if (rs < 0) { rs = s; re = s + q; }
    else if (s === re) re = s + q;
    else { cnt[k] = (re - rs) * 3; off[k] = rs * 3 * ib; k++; rs = s; re = s + q; }
  }
  if (rs >= 0) { cnt[k] = (re - rs) * 3; off[k] = rs * 3 * ib; k++; }
  if (!k) return;
  if (Cull.ext && k > 1) {
    Cull.ext.multiDrawElementsWEBGL(gl.TRIANGLES, cnt, 0, gpu.type, off, 0, k);
    Cull.stats.calls++; if (Cull.st) Cull.stats.sCalls++;
  } else {
    for (let j = 0; j < k; j++) gl.drawElements(gl.TRIANGLES, cnt[j], gpu.type, off[j]);
    Cull.stats.calls += k; if (Cull.st) Cull.stats.sCalls += k;
  }
  Cull.stats.tris += tris;
  if (Cull.st) { Cull.stats.sTris += tris; Cull.stats.full += gpu.tris; }
}

/* Небо рисуется ПОСЛЕДНИМ из непрозрачного: треугольник на дальней плоскости
   с проверкой глубины LEQUAL. На тайловом GPU это значит, что под домами
   шейдер неба не исполняется вовсе, а раньше он считал fbm для всего экрана
   до всякой геометрии. */
export function drawSky() {
  const gl = GL.gl, P = R3.sky;
  gl.useProgram(P.p);
  gl.depthMask(false);
  gl.depthFunc(gl.LEQUAL);
  gl.uniformMatrix4fv(P.u.uInvVP, false, R3.invVP);
  gl.uniform3fv(P.u.uEye, R3.eye);
  gl.uniform3fv(P.u.uSunDir, Env.sun);
  gl.uniform3fv(P.u.uMoonDir, Env.moon);
  gl.uniform3fv(P.u.uSunTint, Env.sunTint);
  gl.uniform1f(P.u.uCloud, Env.cloud);
  gl.uniform1f(P.u.uTime, R3.time);
  gl.uniform1f(P.u.uNight, Env.night);
  gl.uniform1i(P.u.uSky, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_CUBE_MAP, EnvMap.cube);
  gl.bindVertexArray(R3.skyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  R3.curGrp = null;                    /* небо сбило привязку нулевого слота */
}

export function beginMain(lamps) {
  const gl = GL.gl;
  const n = Math.min(QCFG.shader.maxLamps, Q.lamps, lamps ? lamps.length : 0);
  /* Днём источников нет — берём вариант без цикла по ним. */
  R3.main = n > 0 ? R3.mainNight : R3.mainDay;
  const P = R3.main;
  gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uProj, false, R3.proj);
  gl.uniformMatrix4fv(P.u.uView, false, R3.view);
  gl.uniform3fv(P.u.uSunDir, Env.sun);
  gl.uniform3fv(P.u.uSunIrr, Env.sunIrr);
  gl.uniform3fv(P.u.uSH, EnvMap.sh);
  gl.uniform1f(P.u.uFogDens, Env.fogDens);
  gl.uniform1f(P.u.uFogMip, QCFG.sky.fogMip);
  gl.uniform1f(P.u.uNight, Env.night);
  /* Светящиеся окна, неон и свечения-спрайты — авторские, в экранных
     единицах: раньше они смешивались уже после тонмаппинга и от экспозиции не
     зависели. В HDR их надо привести к той экспозиции, которую применит
     постобработка, иначе ночью (экспозиция 7) они выбиваются в белое. */
  gl.uniform1f(P.u.uEmisK, 1 / Math.max(Env.exposure, 1e-3));
  gl.uniform1f(P.u.uGlossMul, Env.glossMul);
  gl.uniform3fv(P.u.uEye, R3.eye);
  gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uSurf, 1); gl.uniform1i(P.u.uAO, 2); gl.uniform1i(P.u.uDetail, 3);
  gl.uniform1i(P.u.uSky, 4);
  gl.uniform1i(P.u.uPref, 5);
  gl.uniform1f(P.u.uPrefMax, QCFG.env.prefLevels - 1);
  /* Тени от солнца. uShadowK = 0 — и ветка выборки не исполняется: ночью
     проход теней не идёт, и читать нечего. */
  if (R3.csmMax > 0) {
    const K = QCFG.shadow, on = SHADOW.on && SHADOW.tex;
    gl.uniform1f(P.u.uShadowK, on ? K.strength : 0);
    /* Слот привязывается ВСЕГДА, даже когда теней нет: сравнивающий семплер,
       оставленный на нулевом слоте, ловит там обычный массив albedo, и вызов
       отвергается целиком. Ночью от этого кадр не рисовался вовсе. */
    gl.uniform1i(P.u.uCsm, 6);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, on ? SHADOW.tex : SHADOW.dummy);
    gl.activeTexture(gl.TEXTURE0);
    if (on) {
      gl.uniformMatrix4fv(P.u.uCsmMat, false, SHADOW.mat);
      gl.uniform4fv(P.u.uCsmTexel, SHADOW.texel);
      gl.uniform4fv(P.u.uCsmFar, SHADOW.far);
      gl.uniform1f(P.u.uCsmMaxDist, SHADOW.far[SHADOW.n - 1]);
      gl.uniform1f(P.u.uCsmN, SHADOW.n);
      gl.uniform1f(P.u.uCsmTexelSize, 1 / SHADOW.size);
      gl.uniform3f(P.u.uCsmBias, K.depthBias, K.slopeBias, K.normalBias);
    }
  }
  if (Tex.detail) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, Tex.detail.tex); }
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_CUBE_MAP, EnvMap.cube);
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_CUBE_MAP, EnvMap.pref);
  gl.activeTexture(gl.TEXTURE0);
  /* Затенение в складках: слот привязывается всегда, при выключенном —
     заглушка 1×1 «затенения нет». */
  gl.uniform1i(P.u.uAOScr, 7);
  gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, R3.aoTex || SSAO.dummy);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform3f(P.u.uAOScrK, 1 / Math.max(1, HDR.w), 1 / Math.max(1, HDR.h), SSAO.on ? 1 : 0);
  /* Отражения: слот привязывается всегда, при выключенных — заглушка 1×1
     «отражения нет». Сила ноль закрывает ветку выборки целиком. */
  gl.uniform1i(P.u.uSSR, 8);
  gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, R3.ssrTex || SSR.dummy);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform2f(P.u.uSSRK, R3.ssrTex ? QCFG.ssr.strength : 0, QCFG.ssr.rough);
  gl.uniform1f(P.u.uDetailK, Q.detail ? QCFG.tex.detailStrength : 0);
  gl.uniform3f(P.u.uDetailP, QCFG.tex.detailScale, QCFG.tex.detailNear, QCFG.tex.detailFar);
  R3.curGrp = null;
  gl.uniform4f(P.u.uTint, 1, 1, 1, 1);
  gl.uniform1f(P.u.uAlphaMode, 0);
  gl.uniform1f(P.u.uCut, QCFG.tex.cutSign);
  gl.uniform3f(P.u.uWind, Env.windX * Env.windAmp, Env.windZ * Env.windAmp, R3.time);
  gl.uniform1f(P.u.uSkin, 0);
  const LP = QCFG.light.lamp;
  gl.uniform1f(P.u.uLampR2, LP.radius * LP.radius);
  gl.uniform1f(P.u.uLampR0, LP.srcR * LP.srcR);
  gl.uniform1f(P.u.uLampP, LP.power * Math.PI);
  gl.uniform1i(P.u.uLampN, n);
  for (let i = 0; i < n; i++) {
    gl.uniform3f(P.u['uLampPos[' + i + ']'] || P.u.uLampPos, lamps[i].x, lamps[i].y, lamps[i].z);
    const c = lamps[i].c || LP.warm;
    const k = lamps[i].k === undefined ? 1 : lamps[i].k;
    gl.uniform3f(P.u['uLampCol[' + i + ']'] || P.u.uLampCol, lin1(c[0]) * k, lin1(c[1]) * k, lin1(c[2]) * k);
  }
}

/* Материал: группа массивов (albedo, surf, ao) и номер слоя. Группа
   связывается один раз, пока идут её материалы; слой — юниформ. */
export function bindMaterial(mat) {
  const gl = GL.gl, P = R3.main, g = mat.grp;
  if (g !== R3.curGrp) {
    R3.curGrp = g;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.albedo.tex);
    if (g.surf) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.surf.tex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.ao.tex);
    }
    gl.uniform1f(P.u.uHasSurf, g.surf ? 1 : 0);
  }
  gl.uniform1f(P.u.uLayer, mat.layer);
  gl.uniform2f(P.u.uMatRM, mat.rough, mat.metal);
  gl.uniform1f(P.u.uTriplanar, mat.tri || 0);
  /* Глянцевость материала — только для маски отражений в проходе глубины.
     Витринное стекло гладкое картой шероховатости, а не вершинами, и маска
     по одному vGloss пропустила бы все витрины. Юниформа нет в главной
     программе — локация null, запись GL игнорирует. */
  gl.uniform1f(P.u.uMatGloss, Math.max(0, 1 - mat.rough / Math.max(0.01, QCFG.ssr.rough)));
}
export function drawMesh(gpu, mat, model, opt) {
  const gl = GL.gl, P = R3.main;
  opt = opt || {};
  gl.uniformMatrix4fv(P.u.uModel, false, model);
  gl.uniform1f(P.u.uSkin, opt.skin ? 1 : 0);
  gl.uniform1f(P.u.uAlphaMode, opt.alpha ? 1 : 0);
  if (opt.tint) gl.uniform4f(P.u.uTint, lin1(opt.tint[0]), lin1(opt.tint[1]), lin1(opt.tint[2]), opt.tint[3] === undefined ? 1 : opt.tint[3]);
  else gl.uniform4f(P.u.uTint, 1, 1, 1, 1);
  bindMaterial(mat);
  gl.bindVertexArray(gpu.vao);
  if (opt.cells) drawCells(gpu, opt.cells);
  else {
    gl.drawElements(gl.TRIANGLES, gpu.count, gpu.type, 0);
    Cull.stats.calls++; Cull.stats.tris += gpu.tris;
    if (Cull.st) { Cull.stats.sCalls++; Cull.stats.sTris += gpu.tris; Cull.stats.full += gpu.tris; }
  }
}

export function drawGlow(pos, size, color, alpha, hard) {
  const gl = GL.gl, P = R3.glow;
  gl.useProgram(P.p);
  gl.uniformMatrix4fv(P.u.uProj, false, R3.proj);
  gl.uniformMatrix4fv(P.u.uView, false, R3.view);
  gl.uniform3fv(P.u.uRight, R3.right);
  gl.uniform3fv(P.u.uUp, R3.up);
  gl.uniform3f(P.u.uPos, pos[0], pos[1], pos[2]);
  gl.uniform2f(P.u.uSize, size, size);
  /* Цвет авторский, в sRGB, и яркость задана «как на экране»: переводим в
     линейный свет и делим на экспозицию кадра — свечения складываются в
     HDR-буфер до тонмаппинга, а не поверх готовой картинки, как раньше. */
  const k = QCFG.light.glowK / Math.max(Env.exposure, 1e-3);
  gl.uniform4f(P.u.uColor, lin1(color[0]) * k, lin1(color[1]) * k, lin1(color[2]) * k, alpha);
  gl.uniform1f(P.u.uHard, hard || 2.0);
  gl.bindVertexArray(R3.glowVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export function hex2rgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/* Осенний нюанс: батч листвы красится одним uTint, геометрию не трогаем. */
export const Season = { tint: null, set(t) { this.tint = t <= 0 ? null : [1 + t * 0.35, 1 - t * 0.06, 0.9 - t * 0.42, 1]; } };

/* Видна ли точка с запасом r: вывески — маленькие отдельные меши, коробок по
   клеткам у них нет, и дешевле проверить их шаром. */
export function sphereVisible(p, r) {
  if (!Cull.on) return true;
  const pl = Cull.planes;
  for (let k = 0; k < 6; k++)
    if (pl[k*4] * p[0] + pl[k*4+1] * p[1] + pl[k*4+2] * p[2] + pl[k*4+3] < -r) return false;
  return true;
}

/* статический мир + вывески */
export function drawStatic() {
  const idm = m4id(R3.model);
  const vis = Cull.on ? Cull.vis : null;
  /* Проход глубины и проход теней гоняют ту же геометрию — но в отчёт о
     вызовах и треугольниках должен попасть только главный проход, иначе
     цифры «до и после отсева» удваиваются на ровном месте. */
  Cull.st = Cull.gate;
  for (const b of Static.batches) {
    if (b.alpha) continue;
    drawMesh(b.gpu, TX[b.name], idm, { cells: vis });
  }
  const gl = GL.gl;
  gl.disable(gl.CULL_FACE);
  /* порог для зелени ниже общего: на дальних мипах альфа усредняется с пустотой
     и при 0.5 крона редеет. Вывескам порог возвращаем — им нужен чёткий край. */
  gl.uniform1f(R3.main.u.uCut, QCFG.tex.cutVeg);
  for (const b of Static.batches) if (b.alpha)
    drawMesh(b.gpu, TX[b.name], idm, { alpha: true, cells: vis, tint: b.name === 'leaves' ? Season.tint : null });
  gl.uniform1f(R3.main.u.uCut, QCFG.tex.cutSign);
  for (const s of Static.signs) if (s.mat && sphereVisible(s.pos, 6)) drawMesh(s.gpu, s.mat, idm, { alpha: true });
  gl.enable(gl.CULL_FACE);
  Cull.st = 0;
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let R3;
export function __init() {

  /* ------------------------------------------------------------------ */
  /* 7. Рендерер                                                          */
  /* ------------------------------------------------------------------ */
  R3 = {
    main: null, mainDay: null, mainNight: null, sky: null, glow: null, tone: null, cube: null, pref: null,
    tonePlain: null, toneFxaa: null, tonePlainB: null, toneFxaaB: null, bloom: null, ssr: null,
    depth: null, shadow: null, ssao: null, ssaoBlur: null, ssaoBlurSep: null, csmMax: 0,
    aoTex: null, bloomTex: null, ssrTex: null,
    skyVAO: null, glowVAO: null,
    proj: m4(), view: m4(), model: m4(), invVP: m4(), viewProj: m4(), tmp: m4(), tmp2: m4(),
    eye: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1], time: 0,
    curGrp: null                         /* группа текстур, связанная сейчас */
  };
}
