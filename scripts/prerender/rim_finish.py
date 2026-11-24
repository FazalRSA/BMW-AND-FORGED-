"""Rim finish materials for the Cycles wheel layers and finish_calibrate.py: brushed metal, not a flat Principled colour.

The rim GLBs are four parts (Rim_Face_Spokes, Rim_Barrel, Center_Cap, Hardware_Bolts). `tag` gives each a role before the parts
are joined, so one rim keeps four material slots and `materials` fills them:
  face    spokes: grooves run along the spoke (radial), as the website photos show, plus a roughness grain across them
  barrel  spun grooves around the axle, a little darker (the photos' barrels are satin, never mirror)
  cap     spun brushing and the FORGED SA mark (scripts/prerender/forged_cap.png)
  lugs    dark steel
finish = [hex, metal, roughness, coat, coat_roughness, brush, grain, barrel_tone]; only the first four are required.
`brush` is the anisotropy (0 = none: the finish stays a plain colour, as gloss/satin black were), `grain` the +-roughness
spread of the streaks, `barrel_tone` multiplies the barrel's colour. The axle is the rim's local Y (glTF Z, face -Y).
"""
import math, os, re

DIR = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(DIR, 'forged_cap.png')


def role_of(name):
    n = name.lower()
    for key, role in (('cap', 'cap'), ('bolt', 'lugs'), ('hardware', 'lugs'), ('barrel', 'barrel')):
        if key in n: return role
    return 'face'


def tag(bpy, parts):
    """Before joining: replace each part's material with its role placeholder ('role:<role>')."""
    for o in parts:
        rl = 'all' if len(parts) == 1 else role_of(o.name)   # one mesh = the shipped rims: roles come from the geometry
        m = bpy.data.materials.get('role:' + rl) or bpy.data.materials.new('role:' + rl)
        if o.data.materials: o.data.materials[0] = m
        else: o.data.materials.append(m)


def cap_radius(parts):
    """The centre cap's radius (before joining; the parts' vertices are in rim space). A one-mesh rim has no cap part: 0.029 m,
    the shipped caps' size."""
    if len(parts) == 1: return 0.029
    return max((max(math.hypot(v.co.x, v.co.z) for v in o.data.vertices) for o in parts if role_of(o.name) == 'cap'), default=0.029)


def lin(hx):
    hx = hx.strip().lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', hx): raise SystemExit(f'{hx!r} is not a #rrggbb colour')
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))]


