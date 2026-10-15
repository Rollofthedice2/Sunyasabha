// Rasterise every English subtitle line to a 1-bit mask (assets/text/sub_NNN.json) in one browser session.
// Run from video/app:  node scripts/subs.mjs ["font css"]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
// timed lines (data/lyrics_timing.json) are used when present, else the estimates (same shape: {en, ...} in subtitle order)
const src = existsSync('../data/lyrics_timing.json') ? '../data/lyrics_timing.json' : '../data/lyrics_estimates.json';
const lines = JSON.parse(readFileSync(src, 'utf8'));
for (const f of readdirSync('assets/text')) if (/^sub_\d{3}\.json$/.test(f)) unlinkSync(`assets/text/${f}`);
const font = process.argv[2] ?? "600 12px 'Segoe UI', sans-serif";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
for (let i = 0; i < lines.length; i++) {
  const res = await p.evaluate(({ text, font }) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = font; const m = g.measureText(text);
    const w = Math.ceil(m.width) + 4, h = 18;
    c.width = w; c.height = h; g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    g.fillText(text, 2, 13);
    const d = g.getImageData(0, 0, w, h).data, rows = [];
    for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += d[(y * w + x) * 4 + 3] > 120 ? '1' : '0'; rows.push(r); }
    return { w, h, rows, text };
  }, { text: lines[i].en, font });
  writeFileSync(`assets/text/sub_${String(i).padStart(3, '0')}.json`, JSON.stringify(res));
}
console.log(`${lines.length} subtitle masks from ${src}`);
await b.close();
