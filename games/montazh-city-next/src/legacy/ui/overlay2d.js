/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «20. Двумерный слой поверх сцены: реплики, метки, указатели», строки 9387–9452.
   ===================================================================== */
import { $, clamp } from '../core/util.js';
import { GL } from '../render/gl.js';
import { R3 } from '../render/renderer.js';
import { roundRect } from './minigames.js';


/* ------------------------------------------------------------------ */
/* 20. Двумерный слой поверх сцены: реплики, метки, указатели            */
/* ------------------------------------------------------------------ */
export const HUD2 = { cv: null, c: null, w: 0, h: 0 };
export function initHud2() { HUD2.cv = $('hud2d'); HUD2.c = HUD2.cv.getContext('2d'); }
export function resizeHud2() {
  HUD2.w = GL.w; HUD2.h = GL.h;
  HUD2.cv.width = Math.floor(GL.w * GL.uiDpr); HUD2.cv.height = Math.floor(GL.h * GL.uiDpr);
  HUD2.cv.style.width = GL.w + 'px'; HUD2.cv.style.height = GL.h + 'px';
  HUD2.c.setTransform(GL.uiDpr, 0, 0, GL.uiDpr, 0, 0);
}
export const PRJ = new Float32Array(4);
export function project(x, y, z) {
  const v = R3.view, pr = R3.proj;
  const ex = v[0]*x + v[4]*y + v[8]*z + v[12];
  const ey = v[1]*x + v[5]*y + v[9]*z + v[13];
  const ez = v[2]*x + v[6]*y + v[10]*z + v[14];
  const cw = -ez;
  if (cw < 0.05) return null;
  const cx = pr[0] * ex, cy = pr[5] * ey;
  PRJ[0] = (cx / cw * 0.5 + 0.5) * HUD2.w;
  PRJ[1] = (0.5 - cy / cw * 0.5) * HUD2.h;
  PRJ[2] = cw;
  return PRJ;
}
export function bubble3(x, y, z, text, color) {
  const p = project(x, y, z);
  if (!p || p[2] > 42) return;
  const c = HUD2.c;
  const scale = clamp(12 / p[2] + 0.55, 0.6, 1.15);
  c.save();
  /* Длинную реплику ужимаем по размеру шрифта, а не обрезаем рамкой: раньше
     всё, что не влезало в 250 пикселей, просто выезжало за пузырь. */
  let f = Math.round(13 * scale);
  c.font = '700 ' + f + 'px "Trebuchet MS",sans-serif';
  let tw = c.measureText(text).width;
  if (tw + 16 > 250) {
    f = Math.max(9, Math.floor(f * 250 / (tw + 16)));
    c.font = '700 ' + f + 'px "Trebuchet MS",sans-serif';
    tw = c.measureText(text).width;
  }
  const w = Math.min(250, tw + 16);
  const h = 22 * scale;
  c.globalAlpha = clamp((42 - p[2]) / 12, 0, 1);
  c.fillStyle = 'rgba(12,7,24,.86)';
  c.strokeStyle = color || 'rgba(255,45,149,.7)'; c.lineWidth = 2;
  roundRect(0, c, p[0] - w / 2, p[1] - h, w, h, 5); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(p[0] - 4, p[1]); c.lineTo(p[0] + 4, p[1]); c.lineTo(p[0], p[1] + 7 * scale); c.closePath(); c.fill();
  c.fillStyle = '#e9dcff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, p[0], p[1] - h / 2);
  c.restore();
}
export function label3(x, y, z, text, color, size) {
  const p = project(x, y, z);
  if (!p || p[2] > 70) return;
  const c = HUD2.c;
  c.save();
  c.globalAlpha = clamp((70 - p[2]) / 20, 0, 1);
  c.font = '900 ' + (size || 12) + 'px "Trebuchet MS",sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 3; c.strokeStyle = 'rgba(8,4,18,.8)';
  c.strokeText(text, p[0], p[1]); c.fillStyle = color || '#ffd23f';
  c.fillText(text, p[0], p[1]);
  c.restore();
}
