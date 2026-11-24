"""A fixed monobloc brake caliper for the Cycles wheel layers and hero stills (BMW M Compound / Brembo look).

One object per wheel (render_car.py counts five objects a wheel), three material slots: 0 gloss paint, 1 dark steel
(bridge bolts, bleed nipple), 2 pad material. Built as the engine's disc plane sees it: X is the axle, `sgn` the side the
wheel's face points to, the caliper sits on the upper arc on the car's end `toward` (+1 front wheels, -1 rear).

A real caliper sits behind the spokes, so nothing here is cut or trimmed to the rim: the body is one clean casting, a C
section (outer plate, bridge over the disc, inner plate) swept along about a third of the disc circumference with rounded
edges, one smooth gloss surface and straight radial ends. On the outer plate: six piston bosses (two rows of three), four hex
bridge bolts; the dark pads show under the plate's lower edge and a bleed nipple sits on the bridge. No boolean cuts, so no notches.
No logos: the live caliper's decal is not reproduced here.
`rim` is accepted for the caller's signature and ignored.
"""
import math


def make(bpy, bmesh, mathutils, sc, mats, x, y, z, disc_r, s, toward, sgn, front=True, rim=None):
    red, steel, pad = mats
    span = math.radians(112 if front else 94)            # about a third of the disc's circumference
    a_c = math.radians(46)
    a0, a1 = a_c - span / 2, a_c + span / 2
    n = max(24, int(math.degrees(span) / 2.0))
    dd = 0.015 * s                       # half the disc thickness
    t_pad = 0.011 * s                    # pad + backing, each side
    u_in = dd + t_pad                    # plates' inner faces
    rin = disc_r - 0.060 * s             # plates' lower edge
    rout = disc_r + 0.014 * s            # bridge top
    rbr = disc_r + 0.006 * s             # underside of the bridge
    u_inb = -0.046 * s                   # inner plate's back face (behind the disc: not seen from the front)
    u_out = 0.056 * s                    # outer plate's face (towards the rim face)
    head = 0.004 * s
    bm = bmesh.new()

    def P(u, r, a):
        return (sgn * u, -toward * math.cos(a) * r, math.sin(a) * r)

    def ss(t):
        t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)

    def taper(f):  # the lower corners climb at both ends: the tapered silhouette of a cast caliper
        t = 1 - ss(min(f, 1 - f) / 0.17)
        return 0.026 * s * t

    def uo(f):     # the middle of the outer plate stands proud of its ends
        return u_out - 0.010 * s * (1 - ss(min(f, 1 - f) / 0.16))

    def rounded(poly, seg=4):
        """poly: [(u, r, tapered, radius)] -> the section with each corner filleted (a quadratic arc)."""
        out = []; m = len(poly)
        for i, (u, r, tp, R) in enumerate(poly):
            if R <= 0: out.append((u, r, tp)); continue
            pu, pr = poly[i - 1][0], poly[i - 1][1]; nu, nr = poly[(i + 1) % m][0], poly[(i + 1) % m][1]
            d1 = (pu - u, pr - r); d2 = (nu - u, nr - r)
            l1 = math.hypot(*d1); l2 = math.hypot(*d2)
            d1 = (d1[0] / l1, d1[1] / l1); d2 = (d2[0] / l2, d2[1] / l2)
            ang = math.acos(max(-1, min(1, d1[0] * d2[0] + d1[1] * d2[1])))
            t = min(R / math.tan(ang / 2), l1 * 0.45, l2 * 0.45)
            a_ = (u + d1[0] * t, r + d1[1] * t); b_ = (u + d2[0] * t, r + d2[1] * t)
            for k in range(seg + 1):
                q = k / seg
                out.append(((1 - q) ** 2 * a_[0] + 2 * q * (1 - q) * u + q * q * b_[0],
                            (1 - q) ** 2 * a_[1] + 2 * q * (1 - q) * r + q * q * b_[1], tp))
        return out

    # the C section: outer plate, bridge, inner plate; `uo` marks the points that follow the outer face
    RB = 0.0065 * s
    sec = [("o", rin, True, RB), ("o", rout, False, RB), (u_inb, rout, False, RB), (u_inb, rin, True, RB * 0.6),
           (-u_in, rin, True, 0), (-u_in, rbr, False, 0), (u_in, rbr, False, 0), (u_in, rin, True, 0)]
    # fillet first at the nominal outer face, then flag which points ride on it
    base = rounded([(u_out if u == "o" else u, r, tp, R) for (u, r, tp, R) in sec])
    rings = []
    for k in range(n + 1):
        f = k / n; a = a0 + (a1 - a0) * f
        ring = []
        for (u, r, tp) in base:
            if u > u_out - 0.02 * s: u = u - (u_out - uo(f))    # the outer plate's face and its rounded edges
            ring.append(bm.verts.new(P(u, r + (taper(f) if tp else 0.0), a)))
        rings.append(ring)
    m = len(base)
    for k in range(n):
        for j in range(m):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % m], rings[k + 1][(j + 1) % m], rings[k + 1][j]))
    bm.faces.new(rings[0]); bm.faces.new(rings[-1][::-1])

    def cyl(u, r, a, rad, h, mat, seg, rad2=None, along=None):
        """A short prism/boss standing on the outer face (along the axle) at (u, r, a), height h, tapering to rad2."""
        pos = mathutils.Vector(P(u, r, a)) + mathutils.Vector((sgn * h / 2, 0, 0))
        res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=rad, radius2=rad if rad2 is None else rad2,
                                    depth=h, matrix=mathutils.Matrix.Translation(pos) @ mathutils.Matrix.Rotation(math.pi / 2, 4, 'Y'))
        for v in res['verts']:
            for f_ in v.link_faces: f_.material_index = mat

    # pads: dark friction blocks either side of the disc; only the part under the plates' lower edge shows
    def block(u0, u1, r0, r1, f0, f1, mat, steps=14):
        ring = []
        for k in range(steps + 1):
            a = a0 + (a1 - a0) * (f0 + (f1 - f0) * k / steps)
            ring.append([bm.verts.new(P(u, r, a)) for (u, r) in ((u0, r0), (u0, r1), (u1, r1), (u1, r0))])
        fs = [bm.faces.new((ring[k][j], ring[k][(j + 1) % 4], ring[k + 1][(j + 1) % 4], ring[k + 1][j]))
              for k in range(steps) for j in range(4)]
        fs += [bm.faces.new(ring[0]), bm.faces.new(ring[-1][::-1])]
        for f_ in fs: f_.material_index = mat
    for sd in (1, -1):
        block(sd * dd * 1.05, sd * (u_in - 0.0008 * s), disc_r - 0.066 * s, disc_r - 0.030 * s, 0.17, 0.83, 2)

    # six piston bosses on the outer plate (two rows of three), four hex bridge bolts, bleed nipple
    for rr in (disc_r - 0.040 * s, disc_r - 0.0045 * s):
        for f_ in (0.27, 0.5, 0.73):
            aa = a0 + (a1 - a0) * f_
            cyl(uo(f_) - 0.0008 * s, rr, aa, 0.0142 * s, 0.0012 * s, 1, 40)                      # the dark seal gap round each piston
            cyl(uo(f_) + 0.0004 * s, rr, aa, 0.0118 * s, head, 0, 40, 0.0102 * s)
    for f_, r_ in ((0.1, disc_r + 0.0045 * s), (0.9, disc_r + 0.0045 * s), (0.1, disc_r - 0.042 * s), (0.9, disc_r - 0.042 * s)):
        cyl(uo(f_) - 0.0008 * s, r_ + (taper(f_) * 0.5 if r_ < disc_r else 0), a0 + (a1 - a0) * f_, 0.0064 * s, head, 1, 6)
    a = a0 + (a1 - a0) * 0.22
    pos = mathutils.Vector(P(0.012 * s, rout + 0.004 * s, a))
    nrm = mathutils.Vector((0, -toward * math.cos(a), math.sin(a)))
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6, radius1=0.0042 * s, radius2=0.0030 * s, depth=0.008 * s,
                                matrix=mathutils.Matrix.Translation(pos) @ nrm.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    for v in res['verts']:
        for f_ in v.link_faces: f_.material_index = 1

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f_ in bm.faces: f_.smooth = True
    for e in bm.edges:                      # crisp where a casting has an edge, smooth along its rounds
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > 0.75: e.smooth = False
    me = bpy.data.meshes.new('layer_caliper'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('layer_caliper', me); sc.collection.objects.link(ob)
    ob.location = (x, y, z)
    for m_ in (red, steel, pad): me.materials.append(m_)
    return ob
