// Rasterise every row of ../data/lyrics_layout.json (written by analysis/lyrics_layout.py) to a 1-bit mask assets/text/lyr_GGG_R.json, in the
// same font and format as scripts/subs.mjs. Run from video/app:  node scripts/lyrics.mjs ["font css"]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
const G = JSON.parse(readFileSync('../data/lyrics_layout.json', 'utf8')).groups;
for (const f of readdirSync('assets/text')) if (/^lyr_\d{3}_\d\.json$/.test(f)) unlinkSync(`assets/text/${f}`);
const font = process.argv[2] ?? "600 12px 'Segoe UI', sans-serif";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
let n = 0;
for (let g = 0; g < G.length; g++) for (let r = 0; r < G[g].rows.length; r++) {
  const res = await p.evaluate(({ text, font }) => {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = font; const m = x.measureText(text);
    const w = Math.ceil(m.width) + 4, h = 18;
    c.width = w; c.height = h; x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    x.fillText(text, 2, 13);
    const d = x.getImageData(0, 0, w, h).data, rows = [];
    for (let y = 0; y < h; y++) { let s = ''; for (let i = 0; i < w; i++) s += d[(y * w + i) * 4 + 3] > 120 ? '1' : '0'; rows.push(s); }
    return { w, h, rows, text };
  }, { text: G[g].rows[r].text, font });
  writeFileSync(`assets/text/lyr_${String(g).padStart(3, '0')}_${r}.json`, JSON.stringify(res)); n++;
}
console.log(`${n} lyric row masks from ../data/lyrics_layout.json`);
await b.close();
