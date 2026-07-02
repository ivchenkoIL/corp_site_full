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
    window.addEventListener('load', async () => {
      let reg;
      try {
        reg = await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('SW register failed', err);
        return;
      }

      const showUpdateToastIfWaiting = () => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg);
      };
      // Already-waiting SW (e.g. user reloaded with the toast still pending).
      showUpdateToastIfWaiting();
      // New SW detected → wait for it to become 'installed' alongside the active one.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
      // Reload once the new SW takes control. Guard against the boot reload
      // that fires when the page hasn't been controlled yet.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    });
  }

  function showUpdateToast(reg) {
    const toast = document.getElementById('update-toast');
    if (!toast) return;
    if (toast.dataset.shown === '1') return;
    toast.dataset.shown = '1';
    toast.hidden = false;
    const btn = toast.querySelector('[data-act="update"]');
    const dismiss = toast.querySelector('[data-act="dismiss"]');
    btn?.addEventListener('click', () => {
      btn.disabled = true;
      reg.waiting?.postMessage('skipWaiting');
      // controllerchange listener (above) will reload once the new SW takes over.
    }, { once: true });
    dismiss?.addEventListener('click', () => { toast.hidden = true; }, { once: true });
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
