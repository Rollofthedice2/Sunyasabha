"""Parametric blockout of the hall, rendered from any camera, so a background plate follows one consistent geometry: long nave, arcades of clustered
pillars with pointed arches, aisle walls, the stage at the far end with steps, decks, two stone faces, the blue ring and braziers, and the entrance
end (central stair to a door, two more faces). Metres; Z up; hall axis = +Y toward the stage; floor z = 0; nave centred on x = 0.
Run: blender -b -P hall_blockout.py -- PARAMS_JSON OUT_PNG   (OUT_PNG absolute)
PARAMS: hall {nave_w, aisle_w, bay, n_bays, y0, pillar_r, cap_h, arch_h, stage_y, stage_h, stage_w, steps, wall_h, entrance?, stair_n?, eface?},
cam {x, y, z, yaw_deg, pitch_deg, hfov_deg, res [w, h], shift_y?}, marks (floor polylines [[x, y], ...] with rgb), figures ({x, y, h} standing-height bars), lines_only, grid, dj.
Examples: blender/examples/*.json"""
import bpy, json, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
P = json.load(open(argv[0])); OUT = argv[1]; Hh = P['hall']; Cm = P['cam']
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
def mat(n, rgb):
    m = bpy.data.materials.get(n) or bpy.data.materials.new(n); m.diffuse_color = (*rgb, 1.0); return m
LO = P.get('lines_only', False)
STONE = mat('stone', (0.95, 0.95, 0.95) if LO else (0.42, 0.40, 0.42)); FLOOR = mat('floor', (0.98, 0.98, 0.98) if LO else (0.18, 0.17, 0.19))
STAGE = mat('stage', (0.9, 0.9, 0.9) if LO else (0.28, 0.27, 0.30)); BLUE = mat('blue', (0.1, 0.4, 1.0)); FACE = mat('face', (0.8, 0.75, 0.65) if LO else (0.55, 0.47, 0.36))
DJM = mat('dj', (0.2, 0.2, 0.3)); MARKM = {}
def box(c, s, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o = bpy.context.object; o.scale = s; o.data.materials.append(m); return o
def cyl(c, r, h, m, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(c[0], c[1], c[2] + h / 2)); o = bpy.context.object; o.data.materials.append(m); return o
def tube(pts, r, m):
    cu = bpy.data.curves.new('arch', 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    cu.bevel_depth = r; cu.bevel_resolution = 2; o = bpy.data.objects.new('arch', cu); bpy.context.collection.objects.link(o); o.data.materials.append(m); return o
W, AW, BAY, NB, Y0 = Hh['nave_w'], Hh['aisle_w'], Hh['bay'], Hh['n_bays'], Hh['y0']; PR, CAP, ARCH = Hh['pillar_r'], Hh['cap_h'], Hh['arch_h']
SY, SH, SW = Hh['stage_y'], Hh['stage_h'], Hh['stage_w']; WALL = Hh.get('wall_h', 18.0)
FY0 = min(Y0, Cm['y']) - 12
box((0, (FY0 + SY + 8) / 2, -0.05), (W + 2 * AW + 4, SY + 8 - FY0, 0.1), FLOOR)
for sx in (-1, 1):
    x = sx * W / 2
    for i in range(NB + 1):
        y = Y0 + i * BAY
        if y > SY - 0.5: break
        cyl((x, y, 0), PR, CAP, STONE, 20); box((x, y, 0.4), (PR * 2.6, PR * 2.6, 0.8), STONE); box((x, y, CAP), (PR * 2.4, PR * 2.4, 0.5), STONE)
        if i < NB and y + BAY <= SY - 0.5:
            # pointed arch between this pillar and the next, in the arcade plane
            pts = []
            for k in range(13):
                t = k / 12; yy = y + t * BAY; rise = (ARCH - CAP) * (1 - (2 * t - 1) ** 2) ** 0.55
                pts.append((x, yy, CAP + rise))
            tube(pts, 0.35, STONE)
    box((sx * (W / 2 + AW), (Y0 + SY) / 2, WALL / 2), (0.6, SY - Y0, WALL), STONE)
    tube([(sx * W / 2, Y0, ARCH + 0.4), (sx * W / 2, SY, ARCH + 0.4)], 0.25, STONE)
box((0, SY + 4, WALL / 2), (W + 2 * AW, 0.6, WALL), STONE)
# stage: platform + steps toward the nave, decks, faces, ring, braziers, DJ seated on the decks
box((0, SY + 2, SH / 2), (SW, 4, SH), STAGE)
for k in range(Hh.get('steps', 4)):
    hstep = SH * (k + 1) / (Hh.get('steps', 4) + 1); box((0, SY - 0.35 * (Hh.get('steps', 4) - k), hstep / 2), (SW * 0.75, 0.35, hstep), STAGE)
# stage dressing: decks on the dais, the DJ seated cross-legged on the decks, the blue ring right behind the DJ (its lower edge about the DJ's
# shoulders), two giant stone faces flanking the ring with their chins near deck height, braziers at the dais corners
DK = SH + 1.1
box((0, SY + 1.6, SH + 0.55), (3.2, 1.0, 1.1), STAGE)
# 'dj': false leaves the decks unattended (an empty plate)
if P.get('dj', True):
    box((0, SY + 1.6, DK + 0.35), (0.8, 0.6, 0.7), DJM); bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(0, SY + 1.6, DK + 0.92)); bpy.context.object.data.materials.append(DJM)
box((0, SY + 1.45, DK + 0.12), (1.1, 0.8, 0.24), DJM)
RR = 1.6; RZ = DK + 0.55 + RR
bpy.ops.mesh.primitive_torus_add(major_radius=RR, minor_radius=0.09, location=(0, SY + 3.0, RZ), rotation=(math.radians(90), 0, 0)); bpy.context.object.data.materials.append(BLUE)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(sx * 3.6, SY + 3.2, DK + 2.0)); f = bpy.context.object; f.scale = (1.45, 1.2, 2.0); f.data.materials.append(FACE)
    cyl((sx * 2.3, SY + 0.9, SH), 0.3, 1.2, STAGE); bpy.ops.mesh.primitive_cone_add(radius1=0.28, depth=0.6, location=(sx * 2.3, SY + 0.9, SH + 1.5)); bpy.context.object.data.materials.append(BLUE)
