"""Floor plan and cameras for one scene, placed in the hall blockout (blender/hall_blockout.py): a standing woman, five officers and a crouched
crowd in hall metres, rendered from a WIDE camera (toward the entrance) and its CLOSE reverse angle, plus empty-hall geometry guides for the image
model (refs/motion_references/guides/raidfloor/raidfloor_geometry_<CAM>.png). Edit HER, COPS and CAMS to stage another scene.
Usage: python raid_floor_layout.py   (needs Blender 4.x: on the PATH as 'blender', or set the BLENDER environment variable to its executable)"""
import json, math, os, subprocess
from pathlib import Path
V = Path(__file__).resolve().parents[1]; OUT = V / 'out/t_redo/raid_layout'; OUT.mkdir(parents=True, exist_ok=True)
BL = os.environ.get('BLENDER', 'blender')
HALL = json.loads((V / 'analysis/blender/examples/T_hall_REVERSE_clean.json').read_text())['hall']
# entrance faces as the hall-reverse background plate draws them (measured against the 2 m door): flanking the door at its height, 2.3 x 3.4 m
HALL['eface'] = {'x': 3.0, 'z': 6.1, 'rx': 1.15, 'rz': 1.7}
HER = (-1.5, 21.0)
# officers: A faces her from the stair side, B on her right flank, C behind her left (nearer the WIDE camera); D, E hold the stair foot
COPS = {'A': (-1.1, 19.0), 'B': (-3.8, 20.6), 'C': (1.3, 22.2), 'D': (1.3, 12.2), 'E': (-1.4, 12.6)}
# crowd: crouched / face-down patrons fill the floor between the arcades, about 1 m tall when crouched; leave the officers' few square metres
def crowd():
    out = []
    for gy in [y * 1.1 for y in range(12, 30)]:
        for gx in [x * 1.1 for x in range(-8, 9)]:
            jx = gx + 0.35 * math.sin(gx * 7.1 + gy * 3.3); jy = gy + 0.3 * math.cos(gx * 2.7 - gy * 5.1)
            if any(math.hypot(jx - p[0], jy - p[1]) < 0.9 for p in [HER, *COPS.values()]): continue
            out.append({'x': round(jx, 2), 'y': round(jy, 2), 'h': 0.95, 'rgb': [0.45, 0.32, 0.30]})
    return out
FIG = [{'x': HER[0], 'y': HER[1], 'h': 1.70, 'rgb': [0.85, 0.85, 0.9]}] + [{'x': p[0], 'y': p[1], 'h': 1.85, 'rgb': [0.1, 0.1, 0.12]} for p in COPS.values()]
def yaw_to(cx, cy, tx, ty):
    # camera looks along (-sin yaw, cos yaw) in this blockout
    dx, dy = tx - cx, ty - cy; return math.degrees(math.atan2(-dx, dy))
CAMS = {
    'WIDE': dict(x=1.0, y=29.0, z=2.4, yaw_deg=180.0, pitch_deg=3.0, hfov_deg=66),
    'CLOSE': None,
}
# over A's shoulder: behind A and to his -x side, so the camera->her line runs nearly down the hall axis (the stage end, heads and ring behind her)
# and A's shoulder breaks the screen-right frame edge (looking toward the stage +x is screen-RIGHT)
cx, cy = -1.9, 16.6
CAMS['CLOSE'] = dict(x=cx, y=cy, z=1.3, yaw_deg=yaw_to(cx, cy, *HER), pitch_deg=3.5, hfov_deg=28)
import shutil
GUIDES = V.parent / 'refs/motion_references/guides/raidfloor'; GUIDES.mkdir(parents=True, exist_ok=True)
for nm, cam in CAMS.items():
    # geometry guide for the painter: the empty hall only (no figures, no DJ), at the generator's canvas size
    p = {'hall': HALL, 'cam': {**cam, 'res': [1672, 941]}, 'lines_only': False, 'grid': True, 'dj': False, 'figures': [], 'marks': []}
    pj = OUT / f'raidfloor_geometry_{nm}.json'; pj.write_text(json.dumps(p, indent=1)); png = GUIDES / f'raidfloor_geometry_{nm}.png'
    subprocess.run([BL, '-b', '-P', str(V / 'analysis/blender/hall_blockout.py'), '--', str(pj), str(png)], capture_output=True, text=True)
    print('geometry', nm, png.exists())
for nm, cam in CAMS.items():
    for show_crowd in (False, True):
        p = {'hall': HALL, 'cam': {**cam, 'res': [1280, 720]}, 'lines_only': False, 'grid': True, 'dj': False,
             'figures': FIG + (crowd() if show_crowd else []), 'marks': []}
        tag = f'raid_layout_{nm}' + ('_crowd' if show_crowd else '')
        pj = OUT / f'{tag}.json'; pj.write_text(json.dumps(p, indent=1))
        r = subprocess.run([BL, '-b', '-P', str(V / 'analysis/blender/hall_blockout.py'), '--', str(pj), str(OUT / f'{tag}.png')], capture_output=True, text=True)
        print(tag, 'ok' if (OUT / f'{tag}.png').exists() else r.stdout[-800:] + r.stderr[-800:])
# screen x (0..1) of every figure in each camera, so nobody hides behind anybody by accident
def sx(cam, x, y):
    yw = math.radians(cam['yaw_deg']); fx, fy = -math.sin(yw), math.cos(yw); rx, ry = fy, -fx
    d = (x - cam['x']) * fx + (y - cam['y']) * fy; r = (x - cam['x']) * rx + (y - cam['y']) * ry
    return round(0.5 + r / d / (2 * math.tan(math.radians(cam['hfov_deg'] / 2))), 3), round(d, 1)
for nm, cam in CAMS.items(): print(nm, 'her', sx(cam, *HER), {k: sx(cam, *v) for k, v in COPS.items()})
print('her', HER, 'cops', COPS, 'close cam', CAMS['CLOSE'])
