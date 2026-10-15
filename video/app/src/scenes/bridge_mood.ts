// Confirmed lyric-line bounds. These are not word/phoneme timestamps.
export const DEPENDENT_ARISING = 109.109;
export const BRIDGE_LAST_LINE_END = 123.169;

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// Lower the architectural light while keeping the dancers and sweat highlights legible.
export function bridgeClubAmount(t: number) {
  return smooth((t - DEPENDENT_ARISING) / 0.65) * (1 - smooth((t - BRIDGE_LAST_LINE_END) / 0.4));
}
