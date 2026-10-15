// The crowd's response to the beat in the sister and bridge shots: per-group overlay plates of the bounced (B) and
// halfway (C) poses drawn over the static background plate (pose A). Each group cycles B (on the beat) -> C -> A -> C on
// its own phase offset, so compression and recovery are drawn in steps, never dissolved. The schedule (measured beats,
// per-group offsets) is video/data/crowd_response.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
type Sch = { beat0: number; period: number; offsets: number[]; groups: number; from: number; to: number; h?: { every: number; all_from: number } };
let SCH: Record<string, Sch> | undefined;
// win: the same beat phase and cycle shown in another time window (the bridge reprise at 1:56); hAll false = the high
// fist only every 4th cycle (no build)
export function drawCrowdResponse(fb: Frame, shot: 'sister' | 'bridge', t: number, win?: { from: number; to: number; hAll: boolean }) {
  SCH ??= JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data/crowd_response.json'), 'utf8')) as Record<string, Sch>;
  const s0 = SCH[shot] as (Sch & { disabled?: string }) | undefined; if (!s0 || s0.disabled) return;
  const s = win ? { ...s0, from: win.from, to: win.to, h: s0.h && !win.hAll ? { ...s0.h, all_from: Infinity } : s0.h } : s0; if (t < s.from || t >= s.to) return;
  for (let g = 0; g < s.groups; g++) { const st = stateAt(s, g, t); if (st) drawPlate(fb, loadPlate(`${shot}_crowd_${st}_g${g}`), 0, 0); }
}
// H is the high-fist peak in the bridge. H cycles (schedule.h: every 4th 2-beat cycle, then every cycle from the synth
// build at 105.78 s) run H (on the beat) -> B -> C, and the quarter before an H cycle is B, so each high punch rises
// through B and falls back through B and C.
function stateAt(s: Sch, g: number, t: number): string | null {
  const u0 = (t - s.beat0) / s.period - s.offsets[g]!, k = Math.floor(u0), u = u0 - k;
  const isH = (j: number) => !!s.h && j >= 0 && (j % s.h.every === 0 || s.beat0 + j * s.period >= s.h.all_from - 1e-3);
  if (isH(k)) return u < 0.25 ? 'H' : u < 0.5 ? 'B' : u < 0.75 ? 'C' : isH(k + 1) ? 'B' : 'C';
  return u < 0.25 ? 'B' : u < 0.5 ? 'C' : isH(k + 1) ? (u < 0.75 ? 'C' : 'B') : u < 0.75 ? null : 'C';
}
// The high-fist arms that rise in front of the DJ: arm pixels only (bridge_crowd_H_over), drawn after the DJ. Uses the
// schedule loaded by drawCrowdResponse.
export function drawCrowdOver(fb: Frame, shot: 'bridge', t: number, win?: { from: number; to: number; hAll: boolean }) {
  const s0 = SCH?.[shot] as (Sch & { disabled?: string }) | undefined; if (!s0 || s0.disabled) return;
  const s = win ? { ...s0, from: win.from, to: win.to, h: s0.h && !win.hAll ? { ...s0.h, all_from: Infinity } : s0.h } : s0; if (t < s.from || t >= s.to) return;
  if (stateAt(s, 0, t) === 'H') drawPlate(fb, loadPlate(`${shot}_crowd_H_over`), 0, 0);
}
