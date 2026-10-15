import { dimSilence } from './outro_turn.ts';
// The DJ in close profile: a prepared profile drawing with mouth shapes driven by the syllables (fig/lipsync.ts), and whole key-pose
// drawings for the sung lines that carry a performance. Behind: the throne's world seen side-on, the ensō's glow, the fire's flicker on
// the face, and (in the code shot) a slow tide of red glyphs rising like heat off the circuitry.
import { Frame, W, H, hex } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { loadPlate, drawPlate, type Plate, type PlateOpts } from '../engine/plate.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mouthAt, type Mouth } from '../fig/lipsync.ts';
import { beatHit, env } from '../engine/music.ts';
import { hash3, vnoise } from '../fig/sdf.ts';

export const CODE_FROM = 87.84;
const MOUTH: Record<Mouth, Plate> = {
  closed: loadPlate('dj_canon_profile'), small: loadPlate('dj_canon_profile_mouth_small'), a: loadPlate('dj_canon_profile_mouth_a'),
  o: loadPlate('dj_canon_profile_mouth_o'), e: loadPlate('dj_canon_profile_mouth_e'), m: loadPlate('dj_canon_profile_mouth_m'),
};

// Inclusive native sprite coordinates of the region every mouth shape changes: lower cheek, lips, moving jaw and the front of the
// throat. The top stays below the eyes, the right stays in front of the earcup, and the bottom meets the neck band.
export const PROFILE_ARTICULATION = [200, 117, 311, 246] as readonly [number, number, number, number];

// Head nod: the head rotates about the head-neck joint (below/behind the ear) and the rotation fades out across the neck band, so the
// body, necklaces and lower hair stay put and the neck bends. Nearest sampling keeps the pixel art crisp; every mouth plate gets the
// identical warp, so the articulation-region swap stays aligned. Cached per plate per 0.1 deg.
const NOD_RIG = { pivot: [370, 190], band: [225, 275] };
const nodCache = new WeakMap<Plate, Map<number, Plate>>();
function nodPlate(p: Plate, deg: number): Plate {
  const q = Math.round(deg * 10) / 10;
  if (Math.abs(q) < 0.05) return p;
  let per = nodCache.get(p);
  if (!per) { per = new Map(); nodCache.set(p, per); }
  let o = per.get(q);
  if (o) return o;
  const { w, h } = p, n = w * h, [px, py] = NOD_RIG.pivot, [b0, b1] = NOD_RIG.band;
  o = { ...p, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Uint8Array(n), bbox: [0, 0, w - 1, h - 1] };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = y <= b0 ? 1 : y >= b1 ? 0 : 1 - (y - b0) / (b1 - b0), wgt = u * u * (3 - 2 * u);
      // nose-down for a left-facing profile = negative screen rotation; the inverse map rotates by +angle to find the source
      const th = (q * Math.PI / 180) * wgt, c = Math.cos(th), s = Math.sin(th);
      const sx = Math.round(px + c * (x - px) - s * (y - py)); let sy = Math.round(py + s * (x - px) + c * (y - py));
      // the body continues below the frame: no gap at the bottom edge
      if (sy >= h) sy = h - 1;
      if (sx < 0 || sy < 0 || sx >= w) continue;
      const i = y * w + x, j = sy * w + sx;
      o.r[i] = p.r[j]!; o.g[i] = p.g[j]!; o.b[i] = p.b[j]!; o.a[i] = p.a[j]!;
    }
  }
  per.set(q, o); return o;
}
const sm01 = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const bump = (t: number, a: number, m: number, b: number) => (t <= a || t >= b ? 0 : t < m ? sm01((t - a) / (m - a)) : 1 - sm01((t - m) / (b - m)));
// "tannāma muktiḥ" (onsets: mu 44.775, ktiḥ 45.055): lead in through the rounded 'u', apex on the unreleased k + t closure, recoil
// slightly past neutral with the t-release into 'i', settle; a half-degree dip on the visarga breath. Degrees, nose-down positive.
export function muktihNod(t: number) {
  return 2.0 * bump(t, 44.95, 45.075, 45.24) - 0.4 * bump(t, 45.17, 45.24, 45.36) + 0.5 * bump(t, 45.36, 45.45, 45.6);
}
// Line prosody for "... kiṃ kampate? / tannāma muktiḥ", a question and its answer: the head lifts into the question and settles into
// the answer, with the muktiḥ nod as the culmination (onsets: kiṃ 42.69, ka 43.12, mpa 43.415, te? 43.59, ta 44.02, nnā 44.345,
// ma 44.61, mu 44.775, ktiḥ 45.055). Heavy syllables carry the small accents. Degrees, nose-down positive, all within ~2 deg.
// The breath lifts the chest and shoulders before the line and in the pause after the question (43.80-44.02); pixels up.
export function profileLineBreath(t: number) {
  if (t < 42.3 || t > 45.83) return 0;
  return 2 * bump(t, 42.3, 42.5, 42.95) + 2 * bump(t, 43.78, 44.0, 44.45);
}
export function profileLineNod(t: number) {
  if (t < 42.45 || t > 45.83) return 0;
  // the phrase arc: chin slightly up through the question
  const question = -1.0 * sm01((t - 42.6) / 0.2) * (1 - sm01((t - 43.95) / 0.3));
  return question - 0.5 * bump(t, 42.6, 42.74, 42.95) + 0.6 * bump(t, 43.06, 43.15, 43.32) - 0.9 * bump(t, 43.5, 43.68, 44.0)
    + 0.8 * bump(t, 43.95, 44.07, 44.3) - 0.5 * bump(t, 44.3, 44.42, 44.6) + muktihNod(t);
}

