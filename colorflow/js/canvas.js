// ColorFlow — canvas engine (Step 1: single layer, brush + eraser, undo stub).
// Uses pointer events + pressure. Renders into an offscreen layer canvas
// and blits onto the visible canvas via requestAnimationFrame.

(function () {
  'use strict';

  const CANVAS_SIZE = 1080; // logical resolution; CSS scales to fit

  class CanvasEngine {
    constructor(canvasEl) {
      this.canvas = canvasEl;
      this.ctx = canvasEl.getContext('2d', { willReadFrequently: false });

      this.canvas.width = CANVAS_SIZE;
      this.canvas.height = CANVAS_SIZE;

      // White base — exported PNGs need a background.
      this.fillBackground('#ffffff');

      // Drawing layer (offscreen) — we draw the current stroke here, then composite.
      this.layer = document.createElement('canvas');
      this.layer.width = CANVAS_SIZE;
      this.layer.height = CANVAS_SIZE;
      this.lctx = this.layer.getContext('2d');

      // Pre-stroke snapshot (regular canvas, not ImageData). drawImage from this
      // is GPU-fast — used every frame instead of putImageData(history[...]).
      this.base = document.createElement('canvas');
      this.base.width = CANVAS_SIZE;
      this.base.height = CANVAS_SIZE;
      this.bctx = this.base.getContext('2d');

      // History (Step 1: simple full-image snapshots, capped).
      this.history = [];
      this.future = [];
      // Image-based snapshots are memory-heavy (~4.6 MB at 1080²); Step 2 will
      // replace this with stroke-based history that meets the ≥50 step target.
      this.maxHistory = 12;
      this.snapshot();

      // Brush state
      this.tool = 'brush';
      this.color = '#6366f1';
      this.size = 14;
      this.opacity = 1;

      // Pointer / stroke state
      this.activePointerId = null;
      this.lastX = 0;
      this.lastY = 0;
      this.lastPressure = 0.5;
      this.pendingPoints = [];
      this._raf = 0;

      this._bind();
      this._setupCursor();
    }

    fillBackground(color) {
      this.ctx.save();
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', this._onDown.bind(this));
      c.addEventListener('pointermove', this._onMove.bind(this));
      c.addEventListener('pointerup', this._onUp.bind(this));
      c.addEventListener('pointercancel', this._onUp.bind(this));
      c.addEventListener('pointerleave', this._onUp.bind(this));
      // Block context menu on long-press.
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _setupCursor() {
      const wrap = this.canvas.parentElement;
      if (!wrap) return;
      const el = document.createElement('div');
      el.className = 'cursor-preview';
      el.setAttribute('aria-hidden', 'true');
      wrap.appendChild(el);
      this.cursorEl = el;

      this.canvas.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'touch') el.classList.add('visible');
      });
      this.canvas.addEventListener('pointerleave', () => {
        el.classList.remove('visible');
      });
    }

    _updateCursor(e) {
      const el = this.cursorEl;
      if (!el) return;
      if (e.pointerType === 'touch') {
        el.classList.remove('visible');
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      // size in CSS px = canvas size * (display ratio).
      const cssSize = this.size * (rect.width / this.canvas.width);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.transform = `translate(${x - cssSize / 2}px, ${y - cssSize / 2}px)`;
      el.style.width = `${cssSize}px`;
      el.style.height = `${cssSize}px`;
    }

    _toLocal(e) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / rect.width;
      const sy = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
        // Pen pressure if available; finger/mouse fall back to 0.5.
        p: (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure :
           (e.pointerType === 'mouse' ? 0.5 : Math.max(0.35, e.pressure || 0.5)),
      };
    }

    _onDown(e) {
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();

      const p = this._toLocal(e);
      this.lastX = p.x;
      this.lastY = p.y;
      this.lastPressure = p.p;
      this.pendingPoints = [{ x: p.x, y: p.y, p: p.p }];

      // Reset offscreen layer for fresh stroke.
      this.lctx.clearRect(0, 0, this.layer.width, this.layer.height);

      // Snapshot pre-stroke canvas into a regular canvas (drawImage source).
      // Avoids ~4.6 MB putImageData copies per preview frame.
      this.bctx.clearRect(0, 0, this.base.width, this.base.height);
      this.bctx.drawImage(this.canvas, 0, 0);

      this._scheduleRender();

      if (navigator.vibrate) navigator.vibrate(2);
    }

    _onMove(e) {
      this._updateCursor(e);
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      // Use coalesced events when available — smoother strokes on mobile.
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (events && events.length) {
        for (const ev of events) {
          const p = this._toLocal(ev);
          this.pendingPoints.push({ x: p.x, y: p.y, p: p.p });
        }
      } else {
        const p = this._toLocal(e);
        this.pendingPoints.push({ x: p.x, y: p.y, p: p.p });
      }
      this._scheduleRender();
    }

    _onUp(e) {
      if (e.pointerId !== this.activePointerId) return;
      // Flush any pending points before commit.
      this._renderStroke();
      // Reset canvas to pre-stroke base, then composite layer once for final commit.
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.base, 0, 0);
      this._blitLayer();
      this.lctx.clearRect(0, 0, this.layer.width, this.layer.height);

      this.activePointerId = null;
      this.pendingPoints.length = 0;
      this.snapshot();
    }

    // Composite the offscreen stroke layer onto the main canvas with
    // tool-specific blending (used both for live preview and final commit).
    _blitLayer() {
      this.ctx.save();
      // Opacity slider drives both brush alpha and eraser strength
      // (destination-out + alpha = partial erase per pass).
      this.ctx.globalAlpha = this.opacity;
      this.ctx.globalCompositeOperation =
        this.tool === 'eraser' ? 'destination-out' : 'source-over';
      this.ctx.drawImage(this.layer, 0, 0);
      this.ctx.restore();
    }

    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._renderStroke();
        this._composite();
      });
    }

    // Draw queued points onto the offscreen layer with smoothing.
    _renderStroke() {
      if (!this.pendingPoints.length) return;
      const ctx = this.lctx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Always paint into the offscreen layer with source-over; eraser
      // semantics are applied only when blitting the layer onto the canvas.
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = (this.tool === 'eraser') ? '#000000' : this.color;

      for (const pt of this.pendingPoints) {
        const w = Math.max(0.5, this.size * (0.5 + pt.p * 0.7));
        ctx.lineWidth = w;
        ctx.beginPath();
        // Smooth via midpoint between previous and current.
        const mx = (this.lastX + pt.x) / 2;
        const my = (this.lastY + pt.y) / 2;
        ctx.moveTo(this.lastX, this.lastY);
        ctx.quadraticCurveTo(this.lastX, this.lastY, mx, my);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        this.lastX = pt.x;
        this.lastY = pt.y;
        this.lastPressure = pt.p;
      }
      this.pendingPoints.length = 0;
    }

    // Composite current image with active stroke layer (preview while drawing).
    _composite() {
      // Avoid double-stacking the layer between frames: reset to the pre-stroke
      // base canvas (GPU drawImage, not putImageData), then blit the layer once.
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.base, 0, 0);
      this._blitLayer();
    }

    // ---------------- History ----------------
    snapshot() {
      try {
        const snap = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(snap);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.future.length = 0;
      } catch (err) {
        console.warn('snapshot failed', err);
      }
    }

    undo() {
      if (this.history.length <= 1) return false;
      this.future.push(this.history.pop());
      const prev = this.history[this.history.length - 1];
      this.ctx.putImageData(prev, 0, 0);
      return true;
    }

    redo() {
      if (!this.future.length) return false;
      const snap = this.future.pop();
      this.history.push(snap);
      this.ctx.putImageData(snap, 0, 0);
      return true;
    }

    clear() {
      this.fillBackground('#ffffff');
      this.snapshot();
    }

    // ---------------- Setters ----------------
    setTool(t) { this.tool = t; }
    setColor(c) { this.color = c; }
    setSize(s) {
      this.size = +s;
      // Resize the cursor ring in place if it's currently visible.
      const el = this.cursorEl;
      if (!el || !el.classList.contains('visible')) return;
      const rect = this.canvas.getBoundingClientRect();
      const cssSize = this.size * (rect.width / this.canvas.width);
      // Preserve current centre by adjusting transform.
      const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      const prevSize = parseFloat(el.style.width) || cssSize;
      if (m) {
        const cx = parseFloat(m[1]) + prevSize / 2;
        const cy = parseFloat(m[2]) + prevSize / 2;
        el.style.transform = `translate(${cx - cssSize / 2}px, ${cy - cssSize / 2}px)`;
      }
      el.style.width = `${cssSize}px`;
      el.style.height = `${cssSize}px`;
    }
    setOpacity(o) { this.opacity = Math.max(0, Math.min(1, +o)); }

    // ---------------- Export ----------------
    toDataURL(type = 'image/png', quality) {
      return this.canvas.toDataURL(type, quality);
    }
  }

  window.CFCanvas = CanvasEngine;
})();
