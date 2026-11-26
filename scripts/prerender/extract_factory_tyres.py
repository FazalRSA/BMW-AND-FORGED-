"""Pulls a car's own factory tyres out of its original licensed .blend into a small private file (the licence forbids serving the
model, but images rendered from it are fine; the output stays under .scratch/private/ or /opt, never in the repo).

    blender -b --python scripts/prerender/extract_factory_tyres.py -- <car.blend> <out factory_tyres.blend>

Keeps every mesh with a tyre material (TireColor*: the rubber body; Tire*: the moulded lettering), world transforms applied, parents
dropped, and nothing else. render_car.py --tyres-blend loads the result and resizes each sidewall to the rim that is fitted.
"""
import bpy, re, sys

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) != 2:
    sys.exit(__doc__)
src, dst = argv
bpy.ops.wm.open_mainfile(filepath=src)
body = re.compile(r'^TireColor(\.\d+)?$'); print_ = re.compile(r'^Tire(\.\d+)?$')
keep = []
for o in list(bpy.data.objects):
    if o.type == 'MESH' and any(s.material and (body.match(s.material.name) or print_.match(s.material.name)) for s in o.material_slots):
        keep.append(o)
if not keep:
    sys.exit(f'{src}: no tyre meshes (materials TireColor / Tire)')
for o in keep:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data = o.data.copy()          # single user: the same mesh may serve two wheels
    o.data.transform(mw); o.matrix_world = o.matrix_world.Identity(4)
    for m in list(o.modifiers): o.modifiers.remove(m)
    o['tyre_body'] = any(s.material and body.match(s.material.name) for s in o.material_slots)
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
bpy.data.use_autopack = False   # a lettering texture whose source file is missing on this machine must not stop the save
bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True)
print('EXTRACTED', len(keep), 'tyre meshes ->', dst)
