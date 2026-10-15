"""Casting continuum text for every image request that paints people: a varied crowd of humans, subtly augmented people, cyborgs, androids and the
occasional robot, in ordinary club clothes, with a cast reference image for variety (never for layout). request_lint.py checks requests carry it."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; ECROWD = ROOT / 'refs/cast/E_crowd_ring_assembled_v2_master.png'
CAST = ('CAST like the cast reference (varied, colourful, many builds, ages, genders and skin tones): mostly humans in varied club clothes - jeans, slip dresses, '
        'oversized tees, mesh tops, skirts, cargo pants, sneakers, platform boots, bright and pastel colours as well as black (some leather or fishnet, MOST NOT; no '
        'harnesses, no studded leather vests, no bodybuilders in black tank tops); several with subtle augmentation (thin seam lines, a prosthetic forearm, an optic '
        'implant glint), two or three overtly cyborg, and one android. No duplicated people.')
MARK = 'CAST like the cast reference'
