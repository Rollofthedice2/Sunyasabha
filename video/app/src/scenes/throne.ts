// "The DJ on the circuit throne" — establishing frame.
// The hall is a prepared plate (the two colossal stone heads, the circuit-board throne wall, the decks, the neon
// pipes — generated reference art re-quantised to the film's grid) and the DJ is a prepared sprite
// seated on it. The engine draws everything that moves: blue fire in the braziers, the ensō of light, the
// spotlights sweeping the haze, the kick on the neon, sweat, smoke, and the crowd in the foreground.
import { Frame, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { path } from '../engine/vec2d.ts';
import { drawCrowdPerson } from '../fig/crowd_phrase.ts';
import { loadPlate, drawPlate, drawPlateAt, type Plate } from '../engine/plate.ts';
import { beatHit, env } from '../engine/music.ts';
import { hash3, vnoise } from '../fig/sdf.ts';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { loadAnim, frameAt } from '../engine/anim.ts';
import { pixelFire } from '../fig/pixelfire.ts';
import { armsPhaseForAccents, drawArmsPhase } from '../fig/crowd_arms.ts';

const BG = loadPlate('throne_bg');
// 19.9-29.5: the plate with the packed crowd band baked in
const EARLY = loadPlate('throne_bg_crowd_A02');
const THRONE_BEATS = (JSON.parse(readFileSync(nodePath.resolve(import.meta.dirname, '../../../data/groove/groove.json'), 'utf8')) as { beats_local_s: number[] }).beats_local_s;
// the DJ's seated groove sprite
const DJA = loadAnim('dj_bar');
// flame bases, in the plate's bowls
export const BRAZIERS: [number, number][] = [[107, 240], [535, 240]];
// the sprite's feet settle on the top edge of the decks
const DJ_FEET: [number, number] = [320, 298];
// the ensō's centre, behind the head
const EC: [number, number] = [320, 168];
// skin pixels of the sprite (for sweat glints): warm, lit, not the robe or hair
const SKIN = new WeakMap<Plate, number[]>();
function skinPixels(p: Plate) {
  let points = SKIN.get(p);
  if (!points) {
    points = [];
    for (let i = 0; i < p.w * p.h; i++) if (p.a[i] && p.r[i]! > 0.12 && p.r[i]! > p.g[i]! * 1.15 && p.g[i]! > p.b[i]! * 1.1) points.push(i);
    SKIN.set(p, points);
  }
  return points;
}

const plateCache = new Map<string, ReturnType<typeof loadPlate>>();
const loadPlateCached = (n: string) => { let p = plateCache.get(n); if (!p) { p = loadPlate(n); plateCache.set(n, p); } return p; };
const IGN_D: [string, number][] = [['LO', 20.62], ['LI', 20.80], ['RO', 21.50], ['RI', 21.71]];
// LI stays in D
const IGN_E: [string, number][] = [['LO', 22.25], ['RO', 22.55], ['RI', 22.85]];
export interface ThroneOpts { noDJ?: boolean; flameOn?: [number, number]; ensō?: number; crowd?: boolean; burn?: number }
// the DJ's phrase in his canonical costume: base drawings on the phrase times, with groove-down drawings on the hold beats
// (0.16 s each, then the neighbour resumes); stepped, no crossfade or warp
const DJ_PHRASE = JSON.parse(readFileSync(nodePath.resolve(import.meta.dirname, '../../../data/dj_phrase.json'), 'utf8')) as { start: number; end: number; base: [number, string][]; groove: [number, number, string][] };
export function drawThrone(fb: Frame, t = 0, opts: ThroneOpts = {}) {
  const kick = env('drums', t), bass = env('bass', t), hit = beatHit(t, 6);
  // 19.9-29.5: the baked packed-crowd band replaces the plate and the sprite patrons stay away
  const early = t >= 19.9 && t < 29.5;
  drawPlate(fb, early ? EARLY : BG, 0, 0);
  // the band's people react to the fires with a staggered latency per small group after each ignition (left 20.45, right 21.33):
  // heads and shoulders turn to the nearest fire (state D), held through the throne shot; after the ensō appears (~22.1) a few
  // lift a single arm (state E), staggered per group; held to the 24.936 cut. D's own blue rims are the only added blue.
  if (early) for (const [g, at] of IGN_D) if (t >= at && t < 24.936) {
    const e = IGN_E.find(([gg]) => gg === g); const st = e && t >= e[1] ? 'E' : 'D';
    drawPlate(fb, loadPlateCached(`ign_${st}_${g}`), 0, 0);
  }

  // ceiling spotlights: narrow cones sweeping through the haze, dithered so they read as light in smoke
  for (const [ox, phase, col] of [[150, 0, [0.15, 0.3, 1.0]], [490, 2.1, [0.15, 0.3, 1.0]], [320, 4.2, [0.9, 0.1, 0.15]]] as const) {
    const ang = 0.35 * Math.sin(t * 0.45 + phase) + (ox < 320 ? 0.25 : ox > 320 ? -0.25 : 0);
    const dx = Math.sin(ang), dy = Math.cos(ang);
    for (let y = 0; y < 300; y++) {
      const s = y / dy;
      const cx = ox + dx * s, half = 4 + s * 0.12;
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const f = 1 - Math.abs(x - cx) / half;
        if (f <= 0) continue;
        const k = 0.05 * f * (1 - y / 320) * (0.6 + 0.4 * vnoise(x * 0.05, y * 0.05 - t * 0.3, 4));
        fb.add(x, y, col as unknown as RGB, k);
      }
    }
  }

  // ensō of light behind the head: a brush circle, open at the upper right, slowly turning
  const spin = t * 0.08;
  for (let a = -1.0 + spin; a < Math.PI * 2 - 1.45 + spin; a += 0.004) {
    const wv = 2.2 + 1.8 * Math.sin((a - spin) * 0.5 + 0.4) + (vnoise((a - spin) * 6, 1, 1) - 0.5) * 1.6;
    for (let k = -wv; k <= wv; k += 0.6) {
      const r = 66 + k;
      if ((opts.ensō ?? 1) > hash3(Math.round(a * 200), Math.round(k * 10), 17)) fb.set(EC[0] + Math.cos(a) * r, EC[1] + Math.sin(a) * r, Math.abs(k) < wv * 0.35 ? P.blu6 : P.blu3);
    }
  }
  fb.glow(EC[0], EC[1], 90, hex('#1d3cff'), (0.06 + 0.12 * bass) * (opts.ensō ?? 1));

  // braziers: blue fire in the plate's bowls, its light on the heads above
  // the fire starts BOWL_DROP px below the rim, inside the bowl; the bowl's front wall (plate pixels below the front arc of the rim
  // ellipse: centre (cx, 235), half-axes 42 x 8) is saved here and restored over the fire's base, so the flame has no flat cut base
  const BOWL = BRAZIERS.map(([cx]) => {
    const pts: [number, number, number, number, number][] = [];
    for (let x = cx - 44; x <= cx + 44; x++) {
      const u = (x - cx) / 42, yf = Math.abs(u) < 1 ? 235 + 8 * Math.sqrt(1 - u * u) : 235;
      for (let y = Math.ceil(yf); y < 252; y++) { const i = y * fb.w + x; if (x >= 0 && x < fb.w) pts.push([x, y, fb.r[i]!, fb.g[i]!, fb.b[i]!]); }
    }
    return pts;
  });
  const BOWL_DROP = 8;
  for (const [bi, [cx, cy0]] of BRAZIERS.entries()) {
    const cy = cy0 + BOWL_DROP;
    const on = opts.flameOn ? opts.flameOn[bi]! : 1;
    // pixel-art heat-field fire (fig/pixelfire.ts): ignition grows the feed (on), not the opacity; the tongues end ~100-115 px up
    if (on > 0.02) pixelFire(fb, cx, cy + 2, 64, 140, t, cx, on);
  }
  for (const pts of BOWL) for (const [x, y, r, g, b] of pts) { const i = y * fb.w + x; fb.r[i] = r; fb.g[i] = g; fb.b[i] = b; }
  // the bowl's front lip lit by the fire: a 1-px rim line along the arc in front of the flame base (brightest where the flame is),
  // and the fire's light on the front wall just below it
  for (const [bi, [cx]] of BRAZIERS.entries()) {
    const on = opts.flameOn ? opts.flameOn[bi]! : 1; if (on <= 0.02) continue;
    for (let x = cx - 42; x <= cx + 42; x++) {
      const u = (x - cx) / 42, y = Math.round(235 + 8 * Math.sqrt(Math.max(0, 1 - u * u))), lit = on * Math.max(0, 1 - Math.abs(u) * 1.15);
      fb.add(x, y, [0.25, 0.45, 1.0], 0.55 * lit); fb.add(x, y + 1, [0.12, 0.22, 0.6], 0.3 * lit);
    }
    fb.glow(cx, 247, 26, hex('#2a5cff'), 0.10 * on, 0.9);
  }

  // the throne overloads ("until the circuit burns"): the traces glow red-hot, sparks, smoke
  const burn = opts.burn ?? 0;
  if (burn > 0.05) {
    for (let y = 0; y < 270; y++) for (let x = 215; x < 425; x++) {
      const i = y * fb.w + x, l = fb.r[i]! + fb.g[i]! + fb.b[i]!;
      if (l > 0.08 && l < 0.6) { const heat = burn * (0.4 + 0.6 * hash3(x >> 2, y >> 2, Math.floor(t * 12))); fb.r[i] += 0.5 * heat; fb.g[i] += 0.06 * heat; }
    }
    for (let k = 0; k < 90; k++) {
      const src = [[256, 190], [384, 182], [258, 238], [382, 236], [300, 196], [342, 200]][k % 6]!;
      const period = 0.5 + hash3(k, 1, 91) * 0.6;
      const life = ((t + hash3(k, 2, 91) * period) % period) / period;
      const a = -Math.PI / 2 + (hash3(k, 3, 91) - 0.5) * 2.4, v = 50 + hash3(k, 4, 91) * 120;
      const x = src[0]! + Math.cos(a) * v * life, y = src[1]! + Math.sin(a) * v * life + 160 * life * life;
      if (hash3(k, 5, 91) < burn) fb.set(Math.round(x), Math.round(y), life < 0.3 ? P.white : life < 0.6 ? P.red7 : P.red4);
    }
    for (let y = 20; y < 260; y++) for (let x = 220; x < 420; x++) {
      const n = vnoise(x * 0.04, y * 0.03 + t * 0.8, 92);
      if (n > 0.55) fb.add(x, y, [0.3, 0.12, 0.14], (n - 0.55) * 0.5 * burn * (1 - y / 300));
    }
    fb.glow(320, 210, 120, hex('#ff3010'), 0.12 * burn);
  }

  // the DJ: during his phrase the canonical drawings; otherwise the seated groove sprite, breathing a pixel on the kick, the fire's
  // light flickering on the skin from both sides, sweat glints twinkling where the skin faces the light
  const phraseOn = !opts.noDJ && t >= DJ_PHRASE.start && t < DJ_PHRASE.end;
  if (phraseOn) {
    const g = DJ_PHRASE.groove.find(([a, b]) => t >= a && t < b);
    let n = DJ_PHRASE.base[0]![1]; for (const [at, nm] of DJ_PHRASE.base) if (t >= at) n = nm;
    drawPlate(fb, loadPlateCached(g ? g[2] : n), 0, 0);
  }
  if (!opts.noDJ && !phraseOn) {
    const p = frameAt(DJA, t, 8);
    const bob = Math.round(1.5 * hit);
    const flL = 0.85 + 0.3 * vnoise(t * 3, 0, 77), flR = 0.85 + 0.3 * vnoise(t * 3 + 7, 0, 78);
    const [ox, oy] = drawPlateAt(fb, p, DJ_FEET[0], DJ_FEET[1] + bob, 0.5, 1, { mul: (x) => { const side = Math.min(1, Math.abs(x - 318) / 100), f = x < 318 ? flL : flR; return [1 + 0.04 * side * (f - 1), 1 + 0.08 * side * (f - 1), 1 + 0.35 * side * (f - 1)]; } });
    const slot = Math.floor(t * 5);
    const skin = skinPixels(p);
    for (let k = 0; k < 14; k++) {
      if (!skin.length || hash3(k, slot, 31) < 0.55) continue;
      const i = skin[Math.floor(hash3(k, slot >> 1, 32) * skin.length)]!;
      fb.set(ox + (i % p.w), oy + Math.floor(i / p.w), hash3(k, slot, 33) > 0.5 ? P.white : P.blu7);
    }
  }

  // the red neon under the decks pumps with the kick
  for (const x of [118, 215, 320, 425, 522]) fb.glow(x, 334, 24, hex('#ff1020'), 0.02 + 0.2 * kick, 0.3);

  // foreground crowd: complete drawn phrases with fixed staging and phase offsets
  const crowd: [number, number, number, number][] = [[40, 400, 230, 0], [118, 420, 200, 1], [196, 430, 170, 2], [452, 430, 170, 3], [530, 420, 200, 0], [604, 400, 230, 1]];
  // from the raid on (throne-siren cutaway, finale) these are the same patrons as in the raid: source costumes (variant null, no
  // recolour), never mirrored (baked red-left / blue-right rim light), none repeated; identities e/f/g/h plus two stage-facing
  // patrons A/B on their own accents
  const light: RGB = [.35, .38, .5];
  if (opts.crowd !== false && t >= 150) {
    const patrons: [number, number, number, 'e' | 'f' | 'g' | 'h' | 'A' | 'B'][] = [[40, 400, 230, 'e'], [118, 420, 200, 'A'], [196, 430, 170, 'g'], [452, 430, 170, 'h'], [530, 420, 200, 'B'], [604, 400, 230, 'f']];
    const beats = THRONE_BEATS.filter((b) => Math.abs(b - t) < 3);
    patrons.forEach(([x, y, h, id], i) => {
      if (id === 'A' || id === 'B') drawArmsPhase(fb, id, armsPhaseForAccents(id, 31 + i, t, beats, 0.22, (i % 3) * 0.125), x, y, h, light);
      else drawCrowdPerson(fb, t, 'efgh'.indexOf(id), x, y, h, { phaseBeats: i * .63, light, variant: null });
    });
  } else if (opts.crowd !== false && !early) crowd.forEach(([x, y, h, who], i) => {
    drawCrowdPerson(fb,t,who,x,y,h,{phaseBeats:i*.63,flipX:i>3,light});
  });

  // low smoke drifting across the floor between the braziers
  for (let y = 236; y < 300; y++)
    for (let x = 0; x < 640; x++) {
      const n = vnoise(x * 0.03 + t * 0.2, y * 0.06, 3) * vnoise(x * 0.011 - t * 0.1, y * 0.02, 7);
      const k = n * Math.max(0, 1 - Math.abs(y - 270) / 34) * 0.22;
      if (k > 0.01) fb.add(x, y, [0.12, 0.16, 0.5], k);
    }
}

