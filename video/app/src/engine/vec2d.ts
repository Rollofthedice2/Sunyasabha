// 2D drawing in native pixels: SVG-style paths (M L H V C S Q T Z, absolute + relative) rasterised
// without anti-aliasing (pixel centres), plus edge-aware rim lighting and selective outlines —
// the way a pixel artist lights flat shapes.
import { Frame, type RGB } from './fb.ts';

export type Pt = [number, number];
// a b c d e f (SVG matrix)
export type Xform = [number, number, number, number, number, number];

export const ID: Xform = [1, 0, 0, 1, 0, 0];
export function mulX(m: Xform, n: Xform): Xform {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export const translate = (x: number, y: number): Xform => [1, 0, 0, 1, x, y];
export const scaleX = (sx: number, sy = sx): Xform => [sx, 0, 0, sy, 0, 0];
export function rotateAbout(a: number, cx: number, cy: number): Xform {
  const c = Math.cos(a), s = Math.sin(a);
  return mulX(translate(cx, cy), mulX([c, s, -s, c, 0, 0], translate(-cx, -cy)));
}
export function invX(m: Xform): Xform {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
const apply = (m: Xform, p: Pt): Pt => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// ---- path parsing → polylines ----
export function flatten(d: string, m: Xform = ID): Pt[][] {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, lq: Pt | null = null;
  let i = 0;
  const num = () => parseFloat(tok[i++]!);
  const push = (px: number, py: number) => cur.push(apply(m, [px, py]));
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const n = Math.max(4, Math.ceil(Math.hypot(x3 - x, y3 - y) / 2));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
    lcx = x2; lcy = y2; x = x3; y = y3;
  };
  const quad = (x1: number, y1: number, x2: number, y2: number) => {
    const n = Math.max(4, Math.ceil(Math.hypot(x2 - x, y2 - y) / 2));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      push(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2);
    }
    lq = [x1, y1]; x = x2; y = y2;
  };
  while (i < tok.length) {
    const i0 = i;
    if (/[a-zA-Z]/.test(tok[i]!)) cmd = tok[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    const C = cmd.toUpperCase();
    if (C !== 'C' && C !== 'S') { lcx = NaN; }
    if (C !== 'Q' && C !== 'T') lq = null;
    switch (C) {
      case 'M': {
        if (cur.length > 1) polys.push(cur);
        x = ox + num(); y = oy + num(); sx = x; sy = y;
        cur = [apply(m, [x, y])];
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': x = ox + num(); y = oy + num(); push(x, y); break;
      case 'H': x = (rel ? x : 0) + num(); push(x, y); break;
      case 'V': y = (rel ? y : 0) + num(); push(x, y); break;
      case 'C': { const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(), f = ox + num(), g = oy + num(); cubic(a, b, c, e, f, g); break; }
      case 'S': {
        const rx = isNaN(lcx) ? x : 2 * x - lcx, ry = isNaN(lcx) ? y : 2 * y - lcy;
        const c = ox + num(), e = oy + num(), f = ox + num(), g = oy + num();
        cubic(rx, ry, c, e, f, g); break;
      }
      case 'Q': { const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(); quad(a, b, c, e); break; }
      case 'T': { const r: Pt = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y]; quad(r[0], r[1], ox + num(), oy + num()); break; }
      case 'Z': x = sx; y = sy; push(x, y); if (cur.length > 1) polys.push(cur); cur = [apply(m, [x, y])]; break;
      default: throw new Error(`path: unsupported command ${cmd}`);
    }
    if (i === i0) throw new Error(`path: stuck at token ${i} ('${tok[i]}') in: ${d.slice(0, 200)}`);
  }
  if (cur.length > 1) polys.push(cur);
  return polys;
}

// ---- masks ----
export class Mask {
  w: number;
  h: number;
  a: Uint8Array;
  // bounding box of set pixels (inclusive); empty when x0 > x1
  x0: number; y0: number; x1: number; y1: number;
  constructor(w: number, h: number) { this.w = w; this.h = h; this.a = new Uint8Array(w * h); this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1; }
  grow(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = Math.min(this.x0, x0); this.y0 = Math.min(this.y0, y0); this.x1 = Math.max(this.x1, x1); this.y1 = Math.max(this.y1, y1);
  }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.a[y * this.w + x]! : 0; }
}

