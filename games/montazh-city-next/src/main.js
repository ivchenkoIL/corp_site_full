/* =====================================================================
   Монтаж-Сити на Babylon.js — точка входа.
   Разметка и стили интерфейса — те же, что у старой игры (их нарезает
   tools/split-legacy.mjs), кадр рисует Babylon, логика — старая.
   ===================================================================== */
import './legacy/style.css';
import './next.css';
import dom from './legacy/dom.html?raw';
import { BabylonBackend } from './engine/babylon/app.js';
import { start } from './game/runtime.js';

document.body.insertAdjacentHTML('afterbegin', dom.replace(/<!--[\s\S]*?-->/, ''));
const q = new URLSearchParams(location.search);
const base = new URL('./assets/', document.baseURI).href;
start(new BabylonBackend(), { base, quality: q.get('q') || 'high' }).catch(e => {
  console.error(e);
  const el = document.getElementById('loading');
  if (el) el.innerHTML = '<div class="bootfail"><b>Не удалось запустить</b>' + (e && e.message ? e.message : e) +
    '<br><br>Нужен браузер с WebGL2 (актуальные Chrome, Edge, Safari 17+, Firefox).</div>';
});
