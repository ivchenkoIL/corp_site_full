/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «12. Диалоги и портреты», строки 7463–7551.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $ } from '../core/util.js';
import { Input, K } from '../game/input.js';
import { drawPortrait } from '../game/phone.js';
import { GL } from '../render/gl.js';


/* ------------------------------------------------------------------ */
/* 12. Диалоги и портреты                                               */
/* ------------------------------------------------------------------ */
export const Dlg = {
  open: false, who: '', text: '', shown: 0, opts: null, queue: [], onEnd: null, lock: 0,
  seq(list, onEnd) {
    this.queue = list.slice();
    this.onEnd = onEnd || null;
    this._next();
  },
  one(who, text, opts, onEnd) { this.seq([{ who, text, opts }], onEnd); },
  _next() {
    if (!this.queue.length) { this._close(); if (this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); } return; }
    const e = this.queue.shift();
    this.open = true; this.who = e.who; this.text = e.text; this.shown = 0; this.opts = e.opts || null; this.lock = 0.18;
    $('dialog').style.display = 'block';
    $('dlgName').textContent = CHARS[e.who] ? CHARS[e.who].name : e.who;
    $('dlgText').textContent = '';
    drawPortrait(e.who);
    this._renderOpts();
    if (this.opts) Audio2.select(); else Audio2.click();
  },
  _renderOpts() {
    const box = $('dlgOpts'); box.innerHTML = '';
    $('dlgNext').textContent = this.opts ? 'Цифры 1–5 или мышь' : 'Space / E — далее';
    if (!this.opts) return;
    this.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt'; b.type = 'button';
      b.innerHTML = '<s>' + (i + 1) + '.</s> ' + o.label + (o.hint ? ' <s>— ' + o.hint + '</s>' : '');
      b.disabled = !!o.disabled;
      if (o.disabled) b.style.opacity = '.45';
      b.addEventListener('click', () => this.choose(i));
      box.appendChild(b);
    });
  },
  choose(i) {
    if (!this.opts || !this.opts[i] || this.opts[i].disabled) return;
    const o = this.opts[i];
    Audio2.click();
    const rest = this.queue.slice(); const end = this.onEnd;
    this.queue = []; this.onEnd = null; this._close();
    if (o.fn) o.fn();
    if (!this.open && rest.length) { this.queue = rest; this.onEnd = end; this._next(); }
  },
  _close() { this.open = false; this.opts = null; $('dialog').style.display = 'none'; },
  closeAll() { this.queue = []; this.onEnd = null; this._close(); },
  update(dt) {
    if (!this.open) return;
    this.lock = Math.max(0, this.lock - dt);
    if (this.shown < this.text.length) {
      this.shown = Math.min(this.text.length, this.shown + dt * 74);
      $('dlgText').textContent = this.text.slice(0, Math.floor(this.shown));
    }
    if (this.lock > 0) return;
    if (this.opts) {
      for (let i = 0; i < this.opts.length; i++)
        if (Input.pressed('Digit' + (i + 1)) || Input.pressed('Numpad' + (i + 1))) { this.choose(i); return; }
      return;
    }
    if (Input.anyHit(K.act) || Input.anyHit(K.brake) || (Input.mclick && Input.my > GL.h - 190)) {
      delete Input.hit['KeyE']; delete Input.hit['Space'];
      if (this.shown < this.text.length) { this.shown = this.text.length; $('dlgText').textContent = this.text; }
      else this._next();
    }
  }
};

export const CHARS = {
  oleg:     { name: 'ОЛЕГ', c: '#ff8a1f' },
  tamara:   { name: 'ДИСПЕТЧЕР ТАМАРА', c: '#ff2d95' },
  sanya:    { name: 'НАПАРНИК САНЯ', c: '#25e8dc' },
  boris:    { name: 'НАЧАЛЬНИК БОРИСЫЧ', c: '#ffd23f' },
  hool:     { name: 'ДВОРОВЫЙ ДЕЯТЕЛЬ', c: '#8a2be2' },
  gran:     { name: 'БАБУШКА У ПОДЪЕЗДА', c: '#4be36b' },
  guard:    { name: 'ЧОП «БДИТЕЛЬНЫЙ СОСЕД»', c: '#ff4d5e' },
  client:   { name: 'КЛИЕНТ', c: '#25e8dc' },
  ohran:    { name: 'ОХРАННИК ВАЛЕРА', c: '#25e8dc' },
  zaved:    { name: 'ЗАВЕДУЮЩАЯ НИНА ПАЛНА', c: '#ff2d95' },
  sklad:    { name: 'ДИРЕКТОР СКЛАДА', c: '#ff8a1f' },
  predsed:  { name: 'ПРЕДСЕДАТЕЛЬ ДОМА', c: '#4be36b' },
  director: { name: 'ЗАКАЗЧИК БЦ', c: '#8a2be2' },
  kostya:   { name: 'МОНТАЖНИК КОСТЯ', c: '#9ae64b' },
  vanya:    { name: 'БРИГАДИР ВАНЯ', c: '#5b8dff' },
  egorov:   { name: 'ЕГОРОВ СЕРГЕЙ', c: '#e8643c' },
  ambul:    { name: 'СКОРАЯ ПОМОЩЬ', c: '#ff4d5e' },
  pnd:      { name: 'ПНД, ДЕЖУРНЫЙ', c: '#8a2be2' }
};
