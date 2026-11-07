"""Build an original, rigged, animated zebra for Wildgrove Zoo and export it as GLB.

Run:  python3 build_zebra.py out_dir
Coordinates (Blender): +X forward, +Y left, +Z up. Units are game tiles (1 tile = 1 m here).
"""
import bpy, bmesh, math, sys, os, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else '.'
os.makedirs(OUT, exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

# ---------------------------------------------------------------- skeleton
# name: (position, skin radius x(width), radius y(height))
J = {
    'pelvis': ((-0.22, 0, 0.405), .108, .13),
    'loin':   ((-0.08, 0, 0.405), .112, .135),
    'belly':  ((0.06, 0, 0.395), .118, .145),
    'chest':  ((0.19, 0, 0.395), .108, .152),
    'withers':((0.27, 0, 0.455), .078, .11),
    'neck1':  ((0.335, 0, 0.55), .058, .098),
    'neck2':  ((0.395, 0, 0.64), .05, .082),
    'poll':   ((0.435, 0, 0.705), .046, .064),
    'head':   ((0.5, 0, 0.685), .05, .064),
    'muzzle': ((0.58, 0, 0.635), .04, .047),
    'nose':   ((0.625, 0, 0.612), .035, .037),
    'tail0':  ((-0.33, 0, 0.45), .022, .022),
    'tail1':  ((-0.37, 0, 0.38), .013, .013),
    'tail2':  ((-0.39, 0, 0.27), .011, .011),
    'tail3':  ((-0.395, 0, 0.21), .018, .018),
}
for s, sy in (('L', 1), ('R', -1)):
    J.update({
        f'fshoulder{s}': ((0.21, sy*.075, 0.36), .058, .078),
        f'felbow{s}':    ((0.225, sy*.078, 0.26), .04, .046),
        f'fknee{s}':     ((0.22, sy*.078, 0.16), .03, .032),
        f'ffet{s}':      ((0.225, sy*.078, 0.05), .024, .025),
        f'fhoof{s}':     ((0.238, sy*.078, 0.014), .029, .017),
        f'hhip{s}':      ((-0.21, sy*.075, 0.37), .068, .088),
        f'hstifle{s}':   ((-0.16, sy*.08, 0.27), .052, .06),
        f'hhock{s}':     ((-0.245, sy*.078, 0.165), .03, .034),
        f'hfet{s}':      ((-0.228, sy*.078, 0.05), .024, .025),
        f'hhoof{s}':     ((-0.215, sy*.078, 0.014), .029, .017),
        f'ear{s}0':      ((0.44, sy*.03, 0.74), .02, .014),
        f'ear{s}1':      ((0.43, sy*.055, 0.815), .008, .007),
    })
EDGES = [('pelvis','loin'),('loin','belly'),('belly','chest'),('chest','withers'),('withers','neck1'),('neck1','neck2'),
         ('neck2','poll'),('poll','head'),('head','muzzle'),('muzzle','nose'),
         ('pelvis','tail0'),('tail0','tail1'),('tail1','tail2'),('tail2','tail3')]
for s in 'LR':
    EDGES += [('chest',f'fshoulder{s}'),(f'fshoulder{s}',f'felbow{s}'),(f'felbow{s}',f'fknee{s}'),(f'fknee{s}',f'ffet{s}'),(f'ffet{s}',f'fhoof{s}'),
              ('pelvis',f'hhip{s}'),(f'hhip{s}',f'hstifle{s}'),(f'hstifle{s}',f'hhock{s}'),(f'hhock{s}',f'hfet{s}'),(f'hfet{s}',f'hhoof{s}'),
              ('poll',f'ear{s}0'),(f'ear{s}0',f'ear{s}1')]

names = list(J)
me = bpy.data.meshes.new('ZebraSkel')
me.from_pydata([J[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in EDGES], [])
body = bpy.data.objects.new('Zebra', me)
scene.collection.objects.link(body)
bpy.context.view_layer.objects.active = body
body.select_set(True)
sk = body.modifiers.new('skin', 'SKIN')
sk.branch_smoothing = .6
sk.use_smooth_shade = True
for i, n in enumerate(names):
    sv = me.skin_vertices[0].data[i]
    sv.radius = (J[n][1], J[n][2])
    sv.use_root = (n == 'pelvis')
sub = body.modifiers.new('sub', 'SUBSURF')
sub.levels = 2
sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier='skin')
bpy.ops.object.modifier_apply(modifier='sub')
zone = body.vertex_groups.new(name='smoothzone')
for v in me.vertices:
    x, y, z = v.co
    if -0.3 < x < 0.33 and z < 0.47:
        zone.add([v.index], 1.0 if z < 0.4 else (0.47 - z) / 0.07, 'REPLACE')
sm = body.modifiers.new('smooth', 'LAPLACIANSMOOTH'); sm.iterations = 14; sm.lambda_factor = 0.6; sm.use_volume_preserve = True; sm.vertex_group = 'smoothzone'
bpy.ops.object.modifier_apply(modifier='smooth')
body.vertex_groups.remove(body.vertex_groups['smoothzone'])

# sculpt-style shaping passes: belly sag, neck crest, mane ridge, flatten flanks slightly
bm = bmesh.new(); bm.from_mesh(me)
for v in bm.verts:
    x, y, z = v.co
    if -0.2 < x < 0.22 and z < 0.4:            # belly hangs a touch
        v.co.z -= 0.012 * math.cos((x - .01) / .21 * math.pi / 2)
    if 0.27 < x < 0.43 and z > 0.5 and abs(y) < 0.03:   # mane crest
        k = max(0, 1 - abs(y) / .03)
        v.co.z += 0.03 * k; v.co.x -= 0.01 * k
    if 0.45 < x < 0.6 and z > 0.62:            # flatter forehead/nasal line
        v.co.z -= 0.004
bm.to_mesh(me); bm.free()
me.update()
bpy.ops.object.shade_smooth()
print('verts', len(me.vertices), 'faces', len(me.polygons))

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new('ZebraRig')
rig = bpy.data.objects.new('ZebraRig', arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def P(n): return Vector(J[n][0])
def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name); b.head = head; b.tail = tail; b.roll = 0
    if parent: b.parent = eb[parent]; b.use_connect = connect
    return b
bone('root', Vector((0, 0, 0)), Vector((0, 0, .1)))
bone('hips', P('loin'), P('pelvis'), 'root')
bone('spine', P('loin'), P('belly'), 'root')
bone('chest', P('belly'), P('withers'), 'spine', True)
bone('neck1', P('withers'), P('neck2'), 'chest', True)
bone('neck2', P('neck2'), P('poll'), 'neck1', True)
bone('head', P('poll'), P('nose'), 'neck2', True)
bone('tail1', P('tail0'), P('tail1'), 'hips')
bone('tail2', P('tail1'), P('tail2'), 'tail1', True)
bone('tail3', P('tail2'), P('tail3') + Vector((0, 0, -.03)), 'tail2', True)
for s in 'LR':
    bone(f'ear{s}', P(f'ear{s}0'), P(f'ear{s}1'), 'head')
    bone(f'fUpper{s}', P(f'fshoulder{s}') + Vector((0, 0, .04)), P(f'felbow{s}'), 'chest')
    bone(f'fLower{s}', P(f'felbow{s}'), P(f'fknee{s}'), f'fUpper{s}', True)
    bone(f'fCannon{s}', P(f'fknee{s}'), P(f'ffet{s}'), f'fLower{s}', True)
    bone(f'fHoof{s}', P(f'ffet{s}'), P(f'fhoof{s}') + Vector((.01, 0, -.012)), f'fCannon{s}', True)
    bone(f'hUpper{s}', P(f'hhip{s}') + Vector((0, 0, .03)), P(f'hstifle{s}'), 'hips')
    bone(f'hLower{s}', P(f'hstifle{s}'), P(f'hhock{s}'), f'hUpper{s}', True)
    bone(f'hCannon{s}', P(f'hhock{s}'), P(f'hfet{s}'), f'hLower{s}', True)
    bone(f'hHoof{s}', P(f'hfet{s}'), P(f'hhoof{s}') + Vector((.01, 0, -.012)), f'hCannon{s}', True)
bpy.ops.object.mode_set(mode='OBJECT')

# bind with automatic (heat) weights
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
empty_groups = [g.name for g in body.vertex_groups if not any(g.index in [e.group for e in v.groups] for v in body.data.vertices[:2000])]
print('bound; groups', len(body.vertex_groups))

# keep leg bones out of the torso so the skin doesn't tear when legs swing
G = {g.name: g for g in body.vertex_groups}
for gname in ('chest', 'hips', 'spine'):
    if gname not in G: G[gname] = body.vertex_groups.new(name=gname)
for v in body.data.vertices:
    x, y, z = v.co
    ws = {body.vertex_groups[e.group].name: e.weight for e in v.groups}
    moved = 0.0
    for gname in list(ws):
        if gname.startswith(('fUpper', 'hUpper')):
            top = 0.29 if gname.startswith('f') else 0.3
            k = min(1.0, max(0.0, (top - z) / 0.06))
            if abs(y) < 0.05: k *= max(0.0, (abs(y) - 0.02) / 0.03)
            nw = ws[gname] * k; moved += ws[gname] - nw; ws[gname] = nw
            G[gname].add([v.index], nw, 'REPLACE')
    if moved > 1e-4:
        tgt = 'chest' if x > 0.05 else 'hips'
        G[tgt].add([v.index], ws.get(tgt, 0.0) + moved, 'REPLACE')

# ---------------------------------------------------------------- coat texture (painted in Python)
bpy.context.view_layer.objects.active = body
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.012)
bpy.ops.object.mode_set(mode='OBJECT')

