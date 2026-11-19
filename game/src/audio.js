// Procedural sound for SOLMAR HEAT: every sound is synthesized with WebAudio,
// so the game ships no audio files and makes no network request.
export class Sound {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioNodes = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: a low sawtooth whose pitch follows speed, through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filt).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  engine(speed, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.05 + Math.abs(speed) / 38 * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 3.2, this.ctx.currentTime, 0.08);
  }

  blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  shot() {
    if (!this.ctx || this.muted) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle';
      g.gain.value = 0.03;
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      lfo.frequency.value = 0.6; lg.gain.value = 320;
      lfo.connect(lg).connect(o.frequency);
      o.frequency.value = 750;
      o.connect(g).connect(this.ctx.destination);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  jingle() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.25, 'triangle', 0.18), i * 130);
    });
  }

  // A tiny lo-fi radio loop: bass note + plucked arp, rescheduled each bar.
  // M toggles the station in main.js; the loop re-reads the station each bar.
  radio(on, station) {
    if (!this.ctx) return;
    if (!on) { if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; } return; }
    if (this.radioTimer && this.radioStation === station) return;
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.radioStation = station;
    const roots = [110, 98, 87.3, 130.8];
    const root = roots[station % roots.length];
    let step = 0;
    this.radioTimer = setInterval(() => {
      if (this.muted) return;
      const scale = [1, 1.189, 1.335, 1.498, 1.782, 2];
      this.blip(root * scale[step % scale.length], 0.22, 'triangle', 0.07);
      if (step % 4 === 0) this.blip(root / 2, 0.5, 'sine', 0.12);
      step += 1;
    }, 240);
  }
}
