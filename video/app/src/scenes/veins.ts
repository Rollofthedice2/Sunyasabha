// "Where the beat flows like blood through the veins" (16.9 → 19.9): the boots close-up, chest-down, four dancers stomping over the
// close crowd. Prepared full frames (bootsc_v5_fNNN, timed by boots_close_frames.json: t0, fps, n, prefix), stepped, in true colour.
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { preserveColor } from '../engine/post_masks.ts';

export const VEINS_IN = 16.0775;
const META = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data/boots_close_frames.json'), 'utf8')) as { t0: number; fps: number; n: number; prefix: string };
const FRAMES = Array.from({ length: META.n }, (_, j) => loadPlate(`${META.prefix}${String(j).padStart(3, '0')}`));
export function drawVeins(fb: Frame, t = 18) {
  drawPlate(fb, FRAMES[Math.min(META.n - 1, Math.max(0, Math.floor((t - META.t0) * META.fps)))]!, 0, 0); preserveColor(fb).fill(1);
}
