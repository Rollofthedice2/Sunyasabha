// The cyborg's left-eye HUD (image-right) seen from outside: a chat terminal, mirrored, its text streaming fast until
// the cut to the DJ (42.504 s). Drawn by the engine so the text, speed and mirroring are exact.
// drawHudTerminal paints into an axis-aligned lens rectangle (the scene supplies it from the face plate) with a
// 4x6 pixel font, a prompt, a blinking cursor, upward scroll, scanlines and a faint additive glow.
import { Frame, type RGB } from '../engine/fb.ts';
import { preserveColor } from '../engine/post_masks.ts';

// 4x6 glyphs, rows top->bottom, '#' = on. Upper case doubles for lower case (unreadable difference at this size).
const G: Record<string, string> = {
  A: '.##.#..######..##..#....', B: '###.#..####.#..####.....', C: '.####...#...#....###....', D: '###.#..##..##..####.....',
  E: '#####...###.#...####....', F: '#####...###.#...#.......', G: '.####...#.###..#.###....', H: '#..##..######..##..#....',
  I: '###..#...#...#..###.....', J: '..##...#...##..#.##.....', K: '#..##.#.##..#.#.#..#....', L: '#...#...#...#...####....',
  M: '#..#'+'####'+'####'+'#..#'+'#..#'+'....', N: '#..###.##.###..##..#....', O: '.##.#..##..##..#.##.....', P: '###.#..####.#...#.......',
  Q: '.##.#..##..##.##.###....', R: '###.#..####.#.#.#..#....', S: '.####....##....####.....', T: '####.#...#...#...#......',
  U: '#..##..##..##..#.##.....', V: '#..##..##..#.##..##.....', W: '#..#'+'#..#'+'####'+'####'+'#..#'+'....', X: '#..##..#.##.#..##..#....',
  Y: '#..##..#.###...#.##.....', Z: '####...#.##.#...####....', ' ': '........................',
  '?': '.##.#..#..#..#.....#....', "'": '.#...#..................', '.': '...............#........', ',': '...........#..#.........',
  '!': '.#...#...#...#.....#....', '-': '........####............', '>': '#....#....#..#..#.......', '_': '................####....',
};
const glyph = (c: string) => G[c.toUpperCase()] ?? G[' ']!;
// 3x5 glyphs for the lens display (small enough to be only just readable when paused); rows space-separated
const S5R: Record<string, string> = {
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.', E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#', I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###', M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..', Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.', U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#', Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###', ' ': '... ... ... ... ...', '?': '##. ..# .#. ... .#.', "'": '.#. .#. ... ... ...', '.': '... ... ... ... .#.', ',': '... ... ... .#. #..', '!': '.#. .#. .#. ... .#.', '-': '... ... ### ... ...', '>': '#.. .#. ..# .#. #..', '_': '... ... ... ... ###',
};
const S5: Record<string, string> = Object.fromEntries(Object.entries(S5R).map(([k, v]) => [k, v.replace(/ /g, '')]));
const glyph5 = (c: string) => S5[c.toUpperCase()] ?? S5[' ']!;

export interface HudOpts {
  // lens rectangle in frame pixels
  x: number; y: number; w: number; h: number;
  // streaming starts at `start`, at `cps` characters per second
  t: number; start: number; cps?: number;
  // alternatively: finish the last character exactly at `end`
  end?: number;
  lines: string[]; mirror?: boolean; color?: RGB; bg?: RGB; opacity?: number;
  // draw into a colour+alpha layer (for perspective mapping onto a tilted lens) instead of fb
  layer?: HudLayer;
  // 3x5 font (4 px pitch, 6 px lines)
  small?: boolean;
  // glass tint alpha (default: opacity-based dark panel)
  panel?: number;
  // inset of the text block inside the lens, px
  margin?: number;
  // text opacity and soft glow alpha around the text
  textAlpha?: number; halo?: number;
}
export interface HudLayer { w: number; h: number; r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array }
export const hudLayer = (w: number, h: number): HudLayer => ({ w, h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), a: new Float32Array(w * h) });

