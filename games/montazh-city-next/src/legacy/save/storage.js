/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «11. Сохранение», строки 7418–7462.
   ===================================================================== */


/* ------------------------------------------------------------------ */
/* 11. Сохранение                                                       */
/* ------------------------------------------------------------------ */
export const SAVE_KEY = 'montazh_city_3d_save_v1';
export const Save = {
  available: true, lastError: '',
  test() {
    try { localStorage.setItem(SAVE_KEY + '_t', '1'); localStorage.removeItem(SAVE_KEY + '_t'); this.available = true; }
    catch (e) { this.available = false; this.lastError = String(e && e.message || e); }
    return this.available;
  },
  write(data) {
    if (!this.available) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
    catch (e) { this.available = false; this.lastError = String(e && e.message || e); return false; }
  },
  read() {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object' || d.v !== 1) return null;
      return d;
    } catch (e) { this.lastError = String(e && e.message || e); return null; }
  },
  wipe() { try { localStorage.removeItem(SAVE_KEY); return true; } catch (e) { return false; } },
  has() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
};

/* ---------------------------------------------------------------------
   Исполняемая часть раздела. В монолите эти операторы шли вперемешку с
   функциями выше; здесь они в __init(), который main.js зовёт в исходном
   порядке разделов, — так порядок исполнения остаётся прежним.
   --------------------------------------------------------------------- */
export function __init() {
  Save.test();
  /* Настройки хранятся отдельно от сохранения смены: «стереть сохранение»
     не должно сбрасывать выбранное управление и режим эффектов. */
  Save.readOpts = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY + '_opt');
      if (!raw) return null;
      const d = JSON.parse(raw);
      return (d && typeof d === 'object') ? d : null;
    } catch (e) { return null; }
  };
  Save.writeOpts = function (o) {
    try { localStorage.setItem(SAVE_KEY + '_opt', JSON.stringify(o)); return true; } catch (e) { return false; }
  };
}
