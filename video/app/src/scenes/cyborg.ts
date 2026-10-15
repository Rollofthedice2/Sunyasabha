// The cyborg (36.775 -> 42.504).
//   36.775 (the first prakāśe) -> 38.790: the cyborg, centred, looking at us; a slow push-in; a soft light sweeps across him on
//        each prakāśe ("light after light") and a restrained glint answers on the chrome.
//   38.790 (vadanti) -> 42.504 (the DJ cut): a close-up of his left-eye display (image-right). The five lines stream down
//        mirrored (we see the display from outside), the last character just before the cut.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame, W, H, type RGB } from '../engine/fb.ts';
import { loadPlate, type Plate } from '../engine/plate.ts';
import { drawHudTerminal, OWNER_HUD_LINES, hudLayer } from '../fig/hud_terminal.ts';
import { preserveColor } from '../engine/post_masks.ts';

export const S7_IN = 36.775, PRAKASE2 = 37.555, S8_IN = 38.790, DJ_CUT = 42.504;
// 1280x720 = 2x the frame
const WIDE = loadPlate('cyborg_a07_hi');
// cheek plate, chrome forearm, wrist (plate pixels)
const GLINTS: [number, number][] = [[576, 115], [490, 459], [459, 589]];
// the tilted lens quad (TL, TR, BR, BL) in the close-up plate's pixels
const QUAD = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../assets/plates/cyborg_s8_closeup_hi.json'), 'utf8')) as { lensQuad: [number, number][] }).lensQuad;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// bilinear sample of a hi-res plate through a camera (cx, cy = plate point at frame centre, s = plate px per frame px)
function drawCamera(fb: Frame, p: Plate, cx: number, cy: number, s: number, light?: (x: number, y: number) => RGB) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = Math.min(p.w - 1.001, Math.max(0, cx + (x - W / 2) * s)), v = Math.min(p.h - 1.001, Math.max(0, cy + (y - H / 2) * s));
    const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, i = y0 * p.w + x0;
    const bl = (a: Float32Array) => (a[i]! * (1 - fx) + a[i + 1]! * fx) * (1 - fy) + (a[i + p.w]! * (1 - fx) + a[i + p.w + 1]! * fx) * fy;
    let r = bl(p.r), g = bl(p.g), b = bl(p.b);
    if (light) { const m = light(x, y); r *= m[0]; g *= m[1]; b *= m[2]; }
    const o = y * W + x; fb.r[o] = r; fb.g[o] = g; fb.b[o] = b;
  }
}
const toFrame = (px: number, py: number, cx: number, cy: number, s: number): [number, number] => [W / 2 + (px - cx) / s, H / 2 + (py - cy) / s];

// a small 4-point star, additive
function glint(fb: Frame, x: number, y: number, k: number) {
  if (k <= 0.01) return;
  const c: RGB = [1, 0.92, 0.85];
  for (let d = -6; d <= 6; d++) { const f = k * (1 - Math.abs(d) / 7) ** 2; fb.add(Math.round(x + d), Math.round(y), c, f); fb.add(Math.round(x), Math.round(y + d), c, f); }
  fb.glow(x, y, 5, c, 0.6 * k);
}

export function drawCyborg(fb: Frame, t: number) {
  // push-in 1.00 -> 1.06 toward the face over the shot; a soft diagonal light band crosses on each prakāśe
  const u = smooth((t - S7_IN) / (S8_IN - S7_IN)), s = 2 / (1 + 0.06 * u), cx = 640 + (600 - 640) * u, cy = 360 + (250 - 360) * u;
  const sweeps = [S7_IN, PRAKASE2].map((t0) => (t - t0) / 0.55).filter((q) => q >= 0 && q <= 1);
  drawCamera(fb, WIDE, cx, cy, s, sweeps.length ? (x, y) => {
    let k = 1; for (const q of sweeps) { const pos = -200 + q * (W + 400), d = (x + 0.45 * y) - pos; k += 0.35 * Math.exp(-(d * d) / (2 * 38 * 38)) * Math.sin(q * Math.PI); }
    return [k, k * 0.96, k * 0.92];
  } : undefined);
  // restrained glints: cheek plate on the first prakāśe, forearm and wrist answering the second
  const gk = (t0: number, dur = 0.35) => (t >= t0 && t < t0 + dur ? Math.sin(((t - t0) / dur) * Math.PI) : 0);
  const pts = GLINTS.map(([px, py]) => toFrame(px, py, cx, cy, s));
  glint(fb, pts[0]![0], pts[0]![1], 0.8 * gk(S7_IN + 0.12));
  glint(fb, pts[1]![0], pts[1]![1], 0.7 * gk(PRAKASE2 + 0.08));
  glint(fb, pts[2]![0], pts[2]![1], 0.5 * gk(PRAKASE2 + 0.2));
}

// The palette snap and dither pull mid skin tones onto red entries, so painted skin keeps its colour: inside a face mask in plate
// coordinates (face, ear, metal plate and glasses: ellipse centre (540,330), radii (330,300) in the 1280x720 close-up) every pixel is
// kept except true neon rim light (almost no green); outside it a skin predicate (warm, r > g > b) still covers the neck.
function keepSkin(fb: Frame, cx: number, cy: number, s: number) {
  const keep = preserveColor(fb);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = Math.sqrt(fb.r[i]!), g = Math.sqrt(fb.g[i]!), b = Math.sqrt(fb.b[i]!);
    const u = cx + (x - W / 2) * s, v = cy + (y - H / 2) * s, inFace = ((u - 540) / 330) ** 2 + ((v - 330) / 300) ** 2 < 1;
    const neon = r > 0.75 && g < 0.25;
    if (inFace ? !neon : (r > 0.12 && r > g && g >= b * 0.9 && g > 0.2 && r < 3.2 * g)) keep[i] = 1;
  }
}

