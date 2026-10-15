// "Fifteenth time her memory was wiped away" (≈69.4 → 72.8): a close-up of her face; a wipe bar tears down
// through the frame — pixels displaced, channels split — and resets her. She blinks, lost for a beat, then her
// eyes find the music again. Then an insert: her forearm, fourteen scratched tallies; she scratches the fifteenth.
import { Frame, W, H, hex } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { line, mulX, translate, scaleX } from '../engine/vec2d.ts';
import { drawSisterFace } from '../fig/sister_face.ts';
import { drawText, textMask } from '../engine/text.ts';
import { beatPos } from '../engine/music.ts';
import { hash3 } from '../fig/sdf.ts';
import { loadPlate, drawPlate, drawPlateAt } from '../engine/plate.ts';

export const WIPE_FROM = 69.4, WIPE_BAR = 70.34, TALLY = 71.6, WIPE_TO = 72.8;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const tmp = new Frame();
// the hall behind her: the camera faces her, so behind her is the entrance end (doorway, the two stone heads beside her head, the crowd),
// the same reverse view as her solo, defocused like a close-up lens
const BG = loadPlate('wipe_bg_rev_b2');

export function drawWipe(fb: Frame, t = 70.5) {
  if (t >= TALLY) return drawTally(fb, t);
  drawPlate(fb, BG, 0, 0);
  // her face, large; a slow push in
  const k = 2.0 + 0.08 * (t - WIPE_FROM);
  const m = mulX(translate(320, 196), mulX(scaleX(k), translate(-358, -150)));
  const since = t - WIPE_BAR;
  const blink = since > 0 && since < 0.35 ? 1 : since > 0.35 && since < 0.5 ? 0.5 : 0;
  const gaze: [number, number] = since > 0.5 && since < 1.1 ? [Math.sin(since * 9) * 0.8, 0.2] : [0, 0];
  drawSisterFace(fb, m, { blink, gaze, ring: since > 0 && since < 1.2 ? 1 : 0.4, braidSwing: Math.sin(beatPos(t) * Math.PI) * 0.3 });

  // the wipe bar: a band sweeping down; inside it pixels are displaced and channels split; behind it, a reset flash
  if (since > -0.05 && since < 0.45) {
    tmp.copyFrom(fb);
    const y0 = -40 + (since / 0.45) * (H + 80);
    for (let y = Math.max(0, Math.floor(y0 - 26)); y < Math.min(H, y0 + 26); y++) {
      const off = Math.round((hash3(Math.floor(y / 3), Math.floor(since * 40), 52) - 0.5) * 60);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const sx = Math.max(0, Math.min(W - 1, x + off));
        fb.r[i] = tmp.r[y * W + Math.min(W - 1, sx + 4)]!; fb.g[i] = tmp.g[y * W + sx]!; fb.b[i] = tmp.b[y * W + Math.max(0, sx - 4)]!;
        if (Math.abs(y - y0) < 2) { fb.r[i] = 0.9; fb.g[i] = 0.95; fb.b[i] = 1; }
      }
    }
    // above the bar (already wiped): desaturated, cold, flickering
    for (let y = 0; y < Math.min(H, y0 - 26); y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, l = 0.3 * fb.r[i]! + 0.6 * fb.g[i]! + 0.1 * fb.b[i]!;
      const f = 0.6 + 0.4 * (hash3(x >> 2, y >> 2, Math.floor(since * 30)) > 0.5 ? 1 : 0);
      fb.r[i] = l * 0.5 * f; fb.g[i] = l * 0.7 * f; fb.b[i] = l * 1.1 * f;
    }
  }
  if (since > 0.45 && since < 0.6) for (let i = 0; i < W * H; i++) { fb.r[i]! += 0.3; fb.g[i]! += 0.35; fb.b[i]! += 0.45; }
  // the counter, terse, machine-voiced: "15"
  if (since > 0.2 && since < 1.3) {
    const tm = textMask('wipe15_v2');
    drawText(fb, 'wipe15_v2', 320 - tm.w / 2, 28, Math.floor(since * 8) % 2 ? P.cy1 : P.cy0);
  }
}

