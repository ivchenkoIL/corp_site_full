// Storage helpers — small JSON via localStorage, big stuff (layer bitmaps)
// via IndexedDB. Scene auto-save is debounced so it doesn't compete with
// drawing performance.

(function () {
  'use strict';

  const LS_PREFIX = 'colorflow:';

  const Storage = {
    // ---------------- localStorage (small JSON) ----------------
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); }
      catch { /* quota / disabled — ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem(LS_PREFIX + key); } catch { /* noop */ }
    },

    // ---------------- IndexedDB (scene snapshots) ----------------
    _dbPromise: null,
    _openDB() {
      if (!('indexedDB' in window)) return Promise.reject(new Error('no idb'));
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('colorflow', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('scene')) db.createObjectStore('scene');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._dbPromise;
    },

    async _putScene(snapshot) {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('scene', 'readwrite');
        tx.objectStore('scene').put(snapshot, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async _getScene() {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('scene', 'readonly');
        const r = tx.objectStore('scene').get('current');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },

    async clearScene() {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('scene', 'readwrite');
        tx.objectStore('scene').delete('current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    // Serialize layers: PNG Blob per layer (compressed; empty layers are tiny).
    async _serializeScene(engine) {
      const layers = engine.getLayers();
      const ser = await Promise.all(layers.map((l) => new Promise((resolve) => {
        l.canvas.toBlob((blob) => {
          resolve({
            id: l.id,
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode,
            blob, // null possible if toBlob fails — handled in restore.
          });
        }, 'image/png');
      })));
      return {
        version: 1,
        savedAt: Date.now(),
        activeIdx: engine.activeLayerIdx,
        scale: engine.scale,
        tx: engine.tx,
        ty: engine.ty,
        layers: ser,
      };
    },

    // Restore a saved scene into a freshly created engine. Returns true on success.
    async loadScene(engine) {
      try {
        const data = await this._getScene();
        if (!data || !Array.isArray(data.layers) || !data.layers.length) return false;
        // Replace engine.layers with restored ones.
        const restored = await Promise.all(data.layers.map((rec) => loadLayerFromBlob(engine, rec)));
        if (restored.some((l) => !l)) return false;
        engine.layers = restored;
        engine.activeLayerIdx = Math.min(data.activeIdx ?? 0, restored.length - 1);
        // Restored history is fresh — old undo stack is invalidated.
        engine.history = [];
        engine.future = [];
        // Drop any thumbnail cache from the previous scene.
        engine._thumbCache?.clear?.();
        engine.scale = data.scale || 1;
        engine.tx = data.tx || 0;
        engine.ty = data.ty || 0;
        engine._applyTransform?.();
        engine._rebuildCaches();
        engine._renderFull();
        engine.emit('change');
        return true;
      } catch (err) {
        console.warn('loadScene failed', err);
        return false;
      }
    },

    // Wire engine events → debounced auto-save.
    bindAutoSave(engine, ms = 1500) {
      let timer = 0;
      let askedToPersist = false;
      const flush = async () => {
        try {
          const snap = await this._serializeScene(engine);
          await this._putScene(snap);
          // After the first successful save, ask the browser to keep our
          // IndexedDB durable — protects user work from quota eviction.
          if (!askedToPersist && navigator.storage?.persist) {
            askedToPersist = true;
            try {
              const persisted = await navigator.storage.persisted();
              if (!persisted) await navigator.storage.persist();
            } catch { /* ignore — best-effort */ }
          }
        } catch (err) { console.warn('autosave failed', err); }
      };
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(flush, ms);
      };
      engine.on('change', schedule);
      engine.on('stroke-commit', schedule);
      // Also save when the tab is hidden/closed for a final flush.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') schedule();
      });
    },
  };

  async function loadLayerFromBlob(engine, rec) {
    if (!rec || !rec.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      // Build a fresh layer that mirrors the engine's Layer shape. We use the
      // 'lr_' prefix so restored ids never collide with future addLayer() ids
      // (which use 'l_${seq}' from the engine's private counter).
      const c = document.createElement('canvas');
      c.width = engine.canvas.width;
      c.height = engine.canvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return {
        id: 'lr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        name: rec.name,
        visible: !!rec.visible,
        opacity: typeof rec.opacity === 'number' ? rec.opacity : 1,
        blendMode: rec.blendMode || 'source-over',
        canvas: c,
        ctx,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.CFStorage = Storage;
})();
