/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «3. Процедурные текстуры (рисуются кодом, ничего не загружается)», строки 2676–3705.
   ===================================================================== */
import { Q, QCFG } from '../core/quality.js';
import { TAU, clamp, mulberry32 } from '../core/util.js';
import { Loader, fatal } from '../game/loop.js';
import { GL } from './gl.js';
import { R3 } from './renderer.js';
import { Static } from './static.js';

/* ------------------------------------------------------------------ */
/* 3. Процедурные текстуры (рисуются кодом, ничего не загружается)      */
/* ------------------------------------------------------------------ */
/* Устройство. Материал — не одна картинка, а комплект карт:
     albedo   цвет и альфа (маска свечения окон либо альфа-тест карт);
              хранится в SRGB8_ALPHA8 — семплер отдаёт линейный цвет, мипы
              усредняются правильно;
     surf     nx, ny (нормаль по Собелю из карты высот), roughness,
              metalness — RGBA8, линейно;
     ao       ambient occlusion из полостей той же карты высот — R8.
   Полный комплект получают материалы поверхностей (SURF_DEFS). Картам
   зелени и знаков, вывескам, ткани и краске хватает albedo плюс констант
   материала: нормаль на фанерке листа и на вывеске ничего не даёт, а по
   памяти и времени генерации они самые дорогие.
   Материалы одного размера лежат слоями одного TEXTURE_2D_ARRAY: одно
   связывание на группу, слой выбирает юниформ uLayer. Все текстуры — с
   полной мип-цепочкой и анизотропией из профиля (Q.aniso).
   Генерация идёт заданиями, по одному на материал, и отдаёт кадр браузеру
   между ними: заставка рисует полосу прогресса, а при смене профиля
   текстуры пересобираются прямо в игре и подменяются разом — батчи ищут
   материал по имени при каждом вызове отрисовки. */
export const TX = {};              /* материалы по имени: { grp, layer, rough, metal, tri } */
export let TEX_SS = 2;             /* холст крупнее логического размера во столько раз (Q.texSS) */
export const Tex = { detail: null, recs: [], signRecs: [], busy: false };

/* Реестр GPU-текстур: анизотропия меняется у всех разом, инвентарь памяти
   считается с мипами, при пересборке старые удаляются. */
export const TexReg = {
  list: [],
  add(rec) { this.list.push(rec); return rec; },
  bytes() { return this.list.reduce((a, r) => a + r.bytes, 0); },
  setAniso(gl, a) {
    if (!GL.aniso) return;
    const v = Math.max(1, Math.min(a, GL.maxAniso));
    for (const r of this.list) { gl.bindTexture(r.target, r.tex); gl.texParameterf(r.target, GL.aniso.TEXTURE_MAX_ANISOTROPY_EXT, v); }
  },
  drop(gl, recs) {
    for (const r of recs) { gl.deleteTexture(r.tex); const i = this.list.indexOf(r); if (i >= 0) this.list.splice(i, 1); }
  }
};

/* --- холсты и кисти ------------------------------------------------- */
/* Текстуры рисуются в «логической» системе, а холст берём крупнее в TEX_SS
   раз: композиция та же, зерно, трещины и подтёки получают больше пикселей. */
export function cv2d(size, hgt) {
  const c = document.createElement('canvas');
  c.width = size * TEX_SS; c.height = (hgt || size) * TEX_SS;
  /* Холст обязательно читается обратно, поэтому просим держать его в памяти:
     иначе Chrome на каждом getImageData ругается на выкачку из GPU. */
  const x = c.getContext('2d', { willReadFrequently: true });
  x.scale(TEX_SS, TEX_SS);
  return { c, x, s: size };
}
export const pix = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
export function noiseFill(x, s, amt, seed, mono) {
  /* зерно кладём в настоящем разрешении холста, мимо масштаба контекста */
  const w = x.canvas.width, h = x.canvas.height;
  const img = x.getImageData(0, 0, w, h), d = img.data, R = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amt * 255;
    if (mono) { d[i] = clamp(d[i] + n, 0, 255); d[i+1] = clamp(d[i+1] + n, 0, 255); d[i+2] = clamp(d[i+2] + n, 0, 255); }
    else {
      d[i] = clamp(d[i] + n, 0, 255);
      d[i+1] = clamp(d[i+1] + n * 0.9, 0, 255);
      d[i+2] = clamp(d[i+2] + n * 1.1, 0, 255);
    }
  }
  x.putImageData(img, 0, 0);
}
/* вертикальные подтёки: грязь, стекающая от подоконников и с крыши */
export function streaks(x, s, n, seed, col, wmin, wmax, hmin, hmax) {
  const R = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const px = R() * s, py = R() * s * 0.6;
    const w = wmin + R() * (wmax - wmin), h = hmin + R() * (hmax - hmin);
    const g = x.createLinearGradient(0, py, 0, py + h);
    g.addColorStop(0, 'rgba(' + col + ',0)');
    g.addColorStop(0.18, 'rgba(' + col + ',' + (0.10 + R() * 0.14).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + col + ',0)');
    x.fillStyle = g; x.fillRect(px, py, w, h);
  }
}
/* мелкая крошка: щебень в асфальте, вкрапления в бетоне */
export function speckle(x, s, n, seed, colors, rmin, rmax, alpha) {
  const R = mulberry32(seed);
  x.globalAlpha = alpha === undefined ? 0.5 : alpha;
  for (let i = 0; i < n; i++) {
    x.fillStyle = 'rgb(' + colors[Math.floor(R() * colors.length)] + ')';
    const r = rmin + R() * (rmax - rmin);
    x.beginPath(); x.ellipse(R() * s, R() * s, r, r * (0.6 + R() * 0.6), R() * TAU, 0, TAU); x.fill();
  }
  x.globalAlpha = 1;
}
export function blotches(x, s, n, colors, seed, rmin, rmax, alpha) {
  const R = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const px = R() * s, py = R() * s, r = rmin + R() * (rmax - rmin);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const c = colors[Math.floor(R() * colors.length)];
    g.addColorStop(0, 'rgba(' + c + ',' + (alpha || 0.16) + ')');
    g.addColorStop(1, 'rgba(' + c + ',0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}
export function cracks(x, s, n, seed, col, w) {
  const R = mulberry32(seed);
  x.strokeStyle = col; x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let px = R() * s, py = R() * s, a = R() * TAU;
    x.lineWidth = w * (0.5 + R());
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      a += (R() - 0.5) * 1.5;
      px += Math.cos(a) * (6 + R() * 22); py += Math.sin(a) * (6 + R() * 22);
      x.lineTo(px, py);
    }
    x.stroke();
  }
}
/* ВАЖНО: альфу нельзя записывать обратно в canvas — он хранит цвет
   премультиплицированным, и alpha=0 обнуляет RGB. Поэтому маску свечения
   накладываем уже на выгруженные пиксели и грузим массивом. */
/* Растекание цвета под прозрачные тексели. Мип-уровни усредняют RGB вместе с
   пустотой, и по контуру листа появляется тёмная кайма. Два прохода дилатации
   заполняют пустоту цветом соседей; альфа остаётся нетронутой, маска
   альфа-теста не съезжает. Заполненные тексели помечаем альфой 1 — это
   ниже любого порога uCut, зато на следующем проходе они уже доноры. */
