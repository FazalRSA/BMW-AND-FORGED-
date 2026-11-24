"""Sidewall lettering for the rendered tyres: a white-on-transparent strip that wraps once round the tyre (u = around, v = bead to
shoulder), drawn from a car's factory tyre spec (brand, model, size). Plain Inter type, not the makers' own wordmarks.

    from tyre_label import make
    png = make('PIRELLI', 'P ZERO', '295/35 R21', '/tmp/x.png')
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 4096, 512
FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
FONT_M = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'


def _font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError as e:
        raise SystemExit(f'tyre_label: font {path}: {e}')


def make(brand, model, size, path):
    """Writes the strip to `path` (PNG with alpha) and returns it. The text blocks sit on the middle band of the sidewall (v 0.35-0.8),
    repeated twice round the tyre so the lettering reads at any angle."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    big, mid, small = _font(FONT, 150), _font(FONT, 78), _font(FONT_M, 56)
    blocks = [(brand.upper(), big), (model, mid), (size.upper(), mid), ('TUBELESS  RADIAL', small)]
    gap = 90
    widths = [d.textlength(t, font=f) for t, f in blocks]
    total = sum(widths) + gap * (len(blocks) - 1)
    for rep in range(2):
        x = rep * (W / 2) + (W / 2 - total) / 2
        for (t, f), w in zip(blocks, widths):
            bb = f.getbbox(t); y = H * 0.58 - (bb[1] + bb[3]) / 2
            d.text((x, y), t, font=f, fill=(255, 255, 255, 255)); x += w + gap
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    im.save(path)
    return path


def apply_to_material(bpy, mat, png, ri, r, sgn):
    """Prints the strip `png` on the outer sidewall of a tyre material (a copy of the rubber): `ri` is the bead radius, `r` the tread
    radius, `sgn` the side the wheel's face points to (+1 / -1 along the axle, X). The tyre is turned about X, so the angle round it
    is atan2(z, y) in object space and the height up the sidewall is the radius between bead and shoulder."""
    mat.use_nodes = True
    nt = mat.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    base = tuple(b.inputs['Base Color'].default_value)[:3]

    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items(): setattr(n, k, v)
        return n

    def mt(op, a, c=None, clamp=False):
        n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]

    tc = node('ShaderNodeTexCoord')
    sp = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sp.inputs[0]); x, y, z = sp.outputs
    nm = node('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Normal'], nm.inputs[0])
    ang = mt('ADD', mt('DIVIDE', mt('ARCTAN2', z, y), 6.2831853), 0.5)
    rad = mt('SQRT', mt('ADD', mt('MULTIPLY', y, y), mt('MULTIPLY', z, z)))
    v = mt('DIVIDE', mt('SUBTRACT', rad, ri), max(r - ri, 1e-4))
    u = ang if sgn < 0 else mt('SUBTRACT', 1.0, ang)       # the print reads the same way from outside on either side of the car
    uv = node('ShaderNodeCombineXYZ'); L.new(u, uv.inputs[0]); L.new(v, uv.inputs[1])
    img = node('ShaderNodeTexImage'); img.image = bpy.data.images.load(png, check_existing=True); img.extension = 'CLIP'
    img.image.colorspace_settings.name = 'sRGB'; L.new(uv.outputs[0], img.inputs['Vector'])
    side = mt('GREATER_THAN', mt('MULTIPLY', x, float(sgn)), 0.0)                 # the outer sidewall only
    flat = mt('GREATER_THAN', mt('ABSOLUTE', nm.outputs[0]), 0.5)                 # not the tread
    mask = mt('MULTIPLY', mt('MULTIPLY', side, flat), img.outputs['Alpha'])
    mix = node('ShaderNodeMix', data_type='RGBA', blend_type='MIX')
    mix.inputs[6].default_value = (*base, 1)
    mix.inputs[7].default_value = (0.30, 0.30, 0.31, 1)       # printed rubber: a lighter, matte grey, not white paint
    L.new(mask, mix.inputs[0]); L.new(mix.outputs[2], b.inputs['Base Color'])
    return mat
