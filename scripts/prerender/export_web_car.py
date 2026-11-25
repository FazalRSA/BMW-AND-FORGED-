"""Exports one licensed car from its (fixed) .blend to a live-web GLB for the configurator engine.

    blender -b --python scripts/prerender/export_web_car.py -- <car.blend> <out.glb> [front|rear caliper material to rename, e.g. MetallicRed]

The engine reads a car's own parts by name: the paint material is called Paint, tyres/discs by material (Tire*, *Disc*), calipers by a
material containing "caliper". It hides the stock rim by object name, and splits wheel meshes that span both sides of the car itself.
So this keeps every part, renames the paint material to Paint, and gives the objects that use the caliper-colour material their own copy
named Caliper_<colour>. Written output goes to .scratch/ (never commit it before the author's permission is filed in CREDITS.md).
"""
import bpy, re, sys

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) < 2:
    sys.exit(__doc__)
src, dst = argv[0], argv[1]
cal_mat = argv[2] if len(argv) > 2 else None
bpy.ops.wm.open_mainfile(filepath=src)

paint = bpy.data.materials.get('CarPaint')
if not paint:
    sys.exit(f'{src}: no CarPaint material (name the body paint "CarPaint" or extend this script)')
paint.name = 'Paint'

n_cal = 0
if cal_mat:
    base = bpy.data.materials.get(cal_mat)
    if not base:
        sys.exit(f'{src}: no material {cal_mat}')
    cal = base.copy(); cal.name = 'Caliper_' + re.sub(r'^Metallic', '', cal_mat)
    for o in bpy.data.objects:
        if o.type != 'MESH' or not re.match(r'^Brake', o.name):
            continue
        for s in o.material_slots:
            if s.material is base:
                s.material = cal; n_cal += 1
    if not n_cal:
        sys.exit(f'{src}: no Brake* object uses {cal_mat}')

# Triangle budget (prepared cars are 250-330k): subdivision stays on for painted panels only, everything else exports at its base mesh.
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    painted = any(s.material is paint for s in o.material_slots)
    for m in o.modifiers:
        if m.type == 'SUBSURF':
            m.levels = 1 if painted else 0

# One mesh per wheel part and side: axle meshes that span both sides of the car are cut at the centre line (engine corners are per side).
import bmesh
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
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data); bm.free()

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.select_set(o.type in ('MESH', 'EMPTY'))
import os
try:
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_image_format='WEBP', export_materials='EXPORT')
except RuntimeError as e:
    sys.exit(f'{src}: glTF export failed: {e}')
if not os.path.isfile(dst) or os.path.getsize(dst) < 100_000:
    sys.exit(f'{src}: export wrote no usable file at {dst}')
print('EXPORTED', dst, 'caliper slots renamed:', n_cal)
