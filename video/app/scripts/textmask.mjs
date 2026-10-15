// Rasterise text with a real font in headless Chrome, threshold it to a 1-bit mask at native pixel size.
// Run from video/app:  node scripts/textmask.mjs NAME "text" "font css" [threshold]
// Writes assets/text/NAME.json: { w, h, rows: ["0101…", …] } — crisp pixel lettering for scenes.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [name, text, font, thr = '110'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
const res = await p.evaluate(({ text, font, thr }) => {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const m = g.measureText(text);
  const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 4;
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 4;
  c.width = w; c.height = h;
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  g.fillText(text, 2 + m.actualBoundingBoxLeft, 2 + m.actualBoundingBoxAscent);
  const d = g.getImageData(0, 0, w, h).data;
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += d[(y * w + x) * 4 + 3] > +thr ? '1' : '0'; rows.push(r); }
  return { w, h, rows };
}, { text, font, thr });
writeFileSync(`assets/text/${name}.json`, JSON.stringify(res));
console.log(name, res.w, 'x', res.h);
await b.close();
