/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «4. Район: данные (всё в метрах)», строки 3706–3885.
   ===================================================================== */
import { mulberry32 } from '../core/util.js';

/* ------------------------------------------------------------------ */
/* 4. Район: данные (всё в метрах)                                      */
/* ------------------------------------------------------------------ */
export const W = { x: 200, z: 150 };            /* размеры района */
export const ROAD_W = 10.5, SIDE_W = 2.6;
export const ROADS_Z = [18.75, 75, 131.25];     /* дороги «восток-запад» */
export const ROADS_X = [25, 100, 175];          /* дороги «север-юг» */

/* kind: panel | stucco | brick | indust | garage | office */
export const BUILDINGS = [
  { x: 2.5, z: 38.7, w: 13.2, d: 9.4, h: 8, kind: 'stucco', tint: [.95,.86,.8], sign: { t: 'МОНТАЖ-СЕРВИС', c: '#25e8dc', side: 'S' }, shop: true, name: 'контора' },
  { x: 2.5, z: 27.4, w: 9.4, d: 5.6, h: 3, kind: 'garage', rows: 3 },
  { x: 2.5, z: 56.2, w: 10.6, d: 6.2, h: 3, kind: 'garage', rows: 3 },

  { x: 31.2, z: 25, w: 28.9, d: 7, h: 15, kind: 'panel', tint: [.92,.9,.95], name: 'ПАНЕЛЬНАЯ 12', entries: [43.7, 61.2], balcony: 'S' },
  { x: 63.2, z: 25, w: 24.7, d: 7, h: 15, kind: 'panel', tint: [.95,.88,.86], name: 'ПАНЕЛЬНАЯ 14', entries: [70, 83], balcony: 'S' },
  { x: 31.2, z: 43.7, w: 7, d: 24, h: 13.5, kind: 'panel', tint: [.88,.92,.95], balcony: 'E' },
  { x: 77.5, z: 40, w: 10.7, d: 18.7, h: 12, kind: 'panel', tint: [.95,.93,.86], balcony: 'W' },
  { x: 43.7, z: 61.9, w: 24, d: 5.7, h: 3, kind: 'garage', rows: 6 },
  { x: 70.6, z: 62, w: 5.7, d: 4.6, h: 3.5, kind: 'brick', sign: { t: 'ТП-4', c: '#ffd23f', side: 'S', small: true } },

  { x: 106.2, z: 25, w: 32.5, d: 12.6, h: 10, kind: 'indust', tint: [.9,.9,.95], sign: { t: 'СКЛАД «ЯЩИК И КО»', c: '#ff8a1f', side: 'S' }, gate: true },
  { x: 143.7, z: 25, w: 24, d: 10.7, h: 11, kind: 'indust', tint: [.95,.85,.85], sign: { t: 'ЦЕХ №3', c: '#ff2d95', side: 'S' } },
  { x: 106.2, z: 44.1, w: 18.7, d: 6.2, h: 3, kind: 'garage', rows: 5 },
  { x: 130.6, z: 43.7, w: 18.7, d: 8.9, h: 8, kind: 'indust', tint: [.85,.9,.85] },
  { x: 156.2, z: 44.1, w: 8.1, d: 6, h: 3.5, kind: 'brick', sign: { t: 'ТП-11', c: '#ffd23f', side: 'S', small: true } },
  { x: 131.9, z: 58.1, w: 15, d: 5.6, h: 3, kind: 'garage', rows: 4 },

  { x: 32.5, z: 88.7, w: 16.4, d: 9.5, h: 5.5, kind: 'stucco', tint: [.85,.95,.95], sign: { t: 'МАСТЕРСКАЯ «ВОСЬМЁРКА»', c: '#25e8dc', side: 'S' }, shop: true },
  { x: 62.5, z: 81.2, w: 18.7, d: 8.2, h: 6, kind: 'stucco', tint: [.98,.92,.8], sign: { t: 'КРЕПЁЖ И СОВЕСТЬ', c: '#ffd23f', side: 'S' }, shop: true },
  { x: 78.1, z: 97.5, w: 15.2, d: 8.2, h: 6, kind: 'stucco', tint: [.98,.85,.92], sign: { t: 'ПРОДУКТЫ 24 «СИНИЙ КИТ»', c: '#ff2d95', side: 'S' }, shop: true },
  { x: 53.1, z: 114.4, w: 14, d: 7.5, h: 5.5, kind: 'brick', sign: { t: 'ЧАЙНАЯ «ТЕРМОС»', c: '#4be36b', side: 'S' }, shop: true },
  { x: 81.2, z: 114.5, w: 11.5, d: 7, h: 5, kind: 'stucco', tint: [.95,.82,.82], sign: { t: 'РАЗЛИВНАЯ «ТРИ ГВОЗДЯ»', c: '#ff4d5e', side: 'S' }, shop: true },
  { x: 32.5, z: 106.2, w: 16.4, d: 5.7, h: 3, kind: 'garage', rows: 4 },
  { x: 55, z: 97.5, w: 11.2, d: 6.9, h: 12, kind: 'panel', tint: [.9,.9,.86] },

  { x: 121.9, z: 97.5, w: 32.5, d: 16.4, h: 26, kind: 'office', tint: [.86,.88,.98], sign: { t: 'БЦ «ПАНЕЛЬНЫЙ ТИТАН»', c: '#8a2be2', side: 'S' }, glassBand: true, entries: [138] },
  { x: 158.1, z: 87.5, w: 10.1, d: 12.6, h: 12, kind: 'office', tint: [.9,.86,.95] },
  { x: 107.5, z: 82.5, w: 11.2, d: 7.5, h: 3.5, kind: 'garage', rows: 3 },
  { x: 143.7, z: 83.1, w: 11.9, d: 6, h: 3, kind: 'garage', rows: 3 },

  { x: 185, z: 31.2, w: 11.9, d: 18.7, h: 3, kind: 'garage', rows: 5, vert: true },
  { x: 185, z: 87.5, w: 11.9, d: 16.2, h: 3, kind: 'garage', rows: 4, vert: true },
  { x: 183.7, z: 137.5, w: 13.7, d: 7.5, h: 7, kind: 'indust', tint: [.9,.88,.85] },

  /* Вокзал «Верещагино»: восточный край промзоны, главным фасадом на запад,
     между двумя рядами гаражей. За ним со временем лягут пути. */
  { x: 187, z: 52, w: 12, d: 34, h: 7.5, kind: 'station', tint: [1,.94,.74], name: 'ВОКЗАЛ ВЕРЕЩАГИНО',
    sign: { t: 'ЖД ВОКЗАЛ ВЕРЕЩАГИНО РЖД', c: '#e0242c', side: 'W',
            w: 9.6, h: 0.9, y: 10.3, out: 0.55, fill: 1 } },

  { x: 37.5, z: 138.1, w: 18.7, d: 8.1, h: 5, kind: 'indust', tint: [.85,.92,.95], sign: { t: 'АВТОМОЙКА «БЛЕСК»', c: '#25e8dc', side: 'N' } },
  { x: 75.8, z: 139.4, w: 16.2, d: 6.9, h: 3, kind: 'garage', rows: 4 },
  { x: 131.2, z: 138.7, w: 21.2, d: 7.5, h: 5.5, kind: 'indust', tint: [.95,.9,.82], sign: { t: 'ШИНОМОНТАЖ 24', c: '#ff8a1f', side: 'N' } },

  { x: 43.7, z: 3.7, w: 21.2, d: 6.9, h: 15, kind: 'panel', tint: [.9,.94,.9], balcony: 'S' },
  { x: 112.5, z: 3.7, w: 22.5, d: 6.9, h: 15, kind: 'panel', tint: [.94,.9,.94], balcony: 'S' },
  { x: 150.8, z: 3.7, w: 16.2, d: 6.2, h: 9, kind: 'brick' }
];

