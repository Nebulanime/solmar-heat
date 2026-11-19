// SOLMAR HEAT — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Three radio stations are tiny step sequencers (bass + lead + hats),
// plus an engine hum, a two-tone police siren, and one-shot effects.
// Everything is guarded: if the AudioContext cannot start (headless,
// no gesture yet), every call is a safe no-op.

const NOTES = {
  // Semitone offsets from A2 (110 Hz), per station.
  'solmar-887': {
    bass: [0, 0, 7, 10, 0, 0, 12, 7],
    lead: [12, 15, 19, 15, 12, 10, 7, 10],
    wave: 'sawtooth',
  },
  'palma-101': {
    bass: [0, 3, 7, 5, 0, 3, 10, 7],
    lead: [12, 12, 15, 12, 19, 15, 12, 10],
    wave: 'triangle',
  },
  'neon-945': {
    bass: [0, 0, 5, 3, 0, 0, 8, 5],
    lead: [12, 17, 12, 10, 12, 15, 12, 7],
    wave: 'sine',
  },
};

function freq(semi) {
  return 110 * Math.pow(2, semi / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.stationIds = ['solmar-887', 'palma-101', 'neon-945'];
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startRadio();
      this.startEngine();
      return true;
    } catch {
      return false;
    }
  }

  stationName() {
    return this.stationIds[this.station];
  }

  cycleStation() {
    this.station = (this.station + 1) % this.stationIds.length;
    this.step = 0;
  }

  startRadio() {
    const ctx = this.ctx;
    this.nextStepTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.scheduleRadio(), 120);
  }

  scheduleRadio() {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const bpm = [96, 104, 76][this.station];
    const stepDur = 60 / bpm / 2;
    while (this.nextStepTime < ctx.currentTime + 0.3) {
      const t = this.nextStepTime;
      const pat = NOTES[this.stationIds[this.station]];
      const s = this.step % 8;
      this.note(freq(pat.bass[s] - 12), t, stepDur * 0.95, pat.wave, 0.16);
      if (s % 2 === 0) this.note(freq(pat.lead[s]), t, stepDur * 0.9, 'square', 0.05);
      if (s % 2 === 1) this.hat(t);
      this.step++;
      this.nextStepTime += stepDur;
    }
  }

  note(f, t, dur, wave, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hat(t) {
    const ctx = this.ctx;
    const len = 0.04;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, inCar) {
    if (!this.ctx || !this.engineGain) return;
    const target = inCar ? 0.02 + speed01 * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 110, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  blip(f = 880, dur = 0.12, vol = 0.12) {
    if (!this.ctx) return;
    this.note(f, this.ctx.currentTime, dur, 'square', vol);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.18;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  jingle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12].forEach((s, i) => this.note(freq(s + 12), t + i * 0.09, 0.22, 'triangle', 0.14));
  }
}

// ---- Mute control (second pass) ------------------------------------------
// M toggles the map, so mute lives on the title OPTIONS menu instead of a
// key. The game calls audio.setMuted(true/false); the radio scheduler
// checks this.muted each tick, and setEngine/setSiren are silenced by
// dropping the master gain to zero.

AudioEngine.prototype.setMuted = function (muted) {
  this.muted = muted;
  if (this.master) {
    this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }
};
