// Shared 2D figure style: rim lights, outline, lip colours, hair strands, chains.
import { Frame, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { line, type Rim, type Xform } from '../engine/vec2d.ts';
import { hash3 } from './sdf.ts';

export const rimL = (bright: RGB = P.blu5, mid: RGB = P.blu3, w = 3): Rim[] => [
  { dir: [-1, -0.2], col: bright, width: 1, thr: 0.55 }, { dir: [-1, -0.2], col: mid, width: w, thr: 0.5 }];
export const rimR = (bright: RGB = P.blu6, mid: RGB = P.blu3, w = 2): Rim[] => [
  { dir: [1, -0.3], col: bright, width: 1, thr: 0.6 }, { dir: [1, -0.3], col: mid, width: w, thr: 0.55 }];
export const rimB = (bright: RGB = P.red4, mid: RGB = P.red2, w = 2): Rim[] => [
  { dir: [0.1, 1], col: bright, width: 1, thr: 0.6 }, { dir: [0.1, 1], col: mid, width: w, thr: 0.5 }];
export const OUT = hex('#07040b');
export const LIP_D = hex('#4e201d'), LIP_M = hex('#6e3029'), LIP_L = hex('#93493d'), LIP_LINE = hex('#240c0c');

export function ap(m: Xform, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// Hair strands between two guide curves (4 control points each, outer → inner)
export function strands(fb: Frame, m: Xform, outer: [number, number][], inner: [number, number][], n: number, seed: number, glintCol: RGB = P.blu5) {
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n + (hash3(seed, k, 1) - 0.5) * 0.06;
    const pts = outer.map((o, i) => [o[0] + (inner[i]![0] - o[0]) * t + (hash3(seed, k, i) - 0.5) * 3, o[1] + (inner[i]![1] - o[1]) * t] as [number, number]);
    const d = `M${pts[0]![0]},${pts[0]![1]} C${pts[1]![0]},${pts[1]![1]} ${pts[2]![0]},${pts[2]![1]} ${pts[3]![0]},${pts[3]![1]}`;
    line(fb, d, t < 0.25 ? P.blu2 : k % 2 ? P.void3 : P.void2, m);
    if (t < 0.45) {
      const g0 = 0.15 + hash3(seed, k, 7) * 0.5;
      for (let u = g0; u < g0 + 0.12; u += 0.01) { const [x, y] = bez(pts, u); const [a, b] = ap(m, x, y); fb.set(a, b, glintCol); }
      const [x, y] = bez(pts, g0 + 0.05); const [a, b] = ap(m, x, y); fb.set(a, b, P.white);
    }
  }
}
export function bez(p: [number, number][], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * u * p[0]![0] + 3 * u * u * t * p[1]![0] + 3 * u * t * t * p[2]![0] + t * t * t * p[3]![0],
    u * u * u * p[0]![1] + 3 * u * u * t * p[1]![1] + 3 * u * t * t * p[2]![1] + t * t * t * p[3]![1]];
}

// Chain along a sagging curve, alternating bright and dark links
export function chain(fb: Frame, m: Xform, x0: number, y0: number, x1: number, y1: number, sag: number, link = 3) {
  const n = Math.max(20, Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.6));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t);
    const on = Math.floor(k / link) % 2;
    const [px, py] = ap(m, x, y);
    fb.set(px, py, on ? P.gry5 : P.gry2);
  }
}
