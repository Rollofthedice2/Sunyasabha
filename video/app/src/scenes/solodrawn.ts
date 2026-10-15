// The titanium solo (72.8-79.6): composited full frames (f3_Tredo_t12b_NNN, timed by f3_Tredo_t12b.json: fps, t0, n) drawn in true colour.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Frame } from '../engine/fb.ts';
import { drawPlate, readPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';

const TAG = 'Tredo_t12b';
const META = JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../../assets/plates/f3_${TAG}.json`), 'utf8')) as { fps: number; t0: number; n: number };
export function drawSolodrawn(fb: Frame, t = 74) {
  const i = Math.max(0, Math.min(META.n - 1, Math.floor((t - META.t0) * META.fps)));
  drawPlate(fb, readPlate(`f3_${TAG}_${String(i).padStart(3, '0')}`), 0, 0); preserveColor(fb).fill(1);
}
