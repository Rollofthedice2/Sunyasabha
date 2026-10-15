"""Blender character body from a per-character SPEC (blender/specs/<NAME>.json, radii in metres for a 1.8 m figure) posed per frame from joint
positions, rendered as mannequin pose guides. Run headless:
  blender.exe -b -P analysis/blender/char_body.py -- SPEC_JSON POSE_JSON OUT_DIR [FRAME ...] [front|side|threeq] [handmask]
POSE_JSON: {'px_per_m': px per metre (rig px), 'frames': {key: {joint: [x, y, z]}}, optional 'windows': {key: [x0, y0, x1, y1]}, 'window', 'res'}
joints (rig px; x right, y down, z toward camera): hip/kn/an/heel/toe/sh/el/wr/kk _L/_R, waist, chest, neck, head, nose; optional per-frame
hand_L/hand_R (fist|relaxed|open|flat), hand_dir_L/R and hand_back_L/R (rig-px directions).
SPEC keys: colors{skin, top, bottom, shoes, hair, accent}; top{type: tank|crop, r{hem, belt, waist, chest, upt, scap}}; bottom{type: long|shorts,
r{pelvis, belt, hip, knee, ankle}}; arms{sh, bic, el, fore, wr, kk}; legs_skin{knee, calf, ankle}; neck; head{scale[x,y,z], hair: cap|buzz|braids,
braid_len}; shoes{w, len, top_above_ankle}; extras: wristbands (bool), belt (bool).
Optional SPEC keys: colors.metal, metal_forearm (L|R), top.loft / bottom.loft, head{pitch, face_marks, braid_r}, hands (default hand state),
hand_scale, hand_poses {state: [[mcp, pip, dip], spread, thumb_curl, [finger multipliers]?, thumb_out?]}, no_hands, no_head.
Output OUT_DIR/<NAME>_<view>_f<key>.png (transparent), Workbench + outline."""
import bpy, bmesh, json, sys, math, mathutils
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
SP = json.load(open(argv[0])); D = json.load(open(argv[1])); OUT = argv[2]
want = [a for a in argv[3:] if a not in ('front', 'side', 'threeq', 'handmask')]
# handmask: an extra pass per frame with the hands in flat red (L) / blue (R) and everything else black, rendered with the body (what the guide
# shows) and hands-only (the whole hand) -> <name>_handmask_f<key>.png and <name>_handsolo_f<key>.png; comparing the two pixel counts gives how
# much of each hand is visible in the guide
HM = 'handmask' in argv[3:]
HANDM = {}; VIEW = next((a for a in argv[3:] if a in ('front', 'side', 'threeq')), 'front')
K = 1.0 / D['px_per_m']; WINS = D.get('windows', {}); RES = D.get('res', 2.0); WIN = D.get('window', [0, 0, 1280, 720])
def V3(p): return Vector((p[0] * K, -p[2] * K, -p[1] * K))
def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0); return m
C = SP['colors']; SKIN, TOP, BOT, SHOE, HAIR = (mat(SP['name'] + '_' + k, C[k]) for k in ('skin', 'top', 'bottom', 'shoes', 'hair'))
ACC = mat(SP['name'] + '_accent', C.get('accent', C['hair']))
METAL = mat(SP['name'] + '_metal', C.get('metal', [0.72, 0.74, 0.78]))
# face marks are always near-black (in the hair colour they can vanish against the skin)
FACEM = mat(SP['name'] + '_facemarks', [0.02, 0.02, 0.025])
def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
def skin_obj(name, nodes, P, material):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); idx = {}
    for n, par, r in nodes: idx[n] = bm.verts.new(P[n])
    for n, par, r in nodes:
        if par: bm.edges.new((idx[n], idx[par]))
    bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN'); sk = me.skin_vertices[0].data
    for i, (n, par, r) in enumerate(nodes): sk[i].radius = r; sk[i].use_root = (par is None)
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    me.materials.append(material)
    for poly in me.polygons: poly.use_smooth = True
    return ob