// Non-zero fill sampled at pixel centres
export function fillMask(mask: Mask, polys: Pt[][], value = 1) {
  const { w, h } = mask;
  let y0 = h, y1 = 0;
  for (const p of polys) for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
  const xs: { x: number; d: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (const p of polys) {
      const n = p.length;
      for (let k = 0; k < n; k++) {
        const a = p[k]!, b = p[(k + 1) % n]!;
        if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) {
          const t = (cy - a[1]) / (b[1] - a[1]);
          xs.push({ x: a[0] + t * (b[0] - a[0]), d: b[1] > a[1] ? 1 : -1 });
        }
      }
    }
    xs.sort((p, q) => p.x - q.x);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k]!.d;
      if (wind !== 0) {
        const xa = Math.max(0, Math.ceil(xs[k]!.x - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1]!.x - 0.5));
        if (xb >= xa) mask.grow(xa, y, xb, y);
        for (let x = xa; x <= xb; x++) mask.a[y * w + x] = value;
      }
    }
  }
}

// Pixel lines (Bresenham) along a polyline, for strands, lash lines, creases
export function strokeMask(mask: Mask, polys: Pt[][], value = 1, width = 1) {
  for (const p of polys)
    for (let k = 0; k + 1 < p.length; k++) {
      let x0 = Math.round(p[k]![0] - 0.5), y0 = Math.round(p[k]![1] - 0.5);
      const x1 = Math.round(p[k + 1]![0] - 0.5), y1 = Math.round(p[k + 1]![1] - 0.5);
      if (!Number.isFinite(x0 + y0 + x1 + y1)) throw new Error(`strokeMask: non-finite point ${p[k]} → ${p[k + 1]} (poly of ${p.length}: ${p.slice(0, 3).join(' | ')})`);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        for (let oy = 0; oy < width; oy++) for (let ox = 0; ox < width; ox++) {
          const xx = x0 + ox - ((width - 1) >> 1), yy = y0 + oy - ((width - 1) >> 1);
          if (xx >= 0 && yy >= 0 && xx < mask.w && yy < mask.h) { mask.a[yy * mask.w + xx] = value; mask.grow(xx, yy, xx, yy); }
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
}

// Distance (in px, chamfer 3-4) from each inside pixel to the nearest outside pixel,
// and the outward edge normal (gradient of that distance), used for rims and bevel shading.
export function edgeField(mask: Mask, maxD = 12) {
  const { w, h } = mask;
  const INF = 1e6;
  const d = new Float32Array(w * h);
  if (mask.x1 < mask.x0) return d;
  const bx0 = Math.max(0, mask.x0 - 1), by0 = Math.max(0, mask.y0 - 1), bx1 = Math.min(w - 1, mask.x1 + 1), by1 = Math.min(h - 1, mask.y1 + 1);
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * w + x; d[i] = mask.a[i] ? INF : 0; }
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i]!;
    v = Math.min(v, x > 0 ? d[i - 1]! + 3 : INF, y > 0 ? d[i - w]! + 3 : INF,
      x > 0 && y > 0 ? d[i - w - 1]! + 4 : INF, x < w - 1 && y > 0 ? d[i - w + 1]! + 4 : INF);
    d[i] = v;
  }
  for (let y = by1; y >= by0; y--) for (let x = bx1; x >= bx0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i]!;
    v = Math.min(v, x < w - 1 ? d[i + 1]! + 3 : INF, y < h - 1 ? d[i + w]! + 3 : INF,
      x < w - 1 && y < h - 1 ? d[i + w + 1]! + 4 : INF, x > 0 && y < h - 1 ? d[i + w - 1]! + 4 : INF);
    d[i] = v;
  }
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * w + x; d[i] = Math.min(d[i]! >= INF ? maxD * 3 : d[i]! / 3, maxD); }
  return d;
}

export interface Rim {
  // screen-space direction the light comes FROM (e.g. [-1, 0] = from the left)
  dir: Pt;
  col: RGB;
  // px
  width: number;
  // min alignment of edge normal with the light (0..1)
  thr?: number;
}

export interface ShapeStyle {
  fill: RGB;
  rims?: Rim[];
  // drawn on edge pixels not taken by a rim
  outline?: RGB;
  // only where edge normal · light-dir < this (unlit side), default always
  outlineAt?: number;
  // inner shadow band on the side away from a light
  bevel?: { col: RGB; width: number; dir: Pt; thr?: number };
}

