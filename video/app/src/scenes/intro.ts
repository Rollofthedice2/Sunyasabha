// Intro (0 → 14.671): rain, a brutalist wall, the neon शून्यसभा sign flickers on with the synth; the club's light leaks
// through the gaps around the closed door, pulsing with the bass; the drums enter (10.5 s); on the downbeat before the
// first sung syllable (13.82) the door swings open, and from 14.233 the stair-angle view of the queue coming down inside.
import { Frame, W, H, hex, type RGB } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { line } from '../engine/vec2d.ts';
import { drawText, textMask } from '../engine/text.ts';
import { beatHit, env } from '../engine/music.ts';
import { loadPlate, drawPlate, type Plate } from '../engine/plate.ts';
import { loadIntroQueue, drawIntroQueue } from '../fig/intro_queue.ts';
import { hash3, vnoise } from '../fig/sdf.ts';

const WALL = loadPlate('wall_bg');

const DRUMS_IN = 10.5;
// the downbeat before the first sung syllable: the door opens
const OPEN = 13.82;
// px (native) over which the neon dead/lit split fades out beyond the halo box
const HALO_FEATHER = 40;
const GROUND = 300;

// the stair-angle view with the queue coming down inside, held from 14.233 to the cut into the hall (true colour)
const ENTRY = loadPlate('entry_T2');
export function drawIntro(fb: Frame, t = 0) {
  if (t >= 14.233) { drawPlate(fb, ENTRY, 0, 0); preserveColor(fb).fill(1); return; }
  const queue = loadIntroQueue(), wall = queue?.background ?? WALL;
  const hit = t > DRUMS_IN ? beatHit(t, 7) : 0;
  const signOn = neonLevel(t);
  // seconds since the door began to open
  const open = Math.max(0, t - OPEN);

  // ---------- the wall (a prepared plate: rain-streaked concrete, the steel door, the neon sign, the queue in
  // hoodies, the wet pavement). The sign's pixels and their reflection follow the neon's flicker ----------
  // door steel/seams measured on the source wall at native resolution
  const SIGN = [228, 28, 412, 82] as const, REFL = [228, 318, 412, 352] as const, DOOR = [276, 119, 365, 282] as const;
  const keep = signOn > 0.02 ? preserveColor(fb) : null;
  drawPlate(fb, wall, 0, 0, { mul: (x, y) => {
    const i = y * wall.w + x;
    const r = wall.r[i]!, g = wall.g[i]!, b = wall.b[i]!;
    // the tubes (saturated red) and the glow they cast on the wet concrete / puddle (any reddish pixel in the sign's
    // halo) are the sign's light: all of it follows the flicker, so nothing of it is left when the sign is dark
    const neon = r > 0.08 && r > g * 2.2 && r > b * 2.2 ? 1 : 0;
    const reddish = r > 0.02 && r > g * 1.35 && r > b * 1.35;
    const inSign = x >= SIGN[0] && x <= SIGN[2] && y >= SIGN[1] && y <= SIGN[3] ? 1 : 0;
    const inRefl = x >= REFL[0] && x <= REFL[2] && y >= REFL[1] && y <= REFL[3] ? 1 : 0;
    // the neon split fades out over HALO_FEATHER px outside the halo box (w = 1 inside, 0 beyond the feather), so the
    // dead/lit difference has no visible edge
    const fade = (x0: number, y0: number, x1: number, y1: number) => { const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); const d = Math.hypot(dx, dy); return d >= HALO_FEATHER ? 0 : 1 - d / HALO_FEATHER; };
    const wHalo = Math.max(fade(150, 0, 490, 150), fade(180, 300, 460, 360));
    const inHalo = wHalo > 0;
    const wash = 0.75 + 0.25 * signOn;
    // continuous split: the concrete is blue-grey (r = .229 b, g = .349 b, measured on the plate away from the sign) and the
    // neon only ADDS red light, so the excess r/g over (.229 b, .349 b, b) is the sign's light. Only that excess follows the
    // neon: dead = plain concrete with no outline; lit = the painted soft glow.
    if (inHalo || inSign || inRefl) {
      const baseR = 0.229 * b, baseG = 0.349 * b;
      const exR = Math.max(0, r - baseR), exG = Math.max(0, g - baseG);
      const isTube = neon && (inSign || inRefl);
      // dead tubes keep a trace: dim glass, not a hole
      const on0 = isTube ? 0.06 + 0.94 * signOn : signOn;
      // smooth feathered weight outside the tube boxes
      const wgt = inSign || inRefl ? 1 : wHalo * wHalo * (3 - 2 * wHalo);
      const on = 1 - wgt * (1 - on0);
      // the glow keeps its true smooth falloff (no palette banding)
      if (keep && exR * on > 0.004) keep[y * fb.w + x] = 1;
      return [(baseR + exR * on) * wash / Math.max(1e-4, r), (baseG + exG * on) * wash / Math.max(1e-4, g), wash];
    }
    return [wash, wash, wash];
  } });
  if (open > 0) drawDoorOpening(fb, wall, t, open, DOOR);
  // the queue is drawn before the neon/police/door light and the foreground rain; its manifest also supplies the cleaned wall
  if (queue) drawIntroQueue(fb, queue, t, 0.75 + 0.25 * signOn);
  if (signOn > 0.3) fb.glow(320, 55, 120, hex('#ff1020'), 0.08 * signOn, 1.6);
  if (open <= 0) drawDoorEdgeLeak(fb, t, hit);
  // romanised + English under the sign, appear after it settles
  if (t > 4.5) {
    const a = Math.min(1, (t - 4.5) / 1.2) * (t > 12.5 ? Math.max(0, 1 - (t - 12.5) / 0.6) : 1);
    const im = textMask('title_iast'), em = textMask('title_en');
    drawText(fb, 'title_iast', 320 - im.w / 2, 96, P.gry4, { alpha: a });
    drawText(fb, 'title_en', 320 - em.w / 2, 114, P.gry3, { alpha: a });
  }

  // ---------- far off, a police car passes behind the crowd: red/blue washes along the wall (6 → 9.5 s) ----------
  if (t > 6 && t < 9.5) {
    const u = (t - 6) / 3.5, env2 = Math.sin(u * Math.PI);
    const red = Math.floor(t * 6) % 2 === 0, col: RGB = red ? [1, 0.05, 0.08] : [0.1, 0.25, 1];
    const cx = 700 - u * 820;
    for (let y = 120; y < GROUND; y += 1) for (let x = Math.max(0, Math.floor(cx - 150)); x < Math.min(W, cx + 150); x++) {
      const f = (1 - Math.abs(x - cx) / 150) * (1 - (GROUND - y) / 300);
      fb.add(x, y, col, 0.05 * f * env2);
    }
  }

  // ---------- the puddles ripple on each kick ----------
  if (hit > 0.3) for (const [px, py] of [[150, 334], [330, 350], [470, 338], [580, 352]] as const) {
    const r = 14 * (1.3 - hit);
    for (let a = 0; a < Math.PI * 2; a += 0.05) fb.add(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.25, [0.9, 0.2, 0.2], 0.3 * hit);
  }
  // the open door's light on the wet ground, the queue's near silhouettes against it
  if (open > 0) {
    const f = Math.min(1, open / 0.25);
    for (let y = GROUND + 1; y < 360; y++) for (let dx = -34; dx <= 34; dx++) fb.add(320 + dx + Math.round(Math.sin(y * 0.9 + t * 8) * 2), y, [0.5, 0.65, 1], 0.3 * f * (1 - Math.abs(dx) / 34) * ((y + dx) % 2 ? 1 : 0.4));
    fb.glow(320, 234, 90, hex('#8fb4ff'), 0.25 * f);
  }

  // ---------- rain: long thin streaks, a little wind; splashes on the ground ----------
  for (let k = 0; k < 220; k++) {
    const sp = 520 + hash3(k, 1, 8) * 200;
    const x0 = hash3(k, 2, 8) * 700 - 30;
    const y = ((hash3(k, 3, 8) * 400 + t * sp) % 400) - 30;
    const x = x0 + y * 0.18;
    const len = 6 + hash3(k, 4, 8) * 8;
    const c: RGB = y < 200 && Math.abs(x - 320) < 160 && signOn > 0.3 ? P.red3 : P.gry1;
    line(fb, `M${x.toFixed(1)},${y.toFixed(1)} L${(x + len * 0.18).toFixed(1)},${(y + len)}`, c);
    if (y > GROUND && y < GROUND + 50 && hash3(k, 5, 8) > 0.6) { fb.set(x - 1, y + len, P.gry2); fb.set(x + 1, y + len, P.gry2); }
  }
}

