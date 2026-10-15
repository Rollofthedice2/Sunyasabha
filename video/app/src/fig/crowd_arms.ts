// Chorus crowd response: three stage-facing patrons (A, B, C) with four drawings each (low, rise, peak, settle) timed
// to the music. Primary accents are the hand-tapped onsets of the sung "nṛ"; secondary accents are the chorus bar
// downbeats. Each patron responds to a deterministic subset with its own delay and hold, and holds the low pose in
// between, so the participation varies and nobody pumps in lockstep.
import { Frame, type RGB } from '../engine/fb.ts';
import { loadPlate, drawPlateAt, type Plate } from '../engine/plate.ts';
import { hash3 } from './sdf.ts';

export type ArmsPerson = 'A' | 'B' | 'C';
export type ArmsSize = 'mid' | 'near' | 'close';
const PHASES = ['low', 'rise', 'peak', 'settle'] as const;
type Phase = typeof PHASES[number];
const cache = new Map<string, Plate>();
const plate = (p: ArmsPerson, s: ArmsSize, ph: Phase) => { const k = `crowd_arms_${p}_${s}_${ph}`; let v = cache.get(k); if (!v) { v = loadPlate(k); cache.set(k, v); } return v; };

// tapped "nṛ" onsets of lyric lines 10 and 12
export const NRTYA_ONSETS = [45.632, 46.178, 52.37, 53.061];
const BEAT = 0.4378;
// chorus bar downbeats
const DOWNBEATS = Array.from({ length: 24 }, (_, i) => 46.882 + i * 4 * BEAT).filter((t) => t < 55.63);

export interface ArmsCfg { person: ArmsPerson; seed: number; delayBeats: number; riseBeats: number; peakBeats: number; settleBeats: number; pPrimary: number; pSecondary: number }
export const ARMS_DEFAULTS: Record<ArmsPerson, Omit<ArmsCfg, 'seed'>> = {
  A: { person: 'A', delayBeats: 0.0, riseBeats: 0.5, peakBeats: 0.6, settleBeats: 0.6, pPrimary: 1.0, pSecondary: 0.35 },
  B: { person: 'B', delayBeats: 0.25, riseBeats: 0.4, peakBeats: 0.5, settleBeats: 0.5, pPrimary: 0.75, pSecondary: 0.5 },
  // C claps: a short contact, then the hands separate
  C: { person: 'C', delayBeats: 0.125, riseBeats: 0.5, peakBeats: 0.2, settleBeats: 0.5, pPrimary: 0.6, pSecondary: 0.25 },
};

export function armsPhaseAt(cfg: ArmsCfg, t: number): Phase {
  const events: { a: number; peak: boolean }[] = [];
  NRTYA_ONSETS.forEach((a, i) => { if (hash3(cfg.seed, i, 41) < cfg.pPrimary) events.push({ a, peak: true }); });
  DOWNBEATS.forEach((a, i) => { if (hash3(cfg.seed, i, 43) < cfg.pSecondary && !NRTYA_ONSETS.some((n) => Math.abs(n - a) < 2 * BEAT)) events.push({ a, peak: cfg.person === 'C' }); });
  let best: Phase = 'low', rank = 0; const R: Record<Phase, number> = { low: 0, settle: 1, rise: 2, peak: 3 };
  for (const e of events) {
    const r = (t - e.a) / BEAT - cfg.delayBeats; let ph: Phase = 'low';
    if (r >= -cfg.riseBeats && r < 0) ph = 'rise';
    else if (r >= 0 && r < (e.peak ? cfg.peakBeats : 0)) ph = 'peak';
    else if (r >= (e.peak ? cfg.peakBeats : 0) && r < (e.peak ? cfg.peakBeats : 0) + cfg.settleBeats) ph = 'settle';
    if (R[ph] >= rank) { best = ph; rank = R[ph]; }
  }
  return best;
}

export function drawArmsPerson(fb: Frame, t: number, cfg: ArmsCfg, x: number, y: number, size: ArmsSize, light: RGB) {
  drawPlateAt(fb, plate(cfg.person, size, armsPhaseAt(cfg, t)), x, y, 0.5, 1, { mul: light });
}

// A held pose (default low) for shots where the patrons just stand among the crowd, in the size bin nearest to height h.
export function drawArmsHeld(fb: Frame, person: ArmsPerson, x: number, y: number, h: number, light: RGB, phase: Phase = 'low') {
  const bins: [ArmsSize, number][] = [['mid', 112], ['near', 160], ['close', 224]];
  const size = bins.reduce((a, b) => (Math.abs(Math.log(b[1] / h)) < Math.abs(Math.log(a[1] / h)) ? b : a))[0];
  drawPlateAt(fb, plate(person, size, phase), x, y, 0.5, 1, { mul: light });
}

// Respond to a deterministic subset (probability p) of the given accent times; the peak is arms up (C: a brief clap).
export function armsPhaseForAccents(person: ArmsPerson, seed: number, t: number, accents: readonly number[], p: number, delayBeats = 0): Phase {
  const c = ARMS_DEFAULTS[person]; let best: Phase = 'low', rank = 0; const R: Record<Phase, number> = { low: 0, settle: 1, rise: 2, peak: 3 };
  for (let i = 0; i < accents.length; i++) {
    const a = accents[i]!; if (Math.abs(t - a) > 3) continue; if (hash3(seed, i, 47) >= p) continue;
    const r = (t - a) / BEAT - delayBeats; let ph: Phase = 'low';
    if (r >= -c.riseBeats && r < 0) ph = 'rise'; else if (r >= 0 && r < c.peakBeats) ph = 'peak'; else if (r >= c.peakBeats && r < c.peakBeats + c.settleBeats) ph = 'settle';
    if (R[ph] >= rank) { best = ph; rank = R[ph]; }
  }
  return best;
}
export function drawArmsPhase(fb: Frame, person: ArmsPerson, phase: Phase, x: number, y: number, h: number, light: RGB) { drawArmsHeld(fb, person, x, y, h, light, phase); }
