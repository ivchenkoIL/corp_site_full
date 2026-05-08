// Storage helpers — localStorage + IndexedDB stub for later.
// In Step 1 we only persist last-used colors and theme.
(function () {
  'use strict';

  const LS_PREFIX = 'colorflow:';

  const Storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch {
        /* quota / disabled — ignore */
      }
    },
    remove(key) {
      try { localStorage.removeItem(LS_PREFIX + key); } catch { /* noop */ }
    },
  };

  window.CFStorage = Storage;
})();
