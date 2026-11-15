// Little game sounds made in code (no audio files). iPads only allow sound after a tap,
// so the first tap anywhere in the app switches the sound on.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockSound() {
  const a = audio();
  if (!a) return;
  // A silent blip is what actually unlocks audio on iOS.
  const o = a.createOscillator();
  const g = a.createGain();
  g.gain.value = 0;
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.01);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockSound, { once: true, capture: true });
}

function notes(seq: [freq: number, start: number, len: number][], type: OscillatorType = 'square', volume = 0.18) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + 0.05;
  for (const [f, s, l] of seq) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + s);
    g.gain.linearRampToValueAtTime(volume, t0 + s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + s + l);
    o.connect(g).connect(a.destination);
    o.start(t0 + s);
    o.stop(t0 + s + l + 0.05);
  }
}

/** Gentle two-note chime: one minute left. */
export function playWarning() {
  notes([[880, 0, 0.25], [660, 0.3, 0.4]], 'sine', 0.3);
}

/** Game-over jingle, played three times: time's up! */
export function playTimesUp() {
  const tune: [number, number, number][] = [
    [784, 0, 0.15], [659, 0.17, 0.15], [523, 0.34, 0.15], [392, 0.51, 0.45],
  ];
  for (let r = 0; r < 3; r++) notes(tune.map(([f, s, l]) => [f, s + r * 1.2, l]));
}