def _material(bpy, name, role, hx, met, rough, coat, coat_rough, brush, grain, tone, cap_r, rad, logo):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    col = lin(hx)
    b.inputs['Metallic'].default_value = float(met); b.inputs['Coat Weight'].default_value = float(coat)
    b.inputs['Coat Roughness'].default_value = float(coat_rough)
    if not brush:
        b.inputs['Base Color'].default_value = (*[c * (tone if role == 'barrel' else 1.0) for c in col], 1)
        b.inputs['Roughness'].default_value = float(rough)
        if role != 'all' and not (role == 'cap' and logo): return m

    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items(): setattr(n, k, v)
        return n
    def link(x, sock):
        if isinstance(x, (int, float)): sock.default_value = x
        elif isinstance(x, tuple): sock.default_value = x
        else: L.new(x, sock)
    def mt(op, a, c=None, clamp=False):
        n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
        link(a, n.inputs[0])
        if c is not None: link(c, n.inputs[1])
        return n.outputs[0]
    def mixv(kind, a, c, f, blend='MIX'):   # kind VECTOR / RGBA, factor f (number or socket)
        n = node('ShaderNodeMix', data_type=kind, blend_type=blend)
        ia, ib, out = (4, 5, 1) if kind == 'VECTOR' else (6, 7, 2)
        link(f, n.inputs[0]); link(a, n.inputs[ia]); link(c, n.inputs[ib])
        return n.outputs[out]
    def xyz(a, c, d):
        n = node('ShaderNodeCombineXYZ')
        for sock, v in zip(n.inputs, (a, c, d)): link(v, sock)
        return n.outputs[0]
    tc = node('ShaderNodeTexCoord')
    sx = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sx.inputs[0]); x, y, z = sx.outputs
    nx = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Normal'], nx.inputs[0])
    r = mt('SQRT', mt('ADD', mt('MULTIPLY', x, x), mt('MULTIPLY', z, z)))
    ang = mt('ARCTAN2', x, z)
    # spun = 1 where the grooves run around the axle (barrel, lip, cap), 0 on the spokes' face
    if role == 'all':   # the shipped rims are one mesh: find the barrel and cap by where they are
        side = mt('LESS_THAN', mt('ABSOLUTE', nx.outputs[1]), 0.6)
        barrel = mt('MULTIPLY', mt('GREATER_THAN', r, 0.8 * rad), side)
        capm = mt('LESS_THAN', r, cap_r)
        spun = mt('MAXIMUM', barrel, capm)
    else:
        barrel = 1.0 if role == 'barrel' else 0.0; capm = 1.0 if role == 'cap' else 0.0; spun = 1.0 if role != 'face' else 0.0
    inv_r = mt('DIVIDE', 1.0, mt('MAXIMUM', r, 1e-5))
    radial = xyz(mt('MULTIPLY', x, inv_r), 0.0, mt('MULTIPLY', z, inv_r))
    around = xyz(mt('MULTIPLY', z, inv_r), 0.0, mt('MULTIPLY', mt('MULTIPLY', x, inv_r), -1.0))
    # Cycles stretches the highlight along the tangent: grooves along the spokes (radial) take the circumferential
    # tangent, spun grooves the radial one
    tr = node('ShaderNodeVectorTransform', vector_type='VECTOR', convert_from='OBJECT', convert_to='WORLD')
    L.new(mixv('VECTOR', around, radial, spun), tr.inputs[0])
    if brush:
        L.new(tr.outputs[0], b.inputs['Tangent'])
        link(mt('MULTIPLY', float(brush), mt('SUBTRACT', 1.0, mt('MULTIPLY', barrel, 0.4))), b.inputs['Anisotropic'])
        # streak grain: constant along the grooves, varying across them
        co = mixv('VECTOR', xyz(mt('MULTIPLY', ang, 170.0), mt('MULTIPLY', r, 30.0), 0.0),
                  xyz(mt('MULTIPLY', mt('ADD', r, y), 900.0), mt('MULTIPLY', ang, 2.0), 0.0), spun)
        nz = node('ShaderNodeTexNoise', noise_dimensions='3D'); nz.inputs['Scale'].default_value = 1.0
        nz.inputs['Detail'].default_value = 3.0; nz.inputs['Roughness'].default_value = 0.65
        L.new(co, nz.inputs['Vector'])
        fac = nz.outputs['Fac']
        # roughness: base +- grain; colour: +-6 % so the satin face is not one flat tone
        link(mt('ADD', mt('MULTIPLY', mt('SUBTRACT', fac, 0.5), 2.0 * float(grain)), float(rough), clamp=True), b.inputs['Roughness'])
        bump = node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.0004
        L.new(fac, bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])   # the grooves catch the light
        tint = mt('ADD', 1.0, mt('MULTIPLY', mt('SUBTRACT', fac, 0.5), 0.12))
        tv = node('ShaderNodeCombineColor'); [L.new(tint, tv.inputs[i]) for i in range(3)]
        # the barrel is darker: base colour times (1 - barrel * (1 - tone))
        k = mt('SUBTRACT', 1.0, mt('MULTIPLY', barrel, 1.0 - float(tone)))
        kc = node('ShaderNodeCombineColor'); [L.new(k, kc.inputs[i]) for i in range(3)]
        out = mixv('RGBA', mixv('RGBA', (*col, 1), kc.outputs[0], 1.0, 'MULTIPLY'), tv.outputs[0], 1.0, 'MULTIPLY')
    else:
        out = (*col, 1)
    if (role in ('cap', 'all')) and logo:
        img = node('ShaderNodeTexImage'); img.image = bpy.data.images.load(LOGO, check_existing=True); img.extension = 'CLIP'
        img.image.colorspace_settings.name = 'sRGB'
        sc_ = 1.0 / (2 * cap_r)
        L.new(xyz(mt('ADD', mt('MULTIPLY', x, sc_), 0.5), mt('ADD', mt('MULTIPLY', z, sc_), 0.5), 0.0), img.inputs['Vector'])
        # white outside the cap, so only the cap carries the mark
        mark = mixv('RGBA', (1, 1, 1, 1), img.outputs['Color'], capm)
        out = mixv('RGBA', out, mark, 1.0, 'MULTIPLY')
    link(out, b.inputs['Base Color'])
    return m


def materials(bpy, name, finish, cap_r=0.029, rad=0.27, logo=True):
    """{role: material} for one finish list (see the module doc). logo=False leaves the cap unmarked (SIXNINE caps carry their own badge)."""
    hx, met, rough, coat = finish[:4]
    f = lambda i, d: float(finish[i]) if len(finish) > i else d
    cr, brush, grain, tone = f(4, 0.03), f(5, 0.0), f(6, 0.0), f(7, 1.0)
    out = {role: _material(bpy, f'{name}:{role}', role, hx, met, rough, coat, cr, brush, grain, tone, cap_r, rad, logo and os.path.exists(LOGO))
           for role in ('face', 'barrel', 'cap', 'all')}
    lug = bpy.data.materials.new(f'{name}:lugs'); lb = lug.node_tree.nodes['Principled BSDF']
    lb.inputs['Base Color'].default_value = (0.20, 0.20, 0.21, 1); lb.inputs['Metallic'].default_value = 1.0; lb.inputs['Roughness'].default_value = 0.38
    out['lugs'] = lug
    return out


def apply(rim, mats):
    """Fill a joined rim's slots from the role placeholders (slots must link to the object)."""
    for sl in rim.material_slots:
        src = rim.data.materials[sl.slot_index]
        sl.link = 'OBJECT'; sl.material = mats[src.name.split(':', 1)[1] if src and src.name.startswith('role:') else 'all']
