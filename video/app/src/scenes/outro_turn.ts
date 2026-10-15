// The DJ turns the sound on the raid, led by the measured music: near silence 170.1-171.862 (only his voice), then the loudest
// full-band hit of the section on the 171.862 downbeat.
//  1) the lights die in the silence (dimSilence, called by the djprofile shot);
//  2) 170.987-172.737 an officer's visor HUD acquires the DJ, then overloads on the hit and whites out in one slow ramp;
//  3) 172.737-174.392 the turn on the DJ-console camera (outro_turn_T* on the beats) under the lighting rig's strobes.
// Photosensitivity: at most one strobe hit per measured beat (0.4376 s -> 2.29 flashes / s, under the 3 / s limit), soft decay,
// partial-frame beams, cool white-blue, never saturated red; the HUD whiteout is a single 0.35 s ramp, not a flicker.
import { Frame, W, H } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { beatPos } from '../engine/music.ts';
import { drawText, textMask } from '../engine/text.ts';
import { readFileSync } from 'node:fs';
import { hash3, vnoise } from '../fig/sdf.ts';
import path from 'node:path';
export const TURN_ON = true;
export const SIL0 = 170.1, HIT = 171.862, WIDE0 = 172.737, AFTER0 = 174.392;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// 1) the lights die: the whole frame falls to 38 % over ~0.9 s and holds; a little blue survives (the sirens outside)
export function dimSilence(fb: Frame, t: number) {
  if (t < SIL0 || t >= HIT) return;
  const k = 1 - 0.62 * smooth((t - SIL0) / 0.9);
  for (let i = 0; i < W * H; i++) { fb.r[i] = fb.r[i]! * k; fb.g[i] = fb.g[i]! * k; fb.b[i] = fb.b[i]! * (k + (1 - k) * 0.25); }
}
// 2) the visor HUD: a drawn officer POV from the top of the entrance stairs (plate bp4_hud_pov), in two acts on the measured grid:
//  A 170.987-171.862 (2 beats, his voice alone, lights dead): a sweep line, face boxes popping on the crowd, the reticle travelling to
//    the DJ and locking on the beat (171.425), a magnified inset of him, its analyser reading the music (data/spectrum_hud.json);
//  B 171.862-172.737 (the hit): lights slam up, the analyser pins to the top + CLIP, SIGNAL OVERLOAD, chromatic split, block glitches,
//    cracks spreading over the visor, the reticle blows apart, then the single whiteout ramp.
export const HUD_V2 = true, HUD0 = 170.987;
const SPH = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data/spectrum_hud.json'), 'utf8')) as { t0: number; rate: number; bands: number[][]; peaks: number[][] };
const RED: [number, number, number] = [1, 0.16, 0.1], PALE: [number, number, number] = [1, 0.78, 0.7];
const FACES: [number, number][] = [[118, 300], [188, 258], [262, 318], [330, 244], [402, 292], [470, 252], [536, 310], [222, 196], [300, 176], [372, 202],
  [446, 184], [160, 214], [512, 214], [254, 150], [392, 146], [96, 250]];
