// 1-bit text masks (rasterised offline by scripts/textmask.mjs) drawn as pixel lettering / neon.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Frame, type RGB } from './fb.ts';

export interface TextMask { w: number; h: number; bits: Uint8Array }
const cache = new Map<string, TextMask>();
const DIR = path.resolve(import.meta.dirname, '../../assets/text');

export function textMask(name: string): TextMask {
  let m = cache.get(name);
  if (!m) {
    const j = JSON.parse(readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as { w: number; h: number; rows: string[] };
    const bits = new Uint8Array(j.w * j.h);
    j.rows.forEach((r, y) => { for (let x = 0; x < j.w; x++) bits[y * j.w + x] = r.charCodeAt(x) === 49 ? 1 : 0; });
    m = { w: j.w, h: j.h, bits };
    cache.set(name, m);
  }
  return m;
}

// Draw a mask: body colour, optional 1px edge colour (outline), optional additive glow around lit pixels.
export function drawText(fb: Frame, name: string, x0: number, y0: number, col: RGB,
  o: { edge?: RGB; glow?: RGB; glowK?: number; glowR?: number; core?: RGB; alpha?: number; flipY?: boolean } = {}) {
  const m = textMask(name);
  x0 = Math.round(x0); y0 = Math.round(y0);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.bits[y * m.w + x] === 1;
  if (o.glow) {
    const r = o.glowR ?? 6, k = o.glowK ?? 0.04;
    for (let y = 0; y < m.h; y += 2) for (let x = 0; x < m.w; x += 2) if (at(x, y)) fb.glow(x0 + x, y0 + (o.flipY ? m.h - 1 - y : y), r, o.glow, k);
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!at(x, y)) continue;
    const yy = y0 + (o.flipY ? m.h - 1 - y : y);
    // neon tube: core where the stroke is thick (all 4 neighbours lit), body elsewhere
    const inner = at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1) && at(x - 2, y) && at(x + 2, y);
    const c = o.core && inner ? o.core : col;
    fb.set(x0 + x, yy, c, o.alpha ?? 1);
  }
  if (o.edge) for (let y = -1; y <= m.h; y++) for (let x = -1; x <= m.w; x++) {
    if (at(x, y)) continue;
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) fb.set(x0 + x, y0 + (o.flipY ? m.h - 1 - y : y), o.edge, o.alpha ?? 1);
  }
}
