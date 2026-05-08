// ColorFlow — entry point.

(function () {
  'use strict';

  function start() {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;

    const engine = new window.CFCanvas(canvasEl);
    window.CFUI.init(engine);

    // Expose for debugging.
    window.colorflow = { engine, ui: window.CFUI };

    // Block double-tap zoom on iOS.
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 350) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