def lerp(a, b, t): return a + (b - a) * t
def loft(name, rings, material, nv=24, caps=True):
    """Explicit tube through rings = [(centre, lateral axis, rx, rz)]: each ring an ellipse with rx along the body's own left-right axis (hip or
    shoulder line, made perpendicular to the spine) and rz front-back; rings joined, ends capped, subsurf 2, smooth. The SKIN modifier picks each
    cross-section's orientation itself, so an elliptical waist can turn its wide axis toward the camera and branch roots tear at a waistband; a
    loft keeps the orientation fixed."""
    bm = bmesh.new(); R = []
    for i, (c, lat, rx, rz) in enumerate(rings):
        t = (rings[min(i + 1, len(rings) - 1)][0] - rings[max(i - 1, 0)][0]).normalized()
        x = (lat - t * lat.dot(t)).normalized(); z = t.cross(x).normalized()
        R.append([bm.verts.new(c + x * (rx * math.cos(2 * math.pi * k / nv)) + z * (rz * math.sin(2 * math.pi * k / nv))) for k in range(nv)])
    for a, b in zip(R, R[1:]):
        for k in range(nv): bm.faces.new((a[k], a[(k + 1) % nv], b[(k + 1) % nv], b[k]))
    if caps:
        for ring, flip in ((R[0], True), (R[-1], False)):
            c = bm.verts.new(sum((v.co for v in ring), Vector()) / nv)
            for k in range(nv): bm.faces.new((c, ring[(k + 1) % nv], ring[k]) if flip else (c, ring[k], ring[(k + 1) % nv]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2; me.materials.append(material)
    for poly in me.polygons: poly.use_smooth = True
    return ob
def capsule(name, a, b, r, material):
    # a rounded segment from a to b (cylinder + two spheres), smooth shaded
    d = b - a; L = max(d.length, 1e-4); mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=16, location=mid); c = bpy.context.object
    c.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); c.data.materials.append(material); bpy.ops.object.shade_smooth()
    for e in (a, b):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=e, segments=16, ring_count=8); sp = bpy.context.object; sp.data.materials.append(material); bpy.ops.object.shade_smooth()
