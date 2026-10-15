// Verse 3: the raid. Every raid shot is a held still from the raid schedule (raid_stills.ts); this module also provides
// the siren that lights the raid scenes and the procedural riot cop.
import { drawRaidStill } from './raid_stills.ts';
import { Frame, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { path, line } from '../engine/vec2d.ts';
import { solve, drawFigure, type Pose } from '../fig/rig.ts';
import { beatPos } from '../engine/music.ts';
import { OUT } from '../fig/style2d.ts';

export const RAID_START = 129.3;

// siren: two flashes per beat alternating red / blue
export function siren(t: number) {
  const ph = beatPos(t) * 2;
  const k = Math.exp(-(ph - Math.floor(ph)) * 3.5);
  const red = Math.floor(ph) % 2 === 0;
  return { red, k, col: (red ? [1, 0.06, 0.08] : [0.12, 0.3, 1]) as RGB, pal: red ? P.red5 : P.blu5, palDim: red ? P.red2 : P.blu2 };
}

// an android riot cop on the rig: armour, helmet with a red visor line, badge, optional riot shield; returns the solved joints
export function drawCop(fb: Frame, x: number, y: number, h: number, pose: Pose, sir: ReturnType<typeof siren>, shield: boolean) {
  const j = solve(x, y, pose, { h, build: 1.35, headR: 0.068 });
  const rims = [{ dir: [1, -0.6] as [number, number], col: sir.pal, width: 1, thr: 0.7 }, { dir: [-0.5, -1] as [number, number], col: P.blu2, width: 1, thr: 0.8 }];
  // armour plates over the silhouette: shoulder pads, chest plate
  const r = j.r;
  const pads = [j.shL, j.shR].map((s) => `M${s[0] - r.arm * 1.8},${s[1] + r.arm} C${s[0] - r.arm * 1.8},${s[1] - r.arm * 2} ${s[0] + r.arm * 1.8},${s[1] - r.arm * 2} ${s[0] + r.arm * 1.8},${s[1] + r.arm} Z`);
  drawFigure(fb, j, { fill: P.void1, rims, outline: OUT }, pads);
  // helmet dome over the head, visor with a red scanner line
  const [hx, hy] = j.head, hr = r.head * 1.25;
  path(fb, `M${hx - hr},${hy + hr * 0.4} C${hx - hr},${hy - hr * 1.5} ${hx + hr},${hy - hr * 1.5} ${hx + hr},${hy + hr * 0.4} L${hx + hr * 0.8},${hy + hr * 0.9} L${hx - hr * 0.8},${hy + hr * 0.9} Z`,
    { fill: P.gry0, rims: [{ dir: [0.6, -1], col: sir.pal, width: 1, thr: 0.4 }, { dir: [0, -1], col: P.gry3, width: 1, thr: 0.6 }], outline: OUT });
  line(fb, `M${hx - hr * 0.8},${hy} L${hx + hr * 0.85},${hy}`, P.red5);
  fb.glow(hx, hy, 5, hex('#ff2020'), 0.15);
  const [cx, cy] = [(j.neck[0] + j.pelvis[0]) / 2, (j.neck[1] * 2 + j.pelvis[1]) / 3];
  // badge on the left breast (brass, catching the siren) and a unit light on the shoulder strap
  const bx = cx + (j.shL[0] - cx) * 0.45, by = cy - 1;
  fb.set(bx, by, P.brs2); fb.set(bx + 1, by, P.brs3); fb.set(bx, by + 1, P.brs1); fb.set(bx + 1, by + 1, sir.k > 0.6 ? P.white : P.brs2);
  fb.set(j.shR[0], j.shR[1] + 1, P.red5);
  if (shield) {
    // riot shield held in front on the screen-left arm
    const [sx, sy] = j.hdL;
    path(fb, `M${sx - h * 0.1},${sy - h * 0.22} L${sx + h * 0.06},${sy - h * 0.24} L${sx + h * 0.07},${sy + h * 0.2} L${sx - h * 0.09},${sy + h * 0.22} Z`,
      { fill: P.void2, rims: [{ dir: [1, -0.3], col: sir.pal, width: 1, thr: 0.4 }, { dir: [-1, 0], col: P.gry2, width: 1, thr: 0.5 }], outline: OUT });
    line(fb, `M${sx - h * 0.07},${sy - h * 0.05} L${sx + h * 0.05},${sy - h * 0.06}`, P.gry2);
  }
  return j;
}

export function drawRaid(fb: Frame, t = RAID_START) {
  drawRaidStill(fb, t);
}