TEX = 1024
def hsh(*a):
    h = 0
    for v in a: h = (h * 1103515245 + int(v) * 2654435761 + 12345) & 0xffffffff
    h ^= h >> 13; h = (h * 1274126177) & 0xffffffff
    return (h ^ (h >> 16)) / 4294967296.0
_g = np.random.default_rng(3).random((64, 64, 64)).astype(np.float32)
def noise(p, f):
    q = p * f
    i = np.floor(q).astype(int); t = q - i; t = t * t * (3 - 2 * t)
    def g(dx, dy, dz): return _g[(i[:, 0] + dx) % 64, (i[:, 1] + dy) % 64, (i[:, 2] + dz) % 64]
    l = lambda a, b, s: a + (b - a) * s
    return l(l(l(g(0,0,0), g(1,0,0), t[:,0]), l(g(0,1,0), g(1,1,0), t[:,0]), t[:,1]),
             l(l(g(0,0,1), g(1,0,1), t[:,0]), l(g(0,1,1), g(1,1,1), t[:,0]), t[:,1]), t[:,2])

WHITE = np.array([.93, .92, .885]); BLACK = np.array([.07, .07, .075]); MUZ = np.array([.11, .1, .1])
def coat(p, n):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    w = noise(p, 9) * 1.6 + noise(p, 22) * .5
    leg = (z < 0.33) & ((x > 0.14) | (x < -0.12)) & (np.abs(y) > 0.035)
    neckhead = x > 0.3
    # body stripes: vertical bands that sweep back toward the rump
    body_ph = x * 34 + np.sin(z * 12 + y * 3) * 1.2 + z * 6 + w
    # rump: chevron/diagonal bands
    rump = x < -0.13
    rump_ph = (x * 22 - z * 26) + w
    leg_ph = z * 62 + w * .6
    neck_ph = (x * 20 + z * 30) * 1.15 + w
    ph = np.where(leg, leg_ph, np.where(rump & ~leg, rump_ph, np.where(neckhead, neck_ph, body_ph)))
    s = np.sin(ph)
    thick = np.where(leg, .05, .12)
    stripe = s > thick
    col = np.where(stripe[:, None], BLACK, WHITE)
    belly = (n[:, 2] < -0.55) & (x > -0.18) & (x < 0.2) & (z < 0.4)
    col = np.where(belly[:, None], WHITE * .97, col)
    muzzle = x > 0.57
    col = np.where(muzzle[:, None], MUZ, col)
    hoof = z < 0.03
    col = np.where(hoof[:, None], np.array([.16, .13, .1]), col)
    mane = (x > 0.27) & (x < 0.45) & (z > 0.5) & (np.abs(y) < 0.016) & (n[:, 2] > 0.2)
    col = np.where(mane[:, None], np.where((np.sin(x * 120) > 0)[:, None], BLACK, WHITE * .9), col)
    tailtuft = (x < -0.37) & (z < 0.27)
    col = np.where(tailtuft[:, None], BLACK, col)
    eyes = (np.abs(np.abs(y) - 0.044) < 0.014) & (np.abs(x - 0.51) < 0.013) & (np.abs(z - 0.705) < 0.013)
    col = np.where(eyes[:, None], np.array([.02, .02, .02]), col)
    # baked "2005 game" shading: soft top light + darker underside + grain
    shade = .82 + .2 * np.clip(n[:, 2] * .5 + .5, 0, 1) + (noise(p, 60) - .5) * .06
    return np.clip(col * shade[:, None], 0, 1)

