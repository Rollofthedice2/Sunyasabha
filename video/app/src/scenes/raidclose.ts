// Raid close-ups (verse 3), each a prepared plate with the siren and the beat alive on it:
// 131.8 "A siren — where the subwoofer roared": the speaker stack; the cones kick, pressure rings, siren sweeps.
// 134.3 "Boots on the stairs, badges at the door": low on the stairs, armoured boots; the badge glints.
// 136.8 "Everyone on the ground! Now!": the riot helmet fills the frame, the crowd reflected in the visor, the
//       red scanner line sweeping, the megaphone shouting rings on the beat.
import { Frame, W, hex } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { line } from '../engine/vec2d.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { siren } from './raid.ts';
import { beatHit } from '../engine/music.ts';

export const SUB = 131.8, BOOTS = 134.3, MEGA = 136.8;
// the boots stand at the foot of the broad entrance stairs, between the balustrades, in the doorway glare
const SUBP = loadPlate('subwoofer_bg'), BOOTP = loadPlate('boots_stairs_A02'), HELM = loadPlate('helmet_bg');

export function drawRaidclose(fb: Frame, t = 132.5) {
  if (t < BOOTS) return drawSub(fb, t);
  if (t < MEGA) return drawBoots(fb, t);
  return drawMega(fb, t);
}

// the siren's light sweeping across a plate: a soft diagonal band in the flash colour
function sweep(x: number, y: number, t: number) {
  const s = siren(t);
  const x0 = ((t * 1.3) % 1) * (W + 300) - 150;
  const f = Math.max(0, 1 - Math.abs(x - x0 - (y - 180) * 0.3) / 120);
  return 0.35 * f * (0.4 + 0.6 * s.k);
}

function drawSub(fb: Frame, t: number) {
  const s = siren(t), hit = beatHit(t, 8);
  drawPlate(fb, SUBP, 0, 0, { mul: (x, y) => {
    const w = sweep(x, y, t);
    let cone = 0;
    for (const cx of [154, 474]) { const d = Math.hypot(x - cx, y - 173); if (d < 118) cone = 1 - d / 118; }
    // the cone has jumped forward: lit on top, shaded below
    const k = 1 + cone * hit * 0.35 * (y < 173 ? 1 : -0.6);
    return [k + w * s.col[0] * 2, k + w * s.col[1] * 2, k + w * s.col[2] * 2];
  } });
  for (const cx of [154, 474]) {
    const age = 1 - hit;
    if (hit > 0.05) for (let a = 0; a < Math.PI * 2; a += 0.01) { const rr = 110 * (0.9 + age * 0.9); fb.add(cx + Math.cos(a) * rr, 173 + Math.sin(a) * rr, [0.6, 0.7, 1], 0.25 * hit); }
    if (hit > 0.3) for (let k = 0; k < 24; k++) { const a = k * 1.3; fb.set(cx + Math.cos(a) * 60, 173 + Math.sin(a) * 60 - hit * 10, P.gry4); }
  }
}

function drawBoots(fb: Frame, t: number) {
  const s = siren(t);
  // a single illustrated detail with fixed camera and stair contacts: only the light changes
  drawPlate(fb, BOOTP, 0, 0, { mul: (x, y) => { const w = sweep(x, y, t); const k = 1 + 0.15 * s.k; return [k + w * s.col[0] * 2, k + w * s.col[1] * 2, k + w * s.col[2] * 2]; } });
  if (s.k > 0.6) { fb.glow(102, 320, 14, hex('#fff0c0'), 0.35); fb.set(100, 318, P.white); }
}

function drawMega(fb: Frame, t: number) {
  const s = siren(t), hit = beatHit(t, 5);
  drawPlate(fb, HELM, 0, 0, { mul: (x, y) => {
    const k = 1 + 0.12 * s.k * Math.max(0, 1 - Math.hypot(x - 320, y - 170) / 400);
    return [k + 0.25 * s.k * s.col[0], k + 0.25 * s.k * s.col[1], k + 0.25 * s.k * s.col[2]];
  } });
  const sx = 305 + Math.sin(t * 5) * 140;
  line(fb, `M${sx - 24},140 L${sx + 24},140`, P.red6, undefined, 2);
  fb.glow(sx, 140, 26, hex('#ff2020'), 0.35);
  fb.glow(305, 145, 160, hex('#ff2020'), 0.05 + 0.12 * hit, 2.5);
  for (let r = 1; r <= 3; r++) {
    const rr = 20 + r * 24 + (1 - hit) * 20;
    for (let a = -0.9; a < 0.9; a += 0.02) fb.add(600 + Math.cos(a) * rr * 0.4 + 30, 245 + Math.sin(a) * rr, [1, 0.3, 0.3], 0.3 * hit / r);
  }
}
