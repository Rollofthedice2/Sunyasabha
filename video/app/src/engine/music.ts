// Song-time helpers: beat grid, bar phase, stem envelopes. Data comes from analysis/analyze.py.
// Call initMusic(audioJson, envelopesJson) once (node: read files; browser: fetch).

export interface AudioData {
  duration: number;
  bpm: number;
  beat_period: number;
  grid_offset: number;
  beats: number[];
  downbeats: number[];
}
export interface Envelopes { rate: number; [stem: string]: number[] | number }

let A: AudioData | null = null;
let E: Envelopes | null = null;

export function initMusic(audio: AudioData, env: Envelopes) {
  A = audio;
  E = env;
}

const need = () => { if (!A) throw new Error('music not initialised'); return A; };

// beat index (float) since the first grid beat
export function beatPos(t: number) { const a = need(); return (t - a.grid_offset) / a.beat_period; }
export function beatPhase(t: number) { const b = beatPos(t); return b - Math.floor(b); }
export function barPos(t: number) { return beatPos(t) / 4; }
export function barPhase(t: number) { const b = barPos(t); return b - Math.floor(b); }
// sharp hit at each beat decaying over the beat (1 at the beat → ~0)
export function beatHit(t: number, decay = 5) { return Math.exp(-beatPhase(t) * decay); }

// stem envelope in dB, linearly interpolated; normalised to 0..1 between floor and ceil dB
export function env(stem: string, t: number, floor = -45, ceil = -12) {
  if (!E) return 0;
  const arr = E[stem] as number[] | undefined;
  if (!arr) return 0;
  const x = t * E.rate;
  const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x)));
  const f = Math.max(0, Math.min(1, x - i));
  const db = arr[i]! * (1 - f) + arr[i + 1]! * f;
  return Math.max(0, Math.min(1, (db - floor) / (ceil - floor)));
}

// smooth ease helpers
export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
