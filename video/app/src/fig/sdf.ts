// Signed-distance primitives on plain numbers (no allocation in the hot path).
// Convention: metres, y up, +z towards the camera.

export type V3 = [number, number, number];

export const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function sphere(x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number) {
  return len3(x - cx, y - cy, z - cz) - r;
}

// Inigo Quilez's ellipsoid bound
export function ellipsoid(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = len3(px / rx, py / ry, pz / rz);
  const k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

// Capsule from a to b with radii ra→rb (round cone, linear taper, good enough for limbs)
export function capsule(x: number, y: number, z: number, a: V3, b: V3, ra: number, rb = ra) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = x - a[0], pay = y - a[1], paz = z - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - mix(ra, rb, h);
}

// Torus in a plane given by its normal axis ('x'|'y'|'z'), major radius R, minor r
export function torus(x: number, y: number, z: number, c: V3, axis: 'x' | 'y' | 'z', R: number, r: number) {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  let u: number, v: number, w: number;
  if (axis === 'y') { u = px; v = pz; w = py; } else if (axis === 'x') { u = py; v = pz; w = px; } else { u = px; v = py; w = pz; }
  const q = Math.sqrt(u * u + v * v) - R;
  return Math.sqrt(q * q + w * w) - r;
}

// Capped cylinder along axis through c, half-height h, radius r, with edge rounding re
export function cylinder(x: number, y: number, z: number, c: V3, axis: 'x' | 'y' | 'z', r: number, h: number, re = 0) {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  let rad: number, ax: number;
  if (axis === 'x') { rad = Math.sqrt(py * py + pz * pz); ax = px; } else if (axis === 'y') { rad = Math.sqrt(px * px + pz * pz); ax = py; } else { rad = Math.sqrt(px * px + py * py); ax = pz; }
  const dx = rad - r + re, dy = Math.abs(ax) - h + re;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - re;
}

export function roundBox(x: number, y: number, z: number, c: V3, hx: number, hy: number, hz: number, r: number) {
  const qx = Math.abs(x - c[0]) - hx + r, qy = Math.abs(y - c[1]) - hy + r, qz = Math.abs(z - c[2]) - hz + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

// Polynomial smooth min / max
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a: number, b: number, k: number) {
  return -smin(-a, -b, k);
}

// Rotation helpers: rotate point (x,y,z) about origin by Euler angles (applied Y, then X, then Z)
export interface Mat3 { m: Float64Array }
export function rotMat(rx: number, ry: number, rz: number): Float64Array {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Rx * Ry
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mul = (A: number[], B: number[]) => {
    const o = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += A[i * 3 + k]! * B[k * 3 + j]!;
    return o;
  };
  return new Float64Array(mul(Rz, mul(Rx, Ry)));
}
// Apply the inverse (transpose) of R to p - origin: world → local
export function toLocal(m: Float64Array, ox: number, oy: number, oz: number, x: number, y: number, z: number, out: V3) {
  const px = x - ox, py = y - oy, pz = z - oz;
  out[0] = m[0]! * px + m[3]! * py + m[6]! * pz;
  out[1] = m[1]! * px + m[4]! * py + m[7]! * pz;
  out[2] = m[2]! * px + m[5]! * py + m[8]! * pz;
  return out;
}
// local → world (for placing joints)
export function toWorld(m: Float64Array, o: V3, l: V3): V3 {
  return [
    o[0] + m[0]! * l[0] + m[1]! * l[1] + m[2]! * l[2],
    o[1] + m[3]! * l[0] + m[4]! * l[1] + m[5]! * l[2],
    o[2] + m[6]! * l[0] + m[7]! * l[1] + m[8]! * l[2],
  ];
}

// Deterministic hash of three integers to [0, 1), the basis of all seeded randomness
export function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Smooth value noise (3D) on the hash3 lattice. The 8 corner hashes of a lattice cell are kept in a small direct-mapped
// cache keyed by the integer cell, since neighbouring samples (scanlines, haze, fire rows) usually share it.
const VN_SLOTS = 256, vnTag = new Float64Array(VN_SLOTS * 3).fill(NaN), vnHash = new Float64Array(VN_SLOTS * 8);
export function vnoise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const slot = (Math.imul(ix | 0, 73856093) ^ Math.imul(iy | 0, 19349663) ^ Math.imul(iz | 0, 83492791)) & (VN_SLOTS - 1), t3 = slot * 3, h8 = slot * 8;
  if (vnTag[t3] !== ix || vnTag[t3 + 1] !== iy || vnTag[t3 + 2] !== iz) {
    vnHash[h8] = hash3(ix, iy, iz); vnHash[h8 + 1] = hash3(ix + 1, iy, iz); vnHash[h8 + 2] = hash3(ix, iy + 1, iz); vnHash[h8 + 3] = hash3(ix + 1, iy + 1, iz);
    vnHash[h8 + 4] = hash3(ix, iy, iz + 1); vnHash[h8 + 5] = hash3(ix + 1, iy, iz + 1); vnHash[h8 + 6] = hash3(ix, iy + 1, iz + 1); vnHash[h8 + 7] = hash3(ix + 1, iy + 1, iz + 1);
    vnTag[t3] = ix; vnTag[t3 + 1] = iy; vnTag[t3 + 2] = iz;
  }
  const a = vnHash[h8]!, b = vnHash[h8 + 1]!, c = vnHash[h8 + 2]!, d = vnHash[h8 + 3]!, e = vnHash[h8 + 4]!, f = vnHash[h8 + 5]!, g = vnHash[h8 + 6]!, h = vnHash[h8 + 7]!;
  return mix(mix(mix(a, b, ux), mix(c, d, ux), uy), mix(mix(e, f, ux), mix(g, h, ux), uy), uz);
}
