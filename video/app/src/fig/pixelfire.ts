// Pixel-art blue fire for the braziers: evolving tongues that split and rejoin, rising sparks and a matching light
// spill, at the frame's native pixel scale. A heat field on the pixel grid (one cell = one pixel of the 640x360 frame):
// each step heat rises one row, drifts sideways with a slowly turning wind and cools by a seeded random amount (so
// tongues tear off and re-form), and the bowl row is re-fed with a moving noise profile (three wandering tongue roots).
// The field is carried from the previous frame of the same brazier and advanced only by the steps since; a cold start
// (the first frame, a seek, a new render worker) first runs enough warm-up steps to develop the field fully. Heat maps
// to the blue palette in hard steps. Sparks are deterministic particles born at the tongue tips; the light spill scales
// with the frame's total heat.
import { Frame, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { hash3, vnoise } from './sdf.ts';

// Heat rises one row per step, so the warm-up must exceed the grid height (plus a margin) for every tongue to end
// where it cools rather than at a flat lid.
const STEP_HZ = 30, WARM_MARGIN = 30;
const FIRE_STATE = new Map<string, { heat: Float32Array; next: Float32Array; s: number; on: number }>();
// The per-cell noise terms (sway, wind gain, gaps, lid) depend only on (x, rise = y + step), so a row computed for one
// step is the same row one cell lower on the next: rows are cached per brazier by rise and each step computes only the
// new ones.
const FIRE_ROWS = new Map<string, { R: number; tag: Float64Array; rows: Float64Array; edge: Float64Array }>();
const RAMP: RGB[] = [P.blu2, P.blu3, P.blu4, P.blu5, P.blu6, P.cy0, P.cy1, P.blu7] as RGB[];
// w x h is the bowl width and flame height in cells; cell > 1 draws the same simulation with cell x cell pixel blocks
// for close-ups. on (0..1) scales the feed (an ignition grows the fire, it does not fade it in).
export function pixelFire(fb: Frame, cx: number, base: number, w: number, h: number, t: number, seed: number, on = 1, cell = 1) {
  if (on <= 0.01) return;
  // The grid has PAD empty columns on each side of the bowl width BW; the feed and the cooling profile are defined on
  // the bowl, so leaning tongues curl out past it and burn off in the open instead of being cut by the grid edge.
  const BW = Math.round(w), PAD = Math.round(BW * 0.4);
  const W = BW + 2 * PAD, H = Math.round(h), x0 = Math.round(cx - W / 2);
  const s1 = Math.floor(t * STEP_HZ), key = `${seed}|${cx}|${base}|${W}|${H}|${cell}`, st = FIRE_STATE.get(key);
  let heat: Float32Array, next: Float32Array, sStart: number;
  // carry only while 'on' is unchanged (during an ignition ramp each frame warms up again at its current 'on')
  if (st && st.on === on && st.s <= s1 && s1 - st.s <= H + WARM_MARGIN) { heat = st.heat; next = st.next; sStart = st.s + 1; }
  else { heat = new Float32Array(W * H); next = new Float32Array(W * H); sStart = s1 - (H + WARM_MARGIN); }
  pixelFireSteps(heat, next, sStart, s1, W, H, BW, PAD, seed, on, key); heat = FIRE_SWAP.heat!; next = FIRE_SWAP.next!;
  FIRE_STATE.set(key, { heat, next, s: s1, on });
  // draw: heat -> palette (hard steps, pixel art), additive core light
  const ox = cell === 1 ? x0 : Math.round(cx - (W * cell) / 2), oy = base - (H - 1) * cell;
  const blk = (x: number, y: number, c: RGB) => { if (cell === 1) { fb.set(x0 + x, base - (H - 1) + y, c); return; } for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) fb.set(ox + Math.round(x * cell) + dx, oy + Math.round(y * cell) + dy, c); };
  let total = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // the top rows are never drawn
    const v = heat[y * W + x]!; if (v < 0.12 || y < 3) continue; total += v;
    const k = Math.min(RAMP.length - 1, Math.floor((v - 0.12) / 0.88 * RAMP.length));
    blk(x, y, RAMP[k]!);
  }
  // sparks: 22 of them, born at this frame's tongue tips (the top-most hot cell per column), each with its own speed,
  // drift, size (1-2 px) and a short trail; white -> pale cyan -> blue as they cool, flickering out with age
  const tips: [number, number][] = [];
  for (let x = 1; x < W - 1; x++) { for (let y = 0; y < H; y++) if (heat[y * W + x]! > 0.3) { tips.push([x, y]); break; } }
  // the highest tips
  tips.sort((a, b) => a[1] - b[1]); const hi = tips.slice(0, Math.max(3, Math.floor(tips.length * 0.35)));
  for (let k = 0; hi.length && k < 22; k++) {
    const period = 0.45 + 0.6 * hash3(k, seed, 41), life = (t / period + hash3(k, seed, 42)) % 1;
    const sb = Math.floor((t - life * period) * STEP_HZ), [bx, by] = hi[Math.floor(hash3(k, sb, 43) * hi.length)]!;
    const vy = 28 + 60 * hash3(k, sb, 45), drift = (hash3(k, sb, 46) - 0.5) * 30, curl = Math.sin(life * (5 + 4 * hash3(k, sb, 48)) + k) * (2 + 3 * hash3(k, sb, 49));
    const age = life * period, x = bx + drift * age + curl, y = by - 2 - vy * age;
    // flicker out with age
    if (hash3(k, Math.floor(t * 24), 47) < 0.25 * life) continue;
    const c: RGB = life < 0.3 ? P.blu7 : life < 0.65 ? P.cy1 : P.blu5, big = hash3(k, sb, 50) < 0.35 && life < 0.5;
    blk(Math.round(x), Math.round(y), c); if (big) blk(Math.round(x) + 1, Math.round(y), c);
    // trail
    if (life < 0.6) { blk(Math.round(x - drift * 0.03), Math.round(y + 1), P.blu6); blk(Math.round(x - drift * 0.06), Math.round(y + 2), P.blu4); }
  }
  // light spill: a tight glow at the flame body plus a faint lift on the stone above, both scaled by the frame's heat
  const amt = Math.min(1, total / (BW * 100 * 0.22));
  fb.glow(cx, base - 30 * cell, (34 + 14 * amt) * cell, hex('#2a5cff'), 0.12 * amt * on, 0.9);
  fb.glow(cx, base - 95 * cell, 40 * cell, hex('#1d4cff'), 0.05 * amt * on, 0.9);
}

