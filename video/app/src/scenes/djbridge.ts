import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { drawPlateAt, drawPlate, loadPlate } from '../engine/plate.ts';
import { pixelFire } from '../fig/pixelfire.ts';
import { drawCrowdResponse, drawCrowdOver } from '../fig/crowd_response.ts';
import { mouthAt } from '../fig/lipsync.ts';

const DATA = path.resolve(import.meta.dirname, '../../../data');
const readData = (n: string) => JSON.parse(readFileSync(path.join(DATA, n), 'utf8'));

// The bridge (94.917 -> 108.759): a 1.25x camera crop of the stage with the DJ seated on the deck top, the crowd in the background
// below his hips, one mudra key per sung line: abhaya 95.284 'Without own-nature', palms-up questioning 99.049 'who has
// own-nature?', karana 101.687 'Neither existent...', dhyana 104.86 'Master Nāgārjuna knew - all this is empty'. Before the first
// line he rests in dhyana.
const KEYS = [0, 1, 2, 3].map((i) => loadPlate(`bridge_mudra_A01_c${i}`));
const LINES: [number, number][] = [[95.284, 0], [99.049, 1], [101.687, 2], [104.86, 3]];
// The seat sits 4 px into the deck-top surface (back edge y200, front ~207), with a soft contact shadow under it.
const SEAT: [number, number] = [320, 204];
// Head groove on the measured bar grid: each beat is a different move and side tilts never repeat back to back. A bar runs
// clockwise (tilt image-left, neutral, tilt image-right, nod on the big snare) or counter-clockwise (tilt right, neutral, tilt left,
// nod); each reversal pivots on a fully visible nod, so the head swings back the way it came. The last line's bars ('all this is
// empty') hold the chin up, back to neutral on the final bar's beat 3. Head states: 0 nod, 1 tilt image-left, 2 tilt image-right,
// 3 chin up, -1 neutral.
const BARS = [94.833, 96.585, 98.335, 100.084, 101.832, 103.582, 105.332, 107.085, 108.837];
const BAR_CW = [true, true, false, false, false, true];
function headAt(t: number): number {
  let b = -1; for (let i = 0; i + 1 < BARS.length; i++) if (t >= BARS[i]!) b = i;
  // before the first sung line: still
  if (b < 0 || t < 95.284) return -1;
  // the dhyana key enters on the nod
  if (t >= 104.86 && t < 104.894) return 0;
  const beat = Math.floor((t - BARS[b]!) / ((BARS[b + 1]! - BARS[b]!) / 4));
  if (b >= 6) return b === 7 && beat >= 2 ? -1 : 3;
  const CW = BAR_CW[b] ?? true;
  return (CW ? [1, -1, 2, 0] : [2, -1, 1, 0])[Math.min(3, beat)]!;
}
// On a held key each head state is a whole-body groove drawing bridge_wg_c<key>_h<state> (head, shoulders and chest move together,
// legs and seat fixed, hands in the mudra); its lips are the lower-face viseme rotated to the drawing's measured face angle, centred
// on its measured mouth position.
const WG = readData('bridge_wg_mouths.json') as Record<string, { pos: number[]; angle: number; zncc: number }>;
// The r in 'sarvam' is trilled (~108.00-108.27, from the lead stem's 25-33 Hz periodicity): the jaw holds a steady half-open 'e'
// through the trill and the vowel opens after it.
const TRILL: [number, number] = [108.002, 108.27];
const bridgeMouthAt = (t: number) => (t >= TRILL[0] && t < TRILL[1] ? 'e' : mouthAt(t));
const MSHAPE: Record<string, string | null> = { a: 'a', o: 'o', e: 'e', small: 'small', m: null, closed: null };
// Whole lower-face visemes for the neutral head: bridgelf_<shape>, positioned per key, with their offset against the lips position
// the transition drawings were matched to.
const mouthCache = new Map<string, { p: ReturnType<typeof loadPlate>; pos: [number, number][]; off: [number, number] }>();
function bridgeMouth(shape: string) {
  const n = `bridgelf_${shape}`;
  if (!mouthCache.has(n)) { const j = JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../../assets/plates/${n}.json`), 'utf8')); mouthCache.set(n, { p: loadPlate(n), pos: j.pos_per_key, off: (j.offset_vs_B1 ?? [0, 0]) as [number, number] }); }
  return mouthCache.get(n)!;
}
// Transition drawings carry lip sync too: the neutral lower-face viseme placed at each drawing's face-matched mouth position.
const TR_MOUTH = readData('bridge_transition_mouths.json') as Record<string, { pos: [number, number]; accept: boolean }>;
function drawTransition(fb: Frame, t: number, name: string) {
  const [ox, oy] = drawPlateAt(fb, loadPlate(name), SEAT[0], SEAT[1]);
  const m = TR_MOUTH[name], shape = MSHAPE[bridgeMouthAt(t)] ?? null;
  if (!m?.accept || !shape) return;
  const mp = bridgeMouth(shape); drawPlate(fb, mp.p, ox + m.pos[0] + mp.off[0], oy + m.pos[1] + mp.off[1]);
}
// the lower-face viseme for a whole-body groove drawing, centred on its measured mouth
function drawGrooveMouth(fb: Frame, shape: string | null, k: number, head: number, ox: number, oy: number) {
  if (!shape) return;
  const mp = loadPlate(`bridgelf_${shape}_wg_c${k}_h${head}`), c = WG[`bridge_wg_c${k}_h${head}`]!.pos;
  drawPlate(fb, mp, ox + c[0]! - Math.round(mp.w / 2), oy + c[1]! - Math.round(mp.h / 2));
}
// The stage plate with the painted flames removed, the animated pixel fire at the bowl rims (128,190) / (512,190) scaled to the
// bowl width, and a soft contact shadow on the deck top under the seat.
function drawStage(fb: Frame, t: number, win?: { from: number; to: number; hAll: boolean }) {
  drawPlate(fb, loadPlate('bridge_bg_z125_noflame'), 0, 0);
  if (win) drawCrowdResponse(fb, 'bridge', t, win); else drawCrowdResponse(fb, 'bridge', t);
  for (const cx of [128, 512]) pixelFire(fb, cx, 190, 56, 120, t, cx, 1);
  for (let y = SEAT[1] - 3; y <= SEAT[1] + 3; y++) for (let x = SEAT[0] - 66; x <= SEAT[0] + 66; x++) {
    const d = Math.hypot((x - SEAT[0]) / 66, (y - SEAT[1]) / 3.5); if (d >= 1) continue;
    const i = y * fb.w + x, s = 1 - 0.5 * (1 - d * d); fb.r[i] = fb.r[i]! * s; fb.g[i] = fb.g[i]! * s; fb.b[i] = fb.b[i]! * s;
  }
}
// The crowd's high-fist arms are drawn in front of the DJ after every draw path.
export function drawDjbridge(fb: Frame, t: number) { drawDjbridgeInner(fb, t); drawCrowdOver(fb, 'bridge', t); }
function drawDjbridgeInner(fb: Frame, t: number) {
  drawStage(fb, t);
  const k = LINES.reduce((c, [at, i]) => (t >= at ? i : c), 3);
  // dhyana -> abhaya: six whole drawings from the first visible frame (94.917) to the abhaya key on the 95.284 onset, slightly
  // easing out
  if (t >= 94.917 && t < 95.284) {
    const SEQ: [number, string][] = [[94.917, 'bridge_T0g_pair_c0'], [94.975, 'bridge_T0g_pair_c1'], [95.033, 'bridge_T0g_six_c2'], [95.093, 'bridge_T0g_six_c3'], [95.155, 'bridge_T0g_six_c4'], [95.219, 'bridge_T0g_six_c5']];
    let n = SEQ[0]![1]; for (const [at, nm] of SEQ) if (t >= at) n = nm;
    drawTransition(fb, t, `${n}_v2`); return;
  }
  // the mudra changes: each is one consistent sheet of 8 drawings (the head and shoulders keep the beat's tilts through the change),
  // spread evenly from one step before the change to the next key (~15 drawings/s)
  for (const [key, a, b] of [['T1', 98.52, 99.049], ['T2', 101.21, 101.687], ['T3', 104.31, 104.86]] as [string, number, number][])
    if (t >= a && t < b) { drawTransition(fb, t, `bridge_gsh2_${key}_c${Math.min(7, Math.floor((t - a) / (b - a) * 8))}`); return; }
  const head = headAt(t), shape = MSHAPE[bridgeMouthAt(t)] ?? null;
  if (head >= 0) {
    const [ox, oy] = drawPlateAt(fb, loadPlate(`bridge_wg_c${k}_h${head}`), SEAT[0], SEAT[1]);
    drawGrooveMouth(fb, shape, k, head, ox, oy); return;
  }
  const [ox, oy] = drawPlateAt(fb, KEYS[k]!, SEAT[0], SEAT[1]);
  if (shape) { const m = bridgeMouth(shape); drawPlate(fb, m.p, ox + m.pos[k]![0], oy + m.pos[k]![1]); }
}
// The bridge's own shot returns for "vayaṃ tu etaj jānīmaḥ" (from 116.17): the same camera plate, fire and crowd response on the
// same 2-beat phase (the high fists every 4th cycle only), the seated DJ with the bridge's head groove and lower-face lip sync.
// Whole-figure keys per head state; lips are the lower-face bank of that head state at the face-matched position.
const BHUMI = readData('bridge156_mouths.json') as Record<string, { bank_suffix: string; pos_lf: [number, number]; accept?: boolean }>;
// Every bar runs counter-clockwise (tilt right, neutral, tilt left, nod), so the tilt flips across each bar line. Downbeats from
// data/audio.json.
const R_BARS = [115.849, 117.600, 119.350, 121.101, 122.851];
function headAtReprise(t: number): number {
  let b = -1; for (let i = 0; i + 1 < R_BARS.length; i++) if (t >= R_BARS[i]!) b = i;
  if (b < 0) return -1;
  const beat = Math.min(3, Math.floor((t - R_BARS[b]!) / ((R_BARS[b + 1]! - R_BARS[b]!) / 4)));
  return [2, -1, 1, 0][beat]!;
}
// Look-down / look-up in the drum pause before 'ato nṛtyāmaḥ' (last kick 119.30-119.50, silence from ~119.60 past the 121.506 cut):
// the groove stops and six drawings (lowering, bowed at the touching hand, rising, upright, face lifted, eyes open) play on
// 119.70 / 119.90 (held through the breath) / 120.75 / 120.98 / 121.20 / 121.38.
const LOOK = [119.70, 119.90, 120.75, 120.98, 121.20, 121.38];
export function drawBridgeReprise(fb: Frame, t: number, from: number, to: number): boolean {
  const win = { from, to, hAll: false };
  drawStage(fb, t, win);
  const head = headAtReprise(t), shape = MSHAPE[mouthAt(t)] ?? null;
  const drawKey = (n: string) => {
    const [ox, oy] = drawPlateAt(fb, loadPlate(n), SEAT[0], SEAT[1]), fm = BHUMI[n];
    if (shape && fm && fm.accept !== false) drawPlate(fb, loadPlate(`bridgelf_${shape}${fm.bank_suffix}`), ox + fm.pos_lf[0], oy + fm.pos_lf[1]);
    drawCrowdOver(fb, 'bridge', t, win); return true;
  };
  // dhyana -> bhūmisparśa: the hand lifts at the belly, passes the thigh and the knee, fingertips reach the deck edge, then the key
  // lands on the 117.600 downbeat
  if (t >= 117.162 && t < 117.600) return drawKey(`bridge156_T4_A01_c${t >= 117.50 ? 3 : t >= 117.40 ? 2 : t >= 117.27 ? 1 : 0}`);
  if (t >= 119.70) {
    let i = 0; for (let q = 0; q < LOOK.length; q++) if (t >= LOOK[q]!) i = q;
    return drawKey(`bridge156_look_A01_c${i}`);
  }
  // bhūmisparśa key cells: c0 neutral, c1 nod, c2 tilt image-right, c3 tilt image-left
  if (t >= 117.600) return drawKey(`bridge156_bhumi_A01_c${head < 0 ? 0 : head === 0 ? 1 : head === 1 ? 3 : head === 2 ? 2 : 0}`);
  // before the gesture he holds the dhyana key he ended the bridge on, with the same whole-body groove drawings
  const k = 3;
  if (head >= 0) {
    const [ox, oy] = drawPlateAt(fb, loadPlate(`bridge_wg_c${k}_h${head}`), SEAT[0], SEAT[1]);
    drawGrooveMouth(fb, shape, k, head, ox, oy);
  } else {
    const [ox, oy] = drawPlateAt(fb, KEYS[k]!, SEAT[0], SEAT[1]);
    if (shape) { const m = bridgeMouth(shape); drawPlate(fb, m.p, ox + m.pos[k]![0], oy + m.pos[k]![1]); }
  }
  drawCrowdOver(fb, 'bridge', t, win);
  return true;
}
