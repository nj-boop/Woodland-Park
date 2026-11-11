"""Wildgrove Zoo animal builder: original rigged, textured, animated animals exported as glTF.

Usage: python3 build_animals.py <species> <out_dir>
Blender axes: +X forward, +Y left, +Z up. 1 unit = 1 game tile.
"""
import bpy, bmesh, math, sys, os
import numpy as np
from mathutils import Vector, Matrix, Quaternion

SP, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
TAU = math.tau

# ============================================================ helpers: coat painting
_g = np.random.default_rng(3).random((64, 64, 64)).astype(np.float32)
def noise(p, f):
    q = p * f; i = np.floor(q).astype(int); t = q - i; t = t * t * (3 - 2 * t)
    def g(dx, dy, dz): return _g[(i[:, 0] + dx) % 64, (i[:, 1] + dy) % 64, (i[:, 2] + dz) % 64]
    l = lambda a, b, s: a + (b - a) * s
    return l(l(l(g(0,0,0), g(1,0,0), t[:,0]), l(g(0,1,0), g(1,1,0), t[:,0]), t[:,1]),
             l(l(g(0,0,1), g(1,0,1), t[:,0]), l(g(0,1,1), g(1,1,1), t[:,0]), t[:,1]), t[:,2])
def voronoi(p, size):
    q = p / size; cell = np.floor(q).astype(int)
    d1 = np.full(len(p), 9.0); d2 = np.full(len(p), 9.0); cid = np.zeros(len(p))
    rng = np.random.default_rng(11); jit = rng.random((32, 32, 32, 3))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = cell + np.array([dx, dy, dz]); j = jit[c[:, 0] % 32, c[:, 1] % 32, c[:, 2] % 32]
                d = np.linalg.norm(c + j - q, axis=1)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d)); cid = np.where(closer, j[:, 0], cid); d1 = np.where(closer, d, d1)
    return d2 - d1, cid
def C(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) / 255 for i in (0, 2, 4)])
def sel(mask, col, base): return np.where(mask[:, None], col if np.ndim(col) == 2 else np.broadcast_to(col, base.shape), base)
def shade_bake(col, p, n):
    s = .8 + .22 * np.clip(n[:, 2] * .5 + .5, 0, 1) + (noise(p, 70) - .5) * .07
    return np.clip(col * s[:, None], 0, 1)
def fur(base, p, f=30, amt=.18):
    v = noise(p, f) * .6 + noise(p, f * 3) * .4
    return base[None, :] * (1 - amt / 2 + amt * v)[:, None]

# ============================================================ quadruped template
def quad_joints(q):
    # game animals read better with a slightly larger head and ears than life
    hs = q.get('hs', 1.18); es_ = q.get('earS', 1.35)
    q = dict(q, hl=q['hl'] * hs, hr=(q['hr'][0] * hs, q['hr'][1] * hs), mr=(q['mr'][0] * hs, q['mr'][1] * hs), el=q['el'] * es_, er=q['er'] * es_)
    L, Zp, Zc, w, h, lr = q['L'], q['Zp'], q['Zc'], q['w'], q['h'], q['lr']
    xp, xc = -L / 2, L / 2
    zt = lambda x: Zp + (Zc - Zp) * (x - xp) / L
    J = {
        'pelvis': ((xp, 0, Zp), w * .95, h * .95),
        'loin': ((-L / 6, 0, zt(-L / 6) + .005 + h * (1 - q.get('loinH', 1)) * .6), w * q.get('loinW', 1), h * q.get('loinH', 1)),
        'belly': ((L / 6, 0, zt(L / 6) - .005), w * 1.05, h * q.get('belly', 1.08)),
        'chest': ((xc - .02, 0, Zc - .005), w * .96, h * q.get('chestH', 1.12)),
        'withers': ((xc + q.get('wx', .06), 0, Zc + h * .45), w * .66, h * .74),
    }
    a, nl = q['na'], q['nl']; d = Vector((math.cos(a), 0, math.sin(a)))
    wv = Vector(J['withers'][0])
    for k, f, rs in (('neck1', .35, 1), ('neck2', .7, .86), ('poll', 1.0, .78)):
        J[k] = (tuple(wv + d * nl * f), q['nr'][0] * rs, q['nr'][1] * rs)
    pv = Vector(J['poll'][0]); hd = Vector((math.cos(q['ha']), 0, math.sin(q['ha'])))
    J['head'] = (tuple(pv + hd * q['hl'] * .42), q['hr'][0], q['hr'][1])
    J['muzzle'] = (tuple(pv + hd * q['hl'] * .84), q['mr'][0], q['mr'][1])
    J['nose'] = (tuple(pv + hd * q['hl'] * 1.02), q['mr'][0] * .85, q['mr'][1] * .82)
    td = Vector((-math.cos(q.get('ta', 1.2)), 0, -math.sin(q.get('ta', 1.2))))
    t0 = Vector((xp - w * .7, 0, Zp + h * .5))
    J['tail0'] = (tuple(t0), q['tr'], q['tr'])
    for i, f in ((1, .35), (2, .72), (3, 1.0)):
        J[f'tail{i}'] = (tuple(t0 + td * q['tl'] * f), q['tr'] * (1 - .25 * i), q['tr'] * (1 - .25 * i))
    if q.get('tuft'):
        J['tail3'] = (J['tail3'][0], q['tuft'], q['tuft'])
    ft, ht = Zc - h * .35, Zp - h * .3
    for s, sy in (('L', 1), ('R', -1)):
        yo = sy * w * .68
        paw = q.get('paw', False)
        fx = xc + q.get('fx', 0)
        J.update({
            f'fshoulder{s}': ((fx - .01, yo, ft), lr * 1.45, lr * 1.85),
            f'felbow{s}': ((fx + .005, yo * 1.03, ft * .68), lr * 1.05, lr * 1.15),
            f'fknee{s}': ((fx, yo * 1.03, ft * .4), lr * .78, lr * .82),
            f'ffet{s}': ((fx + .005, yo * 1.03, ft * .13), lr * .62, lr * .64),
            f'fhoof{s}': ((fx + (.03 if paw else .015), yo * 1.03, .014), lr * (.95 if paw else .78), lr * .46),
            f'hhip{s}': ((xp + .01, yo, ht + .01), lr * 1.75, lr * 2.15),
            f'hstifle{s}': ((xp + .06, yo * 1.05, ht * .72), lr * 1.3, lr * 1.5),
            f'hhock{s}': ((xp - .035, yo * 1.03, ht * .42), lr * .78, lr * .86),
            f'hfet{s}': ((xp - .015, yo * 1.03, ht * .13), lr * .62, lr * .64),
            f'hhoof{s}': ((xp + (.02 if paw else .005), yo * 1.03, .014), lr * (.95 if paw else .78), lr * .46),
        })
        e0 = Vector(J['poll'][0]) + Vector((-.01, sy * q['hr'][0] * .7, q['hr'][1] * .55))
        el = q['el']
        J[f'ear{s}0'] = (tuple(e0), q['er'], q['er'] * .75)
        J[f'ear{s}1'] = (tuple(e0 + Vector((-.012, sy * el * q.get('es', .4), el))), q['er'] * .4, q['er'] * .35)
    for k, v in q.get('override', {}).items():
        J[k] = v
    return J, ft, ht

QEDGES = [('pelvis','loin'),('loin','belly'),('belly','chest'),('chest','withers'),('withers','neck1'),('neck1','neck2'),
          ('neck2','poll'),('poll','head'),('head','muzzle'),('muzzle','nose'),('pelvis','tail0'),('tail0','tail1'),('tail1','tail2'),('tail2','tail3')]
for s in 'LR':
    QEDGES += [('chest',f'fshoulder{s}'),(f'fshoulder{s}',f'felbow{s}'),(f'felbow{s}',f'fknee{s}'),(f'fknee{s}',f'ffet{s}'),(f'ffet{s}',f'fhoof{s}'),
               ('pelvis',f'hhip{s}'),(f'hhip{s}',f'hstifle{s}'),(f'hstifle{s}',f'hhock{s}'),(f'hhock{s}',f'hfet{s}'),(f'hfet{s}',f'hhoof{s}'),
               ('poll',f'ear{s}0'),(f'ear{s}0',f'ear{s}1')]

def quad_bones(J, eb, bone):
    P = lambda n: Vector(J[n][0])
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

# ============================================================ species specs
def quad_spec(q, coat, attach=None, extra_bones=None):
    return dict(kind='quad', q=q, coat=coat, attach=attach or (lambda J: []), extra_bones=extra_bones)

def coat_giraffe(p, n, J):
    x, y, z = p.T
    e, cid = voronoi(p * np.array([1, 1, .8]), .055)
    patch = C('#a3591f')[None, :] * (.8 + .35 * cid[:, None])
    col = np.where((e < .16)[:, None], C('#efdcb0'), patch)
    lowleg = z < .3
    col = np.where(lowleg[:, None], np.where((e < .25)[:, None], C('#efe2c0'), col * 1.15), col)
    col = sel((z < .03), C('#3a2a1c'), col)
    mz = J['muzzle'][0][0] - .02
    col = sel((x > mz), C('#d6bf98'), col)
    mane = (x > J['withers'][0][0] - .02) & (np.abs(y) < .014) & (n[:, 2] > .1) & (x < J['poll'][0][0])
    col = sel(mane, C('#6e3f1a'), col)
    col = sel((z > J['poll'][0][2] + .045) & (np.abs(y) < .05) & (x < J['poll'][0][0] + .02), C('#3f2a18'), col)
    col = sel((x < J['tail3'][0][0] + .03) & (z < J['tail3'][0][2] + .03), C('#2a1a10'), col)
    return col

