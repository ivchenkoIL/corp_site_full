/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «13. Мини-игры монтажа (двумерные схемы поверх сцены)», строки 7957–8062.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $, TAU, clamp } from '../core/util.js';
import { Input } from '../game/input.js';
import { S } from '../game/state.js';


/* ------------------------------------------------------------------ */
/* 13. Мини-игры монтажа (двумерные схемы поверх сцены)                  */
/* ------------------------------------------------------------------ */
export function roundRect(x, c, rx, ry, w, h, r) {
  c.beginPath();
  c.moveTo(rx + r, ry);
  c.arcTo(rx + w, ry, rx + w, ry + h, r);
  c.arcTo(rx + w, ry + h, rx, ry + h, r);
  c.arcTo(rx, ry + h, rx, ry, r);
  c.arcTo(rx, ry, rx + w, ry, r);
  c.closePath();
}
export const Mini = {
  g: null, cv: null, cx: null, w: 0, h: 0, dpr: 1, onDone: null, t: 0,
  open(game, onDone) {
    this.g = game; this.onDone = onDone; this.t = 0;
    this.cv = $('miniCanvas'); this.cx = this.cv.getContext('2d');
    S.screen = 'mini';
    $('mini').classList.add('show');
    $('miniTitle').textContent = game.title;
    this.resize();
    game.layout(this.w, this.h);
    if (game.init) game.init();
    this.sync();
    Audio2.select();
  },
  resize() {
    const r = $('stage').getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(320, Math.floor(r.width)); this.h = Math.max(240, Math.floor(r.height));
    this.cv.width = Math.floor(this.w * this.dpr); this.cv.height = Math.floor(this.h * this.dpr);
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
    this.cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.g && this.g.layout) this.g.layout(this.w, this.h);
  },
  close() {
    $('mini').classList.remove('show');
    $('miniBtns').innerHTML = '';
    this.g = null; S.screen = 'play';
  },
  finish(q) {
    const cb = this.onDone; const qq = clamp(Math.round(q), 0, 100);
    this.close();
    if (cb) cb(qq);
  },
  sync() {
    const g = this.g; if (!g) return;
    $('miniPhase').textContent = g.phaseName();
    $('miniHint').innerHTML = g.hint();
    const q = clamp(g.q, 0, 100);
    $('miniQBar').style.width = q + '%';
    $('miniQNum').textContent = Math.round(q);
    const btns = g.buttons ? g.buttons() : [];
    const box = $('miniBtns');
    const sig = btns.map(b => b.label + (b.disabled ? '!' : '')).join('|');
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig; box.innerHTML = '';
      btns.forEach(b => {
        const el = document.createElement('button');
        el.className = 'btn sm ' + (b.cls || '');
        el.type = 'button'; el.textContent = b.label; el.disabled = !!b.disabled;
        el.addEventListener('click', e => { e.stopPropagation(); Audio2.click(); b.fn(); });
        box.appendChild(el);
      });
    }
  },
  update(dt) {
    if (!this.g) return;
    this.t += dt;
    /* «пьяный» курсор и усталость */
    const p = S.player;
    const jx = p.drunk > 5 ? Math.sin(this.t * 3.7) * p.drunk * 0.16 + Math.sin(this.t * 9.1) * p.drunk * 0.06 : 0;
    const jy = p.drunk > 5 ? Math.cos(this.t * 3.1) * p.drunk * 0.14 : 0;
    const tired = p.stamina < 25 ? Math.sin(this.t * 5.3) * (25 - p.stamina) * 0.12 : 0;
    this.mx = Input.mx + jx + tired; this.my = Input.my + jy;
    this.g.update(dt, this);
    this.sync();
  },
  draw() {
    if (!this.g) return;
    const c = this.cx;
    c.clearRect(0, 0, this.w, this.h);
    const bg = c.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#241041'); bg.addColorStop(0.55, '#160a2a'); bg.addColorStop(1, '#0b0518');
    c.fillStyle = bg; c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.globalAlpha = 0.1; c.strokeStyle = '#8a2be2'; c.lineWidth = 1;
    for (let x = 0; x < this.w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.h); c.stroke(); }
    for (let y = 0; y < this.h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(this.w, y); c.stroke(); }
    c.restore();
    this.g.draw(c, this.w, this.h, this);
    /* курсор */
    if (this.mx != null) {
      c.save();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.mx, this.my, 9, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(this.mx - 14, this.my); c.lineTo(this.mx - 4, this.my);
      c.moveTo(this.mx + 4, this.my); c.lineTo(this.mx + 14, this.my);
      c.moveTo(this.mx, this.my - 14); c.lineTo(this.mx, this.my - 4);
      c.moveTo(this.mx, this.my + 4); c.lineTo(this.mx, this.my + 14); c.stroke();
      c.restore();
    }
  },
  click() { return Input.mclick && this.my < this.h - 74 && this.my > 58; }
};
