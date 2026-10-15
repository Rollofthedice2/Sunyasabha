"""Composite a placed sequence of character drawings over a background plate at 30 fps for song frames 885-1022 (29.5-34.1 s): each frame holds
the nearest earlier drawing, with a soft contact shadow under whatever touches the floor and a faint wet-floor reflection (the figure flipped
about its lowest sole, blurred, peak alpha 0.28, faded with distance). Placement data: data/e_art_<TAG>.json; the plate can be overridden with
E_PLATE (path relative to the repository root). Writes out/e_redo/comp_<TAG>/NNNN.png and an mp4 with the song. Usage: python e_compose.py TAG"""
import json, sys, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
V = Path(__file__).resolve().parents[1]; ROOT = V.parent; tag = sys.argv[1]
C = json.loads((V / f'data/e_art_{tag}.json').read_text())['cells']; keys = sorted(C, key=lambda k: C[k]['t'])
import os
plate = Image.open(ROOT / os.environ.get('E_PLATE', 'refs/generated/big_picture/E_CROWD_B_v2_plate.png')).convert('RGBA').resize((1280, 720), Image.LANCZOS)
OUT = V / f'out/e_redo/comp_{tag}'; OUT.mkdir(parents=True, exist_ok=True); F0, NF = 885, 138; cache = {}
def sprite(k):
    if k not in cache:
        c = C[k]; im = Image.open(ROOT / c['src_png']).convert('RGBA'); cache[k] = im.resize((max(1, round(im.width * c['s'])), max(1, round(im.height * c['s']))), Image.LANCZOS)
    return cache[k]
for i in range(NF):
    f = F0 + i; cur = [k for k in keys if round(C[k]['t'] * 30) <= f]; k = cur[-1] if cur else keys[0]; c = C[k]; sp = sprite(k)
    x0, y0 = int(round(c['tx'])), int(round(c['ty'])); a = np.asarray(sp)[..., 3] > 40; ys, xs = np.nonzero(a); sole = ys.max()
    fr = plate.copy()
    # reflection: flip about the lowest sole, fade
    ref = sp.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(2)); ra = np.asarray(ref).astype(float); h = ra.shape[0]
    fade = np.clip(1 - np.arange(h) / (0.45 * h), 0, 1)[:, None] * 0.28; ra[..., 3] *= fade; ref = Image.fromarray(ra.astype(np.uint8), 'RGBA')
    fr.alpha_composite(ref, (x0, y0 + 2 * sole - (sp.height - 1) + 2)) if y0 + 2 * sole - (sp.height - 1) + 2 >= 0 else None
    # contact shadow under the lowest rows (the supporting boot(s))
    low = xs[ys >= sole - 0.03 * sp.height]; sh = Image.new('RGBA', fr.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    cx, w = x0 + (low.min() + low.max()) / 2, (low.max() - low.min()) * 0.75 + 18
    d.ellipse([cx - w / 2, y0 + sole - 6, cx + w / 2, y0 + sole + 8], fill=(0, 0, 0, 200)); fr.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)))
    fr.alpha_composite(sp, (x0, y0)); fr.convert('RGB').save(OUT / f'{i:04d}.png')
mp4 = V / f'out/bp3_f3/e_redo/E_comp_{tag}.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', str(OUT / '%04d.png'), '-ss', '29.5', '-i', str(ROOT / 'शून्यसभा ŚŪNYASABHĀ (The Assembly of Emptiness).wav'),
                '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-shortest', str(mp4)], check=True)
print(len(keys), 'drawings,', NF, 'frames ->', mp4)