export const KIOSKS = [
  { x: 30, z: 13.1, w: 4.8, d: 3.4, t: 'ШАУРМА «ГОРИЗОНТ»', c: '#ff8a1f' },
  { x: 107.5, z: 13.4, w: 4.8, d: 3.4, t: 'ЦВЕТЫ 24', c: '#ff2d95' },
  { x: 67.5, z: 69.5, w: 4.8, d: 3.4, t: 'ПЕЧАТЬ', c: '#25e8dc' },
  { x: 141.2, z: 126.2, w: 4.8, d: 3.4, t: 'КЛЮЧИ / ЗАМКИ', c: '#ffd23f' },
  { x: 20, z: 81.2, w: 4.8, d: 3.4, t: 'КОФЕ С СОБОЙ', c: '#4be36b' }
];

export const POLES = [
  { x: 29.4, z: 14.4, lamp: true }, { x: 73.7, z: 14.4, lamp: true }, { x: 125, z: 14.4, lamp: true }, { x: 168.7, z: 14.4, lamp: true },
  { x: 29.4, z: 70.6, lamp: true }, { x: 81.2, z: 70.6, lamp: true }, { x: 137.5, z: 70.6, lamp: true },
  { x: 43.7, z: 126.9, lamp: true }, { x: 106.2, z: 126.9, lamp: true }, { x: 162.5, z: 126.9, lamp: true },
  { x: 20.6, z: 43.7, lamp: true }, { x: 20.6, z: 106.2, lamp: true },
  { x: 97.5, z: 43.7, lamp: true }, { x: 97.5, z: 106.2, lamp: true },
  { x: 179.4, z: 56.2, lamp: true }, { x: 179.4, z: 112.5, lamp: true },
  { x: 147.5, z: 80.6, mount: 'M1' },
  { x: 116.2, z: 86.9, mount: 'M2' },
  { x: 162.5, z: 117.5, mount: 'M3' },
  { x: 111.9, z: 118.7, mount: 'M4' },
  { x: 152.5, z: 60, mount: 'N1', dark: true },
  { x: 163.7, z: 66.2, mount: 'N2', dark: true },
  { x: 136.2, z: 67.2, mount: 'N3', dark: true }
];

