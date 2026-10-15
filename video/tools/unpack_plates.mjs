// Restores the engine's raw plates: every app/assets/plates/NAME.png (8-bit RGBA, as stored in this repository) becomes NAME.rgba, the
// uncompressed RGBA bytes the renderer reads. Uses only Node's built-in zlib. Run once after cloning:  node video/tools/unpack_plates.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../app/assets/plates');
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0; const idat = []; let plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || inter !== 0) throw new Error(`unsupported PNG (depth ${depth}, interlace ${inter})`);
  const ch = { 6: 4, 2: 3, 0: 1, 4: 2, 3: 1 }[type]; const raw = inflateSync(Buffer.concat(idat)), stride = w * ch;
  const px = Buffer.alloc(h * stride); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (type === 6) px.copy(out, i * 4, i * 4, i * 4 + 4);
    else if (type === 2) { out[i * 4] = px[i * 3]; out[i * 4 + 1] = px[i * 3 + 1]; out[i * 4 + 2] = px[i * 3 + 2]; out[i * 4 + 3] = 255; }
    else if (type === 0) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i]; out[i * 4 + 3] = 255; }
    else if (type === 4) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i * 2]; out[i * 4 + 3] = px[i * 2 + 1]; }
    else { const k = px[i]; out[i * 4] = plte[k * 3]; out[i * 4 + 1] = plte[k * 3 + 1]; out[i * 4 + 2] = plte[k * 3 + 2]; out[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { w, h, rgba: out };
}
let n = 0;
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.png')) continue;
  const o = path.join(DIR, f.replace(/\.png$/, '.rgba'));
  if (existsSync(o)) continue;
  writeFileSync(o, decodePNG(readFileSync(path.join(DIR, f))).rgba); n++;
}
console.log(`unpacked ${n} plates into ${DIR}`);
