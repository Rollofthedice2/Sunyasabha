// Unobtrusive colour variation for the crowd drawings, so one drawing can play many different people (a global tint
// would read as an obvious swap). Every plate pixel is classified once into a material (rim light / skin / hair / top /
// bottom / boots) from its OKLab colour and its height on the figure; a person's variant then changes each material
// independently in OKLab (lightness, chroma, hue), keeping the painted shading. Rim light (the saturated red/blue edge
// light baked into the art, <= 3 px from the outline) is never touched, so the scene lighting stays coherent.
import { Frame, type RGB } from '../engine/fb.ts';
import type { Plate } from '../engine/plate.ts';

const M = { None: 0, Rim: 1, Skin: 2, Hair: 3, Top: 4, Bottom: 5, Boots: 6 } as const;
export const WAIST: Record<string, number> = { e: .44, f: .40, g: .43, h: .47, cop: .45 };

interface Lab { L: Float32Array; A: Float32Array; B: Float32Array; mat: Uint8Array; fy: Float32Array }
const labCache = new WeakMap<Plate, Lab>();

// linear RGB -> OKLab
function toOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .7936177850 * m - .0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .8086757660 * s];
}
// OKLab -> linear RGB
function fromOklab(L: number, A: number, B: number): RGB {
  const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.2914855480 * B) ** 3;
  return [Math.max(0, 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s), Math.max(0, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s), Math.max(0, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s)];
}

function analyse(p: Plate, waist: number): Lab {
  let c = labCache.get(p); if (c) return c;
  const n = p.w * p.h, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), mat = new Uint8Array(n), fy = new Float32Array(n);
  const [, y0, , y1] = p.bbox, hh = Math.max(1, y1 - y0);
  for (let i = 0; i < n; i++) if (p.a[i]) { const o = toOklab(p.r[i]!, p.g[i]!, p.b[i]!); L[i] = o[0]; A[i] = o[1]; B[i] = o[2]; }
  const hue = (i: number) => ((Math.atan2(B[i]!, A[i]!) * 180 / Math.PI) + 360) % 360, chroma = (i: number) => Math.hypot(A[i]!, B[i]!);
  const nearEdge = (x: number, y: number) => {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue; const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= p.w || yy >= p.h || !p.a[yy * p.w + xx]) return true;
    }
    return false;
  };
  // pass 1: rim + confident skin seed (club light shifts skin red and dark: hue 12-70, C .04-.12, L .3-.8)
  const rim = new Uint8Array(n), seed: number[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = y * p.w + x; if (!p.a[i]) continue; fy[i] = (y - y0) / hh;
    const C = chroma(i), H = hue(i);
    if (C > .13 && (H < 40 || H > 330 || (H > 200 && H < 290)) && nearEdge(x, y)) rim[i] = 1;
    else if (H > 12 && H < 70 && C > .04 && C < .12 && L[i]! > .3 && L[i]! < .8) seed.push(i);
  }
  // pass 2: adaptive skin model from this figure's own confident skin
  let mu = [0, 0, 0], sd = [.06, .02, .02];
  if (seed.length >= 12) {
    for (const i of seed) { mu[0] += L[i]!; mu[1] += A[i]!; mu[2] += B[i]!; } mu = mu.map(v => v / seed.length);
    const v = [0, 0, 0]; for (const i of seed) { v[0] += (L[i]! - mu[0]!) ** 2; v[1] += (A[i]! - mu[1]!) ** 2; v[2] += (B[i]! - mu[2]!) ** 2; }
    sd = [Math.max(.06, Math.sqrt(v[0]! / seed.length)), Math.max(.02, Math.sqrt(v[1]! / seed.length)), Math.max(.02, Math.sqrt(v[2]! / seed.length))];
  }
  const isSeed = new Uint8Array(n); for (const i of seed) isSeed[i] = 1;
  for (let i = 0; i < n; i++) {
    if (!p.a[i]) continue;
    const f = fy[i]!; let m: number = f > .9 ? M.Boots : f > waist ? M.Bottom : f < .17 ? M.Hair : M.Top;
    const d = Math.sqrt(((L[i]! - mu[0]!) / sd[0]!) ** 2 + ((A[i]! - mu[1]!) / sd[1]!) ** 2 + ((B[i]! - mu[2]!) / sd[2]!) ** 2);
    if (!rim[i] && f < .9 && L[i]! > .22 && (isSeed[i] || (seed.length >= 12 && d < 2.6))) m = M.Skin;
    if (rim[i]) m = M.Rim;
    mat[i] = m;
  }
  c = { L, A, B, mat, fy }; labCache.set(p, c); return c;
}

