/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «8. Персонажи: модели со скелетом», строки 6370–6929.
   ===================================================================== */
import { TAU, clamp, lerp, m4, m4compose, m4mul } from '../core/util.js';
import { S } from '../game/state.js';
import { GL } from './gl.js';
import { Mesh } from './mesh.js';
import { R3, drawMesh } from './renderer.js';
import { TX } from './textures.js';


/* ------------------------------------------------------------------ */
/* 8. Персонажи: модели со скелетом                                     */
/* ------------------------------------------------------------------ */
/* Кости. Геометрия каждой части нарисована в системе своей кости и
   свисает вниз от сустава — так конечности гнутся в нужных местах.     */
export const BONE = {
  HIP: 0, SPINE: 1, CHEST: 2, HEAD: 3, CAP: 4,
  ARMLU: 5, ARMLD: 6, HANDL: 7, ARMRU: 8, ARMRD: 9, HANDR: 10,
  LEGLU: 11, LEGLD: 12, FOOTL: 13, LEGRU: 14, LEGRD: 15, FOOTR: 16, ACC: 17
};
export const NBONE = 18;
export const BONEBUF = new Float32Array(20 * 16);
export const BONES = [];

/* размеры скелета в метрах: рост ≈ 1.76 при основании таза 0.96 */
export const RIG = {
  root: 0.96, sit: 0.60,
  spine: 0.06, chest: 0.24, neck: 0.24,      /* подъёмы суставов корпуса */
  shoulder: [0.200, 0.19], upperArm: 0.30, foreArm: 0.27,
  hip: [0.105, -0.06], thigh: 0.44, shin: 0.38
};

/* Походки. Одна строка — один характер.
   vmax — скорость, на которой походка выкручена до предела (нормировка speed)
   cad  — сколько фазы набегает на метр пути (частота шага)
   amp/arm — размах бедра и руки, knee — сгиб колена, elbow — сгиб локтя
   bob/roll/sway — вертикаль, боковой крен, раскачка таза
   lean — наклон вперёд на полной скорости, duck — присед, splay — разножка
   toe  — насколько жёстко отталкивается носком, turn — скорость доворота корпуса */
export const GAITS = {
  norm:   { vmax: 3.4, cad: 3.2, amp: 0.72, arm: 0.70, knee: 1.00, bob: 0.026, roll: 0.035, sway: 0.05, lean: 0.12, duck: 0,    toe: 1.00, elbow: 0.55, splay: 0.02, turn: 9 },
  oleg:   { vmax: 7.2, cad: 2.2, amp: 1.00, arm: 0.95, knee: 1.12, bob: 0.030, roll: 0.038, sway: 0.05, lean: 0.14, duck: 0,    toe: 1.05, elbow: 0.55, splay: 0.02, turn: 12 },
  sanya:  { vmax: 3.4, cad: 3.1, amp: 0.78, arm: 0.66, knee: 1.00, bob: 0.030, roll: 0.040, sway: 0.07, lean: 0.10, duck: 0,    toe: 0.95, elbow: 0.50, splay: 0.06, turn: 9 },
  hool:   { vmax: 3.0, cad: 2.5, amp: 0.60, arm: 0.40, knee: 0.85, bob: 0.050, roll: 0.105, sway: 0.16, lean: 0.00, duck: 0.06, toe: 0.65, elbow: 0.30, splay: 0.22, turn: 7 },   /* вразвалку */
  gran:   { vmax: 1.2, cad: 5.2, amp: 0.32, arm: 0.22, knee: 0.62, bob: 0.012, roll: 0.022, sway: 0.02, lean: 0.30, duck: 0.11, toe: 0.45, elbow: 0.80, splay: 0.07, turn: 5 },   /* мелкий шаг */
  vanya:  { vmax: 3.0, cad: 4.6, amp: 0.58, arm: 0.62, knee: 1.00, bob: 0.030, roll: 0.030, sway: 0.04, lean: 0.20, duck: 0,    toe: 1.10, elbow: 0.62, splay: 0.05, turn: 11 },  /* невысокий, берёт частотой */
  kostya: { vmax: 4.2, cad: 2.8, amp: 0.95, arm: 0.98, knee: 1.15, bob: 0.036, roll: 0.045, sway: 0.06, lean: 0.24, duck: 0,    toe: 1.20, elbow: 0.42, splay: 0.03, turn: 10 },  /* размашисто и торопливо */
  boris:  { vmax: 2.6, cad: 2.9, amp: 0.52, arm: 0.34, knee: 0.80, bob: 0.034, roll: 0.070, sway: 0.12, lean: 0.06, duck: 0.04, toe: 0.70, elbow: 0.45, splay: 0.16, turn: 6 },   /* с достоинством */
  guard:  { vmax: 4.6, cad: 3.0, amp: 0.86, arm: 0.80, knee: 1.10, bob: 0.034, roll: 0.040, sway: 0.05, lean: 0.26, duck: 0,    toe: 1.10, elbow: 0.40, splay: 0.05, turn: 8 },
  client: { vmax: 2.8, cad: 3.3, amp: 0.62, arm: 0.52, knee: 0.95, bob: 0.024, roll: 0.030, sway: 0.04, lean: 0.10, duck: 0,    toe: 0.95, elbow: 0.60, splay: 0.03, turn: 8 }
};
export const GAIT = k => GAITS[k] || GAITS.norm;
/* Холостые движения в покое: 0 — глянуть на часы, 1 — размять шею,
   2 — поправить сумку, 3 — переступить с ноги на ногу. len — длительность, с. */
export const IDLES = [{ len: 2.2 }, { len: 1.8 }, { len: 1.5 }, { len: 1.2 }];

