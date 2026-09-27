/* =====================================================================
   buildings.js — дома района из тех же данных, что у старой игры
   (BUILDINGS: угол, размеры, высота, тип, вывеска, подъезды, балконы).

   Старая игра рисовала окна картинкой на стене. Здесь окно — настоящий
   проём: откосы уходят вглубь стены, в проёме рама с импостом, стекло
   отражает небо, снизу металлический отлив. Отсюда свет и тень на фасаде:
   солнце в пять вечера рисует на откосах полосы тени, как на живом доме.

   Всё копится пачками по материалам (geo.js) — по одной пачке на дом и
   материал, чтобы дом отсекался камерой и тенями целиком.
   ===================================================================== */
import { Batch, rng } from './geo.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';

/* Параметры фасада по типу дома: высота этажа, окно (ширина, высота,
   подоконник от пола), шаг окон, материал стены, цоколь. */
const KIND = {
  panel:   { floor: 2.8, win: [1.46, 1.42, 0.86], bay: 3.1, wall: 'panel', plinth: 0.75, parapet: 0.55, frame: [0.93, 0.93, 0.9] },
  stucco:  { floor: 3.9, win: [1.42, 1.72, 0.9], bay: 2.9, wall: 'plaster', plinth: 0.62, parapet: 0.5, frame: [0.95, 0.95, 0.93] },
  brick:   { floor: 3.2, win: [1.2, 1.5, 0.95], bay: 2.6, wall: 'brick', plinth: 0.5, parapet: 0.45, frame: [0.9, 0.88, 0.84] },
  indust:  { floor: 99, win: [2.6, 1.3, 0], bay: 4.4, wall: 'indust', plinth: 0.9, parapet: 0.6, frame: [0.62, 0.64, 0.66], band: true },
  office:  { floor: 3.6, win: [1.7, 2.2, 0.8], bay: 2.4, wall: 'office', plinth: 0.55, parapet: 0.7, frame: [0.42, 0.45, 0.5] },
  garage:  { floor: 99, win: null, bay: 0, wall: 'garage', plinth: 0.3, parapet: 0.25, frame: [0.9, 0.9, 0.9] },
  station: { floor: 7.5, win: [2.1, 3.9, 1.6], bay: 3.4, wall: 'station', plinth: 0.8, parapet: 0.8, frame: [0.96, 0.96, 0.94], arch: true }
};

export function buildBuildings(scene, mats, BUILDINGS, env) {
  const M = {
    panel: mats.surface('concrete_slab_wall', { tile: 2.8, name: 'panelWall' }),
    plaster: mats.surface('yellow_plaster', { tile: 2.4, name: 'plasterWall' }),
    brick: mats.surface('red_brick_03', { tile: 1.6, name: 'brickWall' }),
    indust: mats.surface('concrete_wall_006', { tile: 3.6, name: 'industWall' }),
    office: mats.surface('concrete_wall_006', { tile: 2.4, name: 'officeWall' }),
    garage: mats.surface('red_brick_03', { tile: 1.7, name: 'garageWall', tint: [0.86, 0.8, 0.76] }),
    station: mats.surface('yellow_plaster', { tile: 2.2, name: 'stationWall' }),
    plinth: mats.surface('dirty_concrete', { tile: 1.8, name: 'plinth' }),
    reveal: mats.surface('worn_plaster_wall', { tile: 1.4, name: 'reveal' }),
    roof: mats.surface('asphalt_02', { tile: 3, name: 'roofing', tint: [0.42, 0.41, 0.4] }),
    gdoor: mats.surface('green_metal_rust', { tile: 2.6, name: 'garageDoor' }),
    corr: mats.surface('corrugated_iron_02', { tile: 1.2, name: 'corrugated' }),
    frame: mats.color('pvcFrame', [0.9, 0.9, 0.88], 0.42, 0),
    metal: mats.color('galvanized', [0.62, 0.63, 0.64], 0.38, 0.85),
    darkMetal: mats.color('doorMetal', [0.2, 0.19, 0.18], 0.5, 0.6),
    glass: mats.glass('windowGlass'),
    concrete: mats.surface('concrete_floor_worn_001', { tile: 1.5, name: 'concreteTrim' })
  };
  for (const k of ['panel', 'plaster', 'brick', 'indust', 'office', 'garage', 'station', 'gdoor', 'reveal', 'plinth', 'frame']) M[k].useVertexColors = true;

  const anchors = { ac: [], camera: [], lamp: [], pipe: [], box: [] };
  const meshes = [];
  for (const b of BUILDINGS) {
    const R = rng(Math.floor(b.x * 977 + b.z * 131 + b.h * 7));
    const bt = {};
    const B = key => bt[key] || (bt[key] = new Batch(key));
    buildOne(b, B, R, anchors, M);
    for (const [key, batch] of Object.entries(bt)) {
      const m = batch.build(scene, M[key], { name: 'b_' + (b.name || b.kind) + '_' + key });
      if (!m) continue;
      meshes.push(m);
      if (env.shadows && key !== 'glass') env.shadows.addShadowCaster(m, false);
    }
    if (b.sign) meshes.push(...buildSign(scene, b));
  }
  return { meshes, anchors };
}

