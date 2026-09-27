/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «15. Ввод: клавиатура, мышь, обзор от третьего лица», строки 8936–9003.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { $ } from '../core/util.js';
import { S } from './state.js';
import { Dlg } from '../ui/dialog.js';
export const K = {
  up: ['KeyW','ArrowUp'], down: ['KeyS','ArrowDown'], left: ['KeyA','ArrowLeft'], right: ['KeyD','ArrowRight'],
  sprint: ['ShiftLeft','ShiftRight'], act: ['KeyE'], brake: ['Space'], tool: ['KeyF'],
  map: ['KeyM'], pause: ['Escape'], radio: ['KeyQ'], phone: ['KeyR'], partner: ['KeyC'],
  myphone: ['KeyT']
};
export function requestLock() {
  try {
    const pr = $('stage').requestPointerLock();
    /* Chrome возвращает промис: он отклоняется, если захват курсора запрещён
       (iframe без разрешения) или пользователь только что вышел из захвата. */
    if (pr && typeof pr.catch === 'function') pr.catch(() => { });
  } catch (e) { }
}
export function exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { } }

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export let Input;
export function __init() {


  /* ------------------------------------------------------------------ */
  /* 15. Ввод: клавиатура, мышь, обзор от третьего лица                   */
  /* ------------------------------------------------------------------ */
  Input = {
    down: Object.create(null), hit: Object.create(null),
    mx: 0, my: 0, mdown: false, mclick: false, dx: 0, dy: 0, locked: false, wheel: 0, rdrag: false,
    blockKeys: { ArrowUp:1, ArrowDown:1, ArrowLeft:1, ArrowRight:1, Space:1, Tab:1, KeyE:1, KeyF:1, KeyM:1, KeyQ:1, KeyR:1, KeyC:1, KeyT:1 },
    init() {
      window.addEventListener('keydown', e => {
        if (e.repeat) { if (this.blockKeys[e.code]) e.preventDefault(); return; }
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.down[e.code] = true; this.hit[e.code] = true;
        if (this.blockKeys[e.code]) e.preventDefault();
        Audio2.resume();
      });
      window.addEventListener('keyup', e => { this.down[e.code] = false; });
      window.addEventListener('blur', () => { this.down = Object.create(null); this.mdown = false; });
      const stage = $('stage');
      const upd = e => {
        const r = stage.getBoundingClientRect();
        const p = (e.touches && e.touches[0]) || e;
        this.mx = p.clientX - r.left; this.my = p.clientY - r.top;
      };
      stage.addEventListener('mousemove', e => {
        const px = this.mx, py = this.my;
        upd(e);
        if (this.locked) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
        else if (this.rdrag) { this.dx += (this.mx - px); this.dy += (this.my - py); }
      });
      stage.addEventListener('mousedown', e => {
        upd(e); Audio2.resume();
        if (e.button === 2) { this.rdrag = true; e.preventDefault(); return; }
        this.mdown = true; this.mclick = true;
        if (S.screen === 'play' && !Dlg.open && !this.locked && e.button === 0) requestLock();
      });
      window.addEventListener('mouseup', e => { this.mdown = false; if (e.button === 2) this.rdrag = false; });
      stage.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === $('stage') || document.pointerLockElement === $('gl');
        $('crosshair').style.display = this.locked ? 'block' : 'none';
      });
      stage.addEventListener('touchstart', e => { upd(e); this.mdown = true; this.mclick = true; Audio2.resume(); }, { passive: true });
      stage.addEventListener('touchmove', e => upd(e), { passive: true });
      stage.addEventListener('touchend', () => { this.mdown = false; }, { passive: true });
      window.addEventListener('contextmenu', e => { if (e.target && e.target.id === 'gl') e.preventDefault(); });
    },
    pressed(c) { return !!this.hit[c]; },
    any(list) { for (const c of list) if (this.down[c]) return true; return false; },
    anyHit(list) { for (const c of list) if (this.hit[c]) return true; return false; },
    endFrame() { this.hit = Object.create(null); this.mclick = false; this.dx = 0; this.dy = 0; this.wheel = 0; }
  };
}