export function makeCharMesh(gl, pal) {
  const m = new Mesh();
  const skin = pal.skin, shirt = pal.shirt, pants = pal.pants, hair = pal.hair;
  const bw = pal.build === undefined ? 1 : pal.build;        /* полнота */
  const sh = pal.shoes || [.16, .15, .19];
  const sleeve = pal.sleeve || shirt;
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const CLOTH = 0.05, SKIN_G = 0.2, BOOT = 0.3;

  /* ---------- таз и корпус ---------- */
  m.bevelBox(0, -0.13, 0, 0.30 * bw, 0.24, 0.20 * bw, pants,
    { bev: 0.045, r: 0.05, cs: 2, part: BONE.HIP, gloss: CLOTH, uv: 0.6, bottom: true });
  /* ремень */
  m.bevelBox(0, 0.075, 0, 0.305 * bw + 0.008, 0.045, 0.205 * bw + 0.008, pal.belt || mul(pants, 0.55),
    { bev: 0.012, r: 0.05, cs: 2, part: BONE.HIP, gloss: 0.35, skipTop: true });
  if (pal.buckle) m.bevelBox(0, 0.08, 0.104 * bw, 0.05, 0.035, 0.02, pal.buckle,
    { bev: 0.008, r: 0.008, cs: 1, part: BONE.HIP, gloss: 0.8 });

  /* живот: слегка сужается кверху, юбка для тех, кто в юбке */
  if (pal.skirt) {
    m.bevelBox(0, -0.30, 0, 0.34 * bw, 0.42, 0.26 * bw, pal.skirt,
      { bev: 0.03, r: 0.07, cs: 2, part: BONE.HIP, gloss: CLOTH, uv: 0.5, taper: [0.78, 0.78], skipTop: true, bottom: true });
  }
  m.bevelBox(0, 0, 0, 0.32 * bw, 0.25, 0.21 * bw, shirt,
    { bev: 0.04, r: 0.06, cs: 2, part: BONE.SPINE, gloss: CLOTH, uv: 0.6, taper: [1.06, 1.04], skipTop: true });
  /* грудь и плечевой пояс */
  m.bevelBox(0, -0.02, 0, 0.35 * bw, 0.30, 0.23 * bw, shirt,
    { bev: 0.045, r: 0.07, cs: 2, part: BONE.CHEST, gloss: CLOTH, uv: 0.6, taper: [1.02, 0.94], skipTop: true });
  for (const sx of [-1, 1])
    m.ellipsoid(sx * 0.180 * bw, 0.192, 0, 0.078, 0.076, 0.098, 8, 5, shirt, { part: BONE.CHEST, gloss: CLOTH });
  /* воротник */
  m.bevelBox(0, 0.215, 0, 0.155, 0.045, 0.135, pal.collar || mul(shirt, 0.82),
    { bev: 0.012, r: 0.04, cs: 2, part: BONE.CHEST, gloss: CLOTH, skipTop: true });

  if (pal.vest) {                        /* сигнальный жилет: цельная манишка */
    const v = pal.vest, refl = [1.45, 1.45, 1.5];
    m.bevelBox(0, -0.035, 0, 0.335 * bw, 0.275, 0.235 * bw, v,
      { bev: 0.02, r: 0.07, cs: 2, part: BONE.CHEST, gloss: 0.22, uv: 0.5, taper: [1.0, 0.96], skipTop: true });
    for (const y of [0.035, 0.135])       /* световозвращающие полосы вокруг */
      m.bevelBox(0, y, 0, 0.342 * bw, 0.038, 0.242 * bw, refl,
        { bev: 0.005, r: 0.07, cs: 2, part: BONE.CHEST, gloss: 0.5, skipTop: true });
    m.box(0, -0.02, 0.120 * bw, 0.014, 0.245, 0.008, mul(v, 0.55), { part: BONE.CHEST, gloss: 0.3 });  /* молния */
    for (const sx of [-1, 1])             /* плечевые лямки */
      m.box(sx * 0.105 * bw, 0.235, 0, 0.070, 0.02, 0.19 * bw, v, { part: BONE.CHEST, gloss: 0.22 });

    /* Название конторы по спине. Буквы набраны трубками по ломаной: в этой
       игре ни одного загруженного шрифта нет, а на жилете надпись нужна. */
    if (pal.vestText) {
      const T = pal.vestText, zb = -0.1245 * bw;
      /* Спина смотрит в −Z, и для взгляда оттуда экранное «вправо» — это мир −X.
         Поэтому всю раскладку зеркалим по x: одновременно разворачивается и
         порядок букв, и форма каждой из них, — и надпись читается слева
         направо, как ей положено. */
      const st = (pts, r) => m.tube(pts.map(q => [-q[0], q[1], zb]), r || 0.0055, 4, T,
        { part: BONE.CHEST, gloss: 0.4 });
      /* Одна буква рисуется в своей коробке x..x+w, y..y+h. */
      const glyph = (ch, x, y, w, h, r) => {
        const xm = x + w / 2, x1 = x + w, y1 = y + h, ym = y + h / 2;
        if (ch === 'О') st([[x + w * .28, y1], [x + w * .72, y1], [x1, y1 - h * .28], [x1, y + h * .28],
                            [x + w * .72, y], [x + w * .28, y], [x, y + h * .28], [x, y1 - h * .28], [x + w * .28, y1]], r);
        if (ch === 'В') { st([[x, y], [x, y1]], r);
          st([[x, y1], [x + w * .68, y1], [x1, y1 - h * .17], [x + w * .68, ym], [x, ym]], r);
          st([[x, ym], [x + w * .78, ym], [x1, ym - h * .22], [x + w * .78, y], [x, y]], r); }
        if (ch === 'Е') { st([[x1, y1], [x, y1], [x, y], [x1, y]], r); st([[x, ym], [x + w * .74, ym]], r); }
        if (ch === 'С') st([[x1, y1 - h * .16], [x + w * .74, y1], [x + w * .26, y1], [x, y1 - h * .30],
                            [x, y + h * .30], [x + w * .26, y], [x + w * .74, y], [x1, y + h * .16]], r);
        if (ch === 'Т') { st([[x, y1], [x1, y1]], r); st([[xm, y1], [xm, y]], r); }
        if (ch === '«') { st([[x + w * .8, y1], [x + w * .2, ym], [x + w * .8, y]], r); }
        if (ch === '»') { st([[x + w * .2, y1], [x + w * .8, ym], [x + w * .2, y]], r); }
      };
      const line = (text, cx, y, w, h, gap, r) => {
        const total = text.length * w + (text.length - 1) * gap;
        let x = cx - total / 2;
        for (const ch of text) { glyph(ch, x, y, w, h, r); x += w + gap; }
      };
      /* «ООО» мелко над верхней полосой, «ВЕСТ» крупно между полосами */
      line('ООО', 0, 0.182, 0.030, 0.040, 0.010, 0.0042);
      line('«ВЕСТ»', 0, 0.082, 0.038, 0.046, 0.008, 0.0055);
    }
  }

  /* ---------- портупея поверх жилета ---------- */
  if (pal.harness) {
    const H = pal.harness, HD = mul(H, 0.82);
    /* через грудь наискось от правого плеча к левому боку */
    m.tube([[0.118 * bw, 0.225, -0.02], [0.070, 0.115, 0.108], [-0.020, 0.020, 0.120],
            [-0.120, -0.065, 0.070], [-0.158 * bw, -0.085, -0.05]], 0.017, 5, H,
      { part: BONE.CHEST, gloss: 0.24 });
    /* и по спине — вместе с ремнём сумки получается крест */
    m.tube([[0.118 * bw, 0.225, -0.02], [0.062, 0.130, -0.112], [-0.040, 0.030, -0.124],
            [-0.132, -0.055, -0.078]], 0.015, 5, HD, { part: BONE.CHEST, gloss: 0.24 });
    /* пряжка на груди и подсумок под мышкой */
    m.bevelBox(0.028, 0.035, 0.122 * bw, 0.058, 0.042, 0.020, pal.buckle || [.72, .74, .78],
      { bev: 0.006, r: 0.008, cs: 1, part: BONE.CHEST, gloss: 0.75 });
    m.bevelBox(-0.098, -0.060, 0.104 * bw, 0.058, 0.090, 0.038, HD,
      { bev: 0.008, r: 0.014, cs: 2, part: BONE.CHEST, gloss: 0.2 });
  }

  /* ---------- шея и голова ---------- */
  m.cyl(0, -0.02, 0, 0.048, 0.10, 8, mul(skin, 0.9), { part: BONE.HEAD, cap: false, gloss: SKIN_G });
  m.ellipsoid(0, 0.155, 0.004, 0.090, 0.118, 0.100, 12, 8, skin, { part: BONE.HEAD, gloss: SKIN_G });
  /* челюсть и подбородок */
  m.ellipsoid(0, 0.094, 0.006, 0.070, 0.050, 0.076, 10, 5, skin, { part: BONE.HEAD, gloss: SKIN_G });
  /* нос */
  m.bevelBox(0, 0.112, 0.086, 0.024, 0.046, 0.030, skin, { bev: 0.007, r: 0.007, cs: 1, part: BONE.HEAD, gloss: SKIN_G });
  /* уши */
  for (const sx of [-1, 1])
    m.ellipsoid(sx * 0.089, 0.146, -0.004, 0.015, 0.030, 0.021, 6, 4, skin, { part: BONE.HEAD, gloss: SKIN_G });
  /* глаза: белок и зрачок, чуть утоплены */
  for (const sx of [-1, 1]) {
    m.ellipsoid(sx * 0.037, 0.150, 0.076, 0.021, 0.014, 0.014, 7, 4, [.93, .92, .91], { part: BONE.HEAD, gloss: 0.55 });
    m.ellipsoid(sx * 0.039, 0.148, 0.086, 0.0085, 0.0095, 0.006, 6, 3, pal.eyes || [.16, .13, .12], { part: BONE.HEAD, gloss: 0.7 });
    m.box(sx * 0.038, 0.165, 0.079, 0.040, 0.009, 0.014, pal.brow || mul(hair, 0.8), { part: BONE.HEAD, gloss: 0.05 });
  }
  /* рот */
  m.box(0, 0.086, 0.082, 0.044, 0.009, 0.012, [.5, .27, .26], { part: BONE.HEAD, gloss: 0.25 });
  if (pal.beard) {
    m.bevelBox(0, 0.048, 0.014, 0.118, 0.066, 0.102, pal.beard,
      { bev: 0.012, r: 0.03, cs: 2, part: BONE.HEAD, gloss: 0.04, skipTop: true });
  }

  /* ---------- волосы, шапка, платок ---------- */
  if (pal.helmet) {                      /* кожаный шлем с наушниками и подбородочным ремнём */
    const H = pal.helmet, HD = mul(H, 0.76);
    m.ellipsoid(0, 0.156, -0.006, 0.103, 0.126, 0.113, 12, 6, H, { part: BONE.CAP, cut: 0.14, gloss: 0.26 });
    m.bevelBox(0, 0.060, -0.086, 0.176, 0.100, 0.060, H,
      { bev: 0.014, r: 0.03, cs: 2, part: BONE.CAP, gloss: 0.26, skipTop: true });     /* назатыльник */
    for (const sx of [-1, 1]) {
      m.ellipsoid(sx * 0.096, 0.124, -0.010, 0.024, 0.050, 0.046, 7, 4, HD, { part: BONE.CAP, gloss: 0.28 });
      m.tube([[sx * 0.094, 0.096, -0.006], [sx * 0.084, 0.040, 0.018], [sx * 0.046, 0.012, 0.044]],
        0.008, 4, HD, { part: BONE.CAP, gloss: 0.22 });                                /* ремешок */
      m.box(sx * 0.090, 0.058, 0.004, 0.022, 0.024, 0.016, pal.buckle || [.72, .74, .78],
        { part: BONE.CAP, gloss: 0.72 });                                              /* застёжка */
    }
  } else if (pal.cap) {
    m.ellipsoid(0, 0.153, -0.004, 0.099, 0.122, 0.108, 12, 6, pal.cap, { part: BONE.CAP, cut: 0.15, gloss: 0.12 });
    m.bevelBox(0, 0.168, -0.004, 0.198, 0.020, 0.216, mul(pal.cap, 0.92),
      { bev: 0.006, r: 0.09, cs: 3, part: BONE.CAP, gloss: 0.14, skipTop: true });   /* околыш */
    m.bevelBox(0, 0.170, 0.108, 0.150, 0.014, 0.090, mul(pal.cap, 0.8),
      { bev: 0.005, r: 0.04, cs: 2, part: BONE.CAP, gloss: 0.16 });   /* козырёк */
  } else if (pal.scarf) {
    m.ellipsoid(0, 0.150, -0.006, 0.104, 0.124, 0.112, 12, 6, pal.scarf, { part: BONE.CAP, cut: 0.12, gloss: 0.1 });
    for (const sx of [-1, 1])            /* щёчные отвороты */
      m.bevelBox(sx * 0.088, 0.070, -0.014, 0.034, 0.110, 0.150, pal.scarf,
        { bev: 0.01, r: 0.02, cs: 2, part: BONE.CAP, gloss: 0.1, skipTop: true });
    m.bevelBox(0, 0.096, -0.088, 0.150, 0.090, 0.048, pal.scarf,
      { bev: 0.012, r: 0.03, cs: 2, part: BONE.CAP, gloss: 0.1, skipTop: true });   /* затылок */
    m.bevelBox(0, 0.040, 0.052, 0.062, 0.050, 0.048, pal.scarf,
      { bev: 0.012, r: 0.02, cs: 2, part: BONE.CAP, gloss: 0.1 });                  /* узелок под подбородком */
  } else {
    m.ellipsoid(0, 0.152, -0.004, 0.097, 0.119, 0.105, 12, 6, hair, { part: BONE.CAP, cut: pal.bald ? 0.55 : 0.20, gloss: pal.bald ? 0.30 : 0.14 });
    if (!pal.bald) m.bevelBox(0, 0.12, -0.072, 0.165, 0.10, 0.055, hair,
      { bev: 0.014, r: 0.03, cs: 2, part: BONE.CAP, gloss: 0.14, skipTop: true });
  }

  /* ---------- очки на лбу и гарнитура ---------- */
  if (pal.goggles) {                     /* защитные очки, сдвинутые на лоб: линза и резинка */
    const lens = pal.lens || [.74, .80, .62];
    m.bevelBox(0, 0.186, 0.080, 0.152, 0.042, 0.058, lens,
      { bev: 0.010, r: 0.022, cs: 2, part: BONE.CAP, gloss: 0.75 });
    m.tube([[-0.080, 0.206, 0.046], [-0.096, 0.212, -0.030], [0, 0.216, -0.104], [0.096, 0.212, -0.030], [0.080, 0.206, 0.046]],
      0.011, 5, pal.goggles, { part: BONE.CAP, gloss: 0.2 });
  }
  if (pal.earbud) {                      /* гарнитура: капля в ухе и короткий провод по скуле */
    m.ellipsoid(0.093, 0.146, 0.002, 0.016, 0.019, 0.016, 6, 4, pal.earbud, { part: BONE.HEAD, gloss: 0.45 });
    m.tube([[0.094, 0.130, 0.000], [0.086, 0.090, -0.014], [0.068, 0.048, -0.018]], 0.005, 4,
      pal.earbud, { part: BONE.HEAD, gloss: 0.3 });
  }

  /* ---------- руки ---------- */
  /* В майке рукавов нет: плечо и предплечье — кожа, а не ткань. */
  const armU = pal.tank ? skin : shirt, armD = pal.tank ? skin : sleeve;
  const armG = pal.tank ? SKIN_G : CLOTH;
  for (const [u, d, hnd] of [[BONE.ARMLU, BONE.ARMLD, BONE.HANDL], [BONE.ARMRU, BONE.ARMRD, BONE.HANDR]]) {
    m.ellipsoid(0, 0.005, 0, 0.055, 0.05, 0.058, 8, 4, armU, { part: u, gloss: armG });
    m.bevelBox(0, -0.30, 0, 0.098, 0.31, 0.104, armU,
      { bev: 0.022, r: 0.03, cs: 2, part: u, gloss: armG, uv: 0.5, taper: [1.06, 1.06], skipTop: true });
    m.bevelBox(0, -0.27, 0, 0.084, 0.28, 0.088, armD,
      { bev: 0.02, r: 0.028, cs: 2, part: d, gloss: armG, uv: 0.5, taper: [1.14, 1.14], skipTop: true });
    if (pal.wraps) m.bevelBox(0, -0.255, 0, 0.092, 0.150, 0.096, pal.wraps,
      { bev: 0.012, r: 0.028, cs: 2, part: d, gloss: 0.07, skipTop: true });   /* бинты на предплечье */
    if (pal.cuff && !pal.tank) m.bevelBox(0, -0.275, 0, 0.09, 0.03, 0.094, pal.cuff,
      { bev: 0.006, r: 0.028, cs: 2, part: d, gloss: 0.12, skipTop: true });
    /* кисть: ладонь и обобщённые пальцы */
    m.ellipsoid(0, -0.045, 0.004, 0.040, 0.048, 0.026, 7, 4, skin, { part: hnd, gloss: SKIN_G });
    m.bevelBox(0, -0.115, 0.004, 0.062, 0.075, 0.042, skin,
      { bev: 0.012, r: 0.018, cs: 2, part: hnd, gloss: SKIN_G, skipTop: true });
    /* перчатка без пальцев: ладонь закрыта, накладка на тыльной стороне */
    if (pal.gloves) {
      m.bevelBox(0, -0.062, 0.004, 0.048, 0.070, 0.034, pal.gloves,
        { bev: 0.010, r: 0.016, cs: 2, part: hnd, gloss: 0.20 });
      m.bevelBox(0, -0.058, -0.018, 0.042, 0.058, 0.014, mul(pal.gloves, 1.35),
        { bev: 0.006, r: 0.012, cs: 2, part: hnd, gloss: 0.32 });
    }
  }

  /* ---------- ноги ---------- */
  const LEGS = [[BONE.LEGLU, BONE.LEGLD, BONE.FOOTL], [BONE.LEGRU, BONE.LEGRD, BONE.FOOTR]];
  for (let li = 0; li < LEGS.length; li++) {
    const [u, d, f] = LEGS[li];
    m.bevelBox(0, -0.45, 0, 0.145 * bw, 0.46, 0.155 * bw, pants,
      { bev: 0.028, r: 0.045, cs: 2, part: u, gloss: CLOTH, uv: 0.5, taper: [0.86, 0.88], skipTop: true });
    m.bevelBox(0, -0.40, -0.004, 0.122 * bw, 0.41, 0.132 * bw, pants,
      { bev: 0.024, r: 0.04, cs: 2, part: d, gloss: CLOTH, uv: 0.5, taper: [0.86, 0.9], skipTop: true });
    /* ботинок: подошва, союзка, задник */
    m.bevelBox(0, -0.075, 0.052, 0.115, 0.085, 0.245, sh,
      { bev: 0.018, r: 0.035, cs: 2, part: f, gloss: BOOT, skipTop: true });
    m.bevelBox(0, -0.088, 0.048, 0.122, 0.028, 0.255, mul(sh, 0.55),
      { bev: 0.008, r: 0.035, cs: 2, part: f, gloss: 0.1, skipTop: true, bottom: true });
    m.bevelBox(0, -0.028, -0.038, 0.108, 0.075, 0.10, sh,
      { bev: 0.014, r: 0.03, cs: 2, part: f, gloss: BOOT });
    /* ремешки на бедре и наколенник — то, что носят, когда лазают */
    if (pal.thighStraps) for (const y of [-0.30, -0.40])
      m.bevelBox(0, y, 0, 0.150 * bw, 0.024, 0.160 * bw, pal.thighStraps,
        { bev: 0.005, r: 0.045, cs: 2, part: u, gloss: 0.24, skipTop: true });
    if (pal.holster) {
      const side = li === 1 ? 1 : -1;
      m.bevelBox(side * 0.082 * bw, -0.40, 0.010, 0.052, 0.145, 0.046, pal.holster,
        { bev: 0.008, r: 0.014, cs: 2, part: u, gloss: 0.22 });
      m.bevelBox(side * 0.082 * bw, -0.255, 0.010, 0.058, 0.028, 0.052, mul(pal.holster, 0.8),
        { bev: 0.006, r: 0.014, cs: 2, part: u, gloss: 0.26 });
    }
    if (pal.kneePads)
      m.ellipsoid(0, -0.030, 0.066, 0.064, 0.072, 0.040, 9, 5, pal.kneePads, { part: d, gloss: 0.30 });
  }

  /* ---------- рация на ремне (у бригадира вместо инструмента) ---------- */
  if (pal.radio) {
    m.bevelBox(-0.15 * bw - 0.026, 0.018, -0.052, 0.062, 0.115, 0.042, pal.radio,
      { bev: 0.008, r: 0.014, cs: 1, part: BONE.HIP, gloss: 0.3 });
    m.cyl(-0.15 * bw - 0.026, 0.133, -0.052, 0.007, 0.075, 5, mul(pal.radio, 0.7),
      { part: BONE.HIP, gloss: 0.25, rTop: 0.005 });
  }

  /* ---------- сумка монтажника ---------- */
  if (pal.bag) {
    m.bevelBox(0, -0.12, 0, 0.30, 0.24, 0.15, pal.bag,
      { bev: 0.018, r: 0.025, cs: 2, part: BONE.ACC, gloss: 0.18, uv: 0.4 });
    m.bevelBox(0, 0.10, 0, 0.31, 0.05, 0.16, mul(pal.bag, 0.8),
      { bev: 0.008, r: 0.025, cs: 2, part: BONE.ACC, gloss: 0.2 });
    if (pal.bagStripe) m.box(0, -0.02, 0.078, 0.24, 0.05, 0.008, pal.bagStripe, { part: BONE.ACC, gloss: 0.3 });
    /* Ремень идёт наискось к левому плечу. Раньше над сумкой висела короткая
       дужка, которая ни к чему не крепилась, — сумка и читалась приклеенной
       к бедру. Координаты левого плеча в системе кости сумки: примерно
       (-0.50, 0.55), потому что сама кость висит на тазе справа. */
    m.tube([[0.055, 0.11, -0.045], [-0.01, 0.24, -0.115], [-0.17, 0.38, -0.150],
            [-0.38, 0.49, -0.140], [-0.50, 0.545, -0.060], [-0.53, 0.552, 0.030]], 0.019, 6,
      mul(pal.bag, 0.7), { part: BONE.ACC, gloss: 0.25 });
    m.bevelBox(-0.505, 0.556, -0.020, 0.085, 0.028, 0.135, mul(pal.bag, 0.62),
      { bev: 0.008, r: 0.02, cs: 2, part: BONE.ACC, gloss: 0.25 });   /* наплечник */
  }
  return { gpu: m.upload(gl), pal };
}