def rbox(name, c, M3, size, bev, material):
    # rounded box on an orthonormal frame M3 (columns = local x, y, z), size = full extents; the scale is applied before the bevel (an object
    # scale of ~0.1 would shrink the bevel to nothing) and one subsurf level keeps the palm soft
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); o = bpy.context.object; o.scale = Vector(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.matrix_world = mathutils.Matrix.LocRotScale(c, M3.to_quaternion(), Vector((1, 1, 1)))
    bv = o.modifiers.new('bev', 'BEVEL'); bv.width = bev; bv.segments = 3; bv.affect = 'EDGES'
    sb = o.modifiers.new('sub', 'SUBSURF'); sb.levels = 1; sb.render_levels = 1
    o.data.materials.append(material); bpy.ops.object.shade_smooth(); return o
# per hand state: finger flexion (deg) at MCP / PIP / DIP, finger spread (deg), thumb curl factor
HAND_POSES = {'fist': ((88, 100, 55), 0.0, 1.0), 'relaxed': ((28, 38, 22), 4.0, 0.35), 'open': ((8, 10, 6), 9.0, 0.1), 'flat': ((0, 0, 0), 2.0, 0.0)}
# SPEC hand_poses overrides these per character, e.g. {'relaxed': [[55, 70, 40], 2.0, 0.6]} = fingers clearly curled, thumb resting
HAND_POSES.update({k: (tuple(v[0]), v[1], v[2]) for k, v in SP.get('hand_poses', {}).items()})
# optional 4th entry per SPEC hand pose = per-finger flexion multipliers index / middle / ring / little (a resting hand curls more toward the
# little finger); default 1, 1, 1, 1
HAND_CASCADE = {k: tuple(v[3]) for k, v in SP.get('hand_poses', {}).items() if len(v) > 3}
# optional 5th entry = how far the thumb points out to the side (default 0.35: the thumb sticks out from the palm like a peg; ~0 lays it along
# the index finger, as in a resting hand)
HAND_THUMB = {k: float(v[4]) for k, v in SP.get('hand_poses', {}).items() if len(v) > 4}
def hand(s, P, A, material):
    """Anatomical hand on the hand frame (ax = wrist -> knuckles, nz = out of the BACK of the hand, the palm faces -nz, ny = ax x nz):
      - palm = rounded box ~0.098 x 0.084 x 0.030 m (x k = (wrist radius / 0.034)^0.6 per character), tapering knuckle row arched 4 mm;
      - four fingers of THREE phalanges (index, middle, ring, little lengths 0.92 / 1.0 / 0.95 / 0.78 of 46 / 29 / 23 mm), each joint flexed toward
        the palm by the state's MCP / PIP / DIP angles (fist 88 / 100 / 55: fingertips tuck into the palm; relaxed 28 / 38 / 22; open; flat);
      - thumb (metacarpal + two phalanges) on the ANATOMICAL thumb side: right hand -(ax x nz), left hand +(ax x nz); in a fist it lies across the
        front of the index and middle middle-phalanges.
    States per frame: pose keys hand_L / hand_R in fist | relaxed | open | flat (SPEC 'hands' default fist)."""
    wr, el = P['wr_' + s], P['el_' + s]; ax = (wr - el).normalized()
    # a braced/flat hand can point its own way (pose key hand_dir_L/R = rig-px direction, e.g. down the thigh); back of the hand to camera
    if s in HAND_DIR: ax = V3(HAND_DIR[s]) - V3([0.0, 0.0, 0.0]); ax = ax.normalized()
    side = (P['wr_' + s] - (P['hip_L'] + P['hip_R']) / 2); side.z = 0
    nz = (Vector((0, -1, 0)) * 0.6 + side.normalized() * 0.8 if side.length > 1e-6 else Vector((0, -1, 0)))
    # pose key hand_back_L/R = rig-px direction out of the BACK of the hand (the palm faces the opposite way), e.g. a high five
    if s in HAND_BACK: nz = V3(HAND_BACK[s]) - V3([0.0, 0.0, 0.0])
    nz = (nz - ax * nz.dot(ax)).normalized(); ny = ax.cross(nz).normalized()
    k = (A['wr'][0] / 0.034) ** 0.6 * SP.get('hand_scale', 1.0); style = HAND_STYLE.get(s, SP.get('hands', 'fist'))
    if style not in HAND_POSES: style = 'relaxed'
    (fm, fp, fd), spread, tcurl = HAND_POSES[style]
    cas = HAND_CASCADE.get(style, (1.0, 1.0, 1.0, 1.0))
    PL, PW, PT = 0.098 * k, 0.084 * k, 0.030 * k
    M3 = mathutils.Matrix((ax, ny, nz)).transposed()
    rbox(f'palm{s}', wr + ax * PL * 0.5, M3, (PL, PW, PT), PT * 0.45, material)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=wr + ax * PL * 0.08, segments=16, ring_count=8); wj = bpy.context.object
    wj.matrix_world = mathutils.Matrix.LocRotScale(wr + ax * PL * 0.08, M3.to_quaternion(), Vector((PL * 0.16, PW * 0.42, PT * 0.55))); wj.data.materials.append(material); bpy.ops.object.shade_smooth()
    thumb_dir = -1.0 if s == 'R' else 1.0; ty = ny * thumb_dir
    LEN = (0.92, 1.0, 0.95, 0.78); SEG = (0.046 * k, 0.029 * k, 0.023 * k); fr = 0.0098 * k
    tips = {}
    for i in range(4):
        # i = 0 index (thumb side) .. 3 little
        u = (1.5 - i) / 1.5; off = ty * PW * 0.36 * u; arch = -ax * 0.004 * k * abs(u) * 1.5
        k0 = wr + ax * PL * 0.98 + off + arch - nz * PT * 0.05
        d = (ax + ty * math.tan(math.radians(spread * u))).normalized(); pts = [k0]; ang = 0.0
        for j, fl in enumerate((fm, fp, fd)):
            ang += math.radians(fl * cas[i]); dj = (d * math.cos(ang) - nz * math.sin(ang)).normalized()
            pts.append(pts[-1] + dj * SEG[j] * LEN[i])
        for j in range(3):
            capsule(f'f{s}{i}{j}', pts[j], pts[j + 1], fr * (1.0 - 0.09 * j) * (0.9 if i == 3 else 1.0), material)
        tips[i] = pts
    # thumb: the METACARPAL lives inside the palm as the thenar pad (a flattened ellipsoid along the palm's thumb edge on the palm side); only
    # the two phalanges show, rooted at the pad's far end near mid-palm
    tb = wr + ax * PL * 0.18 + ty * PW * 0.30 - nz * PT * 0.30; m1 = wr + ax * PL * 0.55 + ty * PW * 0.58 - nz * PT * 0.45
    pc = (tb + m1) / 2; da = (m1 - tb).normalized(); db = nz.cross(da).normalized(); dc = da.cross(db).normalized()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=pc, segments=20, ring_count=10); th = bpy.context.object
    th.matrix_world = mathutils.Matrix.LocRotScale(pc, mathutils.Matrix((da, db, dc)).transposed().to_quaternion(), Vector(((m1 - tb).length * 0.75, PT * 0.75, PT * 0.62)))
    th.data.materials.append(material); bpy.ops.object.shade_smooth()
    if tcurl >= 0.99:
        # fist: proximal phalanx forward over the curled fingers, distal across the index + middle middle phalanges
        tgt = (tips[0][2] + tips[1][2]) / 2 - nz * fr * 1.5
        m2 = m1 + (ax * 0.7 - nz * 0.7).normalized() * 0.030 * k; m3 = m2 + (tgt - m2).normalized() * 0.026 * k
    else:
        d1 = (ax * 0.75 + ty * HAND_THUMB.get(style, 0.35) - nz * (0.25 + 0.5 * tcurl)).normalized()
        m2 = m1 + d1 * 0.031 * k; d2 = (d1 - ty * 0.25 * tcurl - nz * 0.4 * tcurl).normalized(); m3 = m2 + d2 * 0.025 * k
    capsule(f't{s}1', m1, m2, fr * 1.18, material); capsule(f't{s}2', m2, m3, fr * 1.05, material)
