// Outro: "Yes. We know." Three answers to the police, each a face in the siren light, each looking straight back:
// 146.77  the sister — calm, the android ring in her eye lit; she nods once on "know".
// 152.25  the DJ — bowed in the music, then his head comes up and his eyes open to the police.
// 157.78  the sister again, down on the floor under the gunfire; tracers whip overhead; she lifts her eyes to us.
// Between them the wide raid shot carries the unison, the volley and the rise.
import { drawRaidStill } from './raid_stills.ts';
import { Frame, W, H, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { line, path, mulX, translate, scaleX } from '../engine/vec2d.ts';
import { drawSisterFace } from '../fig/sister_face.ts';
import { loadPlate, drawPlateAt, drawPlate } from '../engine/plate.ts';
import { siren } from './raid.ts';
import { beatPos, beatHit } from '../engine/music.ts';
import { hash3, vnoise } from '../fig/sdf.ts';

const FLOOR = loadPlate('floor_sister_astra');
export const KNOW1 = 146.77, KNOW2 = 152.25, KNOW3 = 157.78;
const FIRE = 156.08, RISE = FIRE + 4 * 0.4376 * 2;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const fig = new Frame();
const NONE = -1;

export function drawDefiance(fb: Frame, t = 147.5) {
  if (drawRaidStill(fb, t)) return;
  if (t < KNOW2 - 1) return drawKnow1(fb, t);
  if (t < KNOW3 - 1) return drawKnow2(fb, t);
  return drawKnow3(fb, t);
}

// ---------- shared: the club behind, out of focus, under the sirens ----------
function backdrop(fb: Frame, t: number, copsSide: number, hz = 0) {
  const s = siren(t);
  fb.vgrad(0, H, hex('#05030a'), hex('#0d0815'));
  // big soft bokeh discs: the siren lights and the stage, out of focus
  for (let k = 0; k < 12; k++) {
    const x = hash3(k, 1, 77) * W, y = 30 + hash3(k, 2, 77) * 200, r = 24 + hash3(k, 3, 77) * 40;
    const red = (k + Math.floor(beatPos(t) * 2)) % 2 === 0;
    fb.glow(x + Math.sin(t * 0.7 + k) * 6, y, r, red ? hex('#ff1020') : hex('#1d3cff'), 0.08 + 0.12 * s.k * hash3(k, 4, 77));
  }
  if (hz) floor(fb, t, hz);
  // the police line far back on their side: dark shapes, red visor slits (standing on the floor if we see it)
  for (let c = 0; c < 6; c++) {
    const x = copsSide > 0 ? 420 + c * 42 : 220 - c * 42, y = hz ? hz - 34 + (c % 2) * 3 : 210 + (c % 2) * 6;
    const foot = hz ? hz + 8 + (c % 2) * 3 : H;
    path(fb, `M${x - 16},${foot} L${x - 18},${y + 26} C${x - 18},${y - 6} ${x + 18},${y - 6} ${x + 18},${y + 26} L${x + 16},${foot} Z`, { fill: hex('#0a0812') });
    path(fb, `M${x - 11},${y + 8} C${x - 11},${y - 12} ${x + 11},${y - 12} ${x + 11},${y + 8} Z`, { fill: hex('#0c0a14') });
    line(fb, `M${x - 9},${y + 3} L${x + 9},${y + 3}`, P.red4);
    fb.glow(x, y + 3, 10, hex('#ff2020'), 0.18);
  }
  // smoke
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = vnoise(x * 0.012 + t * 0.15, y * 0.02 - t * 0.05, 211);
    if (n > 0.55) fb.add(x, y, s.red ? [0.35, 0.06, 0.1] : [0.08, 0.14, 0.4], (n - 0.55) * 0.35 * (0.4 + 0.6 * s.k));
  }
}

