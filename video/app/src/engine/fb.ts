// Linear-light RGB frame buffer at the native pixel resolution.
// Scenes draw into it; post() quantizes to the master palette and writes RGBA bytes.

export const W = 640;
export const H = 360;

export type RGB = [number, number, number];

export function hex(s: string): RGB {
  const n = parseInt(s.replace('#', ''), 16);
  return [srgbToLin(((n >> 16) & 255) / 255), srgbToLin(((n >> 8) & 255) / 255), srgbToLin((n & 255) / 255)];
}

export function srgbToLin(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function linToSrgb(c: number) {
  c = c < 0 ? 0 : c > 1 ? 1 : c;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export class Frame {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  constructor(w = W, h = H) {
    this.w = w;
    this.h = h;
    this.r = new Float32Array(w * h);
    this.g = new Float32Array(w * h);
    this.b = new Float32Array(w * h);
  }
  clear(c: RGB = [0, 0, 0]) {
    this.r.fill(c[0]);
    this.g.fill(c[1]);
    this.b.fill(c[2]);
  }
  set(x: number, y: number, c: RGB, a = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (a >= 1) {
      this.r[i] = c[0];
      this.g[i] = c[1];
      this.b[i] = c[2];
    } else if (a > 0) {
      this.r[i] += (c[0] - this.r[i]) * a;
      this.g[i] += (c[1] - this.g[i]) * a;
      this.b[i] += (c[2] - this.b[i]) * a;
    }
  }
  add(x: number, y: number, c: RGB, k = 1) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.r[i] += c[0] * k;
    this.g[i] += c[1] * k;
    this.b[i] += c[2] * k;
  }
  mul(x: number, y: number, c: RGB) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.r[i] *= c[0];
    this.g[i] *= c[1];
    this.b[i] *= c[2];
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGB, a = 1) {
    const x1 = Math.min(this.w, Math.round(x0 + w)), y1 = Math.min(this.h, Math.round(y0 + h));
    for (let y = Math.max(0, Math.round(y0)); y < y1; y++)
      for (let x = Math.max(0, Math.round(x0)); x < x1; x++) this.set(x, y, c, a);
  }
  // Vertical gradient fill (linear interpolation in linear light)
  vgrad(y0: number, y1: number, top: RGB, bot: RGB) {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1);
      const c: RGB = [top[0] + (bot[0] - top[0]) * t, top[1] + (bot[1] - top[1]) * t, top[2] + (bot[2] - top[2]) * t];
      for (let x = 0; x < this.w; x++) this.set(x, y, c);
    }
  }
  // Additive radial glow (light falloff), used for flames, neon, sirens
  glow(cx: number, cy: number, rad: number, c: RGB, k = 1, squash = 1) {
    const r2 = rad * rad;
    const ry = rad / squash;
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(this.h, Math.ceil(cy + ry)); y++) {
      const dy = (y - cy) * squash;
      for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(this.w, Math.ceil(cx + rad)); x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const f = 1 - d2 / r2;
        this.add(x, y, c, k * f * f);
      }
    }
  }
  copyFrom(o: Frame) {
    this.r.set(o.r);
    this.g.set(o.g);
    this.b.set(o.b);
  }
}
