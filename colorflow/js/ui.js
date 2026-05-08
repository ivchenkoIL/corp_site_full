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
      this.setColor(this.recent[0] || '#6366f1');
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
        if (confirm('Очистить холст?')) this.engine.clear();
      });
      $('#btn-theme').addEventListener('click', () => this.cycleTheme());
      $('#btn-export').addEventListener('click', () => this.exportPNG());
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
