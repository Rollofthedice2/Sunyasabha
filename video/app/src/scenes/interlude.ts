// Cutaways drawn from generated plates, each playing its own timed schedule.
// The break (60.06-66.84, four-on-the-floor kicks, bars at 61.561 / 63.311 / 65.064, no lyric until "bha-gi" 66.706) is cut on the kicks:
//   rave hands 60.06-61.998 | balcony 61.998-62.873 | stomp 62.873-63.749 | drink 63.749-65.064 | texter 65.064-65.94 | turn to her 65.94-66.84
// After "Therefore we dance" the doorman's warning runs before the raid: exterior 123.169 | close-up 124.601 | the stair run 126.352-128.1.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate, type Plate } from '../engine/plate.ts';

const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
const cache = new Map<string, Plate>();
const plate = (n: string) => { if (!cache.has(n)) cache.set(n, loadPlate(n)); return cache.get(n)!; };
export const INTERLUDE_CUTS: { from: number; to: number; id: string }[] = [{ from: 63.749, to: 65.064, id: 'int-drink' }, { from: 65.064, to: 65.94, id: 'int-texter' }];
export const BREAK_CUTS: { from: number; to: number; id: string }[] = [{ from: 60.06, to: 61.998, id: 'break-a' }, { from: 61.998, to: 62.873, id: 'break-bal' }, { from: 62.873, to: 63.749, id: 'break-b' }, { from: 65.94, to: 66.84, id: 'break-c' }];
export const WARN_CUTS: { from: number; to: number; id: string }[] = [{ from: 123.169, to: 124.601, id: 'warn-1' }, { from: 124.601, to: 126.352, id: 'warn-2' }, { from: 126.352, to: 128.1, id: 'warn-3' }];
export const INTERLUDE_ON = true;

// Schedule files (assets/plates/int_<cut>.json): one stable background, only the performer changes; each entry shows a drawing from
// `at` seconds after the cut starts. The close-up and the stair run use their extended schedules (int_warn-2_v2 / int_warn-3_v2).
const SCHEDULE_FILE: Record<string, string> = { 'warn-2': 'int_warn-2_v2.json', 'warn-3': 'int_warn-3_v2.json' };
const schedules = new Map<string, { plate: string; at: number }[]>();
function scheduled(cut: string, t: number, from: number) {
  if (!schedules.has(cut)) schedules.set(cut, (JSON.parse(readFileSync(path.join(DIR, SCHEDULE_FILE[cut] ?? `int_${cut}.json`), 'utf8')) as { schedule: { plate: string; at: number }[] }).schedule);
  const sch = schedules.get(cut)!;
  let name = sch[0]!.plate; for (const e of sch) if (t - from >= e.at - 1e-9) name = e.plate;
  return name;
}

export function drawInterludeCut(id: string) {
  const cut = [...INTERLUDE_CUTS, ...BREAK_CUTS, ...WARN_CUTS].find((c) => c.id === id)!;
  return (fb: Frame, t: number) => drawPlate(fb, plate(scheduled(id.replace('int-', ''), t, cut.from)), 0, 0);
}
