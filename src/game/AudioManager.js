// ── AudioManager ─────────────────────────────────────────────────────────────
// Uses Web Audio API directly (same approach as Bug Blast) so it works on iOS.

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._droneNodes = [];
    this._rainNodes  = [];
    this._muted = false;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.6;
      this._masterGain.connect(this._ctx.destination);
    }
    // iOS requires resume after user gesture
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // ── AMBIENT DRONE ───────────────────────────────────────────────
  startAmbient() {
    if (this._droneNodes.length) return;
    const ctx = this._getCtx();

    // Two detuned oscillators for an eerie drone
    [[55, 0], [55.3, -8], [110, -14]].forEach(([freq, detune]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;

      filt.type = 'lowpass';
      filt.frequency.value = 400;

      gain.gain.value = 0;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this._masterGain);
      osc.start();

      // Fade in slowly
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);

      // Subtle slow tremolo
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      this._droneNodes.push({ osc, gain, lfo });
    });
  }

  stopAmbient() {
    const ctx = this._getCtx();
    this._droneNodes.forEach(({ osc, gain, lfo }) => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => { try { osc.stop(); lfo.stop(); } catch(e){} }, 1100);
    });
    this._droneNodes = [];
  }

  // ── RAIN ────────────────────────────────────────────────────────
  startRain() {
    if (this._rainNodes.length) return;
    const ctx = this._getCtx();

    // White noise buffer
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = buf;
    src.loop = true;
    filt.type = 'bandpass';
    filt.frequency.value = 3000;
    filt.Q.value = 0.4;
    gain.gain.value = 0;

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this._masterGain);
    src.start();

    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2);
    this._rainNodes = [{ src, gain }];
  }

  stopRain() {
    const ctx = this._getCtx();
    this._rainNodes.forEach(({ src, gain }) => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => { try { src.stop(); } catch(e){} }, 1100);
    });
    this._rainNodes = [];
  }

  // ── ONE-SHOT SFX ────────────────────────────────────────────────
  playFootstep() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 120 + Math.random() * 40;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.stop(ctx.currentTime + 0.07);
  }

  playJump() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.16);
  }

  playDeath() {
    if (this._muted) return;
    const ctx = this._getCtx();
    // Descending crash
    [0, 0.05, 0.1, 0.18].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 - i * 60, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + t + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
  }

  playCheckpoint() {
    if (this._muted) return;
    const ctx = this._getCtx();
    [0, 0.12].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660 + i * 220;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      osc.stop(ctx.currentTime + t + 0.22);
    });
  }

  playLever() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.2);
    gain.gain.value = 0.09;
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.26);
  }

  playWin() {
    if (this._muted) return;
    const ctx = this._getCtx();
    [0, 0.15, 0.3, 0.5].forEach((t, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = [330, 440, 550, 660][i];
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
      osc.stop(ctx.currentTime + t + 0.42);
    });
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : 0.6;
    }
  }

  toggle() {
    this.setMuted(!this._muted);
    return this._muted;
  }
}

// Singleton shared across scenes
export const audio = new AudioManager();