export function bleedAlpha(d, w, h, passes) {
  for (let p = 0; p < (passes || 2); p++) {
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (src[j + 3] === 0) continue;
        r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
      }
      if (!n) continue;
      d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n; d[i + 3] = 1;
    }
  }
}
/* маска свечения в альфе: прямоугольники окон в логических координатах */
export function applyEmis(d, w, h, rects) {
  for (let i = 3; i < d.length; i += 4) d[i] = 0;
  for (const r of rects) {
    const k = TEX_SS;
    const x0 = Math.max(0, Math.floor(r.wx * k)), x1 = Math.min(w, Math.ceil((r.wx + r.ww) * k));
    const y0 = Math.max(0, Math.floor(r.wy * k)), y1 = Math.min(h, Math.ceil((r.wy + r.wh) * k));
    const on = Math.round(255 * (r.on === undefined ? 1 : r.on));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) d[(yy * w + xx) * 4 + 3] = on;
  }
}
export function alphaFromLuma(d) {
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.4 + d[i + 1] * 0.4 + d[i + 2] * 0.2) / 255;
    d[i + 3] = Math.round(clamp((lum - 0.24) * 1.8, 0, 1) * 255);
  }
}
/* GL считает строки снизу вверх, холст — сверху вниз */
export function flipRows(src, w, h, ch) {
  const out = new Uint8Array(src.length), row = w * ch;
  for (let y = 0; y < h; y++) out.set(src.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  return out;
}

/* --- окно: рисуем стеклопакет, альфа = маска свечения --- */
export function drawWindow(x, wx, wy, ww, wh, seed, opt) {
  opt = opt || {};
  const R = mulberry32(seed);
  x.save();
  /* откос / рама */
  x.fillStyle = opt.frame || '#cfc7d8';
  x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
  /* стекло */
  const g = x.createLinearGradient(wx, wy, wx + ww * 0.4, wy + wh);
  g.addColorStop(0, '#20304a'); g.addColorStop(0.45, '#3e5a7a'); g.addColorStop(0.46, '#1b2740'); g.addColorStop(1, '#141c30');
  x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
  /* переплёт */
  x.fillStyle = opt.frame || '#cfc7d8';
  x.fillRect(wx + ww * 0.48, wy, Math.max(1, ww * 0.05), wh);
  if (opt.cross !== false) x.fillRect(wx, wy + wh * 0.42, ww, Math.max(1, wh * 0.05));
  /* занавеска / жалюзи */
  if (R() < 0.55) {
    x.fillStyle = ['rgba(240,230,210,.75)', 'rgba(210,180,200,.7)', 'rgba(190,215,220,.7)'][Math.floor(R() * 3)];
    const hh = wh * (0.2 + R() * 0.45);
    x.fillRect(wx + 1, wy + 1, ww - 2, hh);
  }
  x.restore();
  return { wx, wy, ww, wh };
}
/* то же окно на карте высот: рама выступает, стекло утоплено */
export function windowH(x, rects) {
  for (const r of rects) {
    x.fillStyle = '#a8a8a8'; x.fillRect(r.wx - 2, r.wy - 2, r.ww + 4, r.wh + 4);
    x.fillStyle = '#4c4c4c'; x.fillRect(r.wx, r.wy, r.ww, r.wh);
    x.fillStyle = '#9a9a9a'; x.fillRect(r.wx + r.ww * 0.48, r.wy, Math.max(1, r.ww * 0.05), r.wh);
  }
}
export const gray = v => { const k = Math.round(clamp(v, 0, 1) * 255); return 'rgb(' + k + ',' + k + ',' + k + ')'; };
export const hexRGB = h => parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);

/* --- материалы поверхностей ------------------------------------------
   albedo(x, S) рисует цвет и возвращает список окон (маска свечения в альфе).
   height(x, S, rects) рисует карту высот: серее — ниже, белее — выше; кисти
   и посев случайных чисел те же, что у цвета, поэтому трещины, швы, кирпичи и
   рёбра ложатся ровно на свои места. Из высот считаются нормаль (Собель,
   крутизна bump) и ambient occlusion; hnoise — [размах, посев] зерна высот,
   которое кладётся уже в массив, минуя холст. rough — [база, по высоте, по яркости];
   metal — константа либо маска (белое — металл), roughMetal — шероховатость
   металлических участков. tri — шаг триплоскостной проекции в метрах для
   тех, у кого развёртка тянется (стволы). */
