/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «23. Мини-игра «Монтаж двери» (условная схема)», строки 8063–8814.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { TAU, clamp, dist, lerp, pick, rnd } from '../core/util.js';
import { applyWorkMods, shake, toast } from '../game/effects.js';
import { Input, K } from '../game/input.js';
import { S, clockStr } from '../game/state.js';
import { Dlg } from './dialog.js';
import { Mini, roundRect } from './minigames.js';
import { drawPerson } from './radio.js';

/* ------------------------------------------------------------------ */
/* 23. Мини-игра «Монтаж двери» (условная схема)                        */
/* ------------------------------------------------------------------ */
export function startDoorGame(onDone) {
  const DEVS = [
    { id: 'ctrl', name: 'Контроллер', tok: '' },
    { id: 'read', name: 'Считыватель', tok: 'B' },
    { id: 'exit', name: 'Кнопка выхода', tok: 'C' },
    { id: 'lock', name: 'Замок', tok: 'D' }
  ];
  const g = {
    title: 'МОНТАЖ СКУД: ДВЕРЬ', q: 100, phase: 0, t: 0,
    devs: DEVS.map(d => Object.assign({ placed: false }, d)),
    slots: [], tray: [], held: null, sel: 0, slotSel: 0,
    nodes: [], links: [], selNode: null, shorts: 0, misses: 0,
    test: -1, log: [], finished: false,
    layout(w, h) {
      const bw = Math.min(880, w - 120), bh = Math.min(430, h - 210);
      const bx = (w - bw) / 2, by = 74 + (h - 150 - bh) / 2;
      this.board = { x: bx, y: by, w: bw, h: bh };
      const doorW = bw * 0.32;
      this.door = { x: bx + 34, y: by + 62, w: doorW, h: bh - 132 };
      const px = bx + doorW + 96, pw = bw - doorW - 130;
      this.panel = { x: px, y: by + 62, w: pw, h: bh - 132 };
      const sw = 108, sh = 62;
      this.slots = [
        { id: 'ctrl', label: 'Контроллер', x: px + pw / 2 - sw / 2, y: by + 82, w: sw, h: sh },
        { id: 'read', label: 'Считыватель', x: this.door.x + this.door.w + 12, y: this.door.y + 70, w: sw * 0.72, h: sh * 0.72 },
        { id: 'exit', label: 'Кнопка выхода', x: this.door.x + 14, y: this.door.y + this.door.h - 84, w: sw * 0.66, h: sh * 0.66 },
        { id: 'lock', label: 'Замок', x: this.door.x + this.door.w / 2 - sw * 0.4, y: this.door.y + 12, w: sw * 0.8, h: sh * 0.42 }
      ];
      const tw = 128, ty = by + bh - 4;
      this.tray = this.devs.map((d, i) => ({ id: d.id, x: bx + 20 + i * (tw + 12), y: ty, w: tw, h: 44 }));
      this.psu = { x: px + pw - 92, y: by + bh - 150, w: 76, h: 54 };
      this.rebuildNodes();
    },
    rebuildNodes() {
      const s = id => this.slots.find(v => v.id === id);
      const c = s('ctrl');
      this.nodes = [
        { id: 'c_A', tok: 'A', x: c.x + 14, y: c.y + c.h + 12, own: 'ctrl' },
        { id: 'c_B', tok: 'B', x: c.x + 42, y: c.y + c.h + 12, own: 'ctrl' },
        { id: 'c_C', tok: 'C', x: c.x + 70, y: c.y + c.h + 12, own: 'ctrl' },
        { id: 'c_D', tok: 'D', x: c.x + 96, y: c.y + c.h + 12, own: 'ctrl' },
        { id: 'psu_A', tok: 'A', x: this.psu.x + this.psu.w / 2, y: this.psu.y - 10, own: 'psu' },
        { id: 'read_B', tok: 'B', x: s('read').x + s('read').w / 2, y: s('read').y + s('read').h + 10, own: 'read' },
        { id: 'exit_C', tok: 'C', x: s('exit').x + s('exit').w + 13, y: s('exit').y + s('exit').h / 2, own: 'exit' },
        { id: 'lock_D', tok: 'D', x: s('lock').x + s('lock').w + 13, y: s('lock').y + s('lock').h / 2, own: 'lock' }
      ];
    },
    phaseName() { return ['ЭТАП 1 — РАЗМЕЩЕНИЕ', 'ЭТАП 2 — КОММУТАЦИЯ', 'ЭТАП 3 — ПРОВЕРКА'][this.phase] || 'ГОТОВО'; },
    hint() {
      if (this.phase === 0) return 'Расставь оборудование по местам: клик по прибору внизу, затем клик по контуру. С клавиатуры: <b>←/→</b> — прибор, <b>↑/↓</b> — место, <b>E</b> — поставить. Ошибка стоит качества.';
      if (this.phase === 1) return 'Соедини одинаковые метки: <b>A</b>—питание, <b>B</b>—считыватель, <b>C</b>—кнопка, <b>D</b>—замок. Разные метки = короткое замыкание. Замыканий: <b>' + this.shorts + '/3</b>';
      if (this.phase === 2) return 'Жми <b>«Запустить проверку»</b> — посмотрим, откроется ли дверь и запишется ли проход.';
      return 'Готово.';
    },
    buttons() {
      if (this.phase === 1) return [{ label: 'Сбросить последний провод', cls: '', disabled: !this.links.length, fn: () => { this.links.pop(); this.q = clamp(this.q - 2, 0, 100); } }];
      if (this.phase === 2 && this.test < 0) return [{ label: 'Запустить проверку', cls: 'c', fn: () => { this.test = 0; this.log = []; Audio2.click(); } }];
      if (this.phase === 3) return [{ label: 'Закончить и сдать', cls: 'y', fn: () => Mini.finish(this.q) }];
      return [];
    },
    init() { this.t = 0; },
    update(dt, M) {
      this.t += dt;
      const click = Mini.click();
      if (this.phase === 0) {
        /* клавиатура */
        const freeDevs = this.devs.filter(d => !d.placed);
        if (freeDevs.length && this.devs[this.sel].placed) {
          this.sel = this.devs.indexOf(freeDevs[0]);
        }
        if (Input.anyHit(K.left) || Input.anyHit(K.right)) {
          const dir = Input.anyHit(K.right) ? 1 : -1;
          for (let i = 0; i < this.devs.length; i++) {
            this.sel = (this.sel + dir + this.devs.length) % this.devs.length;
            if (!this.devs[this.sel].placed) break;
          }
          Audio2.click();
        }
        if (Input.anyHit(K.up) || Input.anyHit(K.down)) {
          const dir = Input.anyHit(K.down) ? 1 : -1;
          this.slotSel = (this.slotSel + dir + this.slots.length) % this.slots.length;
          Audio2.click();
        }
        if (Input.anyHit(K.act)) this.tryPlace(this.devs[this.sel].id, this.slots[this.slotSel].id);
        if (click) {
          const tr = this.tray.find(t => hitRect(M.mx, M.my, t) && !this.devs.find(d => d.id === t.id).placed);
          if (tr) { this.held = tr.id; Audio2.click(); }
          else if (this.held) {
            const sl = this.slots.find(s => hitRect(M.mx, M.my, s, 12));
            if (sl) { this.tryPlace(this.held, sl.id); this.held = null; }
          }
        }
        if (this.devs.every(d => d.placed)) {
          this.phase = 1; Audio2.ok();
          toast('Оборудование на местах. Теперь коммутация', 'good', 2200);
        }
      } else if (this.phase === 1) {
        if (click) {
          const n = this.nodes.find(n => dist(M.mx, M.my, n.x, n.y) < 20);
          if (n) {
            if (!this.selNode) { this.selNode = n; Audio2.click(); }
            else if (this.selNode.id === n.id) { this.selNode = null; }
            else this.tryLink(this.selNode, n);
          } else this.selNode = null;
        }
        if (this.links.length >= 4) { this.phase = 2; Audio2.ok(); }
      } else if (this.phase === 2) {
        if (this.test >= 0) {
          const prev = this.test;
          this.test += dt;
          const stages = [0.1, 1.0, 1.9, 2.8, 3.8];
          const msgs = [
            'Подношу карту к считывателю…',
            'Контроллер думает. Думает хорошо.',
            this.q >= 55 ? 'Замок щёлкнул. Дверь открылась.' : 'Замок щёлкнул. Со второй попытки.',
            'Журнал: «' + clockStr() + ' — проход зафиксирован, карта №001».',
            'Кнопка выхода отработала. Дверь закрылась, как приличная.'
          ];
          for (let i = 0; i < stages.length; i++) {
            if (prev < stages[i] && this.test >= stages[i]) {
              this.log.push(msgs[i]);
              if (i === 2) Audio2.lock(); else Audio2.click();
            }
          }
          if (this.test > 5) { this.phase = 3; Audio2.ok(); }
        }
      } else if (this.phase === 3) {
        if (Input.anyHit(K.act)) Mini.finish(this.q);
      }
    },
    tryPlace(devId, slotId) {
      const dev = this.devs.find(d => d.id === devId);
      if (!dev || dev.placed) return;
      if (devId === slotId) {
        dev.placed = true; Audio2.screwdr();
        const sl = this.slots.find(s => s.id === slotId);
        fxMini(sl.x + sl.w / 2, sl.y + sl.h / 2);
      } else {
        this.misses++; this.q = clamp(this.q - 7, 0, 100);
        Audio2.nope();
        toast(pick(['Не туда. Совсем не туда', 'Замок на кнопку выхода — смело, но нет', 'Оно, конечно, влезет. Но не должно']), 'bad', 1600);
      }
    },
    tryLink(a, b) {
      const key = [a.id, b.id].sort().join('|');
      if (this.links.some(l => l.key === key)) { this.selNode = null; return; }
      if (this.links.some(l => l.a.id === a.id || l.b.id === a.id || l.a.id === b.id || l.b.id === b.id)) {
        toast('Эта клемма уже занята', 'bad', 1400); Audio2.nope(); this.selNode = null; return;
      }
      if (a.tok === b.tok && a.own !== b.own) {
        this.links.push({ a, b, key, tok: a.tok, spark: 0 });
        Audio2.ok(); this.selNode = null;
        fxMini((a.x + b.x) / 2, (a.y + b.y) / 2);
      } else {
        this.shorts++; this.q = clamp(this.q - 11, 0, 100);
        Audio2.spark(); shake(4);
        this.selNode = null;
        this.sparkAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0.5 };
        toast(pick(['Короткое замыкание! Пахнет опытом', 'Искра, буря, безумие. И запах', 'Так делать не надо. Уже не надо']), 'bad', 1800);
        if (this.shorts >= 3) {
          this.links.length = 0; this.shorts = 0;
          this.q = clamp(this.q - 8, 0, 100);
          toast('Автомат выбило. Начинаем коммутацию заново', 'bad', 2600);
        }
      }
    },
    draw(c, w, h, M) {
      const b = this.board;
      c.save();
      /* панель схемы */
      c.fillStyle = 'rgba(12,7,24,.86)'; c.strokeStyle = 'rgba(37,232,220,.5)'; c.lineWidth = 2;
      roundRect(0, c, b.x, b.y, b.w, b.h, 10); c.fill(); c.stroke();
      c.fillStyle = 'rgba(185,166,214,.6)'; c.font = '700 11px "Trebuchet MS", sans-serif';
      c.fillText('УСЛОВНАЯ МОНТАЖНАЯ СХЕМА · ИГРОВАЯ ГОЛОВОЛОМКА', b.x + 14, b.y + 20);

      /* дверь */
      const d = this.door;
      c.fillStyle = '#2a2338'; roundRect(0, c, d.x, d.y, d.w, d.h, 4); c.fill();
      c.strokeStyle = '#6b5a86'; c.lineWidth = 3; c.stroke();
      const openAmt = this.phase === 2 && this.test > 1.9 ? clamp((this.test - 1.9) / 0.8, 0, 1) : (this.phase === 3 ? 1 : 0);
      c.fillStyle = '#0d0a16'; c.fillRect(d.x + 6, d.y + 6, d.w - 12, d.h - 12);   /* тёмный проём */
      if (openAmt > 0.05) {
        c.fillStyle = 'rgba(255,210,63,.10)';
        c.fillRect(d.x + 6, d.y + 6, (d.w - 12) * openAmt, d.h - 12);
      }
      c.save();
      c.translate(d.x + 6, d.y + 6);
      c.scale(clamp(1 - openAmt * 0.72, 0.05, 1), 1);
      c.fillStyle = '#3c3350'; c.fillRect(0, 0, d.w - 12, d.h - 12);
      c.strokeStyle = '#8f7fae'; c.lineWidth = 2; c.strokeRect(8, 8, d.w - 28, d.h - 28);
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(d.w - 30, (d.h - 12) / 2, 5, 0, TAU); c.fill();
      c.restore();
      c.fillStyle = 'rgba(185,166,214,.55)'; c.font = '700 10px "Trebuchet MS", sans-serif';
      c.fillText('ДВЕРЬ ПОДЪЕЗДА', d.x + 4, d.y - 8);

      /* блок питания */
      c.fillStyle = '#1c1430'; c.strokeStyle = '#ff8a1f'; c.lineWidth = 2;
      roundRect(0, c, this.psu.x, this.psu.y, this.psu.w, this.psu.h, 5); c.fill(); c.stroke();
      c.fillStyle = '#ff8a1f'; c.font = '700 10px "Trebuchet MS", sans-serif';
      c.fillText('БЛОК ПИТАНИЯ', this.psu.x + 6, this.psu.y + 18);
      c.fillStyle = '#b9a6d6'; c.fillText('метка A', this.psu.x + 6, this.psu.y + 34);

      /* слоты */
      for (const s of this.slots) {
        const dev = this.devs.find(v => v.id === s.id);
        const on = dev.placed;
        c.setLineDash(on ? [] : [7, 5]);
        const aimed = this.phase === 0 && (this.held === s.id || this.slots[this.slotSel] === s);
        c.strokeStyle = on ? '#4be36b' : (aimed ? '#ffd23f' : 'rgba(185,166,214,.5)');
        c.lineWidth = on ? 2 : 2;
        c.fillStyle = on ? 'rgba(75,227,107,.12)' : (aimed ? 'rgba(255,210,63,.12)' : 'rgba(255,255,255,.04)');
        roundRect(0, c, s.x, s.y, s.w, s.h, 6); c.fill(); c.stroke();
        c.setLineDash([]);
        if (on) drawDevice(c, s, dev);
        c.fillStyle = on ? '#e9dcff' : 'rgba(185,166,214,.75)';
        c.font = '700 10px "Trebuchet MS", sans-serif';
        c.fillText(s.label, s.x, s.y - 5);
      }

      /* провода */
      for (const l of this.links) {
        c.strokeStyle = tokColor(l.tok); c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(l.a.x, l.a.y);
        const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2 + 26;
        c.quadraticCurveTo(mx, my, l.b.x, l.b.y); c.stroke();
        if (this.phase >= 2) {
          const ph = (this.t * 1.6 + l.tok.charCodeAt(0) * 0.1) % 1;
          const px = lerp(l.a.x, l.b.x, ph), py = lerp(l.a.y, l.b.y, ph) + Math.sin(ph * Math.PI) * 20;
          c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fill();
        }
      }
      /* клеммы */
      if (this.phase >= 1) {
        for (const n of this.nodes) {
          const linked = this.links.some(l => l.a.id === n.id || l.b.id === n.id);
          const hov = dist(M.mx, M.my, n.x, n.y) < 20;
          c.fillStyle = linked ? tokColor(n.tok) : (hov ? '#fff' : '#1c1430');
          c.strokeStyle = tokColor(n.tok); c.lineWidth = 2.4;
          c.beginPath(); c.arc(n.x, n.y, this.selNode && this.selNode.id === n.id ? 11 : 8, 0, TAU);
          c.fill(); c.stroke();
          c.fillStyle = linked ? '#0b0518' : tokColor(n.tok);
          c.font = '900 10px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
          c.fillText(n.tok, n.x, n.y + 3.5); c.textAlign = 'left';
        }
        if (this.selNode) {
          c.strokeStyle = 'rgba(255,210,63,.8)'; c.lineWidth = 2; c.setLineDash([5, 4]);
          c.beginPath(); c.moveTo(this.selNode.x, this.selNode.y); c.lineTo(M.mx, M.my); c.stroke(); c.setLineDash([]);
        }
      }
      if (this.sparkAt && this.sparkAt.t > 0) {
        this.sparkAt.t -= 0.016;
        const s = this.sparkAt;
        c.strokeStyle = '#ffd23f'; c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = Math.random() * TAU, r = 8 + Math.random() * 28;
          c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); c.stroke();
        }
      }
      /* лоток */
      if (this.phase === 0) for (let i = 0; i < this.tray.length; i++) {
        const t = this.tray[i], dev = this.devs.find(v => v.id === t.id);
        if (dev.placed) continue;
        const act = this.held === t.id || this.devs[this.sel].id === t.id;
        c.fillStyle = act ? 'rgba(255,210,63,.18)' : 'rgba(255,255,255,.06)';
        c.strokeStyle = act ? '#ffd23f' : 'rgba(185,166,214,.5)'; c.lineWidth = 2;
        roundRect(0, c, t.x, t.y, t.w, t.h, 6); c.fill(); c.stroke();
        c.fillStyle = '#e9dcff'; c.font = '700 12px "Trebuchet MS", sans-serif';
        c.fillText(dev.name, t.x + 34, t.y + 27);
        drawDevIcon(c, t.x + 18, t.y + 22, dev.id);
      }
      /* журнал проверки */
      if (this.phase >= 2 && this.log.length) {
        const lx = this.panel.x + 8, ly = b.y + b.h - 20 - this.log.length * 18;
        c.fillStyle = 'rgba(5,3,12,.88)'; roundRect(0, c, lx - 8, ly - 18, 352, this.log.length * 18 + 14, 6); c.fill();
        c.fillStyle = '#4be36b'; c.font = '600 11px "Consolas", monospace';
        this.log.forEach((s, i) => c.fillText('> ' + s, lx, ly + i * 18));
      }
      c.restore();
    }
  };
  Mini.open(g, q => onDone(applyWorkMods(q)));
}
export function tokColor(t) { return { A: '#ff8a1f', B: '#25e8dc', C: '#4be36b', D: '#ff2d95' }[t] || '#fff'; }
export function hitRect(x, y, r, pad) { pad = pad || 0; return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }
export function fxMini(x, y) { /* маленькая вспышка на схеме */ Audio2.click(); }
export function drawDevIcon(c, x, y, id) {
  c.save(); c.translate(x, y);
  if (id === 'ctrl') { c.fillStyle = '#25e8dc'; c.fillRect(-9, -7, 18, 14); c.fillStyle = '#0b0518'; c.fillRect(-6, -4, 12, 3); }
  if (id === 'read') { c.fillStyle = '#ffd23f'; roundRect(0, c, -7, -9, 14, 18, 3); c.fill(); c.fillStyle = '#0b0518'; c.beginPath(); c.arc(0, -2, 3, 0, TAU); c.fill(); }
  if (id === 'exit') { c.fillStyle = '#4be36b'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#0b0518'; c.font = '700 8px sans-serif'; c.textAlign = 'center'; c.fillText('EXIT', 0, 3); c.textAlign = 'left'; }
  if (id === 'lock') { c.fillStyle = '#ff2d95'; c.fillRect(-10, -5, 20, 10); c.fillStyle = '#0b0518'; c.fillRect(-3, -3, 6, 6); }
  c.restore();
}
export function drawDevice(c, s, dev) {
  c.save(); c.translate(s.x + s.w / 2, s.y + s.h / 2);
  const sc = Math.min(s.w / 108, s.h / 62) * 1.5;
  c.scale(sc, sc);
  drawDevIcon(c, 0, 0, dev.id);
  c.restore();
}

export function startCameraGame(opts, onDone) {
  opts = opts || {};
  const quick = !!opts.quick;
  const g = {
    title: 'МОНТАЖ КАМЕРЫ' + (opts.zone ? ' · ' + opts.zone.toUpperCase() : ''),
    q: 100, phase: quick ? 1 : 0, t: 0, zoneName: opts.zone || 'контрольная зона',
    /* высота */
    hVal: 0, hDir: 1, hSet: quick ? 5 : 0, hBand: [0.46, 0.66], hStopped: quick,
    /* крепёж */
    bolts: [], boltIdx: 0, boltsN: quick ? 2 : 3,
    /* питание и сеть */
    plugs: [], plugSel: null, plugsDone: quick,
    /* угол */
    ang: 0, tilt: 16, fovH: 55, fovV: 38, cover: 0, sky: 0,
    shakeT: 0, shakeCd: 5, shakeMiss: 0, aimOk: false, confirmed: false,
    zone: null,
    layout(w, h) {
      this.w = w; this.h = h;
      this.cx0 = w / 2; this.cy0 = h / 2 + 10;
      this.prev = { x: w - Math.min(360, w * 0.34) - 24, y: 92, w: Math.min(360, w * 0.34), h: Math.min(230, h * 0.32) };
    },
    init() {
      for (let i = 0; i < this.boltsN; i++) this.bolts.push({ a: rnd(0, 1), dir: 1, sp: 0.85 + i * 0.22, state: 0 });
      this.plugs = [
        { id: 'pwr', name: 'Питание', x: 0, y: 0, done: false, c: '#ff8a1f' },
        { id: 'net', name: 'Сеть', x: 0, y: 0, done: false, c: '#25e8dc' }
      ];
      const bear = rnd(-0.85, 0.85);
      this.zone = { bear, dist: rnd(9, 14), w: 6.5, d: 4.2 };
      this.ang = bear + rnd(-0.9, 0.9);
      this.tilt = rnd(4, 12);
      this.recompute();
    },
    phaseName() {
      return ['ЭТАП 1 — ВЫСОТА', 'ЭТАП 2 — КРЕПЁЖ', 'ЭТАП 3 — ПИТАНИЕ И СЕТЬ', 'ЭТАП 4 — УГОЛ ОБЗОРА', 'ГОТОВО'][this.phase] || 'ГОТОВО';
    },
    hint() {
      if (this.phase === 0) return 'Останови метку в зелёной зоне высоты: <b>Space</b>, <b>E</b> или клик. Ниже — удобно, выше — обзорнее.';
      if (this.phase === 1) return 'Затяни ' + this.boltsN + ' крепления: жми <b>F</b> (или Space), когда стрелка в зелёном. В красном — сорвёшь резьбу.';
      if (this.phase === 2) return 'Соедини разъёмы с гнёздами: клик по разъёму, затем по гнезду.';
      if (this.phase === 3) return '<b>A/D</b> — поворот, <b>W/S</b> — наклон, <b>Z/X</b> — зум. Зона «' + this.zoneName + '» в кадре: <b>' + Math.round(this.cover * 100) + '%</b>, неба в кадре: <b>' + Math.round(this.sky * 100) + '%</b>. ' + (this.shakeT > 0 ? '<b style="color:#ff4d5e">Опору раскачивают! F — отогнать</b>' : 'Нужно ≥ 90% зоны и ≤ 30% неба.');
      return 'Камера смотрит куда надо.';
    },
    buttons() {
      if (this.phase === 3) return [
        { label: 'Зум −', fn: () => { this.fovH = clamp(this.fovH + 5, 28, 78); this.recompute(); } },
        { label: 'Зум +', fn: () => { this.fovH = clamp(this.fovH - 5, 28, 78); this.recompute(); } },
        { label: 'Подтвердить ракурс', cls: 'c', fn: () => this.confirm() }
      ];
      if (this.phase === 4) return [{ label: 'Закончить и сдать', cls: 'y', fn: () => Mini.finish(this.q) }];
      return [];
    },
    update(dt, M) {
      this.t += dt;
      const click = Mini.click();
      if (this.phase === 0) {
        this.hVal += this.hDir * dt * 0.62;
        if (this.hVal > 1) { this.hVal = 1; this.hDir = -1; }
        if (this.hVal < 0) { this.hVal = 0; this.hDir = 1; }
        if (Input.anyHit(K.brake) || Input.anyHit(K.act) || Input.anyHit(K.tool) || click) {
          this.hStopped = true;
          const mid = (this.hBand[0] + this.hBand[1]) / 2;
          const off = Math.abs(this.hVal - mid);
          const half = (this.hBand[1] - this.hBand[0]) / 2;
          this.hSet = 2.6 + this.hVal * 5.2;
          if (off <= half) { Audio2.ok(); toast('Высота удачная: ' + this.hSet.toFixed(1) + ' м', 'good', 1800); }
          else { const pen = Math.round(clamp((off - half) * 60, 4, 22)); this.q -= pen; Audio2.nope(); toast('Высота так себе (' + this.hSet.toFixed(1) + ' м): −' + pen, 'bad', 2000); }
          this.phase = 1;
        }
      } else if (this.phase === 1) {
        const b = this.bolts[this.boltIdx];
        if (b) {
          b.a += b.dir * dt * b.sp;
          if (b.a > 1) { b.a = 1; b.dir = -1; }
          if (b.a < 0) { b.a = 0; b.dir = 1; }
          if (Input.anyHit(K.tool) || Input.anyHit(K.brake) || click) {
            const v = b.a;
            if (v > 0.42 && v < 0.6) { b.state = 1; Audio2.screwdr(); toast('Затянуто как надо', 'good', 1200); }
            else if (v > 0.3 && v < 0.72) { b.state = 2; this.q -= 5; Audio2.click(); toast('Почти. Будет поскрипывать', 'info', 1200); }
            else { b.state = 3; this.q -= 12; Audio2.spark(); shake(3); toast(pick(['Сорвал резьбу!', 'Перетянул. Крепление теперь «условное»']), 'bad', 1800); }
            this.boltIdx++;
            if (this.boltIdx >= this.bolts.length) { this.phase = this.plugsDone ? 3 : 2; Audio2.ok(); }
          }
        }
      } else if (this.phase === 2) {
        if (click) {
          const pl = this.plugs.find(p => !p.done && dist(M.mx, M.my, p.px, p.py) < 34);
          if (pl) { this.plugSel = pl; Audio2.click(); }
          else if (this.plugSel) {
            const sock = this.sockets.find(s => dist(M.mx, M.my, s.px, s.py) < 34);
            if (sock) {
              if (sock.id === this.plugSel.id) { this.plugSel.done = true; Audio2.ok(); }
              else { this.q -= 6; Audio2.nope(); toast('Не то гнездо. Разъём смотрит на тебя с укором', 'bad', 1600); }
              this.plugSel = null;
            }
          }
        }
        if (this.plugs.every(p => p.done)) { this.phase = 3; Audio2.ok(); toast('Питание и сеть есть. Теперь ракурс', 'good', 2000); }
      } else if (this.phase === 3) {
        const sp = dt * (Input.any(K.sprint) ? 1.9 : 1);
        if (Input.any(K.left)) this.ang -= sp * 0.85;
        if (Input.any(K.right)) this.ang += sp * 0.85;
        if (Input.any(K.up)) this.tilt = clamp(this.tilt - sp * 26, 0, 68);
        if (Input.any(K.down)) this.tilt = clamp(this.tilt + sp * 26, 0, 68);
        if (Input.down['KeyZ']) this.fovH = clamp(this.fovH + sp * 26, 28, 78);
        if (Input.down['KeyX']) this.fovH = clamp(this.fovH - sp * 26, 28, 78);
        /* хулиган раскачивает опору */
        if (!S.partnerBonus) {
          this.shakeCd -= dt;
          if (this.shakeCd <= 0 && this.shakeT <= 0) {
            this.shakeCd = rnd(7, 12); this.shakeT = 2.4;
            Audio2.thud(); shake(6);
            toast('«Опора-то шатается! Смотри как!» — F, чтобы отогнать', 'bad', 2400);
          }
        }
        if (this.shakeT > 0) {
          this.shakeT -= dt;
          this.ang += Math.sin(this.t * 18) * 0.012;
          this.tilt += Math.cos(this.t * 15) * 0.16;
          if (Input.anyHit(K.tool)) {
            this.shakeT = 0; this.shakeCd = rnd(9, 14);
            Audio2.thud();
            toast(pick(['Отогнал. «Я же помогаю!»', 'Ушли. Пока что']), 'good', 1800);
          } else if (this.shakeT <= 0) {
            this.shakeMiss++; this.q -= 7;
            toast('Пока качали — сбился ракурс: −7', 'bad', 2000);
          }
        }
        this.recompute();
        if (Input.anyHit(K.act)) this.confirm();
      } else if (this.phase === 4) {
        if (Input.anyHit(K.act)) Mini.finish(this.q);
      }
    },
    confirm() {
      if (this.cover < 0.9 || this.sky > 0.3) {
        Audio2.nope();
        const why = this.sky > 0.3 ? 'Камера смотрит в небо. Небо у нас не воруют.' : 'Часть зоны «' + this.zoneName + '» вне кадра.';
        Dlg.one('client', why + ' Поправь и подтверди.');
        this.q = clamp(this.q - 3, 0, 100);
        return;
      }
      this.confirmed = true;
      const bonus = Math.round((this.cover - 0.9) * 60 + (0.3 - this.sky) * 20);
      this.q = clamp(this.q + bonus, 0, 100);
      this.phase = 4;
      Audio2.ok();
    },
    recompute() {
      const h = this.hSet || 5;
      const fovVr = this.fovV * Math.PI / 180;
      const top = (this.tilt * Math.PI / 180) - fovVr / 2;
      const bot = (this.tilt * Math.PI / 180) + fovVr / 2;
      const near = h / Math.tan(Math.max(0.02, bot));
      const far = top > 0.02 ? h / Math.tan(top) : 1e6;
      this.near = near; this.far = far;
      this.sky = top < 0 ? clamp(-top / fovVr, 0, 1) : 0;
      /* покрытие зоны */
      const z = this.zone;
      const zc = { x: Math.cos(z.bear) * z.dist, y: Math.sin(z.bear) * z.dist };
      const ux = Math.cos(z.bear), uy = Math.sin(z.bear);
      let inside = 0, total = 0;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        const px = zc.x + ux * (i / 2) * (z.d / 2) - uy * (j / 2) * (z.w / 2);
        const py = zc.y + uy * (i / 2) * (z.d / 2) + ux * (j / 2) * (z.w / 2);
        const r = Math.hypot(px, py);
        let da = Math.atan2(py, px) - this.ang;
        da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
        total++;
        if (Math.abs(da) <= (this.fovH * Math.PI / 180) / 2 && r >= near && r <= far) inside++;
      }
      this.cover = inside / total;
      this.aimOk = this.cover >= 0.9 && this.sky <= 0.3;
    },
    draw(c, w, h, M) {
      c.save();
      if (this.phase === 0) this.drawHeight(c, w, h);
      else if (this.phase === 1) this.drawBolts(c, w, h);
      else if (this.phase === 2) this.drawPlugs(c, w, h, M);
      else this.drawAim(c, w, h);
      c.restore();
    },
    drawHeight(c, w, h) {
      this.hSet = 2.6 + this.hVal * 5.2;
      this.drawRig(c, w, h);
      const px = w * 0.62, top = 110, bot = h - 150;
      c.strokeStyle = '#6b5a86'; c.lineWidth = 14; c.lineCap = 'round';
      c.beginPath(); c.moveTo(px, top); c.lineTo(px, bot); c.stroke();
      c.lineWidth = 2; c.strokeStyle = 'rgba(185,166,214,.5)';
      for (let i = 0; i <= 8; i++) {
        const y = lerp(bot, top, i / 8);
        c.beginPath(); c.moveTo(px - 22, y); c.lineTo(px + 22, y); c.stroke();
        c.fillStyle = 'rgba(185,166,214,.75)'; c.font = '700 11px "Consolas",monospace';
        c.fillText((2.6 + (i / 8) * 5.2).toFixed(1) + ' м', px + 30, y + 4);
      }
      const by0 = lerp(bot, top, this.hBand[0]), by1 = lerp(bot, top, this.hBand[1]);
      c.fillStyle = 'rgba(75,227,107,.25)'; c.fillRect(px - 40, by1, 80, by0 - by1);
      c.strokeStyle = '#4be36b'; c.lineWidth = 2; c.strokeRect(px - 40, by1, 80, by0 - by1);
      c.fillStyle = '#4be36b'; c.font = '700 12px "Trebuchet MS",sans-serif';
      c.fillText('УДОБНО И ВИДНО', px + 48, (by0 + by1) / 2);
      const my = lerp(bot, top, this.hVal);
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(px - 54, my); c.lineTo(px - 30, my - 9); c.lineTo(px - 30, my + 9); c.closePath(); c.fill();
      drawCamIcon(c, px, my - 6, 1, 0.2);
      c.fillStyle = '#e9dcff'; c.font = '900 16px "Arial Black",sans-serif'; c.textAlign = 'center';
      c.fillText('ВЫБЕРИ ВЫСОТУ УСТАНОВКИ', px, 96); c.textAlign = 'left';
    },
    drawRig(c, w, h) {
      const gx = Math.max(150, w * 0.17), gy = h * 0.86, top = h * 0.2;
      const hFrac = clamp(((this.hSet || 5) - 2.6) / 5.2, 0, 1);
      const camY = lerp(gy - 120, top, hFrac);
      c.save();
      /* земля */
      c.strokeStyle = 'rgba(185,166,214,.25)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(gx - 140, gy); c.lineTo(gx + 190, gy); c.stroke();
      /* опора */
      c.strokeStyle = '#6b6278'; c.lineWidth = 13; c.lineCap = 'round';
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 12, top); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(gx - 3, gy); c.lineTo(gx - 15, top); c.stroke();
      /* кронштейн и камера */
      const bx = gx - 12 + (camY - top) * 0.055;
      c.strokeStyle = '#8d8499'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(bx, camY); c.lineTo(bx + 34, camY - 12); c.stroke();
      c.save(); c.translate(bx + 48, camY - 14); c.scale(1.15, 1.15);
      drawCamIcon(c, 0, 0, 1, this.phase >= 3 ? clamp(this.tilt / 90, 0, 0.7) : 0.2);
      c.restore();
      /* болты крепления */
      for (let i = 0; i < this.bolts.length; i++) {
        const b = this.bolts[i];
        c.fillStyle = b.state === 1 ? '#4be36b' : b.state === 2 ? '#ffd23f' : b.state === 3 ? '#ff4d5e' : '#2a2338';
        c.strokeStyle = i === this.boltIdx && this.phase === 1 ? '#fff' : 'rgba(185,166,214,.6)';
        c.lineWidth = 2;
        c.beginPath(); c.arc(bx + 6 + i * 11, camY + 8, 4.5, 0, TAU); c.fill(); c.stroke();
      }
      /* стремянка и Олег */
      c.strokeStyle = '#c9a24f'; c.lineWidth = 4;
      const lx = gx + 60, ly0 = gy, ly1 = camY + 40;
      c.beginPath(); c.moveTo(lx, ly0); c.lineTo(lx - 16, ly1); c.moveTo(lx + 26, ly0); c.lineTo(lx + 8, ly1); c.stroke();
      c.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const t = i / 5, ax = lerp(lx, lx - 16, t), ay = lerp(ly0, ly1, t);
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + lerp(26, 24, t), ay); c.stroke();
      }
      drawPerson(c, lx + 4, camY + 62, { phase: S.t * 2, dir: -0.4, body: '#ff8a1f', vest: true, cap: '#3a3446', hair: '#5a4230', pants: '#2f3550', tool: true });
      if (S.partnerBonus) drawPerson(c, gx + 120, gy, { phase: S.t, dir: Math.PI, body: '#25e8dc', cap: '#0e5a56', hair: '#3a2a1f', pants: '#2a2a3a' });
      c.fillStyle = 'rgba(185,166,214,.7)'; c.font = '700 11px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
      c.fillText('ОПОРА · ВЫСОТА ' + (this.hSet || 5).toFixed(1) + ' М', gx + 20, gy + 22);
      c.textAlign = 'left';
      c.restore();
    },
    drawBolts(c, w, h) {
      this.drawRig(c, w, h);
      const n = this.bolts.length;
      const gap = Math.min(200, (w * 0.52) / n);
      const y = h / 2 - 10;
      for (let i = 0; i < n; i++) {
        const x = w * 0.62 + (i - (n - 1) / 2) * gap;
        const b = this.bolts[i], r = 66;
        c.save(); c.translate(x, y);
        c.strokeStyle = 'rgba(185,166,214,.35)'; c.lineWidth = 16;
        c.beginPath(); c.arc(0, 0, r, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
        const arc = (t) => Math.PI * 0.75 + t * Math.PI * 1.5;
        c.strokeStyle = 'rgba(255,210,63,.5)'; c.lineWidth = 16;
        c.beginPath(); c.arc(0, 0, r, arc(0.3), arc(0.72)); c.stroke();
        c.strokeStyle = '#4be36b';
        c.beginPath(); c.arc(0, 0, r, arc(0.42), arc(0.6)); c.stroke();
        c.strokeStyle = '#ff4d5e'; c.lineWidth = 16;
        c.beginPath(); c.arc(0, 0, r, arc(0.72), arc(1)); c.stroke();
        if (i === this.boltIdx) {
          const a = arc(b.a);
          c.strokeStyle = '#fff'; c.lineWidth = 4;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (r + 14), Math.sin(a) * (r + 14)); c.stroke();
        }
        c.fillStyle = b.state === 1 ? '#4be36b' : b.state === 2 ? '#ffd23f' : b.state === 3 ? '#ff4d5e' : '#2a2338';
        c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill();
        c.strokeStyle = '#0b0518'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.stroke();
        c.fillStyle = '#e9dcff'; c.font = '900 13px "Arial Black",sans-serif'; c.textAlign = 'center';
        c.fillText('КРЕПЁЖ ' + (i + 1), 0, r + 44);
        if (b.state) c.fillText(['', 'ОТЛИЧНО', 'НОРМ', 'СОРВАНО'][b.state], 0, r + 64);
        c.textAlign = 'left'; c.restore();
      }
      c.fillStyle = '#e9dcff'; c.font = '900 16px "Arial Black",sans-serif'; c.textAlign = 'center';
      c.fillText('ЗАТЯНИ КРЕПЛЕНИЯ — F В ЗЕЛЁНОМ СЕКТОРЕ', w * 0.62, 96); c.textAlign = 'left';
    },
    drawPlugs(c, w, h, M) {
      this.drawRig(c, w, h);
      const cx = w * 0.64, cy = h / 2;
      c.fillStyle = 'rgba(12,7,24,.8)'; c.strokeStyle = 'rgba(37,232,220,.4)'; c.lineWidth = 2;
      roundRect(0, c, cx - 210, cy - 120, 420, 240, 10); c.fill(); c.stroke();
      drawCamIcon(c, cx, cy - 74, 1.3, 0.15);
      this.sockets = [
        { id: 'pwr', px: cx - 90, py: cy + 10, name: 'Гнездо питания', c: '#ff8a1f' },
        { id: 'net', px: cx + 90, py: cy + 10, name: 'Гнездо сети', c: '#25e8dc' }
      ];
      /* перемешиваем расположение гнёзд один раз */
      if (this.swapSockets === undefined) this.swapSockets = Math.random() < 0.5;
      if (this.swapSockets) { const a = this.sockets[0].px; this.sockets[0].px = this.sockets[1].px; this.sockets[1].px = a; }
      for (const s of this.sockets) {
        const done = this.plugs.find(p => p.id === s.id).done;
        c.strokeStyle = s.c; c.lineWidth = 3; c.fillStyle = done ? s.c : 'rgba(0,0,0,.4)';
        c.beginPath(); c.arc(s.px, s.py, 22, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#e9dcff'; c.font = '700 11px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
        c.fillText(s.name, s.px, s.py + 40); c.textAlign = 'left';
      }
      this.plugs.forEach((p, i) => {
        p.px = cx - 120 + i * 240; p.py = cy + 110;
        if (p.done) return;
        const sel = this.plugSel === p;
        c.fillStyle = sel ? '#fff' : p.c; c.strokeStyle = p.c; c.lineWidth = 2;
        roundRect(0, c, p.px - 30, p.py - 16, 60, 32, 6); c.fill();
        c.fillStyle = '#0b0518'; c.font = '700 11px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
        c.fillText(p.name, p.px, p.py + 4); c.textAlign = 'left';
        if (sel) { c.strokeStyle = '#ffd23f'; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(M.mx, M.my); c.stroke(); c.setLineDash([]); }
      });
      c.fillStyle = '#e9dcff'; c.font = '900 16px "Arial Black",sans-serif'; c.textAlign = 'center';
      c.fillText('ПОДКЛЮЧИ ПИТАНИЕ И СЕТЬ', cx, 96); c.textAlign = 'left';
    },
    drawAim(c, w, h) {
      /* вид сверху */
      const cx = w * 0.34, cy = h * 0.62, ppm = Math.min(13, (h * 0.4) / 16);
      c.fillStyle = 'rgba(10,6,20,.6)'; c.strokeStyle = 'rgba(185,166,214,.25)'; c.lineWidth = 1;
      for (let r = 4; r <= 16; r += 4) {
        c.beginPath(); c.arc(cx, cy, r * ppm, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(185,166,214,.45)'; c.font = '600 10px "Consolas",monospace';
        c.fillText(r + ' м', cx + r * ppm + 3, cy - 3);
      }
      /* конус */
      const a0 = this.ang - (this.fovH * Math.PI / 180) / 2, a1 = this.ang + (this.fovH * Math.PI / 180) / 2;
      const LIM = 19;                                  /* дальше диаграмму не рисуем */
      const clipped = this.far > LIM;
      const nr = clamp(this.near, 0, LIM) * ppm, fr = Math.min(this.far, LIM) * ppm;
      const grad = c.createRadialGradient(cx, cy, nr, cx, cy, Math.max(nr + 1, fr));
      grad.addColorStop(0, 'rgba(37,232,220,.34)'); grad.addColorStop(1, 'rgba(37,232,220,.05)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(cx, cy, fr, a0, a1); c.arc(cx, cy, nr, a1, a0, true); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(37,232,220,.8)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a0) * nr, cy + Math.sin(a0) * nr); c.lineTo(cx + Math.cos(a0) * fr, cy + Math.sin(a0) * fr);
      c.moveTo(cx + Math.cos(a1) * nr, cy + Math.sin(a1) * nr); c.lineTo(cx + Math.cos(a1) * fr, cy + Math.sin(a1) * fr);
      c.stroke();
      c.beginPath(); c.arc(cx, cy, nr, a0, a1); c.stroke();
      c.setLineDash(clipped ? [7, 6] : []);
      c.beginPath(); c.arc(cx, cy, fr, a0, a1); c.stroke();
      c.setLineDash([]);
      if (clipped) {
        c.fillStyle = 'rgba(37,232,220,.75)'; c.font = '700 10px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
        c.fillText('дальше — до горизонта', cx + Math.cos(this.ang) * (fr + 16), cy + Math.sin(this.ang) * (fr + 16));
        c.textAlign = 'left';
      }
      c.fillStyle = 'rgba(255,77,94,.16)';
      c.beginPath(); c.arc(cx, cy, nr, a0, a1); c.lineTo(cx, cy); c.closePath(); c.fill();
      /* зона */
      const z = this.zone, zx = cx + Math.cos(z.bear) * z.dist * ppm, zy = cy + Math.sin(z.bear) * z.dist * ppm;
      c.save(); c.translate(zx, zy); c.rotate(z.bear);
      c.fillStyle = this.cover >= 0.9 ? 'rgba(75,227,107,.3)' : 'rgba(255,45,149,.28)';
      c.strokeStyle = this.cover >= 0.9 ? '#4be36b' : '#ff2d95'; c.lineWidth = 2;
      c.fillRect(-z.d / 2 * ppm, -z.w / 2 * ppm, z.d * ppm, z.w * ppm);
      c.strokeRect(-z.d / 2 * ppm, -z.w / 2 * ppm, z.d * ppm, z.w * ppm);
      c.restore();
      c.fillStyle = '#e9dcff'; c.font = '700 11px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
      c.fillText(this.zoneName.toUpperCase(), zx, zy - z.w / 2 * ppm - 8); c.textAlign = 'left';
      /* опора */
      c.fillStyle = '#8f7fae'; c.beginPath(); c.arc(cx, cy, 8, 0, TAU); c.fill();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(this.ang) * 30, cy + Math.sin(this.ang) * 30); c.stroke();
      c.fillStyle = 'rgba(185,166,214,.85)'; c.font = '700 11px "Trebuchet MS",sans-serif';
      c.fillText('ВИД СВЕРХУ · высота ' + (this.hSet || 5).toFixed(1) + ' м · наклон ' + Math.round(this.tilt) + '°', cx - 90, cy + h * 0.2);

      /* превью «что видит камера» */
      const p = this.prev;
      c.save();
      c.beginPath(); roundRect(0, c, p.x, p.y, p.w, p.h, 8); c.clip();
      const horizon = p.y + p.h / 2 - ((this.tilt * Math.PI / 180) / ((this.fovV * Math.PI / 180) / 2)) * (p.h / 2);
      const sky = c.createLinearGradient(0, p.y, 0, horizon);
      sky.addColorStop(0, '#ff8a1f'); sky.addColorStop(1, '#8a2be2');
      c.fillStyle = sky; c.fillRect(p.x, p.y, p.w, Math.max(0, horizon - p.y));
      const gr = c.createLinearGradient(0, horizon, 0, p.y + p.h);
      gr.addColorStop(0, '#3a3448'); gr.addColorStop(1, '#221c30');
      c.fillStyle = gr; c.fillRect(p.x, Math.max(p.y, horizon), p.w, p.y + p.h - Math.max(p.y, horizon));
      /* проекция зоны */
      const proj = (px, py) => {
        const r = Math.hypot(px, py);
        let da = Math.atan2(py, px) - this.ang;
        da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const e = Math.atan((this.hSet || 5) / Math.max(0.3, r));
        const u = da / ((this.fovH * Math.PI / 180) / 2);
        const v = (e - this.tilt * Math.PI / 180) / ((this.fovV * Math.PI / 180) / 2);
        return { x: p.x + p.w / 2 + u * p.w / 2, y: p.y + p.h / 2 + v * p.h / 2 };
      };
      const ux = Math.cos(z.bear), uy = Math.sin(z.bear);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
        const px = Math.cos(z.bear) * z.dist + ux * i * (z.d / 2) - uy * j * (z.w / 2);
        const py = Math.sin(z.bear) * z.dist + uy * i * (z.d / 2) + ux * j * (z.w / 2);
        return proj(px, py);
      });
      c.beginPath(); c.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) c.lineTo(corners[i].x, corners[i].y);
      c.closePath();
      c.fillStyle = this.cover >= 0.9 ? 'rgba(75,227,107,.35)' : 'rgba(255,45,149,.3)';
      c.strokeStyle = this.cover >= 0.9 ? '#4be36b' : '#ff2d95'; c.lineWidth = 2;
      c.fill(); c.stroke();
      /* сетка «видеокадра» */
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        c.beginPath(); c.moveTo(p.x + p.w * i / 3, p.y); c.lineTo(p.x + p.w * i / 3, p.y + p.h); c.stroke();
        c.beginPath(); c.moveTo(p.x, p.y + p.h * i / 3); c.lineTo(p.x + p.w, p.y + p.h * i / 3); c.stroke();
      }
      c.fillStyle = '#4be36b'; c.font = '700 11px "Consolas",monospace';
      c.fillText('REC ' + clockStr(), p.x + 10, p.y + 20);
      c.fillStyle = 'rgba(255,77,94,.9)'; c.beginPath(); c.arc(p.x + p.w - 16, p.y + 16, 5, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = this.aimOk ? '#4be36b' : 'rgba(185,166,214,.6)'; c.lineWidth = 2;
      roundRect(0, c, p.x, p.y, p.w, p.h, 8); c.stroke();
      c.fillStyle = '#b9a6d6'; c.font = '700 11px "Trebuchet MS",sans-serif';
      c.fillText('ЧТО ВИДИТ КАМЕРА', p.x, p.y - 6);
      if (this.sky > 0.3) {
        c.fillStyle = '#ff4d5e'; c.font = '900 13px "Arial Black",sans-serif';
        c.fillText('СЛИШКОМ МНОГО НЕБА', p.x, p.y + p.h + 20);
      } else if (this.cover < 0.9) {
        c.fillStyle = '#ffd23f'; c.font = '900 13px "Arial Black",sans-serif';
        c.fillText('ЗОНА НЕ ЦЕЛИКОМ В КАДРЕ', p.x, p.y + p.h + 20);
      } else {
        c.fillStyle = '#4be36b'; c.font = '900 13px "Arial Black",sans-serif';
        c.fillText('ЗОНА В КАДРЕ — МОЖНО ПОДТВЕРЖДАТЬ (E)', p.x, p.y + p.h + 20);
      }
      if (this.shakeT > 0) {
        c.save(); c.translate(rnd(-4, 4), rnd(-4, 4));
        c.fillStyle = 'rgba(255,77,94,.9)'; c.font = '900 18px "Arial Black",sans-serif'; c.textAlign = 'center';
        c.fillText('ОПОРУ РАСКАЧИВАЮТ! F — ОТОГНАТЬ', w / 2, h - 110); c.textAlign = 'left';
        c.restore();
      }
    }
  };
  Mini.open(g, q => onDone(applyWorkMods(q)));
}
export function drawCamIcon(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(rot || 0);
  c.fillStyle = '#2a2338'; c.strokeStyle = '#25e8dc'; c.lineWidth = 2;
  roundRect(0, c, -22, -10, 40, 20, 4); c.fill(); c.stroke();
  c.fillStyle = '#0b0518'; c.beginPath(); c.arc(16, 0, 8, 0, TAU); c.fill();
  c.strokeStyle = '#ffd23f'; c.beginPath(); c.arc(16, 0, 8, 0, TAU); c.stroke();
  c.fillStyle = '#6b5a86'; c.fillRect(-26, -4, 6, 8);
  c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(-14, -6, 2.5, 0, TAU); c.fill();
  c.restore();
}