HAND_STYLE = {}; HAND_DIR = {}; HAND_BACK = {}
def build(J):
    clear(); P = {k: V3(v) for k, v in J.items()}; T, B, A, LS = SP['top'], SP['bottom'], SP['arms'], SP.get('legs_skin', {})
    hipc = (P['hip_L'] + P['hip_R']) / 2; P['pelvis'] = hipc + Vector((0, 0, 0.03))
    P['belt'] = lerp(P['waist'], hipc, 0.45); P['hem'] = lerp(P['waist'], hipc, 0.70); P['wband'] = lerp(P['waist'], hipc, 0.15)
    P['upt'] = lerp((P['sh_L'] + P['sh_R']) / 2, P['chest'], 0.25)
    for s in ('L', 'R'):
        P['scap_' + s] = lerp(P['chest'], P['sh_' + s], 0.80)
        P['bic_' + s] = lerp(P['sh_' + s], P['el_' + s], 0.45); P['fore_' + s] = lerp(P['el_' + s], P['wr_' + s], 0.30)
        P['ankb_' + s] = P['an_' + s] + Vector((0, 0, -0.02)); P['calf_' + s] = lerp(P['kn_' + s], P['an_' + s], 0.35)
        P['kntop_' + s] = lerp(P['hip_' + s], P['kn_' + s], 0.92)
    r = T['r']
    if T['type'] == 'crop':
        # crop top: chest band only; the midriff is skin (waist -> belt)
        # the top gets a hem node a third of the way to the waist so it overlaps the midriff (no gap between top and skin)
        P['cthem'] = lerp(P['chest'], P['waist'], 0.35)
        skin_obj('top', [('cthem', None, tuple(r['chest'])), ('chest', 'cthem', tuple(r['chest'])), ('upt', 'chest', tuple(r['upt'])), ('scap_L', 'upt', tuple(r['scap'])), ('scap_R', 'upt', tuple(r['scap']))], P, TOP)
        # the midriff runs from the trouser waistband into the crop top at full width
        if T.get('loft'):
            # SPEC top.loft: explicit loft oriented on the hip line (low rings) and shoulder line (chest ring), free of skin-modifier twist
            lh = P['hip_L'] - P['hip_R']; ls = P['sh_L'] - P['sh_R']; lw = (lh.normalized() + ls.normalized())
            loft('midriff', [(P['wband'], lh, r['belt'][0], r['belt'][1]), (P['belt'], lh, r['belt'][0], r['belt'][1]), (P['waist'], lw, r['waist'][0], r['waist'][1]),
                             (P['chest'], ls, r['chest'][0] * 0.98, r['chest'][1] * 0.98)], SKIN)
        else:
            skin_obj('midriff', [('wband', None, tuple(r['belt'])), ('belt', 'wband', tuple(r['belt'])), ('waist', 'belt', tuple(r['waist'])), ('chest', 'waist', (r['chest'][0] * 0.98, r['chest'][1] * 0.98))], P, SKIN)
    else:
        skin_obj('top', [('hem', None, tuple(r['hem'])), ('belt', 'hem', tuple(r['belt'])), ('waist', 'belt', tuple(r['waist'])), ('chest', 'waist', tuple(r['chest'])),
                         ('upt', 'chest', tuple(r['upt'])), ('scap_L', 'upt', tuple(r['scap'])), ('scap_R', 'upt', tuple(r['scap']))], P, TOP)
    rb = B['r']
    if B['type'] == 'shorts':
        skin_obj('bottom', [('pelvis', None, tuple(rb['pelvis'])), ('belt', 'pelvis', tuple(rb['belt'])), ('wband', 'belt', tuple(rb['belt'])),
                            ('hip_L', 'pelvis', tuple(rb['hip'])), ('kntop_L', 'hip_L', tuple(rb['knee'])), ('hip_R', 'pelvis', tuple(rb['hip'])), ('kntop_R', 'hip_R', tuple(rb['knee']))], P, BOT)
        for s in ('L', 'R'):
            skin_obj('leg_' + s, [('kntop_' + s, None, tuple(LS['knee'])), ('kn_' + s, 'kntop_' + s, tuple(LS['knee'])), ('calf_' + s, 'kn_' + s, tuple(LS['calf'])), ('ankb_' + s, 'calf_' + s, tuple(LS['ankle']))], P, SKIN)
    elif B.get('loft'):
        # SPEC bottom.loft: trouser seat + waistband as a loft on the hip line (a skin root at the pelvis tears a V into the waistband); each leg
        # its own skin chain from inside the seat
        lh = P['hip_L'] - P['hip_R']; P['seat'] = lerp(hipc, P['pelvis'], 0.5) + Vector((0, 0, -0.04))
        loft('bottom', [(P['seat'], lh, rb['pelvis'][0], rb['pelvis'][1]), (P['pelvis'], lh, rb['pelvis'][0], rb['pelvis'][1]), (P['belt'], lh, rb['belt'][0], rb['belt'][1]),
                        (P['wband'], lh, rb['belt'][0], rb['belt'][1])], BOT)
        for s in ('L', 'R'):
            P['hipin_' + s] = lerp(P['hip_' + s], hipc, 0.25)
            skin_obj('pleg_' + s, [('hipin_' + s, None, tuple(rb['hip'])), ('hip_' + s, 'hipin_' + s, tuple(rb['hip'])), ('kn_' + s, 'hip_' + s, tuple(rb['knee'])), ('ankb_' + s, 'kn_' + s, tuple(rb['ankle']))], P, BOT)
    else:
        skin_obj('bottom', [('pelvis', None, tuple(rb['pelvis'])), ('belt', 'pelvis', tuple(rb['belt'])), ('wband', 'belt', tuple(rb['belt'])),
                            ('hip_L', 'pelvis', tuple(rb['hip'])), ('kn_L', 'hip_L', tuple(rb['knee'])), ('ankb_L', 'kn_L', tuple(rb['ankle'])),
                            ('hip_R', 'pelvis', tuple(rb['hip'])), ('kn_R', 'hip_R', tuple(rb['knee'])), ('ankb_R', 'kn_R', tuple(rb['ankle']))], P, BOT)
    for s in ('L', 'R'):
        # upper arm and forearm are separate objects so a forearm can be a prosthetic (SPEC metal_forearm: 'L'|'R')
        fmat = METAL if SP.get('metal_forearm') == s else SKIN
        skin_obj('uarm_' + s, [('sh_' + s, None, tuple(A['sh'])), ('bic_' + s, 'sh_' + s, tuple(A['bic'])), ('el_' + s, 'bic_' + s, tuple(A['el']))], P, SKIN)
        skin_obj('farm_' + s, [('el_' + s, None, tuple(A['el'])), ('fore_' + s, 'el_' + s, tuple(A['fore'])), ('wr_' + s, 'fore_' + s, tuple(A['wr']))], P, fmat)
        # SPEC no_hands: the arm ends at the wrist (image models tend to copy a modelled hand; the hands then come from the prompt and a
        # real-hand reference)
        if not SP.get('no_hands'): hand(s, P, A, HANDM.get(s, fmat))
        if SP.get('extras', {}).get('wristbands'):
            bpy.ops.mesh.primitive_cylinder_add(radius=A['wr'][0] * 1.25, depth=0.06, location=lerp(P['fore_' + s], P['wr_' + s], 0.7)); wb = bpy.context.object
            wb.rotation_euler = (P['wr_' + s] - P['el_' + s]).to_track_quat('Z', 'Y').to_euler(); wb.data.materials.append(ACC)
    # SPEC no_head skips neck, head, hair, nose and face marks (e.g. for arm-only layers)
    if not SP.get('no_head'):
        skin_obj('neck', [('upt', None, (SP['neck'] * 1.1, SP['neck'])), ('neck', 'upt', (SP['neck'], SP['neck']))], P, SKIN)
        hd0, ns = P['head'], P['nose']; fwd = ns - hd0; fwd.z = 0; fwd = fwd.normalized() if fwd.length > 1e-6 else Vector((0, -1, 0))
        up = (P['head'] - P['neck']).normalized(); H = SP['head']; hd = P['neck'] + up * H['scale'][2] * 1.0
        rotz = math.atan2(fwd.x, -fwd.y)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=hd, segments=32, ring_count=16); h = bpy.context.object; h.scale = tuple(H['scale'])
        # opt-in head.pitch: the head also tilts up/down with the nose (Euler XYZ: pitch about local X first, then the turn about Z)
        f3 = (ns - hd0).normalized() if (ns - hd0).length > 1e-6 else fwd; pitch = math.asin(max(-0.9, min(0.9, f3.z))) if H.get('pitch') else 0.0
        h.rotation_euler = (-pitch, 0, rotz); h.data.materials.append(SKIN); bpy.ops.object.shade_smooth()
        if H.get('pitch'):
            side0 = fwd.cross(up).normalized(); fwd = (fwd * math.cos(pitch) + Vector((0, 0, 1)) * math.sin(pitch)).normalized(); up = side0.cross(fwd).normalized()
        hair = H.get('hair', 'cap')
        if hair in ('cap', 'buzz', 'braids', 'buzz_braid'):
            th = 0.6 if hair == 'buzz' else 1.0
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=hd + Vector((0, 0, 0.03 * th)) - fwd * 0.02, segments=32, ring_count=16); hr = bpy.context.object
            hr.scale = (H['scale'][0] * (1.02 + 0.06 * th), H['scale'][1] * (1.02 + 0.06 * th), H['scale'][2] * (0.78 + 0.05 * th)); hr.rotation_euler = h.rotation_euler
            hr.data.materials.append(HAIR); bpy.ops.object.shade_smooth()
        if hair in ('braids', 'bald_braid', 'buzz_braid'):
            # long braids: a ponytail mass from the crown down the back
            crown = hd + up * H['scale'][2] * 0.6 - fwd * H['scale'][1] * 0.7; tip = crown - up * H.get('braid_len', 0.75) - fwd * 0.08
            me = bpy.data.meshes.new('braids'); bm_ = bmesh.new(); a = bm_.verts.new(crown); m = bm_.verts.new(lerp(crown, tip, 0.5) - fwd * 0.05); b = bm_.verts.new(tip)
            bm_.edges.new((a, m)); bm_.edges.new((m, b)); bm_.to_mesh(me); bm_.free(); ob = bpy.data.objects.new('braids', me); bpy.context.collection.objects.link(ob)
            ob.modifiers.new('skin', 'SKIN'); sk = me.skin_vertices[0].data; br = H.get('braid_r', 1.0); sk[0].radius = (0.07 * br, 0.06 * br); sk[1].radius = (0.13 * br, 0.08 * br); sk[2].radius = (0.11 * br, 0.06 * br); sk[0].use_root = True
            ob.modifiers.new('sub', 'SUBSURF').levels = 2; me.materials.append(HAIR)
        bpy.ops.mesh.primitive_cone_add(radius1=0.02, depth=0.045, location=hd + fwd * (H['scale'][1] * 0.95) - Vector((0, 0, 0.012)))
        nz = bpy.context.object; nz.rotation_euler = fwd.to_track_quat('Z', 'Y').to_euler(); nz.data.materials.append(SKIN)
        # opt-in head.face_marks: small dark eyes, brows and a mouth line on the front of the head so the face direction is unmistakable at
        # any turn (a faceless head reads turns as more extreme than they are)
        if H.get('face_marks'):
            side = fwd.cross(up).normalized(); sy, sx, sz = H['scale'][1], H['scale'][0], H['scale'][2]
            for sg in (-1, 1):
                e = hd + fwd * (sy * 0.86) + side * (sg * sx * 0.38) + up * (sz * 0.10)
                bpy.ops.mesh.primitive_uv_sphere_add(radius=sx * 0.17, location=e, segments=12, ring_count=8); o = bpy.context.object; o.data.materials.append(FACEM)
                bpy.ops.mesh.primitive_cube_add(size=1, location=e + up * (sz * 0.16) + fwd * (sy * 0.03)); o = bpy.context.object
                o.scale = (sx * 0.40, sx * 0.06, sz * 0.05); o.rotation_euler = h.rotation_euler; o.data.materials.append(FACEM)
            bpy.ops.mesh.primitive_cube_add(size=1, location=hd + fwd * (sy * 0.88) - up * (sz * 0.38)); o = bpy.context.object
            o.scale = (sx * 0.50, sx * 0.06, sz * 0.05); o.rotation_euler = h.rotation_euler; o.data.materials.append(FACEM)
            # a clear nose wedge (the default cone is tiny at guide scale)
            bpy.ops.mesh.primitive_cone_add(radius1=sx * 0.22, depth=sy * 0.45, location=hd + fwd * (sy * 0.92) - up * (sz * 0.12)); o = bpy.context.object
            o.rotation_euler = fwd.to_track_quat('Z', 'Y').to_euler(); o.data.materials.append(SKIN)
    S = SP['shoes']
    # shoes: a skin-modifier last along heel -> instep -> ball -> rounded toe (low toe box, higher instep, heel counter), a collar around the
    # ankle up to top_above_ankle (boot shaft when > 0.08), and a thin flat sole slab slightly wider than the upper; all on the foot's own
    # heel -> toe line
    for s in ('L', 'R'):
        he, to, an = P['heel_' + s], P['toe_' + s], P['an_' + s]; floor = min(he.z, to.z)
        d = Vector((to.x - he.x, to.y - he.y, 0)); ln = max(d.length, 0.05); d = d.normalized(); L_ = max(S['len'], ln * 1.2)
        back = Vector((he.x, he.y, floor)) - d * (L_ - ln) * 0.25
        at = lambda u, h: back + d * (L_ * u) + Vector((0, 0, h))
        w2 = S['w'] / 2; top = S.get('top_above_ankle', 0.03); boot = top > 0.08
        # skin + subsurf shrinks a short chain to about half size, so the radii are x1.55 and the chain ends sit past heel and toe
        P['s_heel_' + s] = at(0.0, 0.06); P['s_inst_' + s] = at(0.40, 0.08); P['s_ball_' + s] = at(0.74, 0.05); P['s_toe_' + s] = at(1.0, 0.04)
        P['s_col_' + s] = Vector((an.x, an.y, max(an.z, floor + 0.08))) + Vector((0, 0, top * 0.55)) - d * 0.01
        k_ = 1.55
        nodes = [('s_heel_' + s, None, (w2 * 0.8 * k_, 0.055 * k_)), ('s_inst_' + s, 's_heel_' + s, (w2 * 0.92 * k_, 0.065 * k_)), ('s_ball_' + s, 's_inst_' + s, (w2 * k_, 0.045 * k_)),
                 ('s_toe_' + s, 's_ball_' + s, (w2 * 0.82 * k_, 0.034 * k_)), ('s_col_' + s, 's_inst_' + s, ((0.064 if boot else 0.054) * k_, (0.064 if boot else 0.052) * k_))]
        skin_obj('shoe_' + s, nodes, P, SHOE)
        c = back + d * (L_ * 0.5) + Vector((0, 0, 0.011)); M3 = mathutils.Matrix((d, Vector((-d.y, d.x, 0)), Vector((0, 0, 1)))).transposed()
        rbox('sole_' + s, c, M3, (L_ * 1.02, S['w'] * 1.06, 0.022), 0.008, SHOE)
