// "Blue flames blaze — the darkness is burned" (19.9 → 22.9): a close-up of the LEFT brazier (to 20.761), then the RIGHT
// (to 21.844), cut on the sung syllables, then the continuous wide of the DJ on the throne.
// Each close-up is a plate with pixel fire rooted at the measured rim centre (data/braziers.json), drawn at cell 2,
// with the plate's own rim/brace occluder redrawn over it; each side has its own seed so the two flames never share a phase.
import { Frame } from '../engine/fb.ts';
import { drawThrone } from './throne.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { pixelFire } from '../fig/pixelfire.ts';

export const IGNITE_L = 20.45, IGNITE_R = 21.33;

const RIM = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data/braziers.json'), 'utf8')) as Record<'L' | 'R', { root_x: number; root_y: number; opening_w: number }>;
const BRAZIER = { L: loadPlate('early20_brz_L'), R: loadPlate('early20_brz_R') };
const OCCLUDER = { L: loadPlate('early20_brz_L_occ'), R: loadPlate('early20_brz_R_occ') };

export function drawIgnite(fb: Frame, t = 21) {
  if (t >= 21.844) { drawThrone(fb, t); return; }
  const s: 'L' | 'R' = t < 20.761 ? 'L' : 'R', g = RIM[s];
  drawPlate(fb, BRAZIER[s], 0, 0);
  pixelFire(fb, g.root_x, Math.round(g.root_y), Math.round(g.opening_w * 0.42), 120, t, s === 'L' ? 107 : 535, 1, 2);
  drawPlate(fb, OCCLUDER[s], 0, 0);
}
