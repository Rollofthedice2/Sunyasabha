// The throne under siren light: the DJ plays on while the raid sweeps the hall (the film cuts here at 162-165.5;
// a raid still is drawn instead wherever raid_stills schedules one). From 178.3 the blue flames go out one by one,
// the ensō fades and the DJ dissolves pixel by pixel; the empty throne, then black, and the neon title once more.
import { drawRaidStill } from './raid_stills.ts';
import { Frame, W, H } from '../engine/fb.ts';
import { drawThrone } from './throne.ts';
import { siren } from './raid.ts';
import { drawText, textMask } from '../engine/text.ts';
import { P } from '../engine/palette.ts';
import { hex } from '../engine/fb.ts';
import { hash3 } from '../fig/sdf.ts';

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// one beat (s)
const B = 0.4376;
const OUT_L = 178.3, OUT_R = 180.0, ENSO = 181.4, DISSOLVE = [182.0, 184.4], BLACK = 184.9;
const fbB = new Frame();
// chamfer distance (px) from each set pixel to the nearest unset one
function edgeDist(m: Uint8Array) {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = m[i] ? 1e6 : 0;
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i]!, d[i - 1]! + 1, d[i - W]! + 1, d[i - W - 1]! + 1.4, d[i - W + 1]! + 1.4); }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i]!, d[i + 1]! + 1, d[i + W]! + 1, d[i + W + 1]! + 1.4, d[i + W - 1]! + 1.4); }
  return d;
}

export function drawFinale(fb: Frame, t = 172) {
  if (drawRaidStill(fb, t)) return;
  const flameOn: [number, number] = [1 - smooth((t - OUT_L) / (B * 2)), 1 - smooth((t - OUT_R) / (B * 2))];
  const ensō = 1 - smooth((t - ENSO) / (B * 4));
  const d = smooth((t - DISSOLVE[0]) / (DISSOLVE[1] - DISSOLVE[0]));
  drawThrone(fb, t, { flameOn, ensō, crowd: t < 180 });
  if (d > 0) {
    drawThrone(fbB, t, { flameOn, ensō, noDJ: true, crowd: t < 180 });
    // where the DJ is: the pixels that differ between the two frames
    const diff = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) diff[i] = Math.abs(fb.r[i]! - fbB.r[i]!) + Math.abs(fb.g[i]! - fbB.g[i]!) + Math.abs(fb.b[i]! - fbB.b[i]!) > 0.02 ? 1 : 0;
    // erosion: a pixel goes once the dissolve has reached its distance from the silhouette's edge
    const dist = edgeDist(diff);
    // slow at first, then the body goes quickly
    const reach = 4 * d + 40 * d * d;
    for (let i = 0; i < W * H; i++) {
      if (!diff[i]) continue;
      const gone = dist[i]! + (hash3(i % W, (i / W) | 0, 5) - 0.5) * 6 < reach;
      if (gone) { fb.r[i] = fbB.r[i]!; fb.g[i] = fbB.g[i]!; fb.b[i] = fbB.b[i]!; }
      else if (dist[i]! < reach + 2.5) { fb.r[i] = P.cy1[0]; fb.g[i] = P.cy1[1]; fb.b[i] = P.cy1[2]; }
    }
    // motes: the dissolved pixels drift upward and fade
    for (let k = 0; k < 160; k++) {
      const born = DISSOLVE[0]! + hash3(k, 1, 6) * (DISSOLVE[1]! - DISSOLVE[0]!);
      const age = t - born;
      if (age < 0 || age > 1.2) continue;
      const x = 250 + hash3(k, 2, 6) * 140 + Math.sin(age * 5 + k) * 3, y = 150 + hash3(k, 3, 6) * 150 - age * 50;
      fb.set(x, y, age < 0.5 ? P.cy1 : P.blu4);
    }
  }
  // siren wash: the hall breathes red and blue, stronger as the flames die
  const s = siren(t);
  const k = (0.05 + 0.1 * (1 - (flameOn[0] + flameOn[1]) / 2)) * s.k;
  const fade = 1 - smooth((t - BLACK) / 0.8);
  for (let i = 0; i < W * H; i++) {
    fb.r[i] = (fb.r[i]! + s.col[0] * k) * fade; fb.g[i] = (fb.g[i]! + s.col[1] * k) * fade; fb.b[i] = (fb.b[i]! + s.col[2] * k) * fade;
  }
  // bookend: in the dark, the neon शून्यसभा from the intro stutters on one last time, then dies
  if (t > 186.0) {
    const u = t - 186.0;
    const on = u < 0.7 && hash3(Math.floor(t * 16), 7, 7) < 0.55 + u * 0.5 ? 1 : u < 0.9 ? 0.15 : 0;
    if (on > 0) {
      const tm = textMask('title_deva');
      drawText(fb, 'title_deva', 320 - tm.w / 2, 180 - tm.h / 2, on > 0.5 ? P.red5 : P.red2, { core: on > 0.5 ? P.red7 : undefined, glow: hex('#ff1020'), glowK: 0.05 * on, glowR: 9 });
    }
  }
}
