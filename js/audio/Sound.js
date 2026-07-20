/**
 * Procedural SFX via Web Audio — richer layered synthesis.
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._walkAt = 0;
    this.master = 0.42;
    this._out = null;
    this._muffle = null;
    this._muffleAmt = 0;
    this.muteWalk = false;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this._out = this.ctx.createGain();
      this._out.gain.value = this.master;
      // Master lowpass — dulls ALL game SFX when hurt
      this._muffle = this.ctx.createBiquadFilter();
      this._muffle.type = "lowpass";
      this._muffle.frequency.value = 16000;
      this._muffle.Q.value = 0.5;
      this._out.connect(this._muffle);
      this._muffle.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(this._out);
    s.start(0);
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.enabled) this.ensure();
    if (this._out) this._out.gain.value = this.enabled ? this.master : 0;
  }

  setMaster(v) {
    this.master = Math.max(0, Math.min(1, Number(v) || 0));
    if (this._out) this._out.gain.value = this.enabled ? this.master : 0;
  }

  /**
   * 0 = normal, 1 = heavily muffled (underwater / ringing ears).
   * Affects every sound that goes through the master bus.
   */
  setMuffle(amount) {
    const ctx = this.ensure();
    if (!ctx || !this._muffle) return;
    const t = Math.max(0, Math.min(1, Number(amount) || 0));
    this._muffleAmt = t;
    // Clear ~16kHz → muffled ~280Hz
    const freq = 280 + (16000 - 280) * Math.pow(1 - t, 1.35);
    const now = ctx.currentTime;
    this._muffle.frequency.cancelScheduledValues(now);
    this._muffle.frequency.setTargetAtTime(freq, now, 0.06);
    // Slight volume dip when muffled
    if (this._out && this.enabled) {
      const g = this.master * (1 - t * 0.35);
      this._out.gain.cancelScheduledValues(now);
      this._out.gain.setTargetAtTime(g, now, 0.06);
    }
  }

  /**
   * @param {object} opts
   * freq, dur, type, vol, slideTo, attack, curve ('exp'|'lin'), delay, detune
   */
  osc(opts = {}) {
    const ctx = this.ensure();
    if (!ctx || !this._out) return;
    const {
      freq = 440,
      dur = 0.1,
      type = "sine",
      vol = 0.2,
      slideTo = null,
      attack = 0.008,
      delay = 0,
      detune = 0,
      filterFreq = null,
      filterType = "lowpass"
    } = opts;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (detune) osc.detune.setValueAtTime(detune, t0);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let node = osc;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.setValueAtTime(filterFreq, t0);
      f.Q.value = 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this._out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(opts = {}) {
    const ctx = this.ensure();
    if (!ctx || !this._out) return;
    const {
      dur = 0.1,
      vol = 0.15,
      filterFreq = 2000,
      filterType = "bandpass",
      q = 0.7,
      delay = 0,
      attack = 0.004
    } = opts;

    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      // soft pink-ish noise
      data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this._out);
    src.start(t0);
    src.stop(t0 + dur);
  }

  click(freq = 1200, vol = 0.08) {
    this.osc({ freq, dur: 0.03, type: "square", vol, slideTo: freq * 0.4, attack: 0.001 });
  }

  _s(scale) {
    return Math.max(0, Math.min(1, scale == null ? 1 : scale));
  }

  walk(scale = 1) {
    if (this.muteWalk) return;
    const s = this._s(scale);
    if (s < 0.04) return;
    const now = performance.now();
    const gap = s > 0.55 ? 290 : 140;
    if (now - this._walkAt < gap) return;
    this._walkAt = now;
    this.noise({ dur: 0.055, vol: 0.07 * s, filterFreq: 140, filterType: "lowpass", q: 0.5 });
    this.osc({ freq: 70 + Math.random() * 15, dur: 0.07, type: "sine", vol: 0.07 * s, filterFreq: 200 });
  }

  dash(scale = 1) {
    const s = this._s(scale);
    if (s < 0.03) return;
    this.noise({ dur: 0.22, vol: 0.2 * s, filterFreq: 700, filterType: "bandpass", q: 0.5 });
    this.osc({ freq: 520, dur: 0.18, type: "sawtooth", vol: 0.09 * s, slideTo: 90, filterFreq: 1200 });
    this.osc({ freq: 160, dur: 0.24, type: "sine", vol: 0.12 * s, slideTo: 50 });
    this.osc({ freq: 880, dur: 0.08, type: "triangle", vol: 0.05 * s, delay: 0.02, slideTo: 200 });
  }

  pistol(scale = 1) {
    const s = this._s(scale);
    if (s < 0.03) return;
    this.osc({ freq: 110, dur: 0.16, type: "triangle", vol: 0.22 * s, slideTo: 40, attack: 0.002 });
    this.osc({ freq: 65, dur: 0.2, type: "sine", vol: 0.18 * s, slideTo: 30 });
    this.noise({ dur: 0.07, vol: 0.32 * s, filterFreq: 1800, filterType: "bandpass", q: 1.2 });
    this.noise({ dur: 0.05, vol: 0.18 * s, filterFreq: 4200, filterType: "highpass", q: 0.6 });
    this.osc({ freq: 380, dur: 0.05, type: "square", vol: 0.08 * s, slideTo: 90, filterFreq: 900 });
  }

  rifle(scale = 1) {
    const s = this._s(scale);
    if (s < 0.03) return;
    this.osc({ freq: 140, dur: 0.07, type: "triangle", vol: 0.14 * s, slideTo: 55, attack: 0.001 });
    this.osc({ freq: 80, dur: 0.09, type: "sine", vol: 0.12 * s, slideTo: 35 });
    this.noise({ dur: 0.04, vol: 0.26 * s, filterFreq: 2400, filterType: "bandpass", q: 1.4 });
    this.noise({ dur: 0.03, vol: 0.12 * s, filterFreq: 5500, filterType: "highpass", q: 0.5 });
    this.click(1600, 0.05 * s);
  }

  knife(scale = 1) {
    const s = this._s(scale);
    if (s < 0.03) return;
    // one swing: short whoosh + single metallic slice (no delayed second hit)
    this.noise({
      dur: 0.09,
      vol: 0.14 * s,
      filterFreq: 3200,
      filterType: "bandpass",
      q: 1.6,
      attack: 0.002
    });
    this.osc({
      freq: 2100,
      dur: 0.08,
      type: "sawtooth",
      vol: 0.065 * s,
      slideTo: 420,
      attack: 0.001,
      filterFreq: 4200
    });
    this.osc({
      freq: 1400,
      dur: 0.07,
      type: "triangle",
      vol: 0.055 * s,
      slideTo: 380,
      filterFreq: 3000
    });
  }

  death(scale = 1) {
    const s = this._s(scale);
    this.osc({ freq: 280, dur: 0.4, type: "sawtooth", vol: 0.12 * s, slideTo: 45, filterFreq: 600 });
    this.osc({ freq: 160, dur: 0.5, type: "triangle", vol: 0.14 * s, slideTo: 35 });
    this.osc({ freq: 90, dur: 0.55, type: "sine", vol: 0.1 * s, slideTo: 28 });
    this.noise({ dur: 0.35, vol: 0.1 * s, filterFreq: 350, filterType: "lowpass", q: 0.4 });
  }

  /** Short metallic confirm — “you got the kill” (CS-like ding). */
  kill(scale = 1) {
    const s = this._s(scale);
    if (s < 0.03) return;
    this.osc({
      freq: 880,
      dur: 0.055,
      type: "triangle",
      vol: 0.11 * s,
      attack: 0.001,
      filterFreq: 4200
    });
    this.osc({
      freq: 1320,
      dur: 0.09,
      type: "sine",
      vol: 0.09 * s,
      delay: 0.018,
      slideTo: 990,
      filterFreq: 5000
    });
    this.noise({
      dur: 0.035,
      vol: 0.06 * s,
      filterFreq: 3600,
      filterType: "bandpass",
      q: 1.2,
      delay: 0.01
    });
  }
}
