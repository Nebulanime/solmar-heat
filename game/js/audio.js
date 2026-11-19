// audio.js — all sound is synthesized with WebAudio: engine hum, sirens,
// gunshots, UI blips and three looping radio stations. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0;
    this.radioOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.step = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startRadio();
  }
  setEngine(speed01, inCar) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = inCar ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.frequency.value = 0.55;
      const lg = this.ctx.createGain(); lg.gain.value = 320;
      this.sirenLfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 880;
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }
  blip(freq = 660, dur = 0.08, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  gunshot() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.14;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(this.master);
    src.start();
    this.blip(180, 0.12, 'sawtooth', 0.2);
  }
  crash() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start();
  }
  // Radio: three stations, simple step-sequenced synth loops.
  static STATIONS = [
    { name: 'SOLMAR FM 98.4', song: '"Neon Coast" — The Palms', bpm: 96, bass: [0, 0, 7, 5], lead: [12, 15, 19, 15] },
    { name: 'VICE CITY RADIO 101.1', song: '"Sunset Drive" — Marina', bpm: 112, bass: [0, 3, 5, 3], lead: [12, 14, 17, 19] },
    { name: 'BASSLINE 88.8', song: '"Night Heat" — Kova', bpm: 124, bass: [0, 0, 10, 8], lead: [0, 12, 10, 7] },
  ];
  startRadio() {
    if (!this.ctx || this.musicTimer) return;
    const tick = () => {
      if (!this.radioOn || !this.ctx) return;
      const st = AudioEngine.STATIONS[this.station];
      const spb = 60 / st.bpm / 2;
      const root = 110;
      const note = (semi) => root * Math.pow(2, semi / 12);
      const bassN = st.bass[this.step % st.bass.length];
      const leadN = st.lead[this.step % st.lead.length];
      this.tone(note(bassN), spb * 0.95, 'triangle', 0.16);
      if (this.step % 2 === 0) this.tone(note(leadN) * 2, spb * 0.5, 'square', 0.045);
      if (this.step % 4 === 2) this.noiseHit(spb * 0.3);
      this.step++;
    };
    this.musicTimer = setInterval(tick, 240);
  }
  tone(freq, dur, type, vol) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noiseHit(dur) {
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = this.ctx.createGain(); g.gain.value = 0.08;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  nextStation() {
    this.station = (this.station + 1) % AudioEngine.STATIONS.length;
    this.blip(880, 0.06);
    return AudioEngine.STATIONS[this.station];
  }
}