// Draw a figure into its own layer, then composite it lit by the siren. The flash comes from one side (red from the
// left, blue from the right): light hugs the silhouette on that side — a hard rim, then a coloured sheen that falls
// off a few pixels into the form — and the whole figure is graded slightly towards the flash colour.
// `keep(x, y)` can clip the layer (e.g. at a floor line).
function sirenFigure(fb: Frame, t: number, draw: (f: Frame) => void, strength = 1, keep?: (x: number, y: number) => boolean) {
  const s = siren(t);
  fig.clear([NONE, NONE, NONE]);
  draw(fig);
  if (keep) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!keep(x, y)) fig.r[y * W + x] = NONE;
  // where the light comes from
  const dir = s.red ? -1 : 1;
  const k = s.k * strength;
  const rim = s.red ? P.red6 : P.blu6;
  for (let y = 0; y < H; y++) {
    // scan away from the light: d = pixels since the silhouette edge on the lit side
    let d = 1e9;
    for (let n = 0; n < W; n++) {
      const x = dir < 0 ? n : W - 1 - n;
      const i = y * W + x;
      const r = fig.r[i]!;
      if (r <= NONE + 0.5) { d = -1; continue; }
      d = d < 0 ? 0 : d + 1;
      const g = fig.g[i]!, b = fig.b[i]!;
      const l = 0.3 * r + 0.6 * g + 0.1 * b;
      const sheen = Math.exp(-d / 30) * k, wash = 0.1 * k;
      fb.r[i] = r + (l * 1.6 + 0.02) * s.col[0] * (sheen + wash);
      fb.g[i] = g + (l * 1.6 + 0.02) * s.col[1] * (sheen + wash);
      fb.b[i] = b + (l * 1.6 + 0.02) * s.col[2] * (sheen + wash);
      if (d < 2 && k > 0.2) { fb.r[i] = rim[0]; fb.g[i] = rim[1]; fb.b[i] = rim[2]; }
    }
  }
}

// ---------- 1: the sister ----------
function drawKnow1(fb: Frame, t: number) {
  const lt = t - KNOW1;
  backdrop(fb, t, 1);
  // one slow nod on "know"
  const nod = Math.exp(-(((t - (KNOW1 + 0.95)) / 0.18) ** 2)) * 5;
  const k = 2.05 + 0.03 * lt;
  const m = mulX(translate(318, 200 + nod), mulX(scaleX(k), translate(-358, -150)));
  sirenFigure(fb, t, (f) => drawSisterFace(f, m, { gaze: [0, 0], ring: 1, braidSwing: Math.sin(beatPos(t) * Math.PI) * 0.2, blink: lt > 1.6 && lt < 1.72 ? 1 : 0 }));
}

// ---------- 2: the DJ — one clear move, then composure ----------
// Bowed in the music with his eyes closed, the head comes up level and the eyes open to the police on 'jā' (152.34); then the same
// steady head, only the mouth moving: 'nī' (152.54), the lips closing for the m, open on 'maḥ' (152.98), then the closed, certain
// hold. Whole figure drawings over the figure-free background, so the flames never boil between poses; the siren lights both.
const KNOW2_BG = loadPlate('dj_canon_know2_bg');
const KNOW2_FIG = Object.fromEntries(['D1', 'D2_ja', 'D3_ni', 'D4', 'D4_ma'].map((k) => [k, loadPlate(`dj_canon_know2_${k}`)])) as Record<string, ReturnType<typeof loadPlate>>;
function drawKnow2(fb: Frame, t: number) {
  const s = siren(t);
  const k = t < 152.33 ? 'D1' : t < 152.53 ? 'D2_ja' : t < 152.94 ? 'D3_ni' : t < 152.99 ? 'D4' : t < 153.22 ? 'D4_ma' : 'D4', fig = KNOW2_FIG[k]!;
  const nod = Math.round(1.2 * beatHit(t, 6));
  // siren: a hard sheen from the side the light comes from (red from image-left, blue from image-right) + a soft wash,
  // decaying through each half beat; the plate's own dark club light stays underneath
  const lit = s.red ? 0 : W - 1;
  drawPlate(fb, KNOW2_BG, 0, nod, { mul: (x) => {
    const d = Math.abs(x - lit) / W, sheen = Math.exp(-d * 3.2) * s.k, wash = 0.12 * s.k, dim = 0.82;
    return [dim + (sheen * 0.9 + wash) * s.col[0], dim + (sheen * 0.9 + wash) * s.col[1], dim + (sheen * 0.9 + wash) * s.col[2]];
  } });
  // breath: a slow 1-2 px rise and fall through the hold so the stillness is alive, not frozen
  const br = t > 152.95 ? Math.round(1.2 * Math.sin(Math.PI * Math.min(1, (t - 152.95) / 1.3))) : 0;
  drawPlate(fb, fig, 0, nod - br, { mul: (x) => {
    const d = Math.abs(x - lit) / W, sheen = Math.exp(-d * 3.2) * s.k, wash = 0.12 * s.k, dim = 0.82;
    return [dim + (sheen * 0.9 + wash) * s.col[0], dim + (sheen * 0.9 + wash) * s.col[1], dim + (sheen * 0.9 + wash) * s.col[2]];
  } });
  // fill the 1-px row the nod uncovers
  if (nod > 0) for (let x = 0; x < W; x++) { const i = x; fb.r[i] = fb.r[i + W]!; fb.g[i] = fb.g[i + W]!; fb.b[i] = fb.b[i + W]!; }
}