def lion_mane(J):
    pl = np.array(J['poll'][0]); return pl + np.array([-.075, 0, -.045]), np.array([.125, .15, .185])
def coat_lion(p, n, J):
    x, y, z = p.T
    base = fur(C('#c99a55'), p, 28, .2)
    col = sel(n[:, 2] < -.45, C('#e6cc9a'), base)
    c, r = lion_mane(J)
    mane = (np.linalg.norm((p - c) / (r * 1.06), axis=1) < 1) & (x < J['head'][0][0] - J['head'][1] * .25)
    streak = noise(p * np.array([1, 1, .35]), 60)
    mcol = fur(C('#6f3d17'), p, 45, .35) * (.75 + .5 * streak[:, None])
    col = np.where(mane[:, None], np.where((z < c[2] - r[2] * .45)[:, None], mcol * .6, mcol), col)
    col = sel((x > J['muzzle'][0][0] + .004) & (z < J['muzzle'][0][2] + J['muzzle'][2] * .35) & ~mane, C('#f0dcb4'), col)
    col = sel((x < J['tail3'][0][0] + .04) & (z < J['tail3'][0][2] + .04), C('#3d2410'), col)
    col = sel(z < .018, C('#8a6a44'), col)
    return col

def coat_tiger(p, n, J):
    x, y, z = p.T
    w = noise(p, 8) * 2.5
    ph = np.where(z < .24, z * 95 + w, x * 62 + np.abs(y) * 14 + w * 1.6 + z * 9)
    taper = np.clip((np.abs(y) + .02) / .09, 0, 1)   # stripes thin out toward the spine line
    stripe = (np.sin(ph) > .5 + .35 * (1 - taper)) & ~((n[:, 2] < -.35) & (z < .3))
    base = fur(C('#d66f28'), p, 30, .14)
    col = np.where(stripe[:, None], C('#1b130e'), base)
    white = (n[:, 2] < -.35) | ((x > J['muzzle'][0][0] - .005) & (z < J['muzzle'][0][2] + J['muzzle'][2] * .5))
    col = np.where((white & ~stripe)[:, None], C('#f1e7d6'), col)
    col = sel((x < J['tail3'][0][0] + .03) & (z < J['tail3'][0][2] + .03), C('#1b130e'), col)
    return col

def coat_elephant(p, n, J):
    x, y, z = p.T
    wr = noise(p * np.array([1, 1, 2.5]), 30) * .5 + noise(p, 70) * .5
    col = C('#8a8b8b')[None, :] * (.78 + .3 * wr[:, None])
    earz = (np.abs(y) > J['head'][1] * 1.02) & (x < J['head'][0][0] + .02) & (x > J['head'][0][0] - .26) & (z > J['head'][0][2] - .2)
    col = np.where((earz & (n[:, 0] > .25))[:, None], C('#a89490')[None, :] * (.85 + .2 * wr[:, None]), col)
    col = np.where(((z < .07) & (z > .02) & (np.sin(np.arctan2(y, x) * 9) > .55) & (n[:, 2] > -.3))[:, None], C('#d9d2c2'), col)  # toenails
    ax = np.array([math.sin(2.2), 0, math.cos(2.2)]); tusk = np.zeros(len(p), bool)
    for sy in (1, -1):
        c = np.array(J['muzzle'][0]) + np.array([.07, sy * .08, -.09]); a0, a1 = c - ax * .12, c + ax * .12
        ba = a1 - a0; h = np.clip(((p - a0) @ ba) / (ba @ ba), 0, 1); dd = np.linalg.norm(p - a0 - h[:, None] * ba, axis=1)
        tusk |= (dd < .034 * (1 - .8 * h) + .006) & (h > .25)
    col = sel(tusk, C('#f1e9d4'), col)
    col = sel(z < .02, C('#6c6a65'), col)
    return col

def coat_polar(p, n, J):
    x, y, z = p.T
    col = fur(C('#eee7d4'), p, 26, .12)
    col = sel(z < .018, C('#3a3632'), col)
    return col

def coat_camel(p, n, J):
    x, y, z = p.T
    col = fur(C('#c39a5e'), p, 24, .16)
    col = sel(z < .03, C('#7a5a3a'), col)
    col = sel(x > J['muzzle'][0][0], C('#a8814c'), col)
    return col

def coat_fox(p, n, J):
    x, y, z = p.T
    col = fur(C('#d99a52'), p, 40, .16)
    col = sel((n[:, 2] < -.4) | (x > J['muzzle'][0][0] + .005), C('#f4eadb'), col)
    col = sel(z < .07, C('#4a301c'), col)
    col = sel(x < J['tail3'][0][0] + .05, C('#f6f0e4'), col)
    return col

def coat_bison(p, n, J):
    x, y, z = p.T
    sh = noise(p, 22)
    front = x > J['belly'][0][0] - .03
    col = np.where(front[:, None], C('#3e2a18')[None, :] * (.75 + .5 * sh[:, None]), C('#6c4c30')[None, :] * (.85 + .3 * sh[:, None]))
    col = sel(x > J['poll'][0][0] - .05, C('#3a281c'), col)
    col = sel((np.linalg.norm(p - np.array(J['nose'][0]), axis=1) < J['muzzle'][1] * 1.5), C('#5a4636'), col)
    hc = np.array(J['poll'][0]); horn = np.zeros(len(p), bool)
    for sy in (1, -1): horn |= (np.abs(y) > .118) & (z > hc[2] - .01) & (x > hc[0] - .05) & (x < hc[0] + .05)
    col = sel(horn, C('#d8cfb8'), col)
    col = sel(horn & (z > hc[2] + .085), C('#3a342c'), col)
    col = sel(z < .02, C('#24201c'), col)
    return col

def coat_monkey(p, n, J):
    x, y, z = p.T
    col = fur(C('#7a5132'), p, 40, .22)
    hd = np.array(J['head'][0]); fc = hd + np.array([J['head'][1] * .75, 0, -J['head'][2] * .1])
    face = np.linalg.norm((p - fc) / np.array([1, 1.15, 1.25]), axis=1) < J['head'][1] * .78
    col = sel(face, C('#e0b48a'), col)
    col = sel((z < .03) | ((n[:, 2] < -.6) & (z < .05)), C('#5a3b26'), col)
    return col

def coat_gorilla(p, n, J):
    x, y, z = p.T
    col = fur(C('#2a2829'), p, 40, .35)
    hd = np.array(J['head'][0]); fc = hd + np.array([J['head'][1] * .8, 0, -J['head'][2] * .25])
    col = sel(np.linalg.norm((p - fc) / np.array([1, 1.1, 1.3]), axis=1) < J['head'][1] * .8, C('#4a4346'), col)
    col = sel((n[:, 0] > .55) & (np.abs(y) < J['chest'][1] * .7) & (z > J['chest'][0][2] - .12) & (z < J['chest'][0][2] + .08) & (x > J['chest'][0][0]), C('#3a3436'), col)
    back = (n[:, 2] > .5) & (x < J['belly'][0][0]) & (z > .4)
    col = np.where(back[:, None], fur(C('#6d6a6a'), p, 40, .3), col)
    return col

def coat_kangaroo(p, n, J):
    x, y, z = p.T
    col = fur(C('#b07a52'), p, 30, .16)
    col = sel((n[:, 0] > .45) & (z > .2) & (z < .55), C('#e4cba8'), col)
    col = sel(z < .02, C('#6e4a30'), col)
    col = sel(x > .25, C('#2a1e18'), col)
    return col

def coat_penguin(p, n, J):
    x, y, z = p.T
    K = C('#1b1f24')
    col = np.where(((n[:, 0] > .05) & (z < .5) & (z > .04))[:, None], fur(C('#f3f1ea'), p, 30, .05), K[None, :] * np.ones((len(p), 1)))
    col = sel((x > .09) & (z > .46) & (z < .54), C('#e8902a'), col)
    col = sel(z < .025, C('#e8902a'), col)
    cheek = (np.abs(np.abs(y) - .065) < .025) & (z > .5) & (z < .56) & (x > 0)
    col = sel(cheek, C('#f2c840'), col)
    return col

def coat_eye(p, J, col, r=.012):
    ex, ez = J['eye'] if 'eye' in J else (None, None)
    return col

