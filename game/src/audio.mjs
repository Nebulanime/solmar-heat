// SOLMAR HEAT — all sound is synthesised with WebAudio: no audio files, no
// network. Engine hum, two-tone Solmar PD sirens, gunshots, chimes and a small
// sun-soaked bass-and-keys loop. Every call is a no-op until the first gesture
// creates an AudioContext, so headless runs stay silent and safe.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let sirenOsc = null;
  let sirenGain = null;
  let engineOsc = null;
  let engineGain = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio is garnish, never fatal */ }
  }

  function noise(dur, vol, lowpass = 1200) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch { /* ignore */ }
  }

  // A lazy reggae-ish bassline in A minor: root notes walk, keys sparkle on top.
  const BASS = [110, 110, 130.81, 98, 110, 110, 146.83, 164.81];
  const KEYS = [440, 523.25, 659.25, 523.25, 440, 392, 493.88, 587.33];

  function musicTick() {
    if (!ctx || muted) return;
    const i = musicStep % 8;
    tone(BASS[i], 0.42, 'triangle', 0.16);
    if (musicStep % 2 === 0) tone(KEYS[i], 0.3, 'sine', 0.05);
    if (musicStep % 8 === 4) noise(0.08, 0.05, 6000);
    musicStep += 1;
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m) this.siren(false);
    },
    isMuted() { return muted; },
    shot() { noise(0.14, 0.5, 2800); tone(160, 0.1, 'square', 0.12, 0, 60); },
    horn() { tone(370, 0.22, 'square', 0.1); tone(466, 0.22, 'square', 0.08); },
    crash() { noise(0.35, 0.4, 900); tone(90, 0.3, 'sawtooth', 0.15, 0, 45); },
    chime() { tone(880, 0.18, 'sine', 0.2); tone(1318.5, 0.3, 'sine', 0.16, 0.09); },
    pickup() { tone(660, 0.12, 'sine', 0.18); tone(990, 0.2, 'sine', 0.14, 0.07); },
    busted() { tone(392, 0.25, 'square', 0.14); tone(311, 0.4, 'square', 0.14, 0.2); },
    engine(speed01) {
      if (!ensure() || muted) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    siren(on) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'triangle';
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenOsc.frequency.setValueAtTime(700, ctx.currentTime);
          const wobble = () => {
            if (!sirenOsc) return;
            sirenOsc.frequency.setTargetAtTime(
              sirenOsc.frequency.value > 800 ? 700 : 950, ctx.currentTime, 0.4,
            );
            setTimeout(wobble, 420);
          };
          wobble();
        } else if (!on && sirenOsc) {
          try { sirenOsc.stop(); } catch { /* already stopped */ }
          sirenOsc = null;
          sirenGain = null;
        }
      } catch { /* ignore */ }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(musicTick, 300);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
}
