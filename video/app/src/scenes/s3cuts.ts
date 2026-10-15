// The entry: after the door opens at 13.82 (intro.ts), three held cuts on kick-locked beats push in from the hall to the stage,
// each a baked packed-crowd plate, until the boots at 16.0775.
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate, drawPlateAt } from '../engine/plate.ts';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

export const S3_HALL = 14.671, S3_FLOOR = 15.109, S3_STAGE = 15.546;
const DIR = nodePath.resolve(import.meta.dirname, '../../assets/plates');
const json = (n: string) => JSON.parse(readFileSync(nodePath.join(DIR, `${n}.json`), 'utf8'));
// per cut: the base plate set, and whether it has a groove state (<base>_g1) from one half-beat after the cut
const CUTS = { entry: { base: 's3p_entry', groove: false }, mid: { base: 's3p_mid_dj2', groove: true }, front: { base: 's3p_front', groove: true } } as const;
// entry: a few people raise their arms at staggered moments, each a full-frame cut-out (alpha = that person only), 'half' then 'up'
const ENTRY_ARMS = (json('s3p_entry_arms') as { people: { id: string; start_offset_s: number; half_s?: number }[] }).people;
// front: the plate's empty deck takes the seated DJ at 'dj' [x, y]; the console rectangle 'deck_occluder' is redrawn over him
const FRONT = json('s3p_front_0') as { dj: [number, number]; deck_occluder: [number, number, number, number] };

function s3p(fb: Frame, cut: keyof typeof CUTS, t: number, t0: number) {
  const { base, groove } = CUTS[cut], half = 0.4376 / 2;
  const p = loadPlate(groove && t - t0 >= half ? `${base}_g1` : `${base}_0`); drawPlate(fb, p, 0, 0);
  if (cut === 'entry') for (const a of ENTRY_ARMS) {
    const u = t - t0 - a.start_offset_s;
    if (u >= 0) drawPlate(fb, loadPlate(`s3p_entry_p${a.id}_${u < (a.half_s ?? 0.06) ? 'half' : 'up'}`), 0, 0);
  }
  if (cut === 'front') {
    // the seated DJ, scaled to the plate's stage, behind the consoles
    drawPlateAt(fb, loadPlate('s3p_dj_front'), FRONT.dj[0], FRONT.dj[1], 0.5, 1);
    const o = FRONT.deck_occluder;
    for (let y = o[1]; y < o[3]; y++) for (let x = o[0]; x < o[2]; x++) { const i = y * p.w + x, j = y * fb.w + x; fb.r[j] = p.r[i]!; fb.g[j] = p.g[i]!; fb.b[j] = p.b[i]!; }
  }
}
// long view down the hall: the stage glows at the far end, a large still crowd fills the floor
export function drawS3Hall(fb: Frame, t: number) { s3p(fb, 'entry', t, S3_HALL); }
// closer: the floor in front of the stage
export function drawS3Floor(fb: Frame, t: number) { s3p(fb, 'mid', t, S3_FLOOR); }
// the stage, with the DJ seated at the decks
export function drawS3Stage(fb: Frame, t: number) { s3p(fb, 'front', t, S3_STAGE); }
