"""Per 1/60 s: is the lead vocal sounding? Band 250-3500 Hz RMS (30 ms window) of the lead vocal stem, normalised by the local 95th percentile
(+-1.5 s) so quiet and loud phrases gate alike; voiced = > 0.10. The engine's lip sync relaxes an open vowel to a small mouth over silences inside
a syllable (stop closures, breaths). Writes data/lead_voiced.json {t0, fps, voiced: '0101...'}. Usage: python lead_voiced.py"""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy import signal
V = Path(__file__).resolve().parents[1]; ROOT = V.parent
sr, x = wavfile.read(ROOT / 'Stems/0 Lead Vocals.wav'); x = x.astype(np.float32); x = x.mean(1) if x.ndim > 1 else x
b = signal.sosfilt(signal.butter(4, [250, 3500], 'band', fs=sr, output='sos'), x).astype(np.float32)
hop = sr // 60; n = len(b) // hop; w = int(0.03 * sr)
pw = np.convolve(b.astype(np.float64) ** 2, np.ones(w) / w, 'same')[: n * hop].reshape(n, hop).mean(1); e = np.sqrt(pw)
k = 90; loc = np.array([np.percentile(e[max(0, i - k):i + k], 95) for i in range(0, n, 6)]); loc = np.repeat(loc, 6)[:n]
v = (e / np.maximum(loc, 1e-6 + 0.02 * e.max())) > 0.10
(V / 'data/lead_voiced.json').write_text(json.dumps({'src': 'analysis/lead_voiced.py', 't0': 0.0, 'fps': 60, 'voiced': ''.join('1' if q else '0' for q in v)}))
print(n, 'frames;', round(float(v.mean()) * 100, 1), '% voiced')
