"""Credit screens: four centred screens, bone-white pixel type (Soft Type's Jersey fonts, SIL OFL, at their exact pixel grids, drawn 1-bit at the
film's native 640x360) on near-black, one small blue ring above each. Hierarchy by case and tracking: tracked capitals for headings, white names,
dim notes, steel-blue links. Default writes previews (out/t_redo/credits/); --install writes the engine plates credits_s1..s4 and data/credits.json.
Usage: python credits.py [--install]"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
V = Path(__file__).resolve().parents[1]; F = V / 'app/assets/fonts'; PL = V / 'app/assets/plates'; PV = V / 'out/t_redo/credits'; PV.mkdir(parents=True, exist_ok=True)
W, H = 640, 360
TITLE = ImageFont.truetype(str(F / 'Jersey20-Regular.ttf'), 68); BODY = ImageFont.truetype(str(F / 'Jersey10-Regular.ttf'), 19)
BONE, DIM, NOTE, LINK, RING = (232, 226, 216), (168, 162, 156), (112, 108, 112), (150, 178, 206), (96, 168, 255)
GITHUB = 'https://github.com/Rollofthedice2/Sunyasabha'
# line kinds: T title, H heading (tracked capitals), N name, S small connective, L link, X footnote; (kind, text, gap after in px)
S = {
    's1': [('T', 'ŚŪNYASABHĀ', 6), ('H', 'The Assembly of Emptiness', 24), ('L', 'https://suno.com/s/jnz54PjJ2BGD4zTJ', 0)],
    's2': [('H', 'Created in 14 days* by', 10), ('N', 'Claude Opus 5.5', 1), ('S', 'and', 1), ('N', 'GPT-Astra 6', 8), ('S', 'using', 1),
           ('N', 'GPT Image 2.5', 20), ('H', 'Initial prompting and substantial steered guidance by', 10), ('N', 'Rollofthedice', 1),
           ('S', '(Chance Chapman)', 18), ('X', '*and change', 0)],
    's3': [('H', 'Featuring', 10), ('N', 'Rey*', 4), ('L', 'https://bsky.app/profile/rey-notnecessarily.bsky.social', 16), ('X', "*I'm not telling where", 0)],
    's4': [('N', 'Homage to the World-Honored One.', 6), ('N', 'May attachment to fixed views subside.', 6),
           ('N', 'Wherever there is bondage, may there be liberation.', 26), ('L', 'https://rollofthedice2.substack.com/p/the-internal-logic-of-buddhism-is', 0)],
}
FOOT = {'s3': ('L', GITHUB)}
RING_R = {'s1': 9, 's2': 7, 's3': 7, 's4': 15}
COL = {'T': BONE, 'H': DIM, 'N': BONE, 'S': NOTE, 'L': LINK, 'X': NOTE}
def mask(kind, txt):
    # one text line as a 1-bit mask, letters advanced one by one so headings can be tracked (letter-spaced)
    f = TITLE if kind == 'T' else BODY
    if kind == 'H': txt = txt.upper()
    track = 3 if kind == 'H' else (4 if kind == 'T' else 0)
    adv = [f.getlength(c) for c in txt]; asc, desc = f.getmetrics()
    m = Image.new('L', (int(sum(adv) + track * len(txt)) + 8, asc + desc + 8), 0); d = ImageDraw.Draw(m); d.fontmode = '1'; x = 4
    for c, a in zip(txt, adv): d.text((x, 4), c, font=f, fill=255); x += a + track
    return m.crop(m.getbbox())
def screen(key):
    # fixed line pitch per kind (cropped masks would lose the leading): title 52, body 20 px
    lines = [(mask(k, t), COL[k], g + (52 if k == 'T' else 20)) for k, t, g in S[key]]
    rr = RING_R[key]; ring_h = 2 * rr + 18
    total = ring_h + sum(g for m, c, g in lines)
    y = (H - total) // 2 - (12 if key == 's3' else 0)
    img = np.zeros((H, W, 3), float); img[...] = (7, 7, 10)
    # the ring: a 1-px pixel circle with a faint halo
    cx, cy = W // 2, y + rr; yy, xx = np.mgrid[0:H, 0:W]; ra = (np.abs(np.hypot(xx - cx, yy - cy) - rr) < 0.6).astype(float)
    halo = np.asarray(Image.fromarray((ra * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), float) / 255
    for ch in range(3): img[..., ch] += halo * RING[ch] * 0.5; img[..., ch] = img[..., ch] * (1 - ra) + RING[ch] * ra * 0.9
    y += ring_h; placed = []
    for m, c, g in lines: placed.append((m, c, (W - m.width) // 2, y)); y += g
    if key in FOOT:
        k, t = FOOT[key]; m = mask(k, t); placed.append((m, COL[k], (W - m.width) // 2, H - 24 - m.height))
    for m, c, x, y0 in placed:
        a = np.zeros((H, W)); a[y0:y0 + m.height, x:x + m.width] = np.asarray(m) / 255
        for ch in range(3): img[..., ch] = img[..., ch] * (1 - a) + c[ch] * a
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), (cx, cy, rr)
rings = {}
for k in S:
    im, rings[k] = screen(k); im.resize((1280, 720), Image.NEAREST).save(PV / f'credits_{k}.png')
    if '--install' in sys.argv:
        arr = np.dstack([np.asarray(im), np.full((H, W), 255, np.uint8)])
        (PL / f'credits_{k}.rgba').write_bytes(arr.tobytes()); (PL / f'credits_{k}.json').write_text(json.dumps({'w': W, 'h': H, 'bbox': [0, 0, W - 1, H - 1], 'src': 'analysis/credits.py'}))
if '--install' in sys.argv:
    # timing in seconds after the credits start: each screen fades in and out over 'fade'; the song bed fades out by bed_end; ~1.6 s of silence;
    # the last page arrives and the bell strikes as it settles (bell_at) and rings ~15 s; picture and sound fade together over end_fade
    T = {'s1': [0.0, 5.6], 's2': [5.6, 14.0], 's3': [14.0, 20.6], 's4': [21.9, 39.0]}
    (V / 'data/credits.json').write_text(json.dumps({'screens': T, 'fade': 0.7, 'bed_end': 21.0, 'bed_fade': 4.0, 'bell_at': 22.6, 'end_fade': [36.0, 39.0],
                                                         'length': 39.0, 'ripple': {'dur': 3.2, 'grow': 70}, 'rings': rings, 'ring_rgb': RING}, indent=1))
print('previews ->', PV)
