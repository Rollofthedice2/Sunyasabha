// "Love cannot be extinguished by code" (83.2 → 88.08): two profiles, foreheads touching, eyes closed — the
// sister (shaved head, braid) and her partner (wet curls) — who then kiss. Between them, cupped in their
// hands, a small red flame (engine-drawn, flickering). A torrent of glyphs pours across the frame; where it
// reaches the flame it burns away. The flame stays.
import { Frame, W, H, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { path } from '../engine/vec2d.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { env } from '../engine/music.ts';
import { hash3, vnoise } from '../fig/sdf.ts';

export const FH_FROM = 83.2;
// The kiss: four whole drawings registered on the hands, ears and braid. It opens and closes on c0 (foreheads touching).
// Sung onsets: ma 84.676 -> c1 (noses passing), kU 84.976 -> c2 (the kiss, held), pya 86.671 -> c3 (lips part);
// the return to c1 at 87.392 and c0 at 87.827 sits on measured kicks.
const KISS = [0, 1, 2, 3].map((i) => loadPlate(`kiss_A01w_c${i}`));
const KISS_T: [number, number][] = [[84.676, 1], [84.976, 2], [86.671, 3], [87.392, 1], [87.827, 0]];
const kissCell = (t: number) => KISS_T.reduce((c, [at, k]) => (t >= at ? k : c), 0);

export function drawForeheads(fb: Frame, t = 85) {
  fb.vgrad(0, H, hex('#05030a'), hex('#0c0714'));
  // a one-pixel breath
  const breathe = Math.round(Math.sin((t - FH_FROM) * 1.6));
  // the flame's base rests on the palm (palm top at y ~305 under x 322), in the cup of their hands
  const fx = 322, fy = 307 + breathe;
  // the code: two tides of glyphs flowing in from both edges towards them, breaking against the flame's
  // halo and burning away; it never reaches the flame
  const rate = 0.7 + 0.5 * env('drums', t);
  for (let row = 0; row < 46; row++) {
    const y = 8 + row * 7.6;
    for (const dir of [-1, 1]) {
      const speed = 70 + hash3(row, dir + 2, 83) * 90;
      for (let k = 0; k < 30; k++) {
        const travel = ((t - FH_FROM) * speed * rate + k * 26 + hash3(row, k, 84) * 20) % 360;
        const x = dir < 0 ? -20 + travel : W + 20 - travel;
        const dist = Math.hypot(x - fx, (y - (fy - 20)) * 1.15);
        const reach = 88 + 10 * Math.sin(t * 6 + row);
        // burned away
        if (dist < reach) continue;
        const heat = Math.max(0, 1 - (dist - reach) / 50);
        if (heat > 0.3 && hash3(row, k, Math.floor(t * 20)) < heat * 0.6) continue;
        const g = Math.floor(hash3(row * 7 + k, dir + 3, Math.floor(t * 10 + k)) * 32768);
        const col: RGB = heat > 0.6 ? P.red6 : heat > 0.2 ? P.red4 : (row + k) % 4 === 0 ? P.blu5 : P.blu3;
        for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if ((g >> (gy * 3 + gx)) & 1) fb.set(x + gx, y + gy, col, 0.9);
      }
    }
  }
  drawPlate(fb, KISS[kissCell(t)]!, 0, 2 + breathe);
  // the flame: small, steady, red with a white heart; its light flickers on their faces
  const fl = 1 + 0.15 * Math.sin(t * 13) + 0.1 * vnoise(t * 5, 1, 1);
  for (const [col, w, h] of [[P.red3, 15, 52], [P.red5, 10, 38], [P.red7, 6, 22], [P.white, 2.5, 10]] as const)
    path(fb, `M${fx - w},${fy - 2} C${fx - w},${fy - h * 0.5 * fl} ${fx + Math.sin(t * 4) * 2},${fy - h * 0.7 * fl} ${fx + Math.sin(t * 5)},${fy - h * fl} C${fx},${fy - h * 0.6 * fl} ${fx + w},${fy - h * 0.4 * fl} ${fx + w},${fy - 2} Z`, { fill: col });
  fb.glow(fx, fy - 22, 130, hex('#ff3020'), 0.16 + 0.2 * (fl - 0.85));
  // light pooling on the palm and fingers, a hot ember where the flame touches, and a few sparks at its root
  fb.glow(fx, fy - 1, 34, hex('#ff7a3a'), 0.30 * fl, 2.8);
  fb.glow(fx, fy - 2, 7, hex('#fff1c8'), 0.55 * fl, 1.8);
  for (let k = 0; k < 3; k++) { const a = t * (3 + k) + k * 2.1; fb.set(fx + Math.round(Math.sin(a) * (3 + k)), fy - 2 - k, [1, 0.9, 0.7], 0.8); }
}
