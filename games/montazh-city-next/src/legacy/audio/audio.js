/* =====================================================================
   СГЕНЕРИРОВАНО tools/split-legacy.mjs из games/montazh-city-3d/index.html.
   Не править: при следующей нарезке файл перезапишется. Пока монолит —
   источник правды, правка вносится туда, потом `npm run split`.

   Раздел «10. Звук: Web Audio, всё синтезируется на лету», строки 7273–7417.
   ===================================================================== */

/* ------------------------------------------------------------------ */
/* 10. Звук: Web Audio, всё синтезируется на лету                       */
/* ------------------------------------------------------------------ */
export const Audio2 = {
  ctx: null, master: null, sfxGain: null, musGain: null,
  ready: false, muted: false, sfxVol: 0.6, musVol: 0.35,
  station: 0, _next: 0, _step: 0, _timer: null,

  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol;
      this.musGain = this.ctx.createGain(); this.musGain.gain.value = this.musVol;
      this.sfxGain.connect(this.master); this.musGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.ready = true;
      this._timer = setInterval(() => this._pump(), 90);
    } catch (e) { this.ready = false; this.ctx = null; }
  },
  resume() { if (this.ready && this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  setSfx(v) { this.sfxVol = v; if (this.ready) this.sfxGain.gain.value = this.muted ? 0 : v; },
  setMus(v) { this.musVol = v; if (this.ready) this.musGain.gain.value = this.muted ? 0 : v; },
  mute(m) { this.muted = m; if (!this.ready) return; this.sfxGain.gain.value = m ? 0 : this.sfxVol; this.musGain.gain.value = m ? 0 : this.musVol; },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ready || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol || 0.2), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t0); o.stop(t0 + dur + 0.03);
  },
  noise(dur, vol, lo, hi, delay) {
    if (!this.ready || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, Math.max(1, n), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = (lo + hi) / 2; f.Q.value = 0.9;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t0); s.stop(t0 + dur + 0.02);
  },

  click()   { this.tone(680, 0.05, 'square', 0.16); },
  select()  { this.tone(420, 0.05, 'square', 0.13); this.tone(640, 0.06, 'square', 0.11, null, 0.05); },
  ok()      { this.tone(560, 0.08, 'triangle', 0.2); this.tone(760, 0.1, 'triangle', 0.18, null, 0.07); this.tone(980, 0.16, 'triangle', 0.16, null, 0.15); },
  nope()    { this.tone(200, 0.16, 'sawtooth', 0.18, 90); },
  spark()   { this.noise(0.16, 0.3, 1800, 6500); this.tone(1400, 0.07, 'square', 0.12, 300); },
  drill()   { this.noise(0.22, 0.16, 300, 1400); this.tone(120, 0.2, 'sawtooth', 0.1, 180); },
  screwdr() { this.noise(0.14, 0.1, 500, 2200); this.tone(320, 0.12, 'square', 0.07, 420); },
  crash()   { this.noise(0.32, 0.34, 90, 900); this.tone(90, 0.3, 'sawtooth', 0.2, 40); },
  thud()    { this.tone(110, 0.14, 'sine', 0.24, 55); this.noise(0.1, 0.12, 100, 500); },
  bark()    { this.tone(300, 0.09, 'sawtooth', 0.18, 180); this.tone(240, 0.1, 'sawtooth', 0.15, 140, 0.1); },
  cash()    { [880, 1180, 1480].forEach((f, i) => this.tone(f, 0.13, 'triangle', 0.17, null, i * 0.07)); },
  lock()    { this.tone(150, 0.06, 'square', 0.22); this.tone(900, 0.05, 'square', 0.12, null, 0.06); },
  bell()    { this.tone(1240, 0.4, 'sine', 0.15, 1180); this.tone(1860, 0.3, 'sine', 0.07, null, 0.02); },
  phone()   { for (let i = 0; i < 3; i++) { this.tone(880, 0.09, 'square', 0.14, null, i * 0.18); this.tone(1180, 0.09, 'square', 0.12, null, i * 0.18 + 0.09); } },
  siren()   { this.tone(700, 0.28, 'sawtooth', 0.12, 1100); this.tone(1100, 0.28, 'sawtooth', 0.12, 700, 0.28); },
  gulp()    { this.tone(220, 0.12, 'sine', 0.16, 120); this.tone(160, 0.14, 'sine', 0.14, 90, 0.12); },
  win()     { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.19, null, i * 0.14)); },
  lose()    { [440, 392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.16, null, i * 0.17)); },
  skid()    { this.noise(0.26, 0.15, 400, 2600); },

  /* --- радио: три станции, всё сочинено процедурно --- */
  stations: [
    { name: 'ЗАКАТ 101.4', bpm: 108, wave: 'sawtooth',
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      lead: [76, 74, 72, 69, 71, 72, 74, 69], drums: 1 },
    { name: 'ПРОМЗОНА FM', bpm: 132, wave: 'square',
      chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]],
      lead: [62, 65, 69, 65, 62, 60, 62, 57], drums: 2 },
    { name: 'ГАРАЖ-ВОЛНА 88.2', bpm: 92, wave: 'triangle',
      chords: [[45, 48, 52], [50, 53, 57], [43, 47, 50], [45, 48, 52]],
      lead: [69, 67, 64, 62, 64, 67, 69, 71], drums: 0 },
    { name: 'ТИШИНА', bpm: 0, chords: [], lead: [], drums: 0 }
  ],
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  _pump() {
    if (!this.ready || this.muted || this.musVol <= 0.001) return;
    const st = this.stations[this.station];
    if (!st || !st.bpm) return;
    if (this.ctx.state !== 'running') return;
    const spb = 60 / st.bpm / 2;              // восьмые
    const now = this.ctx.currentTime;
    if (this._next < now) this._next = now + 0.05;
    while (this._next < now + 0.35) {
      const s = this._step, t = this._next;
      const ch = st.chords[(s >> 3) % st.chords.length];
      if (s % 8 === 0) ch.forEach((n, i) => this._mnote(this.mtof(n), spb * 3.4, st.wave, 0.055 - i * 0.006, t));
      if (s % 2 === 0) this._mnote(this.mtof(ch[0] - 12), spb * 1.5, 'triangle', 0.085, t);
      const ld = st.lead[s % st.lead.length];
      if (s % 2 === 1) this._mnote(this.mtof(ld), spb * 0.8, 'square', 0.032, t);
      if (st.drums) {
        if (s % 4 === 0) this._mkick(t);
        if (st.drums > 1 && s % 4 === 2) this._mhat(t, 0.05);
        if (s % 8 === 4) this._msnare(t);
        if (s % 2 === 1) this._mhat(t, 0.022);
      }
      this._next += spb; this._step++;
    }
  },
  _mnote(f, d, w, v, t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = w; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + d + 0.02);
  },
  _mkick(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + 0.18);
  },
  _mhat(t, v) { this._mnoise(t, 0.035, v, 6000); },
  _msnare(t) { this._mnoise(t, 0.12, 0.08, 1800); },
  _mnoise(t, d, v, freq) {
    const n = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, Math.max(1, n), this.ctx.sampleRate);
    const arr = buf.getChannelData(0);
    for (let i = 0; i < n; i++) arr[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.musGain); s.start(t); s.stop(t + d + 0.02);
  },
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this._step = 0; this._next = 0;
    return this.stations[this.station].name;
  }
};
