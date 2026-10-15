"""Review gate for a clip before it is shown to a reviewer. Builds static evidence in out/t_redo/gate/<clip>/: (1) contact strips sampling the
whole clip (every 2nd frame for clips, one per second for a full film) and (2) a flicker scan (triplet pop score; frames above median + 4 MAD
shown at half size). It records a pass only after the sheets are opened and --confirm states what was checked (stored with the mp4's sha256).
Watching the clip play is still the judgement of motion. Frames are streamed, so a full film fits in memory.
Usage: python review_gate.py <mp4>   then   python review_gate.py <mp4> --confirm "<what you checked and saw>"
"""
import hashlib, json, subprocess, sys, glob
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
V = Path(__file__).resolve().parents[1]; ROOT = V.parent
mp4 = Path(sys.argv[1]).resolve(); stem = mp4.stem; G = V / 'out/t_redo/gate' / stem; G.mkdir(parents=True, exist_ok=True)
sha = hashlib.sha256(mp4.read_bytes()).hexdigest()
arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
if '--confirm' in sys.argv:
    need = sorted(G.glob('*.png'))
    if not need: sys.exit('gate: no evidence built for this clip - run without --confirm first')
    note = arg('--confirm') or ''
    if len(note) < 20: sys.exit('gate: write what you checked and saw (>= 20 chars)')
    (V / 'out/t_redo/gate' / f'{stem}.ok').write_text(json.dumps({'sha256': sha, 'evidence': [p.name for p in need], 'note': note}, indent=1))
    print('gate PASS recorded for', mp4.name); sys.exit(0)
# frames are streamed from ffmpeg; only small strip thumbnails and the last three luminance frames are kept. Clips (<= 1200 frames) get
# every-2nd-frame strips; longer inputs (a full film) get one strip frame per second, and the flicker scan runs over every frame. Old evidence
# sheets are cleared first so --confirm sees only this run's.
for f in G.glob('*.png'): f.unlink()
pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate', '-of', 'json', str(mp4)], capture_output=True, text=True)
st = json.loads(pr.stdout)['streams'][0]; W, H = int(st['width']), int(st['height']); NF = int(st.get('nb_frames') or 0)
num, den = (int(x) for x in st['r_frame_rate'].split('/')); FPS = num / den
step = 2 if NF <= 1200 else max(2, int(round(FPS)))
tw, th = W // 3, H // 3; sw, sh = W // 2, H // 2
proc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', str(mp4), '-vf', f'scale={sw}:{sh}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
thumbs = []; Lw = []; pop = []; dd = lambda a, b: float(np.abs(a - b).mean()); n = 0
while True:
    buf = proc.stdout.read(sw * sh * 3)
    if len(buf) < sw * sh * 3: break
    a = np.frombuffer(buf, np.uint8).reshape(sh, sw, 3)
    if n % step == 0: thumbs.append((n, Image.fromarray(a).resize((tw, th))))
    Lw.append(a.mean(2)); Lw = Lw[-3:]
    if len(Lw) == 3: pop.append(dd(Lw[1], Lw[0]) + dd(Lw[1], Lw[2]) - dd(Lw[0], Lw[2]))
    n += 1
proc.wait(); pop = np.array([0.0] + pop + [0.0])[:n]
# 1. at-speed strips: 6 per row, 1/3 scale, 36 per sheet
for part in range(0, len(thumbs), 36):
    chunk = thumbs[part:part + 36]; o = Image.new('RGB', (6 * tw, ((len(chunk) + 5) // 6) * th)); d = ImageDraw.Draw(o)
    for j, (i, im) in enumerate(chunk):
        o.paste(im, ((j % 6) * tw, (j // 6) * th)); d.text(((j % 6) * tw + 4, (j // 6) * th + 4), f'{i}' if step == 2 else f'{i} ({i / FPS:.0f}s)', fill=(255, 255, 0))
    o.save(G / f'1_strip_{part // 36:02d}.png')
# 2. flicker: the 16 highest frames above median + 4 MAD, pulled back out of the file by index
thr = np.median(pop) + 4 * np.median(np.abs(pop - np.median(pop))); hot = [int(i) for i in np.nonzero(pop > max(thr, 1.0))[0]]
if hot:
    show = sorted(sorted(hot, key=lambda i: -pop[i])[:16]); sel = '+'.join(f'eq(n\\,{i})' for i in show)
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(mp4), '-vf', f"select='{sel}',scale={sw}:{sh}", '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    o = Image.new('RGB', (min(len(show), 4) * sw, ((len(show) + 3) // 4) * sh)); d = ImageDraw.Draw(o)
    for j, i in enumerate(show):
        seg = raw[j * sw * sh * 3:(j + 1) * sw * sh * 3]
        if len(seg) < sw * sh * 3: break
        o.paste(Image.fromarray(np.frombuffer(seg, np.uint8).reshape(sh, sw, 3)), ((j % 4) * sw, (j // 4) * sh)); d.text(((j % 4) * sw + 4, (j // 4) * sh + 4), f'frame {i} ({i / FPS:.2f}s) pop {pop[i]:.1f}', fill=(255, 80, 80))
    o.save(G / '2_flicker.png')
rep = {'mp4': str(mp4), 'sha256': sha, 'frames': n, 'strip_step': step, 'flicker_frames': hot}
(G / 'report.json').write_text(json.dumps(rep, indent=1))
print(json.dumps({k: v for k, v in rep.items() if k != 'sha256'}, indent=1))
print('EVIDENCE TO OPEN (all of it):'); [print(' ', p) for p in sorted(G.glob('*.png'))]
print(f'then: review_gate.py {mp4} --confirm "<what you checked and saw>"')