function brk(fb: Frame, cx: number, cy: number, r: number, c: [number, number, number], a = 10) {
  const L = Math.max(2, Math.round(Math.min(a, r)));
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x0 = Math.round(cx + sx * r), y0 = Math.round(cy + sy * r);
    fb.rect(sx > 0 ? x0 - L + 1 : x0, y0, L, 1, c); fb.rect(x0, sy > 0 ? y0 - L + 1 : y0, 1, L, c);
  }
}
// corner brackets of a rectangle, independent width and height
function brkR(fb: Frame, x0: number, y0: number, x1: number, y1: number, c: [number, number, number], L: number) {
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
    fb.rect(sx > 0 ? x : x - L + 1, y, L, 1, c); fb.rect(x, sy > 0 ? y : y - L + 1, 1, L, c);
  }
}
export function drawTurnHud(fb: Frame, t: number) {
  const pov = loadPlate('bp4_hud_pov'); drawPlate(fb, pov, 0, 0);
  const A = t < HIT, ua = Math.min(1, (t - HUD0) / (HIT - HUD0)), ub = A ? 0 : (t - HIT) / (WIDE0 - HIT);
  // light: dead lights in A (like dimSilence), a cold visor tint; on the hit the club light slams back up (one transition)
  const lit = A ? 0.4 : 0.4 + 0.5 * smooth(ub / 0.12);
  for (let y = 0; y < H; y++) {
    const scan = y % 3 === 0 ? 0.82 : 1, vy = (y - H / 2) / (H / 2);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, vx = (x - W / 2) / (W / 2), vig = 1 - 0.35 * (vx * vx + vy * vy);
      fb.r[i] = fb.r[i]! * lit * vig * scan * 0.92; fb.g[i] = fb.g[i]! * lit * vig * scan; fb.b[i] = fb.b[i]! * lit * vig * scan * 1.08;
    }
  }
  // A: sweep line + face boxes popping in sequence
  if (A) {
    const sy = Math.round(110 + 240 * ua); for (let x = 0; x < W; x++) fb.add(x, sy, RED, 0.25);
    FACES.forEach(([fx, fy], k) => { const t0 = HUD0 + 0.04 + k * 0.045; if (t < t0) return; brk(fb, fx, fy, 4 + fy / 70, t - t0 < 0.06 ? PALE : RED, 3); });
  }
  // reticle: centre -> the DJ (320, 50), locking on the beat 171.425
  const LOCK = 171.425, DJ: [number, number] = [320, 50];
  const m = smooth((t - HUD0) / (LOCK - HUD0)), rx = 320 + (DJ[0] - 320) * m, ry = 200 + (DJ[1] - 200) * m;
  if (A) {
    const r = t < LOCK ? 30 - 10 * m : 13 + 7 * Math.exp(-(t - LOCK) * 18);
    brk(fb, rx, ry, r, t >= LOCK && t < LOCK + 0.07 ? PALE : RED, 7);
    fb.rect(Math.round(rx), Math.round(ry) - 2, 1, 5, RED); fb.rect(Math.round(rx) - 2, Math.round(ry), 5, 1, RED);
    if (t < LOCK) { if (Math.floor(t * 8) % 2 === 0) drawText(fb, 'hud_acq', Math.round(rx + r + 4), Math.round(ry) - 5, RED); }
    else { drawText(fb, 'hud_lock', Math.round(rx) + 24, Math.round(ry) - 10, PALE); drawText(fb, 'hud_src', Math.round(rx) + 24, Math.round(ry) + 2, RED); }
  } else {
    // the hit: the brackets blow apart
    const spread = 20 + 150 * ub * ub, jit = Math.round(5 * Math.sin(t * 61));
    brk(fb, DJ[0] + jit, DJ[1] - jit, spread, RED, 12);
  }
  // inset: the magnified DJ, top right, glitching on the hit
  if (t >= LOCK - 0.1) {
    const ix = 500, iy = 14, iw = 120, ih = 69, gx = A ? 0 : Math.round(8 * Math.sin(t * 47) * ub);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      // 2x of x 290-350, y 34-69: raised arm, face and upper body, centred on his face (320, 51)
      const sx = Math.min(pov.w - 1, Math.max(0, 290 + Math.floor((x + (y % 7 < 3 ? gx : 0)) / 2))), sy = Math.min(pov.h - 1, 34 + Math.floor(y / 2));
      const j = sy * pov.w + sx, i = (iy + y) * W + ix + x, k = (A ? 0.75 : 1.1) * (y % 2 ? 0.85 : 1);
      fb.r[i] = pov.r[j]! * k; fb.g[i] = pov.g[j]! * k * 0.9; fb.b[i] = pov.b[j]! * k * 0.9;
    }
    // frame corners on the box; reticle on his face
    brkR(fb, ix, iy, ix + iw - 1, iy + ih - 1, RED, 9); brk(fb, ix + (320 - 290) * 2, iy + (51 - 34) * 2, 9, RED, 4);
  }
  // analyser bottom-left: 32 bars from the music
  {
    const k = Math.max(0, Math.min(SPH.bands.length - 1, Math.round((t - SPH.t0) * SPH.rate))), B = SPH.bands[k]!, PK = SPH.peaks[k]!;
    for (let b = 0; b < 32; b++) {
      const h = Math.round(40 * (A ? B[b]! : Math.max(B[b]!, 0.85 + 0.15 * hash3(b, Math.floor(t * 30), 3)))), x = 20 + b * 3;
      for (let y = 0; y < h; y++) if (y % 2 === 0) fb.set(x, 328 - y, y > 30 ? PALE : RED);
      fb.set(x, 328 - Math.round(40 * PK[b]!), PALE);
    }
    drawText(fb, 'hud_audio', 20, 334, RED);
    if (!A && Math.floor(t * 6) % 2 === 0) drawText(fb, 'hud_clip', 122, 314, PALE);
  }
  drawText(fb, 'hud_unit', 320 - textMask('hud_unit').w / 2, 10, RED);
  if (!A) {
    if (Math.floor(t * 4) % 2 === 0) { const om = textMask('hud_overload'); drawText(fb, 'hud_overload', 320 - om.w / 2, 28, PALE); }
    if (ub > 0.35) drawText(fb, 'hud_err', 20, 300, RED);
    // chromatic split, growing
    const cs = Math.round(1 + 6 * ub);
    for (let y = 0; y < H; y++) { const row = fb.r.slice(y * W, y * W + W); for (let x = 0; x < W; x++) fb.r[y * W + x] = row[Math.min(W - 1, x + cs)]!; }
    // block glitches: copied rectangles displaced sideways, re-seeded every 2 frames
    const sd = Math.floor(t * 30);
    for (let n = 0; n < Math.round(4 + 14 * ub); n++) {
      const bw = 20 + Math.round(70 * hash3(n, sd, 1)), bh = 3 + Math.round(10 * hash3(n, sd, 2)), bx = Math.round((W - bw) * hash3(n, sd, 3)), by = Math.round((H - bh) * hash3(n, sd, 4));
      const off = Math.round((hash3(n, sd, 5) - 0.5) * 60 * (0.3 + ub));
      for (let y = by; y < by + bh; y++) {
        const rr = fb.r.slice(y * W, y * W + W), gg = fb.g.slice(y * W, y * W + W), bb = fb.b.slice(y * W, y * W + W);
        for (let x = bx; x < bx + bw; x++) { const sx = Math.min(W - 1, Math.max(0, x - off)), i = y * W + x; fb.r[i] = rr[sx]!; fb.g[i] = gg[sx]!; fb.b[i] = bb[sx]!; }
      }
    }
    // visor fracture: an impact point low left (clear of the analyser and ERR readout), 9 jagged rays growing with the overload + two partial rings
    const IX = 176, IY = 236, grow = smooth(ub / 0.6);
    const px = (x: number, y: number) => { fb.set(x, y, [0.92, 0.94, 1], 0.9); fb.add(x + 1, y + 1, [0.2, 0.22, 0.3], 0.5); };
    for (let c = 0; c < 9; c++) {
      let x = IX, y = IY, a = c / 9 * Math.PI * 2 + (hash3(c, 1, 21) - 0.5) * 0.5; const L = (25 + 230 * hash3(c, 2, 21) ** 1.5) * grow;
      for (let d = 0; d < L; d += 5) {
        a += (hash3(c, d, 22) - 0.5) * 0.45; const nx = x + Math.cos(a) * 5, ny = y + Math.sin(a) * 5;
        for (let q = 0; q <= 5; q++) px(Math.round(x + (nx - x) * q / 5), Math.round(y + (ny - y) * q / 5));
        x = nx; y = ny; if (x < 0 || x >= W || y < 0 || y >= H) break;
      }
    }
    for (const [R, arc] of [[16, 0.7], [38, 0.5]] as const) if (grow * 60 > R) for (let k = 0; k < 9; k++) {
      if (hash3(k, R, 23) > arc) continue; const a0 = k / 9 * Math.PI * 2, a1 = (k + 1) / 9 * Math.PI * 2;
      for (let a = a0; a < a1; a += 0.03) px(Math.round(IX + Math.cos(a) * R * (1 + 0.08 * Math.sin(a * 7))), Math.round(IY + Math.sin(a) * R * (1 + 0.08 * Math.sin(a * 7))));
    }
  }
  const wk = smooth((t - (WIDE0 - 0.35)) / 0.35) * 0.8;
  if (wk > 0) for (let i = 0; i < W * H; i++) { fb.r[i] = fb.r[i]! + (0.9 - fb.r[i]!) * wk; fb.g[i] = fb.g[i]! + (0.92 - fb.g[i]!) * wk; fb.b[i] = fb.b[i]! + (0.95 - fb.b[i]!) * wk; }
  preserveColor(fb).fill(1);
}
// 3) the turn: plates on the beats, under the lighting rig
const TURN_KEYS: [number, string][] = [[WIDE0, 'outro_turn_T1'], [173.175, 'outro_turn_T2'], [173.612, 'outro_turn_T3'], [173.83, 'outro_turn_T35'], [173.94, 'outro_turn_T375'], [174.050, 'outro_turn_T4']];
// The rig: four moving-head fixtures hang over the hall beyond the DJ (across the right part of the top edge, clear of his silhouette
// x < 250). Each throws a narrow beam through the haze (volumetric noise, widening with distance) that sweeps with the bar and ends on
// the crowd (floor y ~ 150-190) in a light pool, with a bright 1 px core; blue-violet at rest. On each measured beat one pair
// (alternating sides) fires a short white-cyan hit with a lens glint at the fixture.
const RIG: [number, number][] = [[300, -8], [395, -12], [490, -12], [585, -8]];
export function strobe(fb: Frame, t: number, gain = 1) {
  const b = beatPos(t), ph = b - Math.floor(b), pair = Math.floor(b) % 2, hit = Math.exp(-ph * 9) * gain, bar = b / 4;
  for (let f = 0; f < 4; f++) {
    const [fx, fy] = RIG[f]!, side = f < 2 ? 0 : 1, on = side === pair ? hit : 0;
    const ang = Math.PI / 2 + (f - 1.5) * 0.22 + 0.28 * Math.sin(bar * Math.PI * 0.5 + f * 1.3), dx = Math.cos(ang), dy = Math.sin(ang);
    const k = 0.07 * gain + 0.6 * on;
    if (k < 0.01) continue;
    const col: [number, number, number] = on > 0.05 ? [0.8, 0.92, 1] : [0.55, 0.42, 1], landY = 150 + 40 * (f % 2);
    let lx = fx;
    for (let y = 0; y < landY; y++) {
      const d = (y - fy) / Math.max(0.2, dy), cx = fx + dx * d, hw = 1.5 + d * 0.05, fall = 0.55 + 0.45 * (y / landY); lx = cx;
      if (cx < 250) break;
      for (let x = Math.max(250, Math.floor(cx - hw - 3)); x < Math.min(W, Math.ceil(cx + hw + 3)); x++) {
        const e = Math.max(0, 1 - Math.abs(x - cx) / (hw + 3)), haze = 0.4 + 0.6 * vnoise(x * 0.06, y * 0.05 - t * 0.7, f * 3.1);
        fb.add(x, y, col, k * e * e * fall * haze);
      }
      // core
      fb.add(Math.round(cx), y, [1, 1, 1], k * 0.35 * fall);
    }
    // pool on the crowd
    if (lx >= 250) fb.glow(lx, landY, 22, col, 0.35 * k, 2.6);
    // lens glint at the fixture
    if (on > 0.05) fb.glow(fx, 0, 14, [0.9, 0.95, 1], 0.55 * on);
  }
}
export function drawTurnWide(fb: Frame, t: number) {
  let nm = TURN_KEYS[0]![1];
  for (const [a, n] of TURN_KEYS) if (t >= a) nm = n;
  drawPlate(fb, loadPlate(nm), 0, 0); preserveColor(fb).fill(1); strobe(fb, t);
}
// the plate that follows the turn
export const AFTER_PLATE = () => 'outro_flee_titanium_A01';
