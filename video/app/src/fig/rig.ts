// A 2D skeleton rig for full-body figures (crowd, police, solo dancers).
// Limb angles are measured from straight DOWN (0) and are MIRRORED per side: positive always swings the limb
// OUTWARD (away from the body's midline); π points straight up. Torso/head angles: π = upright, + leans right.
import { Frame, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { paths, seg, shadeLimb, drawShape, maskOf, Mask, type ShapeStyle, type Rim } from '../engine/vec2d.ts';
import { handParts } from './hand.ts';

export interface Pose {
  // spine angle from pelvis to neck (π = upright)
  torso: number;
  // neck → head angle
  head: number;
  // upper arm, forearm (absolute angles) — L = screen-left side of the body
  armL: [number, number];
  armR: [number, number];
  // thigh, shin
  legL: [number, number];
  legR: [number, number];
}

export interface Body {
  // standing height in px
  h: number;
  // 0.8 slight … 1.25 heavy
  build: number;
  // override head radius factor
  headR?: number;
}

export const STAND: Pose = { torso: Math.PI, head: Math.PI, armL: [0.22, 0.12], armR: [0.22, 0.12], legL: [0.07, 0.02], legR: [0.07, 0.02] };

const dir = (a: number): [number, number] => [Math.sin(a), Math.cos(a)];
const add = (p: [number, number], a: number, l: number): [number, number] => { const [dx, dy] = dir(a); return [p[0] + dx * l, p[1] + dy * l]; };

export interface Joints {
  pelvis: [number, number]; neck: [number, number]; head: [number, number];
  shL: [number, number]; shR: [number, number]; elL: [number, number]; elR: [number, number]; hdL: [number, number]; hdR: [number, number];
  hipL: [number, number]; hipR: [number, number]; knL: [number, number]; knR: [number, number]; ftL: [number, number]; ftR: [number, number];
  r: { head: number; torso: number; arm: number; fore: number; thigh: number; shin: number };
  H: number; k: number; spine: number; headDir: number;
}

export function solve(x: number, y: number, p: Pose, b: Body): Joints {
  const H = b.h, k = b.build;
  const pelvis: [number, number] = [x, y];
  const neck = add(pelvis, p.torso, 0.3 * H);
  const head = add(neck, p.head, 0.05 * H + (b.headR ?? 0.062) * H * 1.15);
  // shoulder/hip lines are perpendicular to the spine
  const perp = p.torso + Math.PI / 2;
  const sw = 0.105 * H * k, hw = 0.06 * H * k;
  const shL = add(neck, perp, sw), shR = add(neck, perp, -sw);
  const hipL = add(pelvis, perp, hw), hipR = add(pelvis, perp, -hw);
  // after the perpendicular, 'L' ends up on the screen-left when upright (perp of π points left)
  // L is screen-left: outward = negative x, so mirror its angles; the body's tilt rotates both sides
  const tilt = p.torso - Math.PI;
  const elL = add(shL, -p.armL[0] + tilt, 0.17 * H), hdL = add(elL, -p.armL[1] + tilt, 0.15 * H);
  const elR = add(shR, p.armR[0] + tilt, 0.17 * H), hdR = add(elR, p.armR[1] + tilt, 0.15 * H);
  const knL = add(hipL, -p.legL[0], 0.25 * H), ftL = add(knL, -p.legL[1], 0.24 * H);
  const knR = add(hipR, p.legR[0], 0.25 * H), ftR = add(knR, p.legR[1], 0.24 * H);
  return { pelvis, neck, head, shL, shR, elL, elR, hdL, hdR, hipL, hipR, knL, knR, ftL, ftR,
    r: { head: (b.headR ?? 0.062) * H, torso: 0.075 * H * k, arm: 0.03 * H * k, fore: 0.024 * H * k, thigh: 0.042 * H * k, shin: 0.03 * H * k },
    H, k, spine: p.torso, headDir: p.head } as Joints;
}

export interface FigureStyle {
  fill: RGB;
  rims?: Rim[];
  outline?: RGB;
  // if set, limbs are cylinder-shaded with this ramp
  ramp?: RGB[];
  light?: [number, number];
  // outline only: the body is empty, the world shows through
  hollow?: boolean;
  // the caller draws detailed hands
  noHands?: boolean;
  // 0 shaved, 1 long, 2 bun, 3 braid, 4 mohawk, 5 afro
  hair?: number;
}

// hair silhouettes attached to the head (they follow head position; long hair hangs with gravity)
export function hairParts(j: Joints, style: number): string[] {
  const [hx, hy] = j.head, r = j.r.head;
  // from neck to head
  const up = dir(j.headDir);
  const top: [number, number] = [hx + up[0] * r, hy + up[1] * r];
  switch (style % 6) {
    // long: a sheet from the crown hanging past the shoulders
    case 1:
      return [`M${hx - r * 1.15},${hy - r * 0.3} C${hx - r * 1.2},${hy - r * 1.5} ${hx + r * 1.2},${hy - r * 1.5} ${hx + r * 1.15},${hy - r * 0.3} L${hx + r * 1.3},${hy + r * 3.2} L${hx - r * 1.3},${hy + r * 3.2} Z`];
    // bun on top
    case 2:
      return [`M${top[0] - r * 0.55},${top[1]} C${top[0] - r * 0.55},${top[1] - r * 1.1} ${top[0] + r * 0.55},${top[1] - r * 1.1} ${top[0] + r * 0.55},${top[1]} Z`];
    // braid down the back
    case 3:
      return [seg(hx, hy, hx + r * 0.3, hy + r * 2.4, r * 0.38, r * 0.22), seg(hx + r * 0.3, hy + r * 2.4, hx + r * 0.1, hy + r * 4.2, r * 0.22, r * 0.12)];
    // mohawk ridge
    case 4:
      return [`M${hx - r * 0.25},${hy - r * 0.8} L${top[0]},${top[1] - r * 0.9} L${hx + r * 0.25},${hy - r * 0.8} Z`];
    // afro: a bigger rounded crown
    case 5:
      return [`M${hx - r * 1.5},${hy - r * 0.1} C${hx - r * 1.7},${hy - r * 2.2} ${hx + r * 1.7},${hy - r * 2.2} ${hx + r * 1.5},${hy - r * 0.1} C${hx + r * 1.2},${hy + r * 0.5} ${hx - r * 1.2},${hy + r * 0.5} ${hx - r * 1.5},${hy - r * 0.1} Z`];
    default: return [];
  }
}

// A limb with a muscle profile: width ra→rb with a swell (bulge × ra at position bp along the bone),
// rounded ends. Reads as a body part rather than a tube.
export function limbPath(a: [number, number], b: [number, number], ra: number, rb: number, bulge = 0.22, bp = 0.35, bias = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const N = 10, left: string[] = [], right: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const w = (ra + (rb - ra) * u) * (1 + bulge * Math.exp(-((u - bp) ** 2) / 0.05));
    // bias shifts the swell to one side (biceps forward, calf back)
    const wl = w * (1 + bias), wr = w * (1 - bias);
    const x = a[0] + dx * u, y = a[1] + dy * u;
    left.push(`${(x + nx * wl).toFixed(1)},${(y + ny * wl).toFixed(1)}`);
    right.unshift(`${(x - nx * wr).toFixed(1)},${(y - ny * wr).toFixed(1)}`);
  }
  // end caps as short arcs
  const cap = (cx: number, cy: number, r: number, sgn: number) => {
    const pts: string[] = [];
    for (let k = 1; k < 6; k++) { const th = (k / 6) * Math.PI; const ox = nx * Math.cos(th) * sgn + ux * Math.sin(th) * sgn; const oy = ny * Math.cos(th) * sgn + uy * Math.sin(th) * sgn; pts.push(`${(cx + ox * r).toFixed(1)},${(cy + oy * r).toFixed(1)}`); }
    return pts;
  };
  return `M${left.join(' L')} L${cap(b[0], b[1], rb, 1).join(' L')} L${right.join(' L')} L${cap(a[0], a[1], ra, -1).join(' L')} Z`;
}

