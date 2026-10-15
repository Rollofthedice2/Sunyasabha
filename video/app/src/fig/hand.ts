// A hand at the end of a forearm, any scale: palm, four fingers (each two phalanx segments so they can curl into a
// grip), thumb on the `sgn` side. `rf` is the forearm radius at the wrist; everything is proportioned from it.
// curl 0 = open and fanned, 1 = a closed fist. back = we see the back of the hand (knuckle ridge, no palm crease).
import { Frame, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { paths, line, seg } from '../engine/vec2d.ts';
import { OUT } from './style2d.ts';

export interface HandOpts { spread?: number; curl?: number; back?: boolean; fill?: RGB; shade?: RGB; light?: RGB }

// Geometry only: the hand as path strings (palm, eight phalanges, thumb), for unioning into a silhouette.
export function handParts(el: [number, number], wr: [number, number], rf: number, sgn: number, curl = 0, spread0 = 0.14) {
  const dx = wr[0] - el[0], dy = wr[1] - el[1], l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l, nx = -uy * sgn, ny = ux * sgn;
  const spread = spread0 * (1 - curl);
  const pl = rf * 2.0, pw = rf * 1.05, fl = rf * 2.1;
  const Q = (a: number, c: number): [number, number] => [wr[0] + ux * a + nx * c, wr[1] + uy * a + ny * c];
  const S = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const parts: string[] = [`M${S(Q(-rf * 0.3, -pw * 0.9))} L${S(Q(pl * 0.95, -pw))} L${S(Q(pl, pw))} L${S(Q(-rf * 0.3, pw * 0.95))} Z`];
  const tips: [number, number][] = [], knuck: [number, number][] = [];
  for (let f = 0; f < 4; f++) {
    const off = (-0.75 + f * 0.5) * pw;
    const len = fl * [0.72, 0.92, 1.0, 0.92][f]!;
    const ang = (f - 1.5) * spread;
    const a1 = ang, a2 = ang + curl * 2.0;
    const d1: [number, number] = [ux * Math.cos(a1) + nx * Math.sin(a1), uy * Math.cos(a1) + ny * Math.sin(a1)];
    const k0 = Q(pl, off);
    const k1: [number, number] = [k0[0] + d1[0] * len * 0.5, k0[1] + d1[1] * len * 0.5];
    const fold = Math.cos(curl * 1.6);
    const d2: [number, number] = [ux * Math.cos(a2 * 0.3) * fold + nx * Math.sin(a2 * 0.3), uy * Math.cos(a2 * 0.3) * fold + ny * Math.sin(a2 * 0.3)];
    const tip: [number, number] = [k1[0] + d2[0] * len * 0.5, k1[1] + d2[1] * len * 0.5];
    parts.push(seg(k0[0], k0[1], k1[0], k1[1], rf * 0.33, rf * 0.29), seg(k1[0], k1[1], tip[0], tip[1], rf * 0.29, rf * 0.23));
    tips.push(tip); knuck.push(k0);
  }
  const tb = Q(rf * 0.4, pw * 0.85);
  const tt = curl > 0.5 ? Q(pl * 1.05, pw * 0.2) : Q(rf * 0.4 + fl * 0.55, pw * 0.9 + fl * 0.5);
  parts.push(seg(tb[0], tb[1], tt[0], tt[1], rf * 0.42, rf * 0.28));
  return { parts, tips, knuck, Q, S, pl, pw, fl };
}

export function drawHand(fb: Frame, el: [number, number], wr: [number, number], rf: number, sgn: number, o: HandOpts = {}) {
  const curl = o.curl ?? 0;
  const fill = o.fill ?? P.skn2, shade = o.shade ?? P.skn0, light = o.light ?? P.skn5;
  const { parts, tips, knuck, Q, S, pl, pw, fl } = handParts(el, wr, rf, sgn, curl, o.spread ?? 0.14);
  paths(fb, parts, { fill, rims: [{ dir: [0, -1], col: light, width: 1, thr: 0.5 }, { dir: [-1, -0.2], col: P.red4, width: 1, thr: 0.6 }, { dir: [1, -0.2], col: P.blu5, width: 1, thr: 0.6 }], outline: OUT });
  for (let f = 0; f < 3; f++) {
    const a = Q(pl - rf * 0.15, (-0.5 + f * 0.5) * pw), c = Q(pl + fl * (0.35 - curl * 0.2), (-0.5 + f * 0.5) * pw);
    line(fb, `M${S(a)} L${S(c)}`, shade);
  }
  if (o.back) for (const k of knuck) fb.set(k[0], k[1], light);
  else line(fb, `M${S(Q(pl * 0.75, -pw * 0.8))} C${S(Q(pl * 0.6, 0))} ${S(Q(pl * 0.55, pw * 0.3))} ${S(Q(pl * 0.3, pw * 0.6))}`, shade);
  for (const tp of tips) fb.set(tp[0], tp[1], light);
}
