// Synthesized sound: every effect and the music loop are built with
// WebAudio oscillators and noise — no audio files, no network.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  const MELODY = [0, 3, 5, 7, 10, 7, 5, 3, 0, -2, 0, 3, 5, 3, 2, 0];
  const BASS = [0, 0, 5, 3];

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq || 1200;
    const gain = ac.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    src.start();
  }

  function startMusic() {
    if (musicTimer || muted) return;
    ensure();
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const step = musicStep;
      const root = 110;
      const note = MELODY[step % MELODY.length];
      const freq = root * Math.pow(2, note / 12) * 2;
      tone(freq, 0.22, 'triangle', 0.05);
      if (step % 4 === 0) tone(root * Math.pow(2, BASS[(step / 4) % BASS.length] / 12), 0.4, 'sine', 0.09);
      if (step % 8 === 4) noise(0.05, 0.04, 6000);
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    get muted() { return muted; },
    unlock() { ensure(); startMusic(); },
    toggleMute() {
      muted = !muted;
      if (muted) stopMusic(); else startMusic();
      return muted;
    },
    playClick() { tone(660, 0.06, 'square', 0.08); },
    playCash() { tone(880, 0.08, 'sine', 0.12); window.setTimeout(() => tone(1320, 0.12, 'sine', 0.12), 70); },
    playPunch() { noise(0.09, 0.25, 900); },
    playShot() { noise(0.12, 0.3, 2400); tone(180, 0.1, 'square', 0.1, 60); },
    playCrash() { noise(0.25, 0.35, 500); tone(90, 0.25, 'sawtooth', 0.12, 40); },
    playSiren() { tone(700, 0.3, 'sine', 0.05, 950); },
    playEngine() { tone(70, 0.15, 'sawtooth', 0.03, 110); },
    playMissionComplete() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.18, 'triangle', 0.12), i * 110)); },
    playFail() { [400, 320, 240].forEach((f, i) => window.setTimeout(() => tone(f, 0.2, 'sawtooth', 0.08), i * 130)); },
    playBusted() { [300, 280, 260, 200].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 180)); },
    playHorn() { tone(370, 0.18, 'square', 0.07); tone(466, 0.18, 'square', 0.05); },
  };
}