// --- variants -------------------------------------------------------------------------------------------------
type Cloth = null | [ls: number, cs: number, cadd: number, hue: number | null];
// skin: lightness and chroma scales kept to a natural range (much lighter reads as grey)
const SKIN: [number, number][] = [[1, 1], [.85, 1.05], [.72, 1.02], [1.1, .96], [.92, 1.08], [.8, 1]];
const HAIR: Cloth[] = [null, [.35, .3, 0, null], [1.35, 1, .06, 85], [1, 1.2, .07, 25], [1.55, .15, 0, null], [.9, 1, .09, 300], [.95, 1, .08, 200]];
const CLOTH: Cloth[] = [null, [1, 1, .05, 145], [1.05, 1, .05, 25], [1, 1, .05, 260], [1.15, .6, 0, null], [.85, 1, .04, 320], [1, 1, .045, 60]];
export interface CrowdVariant { skin: [number, number]; hair: Cloth; top: Cloth; bottom: Cloth }
const hash = (n: number) => { let x = (n | 0) * 0x9e3779b1; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
export function crowdVariant(seed: number): CrowdVariant {
  const pick = <T>(a: T[], k: number) => a[Math.floor(hash(seed * 7 + k) * a.length)]!;
  return { skin: pick(SKIN, 1), hair: pick(HAIR, 2), top: pick(CLOTH, 3), bottom: pick(CLOTH, 4) };
}

// Per-garment hue rotation for already-coloured garments (a purple jacket): mean hue of saturated pixels, per plate.
const garmentHue = new WeakMap<Plate, Map<number, number | null>>();
function meanHue(p: Plate, lab: Lab, mats: number[]): number | null {
  let m = garmentHue.get(p); if (!m) { m = new Map(); garmentHue.set(p, m); }
  const key = mats.reduce((a, b) => a * 8 + b, 0); if (m.has(key)) return m.get(key)!;
  let sa = 0, sb = 0, ns = 0, nt = 0;
  for (let i = 0; i < lab.mat.length; i++) if (mats.includes(lab.mat[i]!)) { nt++; if (Math.hypot(lab.A[i]!, lab.B[i]!) > .06) { ns++; sa += lab.A[i]!; sb += lab.B[i]!; } }
  const h = nt && ns / nt > .35 ? Math.atan2(sb, sa) : null; m.set(key, h); return h;
}

function cloth(spec: Cloth, L: number, A: number, B: number, rot: number | null): [number, number, number] {
  if (!spec) return [L, A, B];
  const [ls, cs, cadd, hue] = spec;
  if (hue !== null && rot !== null) { const d = hue * Math.PI / 180 - rot, c = Math.cos(d), s = Math.sin(d); return [Math.min(1, L * ls), (A * c - B * s) * cs, (A * s + B * c) * cs]; }
  let A2 = A * cs, B2 = B * cs;
  if (hue !== null) { const k = cadd * Math.min(1.2, Math.max(0, L / .5)); A2 += k * Math.cos(hue * Math.PI / 180); B2 += k * Math.sin(hue * Math.PI / 180); }
  return [Math.min(1, L * ls), A2, B2];
}

// drawPlate with a material variant (same placement semantics: integer origin, flipX, multiplicative light).
export function drawPlateVariant(fb: Frame, p: Plate, x: number, y: number, v: CrowdVariant, o: { flipX?: boolean; mul?: RGB; waist?: number } = {}) {
  x |= 0; y |= 0; const waist = o.waist ?? .47, lab = analyse(p, waist), W = fb.w, [bx0, by0, bx1, by1] = p.bbox, mul = o.mul ?? [1, 1, 1];
  const rotHair = meanHue(p, lab, [M.Hair]), rotTop = meanHue(p, lab, [M.Top]), rotBot = meanHue(p, lab, [M.Bottom]);
  for (let py = by0; py <= by1; py++) {
    const sy = y + py; if (sy < 0 || sy >= fb.h) continue;
    for (let px = bx0; px <= bx1; px++) {
      const si = py * p.w + px; if (!p.a[si]) continue;
      const sx = x + (o.flipX ? p.w - 1 - px : px); if (sx < 0 || sx >= W) continue;
      const di = sy * W + sx, m = lab.mat[si]!;
      let r = p.r[si]!, g = p.g[si]!, b = p.b[si]!;
      if (m >= M.Skin && m <= M.Bottom) {
        const L = lab.L[si]!, A = lab.A[si]!, B = lab.B[si]!; let o3: [number, number, number];
        if (m === M.Skin) o3 = [Math.min(1, L * v.skin[0]), A * v.skin[1], B * v.skin[1]];
        else if (m === M.Hair) o3 = cloth(v.hair, L, A, B, rotHair);
        else {
          // top and bottom blend over +-.03 of the waist, so a garment that crosses it has no hard seam
          const w = Math.min(1, Math.max(0, (lab.fy[si]! - (waist - .03)) / .06));
          const t = cloth(v.top, L, A, B, rotTop), u = cloth(v.bottom, L, A, B, rotBot);
          o3 = [t[0] * (1 - w) + u[0] * w, t[1] * (1 - w) + u[1] * w, t[2] * (1 - w) + u[2] * w];
        }
        [r, g, b] = fromOklab(o3[0], o3[1], o3[2]);
      }
      fb.r[di] = r * mul[0]; fb.g[di] = g * mul[1]; fb.b[di] = b * mul[2];
    }
  }
}
