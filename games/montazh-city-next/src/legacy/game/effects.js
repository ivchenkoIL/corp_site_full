/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «17. Эффекты, тосты, показатели», строки 9059–9131.
   ===================================================================== */
import { Audio2 } from '../audio/audio.js';
import { Q } from '../core/quality.js';
import { $, TAU, clamp, dist2, fmtMoney, pick, rnd } from '../core/util.js';
import { S } from './state.js';
import { endGame } from '../ui/screens.js';

/* ------------------------------------------------------------------ */
/* 17. Эффекты, тосты, показатели                                       */
/* ------------------------------------------------------------------ */
export function fx3(x, y, z, kind, n, color) {
  n = n || 8;
  n = Math.max(2, Math.round(n * Q.sparks));
  if (S.fx.length > 300) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = kind === 'spark' ? rnd(1.5, 6) : rnd(0.5, 3);
    S.fx.push({
      x, y, z, vx: Math.cos(a) * sp, vy: rnd(1, 4), vz: Math.sin(a) * sp,
      life: rnd(0.3, 0.9), max: 0.9, kind, color: color || (kind === 'spark' ? [1, .82, .25] : [.78, .72, .86]),
      s: kind === 'spark' ? rnd(0.05, 0.12) : rnd(0.08, 0.22)
    });
  }
}
export function floater(x, y, z, text, color) { S.fx.push({ x, y, z, vx: 0, vy: 1.1, vz: 0, life: 1.3, max: 1.3, kind: 'text', text, color: color || '#ffd23f' }); }
export function shake(v) { S.shake = Math.min(1.2, S.shake + v * 0.05); }
export function toast(text, cls, ms) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (cls || '');
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, ms || 2600);
  while (box.children.length > 5) box.removeChild(box.firstChild);
}
export function addMoney(v, why) {
  S.player.money = Math.max(0, S.player.money + v);
  if (v > 0) { S.stats.earned += v; Audio2.cash(); }
  floater(S.player.x, 2.1, S.player.z, (v > 0 ? '+' : '') + Math.round(v) + ' ₽', v > 0 ? '#4be36b' : '#ff4d5e');
  if (why) toast(why + ': ' + (v > 0 ? '+' : '') + fmtMoney(v), v > 0 ? 'good' : 'bad');
}
export function addRep(v, why) {
  S.player.rep = clamp(S.player.rep + v, -30, 120);
  if (why) toast(why + ' (репутация ' + (v > 0 ? '+' : '') + v + ')', v > 0 ? 'good' : 'bad');
  if (S.player.rep <= -25) endGame(false, 'Борисыч устал. «Олег, ты хороший человек, но объекты после тебя — как после града».');
}
export function hurt(v, why) {
  const p = S.player;
  if (p.invuln > 0) return;
  p.health = clamp(p.health - v, 0, 100);
  p.hurt = 0.45; p.invuln = 0.55;
  shake(v * 0.5);
  if (p.health <= 0) endGame(false, why || 'Олег переоценил себя и недооценил бордюр. Смена окончена больничным.');
}
export function addHeat(v, reason) {
  S.heat = clamp(S.heat + v, 0, 100);
  if (v >= 8 && reason) toast(reason, 'bad', 2000);
}
export const GRAN_LINES = ['Я всё записала, молодой человек!', 'Вот при Николавне такого не было.', 'Это тот, что провода тянул и водосток задел!', 'Сейчас председателю позвоню, у меня быстрый набор.', 'Ходят тут, монтируют.'];
export function witnessed(x, z) {
  let seen = false;
  for (const g of S.grans) if (dist2(g.x, g.z, x, z) < 20 * 20) { seen = true; g.say = 3.2; g.line = pick(GRAN_LINES); }
  if (seen) addHeat(11, 'Бабушки у подъезда всё видели');
  return seen;
}
export function bagCapacity() { return 6 + (S.upgrades.rack ? 2 : 0); }
export function staminaMult() {
  let m = 1;
  if (S.upgrades.thermos) m += 0.35;
  if (S.upgrades.saddle) m += 0.2;
  if (S.player.drunk > 30) m -= 0.3;
  return Math.max(0.3, m);
}
export function applyWorkMods(q) {
  let f = q;
  if (S.partnerBonus) f += 8;
  if (S.player.drunk > 20) f = Math.min(f, 62);
  if (S.player.stamina < 15) f -= 5;
  return clamp(f, 5, 100);
}
