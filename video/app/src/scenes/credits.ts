// The credits after the final shot: four centred screens (plates credits_s1..s4, timing in data/credits.json), each fading in
// and out through black. When the bell strikes on the last screen, one soft ripple leaves its ring and fades.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Frame } from '../engine/fb.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';

const F = path.resolve(import.meta.dirname, '../../../data/credits.json');
interface Cred { screens: Record<string, [number, number]>; fade: number; bell_at: number; end_fade: [number, number]; length: number;
  ripple: { dur: number; grow: number }; rings: Record<string, [number, number, number]>; ring_rgb: [number, number, number] }
const C: Cred = JSON.parse(readFileSync(F, 'utf8'));
export const CREDITS_LEN = C.length;
const lin = (v: number) => Math.pow(v / 255, 2.2);

export function drawCredits(fb: Frame, t: number, t0: number) {
  fb.r.fill(0); fb.g.fill(0); fb.b.fill(0);
  const u = t - t0;
  for (const [k, [a, b]] of Object.entries(C.screens)) {
    if (u < a || u >= b) continue;
    // fade in over C.fade, fade out over C.fade (the last screen fades with the sound at end_fade)
    let al = Math.min(1, (u - a) / C.fade);
    if (k === 's4') al = Math.min(al, 1 - Math.max(0, Math.min(1, (u - C.end_fade[0]) / (C.end_fade[1] - C.end_fade[0]))));
    else al = Math.min(al, (b - u) / C.fade);
    al = Math.max(0, al) ** 1.5;
    drawPlate(fb, loadPlate(`credits_${k}`), 0, 0, { mul: [al, al, al] });
    if (k === 's4' && u >= C.bell_at && u < C.bell_at + C.ripple.dur) {
      const [cx, cy, r0] = C.rings[k]!, p = (u - C.bell_at) / C.ripple.dur, r = r0 + C.ripple.grow * Math.pow(p, 0.6), k2 = 0.55 * (1 - p) ** 2 * al;
      const col: [number, number, number] = [lin(C.ring_rgb[0]), lin(C.ring_rgb[1]), lin(C.ring_rgb[2])];
      const n = Math.ceil(2 * Math.PI * r * 1.5);
      // the ripple passes behind the type: it only lights dark background pixels, never a letter
      for (let i = 0; i < n; i++) {
        const th = (i / n) * 2 * Math.PI, x = Math.round(cx + r * Math.cos(th)), y = Math.round(cy + r * Math.sin(th));
        if (x < 0 || y < 0 || x >= fb.w || y >= fb.h) continue;
        const j = y * fb.w + x; if (fb.r[j]! + fb.g[j]! + fb.b[j]! > 0.06) continue;
        fb.add(x, y, col, k2 / 1.5);
      }
    }
  }
  preserveColor(fb).fill(1);
}