/* ------------------------------------------------------------------ */
function buildOne(b, B, R, anchors, M) {
  const K = KIND[b.kind] || KIND.stucco;
  const tint = b.tint || [1, 1, 1];
  /* панели и цеха в текстуре темнее, чем выглядят живьём: подтягиваем тон */
  const lift = b.kind === 'panel' ? 1.05 : b.kind === 'indust' || b.kind === 'office' ? 1.3 : 1;
  const wallCol = [tint[0] * lift, tint[1] * lift, tint[2] * lift, 1];
  const floors = Math.max(1, Math.round(b.h / K.floor));
  const fh = b.h / floors;
  const top = b.h;
  /* фасады: начало, направление вдоль, наружная нормаль, длина */
  const faces = [
    { id: 'S', o: [b.x, 0, b.z + b.d], u: [1, 0, 0], n: [0, 0, 1], L: b.w },
    { id: 'N', o: [b.x + b.w, 0, b.z], u: [-1, 0, 0], n: [0, 0, -1], L: b.w },
    { id: 'E', o: [b.x + b.w, 0, b.z + b.d], u: [0, 0, -1], n: [1, 0, 0], L: b.d },
    { id: 'W', o: [b.x, 0, b.z], u: [0, 0, 1], n: [-1, 0, 0], L: b.d }
  ];
  const at = (f, s, y, out = 0) => [f.o[0] + f.u[0] * s + f.n[0] * out, y, f.o[2] + f.u[2] * s + f.n[2] * out];
  const signSide = b.sign ? (b.sign.side || 'S') : 'S';

  for (const f of faces) {
    const holes = [];
    const isFront = f.id === 'S';
    /* --- двери --- */
    const doors = [];
    if (isFront && b.entries) for (const ex of b.entries) doors.push({ s: ex - b.x, w: 1.3, h: 2.25, entry: true });
    if (isFront && b.shop) doors.push({ s: (b.name === 'контора' ? 9.1 - b.x : b.w / 2), w: 1.1, h: 2.2, shop: true });
    if (isFront && b.gate) doors.push({ s: b.w / 2, w: 6.2, h: 4.3, gate: true });
    if (!doors.length && f.id === 'N' && b.kind !== 'garage' && f.L > 6) doors.push({ s: f.L * 0.5, w: 1.0, h: 2.1, back: true });
    for (const d of doors) holes.push({ x0: d.s - d.w / 2, x1: d.s + d.w / 2, y0: 0.18, y1: 0.18 + d.h, door: d });

    /* --- витрина магазина: широкие окна первого этажа по фасаду с вывеской --- */
    const shopFront = isFront && b.shop && b.name !== 'контора';
    if (shopFront) {
      const d = doors.find(x => x.shop);
      for (const [a0, a1] of [[0.7, d.s - d.w / 2 - 0.5], [d.s + d.w / 2 + 0.5, f.L - 0.7]])
        if (a1 - a0 > 1.2) holes.push({ x0: a0, x1: a1, y0: 0.7, y1: 2.9, shopWin: true });
    }

    /* --- окна по этажам --- */
    if (K.win && b.kind !== 'garage') {
      const [ww, wh, sill] = K.win;
      const n = Math.max(0, Math.floor((f.L - 1.2) / K.bay));
      const start = (f.L - n * K.bay) / 2 + K.bay / 2;
      for (let fl = 0; fl < floors; fl++) {
        if (fl === 0 && shopFront) continue;
        let y0 = fl * fh + sill, y1 = y0 + wh;
        if (K.floor > 50) { y0 = b.h - wh - 1.2; y1 = b.h - 1.2; }          /* цеха: лента под кровлей */
        if (fl === 0 && y0 < K.plinth + 0.2) { y0 = K.plinth + 0.25; y1 = y0 + wh; }
        if (y1 > top - 0.35) continue;
        for (let i = 0; i < n; i++) {
          const s = start + i * K.bay;
          const x0 = s - ww / 2, x1 = s + ww / 2;
          if (holes.some(h => h.door && x1 > h.x0 - 0.35 && x0 < h.x1 + 0.35 && y0 < h.y1 + 0.3)) continue;
          holes.push({ x0, x1, y0, y1, win: true, floor: fl });
        }
        if (K.floor > 50) break;
      }
    }

    /* --- стена с проёмами и цоколь --- */
    B(K.wall).wall(f.o, f.u, f.L, top, holes, 1, [0, 0], wallCol);
    const pl = K.plinth;
    const plinthHoles = holes.filter(h => h.y0 < pl).map(h => ({ ...h, y1: Math.min(h.y1, pl) }));
    /* цоколь выступает на 5 см и заходит за углы, чтобы на стыке не было щели */
    const po = at(f, -0.05, 0, 0.05);
    B('plinth').wall(po, f.u, f.L + 0.1, pl, plinthHoles.map(q => ({ ...q, x0: q.x0 + 0.05, x1: q.x1 + 0.05 })), 1, [0, 0], [0.9, 0.9, 0.9, 1]);
    B('plinth').rect(at(f, -0.05, pl, 0.05), f.u, [-f.n[0], 0, -f.n[2]], f.L + 0.1, 0.05, [0, 0], 1);   /* верх цоколя */

    /* --- поясок под кровлей --- */
    if (b.kind !== 'garage') {
      const c = at(f, f.L / 2, top - 0.3, 0.07);
      const alongX = f.u[0] !== 0;
      B('concrete').box(c[0], top - 0.3, c[2], alongX ? f.L + 0.14 : 0.16, 0.3, alongX ? 0.16 : f.L + 0.14, 0, { uvScale: 1 });
    }

    /* --- проёмы: окна, витрины, двери --- */
    for (const h of holes) {
      if (h.win || h.shopWin) emitWindow(B, f, h, K, R, anchors, b);
      else if (h.door) emitDoor(B, f, h, R, b, anchors);
    }

    /* кондиционеры и тарелки — вешаем потом моделями, здесь только точки */
  }

  /* --- кровля: плита, парапет с оцинкованной крышкой --- */
  if (b.kind === 'garage') {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    B('corr').box(cx, top, cz, b.w + 0.5, 0.08, b.d + 0.5, 0, { uvScale: 1 });
    /* ворота боксов */
    const n = b.rows || 4;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const col = [[0.75, 0.9, 0.8, 1], [0.6, 0.72, 0.9, 1], [0.9, 0.8, 0.62, 1], [0.8, 0.66, 0.66, 1]][Math.floor(R() * 4)];
      if (b.vert) {
        const z0 = b.z + t0 * b.d + 0.28, z1 = b.z + t1 * b.d - 0.28;
        B('gdoor').rect([b.x + b.w + 0.04, 0.12, z1], [0, 0, -1], [0, 1, 0], z1 - z0, b.h - 0.55, [0, 0], 1, col);
        B('metal').box(b.x + b.w + 0.07, b.h - 0.43, (z0 + z1) / 2, 0.06, 0.08, z1 - z0 + 0.1, 0);
      } else {
        const x0 = b.x + t0 * b.w + 0.28, x1 = b.x + t1 * b.w - 0.28;
        B('gdoor').rect([x0, 0.12, b.z + b.d + 0.04], [1, 0, 0], [0, 1, 0], x1 - x0, b.h - 0.55, [0, 0], 1, col);
        B('metal').box((x0 + x1) / 2, b.h - 0.43, b.z + b.d + 0.07, x1 - x0 + 0.1, 0.08, 0.06, 0);
      }
    }
  } else {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2, pt = 0.26, ph = K.parapet;
    B('roof').box(cx, top, cz, b.w, 0.02, b.d, 0, { uvScale: 1, faces: 't' });
    for (const [x, z, w, d] of [[cx, b.z + pt / 2, b.w, pt], [cx, b.z + b.d - pt / 2, b.w, pt], [b.x + pt / 2, cz, pt, b.d - 2 * pt], [b.x + b.w - pt / 2, cz, pt, b.d - 2 * pt]]) {
      B(K.wall).box(x, top, z, w, ph, d, 0, { uvScale: 1, color: wallCol, faces: 'nsew' });
      B('metal').box(x, top + ph, z, w + (w > d ? 0.12 : 0.12), 0.05, d + (w > d ? 0.12 : 0.12), 0);
    }
    /* надстройки: выход на кровлю, вентиляция */
    if (b.h >= 7) {
      B(K.wall).box(b.x + b.w * (0.22 + R() * 0.4), top, b.z + b.d * (0.3 + R() * 0.3), 2.4, 2.3, 2.0, 0, { uvScale: 1, color: wallCol });
      for (let i = 0; i < 3; i++) B('metal').box(b.x + 1.2 + R() * (b.w - 2.4), top, b.z + 1 + R() * (b.d - 2), 0.6 + R() * 0.6, 0.5 + R() * 0.6, 0.6 + R() * 0.6, R() * 0.5);
    }
    /* водостоки по углам: труба с воронкой, отвод внизу */
    for (const [px, pz, ox, oz] of [[b.x, b.z, -1, -1], [b.x + b.w, b.z, 1, -1], [b.x, b.z + b.d, -1, 1], [b.x + b.w, b.z + b.d, 1, 1]]) {
      const x = px + ox * 0.13 - ox * 0.3, z = pz + oz * 0.13;
      B('metal').cylinder(x, 0.35, z, 0.055, top - 0.1, 10, { cap: false });
      B('metal').box(x, top - 0.28, z, 0.2, 0.22, 0.2, 0);
      B('metal').tube([[x, 0.4, z], [x, 0.22, z + oz * 0.05], [x, 0.18, z + oz * 0.28]], 0.055, 8);
    }
  }

  /* --- балконы панелек --- */
  if (b.balcony) {
    const side = b.balcony, f = faces.find(q => q.id === side);
    const [ww] = K.win;
    const n = Math.floor((f.L - 1.2) / K.bay), start = (f.L - n * K.bay) / 2 + K.bay / 2;
    for (let fl = 1; fl < floors; fl++) for (let i = 0; i < n; i += 2) {
      const s = start + i * K.bay;
      const y = fl * fh;
      const c = at(f, s, y, 0.55);
      const alongX = f.u[0] !== 0;
      const bw = 2.5, bd = 1.1;
      B('concrete').box(c[0], y - 0.12, c[2], alongX ? bw : bd, 0.14, alongX ? bd : bw, 0, { uvScale: 1 });
      /* ограждение: лицевой лист и боковины */
      const cf = at(f, s, y, 1.08);
      const col = [[0.86, 0.84, 0.8, 1], [0.7, 0.78, 0.84, 1], [0.84, 0.74, 0.7, 1], [0.78, 0.82, 0.72, 1]][Math.floor(R() * 4)];
      B('panel').box(cf[0], y + 0.02, cf[2], alongX ? bw : 0.06, 1.0, alongX ? 0.06 : bw, 0, { uvScale: 1, color: col });
      for (const sgn of [-1, 1]) {
        const cs = at(f, s + sgn * (bw / 2 - 0.03), y, 0.55);
        B('panel').box(cs[0], y + 0.02, cs[2], alongX ? 0.06 : bd, 1.0, alongX ? bd : 0.06, 0, { uvScale: 1, color: col });
      }
      /* сушка белья и хлам — иногда */
      if (R() < 0.3) { const cc = at(f, s + (R() - 0.5), y, 0.7); B('metal').box(cc[0], y + 0.02, cc[2], 0.4, 0.5, 0.35, R()); }
    }
  }

  /* точки под навесное оборудование — их займут модели */
  if (b.kind !== 'garage') {
    for (const f of faces) {
      if (f.L < 5 || b.kind === 'station') continue;
      const n = Math.floor(f.L / 3.6);
      for (let i = 0; i < n; i++) if (R() < (b.kind === 'panel' ? 0.16 : 0.24)) {
        const s = 1.8 + i * 3.6 + (R() - 0.5), fl = Math.floor(R() * floors);
        const y = Math.max(1.4, fl * fh + 0.35);
        if (y > top - 1.5) continue;
        anchors.ac.push({ p: at(f, s, y, 0.02), n: f.n, b });
      }
    }
  }
  if (b.name === 'контора') {
    const f = faces[0];
    anchors.camera.push({ p: at(f, 0.35, top - 0.6, 0.02), n: f.n, b, yawOff: 0.6 });
    anchors.camera.push({ p: at(f, f.L - 0.35, top - 0.6, 0.02), n: f.n, b, yawOff: -0.6 });
    anchors.lamp.push({ p: at(f, 9.1 - b.x, 2.95, 0.02), n: f.n, b });
    anchors.box.push({ p: at(faces[2], 2.2, 0.35, 0.02), n: faces[2].n, b });
  }
}

