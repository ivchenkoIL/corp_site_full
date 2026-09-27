/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «1. WebGL: контекст, шейдеры, буферы», строки 960–2147.
   ===================================================================== */
import { QCFG } from '../core/quality.js';
import { clamp, lerp } from '../core/util.js';

/* ------------------------------------------------------------------ */
/* 1. WebGL: контекст, шейдеры, буферы                                  */
/* ------------------------------------------------------------------ */
export const GL = { gl: null, canvas: null, w: 1, h: 1, dpr: 1, scale: 1, uiDpr: 1, aniso: null, maxAniso: 1, renderer: '' };

/* Числа конфигурации в текст шейдера. */
export const gf = v => (v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(8) : v.toFixed(8));
export const gv3 = a => 'vec3(' + a.map(gf).join(', ') + ')';

/* JS-двойник модели неба. Нужен ровно для одного: посчитать сферические
   гармоники рассеянного света, не читая обратно нарисованную кубмапу —
   любое такое чтение ломает тайловый конвейер. Тест tools/sky-test.mjs
   сравнивает его с GLSL-версией на сетке направлений. */
export const SkyJS = {
  _o: [0, 0, 0], _p: [0, 0, 0],
  atmoFar(ox, oy, oz, dx, dy, dz) {
    const K = QCFG.sky;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - K.rAtmo * K.rAtmo;
    const disc = b * b - c;
    return disc <= 0 ? 0 : -b + Math.sqrt(disc);
  },
  hitsGround(ox, oy, oz, dx, dy, dz) {
    const K = QCFG.sky;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - K.rEarth * K.rEarth;
    const disc = b * b - c;
    return disc > 0 && (-b - Math.sqrt(disc)) > 0;
  },
  /* out = [r, g, b]; dir и sun — единичные */
  color(out, dir, sun, nightK) {
    const K = QCFG.sky, bR = K.betaR, bM = K.betaM;
    const oy = K.rEarth + 200;
    /* нижняя полусфера считается по зеркальному направлению — см. skyColor */
    const dx = dir[0], dy0 = dir[1], dz = dir[2];
    const uy = dy0 < 0 ? -dy0 : dy0;
    const far = this.atmoFar(0, oy, 0, dx, uy, dz);
    let r = 0, g = 0, b = 0;
    if (far > 0) {
      const seg = far / K.viewSteps;
      let sR0 = 0, sR1 = 0, sR2 = 0, sM0 = 0, sM1 = 0, sM2 = 0, odR = 0, odM = 0;
      for (let i = 0; i < K.viewSteps; i++) {
        const t = seg * (i + 0.5);
        const px = dx * t, py = oy + uy * t, pz = dz * t;
        const h = Math.sqrt(px * px + py * py + pz * pz) - K.rEarth;
        const dr = Math.exp(-h / K.hR) * seg, dm = Math.exp(-h / K.hM) * seg;
        odR += dr; odM += dm;
        if (this.hitsGround(px, py, pz, sun[0], sun[1], sun[2])) continue;
        const ls = this.atmoFar(px, py, pz, sun[0], sun[1], sun[2]) / K.lightSteps;
        let lR = 0, lM = 0;
        for (let j = 0; j < K.lightSteps; j++) {
          const u = ls * (j + 0.5);
          const qx = px + sun[0] * u, qy = py + sun[1] * u, qz = pz + sun[2] * u;
          const hq = Math.sqrt(qx * qx + qy * qy + qz * qz) - K.rEarth;
          lR += Math.exp(-hq / K.hR) * ls; lM += Math.exp(-hq / K.hM) * ls;
        }
        const tR = odR + lR, tM = (odM + lM) * bM * 1.1;
        const a0 = Math.exp(-(bR[0] * tR + tM)), a1 = Math.exp(-(bR[1] * tR + tM)), a2 = Math.exp(-(bR[2] * tR + tM));
        sR0 += a0 * dr; sR1 += a1 * dr; sR2 += a2 * dr;
        sM0 += a0 * dm; sM1 += a1 * dm; sM2 += a2 * dm;
      }
      const mu = dx * sun[0] + uy * sun[1] + dz * sun[2], mu2 = mu * mu;
      const pR = 0.05968310 * (1 + mu2);
      const g2 = K.gMie * K.gMie;
      const pM = 0.11936620 * ((1 - g2) * (1 + mu2)) /
                 ((2 + g2) * Math.pow(Math.max(1 + g2 - 2 * K.gMie * mu, 1e-4), 1.5));
      const msk = K.msK * K.sunI * Math.max(sun[1] * 1.4 + 0.06, 0);
      r = (sR0 * bR[0] * pR + sM0 * bM * pM) * K.sunI + (1 - Math.exp(-bR[0] * odR)) * msk;
      g = (sR1 * bR[1] * pR + sM1 * bM * pM) * K.sunI + (1 - Math.exp(-bR[1] * odR)) * msk;
      b = (sR2 * bR[2] * pR + sM2 * bM * pM) * K.sunI + (1 - Math.exp(-bR[2] * odR)) * msk;
    }
    const up = clamp(dir[1] * 0.5 + 0.5, 0, 1), N = QCFG.sky.night;
    r += lerp(N.horizon[0], N.zenith[0], up) * nightK;
    g += lerp(N.horizon[1], N.zenith[1], up) * nightK;
    b += lerp(N.horizon[2], N.zenith[2], up) * nightK;
    if (dir[1] < 0) {
      const A = QCFG.sky.groundAlbedo;
      const k = Math.max(sun[1], 0) * QCFG.sky.groundSun + QCFG.sky.groundSky;
      const t = clamp(-dir[1] * 2.5, 0, 1) * 0.85;
      r = lerp(r, A[0] * k, t); g = lerp(g, A[1] * k, t); b = lerp(b, A[2] * k, t);
    }
    out[0] = Math.max(r, 0); out[1] = Math.max(g, 0); out[2] = Math.max(b, 0);
    return out;
  },
  /* Прозрачность атмосферы вдоль луча на солнце: отсюда цвет и сила прямого
     солнечного света, а не из авторской палитры. */
  transmittance(out, sun) {
    const K = QCFG.sky, bR = K.betaR;
    const oy = K.rEarth + 200;
    if (this.hitsGround(0, oy, 0, sun[0], sun[1], sun[2])) { out[0] = out[1] = out[2] = 0; return out; }
    const far = this.atmoFar(0, oy, 0, sun[0], sun[1], sun[2]);
    const seg = far / (K.lightSteps * 2);
    let odR = 0, odM = 0;
    for (let j = 0; j < K.lightSteps * 2; j++) {
      const t = seg * (j + 0.5);
      const px = sun[0] * t, py = oy + sun[1] * t, pz = sun[2] * t;
      const h = Math.sqrt(px * px + py * py + pz * pz) - K.rEarth;
      odR += Math.exp(-h / K.hR) * seg; odM += Math.exp(-h / K.hM) * seg;
    }
    const m = K.betaM * 1.1 * odM;
    out[0] = Math.exp(-(bR[0] * odR + m)); out[1] = Math.exp(-(bR[1] * odR + m)); out[2] = Math.exp(-(bR[2] * odR + m));
    return out;
  }
};

/* --- Постобработка ----------------------------------------------------
   Единственное место, где линейный свет становится картинкой. Сцена, небо и
   свечения складываются в HDR-буфере, и уже он проходит экспозицию, ACES,
   насыщенность, кодирование в sRGB и дизеринг. */
export const VS_TONE = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* Тонмаппинг собирается в двух вариантах: с постфильтром сглаживания и без.
   Мультисэмплинг в буфере сцены выключен (замер этапа 04: разрешение
   мультисэмпла блитом стоило дороже, чем весь выигрыш от него), и ступеньки
   на силуэтах убирает FXAA прямо здесь — отдельного прохода он не заводит. */