export const POIS = [
  { id: 'base',      x: 9.1,   z: 49.5,  r: 3.6, name: 'Контора «Монтаж-Сервис»',     color: '#25e8dc', act: 'Отчитаться / отдохнуть' },
  { id: 'warehouse', x: 118.7, z: 39.5,  r: 4.0, name: 'Склад «Ящик и Ко»',            color: '#ff8a1f', act: 'Взять комплект инструментов' },
  { id: 'workshop',  x: 40.7,  z: 99.6,  r: 3.6, name: 'Мастерская «Восьмёрка»',       color: '#ffd23f', act: 'Ремонт и апгрейд велосипеда' },
  { id: 'toolshop',  x: 71.9,  z: 90.8,  r: 3.6, name: 'Магазин «Крепёж и Совесть»',   color: '#ff2d95', act: 'Купить снаряжение' },
  { id: 'rest',      x: 60.1,  z: 123.4, r: 3.4, name: 'Чайная «Термос»',              color: '#4be36b', act: 'Чай, пирожок, передышка' },
  { id: 'bar',       x: 87,    z: 123,   r: 3.4, name: 'Разливная «Три Гвоздя»',       color: '#ff4d5e', act: 'Соблазн (плохая идея)' }
];

export const PROPS = [];

export const POTHOLES = [];

/* Высота покрытия в точке. Тротуар лежит выше проезжей части, отмостка выше
   газона — и если рисовать людей и технику на нуле, ноги уходят в бордюр,
   а колёса под асфальт. Порядок проверок важен: дорога режет двор. */
export function surfY(x, z) {
  for (const r of ROADS_Z) {
    const d = Math.abs(z - r);
    if (d < ROAD_W / 2) return 0.031;
    if (d < ROAD_W / 2 + SIDE_W) return 0.161;
  }
  for (const r of ROADS_X) {
    const d = Math.abs(x - r);
    if (d < ROAD_W / 2) return 0.031;
    if (d < ROAD_W / 2 + SIDE_W) return 0.161;
  }
  if (x > 106.5 && x < 121 && z > 93 && z < 119) return 0.051;   /* парковка у БЦ */
  if (x > 38 && x < 52 && z > 47 && z < 57) return 0.051;        /* спортплощадка */
  for (const b of BUILDINGS)                                     /* отмостка вокруг дома */
    if (x > b.x - 1.45 && x < b.x + b.w + 1.45 && z > b.z - 1.45 && z < b.z + b.d + 1.45) return 0.186;
  return 0.013;                                                  /* газон и голая земля */
}