/* окно: откосы, рама с импостом, стекло, отлив и подоконная доска снаружи */
function emitWindow(B, f, h, K, R, anchors, b) {
  const D = h.shopWin ? 0.16 : 0.22;                 /* глубина откоса */
  const alongX = f.u[0] !== 0;
  const inn = [-f.n[0], 0, -f.n[2]];
  const P = (s, y, out) => [f.o[0] + f.u[0] * s + f.n[0] * out, y, f.o[2] + f.u[2] * s + f.n[2] * out];
  const w = h.x1 - h.x0, ht = h.y1 - h.y0;
  const dark = [0.78, 0.76, 0.74, 1];
  /* откосы: левый, правый, верх, низ */
  const rev = B('reveal');
  rev.quad(P(h.x0, h.y0, 0), P(h.x0, h.y0, -D), P(h.x0, h.y1, -D), P(h.x0, h.y1, 0), f.u, [0, 0, D, 0, D, ht, 0, ht], dark);
  rev.quad(P(h.x1, h.y0, -D), P(h.x1, h.y0, 0), P(h.x1, h.y1, 0), P(h.x1, h.y1, -D), [-f.u[0], 0, -f.u[2]], [0, 0, D, 0, D, ht, 0, ht], dark);
  rev.quad(P(h.x0, h.y1, 0), P(h.x0, h.y1, -D), P(h.x1, h.y1, -D), P(h.x1, h.y1, 0), [0, -1, 0], [0, 0, D, 0, D, w, 0, w], dark);
  rev.quad(P(h.x1, h.y0, 0), P(h.x1, h.y0, -D), P(h.x0, h.y0, -D), P(h.x0, h.y0, 0), [0, 1, 0], [0, 0, D, 0, D, w, 0, w], dark);
  /* рама: по периметру и импост; рама стоит в глубине откоса */
  const fd = D - 0.05, fw = 0.065, depth = 0.07;
  const fr = B('frame'), fc = [...(K.frame || [0.92, 0.92, 0.9]), 1];
  const box = (s0, s1, y0, y1) => {
    const c = P((s0 + s1) / 2, y0, -fd);
    fr.box(c[0], y0, c[2], alongX ? s1 - s0 : depth, y1 - y0, alongX ? depth : s1 - s0, 0, { uvScale: 1, color: fc });
  };
  box(h.x0, h.x1, h.y0, h.y0 + fw); box(h.x0, h.x1, h.y1 - fw, h.y1);
  box(h.x0, h.x0 + fw, h.y0, h.y1); box(h.x1 - fw, h.x1, h.y0, h.y1);
  if (!h.shopWin) {
    const mid = h.x0 + w * (R() < 0.5 ? 0.5 : 0.38);
    box(mid - fw / 2, mid + fw / 2, h.y0, h.y1);
    if (ht > 1.3 && K.floor < 50) { const ty = h.y1 - ht * 0.26; box(h.x0, mid, ty - fw / 2, ty + fw / 2); }
  } else {
    for (let s = h.x0 + 1.6; s < h.x1 - 0.8; s += 1.6) box(s - fw / 2, s + fw / 2, h.y0, h.y1);
  }
  /* стекло: чуть за рамой; цвет — «что за шторой», у каждого окна свой */
  const tones = [[1, 1, 1], [0.8, 0.85, 1.1], [1.25, 1.05, 0.8], [0.7, 0.72, 0.7], [1.1, 0.9, 0.9], [0.9, 1.05, 0.95]];
  const t = tones[Math.floor(R() * tones.length)];
  const gl = B('glass');
  const g0 = P(h.x0, h.y0, -fd - 0.01);
  gl.rect(g0, f.u, [0, 1, 0], w, ht, [0, 0], 1 / Math.max(w, ht), [t[0], t[1], t[2], 1]);
  /* отлив снаружи и подоконная доска */
  if (!h.shopWin) {
    const c = P((h.x0 + h.x1) / 2, h.y0 - 0.035, 0.05);
    B('metal').box(c[0], h.y0 - 0.035, c[2], alongX ? w + 0.1 : 0.14, 0.035, alongX ? 0.14 : w + 0.1, 0);
  }
}

