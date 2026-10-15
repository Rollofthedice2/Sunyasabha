"""Sound-effects mix: the song plus effects from data/sfx_cues.json (times in song seconds; levels in dB RELATIVE to the song's own local loudness, so
effects sit inside the music). Sirens are band-limited and looped with crossfades under a slow gain envelope and a diffuse room tail; shots are
trimmed, high-passed and given a room; the bell is written separately for the credits. Sources and licences: refs/sfx/SOURCES.md (public domain/CC0).
Usage: python sfx_mix.py [OUTNAME.wav]   (written to out/audio; default soundtrack_sfx_v1.wav)"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
V = Path(__file__).resolve().parents[1]; ROOT = V.parent; SR = 48000; OUTD = V / 'out/audio'; OUTD.mkdir(parents=True, exist_ok=True)
SONG = ROOT / 'शून्यसभा ŚŪNYASABHĀ (The Assembly of Emptiness).wav'
CUES = json.loads((V / 'data/sfx_cues.json').read_text(encoding='utf-8'))
def load(p, ch=1):
    a = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(p), '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    return a.reshape(-1, ch).copy()
def db(x): return 10 ** (x / 20)
def onepole_lp(x, fc):
    # one-pole low-pass y[i] = (1-a) x[i] + a y[i-1], run by scipy's lfilter (a per-sample Python loop takes minutes on the full song)
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * fc / SR); return lfilter([1 - a], [1, -a], x, axis=0).astype(np.float32)
def lp(x, fc): return onepole_lp(onepole_lp(x, fc), fc)
def hp(x, fc): return x - lp(x, fc)
def room(x, t60, wet, seed=1):
    # simple diffuse tail: exponentially decaying noise IR (stereo decorrelated), convolved by FFT
    n = int(t60 * SR); rng = np.random.default_rng(seed); env = np.exp(-6.9 * np.arange(n) / n)
    ir = np.stack([rng.standard_normal(n) * env, rng.standard_normal(n) * env], 1).astype(np.float32); ir /= np.sqrt((ir ** 2).sum(0))
    m = x.mean(1); L = len(m) + n; F = np.fft.rfft(m, L)
    tail = np.stack([np.fft.irfft(F * np.fft.rfft(ir[:, c], L), L) for c in range(2)], 1).astype(np.float32)
    dry = np.zeros_like(tail); dry[:len(x)] = x if x.shape[1] == 2 else np.repeat(x, 2, 1)
    return dry * (1 - wet) + tail * wet
song = load(SONG, 2); N = len(song)
# local loudness: 0.5 s moving RMS by uniform_filter1d (running sum, linear time; a direct convolution over ~9 M samples is very slow)
from scipy.ndimage import uniform_filter1d
win = SR // 2; rms = np.sqrt(uniform_filter1d((song ** 2).mean(1).astype(np.float64), win, mode='constant')) + 1e-6
def local_rms(t0, t1): return float(np.median(rms[int(t0 * SR):int(t1 * SR)]))
mix = song.copy(); log = []
for c in CUES['cues']:
    kind = c['kind']; src = load(ROOT / c['file'], 1)
    if kind == 'siren':
        # distant: band-limited (outside the walls), looped with crossfades to cover the span, slow gain envelope from the keyframes
        t0, t1 = c['keys'][0][0], c['keys'][-1][0]; need = int((t1 - t0) * SR) + SR; x = hp(lp(src, c.get('lp', 2800)), c.get('hp', 350))[:, 0]
        xf = SR // 2; out = np.zeros(need, np.float32); pos = 0; fade = np.linspace(0, 1, xf, dtype=np.float32)
        while pos < need:
            seg = x.copy(); seg[:xf] *= fade; seg[-xf:] *= fade[::-1]; e = min(need, pos + len(seg)); out[pos:e] += seg[:e - pos]; pos += len(seg) - xf
        tt = t0 + np.arange(need) / SR; kt = [k[0] for k in c['keys']]; kg = [k[1] for k in c['keys']]
        # gain keyframes in dB relative to the song's local loudness
        g_rel = np.interp(tt, kt, kg)
        ref = local_rms(t0, t1); src_rms = float(np.sqrt(np.mean(x ** 2))) + 1e-9
        gain = np.where(g_rel <= -59, 0.0, db(g_rel) * ref / src_rms).astype(np.float32)
        y = room((out * gain)[:, None], 1.2, 0.35)[:need]
        a = int(t0 * SR); e = min(N, a + need); mix[a:e] += y[:e - a]; log.append(f"siren {t0}-{t1}s peak rel {max(kg)} dB")
    elif kind == 'shot':
        on = c.get('onset', 0.05); x = src[int(max(0, on - 0.01) * SR):int((on + c.get('len', 0.9)) * SR)]
        # tame the recorded tail; the room adds its own
        x = x * np.linspace(1, 0, len(x), dtype=np.float32)[:, None] ** 2
        x = hp(x, 120); y = room(x, c.get('t60', 1.6), c.get('wet', 0.45), seed=7)
        for i, t in enumerate(c['times']):
            ref = local_rms(t - 0.3, t + 0.3); pk = float(np.abs(y).max()) + 1e-9
            g = db(c['rel_db']) * ref / (float(np.sqrt(np.mean(y[:int(0.05 * SR)] ** 2))) + 1e-9)
            yy = y * g * (1.0 - 0.08 * i); a = int(t * SR); e = min(N, a + len(yy)); mix[a:e] += yy[:e - a]
        log.append(f"shots {c['times']} rel {c['rel_db']} dB")
    elif kind == 'bell':
        on = 0.05; x = src[int(on * SR):int((on + c.get('len', 20)) * SR)]; x = x * np.minimum(1, np.linspace(c.get('len', 20), 0, len(x)) / 3)[:, None]
        y = room(x, 2.5, 0.25, seed=3); y = y / (np.abs(y).max() + 1e-9) * db(-3)
        with wave.open(str(OUTD / 'credits_bell_once.wav'), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
        log.append(f"bell -> {OUTD / 'credits_bell_once.wav'} ({len(y) / SR:.1f}s)")
# never clip; keep the song's own peak level (soft-limit only the summed overshoot)
peak = float(np.abs(mix).max()); sp = float(np.abs(song).max())
if peak > sp: mix = np.where(np.abs(mix) > sp * 0.95, np.sign(mix) * (sp * 0.95 + (sp * 0.05) * np.tanh((np.abs(mix) - sp * 0.95) / (sp * 0.05))), mix)
import sys as _sys
# output file name in out/audio
OUTNAME = _sys.argv[1] if len(_sys.argv) > 1 else 'soundtrack_sfx_v1.wav'
with wave.open(str(OUTD / OUTNAME), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print('\n'.join(log)); print('->', OUTD / OUTNAME, f'song peak {20 * np.log10(sp):.1f} dBFS, mix peak {20 * np.log10(float(np.abs(mix).max())):.1f} dBFS')