export function isRoad(x, z) {
  for (const r of ROADS_Z) if (Math.abs(z - r) < ROAD_W / 2) return true;
  for (const r of ROADS_X) if (Math.abs(x - r) < ROAD_W / 2) return true;
  return false;
}

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export function __init() {
  (function seedProps() {
    const add = (kind, x, z, o) => PROPS.push(Object.assign({ kind, x, z }, o || {}));
    /* двор «Три Колена» */
    add('sandbox', 55, 50); add('swing', 63, 47.5); add('carousel', 47.5, 55);
    add('bench', 41, 35, { a: 0 }); add('bench', 63, 35, { a: 0 }); add('bench', 83, 35, { a: 0 });
    add('bin', 38.7, 38.7); add('bin', 73.7, 59.4); add('bin', 58.7, 60);
    add('tree', 37.5, 53.7, { sp: 'maple' }); add('tree', 70.6, 43.7, { sp: 'birch' });
    add('tree', 88.7, 62.5, { sp: 'poplar' }); add('tree', 52.5, 41.2, { sp: 'birch' });
    add('bush', 43.7, 43.7); add('bush', 76.9, 35); add('bush', 56.2, 56.2);
    /* живая изгородь вдоль дорожки к подъездам */
    add('hedge', 47.5, 30.5, { len: 13, a: 0 });
    add('hedge', 76.5, 30.5, { len: 11, a: 0 });
    add('hedge', 33.4, 47, { len: 9, a: Math.PI / 2 });
    /* клумбы сбоку от каждого подъезда (крыльцо занимает ex ± 1.1) */
    add('flowerbed', 41.5, 33.4); add('flowerbed', 63.4, 33.4);
    add('flowerbed', 67.8, 33.4); add('flowerbed', 85.2, 33.4);
    add('flowerbed', 140.5, 115.4);
    add('board', 48.7, 38.7, { t: 'СОБРАНИЕ ЖИЛЬЦОВ' });
    add('carcass', 80.6, 63.1);
    /* промзона */
    add('pipe', 110, 55); add('pipe', 116.2, 55); add('block', 141.2, 38.7);
    add('block', 145, 41.2); add('barrel', 128.1, 56.2); add('barrel', 130, 58.7);
    add('pallet', 123.7, 63.7); add('pallet', 126.2, 65.6); add('coil', 150, 38.7);
    add('fence', 106.2, 67.5, { len: 31 }); add('cone', 134.4, 62.5); add('cone', 136.9, 63.1);
    /* сервисный квартал */
    add('tree', 53.7, 87.5, { sp: 'spruce' }); add('tree', 43.7, 118.7, { sp: 'poplar' }); add('bush', 72.5, 118.7);
    add('bench', 62.5, 109.4, { a: 0 }); add('bin', 67.5, 110); add('cone', 37.5, 103.1);
    add('board', 73.7, 101.2, { t: 'СДАЁТСЯ УГОЛ' });
    add('barrel', 35, 114.4); add('pallet', 51.2, 106.2);
    /* привокзальная площадь: памятник Верещагину на постаменте с оградой */
    add('monument', 184.2, 69);
    add('bench', 184.4, 60, { a: Math.PI / 2 }); add('bench', 184.4, 78, { a: Math.PI / 2 });
    add('bin', 185.0, 64.5); add('tree', 184.6, 55, { sp: 'birch' }); add('tree', 184.6, 83, { sp: 'birch' });

    /* большой объект */
    add('fence', 106.2, 92.5, { len: 12.5 }); add('cone', 125, 118.7); add('cone', 127.5, 119.4);
    add('coil', 131.2, 118.7); add('block', 156.2, 101.2); add('block', 158.7, 103.7);
    add('tree', 110, 106.2, { sp: 'maple' }); add('tree', 168.7, 93.7, { sp: 'spruce' }); add('bush', 143.7, 118.7);
    add('board', 138.1, 118.7, { t: 'ОБЪЕКТ ОХРАНЯЕТСЯ' });
    /* деревья по окраинам */
    /* деревья по окраинам: 34 -> 60 попыток. Поток RNG последователен, поэтому
       первые 34 итерации дают ровно те же посадки, что и раньше. */
    const R = mulberry32(20240917);
    for (let i = 0; i < 60; i++) {
      const x = 4 + R() * (W.x - 8), z = 4 + R() * (W.z - 8);
      if (ROADS_Z.some(r => Math.abs(z - r) < 9) || ROADS_X.some(r => Math.abs(x - r) < 9)) continue;
      add(R() < .62 ? 'tree' : 'bush', x, z);
    }
  })();
  (function seedHoles() {
    const R = mulberry32(777);
    for (const z of ROADS_Z) for (let i = 0; i < 7; i++)
      POTHOLES.push({ x: 8 + R() * (W.x - 16), z: z + (R() < .5 ? -1 : 1) * (1 + R() * 3), r: 1 + R() * 0.7 });
    for (const x of ROADS_X) for (let i = 0; i < 5; i++)
      POTHOLES.push({ z: 8 + R() * (W.z - 16), x: x + (R() < .5 ? -1 : 1) * (1 + R() * 3), r: 1 + R() * 0.7 });
  })();
}
