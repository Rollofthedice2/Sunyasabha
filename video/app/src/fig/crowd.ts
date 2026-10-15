// Crowd dancers as prepared sprites (three people seen from behind, mostly silhouette, blue rim, red glow at the
// feet) in a ladder of sizes, so a figure of any height on screen uses the nearest size and is never resampled.
// The caller adds the movement (a bob on the beat, a sway, a switch between standing and crouched).
import { Frame, type RGB } from '../engine/fb.ts';
import { loadPlate, drawPlateAt, type Plate, type PlateOpts } from '../engine/plate.ts';

// size suffix, figure height in px
const SIZES: [string, number][] = [['xxs', 41], ['xs', 62], ['xs2', 90], ['s', 124], ['m', 179], ['l', 248]];
const cache = new Map<string, Plate | null>();
function get(name: string): Plate | null {
  if (!cache.has(name)) { try { cache.set(name, loadPlate(name)); } catch { cache.set(name, null); } }
  return cache.get(name)!;
}
function pick(kind: string, h: number): Plate | null {
  let best: Plate | null = null, bd = 1e9;
  for (const [sz, fh] of SIZES) {
    const d = Math.abs(Math.log(fh / h));
    if (d < bd) { const p = get(`${kind}_${sz}`); if (p) { bd = d; best = p; } }
  }
  return best;
}

export interface CrowdOpts extends PlateOpts { down?: boolean; tint?: RGB }
// Draw dancer `who` (0..2) with its feet at (x, y), about h px tall. `down` = crouched (the gunfire).
export function drawCrowdSprite(fb: Frame, who: number, x: number, y: number, h: number, o: CrowdOpts = {}) {
  const kind = o.down ? 'crowddown' : `crowd${(((who | 0) % 3) + 3) % 3 + 1}`;
  const p = pick(kind, h) ?? pick(`crowd${(((who | 0) % 3) + 3) % 3 + 1}`, h);
  if (!p) return;
  const { down: _d, tint, ...rest } = o;
  const mul = tint ? (typeof rest.mul === 'function' ? (px: number, py: number) => { const m = (rest.mul as (a: number, b: number) => RGB)(px, py); return [m[0] * tint[0], m[1] * tint[1], m[2] * tint[2]] as RGB; } : tint) : rest.mul;
  drawPlateAt(fb, p, x, y, 0.5, 1, { ...rest, mul });
}

// A sprite as an outline of light only (the body empty, the world showing through): "without own-nature".
export function drawSpriteOutline(fb: Frame, p: Plate, ox: number, oy: number, col: RGB, fill?: RGB) {
  const [bx0, by0, bx1, by1] = p.bbox;
  const at = (px: number, py: number) => px >= 0 && py >= 0 && px < p.w && py < p.h && p.a[py * p.w + px] === 1;
  for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
    if (!at(px, py)) continue;
    const edge = !at(px - 1, py) || !at(px + 1, py) || !at(px, py - 1) || !at(px, py + 1);
    if (edge) fb.set(ox + px, oy + py, col); else if (fill) fb.set(ox + px, oy + py, fill);
  }
}
export function crowdPlate(who: number, h: number, down = false) { return pick(down ? 'crowddown' : `crowd${(((who | 0) % 3) + 3) % 3 + 1}`, h); }