export const CHAR_MESHES = {};
export function buildCharacters(gl) {
  const P = {
    /* Олег переодет: кожаный шлем с очками на лбу, майка, портупея крестом
       с ремнём сумки, бинты на предплечьях, перчатки без пальцев, широкий
       ремень, оранжевые штаны с ремешками и наколенниками. Поверх всего —
       жёлтый сигнальный жилет с названием конторы по спине. */
    oleg:   { skin: [.95,.72,.55], shirt: [.88,.85,.76], sleeve: [.88,.85,.76], pants: [1.05,.44,.13],
              hair: [.42,.28,.17], collar: [.90,.87,.78],
              helmet: [.44,.31,.22], goggles: [.30,.23,.17], lens: [.34,.74,.92],
              vest: [1.32,1.02,.14], vestText: [.10,.09,.08],
              tank: true, harness: [.33,.25,.18], wraps: [.90,.88,.80], gloves: [.25,.22,.21],
              kneePads: [.74,.74,.72], thighStraps: [.31,.24,.18], holster: [.36,.31,.29],
              bag: [.36,.26,.2], bagStripe: [1.3,1.0,.3], shoes: [.22,.19,.18],
              belt: [.26,.20,.15], buckle: [.80,.81,.85] },
    sanya:  { skin: [.93,.71,.54], shirt: [.16,.62,.60], sleeve: [.14,.55,.54], pants: [.24,.24,.36], hair: [.34,.24,.15],
              cap: [.09,.42,.40], vest: [.28,1.15,1.1], bag: [.3,.4,.42], shoes: [.18,.2,.24], build: 1.06,
              belt: [.16,.16,.2], collar: [.13,.5,.5] },
    tamara: { skin: [.98,.78,.64], shirt: [.72,.2,.46], sleeve: [.66,.18,.42], pants: [.32,.2,.4], hair: [.62,.22,.34],
              shoes: [.28,.14,.22], collar: [.8,.28,.54], eyes: [.2,.3,.2], belt: [.35,.12,.26], buckle: [.9,.8,.4] },
    boris:  { skin: [.92,.71,.56], shirt: [.45,.42,.52], sleeve: [.40,.38,.48], pants: [.3,.3,.36], hair: [.78,.78,.8],
              beard: [.8,.8,.82], build: 1.16, shoes: [.2,.19,.2], bald: true, belt: [.2,.18,.16] },
    hool:   { skin: [.9,.68,.52], shirt: [.22,.22,.30], sleeve: [.19,.19,.27], pants: [.17,.17,.25], hair: [.15,.15,.2],
              cap: [.38,.16,.52], shoes: [.9,.9,.92], build: 0.96, belt: [.12,.12,.16] },
    gran:   { skin: [.96,.8,.68], shirt: [.6,.34,.68], sleeve: [.55,.3,.62], pants: [.36,.26,.42], hair: [1.05,1.05,1.1],
              scarf: [.86,.34,.42], skirt: [.34,.24,.4], build: 1.1, shoes: [.24,.2,.24] },
    guard:  { skin: [.9,.7,.55], shirt: [.40,.13,.16], sleeve: [.36,.12,.15], pants: [.22,.2,.26], hair: [.26,.26,.3],
              cap: [.86,.18,.25], vest: [1.15,.34,.38], shoes: [.14,.13,.16], build: 1.08, belt: [.1,.1,.12], buckle: [.8,.8,.85] },
    client: { skin: [.93,.74,.59], shirt: [.26,.44,.62], sleeve: [.23,.4,.58], pants: [.3,.3,.4], hair: [.42,.33,.22],
              shoes: [.2,.18,.2], collar: [.9,.92,.95], belt: [.2,.16,.14] },
    /* Костя: лысый, очки сдвинуты на лоб, гарнитура в ухе. Работает быстро и на глаз */
    kostya: { skin: [.94,.73,.56], shirt: [.30,.42,.34], sleeve: [.26,.37,.30], pants: [.22,.24,.27],
              hair: [.80,.62,.47], bald: true, brow: [.24,.20,.17],
              vest: [.86,1.18,.22], goggles: [.16,.16,.20], earbud: [.86,.87,.92],
              bag: [.32,.30,.28], bagStripe: [1.2,.9,.25], shoes: [.17,.16,.18],
              belt: [.15,.14,.13], buckle: [.70,.66,.40], collar: [.26,.36,.30], cuff: [.26,.36,.30],
              build: 0.98, eyes: [.20,.24,.20] },
    /* Ваня: бригадир, 40 лет. Невысокий и плотный, борода, кепка, рация вместо сумки */
    vanya:  { skin: [.92,.70,.53], shirt: [.27,.29,.33], sleeve: [.24,.26,.30], pants: [.19,.20,.24],
              hair: [.30,.22,.15], beard: [.32,.24,.16], cap: [.20,.31,.50], radio: [.18,.18,.22],
              build: 1.14, scale: 0.93, shoes: [.16,.15,.17], belt: [.14,.12,.11], buckle: [.72,.66,.38],
              collar: [.32,.34,.38], cuff: [.24,.26,.30], eyes: [.18,.16,.13] }
  };
  const pedColors = [
    [.38,.56,.8], [.68,.38,.62], [.46,.68,.42], [.8,.6,.32], [.4,.4,.74], [.74,.46,.4], [.32,.62,.62], [.66,.66,.4]
  ];
  for (const k in P) CHAR_MESHES[k] = makeCharMesh(gl, P[k]);
  CHAR_MESHES.peds = pedColors.map((c, i) => makeCharMesh(gl, {
    skin: [.95 - i * 0.03, .74 - i * 0.03, .58], shirt: c, sleeve: [c[0] * .9, c[1] * .9, c[2] * .9],
    pants: [.28 + (i % 3) * .06, .28, .38], hair: i % 3 === 0 ? [1.0,1.0,1.05] : [.36,.26,.17],
    cap: i % 4 === 0 ? c : null, bag: i % 3 === 1 ? [.78,.72,.64] : null,
    skirt: i % 4 === 2 ? [c[0] * .7, c[1] * .7, c[2] * .8] : null,
    build: 0.94 + (i % 4) * 0.06, bald: i === 5,
    shoes: [.18 + (i % 3) * .05, .17, .21], belt: [.2,.18,.2]
  }));
}

