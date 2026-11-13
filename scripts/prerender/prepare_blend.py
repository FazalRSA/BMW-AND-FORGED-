"""Turns a licensed .blend car (e.g. from Blendkit) into a PRIVATE GLB the render pipeline can read.

The GLB is a build-time intermediate for export-scene.cjs and render_car.py: it goes in .scratch/ (git-ignored) and is
never copied to public/ or uploaded. Royalty Free cars may only reach the site as pre-rendered images
(docs/ADD_PREPARED_CAR.md, "Frames-only cars").

What it does:
  - if the model merges each axle's wheels into one mesh (two tyre meshes, each spanning both sides), first splits
    every mesh inside an axle's wheel zone into a left and a right half;
  - levels a car whose geometry is turned on the ground (both axles should run along X);
  - finds the four wheels from the tyres (objects using a material matching --tyre-mat), and renames every mesh that
    sits inside a wheel (tyre, rim, brake, caps, logos) to wheel_<corner>_<n>, so the engine's DEFAULT_HIDE finds four
    wheels and swaps in the forged ones;
  - renames meshes whose material matches --paint-mat to paint_<n>, so the engine's paint regex finds the body;
  - drops meshes using a material matching --drop-mat (default: the model's own number plates, which would sit
    behind the engine's FORGED plates, as on the other cars);
  - exports glTF (textures embedded) with no cameras, lights or animation.

  blender -b car.blend --python scripts/prerender/prepare_blend.py -- out.glb [--tyre-mat Tire] [--paint-mat "Car paint"]
"""
import argparse, math, os, re, sys
import bpy, bmesh, mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--tyre-mat', default=r'^tyre$|^tire$', help='regex (case-insensitive) of the tyre tread material')
ap.add_argument('--paint-mat', default=r'car ?paint', help='regex (case-insensitive) of the body paint material')
ap.add_argument('--drop-mat', default=r'number ?plate|licen[cs]e', help='regex (case-insensitive) of materials whose meshes are left out')
ap.add_argument('--margin', type=float, default=0.12, help='metres a wheel part may stick out of its tyre box')
a = ap.parse_args(argv)

if os.path.abspath(a.out).startswith(os.path.abspath('public') + os.sep):
    sys.exit('refusing to write a licensed model under public/: use .scratch/')

tyre_re, paint_re = re.compile(a.tyre_mat, re.I), re.compile(a.paint_mat, re.I)
drop_re = re.compile(a.drop_mat, re.I) if a.drop_mat else None
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.visible_get()]


def box(o):
    pts = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return (mathutils.Vector([min(p[i] for p in pts) for i in range(3)]),
            mathutils.Vector([max(p[i] for p in pts) for i in range(3)]))


def mats(o):
    return [s.material.name for s in o.material_slots if s.material]


def split_by_side(o, cx):
    """Splits a mesh that holds both wheels of an axle into a left and a right object (by face centre x). Some models
    merge each axle's tyres, rims and caps into one mesh, which no single wheel box can contain."""
    right = o.copy()
    right.data = o.data.copy()
    for col in o.users_collection:
        col.objects.link(right)
    for obj, keep_right in ((o, False), (right, True)):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        mw = obj.matrix_world
        doomed = [f for f in bm.faces if ((mw @ f.calc_center_median()).x > cx) != keep_right]
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
        bm.to_mesh(obj.data)
        bm.free()
    right.name = o.name + '_R'
    o.name = o.name + '_L'
    return right


def spans_sides(o, cx):
    mn, mx = box(o)
    return mn.x < cx - 0.2 and mx.x > cx + 0.2


tyres = [o for o in meshes if any(tyre_re.search(m) for m in mats(o))]
if len(tyres) == 2 and all(spans_sides(t, 0.0) for t in tyres):
    # One tyre mesh per axle: split every mesh that lies inside an axle's zone and reaches both sides
    cx = sum((box(t)[0].x + box(t)[1].x) / 2 for t in tyres) / 2
    zones = [box(t) for t in tyres]
    for o in list(meshes):
        mn, mx = box(o)
        inside = any(all(mn[k] >= zmn[k] - a.margin and mx[k] <= zmx[k] + a.margin for k in range(3)) for zmn, zmx in zones)
        if inside and spans_sides(o, cx):
            meshes.append(split_by_side(o, cx))
            print('split per side:', o.name)
    bpy.context.view_layer.update()  # the halves' bounding boxes are stale until the scene re-evaluates
    tyres = [o for o in meshes if any(tyre_re.search(m) for m in mats(o))]
if len(tyres) != 4:
    sys.exit(f'expected 4 tyres matching {a.tyre_mat!r}, found {len(tyres)}: {[o.name for o in tyres]}')


def centre(o):
    mn, mx = box(o)
    return (mn + mx) / 2


# Level the car if its geometry is turned on the ground (seen on the X1: about 1 degree baked into the meshes): each
# axle should run along X. The yaw is the mean angle of the two axles; everything is turned back about the origin.
by_y = sorted(tyres, key=lambda t: centre(t).y)
axles = [sorted(by_y[:2], key=lambda t: centre(t).x), sorted(by_y[2:], key=lambda t: centre(t).x)]
yaw = sum(math.atan2(centre(r).y - centre(l).y, centre(r).x - centre(l).x) for l, r in axles) / 2
if abs(math.degrees(yaw)) > 0.1:
    turn = mathutils.Matrix.Rotation(-yaw, 4, 'Z')
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = turn @ o.matrix_world
    bpy.context.view_layer.update()
    print(f'levelled: turned {-math.degrees(yaw):.2f} degrees about Z')

# Corner names only for the log; the engine decides front/rear and left/right itself.
cx = sum((box(t)[0].x + box(t)[1].x) / 2 for t in tyres) / 4
cy = sum((box(t)[0].y + box(t)[1].y) / 2 for t in tyres) / 4
wheel_parts, painted = 0, 0
for i, t in enumerate(tyres):
    tmn, tmx = box(t)
    c = (tmn + tmx) / 2
    corner = ('A' if c.y < cy else 'B') + ('R' if c.x > cx else 'L')
    for o in meshes:
        if any(paint_re.search(m) for m in mats(o)):
            continue  # body paint is never a wheel part, however close to the wheel (the X1's lower front panel)
        mn, mx = box(o)
        if all(mn[k] >= tmn[k] - a.margin and mx[k] <= tmx[k] + a.margin for k in range(3)):
            o.name = f'wheel_{corner}_{wheel_parts:03d}'
            wheel_parts += 1
    print(f'tyre {corner}: centre {tuple(round(v, 3) for v in c)}, diameter {tmx.z - tmn.z:.3f} m')

for o in meshes:
    if not o.name.startswith('wheel_') and any(paint_re.search(m) for m in mats(o)):
        o.name = f'paint_{painted:03d}'
        painted += 1
if not painted:
    sys.exit(f'no mesh uses a material matching {a.paint_mat!r}')
dropped = [o for o in meshes if drop_re and any(drop_re.search(m) for m in mats(o))]
for o in dropped:
    o.hide_set(True)
    o.hide_render = True
print(f'{wheel_parts} wheel parts, {painted} paint meshes, dropped {len(dropped)}: {[o.name for o in dropped]}')

os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=a.out, export_format='GLB', use_visible=True, export_cameras=False,
                          export_lights=False, export_animations=False, export_apply=True)
print('wrote', a.out, os.path.getsize(a.out))