def setup(win):
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_object_outline = True
    sh.object_outline_color = (0.05, 0.05, 0.06); sh.show_specular_highlight = False; sh.show_shadows = False
    sc.render.film_transparent = True; sc.render.resolution_x = int((win[2] - win[0]) * RES); sc.render.resolution_y = int((win[3] - win[1]) * RES)
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
def camera(win):
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co)
    if VIEW == 'front':
        cam.ortho_scale = max(win[2] - win[0], win[3] - win[1]) * K
        co.location = ((win[0] + win[2]) / 2 * K, -20.0, -(win[1] + win[3]) / 2 * K); co.rotation_euler = (math.radians(90), 0, 0)
    else:
        objs = [o for o in bpy.data.objects if o.type == 'MESH']; pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = (lo + hi) / 2; cam.ortho_scale = (hi.z - lo.z) * 1.15; ang = math.radians(90 if VIEW == 'side' else 40)
        co.location = (c.x + 20 * math.sin(ang), c.y - 20 * math.cos(ang), c.z); co.rotation_euler = (math.radians(90), 0, ang)
    bpy.context.scene.camera = co
keys = want or sorted(D['frames'], key=lambda k: D.get('times', {}).get(k, 0) if not k.replace('.', '').isdigit() else float(k))
for k in keys:
    fr_ = D['frames'][k]; HAND_STYLE.clear(); HAND_STYLE.update({sd: fr_[f'hand_{sd}'] for sd in ('L', 'R') if isinstance(fr_.get(f'hand_{sd}'), str)})
    HAND_DIR.clear(); HAND_DIR.update({sd: fr_[f'hand_dir_{sd}'] for sd in ('L', 'R') if f'hand_dir_{sd}' in fr_})
    HAND_BACK.clear(); HAND_BACK.update({sd: fr_[f'hand_back_{sd}'] for sd in ('L', 'R') if f'hand_back_{sd}' in fr_})
    win = WINS.get(k, WIN); setup(win); build({j: v for j, v in fr_.items() if not isinstance(v, str) and not j.startswith(('hand_dir', 'hand_back'))}); camera(win)
    bpy.context.scene.render.filepath = f"{OUT}/{SP['name']}_{VIEW}_f{k}.png"; bpy.ops.render.render(write_still=True)
    if HM:
        HANDM.update({'L': mat('HM_L', [1.0, 0.0, 0.0]), 'R': mat('HM_R', [0.0, 0.0, 1.0])}); clear()
        keep = {m: tuple(m.diffuse_color) for m in bpy.data.materials if m.name not in ('HM_L', 'HM_R')}
        for m in keep: m.diffuse_color = (0, 0, 0, 1)
        build({j: v for j, v in fr_.items() if not isinstance(v, str) and not j.startswith(('hand_dir', 'hand_back'))}); camera(win)
        sh = bpy.context.scene.display.shading; sh.light = 'FLAT'; sh.show_cavity = False; sh.show_object_outline = False
        bpy.context.scene.render.filepath = f"{OUT}/{SP['name']}_handmask_f{k}.png"; bpy.ops.render.render(write_still=True)
        for o in bpy.data.objects:
            if o.type == 'MESH' and not any(ms.material and ms.material.name in ('HM_L', 'HM_R') for ms in o.material_slots): o.hide_render = True
        bpy.context.scene.render.filepath = f"{OUT}/{SP['name']}_handsolo_f{k}.png"; bpy.ops.render.render(write_still=True)
        for m, c_ in keep.items(): m.diffuse_color = c_
        HANDM.clear(); clear()
print('rendered', len(keys))