mesh = body.data
uvl = mesh.uv_layers.active.data
img = np.zeros((TEX, TEX, 3), np.float32); mask = np.zeros((TEX, TEX), bool)
mesh.calc_loop_triangles()
co = np.array([v.co[:] for v in mesh.vertices]); vn = np.array([v.normal[:] for v in mesh.vertices])
for tri in mesh.loop_triangles:
    uv = np.array([uvl[l].uv[:] for l in tri.loops]) * (TEX - 1)
    vi = list(tri.vertices)
    x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    px = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    a, b, c = uv
    v0, v1 = b - a, c - a; d = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(d) < 1e-9: continue
    q = px - a
    l1 = (q[:, 0] * v1[1] - v1[0] * q[:, 1]) / d; l2 = (v0[0] * q[:, 1] - q[:, 0] * v0[1]) / d; l0 = 1 - l1 - l2
    m = (l0 >= -.02) & (l1 >= -.02) & (l2 >= -.02)
    if not m.any(): continue
    L = np.stack([l0[m], l1[m], l2[m]], 1)
    pos = L @ co[vi]; nor = L @ vn[vi]; nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
    X = np.clip(xs.ravel()[m], 0, TEX - 1); Y = np.clip(ys.ravel()[m], 0, TEX - 1)
    img[Y, X] = coat(pos, nor); mask[Y, X] = True