def coat_mammoth(p, n, J):
    x, y, z = p.T
    # long shaggy hair: streaks running down the body, darker underneath
    streak = noise(p * np.array([3, 3, .6]), 40) * .6 + noise(p, 90) * .4
    col = C('#8f6038')[None, :] * (.6 + .6 * streak[:, None])
    col = np.where((x > J['head'][0][0] - .02)[:, None], col * .82, col)
    col = np.where((n[:, 2] < -.3)[:, None], col * .7, col)
    for sy in (1, -1):  # tusks, matching attach_mammoth()
        for c, s, ax in mammoth_tusk(J, sy):
            a0, a1 = c - ax * s, c + ax * s
            ba = a1 - a0; h = np.clip(((p - a0) @ ba) / (ba @ ba), 0, 1); dd = np.linalg.norm(p - a0 - h[:, None] * ba, axis=1)
            col = sel(dd < .03, C('#efe3c4'), col)
    col = sel(z < .02, C('#3a2a1e'), col)
    return col

def mammoth_tusk(J, sy):
    # two segments per tusk, curving forward, outward and up: (centre, half-length, axis)
    m = np.array(J['muzzle'][0])
    a1 = np.array([.55, sy * .25, -.8]); a1 /= np.linalg.norm(a1)
    a2 = np.array([.75, sy * .35, .55]); a2 /= np.linalg.norm(a2)
    c1 = m + np.array([.02, sy * .07, -.1]) + a1 * .12
    c2 = c1 + a1 * .12 + a2 * .15
    return [(c1, .12, a1), (c2, .15, a2)]

def attach_mammoth(J):
    out = []
    for sy in (1, -1):
        for c, s, ax in mammoth_tusk(J, sy):
            # cones point along +z; tilt that onto the tusk's axis
            pitch = math.atan2(math.hypot(ax[0], ax[1]), ax[2]); yaw = math.atan2(ax[1], ax[0])
            out.append(attach_cone(Vector(tuple(c)), (.03, .03, s), (0, pitch, yaw)))
        out.append(attach_ellipsoid(Vector(J['head'][0]) + Vector((-.07, sy * .14, .0)), (.025, .06, .07), (0, 0, sy * -.3)))  # small ears
    out.append(attach_ellipsoid(Vector(J['head'][0]) + Vector((-.03, 0, .1)), (.12, .11, .1)))  # domed head
    out.append(attach_ellipsoid(Vector(J['withers'][0]) + Vector((-.02, 0, .06)), (.16, .14, .1)))  # shoulder hump
    return out

def coat_sabre(p, n, J):
    x, y, z = p.T
    base = fur(C('#b8864c'), p, 30, .2)
    e, cid = voronoi(p * np.array([1, 1.4, 1]), .05)
    col = np.where(((e > .55) & (cid > .55) & (n[:, 2] > -.2))[:, None], base * .72, base)  # faint spots
    col = sel(n[:, 2] < -.45, C('#e6cfa2'), col)
    col = sel((x > J['muzzle'][0][0] + .004) & (z < J['muzzle'][0][2] + J['muzzle'][2] * .35), C('#e8d4ab'), col)
    m = np.array(J['muzzle'][0])
    for sy in (1, -1):  # the sabre teeth
        c = m + np.array([.03, sy * .03, -.075])
        d = np.linalg.norm((p - c) / np.array([.016, .016, .065]), axis=1)
        col = sel(d < 1, C('#f2ead6'), col)
    col = sel(z < .02, C('#5a3c22'), col)
    return col

def attach_ellipsoid(c, s, rot=(0, 0, 0)):
    return ('sph', c, s, rot)
def attach_cone(c, s, rot=(0, 0, 0)):
    return ('cone', c, s, rot)

SPECIES = {
    'giraffe': quad_spec(dict(L=.36, Zp=.66, Zc=.72, w=.1, h=.12, lr=.04, na=1.3, nl=.62, nr=(.055, .085), ha=-.55, hl=.17, hr=(.048, .055),
                              mr=(.035, .04), tl=.3, tr=.02, tuft=.024, ta=1.35, el=.06, er=.018, wx=.04, chestH=1.15), coat_giraffe,
                         attach=lambda J: [attach_cone(Vector(J['poll'][0]) + Vector((-.005, s * .02, .06)), (.012, .012, .055)) for s in (1, -1)]),
    'lion': quad_spec(dict(L=.44, Zp=.4, Zc=.42, w=.095, h=.105, lr=.041, na=.78, nl=.12, nr=(.07, .085), ha=-.05, hl=.125, hr=(.07, .068),
                           mr=(.05, .04), tl=.34, tr=.014, tuft=.03, ta=.95, el=.026, er=.024, paw=True, es=.45, chestH=1.22, belly=.96, loinH=.86,
                           nose='#3a2a22', noseR=.4, eye=(.34, .78, .38)), coat_lion,
                      attach=lambda J: [('sph', Vector(tuple(lion_mane(J)[0])), tuple(lion_mane(J)[1]), (0, .25, 0)),
                                        ('sph', Vector(J['chest'][0]) + Vector((.03, 0, -.02)), (.1, .1, .13), (0, 0, 0))]),
    'tiger': quad_spec(dict(L=.5, Zp=.38, Zc=.39, w=.093, h=.103, lr=.04, na=.6, nl=.11, nr=(.068, .08), ha=-.05, hl=.125, hr=(.07, .066),
                            mr=(.048, .04), tl=.4, tr=.02, ta=.6, el=.022, er=.024, paw=True, es=.4, chestH=1.15, belly=1.0, loinH=.9,
                            nose='#c9867a', noseR=.4, eye=(.34, .78, .38)), coat_tiger,
                       attach=lambda J: [('sph', Vector(J['head'][0]) + Vector((-.03, s * .062, -.035)), (.045, .028, .05), (0, 0, 0)) for s in (1, -1)]),
    'elephant': quad_spec(dict(L=.62, Zp=.74, Zc=.78, w=.23, h=.24, lr=.085, na=.3, nl=.12, nr=(.15, .18), ha=-.6, hl=.2, hr=(.145, .155),
                               mr=(.085, .085), tl=.3, tr=.02, tuft=.028, ta=1.4, el=.02, er=.02, chestH=1.05, hs=1.0, earS=.4, eyeR=.12,
                               eye=(.45, .86, .1), mouth=False, nostril=False, trunkL=1.25), coat_elephant,
                          attach=lambda J: (
                              [attach_ellipsoid(Vector(J['head'][0]) + Vector((-.11, s * .2, .02)), (.026, .17, .2), (0, 0, s * -.5)) for s in (1, -1)]
                              + [attach_ellipsoid(Vector(J['head'][0]) + Vector((-.03, 0, .09)), (.13, .12, .1))]
                              + [attach_cone(Vector(J['muzzle'][0]) + Vector((.07, s * .08, -.09)), (.026, .026, .12), (0, 2.2, 0)) for s in (1, -1)]),
                          extra_bones='trunk'),
    'polar': quad_spec(dict(L=.52, Zp=.46, Zc=.44, w=.14, h=.15, lr=.062, na=.32, nl=.2, nr=(.085, .1), ha=-.3, hl=.2, hr=(.072, .07),
                            mr=(.044, .04), tl=.05, tr=.03, ta=1.2, el=.016, er=.02, paw=True, es=.3, chestH=1.0, belly=1.1, hs=1.1,
                            nose='#1c1c1c', noseR=.62, eyeR=.2, eye=(.3, .8, .4)), coat_polar),
    'camel': quad_spec(dict(L=.42, Zp=.62, Zc=.62, w=.115, h=.135, lr=.036, na=1.0, nl=.4, nr=(.05, .072), ha=-.1, hl=.17, hr=(.05, .058),
                            mr=(.04, .042), tl=.24, tr=.016, tuft=.022, ta=1.35, el=.022, er=.016, nose='#6e5234', noseR=.45, loinH=.9), coat_camel,
                       attach=lambda J: [attach_ellipsoid(Vector(J['belly'][0]) + Vector((-.05, 0, .15)), (.105, .08, .14)),
                                         attach_ellipsoid(Vector(J['withers'][0]) + Vector((.03, 0, -.03)), (.07, .075, .1), (0, -.5, 0))]),
    'fox': quad_spec(dict(L=.22, Zp=.18, Zc=.19, w=.055, h=.06, lr=.02, na=.6, nl=.06, nr=(.04, .045), ha=-.2, hl=.11, hr=(.042, .04),
                          mr=(.022, .02), tl=.24, tr=.045, tuft=.04, ta=.25, el=.06, er=.026, paw=True, es=.25), coat_fox),
    'bison': quad_spec(dict(L=.52, Zp=.5, Zc=.5, w=.13, h=.15, lr=.045, na=-.05, nl=.1, nr=(.12, .14), ha=-.85, hl=.2, hr=(.095, .1),
                            mr=(.07, .06), tl=.24, tr=.016, tuft=.028, ta=1.35, el=.02, er=.024, wx=.03, loinH=.82, loinW=.85, chestH=1.2, hs=1.1,
                            nose='#1a1512', noseR=.7, es=1.6, eye=(.2, .92, .1)), coat_bison,
                       attach=lambda J: [attach_ellipsoid(Vector(J['chest'][0]) + Vector((-.04, 0, .15)), (.2, .13, .16)),      # shoulder hump
                                         attach_ellipsoid(Vector(J['head'][0]) + Vector((-.04, 0, .05)), (.1, .115, .1)),       # woolly crown
                                         attach_ellipsoid(Vector(J['muzzle'][0]) + Vector((-.06, 0, -.09)), (.04, .035, .075))]  # beard
                                        + sum([[attach_cone(Vector(J['poll'][0]) + Vector((.0, s * .125, .035)), (.024, .024, .04), (s * -1.25, 0, 0)),
                                                attach_cone(Vector(J['poll'][0]) + Vector((.0, s * .175, .08)), (.016, .016, .04), (s * -.2, 0, 0))] for s in (1, -1)], [])),
    'monkey': quad_spec(dict(L=.18, Zp=.21, Zc=.28, w=.065, h=.07, lr=.022, na=.95, nl=.045, nr=(.045, .045), ha=-.08, hl=.085, hr=(.064, .064),
                             mr=(.036, .034), tl=.34, tr=.014, ta=-.6, el=.012, er=.028, paw=True, es=2.2, fx=.02, hs=1.12, earT=.3,
                             eye=(.95, .42, .3), eyeR=.17, nose='#5a3b2a', noseR=.3), coat_monkey),
    'mammoth': quad_spec(dict(L=.6, Zp=.64, Zc=.8, w=.24, h=.26, lr=.09, na=.4, nl=.17, nr=(.16, .19), ha=-.5, hl=.2, hr=(.15, .16),
                              mr=(.09, .09), tl=.12, tr=.022, tuft=.036, ta=1.4, el=.015, er=.015, chestH=1.15, hs=1.0, earS=.4, eyeR=.12,
                              eye=(.45, .86, .1), mouth=False, nostril=False, trunkL=1.25), coat_mammoth,
                         attach=attach_mammoth, extra_bones='trunk'),
    'sabre': quad_spec(dict(L=.44, Zp=.38, Zc=.44, w=.1, h=.11, lr=.044, na=.7, nl=.12, nr=(.078, .09), ha=-.08, hl=.13, hr=(.072, .07),
                            mr=(.052, .044), tl=.07, tr=.02, ta=1.0, el=.022, er=.022, paw=True, es=.4, chestH=1.28, loinH=.88,
                            nose='#3a2418', noseR=.4, eye=(.34, .78, .38)), coat_sabre,
                       attach=lambda J: [attach_cone(Vector(J['muzzle'][0]) + Vector((.03, s * .03, -.075)), (.013, .013, .06), (math.pi, 0, 0)) for s in (1, -1)]),
    'gorilla': quad_spec(dict(L=.32, Zp=.36, Zc=.56, w=.145, h=.15, lr=.062, na=.85, nl=.05, nr=(.1, .1), ha=-.2, hl=.14, hr=(.098, .1),
                              mr=(.07, .062), tl=.01, tr=.01, ta=1.2, el=.01, er=.02, paw=True, es=2.2, chestH=1.25, fx=.05, hs=1.08,
                              eye=(.8, .45, .28), eyeR=.13, nostril=True), coat_gorilla,
                         attach=lambda J: [attach_ellipsoid(Vector(J['head'][0]) + Vector((-.04, 0, .09)), (.085, .075, .07)),      # crest
                                           attach_ellipsoid(Vector(J['head'][0]) + Vector((.075, 0, .05)), (.03, .085, .022))]),  # brow ridge
}

