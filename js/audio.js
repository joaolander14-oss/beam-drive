// Som procedural: motor (por tipo/cilindros), turbo, pneus, vento, batidas
export class CarAudio {
  constructor() { this.ctx = null; this.vol = 0.6; this.on = true; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    // ruído
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const noise = () => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    // motor
    this.eo1 = c.createOscillator(); this.eo1.type = 'sawtooth';
    this.eo2 = c.createOscillator(); this.eo2.type = 'square';
    this.eo3 = c.createOscillator(); this.eo3.type = 'triangle';
    this.eg1 = c.createGain(); this.eg2 = c.createGain(); this.eg3 = c.createGain();
    this.ef = c.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.Q.value = 2.5;
    this.ews = c.createWaveShaper(); const cur = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cur[i] = Math.tanh(x * 2.4); } this.ews.curve = cur;
    this.eout = c.createGain(); this.eout.gain.value = 0;
    this.eo1.connect(this.eg1).connect(this.ef); this.eo2.connect(this.eg2).connect(this.ef); this.eo3.connect(this.eg3).connect(this.ef);
    this.ef.connect(this.ews).connect(this.eout).connect(this.master);
    this.en = noise(); this.enf = c.createBiquadFilter(); this.enf.type = 'bandpass'; this.enf.frequency.value = 500; this.eng = c.createGain(); this.eng.gain.value = 0;
    this.en.connect(this.enf).connect(this.eng).connect(this.master);
    [this.eo1, this.eo2, this.eo3].forEach(o => o.start());
    // turbo
    this.to = c.createOscillator(); this.to.type = 'sine'; this.tg = c.createGain(); this.tg.gain.value = 0; this.to.connect(this.tg).connect(this.master); this.to.start();
    // pneu
    this.sn = noise(); this.sf = c.createBiquadFilter(); this.sf.type = 'bandpass'; this.sf.Q.value = 5; this.sf.frequency.value = 1100; this.sg = c.createGain(); this.sg.gain.value = 0;
    this.sn.connect(this.sf).connect(this.sg).connect(this.master);
    // vento / rodagem
    this.wn = noise(); this.wf = c.createBiquadFilter(); this.wf.type = 'lowpass'; this.wf.frequency.value = 600; this.wg = c.createGain(); this.wg.gain.value = 0;
    this.wn.connect(this.wf).connect(this.wg).connect(this.master);
    this.rn = noise(); this.rf = c.createBiquadFilter(); this.rf.type = 'lowpass'; this.rf.frequency.value = 220; this.rg = c.createGain(); this.rg.gain.value = 0;
    this.rn.connect(this.rf).connect(this.rg).connect(this.master);
  }
  setProfile(i) { this.prof = i; }
  tick(hi) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = hi ? 1700 : 1300;
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.035); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.04);
  }
  chime() {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f, d] of [[880, 0], [660, 0.16]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.1, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.3); o.connect(g).connect(this.master); o.start(t + d); o.stop(t + d + 0.35); }
  }
  horn(type, on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!on) { if (this._horn) { const t = c.currentTime; this._horn.g.gain.setTargetAtTime(0, t, 0.03); this._horn.o.forEach(o => o.stop(t + 0.2)); this._horn = null; } return; }
    if (this._horn) return;
    const T = [[400, 500, 'square'], [200, 250, 'square'], [600, 750, 'square'], [140, 175, 'sawtooth'], [440, 554, 'triangle'], [700, 900, 'sawtooth'], [523, 659, 'triangle'], [349, 440, 'sawtooth']][type] || [400, 500, 'square'];
    const g = c.createGain(); g.gain.value = 0.0; g.gain.setTargetAtTime(0.16, c.currentTime, 0.01); g.connect(this.master);
    const o = T.slice(0, 2).map(f => { const os = c.createOscillator(); os.type = T[2]; os.frequency.value = f; os.connect(g); os.start(); return os; });
    if (type === 5) { const l = c.createOscillator(); l.frequency.value = 3; const lg = c.createGain(); lg.gain.value = 200; l.connect(lg); o.forEach(x => lg.connect(x.frequency)); l.start(); o.push(l); }
    this._horn = { g, o };
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  update(s) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, tc = 0.04;
    if (!this.on || s.paused) { this.eout.gain.setTargetAtTime(0, t, 0.05); this.tg.gain.setTargetAtTime(0, t, 0.05); this.sg.gain.setTargetAtTime(0, t, 0.05); this.wg.gain.setTargetAtTime(0, t, 0.05); this.rg.gain.setTargetAtTime(0, t, 0.05); this.eng.gain.setTargetAtTime(0, t, 0.05); return; }
    const rpm = Math.max(0, s.rpm), thr = s.thr, load = 0.25 + 0.75 * thr;
    if (s.ev) {
      const f = 60 + rpm / 60 * 2.2;
      this.eo1.type = 'sine'; this.eo2.type = 'sine'; this.eo3.type = 'triangle';
      this.eo1.frequency.setTargetAtTime(f, t, tc); this.eo2.frequency.setTargetAtTime(f * 2.01, t, tc); this.eo3.frequency.setTargetAtTime(f * 4, t, tc);
      this.eg1.gain.setTargetAtTime(0.5, t, tc); this.eg2.gain.setTargetAtTime(0.25 * (0.3 + thr), t, tc); this.eg3.gain.setTargetAtTime(0.08 * (0.2 + thr), t, tc);
      this.ef.frequency.setTargetAtTime(2500 + rpm * 0.2, t, tc);
      this.eout.gain.setTargetAtTime(0.10 + 0.22 * Math.min(1, rpm / 8000) + 0.05 * thr, t, tc);
      this.eng.gain.setTargetAtTime(0, t, tc);
    } else {
      const f = rpm / 60 * (s.cyl / 2) * (s.rotary ? 1.5 : 1);
      const ff = Math.max(8, f);
      this.eo1.type = 'sawtooth'; this.eo2.type = s.kind === 'diesel' ? 'square' : 'square'; this.eo3.type = 'triangle';
      this.eo1.frequency.setTargetAtTime(ff, t, tc); this.eo2.frequency.setTargetAtTime(ff * 0.5, t, tc); this.eo3.frequency.setTargetAtTime(ff * 2, t, tc);
      this.eg1.gain.setTargetAtTime(0.5, t, tc);
      this.eg2.gain.setTargetAtTime((s.cyl >= 8 ? 0.55 : 0.30) * (s.kind === 'diesel' ? 1.4 : 1), t, tc);
      this.eg3.gain.setTargetAtTime(0.12 + 0.2 * thr, t, tc);
      const PR = [[1, 1, 'sawtooth'], [0.7, 1.5, 'sawtooth'], [1.5, 0.8, 'sawtooth'], [1.9, 1.2, 'square'], [0.9, 1, 'triangle'], [0.45, 1, 'sawtooth'], [1.3, 1.0, 'square'], [1.1, 0.4, 'sine']][this.prof | 0] || [1, 1, 'sawtooth'];
      this.eo1.type = PR[2];
      const cut = (350 + 160 * Math.sqrt(ff) * (0.5 + thr) + rpm * 0.2) * PR[0];
      this.ef.frequency.setTargetAtTime(Math.min(7000, cut), t, tc);
      const lim = s.limiter ? 0.2 : 1;
      this.eout.gain.setTargetAtTime((0.10 + 0.12 * load + 0.04 * Math.min(1, rpm / 7000)) * lim, t, tc);
      this.enf.frequency.setTargetAtTime(400 + rpm * 0.35, t, tc);
      this.eng.gain.setTargetAtTime((0.015 + 0.06 * thr) * Math.min(1, rpm / 4000), t, tc);
    }
    // turbo
    this.tg.gain.setTargetAtTime(s.boost > 0.02 ? Math.min(0.05, 0.012 + s.boost * 0.045) * (s.kind === 'sc' ? 1.2 : 1) : 0, t, tc);
    this.to.frequency.setTargetAtTime(s.kind === 'sc' ? 400 + rpm * 0.4 : 1500 + s.boost * 4500 + rpm * 0.1, t, tc);
    // pneus
    this.sg.gain.setTargetAtTime(Math.min(0.30, s.squeal * 0.30), t, 0.03);
    this.sf.frequency.setTargetAtTime(900 + s.squeal * 500 + s.speed * 6, t, 0.05);
    // vento e rodagem
    const sp = Math.abs(s.speed);
    this.wg.gain.setTargetAtTime(Math.min(0.35, Math.pow(sp / 60, 2) * 0.5), t, 0.1); this.wf.frequency.setTargetAtTime(300 + sp * 22, t, 0.1);
    this.rg.gain.setTargetAtTime(Math.min(0.28, sp / 70 * (s.rough ? 0.55 : 0.18)), t, 0.1); this.rf.frequency.setTargetAtTime(s.rough ? 420 : 200, t, 0.1);
  }
  thump(v) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime, g = c.createGain(), vv = Math.min(1, v / 18);
    g.gain.setValueAtTime(0.7 * vv, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; const g2 = c.createGain();
    g2.gain.setValueAtTime(0.5 * vv, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    s.connect(f).connect(g2).connect(this.master); s.start(t); s.stop(t + 0.4);
  }
  scrape(v) { this.thump(v * 0.25); }
  bov() {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.2; const g = c.createGain();
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 0.4);
  }
}
