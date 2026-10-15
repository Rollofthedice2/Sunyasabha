// The robot dancing in a clearing of the packed club (34.1-36.775): forward and back with musical verticality and little horizontal travel.
// Composited full frames (robot3d_r4le_NNN, 640x360, timed by robot3d_r4le.json: fps, t0, n) drawn in their true colour.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { readPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';

const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
const TAG = 'r4le';
const META = JSON.parse(readFileSync(path.join(DIR, `robot3d_${TAG}.json`), 'utf8')) as { fps: number; t0: number; n: number };
export function drawRobot(fb: Frame, t: number) {
  const k = Math.max(0, Math.min(META.n - 1, Math.floor((t - META.t0) * META.fps + 1e-6)));
  // read uncached: holding every full-frame plate in the permanent cache would cost hundreds of MB
  drawPlate(fb, readPlate(`robot3d_${TAG}_${String(k).padStart(3, '0')}`), 0, 0); preserveColor(fb).fill(1);
}