# entrance end: back wall at y = Y0 - 4; one straight flight of stair_n steps on the hall axis rising away from the stage to a landing and a red
# door in the centre of the back wall, with railings on both sides
if Hh.get('entrance', True):
    BW = Y0 - 4; box((0, BW, WALL / 2), (W + 2 * AW, 0.6, WALL), STONE)
    n = Hh.get('stair_n', 18); rise = 0.24; run = 0.38; SW_ = 4.2; foot = BW + 0.3 + n * run + 2.0
    for k in range(n):
        yk = foot - (k + 0.5) * run; box((0, (yk + BW) / 2, rise * (k + 1) / 2), (SW_, run, rise * (k + 1)), STAGE)
        box((0, yk, rise * (k + 1) / 2), (SW_, run, rise * (k + 1)), STAGE)
    box((0, BW + 1.15, n * rise / 2), (SW_, 2.0, n * rise), STAGE)
    for sx in (-1, 1):
        o = box((sx * (SW_ / 2 + 0.1), (foot + BW + 1.0) / 2, n * rise / 2 + 0.6), (0.12, foot - BW - 1.0, 0.1), STONE); o.rotation_euler = (math.atan2(n * rise, n * run), 0, 0)
    box((0, BW + 0.32, n * rise + 1.8), (2.0, 0.1, 3.6), mat('door', (0.8, 0.15, 0.15)))
    # two giant carved heads on the back wall, one each side of the door, each set just inside its colonnade so the pillar rows frame them;
    # hall 'eface' {x, z, rx, rz} overrides their place and size (e.g. lower and closer, flanking the door at its own height)
    EF = Hh.get('eface', {'x': W / 2 - 3.0, 'z': 9.5, 'rx': 2.4, 'rz': 3.2})
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(sx * EF['x'], BW + 0.9, EF['z'])); f = bpy.context.object; f.scale = (EF['rx'], 1.0, EF['rz']); f.data.materials.append(FACE)
GRID = mat('grid', (0.75, 0.75, 0.75))
if P.get('grid', True):
    for gx in range(-int(W / 2 + AW), int(W / 2 + AW) + 1, 2): box((gx, (FY0 + SY) / 2, 0.005), (0.03, SY - FY0, 0.01), GRID)
    for gy in range(int(FY0), int(SY), 2): box((0, gy, 0.005), (W + 2 * AW, 0.03, 0.01), GRID)
for mk in P.get('marks', []):
    m = MARKM.setdefault(tuple(mk['rgb']), mat('mk%d' % len(MARKM), tuple(mk['rgb']))); pts = mk['pts']
    for a, b in zip(pts[:-1], pts[1:]):
        ax_, ay_ = a; bx_, by_ = b; L = math.hypot(bx_ - ax_, by_ - ay_); o = box(((ax_ + bx_) / 2, (ay_ + by_) / 2, 0.01), (L, mk.get('w', 0.08), 0.02), m)
        o.rotation_euler = (0, 0, math.atan2(by_ - ay_, bx_ - ax_))
for fg in P.get('figures', []):
    o = box((fg['x'], fg['y'], fg['h'] / 2), (0.45, 0.3, fg['h']), mat('fig_%s' % '_'.join(str(c) for c in fg.get('rgb', (0.5, 0.5, 0.5))), tuple(fg.get('rgb', (0.5, 0.5, 0.5)))))
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'
sh.show_object_outline = True; sh.object_outline_color = (0, 0, 0); sh.show_cavity = not LO; sh.show_shadows = False
sc.render.resolution_x, sc.render.resolution_y = Cm['res']; sc.render.film_transparent = False; sc.world = sc.world or bpy.data.worlds.new('w')
cam = bpy.data.cameras.new('cam'); cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(Cm['hfov_deg']); co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co)
co.location = (Cm['x'], Cm['y'], Cm['z']); co.rotation_euler = (math.radians(90 + Cm.get('pitch_deg', 0)), 0, math.radians(Cm['yaw_deg']))
cam.shift_y = Cm.get('shift_y', 0.0); cam.clip_end = 300
sc.camera = co; sc.render.filepath = OUT; bpy.ops.render.render(write_still=True); print('rendered', OUT)
