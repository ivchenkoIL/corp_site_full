// UI wiring — palette, sliders, theme toggle, export.

(function () {
  'use strict';

  const PALETTES = {
    pastel: ['#fce7f3', '#fbcfe8', '#fecaca', '#fed7aa', '#fef3c7', '#d9f99d',
             '#a7f3d0', '#bae6fd', '#c7d2fe', '#e9d5ff', '#fef9c3', '#ffe4e6'],
    neon:   ['#ff00ff', '#00ffff', '#39ff14', '#ff073a', '#fffb00', '#ff5f1f',
             '#bc13fe', '#1f51ff', '#cfff04', '#fe019a', '#04d9ff', '#ffaa00'],
    earth:  ['#3e2723', '#5d4037', '#795548', '#8d6e63', '#a1887f', '#bcaaa4',
             '#6d4c41', '#4e342e', '#33691e', '#827717', '#9e9d24', '#bf360c'],
    mono:   ['#000000', '#1f1f1f', '#3a3a3a', '#555555', '#707070', '#8b8b8b',
             '#a6a6a6', '#c1c1c1', '#dcdcdc', '#f5f5f5', '#ffffff', '#cccccc'],
  };

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function isHex(v) { return /^#([0-9a-fA-F]{6})$/.test(v); }

  // ---- Color conversions ----
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
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(hue2rgb(h + 1 / 3) * 255),
      g: Math.round(hue2rgb(h) * 255),
      b: Math.round(hue2rgb(h - 1 / 3) * 255),
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Inline SVG icons (avoid extra HTTP requests).
  const EYE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const EYE_OFF_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.8-1.9M9.5 5.4A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.6 4.4M6.7 6.7A18 18 0 0 0 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const UP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const DOWN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const TRASH_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const UI = {
    init(engine) {
      this.engine = engine;
      this.recent = window.CFStorage.get('recent', ['#6366f1']);
      this.theme = window.CFStorage.get('theme', 'auto');
      document.body.dataset.theme = this.theme;

      this.activePalette = window.CFStorage.get('palette', 'recent');

      this.bindPaletteTabs();
      this.renderPalette();
      this.bindTools();
      this.bindSliders();
      this.bindTopbar();
      this.bindExportMenu();
      this.bindHexInput();
      this.bindRgbInput();
      this.bindHslSliders();
      this.bindLayers();
      this.bindImport();
      this.bindZoomReset();
      this.bindTolerance();
      this.bindDockCollapse();
      this.setColor(this.recent[0] || '#6366f1');

      engine.on('change', () => {
        this.renderLayers();
        this.updateUndoRedo();
      });
      engine.on('stroke-commit', () => {
        this.renderLayers();
        this.updateUndoRedo();
      });
      // Eyedropper sets engine.color directly; reflect in UI inputs + revert tool.
      engine.on('color-picked', ({ color }) => {
        this.setColor(color, { skipEngine: true });
        const t = engine.tool;
        $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
        this.updateToolOnly();
      });
      this.renderLayers();
      this.updateUndoRedo();
    },

    renderPalette() {
      const root = $('#palette');
      root.innerHTML = '';
      const colors = this.activePalette === 'recent' ? this.recent : PALETTES[this.activePalette] || [];
      colors.slice(0, 24).forEach((c) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'swatch';
        sw.style.background = c;
        sw.dataset.color = c;
        sw.setAttribute('aria-label', `Цвет ${c}`);
        sw.addEventListener('click', () => this.setColor(c));
        root.appendChild(sw);
      });
      this.markActiveSwatch();
    },

    bindPaletteTabs() {
      $$('#palette-tabs button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.palette === this.activePalette);
        btn.addEventListener('click', () => {
          this.activePalette = btn.dataset.palette;
          window.CFStorage.set('palette', this.activePalette);
          $$('#palette-tabs button').forEach(b => b.classList.toggle('active', b === btn));
          this.renderPalette();
        });
      });
    },

    markActiveSwatch() {
      $$('.swatch', $('#palette')).forEach((el) => {
        el.classList.toggle('active', el.dataset.color?.toLowerCase() === this.engine.color.toLowerCase());
      });
    },

    bindTools() {
      $$('.tool[data-tool]').forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('.tool[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.engine.setTool(btn.dataset.tool);
          this.updateToolOnly();
          if (navigator.vibrate) navigator.vibrate(4);
        });
      });
    },

    // Show/hide tool-specific control rows based on the active tool.
    updateToolOnly() {
      const t = this.engine.tool;
      $$('.tool-only').forEach((el) => {
        el.hidden = el.dataset.toolOnly !== t;
      });
    },

    bindSliders() {
      const size = $('#size'), sizeOut = $('#size-out');
      const op = $('#opacity'), opOut = $('#opacity-out');

      size.addEventListener('input', () => {
        sizeOut.textContent = size.value;
        this.engine.setSize(size.value);
      });
      op.addEventListener('input', () => {
        opOut.textContent = op.value;
        this.engine.setOpacity(op.value / 100);
      });

      this.engine.setSize(size.value);
      this.engine.setOpacity(op.value / 100);
    },

    bindTopbar() {
      $('#btn-undo').addEventListener('click', () => this.engine.undo());
      $('#btn-redo').addEventListener('click', () => this.engine.redo());
      $('#btn-clear').addEventListener('click', () => {
        if (confirm('Очистить активный слой?')) this.engine.clear();
      });
      $('#btn-theme').addEventListener('click', () => this.cycleTheme());
      // Export button is wired by bindExportMenu.
    },

    updateUndoRedo() {
      $('#btn-undo').disabled = !this.engine.canUndo();
      $('#btn-redo').disabled = !this.engine.canRedo();
    },

    // ---------------- Layers ----------------
    bindLayers() {
      $('#btn-layer-add').addEventListener('click', () => this.engine.addLayer());

      const lop = $('#layer-opacity'), lopOut = $('#layer-opacity-out');

      lop.addEventListener('pointerdown', () => {
        const a = this.engine.getActiveLayer();
        if (a) this._opacityStart = a.opacity;
      });
      lop.addEventListener('input', () => {
        lopOut.textContent = lop.value;
        const a = this.engine.getActiveLayer();
        if (!a) return;
        // Live mutation + redraw (no history, no UI rebuild).
        a.opacity = lop.value / 100;
        this.engine.redraw();
      });
      lop.addEventListener('change', () => {
        // On release, fold the live drag into a single undoable history entry.
        const a = this.engine.getActiveLayer();
        if (!a || this._opacityStart === undefined) return;
        const after = a.opacity;
        a.opacity = this._opacityStart;
        this.engine.setLayerProp(a.id, 'opacity', after);
        this._opacityStart = undefined;
      });

      $('#layer-blend').addEventListener('change', (e) => {
        const a = this.engine.getActiveLayer();
        if (!a) return;
        this.engine.setLayerProp(a.id, 'blendMode', e.target.value);
      });
    },

    renderLayers() {
      const list = $('#layer-list');
      const layers = this.engine.getLayers();
      const active = this.engine.getActiveLayer();
      list.innerHTML = '';
      layers.forEach((l, idx) => {
        const li = document.createElement('li');
        li.className = 'layer-row' + (l === active ? ' active' : '');
        li.dataset.id = l.id;
        li.innerHTML = `
          <button class="layer-vis ${l.visible ? '' : 'hidden'}" aria-label="Видимость" title="Показать/скрыть">
            ${l.visible ? EYE_SVG : EYE_OFF_SVG}
          </button>
          <span class="layer-thumb" style="background-image:url('${this.engine.getLayerThumbnail(l.id, 48)}')"></span>
          <span class="layer-name">${escapeHtml(l.name)}</span>
          <span class="layer-actions">
            <button data-act="up"   aria-label="Выше"  title="Выше"  ${idx === layers.length - 1 ? 'disabled' : ''}>${UP_SVG}</button>
            <button data-act="down" aria-label="Ниже"  title="Ниже"  ${idx === 0 ? 'disabled' : ''}>${DOWN_SVG}</button>
            <button data-act="del"  aria-label="Удалить" title="Удалить" ${layers.length <= 1 ? 'disabled' : ''}>${TRASH_SVG}</button>
          </span>
        `;
        // Activate on click anywhere except controls.
        li.addEventListener('click', (e) => {
          if (e.target.closest('.layer-vis') || e.target.closest('.layer-actions')) return;
          this.engine.setActiveLayer(l.id);
        });
        li.querySelector('.layer-vis').addEventListener('click', () => {
          this.engine.setLayerProp(l.id, 'visible', !l.visible);
        });
        li.querySelectorAll('.layer-actions button').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = btn.dataset.act;
            if (act === 'up') this.engine.moveLayer(l.id, 1);
            else if (act === 'down') this.engine.moveLayer(l.id, -1);
            else if (act === 'del') {
              if (confirm(`Удалить «${l.name}»?`)) this.engine.deleteLayer(l.id);
            }
          });
        });
        list.appendChild(li);
      });

      // Reflect active layer's opacity & blend in the controls.
      if (active) {
        $('#layer-opacity').value = Math.round(active.opacity * 100);
        $('#layer-opacity-out').textContent = Math.round(active.opacity * 100);
        $('#layer-blend').value = active.blendMode;
      }
    },

    bindHexInput() {
      const hex = $('#hex');
      hex.addEventListener('change', () => {
        let v = hex.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (isHex(v)) this.setColor(v);
        else hex.value = this.engine.color;
      });
    },

    bindRgbInput() {
      const rgb = $('#rgb');
      rgb.addEventListener('change', () => {
        const m = rgb.value.match(/(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/);
        if (!m) return this.syncColorInputs();
        const r = +m[1], g = +m[2], b = +m[3];
        if ([r, g, b].some(v => v < 0 || v > 255)) return this.syncColorInputs();
        this.setColor(rgbToHex(r, g, b));
      });
    },

    bindHslSliders() {
      const ids = ['hsl-h', 'hsl-s', 'hsl-l'];
      const els = ids.map(id => $('#' + id));
      const outs = ids.map(id => $('#' + id + '-out'));
      const apply = () => {
        const [h, s, l] = els.map(e => +e.value);
        outs[0].textContent = h;
        outs[1].textContent = s;
        outs[2].textContent = l;
        const { r, g, b } = hslToRgb(h, s, l);
        this.setColor(rgbToHex(r, g, b));
      };
      els.forEach(el => {
        el.addEventListener('input', apply);
      });
    },

    bindImport() {
      const input = $('#import-file');
      if (!input) return;
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await this.engine.importImage(file);
          if (navigator.vibrate) navigator.vibrate(8);
        } catch (err) {
          alert('Не удалось импортировать изображение: ' + (err?.message || err));
        } finally {
          input.value = '';
        }
      });
    },

    bindZoomReset() {
      const btn = $('#btn-zoom-reset');
      if (!btn) return;
      btn.addEventListener('click', () => this.engine.resetTransform());
      this.engine.on('transform', () => this._refreshZoomLabel());
      this._refreshZoomLabel();
    },

    _refreshZoomLabel() {
      const btn = $('#btn-zoom-reset');
      const s = this.engine.scale || 1;
      if (Math.abs(s - 1) < 0.01 && Math.abs(this.engine.tx) < 1 && Math.abs(this.engine.ty) < 1) {
        btn.hidden = true;
      } else {
        btn.hidden = false;
        btn.textContent = `${Math.round(s * 100)}%`;
      }
    },

    bindTolerance() {
      const t = $('#tolerance'), out = $('#tolerance-out');
      if (!t) return;
      t.addEventListener('input', () => {
        out.textContent = t.value;
        this.engine.setFillTolerance(t.value);
      });
      this.engine.setFillTolerance(t.value);
    },

    bindDockCollapse() {
      const dock = $('#dock');
      const btn = $('#btn-dock-collapse');
      if (!dock || !btn) return;
      const apply = (collapsed) => {
        dock.classList.toggle('collapsed', collapsed);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.title = collapsed ? 'Развернуть панель' : 'Свернуть панель';
      };
      apply(window.CFStorage.get('dockCollapsed', false));
      btn.addEventListener('click', () => {
        const next = !dock.classList.contains('collapsed');
        apply(next);
        window.CFStorage.set('dockCollapsed', next);
        if (navigator.vibrate) navigator.vibrate(4);
      });
    },

    bindExportMenu() {
      const menu = $('.export-menu');
      $$('.export-menu-item').forEach((b) => {
        b.addEventListener('click', () => {
          const fmt = b.dataset.export;
          this.exportImage(fmt);
          menu.removeAttribute('open');
        });
      });
      // Close menu on outside click.
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) menu.removeAttribute('open');
      });
    },

    setColor(c, opts = {}) {
      if (!isHex(c)) return;
      if (!opts.skipEngine) this.engine.setColor(c);
      this.syncColorInputs(c);

      // Update recent (max 10).
      this.recent = [c, ...this.recent.filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 10);
      window.CFStorage.set('recent', this.recent);
      if (this.activePalette === 'recent') this.renderPalette();
      // If user picks a color while eraser was active, swap back to brush.
      if (!opts.skipEngine && this.engine.tool === 'eraser') {
        const brushBtn = document.querySelector('.tool[data-tool="brush"]');
        brushBtn?.click();
      }
    },

    syncColorInputs(c) {
      c = c || this.engine.color;
      const { r, g, b } = hexToRgb(c);
      const hsl = rgbToHsl(r, g, b);
      $('#hex').value = c;
      $('#current-swatch').style.background = c;
      $('#rgb').value = `${r}, ${g}, ${b}`;
      $('#hsl-h').value = hsl.h; $('#hsl-h-out').textContent = hsl.h;
      $('#hsl-s').value = hsl.s; $('#hsl-s-out').textContent = hsl.s;
      $('#hsl-l').value = hsl.l; $('#hsl-l-out').textContent = hsl.l;
      this.markActiveSwatch();
    },

    cycleTheme() {
      const order = ['auto', 'light', 'dark'];
      const i = order.indexOf(this.theme);
      this.theme = order[(i + 1) % order.length];
      document.body.dataset.theme = this.theme;
      window.CFStorage.set('theme', this.theme);
    },

    exportImage(fmt = 'png') {
      const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
      const ext = fmt === 'jpg' ? 'jpg' : 'png';
      const quality = fmt === 'jpg' ? 0.92 : undefined;
      const url = this.engine.toDataURL(mime, quality);
      const a = document.createElement('a');
      a.href = url;
      a.download = `colorflow-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  };

  window.CFUI = UI;
})();