// Blue fire. Each tongue is a narrowing ribbon whose spine curls (S-curve) and sways with time;
// tongues nest dark-to-hot (outer blue → cyan core → white heart). Sparks rise above.
export function flame(fb: Frame, cx: number, base: number, w: number, h: number, t: number, seed: number) {
  const layers: [RGB, number, number][] = [[P.blu2, 1, 1], [P.blu4, 0.78, 0.86], [P.blu6, 0.56, 0.66], [P.cy0, 0.36, 0.46], [P.cy1, 0.2, 0.28]];
  const tongues = 6;
  for (const [col, ws, hs] of layers) {
    for (let k = 0; k < tongues; k++) {
      const u = (k + 0.5) / tongues - 0.5;
      const x0 = cx + u * w * ws;
      const hh = h * hs * (0.5 + 0.5 * Math.cos(u * 2.8)) * (0.8 + 0.4 * vnoise(seed + k * 3.1, t * 2.5, 0));
      const ph = vnoise(seed * 0.1 + k, t * 1.7, 5) * 6.28;
      const bw = ((w * ws) / tongues) * 1.15;
      const N = 8, left: string[] = [], right: string[] = [];
      for (let j = 0; j <= N; j++) {
        const v = j / N;
        const sx = x0 + Math.sin(v * 3.4 + ph) * 5 * v * hs + Math.sin(ph) * 3 * v * v;
        const sy = base - hh * v;
        const half = bw * (1 - v) ** 0.8 * (0.7 + 0.3 * Math.sin(v * 3.14));
        left.push(`${(sx - half).toFixed(1)},${sy.toFixed(1)}`);
        right.unshift(`${(sx + half).toFixed(1)},${sy.toFixed(1)}`);
      }
      path(fb, `M${left.join(' L')} L${right.join(' L')} Z`, { fill: col });
    }
  }
  for (let k = 0; k < 6; k++) {
    const life = (t * 0.7 + hash3(seed, k, 1)) % 1;
    const x = cx + (hash3(seed, k, 2) - 0.5) * w * 0.8 + Math.sin(life * 6 + k) * 3;
    const y = base - h * (0.5 + life * 0.8);
    fb.set(x, y, life < 0.6 ? P.cy1 : P.blu5);
  }
}
