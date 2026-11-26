"""Exports one licensed car from its (fixed) .blend to a live-web GLB for the configurator engine.

    blender -b --python scripts/prerender/export_web_car.py -- <car.blend> <out.glb> [--paint <material, default CarPaint>] [--caliper <colour material, e.g. MetallicRed>] [--subsurf <painted-panel level, default 1>] [--smooth <degrees>]

The engine reads a car's own parts by name: the paint material is called Paint, tyres/discs by material (Tire*, *Disc*), calipers by a
material containing "caliper". It hides the stock rim by object name, and splits wheel meshes that span both sides of the car itself.
So this keeps every part, renames the paint material to Paint, and gives the objects that use the caliper-colour material their own copy
named Caliper_<colour>. Written output goes to .scratch/ (never commit it before the author's permission is filed in CREDITS.md).
"""
import bmesh, bpy, os, re, sys

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) < 2:
    sys.exit(__doc__)
src, dst = argv[0], argv[1]
opts = dict(zip(argv[2::2], argv[3::2]))
unknown = set(opts) - {'--paint', '--caliper', '--subsurf', '--smooth'}
if unknown or len(argv) % 2:
    sys.exit(f'unknown or unpaired options {sorted(unknown)}\n{__doc__}')
paint_name = opts.get('--paint', 'CarPaint')
cal_mat = opts.get('--caliper')
try:
    smooth_deg = float(opts['--smooth']) if '--smooth' in opts else None   # re-smooth painted panels by angle (degrees) before export
    paint_levels = int(opts.get('--subsurf', 1))   # subdivision level kept on painted panels (the viewport level of the .blend, Cycles uses 2)
except ValueError as e:
    sys.exit(f'bad --smooth/--subsurf value: {e}')
try:
    bpy.ops.wm.open_mainfile(filepath=src)
except RuntimeError as e:
    sys.exit(f'{src}: cannot open: {e}')

paint = bpy.data.materials.get(paint_name)
if not paint:
    sys.exit(f'{src}: no material {paint_name!r}; pass --paint <the body paint material>')
paint.name = 'Paint'

n_cal = 0
if cal_mat:
    base = bpy.data.materials.get(cal_mat)
    if not base:
        sys.exit(f'{src}: no material {cal_mat}')
    cal = base.copy(); cal.name = 'Caliper_' + re.sub(r'^Metallic', '', cal_mat)
    # The colour material is shared with trim elsewhere on the car: only parts next to a wheel hub (in the side view) become calipers.
    import mathutils
    def centre(o):
        pts = [o.matrix_world @ mathutils.Vector(v) for v in o.bound_box]
        return mathutils.Vector([sum(p[i] for p in pts) / 8 for i in range(3)])
    tyres = [o for o in bpy.data.objects if o.type == 'MESH' and any(s.material and re.match(r'TireColor', s.material.name) for s in o.material_slots)]
    if not tyres:
        sys.exit(f'{src}: no TireColor tyre to locate the wheels with')
    hubs = []
    for t in tyres:
        pts = [t.matrix_world @ mathutils.Vector(v) for v in t.bound_box]
        hubs.append(((min(p.y for p in pts) + max(p.y for p in pts)) / 2, (min(p.z for p in pts) + max(p.z for p in pts)) / 2,
                     (max(p.z for p in pts) - min(p.z for p in pts)) / 2))
    for o in bpy.data.objects:
        if o.type != 'MESH' or not any(s.material is base for s in o.material_slots):
            continue
        c = centre(o)
        if not any(((c.y - hy) ** 2 + (c.z - hz) ** 2) ** 0.5 < 0.5 * hr for hy, hz, hr in hubs):
            continue
        for s in o.material_slots:
            if s.material is base:
                s.material = cal; n_cal += 1
    if not n_cal:
        sys.exit(f'{src}: no part near a wheel uses {cal_mat}')

# The engine hides a car's stock rim by the object name "Rim" and keeps tyre, disc and caliper. Blendkit cars name their rim parts anything
# (rims_003, Wheel_001, Cylinder009), so every part at a wheel hub that is not tyre, disc or caliper becomes Rim_<name>.
def hub_parts():
    import mathutils
    tyres = [o for o in bpy.data.objects if o.type == 'MESH' and any(s.material and re.match(r'TireColor', s.material.name) for s in o.material_slots)]
    if not tyres:
        sys.exit(f'{src}: no TireColor tyre to locate the wheels with')
    hubs = []
    for t in tyres:
        pts = [t.matrix_world @ mathutils.Vector(v) for v in t.bound_box]
        hubs.append(((min(p.y for p in pts) + max(p.y for p in pts)) / 2, (min(p.z for p in pts) + max(p.z for p in pts)) / 2,
                     (max(p.z for p in pts) - min(p.z for p in pts)) / 2))
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        pts = [o.matrix_world @ mathutils.Vector(v) for v in o.bound_box]
        cy = sum(p.y for p in pts) / 8; cz = sum(p.z for p in pts) / 8
        if any(((cy - hy) ** 2 + (cz - hz) ** 2) ** 0.5 < 0.45 * hr for hy, hz, hr in hubs):
            yield o