export const FS_TONE = (FXAA, BLOOM) => `#version 300 es
/* PASS:tone */
precision mediump float;
in vec2 vUV;
uniform sampler2D uHDR;
uniform float uExposure, uSat, uDither;
uniform vec2 uTexel;               /* 1/размер буфера сцены */
${BLOOM ? `uniform sampler2D uBloom;  /* мип-цепочка свечения */
uniform float uBloomK;             /* общая сила */` : ''}
out vec4 fragColor;
/* ACES, аппроксимация Наркович: одна дробь вместо матриц RRT и ODT */
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
/* Interleaved gradient noise, разность двух отсчётов даёт треугольное
   распределение: в восьми битах ночное небо иначе идёт полосами. */
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
/* Кадр в экранном цвете: тонмаппинг применяется ДО поиска краёв, потому что
   искать их в HDR бесполезно — там перепад яркости у неба и у асфальта
   отличается на порядки, и один порог на оба не встаёт. */
vec3 grade(vec2 uv, vec3 bloom){
  vec3 c = aces((texture(uHDR, uv).rgb + bloom) * uExposure);
  float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(g), c, uSat);
  return pow(max(c, vec3(0.0)), vec3(1.0 / ${QCFG.color.gamma.toFixed(2)}));
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  /* Свечение складывается в ЛИНЕЙНОМ свете, до экспозиции: только так яркое
     тянет за собой тонмаппинг, а не ложится плёнкой поверх готовой картинки.
     Уровни мип-цепочки берутся один раз на пиксель: свечение — самая низкая
     частота в кадре, и четырём соседям постфильтра сглаживания оно одно и
     то же, так что пять вызовов grade получают уже посчитанное. */
  vec3 bl = vec3(0.0);
${BLOOM ? BLOOM : ''}
  vec3 c = grade(vUV, bl);
${FXAA ? `
  /* FXAA: край ищется по яркости четырёх соседей крестом, направление —
     по тому, где перепад круче, и вдоль него берётся одна дополнительная
     выборка со сдвигом на полтекселя. Это «дешёвая» версия: она не строит
     длинный поиск конца края, зато стоит пять выборок вместо тридцати, а
     ступеньку на проводах и на краю крыши убирает. */
  float lC = luma(c);
  float lN = luma(grade(vUV + vec2(0.0, -uTexel.y), bl));
  float lS = luma(grade(vUV + vec2(0.0,  uTexel.y), bl));
  float lW = luma(grade(vUV + vec2(-uTexel.x, 0.0), bl));
  float lE = luma(grade(vUV + vec2( uTexel.x, 0.0), bl));
  float lo = min(lC, min(min(lN, lS), min(lW, lE)));
  float hi = max(lC, max(max(lN, lS), max(lW, lE)));
  float range = hi - lo;
  /* порог: и абсолютный (тьма не должна кипеть), и относительный к яркости */
  if (range >= max(0.028, hi * 0.125)) {
    vec2 dir = vec2(-((lN + lS) - 2.0 * lC), ((lW + lE) - 2.0 * lC));
    float m = max(abs(dir.x), abs(dir.y));
    if (m > 1e-5) {
      dir = clamp(dir / m, -1.0, 1.0) * uTexel * 0.5;
      vec3 a = grade(vUV + dir, bl), b = grade(vUV - dir, bl);
      vec3 mixed = (a + b) * 0.5;
      /* если размытие увело яркость за пределы соседей — край был не там */
      float lm = luma(mixed);
      c = (lm < lo || lm > hi) ? c : mix(c, mixed, 0.75);
    }
  }` : ''}
  float d = ign(gl_FragCoord.xy) - ign(gl_FragCoord.xy + vec2(11.0, 7.0));
  fragColor = vec4(c + d * (uDither / 255.0), 1.0);
}`;

/* --- Физическая модель отражения --------------------------------------
   GGX (Троубридж–Райц) для распределения микрограней, высотно-
   коррелированный Smith для затенения, Френель по Шлику, Ламберт в диффузе.
   Одна и та же BRDF для солнца, для точечных источников и для окружения —
   иначе объекты и выглядят наклеенными: блик живёт по одним правилам,
   рассеянное по другим, отражение неба вовсе отсутствует. */
export const GLSL_PBR = `
const float PI = 3.14159265, INV_PI = 0.31830989;
float D_GGX(float NoH, float a){
  float a2 = a * a, d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 1e-7);
}
/* уже делённый на 4·NoL·NoV — в произведении с D эти множители сокращаются */
float V_Smith(float NoV, float NoL, float a){
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
  float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-5);
}
vec3 F_Schlick(vec3 f0, float u){ return f0 + (1.0 - f0) * pow(1.0 - u, 5.0); }
/* Приближение Кариса для второй суммы split-sum. Взято вместо таблицы BRDF:
   таблица стоила бы прохода генерации, текстуры и выборки на каждый пиксель,
   а это десяток арифметических операций и ноль обращений к памяти. */
vec3 envBRDF(vec3 f0, float rough, float NoV){
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}
/* Зеркальная окклюзия из AO: гладкое зеркало окклюдируется слабее шершавого,
   иначе металл в углу чернеет. */
float specOcclusion(float NoV, float ao, float rough){
  return clamp(pow(NoV + ao, exp2(-16.0 * rough - 1.0)) - 1.0 + ao, 0.0, 1.0);
}
/* Прямой источник: солнце и фонарь считаются одинаково, разница только в
   освещённости irr и в направлении L. */
vec3 directLight(vec3 N, vec3 V, vec3 L, vec3 irr, vec3 diff, vec3 f0, float a){
  float NoL = max(dot(N, L), 0.0);
  if (NoL <= 0.0) return vec3(0.0);
  vec3 H = normalize(L + V);
  float NoV = max(dot(N, V), 1e-4), NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0);
  vec3 F = F_Schlick(f0, VoH);
  vec3 spec = F * (D_GGX(NoH, a) * V_Smith(NoV, NoL, a));
  return ((vec3(1.0) - F) * diff * INV_PI + spec) * irr * NoL;
}`;

/* Главная программа собирается в двух вариантах: дневном (LAMPS = 0, цикла
   по источникам нет вовсе) и ночном. Обе компилируются при загрузке, а кадр
   выбирает нужную — днём восемь мёртвых итераций с полной BRDF не исполняются.

   Точность: mediump везде, кроме связанного с мировыми координатами. На Apple
   GPU mediump — половинная точность; координаты района доходят до двухсот
   метров, а развёртка с повторами detail — до сотен, и в fp16 то и другое
   рассыпается. */
export const FS_MAIN = (LAMPS, CSM) => `#version 300 es
/* PASS:main — метка для оснастки замера (tools/perf-inject.js): по ней
   программа опознаётся в разборе кадра по проходам, а не по именам юниформ. */
precision mediump float;
precision mediump sampler2DArray;
precision mediump samplerCube;
in highp vec3 vWorld; in highp vec2 vUV;
in vec3 vNor; in vec3 vCol; in float vEmis; in float vGloss;
uniform sampler2DArray uTex;      /* albedo в SRGB8_ALPHA8: семплер отдаёт линейный цвет; альфа — маска */
uniform sampler2DArray uSurf;     /* nx ny roughness metalness, линейно */
uniform sampler2DArray uAO;       /* ambient occlusion, линейно */
uniform sampler2DArray uDetail;   /* detail-нормаль высокой частоты, RG */
uniform samplerCube uSky;         /* небо: туман и дальний план */
uniform samplerCube uPref;        /* префильтрованные по шероховатости отражения */
uniform float uPrefMax;           /* последний уровень префильтра */
uniform vec3 uSH[9];              /* сферические гармоники рассеянного света */
uniform float uLayer, uHasSurf, uTriplanar, uDetailK;
uniform vec2 uMatRM;              /* roughness, metalness для материалов без карт */
uniform vec3 uDetailP;            /* повторов на тайл, ближняя и дальняя дистанции, м */
uniform vec3 uSunDir, uSunIrr;
uniform float uFogDens, uFogMip, uNight, uAlphaMode, uCut, uGlossMul, uEmisK;
uniform vec4 uTint;
uniform highp vec3 uEye;
uniform sampler2D uAOScr;          /* затенение в складках, экранное */
uniform vec3 uAOScrK;              /* 1/ширина, 1/высота буфера сцены, сила */
uniform sampler2D uSSR;            /* отражения в экранном пространстве */
uniform vec2 uSSRK;                /* сила и шероховатость, выше которой их нет */
${CSM > 0 ? `/* Каскады: слои одного массива с глубиной, выборка сравнивающая.
   highp обязателен — координаты каскада живут в метрах района, а в mediump
   (на Apple это половинная точность) сто метров кладутся с шагом в
   дециметр, и тень рассыпается на квадраты. */