// Draw a shape mask into the frame with flat fill + edge lighting.
export function drawShape(fb: Frame, mask: Mask, st: ShapeStyle, clip?: Mask, edgesOnly = false) {
  const needField = !!(st.rims?.length || st.outline || st.bevel);
  const dist = needField ? edgeField(mask, 14) : null;
  const { w, h } = mask;
  for (let y = Math.max(0, mask.y0); y <= Math.min(h - 1, mask.y1); y++)
    for (let x = Math.max(0, mask.x0); x <= Math.min(w - 1, mask.x1); x++) {
      const i = y * w + x;
      if (!mask.a[i]) continue;
      if (clip && !clip.a[i]) continue;
      let c = st.fill;
      let touched = !edgesOnly;
      if (dist) {
        const dv = dist[i]!;
        // outward normal = -gradient of distance
        const gx = (x > 0 ? dist[i - 1]! : 0) - (x < w - 1 ? dist[i + 1]! : 0);
        const gy = (y > 0 ? dist[i - w]! : 0) - (y < h - 1 ? dist[i + w]! : 0);
        const gl = Math.hypot(gx, gy) || 1;
        const nx = gx / gl, ny = gy / gl;
        let lit = false;
        if (st.bevel) {
          const b = st.bevel;
          const dl = Math.hypot(b.dir[0], b.dir[1]);
          const al = (nx * b.dir[0] + ny * b.dir[1]) / dl;
          if (dv <= b.width && al < -(b.thr ?? 0.2)) { c = b.col; touched = true; }
        }
        for (const r of st.rims ?? []) {
          const dl = Math.hypot(r.dir[0], r.dir[1]);
          const al = (nx * r.dir[0] + ny * r.dir[1]) / dl;
          if (dv <= r.width && al > (r.thr ?? 0.35)) { c = r.col; lit = true; touched = true; break; }
        }
        if (!lit && st.outline && dv <= 1) {
          c = st.outline; touched = true;
        }
      }
      if (!touched) continue;
      fb.r[i] = c[0]; fb.g[i] = c[1]; fb.b[i] = c[2];
    }
}

// Rounded limb segment (two circles joined by tangents) as a path: fingers, arms, puppet parts
export function seg(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  // circle-ish cubic handles
  const k = 0.5523;
  const a = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  return `M${a(x0 + nx * r0, y0 + ny * r0)} L${a(x1 + nx * r1, y1 + ny * r1)} ` +
    `C${a(x1 + nx * r1 + ux * r1 * k, y1 + ny * r1 + uy * r1 * k)} ${a(x1 + ux * r1 + nx * r1 * k, y1 + uy * r1 + ny * r1 * k)} ${a(x1 + ux * r1, y1 + uy * r1)} ` +
    `C${a(x1 + ux * r1 - nx * r1 * k, y1 + uy * r1 - ny * r1 * k)} ${a(x1 - nx * r1 + ux * r1 * k, y1 - ny * r1 + uy * r1 * k)} ${a(x1 - nx * r1, y1 - ny * r1)} ` +
    `L${a(x0 - nx * r0, y0 - ny * r0)} ` +
    `C${a(x0 - nx * r0 - ux * r0 * k, y0 - ny * r0 - uy * r0 * k)} ${a(x0 - ux * r0 - nx * r0 * k, y0 - uy * r0 - ny * r0 * k)} ${a(x0 - ux * r0, y0 - uy * r0)} ` +
    `C${a(x0 - ux * r0 + nx * r0 * k, y0 - uy * r0 + ny * r0 * k)} ${a(x0 + nx * r0 - ux * r0 * k, y0 + ny * r0 - uy * r0 * k)} ${a(x0 + nx * r0, y0 + ny * r0)} Z`;
}

