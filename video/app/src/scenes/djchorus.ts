// The first chorus (45.83 → 55.63): a frontal shot of the DJ dancing on the stage behind his controller, the crowd in view;
// "until the circuit burns" keeps the throne's burn build from 52.84.
// The DJ is a sequence of whole-figure drawings at 15 per second, one per frame of data/chorus_dj_timeline.json (plate name +
// offset, soles pinned by the registration). The console's own pixels of the current frame (lighting and burn included) are put
// back over him, so he stands behind it. The crowd is a green-screen layer, the whole crowd in one state at a time
// (A rest / B bounce / C halfway / H fists high / J jump) on the schedule in data/chorus_crowd_schedule.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';
import { drawThrone } from './throne.ts';

const DATA = path.resolve(import.meta.dirname, '../../../data');
export const CHORUS_IN = 45.83, CHORUS_OUT = 55.63, BURN_FROM = 52.84;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

const DJ = (() => {
  const tl = JSON.parse(readFileSync(path.join(DATA, 'chorus_dj_timeline.json'), 'utf8')) as { t0: number; fps: number; frames: [string, number, number][]; plate_prefix: string; console_polygon_640: [number, number][] };
  const cache: Record<string, ReturnType<typeof loadPlate>> = {};
  // the console occluder: every pixel inside the traced polygon (even-odd scanline fill at 640)
  const poly = tl.console_polygon_640, console: number[] = [];
  for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
    let inside = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, ya] = poly[a]!, [xb, yb] = poly[b]!; if ((ya > y + 0.5) !== (yb > y + 0.5) && x + 0.5 < ((xb - xa) * (y + 0.5 - ya)) / (yb - ya) + xa) inside = !inside;
    }
    if (inside) console.push(y * 640 + x);
  }
  return { console, at(t: number) {
    const i = Math.round((t - tl.t0) * tl.fps); const fr = tl.frames[i]; if (i < 0 || !fr) return null;
    const pl = (cache[fr[0]] ??= loadPlate(`${tl.plate_prefix}${fr[0]}`)); return { name: `${tl.plate_prefix}${fr[0]}`, pl, dx: fr[1], dy: fr[2] };
  } };
})();

const CROWD = (() => {
  const plates: Record<string, ReturnType<typeof loadPlate>> = {};
  for (const s of ['A', 'B', 'C', 'H', 'J']) for (const g of ['L', 'C', 'R']) plates[`${s}_${g}`] = loadPlate(`chorus_crowd_v5_${s}_${g}`);
  return { sch: JSON.parse(readFileSync(path.join(DATA, 'chorus_crowd_schedule.json'), 'utf8')).groups as Record<string, [number, string][]>, plates };
})();

// the DJ's SKIN pixels keep their true colour through the output palette snap; robe and hair stay palette-snapped
function keepSkin(fb: Frame, pl: ReturnType<typeof loadPlate>, ox: number, oy: number) {
  const keep = preserveColor(fb); const [bx0, by0, bx1, by1] = pl.bbox;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const j = y * pl.w + x; if (!pl.a[j]) continue; const r = pl.r[j]!, g = pl.g[j]!, b = pl.b[j]!;
    if (r > 0.3 && r > g * 1.15 && g > b * 1.02) { const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < fb.w && Y < fb.h) keep[Y * fb.w + X] = 1; }
  }
}

// name of the DJ drawing shown at time t (null outside the timeline)
export const __djPlateName = (t: number) => DJ.at(t)?.name ?? null;

export function drawDjchorus(fb: Frame, t: number) {
  const burn = t >= BURN_FROM ? smooth((t - BURN_FROM) / 1.4) : 0;
  drawThrone(fb, t, { noDJ: true, crowd: false, burn });
  const dj = DJ.at(t);
  if (dj) {
    const cons = DJ.console.map((i) => [i, fb.r[i]!, fb.g[i]!, fb.b[i]!] as const);
    drawPlate(fb, dj.pl, dj.dx, dj.dy); keepSkin(fb, dj.pl, dj.dx, dj.dy);
    // the console in front of him goes through the palette like the rest of the stage
    const keep = preserveColor(fb); for (const [i, r, g, b] of cons) { fb.r[i] = r; fb.g[i] = g; fb.b[i] = b; keep[i] = 0; }
  }
  for (const g of ['L', 'C', 'R'] as const) {
    const seg = CROWD.sch[g]!; let s = seg[0]![1];
    for (const [t0, st] of seg) { if (t0 > t + 1e-6) break; s = st; }
    const pl = CROWD.plates[`${s}_${g}`]; if (pl) drawPlate(fb, pl, 0, 0);
  }
}