precision highp sampler2DArrayShadow;
uniform sampler2DArrayShadow uCsm;
uniform highp mat4 uCsmMat[${CSM}];
uniform vec4 uCsmTexel;            /* мировых метров на тексель по каскадам */
uniform vec4 uCsmFar;              /* дальние границы каскадов, м */
uniform float uCsmN, uShadowK, uCsmTexelSize, uCsmMaxDist;
uniform vec3 uCsmBias;             /* постоянное, наклонное, нормальное смещение */` : ''}
${LAMPS > 0 ? `uniform highp vec3 uLampPos[${LAMPS}];
uniform vec3 uLampCol[${LAMPS}];
uniform float uLampR2, uLampR0, uLampP;
uniform int uLampN;` : ''}
out vec4 fragColor;
${GLSL_PBR}
/* Освещённость из сферических гармоник L2 по формуле Рамамурти–Ханрахана:
   девять коэффициентов и два десятка операций вместо выборки из карты
   освещённости. Коэффициенты считает CPU по той же модели неба. */
vec3 shIrradiance(vec3 n){
  const float c1 = 0.429043, c2 = 0.511664, c3 = 0.743125, c4 = 0.886227, c5 = 0.247708;
  return max(c1 * uSH[8] * (n.x * n.x - n.y * n.y) + c3 * uSH[6] * n.z * n.z + c4 * uSH[0] - c5 * uSH[6]
           + 2.0 * c1 * (uSH[4] * n.x * n.y + uSH[7] * n.x * n.z + uSH[5] * n.y * n.z)
           + 2.0 * c2 * (uSH[3] * n.x + uSH[1] * n.y + uSH[2] * n.z), vec3(0.0));
}
${CSM > 0 ? `
/* Тень от солнца по каскадам.

   Смещений три, потому что и ошибок три. Постоянное борется с квантованием
   глубины каскада. Наклонное — с тем, что при косом свете один тексель
   каскада накрывает тем больший перепад высоты, чем острее угол; tan у ребра
   уходит в бесконечность, поэтому он с потолком. Нормальное сдвигает саму
   точку выборки вдоль нормали на долю текселя — оно снимает рябь, не отрывая
   тень от подошвы, чем и отличается от первых двух: те двигают глубину и при
   переборе поднимают тень над землёй.

   Каскад выбирается по попаданию в его квадрат, а не по расстоянию: границы
   квадратов — это и есть то, что видно, а расстояние с ними не совпадает по
   углам. На стыке каскады смешиваются, иначе переход читается ступенькой. */
float csmSample(int i, highp vec3 wp, float sBias){
  highp vec4 sc = uCsmMat[i] * vec4(wp, 1.0);
  vec3 uv = sc.xyz / sc.w;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || uv.z > 1.0 || uv.z < 0.0) return -1.0;
  float ref = uv.z - sBias;
  float sum = 0.0;
  const int R = ${QCFG.shadow.pcf};
  for (int y = -R; y <= R; y++)
    for (int x = -R; x <= R; x++)
      sum += texture(uCsm, vec4(uv.xy + vec2(float(x), float(y)) * uCsmTexelSize, float(i), ref));
  return sum / float((2 * R + 1) * (2 * R + 1));
}
float sunShadow(highp vec3 wp, vec3 N, float NoL){
  if (uShadowK <= 0.0) return 1.0;
  /* Дальняя граница теней — одна на все каскады. Раньше она жила внутри
     последнего каскада, но с тех пор, как дальняя плоскость каждого каскада
     отодвинута на длину тени, далёкий пиксель может попасть и в ближний
     каскад: граница должна быть общей, иначе в одном месте тень кончается
     на ста двадцати метрах, а в соседнем тянется дальше. */
  float d = length(wp - uEye);
  if (d > uCsmMaxDist) return 1.0;
  /* smoothstep с edge0 > edge1 не определён — гасим через 1 − smoothstep */
  float fade = 1.0 - smoothstep(uCsmMaxDist * ${gf(1 - QCFG.shadow.fade)}, uCsmMaxDist, d);
  /* tan угла между нормалью и светом, с потолком: у самого ребра он
     обращается в бесконечность и смещение выело бы тень целиком */
  float st = clamp(sqrt(max(1.0 - NoL * NoL, 0.0)) / max(NoL, 0.08), 0.0, ${gf(QCFG.shadow.slopeMax)});
  for (int i = 0; i < ${CSM}; i++) {
    if (float(i) >= uCsmN) break;
    /* Каскад выбирается ПО РАССТОЯНИЮ, а не по попаданию в квадрат. Так
       можно: шар каскада строился вокруг среза пирамиды, поэтому всё видимое
       ближе его дальней границы заведомо внутри квадрата. Зато у отсева
       появляется право сказать «приёмники этого каскада — только его шар», и
       тенеобразующие отбираются по длине тени, а не по бесконечной шахте
       вдоль луча (Cull.markShadow). */
    if (d > uCsmFar[i]) continue;
    float texel = uCsmTexel[i];
    /* нормальное смещение — в текселях этого каскада, поэтому в дальнем оно
       крупнее ровно во столько раз, во сколько там крупнее тексель */
    highp vec3 p = wp + N * (texel * uCsmBias.z);
    float s = csmSample(i, p, uCsmBias.x + uCsmBias.y * st);
    if (s < 0.0) continue;
    return mix(1.0, mix(1.0, s, fade), uShadowK);
  }
  return 1.0;
}` : ''}
/* Касательный базис из производных экрана: тангенсов в вершинах нет и не нужно */
vec3 perturb(vec3 N, vec3 nt, highp vec3 p, highp vec2 uv){
  vec3 dp1 = vec3(dFdx(p)), dp2 = vec3(dFdy(p));
  vec2 duv1 = vec2(dFdx(uv)), duv2 = vec2(dFdy(uv));
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
  return normalize(mat3(T * invmax, B * invmax, N) * nt);
}
void main(){
  vec3 Ng = normalize(vNor);
  vec3 vNorG = Ng;                   /* геометрическая нормаль: для горизонтной окклюзии */
  vec3 N = Ng;
  vec4 t;
  vec4 sf = vec4(0.5, 0.5, uMatRM);
  float ao = 1.0;
  float dEye = float(length(vWorld - uEye));
  if (uTriplanar > 0.0) {
    /* трёхплоскостная проекция: развёртка от мировых координат, швов и растяжений нет */
    vec3 w = pow(abs(Ng), vec3(4.0)); w /= (w.x + w.y + w.z);
    vec3 q = vWorld / uTriplanar;
    highp vec3 cx = vec3(q.zy, uLayer), cy = vec3(q.xz, uLayer), cz = vec3(q.xy, uLayer);
    t = texture(uTex, cx) * w.x + texture(uTex, cy) * w.y + texture(uTex, cz) * w.z;
    if (uHasSurf > 0.5) {
      vec4 sx = texture(uSurf, cx), sy = texture(uSurf, cy), sz = texture(uSurf, cz);
      sf = sx * w.x + sy * w.y + sz * w.z;
      ao = texture(uAO, cx).r * w.x + texture(uAO, cy).r * w.y + texture(uAO, cz).r * w.z;
      vec2 nx = sx.xy * 2.0 - 1.0, ny = sy.xy * 2.0 - 1.0, nz = sz.xy * 2.0 - 1.0;
      vec3 sg = sign(Ng);
      N = normalize(Ng + vec3(0.0, nx.y, nx.x * sg.x) * w.x + vec3(ny.x, 0.0, ny.y * sg.y) * w.y + vec3(nz.x * sg.z, nz.y, 0.0) * w.z);
    }
  } else {
    highp vec3 tc = vec3(vUV, uLayer);
    t = texture(uTex, tc);
    if (uAlphaMode > 0.5 && t.a < uCut) discard;      /* листва и знаки: альфа-тест */
    if (uHasSurf > 0.5) {
      sf = texture(uSurf, tc);
      ao = texture(uAO, tc).r;
      vec2 nxy = sf.xy * 2.0 - 1.0;
      /* Производные развёртки считаем ДО ветки: внутри неоднородного
         ветвления они не определены, а textureGrad как раз и нужен, чтобы
         уровень мипа не зависел от того, зашли мы в ветку или нет. */
      highp vec2 duv = vUV * uDetailP.x;
      vec2 ddx = vec2(dFdx(duv)), ddy = vec2(dFdy(duv));
      if (uDetailK > 0.0 && dEye < uDetailP.z) {
        /* detail-нормаль вблизи — то, что убирает мыло в упор */
        float k = uDetailK * (1.0 - smoothstep(uDetailP.y, uDetailP.z, dEye));
        nxy += (textureGrad(uDetail, vec3(duv, 0.0), ddx, ddy).xy * 2.0 - 1.0) * k;
      }
      N = perturb(Ng, normalize(vec3(nxy, sqrt(max(0.06, 1.0 - dot(nxy, nxy))))), vWorld, vUV);
    }
  }
  vec3 V = normalize(uEye - vWorld);
  vec3 albedo = t.rgb * vCol * uTint.rgb;
  float metal = sf.w;
  /* vGloss — авторская поправка «мокрое, лакированное, стеклянное»: она
     снижает шероховатость, а не подменяет её. Всё остальное из карт. */
  float rough = max(sf.z * (1.0 - clamp(vGloss * uGlossMul, 0.0, 1.0) * ${gf(QCFG.light.vGlossK)}), ${gf(QCFG.light.roughMin)});
  float a = rough * rough;
  vec3 diff = albedo * (1.0 - metal);
  vec3 f0 = mix(vec3(${gf(QCFG.light.f0)}), albedo, metal);
  float NoV = max(dot(N, V), 1e-4);

  /* Солнце. Тень умножает ТОЛЬКО его: рассеянное из гармоник и зеркальное из
     префильтра приходят со всего неба, и затенять их картой теней солнца —
     значит посчитать одно и то же затемнение дважды. */
  vec3 lit = directLight(N, V, uSunDir, uSunIrr * mix(1.0, ao, ${gf(QCFG.light.sunAO)}), diff, f0, a)
${CSM > 0 ? `           * sunShadow(vWorld, vNorG, max(dot(N, uSunDir), 0.0))` : ''};

  /* Окружение как свет. Рассеянное — из сферических гармоник неба;
     зеркальное — из префильтрованной по шероховатости кубмапы по отражённому
     вектору, со split-sum: свёртку даёт префильтр, интеграл BRDF —
     приближение Кариса. Именно это превращает объекты из наклеенных в
     стоящие в сцене: металл отражает небо, тени подсвечены голубым. */
  /* Экранное затенение множит РАССЕЯННОЕ и участвует в зеркальной окклюзии,
     но не трогает ни солнце (его затеняют каскады), ни точечные источники.
     Умножить всё на всё — значит посчитать затемнение в углу дважды. */
  float aoScr = texture(uAOScr, gl_FragCoord.xy * uAOScrK.xy).r;
  float aoC = ao * mix(1.0, aoScr, uAOScrK.z);

  vec3 R = reflect(-V, N);
  /* Горизонтная окклюзия: отражение, ушедшее под геометрическую поверхность,
     физически невозможно — иначе карта нормалей ловит небо сквозь стену. */
  float horiz = clamp(1.0 + ${gf(QCFG.light.horizonOccl)} * dot(R, vNorG), 0.0, 1.0);
  horiz *= horiz;
  vec3 skyRad = textureLod(uPref, R, rough * uPrefMax).rgb;
  /* Отражения в экранном пространстве подменяют собой НЕБО, а не ложатся
     поверх него: дальше идёт та же самая формула с envBRDF и зеркальной
     окклюзией, поэтому лужа отражает дом ровно с той силой, с какой она
     отражала бы небо. Где луч ушёл за кадр или ни во что не попал,
     уверенность нулевая и остаётся префильтр — перехода не видно.
     Ветка на юниформе: на среднем и низком профиле отражений нет, и выборка
     не исполняется. */
  /* Выборка только там, где отражение вообще пойдёт в дело: шершавый пиксель
     всё равно получил бы вес ноль, а лишнее обращение к памяти в самом
     дорогом проходе кадра стоит дороже ветки. Ветка когерентна — она идёт по
     материалу, а не по шахматной доске. */
  if (uSSRK.x > 0.0 && rough < uSSRK.y) {
    vec4 ssr = texture(uSSR, gl_FragCoord.xy * uAOScrK.xy);
    float sw = ssr.a * uSSRK.x * (1.0 - smoothstep(uSSRK.y * 0.55, uSSRK.y, rough));
    skyRad = mix(skyRad, ssr.rgb, clamp(sw, 0.0, 1.0));
${QCFG.ssr.debug ? (QCFG.ssr.debug === 1 ? `
    fragColor = vec4(ssr.rgb, 1.0); return;` : `
    fragColor = vec4(vec3(ssr.a), 1.0); return;`) : ''}
  }
  lit += diff * shIrradiance(N) * INV_PI * aoC;
  lit += skyRad * envBRDF(f0, rough, NoV) * specOcclusion(NoV, aoC, rough) * horiz;

${LAMPS > 0 ? `
  /* точечные источники: фонари, витрины и фары */
  for (int i = 0; i < ${LAMPS}; i++) {
    if (i >= uLampN) break;
    vec3 d = vec3(uLampPos[i] - vWorld);
    float d2 = dot(d, d);
    if (d2 > uLampR2) continue;
    /* спад обратный квадрату с оконной функцией на радиусе: свет кончается
       ровно там, где кончается, и не обрывается ступенькой */
    float win = clamp(1.0 - d2 * d2 / (uLampR2 * uLampR2), 0.0, 1.0);
    float att = uLampP * win * win / max(d2, uLampR0);
    lit += directLight(N, V, d * inversesqrt(max(d2, 1e-8)), uLampCol[i] * att * ao, diff, f0, a);
  }` : ''}
  /* окна и неон: альфа текстуры — маска свечения */
  float winMask = (uAlphaMode > 0.5) ? 0.0 : t.a;
  float em = vEmis + winMask;
  lit += (albedo * em * ${gf(QCFG.light.emis.win)} + ${gv3(QCFG.light.emis.tint)} * winMask * ${gf(QCFG.light.emis.tintK)}) * uNight * uEmisK;
${CSM > 0 && QCFG.shadow.debug ? `
  { /* отладочный показ теней — QCFG.shadow.debug */
    float dbgS = sunShadow(vWorld, vNorG, max(dot(N, uSunDir), 0.0));
    ${QCFG.shadow.debug === 2 ? `
    float dbgI = -1.0;
    float dbgD = length(vWorld - uEye);
    for (int i = 0; i < ${CSM}; i++) {
      if (float(i) >= uCsmN) break;
      if (dbgD > uCsmFar[i]) continue;
      highp vec4 sc = uCsmMat[i] * vec4(vWorld, 1.0);
      vec3 uv = sc.xyz / sc.w;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || uv.z > 1.0 || uv.z < 0.0) continue;
      dbgI = float(i); break;
    }
    vec3 dbgC = dbgI < 0.0 ? vec3(0.15) : (dbgI < 0.5 ? vec3(1.0,0.3,0.25) : (dbgI < 1.5 ? vec3(0.3,1.0,0.35) : vec3(0.3,0.45,1.0)));
    fragColor = vec4(dbgC * mix(0.35, 1.0, dbgS), 1.0); return;` : `
    fragColor = vec4(vec3(dbgS), 1.0); return;`}
  }` : ''}
  /* Туман: цвет берётся из той же модели неба по направлению взгляда — вдаль
     объекты уходят ровно в тот оттенок, каким там небо, и на закате туман
     краснеет со стороны солнца сам, без отдельной палитры. */
  float f = 1.0 - exp(-uFogDens * dEye);
  vec3 col = mix(lit, textureLod(uSky, -V, uFogMip).rgb, clamp(f, 0.0, 1.0));
  /* линейный свет в HDR-буфер: экспозиция и тонмаппинг — один раз, в проходе постобработки */
  fragColor = vec4(col, uTint.a);
}`;

