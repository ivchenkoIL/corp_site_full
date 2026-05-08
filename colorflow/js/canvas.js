// ColorFlow — canvas engine (Step 2: multi-layer, stroke-bbox history).
// Each layer owns an offscreen canvas. The visible canvas is composited from
// all layers. During an active stroke we cache "below" and "above" composites
// so the per-frame preview only repaints the active layer.
//
// History stores bbox-sized ImageData (before/after) for strokes — gives 50+
// undo steps without the 4.6 MB-per-step memory cost of full snapshots.

(function () {
  'use strict';

  const CANVAS_SIZE = 1080;
  const MAX_HISTORY = 50;
  // Soft memory cap for history. Drops oldest entries until under cap.
  const MAX_HISTORY_BYTES = 80 * 1024 * 1024; // 80 MB

  let layerSeq = 0;

  class Layer {
    constructor(name, w, h) {
      this.id = `l_${++layerSeq}`;
      this.name = name;
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d');
      this.visible = true;
      this.opacity = 1;
      this.blendMode = 'source-over';
    }
  }

  class CanvasEngine {
    constructor(canvasEl) {
      this.canvas = canvasEl;
      this.canvas.width = CANVAS_SIZE;
      this.canvas.height = CANVAS_SIZE;
      this.ctx = canvasEl.getContext('2d', { willReadFrequently: false });

      // Stroke buffer — per-stroke offscreen, cleared on pointerdown.
      this.strokeBuf = document.createElement('canvas');
      this.strokeBuf.width = CANVAS_SIZE;
      this.strokeBuf.height = CANVAS_SIZE;
      this.sctx = this.strokeBuf.getContext('2d');

      // Pre-stroke active layer snapshot (used for preview compositing AND
      // for extracting `before` ImageData on commit).
      this.layerBefore = document.createElement('canvas');
      this.layerBefore.width = CANVAS_SIZE;
      this.layerBefore.height = CANVAS_SIZE;
      this.lbctx = this.layerBefore.getContext('2d');

      // Composite caches: layers below / above the active one. Rebuilt only
      // when layers change, not per stroke frame.
      this.belowCache = document.createElement('canvas');
      this.belowCache.width = CANVAS_SIZE;
      this.belowCache.height = CANVAS_SIZE;
      this.bcctx = this.belowCache.getContext('2d');
      this.aboveCache = document.createElement('canvas');
      this.aboveCache.width = CANVAS_SIZE;
      this.aboveCache.height = CANVAS_SIZE;
      this.acctx = this.aboveCache.getContext('2d');

      // Temp canvas for compositing active layer + stroke during preview.
      this.temp = document.createElement('canvas');
      this.temp.width = CANVAS_SIZE;
      this.temp.height = CANVAS_SIZE;
      this.tctx = this.temp.getContext('2d');

      // Layers — index 0 is bottom-most. Default: white background + 1 layer.
      this.layers = [];
      const bg = new Layer('Фон', CANVAS_SIZE, CANVAS_SIZE);
      bg.ctx.fillStyle = '#ffffff';
      bg.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      this.layers.push(bg);
      this.layers.push(new Layer('Слой 1', CANVAS_SIZE, CANVAS_SIZE));
      this.activeLayerIdx = 1;

      // History
      this.history = [];
      this.future = [];

      // Brush state
      this.tool = 'brush';
      this.color = '#6366f1';
      this.size = 14;
      this.opacity = 1;

      // Pointer state
      this.activePointerId = null;
      this.lastX = 0;
      this.lastY = 0;
      this.lastPressure = 0.5;
      this.pendingPoints = [];
      this._raf = 0;
      this._strokeBbox = null;

      // Event listeners
      this._listeners = {};

      this._bind();
      this._setupCursor();
      this._rebuildCaches();
      this._renderFull();
    }

    // ---------------- Events ----------------
    on(ev, cb) { (this._listeners[ev] ||= []).push(cb); }
    emit(ev, payload) { (this._listeners[ev] || []).forEach(cb => cb(payload, this)); }

    // ---------------- Public layer API ----------------
    getLayers() { return this.layers; }
    getActiveLayer() { return this.layers[this.activeLayerIdx]; }
    getActiveLayerId() { return this.layers[this.activeLayerIdx]?.id; }

    addLayer() {
      if (this.activePointerId !== null) return null;
      const name = `Слой ${this.layers.length}`;
      const l = new Layer(name, CANVAS_SIZE, CANVAS_SIZE);
      const idx = this.activeLayerIdx + 1;
      this.layers.splice(idx, 0, l);
      this.activeLayerIdx = idx;
      this._pushHistory({ type: 'layer-add', idx, layerData: this._dehydrate(l) });
      this._afterChange();
      return l;
    }

    deleteLayer(id) {
      if (this.activePointerId !== null) return;
      if (this.layers.length <= 1) return;
      const idx = this.layers.findIndex(l => l.id === id);
      if (idx === -1) return;
      const data = this._dehydrate(this.layers[idx]);
      this.layers.splice(idx, 1);
      const prevActive = this.activeLayerIdx;
      if (this.activeLayerIdx >= this.layers.length) this.activeLayerIdx = this.layers.length - 1;
      else if (this.activeLayerIdx > idx) this.activeLayerIdx--;
      this._pushHistory({ type: 'layer-delete', idx, layerData: data, prevActive });
      this._afterChange();
    }

    setActiveLayer(id) {
      const idx = this.layers.findIndex(l => l.id === id);
      if (idx === -1 || idx === this.activeLayerIdx) return;
      this.activeLayerIdx = idx;
      // Active-layer change is not historied (selection is ephemeral).
      this._rebuildCaches();
      this._renderFull();
      this.emit('change');
    }

    setLayerProp(id, prop, value) {
      const layer = this.layers.find(l => l.id === id);
      if (!layer) return;
      const before = layer[prop];
      if (before === value) return;
      layer[prop] = value;
      this._pushHistory({ type: 'layer-prop', id, prop, before, after: value });
      this._afterChange();
    }

    moveLayer(id, dir) {
      if (this.activePointerId !== null) return;
      const idx = this.layers.findIndex(l => l.id === id);
      if (idx === -1) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= this.layers.length) return;
      const [moved] = this.layers.splice(idx, 1);
      this.layers.splice(newIdx, 0, moved);
      if (this.activeLayerIdx === idx) this.activeLayerIdx = newIdx;
      else if (dir > 0 && this.activeLayerIdx === newIdx) this.activeLayerIdx = idx;
      else if (dir < 0 && this.activeLayerIdx === newIdx) this.activeLayerIdx = idx;
      this._pushHistory({ type: 'layer-reorder', fromIdx: idx, toIdx: newIdx });
      this._afterChange();
    }

    _dehydrate(layer) {
      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        img: layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height),
      };
    }
    _rehydrate(data) {
      const l = new Layer(data.name, CANVAS_SIZE, CANVAS_SIZE);
      l.id = data.id;
      l.visible = data.visible;
      l.opacity = data.opacity;
      l.blendMode = data.blendMode;
      l.ctx.putImageData(data.img, 0, 0);
      return l;
    }

    // ---------------- Compositing ----------------
    _afterChange() {
      this._rebuildCaches();
      this._renderFull();
      this.emit('change');
    }

    // Public redraw that does NOT emit 'change' — safe to call on every input
    // tick (e.g. layer opacity slider drag) without rebuilding UI.
    redraw() {
      this._rebuildCaches();
      this._renderFull();
    }

    _rebuildCaches() {
      const active = this.activeLayerIdx;
      this.bcctx.clearRect(0, 0, this.belowCache.width, this.belowCache.height);
      for (let i = 0; i < active; i++) this._compositeLayerOnto(this.bcctx, this.layers[i]);
      this.acctx.clearRect(0, 0, this.aboveCache.width, this.aboveCache.height);
      for (let i = active + 1; i < this.layers.length; i++) this._compositeLayerOnto(this.acctx, this.layers[i]);
    }

    _compositeLayerOnto(ctx, layer) {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    }

    _renderFull() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (const l of this.layers) this._compositeLayerOnto(this.ctx, l);
    }

    // Live preview during stroke: below + (active+stroke composited via tool
    // semantics, then layer opacity/blend) + above.
    _renderPreview() {
      const active = this.getActiveLayer();
      if (!active) return;

      this.tctx.clearRect(0, 0, this.temp.width, this.temp.height);
      this.tctx.drawImage(this.layerBefore, 0, 0);
      this.tctx.save();
      this.tctx.globalAlpha = this.opacity;
      this.tctx.globalCompositeOperation =
        this.tool === 'eraser' ? 'destination-out' : 'source-over';
      this.tctx.drawImage(this.strokeBuf, 0, 0);
      this.tctx.restore();

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.belowCache, 0, 0);
      if (active.visible) {
        this.ctx.save();
        this.ctx.globalAlpha = active.opacity;
        this.ctx.globalCompositeOperation = active.blendMode;
        this.ctx.drawImage(this.temp, 0, 0);
        this.ctx.restore();
      }
      this.ctx.drawImage(this.aboveCache, 0, 0);
    }

    // ---------------- Pointer / drawing ----------------
    _bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', this._onDown.bind(this));
      c.addEventListener('pointermove', this._onMove.bind(this));
      c.addEventListener('pointerup', this._onUp.bind(this));
      c.addEventListener('pointercancel', this._onUp.bind(this));
      c.addEventListener('pointerleave', this._onUp.bind(this));
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
        p: (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure :
           (e.pointerType === 'mouse' ? 0.5 : Math.max(0.35, e.pressure || 0.5)),
      };
    }

    _onDown(e) {
      if (this.activePointerId !== null) return;
      const active = this.getActiveLayer();
      if (!active || !active.visible) return; // can't draw on hidden layer

      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();

      const p = this._toLocal(e);
      this.lastX = p.x;
      this.lastY = p.y;
      this.lastPressure = p.p;
      this.pendingPoints = [{ x: p.x, y: p.y, p: p.p }];

      this.sctx.clearRect(0, 0, this.strokeBuf.width, this.strokeBuf.height);
      this.lbctx.clearRect(0, 0, this.layerBefore.width, this.layerBefore.height);
      this.lbctx.drawImage(active.canvas, 0, 0);

      const r = this.size;
      this._strokeBbox = { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };

      this._scheduleRender();
      if (navigator.vibrate) navigator.vibrate(2);
    }

    _onMove(e) {
      this._updateCursor(e);
      if (e.pointerId !== this.activePointerId) return;
      e.preventDefault();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const arr = (events && events.length) ? events : [e];
      for (const ev of arr) {
        const p = this._toLocal(ev);
        this.pendingPoints.push({ x: p.x, y: p.y, p: p.p });
        this._extendBbox(p.x, p.y);
      }
      this._scheduleRender();
    }

    _onUp(e) {
      if (e.pointerId !== this.activePointerId) return;
      this._renderStroke();

      const active = this.getActiveLayer();
      // Commit stroke into the active layer (not the visible canvas).
      active.ctx.save();
      active.ctx.globalAlpha = this.opacity;
      active.ctx.globalCompositeOperation =
        this.tool === 'eraser' ? 'destination-out' : 'source-over';
      active.ctx.drawImage(this.strokeBuf, 0, 0);
      active.ctx.restore();

      const bbox = this._snapBbox(this._strokeBbox);
      if (bbox.w > 0 && bbox.h > 0) {
        const before = this.lbctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
        const after = active.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
        this._pushHistory({ type: 'stroke', layerId: active.id, bbox, before, after });
      }

      this.sctx.clearRect(0, 0, this.strokeBuf.width, this.strokeBuf.height);
      this._strokeBbox = null;
      this.activePointerId = null;
      this.pendingPoints.length = 0;

      // Caches are still valid (only the active layer changed).
      this._renderFull();
      this.emit('stroke-commit', { layerId: active.id });
    }

    _extendBbox(x, y) {
      const r = this.size;
      const b = this._strokeBbox;
      if (!b) return;
      if (x - r < b.x0) b.x0 = x - r;
      if (y - r < b.y0) b.y0 = y - r;
      if (x + r > b.x1) b.x1 = x + r;
      if (y + r > b.y1) b.y1 = y + r;
    }

    _snapBbox(b) {
      if (!b) return { x: 0, y: 0, w: 0, h: 0 };
      const W = this.canvas.width, H = this.canvas.height;
      const x = Math.max(0, Math.floor(b.x0));
      const y = Math.max(0, Math.floor(b.y0));
      const x1 = Math.min(W, Math.ceil(b.x1));
      const y1 = Math.min(H, Math.ceil(b.y1));
      return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
    }

    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._renderStroke();
        this._renderPreview();
      });
    }

    _renderStroke() {
      if (!this.pendingPoints.length) return;
      const ctx = this.sctx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = (this.tool === 'eraser') ? '#000000' : this.color;

      for (const pt of this.pendingPoints) {
        const w = Math.max(0.5, this.size * (0.5 + pt.p * 0.7));
        ctx.lineWidth = w;
        ctx.beginPath();
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

    // ---------------- History ----------------
    _pushHistory(entry) {
      this.history.push(entry);
      while (this.history.length > MAX_HISTORY) this.history.shift();
      this._pruneByBytes();
      this.future.length = 0;
    }

    _pruneByBytes() {
      let total = 0;
      for (let i = this.history.length - 1; i >= 0; i--) {
        total += this._entryBytes(this.history[i]);
        if (total > MAX_HISTORY_BYTES) {
          // Drop everything from 0..i inclusive.
          this.history.splice(0, i + 1);
          return;
        }
      }
    }

    _entryBytes(e) {
      switch (e.type) {
        case 'stroke':
        case 'clear':
          return (e.before?.data.byteLength || 0) + (e.after?.data.byteLength || 0);
        case 'layer-add':
        case 'layer-delete':
          return e.layerData?.img?.data.byteLength || 0;
        default:
          return 64;
      }
    }

    canUndo() { return this.history.length > 0; }
    canRedo() { return this.future.length > 0; }

    undo() {
      const entry = this.history.pop();
      if (!entry) return false;
      this._applyEntry(entry, 'undo');
      this.future.push(entry);
      this._afterChange();
      return true;
    }

    redo() {
      const entry = this.future.pop();
      if (!entry) return false;
      this._applyEntry(entry, 'redo');
      this.history.push(entry);
      this._afterChange();
      return true;
    }

    _applyEntry(entry, dir) {
      switch (entry.type) {
        case 'stroke': {
          const layer = this.layers.find(l => l.id === entry.layerId);
          if (!layer) return;
          layer.ctx.putImageData(dir === 'undo' ? entry.before : entry.after, entry.bbox.x, entry.bbox.y);
          break;
        }
        case 'clear': {
          const layer = this.layers.find(l => l.id === entry.layerId);
          if (!layer) return;
          layer.ctx.putImageData(dir === 'undo' ? entry.before : entry.after, 0, 0);
          break;
        }
        case 'layer-add': {
          if (dir === 'undo') {
            this.layers.splice(entry.idx, 1);
            if (this.activeLayerIdx >= this.layers.length) this.activeLayerIdx = this.layers.length - 1;
          } else {
            this.layers.splice(entry.idx, 0, this._rehydrate(entry.layerData));
            this.activeLayerIdx = entry.idx;
          }
          break;
        }
        case 'layer-delete': {
          if (dir === 'undo') {
            this.layers.splice(entry.idx, 0, this._rehydrate(entry.layerData));
            this.activeLayerIdx = entry.prevActive;
          } else {
            this.layers.splice(entry.idx, 1);
            if (this.activeLayerIdx >= this.layers.length) this.activeLayerIdx = this.layers.length - 1;
          }
          break;
        }
        case 'layer-prop': {
          const layer = this.layers.find(l => l.id === entry.id);
          if (!layer) return;
          layer[entry.prop] = dir === 'undo' ? entry.before : entry.after;
          break;
        }
        case 'layer-reorder': {
          const from = dir === 'undo' ? entry.toIdx : entry.fromIdx;
          const to = dir === 'undo' ? entry.fromIdx : entry.toIdx;
          const [moved] = this.layers.splice(from, 1);
          this.layers.splice(to, 0, moved);
          break;
        }
      }
    }

    // ---------------- Misc ----------------
    clear() {
      // Clears the active layer (background layer refills with white).
      if (this.activePointerId !== null) return;
      const active = this.getActiveLayer();
      const before = active.ctx.getImageData(0, 0, active.canvas.width, active.canvas.height);
      active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
      if (this.activeLayerIdx === 0) {
        active.ctx.fillStyle = '#ffffff';
        active.ctx.fillRect(0, 0, active.canvas.width, active.canvas.height);
      }
      const after = active.ctx.getImageData(0, 0, active.canvas.width, active.canvas.height);
      this._pushHistory({ type: 'clear', layerId: active.id, before, after });
      this._afterChange();
    }

    // ---------------- Setters ----------------
    setTool(t) { this.tool = t; }
    setColor(c) { this.color = c; }
    setSize(s) {
      this.size = +s;
      const el = this.cursorEl;
      if (!el || !el.classList.contains('visible')) return;
      const rect = this.canvas.getBoundingClientRect();
      const cssSize = this.size * (rect.width / this.canvas.width);
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
      // Visible canvas is kept up-to-date by _renderFull after every commit.
      return this.canvas.toDataURL(type, quality);
    }

    // Render layer content to a small thumbnail data URL (used by UI panel).
    getLayerThumbnail(id, size = 48) {
      const layer = this.layers.find(l => l.id === id);
      if (!layer) return '';
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const cx = c.getContext('2d');
      // Checkered background so transparent layers are visible.
      cx.fillStyle = '#e8e8f7';
      cx.fillRect(0, 0, size, size);
      cx.fillStyle = '#f4f4ff';
      const t = size / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        if ((x + y) & 1) cx.fillRect(x * t, y * t, t, t);
      }
      cx.drawImage(layer.canvas, 0, 0, size, size);
      return c.toDataURL('image/png');
    }
  }

  window.CFCanvas = CanvasEngine;
})();