for _ in range(6):   # dilate islands so mip-maps don't bleed seams
    grow = ~mask & (np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1))
    for sh in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        src = np.roll(img, sh[0], sh[1]); sm = np.roll(mask, sh[0], sh[1])
        sel = grow & sm; img[sel] = src[sel]
    mask |= grow
bimg = bpy.data.images.new('ZebraCoat', TEX, TEX, alpha=False)
rgba = np.ones((TEX, TEX, 4), np.float32); rgba[..., :3] = img
bimg.pixels.foreach_set(rgba.ravel())
bimg.filepath_raw = os.path.join(OUT, 'zebra_coat.png'); bimg.file_format = 'PNG'; bimg.save()

mat = bpy.data.materials.new('ZebraCoat'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bimg
nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = .85
mesh.materials.append(mat)

# ---------------------------------------------------------------- animation
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
pb = rig.pose.bones
for b in pb: b.rotation_mode = 'QUATERNION'
REST = {b.name: rig.data.bones[b.name].matrix_local.to_3x3() for b in pb}
def wrot(name, axis, ang):
    """rotation about a world axis, expressed in the bone's rest frame"""
    M = REST[name]; R = Matrix.Rotation(ang, 3, axis)
    return (M.inverted() @ R @ M).to_quaternion()
Y = Vector((0, 1, 0)); Xa = Vector((1, 0, 0)); Za = Vector((0, 0, 1))
def compose(name, *rots):
    q = Quaternion()
    for axis, ang in rots: q = wrot(name, axis, ang) @ q
    return q

def make_action(name, frames, pose_fn):
    rig.animation_data_create()
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    for f in range(frames + 1):
        t = f / frames
        for b in pb: b.rotation_quaternion = Quaternion(); b.location = Vector()
        pose_fn(t)
        for b in pb:
            b.keyframe_insert('rotation_quaternion', frame=f)
            if b.name == 'root': b.keyframe_insert('location', frame=f)
    for fc in getattr(act, 'fcurves', []):
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    # stash on NLA so the exporter keeps every clip
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = None
    return act

TAU = math.tau
def leg(prefix, s, ph, stride=.34, lift=.55):
    """one leg's walk pose at phase ph (0..1)"""
    sw = math.sin(ph * TAU)                    # + = leg forward
    up = max(0, math.sin(ph * TAU + .9))       # bend while swinging through
    if prefix == 'f':
        pb[f'fUpper{s}'].rotation_quaternion = wrot(f'fUpper{s}', Y, -sw * stride * .7)
        pb[f'fLower{s}'].rotation_quaternion = wrot(f'fLower{s}', Y, up * lift * .9)
        pb[f'fCannon{s}'].rotation_quaternion = wrot(f'fCannon{s}', Y, -up * lift * .2)
        pb[f'fHoof{s}'].rotation_quaternion = wrot(f'fHoof{s}', Y, up * lift * .6)
    else:
        pb[f'hUpper{s}'].rotation_quaternion = wrot(f'hUpper{s}', Y, -sw * stride * .6)
        pb[f'hLower{s}'].rotation_quaternion = wrot(f'hLower{s}', Y, -up * lift * .6)
        pb[f'hCannon{s}'].rotation_quaternion = wrot(f'hCannon{s}', Y, up * lift * .7)
        pb[f'hHoof{s}'].rotation_quaternion = wrot(f'hHoof{s}', Y, up * lift * .5)

def walk(t):
    # four-beat walk: LH, LF, RH, RF
    leg('h', 'L', t); leg('f', 'L', t + .25); leg('h', 'R', t + .5); leg('f', 'R', t + .75)
    pb['root'].location = Vector((0, 0, .008 * math.sin(t * TAU * 2)))
    pb['spine'].rotation_quaternion = wrot('spine', Za, .04 * math.sin(t * TAU))
    pb['neck1'].rotation_quaternion = wrot('neck1', Y, .06 * math.sin(t * TAU * 2 + 1))
    pb['head'].rotation_quaternion = wrot('head', Y, -.05 * math.sin(t * TAU * 2 + 1))
    pb['tail1'].rotation_quaternion = wrot('tail1', Za, .25 * math.sin(t * TAU))
    pb['tail2'].rotation_quaternion = wrot('tail2', Za, .3 * math.sin(t * TAU - .8))
make_action('walk', 24, walk)

def idle(t):
    b = math.sin(t * TAU)
    pb['root'].location = Vector((0, 0, .003 * b))
    pb['neck1'].rotation_quaternion = wrot('neck1', Y, .05 * b)
    pb['head'].rotation_quaternion = compose('head', (Za, .15 * math.sin(t * TAU)), (Y, .04 * b))
    sw = math.sin(t * TAU * 3) if 0.4 < t < 0.75 else 0
    pb['tail1'].rotation_quaternion = wrot('tail1', Za, .5 * sw)
    pb['tail2'].rotation_quaternion = wrot('tail2', Za, .6 * sw)
    flick = math.sin(t * TAU * 4) if t > .8 else 0
    pb['earL'].rotation_quaternion = wrot('earL', Xa, .4 * flick)
    pb['earR'].rotation_quaternion = wrot('earR', Xa, -.2 * flick)
make_action('idle', 96, idle)

def graze(t):
    chew = math.sin(t * TAU * 6)
    pb['neck1'].rotation_quaternion = wrot('neck1', Y, .95)
    pb['neck2'].rotation_quaternion = wrot('neck2', Y, .45)
    pb['head'].rotation_quaternion = compose('head', (Y, .12 + .05 * chew), (Za, .12 * math.sin(t * TAU)))
    pb['fUpperL'].rotation_quaternion = wrot('fUpperL', Y, -.08)
    pb['fUpperR'].rotation_quaternion = wrot('fUpperR', Y, .08)
    pb['tail1'].rotation_quaternion = wrot('tail1', Za, .3 * math.sin(t * TAU * 2))
make_action('graze', 72, graze)

def lie(t):
    br = math.sin(t * TAU) * .004
    pb['root'].location = Vector((0, 0, -.25 + br))
    for s in 'LR':
        pb[f'fUpper{s}'].rotation_quaternion = wrot(f'fUpper{s}', Y, -.9)
        pb[f'fLower{s}'].rotation_quaternion = wrot(f'fLower{s}', Y, 2.2)
        pb[f'fCannon{s}'].rotation_quaternion = wrot(f'fCannon{s}', Y, -.3)
        pb[f'hUpper{s}'].rotation_quaternion = wrot(f'hUpper{s}', Y, .9)
        pb[f'hLower{s}'].rotation_quaternion = wrot(f'hLower{s}', Y, -1.6)
        pb[f'hCannon{s}'].rotation_quaternion = wrot(f'hCannon{s}', Y, 1.9)
    pb['neck1'].rotation_quaternion = wrot('neck1', Y, .25)
    pb['head'].rotation_quaternion = compose('head', (Y, .2), (Za, .2))
    pb['tail1'].rotation_quaternion = wrot('tail1', Za, .4)
make_action('lie', 96, lie)

bpy.ops.object.mode_set(mode='OBJECT')
for b in pb: b.rotation_quaternion = Quaternion(); b.location = Vector()

# ---------------------------------------------------------------- export
path = os.path.join(OUT, 'zebra.glb')
kw = dict(filepath=path, export_format='GLB', use_selection=False, export_animations=True,
          export_skins=True, export_apply=False, export_yup=True, export_image_format='JPEG')
for extra in (dict(export_animation_mode='NLA_TRACKS'), dict(export_nla_strips=True), {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra); print('exported with', extra); break
    except TypeError as e:
        print('retry', e)
print('size KB', os.path.getsize(path) // 1024)