const FIRE_SWAP: { heat: Float32Array | null; next: Float32Array | null } = { heat: null, next: null };
// Advances the field from step sStart to s1 (inclusive); the result is left in FIRE_SWAP.
function pixelFireSteps(heat: Float32Array, next: Float32Array, sStart: number, s1: number, W: number, H: number, BW: number, PAD: number, seed: number, on: number, key: string) {
  let rc = FIRE_ROWS.get(key);
  if (!rc) {
    const R = 2 * H, edge = new Float64Array(W);
    for (let x = 0; x < W; x++) edge[x] = 1 + 2.2 * Math.abs((x - PAD + 0.5) / BW - 0.5) ** 1.5;
    rc = { R, tag: new Float64Array(R).fill(NaN), rows: new Float64Array(R * W * 4), edge };
    FIRE_ROWS.set(key, rc);
  }
  const { R, tag, rows, edge } = rc;
  // offset of the cached row for this rise: [sway, wind-gain noise, gaps, lid] x W
  const row = (rise: number) => {
    const slot = ((rise % R) + R) % R, off = slot * W * 4;
    if (tag[slot] !== rise) {
      for (let x = 0; x < W; x++) {
        const o = off + x * 4;
        rows[o] = (vnoise(x * 0.09 + seed, rise * 0.07, 11) - 0.5) * 1.1;
        rows[o + 1] = vnoise(x * 0.06 + seed, rise * 0.04, 13);
        rows[o + 2] = vnoise(x * 0.18 + seed * 0.3, rise * 0.08, 12) ** 2.2;
        rows[o + 3] = 0.42 + 0.18 * (vnoise(x * 0.11 + seed, rise * 0.05, 14) - 0.5);
      }
      tag[slot] = rise;
    }
    return off;
  };
  const rcs = [0, 0, 0], rws = [0, 0, 0], ras = [0, 0, 0];
  for (let s = sStart; s <= s1; s++) {
    const ts = s / STEP_HZ;
    // feed the bowl row: three tongue roots that wander and pulse independently, separated by cooler gaps
    for (let r = 0; r < 3; r++) {
      rcs[r] = (r - 1) * 0.28 + 0.10 * (vnoise(seed + r * 5, ts * 0.8, 3) - 0.5); rws[r] = 0.10 + 0.04 * vnoise(seed + r * 7, ts * 1.3, 4);
      ras[r] = 0.75 + 0.35 * vnoise(seed + r * 11, ts * 2.2, 5);
    }
    for (let x = 0; x < W; x++) {
      const u = (x - PAD + 0.5) / BW - 0.5, bowl = Math.max(0, 1 - (2 * u) ** 2 * 1.1);
      let roots = 0;
      for (let r = 0; r < 3; r++) {
        const rcv = rcs[r]!, rw = rws[r]!;
        roots = Math.max(roots, Math.exp(-(((u - rcv) / rw) ** 2)) * ras[r]!);
      }
      heat[(H - 1) * W + x] = Math.min(1, on * bowl * (0.35 + 0.75 * roots));
    }
    const wind = (vnoise(seed + 9, ts * 0.6, 7) - 0.5) * 0.7;
    next.fill(0);
    // Sideways drift and cooling come from low-frequency noise fields that travel up with the heat, so cool gaps rise
    // through the flame and tear tongues off coherently. The wind varies across x so no whole row shifts at once; the
    // gaps are stretched vertically (upright splits, not round holes). Cooling is absolute per row, plus a burn-out band
    // whose height wanders per column and over time, so tongues end at varied heights below the grid edge.
    for (let y = 0; y < H - 1; y++) {
      const rise = y + s, off = row(rise);
      for (let x = 0; x < W; x++) {
        const o = off + x * 4;
        const sway = rows[o]!;
        const windx = wind * (0.6 + 0.8 * rows[o + 1]!) * (1 - y / H);
        const sxi = Math.round(x - windx - sway);
        const src = sxi < 0 || sxi >= W ? 0 : heat[(y + 1) * W + sxi]!;
        const gaps = rows[o + 2]!;
        const lid = rows[o + 3]!, top = Math.max(0, (lid - y / H) / lid) ** 2 * 0.12;
        const cool = (0.0026 + 0.030 * gaps) * edge[x]! * (100 / 104) + top + 0.002 * hash3(x, y + s * 131, seed + 2);
        next[y * W + x] = Math.max(0, src - cool);
      }
    }
    for (let x = 0; x < W; x++) next[(H - 1) * W + x] = heat[(H - 1) * W + x]!;
    const tmp = heat; heat = next; next = tmp;
  }
  FIRE_SWAP.heat = heat; FIRE_SWAP.next = next;
}