// Convenience: one-call path fill with style
export function path(fb: Frame, d: string, st: ShapeStyle, m: Xform = ID, clip?: Mask) {
  const mask = new Mask(fb.w, fb.h);
  fillMask(mask, flatten(d, m));
  drawShape(fb, mask, st, clip);
  return mask;
}
// Union of several paths, shaded as one shape (no seams or outlines between the parts)
export function paths(fb: Frame, ds: string[], st: ShapeStyle, m: Xform = ID, clip?: Mask) {
  const mask = new Mask(fb.w, fb.h);
  for (const d of ds) fillMask(mask, flatten(d, m));
  drawShape(fb, mask, st, clip);
  return mask;
}
let scratch: Mask | null = null;
export function line(fb: Frame, d: string, col: RGB, m: Xform = ID, width = 1, clip?: Mask) {
  // reuse one scratch mask (cleared over its touched box only) instead of allocating a full frame per line
  if (!scratch || scratch.w !== fb.w || scratch.h !== fb.h) scratch = new Mask(fb.w, fb.h);
  const mask = scratch;
  strokeMask(mask, flatten(d, m), 1, width);
  for (let y = Math.max(0, mask.y0); y <= Math.min(mask.h - 1, mask.y1); y++) for (let x = Math.max(0, mask.x0); x <= Math.min(mask.w - 1, mask.x1); x++) {
    const i = y * mask.w + x;
    if (!mask.a[i]) continue;
    if (!clip || clip.a[i]) { fb.r[i] = col[0]; fb.g[i] = col[1]; fb.b[i] = col[2]; }
    mask.a[i] = 0;
  }
  mask.x0 = mask.w; mask.y0 = mask.h; mask.x1 = -1; mask.y1 = -1;
  return mask;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// Shade every pixel of a mask from a ramp by a scalar field f(x,y) in 0..1, with ordered dither
// between neighbouring ramp entries (dither = width of the dithered band, 0 = hard bands).
export function shadeMask(fb: Frame, mask: Mask, f: (x: number, y: number) => number, ramp: RGB[], dither = 0.5, clip?: Mask) {
  const n = ramp.length;
  for (let y = Math.max(0, mask.y0); y <= Math.min(mask.h - 1, mask.y1); y++)
    for (let x = Math.max(0, mask.x0); x <= Math.min(mask.w - 1, mask.x1); x++) {
      const i = y * mask.w + x;
      if (!mask.a[i] || (clip && !clip.a[i])) continue;
      const v = Math.max(0, Math.min(0.9999, f(x, y))) * n;
      const base = Math.floor(v), frac = v - base;
      const th = BAYER4[((y & 3) << 2) | (x & 3)]!;
      // within the dither band around the boundary, flip to the next entry by threshold
      const k = dither > 0 && frac > 1 - dither / 2 && (frac - (1 - dither / 2)) / dither > th ? Math.min(n - 1, base + 1)
        : dither > 0 && frac < dither / 2 && (dither / 2 - frac) / dither > th ? Math.max(0, base - 1) : base;
      const c = ramp[k]!;
      fb.r[i] = c[0]; fb.g[i] = c[1]; fb.b[i] = c[2];
    }
}
export function maskOf(fb: { w: number; h: number }, d: string | string[], m: Xform = ID) {
  const mask = new Mask(fb.w, fb.h);
  for (const p of Array.isArray(d) ? d : [d]) fillMask(mask, flatten(p, m));
  return mask;
}

// Shade a limb segment as a cylinder: value from the cross-section facing a 2D light direction
// (lx,ly = direction the light comes FROM in screen space), plus a falloff along the length.
export function shadeLimb(fb: Frame, ax: number, ay: number, bx: number, by: number, ra: number, rb: number, ramp: RGB[],
  light: Pt = [0.3, -1], bias = 0, clip?: Mask, alongFade = 0) {
  const m = new Mask(fb.w, fb.h);
  fillMask(m, flatten(seg(ax, ay, bx, by, ra, rb)));
  const dx = bx - ax, dy = by - ay, ln = Math.hypot(dx, dy) || 1;
  // left normal
  const nx = -dy / ln, ny = dx / ln;
  const ll = Math.hypot(light[0], light[1]) || 1;
  shadeMask(fb, m, (x, y) => {
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (ln * ln)));
    const cx = ax + dx * u, cy = ay + dy * u;
    const r = ra + (rb - ra) * u;
    // -1..1 across
    const a = ((x - cx) * nx + (y - cy) * ny) / r;
    const nz = Math.sqrt(Math.max(0, 1 - a * a));
    // surface normal in screen space ~ (a*nx, a*ny, nz); light mostly frontal-ish plus the 2D direction
    const d = (a * nx * light[0] + a * ny * light[1]) / ll * 0.75 + nz * 0.35;
    return 0.35 + 0.5 * d + bias - alongFade * u;
  }, ramp, 0.5, clip);
  return m;
}

// Modulate already-painted pixels inside a mask by a lighting factor (form shading over flat paint).
export function volumePass(fb: Frame, mask: Mask, factor: (x: number, y: number) => number) {
  for (let y = Math.max(0, mask.y0); y <= Math.min(mask.h - 1, mask.y1); y++)
    for (let x = Math.max(0, mask.x0); x <= Math.min(mask.w - 1, mask.x1); x++) {
      const i = y * mask.w + x;
      if (!mask.a[i]) continue;
      const f = factor(x, y);
      fb.r[i] = fb.r[i]! * f; fb.g[i] = fb.g[i]! * f; fb.b[i] = fb.b[i]! * f;
    }
}
// ellipsoid lighting factor in a local frame: centre (cx,cy), radii (rx,ry), light dir (lx,ly,lz) (z towards us)
export function ellipsoidLight(inv: Xform, cx: number, cy: number, rx: number, ry: number, l: [number, number, number], amb = 0.55, k = 0.75) {
  const ll = Math.hypot(...l);
  return (x: number, y: number) => {
    const lx = inv[0] * x + inv[2] * y + inv[4], ly = inv[1] * x + inv[3] * y + inv[5];
    const nx = (lx - cx) / rx, ny = (ly - cy) / ry;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return amb + k * Math.max(0, (nx * l[0] + ny * l[1] + nz * l[2]) / ll);
  };
}
