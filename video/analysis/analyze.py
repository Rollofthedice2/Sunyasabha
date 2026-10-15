"""Audio analysis of the song and its stems (librosa): tempo, beat grid, downbeats, per-stem energy envelopes, vocal phrases.
Writes ../data/audio.json, 30 Hz stem envelopes ../data/envelopes.json and a QA plot ../data/overview.png. Usage: python analyze.py"""
import json
from pathlib import Path

import librosa
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
STEMS = ROOT / "Stems"
OUT = Path(__file__).resolve().parents[1] / "data"
SR = 22050
HOP = 512
FPS = SR / HOP

STEM_FILES = {
    "lead": "0 Lead Vocals.wav",
    "backing": "1 Backing Vocals.wav",
    "drums": "2 Drums.wav",
    "bass": "3 Bass.wav",
    "guitar": "4 Guitar.wav",
    "keys": "5 Keyboard.wav",
    "perc": "6 Percussion.wav",
    "synth": "7 Synth.wav",
    "other": "8 Other.wav",
}


def load(name):
    y, _ = librosa.load(STEMS / STEM_FILES[name], sr=SR, mono=True)
    return y


def rms_db(y):
    r = librosa.feature.rms(y=y, hop_length=HOP)[0]
    return librosa.amplitude_to_db(r, ref=1.0)