// Drawn body poses for the singing line: one continuous head-angle curve a(t) (deg, nose-down +) picks the nearest drawn pose
// (P1 chin up with the inhale, P2 neutral, P3 head and upper chest forward-down); only the residual (|r| <= 1.5 deg) uses the warp.
type Pose = 'P1' | 'P2' | 'P3';
// measured drawn head angles against the neutral drawing
const POSE_ANG: Record<Pose, number> = { P1: -5, P2: 0, P3: 9.5 };
const POSE_SET = (() => {
  const reg = (n: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../../assets/plates/${n}.json`), 'utf8')).articulation640 as [number, number, number, number];
  return {
    P1: { base: loadPlate('dj_canon_profile_P1'), m: { e: 'e', a: 'a', small: 'small', o: 'small' } as Record<string, string>, region: reg('dj_canon_profile_P1'), pre: 'dj_canon_profile_P1_mouth_' },
    P3: { base: loadPlate('dj_canon_profile_P3'), m: { small: 'small', o: 'o', e: 'e', a: 'e' } as Record<string, string>, region: reg('dj_canon_profile_P3'), pre: 'dj_canon_profile_P3_mouth_' },
  };
})();
const plat = (t: number, a: number, b: number, r: number) => sm01((t - a) / r) * (1 - sm01((t - b) / r));
export function profileLineAngle(t: number) {
  if (t < 42.45 || t > 45.83) return 0;
  return -5.0 * plat(t, 42.56, 43.92, 0.12) - 0.6 * bump(t, 42.6, 42.74, 42.95) + 0.6 * bump(t, 43.06, 43.15, 43.32) - 0.6 * bump(t, 43.5, 43.68, 44.0)
    + 0.8 * bump(t, 43.98, 44.08, 44.3) - 0.5 * bump(t, 44.3, 44.42, 44.6)
    + 8.5 * bump(t, 44.95, 45.075, 45.25) - 0.6 * bump(t, 45.17, 45.26, 45.38) + 0.6 * bump(t, 45.36, 45.45, 45.6);
}
// Subtle body with a rigid head: the head and neck are always the neutral drawing; only the body below it changes, to the inhale
// drawing B1 (chest and necklaces up ~3 px) for the question "kiṃ kampate?". The head angle is a small rigid curve with a constant
// forward tuck of 1.5 deg across the line.
const B1_PLATE = loadPlate('dj_canon_profile_B1');
const TUCK = 1.5;
export function subtleLineAngle(t: number) {
  if (t < 42.45 || t > 45.83) return 0;
  const tuck = TUCK * sm01((t - 42.45) / 0.1) * (1 - sm01((t - 45.73) / 0.1));
  return tuck + -2.0 * plat(t, 42.56, 43.92, 0.12) - 0.3 * bump(t, 42.6, 42.74, 42.95) + 0.3 * bump(t, 43.06, 43.15, 43.32) - 0.3 * bump(t, 43.5, 43.68, 44.0)
    + 3.5 * bump(t, 44.95, 45.075, 45.25) - 0.4 * bump(t, 45.17, 45.26, 45.38) + 0.4 * bump(t, 45.36, 45.45, 45.6);
}
export function drawProfileBody(fb: Frame, mouth: Mouth, y: number, mul: PlateOpts['mul'] | undefined, t: number) {
  const a = subtleLineAngle(t), inhale = t >= 42.62 && t < 43.95;
  y |= 0; const base = nodPlate(inhale ? B1_PLATE : MOUTH.closed, a);
  if (mouth === 'closed') { drawPlate(fb, base, 0, y, { mul }); return; }
  const [x0, y0, x1, y1] = PROFILE_ARTICULATION; const inside = (x: number, sy: number) => x >= x0 && x <= x1 && sy - y >= y0 && sy - y <= y1;
  drawPlate(fb, base, 0, y, { mul, skip: inside });
  drawPlate(fb, nodPlate(MOUTH[mouth], a), 0, y, { mul, skip: (x, sy) => !inside(x, sy) });
}
export function drawProfilePose(fb: Frame, mouth: Mouth, y: number, mul: PlateOpts['mul'] | undefined, a: number) {
  const pose: Pose = a <= -2.5 ? 'P1' : a >= 4.75 ? 'P3' : 'P2';
  const r = Math.max(-1.5, Math.min(1.5, a - POSE_ANG[pose]));
  if (pose === 'P2') { drawProfilePortrait(fb, mouth, y, mul, Math.max(-2, Math.min(2, a))); return; }
  const P = POSE_SET[pose]; y |= 0;
  const base = nodPlate(P.base, r), shp = mouth === 'closed' || mouth === 'm' ? null : P.m[mouth] ?? null;
  if (!shp) { drawPlate(fb, base, 0, y, { mul }); return; }
  const [x0, y0, x1, y1] = P.region; const inside = (x: number, sy: number) => x >= x0 && x <= x1 && sy - y >= y0 && sy - y <= y1;
  drawPlate(fb, base, 0, y, { mul, skip: inside });
  drawPlate(fb, nodPlate(loadPlate(P.pre + shp), r), 0, y, { mul, skip: (x, sy) => !inside(x, sy) });
}

export function drawProfilePortrait(fb: Frame, mouth: Mouth, y = 0, mul?: PlateOpts['mul'], nod = 0) {
  y |= 0;
  const base = nodPlate(MOUTH.closed, nod);
  if (mouth === 'closed') { drawPlate(fb, base, 0, y, { mul }); return; }
  const [x0, y0, x1, y1] = PROFILE_ARTICULATION;
  const inside = (x: number, sy: number) => x >= x0 && x <= x1 && sy - y >= y0 && sy - y <= y1;
  // Hold hair, headphones, eyes and clothing to one plate. Omit the base *inside* the region too, so a
  // receding jaw exposes the scene beneath it rather than leaving the closed-mouth silhouette behind.
  drawPlate(fb, base, 0, y, { mul, skip: inside });
  drawPlate(fb, nodPlate(MOUTH[mouth], nod), 0, y, { mul, skip: (x, sy) => !inside(x, sy) });
}

// "sabhām ākrāmat — layo na mriyate" (140.584 -> 143.819): the whole close-up is one performance in key poses (whole drawings, body
// and face): K1 alarm on 'sabhām', K2 resolve on 'ākrāmat', the hand raise R1/R2, K4 the attack on 'la', K5 the lift on 'yo',
// K6 the dip on 'na mri ya', K7 the gather on 't', K8 the belt, K9 the release. Suffixed keys are mouth variants inside a held pose
// on their syllables; KIB keys are in-betweens one 15/s frame before a big move.
const RAIDLINE: [number, string][] = [[0, 'K1'], [140.93, 'K1_m'], [141.015, 'K2'], [141.385, 'K2_m'], [141.55, 'R1'], [141.68, 'R2'], [141.73, 'KIBa'], [141.79, 'K4'],
  [141.953, 'K4_y'], [142.043, 'K5'], [142.19, 'KIBc'], [142.25, 'K6'], [142.463, 'K6_m'], [142.513, 'K6_e'], [142.633, 'K6'], [142.80, 'KIBd'],
  [142.85, 'K7'], [142.915, 'KIBe'], [142.975, 'K8'], [143.30, 'K8_b'], [143.72, 'K9']];
const raidlinePlate = (k: string) => k === 'R1' ? 'dj_canon_raise_1' : k === 'R2' ? 'dj_canon_raise_2' : `dj_canon_rlpose_${k}`;
// "sadaiva ullaṅghane smaḥ" (169.375 -> 172.225), very restrained: S1 breath, S2 'sa' 169.725, S2_e 'dai' 170.026, S2 'va' 170.627,
// S3 'u' 170.878 settling.
const SADAIVA: [number, string][] = [[0, 'S1'], [169.70, 'S2'], [170.00, 'S2_e'], [170.60, 'S2'], [170.85, 'S3']];
// "urasi kiṃ kampate? tannāma muktiḥ" (42.2 -> 45.83), sung forcefully but not shouted: U1 the 'urasi' build, U2 'kiṃ' high,
// U3 'kampate?' held, U4 'tannāma' an octave down, U5 'muk' stark on the consonants, U6 the 'tiḥ' release. Suffixed keys are mouth
// variants inside a held pose; U3_IB and U5_IB are in-betweens before the two largest head moves.
const URASI: [number, string][] = [[0, 'U1'], [42.44, 'U1_e'], [42.67, 'U2'], [43.10, 'U3_a'], [43.39, 'U3_m'], [43.44, 'U3_a'], [43.57, 'U3'],
  [43.95, 'U3_IB'], [44.02, 'U4'], [44.59, 'U4_m'], [44.64, 'U4'], [44.755, 'U5_m'], [44.80, 'U5'], [45.04, 'U5_m'], [45.10, 'U5_IB'], [45.17, 'U6'], [45.40, 'U6_h']];
const keyAt = (track: [number, string][], t: number) => { let k = track[0]![1]; for (const [a, v] of track) if (t >= a) k = v; return k; };
// 0 -> 1 ramp over [a, b]
const ramp = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
// a half-sine pulse of duration d starting at each time in ats
const pulses = (t: number, ats: number[], d: number) => ats.reduce((s, a) => s + (t >= a && t < a + d ? Math.sin(Math.PI * (t - a) / d) : 0), 0);

function drawPerformanceProfile(fb: Frame, t: number, codeGlyphs: boolean, quiet = false) {
  const kick = env('drums', t), lead = env('lead', t), hit = beatHit(t, 6);
  fb.vgrad(0, H, hex('#05030a'), hex('#0b0714'));
  // the ensō, side-on: a tall ellipse of light behind the head
  fb.glow(380, 150, 220, hex('#1d3cff'), 0.1 + 0.08 * env('bass', t), 1.4);
  for (let a = 0; a < Math.PI * 2 * 0.86; a += 0.004) {
    const r = 150, x = 400 + Math.cos(a + t * 0.08) * r * 0.22, y = 160 + Math.sin(a + t * 0.08) * r;
    fb.set(x, y, Math.sin(a * 3) > 0.3 ? P.blu6 : P.blu3);
  }
  // the fire's light from the front-left (the braziers are off-frame), flickering
  const fl = 0.85 + 0.3 * vnoise(t * 3, 0, 77);
  fb.glow(40, 260, 220, hex('#2050ff'), 0.2 * fl);
  fb.glow(520, 400, 260, hex('#ff1020'), 0.14);
  // the code: a slow tide of red glyphs rising from the circuitry below, brighter on the kick; never spelled out
  for (let k = 0; codeGlyphs && k < 90; k++) {
    const speed = 12 + hash3(k, 1, 83) * 18;
    const x = 20 + hash3(k, 2, 83) * 600, y = ((hash3(k, 3, 83) * 400 - (t - CODE_FROM) * speed) % 400 + 400) % 400 - 20;
    // not over the face
    if (x > 230 && x < 560 && y > 40 && y < 330) continue;
    const g = Math.floor(hash3(k, 4, Math.floor(t * 6 + k)) * 32768);
    const col = hash3(k, 5, 83) > 0.8 ? P.red5 : P.red2;
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if ((g >> (gy * 3 + gx)) & 1) fb.set(x + gx, y + gy, col, 0.5 + 0.4 * kick);
  }
  // the DJ: the head nods a pixel on the hit, the chest (the robe) breathes with the phrase, and the fire's flicker plays on the lit
  // side of the face. The quiet insert keeps the closed mouth; elsewhere the mouth follows the syllables.
  const m: Mouth = quiet ? 'closed' : mouthAt(t);
  const breathe = Math.round(1.5 * lead), y0 = Math.round(1.5 * hit) - breathe;
  const mul = (x: number): [number, number, number] => { const k = 1 + 0.12 * (fl - 0.85) * Math.max(0, 1 - Math.abs(x - 300) / 200); return [k, k, k + 0.06 * (fl - 0.85)]; };
  if (quiet) drawProfilePortrait(fb, m, y0, mul);
  else if (t >= 140.584 && t < 143.819) {
    // breath: the inhale lifts the figure 141.0-141.75 and empties on the release; a 1-2 px nod on each accented syllable (la, yo, ya, te)
    const inh = ramp(t, 141.0, 141.72) * (1 - ramp(t, 141.76, 141.9)) + 0.6 * ramp(t, 142.84, 142.95) * (1 - ramp(t, 143.65, 143.8));
    const nod = pulses(t, [141.79, 142.043, 142.633, 142.975], 0.2);
    drawPlate(fb, loadPlate(raidlinePlate(keyAt(RAIDLINE, t))), 0, y0 - Math.round(2 * inh) + Math.round(1.5 * nod));
  } else if (t >= 169.375 && t < 172.225) {
    const inh = Math.min(1, Math.max(0, (t - 169.4) / 0.25)) * (1 - Math.min(1, Math.max(0, (t - 169.7) / 0.2)));
    drawPlate(fb, loadPlate(`dj_canon_sadaiva_${keyAt(SADAIVA, t)}`), 0, y0 - Math.round(2 * inh));
  } else if (t >= 42.2 && t < 45.83) {
    // breath: an inhale lifts the figure before the line and in the gap after 'te?'; small accents on kiṃ, nā, muk
    const inh = ramp(t, 42.2, 42.4) * (1 - ramp(t, 42.45, 42.6)) + ramp(t, 43.85, 44.0) * (1 - ramp(t, 44.02, 44.15));
    const acc = pulses(t, [42.69, 44.345, 44.775], 0.18);
    drawPlate(fb, loadPlate(`dj_canon_urasi_${keyAt(URASI, t)}`), 0, y0 - Math.round(2 * inh) + Math.round(1.5 * acc));
  } else drawProfileBody(fb, m, y0, mul, t);
  // haze
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = vnoise(x * 0.015 + t * 0.2, y * 0.02, 151);
    if (n > 0.62) fb.add(x, y, [0.12, 0.1, 0.35], (n - 0.62) * 0.15);
  }
}

export function drawCodeprofile(fb: Frame, t = 89) { drawPerformanceProfile(fb, t, true); }

// Absolute song time feeds the same mouth track; this performance shot has no code glyphs. The lights die in the 170.1-171.86 silence.
export function drawDjprofile(fb: Frame, t: number) { drawPerformanceProfile(fb, t, false); dimSilence(fb, t); }

// The same profile with the closed mouth, for the short insert on नादानाम्.
export function drawDjprofileQuiet(fb: Frame, t: number) { drawPerformanceProfile(fb, t, false, true); }