# ============================================================ marine specs (swimmers)
def swim_profile(prof, S=1.0):
    J = {}; E = []
    for i, (x, rw, rh) in enumerate(prof):
        J[f'c{i}'] = ((x * S, 0, 0), rw * S, rh * S)
        if i: E.append((f'c{i-1}', f'c{i}'))
    return J, E
def coat_dolphin(p, n, J, S=1.0):
    x, y, z = (p / S).T
    w = noise(p / S, 7) * .03
    top = z + w > -.015 + .02 * np.sin(x * 9)
    col = np.where(top[:, None], C('#66747f')[None, :] * (.9 + .15 * noise(p, 20)[:, None]), C('#e4e9ec')[None, :] * np.ones((len(p), 1)))
    cape = (z > .04) & (x > -.2) & (x < .2)
    col = np.where(cape[:, None], col * .8, col)
    return col
def coat_orca(p, n, J, S=1.0):
    x, y, z = (p / S).T
    K = C('#111316'); Wt = C('#f1f2ef')
    col = np.tile(K, (len(p), 1)).astype(float)
    belly = (z < -.035 + .02 * np.cos(x * 6)) & (x > -.26) & (x < .3)
    eye = ((x - .2) / .055) ** 2 + ((np.abs(y) - .065) / .035) ** 2 + ((z - .035) / .03) ** 2 < 1
    flank = ((x + .1) / .09) ** 2 + ((z + .01) / .045) ** 2 < 1
    col = np.where((belly | eye | (flank & (np.abs(y) > .06)))[:, None], Wt, col)
    saddle = ((x + .05) / .07) ** 2 + ((z - .08) / .03) ** 2 < 1
    col = np.where(saddle[:, None], C('#5c6064'), col)
    return col
def coat_shark(p, n, J, S=1.0):
    x, y, z = (p / S).T
    top = z + noise(p / S, 9) * .02 > -.02
    col = np.where(top[:, None], C('#6b7a84')[None, :] * (.9 + .15 * noise(p, 25)[:, None]), C('#eef0ed')[None, :] * np.ones((len(p), 1)))
    gills = (x > .12) & (x < .18) & (np.abs(y) > .05) & (np.sin(x * 220) > .6) & (z > -.03) & (z < .03)
    col = np.where(gills[:, None], col * .6, col)
    return col
def coat_sealion(p, n, J, S=1.0):
    x, y, z = (p / S).T
    col = C('#6a4a32')[None, :] * (.8 + .3 * noise(p, 18)[:, None])
    col = np.where((z < -.04)[:, None], col * 1.15, col)
    col = np.where((x > .33)[:, None], C('#2a1d14'), col)
    return col
def coat_turtle(p, n, J, S=1.0):
    x, y, z = (p / S).T
    shell = (np.abs(x) < .21) & (np.abs(y) < .17) & (z > -.02)
    e, cid = voronoi(p * np.array([1, 1, 1.5]), .07)
    sc = C('#5f5531')[None, :] * (.75 + .45 * cid[:, None])
    shellc = np.where((e < .12)[:, None], C('#2f2a1a'), sc)
    plast = (np.abs(x) < .2) & (np.abs(y) < .15) & (z <= -.02)
    e2, c2 = voronoi(p, .025)
    skin = np.where((e2 < .2)[:, None], C('#c9c79a'), C('#6f7046')[None, :] * (.85 + .3 * c2[:, None]))
    col = np.where(shell[:, None], shellc, np.where(plast[:, None], C('#d6c78c'), skin))
    return col
def coat_beluga(p, n, J, S=1.0):
    x, y, z = (p / S).T
    col = C('#e9ece4')[None, :] * (.9 + .1 * noise(p / S, 14)[:, None])
    col = np.where((z > .06)[:, None], col * .95, col)
    return col
def coat_manatee(p, n, J, S=1.0):
    x, y, z = (p / S).T
    wr = noise(p / S * np.array([1, 1, 2]), 26) * .6 + noise(p / S, 60) * .4
    col = C('#7d7b72')[None, :] * (.78 + .3 * wr[:, None])
    algae = (z > .05) & (noise(p / S, 9) > .6)
    col = np.where(algae[:, None], col * np.array([.85, 1.0, .8]), col)
    col = np.where((x > .27)[:, None], C('#9a968a'), col)
    return col