def main():
    stems = {k: load(k) for k in STEM_FILES}
    n = min(len(y) for y in stems.values())
    stems = {k: y[:n] for k, y in stems.items()}
    mix = sum(stems.values())
    dur = n / SR

    # Beat grid from drums + percussion
    drums = stems["drums"] + stems["perc"]
    onset = librosa.onset.onset_strength(y=drums, sr=SR, hop_length=HOP)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=HOP, units="frames")
    tempo = float(np.atleast_1d(tempo)[0])
    beat_t = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)

    # Refine: fit a constant-tempo grid to the tracked beats (Suno songs are fixed-tempo)
    idx = np.arange(len(beat_t))
    period, offset = np.polyfit(idx, beat_t, 1)
    resid = beat_t - (offset + period * idx)
    keep = np.abs(resid) < 0.05
    period, offset = np.polyfit(idx[keep], beat_t[keep], 1)
    while offset - period > 0:
        offset -= period
    grid = offset + period * np.arange(int((dur - offset) / period) + 1)
    bpm = 60 / period

    # Downbeat phase: kick-band energy summed per phase of 4
    S = np.abs(librosa.stft(stems["drums"], hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=SR)
    low = S[freqs < 120].sum(axis=0)
    gf = np.clip(librosa.time_to_frames(grid, sr=SR, hop_length=HOP), 0, len(low) - 1)
    bass_on = rms_db(stems["bass"])
    scores = []
    for ph in range(4):
        sel = gf[ph::4]
        scores.append(float(low[sel].mean() + 0.5 * np.exp(bass_on[sel] / 20).mean()))
    phase = int(np.argmax(scores))
    downbeats = grid[phase::4]

    # Stem energies per beat (dB) for a coarse arrangement map
    env = {k: rms_db(y) for k, y in stems.items()}
    t_frames = librosa.frames_to_time(np.arange(len(env["lead"])), sr=SR, hop_length=HOP)

    # Vocal phrases: lead vocal activity with hysteresis, gaps < 0.25 s bridged
    lv = env["lead"]
    lv_s = np.convolve(lv, np.ones(5) / 5, mode="same")
    thr = np.percentile(lv_s, 60) - 6
    active = lv_s > thr
    phrases = []
    i = 0
    while i < len(active):
        if active[i]:
            j = i
            while j < len(active) and active[j]:
                j += 1
            phrases.append([t_frames[i], t_frames[min(j, len(t_frames) - 1)]])
            i = j
        else:
            i += 1
    merged = []
    for a, b in phrases:
        if merged and a - merged[-1][1] < 0.25:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    merged = [p for p in merged if p[1] - p[0] > 0.2]

    # Vocal syllable onsets
    v_on = librosa.onset.onset_detect(y=stems["lead"], sr=SR, hop_length=HOP, units="time", backtrack=True)

    # Structural novelty on the mix (chroma + mfcc), boundaries snapped to downbeats
    chroma = librosa.feature.chroma_cqt(y=mix, sr=SR, hop_length=HOP)
    mfcc = librosa.feature.mfcc(y=mix, sr=SR, hop_length=HOP, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
    bf = np.clip(librosa.time_to_frames(downbeats, sr=SR, hop_length=HOP), 0, feat.shape[1] - 1)
    bar_feat = librosa.util.sync(feat, bf, aggregate=np.median)
    R = librosa.segment.recurrence_matrix(bar_feat, mode="affinity", sym=True)
    # checkerboard novelty
    k = 4
    kern = np.kron(np.array([[1, -1], [-1, 1]]), np.ones((k, k)))
    Rp = np.pad(R, k)
    nov = np.array([(Rp[i:i + 2 * k, i:i + 2 * k] * kern).sum() for i in range(R.shape[0])])
    peaks = librosa.util.peak_pick(nov, pre_max=3, post_max=3, pre_avg=4, post_avg=4, delta=0.1, wait=4)
    bounds = [float(downbeats[min(p, len(downbeats) - 1)]) for p in peaks]

    # Per-bar stem energy table
    bars = []
    for bi, t0 in enumerate(downbeats):
        t1 = downbeats[bi + 1] if bi + 1 < len(downbeats) else dur
        m = (t_frames >= t0) & (t_frames < t1)
        bars.append({"i": bi, "t": round(float(t0), 3),
                     **{k: round(float(np.percentile(env[k][m], 90)), 1) for k in env}})

    data = {
        "duration": dur,
        "bpm": bpm,
        "beat_period": period,
        "grid_offset": float(grid[0]),
        "downbeat_phase": phase,
        "beats": [round(float(t), 4) for t in grid],
        "downbeats": [round(float(t), 4) for t in downbeats],
        "vocal_phrases": [[round(a, 3), round(b, 3)] for a, b in merged],
        "vocal_onsets": [round(float(t), 3) for t in v_on],
        "novelty_bounds": bounds,
        "bars": bars,
    }
    (OUT / "audio.json").write_text(json.dumps(data, indent=1))

    # Envelopes at 30 Hz for the renderer
    env_t = np.arange(0, dur, 1 / 30)
    envs = {k: np.round(np.interp(env_t, t_frames, env[k]), 1).tolist() for k in env}
    (OUT / "envelopes.json").write_text(json.dumps({"rate": 30, **envs}))

    # QA plot
    fig, axes = plt.subplots(len(env) + 1, 1, figsize=(40, 2 * (len(env) + 1)), sharex=True)
    for ax, (k, e) in zip(axes, env.items()):
        ax.plot(t_frames, e, lw=0.5)
        ax.set_ylabel(k)
        ax.set_ylim(-60, 0)
        for d in downbeats:
            ax.axvline(d, color="k", lw=0.2, alpha=0.4)
        for b in bounds:
            ax.axvline(b, color="r", lw=1.5)
    for a, b in merged:
        axes[0].axvspan(a, b, color="orange", alpha=0.3)
    m_ = min(len(downbeats), len(nov)); axes[-1].plot(downbeats[:m_], nov[:m_])
    axes[-1].set_ylabel("novelty")
    axes[-1].set_xticks(np.arange(0, dur, 5))
    plt.tight_layout()
    fig.savefig(OUT / "overview.png", dpi=50)

    print(f"dur={dur:.2f}s bpm={bpm:.3f} first_beat={grid[0]:.3f} phase={phase} scores={np.round(scores,1)}")
    print(f"bars={len(downbeats)} phrases={len(merged)} bounds={np.round(bounds,2).tolist()}")


if __name__ == "__main__":
    main()
