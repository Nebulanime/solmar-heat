// Every sound is synthesized with WebAudio: no audio files, no network. An
// engine hum that follows the car's speed, a two-tone siren when the PD is
// close, gunshots and crashes from shaped noise, and a low bass-and-hat loop
// for the drive. Nothing starts until the player first presses a key: browsers
// only let sound begin after a gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenFlip = 0;
  let musicGain = null;
  let musicNext = 0;
  let musicStep = 0;
  let noiseBuf = null;
  let muted = false;

  // A 16-step bassline in A minor, with a hat tick on the off steps.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  const STEP_SECONDS = 0.21;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      // Engine: two detuned saws through a lowpass, quiet until driving.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.detune.value = 8;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: one square wave, flipped between two tones by update().
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      musicNext = ctx.currentTime + 0.1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, time, dur, type, vol, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(dest || master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function noise(time, dur, vol, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  return {
    /** Call from a user gesture (key or click) so sound is allowed to start. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    /** Silence (or restore) every sound; the flag survives a late unlock. */
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows how fast the car is going; silent on foot. */
    engine(speed01, driving) {
      if (!ctx) return;
      const now = ctx.currentTime;
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.05 : 0, now, 0.1);
      const freq = 52 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.5, now, 0.08);
    },
    /** Siren wails while any cop is near; quiet otherwise. */
    siren(on, time) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, time, 0.2);
      if (!on) return;
      if (time - sirenFlip > 0.42) {
        sirenFlip = time;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 920 : 690, ctx.currentTime, 0.05);
      }
    },
    shot() {
      if (!ensure()) return;
      noise(ctx.currentTime, 0.14, 0.5, 1400);
    },
    crash() {
      if (!ensure()) return;
      noise(ctx.currentTime, 0.3, 0.5, 220);
    },
    pickup() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      blip(660, t, 0.09, 'sine', 0.25);
      blip(990, t + 0.09, 0.14, 'sine', 0.25);
    },
    /** A short win arpeggio for a finished mission. */
    jingle() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => blip(f, t + i * 0.11, 0.22, 'triangle', 0.28));
    },
    /** A low two-note sting for failing. */
    sting() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      blip(220, t, 0.3, 'sawtooth', 0.2);
      blip(174, t + 0.25, 0.45, 'sawtooth', 0.2);
    },
    /** The bass-and-hat loop, scheduled a little ahead of time. */
    music(dt, playing) {
      if (!ctx || !playing) return;
      const ahead = ctx.currentTime + 0.25;
      while (musicNext < ahead) {
        const step = musicStep % 16;
        const freq = BASS[step];
        if (freq > 0) blip(freq, musicNext, STEP_SECONDS * 0.9, 'triangle', 0.5, musicGain);
        if (step % 2 === 1) noise(musicNext, 0.03, 0.12, 6000);
        musicNext += STEP_SECONDS;
        musicStep += 1;
      }
    },
  };
}
