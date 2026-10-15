"""Credits audio: under the first three credit screens, the chorus and break (song 45.37-66.0) from the stems without vocals, about 14 dB under the
song's chorus level, with a 1.2 s fade-in and a long equal-power fade-out; a short silence; then a single struck singing bowl as the last page
arrives; everything fades with the picture at the end. Timing from data/credits.json.
Writes out/audio/soundtrack_credits_v1.wav = the film soundtrack + the credits. Usage: python credits_audio.py"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
V = Path(__file__).resolve().parents[1]; ROOT = V.parent; SR = 48000; FILM_END = 187.27
C = json.loads((V / 'data/credits.json').read_text())
def load(p):
    a = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(p), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    return a.reshape(-1, 2).astype(np.float64)
film = load(V / 'out/audio/soundtrack_sfx_v4.wav'); n0 = int(FILM_END * SR)
film = np.vstack([film, np.zeros((max(0, n0 - len(film)), 2))])[:n0]
S0, S1 = 45.37, 66.0
stems = [load(ROOT / 'Stems' / f) for f in ('2 Drums.wav', '3 Bass.wav', '4 Guitar.wav', '5 Keyboard.wav', '6 Percussion.wav', '7 Synth.wav', '8 Other.wav')]
bed = sum(s[int(S0 * SR):int(S1 * SR)] for s in stems)
song_chorus = load(ROOT / 'शून्यसभा ŚŪNYASABHĀ (The Assembly of Emptiness).wav')[int(S0 * SR):int(S1 * SR)]
rms = lambda x: float(np.sqrt(np.mean(x ** 2)) + 1e-12)
bed *= (rms(song_chorus) / rms(bed)) * 10 ** (-14 / 20)
BED_END = C['bed_end']; L = int(C['length'] * SR); out = np.zeros((L, 2))
nb = min(len(bed), int(BED_END * SR)); bed = bed[:nb]
t = np.arange(nb) / SR; g = np.minimum(1, t / 1.2)
fo0 = BED_END - C['bed_fade']; u = np.clip((t - fo0) / C['bed_fade'], 0, 1); g *= np.cos(u * np.pi / 2) ** 1.6
out[:nb] += bed * g[:, None]
bell = load(V / 'out/audio/credits_bell_once.wav'); bell *= 10 ** (-7 / 20)
b0 = int(C['bell_at'] * SR); e = min(L, b0 + len(bell)); out[b0:e] += bell[:e - b0]
# the very end: everything fades with the picture (equal-power)
f0, f1 = C['end_fade']; tt = np.arange(L) / SR; ue = np.clip((tt - f0) / (f1 - f0), 0, 1); out *= (np.cos(ue * np.pi / 2) ** 2)[:, None]
mix = np.vstack([film, out]); pk = float(np.abs(mix).max())
if pk > 0.99: mix *= 0.99 / pk
with wave.open(str(V / 'out/audio/soundtrack_credits_v1.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
db = lambda x: round(20 * np.log10(rms(x)), 1)
print('bed rms', db(out[int(2 * SR):int(15 * SR)]), 'dBFS | song chorus rms', db(song_chorus), '| bell peak', round(20 * np.log10(np.abs(bell).max()), 1),
      '| silence', C['bed_end'], '->', C['bell_at'], '| total', round(len(mix) / SR, 2), 's')
