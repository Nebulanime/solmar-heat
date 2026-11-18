// SOLMAR HEAT — audio.mjs
// All sound is synthesized with the Web Audio API — no audio files.
// Engine hum, sirens, gunshots, punches, pickups and a tiny bass loop
// are built from oscillators and filtered noise, so the game stays
// fully offline with zero network requests.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  const audio = {
    get muted() { return muted; },
    ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
      } catch { ctx = null; }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    // Short oscillator blip.
    blip(freq, dur, type = 'square', vol = 0.2) {
      if (!ctx || muted) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    },
    // Filtered noise burst: gunshots, punches, crashes.
    noise(dur, vol = 0.3, freq = 1200) {
      if (!ctx || muted) return;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = vol;
      src.buffer = buf; src.connect(filter); filter.connect(g); g.connect(master);
      src.start();
    },
    gunshot() { audio.noise(0.14, 0.4, 2400); audio.blip(160, 0.08, 'sawtooth', 0.18); },
    punch() { audio.noise(0.08, 0.25, 700); },
    crash() { audio.noise(0.25, 0.35, 500); },
    horn() { audio.blip(370, 0.18, 'square', 0.15); setTimeout(() => audio.blip(370, 0.18, 'square', 0.15), 200); },
    pickup() { audio.blip(660, 0.09); setTimeout(() => audio.blip(990, 0.12), 80); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.blip(f, 0.16, 'triangle', 0.25), i * 110)); },
    // Two-tone police siren.
    siren() {
      if (!ctx || muted) return;
      audio.blip(760, 0.32, 'sine', 0.12);
      setTimeout(() => audio.blip(560, 0.32, 'sine', 0.12), 320);
    },
    // Engine hum whose pitch follows speed; call every frame while driving.
    engine(speed01) {
      if (!ctx || muted) return;
      if (!audio._eng) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 60;
        g.gain.value = 0.0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420;
        o.connect(f); f.connect(g); g.connect(master);
        o.start();
        audio._eng = { o, g };
      }
      audio._eng.o.frequency.value = 55 + speed01 * 130;
      audio._eng.g.gain.value = 0.05 + speed01 * 0.06;
    },
    engineOff() { if (audio._eng) audio._eng.g.gain.value = 0; },
    // Looping bass line: a simple four-note groove on a timer.
    startMusic() {
      if (musicTimer || !ctx) return;
      const notes = [55, 55, 65.4, 49];
      let i = 0;
      musicTimer = setInterval(() => {
        if (!muted) audio.blip(notes[i % 4], 0.42, 'triangle', 0.10);
        i++;
      }, 430);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
  return audio;
}
