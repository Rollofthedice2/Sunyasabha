// The two stage dances on the hall floor among the crowd: E's dance (29.5-34.1) and the F dance (108.759-116.17).
// Each plays composited full frames (f3_<tag>_NNN, 640x360, timed by f3_<tag>.json: fps, t0, n) in their true colour, read
// uncached per frame (a few hundred full-frame plates would bloat the permanent cache).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { drawPlate, readPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';

const DATA = path.resolve(import.meta.dirname, '../../../data');
const PLATES = path.resolve(import.meta.dirname, '../../assets/plates');
// the shot boundaries in song seconds
const CUT = JSON.parse(readFileSync(path.join(DATA, 'stage/cutouts.json'), 'utf8')) as { f: { song_start_s: number; song_end_s: number }; e: { song_start_s: number; song_end_s: number } };
export const S14_IN = CUT.f.song_start_s, S14_OUT = CUT.f.song_end_s, S6_IN = CUT.e.song_start_s, S6_OUT = CUT.e.song_end_s;

type Seq = { tag: string; fps: number; t0: number; n: number };
const seq = (tag: string): Seq => ({ tag, ...(JSON.parse(readFileSync(path.join(PLATES, `f3_${tag}.json`), 'utf8')) as { fps: number; t0: number; n: number }) });
const F_SEQ = seq('f15ab1c'), E_SEQ = seq('Eredo_twos3c');
function drawSeq(fb: Frame, s: Seq, t: number) {
  const i = Math.max(0, Math.min(s.n - 1, Math.floor((t - s.t0) * s.fps)));
  drawPlate(fb, readPlate(`f3_${s.tag}_${String(i).padStart(3, '0')}`), 0, 0); preserveColor(fb).fill(1);
}
// the F dance: three dancers passing a move, centre stage
export function drawStageF(fb: Frame, t: number) { drawSeq(fb, F_SEQ, t); }
// E's full dance in the crowd ring
export function drawStageE(fb: Frame, t: number) { drawSeq(fb, E_SEQ, t); }
