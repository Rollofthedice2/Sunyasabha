"""Composited frame sequence -> engine plates: frames (1280x720 PNGs, 30 fps, frame i at T0 + (i + 0.5)/30) become full-frame 640x360 plates
(BOX downscale, opaque) named f3_<TAG>_NNN in app/assets/plates plus an index f3_<TAG>.json {fps, t0, n}; scenes play them by time.
Usage: python f3_engine_plates.py FRAMES_DIR TAG [T0]   (T0 defaults to 108.759 s)"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
V = Path(__file__).resolve().parents[1]; OUT = V / 'app/assets/plates'
FD, TAG = Path(sys.argv[1]).resolve(), sys.argv[2]; T0 = float(sys.argv[3]) if len(sys.argv) > 3 else 108.759; fs = sorted(FD.glob('*.png'))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((640, 360), Image.BOX); a = np.dstack([np.asarray(im), np.full((360, 640), 255, np.uint8)])
    n = f'f3_{TAG}_{i:03d}'; (OUT / f'{n}.rgba').write_bytes(a.tobytes())
    (OUT / f'{n}.json').write_text(json.dumps({'w': 640, 'h': 360, 'src': f.relative_to(V.parent).as_posix(), 'bbox': [0, 0, 639, 359]}))
(OUT / f'f3_{TAG}.json').write_text(json.dumps({'fps': 30, 't0': T0, 'n': len(fs), 'src': FD.relative_to(V.parent).as_posix(), 'tool': 'analysis/f3_engine_plates.py'}))
print(len(fs), 'plates', f'f3_{TAG}_000..{len(fs) - 1:03d}')
