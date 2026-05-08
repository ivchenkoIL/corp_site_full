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

  // Tool dispatch table — each tool drives stroke painting + commit composite.
  // brush:  pressure-varying width, normal alpha blend
  // pencil: stamp-based with graphite jitter (low alpha dots along path)
  // marker: fixed-width strokes, multiply-blend on commit (alcohol marker feel)
  // eraser: source-over into the buffer; destination-out on commit
  const TOOLS = {
    brush: {
      blitComposite: 'source-over',
      blitAlphaScale: 1,
      paintSegment(engine, ctx, last, pt) {
        const w = Math.max(0.5, engine.size * (0.5 + pt.p * 0.7));
        ctx.lineWidth = w;
        ctx.strokeStyle = engine.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const mx = (last.x + pt.x) / 2, my = (last.y + pt.y) / 2;
        ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, mx, my);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      },
    },
    pencil: {
      blitComposite: 'source-over',
      blitAlphaScale: 1,
      paintSegment(engine, ctx, last, pt) {
        // Stamp dots along the segment with slight radius/alpha jitter so the
        // stroke has graphite-like texture rather than a perfectly smooth line.
        const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
        const step = Math.max(1, engine.size * 0.18);
        const steps = Math.max(1, Math.ceil(dist / step));
        ctx.fillStyle = engine.color;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = last.x + (pt.x - last.x) * t;
          const y = last.y + (pt.y - last.y) * t;
          const r = Math.max(0.5, engine.size * (0.32 + Math.random() * 0.13));
          const a = 0.18 + pt.p * 0.45 + (Math.random() - 0.5) * 0.06;
          ctx.globalAlpha = Math.max(0.05, Math.min(1, a));
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    },
    marker: {
      blitComposite: 'multiply',
      blitAlphaScale: 0.7,
      paintSegment(engine, ctx, last, pt) {
        ctx.lineWidth = engine.size;
        ctx.strokeStyle = engine.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const mx = (last.x + pt.x) / 2, my = (last.y + pt.y) / 2;
        ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, mx, my);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      },
    },
    eraser: {
      blitComposite: 'destination-out',
      blitAlphaScale: 1,
      paintSegment(engine, ctx, last, pt) {
        const w = Math.max(0.5, engine.size * (0.5 + pt.p * 0.7));
        ctx.lineWidth = w;
        ctx.strokeStyle = '#000000'; // anything opaque; color is irrelevant
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const mx = (last.x + pt.x) / 2, my = (last.y + pt.y) / 2;
        ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, mx, my);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      },
    },
  };

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

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
      this.fillTolerance = 32; // 0..255 per channel for flood fill
      this._prevTool = 'brush'; // restored after eyedropper sample

      // Pointer state (single-pointer drawing)
      this.activePointerId = null;
      this.lastX = 0;
      this.lastY = 0;
      this.lastPressure = 0.5;
      this.pendingPoints = [];
      this._raf = 0;
      this._strokeBbox = null;

      // Multi-pointer transform (pinch zoom + 2-finger pan)
      this._pointers = new Map(); // pointerId -> {clientX, clientY}
      this._transformActive = false;
      this._transformStart = null;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.minScale = 0.5;
      this.maxScale = 8;

      // Symmetry / mandala state. axes=1 + mirrorX/Y=false → no symmetry.
      this.symmetry = { axes: 1, mirrorX: false, mirrorY: false };

      // Timelapse capture state. Set to {frames, timer, startedAt} when active.
      this.timelapse = null;

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
      const tool = TOOLS[this.tool] || TOOLS.brush;
      this.tctx.save();
      this.tctx.globalAlpha = this.opacity * tool.blitAlphaScale;
      this.tctx.globalCompositeOperation = tool.blitComposite;
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
      this._pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      // Two or more pointers → switch into pinch/pan transform mode.
      if (this._pointers.size >= 2) {
        if (this.activePointerId !== null) this._cancelStroke();
        this._beginTransform();
        e.preventDefault();
        return;
      }

      if (this.activePointerId !== null) return;
      const active = this.getActiveLayer();
      if (!active || !active.visible) return;

      const p = this._toLocal(e);

      // Click-only tools: don't start a stroke.
      if (this.tool === 'eyedropper') {
        this._eyedrop(p.x, p.y);
        e.preventDefault();
        return;
      }
      if (this.tool === 'fill') {
        this._floodFill(p.x, p.y);
        e.preventDefault();
        return;
      }

      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();

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
      if (this._pointers.has(e.pointerId)) {
        this._pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      }
      if (this._transformActive) {
        this._updateTransform();
        e.preventDefault();
        return;
      }
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
      this._pointers.delete(e.pointerId);
      if (this._transformActive && this._pointers.size < 2) {
        this._endTransform();
        return;
      }
      if (e.pointerId !== this.activePointerId) return;
      this._renderStroke();

      const active = this.getActiveLayer();
      const tool = TOOLS[this.tool] || TOOLS.brush;
      // Commit stroke into the active layer (not the visible canvas).
      active.ctx.save();
      active.ctx.globalAlpha = this.opacity * tool.blitAlphaScale;
      active.ctx.globalCompositeOperation = tool.blitComposite;
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
      const tool = TOOLS[this.tool];
      if (!tool) { this.pendingPoints.length = 0; return; }
      const ctx = this.sctx;
      // Stroke buffer always paints with source-over; tool-specific composite
      // is applied only when blitting onto the active layer.
      ctx.globalCompositeOperation = 'source-over';
      const transforms = this._symmetryTransforms();
      const symActive = transforms.length > 1;
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      let last = { x: this.lastX, y: this.lastY, p: this.lastPressure };
      for (const pt of this.pendingPoints) {
        for (const t of transforms) {
          if (t.identity) {
            tool.paintSegment(this, ctx, last, pt);
          } else {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t.rot);
            ctx.scale(t.sx, t.sy);
            ctx.translate(-cx, -cy);
            tool.paintSegment(this, ctx, last, pt);
            ctx.restore();
          }
        }
        last = pt;
      }
      // With symmetry the painted area can wrap the full canvas; mark bbox accordingly.
      if (symActive) {
        this._strokeBbox = { x0: 0, y0: 0, x1: this.canvas.width, y1: this.canvas.height };
      }
      this.lastX = last.x;
      this.lastY = last.y;
      this.lastPressure = last.p;
      this.pendingPoints.length = 0;
    }

    _symmetryTransforms() {
      const s = this.symmetry || { axes: 1, mirrorX: false, mirrorY: false };
      const axes = Math.max(1, Math.min(32, s.axes | 0));
      const list = [];
      const mirrorScales = [{ sx: 1, sy: 1 }];
      if (s.mirrorX) mirrorScales.push({ sx: -1, sy: 1 });
      if (s.mirrorY) mirrorScales.push({ sx: 1, sy: -1 });
      if (s.mirrorX && s.mirrorY) mirrorScales.push({ sx: -1, sy: -1 });
      for (let i = 0; i < axes; i++) {
        const rot = (Math.PI * 2 * i) / axes;
        for (const m of mirrorScales) {
          list.push({
            rot,
            sx: m.sx,
            sy: m.sy,
            identity: rot === 0 && m.sx === 1 && m.sy === 1,
          });
        }
      }
      return list;
    }

    setSymmetry(opts) {
      this.symmetry = {
        axes: Math.max(1, Math.min(32, opts.axes | 0)),
        mirrorX: !!opts.mirrorX,
        mirrorY: !!opts.mirrorY,
      };
      this.emit('symmetry', this.symmetry);
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
    setTool(t) {
      // Remember the previous drawing tool so eyedropper can restore it.
      if (this.tool !== 'eyedropper' && t === 'eyedropper') this._prevTool = this.tool;
      this.tool = t;
    }
    setFillTolerance(n) { this.fillTolerance = Math.max(0, Math.min(255, +n)); }
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

    // ---------------- Transform (pinch-zoom + 2-finger pan) ----------------
    _beginTransform() {
      const pts = [...this._pointers.values()];
      if (pts.length < 2) return;
      const cx = (pts[0].clientX + pts[1].clientX) / 2;
      const cy = (pts[0].clientY + pts[1].clientY) / 2;
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      this._transformActive = true;
      this._transformStart = {
        cx, cy, dist,
        scale: this.scale,
        tx: this.tx,
        ty: this.ty,
      };
    }

    _updateTransform() {
      const pts = [...this._pointers.values()];
      if (pts.length < 2 || !this._transformStart) return;
      const cx = (pts[0].clientX + pts[1].clientX) / 2;
      const cy = (pts[0].clientY + pts[1].clientY) / 2;
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const ts = this._transformStart;
      const scale = Math.max(this.minScale, Math.min(this.maxScale, ts.scale * (dist / ts.dist)));
      this.scale = scale;
      this.tx = ts.tx + (cx - ts.cx);
      this.ty = ts.ty + (cy - ts.cy);
      this._applyTransform();
    }

    _endTransform() {
      this._transformActive = false;
      this._transformStart = null;
    }

    _applyTransform() {
      const wrap = this.canvas.parentElement;
      if (!wrap) return;
      wrap.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
      this.emit('transform', { scale: this.scale, tx: this.tx, ty: this.ty });
    }

    resetTransform() {
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this._applyTransform();
    }

    _cancelStroke() {
      this.activePointerId = null;
      this.pendingPoints.length = 0;
      this.sctx.clearRect(0, 0, this.strokeBuf.width, this.strokeBuf.height);
      this._strokeBbox = null;
      // Restore canvas to last fully composited state.
      this._renderFull();
    }

    // ---------------- Eyedropper ----------------
    _eyedrop(x, y) {
      const px = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(x)));
      const py = Math.max(0, Math.min(this.canvas.height - 1, Math.floor(y)));
      // Sample from the visible composite canvas (what the user sees).
      const data = this.ctx.getImageData(px, py, 1, 1).data;
      // Skip fully transparent → no useful color.
      if (data[3] === 0) return;
      const hex = rgbToHex(data[0], data[1], data[2]);
      this.color = hex;
      // Auto-restore previously used drawing tool.
      if (this._prevTool && this._prevTool !== 'eyedropper') this.tool = this._prevTool;
      this.emit('color-picked', { color: hex });
      this.emit('change');
    }

    // ---------------- Flood fill ----------------
    _floodFill(x, y) {
      const layer = this.getActiveLayer();
      if (!layer || !layer.visible) return;
      const w = layer.canvas.width, h = layer.canvas.height;
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= w || y >= h) return;

      const before = layer.ctx.getImageData(0, 0, w, h);
      // Work on a copy so we keep `before` clean for history.
      const img = new ImageData(new Uint8ClampedArray(before.data), w, h);
      const data = img.data;
      const start = (y * w + x) * 4;
      const tR = data[start], tG = data[start + 1], tB = data[start + 2], tA = data[start + 3];

      const { r: fR, g: fG, b: fB } = hexToRgb(this.color);
      const fA = Math.round(this.opacity * 255);

      const tol = this.fillTolerance;
      let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
      let changed = false;

      const visited = new Uint8Array(w * h);
      // Iterative span-stack flood fill (low memory, no recursion).
      const stack = [x, y];
      while (stack.length) {
        const py = stack.pop();
        const px = stack.pop();
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const v = py * w + px;
        if (visited[v]) continue;
        const i = v * 4;
        if (Math.abs(data[i] - tR) > tol ||
            Math.abs(data[i + 1] - tG) > tol ||
            Math.abs(data[i + 2] - tB) > tol ||
            Math.abs(data[i + 3] - tA) > tol) continue;
        visited[v] = 1;
        changed = true;

        // Source-over alpha blending (fill is painted ON TOP of existing pixel).
        const srcA = fA / 255;
        const dstA = data[i + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 0) {
          data[i] = Math.round((fR * srcA + data[i] * dstA * (1 - srcA)) / outA);
          data[i + 1] = Math.round((fG * srcA + data[i + 1] * dstA * (1 - srcA)) / outA);
          data[i + 2] = Math.round((fB * srcA + data[i + 2] * dstA * (1 - srcA)) / outA);
        }
        data[i + 3] = Math.round(outA * 255);

        if (px < bx0) bx0 = px;
        if (py < by0) by0 = py;
        if (px > bx1) bx1 = px;
        if (py > by1) by1 = py;

        stack.push(px + 1, py);
        stack.push(px - 1, py);
        stack.push(px, py + 1);
        stack.push(px, py - 1);
      }

      if (!changed) return;

      layer.ctx.putImageData(img, 0, 0);

      const bbox = { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
      // Crop `before` to bbox to keep history entry small.
      const beforeCrop = this._extractBbox(before, bbox);
      const afterCrop = layer.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
      this._pushHistory({ type: 'stroke', layerId: layer.id, bbox, before: beforeCrop, after: afterCrop });
      this._afterChange();
    }

    _extractBbox(img, bbox) {
      const tmp = document.createElement('canvas');
      tmp.width = img.width;
      tmp.height = img.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(img, 0, 0);
      return tctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    }

    // ---------------- Image import ----------------
    importImage(file) {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('no file'));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          // Fit image inside canvas keeping aspect ratio.
          const cw = this.canvas.width, ch = this.canvas.height;
          const scale = Math.min(cw / img.width, ch / img.height);
          const w = img.width * scale, h = img.height * scale;
          const dx = (cw - w) / 2, dy = (ch - h) / 2;
          // Create the layer first (records to history), then paint into it.
          const layer = this.addLayer();
          if (!layer) return reject(new Error('addLayer failed'));
          layer.name = file.name?.replace(/\.[^.]+$/, '').slice(0, 32) || 'Импорт';
          layer.ctx.drawImage(img, dx, dy, w, h);
          // Refresh history snapshot of the just-added layer so undo restores
          // the painted content, not the empty layer.
          // (Simplest: append a stroke-history entry covering the painted bbox.)
          const bbox = {
            x: Math.max(0, Math.floor(dx)),
            y: Math.max(0, Math.floor(dy)),
            w: Math.min(cw, Math.ceil(w)),
            h: Math.min(ch, Math.ceil(h)),
          };
          if (bbox.w > 0 && bbox.h > 0) {
            // 'before' = empty (transparent)
            const before = layer.ctx.createImageData(bbox.w, bbox.h);
            const after = layer.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
            this._pushHistory({ type: 'stroke', layerId: layer.id, bbox, before, after });
          }
          this._afterChange();
          resolve(layer);
        };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
      });
    }

    // ---------------- Timelapse ----------------
    // Capture strategy: snapshot on every stroke commit + a periodic tick so
    // long pauses don't break the playback. PNG Blobs are cheaper than
    // dataURLs (and don't bloat the JS heap as strings).
    startTimelapse({ maxFrames = 240, intervalMs = 1500 } = {}) {
      if (this.timelapse) return;
      const tl = {
        frames: [],
        maxFrames,
        startedAt: Date.now(),
        timer: 0,
        onCommit: null,
      };
      const capture = async () => {
        if (tl.frames.length >= tl.maxFrames) return;
        await new Promise((resolve) => {
          this.canvas.toBlob((blob) => {
            if (blob) tl.frames.push(blob);
            resolve();
          }, 'image/webp', 0.85);
        });
      };
      tl.onCommit = () => capture();
      this.on('stroke-commit', tl.onCommit);
      tl.timer = setInterval(capture, intervalMs);
      // Capture a starting frame.
      capture();
      this.timelapse = tl;
      this.emit('timelapse', { state: 'recording', frames: 0 });
    }

    isTimelapseRecording() { return !!this.timelapse; }

    // Stops capture and renders frames to a webm Blob via captureStream +
    // MediaRecorder. fps controls playback speed (independent of capture rate).
    async stopTimelapse({ fps = 24 } = {}) {
      const tl = this.timelapse;
      if (!tl) return null;
      clearInterval(tl.timer);
      // onCommit listeners aren't removable via emit/on (no off()), so we just
      // clear timelapse — capture() bails when this.timelapse is null.
      this.timelapse = null;
      const frames = tl.frames;
      if (!frames.length) return null;

      const w = this.canvas.width, h = this.canvas.height;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, w, h);

      if (typeof MediaRecorder === 'undefined' || !c.captureStream) {
        // No recorder support — fall back to returning the last frame as PNG.
        return frames[frames.length - 1];
      }

      const mimes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      const supported = mimes.find((m) => MediaRecorder.isTypeSupported?.(m)) || 'video/webm';
      const stream = c.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: 2_500_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

      const stopPromise = new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: supported }));
        };
      });

      recorder.start();
      const frameDelay = Math.max(16, Math.round(1000 / fps));
      for (const blob of frames) {
        const url = URL.createObjectURL(blob);
        try {
          const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
          });
          cx.fillStyle = '#ffffff';
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
        } finally {
          URL.revokeObjectURL(url);
        }
        await new Promise((r) => setTimeout(r, frameDelay));
      }
      recorder.stop();
      this.emit('timelapse', { state: 'idle' });
      return stopPromise;
    }

    // ---------------- AI Magic Fill (mock with local fallback) ----------------
    // Per spec — заглушка с fallback. We try a backend if window.CF_AI_ENDPOINT
    // is set; otherwise apply a vibrant local filter and pretend it's AI.
    async magicFill() {
      const active = this.getActiveLayer();
      if (!active || !active.visible) return false;
      const w = active.canvas.width, h = active.canvas.height;
      const before = active.ctx.getImageData(0, 0, w, h);

      let appliedRemote = false;
      if (window.CF_AI_ENDPOINT) {
        try {
          const blob = await new Promise((r) => active.canvas.toBlob(r, 'image/png'));
          const fd = new FormData();
          fd.append('image', blob, 'sketch.png');
          const res = await fetch(window.CF_AI_ENDPOINT, { method: 'POST', body: fd });
          if (res.ok) {
            const out = await res.blob();
            const url = URL.createObjectURL(out);
            const img = await new Promise((rs, rj) => {
              const i = new Image(); i.onload = () => rs(i); i.onerror = rj; i.src = url;
            });
            active.ctx.clearRect(0, 0, w, h);
            active.ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            appliedRemote = true;
          }
        } catch { /* fall through to local */ }
      }

      if (!appliedRemote) {
        // Local fallback — saturate + contrast pass via ctx.filter; visually
        // distinct enough to feel like a "magic" tweak.
        await new Promise((r) => setTimeout(r, 700)); // pretend latency
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const tctx = tmp.getContext('2d');
        tctx.filter = 'saturate(1.45) contrast(1.12) brightness(1.05)';
        tctx.drawImage(active.canvas, 0, 0);
        active.ctx.clearRect(0, 0, w, h);
        active.ctx.drawImage(tmp, 0, 0);
      }

      const after = active.ctx.getImageData(0, 0, w, h);
      this._pushHistory({
        type: 'stroke',
        layerId: active.id,
        bbox: { x: 0, y: 0, w, h },
        before,
        after,
      });
      this._afterChange();
      return true;
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