// Neon flicker: dead → stutters on with the synth riser (≈2 s) → steady; hard flicker as the door opens
function neonLevel(t: number) {
  if (t < 2.0) return 0;
  if (t < 4.2) {
    const u = (t - 2.0) / 2.2;
    const stutter = hash3(Math.floor(t * 14), 3, 3) < 0.35 + u * 0.6 ? 1 : 0.08;
    return stutter * (0.5 + 0.5 * u);
  }
  if (t > OPEN && t < OPEN + 0.5) return hash3(Math.floor(t * 30), 4, 4) > 0.5 ? 1 : 0.2;
  return 0.9 + 0.1 * Math.sin(t * 50) * (hash3(Math.floor(t * 3), 5, 5) > 0.9 ? 1 : 0);
}

// The leaf swings inward on its left hinge over ~0.45 s (the plate's own door art squeezed into the foreshortened leaf width,
// with a dark edge), revealing the club's blue light, haze and a few backlit heads inside. Pixels outside the door rect are untouched.
function drawDoorOpening(fb: Frame, wall: Plate, t: number, open: number, D: readonly [number, number, number, number]) {
  const o = Math.min(1, open / 0.45), e = o * o * (3 - 2 * o), ang = e * 1.3;
  const [x0, y0, x1, y1] = D, W0 = x1 - x0, leaf = Math.max(2, Math.round(W0 * Math.cos(ang)));
  for (let y = y0; y <= y1; y++) {
    const v = (y - y0) / (y1 - y0);
    for (let x = x0; x <= x1; x++) {
      const i = y * fb.w + x;
      const inLeaf = x < x0 + leaf;
      if (inLeaf) {
        // the leaf, turning away from the street light
        const sx = x0 + Math.min(W0, Math.round((x - x0) * W0 / leaf)), j = y * wall.w + sx, k = x === x0 + leaf - 1 ? 0.35 : 0.78 - 0.25 * e;
        fb.r[i] = wall.r[j]! * k; fb.g[i] = wall.g[j]! * k; fb.b[i] = wall.b[j]! * k;
      } else {
        // the club inside: deep club blue, brighter toward the centre, hazy, flickering with the music
        const n = 0.9 + 0.1 * hash3(x >> 2, y >> 2, Math.floor(t * 12)), c = Math.max(0, 1 - Math.hypot((x - (x0 + x1) / 2) / (W0 * 0.6), (v - 0.4) / 0.7)), g = (0.35 + 0.65 * c) * n;
        fb.r[i] = 0.16 * g + 0.05 * c; fb.g[i] = 0.2 * g; fb.b[i] = 0.62 * g;
      }
    }
  }
  // backlit heads/shoulders of the crowd inside, low in the doorway (only where the gap is open)
  for (const [hx, hy, r] of [[x0 + 58, y1 - 26, 6], [x0 + 72, y1 - 30, 5], [x0 + 46, y1 - 22, 7], [x0 + 82, y1 - 24, 6]] as const) {
    if (hx < x0 + leaf + 2) continue;
    for (let y = hy - r; y <= y1; y++) for (let x = hx - r * 2; x <= hx + r * 2; x++) {
      if (x <= x0 + leaf || x > x1) continue;
      const head = ((x - hx) / r) ** 2 + ((y - hy) / r) ** 2 < 1, body = y > hy + r * 0.6 && Math.abs(x - hx) < r * 1.9 - (y - hy) * 0.05;
      if (head || body) { const i = y * fb.w + x; fb.r[i] = 0.03; fb.g[i] = 0.035; fb.b[i] = 0.06; }
    }
  }
}
// The club light escaping through the gaps around the closed leaf: uneven along each edge (the leaf sits unevenly in its frame),
// coloured like the club inside, blooming outward onto the frame and wall and strongest at the threshold, where it pools on the
// wet step. It pulses with the bass (muffled before the drums, on the kick after) and builds toward the opening. True colour
// (preserveColor). Leaf gap measured at 640: jambs x 280 / 362, lintel y 120, threshold y 280.
function drawDoorEdgeLeak(fb: Frame, t: number, hit: number) {
  const XL = 280, XR = 362, YT = 120, YB = 280, keep = preserveColor(fb), mark = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < fb.w && y < fb.h) keep[(y | 0) * fb.w + (x | 0)] = 1; };
  const thump = t > DRUMS_IN ? hit : beatHit(t, 6) * env('bass', t) * 0.7, build = Math.min(1, Math.max(0, (t - 1.5) / (OPEN - 1.5)));
  const k = (0.15 + 0.85 * thump) * (0.3 + 0.7 * build);
  if (k < 0.01) return;
  const core: RGB = [0.75, 0.7, 1], glow: RGB = [0.35, 0.3, 1], hot: RGB = [0.95, 0.35, 0.9];
  // gap width along each edge: slow noise (fixed per position) + a flicker; the hinge side (left) is tighter
  const gap = (u: number, side: number) => Math.max(0, 0.25 + 0.75 * vnoise(u * 0.08, side * 5.3, 2.7)) * (0.85 + 0.15 * vnoise(u * 0.4, t * 10, side));
  const bloom = (x0: number, y0: number, dx: number, dy: number, f: number, n: number) => {
    for (let d = 1; d <= n; d++) { const x = x0 + dx * d, y = y0 + dy * d, a = f * (1 - d / (n + 1)) ** 2; fb.add(x, y, glow, 0.55 * a); if (d < 3) fb.add(x, y, hot, 0.12 * a); mark(x, y); }
  };
  for (let y = YT; y <= YB; y++) {
    const u = y - YT, fl = gap(u, 0) * 0.7 * k, fr = gap(u, 1) * k;
    fb.add(XL, y, core, fl); fb.add(XR, y, core, fr); mark(XL, y); mark(XR, y);
    bloom(XL, y, -1, 0, fl, 9); bloom(XR, y, 1, 0, fr, 9);
  }
  for (let x = XL; x <= XR; x++) { const f = gap(x, 2) * 0.6 * k; fb.add(x, YT, core, f); mark(x, YT); bloom(x, YT, 0, -1, f, 6); }
  // threshold: the widest gap; a hot line, then the light pooling over the step and streaking down the wet pavement
  for (let x = XL - 1; x <= XR + 1; x++) { const f = (0.7 + 0.3 * gap(x, 3)) * k; fb.add(x, YB, core, 1.3 * f); fb.add(x, YB - 1, glow, 0.4 * f); mark(x, YB); mark(x, YB - 1); }
  for (let y = YB + 1; y < Math.min(H, YB + 40); y++) {
    const dy = y - YB, spread = 4 + dy * 1.4;
    for (let x = Math.floor(XL - spread); x <= Math.ceil(XR + spread); x++) {
      const inside = x >= XL && x <= XR ? 1 : Math.max(0, 1 - Math.min(Math.abs(x - XL), Math.abs(x - XR)) / spread);
      const streak = 0.5 + 0.5 * Math.max(0, Math.sin(x * 0.9 + vnoise(x * 0.2, y * 0.15, 7.1) * 6));
      fb.add(x, y, glow, 0.5 * k * inside * streak * (1 - dy / 40) ** 2); mark(x, y);
    }
  }
}