SWIM = {
    'beluga': dict(S=1.4, coat=coat_beluga, axis='Y', prof=[(.33, .03, .03), (.3, .062, .068), (.24, .088, .094), (.14, .096, .1), (.03, .1, .1), (-.09, .085, .088), (-.19, .055, .058), (-.27, .03, .033), (-.33, .016, .02)],
                   att=[('sph', (.13, .09, -.05), (.05, .032, .01), (.5, .3, 0)), ('sph', (.13, -.09, -.05), (.05, .032, .01), (-.5, .3, 0)),
                        ('sph', (.0, 0, .085), (.12, .02, .02), (0, 0, 0)), ('sph', (-.37, 0, 0), (.045, .12, .011), (0, 0, 0))], eye=(.24, .07, .02)),
    'manatee': dict(S=1.3, coat=coat_manatee, axis='Y', prof=[(.3, .035, .03), (.26, .06, .055), (.19, .075, .07), (.08, .1, .09), (-.05, .11, .095), (-.16, .085, .075), (-.24, .05, .045), (-.29, .03, .025)],
                    att=[('sph', (.14, .1, -.05), (.06, .035, .012), (.5, .3, 0)), ('sph', (.14, -.1, -.05), (.06, .035, .012), (-.5, .3, 0)),
                         ('sph', (-.36, 0, 0), (.08, .09, .012), (0, 0, 0))], eye=(.27, .05, .02)),
    'dolphin': dict(S=1.0, coat=coat_dolphin, axis='Y', prof=[(.37, .01, .01), (.31, .024, .022), (.25, .055, .062), (.17, .08, .086), (.06, .096, .1), (-.06, .085, .09), (-.17, .055, .06), (-.27, .03, .037), (-.34, .016, .02)],
                    att=[('sph', (-.02, 0, .13), (.07, .012, .06), (0, -.45, 0)), ('sph', (.09, .09, -.05), (.065, .028, .011), (.5, .3, 0)), ('sph', (.09, -.09, -.05), (.065, .028, .011), (-.5, .3, 0)),
                         ('sph', (-.38, 0, 0), (.045, .13, .011), (0, 0, 0))], eye=(.2, .055, .015)),
    'orca': dict(S=1.75, coat=coat_orca, axis='Y', prof=[(.34, .03, .03), (.29, .055, .055), (.21, .085, .085), (.1, .105, .11), (-.03, .1, .105), (-.15, .07, .075), (-.26, .04, .045), (-.33, .02, .025)],
                 att=[('sph', (.0, 0, .17), (.045, .012, .11), (0, -.12, 0)), ('sph', (.12, .1, -.06), (.06, .04, .012), (.5, .2, 0)), ('sph', (.12, -.1, -.06), (.06, .04, .012), (-.5, .2, 0)),
                      ('sph', (-.37, 0, 0), (.05, .14, .012), (0, 0, 0))], eye=(.2, .07, .03)),
    'shark': dict(S=1.3, coat=coat_shark, axis='Z', prof=[(.36, .012, .012), (.3, .04, .035), (.22, .07, .065), (.12, .09, .085), (.0, .088, .085), (-.12, .065, .065), (-.24, .035, .04), (-.33, .015, .02)],
                  att=[('sph', (.02, 0, .12), (.06, .012, .085), (0, -.5, 0)), ('sph', (.1, .1, -.05), (.08, .035, .012), (.45, .45, 0)), ('sph', (.1, -.1, -.05), (.08, .035, .012), (-.45, .45, 0)),
                       ('sph', (-.4, 0, .08), (.04, .011, .11), (0, -.6, 0)), ('sph', (-.38, 0, -.05), (.03, .011, .065), (0, .55, 0)), ('sph', (-.2, 0, .07), (.025, .008, .03), (0, -.5, 0))], eye=(.25, .045, .02)),
    'sealion': dict(S=1.0, coat=coat_sealion, axis='Y', prof=[(.35, .02, .02), (.31, .038, .036), (.25, .055, .058), (.17, .05, .055), (.06, .095, .095), (-.07, .088, .082), (-.19, .05, .048), (-.27, .025, .022)],
                    att=[('sph', (.06, .11, -.06), (.075, .05, .011), (.4, .5, 0)), ('sph', (.06, -.11, -.06), (.075, .05, .011), (-.4, .5, 0)),
                         ('sph', (-.32, .04, -.01), (.06, .04, .009), (0, .2, .3)), ('sph', (-.32, -.04, -.01), (.06, .04, .009), (0, .2, -.3))], eye=(.29, .04, .025)),
    'turtle': dict(S=1.1, coat=coat_turtle, axis='T', prof=[(.29, .035, .032), (.21, .03, .028), (.1, .05, .04), (-.12, .05, .04), (-.22, .018, .015), (-.26, .01, .01)],
                   att=[('sph', (0, 0, .0), (.21, .165, .065), (0, 0, 0)), ('sph', (0, 0, -.02), (.19, .14, .03), (0, 0, 0)),
                        ('sph', (.07, .24, -.01), (.07, .14, .012), (0, 0, -.45)), ('sph', (.07, -.24, -.01), (.07, .14, .012), (0, 0, .45)),
                        ('sph', (-.16, .13, -.015), (.06, .06, .01), (0, 0, .5)), ('sph', (-.16, -.13, -.015), (.06, .06, .01), (0, 0, -.5))], eye=(.27, .028, .015)),
}

# ============================================================ upright specs (penguin, kangaroo)
def penguin_joints():
    J = {'hips': ((0, 0, .12), .12, .1), 'body': ((0, 0, .25), .145, .16), 'chest': ((0, 0, .38), .12, .11),
         'neck': ((.005, 0, .47), .085, .07), 'head': ((.015, 0, .53), .085, .08), 'beak': ((.11, 0, .51), .022, .018), 'tip': ((.15, 0, .5), .008, .008)}
    for s, sy in (('L', 1), ('R', -1)):
        J.update({f'sh{s}': ((0, sy * .12, .39), .03, .04), f'fl{s}': ((-.01, sy * .165, .25), .022, .028), f'ft{s}': ((-.02, sy * .17, .15), .01, .012),
                  f'leg{s}': ((0, sy * .055, .1), .035, .035), f'ank{s}': ((.01, sy * .055, .03), .022, .02), f'toe{s}': ((.07, sy * .06, .012), .035, .012)})
    E = [('hips', 'body'), ('body', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'beak'), ('beak', 'tip')]
    for s in 'LR': E += [('chest', f'sh{s}'), (f'sh{s}', f'fl{s}'), (f'fl{s}', f'ft{s}'), ('hips', f'leg{s}'), (f'leg{s}', f'ank{s}'), (f'ank{s}', f'toe{s}')]
    return J, E
def penguin_bones(J, eb, bone):
    P = lambda n: Vector(J[n][0])
    bone('root', Vector((0, 0, 0)), Vector((0, 0, .1)))
    bone('hips', P('hips'), P('body'), 'root'); bone('chest', P('body'), P('neck'), 'hips', True)
    bone('head', P('neck'), P('head') + Vector((0, 0, .08)), 'chest', True)
    for s in 'LR':
        bone(f'arm{s}', P(f'sh{s}'), P(f'ft{s}'), 'chest'); bone(f'leg{s}', P(f'leg{s}') + Vector((0, 0, .03)), P(f'ank{s}'), 'hips')
        bone(f'foot{s}', P(f'ank{s}'), P(f'toe{s}'), f'leg{s}', True)

def kangaroo_joints():
    J = {'tail3': ((-.42, 0, .03), .02, .02), 'tail2': ((-.32, 0, .08), .03, .03), 'tail1': ((-.2, 0, .17), .045, .045),
         'hips': ((-.07, 0, .3), .1, .1), 'belly': ((.0, 0, .4), .09, .1), 'chest': ((.05, 0, .5), .07, .07),
         'neck': ((.09, 0, .6), .045, .045), 'head': ((.13, 0, .665), .055, .055), 'snout': ((.22, 0, .645), .032, .03), 'nose': ((.255, 0, .635), .02, .02)}
    for s, sy in (('L', 1), ('R', -1)):
        J.update({f'thigh{s}': ((-.03, sy * .07, .26), .07, .085), f'knee{s}': ((.06, sy * .075, .16), .04, .04), f'ank{s}': ((-.06, sy * .075, .05), .022, .022),
                  f'toe{s}': ((.13, sy * .07, .015), .03, .014), f'sh{s}': ((.07, sy * .05, .49), .02, .02), f'elb{s}': ((.12, sy * .06, .42), .016, .016),
                  f'hand{s}': ((.15, sy * .055, .37), .014, .012), f'ear{s}0': ((.11, sy * .03, .7), .02, .015), f'ear{s}1': ((.09, sy * .045, .79), .009, .006)})
    E = [('tail3', 'tail2'), ('tail2', 'tail1'), ('tail1', 'hips'), ('hips', 'belly'), ('belly', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('head', 'snout'), ('snout', 'nose')]
    for s in 'LR': E += [('hips', f'thigh{s}'), (f'thigh{s}', f'knee{s}'), (f'knee{s}', f'ank{s}'), (f'ank{s}', f'toe{s}'), ('chest', f'sh{s}'), (f'sh{s}', f'elb{s}'),
                         (f'elb{s}', f'hand{s}'), ('head', f'ear{s}0'), (f'ear{s}0', f'ear{s}1')]
    return J, E
def kangaroo_bones(J, eb, bone):
    P = lambda n: Vector(J[n][0])
    bone('root', Vector((0, 0, 0)), Vector((0, 0, .1)))
    bone('hips', P('hips'), P('belly'), 'root'); bone('chest', P('belly'), P('neck'), 'hips', True); bone('head', P('neck'), P('nose'), 'chest', True)
    bone('tail1', P('tail1'), P('tail2'), 'hips'); bone('tail2', P('tail2'), P('tail3'), 'tail1', True)
    for s in 'LR':
        bone(f'thigh{s}', P(f'thigh{s}') + Vector((0, 0, .04)), P(f'knee{s}'), 'hips'); bone(f'shin{s}', P(f'knee{s}'), P(f'ank{s}'), f'thigh{s}', True)
        bone(f'foot{s}', P(f'ank{s}'), P(f'toe{s}'), f'shin{s}', True); bone(f'arm{s}', P(f'sh{s}'), P(f'hand{s}'), 'chest')
        bone(f'ear{s}', P(f'ear{s}0'), P(f'ear{s}1'), 'head')

# ============================================================ build mesh
spec = SPECIES.get(SP)
if SP in SWIM:
    sw = SWIM[SP]; J, EDGES = swim_profile(sw['prof'], sw['S']); kind = 'swim'; ROOT = 'c4'
elif SP == 'penguin':
    J, EDGES = penguin_joints(); kind = 'penguin'; ROOT = 'hips'
elif SP == 'kangaroo':
    J, EDGES = kangaroo_joints(); kind = 'kangaroo'; ROOT = 'hips'
else:
    J, FT, HT = quad_joints(spec['q']); EDGES = list(QEDGES); kind = 'quad'; ROOT = 'pelvis'
    if spec['extra_bones'] == 'trunk':
        n0 = Vector(J['nose'][0])
        for i, (dx, dz, r) in enumerate([(.05, -.1, .055), (.06, -.22, .045), (.065, -.34, .035), (.075, -.42, .03)], 1):
            tl_ = spec['q'].get('trunkL', 1.0); J[f'trunk{i}'] = (tuple(n0 + Vector((dx * tl_, 0, dz * tl_))), r, r)
        EDGES += [('nose', 'trunk1'), ('trunk1', 'trunk2'), ('trunk2', 'trunk3'), ('trunk3', 'trunk4')]

# ---- body surface: smooth-blended capsules/ellipsoids → marching cubes (robust for bulky animals)
from skimage.measure import marching_cubes
from mathutils import Euler
def rc_sdf(P, a, b, r1, r2):
    ba = b - a; pa = P - a; h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - (r1 + (r2 - r1) * h)
def el_sdf(P, c, r, R=None):
    q = P - c
    if R is not None: q = q @ R          # rows: world->local with R orthonormal (columns = local axes)
    k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
def smin(a, b, k):
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h)
parts = []   # (fn, k)
jr = lambda n: math.sqrt(J[n][1] * J[n][2])
# eyes are real bumps on the head (painted glossy black with a glint in paint() below)
eyes = []
if kind == 'quad':
    pv, hd = Vector(J['poll'][0]), Vector(J['head'][0]); eq = spec['q'].get('eye', (.3, .8, .32))
    for sy in (1, -1): eyes.append(np.array([hd.x + eq[0] * (hd.x - pv.x), sy * J['head'][1] * eq[1], hd.z + J['head'][2] * eq[2]]))
