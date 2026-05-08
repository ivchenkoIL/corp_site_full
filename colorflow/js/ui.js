// UI wiring — palette, sliders, theme toggle, export.

(function () {
  'use strict';

  const PRESETS = [
    '#000000', '#ffffff', '#6366f1', '#8b5cf6', '#ec4899',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#a855f7', '#f43f5e', '#78350f', '#9ca3af',
  ];

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function isHex(v) { return /^#([0-9a-fA-F]{6})$/.test(v); }

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

      this.renderPalette();
      this.bindTools();
      this.bindSliders();
      this.bindTopbar();
      this.bindHexInput();
      this.bindLayers();
      this.setColor(this.recent[0] || '#6366f1');

      // Re-render layer panel + undo/redo state when engine state changes.
      engine.on('change', () => {
        this.renderLayers();
        this.updateUndoRedo();
      });
      engine.on('stroke-commit', () => {
        // Just refresh thumbnails of affected layer + update history buttons.
        this.renderLayers();
        this.updateUndoRedo();
      });
      this.renderLayers();
      this.updateUndoRedo();
    },

    renderPalette() {
      const root = $('#palette');
      root.innerHTML = '';
      // recent first
      const all = [...this.recent, ...PRESETS.filter(c => !this.recent.includes(c))];
      all.slice(0, 24).forEach((c) => {
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

    markActiveSwatch() {
      $$('.swatch', $('#palette')).forEach((el) => {
        el.classList.toggle('active', el.dataset.color?.toLowerCase() === this.engine.color.toLowerCase());
      });
    },

    bindTools() {
      $$('.tool').forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('.tool').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.engine.setTool(btn.dataset.tool);
          if (navigator.vibrate) navigator.vibrate(4);
        });
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
      $('#btn-export').addEventListener('click', () => this.exportPNG());
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

    setColor(c) {
      if (!isHex(c)) return;
      this.engine.setColor(c);
      $('#hex').value = c;
      $('#current-swatch').style.background = c;

      // Update recent (max 10).
      this.recent = [c, ...this.recent.filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 10);
      window.CFStorage.set('recent', this.recent);
      this.renderPalette();
      // Auto-switch back to brush if eraser was active.
      if (this.engine.tool === 'eraser') {
        const brushBtn = document.querySelector('.tool[data-tool="brush"]');
        brushBtn?.click();
      }
    },

    cycleTheme() {
      const order = ['auto', 'light', 'dark'];
      const i = order.indexOf(this.theme);
      this.theme = order[(i + 1) % order.length];
      document.body.dataset.theme = this.theme;
      window.CFStorage.set('theme', this.theme);
    },

    exportPNG() {
      const url = this.engine.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `colorflow-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  };

  window.CFUI = UI;
})();