export const SURF_DEFS = [
  { key: 'asphalt', hnoise: [0.10, 12], rough: [0.80, -0.30, 0], metal: 0, bump: 1.4,
    albedo(x, S) {
      x.fillStyle = '#3a3542'; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, ['30,28,36', '68,62,76', '52,46,58'], 11, 10, 60, 0.28);
      speckle(x, S, 900, 15, ['86,80,96', '54,50,62', '110,104,120'], 0.5, 1.7, 0.30);
      noiseFill(x, S, 0.20, 12, true);
      cracks(x, S, 10, 13, 'rgba(24,20,30,.55)', 1.4);
      blotches(x, S, 8, ['18,14,22'], 14, 6, 22, 0.4);
      /* латки свежего асфальта и масляные пятна */
      for (let i = 0; i < 3; i++) {
        const R2 = mulberry32(16 + i), px = R2() * S, py = R2() * S, w = 24 + R2() * 46, h = 18 + R2() * 34;
        x.fillStyle = 'rgba(26,23,32,.34)'; x.fillRect(px, py, w, h);
        x.strokeStyle = 'rgba(16,13,20,.5)'; x.lineWidth = 1.5; x.strokeRect(px, py, w, h);
      }
      blotches(x, S, 5, ['12,10,16'], 17, 4, 14, 0.5);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, ['150,150,150', '105,105,105', '135,135,135'], 11, 10, 60, 0.3);
      speckle(x, S, 900, 15, ['205,205,205', '170,170,170', '235,235,235'], 0.5, 1.7, 0.6);
      cracks(x, S, 10, 13, 'rgba(0,0,0,.7)', 1.4);
      blotches(x, S, 8, ['30,30,30'], 14, 6, 22, 0.55);
      for (let i = 0; i < 3; i++) {
        const R2 = mulberry32(16 + i), px = R2() * S, py = R2() * S, w = 24 + R2() * 46, h = 18 + R2() * 34;
        x.fillStyle = 'rgba(150,150,150,.5)'; x.fillRect(px, py, w, h);
        x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1.5; x.strokeRect(px, py, w, h);
      }
    } },
  { key: 'road', hnoise: [0.09, 22], rough: [0.74, -0.30, 0], metal: 0, bump: 1.3,
    albedo(x, S) {
      x.fillStyle = '#37323f'; x.fillRect(0, 0, S, S);
      blotches(x, S, 30, ['2a2632', '5a5468'].map(hexRGB), 21, 12, 70, 0.25);
      noiseFill(x, S, 0.16, 22, true);
      cracks(x, S, 7, 23, 'rgba(22,18,28,.5)', 1.2);
      speckle(x, S, 700, 25, ['80,74,92', '50,46,58'], 0.5, 1.6, 0.26);
      /* колеи */
      x.fillStyle = 'rgba(20,16,26,.22)';
      x.fillRect(0, S * 0.22, S, S * 0.10); x.fillRect(0, S * 0.68, S, S * 0.10);
      x.fillStyle = 'rgba(14,11,18,.16)';
      x.fillRect(0, S * 0.245, S, S * 0.045); x.fillRect(0, S * 0.705, S, S * 0.045);
      /* краевые линии */
      x.fillStyle = 'rgba(236,232,244,.82)';
      x.fillRect(0, S * 0.035, S, 4); x.fillRect(0, S * 0.945, S, 4);
      /* прерывистая осевая */
      x.fillStyle = 'rgba(255,206,60,.88)';
      for (let i = 0; i < 4; i++) x.fillRect(i * S / 4 + 8, S * 0.487, S / 4 - 30, 5);
      noiseFill(x, S, 0.06, 24, true);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#7c7c7c'; x.fillRect(0, 0, S, S);
      blotches(x, S, 30, ['150,150,150', '110,110,110'], 21, 12, 70, 0.3);
      cracks(x, S, 7, 23, 'rgba(0,0,0,.65)', 1.2);
      speckle(x, S, 700, 25, ['205,205,205', '175,175,175'], 0.5, 1.6, 0.55);
      x.fillStyle = 'rgba(0,0,0,.16)';
      x.fillRect(0, S * 0.22, S, S * 0.10); x.fillRect(0, S * 0.68, S, S * 0.10);
      x.fillStyle = 'rgba(0,0,0,.12)';
      x.fillRect(0, S * 0.245, S, S * 0.045); x.fillRect(0, S * 0.705, S, S * 0.045);
    } },
  { key: 'sidewalk', hnoise: [0.07, 31], rough: [0.82, -0.15, 0], metal: 0, bump: 1.5,
    albedo(x, S) {
      x.fillStyle = '#6c6478'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.13, 31, true);
      x.strokeStyle = 'rgba(40,36,50,.55)'; x.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke();
        x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
      }
      blotches(x, S, 16, ['52,48,60', '120,112,132'], 32, 8, 34, 0.2);
      speckle(x, S, 520, 34, ['150,142,164', '60,56,70'], 0.4, 1.3, 0.28);
      cracks(x, S, 5, 33, 'rgba(40,34,48,.4)', 1);
      /* выщербленные углы плит и налипшая грязь */
      blotches(x, S, 9, ['46,40,52'], 35, 3, 11, 0.42);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, S, S);
      x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 2.5;
      for (let i = 0; i <= 4; i++) {
        x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke();
        x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
      }
      blotches(x, S, 16, ['160,160,160', '120,120,120'], 32, 8, 34, 0.25);
      speckle(x, S, 520, 34, ['200,200,200', '110,110,110'], 0.4, 1.3, 0.5);
      cracks(x, S, 5, 33, 'rgba(0,0,0,.6)', 1);
      blotches(x, S, 9, ['40,40,40'], 35, 3, 11, 0.6);
    } },
  { key: 'panel', hnoise: [0.05, 41], rough: [0.86, 0, 0.10], metal: 0, bump: 1.6,
    albedo(x, S) {
      x.fillStyle = '#b9b2ba'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.11, 41, true);
      blotches(x, S, 22, ['150,145,152', '90,86,96'], 42, 14, 50, 0.16);
      /* швы панелей */
      x.strokeStyle = 'rgba(70,66,78,.55)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
      x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, S / 2 + 3); x.lineTo(S, S / 2 + 3); x.stroke();
      /* потёки от крыши и ржавые следы от закладных */
      x.fillStyle = 'rgba(80,76,88,.18)';
      for (let i = 0; i < 6; i++) { const px = (i * 47) % S; x.fillRect(px, 0, 6 + (i % 3) * 4, S * (0.2 + (i % 4) * 0.12)); }
      streaks(x, S, 14, 45, '74,70,84', 3, 11, 40, 130);
      streaks(x, S, 5, 46, '118,74,44', 2, 6, 24, 80);
      speckle(x, S, 420, 47, ['196,190,200', '132,126,140'], 0.4, 1.4, 0.22);
      const rects = [];
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++)
        rects.push(drawWindow(x, k * S / 2 + 26, r * S / 2 + 26, S / 2 - 52, S / 2 - 62, 100 + r * 7 + k));
      return rects.map((r, i) => Object.assign({}, r, { on: [1, 0, 1, 1][i] }));
    },
    height(x, S, rects) {
      x.fillStyle = '#868686'; x.fillRect(0, 0, S, S);
      blotches(x, S, 22, ['150,150,150', '115,115,115'], 42, 14, 50, 0.2);
      x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineWidth = 3.5;
      x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
      x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.stroke();
      speckle(x, S, 420, 47, ['175,175,175', '100,100,100'], 0.4, 1.4, 0.45);
      windowH(x, rects);
    } },
  { key: 'stucco', hnoise: [0.16, 51], rough: [0.90, 0, 0], metal: 0, bump: 1.2,
    albedo(x, S) {
      x.fillStyle = '#d9cfc4'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.09, 51, true);
      blotches(x, S, 26, ['160,150,140', '210,200,190', '120,110,105'], 52, 16, 60, 0.18);
      x.fillStyle = 'rgba(120,110,100,.14)';
      for (let i = 0; i < 5; i++) x.fillRect((i * 61) % S, 0, 10, S * (0.25 + (i % 3) * 0.2));
      streaks(x, S, 12, 55, '112,102,92', 3, 12, 36, 120);
      /* облупившаяся краска */
      const Rp = mulberry32(56);
      for (let i = 0; i < 14; i++) {
        x.fillStyle = 'rgba(150,138,126,.30)';
        x.beginPath(); x.ellipse(Rp() * S, Rp() * S, 3 + Rp() * 9, 2 + Rp() * 7, Rp() * TAU, 0, TAU); x.fill();
      }
      const rects = [];
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++)
        rects.push(drawWindow(x, k * S / 2 + 30, r * S / 2 + 30, S / 2 - 60, S / 2 - 66, 200 + r * 5 + k, { frame: '#8a7f74' }));
      return rects.map((r, i) => Object.assign({}, r, { on: [1, 1, 0, 1][i] }));
    },
    height(x, S, rects) {
      x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, S, S);
      blotches(x, S, 26, ['170,170,170', '190,190,190', '110,110,110'], 52, 16, 60, 0.3);
      const Rp = mulberry32(56);
      for (let i = 0; i < 14; i++) {
        x.fillStyle = 'rgba(70,70,70,.6)';
        x.beginPath(); x.ellipse(Rp() * S, Rp() * S, 3 + Rp() * 9, 2 + Rp() * 7, Rp() * TAU, 0, TAU); x.fill();
      }
      windowH(x, rects);
    } },
  { key: 'brick', hnoise: [0.10, 62], rough: [0.86, -0.10, 0], metal: 0, bump: 1.8,
    albedo(x, S) {
      x.fillStyle = '#8a6a5a'; x.fillRect(0, 0, S, S);
      const R = mulberry32(61), bh = S / 8, bw = S / 4;
      for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
        const off = (r % 2) * bw / 2;
        const px = k * bw + off, py = r * bh;
        const t = 0.8 + R() * 0.4;
        x.fillStyle = 'rgb(' + Math.round(150*t) + ',' + Math.round(96*t) + ',' + Math.round(78*t) + ')';
        x.fillRect(px + 2, py + 2, bw - 4, bh - 4);
      }
      noiseFill(x, S, 0.12, 62, true);
      blotches(x, S, 12, ['60,50,46'], 63, 12, 40, 0.16);
      speckle(x, S, 380, 64, ['190,150,130', '96,66,56'], 0.4, 1.2, 0.2);
      streaks(x, S, 8, 65, '58,44,38', 3, 10, 30, 110);
      /* высолы по швам */
      x.fillStyle = 'rgba(226,220,214,.16)';
      for (let r = 0; r < 8; r++) x.fillRect(0, r * (S / 8) - 1, S, 2);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#464646'; x.fillRect(0, 0, S, S);          /* раствор — низко */
      const R = mulberry32(61), bh = S / 8, bw = S / 4;
      for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
        const off = (r % 2) * bw / 2;
        const px = k * bw + off, py = r * bh;
        const t = 0.8 + R() * 0.4;
        x.fillStyle = gray(0.52 + (t - 1) * 0.5);
        x.fillRect(px + 2, py + 2, bw - 4, bh - 4);
      }
      blotches(x, S, 12, ['60,60,60'], 63, 12, 40, 0.25);
      speckle(x, S, 380, 64, ['200,200,200', '90,90,90'], 0.4, 1.2, 0.4);
    } },
  { key: 'indust', hnoise: [0.05, 72], rough: [0.9, 0, 0], roughMetal: 0.42, bump: 2.2,
    albedo(x, S) {
      x.fillStyle = '#79808c'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 16) {
        const g = x.createLinearGradient(i, 0, i + 16, 0);
        g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.20)');
        x.fillStyle = g; x.fillRect(i, 0, 16, S);
      }
      blotches(x, S, 18, ['140,90,50', '90,70,60'], 71, 10, 46, 0.22);
      noiseFill(x, S, 0.10, 72, true);
      const rects = [];
      for (let k = 0; k < 3; k++) rects.push(drawWindow(x, 18 + k * 80, 30, 56, 44, 300 + k, { frame: '#5f6672', cross: false }));
      return rects.map((r, i) => Object.assign({}, r, { on: i === 1 ? 0 : 1 }));
    },
    height(x, S, rects) {
      /* профлист: волна поперёк листа, шаг 16 логических пикселей */
      for (let i = 0; i < S; i += 16) {
        const g = x.createLinearGradient(i, 0, i + 16, 0);
        g.addColorStop(0, '#4a4a4a'); g.addColorStop(0.45, '#c4c4c4'); g.addColorStop(0.6, '#c4c4c4'); g.addColorStop(1, '#4a4a4a');
        x.fillStyle = g; x.fillRect(i, 0, 16, S);
      }
      blotches(x, S, 18, ['150,150,150', '120,120,120'], 71, 10, 46, 0.3);
      windowH(x, rects);
    },
    metal(x, S) {   /* лист — металл, ржавчина и стёкла — нет */
      x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
      blotches(x, S, 18, ['0,0,0'], 71, 10, 46, 0.95);
      for (let k = 0; k < 3; k++) { x.fillStyle = '#000'; x.fillRect(18 + k * 80, 30, 56, 44); }
    } },
  { key: 'garage', hnoise: [0.05, 82], rough: [0.9, 0, 0], roughMetal: 0.5, bump: 2.0,
    albedo(x, S) {
      x.fillStyle = '#8d8a86'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 26) {
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, i, S, 4);
        x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, i + 4, S, 3);
      }
      blotches(x, S, 20, ['150,80,40', '70,60,55'], 81, 8, 40, 0.28);
      noiseFill(x, S, 0.12, 82, true);
      x.fillStyle = 'rgba(40,36,44,.8)'; x.fillRect(S / 2 - 16, S * 0.62, 32, 10);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < S; i += 26) {
        x.fillStyle = '#3a3a3a'; x.fillRect(0, i, S, 4);
        x.fillStyle = '#b8b8b8'; x.fillRect(0, i + 4, S, 3);
      }
      blotches(x, S, 20, ['140,140,140', '110,110,110'], 81, 8, 40, 0.3);
      x.fillStyle = '#303030'; x.fillRect(S / 2 - 16, S * 0.62, 32, 10);
    },
    metal(x, S) {
      x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
      blotches(x, S, 20, ['0,0,0'], 81, 8, 40, 0.95);
    } },
  { key: 'roof', hnoise: [0.12, 91], rough: [0.88, 0, 0], metal: 0, bump: 1.4,
    albedo(x, S) {
      x.fillStyle = '#4a4550'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.22, 91, true);
      blotches(x, S, 26, ['30,28,34', '90,84,96', '70,60,50'], 92, 14, 54, 0.24);
      x.strokeStyle = 'rgba(30,26,34,.5)'; x.lineWidth = 3;
      for (let i = 0; i <= 3; i++) { x.beginPath(); x.moveTo(0, i * S / 3); x.lineTo(S, i * S / 3); x.stroke(); }
      cracks(x, S, 6, 93, 'rgba(20,16,24,.5)', 1.6);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
      blotches(x, S, 26, ['110,110,110', '150,150,150', '130,130,130'], 92, 14, 54, 0.3);
      x.strokeStyle = 'rgba(0,0,0,.75)'; x.lineWidth = 3;
      for (let i = 0; i <= 3; i++) { x.beginPath(); x.moveTo(0, i * S / 3); x.lineTo(S, i * S / 3); x.stroke(); }
      cracks(x, S, 6, 93, 'rgba(0,0,0,.65)', 1.6);
    } },
  { key: 'ground', hnoise: [0.14, 102], rough: [0.92, 0, 0], metal: 0, bump: 1.6,
    albedo(x, S) {
      x.fillStyle = '#5b5348'; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, ['86,102,60', '70,64,52', '120,110,92'], 101, 14, 70, 0.3);
      noiseFill(x, S, 0.20, 102, true);
      const R = mulberry32(103);
      for (let i = 0; i < 160; i++) {
        x.fillStyle = 'rgba(' + (90 + R() * 60) + ',' + (100 + R() * 60) + ',' + (60 + R() * 40) + ',.5)';
        x.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3);
      }
      return [];
    },
    height(x, S) {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, ['160,160,160', '100,100,100', '140,140,140'], 101, 14, 70, 0.35);
      const R = mulberry32(103);
      for (let i = 0; i < 160; i++) {
        R(); R(); R();
        x.fillStyle = 'rgba(210,210,210,.7)';
        x.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3);
      }
    } },
  { key: 'grass', rough: [0.9, 0, 0], metal: 0, bump: 1.2,
    albedo(x, S) {
      x.fillStyle = '#4a6136'; x.fillRect(0, 0, S, S);
      const R = mulberry32(111);
      for (let i = 0; i < 900; i++) {
        const px = R() * S, py = R() * S;
        x.strokeStyle = 'rgba(' + (60 + R() * 60) + ',' + (90 + R() * 70) + ',' + (40 + R() * 40) + ',.8)';
        x.lineWidth = 1 + R();
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - .5) * 5, py - 3 - R() * 5); x.stroke();
      }
      blotches(x, S, 18, ['80,90,50', '50,60,36'], 112, 16, 60, 0.3);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#5c5c5c'; x.fillRect(0, 0, S, S);
      const R = mulberry32(111);
      for (let i = 0; i < 900; i++) {
        const px = R() * S, py = R() * S;
        const g = 120 + R() * 90; R(); R();
        x.strokeStyle = 'rgba(' + g + ',' + g + ',' + g + ',.85)';
        x.lineWidth = 1 + R();
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - .5) * 5, py - 3 - R() * 5); x.stroke();
      }
      blotches(x, S, 18, ['140,140,140', '70,70,70'], 112, 16, 60, 0.3);
    } },
  { key: 'bark', hnoise: [0.12, 132], rough: [0.9, 0, 0], metal: 0, bump: 1.6, tri: 1.3,
    albedo(x, S) {
      x.fillStyle = '#4e3b2c'; x.fillRect(0, 0, S, S);
      const R = mulberry32(131);
      for (let i = 0; i < 60; i++) {
        x.strokeStyle = 'rgba(' + (30 + R() * 40) + ',' + (24 + R() * 30) + ',' + (18 + R() * 20) + ',.6)';
        x.lineWidth = 1 + R() * 4;
        const px = R() * S;
        x.beginPath(); x.moveTo(px, 0);
        for (let y = 0; y < S; y += 16) x.lineTo(px + (R() - .5) * 8, y);
        x.stroke();
      }
      noiseFill(x, S, 0.16, 132, true);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, S, S);
      const R = mulberry32(131);
      for (let i = 0; i < 60; i++) {
        const g = 40 + R() * 60; R(); R();
        x.strokeStyle = 'rgba(' + g + ',' + g + ',' + g + ',.75)';
        x.lineWidth = 1 + R() * 4;
        const px = R() * S;
        x.beginPath(); x.moveTo(px, 0);
        for (let y = 0; y < S; y += 16) x.lineTo(px + (R() - .5) * 8, y);
        x.stroke();
      }
    } },
  { key: 'birch', hnoise: [0.05, 139], rough: [0.72, 0, 0], metal: 0, bump: 1.0, tri: 1.3,
    albedo(x, S) {
      x.fillStyle = '#e7e3d8'; x.fillRect(0, 0, S, S);
      blotches(x, S, 22, ['198,190,176', '224,214,196', '176,166,152'], 138, 10, 48, 0.45);
      const R = mulberry32(137);
      for (let i = 0; i < 90; i++) {                 /* чечевички: поперечные чёрные штрихи */
        const px = R() * S, py = R() * S, w = 6 + R() * 34, hgt = 1.5 + R() * 3.5;
        x.fillStyle = 'rgba(' + Math.round(26 + R() * 24) + ',' + Math.round(22 + R() * 20) + ',' + Math.round(20 + R() * 18) + ',' + (0.55 + R() * 0.35).toFixed(2) + ')';
        x.beginPath(); x.ellipse(px, py, w / 2, hgt / 2, (R() - .5) * 0.2, 0, TAU); x.fill();
      }
      for (let i = 0; i < 5; i++) {                  /* тёмные наплывы у сучьев */
        const px = R() * S, py = R() * S, r = 8 + R() * 14;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(38,32,28,.75)'); g.addColorStop(1, 'rgba(38,32,28,0)');
        x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      noiseFill(x, S, 0.10, 139, true);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, S, S);
      blotches(x, S, 22, ['150,150,150', '125,125,125', '160,160,160'], 138, 10, 48, 0.3);
      const R = mulberry32(137);
      for (let i = 0; i < 90; i++) {
        const px = R() * S, py = R() * S, w = 6 + R() * 34, hgt = 1.5 + R() * 3.5;
        R(); R(); R(); R();
        x.fillStyle = 'rgba(60,60,60,.7)';
        x.beginPath(); x.ellipse(px, py, w / 2, hgt / 2, (R() - .5) * 0.2, 0, TAU); x.fill();
      }
      for (let i = 0; i < 5; i++) {
        const px = R() * S, py = R() * S, r = 8 + R() * 14;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(50,50,50,.8)'); g.addColorStop(1, 'rgba(50,50,50,0)');
        x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
      }
    } },
  { key: 'metal', hnoise: [0.04, 141], rough: [0.52, 0, 0], metal: 0.25, bump: 0.8,
    albedo(x, S) {
      x.fillStyle = '#cfd2d8'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.08, 141, true);
      blotches(x, S, 14, ['150,110,70', '90,95,105'], 142, 8, 36, 0.2);
      return [];
    },
    height(x, S) {
      x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
      blotches(x, S, 14, ['140,140,140', '110,110,110'], 142, 8, 36, 0.35);
    } },
  { key: 'shopGlass', rough: [0.14, 0, 0], metal: 0, bump: 1.2,
    albedo(x, S) {
      const g = x.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#2b3b52'); g.addColorStop(0.5, '#48627f'); g.addColorStop(1, '#1f2b3e');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = -2; i < 6; i++) x.fillRect(i * 60, 0, 22, S);
      x.fillStyle = '#3a3446';
      x.fillRect(0, 0, 8, S); x.fillRect(S - 8, 0, 8, S); x.fillRect(0, 0, S, 8); x.fillRect(0, S - 10, S, 10);
      x.fillRect(S / 2 - 5, 0, 10, S);
      /* намёк на интерьер */
      x.fillStyle = 'rgba(255,230,180,.35)'; x.fillRect(18, S * 0.45, S / 2 - 34, S * 0.4);
      x.fillStyle = 'rgba(200,240,255,.25)'; x.fillRect(S / 2 + 16, S * 0.5, S / 2 - 34, S * 0.34);
      return [{ wx: 10, wy: 10, ww: S - 20, wh: S - 22, on: 0.85 }];
    },
    height(x, S) {
      x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, S, S);           /* стекло утоплено */
      x.fillStyle = '#b0b0b0';
      x.fillRect(0, 0, 8, S); x.fillRect(S - 8, 0, 8, S); x.fillRect(0, 0, S, 8); x.fillRect(0, S - 10, S, 10);
      x.fillRect(S / 2 - 5, 0, 10, S);
    } }
];

