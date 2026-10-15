// The oblique bow: the DJ seen at an angle from the side, bowing into āgatāḥ. Whole generated key drawings on one set plate,
// each stepped in at its anchor on the sung syllables and measured drum attacks. The DJ's figure pixels are kept out of the
// palette snap so the skin keeps its colour, as for the chorus DJ.
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { mouthAt, type Mouth } from '../fig/lipsync.ts';

const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
// [start time, key]: K0 upright as the shot opens mid-word | K0b the downbeat settle (attack 56.318) | K1 on 'a' 57.366 |
// K2 the apex on 'vā' 57.861, held through the line's loudest syllable | K5 on 'ā' 58.696 | K4 on the drum attack 58.948 |
// K5d the bow on the drum attack 59.399 | K6 the hands drop at 59.826, held to the cut.
const SCHED: [number, string][] = [[55.63, 'K0'], [56.32, 'K0b'], [57.366, 'K1'], [57.861, 'K2'], [58.696, 'K5'], [58.948, 'K4'], [59.399, 'K5d'], [59.826, 'K6']];
// Lower-face visemes on the sung onsets (lipsync.mouthAt), only for the keys that have a mouth bank; the other keys keep their
// painted singing mouths. A shape missing from a bank keeps the key's own painted mouth.
const MOUTH: Record<string, Record<Mouth, string | null>> = {
  K0b: { a: 'a', o: 'o', e: 'e', small: 'small', m: null, closed: null },
  K5d: { a: 'a', o: 'o', e: 'small', small: 'small', m: 'closed', closed: 'closed' },
  K1: { a: 'a', o: 'o', e: 'small', small: 'small', m: 'closed', closed: 'closed' } };
export const BOW_OBLIQUE = true;
const cache = new Map<string, { p: ReturnType<typeof loadPlate>; env: Uint8Array }>();
function key(k: string) {
  if (!cache.has(k)) cache.set(k, { p: loadPlate(`bowob_${k}`), env: new Uint8Array(readFileSync(path.join(DIR, `bowob_${k}_env.bin`))) });
  return cache.get(k)!;
}
const mcache = new Map<string, ReturnType<typeof loadPlate>>();
const mouth = (n: string) => { if (!mcache.has(n)) mcache.set(n, loadPlate(n)); return mcache.get(n)!; };
export function drawBowOblique(fb: Frame, t: number) {
  const k = SCHED.reduce((c, [at, n]) => (t >= at - 1e-9 ? n : c), SCHED[0]![1]); const { p, env } = key(k);
  drawPlate(fb, p, 0, 0);
  const bank = MOUTH[k], shape = bank ? bank[mouthAt(t)] : null;
  if (shape && existsSync(path.join(DIR, `bowobm_${k}_${shape}.json`))) { const mp = mouth(`bowobm_${k}_${shape}`); drawPlate(fb, mp, mp.anchor![0], mp.anchor![1]); }
  // the figure envelope marks the DJ's pixels to keep out of the palette snap
  if (fb.w === 640 && fb.h === 360) { const keep = preserveColor(fb); for (let i = 0; i < env.length; i++) if (env[i]) keep[i] = 1; }
}