elif kind == 'swim': ex, ey, ez = sw['eye']; eyes = [np.array([ex, sy * ey, ez]) * sw['S'] for sy in (1, -1)]
elif kind == 'penguin': eyes = [np.array([.07, sy * .06, .55]) for sy in (1, -1)]
else: eyes = [np.array([.165, sy * .043, .68]) for sy in (1, -1)]
ER = (J['head'][1] if 'head' in J else .05) * (spec['q'].get('eyeR', .25) if kind == 'quad' else .24)
if kind == 'swim': ER = .012 * sw['S']
def frame_from(v, fwd=(1, 0, 0)):
    z = np.array(v, float); z /= np.linalg.norm(z); x = np.array(fwd, float); x -= z * (x @ z); x /= np.linalg.norm(x); y = np.cross(z, x)
    return np.stack([x, y, z], 1)   # columns = local axes
for a, b in EDGES:
    if kind == 'quad' and a.startswith(('poll', 'ear')) and b.startswith('ear'): continue   # ears are flat shapes, added below
    pa, pb_ = np.array(J[a][0]), np.array(J[b][0])
    parts.append((lambda P, pa=pa, pb_=pb_, ra=jr(a), rb=jr(b): rc_sdf(P, pa, pb_, ra, rb), None))
if kind == 'quad':
    qq = spec['q']
    # skull: a rounded cranium and a cheek mass, so the head is a head rather than the end of a tube
    hd_ = np.array(J['head'][0]); hl_ = np.linalg.norm(np.array(J['nose'][0]) - np.array(J['poll'][0]))
    parts.append((lambda P, c=hd_ + np.array([-hl_ * .04, 0, J['head'][2] * .12]), r=np.array([hl_ * .4, J['head'][1] * 1.08, J['head'][2] * 1.1]): el_sdf(P, c, r), .012))
    for sy in (1, -1):
        s0 = np.array(J[f'ear{"L" if sy > 0 else "R"}0'][0]); s1 = np.array(J[f'ear{"L" if sy > 0 else "R"}1'][0]); v = s1 - s0
        er_ = J[f'ear{"L" if sy > 0 else "R"}0'][1]; R = frame_from(v)
        parts.append((lambda P, c=s0 + v * .45, r=np.array([er_ * qq.get('earT', .32), er_ * qq.get('earW', .95), np.linalg.norm(v) * .7 + er_ * .3]), R=R: el_sdf(P, c, r, R), .008))
    for e_ in eyes:
        parts.append((lambda P, c=e_, r=ER * .95: np.linalg.norm(P - c, axis=1) - r, .004))
    paw_ = qq.get('paw', False); lr_ = qq['lr']
    for n in J:
        if n.startswith(('fhoof', 'hhoof')):
            c = np.array(J[n][0]) + np.array([lr_ * (.35 if paw_ else .12), 0, lr_ * .12])
            r = np.array([lr_ * 1.2, lr_ * .95, lr_ * .5]) if paw_ else np.array([lr_ * .92, lr_ * .8, lr_ * .62])
            parts.append((lambda P, c=c, r=r: el_sdf(P, c, r), .006))
    for n, lx in (('pelvis', .3), ('loin', .26), ('belly', .28), ('chest', .26)):
        c = np.array(J[n][0]); parts.append((lambda P, c=c, r=np.array([qq['L'] * lx + J[n][1] * .4, J[n][1], J[n][2]]): el_sdf(P, c, r), None))
    for typ, c, s, rot in spec['attach'](J):
        R = np.array(Euler(rot).to_matrix()); c = np.array(c)
        if typ == 'sph':
            parts.append((lambda P, c=c, s=np.array(s), R=R: el_sdf(P, c, s, R), .02))
        else:
            ax = R @ np.array([0, 0, 1.0]); base = c - ax * s[2]; tip = c + ax * s[2]
            parts.append((lambda P, base=base, tip=tip, r=s[0]: rc_sdf(P, base, tip, r, r * .15), .008))
if kind == 'swim':
    for typ, c, s_, rot in sw['att']:
        R_ = np.array(Euler(rot).to_matrix()); c = np.array(c) * sw['S']; s_ = np.array(s_) * sw['S']
        parts.append((lambda P, c=c, s_=s_, R_=R_: el_sdf(P, c, s_, R_), .015 * sw['S']))
pts = np.array([J[n][0] for n in J]); rad = max(max(J[n][1], J[n][2]) for n in J)
if kind == 'swim': rad = max(rad, .25 * sw['S'])
lo = pts.min(0) - rad - .12; hi = pts.max(0) + rad + .12
step = float((hi - lo).max() / 190)
gx, gy, gz = [np.arange(lo[i], hi[i], step) for i in range(3)]
X, Y, Z = np.meshgrid(gx, gy, gz, indexing='ij'); P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
K = .035 * max(.6, min(1.6, rad / .1)) * (spec['q'].get('k', .6) if kind == 'quad' else .8)
d = None
for fn, k in parts:
    v = fn(P); d = v if d is None else smin(d, v, k or K)
vol = d.reshape(X.shape)
verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(step, step, step))
verts += lo
me = bpy.data.meshes.new(SP)
me.from_pydata(verts.tolist(), [], faces[:, ::-1].tolist()); me.update()
body = bpy.data.objects.new(SP, me); scene.collection.objects.link(body)
bpy.context.view_layer.objects.active = body; body.select_set(True)
dec = body.modifiers.new('dec', 'DECIMATE'); dec.ratio = min(1.0, 14000 / max(1, len(me.polygons)))
bpy.ops.object.modifier_apply(modifier='dec')
sm = body.modifiers.new('smooth', 'LAPLACIANSMOOTH'); sm.iterations = 3; sm.lambda_factor = .4
bpy.ops.object.modifier_apply(modifier='smooth')
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()

bpy.context.view_layer.objects.active = body
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.ops.object.shade_smooth()
me = body.data
print(SP, 'verts', len(me.vertices))

# ============================================================ rig
arm_data = bpy.data.armatures.new(SP + 'Rig'); rig = bpy.data.objects.new(SP + 'Rig', arm_data); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name); b.head = head; b.tail = tail; b.roll = 0
    if parent: b.parent = eb[parent]; b.use_connect = connect
    return b
if kind == 'quad':
    quad_bones(J, eb, bone)
    if spec['extra_bones'] == 'trunk':
        P = lambda n: Vector(J[n][0])
        bone('trunk1', P('nose'), P('trunk2'), 'head'); bone('trunk2', P('trunk2'), P('trunk3'), 'trunk1', True); bone('trunk3', P('trunk3'), P('trunk4'), 'trunk2', True)
elif kind == 'swim':
    P_ = lambda n: Vector(J[n][0]); N = len(sw['prof'])
    bone('root', Vector((0, 0, 0)), Vector((0, 0, .1)))
    bone('body', P_('c4'), P_('c3'), 'root')
    bone('head', P_('c3'), P_('c0'), 'body', True)
    prev = 'body'
    for i in range(4, N - 1):
        nm = f'tail{i-3}'; bone(nm, P_(f'c{i}'), P_(f'c{i+1}'), prev, prev != 'body'); prev = nm
    if SP == 'turtle':
        for nm, a, b in (('finFL', (.07, .08, 0), (.07, .38, -.02)), ('finFR', (.07, -.08, 0), (.07, -.38, -.02)), ('finBL', (-.12, .08, 0), (-.2, .2, -.02)), ('finBR', (-.12, -.08, 0), (-.2, -.2, -.02))):
            bone(nm, Vector(a) * sw['S'], Vector(b) * sw['S'], 'body')
    else:
        for nm, a, b in (('finL', (.06, .05, -.03), (.12, .16, -.07)), ('finR', (.06, -.05, -.03), (.12, -.16, -.07))):
            bone(nm, Vector(a) * sw['S'], Vector(b) * sw['S'], 'body')
