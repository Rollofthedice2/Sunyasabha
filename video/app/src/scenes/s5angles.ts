// Dramatic DJ angles cut on the word onsets of the throne line, unanimated except for light:
//   24.936  low-angle chest from inside the crowd
//   26.261  profile close-up (codeprofile.drawDjprofile)
//   27.181  frontal face close-up on the throne, eyes closed
// Rim light breathes with the kick and the frame settles one pixel on the beat; no rescaling, which would make the pixels crawl.
import { Frame, W, H } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { beatHit, env } from '../engine/music.ts';
import { vnoise } from '../fig/sdf.ts';

export const S5_CHEST = 24.936, S5_PROFILE = 26.261, S5_FACE = 27.181, S5_OUT = 28.257;
// the DJ's canonical look: robe over his left shoulder, bare tattooed right arm
const CHEST = loadPlate('dj_canon_chest_bg'), FACE = loadPlate('dj_canon_face_closed');

// rim/neon breathing: brighten the saturated blue/red rim pixels a little on the kick, leave skin and darks alone
function breathe(fb: Frame, t: number, amt: number) {
  const k = 1 + amt * env('drums', t);
  for (let i = 0; i < W * H; i++) {
    const r = fb.r[i]!, g = fb.g[i]!, b = fb.b[i]!, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 0.25 && mx - mn > 0.5 * mx && (b === mx || r === mx && g < 0.4 * r)) { fb.r[i] = Math.min(1, r * k); fb.g[i] = Math.min(1, g * k); fb.b[i] = Math.min(1, b * k); }
  }
}

export function drawS5Chest(fb: Frame, t: number) {
  const nod = Math.round(beatHit(t, 6));
  drawPlate(fb, CHEST, 0, -nod);
  if (nod) for (let x = 0; x < W; x++) { const i = (H - 1) * W + x, j = (H - 2) * W + x; fb.r[i] = fb.r[j]!; fb.g[i] = fb.g[j]!; fb.b[i] = fb.b[j]!; }
  // a clean detail insert: the crowd is in view in the wide throne and cover shots around it
  breathe(fb, t, 0.12);
}

export function drawS5Face(fb: Frame, t: number) {
  // the blue flames' flicker on the whole frame
  const fl = 0.94 + 0.08 * vnoise(t * 3, 0, 91);
  const nod = Math.round(beatHit(t, 6));
  drawPlate(fb, FACE, 0, nod, { mul: [fl, fl, fl * 1.03] });
  if (nod) for (let x = 0; x < W; x++) { fb.r[x] = fb.r[x + W]!; fb.g[x] = fb.g[x + W]!; fb.b[x] = fb.b[x + W]!; }
  breathe(fb, t, 0.1);
}
