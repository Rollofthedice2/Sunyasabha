// "Every frequency says - this is your home" (28.257 -> 29.5): the DJ's hands on the mixer, drawings stepped on the measured beats
// (data/controller.json), with a 32-band log-frequency analyser of the mix drawn into the drawing's blank screen
// (data/spectrum_controller.json, with display ballistics and peak hold): LED-segmented bars on dark glass, peak caps, and the bass
// bars glowing on the kick.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame, type RGB } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { beatHit } from '../engine/music.ts';

const DATA = path.resolve(import.meta.dirname, '../../../data');
const SPEC = JSON.parse(readFileSync(path.join(DATA, 'spectrum_controller.json'), 'utf8')) as { t0: number; rate: number; bands: number[][]; peaks: number[][] };
// quad: the display corners TL TR BR BL (perspective)
type C28 = { t0: number; t1: number; keys: [number, string][]; quad: [number, number][] };
const CFG = JSON.parse(readFileSync(path.join(DATA, 'controller.json'), 'utf8')) as C28;
export function drawController28(fb: Frame, t: number): boolean {
  if (t < CFG.t0 || t >= CFG.t1) return false;
  let nm = CFG.keys[0]![1]; for (const [a, n] of CFG.keys) if (t >= a) nm = n;
  drawPlate(fb, loadPlate(nm), 0, 0); preserveColor(fb).fill(1);
  const [TL, TR, BR, BL] = CFG.quad as [[number, number], [number, number], [number, number], [number, number]];
  drawSpectrum(fb, t, TL, TR, BR, BL);
  return true;
}

// The display is a perspective quad: every screen row interpolates the left / right edges, and the bars live in normalised (u, v) space.
function drawSpectrum(fb: Frame, t: number, TL: [number, number], TR: [number, number], BR: [number, number], BL: [number, number]) {
  const S = SPEC, k = Math.max(0, Math.min(S.bands.length - 1, Math.round((t - S.t0) * S.rate))), B = S.bands[k]!, PK = S.peaks[k]!, n = B.length, kick = beatHit(t, 7);
  const yA = Math.ceil(TL[1] + 1), yB = Math.floor(BL[1] - 1), H = yB - yA + 1;
  for (let y = yA; y <= yB; y++) {
    // h: 0 at the bottom -> 1 at the top
    const v = (y - TL[1]) / (BL[1] - TL[1]), xl = TL[0] + (BL[0] - TL[0]) * v + 1, xr = TR[0] + (BR[0] - TR[0]) * v - 1, h = 1 - (y - yA) / Math.max(1, H - 1);
    for (let x = Math.ceil(xl); x <= Math.floor(xr); x++) {
      const u = (x - xl) / (xr - xl), i = Math.min(n - 1, Math.floor(u * n)), inBar = (u * n - i) < 0.7;
      // dark glass + faint grid
      const grid = (y - yA) % 6 === 0 ? 0.05 : 0; fb.set(x, y, [0.02 + grid, 0.03 + grid, 0.06 + grid * 1.5], 0.85);
      if (!inBar) continue;
      // LED segments on even rows; odd rows carry their glow
      const on = h <= B[i]!, seg = (y - yA) % 2 === 0;
      if (on) {
        // neon ramp by height: cyan -> violet -> hot pink
        const a = Math.min(1, h / 0.5), b2 = Math.max(0, (h - 0.5) / 0.5);
        const c: RGB = h < 0.5 ? [0.05 + 0.5 * a, 0.85 - 0.5 * a, 1] : [0.55 + 0.45 * b2, 0.35 - 0.15 * b2, 1 - 0.35 * b2];
        const g = 1 + (i < 5 ? 0.6 * kick : 0);
        if (seg) fb.set(x, y, [Math.min(1, c[0] * g), Math.min(1, c[1] * g), Math.min(1, c[2] * g)], 1);
        else fb.add(x, y, c, 0.35 * g);
      }
      // peak cap
      if (Math.abs(h - PK[i]!) < 0.6 / H && PK[i]! > 0.04) fb.set(x, y, [1, 1, 1], 0.95);
    }
  }
}
