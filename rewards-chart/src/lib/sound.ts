// Little game sounds made in code (no audio files).
//
// iPhones and iPads mute "web audio" when the phone is on silent, so these are built as real
// WAV clips and played through an <audio> element, which plays like a video's sound does.
// iOS only lets a page play sound after a tap, so the first tap anywhere unlocks the player.

type Note = [freq: number, start: number, len: number];
const RATE = 22050;

function wav(notes: Note[], wave: 'square' | 'sine', volume: number): string {
  const total = Math.max(...notes.map(([, s, l]) => s + l)) + 0.1;
  const n = Math.ceil(total * RATE);
  const pcm = new Float32Array(n);
  for (const [f, s, l] of notes) {
    const a = Math.floor(s * RATE);
    const len = Math.floor(l * RATE);
    for (let i = 0; i < len && a + i < n; i++) {
      const t = i / RATE;
      const ph = (t * f) % 1;
      const v = wave === 'square' ? (ph < 0.5 ? 1 : -1) * 0.6 : Math.sin(2 * Math.PI * ph);
      const env = Math.min(1, i / (0.01 * RATE)) * Math.exp((-3 * i) / len);
      pcm[a + i] += v * env * volume;
    }
  }
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const str = (o: number, x: string) => [...x].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const tune: Note[] = [[784, 0, 0.15], [659, 0.17, 0.15], [523, 0.34, 0.15], [392, 0.51, 0.45]];
let clips: { warning: string; timesUp: string; silent: string } | null = null;
function getClips() {
  if (!clips && typeof window !== 'undefined') {
    clips = {
      warning: wav([[880, 0, 0.3], [660, 0.32, 0.5]], 'sine', 0.8),
      timesUp: wav([0, 1.2, 2.4].flatMap((r) => tune.map(([f, s, l]): Note => [f, s + r, l])), 'square', 0.5),
      silent: wav([[440, 0, 0.05]], 'sine', 0),
    };
  }
  return clips;
}

let player: HTMLAudioElement | null = null;
function getPlayer() {
  if (!player && typeof window !== 'undefined') {
    player = new Audio();
    player.setAttribute('playsinline', '');
  }
  return player;
}

function play(src: string | undefined) {
  const p = getPlayer();
  if (!p || !src) return;
  try {
    // Newer iPhones/iPads: treat as media so it plays even on silent.
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = 'playback';
  } catch {
    /* not supported */
  }
  p.src = src;
  p.currentTime = 0;
  void p.play().catch(() => {});
}

/** Call from a tap: lets later sounds (like the end of the timer) play on their own. */
export function unlockSound() {
  play(getClips()?.silent);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockSound, { once: true, capture: true });
}

/** Gentle two-note chime: one minute left. */
export function playWarning() {
  play(getClips()?.warning);
}

/** Game-over jingle, three times: time's up! */
export function playTimesUp() {
  play(getClips()?.timesUp);
}