export const SCRATCH = [];
/* --- поза ---------------------------------------------------------------
   o: {x,y,z,yaw,phase,speed,sit,lean,roll,down,armL,armR,
       headYaw,headPitch,headRoll,scale,tint,
       gait  — ключ GAITS: характер походки (по умолчанию 'norm'),
       time  — непрерывное время персонажа (по умолчанию S.t): дыхание и жесты,
       seed  — личный сдвиг фаз 0..1, чтобы двор не дышал строем,
       acc   — продольное ускорение, м/с²: наклон при разгоне и торможении,
       drunk — 0..1 хмель: сбитый такт, крен, разножка,
       idle  — номер холостого жеста, idleP — его прогресс 0..1,
       act   — 'swing'|'work'|'talk'|'climb'|'hold'|'scare',
       actK  — прогресс 0..1 (swing, scare) или вес слоя 0..1 (остальные)}
   Все новые поля необязательны: без них поза считается как раньше.        */
export function poseCharacter(o) {
  const g = GAIT(o.gait);
  const yaw = o.yaw || 0, sp = clamp(o.speed || 0, 0, 1);
  const t = o.time === undefined ? S.t : o.time, sd = (o.seed || 0) * TAU;
  const dr = clamp(o.drunk || 0, 0, 1), down = clamp(o.down || 0, 0, 1);
  const rest = (1 - clamp(sp * 1.8, 0, 1)) * (1 - down);   /* «стоит спокойно» */
  const rn = clamp((sp - 0.55) / 0.45, 0, 1);              /* доля бега в походке */
  const ph = (o.phase || 0) + dr * Math.sin(t * 0.8 + sd) * 0.5;   /* хмель сбивает такт */

  /* --- слои действий: вес и собственные фазы --- */
  const act = o.act || '', ak = clamp(o.actK || 0, 0, 1);
  const work = act === 'work' ? ak : 0, talk = act === 'talk' ? ak : 0;
  const climb = act === 'climb' ? ak : 0, hold = act === 'hold' ? ak : 0;
  const fear = act === 'scare' ? Math.sin(Math.PI * ak) : 0;

  /* --- покой: дыхание, перенос веса, холостой жест --- */
  const br = Math.sin(t * 1.15 + sd) * rest;                       /* вдох-выдох, ~5.5 с */
  const wgt = Math.sin(t * 0.52 + sd * 1.7) * rest;                /* вес: − левая нога, + правая */
  const iN = o.idle || 0, iu = o.idleP === undefined ? 1 : clamp(o.idleP, 0, 1);
  const ik = iu < 1 ? Math.sin(Math.PI * iu) * rest : 0;           /* колокол жеста */

  /* --- корпус --- */
  const twist = Math.sin(ph) * (0.10 + rn * 0.10) * sp;            /* плечи против таза */
  const lean = (o.lean || 0) + sp * g.lean + rn * 0.16
    + clamp((o.acc || 0) * 0.045, -0.12, 0.18)                     /* разгон вперёд, торможение назад */
    + work * 0.20 + climb * 0.06 + talk * 0.04 - fear * 0.30;
  const bob = Math.sin(ph * 2) * g.bob * (1 + rn * 1.4) * sp
    + Math.max(0, Math.sin(ph * 2)) * 0.055 * rn                   /* фаза полёта на бегу */
    + br * 0.009 - g.duck * sp - work * 0.05 - fear * 0.05;
  const roll = Math.sin(ph) * g.roll * sp + wgt * 0.026 + (o.roll || 0)
    + dr * (Math.sin(t * 1.7 + sd) * 0.10 + Math.sin(t * 0.63) * 0.05);
  const root = m4compose(SCRATCH[0], o.x, (o.y || 0) + (o.sit ? RIG.sit : RIG.root) + bob - down * 0.78,
    o.z, down * 1.4, yaw, roll, o.scale || 1);
  const T = (out, parent, dx, dy, dz, rx, ry, rz) =>
    m4mul(out, parent, m4compose(SCRATCH[7], dx, dy, dz, rx || 0, ry || 0, rz || 0, 1));

  /* таз уходит к опорной ноге, проседает на свободной и крутится против плеч */
  const hipX = wgt * 0.022 + Math.sin(ph) * g.sway * 0.09 * sp;
  const swayZ = o.sit ? Math.sin(ph * 1.4) * 0.05 * sp : 0;        /* качание в седле */
  T(BONES[BONE.HIP], root, hipX, -Math.abs(wgt) * 0.012, 0, 0, -twist * 0.55, 0);
  T(BONES[BONE.SPINE], BONES[BONE.HIP], 0, RIG.spine, 0,
    lean * 0.42 - br * 0.012, twist * 0.35, -hipX * 0.6 + swayZ * 0.4);
  T(BONES[BONE.CHEST], BONES[BONE.SPINE], 0, RIG.chest, 0,
    lean * 0.58 - br * 0.030 + work * 0.10,
    twist + Math.sin(t * 1.9 + sd) * 0.07 * talk,
    swayZ + Math.sin(t * 1.3 + sd) * 0.05 * talk);

  /* голова: гасит наклон корпуса, доворачивается к цели, кивает в разговоре */
  const headP = -lean * 0.7 + (o.headPitch || 0) + work * 0.34 - climb * 0.20 - down * 0.55
    + Math.sin(t * 2.6 + sd) * 0.10 * talk + dr * Math.sin(t * 0.9 + sd) * 0.10
    + ik * (iN === 0 ? 0.34 : iN === 1 ? -0.12 : iN === 2 ? 0.18 : 0.05);
  const headY = (o.headYaw || 0) - twist * 0.5 + Math.sin(t * 0.37 + sd * 2.1) * 0.09 * rest
    + ik * (iN === 1 ? 0.45 : iN === 2 ? -0.28 : 0.10);
  const headR = (o.headRoll || 0) + Math.sin(ph) * 0.02 * sp + dr * Math.sin(t * 1.3 + sd) * 0.12
    + ik * (iN === 1 ? Math.sin(iu * TAU) * 0.38 : 0);
  T(BONES[BONE.HEAD], BONES[BONE.CHEST], 0, RIG.neck, 0, headP, headY, headR);
  T(BONES[BONE.CAP], BONES[BONE.HEAD], 0, 0, 0, 0, 0, 0);

  const amp = 0.15 + sp * g.arm, lamp = 0.15 + sp * g.amp;
  const swing = Math.sin(ph) * lamp, swing2 = Math.sin(ph + Math.PI) * lamp;
  const SX = RIG.shoulder[0], SY = RIG.shoulder[1];
  if (o.sit) {                          /* поза на велосипеде: руки на руле */
    const jolt = Math.sin(t * 11 + sd) * 0.02 * sp;                /* дорога отдаёт в локти */
    for (const [u, d, h, sx, rz] of [[BONE.ARMLU, BONE.ARMLD, BONE.HANDL, -SX, 0.16],
                                     [BONE.ARMRU, BONE.ARMRD, BONE.HANDR, SX, -0.16]]) {
      T(BONES[u], BONES[BONE.CHEST], sx, SY, 0.02, -1.02 - (o.lean || 0) * 0.12 + jolt, 0, rz);
      T(BONES[d], BONES[u], 0, -RIG.upperArm, 0, -0.40 - jolt * 2, 0, 0);
      T(BONES[h], BONES[d], 0, -RIG.foreArm, 0, 0.55, 0, 0);
    }
    const pedal = ph * 1.4;
    for (const [u, d, f, off, side] of [[BONE.LEGLU, BONE.LEGLD, BONE.FOOTL, 0, -1],
                                        [BONE.LEGRU, BONE.LEGRD, BONE.FOOTR, Math.PI, 1]]) {
      const th = -1.12 + Math.sin(pedal + off) * (0.42 + sp * 0.16);
      const kn = 1.05 - Math.sin(pedal + off) * (0.38 + sp * 0.16);
      T(BONES[u], BONES[BONE.HIP], side * RIG.hip[0], RIG.hip[1], 0.03, th, 0, side * 0.04);
      T(BONES[d], BONES[u], 0, -RIG.thigh, 0, kn, 0, 0);
      T(BONES[f], BONES[d], 0, -RIG.shin, 0, clamp(-(th + kn) * 0.7, -0.5, 0.7), 0, 0);
    }
  } else {
    /* базовый мах: на бегу локоть закрывается, руки идут выше */
    let sL = swing2 * (g.arm / g.amp), sR = swing * (g.arm / g.amp);
    let eL = -0.24 - Math.abs(sL) * g.elbow - rn * 0.75, eR = -0.24 - Math.abs(sR) * g.elbow - rn * 0.75;
    /* Разведение рук от корпуса. Знак важен: для левой руки (плечо на -X)
       положительный поворот по Z уводит кисть внутрь тела — а раньше именно
       так и было, поэтому на ходу руки тонули в жилете тем глубже, чем
       быстрее шёл персонаж. */
    let zL = -(0.155 + sp * 0.075 + g.splay + dr * 0.22) + br * 0.02;
    let zR =  (0.155 + sp * 0.075 + g.splay + dr * 0.22) - br * 0.02;
    let hL = -0.06, hR = -0.06, yL = 0, yR = 0;
    /* холостые движения */
    if (ik > 0.001) {
      if (iN === 0) {                    /* глянуть на часы */
        sL = lerp(sL, -0.85, ik); eL = lerp(eL, -1.75, ik); zL = lerp(zL, -0.22, ik); hL = lerp(hL, 0.25, ik);
      } else if (iN === 1) {             /* размять шею: ладонь к затылку */
        sR = lerp(sR, -2.05, ik); eR = lerp(eR, -1.95, ik); zR = lerp(zR, -0.45, ik);
      } else if (iN === 2) {             /* поправить сумку */
        sR = lerp(sR, 0.20, ik); eR = lerp(eR, -1.35, ik); zR = lerp(zR, -0.30, ik);
      }
    }
    /* работа отвёрткой: обе руки перед грудью, правая крутит кистью */
    if (work > 0) {
      const w = Math.sin(t * 7.5);
      sL = lerp(sL, -1.02, work); eL = lerp(eL, -1.55, work); zL = lerp(zL, -0.30, work);
      sR = lerp(sR, -1.10 + w * 0.05, work); eR = lerp(eR, -1.45 - Math.max(0, w) * 0.12, work);
      zR = lerp(zR, 0.24, work); yR = lerp(yR, w * 0.9, work); hR = lerp(hR, 0.15, work);
    }
    /* разговор: правая объясняет, левая вступает через раз */
    if (talk > 0) {
      const q = t * 2.3 + sd, q2 = Math.max(0, Math.sin(q * 0.5 - 1));
      sR = lerp(sR, -0.62 - Math.sin(q) * 0.30, talk); eR = lerp(eR, -1.15 + Math.sin(q * 1.7) * 0.35, talk);
      zR = lerp(zR, -0.34 - Math.sin(q * 0.7) * 0.14, talk); yR = lerp(yR, Math.sin(q * 2.1) * 0.45, talk);
      sL = lerp(sL, -0.45 * q2, talk); eL = lerp(eL, -0.90 - q2 * 0.50, talk); zL = lerp(zL, 0.30, talk);
    }
    /* подъём по лестнице: руки и ноги крест-накрест по перекладинам */
    if (climb > 0) {
      const c = t * 2.4 + sd;
      sL = lerp(sL, -2.15 + Math.sin(c) * 0.55, climb); eL = lerp(eL, -0.55 - Math.max(0, Math.sin(c)) * 0.55, climb); zL = lerp(zL, 0.10, climb);
      sR = lerp(sR, -2.15 - Math.sin(c) * 0.55, climb); eR = lerp(eR, -0.55 - Math.max(0, -Math.sin(c)) * 0.55, climb); zR = lerp(zR, -0.10, climb);
    }
    if (hold > 0) {                      /* держит стремянку */
      sL = lerp(sL, -1.45, hold); eL = lerp(eL, -0.35, hold); zL = lerp(zL, 0.18, hold);
      sR = lerp(sR, -1.45, hold); eR = lerp(eR, -0.35, hold); zR = lerp(zR, -0.18, hold);
    }
    if (fear > 0) {                      /* испуг: плечи вверх, руки к груди */
      sL = lerp(sL, -0.95, fear); eL = lerp(eL, -1.85, fear); zL = lerp(zL, 0.42, fear);
      sR = lerp(sR, -0.95, fear); eR = lerp(eR, -1.85, fear); zR = lerp(zR, -0.42, fear);
    }
    /* замах сумкой: 0..0.35 — отвод назад, дальше бросок вперёд */
    if (act === 'swing') {
      const back = clamp(ak / 0.35, 0, 1), f = clamp((ak - 0.35) / 0.40, 0, 1);
      const e3 = f * f * (3 - 2 * f);                               /* мягкий разгон удара */
      sR = 0.95 * back * (1 - e3) - 1.70 * e3;
      eR = -0.30 - 0.90 * back * (1 - e3) - 0.15 * e3;
      zR = -0.34 + 0.22 * e3; yR = 0;
    }
    if (down > 0) {                      /* упал: руки разлетаются */
      sL = lerp(sL, -1.15, down); eL = lerp(eL, -0.55, down); zL = lerp(zL, 0.75, down);
      sR = lerp(sR, -1.15, down); eR = lerp(eR, -0.55, down); zR = lerp(zR, -0.75, down);
    }
    /* явные armL/armR (старые вызовы) перекрывают всё */
    if (o.armL !== undefined) { sL = o.armL; eL = -0.24 - Math.abs(o.armL) * g.elbow; }
    if (o.armR !== undefined) { sR = o.armR; eR = -0.24 - Math.abs(o.armR) * g.elbow; }
    T(BONES[BONE.ARMLU], BONES[BONE.CHEST], -SX, SY, 0, sL, 0, zL);
    T(BONES[BONE.ARMLD], BONES[BONE.ARMLU], 0, -RIG.upperArm, 0, eL, yL, 0);
    T(BONES[BONE.HANDL], BONES[BONE.ARMLD], 0, -RIG.foreArm, 0, hL, 0, 0);
    T(BONES[BONE.ARMRU], BONES[BONE.CHEST], SX, SY, 0, sR, 0, zR);
    T(BONES[BONE.ARMRD], BONES[BONE.ARMRU], 0, -RIG.upperArm, 0, eR, yR, 0);
    T(BONES[BONE.HANDR], BONES[BONE.ARMRD], 0, -RIG.foreArm, 0, hR, 0, 0);

    for (const [u, d, f, off, side] of [[BONE.LEGLU, BONE.LEGLD, BONE.FOOTL, 0, -1],
                                        [BONE.LEGRU, BONE.LEGRD, BONE.FOOTR, Math.PI, 1]]) {
      const fi = ph + off, s = Math.sin(fi) * lamp;      /* + нога сзади, − впереди */
      const sf = Math.max(0, Math.sin(fi)), sb = Math.max(0, -Math.sin(fi));
      /* колено гнётся в середине маха и распрямляется к касанию пятки */
      const knee = Math.max(0, -Math.cos(fi)) * (0.55 + sp * g.knee + rn * 0.55)
        + sf * 0.10 * sp + sp * 0.06
        + Math.max(0, side * wgt) * 0.10                 /* свободная нога в покое чуть согнута */
        + climb * (0.95 + Math.sin(fi) * 0.35) + work * 0.10 + fear * 0.18 + down * 0.65;
      const hipA = s - g.duck * sp * 0.3 + climb * (-0.85 + Math.sin(fi) * 0.35)
        + Math.max(0, side * wgt) * 0.06 + down * 0.35 + fear * 0.10
        + (iN === 3 ? ik * side * 0.18 : 0);             /* переступил с ноги на ногу */
      T(BONES[u], BONES[BONE.HIP], side * RIG.hip[0], RIG.hip[1], 0,
        hipA, 0, side * (g.splay * 0.6 + dr * 0.10 + down * 0.25));
      T(BONES[d], BONES[u], 0, -RIG.thigh, 0, knee, 0, 0);
      /* перекат: пятка первой, отталкивание носком, в воздухе носок вверх */
      const toe = sf * sf * (0.45 + rn * 0.35) * g.toe * sp, heel = sb * sb * 0.26 * sp;
      T(BONES[f], BONES[d], 0, -RIG.shin, 0,
        clamp(-(hipA + knee) * 0.88 + toe - heel, -0.55, 0.85), 0, 0);
    }
  }
  /* сумка: качается в такт шагу, а в замахе она уже в правой руке */
  if (act === 'swing')
    m4mul(BONES[BONE.ACC], BONES[BONE.HANDR], m4compose(SCRATCH[7], 0, -0.30, 0.02, 0.25, 0, 0, 1));
  else {
    const bg = Math.sin(ph) * 0.05 * sp + (iN === 2 ? ik * 0.16 : 0);
    T(BONES[BONE.ACC], BONES[BONE.HIP], 0.300, -0.06, -0.020, 0.05 + bg, 0, 0.06 - bg * 0.35);
  }
  for (let i = 0; i < NBONE; i++) BONEBUF.set(BONES[i], i * 16);
}

export function drawCharacter(mesh, o) {
  const gl = GL.gl, P = R3.main;
  const s0 = o.scale;                    /* рост живёт в палитре: Ваня невысокий */
  if (s0 === undefined && mesh.pal && mesh.pal.scale) o.scale = mesh.pal.scale;
  poseCharacter(o);
  gl.uniformMatrix4fv(P.u.uBones, false, BONEBUF);
  drawMesh(mesh.gpu, TX.cloth || TX.white, BONES[0], { skin: true, tint: o.tint });
  o.scale = s0;
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export function __init() {
   for (let i = 0; i < 20; i++) BONES.push(m4());
   for (let i = 0; i < 8; i++) SCRATCH.push(m4());
}
