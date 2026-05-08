// ColorFlow — entry point.

(function () {
  'use strict';

  function start() {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl || window.colorflow) return;

    const engine = new window.CFCanvas(canvasEl);
    window.CFUI.init(engine);
    window.colorflow = { engine, ui: window.CFUI };

    // Block double-tap zoom on iOS.
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 350) e.preventDefault();
      lastTouch = now;
    }, { passive: false });

    // Block iOS Safari pinch-zoom on the page (canvas pinch handled in Step 3).
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // Cmd/Ctrl+Z = undo, +Shift = redo.
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) engine.redo(); else engine.undo();
      } else if (k === 'y') {
        e.preventDefault();
        engine.redo();
      }
    });

    registerServiceWorker();
    bindInstallPrompt();
    bindOnlineIndicator();

    // Restore previously saved scene (best effort, runs after engine is up).
    if (window.CFStorage?.loadScene) {
      window.CFStorage.loadScene(engine).then((restored) => {
        if (restored && navigator.vibrate) navigator.vibrate(6);
      });
    }
    // Persist scene on stroke commit / layer change (debounced inside storage).
    if (window.CFStorage?.bindAutoSave) {
      window.CFStorage.bindAutoSave(engine);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Defer to the load event so SW install doesn't compete with first paint.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('SW register failed', err);
      });
    });
  }

  function bindInstallPrompt() {
    let deferred = null;
    const btn = document.getElementById('btn-install');
    if (!btn) return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      btn.hidden = true;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
    });
    window.addEventListener('appinstalled', () => {
      btn.hidden = true;
      deferred = null;
    });
  }

  function bindOnlineIndicator() {
    const el = document.getElementById('online-status');
    if (!el) return;
    const update = () => {
      el.hidden = navigator.onLine;
      el.textContent = navigator.onLine ? '' : 'Офлайн';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