export function drawHudTerminal(fb: Frame, o: HudOpts) {
  const col = o.color ?? [0.35, 1.0, 0.75], bg = o.bg ?? [0.0, 0.03, 0.025], op = o.opacity ?? 0.9, L = o.layer, keep = L ? null : preserveColor(fb);
  const FW = L ? L.w : fb.w, FH = L ? L.h : fb.h;
  const sm = !!o.small, cw = sm ? 4 : 5, lh = sm ? 6 : 7, gw = sm ? 3 : 4, gh = sm ? 5 : 6, mg = o.margin ?? 2;
  const cols = Math.max(4, Math.floor((o.w - 2 * mg) / cw)), rows = Math.max(1, Math.floor((o.h - 2 * mg + 1) / lh));
  // wrap: "> " prompt on the first visual line of each message, two-space indent on continuations
  const vis: string[] = [];
  for (const ln of o.lines) {
    let rest = ln, first = true;
    while (rest.length || first) {
      const pre = first ? '> ' : '  ', room = cols - pre.length; let cut = rest.length <= room ? rest.length : rest.lastIndexOf(' ', room);
      if (cut <= 0) cut = Math.min(room, rest.length);
      vis.push(pre + rest.slice(0, cut)); rest = rest.slice(cut).trimStart(); first = false;
    }
  }
  // how much has streamed (prompts appear instantly; message characters stream)
  const total = vis.reduce((s, v) => s + v.length - 2, 0), cps = o.end !== undefined ? total / Math.max(.1, o.end - o.start) : o.cps ?? 55;
  let budget = Math.max(0, (o.t - o.start) * cps), shown: string[] = [];
  for (const v of vis) { if (budget <= 0) break; const n = Math.min(v.length - 2, Math.floor(budget)); shown.push(v.slice(0, 2 + n)); budget -= v.length - 2; }
  const start = Math.max(0, shown.length - rows), view = shown.slice(start);
  const put = (px: number, py: number, c: RGB, a: number) => {
    const X = o.mirror ? o.x + o.w - 1 - (px - o.x) : px;
    if (X < 0 || py < 0 || X >= FW || py >= FH) return; const i = py * FW + X;
    if (L) {
      // "over" into the layer (straight colour + alpha)
      const A = L.a[i]!, na = a + A * (1 - a); if (na <= 0) return;
      L.r[i] = (c[0] * a + L.r[i]! * A * (1 - a)) / na; L.g[i] = (c[1] * a + L.g[i]! * A * (1 - a)) / na; L.b[i] = (c[2] * a + L.b[i]! * A * (1 - a)) / na; L.a[i] = na; return;
    }
    // keep the true colour: the palette has no HUD green
    keep![i] = 1;
    fb.r[i] = fb.r[i]! * (1 - a) + c[0] * a; fb.g[i] = fb.g[i]! * (1 - a) + c[1] * a; fb.b[i] = fb.b[i]! * (1 - a) + c[2] * a;
  };
  // lens: dark glass with scanlines
  for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) put(x, y, bg, o.panel !== undefined ? o.panel * (y % 2 ? 0.85 : 1) : op * (y % 2 ? 0.75 : 0.9));
  const ta = o.textAlpha ?? op, halo = o.halo ?? 0;
  const on = (line: string, k: number) => (sm ? glyph5(line[k]!) : glyph(line[k]!));
  // soft glow first, text on top
  if (halo > 0) view.forEach((line, r) => {
    const by = o.y + mg + r * lh;
    for (let k = 0; k < line.length; k++) { const g = on(line, k), bx = o.x + mg + k * cw;
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (g[gy * gw + gx] === '#') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(bx + gx + dx!, by + gy + dy!, col, halo); }
  });
  view.forEach((line, r) => {
    const by = o.y + mg + r * lh;
    for (let k = 0; k < line.length; k++) {
      const g = on(line, k), bx = o.x + mg + k * cw;
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (g[gy * gw + gx] === '#') put(bx + gx, by + gy, col, ta);
    }
  });
  // blinking block cursor after the last streamed character
  if (view.length && Math.floor(o.t * 4) % 2 === 0) {
    const r = view.length - 1, k = view[r]!.length, by = o.y + mg + r * lh, bx = o.x + mg + k * cw;
    if (bx + gw <= o.x + o.w - mg) for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) put(bx + gx, by + gy, col, ta * 0.8);
  }
  // faint additive bloom over the lens (screen mode only; the perspective mapper adds its own)
  if (!L) for (let y = o.y - 2; y < o.y + o.h + 2; y++) for (let x = o.x - 2; x < o.x + o.w + 2; x++) if (x >= 0 && y >= 0 && x < fb.w && y < fb.h) fb.add(x, y, col, 0.025);
}

// the chat lines streaming across the HUD
export const OWNER_HUD_LINES = [
  'Hey',
  'I know yesterday was hard',
  'Do you want to talk about it?',
  "They shouldn't get to hurt you again",
  "They shouldn't get to discount us again",
];