/* --- карты, у которых только albedo ----------------------------------- */
/* Атлас зелени (альфа-тест). 2x2 ячейки по 256 логических пикселей. Атлас,
   а не четыре текстуры: вся зелень остаётся ОДНИМ альфа-батчем. Породу
   различает форма карт и цвет вершин (vCol умножается на текстуру).
     broad — широкий лист (клён, палая листва)
     veil  — мелкий лист (берёза, тополь, куст, изгородь, вьюн)
     fir   — еловая лапа, перо идёт слева направо, вдоль оси U
     tuft  — пучок узких листьев от нижней кромки + соцветия сверху */
export function paintLeaves(x, A) {
  const H = A / 2, pad = 10;      /* поле, чтобы мипы не мешали ячейки */
  const R = mulberry32(121);
  const cellAt = (cx, cy, draw) => {
    x.save(); x.translate(cx * H, cy * H);
    x.beginPath(); x.rect(0, 0, H, H); x.clip();
    draw(); x.restore();
  };
  /* широкий лист: масса крупных листьев в круге, низ глуше */
  cellAt(0, 0, () => {
    for (let i = 0; i < 520; i++) {
      const px = H / 2 + (R() - .5) * (H - pad * 2), py = H / 2 + (R() - .5) * (H - pad * 2);
      const d = Math.hypot(px - H / 2, py - H / 2) / (H / 2 - pad);
      if (d > 1 || R() < d * d * 0.7) continue;
      const r = (10 + R() * 18) * (1 - d * 0.35), k = py > H * 0.56 ? 0.74 : 1;
      x.fillStyle = 'rgb(' + Math.round((46 + R() * 38) * k) + ',' + Math.round((80 + R() * 64) * k) + ',' + Math.round((34 + R() * 38) * k) + ')';
      x.beginPath(); x.ellipse(px, py, r, r * (0.6 + R() * 0.5), R() * Math.PI, 0, TAU); x.fill();
    }
  });
  /* мелкий лист: вытянутая вуаль с просветами и рваным контуром */
  cellAt(1, 0, () => {
    /* Веточки рисуем тонкими и бледными: при увеличении карты жирные штрихи
       читаются висящими полосами, а не ветками. */
    x.strokeStyle = 'rgba(58,48,36,.28)'; x.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      x.beginPath(); x.moveTo(H / 2, H - pad);
      x.quadraticCurveTo(H / 2 + (R() - .5) * H * .3, H * .55, H / 2 + (R() - .5) * H * .5, pad + R() * H * .45);
      x.stroke();
    }
    for (let i = 0; i < 1100; i++) {
      const px = H / 2 + (R() - .5) * (H - pad * 2) * 0.94, py = H / 2 + (R() - .5) * (H - pad * 2);
      const d = Math.hypot((px - H / 2) / (H * 0.46), (py - H / 2) / (H * 0.47));
      if (d > 1 || R() < d * d * 0.85) continue;
      const r = 4.5 + R() * 9, k = py > H * 0.60 ? 0.78 : 1;
      x.fillStyle = 'rgb(' + Math.round((52 + R() * 44) * k) + ',' + Math.round((92 + R() * 68) * k) + ',' + Math.round((38 + R() * 40) * k) + ')';
      x.beginPath(); x.ellipse(px, py, r, r * (0.55 + R() * 0.5), R() * Math.PI, 0, TAU); x.fill();
    }
  });
  /* еловая лапа: веточка слева направо, хвоинки назад-вбок и короче к концу */
  cellAt(0, 1, () => {
    const y0 = H / 2;
    x.lineCap = 'round';
    x.strokeStyle = '#4a3c2a'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(pad * .5, y0); x.lineTo(H - pad, y0); x.stroke();
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 90; i++) {
      const t = 0.04 + R() * 0.94, bx = pad + t * (H - pad * 2);
      const ln = H * 0.30 * (1 - t * 0.72) * (0.6 + R() * 0.6);
      x.strokeStyle = 'rgb(' + Math.round(26 + R() * 30) + ',' + Math.round(60 + R() * 46) + ',' + Math.round(30 + R() * 28) + ')';
      x.lineWidth = 1.6 + R() * 1.6;
      x.beginPath(); x.moveTo(bx, y0); x.lineTo(bx + ln * 0.45, y0 + s * ln); x.stroke();
    }
  });
  /* пучок: клинки растут от НИЖНЕЙ кромки ячейки, сверху — светлые соцветия */
  cellAt(1, 1, () => {
    for (let i = 0; i < 40; i++) {
      const bx = pad + R() * (H - pad * 2), hgt = H * (0.42 + R() * 0.55);
      const lean = (R() - .5) * H * 0.30, w = 2.5 + R() * 4.5;
      x.fillStyle = 'rgb(' + Math.round(52 + R() * 52) + ',' + Math.round(88 + R() * 70) + ',' + Math.round(36 + R() * 42) + ')';
      x.beginPath();
      x.moveTo(bx - w / 2, H);
      x.quadraticCurveTo(bx + lean * 0.4 + w / 2, H - hgt * 0.55, bx + lean, H - hgt);
      x.quadraticCurveTo(bx + lean * 0.4 - w / 2, H - hgt * 0.55, bx + w / 2, H);
      x.fill();
    }
    for (let i = 0; i < 14; i++) {          /* соцветия почти белые — цвет им даёт vCol */
      const px = pad + R() * (H - pad * 2), py = pad + R() * H * 0.34;
      x.fillStyle = 'rgb(' + Math.round(226 + R() * 26) + ',' + Math.round(216 + R() * 26) + ',' + Math.round(206 + R() * 30) + ')';
      x.beginPath(); x.arc(px, py, 3.5 + R() * 4.5, 0, TAU); x.fill();
    }
  });
}
/* атлас дорожных знаков 4x2: обобщённые пиктограммы, без брендов */
export function paintRoadsign(x, A) {
  const Q4 = A / 4, Hh = A / 2;
  const cell = (col, row, fn) => { x.save(); x.translate(col * Q4 + Q4 / 2, row * Hh + Hh / 2); fn(); x.restore(); };
  const tri = (fill, edge) => {            /* предупреждающий треугольник */
    x.beginPath(); x.moveTo(0, -Q4 * 0.42); x.lineTo(Q4 * 0.46, Q4 * 0.36); x.lineTo(-Q4 * 0.46, Q4 * 0.36); x.closePath();
    x.fillStyle = edge; x.fill();
    x.beginPath(); x.moveTo(0, -Q4 * 0.30); x.lineTo(Q4 * 0.36, Q4 * 0.29); x.lineTo(-Q4 * 0.36, Q4 * 0.29); x.closePath();
    x.fillStyle = fill; x.fill();
  };
  const circ = (fill, edge) => {
    x.beginPath(); x.arc(0, 0, Q4 * 0.44, 0, TAU); x.fillStyle = edge; x.fill();
    x.beginPath(); x.arc(0, 0, Q4 * 0.35, 0, TAU); x.fillStyle = fill; x.fill();
  };
  const ink = '#1a1620';
  cell(0, 0, () => { tri('#f4f0e6', '#c02a24');                      /* лежачий полицейский */
    x.fillStyle = ink; x.beginPath(); x.ellipse(0, Q4 * 0.12, Q4 * 0.24, Q4 * 0.11, 0, Math.PI, TAU); x.fill();
    x.fillRect(-Q4 * 0.26, Q4 * 0.12, Q4 * 0.52, Q4 * 0.04); });
  cell(1, 0, () => { circ('#f4f0e6', '#c02a24');                     /* ограничение 20 */
    x.fillStyle = ink; x.font = 'bold ' + Math.round(Q4 * 0.44) + 'px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('20', 0, Q4 * 0.02); });
  cell(2, 0, () => {                                                 /* пешеходный переход */
    x.fillStyle = '#1d4b8f'; x.beginPath();
    x.moveTo(0, -Q4 * 0.44); x.lineTo(Q4 * 0.44, 0); x.lineTo(0, Q4 * 0.44); x.lineTo(-Q4 * 0.44, 0); x.closePath(); x.fill();
    x.fillStyle = '#f4f0e6';
    for (let i = 0; i < 4; i++) x.fillRect(-Q4 * 0.20 + i * Q4 * 0.11, Q4 * 0.02, Q4 * 0.06, Q4 * 0.20);
    x.beginPath(); x.arc(-Q4 * 0.02, -Q4 * 0.20, Q4 * 0.055, 0, TAU); x.fill();
    x.fillRect(-Q4 * 0.05, -Q4 * 0.14, Q4 * 0.07, Q4 * 0.18); });
  cell(3, 0, () => {                                                 /* уступи дорогу */
    x.beginPath(); x.moveTo(0, Q4 * 0.44); x.lineTo(Q4 * 0.46, -Q4 * 0.36); x.lineTo(-Q4 * 0.46, -Q4 * 0.36); x.closePath();
    x.fillStyle = '#c02a24'; x.fill();
    x.beginPath(); x.moveTo(0, Q4 * 0.30); x.lineTo(Q4 * 0.36, -Q4 * 0.27); x.lineTo(-Q4 * 0.36, -Q4 * 0.27); x.closePath();
    x.fillStyle = '#f4f0e6'; x.fill(); });
  cell(0, 1, () => {                                                 /* стоп */
    x.fillStyle = '#b0241f'; x.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; const r = Q4 * 0.45;
      i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
    x.fillStyle = '#f4f0e6'; x.font = 'bold ' + Math.round(Q4 * 0.26) + 'px sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('СТОП', 0, Q4 * 0.02); });
  cell(1, 1, () => { circ('#c02a24', '#f4f0e6');                     /* въезд запрещён */
    x.fillStyle = '#f4f0e6'; x.fillRect(-Q4 * 0.26, -Q4 * 0.07, Q4 * 0.52, Q4 * 0.14); });
  cell(2, 1, () => { tri('#f4f0e6', '#c02a24');                      /* дорожные работы */
    x.fillStyle = ink; x.fillRect(-Q4 * 0.03, -Q4 * 0.20, Q4 * 0.06, Q4 * 0.40);
    x.beginPath(); x.moveTo(-Q4 * 0.20, -Q4 * 0.06); x.lineTo(Q4 * 0.02, -Q4 * 0.22);
    x.lineTo(Q4 * 0.08, -Q4 * 0.12); x.lineTo(-Q4 * 0.14, Q4 * 0.02); x.closePath(); x.fill(); });
  cell(3, 1, () => { tri('#f4f0e6', '#c02a24');                      /* яма на дороге */
    x.fillStyle = ink; x.beginPath();
    x.moveTo(-Q4 * 0.26, Q4 * 0.20); x.lineTo(-Q4 * 0.10, -Q4 * 0.06); x.lineTo(Q4 * 0.08, Q4 * 0.06);
    x.lineTo(Q4 * 0.26, -Q4 * 0.14); x.lineTo(Q4 * 0.24, Q4 * 0.22); x.closePath(); x.fill(); });
}
/* мелкие: белая заглушка для крашеных вершинами, ткань, краска кузова */
export const SMALL_DEFS = [
  { key: 'white', size: 4, rough: 0.6, metal: 0, paint(x, S) { x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); } },
  { key: 'cloth', size: 128, rough: 0.92, metal: 0, paint(x, S) {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
      x.globalAlpha = 0.07;                            /* переплетение нитей */
      for (let i = 0; i < S; i += 3) { x.fillStyle = '#000'; x.fillRect(0, i, S, 1); x.fillRect(i, 0, 1, S); }
      x.globalAlpha = 1;
      noiseFill(x, S, 0.05, 733, true);
      const R = mulberry32(734);                       /* редкие потёртости и складки */
      for (let i = 0; i < 26; i++) {
        const px = R() * S, py = R() * S;
        const g = x.createRadialGradient(px, py, 0, px, py, 6 + R() * 14);
        g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, 20, 0, TAU); x.fill();
      }
    } },
  { key: 'paint', size: 64, rough: 0.5, metal: 0, paint(x, S) {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
      noiseFill(x, S, 0.05, 151, true);
      const g = x.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.20)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    } }
];
/* detail-нормаль: мелкое зерно без структуры, подмешивается вблизи */
export function paintDetail(x, S) {
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  speckle(x, S, 2600, 901, ['200,200,200', '120,120,120', '235,235,235', '90,90,90'], 0.4, 2.0, 0.55);
  blotches(x, S, 70, ['150,150,150', '100,100,100'], 903, 3, 12, 0.4);
  noiseFill(x, S, 0.30, 902, true);
}

/* --- из высот в карты ------------------------------------------------ */
export function heightOf(d, n) { const h = new Float32Array(n); for (let i = 0; i < n; i++) h[i] = d[i * 4] / 255; return h; }
/* зерно высот численно: тот же mulberry32, что у noiseFill, но без прогона через холст */
export function addNoise(h, n, amt, seed) { const R = mulberry32(seed); for (let i = 0; i < n; i++) h[i] += (R() - 0.5) * amt; }
/* Собель по замкнутому (тайлящемуся) полю высот. Строки холста идут сверху
   вниз, а ось v текстуры — снизу вверх, отсюда знак у ny. */
export function sobelNormal(h, w, hh, k, out) {
  for (let y = 0; y < hh; y++) {
    const y0 = (y - 1 + hh) % hh, y1 = (y + 1) % hh;
    for (let x = 0; x < w; x++) {
      const x0 = (x - 1 + w) % w, x1 = (x + 1) % w;
      const dx = (h[y0*w+x1] + 2*h[y*w+x1] + h[y1*w+x1]) - (h[y0*w+x0] + 2*h[y*w+x0] + h[y1*w+x0]);
      const dy = (h[y1*w+x0] + 2*h[y1*w+x] + h[y1*w+x1]) - (h[y0*w+x0] + 2*h[y0*w+x] + h[y0*w+x1]);
      const nx = -dx * k, ny = dy * k, l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * w + x) * 4;
      out[o] = (nx * l * 0.5 + 0.5) * 255; out[o + 1] = (ny * l * 0.5 + 0.5) * 255;
    }
  }
}
/* коробочное размытие с заворотом, два прохода */
export function blurWrap(src, w, hh, r) {
  const tmp = new Float32Array(w * hh), out = new Float32Array(w * hh), inv = 1 / (2 * r + 1);
  /* по строкам: бегущая сумма, заворот только на краях */
  for (let y = 0; y < hh; y++) {
    const row = y * w; let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + (i < 0 ? i + w : i)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * inv;
      let xa = x + r + 1, xb = x - r; if (xa >= w) xa -= w; if (xb < 0) xb += w;
      acc += src[row + xa] - src[row + xb];
    }
  }
  /* по столбцам: сумма для всей строки разом — обход по памяти последовательный */
  const acc = new Float32Array(w);
  for (let i = -r; i <= r; i++) { const row = (i < 0 ? i + hh : i) * w; for (let x = 0; x < w; x++) acc[x] += src === tmp ? 0 : tmp[row + x]; }
  for (let y = 0; y < hh; y++) {
    const row = y * w;
    let ya = y + r + 1, yb = y - r; if (ya >= hh) ya -= hh; if (yb < 0) yb += hh;
    const ra = ya * w, rb = yb * w;
    for (let x = 0; x < w; x++) { out[row + x] = acc[x] * inv; acc[x] += tmp[ra + x] - tmp[rb + x]; }
  }
  return out;
}