/* дверь: полотно в глубине, козырёк, ступени; у подъездов — лампа над дверью */
function emitDoor(B, f, h, R, b, anchors) {
  const d = h.door, D = 0.2;
  const alongX = f.u[0] !== 0;
  const P = (s, y, out) => [f.o[0] + f.u[0] * s + f.n[0] * out, y, f.o[2] + f.u[2] * s + f.n[2] * out];
  const w = h.x1 - h.x0, ht = h.y1 - h.y0;
  const rev = B('reveal'), dark = [0.75, 0.74, 0.72, 1];
  rev.quad(P(h.x0, h.y0, 0), P(h.x0, h.y0, -D), P(h.x0, h.y1, -D), P(h.x0, h.y1, 0), f.u, [0, 0, D, 0, D, ht, 0, ht], dark);
  rev.quad(P(h.x1, h.y0, -D), P(h.x1, h.y0, 0), P(h.x1, h.y1, 0), P(h.x1, h.y1, -D), [-f.u[0], 0, -f.u[2]], [0, 0, D, 0, D, ht, 0, ht], dark);
  rev.quad(P(h.x0, h.y1, 0), P(h.x0, h.y1, -D), P(h.x1, h.y1, -D), P(h.x1, h.y1, 0), [0, -1, 0], [0, 0, D, 0, D, w, 0, w], dark);
  if (d.gate) {
    B('gdoor').rect(P(h.x0, h.y0, -D + 0.04), f.u, [0, 1, 0], w, ht, [0, 0], 1, [0.7, 0.72, 0.78, 1]);
  } else {
    B('darkMetal').rect(P(h.x0, h.y0, -D + 0.05), f.u, [0, 1, 0], w, ht, [0, 0], 1);
    const handle = P(h.x0 + w * 0.82, h.y0 + 1.0, -D + 0.1);
    B('metal').box(handle[0], h.y0 + 0.95, handle[2], 0.05, 0.22, 0.05, 0);
  }
  /* крыльцо: две ступени и площадка */
  const pc = P((h.x0 + h.x1) / 2, 0, 0.9);
  const cw = w + 1.4;
  B('concrete').box(pc[0], 0, pc[2], alongX ? cw : 1.6, 0.18, alongX ? 1.6 : cw, 0, { uvScale: 1 });
  const ps = P((h.x0 + h.x1) / 2, 0, 1.95);
  B('concrete').box(ps[0], 0, ps[2], alongX ? cw : 0.5, 0.09, alongX ? 0.5 : cw, 0, { uvScale: 1 });
  /* козырёк на двух трубах */
  if (!d.back) {
    const cc = P((h.x0 + h.x1) / 2, h.y1 + 0.28, 0.8);
    B('metal').box(cc[0], h.y1 + 0.28, cc[2], alongX ? cw + 0.2 : 1.7, 0.1, alongX ? 1.7 : cw + 0.2, 0);
    for (const sg of [-1, 1]) {
      const p = P((h.x0 + h.x1) / 2 + sg * (cw / 2 - 0.1), 0, 1.5);
      B('metal').cylinder(p[0], 0.18, p[2], 0.045, h.y1 + 0.1, 8);
    }
  }
}

