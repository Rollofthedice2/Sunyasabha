// Plates and sprites: generated art prepared offline (resized to the film's native grid,
// chroma-keyed), loaded as straight-alpha RGBA8 and converted to linear light. Composited with hard alpha so the
// pixel art stays crisp; everything that moves (flames, light, glyphs, hands) is drawn by the engine on top.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Frame, srgbToLin, type RGB } from './fb.ts';
import { Mask } from './vec2d.ts';

export interface Plate { w: number; h: number; r: Float32Array; g: Float32Array; b: Float32Array; a: Uint8Array; bbox: [number, number, number, number]; anchor?: [number, number] }
export type PlateMetadata = Pick<Plate, 'w' | 'h' | 'bbox' | 'anchor'>;
const DIR = path.resolve(import.meta.dirname, '../../assets/plates');
const cache = new Map<string, Plate>();
const LIN = Float32Array.from({ length: 256 }, (_, i) => srgbToLin(i / 255));

// Some chorus drawing families come back ~10 % smaller than the rest on the same sole line; where a copy enlarged 1.10x
// about the soles exists (<name>_x110), it is loaded in place of the original.
const CHORUS_SCALE_RX = /^dj_(s4_A02|ib_A01|ecomp_A02|jump_A02|s5_A01|s6_A02)_/;
export function loadPlate(name: string): Plate {
  if (CHORUS_SCALE_RX.test(name) && !name.endsWith('_x110') && existsSync(path.join(DIR, `${name}_x110.json`))) name = `${name}_x110`;
  let p = cache.get(name);
  if (p) return p;
  p = readPlate(name);
  cache.set(name, p);
  return p;
}

export function readPlateMetadata(name: string): PlateMetadata {
  const meta = JSON.parse(readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as { w: number; h: number; bbox: [number, number, number, number] | null; anchor?: [number, number] };
  if (!Number.isSafeInteger(meta.w) || !Number.isSafeInteger(meta.h) || meta.w <= 0 || meta.h <= 0)
    throw new Error(`Invalid plate dimensions: ${name}`);
  return { w: meta.w, h: meta.h, bbox: meta.bbox ?? [0, 0, meta.w - 1, meta.h - 1], anchor: meta.anchor };
}

// Uncached reader for bounded animation caches. Never calls loadPlate, whose
// permanent cache retains sprites and cyclic animations.
export function readPlate(name: string, meta = readPlateMetadata(name)): Plate {
  const raw = readFileSync(path.join(DIR, `${name}.rgba`));
  return decodePlate(meta, raw);
}

export function decodePlate(meta: PlateMetadata, raw: Uint8Array): Plate {
  const n = meta.w * meta.h;
  if (raw.byteLength !== n * 4) throw new Error(`Incomplete plate pixels: expected ${n * 4}, got ${raw.byteLength}`);
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), a = new Uint8Array(n);
  for (let i = 0; i < n; i++) { r[i] = LIN[raw[i * 4]!]!; g[i] = LIN[raw[i * 4 + 1]!]!; b[i] = LIN[raw[i * 4 + 2]!]!; a[i] = raw[i * 4 + 3]! > 127 ? 1 : 0; }
  return { ...meta, r, g, b, a };
}

export interface PlateOpts {
  flipX?: boolean;
  // only paint where the clip mask is set
  clip?: Mask;
  // light multiplier (constant or per pixel)
  mul?: RGB | ((x: number, y: number) => RGB);
  // screen-space holdout
  skip?: (x: number, y: number) => boolean;
  // integer horizontal offset per screen row (a body roll, a wobble): pixel-safe
  rowShift?: (sy: number) => number;
}

// Fast path when only `mul` (or nothing) is set and the plate does not share memory with the frame: rows are walked as runs of
// opaque pixels clipped to the frame once per row (no per-pixel option checks); plain runs of 16+ pixels are block-copied.
// Same pixels, same order of mul() calls and same float32 values as the general loop in drawPlate.
function drawPlateRuns(fb: Frame, p: Plate, x: number, y: number, mul: PlateOpts['mul']) {
  const [bx0, by0, bx1, by1] = p.bbox;
  const W = fb.w, Hh = fb.h, pw = p.w, pa = p.a, pr = p.r, pg = p.g, pb = p.b, fr = fb.r, fg = fb.g, fbb = fb.b;
  const lo = Math.max(bx0, -x), hi = Math.min(bx1, W - 1 - x);
  if (lo > hi) return;
  const mf = typeof mul === 'function' ? mul : null, mc = mul && typeof mul !== 'function' ? mul : null;
  for (let py = by0; py <= by1; py++) {
    const sy = y + py;
    if (sy < 0 || sy >= Hh) continue;
    const rs = py * pw, rd = sy * W + x;
    let px = lo;
    while (px <= hi) {
      if (!pa[rs + px]) { px++; continue; }
      let e = px + 1;
      while (e <= hi && pa[rs + e]) e++;
      if (mf) {
        for (let k = px; k < e; k++) { const m = mf(x + k, sy), si = rs + k, di = rd + k; fr[di] = pr[si]! * m[0]; fg[di] = pg[si]! * m[1]; fbb[di] = pb[si]! * m[2]; }
      } else if (mc) {
        for (let k = px; k < e; k++) { const si = rs + k, di = rd + k; fr[di] = pr[si]! * mc[0]; fg[di] = pg[si]! * mc[1]; fbb[di] = pb[si]! * mc[2]; }
      } else if (e - px >= 16) {
        fr.set(pr.subarray(rs + px, rs + e), rd + px); fg.set(pg.subarray(rs + px, rs + e), rd + px); fbb.set(pb.subarray(rs + px, rs + e), rd + px);
      } else {
        for (let k = px; k < e; k++) { const si = rs + k, di = rd + k; fr[di] = pr[si]!; fg[di] = pg[si]!; fbb[di] = pb[si]!; }
      }
      px = e;
    }
  }
}

