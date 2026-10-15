import { drawController28 } from './controller28.ts';
import { drawRaidStill } from './raid_stills.ts';
import { loadPlate, drawPlate } from '../engine/plate.ts';
// The cover shot: the throne between the two heads, seen from inside the crowd, with one whole-person crowd layer drawn over the
// stage, DJ and flames. Its slots in the film hand over to their own inserts: the controller close-up (before 30 s), the bridge's
// seated DJ returning for "vayaṃ tu etaj jānīmaḥ" (114.72 -> 123.169), and the raid stills from the last bar of the drop (128.1).
import { Frame } from '../engine/fb.ts';
import { drawThrone } from './throne.ts';
import { P } from '../engine/palette.ts';
import { drawText, textMask } from '../engine/text.ts';
import { hex } from '../engine/fb.ts';
import { bridgeClubAmount } from './bridge_mood.ts';
import { drawBridgeReprise } from './djbridge.ts';

const COVER_LAYER = loadPlate('cover_crowd_A03');
export function drawCover(fb: Frame, t = 0) {
  if (t >= 128.1 && drawRaidStill(fb, t)) return;
  if (t < 30 && drawController28(fb, t)) return;
  if (t >= 114.72 && t < 123.169 && drawBridgeReprise(fb, t, 114.72, 123.169)) return;
  drawThrone(fb, t, { crowd: false });
  const club = bridgeClubAmount(t);
  if (club > 0) for (let i = 0; i < fb.w * fb.h; i++) {
    fb.r[i]! *= 1 - 0.36 * club;
    fb.g[i]! *= 1 - 0.36 * club;
    fb.b[i]! *= 1 - 0.28 * club;
  }
  // "śūnyam idaṃ sarvam" — all this is empty: it glows into the throne's arch above the ensō as it is sung
  const a = Math.max(0, Math.min(1, (t - 105.6) / 0.5)) * (t > 113 ? Math.max(0, 1 - (t - 113) / 0.6) : 1);
  if (a > 0) {
    const sm = textMask('deva_sunyam');
    drawText(fb, 'deva_sunyam', 320 - sm.w / 2, 6, P.blu6, { core: P.cy1, glow: hex('#4080ff'), glowK: 0.05 * a, glowR: 7, alpha: a });
  }
  drawPlate(fb, COVER_LAYER, 0, 0);
}
