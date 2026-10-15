// "The soul cannot be governed" (79.6 -> 83.2): from behind her, the club ahead, a cable running from the port in her spine up to
// a bundle hanging from the ceiling rig. At the measured PULL the shot cuts from her grip to her arms thrown up with the cable
// whipping back up to the bundle. Light only: a bass breath before the pull, a flare that settles after it.
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { env } from '../engine/music.ts';

export const CABLE_FROM = 79.6, PULL = 81.28;
const GRIP = loadPlate('cable2_G'), FREE = loadPlate('cable2_F');
export function drawCable(fb: Frame, t = 81) {
  const since = t - PULL, pl = since > 0 ? FREE : GRIP, k = since > 0 ? 1 + 0.18 * Math.exp(-since * 2.5) : 0.96 + 0.08 * env('bass', t);
  drawPlate(fb, pl, 0, 0, { mul: [k, k, k * (since > 0 ? 1.04 : 1)] });
  preserveColor(fb).fill(1);
}
