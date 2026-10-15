// Master palette (sRGB hex), drawn from the cover art: void blacks, night indigo, blue flame,
// blood-to-neon reds, the violet where red and blue light meet in smoke, skin, metal, brass, stone.
// Every final pixel is snapped to one of these (post.ts), so the whole video shares one palette.
import { hex, type RGB } from './fb.ts';

export const PAL_HEX = {
  // void / ink
  void0: '#040208', void1: '#0a0712', void2: '#110c1d', void3: '#1a1429',
  // night blue ramp → blue flame
  blu0: '#161a3a', blu1: '#1f2856', blu2: '#273a7c', blu3: '#2f50a6', blu4: '#3c6ad2',
  blu5: '#5b8ff5', blu6: '#8db8ff', blu7: '#c4e0ff', cy0: '#6fe0ff', cy1: '#d4faff',
  // red ramp
  red0: '#22050b', red1: '#3f0912', red2: '#660e1a', red3: '#951421', red4: '#c91c28',
  red5: '#f5323a', red6: '#ff6c5c', red7: '#ffb4a0',
  // violet (mixed light)
  vio0: '#2a0f35', vio1: '#4a1957', vio2: '#72287e', vio3: '#a043a8',
  // skin (shadow → highlight)
  skn0: '#24120e', skn1: '#3e2117', skn2: '#5f3524', skn3: '#844e33', skn4: '#a86c46',
  skn5: '#c98f62', skn6: '#e6b78a',
  // in-between skin shadows: without them darkened skin snaps to the brass entries and goes olive
  sknA: '#301810', sknB: '#4e2a1d', sknC: '#714029', sknD: '#956043',
  // metal / grey
  gry0: '#1e1e26', gry1: '#33333f', gry2: '#4f4f5e', gry3: '#767688', gry4: '#a3a3b3', gry5: '#d6d6e0',
  // brass
  brs0: '#36250e', brs1: '#664518', brs2: '#a0742f', brs3: '#ddb05c',
  // stone (cracked heads)
  stn0: '#141a26', stn1: '#232c3e', stn2: '#38445a', stn3: '#5a6880', stn4: '#8796ad',
  white: '#ffffff',
} as const;

export type PalName = keyof typeof PAL_HEX;
export const P: Record<PalName, RGB> = Object.fromEntries(
  Object.entries(PAL_HEX).map(([k, v]) => [k, hex(v)]),
) as Record<PalName, RGB>;

export const PAL_LIST: { name: string; srgb: [number, number, number] }[] = Object.entries(PAL_HEX).map(([name, v]) => {
  const n = parseInt(v.slice(1), 16);
  return { name, srgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
});