/* вывеска: щит с текстом, буквы светятся своим цветом — как неон старой игры */
function buildSign(scene, b) {
  const s = b.sign;
  const side = s.side || 'S';
  const along = (side === 'W' || side === 'E') ? b.d : b.w;
  /* щит по длине надписи: буквы примерно квадратные, поле по краям */
  const letters = [...s.t].length;
  const w = s.w || Math.min(along - 1.2, s.small ? 2.6 : Math.min(7.5, 0.95 + letters * 0.42));
  const h = s.h || Math.max(0.5, Math.min(1.05, w / 6.2));
  const y = s.y !== undefined ? s.y : (b.name === 'контора' ? 3.55 : b.shop ? 3.35 : b.h - h - 0.9);
  const W = 1024, H = Math.max(128, Math.round(W * h / w / 32) * 32);
  const dt = new DynamicTexture('sign_' + s.t, { width: W, height: H }, scene, true);
  const c = dt.getContext();
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  let fs = Math.floor(H * 0.62);
  const font = px => '900 ' + px + 'px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  c.font = font(fs);
  while (c.measureText(s.t).width > W * 0.92 && fs > 10) { fs -= 2; c.font = font(fs); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = s.c; c.shadowBlur = H * 0.08;
  c.fillStyle = s.c; c.fillText(s.t, W / 2, H / 2 + fs * 0.04);
  c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillText(s.t, W / 2, H / 2 + fs * 0.04);
  dt.update(true);
  const m = new PBRMaterial('signMat_' + s.t, scene);
  m.albedoColor = new Color3(0.02, 0.02, 0.025);
  m.metallic = 0.1; m.roughness = 0.3;
  m.emissiveTexture = dt; m.emissiveColor = new Color3(1, 1, 1); m.emissiveIntensity = 2.6;
  /* короб и лицевая плоскость — в мировых координатах, нормаль наружу */
  const out = s.out ?? 0.16;
  let o, u, n;
  let cx = b.x + b.w / 2;
  if (b.name === 'контора') cx = Math.min(b.x + b.w - w / 2 - 0.4, Math.max(b.x + w / 2 + 0.4, 9.1));
  if (side === 'S') { n = [0, 0, 1]; u = [1, 0, 0]; o = [cx - w / 2, y, b.z + b.d + out]; }
  else if (side === 'N') { n = [0, 0, -1]; u = [-1, 0, 0]; o = [cx + w / 2, y, b.z - out]; }
  else if (side === 'E') { n = [1, 0, 0]; u = [0, 0, -1]; o = [b.x + b.w + out, y, b.z + b.d / 2 + w / 2]; }
  else { n = [-1, 0, 0]; u = [0, 0, 1]; o = [b.x - out, y, b.z + b.d / 2 - w / 2]; }
  const face = new Batch('signFace');
  face.rect(o, u, [0, 1, 0], w, h, [0, 0], 1);
  face.uv = [0, 0, 1, 0, 1, 1, 0, 1];
  const fm = face.build(scene, m, { name: 'signFace_' + s.t });
  const boxB = new Batch('signBox');
  const cxw = o[0] + u[0] * w / 2 - n[0] * out / 2, czw = o[2] + u[2] * w / 2 - n[2] * out / 2;
  const alongX = u[0] !== 0;
  boxB.box(cxw, y - 0.03, czw, alongX ? w + 0.06 : out - 0.01, h + 0.06, alongX ? out - 0.01 : w + 0.06, 0, { uvScale: 1 });
  const bm = boxB.build(scene, scene.getMaterialByName('doorMetal'), { name: 'signBox_' + s.t });
  fm.parent = null;
  return [fm, bm];
}
