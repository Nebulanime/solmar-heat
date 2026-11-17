// Procedural sound only: every effect and the music loop are synthesized with
// WebAudio oscillators and filtered noise, so the game ships zero audio files
// and never touches the network. Audio starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOn = false;
  let musicOn = false;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A lazy bass-and-hat loop in A minor: bass notes walk, a hat ticks on the off-beat.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicOn = true;
    musicTimer = window.setInterval(() => {
      if (!musicOn || !ctx) return;
      const bass = BASS[step % BASS.length];
      tone(bass, 0.42, 'triangle', 0.22);
      if (step % 2 === 1) tone(6000, 0.03, 'square', 0.03);
      if (step % 8 === 6) tone(bass * 2, 0.2, 'sawtooth', 0.06);
      step += 1;
    }, 210);
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speed01, on) {
    if (!engineOsc || !engineGain) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.08 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.1);
  }

  // Two-tone siren that wails while the player is wanted.
  function setSiren(on) {
    if (on === sirenOn) return;
    sirenOn = on;
    if (!on || !ensure()) return;
    const wail = () => {
      if (!sirenOn) return;
      tone(720, 0.42, 'sine', 0.07, 950);
      window.setTimeout(() => {
        if (sirenOn) tone(950, 0.42, 'sine', 0.07, 720);
      }, 430);
      window.setTimeout(wail, 880);
    };
    wail();
  }

  return {
    unlock: resume,
    startMusic,
    stopMusic,
    startEngine,
    setEngine,
    setSiren,
    shoot() {
      noise(0.16, 0.5, 3000);
      tone(180, 0.1, 'square', 0.2, 60);
    },
    punch() {
      noise(0.09, 0.35, 500);
    },
    hit() {
      tone(140, 0.18, 'sawtooth', 0.25, 70);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.2);
      window.setTimeout(() => tone(1318, 0.14, 'sine', 0.2), 90);
    },
    cash() {
      tone(1046, 0.1, 'sine', 0.2);
      window.setTimeout(() => tone(1568, 0.2, 'sine', 0.2), 100);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.22);
      window.setTimeout(() => tone(659, 0.12, 'triangle', 0.22), 120);
      window.setTimeout(() => tone(784, 0.25, 'triangle', 0.22), 240);
    },
    busted() {
      tone(392, 0.3, 'sawtooth', 0.2, 196);
      window.setTimeout(() => tone(311, 0.5, 'sawtooth', 0.2, 155), 300);
    },
    horn() {
      tone(370, 0.25, 'square', 0.12);
      tone(466, 0.25, 'square', 0.1);
    },
    crash() {
      noise(0.3, 0.5, 800);
    },
  };
}