// Paint a plate with its top-left corner at (x, y) (integers: plates never resample at draw time).
export function drawPlate(fb: Frame, p: Plate, x: number, y: number, o: PlateOpts = {}) {
  x |= 0; y |= 0;
  if (!o.flipX && !o.clip && !o.skip && !o.rowShift && p.r.buffer !== fb.r.buffer && p.g.buffer !== fb.g.buffer && p.b.buffer !== fb.b.buffer
    && p.r.buffer !== fb.g.buffer && p.r.buffer !== fb.b.buffer && p.g.buffer !== fb.r.buffer && p.g.buffer !== fb.b.buffer && p.b.buffer !== fb.r.buffer && p.b.buffer !== fb.g.buffer) {
    drawPlateRuns(fb, p, x, y, o.mul); return;
  }
  const [bx0, by0, bx1, by1] = p.bbox;
  const W = fb.w;
  for (let py = by0; py <= by1; py++) {
    const sy = y + py;
    if (sy < 0 || sy >= fb.h) continue;
    for (let px = bx0; px <= bx1; px++) {
      const si = py * p.w + px;
      if (!p.a[si]) continue;
      const sx = x + (o.flipX ? p.w - 1 - px : px) + (o.rowShift ? o.rowShift(sy) : 0);
      if (sx < 0 || sx >= W) continue;
      const di = sy * W + sx;
      if (o.clip && !o.clip.a[di]) continue;
      if (o.skip && o.skip(sx, sy)) continue;
      let r = p.r[si]!, g = p.g[si]!, b = p.b[si]!;
      if (o.mul) { const m = typeof o.mul === 'function' ? o.mul(sx, sy) : o.mul; r *= m[0]; g *= m[1]; b *= m[2]; }
      fb.r[di] = r; fb.g[di] = g; fb.b[di] = b;
    }
  }
}

// The plate's opaque pixels as a screen-space mask at a placement (for clipping, relighting, holdouts).
export function plateMask(fb: Frame, p: Plate, x: number, y: number, flipX = false) {
  x |= 0; y |= 0;
  const m = new Mask(fb.w, fb.h);
  const [bx0, by0, bx1, by1] = p.bbox;
  for (let py = by0; py <= by1; py++) {
    const sy = y + py;
    if (sy < 0 || sy >= fb.h) continue;
    for (let px = bx0; px <= bx1; px++) {
      if (!p.a[py * p.w + px]) continue;
      const sx = x + (flipX ? p.w - 1 - px : px);
      if (sx < 0 || sx >= fb.w) continue;
      const di = sy * fb.w + sx;
      m.a[di] = 1;
      if (sx < m.x0) m.x0 = sx; if (sx > m.x1) m.x1 = sx; if (sy < m.y0) m.y0 = sy; if (sy > m.y1) m.y1 = sy;
    }
  }
  return m;
}

// Place a plate by an anchor on its opaque bounding box: (ax, ay) in 0..1 (0.5, 1 = bottom-centre) lands on (x, y).
export function drawPlateAt(fb: Frame, p: Plate, x: number, y: number, ax = 0.5, ay = 1, o: PlateOpts = {}) {
  const [bx0, by0, bx1, by1] = p.bbox;
  // animation frames carry a feet anchor (so a reaching arm never slides the body); plain sprites use the box
  const ox = p.anchor && ax === 0.5 && ay === 1 ? Math.round(x - p.anchor[0]) : Math.round(x - bx0 - (bx1 - bx0) * ax);
  const oy = p.anchor && ax === 0.5 && ay === 1 ? Math.round(y - p.anchor[1]) : Math.round(y - by0 - (by1 - by0) * ay);
  drawPlate(fb, p, ox, oy, o);
  return [ox, oy] as [number, number];
}
