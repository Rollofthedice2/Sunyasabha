// Final pass: linear RGB frame → palette-snapped sRGB RGBA bytes.
// Nearest colour is found in OKLab through a 64³ lookup table built once.
// Optional ordered (Bayer) dither, applied lightly so gradients band like hand-made pixel art
// rather than shimmering like noise.
import { Frame, linToSrgb } from './fb.ts';
import { PAL_LIST } from './palette.ts';

const LUT_BITS = 6;
const LUT_N = 1 << LUT_BITS;
let lut: Uint8Array | null = null;
const palRGB = PAL_LIST.map((p) => p.srgb);

function oklab(r: number, g: number, b: number): [number, number, number] {
  // r,g,b linear 0..1
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function buildLut() {
  const pl = palRGB.map(([r, g, b]) => oklab(s2l(r / 255), s2l(g / 255), s2l(b / 255)));
  const L = new Uint8Array(LUT_N * LUT_N * LUT_N);
  for (let ri = 0; ri < LUT_N; ri++)
    for (let gi = 0; gi < LUT_N; gi++)
      for (let bi = 0; bi < LUT_N; bi++) {
        const [l, a, b] = oklab(
          s2l((ri + 0.5) / LUT_N), s2l((gi + 0.5) / LUT_N), s2l((bi + 0.5) / LUT_N));
        let best = 0, bd = 1e9;
        for (let k = 0; k < pl.length; k++) {
          const p = pl[k]!;
          // weight lightness a bit higher: preserves form, which matters most at low res
          const d = 1.4 * (l - p[0]) ** 2 + (a - p[1]) ** 2 + (b - p[2]) ** 2;
          if (d < bd) { bd = d; best = k; }
        }
        L[(ri << (2 * LUT_BITS)) | (gi << LUT_BITS) | bi] = best;
      }
  return L;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

export interface PostOpts {
  // 0..1, amplitude of the ordered dither in sRGB units of one LUT cell
  dither?: number;
  quantize?: boolean;
  // dither amplitude where mask is empty (backgrounds, glows): hides banding
  ditherBg?: number;
  // finite = foreground pixel
  mask?: Float32Array;
  // nonzero = retain lit frame RGB, without palette snapping or dither
  preserveColorMask?: ArrayLike<number>;
}

// Table-driven quantization. The quantized path only needs the LUT cell index
// ri = clamp(trunc((linToSrgb(c) + d) * 64)) per channel, a step function of the float32 input c for each of the 16
// dither offsets d. Positive float32 bit patterns sort like their values, so the inputs 0..1 are split into buckets
// of 2^15 bit patterns (bits >>> 15) and for each (bucket, d) the table holds ri at the bucket start plus the exact
// bit pattern where ri steps up (found by bisection with the same linToSrgb call). linToSrgb is non-decreasing over
// all float32 values in [0, 1] except at the branch point 0.0031308 (checked exhaustively on node v24.16.0);
// that bucket, any bucket with more than one step, and inputs outside 0..1 / NaN are computed directly per pixel.
const PB_SHIFT = 15, PB_MAX = 0x3f800000, PB_N = (PB_MAX >>> PB_SHIFT) + 1, PB_SLOW = 255;
const pbU = new Uint32Array(1), pbF = new Float32Array(pbU.buffer);
const f32 = (bits: number) => { pbU[0] = bits; return pbF[0]!; };
const SRGB_BRANCH_BUCKET = (() => { pbF[0] = 0.0031308; return pbU[0]! >>> PB_SHIFT; })();
interface PostTable { base: Uint8Array; thr: Uint32Array }
const postTables = new Map<number, PostTable>();
function postTable(amp: number): PostTable {
  let t = postTables.get(amp);
  if (t) return t;
  const ds = BAYER4.map((v) => v * amp);
  const cell = (s: number, d: number) => Math.min(LUT_N - 1, Math.max(0, ((s + d) * LUT_N) | 0));
  const base = new Uint8Array(PB_N * 16), thr = new Uint32Array(PB_N * 16).fill(0xffffffff);
  for (let k = 0; k < PB_N; k++) {
    const lo = k << PB_SHIFT, hi = Math.min(PB_MAX, lo + (1 << PB_SHIFT) - 1);
    const sLo = linToSrgb(f32(lo)), sHi = linToSrgb(f32(hi));
    for (let j = 0; j < 16; j++) {
      const idx = (k << 4) | j, d = ds[j]!;
      if (k === SRGB_BRANCH_BUCKET) { base[idx] = PB_SLOW; continue; }
      const a = cell(sLo, d), b = cell(sHi, d);
      if (b === a) { base[idx] = a; continue; }
      if (b !== a + 1) { base[idx] = PB_SLOW; continue; }
      // bisect for the smallest bit pattern with cell a + 1 (cell(l) = a, cell(h) = a + 1)
      let l = lo, h = hi;
      while (h - l > 1) { const m = l + ((h - l) >>> 1); if (cell(linToSrgb(f32(m)), d) > a) h = m; else l = m; }
      base[idx] = a; thr[idx] = h;
    }
  }
  t = { base, thr };
  if (postTables.size > 8) postTables.clear();
  postTables.set(amp, t);
  return t;
}
// Same idea for the unquantized / preserve-colour path into a Uint8Array: byte = ToUint8(linToSrgb(c) * 255),
// emulated with a real Uint8Array store; base 0xffff = compute directly per pixel.
let byteTable: { base: Uint16Array; thr: Uint32Array } | null = null;
function postByteTable() {
  if (byteTable) return byteTable;
  const tmp = new Uint8Array(1);
  const byte = (s: number) => { tmp[0] = s * 255; return tmp[0]!; };
  const base = new Uint16Array(PB_N), thr = new Uint32Array(PB_N).fill(0xffffffff);
  for (let k = 0; k < PB_N; k++) {
    const lo = k << PB_SHIFT, hi = Math.min(PB_MAX, lo + (1 << PB_SHIFT) - 1);
    if (k === SRGB_BRANCH_BUCKET) { base[k] = 0xffff; continue; }
    const a = byte(linToSrgb(f32(lo))), b = byte(linToSrgb(f32(hi)));
    if (b === a) { base[k] = a; continue; }
    if (b !== a + 1) { base[k] = 0xffff; continue; }
    let l = lo, h = hi;
    while (h - l > 1) { const m = l + ((h - l) >>> 1); if (byte(linToSrgb(f32(m))) > a) h = m; else l = m; }
    base[k] = a; thr[k] = h;
  }
  return (byteTable = { base, thr });
}
const PAL_FLAT = Float64Array.from(palRGB.flatMap((c) => [c[0], c[1], c[2]]));

export function post(fb: Frame, out: Uint8ClampedArray | Uint8Array, opts: PostOpts = {}) {
  if (!lut) lut = buildLut();
  const L = lut;
  const q = opts.quantize ?? true;
  const dAmp = (opts.dither ?? 0.5) * (1 / LUT_N) * 3;
  const w = fb.w, h = fb.h;
  const fr = fb.r, fg = fb.g, fbb = fb.b;
  const ur = new Uint32Array(fr.buffer, fr.byteOffset, fr.length), ug = new Uint32Array(fg.buffer, fg.byteOffset, fg.length), ub = new Uint32Array(fbb.buffer, fbb.byteOffset, fbb.length);
  const pm = opts.preserveColorMask, mask = opts.mask, useBg = !!mask && opts.ditherBg !== undefined;
  const bgAmp = useBg ? opts.ditherBg! * (1 / LUT_N) * 3 : 0;
  const tD = q ? postTable(dAmp) : null, tB = q && useBg ? postTable(bgAmp) : null;
  // byte table only for a plain Uint8Array target (a Uint8ClampedArray rounds instead of truncating)
  const BT = (!q || pm) && out instanceof Uint8Array ? postByteTable() : null;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const o = i * 4;
      if (q && !pm?.[i]) {
        const bg = useBg && !isFinite(mask![i]!);
        const amp = bg ? bgAmp : dAmp, T = bg ? tB! : tD!;
        const j = ((y & 3) << 2) | (x & 3);
        const d = BAYER4[j]! * amp;
        const br = ur[i]!, bgn = ug[i]!, bb = ub[i]!;
        let ri: number, gi: number, bi: number;
        let e: number;
        if (br <= PB_MAX && (ri = T.base[e = ((br >>> PB_SHIFT) << 4) | j]!) !== PB_SLOW) { if (br >= T.thr[e]!) ri++; }
        else ri = Math.min(LUT_N - 1, Math.max(0, ((linToSrgb(fr[i]!) + d) * LUT_N) | 0));
        if (bgn <= PB_MAX && (gi = T.base[e = ((bgn >>> PB_SHIFT) << 4) | j]!) !== PB_SLOW) { if (bgn >= T.thr[e]!) gi++; }
        else gi = Math.min(LUT_N - 1, Math.max(0, ((linToSrgb(fg[i]!) + d) * LUT_N) | 0));
        if (bb <= PB_MAX && (bi = T.base[e = ((bb >>> PB_SHIFT) << 4) | j]!) !== PB_SLOW) { if (bb >= T.thr[e]!) bi++; }
        else bi = Math.min(LUT_N - 1, Math.max(0, ((linToSrgb(fbb[i]!) + d) * LUT_N) | 0));
        const k = L[(ri << (2 * LUT_BITS)) | (gi << LUT_BITS) | bi]! * 3;
        out[o] = PAL_FLAT[k]!; out[o + 1] = PAL_FLAT[k + 1]!; out[o + 2] = PAL_FLAT[k + 2]!;
      } else if (BT) {
        const br = ur[i]!, bgn = ug[i]!, bb = ub[i]!;
        let v: number;
        if (br <= PB_MAX && (v = BT.base[br >>> PB_SHIFT]!) !== 0xffff) out[o] = br >= BT.thr[br >>> PB_SHIFT]! ? v + 1 : v; else out[o] = linToSrgb(fr[i]!) * 255;
        if (bgn <= PB_MAX && (v = BT.base[bgn >>> PB_SHIFT]!) !== 0xffff) out[o + 1] = bgn >= BT.thr[bgn >>> PB_SHIFT]! ? v + 1 : v; else out[o + 1] = linToSrgb(fg[i]!) * 255;
        if (bb <= PB_MAX && (v = BT.base[bb >>> PB_SHIFT]!) !== 0xffff) out[o + 2] = bb >= BT.thr[bb >>> PB_SHIFT]! ? v + 1 : v; else out[o + 2] = linToSrgb(fbb[i]!) * 255;
      } else {
        out[o] = linToSrgb(fr[i]!) * 255; out[o + 1] = linToSrgb(fg[i]!) * 255; out[o + 2] = linToSrgb(fbb[i]!) * 255;
      }
      out[o + 3] = 255;
    }
  }
}