/* --- Небо в кубмапу ---------------------------------------------------
   Дорогая часть неба считается сюда: одна грань 128² за кадр и только когда
   солнце сдвинулось. В кадре из неё берутся фон, туман, отражения и
   рассеянный свет — четыре потребителя на один расчёт. */
export const VS_FACE = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vP;
void main(){ vP = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* --- Префильтр отражений ----------------------------------------------
   Свёртка кубмапы неба ядром GGX по уровням шероховатости: нулевой уровень —
   зеркало, последний — почти рассеянное. Это вторая половина split-sum;
   первая (интеграл BRDF) взята аналитическим приближением Кариса, поэтому
   таблицы BRDF и прохода её генерации нет вовсе. */
export const FS_PREF = `#version 300 es
/* PASS:env */
precision highp float;
in vec2 vP;
uniform vec3 uFaceO, uFaceU, uFaceV;
uniform samplerCube uSrc;
uniform float uRough, uSrcSize;
uniform int uSamples;
out vec4 fragColor;
const float PI = 3.14159265;
/* Хаммерсли: детерминированная последовательность без текстуры шума */
vec2 hammersley(int i, int n){
  uint b = uint(i);
  b = (b << 16u) | (b >> 16u);
  b = ((b & 0x55555555u) << 1u) | ((b & 0xAAAAAAAAu) >> 1u);
  b = ((b & 0x33333333u) << 2u) | ((b & 0xCCCCCCCCu) >> 2u);
  b = ((b & 0x0F0F0F0Fu) << 4u) | ((b & 0xF0F0F0F0u) >> 4u);
  b = ((b & 0x00FF00FFu) << 8u) | ((b & 0xFF00FF00u) >> 8u);
  return vec2(float(i) / float(n), float(b) * 2.3283064365386963e-10);
}
vec3 importanceGGX(vec2 xi, vec3 N, float a){
  float phi = 2.0 * PI * xi.x;
  float ct = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
  float st = sqrt(max(1.0 - ct * ct, 0.0));
  vec3 h = vec3(st * cos(phi), st * sin(phi), ct);
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tx = normalize(cross(up, N)), ty = cross(N, tx);
  return tx * h.x + ty * h.y + N * h.z;
}
void main(){
  vec3 N = normalize(uFaceO + uFaceU * vP.x + uFaceV * vP.y);
  if (uRough <= 0.0) { fragColor = vec4(texture(uSrc, N).rgb, 1.0); return; }
  float a = uRough * uRough;
  vec3 sum = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uSamples) break;
    vec3 H = importanceGGX(hammersley(i, uSamples), N, a);
    vec3 L = 2.0 * dot(N, H) * H - N;
    float NoL = dot(N, L);
    if (NoL <= 0.0) continue;
    /* Мип источника по телесному углу отсчёта: без него на грубых уровнях
       небо распадается на светлые точки — отсчётов меньше, чем текселей. */
    float NoH = max(dot(N, H), 1e-4);
    float d = NoH * NoH * (a * a - 1.0) + 1.0;
    float pdf = (a * a) / (PI * d * d) * 0.25 + 1e-4;
    float sa = 1.0 / (float(uSamples) * pdf);
    float sTex = 4.0 * PI / (6.0 * uSrcSize * uSrcSize);
    sum += textureLod(uSrc, L, max(0.5 * log2(sa / sTex), 0.0)).rgb * NoL;
    wsum += NoL;
  }
  fragColor = vec4(sum / max(wsum, 1e-4), 1.0);
}`;

export const VS_SKY = `#version 300 es
layout(location=0) in vec2 aPos;
uniform mat4 uInvVP;
out vec3 vDir;
void main(){
  vec4 p = uInvVP * vec4(aPos, 1.0, 1.0);
  vDir = p.xyz / p.w;
  /* w = z: небо садится ровно на дальнюю плоскость и рисуется последним из
     непрозрачного с проверкой глубины — под домами шейдер не исполняется */
  gl_Position = vec4(aPos, 1.0, 1.0);
}`;

/* --- Глубина: проход глубины и проход теней -----------------------------
   Одна программа на оба: позиция, скиннинг и альфа-тест — больше в буфере
   глубины ничего не нужно. Цвета у прохода теней нет вовсе, поэтому
   фрагментный шейдер пуст везде, кроме альфа-теста зелени и знаков: без него
   крона отбрасывала бы тень сплошным прямоугольником.

   uProj·uView здесь — либо камера (проход глубины), либо ортогональная
   матрица каскада (проход теней). Ветер повторён из VS_MAIN дословно: если
   зелень качается в кадре, а в тени стоит, тень отрывается от кроны. */
export const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec2 aUV;
layout(location=5) in float aPart;
layout(location=6) in float aGloss;
uniform mat4 uProj, uView, uModel;
uniform mat4 uBones[20];
uniform float uSkin;
uniform vec3 uWind;
out highp vec2 vUV;
out float vGloss;
void main(){
  mat4 M = uSkin > 0.5 ? uBones[int(aPart)] : uModel;
  vec4 wp = M * vec4(aPos, 1.0);
  if (uSkin < 0.5 && aPart > 0.001) {
    float ph = wp.x * 0.42 + wp.z * 0.31;
    float g = sin(uWind.z * 1.15 + ph) * 0.66 + sin(uWind.z * 2.70 + ph * 2.3) * 0.34;
    wp.xz += uWind.xy * aPart * (0.55 + 0.45 * g);
    wp.y -= length(uWind.xy) * aPart * 0.28 * abs(g);
  }
  vUV = aUV; vGloss = aGloss;
  gl_Position = uProj * uView * wp;
}`;

export const FS_DEPTH = `#version 300 es
/* PASS:depth */
precision mediump float;
precision mediump sampler2DArray;
in highp vec2 vUV;
in float vGloss;
uniform sampler2DArray uTex;
uniform float uLayer, uAlphaMode, uCut, uGlossMul, uMatGloss;
/* Единственный выход прохода — маска «здесь есть что отражать». В проходе
   теней буфер отрисовки объявлен как NONE, и запись просто выбрасывается:
   лишней работы это не создаёт, а второй программы не требует.
   Глянцевость берётся из вершин (лужи, краска, стёкла киосков) и из
   материала (витринное стекло гладкое картой шероховатости, а не вершинами —
   маска по одному vGloss пропустила бы все витрины). */
out float fragColor;
void main(){
  /* Непрозрачному фрагментному шейдеру делать почти нечего — и это как раз
     то, чего хочет тайловый GPU: ранний z работает в полную силу. */
  if (uAlphaMode > 0.5 && texture(uTex, vec3(vUV, uLayer)).a < uCut) discard;
  fragColor = clamp(max(vGloss * uGlossMul, uMatGloss), 0.0, 1.0);
}`;

/* --- Затенение в складках геометрии по буферу глубины -------------------
   Порядок в прямом (не отложенном) рендере обязывает: затенение нужно ДО
   затенения пикселя, а глубина сцены появляется только после неё. Поэтому
   глубина считается отдельным проходом вперёд — но, поскольку мультисэмплинга
   в буфере сцены нет, этот проход пишет в ТУ ЖЕ одно-сэмпловую текстуру
   глубины, которой потом пользуется сцена: она не считает глубину заново, а
   получает готовый ранний z. Проход глубины наполовину окупает сам себя.

   Нормаль берётся из производных восстановленной позиции, отдельного буфера
   нормалей нет. Позиция восстанавливается не матрицей, а двумя тангенсами
   поля зрения — те же три умножения, только без обращения к матрице.

   Считается в половину стороны буфера сцены (вчетверо меньше пикселей) и
   размывается с сохранением краёв: обычное размытие протаскивает затенение
   через силуэт, и вокруг каждого столба появляется тёмный ореол. */
export const VS_FULL = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FS_SSAO = N => `#version 300 es
/* PASS:ssao */
precision mediump float;
precision highp sampler2D;
in vec2 vUV;
uniform highp sampler2D uDepth;
uniform vec4 uProjInfo;            /* tanX, tanY, near, far */
uniform vec2 uTexel;               /* 1/размер половинного буфера */
uniform vec4 uParams;              /* радиус, порог, сила, контраст */
uniform float uMaxDist;
uniform vec3 uKernel[${N}];
out float fragColor;

/* Глубина окна → расстояние вдоль взгляда. Камера в начале, взгляд по +z:
   знак условный, наружу эта система не выходит. */
highp float viewZ(vec2 uv){
  highp float d = texture(uDepth, uv).r * 2.0 - 1.0;
  highp float n = uProjInfo.z, f = uProjInfo.w;
  return 2.0 * n * f / (f + n - d * (f - n));
}
highp vec3 viewPos(vec2 uv, highp float z){
  return vec3((uv * 2.0 - 1.0) * uProjInfo.xy * z, z);
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main(){
  highp float zc = viewZ(vUV);
  /* Дальше maxDist радиус затенения меньше пикселя — считать нечего.
     Небо (глубина 1.0) улетает туда же само. */
  if (zc > uMaxDist) { fragColor = 1.0; return; }
  highp vec3 p = viewPos(vUV, zc);
  /* Нормаль из производных: два соседних отсчёта вместо буфера нормалей */
  highp vec3 pr = viewPos(vUV + vec2(uTexel.x, 0.0), viewZ(vUV + vec2(uTexel.x, 0.0)));
  highp vec3 pu = viewPos(vUV + vec2(0.0, uTexel.y), viewZ(vUV + vec2(0.0, uTexel.y)));
  vec3 Nv = normalize(cross(vec3(pr - p), vec3(pu - p)));
  if (Nv.z > 0.0) Nv = -Nv;                  /* нормаль смотрит на камеру */

  /* Поворот ядра на пиксель: без него двенадцать отсчётов дают полосы */
  float rot = ign(gl_FragCoord.xy) * 6.28318530718;
  vec3 rv = vec3(cos(rot), sin(rot), 0.0);
  vec3 T = normalize(rv - Nv * dot(rv, Nv));
  mat3 TBN = mat3(T, cross(Nv, T), Nv);

  float R = uParams.x, occ = 0.0;
  for (int i = 0; i < ${N}; i++) {
    highp vec3 sp = p + vec3(TBN * uKernel[i]) * R;
    if (sp.z < uProjInfo.z) continue;        /* отсчёт заехал за камеру */
    vec2 su = 0.5 + 0.5 * vec2(sp.xy / (sp.z * uProjInfo.xy));
    if (su.x < 0.0 || su.x > 1.0 || su.y < 0.0 || su.y > 1.0) continue;
    highp float sz = viewZ(su);
    /* Проверка дальности: далёкая стена не должна затенять ближний угол —
       иначе вокруг силуэтов появляется чёрная кайма. */
    float range = smoothstep(0.0, 1.0, R / max(abs(float(zc - sz)), 1e-4));
    occ += (sz < float(sp.z) - uParams.y ? 1.0 : 0.0) * range;
  }
  float ao = 1.0 - occ / float(${N}) * uParams.z;
  fragColor = pow(clamp(ao, 0.0, 1.0), uParams.w);
}`;

/* Размытие затенения. Два исполнения, потому что дешевле — не очевидно:
   одно ядро 5×5 берёт 25 отсчётов затенения и 25 глубины на пиксель, два
   прохода по одной оси — 10 и 10, но платят лишним проходом по буферу и
   лишней сменой буфера отрисовки. На тайловом GPU это не одно и то же, и
   выбор сделан замером (QCFG.ssao.blurSep, docs/RENDER-CHANGELOG.md). */
export const FS_SSAO_BLUR = SEP => `#version 300 es
/* PASS:ssaoblur */
precision mediump float;
precision highp sampler2D;
in vec2 vUV;
uniform sampler2D uAO;
uniform highp sampler2D uDepth;
uniform vec2 uTexel;
uniform vec3 uBlur;                /* радиус, 1/сигма по глубине, near */
uniform vec4 uProjInfo;
${SEP ? 'uniform vec2 uDir;                 /* ось прохода: (1,0) или (0,1) */' : ''}
out float fragColor;
highp float viewZ(vec2 uv){
  highp float d = texture(uDepth, uv).r * 2.0 - 1.0;
  highp float n = uProjInfo.z, f = uProjInfo.w;
  return 2.0 * n * f / (f + n - d * (f - n));
}
void main(){
  highp float z0 = viewZ(vUV);
  float sum = 0.0, wsum = 0.0;
  int R = int(uBlur.x);
${SEP ? `  for (int i = -2; i <= 2; i++) {
    if (i < -R || i > R) continue;
    vec2 uv = vUV + uDir * (float(i) * dot(uDir, uTexel));
    /* Вес по перепаду глубины: через силуэт затенение не течёт */
    float dz = float(viewZ(uv) - z0) * uBlur.y;
    float w = exp(-dz * dz);
    sum += texture(uAO, uv).r * w; wsum += w;
  }` : `  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      if (x < -R || x > R || y < -R || y > R) continue;
      vec2 uv = vUV + vec2(float(x), float(y)) * uTexel;
      /* Вес по перепаду глубины: через силуэт затенение не течёт */
      float dz = float(viewZ(uv) - z0) * uBlur.y;
      float w = exp(-dz * dz);
      sum += texture(uAO, uv).r * w; wsum += w;
    }
  }`}
  fragColor = sum / max(wsum, 1e-4);
}`;

/* --- Свечение вокруг яркого: порог с уменьшением вдвое --------------------
   Один проход. Дальше размытие делает мип-цепочка, а складывает уровни
   проход тонмаппинга — отдельных проходов «вниз» и «вверх» нет.

   Тринадцать отсчётов вместо четырёх: уменьшение вдвое четырьмя отсчётами
   ловит одиночные яркие точки через кадр, и свечение мерцает на движении.
   Здесь четыре центральных квадрата по 0.125 и внешняя решётка 3×3 — фильтр
   шире шага, поэтому точка не может проскочить между отсчётами. */
export const FS_BLOOM = `#version 300 es
/* PASS:bloom */
precision mediump float;
in vec2 vUV;
uniform sampler2D uHDR;
uniform vec2 uTexel;               /* 1/размер буфера сцены */
uniform vec3 uThr;                 /* порог, полуколено, 1/(4·полуколено) */
out vec3 fragColor;
vec3 tap(vec2 o){ return texture(uHDR, vUV + o * uTexel).rgb; }
void main(){
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0,-2.0)), h = tap(vec2(0.0,-2.0)), i = tap(vec2(2.0,-2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0,-1.0)), m = tap(vec2(1.0,-1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625
           + (j + k + l + m) * 0.125;
  /* Порог с мягким коленом. Без колена граница свечения читается ступенькой
     на градиенте неба; без порога вовсе дневное небо превращается в молоко. */
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThr.x + uThr.y, 0.0, 2.0 * uThr.y);
  soft = soft * soft * uThr.z;
  float w = max(soft, br - uThr.x) / max(br, 1e-4);
  fragColor = col * w;
}`;

/* --- Отражения в экранном пространстве ---------------------------------
   Луч отражения марширует по буферу глубины, цвет берётся из буфера сцены
   ПРЕДЫДУЩЕГО кадра (главный проход этого кадра его ещё не чистил) и
   перепроецируется матрицей прошлого кадра — иначе на повороте камеры
   отражение уезжает вместе с ней.

   Нормаль восстанавливается из производных глубины, как в затенении: своего
   буфера нормалей нет. Для луж и стёкол этого хватает — они плоские, — а на
   мятом кузове отражение и так тонет в шероховатости.

   Что отдаётся наружу: rgb — цвет отражения, a — уверенность. Смешивает с
   небом главный проход, там же, где он берёт префильтр: только там известны
   настоящая шероховатость и Френель, и только там переход между отражением
   и небом не читается границей. */
export const FS_SSR = (STEPS, REFINE) => `#version 300 es
/* PASS:ssr */
precision mediump float;
precision highp sampler2D;
in vec2 vUV;
uniform highp sampler2D uDepth;    /* глубина этого кадра */
uniform sampler2D uColor;          /* цвет прошлого кадра, линейный HDR */
uniform sampler2D uMask;           /* глянцевость из прохода глубины */
uniform vec4 uProjInfo;            /* tanX, tanY, near, far */
uniform vec2 uTexel;               /* 1/размер половинного буфера */
uniform vec4 uParams;              /* дальность, толщина, край, порог маски */
uniform mat4 uReproj;              /* из вида этого кадра в клип прошлого */
out vec4 fragColor;

highp float viewZ(vec2 uv){
  highp float d = texture(uDepth, uv).r * 2.0 - 1.0;
  highp float n = uProjInfo.z, f = uProjInfo.w;
  return 2.0 * n * f / (f + n - d * (f - n));
}
highp vec3 viewPos(vec2 uv, highp float z){
  return vec3((uv * 2.0 - 1.0) * uProjInfo.xy * z, z);
}
vec2 project(highp vec3 p){ return 0.5 + 0.5 * vec2(p.xy / (p.z * uProjInfo.xy)); }

void main(){
  fragColor = vec4(0.0);
  /* Первая же выборка закрывает девяносто процентов кадра: марш по лучу
     стоит дороже всего остального вместе взятого. */
  if (texture(uMask, vUV).r < uParams.w) return;
  highp float zc = viewZ(vUV);
  if (zc >= uProjInfo.w * 0.99) return;             /* небо */
  highp vec3 p = viewPos(vUV, zc);
  highp float zr = viewZ(vUV + vec2(uTexel.x, 0.0)), zu = viewZ(vUV + vec2(0.0, uTexel.y));
  /* Нормаль из производных врёт на СИЛУЭТЕ: соседний отсчёт там лежит на
     другом объекте, крест даёт случайное направление, луч уходит куда попало
     и приносит уверенное отражение чужого. В отладочном показе это видно
     сразу — обводка по контуру всего блестящего. Разрыв глубины больше
     сотой доли расстояния — не поверхность, а край: отражать нечего. */
  if (abs(float(zr - zc)) > zc * 0.02 || abs(float(zu - zc)) > zc * 0.02) return;
  highp vec3 pr = viewPos(vUV + vec2(uTexel.x, 0.0), zr);
  highp vec3 pu = viewPos(vUV + vec2(0.0, uTexel.y), zu);
  vec3 N = normalize(cross(vec3(pr - p), vec3(pu - p)));
  if (N.z > 0.0) N = -N;                            /* нормаль смотрит на камеру */
  vec3 V = normalize(vec3(p));
  vec3 R = reflect(V, N);
  if (R.z < 0.02) return;                           /* луч уходит за камеру */

  /* Шаг растёт геометрически: у поверхности нужна точность, вдали — охват.
     Начальный сдвиг вдоль луча снимает самозатенение первым же отсчётом. */
  float far = uParams.x, thick = uParams.y;
  float t = far * 0.02, step = far * 0.02, grow = ${gf(QCFG.ssr.grow)};
  highp vec3 hit = vec3(0.0); float hitT = -1.0; vec2 hitUV = vec2(0.0);
  highp vec3 prevQ = p + R * t;
  for (int i = 0; i < ${STEPS}; i++) {
    t += step; step *= grow;
    if (t > far) break;
    highp vec3 q = p + R * t;
    if (q.z < uProjInfo.z) break;
    vec2 uv = project(q);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    highp float sz = viewZ(uv);
    /* Попадание: сцена оказалась БЛИЖЕ луча, но не настолько, чтобы луч
       прошёл далеко за спиной у геометрии — иначе отражается фон сквозь
       силуэт, и в луже висит кусок неба на месте машины. */
    if (sz < q.z && sz > q.z - thick - step) {
      /* Уточнение делением пополам: без него на пологом луче попадание
         промахивается на целый шаг и отражение съезжает. */
      highp vec3 a = prevQ, b = q;
      for (int k = 0; k < ${REFINE}; k++) {
        highp vec3 m = (a + b) * 0.5;
        vec2 mu = project(m);
        highp float mz = viewZ(mu);
        if (mz < m.z) b = m; else a = m;
      }
      hit = b; hitUV = project(b); hitT = t;
      break;
    }
    prevQ = q;
  }
  if (hitT < 0.0) return;

  /* Цвет берётся из ПРОШЛОГО кадра, поэтому точка попадания перепроецируется
     его матрицей: камера за кадр успевает повернуться. */
  highp vec4 cp = uReproj * vec4(hit, 1.0);
  if (cp.w <= 0.0) return;
  vec2 cu = 0.5 + 0.5 * cp.xy / cp.w;
  if (cu.x < 0.0 || cu.x > 1.0 || cu.y < 0.0 || cu.y > 1.0) return;

  /* Уверенность. Гаснет у краёв кадра — там отражать нечем; гаснет, когда
     луч летит на камеру — такой луч в экранном пространстве не проверить;
     гаснет к дальнему концу луча. Всё это, чтобы стык отражения с небом не
     читался границей. */
  float e = uParams.z;
  vec2 fe = smoothstep(vec2(0.0), vec2(e), cu) * (1.0 - smoothstep(vec2(1.0) - vec2(e), vec2(1.0), cu));
  float conf = fe.x * fe.y;
  conf *= smoothstep(0.0, 0.35, R.z);
  conf *= 1.0 - smoothstep(far * 0.75, far, hitT);
  fragColor = vec4(texture(uColor, cu).rgb, conf);
}`;

export const VS_GLOW = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj, uView;
uniform vec3 uPos; uniform vec2 uSize; uniform vec3 uRight, uUp;
out vec2 vUV;
void main(){
  vUV = aCorner;
  vec3 w = uPos + uRight * (aCorner.x * uSize.x) + uUp * (aCorner.y * uSize.y);
  gl_Position = uProj * uView * vec4(w, 1.0);
}`;

export const FS_GLOW = `#version 300 es
/* PASS:glow */
precision mediump float;
in vec2 vUV;
uniform vec4 uColor;
uniform float uHard, uMode;
out vec4 fragColor;
void main(){
  float r = length(vUV);
  float a = pow(clamp(1.0 - r, 0.0, 1.0), uHard);
  if (uMode > 0.5) fragColor = vec4(uColor.rgb, a * uColor.a);   /* тень: обычное смешивание */
  else fragColor = vec4(uColor.rgb * a * uColor.a, 1.0);         /* свечение: аддитивно */
}`;

/* Веса уровней мип-цепочки: геометрическая прогрессия, нормированная к
   единице. Считаются на JS и вклеиваются в шейдер числами — цикла по
   уровням в шейдере нет, а значит нет и динамического textureLod. */
export function bloomGLSL() {
  const K = QCFG.bloom, n = Math.max(1, K.levels | 0);
  const taps = Math.max(1, Math.min(n, K.taps | 0));
  /* Выборок меньше, чем уровней: фильтр LINEAR_MIPMAP_LINEAR смешивает два
     соседних уровня в ОДНОМ обращении, поэтому дробный уровень 0.5 — это
     полусумма нулевого и первого. Шесть уровней тремя выборками стоят вдвое
     дешевле, а спад свечения от центра остаётся тем же: тонмаппинг идёт по
     полному кадру 2880×1800, и каждая лишняя выборка там — пять миллионов
     обращений к памяти. */
  const w = []; let sum = 0;
  for (let i = 0; i < taps; i++) { const v = Math.pow(K.falloff, i * n / taps); w.push(v); sum += v; }
  let out = '';
  for (let i = 0; i < taps; i++) {
    const lod = (i + 0.5) * n / taps - 0.5;
    out += `  bl += textureLod(uBloom, vUV, ${lod.toFixed(2)}).rgb * ${(w[i] / sum).toFixed(5)};\n`;
  }
  return out + '  bl *= uBloomK;\n';
}

export function compile(gl, type, src, name) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Шейдер ' + name + ': ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}
export function program(gl, vs, fs, name) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, name + '.vs'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Программа ' + name + ': ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const nm = info.name.replace(/\[0\]$/, '');
    u[nm] = gl.getUniformLocation(p, info.name);
    if (info.size > 1) for (let k = 1; k < info.size; k++) u[nm + '[' + k + ']'] = gl.getUniformLocation(p, nm + '[' + k + ']');
  }
  return { p, u };
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let GLSL_SKY, VS_MAIN, FS_CUBE, FS_SKY, FS_SHADOW;
export function __init() {

  /* --- Модель неба: однократное рассеяние Рэлея и Ми ---------------------
     Луч зрения делится на отсчёты; в каждом считается, сколько света дошло от
     солнца (внутренний цикл — оптическая глубина к солнцу) и сколько из него
     рассеялось в сторону наблюдателя. Отсюда сами собой берутся синий зенит
     (Рэлей сильнее в коротких волнах), красный закат (длинный путь через
     атмосферу выедает синеву) и белёсый ореол вокруг солнца (Ми).

     Это единственное место, где живёт формула неба. Из неё собирается GLSL для
     кубмапы, и по ней же считаются сферические гармоники — но на CPU, чтобы
     не читать обратно то, что нарисовали. Значит, формула существует в двух
     исполнениях, и их совпадение проверяется тестом tools/sky-test.mjs. */
  GLSL_SKY = (() => {
    const K = QCFG.sky;
    return `
  const vec3  BETA_R = ${gv3(K.betaR)};
  const float BETA_M = ${gf(K.betaM)};
  const float H_R = ${gf(K.hR)}, H_M = ${gf(K.hM)};
  const float R_EARTH = ${gf(K.rEarth)}, R_ATMO = ${gf(K.rAtmo)};
  const float G_MIE = ${gf(K.gMie)}, SUN_I = ${gf(K.sunI)}, MS_K = ${gf(K.msK)};
  const vec3  GROUND_A = ${gv3(K.groundAlbedo)};
  const vec3  NIGHT_Z = ${gv3(K.night.zenith)}, NIGHT_H = ${gv3(K.night.horizon)};

  /* расстояние до верхней границы атмосферы вдоль луча */
  float atmoFar(vec3 o, vec3 d){
    float b = dot(o, d), c = dot(o, o) - R_ATMO * R_ATMO;
    float disc = b * b - c;
    return disc <= 0.0 ? 0.0 : -b + sqrt(disc);
  }
  /* луч уходит в землю? тогда точка в её тени и не светит */
  bool hitsGround(vec3 o, vec3 d){
    float b = dot(o, d), c = dot(o, o) - R_EARTH * R_EARTH;
    float disc = b * b - c;
    return disc > 0.0 && (-b - sqrt(disc)) > 0.0;
  }
  vec3 inscatter(vec3 dir, vec3 sun){
    vec3 o = vec3(0.0, R_EARTH + 200.0, 0.0);
    float far = atmoFar(o, dir);
    if (far <= 0.0) return vec3(0.0);
    float seg = far / ${K.viewSteps}.0;
    vec3 sumR = vec3(0.0), sumM = vec3(0.0);
    float odR = 0.0, odM = 0.0;
    for (int i = 0; i < ${K.viewSteps}; i++){
      vec3 p = o + dir * (seg * (float(i) + 0.5));
      float h = length(p) - R_EARTH;
      float dr = exp(-h / H_R) * seg, dm = exp(-h / H_M) * seg;
      odR += dr; odM += dm;
      if (hitsGround(p, sun)) continue;
      float ls = atmoFar(p, sun) / ${K.lightSteps}.0;
      float lR = 0.0, lM = 0.0;
      for (int j = 0; j < ${K.lightSteps}; j++){
        float hq = length(p + sun * (ls * (float(j) + 0.5))) - R_EARTH;
        lR += exp(-hq / H_R) * ls; lM += exp(-hq / H_M) * ls;
      }
      vec3 att = exp(-(BETA_R * (odR + lR) + BETA_M * 1.1 * (odM + lM)));
      sumR += att * dr; sumM += att * dm;
    }
    float mu = dot(dir, sun), mu2 = mu * mu;
    float pR = 0.05968310 * (1.0 + mu2);                       /* 3/(16pi) */
    float g2 = G_MIE * G_MIE;
    float pM = 0.11936620 * ((1.0 - g2) * (1.0 + mu2)) /
               ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * G_MIE * mu, 1e-4), 1.5));  /* 3/(8pi) */
    /* Приближение многократного рассеяния. Однократное даёт слишком красный
       горизонт: там, где путь через атмосферу длинный, синева выедается
       начисто, а в действительности она возвращается переотражениями.
       Насыщение (1 − exp(−betaR·od)) даёт нужную форму — у зенита почти ноль,
       у горизонта ровный белый, — и стоит одного exp, потому что оптическая
       глубина уже посчитана. */
    vec3 ms = (vec3(1.0) - exp(-BETA_R * odR)) * (MS_K * SUN_I * max(sun.y * 1.4 + 0.06, 0.0));
    return (sumR * BETA_R * pR + sumM * BETA_M * pM) * SUN_I + ms;
  }
  /* Небо целиком: рассеяние, ночная подложка и земля под горизонтом.

     Для направлений вниз луч зрения ушёл бы под поверхность, плотность
     атмосферы там растёт экспоненциально и интеграл вырождается: в GLSL
     получался ноль, в JS — NaN (0 · Infinity). Поэтому нижнюю полусферу
     считаем по зеркальному направлению — это и есть дымка над далёкой землёй,
     которая вблизи горизонта неотличима от неба, — и подмешиваем к ней саму
     землю, освещённую солнцем и небом.

     Земля нужна не для картинки, её закрывает застройка, а для окружения: из
     нижней полусферы берутся отражения и рассеянный свет снизу. */
  vec3 skyColor(vec3 dir, vec3 sun, float nightK){
    vec3 up = dir.y < 0.0 ? vec3(dir.x, -dir.y, dir.z) : dir;
    vec3 col = inscatter(up, sun);
    col += mix(NIGHT_H, NIGHT_Z, clamp(dir.y * 0.5 + 0.5, 0.0, 1.0)) * nightK;
    if (dir.y < 0.0){
      vec3 g = GROUND_A * (max(sun.y, 0.0) * ${gf(QCFG.sky.groundSun)} + ${gf(QCFG.sky.groundSky)});
      col = mix(col, g, clamp(-dir.y * 2.5, 0.0, 1.0) * 0.85);
    }
    return max(col, vec3(0.0));
  }`;
  })();

  VS_MAIN = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNor;
  layout(location=2) in vec2 aUV;
  layout(location=3) in vec3 aCol;
  layout(location=4) in float aEmis;
  layout(location=5) in float aPart;
  layout(location=6) in float aGloss;
  uniform mat4 uProj, uView, uModel;
  uniform mat4 uBones[20];
  uniform float uSkin;
  uniform vec3 uWind;                       /* xy — вектор порыва в метрах, z — время */
  out highp vec3 vWorld; out highp vec2 vUV;
  out vec3 vNor; out vec3 vCol; out float vEmis; out float vGloss;
  void main(){
    mat4 M = uSkin > 0.5 ? uBones[int(aPart)] : uModel;
    vec4 wp = M * vec4(aPos, 1.0);
    /* Ветер. У статичной зелени aPart — вес качания (0 у земли, ~0.3 у макушки);
       у персонажей тот же атрибут значит номер кости, поэтому ветку закрывает
       uSkin. Кора, стволы и ветви веса не получают — качаются только свободные
       карты, так что разойтись по швам нечему. */
    if (uSkin < 0.5 && aPart > 0.001) {
      float ph = wp.x * 0.42 + wp.z * 0.31;
      float g = sin(uWind.z * 1.15 + ph) * 0.66 + sin(uWind.z * 2.70 + ph * 2.3) * 0.34;
      wp.xz += uWind.xy * aPart * (0.55 + 0.45 * g);
      wp.y -= length(uWind.xy) * aPart * 0.28 * abs(g);   /* карта не тянется, а «приседает» */
    }
    vWorld = wp.xyz;
    vNor = mat3(M) * aNor;
    /* цвета вершин авторские, в sRGB — переводим в линейное, как и albedo */
    vUV = aUV; vCol = pow(max(aCol, vec3(0.0)), vec3(${QCFG.color.gamma.toFixed(2)})); vEmis = aEmis; vGloss = aGloss;
    gl_Position = uProj * uView * wp;
  }`;

  FS_CUBE = `#version 300 es
  /* PASS:env */
  precision highp float;
  in vec2 vP;
  uniform vec3 uFaceO, uFaceU, uFaceV;   /* базис грани куба */
  uniform vec3 uSunDir;
  uniform float uNight;
  out vec4 fragColor;
  ${GLSL_SKY}
  void main(){
    fragColor = vec4(skyColor(normalize(uFaceO + uFaceU * vP.x + uFaceV * vP.y), uSunDir, uNight), 1.0);
  }`;

  FS_SKY = `#version 300 es
  /* PASS:sky */
  precision mediump float;
  precision mediump samplerCube;
  in highp vec3 vDir;
  uniform highp vec3 uEye;
  uniform vec3 uSunDir, uSunTint, uMoonDir;
  uniform samplerCube uSky;
  uniform float uCloud, uTime, uNight;
  out vec4 fragColor;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y);
  }
  /* Четыре октавы вместо пяти: пятая давала рябь мельче пикселя, а стоила
     восьми хешей. Считается только там, где небо видно. */
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  void main(){
    vec3 d = normalize(vDir - uEye);
    vec3 col = texture(uSky, d).rgb;
    float sd = max(dot(d, uSunDir), 0.0);
    /* Диск солнца и луна: в кубмапе 128² они размазались бы в пятно, поэтому
       считаются здесь, аналитически, поверх выборки. */
    col += uSunTint * pow(sd, ${gf(QCFG.sky.disk.pow)}) * ${gf(QCFG.sky.disk.k)};
    if (uNight > 0.01) {
      float md = max(dot(d, uMoonDir), 0.0);
      col += ${gv3(QCFG.sky.moon.col)} * uNight *
             (smoothstep(${gf(QCFG.sky.moon.cos)}, 1.0, md) * ${gf(QCFG.sky.moon.k)} +
              pow(md, ${gf(QCFG.sky.moon.glowPow)}) * 0.2);
      vec3 sp = floor(d * ${gf(QCFG.sky.stars.dens)});
      float st = h21(sp.xy + sp.z * 37.0);
      st = pow(max(st - 0.984, 0.0) * 62.0, 2.0);
      col += vec3(st) * uNight * ${gf(QCFG.sky.stars.k)} * smoothstep(0.0, 0.25, d.y);
    }
    if (d.y > 0.0) {
      /* облачный слой: плоскость над головой, проекция направления взгляда */
      float dy = max(d.y, 0.035);
      vec2 cp = d.xz / dy * ${gf(QCFG.sky.cloud.plane)} + vec2(uTime * ${gf(QCFG.sky.cloud.speed[0])}, uTime * ${gf(QCFG.sky.cloud.speed[1])});
      float n = fbm(cp * ${gf(QCFG.sky.cloud.lo)});
      n = smoothstep(0.52 - uCloud * 0.22, 0.86, n + uCloud * 0.16);
      float edge = fbm(cp * ${gf(QCFG.sky.cloud.hi)}) * 0.5 + 0.5;
      float cov = n * smoothstep(0.0, 0.16, d.y);
      /* Облака красит то же небо: тень снизу, освещённая сторона сверху,
         подсветка со стороны солнца. Своих палитр у облаков больше нет. */
      vec3 lo = texture(uSky, vec3(d.x, -0.3, d.z)).rgb;
      vec3 hi = texture(uSky, vec3(0.0, 1.0, 0.0)).rgb;
      vec3 cloud = mix(lo * 0.8, mix(hi, uSunTint, 0.30) * (0.7 + 0.6 * edge), edge)
                 + uSunTint * pow(sd, 5.0) * ${gf(QCFG.sky.cloud.sunlit)};
      col = mix(col, cloud, cov * 0.85);
    }
    fragColor = vec4(col, 1.0);
  }`;

  /* Та же программа под меткой прохода теней: оснастка замера различает проходы
     по метке в исходнике, и без отдельной метки тени попали бы в «глубину». */
  FS_SHADOW = FS_DEPTH.replace('/* PASS:depth */', '/* PASS:shadow */');
}
