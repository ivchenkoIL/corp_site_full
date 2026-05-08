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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