// ---------- 3: down on the floor under fire ----------
// Camera low on the floor. She is crouched close to us, head down; behind her the wet floor runs away to the police
// line. Tracers whip overhead; casings bounce past; on "know" she lifts her head and eyes to us.
const HZ = 232;
function floor(fb: Frame, t: number, hz: number) {
  const s = siren(t);
  for (let y = hz; y < H; y++) {
    const z = (y - hz) / (H - hz);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const n = vnoise(x * 0.05, y * 0.4, 61);
      const refl = Math.exp(-(((x - (s.red ? 140 : 500)) / 160) ** 2)) * s.k * (0.3 + 0.7 * n);
      fb.r[i] = 0.004 + refl * s.col[0] * 0.2; fb.g[i] = 0.003 + refl * s.col[1] * 0.2; fb.b[i] = 0.008 + refl * s.col[2] * 0.2;
      const u = (x - 320) / Math.max(0.02, z);
      if (Math.abs((((u / 70) % 1) + 1) % 1 - 0.5) > 0.5 - 0.01 / Math.max(0.06, z)) { fb.r[i] += 0.035 * z + 0.01; fb.g[i] += 0.003; fb.b[i] += 0.005; }
      const v = 1 / Math.max(0.02, z);
      if (Math.abs(((v * 2) % 1) - 0.5) > 0.47) { fb.r[i] += 0.03 * z + 0.008; fb.g[i] += 0.002; fb.b[i] += 0.005; }
    }
  }
}
function drawKnow3(fb: Frame, t: number) {
  const lt = t - KNOW3;
  backdrop(fb, t, 1, HZ);
  const lift = smooth((lt - 0.35) / 0.4);
  // crouched on the floor (the prepared sprite), her head coming up on "know"; a flinch on each volley
  const flinch = t < RISE ? Math.round(2 * Math.exp(-((t - FIRE) % 0.2188) * 20)) : 0;
  sirenFigure(fb, t, (f) => drawPlateAt(f, FLOOR, 330, 326 + flinch - Math.round(4 * lift), 0.5, 1));
  // tracers whipping overhead from the police side, until the crowd rises
  if (t < RISE - 0.15) {
    for (let k = 0; k < 12; k++) {
      const born = FIRE + k * 0.2188 + hash3(k, 1, 91) * 0.08;
      const age = t - born;
      if (age < 0 || age > 0.4) continue;
      const y0 = 8 + hash3(k, 2, 91) * 40, slope = (hash3(k, 3, 91) - 0.5) * 0.08;
      const hx = W + 60 - age * 2400;
      for (let d = 0; d < 160; d++) {
        const x = hx + d, y = y0 + (x - W / 2) * slope;
        const f = 1 - d / 160;
        fb.add(x, y, [1, 0.8, 0.55], 1.2 * f);
        if (d < 50) { fb.add(x, y - 1, [1, 0.45, 0.2], 0.4 * f); fb.add(x, y + 1, [1, 0.45, 0.2], 0.4 * f); }
      }
      fb.glow(hx, y0 + (hx - W / 2) * slope, 16, hex('#ffb070'), 0.4);
    }
    // spent casings bouncing past on the floor either side of her, glinting
    for (let k = 0; k < 7; k++) {
      const born = FIRE + 1.5 + k * 0.23;
      const age = t - born;
      if (age < 0) continue;
      const side = k % 2 ? 1 : -1;
      const x = 320 + side * (170 + hash3(k, 4, 91) * 120) - age * 40, bounce = Math.abs(Math.sin(age * 9 + k)) * Math.exp(-age * 2.5) * 22;
      const y = 300 + hash3(k, 5, 91) * 50 - bounce;
      line(fb, `M${x - 3},${y} L${x + 3},${y - 1}`, P.brs2, undefined, 2);
      fb.set(x + 1, y - 1, Math.sin(age * 20 + k) > 0.6 ? P.white : P.brs3);
    }
  }
}