// Draw a figure as one silhouette (union of limbs, torso, head); optional cylinder shading per limb.
export function drawFigure(fb: Frame, j: Joints, st: FigureStyle, extra: string[] = []): Mask {
  const r = j.r;
  const H = j.H, k = j.k;
  const sp = dir(j.spine), u = dir(j.spine + Math.PI / 2);
  const P2 = (along: number, side: number): string => {
    const x = j.pelvis[0] + sp[0] * along + u[0] * side, y = j.pelvis[1] + sp[1] * along + u[1] * side;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const len = 0.3 * H, sw = 0.105 * H * k, hw = 0.06 * H * k;
  // shoulders → armpits → waist (narrow) → hips (flare) → crotch, both sides; trapezius slope into the neck
  const torso = `M${P2(len * 0.99, 0.035 * H)} L${P2(len * 0.95, sw * 0.82)} L${P2(len * 0.78, sw * 0.7)} L${P2(len * 0.4, hw * 1.05)} L${P2(len * 0.05, hw * 1.45)} L${P2(-0.05 * H, hw * 0.4)} ` +
    `L${P2(-0.05 * H, -hw * 0.4)} L${P2(len * 0.05, -hw * 1.45)} L${P2(len * 0.4, -hw * 1.05)} L${P2(len * 0.78, -sw * 0.7)} L${P2(len * 0.95, -sw * 0.82)} L${P2(len * 0.99, -0.035 * H)} Z`;
  const neckPart = seg(j.neck[0], j.neck[1], j.neck[0] + dir(j.headDir)[0] * 0.07 * H, j.neck[1] + dir(j.headDir)[1] * 0.07 * H, 0.032 * H, 0.03 * H);
  const limbs: [[number, number], [number, number], number, number][] = [
    [j.shL, j.elL, r.arm, r.fore], [j.elL, j.hdL, r.fore, r.fore * 0.8], [j.shR, j.elR, r.arm, r.fore], [j.elR, j.hdR, r.fore, r.fore * 0.8],
    [j.hipL, j.knL, r.thigh, r.shin], [j.knL, j.ftL, r.shin, r.shin * 0.75], [j.hipR, j.knR, r.thigh, r.shin], [j.knR, j.ftR, r.shin, r.shin * 0.75],
  ];
  const prof: [number, number][] = [[0.28, 0.3], [0.18, 0.3], [0.28, 0.3], [0.18, 0.3], [0.16, 0.3], [0.22, 0.32], [0.16, 0.3], [0.22, 0.32]];
  const headDir = dir(j.headDir);
  const hr = r.head;
  // head: cranium narrowing to the jaw and chin, oriented along the neck → head direction
  // 'up' for the head
  const hx = j.head[0], hy = j.head[1], fx = headDir[0], fy = headDir[1];
  const side = [fy, -fx];
  const HP = (up: number, sideW: number) => `${(hx + fx * up * hr + side[0] * sideW * hr).toFixed(1)},${(hy + fy * up * hr + side[1] * sideW * hr).toFixed(1)}`;
  const headPath = `M${HP(-1.15, 0)} L${HP(-0.85, 0.42)} L${HP(-0.35, 0.78)} L${HP(0.25, 0.92)} L${HP(0.75, 0.78)} L${HP(1.05, 0.42)} L${HP(1.18, 0)} L${HP(1.05, -0.42)} L${HP(0.75, -0.78)} L${HP(0.25, -0.92)} L${HP(-0.35, -0.78)} L${HP(-0.85, -0.42)} Z`;
  // hands: a mitten (palm + thumb) along the forearm
  const hand = (el: [number, number], h: [number, number], sgn: number) => {
    const ddx = h[0] - el[0], ddy = h[1] - el[1], l = Math.hypot(ddx, ddy) || 1, ux2 = ddx / l, uy2 = ddy / l, nx2 = -uy2 * sgn, ny2 = ux2 * sgn;
    const w = r.fore * 1.1, len = r.fore * 3.2;
    const P3 = (a2: number, b2: number) => `${(h[0] + ux2 * a2 + nx2 * b2).toFixed(1)},${(h[1] + uy2 * a2 + ny2 * b2).toFixed(1)}`;
    return `M${P3(-w * 0.4, -w)} L${P3(len * 0.7, -w * 0.9)} L${P3(len, -w * 0.3)} L${P3(len, w * 0.4)} L${P3(len * 0.55, w)} L${P3(len * 0.45, w * 1.9)} L${P3(len * 0.2, w * 1.7)} L${P3(-w * 0.4, w)} Z`;
  };
  const parts = [torso, neckPart, ...limbs.map(([a, b, ra, rb], i) => limbPath(a, b, ra, rb, prof[i]![0], prof[i]![1])),
    headPath,
    // hands: real fingers once the figure is big enough to read them, a mitten below that
    ...(st.noHands ? [] : H > 110 ? [...handParts(j.elL, j.hdL, r.fore * 0.95, 1, 0.25, 0.12).parts, ...handParts(j.elR, j.hdR, r.fore * 0.95, -1, 0.25, 0.12).parts] : [hand(j.elL, j.hdL, 1), hand(j.elR, j.hdR, -1)]),
    // deltoid caps: the arm grows out of a rounded shoulder muscle
    ...(H > 90 ? [[j.shL, j.elL], [j.shR, j.elR]].map(([a, e]) => { const l = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1, ux = (e[0] - a[0]) / l, uy = (e[1] - a[1]) / l; return seg(a[0] - ux * r.arm * 0.2, a[1] - uy * r.arm * 0.2, a[0] + ux * r.arm * 1.5, a[1] + uy * r.arm * 1.5, r.arm * 1.4, r.arm * 1.05); }) : []),
    ...(st.hair ? hairParts(j, st.hair) : []),
    // feet
    ...[j.ftL, j.ftR].map((f) => seg(f[0] - r.shin * 0.6, f[1], f[0] + r.shin * 1.4, f[1] + 1, r.shin * 0.7, r.shin * 0.6)),
    ...extra];
  if (st.hollow) {
    const hm = maskOf(fb, parts);
    drawShape(fb, hm, { fill: st.fill, rims: st.rims, outline: st.outline }, undefined, true);
    return hm;
  }
  const m = paths(fb, parts, { fill: st.fill, rims: st.rims, outline: st.outline });
  if (st.ramp) {
    for (const [a, b, ra, rb] of limbs) shadeLimb(fb, a[0], a[1], b[0], b[1], ra, rb, st.ramp, st.light ?? [0.3, -1], 0, m);
    drawShape(fb, m, { fill: st.fill, rims: st.rims, outline: st.outline }, undefined, true);
  }
  return m;
}

// ---------- pose generators ----------
const TAU = Math.PI * 2;

// club groove: bounce on the beat (knees), torso sways, arms vary by "style"
export function groove(bp: number, seed: number, style = 0): Pose {
  const ph = bp * TAU + seed * 1.7;
  // 1 per beat
  const bounce = Math.abs(Math.sin(ph / 2));
  const sway = Math.sin(ph / 4) * 0.1;
  const knee = 0.1 + 0.25 * bounce;
  const p: Pose = {
    torso: Math.PI + sway + 0.04 * Math.sin(ph),
    head: Math.PI + sway * 1.6 - 0.12 * bounce * Math.sign(Math.sin(seed * 7) || 1),
    armL: [0.4, 0.3], armR: [0.4, 0.3],
    legL: [0.14 + knee * 0.35, 0.04 - knee * 0.3], legR: [0.14 + knee * 0.35, 0.04 - knee * 0.3],
  };
  const s = style % 4;
  // both up
  if (s === 0) { p.armL = [Math.PI - 0.5 - 0.25 * bounce, Math.PI - 0.2]; p.armR = [Math.PI - 0.45 - 0.2 * Math.sin(ph / 2), Math.PI - 0.1]; }
  // one pumping, other bent out
  else if (s === 1) { p.armL = [Math.PI - 0.35 - 0.35 * bounce, Math.PI - 0.05]; p.armR = [0.45, 1.5 - 0.3 * bounce]; }
  // elbows out, fists at the chest
  else if (s === 2) { p.armL = [0.9 + 0.3 * Math.sin(ph / 2), -2.1]; p.armR = [0.9 + 0.3 * Math.sin(ph / 2), -2.1]; }
  // waving, other hand on the hip
  else { p.armL = [Math.PI - 0.9 + 0.5 * Math.sin(ph / 4), Math.PI - 0.5]; p.armR = [0.6, -1.4 - 0.3 * bounce]; }
  return p;
}

// a step down a staircase / march: t in beats
export function march(bp: number, seed = 0): Pose {
  const ph = bp * Math.PI + seed;
  const sn = Math.sin(ph);
  return {
    torso: Math.PI - 0.04 * sn, head: Math.PI,
    armL: [0.18 + 0.12 * sn, 0.35], armR: [0.18 - 0.12 * sn, 0.35],
    legL: [0.06 + 0.1 * Math.max(0, sn), 0.02 - 0.35 * Math.max(0, sn)], legR: [0.06 + 0.1 * Math.max(0, -sn), 0.02 - 0.35 * Math.max(0, -sn)],
  };
}

// Unison routine (8-beat phrase), the crowd as one body. bp in beats.
export function unison(bp: number): Pose {
  const keys: Pose[] = [
    // 0 gather
    { torso: Math.PI, head: Math.PI - 0.1, armL: [0.3, 0.2], armR: [0.3, 0.2], legL: [0.08, 0.02], legR: [0.08, 0.02] },
    // 1 rise, step out
    { torso: Math.PI, head: Math.PI + 0.15, armL: [Math.PI - 0.35, Math.PI - 0.15], armR: [Math.PI - 0.35, Math.PI - 0.15], legL: [0.28, 0.1], legR: [0.08, 0.02] },
    // 2 reach
    { torso: Math.PI, head: Math.PI + 0.2, armL: [Math.PI - 0.15, Math.PI], armR: [Math.PI - 0.15, Math.PI], legL: [0.28, 0.1], legR: [0.08, 0.02] },
    // 3 hit down, knees bent
    { torso: Math.PI, head: Math.PI - 0.2, armL: [0.55, 0.4], armR: [0.55, 0.4], legL: [0.35, -0.3], legR: [0.35, -0.3] },
    // 4 lean left, point up
    { torso: Math.PI - 0.18, head: Math.PI - 0.25, armL: [Math.PI - 0.6, Math.PI - 0.4], armR: [0.7, -1.8], legL: [0.2, 0.05], legR: [0.12, 0.02] },
    // 5 hold
    { torso: Math.PI - 0.22, head: Math.PI - 0.3, armL: [Math.PI - 0.5, Math.PI - 0.3], armR: [0.7, -1.8], legL: [0.24, 0.05], legR: [0.12, 0.02] },
    // 6 lean right
    { torso: Math.PI + 0.18, head: Math.PI + 0.25, armL: [0.7, -1.8], armR: [Math.PI - 0.6, Math.PI - 0.4], legL: [0.12, 0.02], legR: [0.2, 0.05] },
    // 7 hold
    { torso: Math.PI + 0.22, head: Math.PI + 0.3, armL: [0.7, -1.8], armR: [Math.PI - 0.5, Math.PI - 0.3], legL: [0.12, 0.02], legR: [0.24, 0.05] },
  ];
  const b = ((bp % 8) + 8) % 8, i = Math.floor(b), f = b - i;
  // snap into each pose, hold
  const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  return mixPose(keys[i]!, keys[(i + 1) % 8]!, e);
}

// a tight crouch seen from the front: knees out, head bowed, hands clasped over the back of the head
// (the caller lowers the pelvis by ~0.3 h when using it)
export const DOWN: Pose = { torso: Math.PI - 0.05, head: Math.PI - 0.55, armL: [Math.PI - 0.75, -2.5], armR: [Math.PI - 0.75, -2.5], legL: [1.35, -0.55], legR: [1.35, -0.55] };

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const m = (x: number, y: number) => x + (y - x) * t;
  return { torso: m(a.torso, b.torso), head: m(a.head, b.head), armL: [m(a.armL[0], b.armL[0]), m(a.armL[1], b.armL[1])], armR: [m(a.armR[0], b.armR[0]), m(a.armR[1], b.armR[1])],
    legL: [m(a.legL[0], b.legL[0]), m(a.legL[1], b.legL[1])], legR: [m(a.legR[0], b.legR[0]), m(a.legR[1], b.legR[1])] };
}