// her left forearm across the frame (a prepared plate): fourteen tallies cut into the skin; her robotic right hand cuts the
// fifteenth, the metal fingertip following the stroke, a contact shadow under it.
const ARM = loadPlate('tally_arm');
// the hand's four drawings: hover, press (two along the stroke), lift; each placed by its own fingertip anchor
const RHAND = [0, 1, 2, 3].map((i) => loadPlate(`tally_rhand_${i}`));
function drawTally(fb: Frame, t: number) {
  drawPlate(fb, ARM, 0, 0);
  // the arm's axis on the plate runs from the wrist (lower left) up to the elbow (upper right)
  // u: along the arm; n: across the arm, down-right
  const ux = 1 / Math.hypot(1, 0.41), uy = -0.41 / Math.hypot(1, 0.41), nx = -uy, ny = ux;
  const centre = (x: number) => 318 - 0.41 * x;
  // a cut: a dark line with a pale lip on its upper-left side (the skin lit from the red neon above)
  const cut = (x0: number, y0: number, x1: number, y1: number) => {
    line(fb, `M${x0 - nx * 2},${y0 - ny * 2} L${x1 - nx * 2},${y1 - ny * 2}`, P.skn6);
    line(fb, `M${x0},${y0} L${x1},${y1}`, hex('#2a0c0a'), undefined, 2);
    line(fb, `M${x0 + nx},${y0 + ny} L${x1 + nx},${y1 + ny}`, P.red2);
  };
  const marks: [number, number][] = [];
  for (let g = 0; g < 3; g++) for (let k = 0; k < 5; k++) { const x = 226 + g * 70 + k * 12; marks.push([x, centre(x)]); }
  marks.forEach(([x, y], i) => {
    const strike = i % 5 === 4;
    // the fifteenth is being cut now
    if (strike && i === 14) return;
    if (strike) { const [x0, y0] = marks[i - 4]!; cut(x0 - ux * 4 + nx * 11, y0 - uy * 4 + ny * 11, x + ux * 4 - nx * 11, y + uy * 4 - ny * 11); }
    else cut(x - nx * 10, y - ny * 10, x + nx * 10, y + ny * 10);
  });
  // the fifteenth: the strike across the last group, drawn now, bottom-left to top-right, the stroke following the beat
  const u = smooth((t - TALLY - 0.15) / 0.5);
  const [sx, sy] = marks[10]!, [ex, ey] = marks[14]!;
  const x0 = sx - ux * 4 + nx * 11, y0 = sy - uy * 4 + ny * 11, x1 = ex + ux * 4 - nx * 11, y1 = ey + uy * 4 - ny * 11;
  const fx = x0 + (x1 - x0) * u, fy = y0 + (y1 - y0) * u;
  if (u > 0) { line(fb, `M${x0 - nx * 2},${y0 - ny * 2} L${fx - nx * 2},${fy - ny * 2}`, P.skn6); line(fb, `M${x0},${y0} L${fx},${fy}`, P.red5, undefined, 2); line(fb, `M${fx - 1},${fy} L${fx + 1},${fy}`, P.white); }
  // the hand: nail on the stroke; after the stroke it lifts away
  const lift = smooth((t - TALLY - 0.72) / 0.25);
  // contact shadow on the skin under the fingertip
  if (lift < 1) for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) if ((dx * dx) / 36 + (dy * dy) / 9 <= 1) fb.mul(fx + dx + 2, fy + dy + 2, [0.55, 0.5, 0.6]);
  // hover before the stroke (71.6 + 0.15), press until +0.65, lift from +0.72; a hot glow at the tip while pressing
  const st = u <= 0 ? 0 : lift > 0 ? 3 : u < 0.5 ? 1 : 2, ph = RHAND[st]!;
  const px = Math.round(fx + 6 * lift), py = Math.round(fy - (st === 0 ? 3 : 0) - 9 * lift);
  drawPlateAt(fb, ph, px, py);
  if (st === 1 || st === 2) { fb.glow(fx, fy, 5, hex('#ff6040'), 0.9); fb.glow(fx, fy, 2, hex('#fff2d0'), 1.0); }
}
