// Frame animations: numbered drawings played on the song's beat grid, or at their own absolute song timestamps.
// Frames are anchored by the bottom-centre of their figure so a loop stands still on its feet.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from './fb.ts';
import { loadPlate, readPlateMetadata, drawPlateAt, type Plate, type PlateMetadata, type PlateOpts } from './plate.ts';
import { DecodedFrameCache, lazyPlateFrames } from './lazy_frames.ts';
import { beatPos } from './music.ts';

export interface Anim { frames: Plate[]; height: number; times?: number[]; songTimes?: number[] }
const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
const cache = new Map<string, Anim>();
const continuousFrames = new DecodedFrameCache(64 * 1024 * 1024);
const frameMetadata = new WeakMap<Anim, readonly PlateMetadata[]>();

// Frame metadata (canvas size, anchors) without decoding a whole phrase.
// Hand-built Anim values already hold their Plate objects.
export function animationFrameMetadata(a: Anim): readonly PlateMetadata[] { return frameMetadata.get(a) ?? a.frames; }
export function continuousFrameCacheStats() { return continuousFrames.stats(); }

export function loadAnim(name: string): Anim {
  let a = cache.get(name);
  if (a) return a;
  const meta = JSON.parse(readFileSync(path.join(DIR, `${name}.anim.json`), 'utf8')) as { frames: number; height: number; times?: number[] | null; songTimes?: number[] };
  if (meta.songTimes && (!Number.isSafeInteger(meta.frames) || meta.frames < 1 || meta.songTimes.length !== meta.frames || meta.songTimes.some((t,i)=>!Number.isFinite(t)||(i>0&&t<=meta.songTimes![i-1]!))))
    throw new Error(`Invalid absolute song timestamps: ${name}`);
  if (meta.songTimes) {
    const names = Array.from({ length: meta.frames }, (_, i) => `${name}_${i}`);
    const metadata = names.map(readPlateMetadata);
    a = { frames: lazyPlateFrames(names, metadata, continuousFrames), height: meta.height, times: meta.times ?? undefined, songTimes: meta.songTimes };
    frameMetadata.set(a, metadata);
  } else {
    // beat-cycled loops load every frame eagerly and keep stable Plate identities
    a = { frames: Array.from({ length: meta.frames }, (_, i) => loadPlate(`${name}_${i}`)), height: meta.height, times: meta.times ?? undefined };
  }
  cache.set(name, a);
  return a;
}

// The frame to show at time t: `beats` = how many beats one full cycle takes (2 = a cycle every two beats);
// `offset` shifts the cycle (in frames) so several dancers aren't in lockstep; `pingpong` plays 0..n-1..0.
export function frameAt(a: Anim, t: number, beats = 2, offset = 0, pingpong = false) {
  const n = a.frames.length;
  // continuous phrases use absolute song timestamps and never wrap into a reset
  if (a.songTimes) {
    // Song timestamps are serialized to 7 decimals. Treat an exact render
    // frame boundary as equal despite up to 50 ns of decimal rounding.
    const boundaryTime = t + 1e-7;
    let lo=0,hi=n;
    while(lo<hi){const mid=(lo+hi)>>>1;if(a.songTimes[mid]!<=boundaryTime)lo=mid+1;else hi=mid;}
    return a.frames[Math.max(0,lo-1)]!;
  }
  const u = (((beatPos(t) / beats) % 1) + 1) % 1;
  if (a.times && !pingpong) {
    // frames sit at authored positions in the cycle: show the last one whose time has come
    const uu = ((u + offset / n) % 1 + 1) % 1;
    let k = 0;
    for (let i = 0; i < n; i++) if (a.times[i]! <= uu) k = i;
    return a.frames[k]!;
  }
  if (!pingpong) return a.frames[(Math.floor(u * n) + offset + n * 4) % n]!;
  const m = 2 * n - 2;
  const k = (Math.floor(u * m) + offset + m * 4) % m;
  return a.frames[k < n ? k : m - k]!;
}

export function drawAnimAt(fb: Frame, a: Anim, t: number, x: number, y: number, o: { beats?: number; offset?: number; pingpong?: boolean } & PlateOpts = {}) {
  const { beats, offset, pingpong, ...rest } = o;
  const p = frameAt(a, t, beats ?? 2, offset ?? 0, pingpong ?? false);
  return drawPlateAt(fb, p, x, y, 0.5, 1, rest);
}
