// Close-up of the DJ's eye on the line "ato nṛtyāmaḥ" (121.506-123.169), the dancing crowd reflected in it.
// Two drawings alternate on the measured kicks: eye_dj_0 (base) and eye_dj_1 (the same reflected people a beat later).
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';

export const EYE_FROM = 121.506, EYE_TO = 123.169;
export const EYE_ON = true;
const KICKS = [121.511, 121.948, 122.384, 122.821];

export function drawEye(fb: Frame, t: number) {
  const name = (t >= 121.948 && t < 122.384) || t >= 122.821 ? 'eye_dj_1' : 'eye_dj_0';
  drawPlate(fb, loadPlate(name), 0, 0);
  // the light in the reflection answers each kick: a short red-neon swell inside the iris disc, no geometry change
  let hit = 0; for (const kk of KICKS) { const u = t - kk; if (u >= 0 && u < 0.3) hit = Math.max(hit, Math.exp(-u * 11)); }
  if (hit > 0.01) for (let y = 118; y < 244; y++) for (let x = 236; x < 402; x++) {
    if (((x - 318.5) / 81) ** 2 + ((y - 180) / 62) ** 2 > 1) continue;
    const i = y * fb.w + x; fb.r[i] = fb.r[i]! * (1 + 0.22 * hit); fb.g[i] = fb.g[i]! * (1 + 0.05 * hit); fb.b[i] = fb.b[i]! * (1 + 0.08 * hit);
  }
}