renamed = 0
for o in list(hub_parts()):
    names = [s.material.name for s in o.material_slots if s.material]
    if re.match(r'(Rim|Tire|Tyre|Brake)', o.name) or any(re.match(r'(TireColor|Tire$|Tire\.|BrakeDisc|Caliper_)', n) for n in names):
        continue
    o.name = 'Rim_' + o.name; renamed += 1
if not renamed and not any(re.match(r'Rim', o.name) for o in bpy.data.objects):
    sys.exit(f'{src}: found no rim parts at the wheel hubs')
print('rim parts named Rim_*:', renamed)

# Textures the download did not include (zero-size images, e.g. the M3's carbon weave and a tyre sidewall photo) break the exporter and
# the optimizer: drop those image nodes so the shader falls back to its plain values.
dropped = 0
for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    for node in [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE']:
        if node.image is None or node.image.size[0] == 0 or node.image.size[1] == 0:   # size loads lazily-read packed images first
            mat.node_tree.nodes.remove(node); dropped += 1
if dropped:
    print('dropped', dropped, 'image nodes without data')

# The engine's own-tyre path (greyCarTyre) sets the tyre colour to 5.5 and expects a dark base-colour TEXTURE to scale it; with a plain colour
# the rubber comes out flat light grey. So the tyre materials get a tiny near-black rubber texture (sRGB 18, about 0.006 linear).
import struct, tempfile, zlib
def rubber_png(path, v=18, n=4):
    # not perfectly flat: gltf-transform folds a uniform texture back into a base-colour factor, which the engine's tyre path cannot use
    raw = b''.join(b'\x00' + b''.join(bytes([v + (x + y) % 3] * 3) for x in range(n)) for y in range(n))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
rubber_path = os.path.join(tempfile.mkdtemp(), 'rubber.png')
try:
    rubber_png(rubber_path)
except OSError as e:
    sys.exit(f'cannot write the rubber texture: {e}')
try:
    rubber = bpy.data.images.load(rubber_path)
    rubber.colorspace_settings.name = 'sRGB'; rubber.pack()
except RuntimeError as e:
    sys.exit(f'cannot load the rubber texture {rubber_path}: {e}')
for mat in bpy.data.materials:
    if mat.node_tree and re.match(r'(TireColor|Tire)(\.\d+)?$', mat.name):
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf and not bsdf.inputs['Base Color'].links:
            tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = rubber
            mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

# Triangle budget (prepared cars are 250-330k; one level on trim took the X3 to 1.3M): painted panels keep --subsurf levels, the rest none.
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    painted = any(s.material is paint for s in o.material_slots)
    level = paint_levels if painted else 0
    for m in o.modifiers:
        if m.type == 'SUBSURF':
            m.levels = level

if smooth_deg is not None:
    import math
    hub_names = {o.name for o in hub_parts()}
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name not in hub_names:   # every body part, not only the paint: trim and bumpers crumpled too
            o.select_set(True); bpy.context.view_layer.objects.active = o
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_deg))
    except RuntimeError as e:
        sys.exit(f'{src}: shade smooth failed: {e}')

# One mesh per wheel part and side: axle meshes that span both sides of the car are cut at the centre line (engine corners are per side).
for o in [o for o in bpy.data.objects if o.type == 'MESH' and re.match(r'^(Tire|Brake|Rim|Wheel_Logo)', o.name)]:
    if o.modifiers:   # bake the (level-0) modifiers first: the cut below works on the real mesh
        dg = bpy.context.evaluated_depsgraph_get()
        o.data = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        for m in list(o.modifiers): o.modifiers.remove(m)
    if not o.data.polygons:
        continue
    xs = [(o.matrix_world @ v.co).x for v in o.data.vertices]
    if not (min(xs) < -0.05 and max(xs) > 0.05):
        continue
    other = o.copy(); other.data = o.data.copy(); other.name = o.name + '_L'
    o.users_collection[0].objects.link(other)
    for ob, keep_pos in ((o, True), (other, False)):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if ((ob.matrix_world @ f.calc_center_median()).x >= 0) != keep_pos]
        if not kill or len(kill) == len(bm.faces):   # a cut that would leave nothing (or cut nothing): keep the mesh as it is
            bm.free(); continue
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data); bm.free()

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.select_set(o.type in ('MESH', 'EMPTY'))
try:
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_image_format='AUTO', export_materials='EXPORT')
except RuntimeError as e:
    sys.exit(f'{src}: glTF export failed: {e}')
if not os.path.isfile(dst) or os.path.getsize(dst) < 100_000:
    sys.exit(f'{src}: export wrote no usable file at {dst}')
print('EXPORTED', dst, 'caliper slots renamed:', n_cal)