export function drawCyborgHud(fb: Frame, t: number) {
  // one blink and a reading glance toward his lens display, on the bar grid: half 39.90 | closed 39.95 | half 40.00 | open 40.05 |
  // reading 40.53-42.0
  const kid = (t >= 39.90 && t < 39.95) || (t >= 40.00 && t < 40.05) ? 'half' : (t >= 39.95 && t < 40.00) ? 'closed' : (t >= 40.53 && t < 42.0) ? 'reading' : null;
  const p = loadPlate(kid ? `cyborg_s8_closeup_kid_${kid}` : 'cyborg_s8_closeup_hi_v2'), quad = QUAD;
  // push 1.0 -> 1.4x toward the lens over the shot
  const u = smooth((t - S8_IN) / (DJ_CUT - S8_IN)), z = 1 + 0.4 * u, s = (p.w / W) / z;
  const lc = [(quad[0]![0] + quad[1]![0] + quad[2]![0] + quad[3]![0]) / 4, (quad[0]![1] + quad[1]![1] + quad[2]![1] + quad[3]![1]) / 4];
  const cx = p.w / 2 + (lc[0]! - p.w / 2) * 0.55 * u, cy = p.h / 2 + (lc[1]! - p.h / 2) * 0.55 * u;
  drawCamera(fb, p, cx, cy, s);
  keepSkin(fb, cx, cy, s);
  // the lens-local canvas stays fixed at the base framing: the push-in scales the text, never rewraps it
  const base = W / p.w;
  return lensHud(fb, t, quad.map(([x, y]) => toFrame(x, y, cx, cy, s)), localSize(quad, base));
}

// The terminal is rendered flat in the lens's own coordinates (mirrored there, as seen from outside), then mapped onto
// the tilted glass quad by a homography; it blends over the glass so the eye and reflections stay faintly visible.
// 3x3 (h33 = 1) mapping src -> dst
function homography(src: [number, number][], dst: [number, number][]) {
  const A: number[][] = [], bv: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!, [X, Y] = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); bv.push(X); A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); bv.push(Y);
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < 8; c++) {
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[piv]![c]!)) piv = r;
    [A[c], A[piv]] = [A[piv]!, A[c]!]; [bv[c], bv[piv]] = [bv[piv]!, bv[c]!];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r]![c]! / A[c]![c]!; for (let k = c; k < 8; k++) A[r]![k]! -= f * A[c]![k]!; bv[r]! -= f * bv[c]!; }
  }
  const h = bv.map((v, i) => v / A[i]![i]!); return [...h, 1];
}
// lens-local canvas size from the plate-space quad at a fixed framing scale, so the text never re-wraps during the push-in
function localSize(q: [number, number][], scale: number): [number, number] {
  const wTop = Math.hypot(q[1]![0] - q[0]![0], q[1]![1] - q[0]![1]), hL = Math.hypot(q[3]![0] - q[0]![0], q[3]![1] - q[0]![1]);
  return [Math.max(40, Math.round(wTop * scale)), Math.max(24, Math.round(hL * scale))];
}
function lensHud(fb: Frame, t: number, q: [number, number][], size: [number, number]) {
  const [LW, LH] = size, layer = hudLayer(LW, LH);
  // an AR display seen from behind: mostly clear glass with a faint tint, small 3x5 text with a soft glow, inset from the rim;
  // only just large enough that a careful viewer can pause and read it
  drawHudTerminal(fb, { x: 0, y: 0, w: LW, h: LH, t, start: S8_IN + 0.12, end: DJ_CUT - 0.12, lines: OWNER_HUD_LINES, mirror: true, layer,
    small: true, panel: 0.16, bg: [0.02, 0.12, 0.13], color: [0.62, 1.0, 0.95], textAlpha: 0.88, halo: 0.14, margin: Math.max(4, Math.round(LW * 0.12)) });
  // screen -> local
  const Hm = homography(q, [[0, 0], [LW, 0], [LW, LH], [0, LH]]);
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), keep = preserveColor(fb);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
      const d = Hm[6]! * (x + .5) + Hm[7]! * (y + .5) + 1, lx = (Hm[0]! * (x + .5) + Hm[1]! * (y + .5) + Hm[2]!) / d, ly = (Hm[3]! * (x + .5) + Hm[4]! * (y + .5) + Hm[5]!) / d;
      if (lx < 0 || ly < 0 || lx >= LW || ly >= LH) continue;
      const li = (ly | 0) * LW + (lx | 0), a = layer.a[li]!; if (a <= 0) continue;
      const o = y * W + x; keep[o] = 1;
      fb.r[o] = fb.r[o]! * (1 - a) + layer.r[li]! * a; fb.g[o] = fb.g[o]! * (1 - a) + layer.g[li]! * a; fb.b[o] = fb.b[o]! * (1 - a) + layer.b[li]! * a;
    }
}