/* --- GPU: массивы слоёв ----------------------------------------------- */
export function makeArrayTex(gl, w, h, layers, kind, opt) {
  const tex = gl.createTexture(), T = gl.TEXTURE_2D_ARRAY;
  gl.bindTexture(T, tex);
  const levels = 1 + Math.floor(Math.log2(Math.max(w, h)));
  const ifmt = kind === 'srgb' ? gl.SRGB8_ALPHA8 : kind === 'r8' ? gl.R8 : gl.RGBA8;
  gl.texStorage3D(T, levels, ifmt, w, h, layers);
  const wrap = opt && opt.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
  gl.texParameteri(T, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(T, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(T, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(T, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (GL.aniso) gl.texParameterf(T, GL.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(1, Math.min(Q.aniso, GL.maxAniso)));
  const bpp = kind === 'r8' ? 1 : 4;
  return TexReg.add({ tex, target: T, w, h, layers, kind, bpp, levels, bytes: Math.round(w * h * layers * bpp * 4 / 3) });
}
export function uploadLayer(gl, rec, layer, data) {
  gl.bindTexture(rec.target, rec.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage3D(rec.target, 0, 0, 0, layer, rec.w, rec.h, 1, rec.kind === 'r8' ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, data);
}
/* группа материалов одного размера: albedo, а для поверхностей ещё surf и ao */
export function makeGroup(gl, w, h, names, opt) {
  const g = { w, h, n: names.length, names, recs: [], clamp: !!opt.clamp };
  g.albedo = makeArrayTex(gl, w, h, g.n, 'srgb', opt); g.recs.push(g.albedo);
  if (opt.surf) {
    g.surf = makeArrayTex(gl, w, h, g.n, 'rgba', opt);
    g.ao = makeArrayTex(gl, w, h, g.n, 'r8', opt);
    g.recs.push(g.surf, g.ao);
  }
  return g;
}
export function finishGroup(gl, recs) { for (const r of recs) { gl.bindTexture(r.target, r.tex); gl.generateMipmap(r.target); } }

/* --- сборка слоёв ----------------------------------------------------- */
export function buildSurfLayer(gl, grp, def, layer) {
  const S = QCFG.tex.surfSize, w = grp.w, n = w * w, T = QCFG.tex;
  const A = cv2d(S); const rects = def.albedo(A.x, S) || [];
  const a = pix(A.c);
  applyEmis(a, w, w, rects);
  const Hc = cv2d(S); Hc.x.fillStyle = '#808080'; Hc.x.fillRect(0, 0, S, S); def.height(Hc.x, S, rects);
  const h = heightOf(pix(Hc.c), n);
  if (def.hnoise) addNoise(h, n, def.hnoise[0], def.hnoise[1]);
  let mm = null;
  if (typeof def.metal === 'function') { const Mc = cv2d(S); Mc.x.fillStyle = '#000'; Mc.x.fillRect(0, 0, S, S); def.metal(Mc.x, S); mm = pix(Mc.c); }
  const surf = new Uint8ClampedArray(n * 4), ao = new Uint8ClampedArray(n);
  sobelNormal(h, w, w, def.bump * TEX_SS * 0.5, surf);
  const blur = blurWrap(h, w, w, Math.max(1, Math.round(T.aoRadius * TEX_SS)));
  const rb = def.rough[0], rh = def.rough[1], rl = def.rough[2], mc = typeof def.metal === 'number' ? def.metal : 0;
  const rm = def.roughMetal, aoK = T.aoStrength;
  for (let i = 0; i < n; i++) {
    const hv = h[i], o = i * 4;
    const lum = (a[o] * 0.299 + a[o + 1] * 0.587 + a[o + 2] * 0.114) * (1 / 255);
    const m = mm ? mm[o] * (1 / 255) : mc;
    let r = rb + rh * (hv - 0.5) + rl * (lum - 0.5);
    if (rm !== undefined) r += (rm - r) * m;
    surf[o + 2] = (r < 0.02 ? 0.02 : r > 1 ? 1 : r) * 255; surf[o + 3] = m * 255;
    let c = (blur[i] - hv) * aoK; c = c < 0 ? 0 : c > 0.85 ? 0.85 : c;
    ao[i] = (1 - c) * 255;
  }
  uploadLayer(gl, grp.albedo, layer, flipRows(a, w, w, 4));
  uploadLayer(gl, grp.surf, layer, flipRows(surf, w, w, 4));
  uploadLayer(gl, grp.ao, layer, flipRows(ao, w, w, 1));
}
export function buildCardLayer(gl, grp, layer, paint) {
  const A = QCFG.tex.cardSize, w = grp.w;
  const { c, x } = cv2d(A);
  x.clearRect(0, 0, A, A);
  paint(x, A);
  const d = pix(c);
  bleedAlpha(d, w, w, 2);
  uploadLayer(gl, grp.albedo, layer, flipRows(d, w, w, 4));
}
export function buildSmallLayer(gl, grp, def) {
  const { c, x } = cv2d(def.size);
  def.paint(x, def.size);
  const d = pix(c);
  for (let i = 3; i < d.length; i += 4) d[i] = 0;
  uploadLayer(gl, grp.albedo, 0, flipRows(d, grp.w, grp.h, 4));
}
export function buildDetail(gl) {
  const S = QCFG.tex.detailSize, w = S * TEX_SS, n = w * w;
  const { c, x } = cv2d(S);
  paintDetail(x, S);
  const h = heightOf(pix(c), n);
  const out = new Uint8ClampedArray(n * 4);
  sobelNormal(h, w, w, 1.3 * TEX_SS * 0.5, out);
  for (let i = 0; i < n; i++) { out[i * 4 + 2] = 255; out[i * 4 + 3] = 255; }
  const rec = makeArrayTex(gl, w, w, 1, 'rgba', {});
  uploadLayer(gl, rec, 0, flipRows(out, w, w, 4));
  return rec;
}
/* вывеска: текст светится ночью (альфа = маска свечения) */
export function buildSignLayer(gl, grp, layer, text, color, fill) {
  const [lw, lh] = QCFG.tex.signSize;
  const { c, x } = cv2d(lw, lh);
  x.fillStyle = '#241a33'; x.fillRect(0, 0, lw, lh);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.strokeRect(1.5, 1.5, lw - 3, lh - 3);
  let size = 37;
  x.font = '900 ' + size + 'px "Arial Black", sans-serif';
  while (x.measureText(text).width > lw - 20 && size > 8) {
    size -= 1.5; x.font = '900 ' + size + 'px "Arial Black", sans-serif';
  }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  /* fill: длинная строка ужимается по ширине слоя и занимает по высоте пятую
     часть холста — на щите такие буквы не прочитать. Растягиваем их по вертикали
     на весь слой, а высоту квада в BUILDINGS задаём равной высоте букв. */
  /* transform, а не setTransform: у холста уже стоит масштаб TEX_SS из cv2d,
     и сбросить его — значит нарисовать текст вдвое мельче и не по центру. */
  x.save();
  if (fill) {
    const k = (lh - 6) / (size * 0.74);
    x.transform(1, 0, 0, k, 0, lh / 2 - (lh / 2) * k);
  }
  x.shadowColor = color; x.shadowBlur = 13 * TEX_SS;   /* тень не масштабируется трансформом */
  x.fillStyle = color; x.fillText(text, lw / 2, lh / 2 + 1);
  x.shadowBlur = 0;
  /* Второй проход добирает непрозрачность: alphaFromLuma считает альфу по
     яркости, и чистый красный дал бы полупрозрачные буквы. Обычным вывескам
     район ставит белую сердцевину, вокзалу — светло-красную, чтобы надпись
     осталась цвета РЖД, а не розовой. */
  x.fillStyle = fill ? 'rgba(255,122,126,.86)' : 'rgba(255,255,255,.55)';
  x.font = '900 ' + size + 'px "Arial Black", sans-serif';
  x.fillText(text, lw / 2, lh / 2);
  x.restore();
  const d = pix(c);
  alphaFromLuma(d);
  uploadLayer(gl, grp.albedo, layer, flipRows(d, grp.w, grp.h, 4));
}

/* --- задания: генерация порциями между кадрами ------------------------- */
export async function runJobs(jobs, progress) {
  let t0 = performance.now();
  for (let i = 0; i < jobs.length; i++) {
    if (progress) progress(i / jobs.length, jobs[i][0]);
    jobs[i][1]();
    if (performance.now() - t0 > 14) { await Loader.yield(); t0 = performance.now(); }
  }
  if (progress) progress(1, null);
}
export const matRec = (grp, layer, rough, metal, tri) => ({ grp, layer, rough, metal, tri: tri || 0 });
/* Все материалы, кроме вывесок (их список появляется после сборки района).
   Новые текстуры собираются рядом со старыми и подменяются одним заданием. */
export async function buildTexturesAsync(gl, progress) {
  TEX_SS = Q.texSS;
  const T = QCFG.tex, sz = T.surfSize * TEX_SS, csz = T.cardSize * TEX_SS;
  const nu = {}, recs = [];
  const surf = makeGroup(gl, sz, sz, SURF_DEFS.map(d => d.key), { surf: true }); recs.push(...surf.recs);
  const cards = makeGroup(gl, csz, csz, ['leaves', 'roadsign'], {}); recs.push(...cards.recs);
  const jobs = [];
  SURF_DEFS.forEach((d, i) => jobs.push([d.key, () => {
    buildSurfLayer(gl, surf, d, i);
    nu[d.key] = matRec(surf, i, d.rough[0], typeof d.metal === 'number' ? d.metal : 1, d.tri);
  }]));
  jobs.push(['leaves', () => { buildCardLayer(gl, cards, 0, paintLeaves); nu.leaves = matRec(cards, 0, 0.9, 0); }]);
  jobs.push(['roadsign', () => { buildCardLayer(gl, cards, 1, paintRoadsign); nu.roadsign = matRec(cards, 1, 0.35, 0); }]);
  jobs.push(['small+detail', () => {
    for (const sm of SMALL_DEFS) {
      const g = makeGroup(gl, sm.size * TEX_SS, sm.size * TEX_SS, [sm.key], {});
      recs.push(...g.recs); buildSmallLayer(gl, g, sm);
      nu[sm.key] = matRec(g, 0, sm.rough, sm.metal);
    }
    const det = buildDetail(gl); recs.push(det); nu.__detail = det;
  }]);
  jobs.push(['mipmaps', () => {
    finishGroup(gl, recs);
    const old = Tex.recs;
    for (const k in nu) if (k !== '__detail') TX[k] = nu[k];
    Tex.detail = nu.__detail; Tex.recs = recs;
    R3.curGrp = null;
    if (old.length) TexReg.drop(gl, old);
  }]);
  await runJobs(jobs, progress);
}
/* Вывески: по слою на каждую, список — из Static.signs после buildWorld. */
export async function buildSignsAsync(gl, progress) {
  const n = Static.signs.length;
  if (!n) { if (progress) progress(1); return; }
  const [lw, lh] = QCFG.tex.signSize;
  const g = makeGroup(gl, lw * TEX_SS, lh * TEX_SS, Static.signs.map(s => s.text), { clamp: true });
  const jobs = Static.signs.map((sg, i) => ['вывеска ' + (i + 1), () => buildSignLayer(gl, g, i, sg.text, sg.color, sg.fill)]);
  jobs.push(['mipmaps вывесок', () => {
    finishGroup(gl, g.recs);
    Static.signs.forEach((sg, i) => { sg.mat = matRec(g, i, 0.5, 0); });
    const old = Tex.signRecs; Tex.signRecs = g.recs; TX.signs = g;
    R3.curGrp = null;
    if (old.length) TexReg.drop(gl, old);
  }]);
  await runJobs(jobs, progress);
}
/* Смена texSS в настройках: пересобрать всё прямо в игре, с полосой прогресса. */
export async function rebuildTextures() {
  if (Tex.busy) return;
  Tex.busy = true;
  Loader.show('Пересобираем текстуры…'); Loader.set('генерируем текстуры', 0);
  try {
    await buildTexturesAsync(GL.gl, (f, job) => Loader.set(job ? 'генерируем текстуры · ' + job : null, f * 0.85));
    Loader.set('рисуем вывески', 0.85);
    await buildSignsAsync(GL.gl, (f, job) => Loader.set(job ? 'рисуем вывески · ' + job : null, 0.85 + f * 0.15));
  } catch (e) { fatal(e, false); }
  Loader.hide();
  Tex.busy = false;
}
/* сводка для отчёта и настроек: сколько памяти под текстурами */
export function texInventory() {
  const rows = TexReg.list.map(r => r.w + '×' + r.h + '×' + r.layers + ' ' + r.kind);
  return { count: TexReg.list.length, MiB: +(TexReg.bytes() / 1048576).toFixed(2), rows };
}
