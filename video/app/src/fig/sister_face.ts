// The sister's face, front three-quarter, for close-ups. Same frame as the DJ head (face centre ≈ (358,150),
// 80 px wide) so it can be scaled up. Shaved head, eyes open (android iris ring), fine arched brows, fuller lips,
// hoops, a seam at the temple; the braid swings forward over her left shoulder (screen right).
import { Frame, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { path, line, maskOf, shadeMask, drawShape, invX, paths, seg, volumePass, ellipsoidLight, type Xform, type ShapeStyle } from '../engine/vec2d.ts';
import { rimL, rimR, rimB, OUT, LIP_D, LIP_M, LIP_L, LIP_LINE, ap } from './style2d.ts';
import { hash3 } from './sdf.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';

export interface FaceOpts { blink?: number; gaze?: [number, number]; braidSwing?: number; ring?: number }

// The prepared portrait sprite (closed / half / open eyes, drawn to her model sheet), placed so its face centre lands
// where the vector face's centre (358,150 in its local frame) lands under m. The sprite is never scaled (plates are not
// resampled); gaze is ignored (she looks at us).
const SP = { closed: loadPlate('sister_closed_v2'), half: loadPlate('sister_half_v2'), open: loadPlate('sister_open_v2') };
export function drawSisterFace(fb: Frame, m: Xform, o: FaceOpts = {}) {
  const blink = Math.max(0, Math.min(1, o.blink ?? 0));
  const sprite = blink > 0.66 ? SP.closed : blink > 0.33 ? SP.half : SP.open;
  // where the face centre lands
  const [cx, cy] = ap(m, 358, 150);
  drawPlate(fb, sprite, Math.round(cx - 320), Math.round(cy - 150));
}
// The same face drawn as vector shapes.
export function drawSisterFaceVector(fb: Frame, m: Xform, o: FaceOpts = {}) {
  const S = (d: string, st: ShapeStyle) => path(fb, d, st, m);
  const L = (d: string, c: RGB, w = 1) => line(fb, d, c, m, w);
  const px = (x: number, y: number, c: RGB) => { const [a, b] = ap(m, x, y); fb.set(a, b, c); };
  const skinSt: ShapeStyle = { fill: P.skn3, rims: [...rimL(P.red4, P.skn2, 2), ...rimB(P.red4, P.skn2, 2), ...rimR(P.blu6, P.skn4, 2)], outline: OUT };
  const inv = invX(m);
  const local = (x: number, y: number): [number, number] => [inv[0] * x + inv[2] * y + inv[4], inv[1] * x + inv[3] * y + inv[5]];

  // ---------- shoulders, halter, neck ----------
  S('M250,300 C262,262 300,246 330,240 L388,240 C420,246 456,262 468,300 Z', skinSt);
  S('M300,300 C312,272 330,258 344,252 L352,300 Z', { fill: P.void1, rims: [{ dir: [-1, -0.4], col: P.red4, width: 1, thr: 0.5 }], outline: OUT });
  S('M372,300 L380,252 C394,258 410,272 420,300 Z', { fill: P.void1, rims: [{ dir: [1, -0.4], col: P.blu5, width: 1, thr: 0.5 }], outline: OUT });
  S('M338,180 C338,204 336,222 332,244 L388,244 C384,222 383,204 383,180 Z', skinSt);
  S('M338,194 C350,212 372,212 384,196 L384,212 C372,224 350,226 337,212 Z', { fill: P.skn1 });
  // collar strap of the halter round the neck
  L('M334,232 C346,238 374,238 387,232', P.void0, 3);
  L('M334,231 C346,237 374,237 387,231', P.gry2);

  // ---------- head: a shaved skull with stubble, ears ----------
  const skull = 'M316,128 C310,92 330,62 358,60 C388,60 406,92 400,128 C399,150 398,170 394,186 C388,198 376,206 363,207 C350,207 336,200 328,190 C320,176 318,150 316,128 Z';
  const hm = maskOf(fb, skull, m);
  shadeMask(fb, hm, (x, y) => {
    const [lx, ly] = local(x, y);
    // hairline curves back at the temples; stubble thins out across a dithered band rather than a hard edge
    const hl = 100 + ((lx - 358) / 40) ** 2 * 16;
    const fade = Math.max(0, Math.min(1, (hl - ly) / 8));
    const stubble = fade > hash3(lx | 0, ly | 0, 4) ? -0.18 * fade + (hash3(lx | 0, ly | 0, 3) - 0.5) * 0.12 : 0;
    return 0.48 + (lx - 350) / 140 + stubble - Math.max(0, 96 - ly) / 160;
  }, [P.skn0, P.skn1, P.skn2, P.skn3, P.skn4, P.skn5], 0.5);
  drawShape(fb, hm, skinSt, undefined, true);
  // ears + hoops
  S('M316,136 C308,134 306,148 310,160 C312,168 318,170 320,164 Z', { fill: P.skn2, rims: rimL(P.red4, P.skn1, 1), outline: OUT });
  S('M401,136 C409,134 410,148 406,160 C404,168 398,170 397,164 Z', { fill: P.skn3, rims: rimR(P.blu6, P.skn4, 1), outline: OUT });
  L('M312,168 C306,176 310,186 318,182', P.gry4);
  L('M405,168 C411,176 407,186 400,182', P.gry5);

  // ---------- face planes (from the DJ head, adapted) ----------
  S('M321,118 C319,134 319,150 323,166 C327,180 335,190 345,197 C341,186 337,172 335,160 C333,148 333,132 331,118 Z', { fill: P.skn2 });
  S('M326,160 C330,170 334,180 340,188 C341,178 340,168 336,160 Z', { fill: P.skn1 });
  S('M378,146 C386,144 393,148 395,156 C392,164 386,170 380,172 C378,164 376,154 378,146 Z', { fill: P.skn4 });
  S('M385,150 C389,149 392,151 393,155 C390,158 387,158 385,156 Z', { fill: P.skn5 });
  S('M372,190 C378,186 384,180 388,174 C388,182 384,192 378,198 C375,197 373,194 372,190 Z', { fill: P.skn4 });

  // form: the skull and face as one lit volume (key from the front-right, falling off at the edges)
  volumePass(fb, hm, ellipsoidLight(inv, 360, 138, 50, 78, [0.5, -0.35, 0.8], 0.5, 0.75));
  const neckM = maskOf(fb, ['M338,180 C338,204 336,222 332,244 L388,244 C384,222 383,204 383,180 Z', 'M250,300 C262,262 300,246 330,240 L388,240 C420,246 456,262 468,300 Z'], m);
  volumePass(fb, neckM, ellipsoidLight(inv, 362, 250, 120, 80, [0.4, -0.6, 0.7], 0.45, 0.8));

  // brows: fine, arched
  L('M326,132 C332,126 341,125 349,128', P.void1, 2);
  L('M369,128 C377,124 386,125 393,130', P.void1, 2);

  // ---------- eyes, open (blink closes them) ----------
  const blink = Math.max(0, Math.min(1, o.blink ?? 0));
  const [gx, gy] = o.gaze ?? [0, 0];
  for (const [cx, w, lit] of [[339, 10, false], [380, 9, true]] as const) {
    const top = 141 - 4 * (1 - blink), bot = 141 + 3.5 * (1 - blink);
    // socket shade
    S(`M${cx - w - 2},${137} C${cx - w + 2},${132} ${cx + w - 2},${132} ${cx + w + 2},${137} C${cx + w},${140} ${cx - w},${140} ${cx - w - 2},${137} Z`, { fill: lit ? P.skn3 : P.skn2 });
    if (blink < 0.9) {
      // white, iris, pupil, catchlight, android ring
      S(`M${cx - w},141 C${cx - w / 2},${top} ${cx + w / 2},${top} ${cx + w},141 C${cx + w / 2},${bot} ${cx - w / 2},${bot} ${cx - w},141 Z`, { fill: lit ? P.gry4 : P.gry3 });
      const ix = cx + gx * 3, iy = 141 + gy * 2, ir = 4.2;
      const eyeClip = maskOf(fb, `M${cx - w},141 C${cx - w / 2},${top} ${cx + w / 2},${top} ${cx + w},141 C${cx + w / 2},${bot} ${cx - w / 2},${bot} ${cx - w},141 Z`, m);
      path(fb, `M${ix - ir},${iy} C${ix - ir},${iy - ir * 1.3} ${ix + ir},${iy - ir * 1.3} ${ix + ir},${iy} C${ix + ir},${iy + ir * 1.3} ${ix - ir},${iy + ir * 1.3} ${ix - ir},${iy} Z`, { fill: hex('#3a1e14') }, m, eyeClip);
      path(fb, `M${ix - 1.8},${iy} C${ix - 1.8},${iy - 2.3} ${ix + 1.8},${iy - 2.3} ${ix + 1.8},${iy} C${ix + 1.8},${iy + 2.3} ${ix - 1.8},${iy + 2.3} ${ix - 1.8},${iy} Z`, { fill: P.void0 }, m, eyeClip);
      if ((o.ring ?? 0.4) > 0.2) line(fb, `M${ix - ir + 0.5},${iy + 1.5} C${ix - ir + 1},${iy + ir} ${ix + ir - 1},${iy + ir} ${ix + ir - 0.5},${iy + 1.5}`, (o.ring ?? 0.4) > 0.7 ? P.cy1 : P.cy0, m, 1, eyeClip);
      px(ix + 1.5, iy - 1.5, P.white);
    }
    // upper lid line (heavy), lower lid (light), lashes flick out
    L(`M${cx - w - 1},141 C${cx - w / 2},${top - 1} ${cx + w / 2},${top - 1} ${cx + w + 1},${141 - 1}`, P.void0, 2);
    L(`M${cx + w + 1},${140} L${cx + w + 4},${138}`, P.void0);
    if (blink < 0.9) L(`M${cx - w + 1},142 C${cx - w / 2},${bot + 0.5} ${cx + w / 2},${bot + 0.5} ${cx + w - 1},142`, P.skn1);
  }

  // nose (as on the DJ head)
  S('M354,142 C353,150 352,158 350,166 C353,169 356,170 358,169 C357,160 357,150 357,142 Z', { fill: P.skn2 });
  L('M362,141 C363,148 364,155 365,162', P.skn5);
  S('M358,163 C362,160 368,162 369,166 C368,170 363,171 359,170 C357,168 357,165 358,163 Z', { fill: P.skn4 });
  S('M350,166 C350,170 354,172 357,171 L357,169 C354,169 352,168 350,166 Z', { fill: P.skn1 });
  L('M354,171 L357,171', P.skn0); L('M366,171 L369,170', P.skn0);
  L('M353,173 C358,175 366,175 371,173', P.skn2);
  // lips: fuller
  S('M346,182 C350,178 356,176 359,178 C361,179 362,179 364,178 C368,176 374,178 378,182 C370,184 364,184 361,184 C356,184 351,184 346,182 Z', { fill: LIP_D });
  S('M348,183 C354,186 368,186 376,183 C374,190 367,193 361,193 C355,193 350,190 348,183 Z', { fill: LIP_M });
  S('M361,186 C366,186 370,186 372,187 C370,190 365,190 362,190 Z', { fill: LIP_L });
  px(367, 187, P.skn6);
  L('M346,182 C354,185 368,185 378,182', LIP_LINE);
  S('M360,198 C364,197 368,198 369,201 C366,203 362,203 360,201 Z', { fill: P.skn4 });
  // android seam at the temple running down to the jaw
  L('M324,114 C320,130 320,150 324,170 C328,182 334,192 342,198', P.skn1);
  L('M325,114 C321,130 321,150 325,170', P.skn4);
  px(322, 140, P.white);
  for (const [x, y] of [[386, 152], [364, 164], [389, 120], [376, 196], [350, 90], [372, 76]] as const) px(x, y, P.white);

  // ---------- the braid: from the crown, swung forward over the left shoulder (screen right) ----------
  const sw = o.braidSwing ?? 0;
  const pts: [number, number][] = [];
  for (let j = 0; j < 12; j++) {
    const u = j / 11;
    pts.push([392 + u * 30 + sw * u * u * 20 + Math.sin(u * 3) * 4, 70 + u * 230]);
  }
  const bp: string[] = [];
  for (let j = 0; j + 1 < pts.length; j++) bp.push(seg(pts[j]![0], pts[j]![1], pts[j + 1]![0], pts[j + 1]![1], 9 - j * 0.35, 9 - (j + 1) * 0.35));
  paths(fb, bp, { fill: P.void1, rims: [{ dir: [1, -0.3], col: P.blu5, width: 1, thr: 0.45 }, { dir: [-1, -0.3], col: P.red3, width: 1, thr: 0.5 }], outline: OUT }, m);
  for (let j = 0; j + 1 < pts.length; j++) {
    const [ax, ay] = pts[j]!, r = 8 - j * 0.35;
    L(`M${ax - r},${ay + 4} L${ax + r},${ay + 14}`, j % 2 ? P.void3 : P.blu3);
    L(`M${ax + r},${ay + 2} L${ax - r},${ay + 12}`, P.void0);
  }
}
