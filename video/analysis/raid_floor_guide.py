"""Staging guide for an image edit: projects the floor plan of raid_floor_layout.py through the SAME camera onto a plate (the empty hall image
or the geometry render). White outlines = crouching people at true size for their floor spot (a sparse sample per depth row, so the painter sees the
size rule from near to far); yellow = the standing woman; cyan = officers; thin cyan lines = floor contact rows.
Usage: python raid_floor_guide.py CAM STATE [PLATE]   (CAM WIDE|CLOSE; STATE surround|entry) -> raidfloor_guide_<CAM>_<STATE>.png"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
V = Path(__file__).resolve().parents[1]; G = V.parent / 'refs/motion_references/guides/raidfloor'
CAM_NM, STATE = sys.argv[1], sys.argv[2]
P = json.loads((V / f'out/t_redo/raid_layout/raidfloor_geometry_{CAM_NM}.json').read_text())
plate = Image.open(sys.argv[3] if len(sys.argv) > 3 else G / f'raidfloor_geometry_{CAM_NM}.png').convert('RGB')
Wd, Ht = plate.size; cam = P['cam']
def rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
# Blender object rotation XYZ euler (90+pitch, 0, yaw): world = Rz @ Rx @ local; the camera looks down local -Z, +X right, +Y up
Rw = rz(math.radians(cam['yaw_deg'])) @ rx(math.radians(90 + cam.get('pitch_deg', 0)))
C0 = np.array([cam['x'], cam['y'], cam['z']]); fpx = (Wd / 2) / math.tan(math.radians(cam['hfov_deg']) / 2)
def proj(x, y, z):
    loc = Rw.T @ (np.array([x, y, z]) - C0)
    if loc[2] > -0.05: return None
    return (Wd / 2 + fpx * loc[0] / -loc[2], Ht / 2 - fpx * loc[1] / -loc[2] - cam.get('shift_y', 0) * Wd)
# her and the officers come from the one floor plan (raid_floor_layout.py)
src = (V / 'analysis/raid_floor_layout.py').read_text(encoding='utf-8')
HER = eval(src.split('HER = ')[1].split('\n')[0]); COPS = eval(src.split('COPS = ')[1].split('\n')[0])
if STATE == 'entry':
    # entry: all five officers have just come down the stair and hold its foot
    COPS = {'A': (-2.6, 12.9), 'B': (-1.3, 12.2), 'C': (0.0, 12.9), 'D': (1.3, 12.2), 'E': (2.6, 12.9)}
im = plate.copy(); d = ImageDraw.Draw(im)
def figure(x, y, h, w, col, lw):
    # billboard outline facing the camera: body capsule + head circle, from the floor contact up
    a = proj(x, y, 0.0); b = proj(x, y, h)
    if not a or not b: return
    hp = abs(a[1] - b[1]); half = hp * (w / h) / 2; head = hp * (0.24 / h) / 2 * 1.0
    cx = (a[0] + b[0]) / 2
    if a[1] < 0 or b[1] > Ht or cx < -half or cx > Wd + half: return
    d.rounded_rectangle([cx - half, b[1] + 2 * head, cx + half, a[1]], radius=max(2, half * 0.6), outline=col, width=lw)
    d.ellipse([cx - head, b[1], cx + head, b[1] + 2 * head], outline=col, width=lw)
lw = max(2, Wd // 600)
# sparse crowd samples: every other column on rows from near to far, avoiding the officers' and her few square metres
taken = [HER, *COPS.values()]
# rows run away from the camera: toward the entrance for WIDE (yaw ~180), toward the stage for CLOSE (yaw ~0), from 3 m out to the crowd's far edge
looks_to_stage = math.cos(math.radians(cam['yaw_deg'])) > 0
ys = (sorted({round(y, 1) for y in np.arange(cam['y'] + 3.0, P['hall']['stage_y'] - 3.0, 2.2)}) if looks_to_stage
      else sorted({round(y, 1) for y in np.arange(cam['y'] - 3.0, 12.5, -2.2)}, reverse=True))
for y in ys:
    row = []
    for x in np.arange(-8.0, 8.5, 2.6):
        xx = x + (0.9 if int(y * 10) % 2 else 0.0)
        if any(math.hypot(xx - p[0], y - p[1]) < 1.0 for p in taken): continue
        row.append(xx); figure(xx, y, 1.0, 0.65, (255, 255, 255), lw)
    if row:
        pa, pb = proj(min(row) - 0.4, y, 0.0), proj(max(row) + 0.4, y, 0.0)
        if pa and pb: d.line([pa, pb], fill=(0, 230, 255), width=max(1, lw // 2))
for k, (x, y) in COPS.items(): figure(x, y, 1.85, 0.6, (0, 230, 255), lw + 1)
figure(HER[0], HER[1], 1.70, 0.5, (255, 220, 0), lw + 1)
out = G / f'raidfloor_guide_{CAM_NM}_{STATE}.png'; im.save(out); print(out, im.size)
# sanity: the door's centre should project onto the red door of the geometry render
print('door centre px', proj(0, P['hall']['y0'] - 4 + 0.32, 18 * 0.24 + 1.8))
