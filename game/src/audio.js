// Synthesised sound only: every effect is an oscillator (or filtered noise made
// from an oscillator buffer), so the game ships no audio files at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch { return false; }
    return true;
  }

  /** Must be called from a user gesture (the Start button) to unlock audio. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!enabled || !ensure()) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!enabled || !ensure()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    } catch { /* ignore */ }
  }

  const api = {
    unlock,
    setEnabled(v) { enabled = v; if (!v) api.stopEngine(); },
    playClick() { tone(660, 0.07, 'square', 0.12); },
    playPickup() { tone(520, 0.1, 'sine', 0.22); setTimeout(() => tone(780, 0.14, 'sine', 0.22), 90); },
    playCash() { tone(880, 0.09, 'triangle', 0.22); setTimeout(() => tone(1174, 0.09, 'triangle', 0.22), 80); setTimeout(() => tone(1568, 0.18, 'triangle', 0.22), 160); },
    playPunch() { noiseBurst(0.12, 0.3, 700); },
    playGunshot() { noiseBurst(0.16, 0.4, 2400); tone(160, 0.1, 'square', 0.18, 50); },
    playCrash() { noiseBurst(0.3, 0.45, 500); tone(90, 0.25, 'sawtooth', 0.2, 40); },
    playSirenBlip() { tone(980, 0.18, 'sine', 0.12, 720); },
    playHorn() { tone(370, 0.25, 'sawtooth', 0.14); tone(466, 0.25, 'sawtooth', 0.1); },
    playMissionStart() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.2), i * 110)); },
    playMissionDone() { [784, 988, 1174, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.22), i * 120)); },
    playBusted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.16), i * 200)); },

    /** Continuous engine hum whose pitch follows speed 0..1. Call every frame. */
    updateEngine(speed01, driving) {
      if (!enabled || !ensure()) return;
      try {
        if (!driving || speed01 < 0.02) { api.stopEngine(); return; }
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.03;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 900;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(60 + speed01 * 180, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
      } catch { /* ignore */ }
    },
    stopEngine() {
      try { if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; } } catch { /* ignore */ }
    },
    /** Police siren wail while any police car is chasing. */
    updateSiren(chasing) {
      if (!enabled || !ensure()) return;
      try {
        if (!chasing) {
          if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; sirenGain = null; }
          return;
        }
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'sine';
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain); sirenGain.connect(master);
          sirenOsc.start();
        }
        const t = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(t);
        sirenOsc.frequency.setValueAtTime(700, t);
        sirenOsc.frequency.linearRampToValueAtTime(1050, t + 0.7);
        sirenOsc.frequency.linearRampToValueAtTime(700, t + 1.4);
      } catch { /* ignore */ }
    },
    /** A tiny looping bass line for the menu and driving — pure oscillators. */
    startMusic() {
      if (musicTimer || !ensure()) return;
      const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
      musicTimer = setInterval(() => {
        if (!enabled) return;
        const f = bass[musicStep % bass.length];
        tone(f, 0.42, 'triangle', 0.1);
        if (musicStep % 2 === 0) tone(f * 4, 0.1, 'square', 0.03);
        musicStep++;
      }, 460);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
  return api;
}