elif kind == 'penguin': penguin_bones(J, eb, bone)
else: kangaroo_bones(J, eb, bone)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

if kind == 'quad':
    G = {g.name: g for g in body.vertex_groups}
    for gname in ('chest', 'hips'):
        if gname not in G: G[gname] = body.vertex_groups.new(name=gname)
    for v in body.data.vertices:
        x, y, z = v.co
        ws = {body.vertex_groups[e.group].name: e.weight for e in v.groups}
        moved = 0.0
        for gname in list(ws):
            if gname.startswith(('fUpper', 'hUpper')):
                top = (FT if gname[0] == 'f' else HT) * .82
                k = min(1.0, max(0.0, (top - z) / (top * .2 + .01)))
                nw = ws[gname] * k; moved += ws[gname] - nw; G[gname].add([v.index], nw, 'REPLACE')
        if moved > 1e-4:
            tgt = 'chest' if x > 0 else 'hips'
            G[tgt].add([v.index], ws.get(tgt, 0.0) + moved, 'REPLACE')

# ============================================================ texture
bpy.context.view_layer.objects.active = body; bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=.012); bpy.ops.object.mode_set(mode='OBJECT')
for k_, v_ in SWIM.items(): pass
COATS = {'giraffe': coat_giraffe, 'lion': coat_lion, 'tiger': coat_tiger, 'elephant': coat_elephant, 'polar': coat_polar, 'camel': coat_camel,
         'mammoth': coat_mammoth, 'sabre': coat_sabre,
         'fox': coat_fox, 'bison': coat_bison, 'monkey': coat_monkey, 'gorilla': coat_gorilla, 'kangaroo': coat_kangaroo, 'penguin': coat_penguin}
coatf = (lambda p, n, J: SWIM[SP]['coat'](p, n, J, SWIM[SP]['S'])) if kind == 'swim' else COATS[SP]
def paint(p, n):
    col = coatf(p, n, J)
    if kind == 'quad':
        x, y, z = p.T; mz, nz = np.array(J['muzzle'][0]), np.array(J['nose'][0]); mr0, mr1 = J['muzzle'][1], J['muzzle'][2]
        hd_ = np.array(J['head'][0]); ax = nz - hd_; ln = np.linalg.norm(ax); ax /= ln
        t = (p - hd_) @ ax; off = p - hd_ - t[:, None] * ax    # position along / around the muzzle axis
        up = np.array([-ax[2], 0, ax[0]]); v = off @ up
        if spec['q'].get('mouth', True):
            mouth = (t > ln * .45) & (t < ln * 1.02) & (np.abs(v + mr1 * .42) < mr1 * .1) & (np.abs(y) > mr0 * .25) & (np.abs(y) < mr0 * 1.4)
            col = np.where(mouth[:, None], col * .45, col)
        if spec['q'].get('nostril', True):
            for sy in (1, -1):
                d = np.linalg.norm((p - (nz + ax * mr0 * .35 + up * mr1 * .25 + np.array([0, sy * mr0 * .42, 0]))) / np.array([1, 1, 1]), axis=1)
                col = np.where((d < mr0 * .2)[:, None], col * .3, col)
        if spec['q'].get('nose'):
            d = np.linalg.norm((p - (nz + ax * mr0 * .55 + up * mr1 * .3)) / np.array([1, 1.5, 1]), axis=1)
            col = np.where((d < mr0 * spec['q'].get('noseR', .5))[:, None], C(spec['q']['nose']), col)
        # inside of the ears, a little darker and pinker
        for s_ in 'LR':
            e0 = np.array(J[f'ear{s_}0'][0]); e1 = np.array(J[f'ear{s_}1'][0]); c = e0 + (e1 - e0) * .5
            inner = (np.linalg.norm(p - c, axis=1) < np.linalg.norm(e1 - e0) * .55) & (n[:, 0] > .35)
            col = np.where(inner[:, None], col * np.array([.72, .6, .58]), col)
    for e in eyes:
        d = np.linalg.norm(p - e, axis=1)
        col = np.where(((d >= ER) & (d < ER * 1.5))[:, None], col * .5, col)
        col = np.where((d < ER * 1.08)[:, None], C('#0b0908'), col)
        g_ = np.linalg.norm(p - (e + np.array([ER * .35, np.sign(e[1]) * ER * .45, ER * .5])), axis=1)
        col = np.where((g_ < ER * .36)[:, None], C('#ffffff'), col)
    return shade_bake(col, p, n)

TEX = 1024 if SP in ('orca', 'turtle', 'elephant', 'giraffe', 'tiger', 'lion', 'bison', 'gorilla') else 512
uvl = me.uv_layers.active.data; img = np.zeros((TEX, TEX, 3), np.float32); mask = np.zeros((TEX, TEX), bool)
me.calc_loop_triangles()
co = np.array([v.co[:] for v in me.vertices]); vn = np.array([v.normal[:] for v in me.vertices])
for tri in me.loop_triangles:
    uv = np.array([uvl[l].uv[:] for l in tri.loops]) * (TEX - 1); vi = list(tri.vertices)
    x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1)); px = np.stack([xs.ravel() + .5, ys.ravel() + .5], 1)
    a, b, c = uv; v0, v1 = b - a, c - a; d = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(d) < 1e-9: continue
    q2 = px - a; l1 = (q2[:, 0] * v1[1] - v1[0] * q2[:, 1]) / d; l2 = (v0[0] * q2[:, 1] - q2[:, 0] * v0[1]) / d; l0 = 1 - l1 - l2
    m = (l0 >= -.02) & (l1 >= -.02) & (l2 >= -.02)
    if not m.any(): continue
    Lb = np.stack([l0[m], l1[m], l2[m]], 1); pos = Lb @ co[vi]; nor = Lb @ vn[vi]; nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
    X = np.clip(xs.ravel()[m], 0, TEX - 1); Y = np.clip(ys.ravel()[m], 0, TEX - 1)
    img[Y, X] = paint(pos, nor); mask[Y, X] = True
for _ in range(6):
    grow = ~mask & (np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1))
    for sh in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
        src = np.roll(img, sh[0], sh[1]); smk = np.roll(mask, sh[0], sh[1]); s2 = grow & smk; img[s2] = src[s2]
    mask |= grow
