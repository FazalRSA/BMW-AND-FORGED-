"""Renders a rim face-on in a white product-photo studio with several finish recipes, to match a finish to the website's
photographs (public/images/wheels/<slug>/front.webp in the Forgedwebsite repo). The car stage is a black void, where a
metal has little to reflect, so a finish cannot be judged there: tune it here against the photo, then use the numbers in
FINISH_RECIPES (scripts/prerender/wheel-combos.ts).

  python scripts/prerender/finish_calibrate.py -- <rim.glb> <trials.json> <out dir> [--size 520] [--samples 48]

trials.json: [{"name": "a", "finish": ["#hex", metallic, roughness, clearcoat, coat_roughness?, brush?, grain?, barrel_tone?]}, ...]
(brush = anisotropy of the streaks, grain = +-roughness spread, barrel_tone = colour multiplier of the barrel; see rim_finish.py)
Writes <out dir>/<name>.png for each trial (the rim is decoded glTF in metres, axle on glTF Z, face +Z).
"""
import argparse, json, math, os, re, sys
import bpy, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rim_finish   # brushed face/barrel/cap/lugs materials, shared with render_car.py

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('rim'); ap.add_argument('trials'); ap.add_argument('out')
ap.add_argument('--size', type=int, default=520)
ap.add_argument('--samples', type=int, default=48)
a = ap.parse_args(argv)


def srgb_lin(hx):
    hx = hx.strip().lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', hx): sys.exit(f'{hx!r} is not a #rrggbb colour')
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))]


try:
    with open(a.trials) as f: TRIALS = json.load(f)
    for t in TRIALS: t['name'], t['finish'][3]
except (OSError, ValueError, KeyError, IndexError, TypeError) as e:
    sys.exit(f'{a.trials}: {e!r} (expected a list of {{name, finish}})')
try: os.makedirs(a.out, exist_ok=True)
except OSError as e: sys.exit(f'cannot create {a.out}: {e}')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
try: bpy.ops.import_scene.gltf(filepath=a.rim)
except RuntimeError as e: sys.exit(f'{a.rim}: {e}')
parts = [o for o in sc.objects if o.type == 'MESH']
if not parts: sys.exit(f'{a.rim}: no meshes')
for o in parts:
    mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world = mathutils.Matrix()
rim_finish.tag(bpy, parts); cap_r = rim_finish.cap_radius(parts)
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
rim = bpy.context.view_layer.objects.active
for o in [o for o in sc.objects if o.type != 'MESH' or o != rim]: bpy.data.objects.remove(o, do_unlink=True)
xs = [v.co.x for v in rim.data.vertices]; zs = [v.co.z for v in rim.data.vertices]
diameter = max(max(xs) - min(xs), max(zs) - min(zs))

# the white seamless of a product shot: a bright room (the metal reflects it) and two large soft lights
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = float(os.environ.get('CAL_WORLD', '0.5'))
# (the backdrop itself is transparent and composited on white by the sheet; the wheel reflects this bright room)
def softbox(name, loc, sx, sy, energy):
    l = bpy.data.lights.new(name, 'AREA'); l.shape = 'RECTANGLE'; l.size, l.size_y, l.energy = sx, sy, energy
    ob = bpy.data.objects.new(name, l); ob.location = loc; sc.collection.objects.link(ob)
    ob.rotation_euler = (mathutils.Vector((0, 0, 0)) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob
d = diameter
KEY = float(os.environ.get('CAL_KEY', '30')); FILL = float(os.environ.get('CAL_FILL', '8'))
BOX = float(os.environ.get('CAL_BOX', '1.0'))
softbox('key', (-d * 1.4, -d * 2.2, d * 1.6), d * 1.8 * BOX, d * 1.8 * BOX, KEY)
softbox('fill', (d * 1.8, -d * 2.0, -d * 0.2), d * 1.6 * BOX, d * 1.6 * BOX, FILL)
softbox('top', (0, -d * 0.9, d * 2.0), d * 2.2 * BOX, d * 1.2 * BOX, float(os.environ.get('CAL_TOP', '0')))

# face-on camera on the -Y side (glTF +Z imports as Blender -Y)
cam = bpy.data.cameras.new('c'); cam.lens = 120; cam.sensor_width = 36
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
dist = d * 1.12 * cam.lens / cam.sensor_width * 1.0
co.location = (0, -dist, 0); co.rotation_euler = (math.pi / 2, 0, 0)

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = a.size
sc.view_settings.view_transform = 'Standard'
sc.render.film_transparent = True   # the sheet composites on white, so only the wheel is measured
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

for t in TRIALS:
    rim_finish.apply(rim, rim_finish.materials(bpy, t['name'], t['finish'], cap_r, diameter / 2))
    path = os.path.join(a.out, t['name'] + '.png'); sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(path): sys.exit(f'no file written at {path}')
    print('rendered', path, flush=True)
