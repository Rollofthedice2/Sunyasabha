// Per-frame "keep true colour" mask for post(): pixels set here skip palette snapping and dither. Used for light that
// the palette cannot represent smoothly (a neon glow falling off over blue-grey concrete bands red -> brown -> dark).
// drawFilm clears it at the start of every frame; scenes set pixels while drawing.
import type { Frame } from './fb.ts';
const masks = new WeakMap<Frame, Uint8Array>(), used = new WeakSet<Frame>();
export function preserveColor(fb: Frame): Uint8Array {
  let m = masks.get(fb); if (!m || m.length !== fb.w * fb.h) { m = new Uint8Array(fb.w * fb.h); masks.set(fb, m); }
  used.add(fb); return m;
}
export function clearPreserve(fb: Frame) { const m = masks.get(fb); if (m && used.has(fb)) { m.fill(0); used.delete(fb); } }
export function preserveMaskOf(fb: Frame): Uint8Array | undefined { return used.has(fb) ? masks.get(fb) : undefined; }