bimg = bpy.data.images.new(SP + '_coat', TEX, TEX, alpha=False)
rgba = np.ones((TEX, TEX, 4), np.float32); rgba[..., :3] = img; bimg.pixels.foreach_set(rgba.ravel())
bimg.filepath_raw = os.path.join(OUT, SP + '_coat.png'); bimg.file_format = 'PNG'; bimg.save()
mat = bpy.data.materials.new(SP + 'Coat'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bimg; nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = .85
me.materials.clear(); me.materials.append(mat)
for poly in me.polygons: poly.material_index = 0

# ============================================================ animation
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE')
pb = rig.pose.bones
for b in pb: b.rotation_mode = 'QUATERNION'
REST = {b.name: rig.data.bones[b.name].matrix_local.to_3x3() for b in pb}
def wrot(name, axis, ang):
    M = REST[name]; return (M.inverted() @ Matrix.Rotation(ang, 3, axis) @ M).to_quaternion()
def setr(name, axis, ang):
    if name in pb: pb[name].rotation_quaternion = wrot(name, axis, ang) @ pb[name].rotation_quaternion
Yx = Vector((0, 1, 0)); Xx = Vector((1, 0, 0)); Zx = Vector((0, 0, 1))
def make_action(name, frames, fn):
    rig.animation_data_create(); act = bpy.data.actions.new(name); act.use_fake_user = True; rig.animation_data.action = act
    for f in range(frames + 1):
        t = f / frames
        for b in pb: b.rotation_quaternion = Quaternion(); b.location = Vector()
        fn(t)
        for b in pb:
            b.keyframe_insert('rotation_quaternion', frame=f)
            if b.name == 'root': b.keyframe_insert('location', frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); tr.mute = True
    rig.animation_data.action = None

if kind == 'quad':
    q = spec['q']
    stride = .34 * (1.0 if q['lr'] < .06 else .7); lift = .55 * (.6 if SP in ('elephant', 'bison') else 1)
    cyc = 24 if SP not in ('elephant',) else 32
    def leg(pre, s, ph):
        sw = math.sin(ph * TAU); up = max(0, math.sin(ph * TAU + .9))
        if pre == 'f':
            setr(f'fUpper{s}', Yx, -sw * stride * .7); setr(f'fLower{s}', Yx, up * lift * .9); setr(f'fCannon{s}', Yx, -up * lift * .2); setr(f'fHoof{s}', Yx, up * lift * .6)
        else:
            setr(f'hUpper{s}', Yx, -sw * stride * .6); setr(f'hLower{s}', Yx, -up * lift * .6); setr(f'hCannon{s}', Yx, up * lift * .7); setr(f'hHoof{s}', Yx, up * lift * .5)
    def tail(t, amp):
        setr('tail1', Zx, amp * math.sin(t * TAU)); setr('tail2', Zx, amp * 1.2 * math.sin(t * TAU - .8)); setr('tail3', Zx, amp * 1.3 * math.sin(t * TAU - 1.6))
    def trunk(t, amp, curl=0):
        for i, k in enumerate(('trunk1', 'trunk2', 'trunk3'), 1): setr(k, Yx, curl * i * .25 + amp * math.sin(t * TAU + i * .7)); setr(k, Zx, amp * .6 * math.sin(t * TAU * .5 + i))
    def walk(t):
        leg('h', 'L', t); leg('f', 'L', t + .25); leg('h', 'R', t + .5); leg('f', 'R', t + .75)
        pb['root'].location = Vector((0, 0, .008 * math.sin(t * TAU * 2)))
        setr('spine', Zx, .04 * math.sin(t * TAU)); setr('neck1', Yx, .05 * math.sin(t * TAU * 2 + 1)); setr('head', Yx, -.04 * math.sin(t * TAU * 2 + 1))
        tail(t, .22); trunk(t, .12)
    def idle(t):
        b = math.sin(t * TAU); pb['root'].location = Vector((0, 0, .003 * b))
        setr('neck1', Yx, .04 * b); setr('head', Zx, .15 * math.sin(t * TAU)); setr('head', Yx, .04 * b)
        sw = math.sin(t * TAU * 3) if .4 < t < .75 else 0; tail(t * 3 if sw else 0, .4 * (1 if sw else 0))
        fl = math.sin(t * TAU * 4) if t > .8 else 0; setr('earL', Xx, .4 * fl); setr('earR', Xx, -.2 * fl)
        trunk(t, .18, .4)
    def graze(t):
        chew = math.sin(t * TAU * 6)
        down = 1.0 if q['nl'] > .2 else .6
        setr('neck1', Yx, .9 * down); setr('neck2', Yx, .45 * down); setr('head', Yx, .12 + .05 * chew); setr('head', Zx, .12 * math.sin(t * TAU))
        if SP == 'giraffe':
            for s, sg in (('L', 1), ('R', -1)): setr(f'fUpper{s}', Xx, sg * -.18)
        setr('fUpperL', Yx, -.08); setr('fUpperR', Yx, .08); tail(t * 2, .3); trunk(t * 2, .25, 1.2)
    def lie(t):
        br = math.sin(t * TAU) * .004
        pb['root'].location = Vector((0, 0, -(q['Zp'] - q['h'] * .95) + br))
        for s in 'LR':
            setr(f'fUpper{s}', Yx, -.9); setr(f'fLower{s}', Yx, 2.2); setr(f'fCannon{s}', Yx, -.3)
            setr(f'hUpper{s}', Yx, .9); setr(f'hLower{s}', Yx, -1.6); setr(f'hCannon{s}', Yx, 1.9)
        setr('neck1', Yx, .2); setr('head', Yx, .2); setr('head', Zx, .2); tail(0, 0); setr('tail1', Zx, .4); trunk(t, .1, .6)
    make_action('walk', cyc, walk); make_action('idle', 96, idle); make_action('graze', 72, graze); make_action('lie', 96, lie)
elif kind == 'penguin':
    def walk(t):
        s = math.sin(t * TAU)
        setr('hips', Xx, .14 * s); setr('chest', Xx, -.05 * s)
        setr('legL', Yx, -.4 * s); setr('legR', Yx, .4 * s)
        pb['root'].location = Vector((0, 0, .01 * abs(math.sin(t * TAU))))
        setr('armL', Xx, .5 + .1 * s); setr('armR', Xx, -.5 + .1 * s); setr('head', Zx, .1 * s)
    def idle(t):
        b = math.sin(t * TAU); setr('head', Zx, .3 * math.sin(t * TAU)); setr('head', Yx, .05 * b)
        flap = math.sin(t * TAU * 6) * .6 if .6 < t < .8 else 0; setr('armL', Xx, .2 + flap); setr('armR', Xx, -.2 - flap)
    def graze(t):
        pk = max(0, math.sin(t * TAU * 3)); setr('chest', Yx, .7 * pk); setr('head', Yx, .5 * pk)
    def lie(t):
        pb['root'].location = Vector((0, 0, -.09)); setr('hips', Yx, 1.35); setr('head', Yx, -.9); setr('armL', Xx, .9); setr('armR', Xx, -.9)
        setr('legL', Yx, -1.2); setr('legR', Yx, -1.2)
    make_action('walk', 16, walk); make_action('idle', 96, idle); make_action('graze', 48, graze); make_action('lie', 96, lie)
elif kind == 'swim':
    AX = Zx if sw['axis'] == 'Z' else Yx
    tails = [b.name for b in pb if b.name.startswith('tail')]
    def undulate(t, amp, speed=1):
        for k, nm in enumerate(tails, 1): setr(nm, AX, amp * (.4 + .5 * k / len(tails)) * math.sin(t * TAU * speed - k * .7))
        setr('head', AX, -amp * .25 * math.sin(t * TAU * speed + .6))
    def fins(t, amp, ph=0):
        for nm, sg in (('finL', 1), ('finR', -1), ('finFL', 1), ('finFR', -1), ('finBL', 1), ('finBR', -1)):
            if nm in pb: setr(nm, Xx, sg * amp * math.sin(t * TAU + ph + (0 if nm.startswith(('finF', 'finL', 'finR')) else 1.5)))
    if SP == 'turtle':
        def walk(t): fins(t, .7); setr('head', Zx, .08 * math.sin(t * TAU)); pb['root'].location = Vector((0, 0, .01 * math.sin(t * TAU * 2)))
        def idle(t): fins(t, .2); setr('head', Zx, .2 * math.sin(t * TAU))
        def graze(t): fins(t, .15); setr('head', Yx, .35 + .08 * math.sin(t * TAU * 5))
        def lie(t): fins(t, .05); setr('head', Yx, .1)
        def jump(t): fins(t * 2, .9)
    else:
        def walk(t): undulate(t, .32); fins(t, .15); pb['root'].location = Vector((0, 0, .006 * math.sin(t * TAU)))
        def idle(t): undulate(t, .12); fins(t, .08)
        def graze(t): undulate(t, .1); setr('head', Zx, .3 * math.sin(t * TAU)); setr('head', AX, .1 * math.sin(t * TAU * 4))
        def lie(t): undulate(t, .04)
        def jump(t):
            arc = math.sin(t * TAU)
            setr('body', Yx, -.35 * arc)
            for nm in tails: setr(nm, Yx, .3 * arc)
            setr('head', Yx, -.2 * arc); undulate(t * 2, .25)
    make_action('walk', 24, walk); make_action('idle', 96, idle); make_action('graze', 72, graze); make_action('lie', 96, lie); make_action('jump', 36, jump)
else:  # kangaroo hop
    def legs(fold):
        for s in 'LR': setr(f'thigh{s}', Yx, -.5 * fold); setr(f'shin{s}', Yx, 1.0 * fold); setr(f'foot{s}', Yx, -.55 * fold)
    def walk(t):
        ph = math.sin(t * TAU); air = max(0, ph)
        pb['root'].location = Vector((0, 0, .13 * air - .03 * max(0, -ph)))
        legs(.35 + .35 * max(0, -ph) - .25 * air)
        setr('hips', Yx, .25 * air); setr('tail1', Yx, .25 * ph); setr('tail2', Yx, .2 * ph); setr('head', Yx, -.15 * air)
        for s in 'LR': setr(f'arm{s}', Yx, -.3 * air)
    def idle(t):
        b = math.sin(t * TAU); legs(.3); setr('head', Zx, .25 * math.sin(t * TAU)); setr('earL', Yx, .3 * b); setr('earR', Yx, -.3 * b); setr('tail1', Zx, .05 * b)
    def graze(t):
        legs(.55); pb['root'].location = Vector((0, 0, -.05)); setr('hips', Yx, .9); setr('chest', Yx, .4); setr('head', Yx, .25 + .05 * math.sin(t * TAU * 6))
        for s in 'LR': setr(f'arm{s}', Yx, .6)
    def lie(t):
        pb['root'].location = Vector((0, 0, -.16)); legs(1.1); setr('hips', Yx, .5); setr('head', Yx, .25); setr('head', Zx, .3)
    make_action('walk', 20, walk); make_action('idle', 96, idle); make_action('graze', 72, graze); make_action('lie', 96, lie)

bpy.ops.object.mode_set(mode='OBJECT')
for b in pb: b.rotation_quaternion = Quaternion(); b.location = Vector()

path = os.path.join(OUT, SP + '.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True, export_skins=True, export_yup=True,
                          export_image_format='JPEG', export_animation_mode='NLA_TRACKS')
print(SP, 'KB', os.path.getsize(path) // 1024)
