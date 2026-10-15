// The raid's held stills: a schedule of full-frame plates in song time, with light and air moving over them while nobody moves.
// True colour, like the other generated art.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame, W, H } from '../engine/fb.ts';
import { vnoise, hash3 } from '../fig/sdf.ts';
import { siren } from './raid.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
import { preserveColor } from '../engine/post_masks.ts';

// [start time, plate name or null] in song seconds; each plate holds until the next entry
const SEQ = (JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../data', 'raid_stills.json'), 'utf8')) as { seq: [number, string | null][] }).seq;

// Per camera: the door's siren glow [x, y, radius], an optional brazier flame [x, y], and the vertical haze band [y0, y1], in the 640x360 frame
type Cam = { door?: [number, number, number]; flame?: [number, number]; band: [number, number] };
const RF_WIDE_CAM: Cam = { door: [328, 122, 42], band: [40, 240] };
const DOOR_CAM: Cam = { door: [152, 75, 46], band: [30, 230] }, CONSOLE_CAM: Cam = { door: [455, 92, 40], flame: [18, 172], band: [60, 200] }, CLOSE_CAM: Cam = { band: [0, 200] };
function camOf(nm: string): Cam | null {
  // the console view keeps its own camera inside the wide floor set
  if (nm === 'raid5_RF_W_R241') return CONSOLE_CAM;
  // the wide floor views look straight at the centred entrance door
  if (nm.startsWith('raid5_RF_W')) return RF_WIDE_CAM;
  if (nm.startsWith('raid5_hl_')) return CLOSE_CAM;
  // frontal stage camera: no door or haze band
  if (nm.startsWith('raid5_209')) return null;
  return DOOR_CAM;
}
// haze drifting in the smoke band, the door's siren pulse, the brazier flicker and slow motes
function live(fb: Frame, nm: string, t: number) {
  const cam = camOf(nm); if (!cam) return;
  const s = siren(t), [y0, y1] = cam.band;
  // haze: slow two-octave drift, thin, tinted by the siren; strongest mid-band, fading at its edges
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    const e = Math.sin(Math.PI * (y - y0) / (y1 - y0));
    for (let x = 0; x < W; x += 1) {
      const n = vnoise(x * 0.018 + t * 0.22, y * 0.035 - t * 0.04, 3.1) * 0.65 + vnoise(x * 0.05 - t * 0.35, y * 0.08, 7.7) * 0.35;
      const k = Math.max(0, n - 0.45) * 0.12 * e; if (k <= 0) continue;
      fb.add(x, y, [0.5 + 0.4 * s.col[0], 0.22 + 0.2 * s.col[1], 0.45 + 0.4 * s.col[2]], k);
    }
  }
  if (cam.door) fb.glow(cam.door[0], cam.door[1], cam.door[2], s.col, 0.18 * s.k, 0.8);
  if (cam.flame) {
    const f = 0.7 + 0.3 * vnoise(t * 9, 1.3, 2.2);
    fb.glow(cam.flame[0], cam.flame[1], 34, [0.15, 0.4, 1], 0.22 * f, 0.7);
  }
  // motes: slow drift up and right, wrapping in the band, soft flicker
  for (let k = 0; k < 28; k++) {
    const sp = 6 + hash3(k, 1, 9) * 10, x = (hash3(k, 2, 9) * W + t * sp) % W, y = y1 - ((hash3(k, 3, 9) * (y1 - y0) + t * sp * 0.6) % (y1 - y0));
    const a = 0.25 + 0.35 * Math.max(0, Math.sin(t * (1.5 + hash3(k, 4, 9) * 2) + k));
    fb.add(x, y, [1, 0.55, 0.7], a);
  }
}
export function drawRaidStill(fb: Frame, t: number): boolean {
  let nm: string | null = null; for (const [a, n] of SEQ) if (t >= a) nm = n;
  if (!nm || t < SEQ[0]![0]) return false;
  drawPlate(fb, loadPlate(nm), 0, 0); live(fb, nm, t); preserveColor(fb).fill(1); return true;
}
