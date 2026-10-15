// Verse 2 opener — "Sister on the dance floor — titanium vertebrae".
// Behind her, in the spotlight, in the ring the crowd has opened for her at the stage end. One body roll per bar travels
// down her spine; each titanium vertebra lights as the wave passes.
import { Frame, H, hex } from '../engine/fb.ts';
import { P } from '../engine/palette.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { drawCrowdResponse } from '../fig/crowd_response.ts';
import { loadAnim, drawAnimAt } from '../engine/anim.ts';
import { barPos, env } from '../engine/music.ts';
import { vnoise } from '../fig/sdf.ts';

const SBG = loadPlate('sister_bg_A03');
// her body roll: one drawn cycle per bar
const ROLL = loadAnim('sister_roll_bar');
const TAU = Math.PI * 2;

// the roll's phase in the bar and its sideways displacement at height s (0 at the crown, 1 at the hips)
function bodyAt(t: number) {
  const ph = barPos(t);
  const f = ph - Math.floor(ph);
  const A = 11;
  const wave = (s: number) => A * Math.sin(TAU * (1.1 * s - ph)) * (0.25 + 0.75 * s) + 3 * Math.sin(TAU * ph * 0.5);
  return { f, wave };
}

export function drawSister(fb: Frame, t = 0) {
  // the painted club plate breathes with the kick; the ring of onlookers reacts around her
  drawPlate(fb, SBG, 0, 0, { mul: () => { const k = 0.92 + 0.12 * env('drums', t); return [k, k, k]; } });
  drawCrowdResponse(fb, 'sister', t);
  drawSisterFigure(fb, t);
}
function drawSisterFigure(fb: Frame, t: number) {
  // ---------- spotlight cone onto her ----------
  const spot = 0.7 + 0.3 * env('drums', t);
  for (let y = 0; y < H; y++) {
    const half = 30 + y * 0.42;
    for (let x = Math.floor(320 - half); x <= Math.ceil(320 + half); x++) {
      const f = 1 - Math.abs(x - 320) / half;
      if (f > 0) fb.add(x, y, [0.55, 0.65, 1.0], 0.07 * f * spot * (0.7 + 0.3 * vnoise(x * 0.04, y * 0.03 - t * 0.4, 6)));
    }
  }
  // pool of light on the floor at her feet
  fb.glow(320, 352, 90, hex('#7090ff'), 0.12 * spot, 3);

  // ---------- her: arms overhead, the titanium spine bare, rolling once per bar; lit by the breathing spotlight ----------
  const b = bodyAt(t);
  // the figure spans the frame height, feet at the bottom edge
  const TOP = 4, BOT = 360;
  const roll = b.f;
  const light = (_x: number, y: number): [number, number, number] => { const k = 0.9 + 0.2 * spot - 0.15 * Math.max(0, (y - 240) / 120); return [k, k, k]; };
  drawAnimAt(fb, ROLL, t, 320, BOT, { beats: 4, mul: light });
  // the spine: the wave front glows cyan as it passes each vertebra on the midline
  for (let i = 0; i < 17; i++) {
    const u = i / 16, y = 118 + u * 190;
    const lit = Math.exp(-((u - roll) ** 2) / 0.006) + 0.15 * env('bass', t);
    if (lit < 0.2) continue;
    const x = 320 + Math.round(b.wave((y - TOP) / (BOT - TOP)));
    fb.glow(x, y, 7 + 6 * lit, hex('#40e0ff'), 0.25 * lit);
    fb.set(x, y, lit > 0.6 ? P.white : P.cy1); fb.set(x - 1, y, P.cy1); fb.set(x + 1, y, P.cy1);
  }
}
