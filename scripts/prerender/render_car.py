"""Pre-renders one car for the image configurator with Blender Cycles (pip install bpy).

Input is the GLB from export-scene.cjs (the body exactly as the engine places it, with stock
wheels hidden, plus one CAM_<view> camera per view). For each view it renders the paint four
times: gloss (clearcoat) and matte (frozen), each with white and black base colour. The browser
recolours any paint as  black + (white - black) * colour, so no paint ever needs a re-render.
Background is transparent; the floor is a shadow catcher.

  python3 scripts/prerender/render_car.py scene.glb public/renders/<carId> [--samples 32] [--width 1440]
"""
import argparse, json, math, os, re, sys
import bpy, bmesh, mathutils

ap = argparse.ArgumentParser()
ap.add_argument('glb'); ap.add_argument('out')
ap.add_argument('--samples', type=int, default=32)
ap.add_argument('--width', type=int, default=1440)
ap.add_argument('--views', default='')
ap.add_argument('--no-subdiv', action='store_true', help='for very dense models that run out of memory')
ap.add_argument('--keep-normals', action='store_true',
                help="for clean models: render the paint meshes and their authored normals as exported (no weld, smoothing or subdivision)")
ap.add_argument('--car', default='', help='car id for the per-car fixes below (default: the output folder name)')
ap.add_argument('--hide', default=None, help='regex of mesh names to drop (overrides the per-car default)')
ap.add_argument('--studio', choices=['default', 'dark'], default='default',
                help="'dark': near-black room, low-energy overhead softbox, long side strips, rim strips, "
                     "linear headroom so the white pass never clips (see DARK below)")
ap.add_argument('--dark-set', default='', help='override DARK values, e.g. top_rad=3,strip_rad=14 (for tuning)')
ap.add_argument('--passes', default='', help='comma list of passes to render (default: all four)')
ap.add_argument('--two-render', action='store_true',
                help='render white AND black base colour separately (4 renders per view). Default for --studio dark: ONE render per '
                     'material set with Diffuse passes, black base derived as  B = W - DiffColor*(DiffDirect+DiffIndirect)*paintmask')
ap.add_argument('--seed', type=int, default=0, help='Cycles seed (for noise-floor tests)')
ap.add_argument('--wheels', default='', help="json from export-scene.cjs / wheelpos.cjs: [[x, y, z, radius, width] x4]; default <glb minus .glb>.wheels.json")
ap.add_argument('--threads', type=int, default=0, help='CPU threads for Cycles (0 = all)')
ap.add_argument('--hero', default='', help="welcome still instead of frames: '<#hex>,<Metallic|Solid|Frozen>' paints the body, "
                'mounts --rims at the wheel positions with tyres, discs and calipers, a polished floor, and renders ONE beauty '
                'image of --views (default frontThreeQuarter) to <out>/hero.png (needs --studio dark)')
ap.add_argument('--plate', action='store_true', help='studio plates instead of frames: the --hero studio (black void, polished floor, '
                'the key light over the car) with the car removed, one <out>/<view>/plate.png per view at the frames\' camera and size; '
                'the configurator draws it behind the body frame, which carries the car\'s own shadow (needs --studio dark)')
ap.add_argument('--wheel-layer', default='', help='path-traced wheel layers instead of frames: a json list of '
                '{"name", "rims": [front, rear?], "finish": ["#hex", metallic, roughness, clearcoat], "inches"}; for each entry and '
                'view, the rims (finish on every mesh, as the engine), tyres, discs and calipers at the wheel positions, lit by the '
                'frames\' studio with the body and floor as holdouts, cropped to the wheels: <out>/<view>/wheels/<name>.png, '
                'plus box.json (the crop, as fractions of the frame); files already there are kept (needs --studio dark)')
ap.add_argument('--rims', default='', help='front[,rear] rim GLB for --hero, decoded (no meshopt), real scale, axis Y, face -Y')
a = ap.parse_args()
DERIVE = a.studio == 'dark' and not a.two_render and not a.hero and not a.plate and not a.wheel_layer

# Per-car fixes, keyed by car id (--car, or the output folder name as render-all.sh passes it).
#  hide: multi-variant source models stack alternative parts (tuner kits, CS/Competition panels)
#        on the same surface; coincident painted copies z-fight into a crumpled, mottled panel
#        once subdivided, so drop all but one variant.
#  thin_glass: glazing modelled as open or doubled sheets refracts the cabin into dark blotches;
#        render it as a thin sheet (IOR 1, reflections from the coat layer) instead.
#  lamps: regex of headlight meshes. The mirrored lamp (…_R001) leaves the exporter with reversed
#        winding but outward custom normals, so Cycles shades it from behind (black); its chrome
#        reflector is also an 'other' material (made satin black) and the lens a 30% white alpha
#        sheet. Re-wind those meshes, then give the lamp parts the materials in LAMP_MATS.
#  glass_rough / glass_coat_rough: override the glass roughness (and, with thin_glass, its coat roughness): the
#        coarse, bumpy glazing of some models turns a crisp strip reflection into scribbles; blurred, it reads as sheen.
#  glass_unlink: light-link the crisp reflection strips (strip/low/shoulder/rim lights) away from the glass, so the
#        glass reflects only the soft room (world, overhead panel, gradient wall) and never a ragged white bar.
#        True = every glass mesh; a regex string = only the meshes whose name matches.
#  glass_unlink_lights: regex of the light names glass_unlink keeps off that glass (default: every strip, the regex
#        below), e.g. r'^rim' to drop only the end rim strips and keep the long strips' soft bands.
#  dark_glass: regex of meshes rendered as flat, dark, glossy glass (no transmission, so no cabin shows through),
#        e.g. a panoramic roof seen from above. Its material is copied, so the other windows are untouched.
#  view_gain: {view: {light-name prefix: factor}} scales those lights for one view only (e.g. a roof that clips from above).
#  dark: per-car overrides of the DARK studio values (e.g. calmer strips where a roof is hot).
#  glass_tint: darker glass base colour (the dark studio's glass_tint) for this car.
#  gloss_black: regex of mesh names rendered as high-gloss black (a black roof, piano-black trim) instead of the satin
#        black given to unnamed trim: the paint's own gloss recipe over a black base, so it matches a black car's panels.
#  carbon: regex of mesh names rendered as clear-coated 2x2 twill carbon fibre. The weave is procedural (the glTF route
#        carries no clear coat and none of a model's weave maps) and drawn only where a pixel can resolve it.
CAR_FIXES = {
    # four front-fender variants (stock, Competition, CS, Keyvany): keep the Competition one
    'm8_f92': {'hide': r'^(PAINT_)?(m8f92_fender_[LR](_cs)?(00\d)?_m8f92_|keyvany_fender_[LR])'},
    # The prepared packages (Drive > 3d cars) are clean models with authored normals (16-bit in the web GLB). Welding the
    # panels and re-weighting their normals crumpled them, and subdividing them had Blender killed for memory on an 8 GB
    # machine, so they render exactly as exported. authored_lamps: their lamps are modelled (clear covers, reflectors, lit
    # DRLs and tail lamps) and render that way; without it lamp covers and housings are satin black and nothing glows.
    'm2_g87': {'keep_normals': True, 'authored_lamps': True},
    'm4_cs_g82': {'keep_normals': True, 'authored_lamps': True},
    'm5_g90': {'keep_normals': True, 'authored_lamps': True},
    'm5_touring_g99': {'keep_normals': True, 'authored_lamps': True},
    # Blendkit (frames-only: the browser never gets its GLB), from scripts/prerender/prepare_blend.py
    'ix3_m60': {'keep_normals': True, 'authored_lamps': True},
    'm3_g80': {'keep_normals': True, 'authored_lamps': True},
    'm3_touring_g81': {'keep_normals': True, 'authored_lamps': True},
    'x1_u11': {'keep_normals': True, 'authored_lamps': True},
    'x3_g45': {'keep_normals': True, 'authored_lamps': True},
    # the X3 30e xDrive Standard Model (car id x3_30e_g45); its bright trim, sill inserts and lamps are fixed in the private copy.
    # :top (--car x3_30e_g45:top --views top): from above the windscreen and the panoramic roof mirrored the end and shoulder
    # strips as pale crossing bars; blurred (glass_rough 0.3, as the M3 CS Touring's top view) they are one soft sheen, and a
    # brighter cabin light, linked to the car only so the floor shadow keeps its size, lights the cabin. At the studio's
    # dimmed IOR the blurred glass was a near-black hole; glass's own IOR (glass_ior 1.5, as the M4's top view) gives the
    # windscreen and roof a broad soft sheen of the overhead light, so they read as tinted glass.
    # :ftq (--views frontThreeQuarter): the side panes (split off as Plane_055_side in the private copy) off the end rim
    # strips only: the high one behind the car, seen end-on in the rear door glass, was a pale smudge. The long strips stay
    # linked (with every strip off, the side glass was one flat black shape).
    'x3_30e_g45': {'keep_normals': True, 'authored_lamps': True},
    'x3_30e_g45:top': {'keep_normals': True, 'authored_lamps': True, 'glass_rough': 0.3, 'dark': {'cabin_rad': 2.0, 'cabin_floor': 0, 'glass_ior': 1.5}},
    'x3_30e_g45:ftq': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^Plane_055_side$', 'glass_unlink_lights': r'^rim'},
    # the X5 xDrive50e in the xLine look (car id x5_g05); its bright trim, lamps and split brakes are fixed in the private copy.
    # dark: with the default cabin light (low, small) the tall cabin read as black behind the side glass, with only the low
    # strip's band in it; a brighter, wider light under the headliner (light-linked to the car, so the floor shadow keeps its
    # size) shows the seats, headrests and steering wheel faintly through the side glass and windscreen, as on the X3 G45.
    # :top (--car x5_g05:top --views top): as the X3 30e's top view, the windscreen mirrored the overhead strips as a wavy
    # pale X; blurred (glass_rough 0.3) it is one soft sheen, and the brighter cabin light (off the floor) keeps the seats
    # readable under the panoramic roof.
    'x5_g05': {'keep_normals': True, 'authored_lamps': True,
               'dark': {'cabin_h': 1.45, 'cabin_y': 0.35, 'cabin_w': 1.5, 'cabin_l': 2.0, 'cabin_rad': 5.0, 'cabin_floor': 0}},
    'x5_g05:top': {'keep_normals': True, 'authored_lamps': True, 'glass_rough': 0.3, 'dark': {'cabin_rad': 2.0, 'cabin_floor': 0}},
    # the X5 M Competition before the 2023 facelift (car id x5m_f95; same author as the x5_g05); its lamps, badges, black
    # chrome tailpipes and mirror caps are fixed in the private copy. gloss_black: the Competition's high-gloss black kidney
    # surround and bars, M gills, window surround and pillar trims, roof rails, roof-spoiler trim, side-intake frames and
    # diffuser (satin black, the default for unnamed trim, read as unfinished plastic next to the paint). dark: the x5_g05's
    # cabin light (same G05 cabin) under the headliner, so the seats show through the side glass. glass_unlink: where the
    # fender part of each tail lamp ends at the tailgate split, its red cover glass mirrored the rim strip behind the car
    # and the long strip as a pale inverted V across the top light bar (rear three-quarter and side views); the two cover
    # meshes reflect only the soft room, so the split reads as the thin dark line it is on the car.
    # :top (--car x5m_f95:top --views top): as the x5_g05's top view, the windscreen mirrored the overhead strips as a wavy
    # pale X; blurred (glass_rough 0.3) it is one soft sheen, with the x5_g05's top-view cabin light.
    'x5m_f95': {'keep_normals': True, 'authored_lamps': True,
                'gloss_black': r'^(Hood_001|Plane_003|Front_Fender_00[12]|Back_Fender_00[12]|Plane_02[2345]|Roof_00[12]|Roof_006|Roof_Wing_00[12]|Fron_Bumper_004|Back_Bumper_004)$',
                'glass_unlink': r'^backlamp_Back_Bumper_0(07|15)$',
                'dark': {'cabin_h': 1.45, 'cabin_y': 0.35, 'cabin_w': 1.5, 'cabin_l': 2.0, 'cabin_rad': 5.0, 'cabin_floor': 0}},
    'x5m_f95:top': {'keep_normals': True, 'authored_lamps': True, 'glass_rough': 0.3, 'dark': {'cabin_rad': 2.0, 'cabin_floor': 0},
                    'gloss_black': r'^(Hood_001|Plane_003|Front_Fender_00[12]|Back_Fender_00[12]|Plane_02[2345]|Roof_00[12]|Roof_006|Roof_Wing_00[12]|Fron_Bumper_004|Back_Bumper_004)$'},
    # gloss_black: the roof panel, its rails, the roof spoiler and the aerial fin (BMW: "roof and roof spoiler in Black
    # high-gloss"). carbon: the 'carbon' mesh (splitter, front air intakes, mirror caps, diffuser) and the two bonnet
    # indents (Object494), which BMW leaves in exposed carbon fibre.
    'm3_cs_touring_g81': {'keep_normals': True, 'authored_lamps': True, 'gloss_black': r'^(Circle05[789]|Circle060|Wing)$', 'carbon': r'^(carbon|Object494)$'},
    # its top view only (--car m3_cs_touring_g81:top --views top): from above the windscreen mirrored the end and shoulder
    # strips as a hash of pale bars. Blurred (glass_rough 0.3) they are one soft sheen, so the glass still reads as glass
    # (with the strips unlinked it was a black hole), and a brighter cabin light shows the interior through the side glass.
    'm3_cs_touring_g81:top': {'keep_normals': True, 'authored_lamps': True, 'glass_rough': 0.3, 'dark': {'cabin_rad': 2.0},
                              'gloss_black': r'^(Circle05[789]|Circle060|Wing)$', 'carbon': r'^(carbon|Object494)$'},
    # glass_unlink: its coarse side and rear glazing mirrored the strips as ragged, grainy bands, so those panes reflect only
    # the soft room; so do the headlamp covers, which mirrored them as hairline scribbles in the wheel close-up. The
    # windscreen keeps its clean strip highlight, except from above (--car m3_cs_g80:top --views top), where it mirrored the
    # end strips as scribbles. dark: without those reflections the glasshouse was flat black, so the cabin light sits under
    # the headliner (at the belt line it lights only what the doors hide), brighter, and off the floor.
    'm3_cs_g80': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_0(45|46|50|52)|headlamp_(Circle_011|Plane_003))', 'dark': {'cabin_h': 1.29, 'cabin_y': 0.525, 'cabin_l': 1.55, 'cabin_rad': 2.0, 'cabin_floor': 0}},
    'm3_cs_g80:top': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': True, 'dark': {'cabin_h': 1.29, 'cabin_y': 0.525, 'cabin_l': 1.55, 'cabin_rad': 2.0, 'cabin_floor': 0}},
    # as the M3 CS (same author's glazing): the side and rear panes (Plane_065, Plane_076, Circle_061) and the headlamp
    # covers (hairline scribbles over the yellow running lights in the wheel close-up) off the strips; the windscreen
    # (Circle_059) keeps its highlight. dark: the cabin light under the headliner, as on the M4, so the two seats read
    # through the glass. carbon: splitter, air curtains, mirror caps, sills and diffuser (24698910__11603P001), the bonnet
    # channels and the roof, all exposed clear-coated carbon on the car. Front three-quarter, rear three-quarter, wheel.
    # :soft (--views side,top): with the strips unlinked the side glass was one flat black shape and, from above, the
    # windscreen and rear window black holes; linked they mirrored the strips as ragged bands and scribbles. Blurred
    # (glass_rough 0.3, as the M3 CS Touring's top view) they are one soft sheen, so the glass reads as tinted glass.
    # :front (--views front): every pane off the strips; straight ahead the windscreen mirrored them as two pale bars.
    'm4_csl_g82': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_065|Plane_076|Circle_061|headlamp_(Circle_011|Plane_003))$',
                   'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0},
                   'carbon': r'^(24698910__11603P001|Circle_004|Circle_020)$'},
    'm4_csl_g82:soft': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^headlamp_(Circle_011|Plane_003)$', 'glass_rough': 0.3,
                        'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0},
                        'carbon': r'^(24698910__11603P001|Circle_004|Circle_020)$'},
    'm4_csl_g82:front': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Circle_059|Plane_065|Plane_076|Circle_061|headlamp_(Circle_011|Plane_003))$',
                         'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0},
                         'carbon': r'^(24698910__11603P001|Circle_004|Circle_020)$'},
    # the M4 CSL's body and glazing (same panes, same names): side and rear glass and the headlamp covers (hairline
    # scribbles in the wheel close-up) off the strips. dark: as on the M3 CS, the cabin light sits under the headliner,
    # brighter and off the floor, so the seats read through the glass. carbon: the 'carbon' mesh (mirror caps, boot-lid lip,
    # splitter, intake inserts, diffuser; its weave maps are missing from the download). Straight ahead (--car m4_g82:front
    # --views front) the windscreen mirrored the side strips as two broad pale bands, so all glass is off them. From above
    # (--car m4_g82:top --views top), with every pane off the strips the windscreen and rear window were flat black, and
    # glass_rough 0.3 frosted the sunroof: so those two are dark glass that keeps the strips, as smooth as real glass
    # (dark_glass_rough 0.06: each strip a crisp bar, as on the paint's clear coat; glass blurrier than paint reads false), the side panes
    # stay off the strips, and the clear panes take glass's own IOR (glass_ior 1.5, not the studio's dimmed 1.25), so the
    # flat sunroof, which the strips do not reach from above, shows a faint sheen of the overhead panel over the seats.
    'm4_g82': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_065|Plane_076|Circle_061|headlamp_Circle_011)', 'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0}, 'carbon': r'^carbon$'},
    'm4_g82:front': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': True, 'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0}, 'carbon': r'^carbon$'},
    'm4_g82:top': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_065|Plane_076|headlamp_Circle_011)', 'dark_glass': r'^(Circle_059|Circle_061)$', 'dark_glass_rough': 0.06,
                   'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0, 'glass_ior': 1.5}, 'carbon': r'^carbon$'},
    # The same author's M4 with a soft top (the coupe's meshes and names; the roof is fabric, its look written into the
    # scene by the private patch). As m4_g82: side panes (Plane_065), rear window (Object558) and headlamp covers off the
    # strips, the windscreen (Circle_059) keeps its highlight, the cabin light under the top, the carbon mesh as twill.
    # :front: every pane off the strips. :top: windscreen and rear window as dark glass that keeps the strips.
    'm4_convertible_g83': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_065|Object558|headlamp_Circle_011)', 'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0}, 'carbon': r'^carbon$'},
    'm4_convertible_g83:front': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': True, 'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0}, 'carbon': r'^carbon$'},
    'm4_convertible_g83:top': {'keep_normals': True, 'authored_lamps': True, 'glass_unlink': r'^(Plane_065|headlamp_Circle_011)', 'dark_glass': r'^(Circle_059|Object558)$', 'dark_glass_rough': 0.06,
                               'dark': {'cabin_h': 1.22, 'cabin_y': 0.43, 'cabin_l': 1.35, 'cabin_rad': 2.0, 'cabin_floor': 0, 'glass_ior': 1.5}, 'carbon': r'^carbon$'},
    # The BMW M340i xDrive Touring (G21 facelift; car id m340i_touring_g21), built in the private copy from the same author's
    # 3 Series Touring (a 330e M Sport): mesh kidney insert, M mirror caps, Shadowline trim, trapezoid tailpipes, badges.
    # gloss_black: the M High-gloss Shadowline parts (window surround, roof rails, B/C-pillar covers, mirror triangles), the
    # M mirror caps (BMW: "Black high-gloss") and the kidney mesh, which the satin black of unnamed trim would make plastic.
    # :top (--car m340i_touring_g21:top --views top): as the X3 30e's top view (same author's glazing), the windscreen
    # mirrored the end and shoulder strips as a pale X; blurred (glass_rough 0.3) at glass's own IOR it is one soft sheen.
    # glass_unlink: the two outer tail-lamp lenses mirrored the strips as white squiggles across the lit lower bar (rear
    # three-quarter); unlinked they reflect only the soft room, as on the x5m_f95. dark: the M3 CS's cabin light (same
    # G2x cabin), so the seats show through the glass instead of near-black panes.
    'm340i_touring_g21': {'keep_normals': True, 'authored_lamps': True, 'gloss_black': r'^(shadowline_.*|kidney_mesh_lci)$',
                          'glass_unlink': r'^backlamp_Main_Mesh_0(27|32)$',
                          'dark': {'cabin_h': 1.29, 'cabin_y': 0.525, 'cabin_l': 1.55, 'cabin_rad': 2.0, 'cabin_floor': 0}},
    'm340i_touring_g21:top': {'keep_normals': True, 'authored_lamps': True, 'glass_rough': 0.3, 'dark': {'cabin_rad': 2.0, 'cabin_floor': 0, 'glass_ior': 1.5},
                              'gloss_black': r'^(shadowline_.*|kidney_mesh_lci)$'},
    # The BMW M240i xDrive Coupé before the 2024 update (G42; car id m240i_g42; same author as the m4_g82). gloss_black:
    # the M High-gloss Shadow Line window surround (Object024) and pillar trim (Object023), the mirror bases (Object050),
    # the side-skirt inserts (Object013), the front spoiler lip (Plane007) and the rear apron inlay (Plane015), all
    # high-gloss black on the 2022-2024 car (BMW press kit 07/2021), which the satin black of unnamed trim made plastic.
    # dark: the M4's cabin light under the headliner (a coupe cabin of the same layout, 12 mm higher), so the seats show
    # through the side glass instead of black panes. :top (--car m240i_g42:top --views top): from above the windscreen
    # (Object022) and rear window (Plane005) mirrored the strips as wavy pale bars; as on the m4_g82's top view they are
    # dark glass that keeps the strips as crisp bars, the side panes (Object025) stay off the strips.
    'm240i_g42': {'keep_normals': True, 'authored_lamps': True, 'gloss_black': r'^(Object0(13|23|24|50)|Plane0(07|15))$',
                  'dark': {'cabin_h': 1.23, 'cabin_y': 0.35, 'cabin_l': 1.3, 'cabin_rad': 2.0, 'cabin_floor': 0}},
    'm240i_g42:top': {'keep_normals': True, 'authored_lamps': True, 'gloss_black': r'^(Object0(13|23|24|50)|Plane0(07|15))$',
                      'glass_unlink': r'^(Object025|headlamp_Object035)$', 'dark_glass': r'^(Object022|Plane005)$', 'dark_glass_rough': 0.06,
                      'dark': {'cabin_h': 1.23, 'cabin_y': 0.35, 'cabin_l': 1.3, 'cabin_rad': 2.0, 'cabin_floor': 0, 'glass_ior': 1.5}},
}
LAMP_MATS = {  # source part name in the mesh name: Principled inputs
    'Lights_Common': {'Base Color': (0.7, 0.7, 0.71, 1), 'Metallic': 1.0, 'Roughness': 0.15},  # reflectors
    'Chrome_ext': {'Base Color': (0.8, 0.8, 0.81, 1), 'Metallic': 1.0, 'Roughness': 0.12},
    'Coloured_matte': {'Base Color': (0.12, 0.12, 0.125, 1), 'Metallic': 0.1, 'Roughness': 0.3},  # housing
    'Coloured_gloss': {'Base Color': (0.06, 0.06, 0.065, 1), 'Metallic': 0.1, 'Roughness': 0.22},
    'Glass_Saphir': {'Base Color': (0.8, 0.8, 0.8, 1), 'Metallic': 0.05, 'Roughness': 0.4},
    'signal': {'Base Color': (0.5, 0.5, 0.5, 1), 'Metallic': 0.05, 'Roughness': 0.5},
    'headlight_high': {'Base Color': (0.0, 0.08, 0.8, 1), 'Metallic': 0.2, 'Roughness': 0.2},
    'headlight_low': {'Base Color': (0.0, 0.08, 0.8, 1), 'Metallic': 0.2, 'Roughness': 0.2},
    'running_front': {'Base Color': (0.9, 0.9, 0.9, 1), 'Metallic': 0.0, 'Roughness': 0.35},  # DRL light guides
    'Glass_Clear': {'Base Color': (0.9, 0.91, 0.92, 1), 'Alpha': 1.0, 'Transmission Weight': 0.92, 'IOR': 1.0,
                    'Roughness': 0.0, 'Coat Weight': 1.0, 'Coat Roughness': 0.02},  # thin, slightly hazy lens
}
LAMP_GLOW = 3.0      # most a lit lamp part may emit (authored_lamps); the engine's own values run far higher
# --studio dark. Light sizes are in car lengths (L) or metres; *_rad is the emitted radiance in Blender
# units (area-light power = radiance x area x pi), so the numbers mean the same whatever the car size.
# A white paint pass sees diffuse light = albedo x irradiance / pi, so rad values are chosen to keep that
# under ~0.85 on the body, while a 4-10% clear-coat reflection of a bright strip still reaches ~1 (crisp lines).
# 2026-10-07: the big reflective panels (overhead gradient, far-side wall) and the floor were turned right down. Every panel
# used to mirror them, which laid a grey haze over the paint (black read as dark grey, colours as pale "sheet metal");
# now the paint stays deep and only the narrow strips draw highlight lines, as in a car studio.
DARK = dict(
    exposure=0.0,            # view exposure, stops ('Standard' view transform stays linear)
    world_zenith=0.004, world_horizon=0.008,   # near-black room with a faint horizon glow (lower-body reflections)
    top_rad=2.1, top_w=1.0, top_l=0.75, top_h=3.0,   # big soft overhead, DIFFUSE only: width x length (xL), height above roof (m)
    topg_lo=0.0, topg_hi=0.12, topg_dir=1,   # overhead reflection panel (glossy only): radiance rear->front gradient lo..hi (dir -1 flips)
    strip_rad=3.0, strip_w=0.05, strip_l=2.4, strip_d=0.5, strip_h=1.0,   # high camera-side strip: width (xL), length (xL), offset (xL), height above roof (m)
    sh_rad=6.0, sh_w=0.16, sh_l=2.6, sh_x=1.0, sh_h=1.5, sh_both=1,   # ONE long thin bright shoulder strip along the car: width (m), length (xL), lateral (m), height above roof (m), both sides
    low_rad=4.0, low_w=0.05, low_d=0.7, low_h=0.35,   # low camera-side strip (sills / lower door): height above ground (m)
    rim_rad=6.0, rim_w=0.07, rim_l=0.8, rim_d=0.9, rim_h=1.8,    # end rim strips, high behind/in front, aimed at roof/bonnet
    panel_rad_top=0.12, panel_rad_bottom=0.0, panel_d=0.75, panel_len=1.3, panel_h=2.4,   # far-side gradient wall (emissive, reflection-only): doors/flanks reflect a soft light-to-dark gradient; d, len in xL, h in metres
    fill_rad=0.9, fill_d=0.75, fill_h=1.2,            # camera-side soft diffuse-only fill (flanks, lower body): radiance, offset (xL), height (m)
    end_rad=1.6, end_d=0.95,                          # soft diffuse-only fills ahead of / behind the car (grille, bumper, tail)
    cabin_rad=0.8,           # dim diffuse light inside the cabin so the interior reads through the glass
    cabin_h=0.95, cabin_y=0.15, cabin_w=1.0, cabin_l=1.8, cabin_floor=1,   # that light: height (m), offset along +Y (m), width, length (m); cabin_floor=0 light-links it to the car alone (the shadow catcher counts it as light the body blocks, so a brighter or higher one widens the floor shadow)
    far_strips=0,            # 1 also puts the high/low strips on the far side (they reflect strongly in the windscreen)
    strips_reflect_only=1,   # strips/rims are invisible to diffuse rays: they draw crisp reflections but do not light (wash out) the white pass or the floor
    glass_tint=0.22, glass_opaque=0, glass_rough=0.07, glass_ior=1.25,   # glass_rough / glass_ior: a little roughness and a lower IOR turn the strip reflections into soft dim ones
    coat_rough=0.05,         # paint clear-coat roughness: ~0.05 softens the bumpy source mesh's mirror reflections
    smooth_body=2,           # Corrective Smooth passes on the paint meshes before subdivision (0 = off; skipped for dense / no_subdiv meshes)   # glazing: base-colour tint of the transmissive glass; glass_opaque=1 = old flat-black fallback
    floor_albedo=0.03,       # the (invisible) floor still shows in reflections
)
fix = CAR_FIXES.get(a.car or os.path.basename(os.path.normpath(a.out)), {})
DARK.update(fix.get('dark', {}))   # per-car studio tweaks (fix['dark'] = {'sh_rad': 4.5}); --dark-set still wins
for kv in filter(None, a.dark_set.split(',')):
    k, v = kv.split('='); DARK[k] = float(v)
# Tyre stand-ins (--studio dark): where the live engine puts the wheels. The GLB has none (the engine draws them), so the
# stand-ins only cast the contact shadow, darken the arches and show in the paint's reflections.
_wj = a.wheels or re.sub(r'\.glb$', '', a.glb) + '.wheels.json'
WHEELS = json.load(open(_wj)) if os.path.exists(_wj) else fix.get('wheels')
if a.studio == 'dark' and not WHEELS: print('WARNING: no wheel positions (%s): no contact shadows or dark arches. Run export-scene.cjs or wheelpos.cjs.' % _wj)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
sc = bpy.context.scene
hide = a.hide if a.hide is not None else fix.get('hide')
if hide:
    for o in [o for o in sc.objects if o.type == 'MESH' and re.search(hide, o.name)]:
        bpy.data.objects.remove(o, do_unlink=True)
objs = list(sc.objects)
cams = {o.name.split('CAM_', 1)[1].split('.')[0]: o for o in objs if o.type == 'CAMERA' and 'CAM_' in o.name}
meshes = [o for o in objs if o.type == 'MESH']

def principled(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes['Principled BSDF']

paint, pb = principled('PAINT')
pb.inputs['Coat Roughness'].default_value = DARK['coat_rough'] if a.studio == 'dark' else 0.02
if a.studio == 'dark':
    # The source models' cabins are 'paint' too. Seen through the glass they were body-coloured; a real interior is dark and
    # neutral, and it must not depend on the paint (the Diffuse passes do not see through glass, so the derived B could not
    # remove it). Rays that have been through glass (Light Path: Is Transmission Ray) get a dark leather/plastic instead.
    pnt = paint.node_tree; pout = pnt.nodes['Material Output']
    ib = pnt.nodes.new('ShaderNodeBsdfPrincipled'); ib.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1); ib.inputs['Roughness'].default_value = 0.55
    lp = pnt.nodes.new('ShaderNodeLightPath'); mx = pnt.nodes.new('ShaderNodeMixShader')
    pnt.links.new(lp.outputs['Is Transmission Ray'], mx.inputs['Fac']); pnt.links.new(pb.outputs['BSDF'], mx.inputs[1])
    pnt.links.new(ib.outputs['BSDF'], mx.inputs[2]); pnt.links.new(mx.outputs['Shader'], pout.inputs['Surface'])
if DERIVE:   # marks the paint's pixels (filtered like colour, so anti-aliased edges get a fractional mask)
    aovn = paint.node_tree.nodes.new('ShaderNodeOutputAOV'); aovn.aov_name = 'paintmask'; aovn.inputs['Value'].default_value = 1.0

for o in meshes:
    is_paint = any(s.material and s.material.name.startswith('PAINT') for s in o.material_slots)
    if is_paint:
        o.data.materials.clear(); o.data.materials.append(paint)
        if a.keep_normals or fix.get('keep_normals'):
            continue   # a clean model: its panels and authored normals render exactly as exported
        # The source panels are faceted and split: weld, smooth and subdivide them so the
        # reflections run clean instead of looking like crumpled sheet metal.
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data); bm.free()
        for p in o.data.polygons: p.use_smooth = True
        if a.studio == 'dark' and DARK['smooth_body'] > 0 and not (a.no_subdiv or fix.get('no_subdiv')) and len(o.data.vertices) < 150000:   # irons out the bumpy source mesh before it is mirrored in the coat
            cs_ = o.modifiers.new('csmooth', 'CORRECTIVE_SMOOTH'); cs_.factor = 0.5; cs_.iterations = int(DARK['smooth_body'])
            cs_.smooth_type = 'SIMPLE'; cs_.rest_source = 'ORCO'
        if not (a.no_subdiv or fix.get('no_subdiv')) and len(o.data.vertices) < 150000:  # dense meshes are smooth enough and would run out of memory
            sd = o.modifiers.new('sub', 'SUBSURF'); sd.levels = sd.render_levels = 1
            sd.boundary_smooth = 'PRESERVE_CORNERS'
        o.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    else:
        for p in o.data.polygons: p.use_smooth = True
        for s in o.material_slots:
            m = s.material
            b = m and m.node_tree and m.node_tree.nodes.get('Principled BSDF')
            kind = m.name.split('.')[0] if m else ''
            lamps = fix.get('authored_lamps')
            if b and lamps and kind == 'lens':   # clear lamp cover: thin glass, so the reflectors and the lit parts show through
                for k, v in LAMP_MATS['Glass_Clear'].items(): b.inputs[k].default_value = v
            if b:   # lit parts: without authored_lamps nothing glows (as these frames always were); with it, capped so a DRL reads lit without flooding the bumper
                b.inputs['Emission Strength'].default_value = min(b.inputs['Emission Strength'].default_value, LAMP_GLOW) if lamps else 0.0
            if b and (kind in ('part', 'other', 'blackTrim') or (kind in ('lens', 'lamp') and not lamps)):
                # unnamed plastics, arch liners and trim: satin black, as on the real car
                b.inputs['Base Color'].default_value = (0.02, 0.02, 0.022, 1)
                b.inputs['Metallic'].default_value = 0.0
                b.inputs['Roughness'].default_value = 0.45
            if m and 'glass' in m.name.lower():
                b = m.node_tree.nodes.get('Principled BSDF')
                if b:
                    b.inputs['Transmission Weight'].default_value = 1.0
                    b.inputs['Roughness'].default_value = 0.02
                    b.inputs['Base Color'].default_value = (0.05, 0.06, 0.07, 1)
                    b.inputs['Alpha'].default_value = 1.0
                    if a.studio == 'dark':
                        # dark-tinted, reflective glass with the cabin visible behind it (tint = share of light that gets through)
                        t = DARK['glass_tint']
                        b.inputs['Roughness'].default_value = DARK['glass_rough']; b.inputs['IOR'].default_value = DARK['glass_ior']
                        b.inputs['Base Color'].default_value = (t, t * 1.06, t * 1.14, 1)
                        if DARK['glass_opaque']:   # fallback: no cabin, flat dark glass
                            b.inputs['Transmission Weight'].default_value = 0.0
                            b.inputs['Base Color'].default_value = (0.012, 0.014, 0.017, 1)
                    if fix.get('thin_glass'):
                        b.inputs['IOR'].default_value = 1.0
                        b.inputs['Coat Weight'].default_value = 1.0
                        b.inputs['Coat Roughness'].default_value = fix.get('glass_coat_rough', 0.02)
                    if 'glass_rough' in fix: b.inputs['Roughness'].default_value = fix['glass_rough']
                    if 'glass_tint' in fix and a.studio == 'dark':
                        t = fix['glass_tint']; b.inputs['Base Color'].default_value = (t, t * 1.06, t * 1.14, 1)

if fix.get('dark_glass'):
    for o in [o for o in meshes if re.search(fix['dark_glass'], o.name)]:
        for s in o.material_slots:
            if not s.material: continue
            s.material = s.material.copy()
            b = s.material.node_tree.nodes.get('Principled BSDF')
            if not b: continue
            b.inputs['Transmission Weight'].default_value = 0.0; b.inputs['Alpha'].default_value = 1.0
            b.inputs['Base Color'].default_value = (0.010, 0.012, 0.015, 1)
            b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = fix.get('dark_glass_rough', 0.10)
            b.inputs['IOR'].default_value = 1.45

def gloss_black_material():
    """High-gloss black: the gloss paint pass (PASSES 'gloss') over a black base."""
    m, b = principled('GLOSS_BLACK')
    b.inputs['Base Color'].default_value = (0.004, 0.004, 0.0045, 1); b.inputs['Roughness'].default_value = 0.30
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = DARK['coat_rough'] if a.studio == 'dark' else 0.02
    return m

CARBON_TONES = (0.016, 0.050)   # base colour (linear) of a cell with the weft tow on top, and with the warp tow on top

def carbon_material(tow=0.003, near=3.0, far=4.2):
    """Clear-coated 2x2 twill carbon fibre. tow: width of one tow (m). The weave (two dark greys and a bump, under a smooth
    coat) is laid out in world space on the plane the surface faces most, so it needs no UVs, and it fades to its mean grey
    between near and far metres from the camera: finer than a pixel it would only alias into moire."""
    m, b = principled('CARBON'); nt = m.node_tree
    def M(op, *xs):   # a Math node; inputs are numbers or sockets
        n = nt.nodes.new('ShaderNodeMath'); n.operation = op
        for i, x in enumerate(xs):
            if isinstance(x, (int, float)): n.inputs[i].default_value = x
            else: nt.links.new(x, n.inputs[i])
        return n.outputs[0]
    pick = lambda f, x0, x1: M('ADD', x0, M('MULTIPLY', f, M('SUBTRACT', x1, x0)))   # x0 where f is 0, x1 where it is 1
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    pos = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], pos.inputs[0])
    nrm = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['True Normal'], nrm.inputs[0])
    ax, ay, az = (M('ABSOLUTE', nrm.outputs[i]) for i in range(3))
    up = M('MULTIPLY', M('GREATER_THAN', az, ax), M('GREATER_THAN', az, ay))      # the face looks up or down: weave in x, y
    side = M('MULTIPLY', M('SUBTRACT', 1.0, up), M('GREATER_THAN', ax, ay))       # it looks along x: weave in y, z (else x, z)
    u = M('DIVIDE', pick(side, pos.outputs['X'], pos.outputs['Y']), tow)
    v = M('DIVIDE', pick(up, pos.outputs['Z'], pos.outputs['Y']), tow)
    warp = M('LESS_THAN', M('WRAP', M('ADD', M('FLOOR', u), M('FLOOR', v)), 4.0, 0.0), 1.5)   # over two, under two, one step per row
    arch = lambda t: M('SINE', M('MULTIPLY', M('FRACT', t), math.pi))             # a tow's rounded cross-section
    h = pick(warp, arch(v), arch(u))
    weave = M('MULTIPLY', pick(warp, CARBON_TONES[0], CARBON_TONES[1]), M('ADD', 0.55, M('MULTIPLY', h, 0.45)))
    mean = (CARBON_TONES[0] + CARBON_TONES[1]) / 2 * (0.55 + 0.45 * 2 / math.pi)
    cam = nt.nodes.new('ShaderNodeCameraData')
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.clamp = True; mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = near; mr.inputs['From Max'].default_value = far
    mr.inputs['To Min'].default_value = 1.0; mr.inputs['To Max'].default_value = 0.0
    nt.links.new(cam.outputs['View Z Depth'], mr.inputs['Value'])
    k = mr.outputs[0]   # 1 = full weave, 0 = the mean grey
    nt.links.new(M('ADD', mean, M('MULTIPLY', k, M('SUBTRACT', weave, mean))), b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = tow * 0.12
    nt.links.new(M('MULTIPLY', h, k), bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = 0.3; b.inputs['Roughness'].default_value = 0.4
    b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.04   # the coat keeps the smooth normal
    return m

for key, make in (('gloss_black', gloss_black_material), ('carbon', carbon_material)):
    if fix.get(key):
        hits = [o for o in meshes if re.search(fix[key], o.name) and not o.name.startswith('PAINT')]
        if hits:
            mat = make()
            for o in hits: o.data.materials.clear(); o.data.materials.append(mat)
        print(f'{key}: {sorted(o.name for o in hits)}', flush=True)

def rewind(o):
    """Reverse faces whose winding disagrees with their custom normals, keeping those normals."""
    me = o.data
    cn = [c.vector.copy() for c in me.corner_normals]
    bad = sum(1 for p in me.polygons if sum((cn[i] for i in p.loop_indices), mathutils.Vector()).dot(p.normal) < 0)
    if bad * 2 < len(me.polygons): return
    keep = [{me.loops[i].vertex_index: cn[i] for i in p.loop_indices} for p in me.polygons]
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    me.normals_split_custom_set([keep[p.index][me.loops[i].vertex_index] for p in me.polygons for i in p.loop_indices])

if fix.get('lamps'):
    for o in [o for o in meshes if re.search(fix['lamps'], o.name)]:
        rewind(o)
        part = next((k for k in LAMP_MATS if k in o.name), None)
        for s in o.material_slots:
            b = part and s.material and s.material.node_tree.nodes.get('Principled BSDF')
            if not b: continue
            for k, v in LAMP_MATS[part].items(): b.inputs[k].default_value = v
            if part == 'Glass_Clear': s.material.surface_render_method = 'DITHERED'

# Car extents (Blender is Z-up after import).
xs = [(o.matrix_world @ v.co) for o in meshes for i, v in enumerate(o.data.vertices) if i % 50 == 0]
L = max(max(p.x for p in xs) - min(p.x for p in xs), max(p.y for p in xs) - min(p.y for p in xs))
H = max(p.z for p in xs)

bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
floor = bpy.context.object; floor.is_shadow_catcher = True

def softbox(name, loc, rot, sx, sy, energy):
    l = bpy.data.lights.new(name, 'AREA'); l.shape = 'RECTANGLE'
    l.size, l.size_y, l.energy = sx, sy, energy
    ob = bpy.data.objects.new(name, l); ob.location = loc; ob.rotation_euler = rot
    sc.collection.objects.link(ob)
    return ob
long_y = (max(p.y for p in xs) - min(p.y for p in xs)) > (max(p.x for p in xs) - min(p.x for p in xs))
rz = math.pi / 2 if long_y else 0  # the softboxes follow the car's long axis
cx = (max(p.x for p in xs) + min(p.x for p in xs)) / 2; cy = (max(p.y for p in xs) + min(p.y for p in xs)) / 2

if a.studio == 'default':
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.75, 0.77, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    softbox('top', (0, 0, H + 3.0), (0, 0, rz), L * 1.4, L * 0.7, 2500)
    for sgn in (1, -1):
        d = (0, sgn * L) if not long_y else (sgn * L, 0)
        rot = (math.radians(-70 * sgn), 0, 0) if not long_y else (0, math.radians(70 * sgn), 0)
        softbox(f'side{sgn}', (d[0], d[1], H), rot, L * 1.2, 1.2, 900)
else:
    D = DARK
    # near-black room: vertical gradient, faint glow at the horizon
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.clamp = True
    mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = 0.6
    mr.inputs['To Min'].default_value = D['world_horizon']; mr.inputs['To Max'].default_value = D['world_zenith']
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    absn = nt.nodes.new('ShaderNodeMath'); absn.operation = 'ABSOLUTE'
    nt.links.new(sep.outputs['Z'], absn.inputs[0]); nt.links.new(absn.outputs[0], mr.inputs['Value'])
    cm = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3): nt.links.new(mr.outputs[0], cm.inputs[i])
    nt.links.new(cm.outputs[0], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
    fm = bpy.data.materials.new('floor'); fm.use_nodes = True
    fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (D['floor_albedo'],) * 3 + (1,)
    fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.5
    floor.data.materials.append(fm)
    if WHEELS:
        rub = bpy.data.materials.new('rubber'); rub.use_nodes = True
        rb = rub.node_tree.nodes['Principled BSDF']
        rb.inputs['Base Color'].default_value = (0.015, 0.015, 0.016, 1); rb.inputs['Roughness'].default_value = 0.7
        for (x, y, z, r, wd) in WHEELS:
            bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=wd, location=(x, y, z), rotation=(0, math.pi / 2, 0))
            t = bpy.context.object; t.data.materials.append(rub)
            for pl in t.data.polygons: pl.use_smooth = True
            t.visible_camera = False   # not in the picture (the engine draws the real wheel), but shadows + reflections stay

    def lat(sgn, u, v, z):   # car frame (u along the long axis, v sideways) -> world
        return (cx + v * sgn, cy + u, z) if long_y else (cx + u, cy + v * sgn, z)
    def aim(ob, target):
        d = mathutils.Vector(target) - mathutils.Vector(ob.location)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    def strip(name, loc, target, sx, sy, rad):
        if rad <= 0: return None
        l = bpy.data.lights.new(name, 'AREA'); l.shape = 'RECTANGLE'
        l.size, l.size_y = sx, sy; l.energy = rad * sx * sy * math.pi
        ob = bpy.data.objects.new(name, l); ob.location = loc; sc.collection.objects.link(ob)
        aim(ob, target)
        return ob
    def refl_only(ob):   # seen by glossy (reflection) rays only
        if ob: ob.visible_diffuse = False; ob.visible_transmission = False
        return ob
    def diff_only(ob):   # lights diffusely only: never a reflection or something seen through the glass
        if ob: ob.visible_glossy = False; ob.visible_transmission = False
        return ob
    # Rays that have passed through the glass must not see the shadow-catcher floor: the bodies are hollow, so through the
    # windows it showed as transparent film (the page backdrop) with a wavy refracted edge.
    floor.visible_transmission = False
    def emissive_quad(name, corners, axis, v0, v1, lo, hi):
        """Reflection-only emissive quad whose radiance runs lo..hi (smoothstep) as corner . axis goes v0..v1."""
        me = bpy.data.meshes.new(name); me.from_pydata(corners, [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
        m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; t.nodes.clear()
        em = t.nodes.new('ShaderNodeEmission'); out = t.nodes.new('ShaderNodeOutputMaterial')
        gp = t.nodes.new('ShaderNodeNewGeometry'); dt = t.nodes.new('ShaderNodeVectorMath'); dt.operation = 'DOT_PRODUCT'
        dt.inputs[1].default_value = tuple(axis)
        mr2 = t.nodes.new('ShaderNodeMapRange'); mr2.clamp = True; mr2.interpolation_type = 'SMOOTHSTEP'
        mr2.inputs['From Min'].default_value = v0; mr2.inputs['From Max'].default_value = v1
        mr2.inputs['To Min'].default_value = lo; mr2.inputs['To Max'].default_value = hi
        t.links.new(gp.outputs['Position'], dt.inputs[0]); t.links.new(dt.outputs['Value'], mr2.inputs['Value'])
        t.links.new(mr2.outputs[0], em.inputs['Strength']); t.links.new(em.outputs[0], out.inputs[0])
        ob.data.materials.append(m); ob.visible_camera = False; ob.visible_shadow = False; refl_only(ob)
        return ob
    # 1 big soft overhead, diffuse only: the form gradient on bonnet / roof / door tops (and the floor shadow)
    tsx, tsy = L * D['top_l'], L * D['top_w']   # sx runs along the car (rz turns it), sy across
    diff_only(softbox('top', (cx, cy, H + D['top_h']), (0, 0, rz), tsx, tsy, D['top_rad'] * tsx * tsy * math.pi))
    # 1b the same panel as seen in reflections: a rear->front radiance gradient, so a flat roof or bonnet shows a sheen, not a flat grey
    if D['topg_hi'] > 0:
        zq = H + D['top_h'] - 0.02; hl, hw = tsx / 2, tsy / 2
        lonax = (0, 1, 0) if long_y else (1, 0, 0)
        cor = [(cx + (-hw if long_y else -hl), cy + (-hl if long_y else -hw), zq), (cx + (hw if long_y else hl), cy + (-hl if long_y else -hw), zq),
               (cx + (hw if long_y else hl), cy + (hl if long_y else hw), zq), (cx + (-hw if long_y else -hl), cy + (hl if long_y else hw), zq)]
        c0 = (cy if long_y else cx)
        emissive_quad('top_refl', cor, lonax, c0 - hl, c0 + hl, D['topg_lo'] if D['topg_dir'] > 0 else D['topg_hi'], D['topg_hi'] if D['topg_dir'] > 0 else D['topg_lo'])
    # The five views all shoot from one side of the car, so the camera side gets the strips (crisp lines on the
    # bonnet, roof and shoulder) and the far side gets a tall soft gradient wall that the doors and flanks reflect.
    camv = [(c.matrix_world.translation.x if long_y else c.matrix_world.translation.y) for c in cams.values()]
    cs = 1 if sum(camv) >= 0 else -1
    # 2 long narrow strips: crisp highlight lines along the shoulder and roofline
    for sgn in ((cs, -cs) if D['far_strips'] else (cs,)):
        refl_only(strip(f'strip{sgn}', lat(sgn, 0, L * D['strip_d'], H + D['strip_h']), lat(sgn, 0, 0, H * 0.55),
                        L * D['strip_l'], L * D['strip_w'], D['strip_rad']))
        # 3 low strips for the sills
        refl_only(strip(f'low{sgn}', lat(sgn, 0, L * D['low_d'], D['low_h']), lat(sgn, 0, 0, H * 0.3),
                        L * D['strip_l'], L * D['low_w'], D['low_rad']))
    # 2b the shoulder strip: one long, thin, bright line parallel to the car, above the shoulder (see the camera-side mirror geometry:
    #    a crest with a 45 degree normal reflects what is straight above it, so one long strip draws one continuous line along door and shoulder)
    if D['sh_rad'] > 0:
        for sgn in ((cs, -cs) if D['sh_both'] else (cs,)):
            refl_only(strip(f'shoulder{sgn}', lat(sgn, 0, D['sh_x'], H + D['sh_h']), lat(sgn, 0, D['sh_x'] - 0.6, 0.0),
                            L * D['sh_l'], D['sh_w'], D['sh_rad']))
    # 3b far-side gradient wall: emissive quad, bright at the top fading to dark at the bottom, reflection-only
    if D['panel_rad_top'] > 0:
        dd = L * D['panel_d']; hl2 = L * D['panel_len'] / 2; zt = D['panel_h']
        corners = [lat(-cs, -hl2, dd, 0.05), lat(-cs, hl2, dd, 0.05), lat(-cs, hl2, dd, zt), lat(-cs, -hl2, dd, zt)]
        emissive_quad('panel', corners, (0, 0, 1), 0.05, zt, D['panel_rad_bottom'], D['panel_rad_top'])
    # 4 weak rim strips ahead of / behind the car: separate roof and bonnet from the dark background
    for sgn in (1, -1):
        refl_only(strip(f'rim{sgn}', lat(1, sgn * L * D['rim_d'], 0, H + D['rim_h']), lat(1, 0, 0, H * 0.8),
                        L * D['rim_l'], L * D['rim_w'], D['rim_rad']))
    # 5 soft diffuse-only fills: lift the flanks, lower body, grille and bumper that the overhead light cannot reach (no reflections)
    if D['fill_rad'] > 0:
        f = strip('fill_cam', lat(cs, 0, L * D['fill_d'], D['fill_h']), lat(cs, 0, 0, H * 0.4), L * 1.1, 1.8, D['fill_rad']); diff_only(f)
    if D['end_rad'] > 0:
        for sgn in (1, -1):
            f = strip(f'end{sgn}', lat(cs, sgn * L * D['end_d'], 0.0, 1.0), lat(cs, 0, 0, H * 0.4), 3.6, 1.6, D['end_rad']); diff_only(f)
    # 6 dim light inside the cabin: lights the seats / dash behind the (otherwise shadowing) glass
    if D['cabin_rad'] > 0:
        cab = softbox('cabin', (cx, cy + D['cabin_y'], D['cabin_h']), (0, 0, 0), D['cabin_w'], D['cabin_l'], D['cabin_rad'] * D['cabin_w'] * D['cabin_l'] * math.pi); diff_only(cab)
        if not D['cabin_floor']:
            cc = bpy.data.collections.new('cabin_receivers')
            for o in meshes: cc.objects.link(o)
            cab.light_linking.receiver_collection = cc

if fix.get('glass_unlink') and a.studio == 'dark':
    # the crisp strips light everything except the glass (Cycles light linking: receivers = every other object)
    gu = fix['glass_unlink']
    glass_objs = {o for o in meshes if (re.search(gu, o.name) if isinstance(gu, str) else
                                        any(s.material and 'glass' in s.material.name.lower() for s in o.material_slots))}
    rc = bpy.data.collections.new('light_receivers')
    for o in sc.objects:
        if o not in glass_objs and o.type in ('MESH',): rc.objects.link(o)
    gl = fix.get('glass_unlink_lights', r'(strip|low|shoulder|rim)')   # which lights; the default is every crisp strip
    for o in sc.objects:
        if o.type == 'LIGHT' and re.match(gl, o.name): o.light_linking.receiver_collection = rc


if a.plate:
    # Studio plate: the welcome stills' floor, light pool and black void, without the car (its frames bring the body and
    # its shadow). The key light sits where the hero still's does: placed from the front three-quarter camera, so the
    # pool is the same physical light in every view.
    if a.studio != 'dark': sys.exit('--plate needs --studio dark')
    for o in [o for o in sc.objects if o.type == 'MESH' and o != floor]: bpy.data.objects.remove(o, do_unlink=True)
    floor.is_shadow_catcher = False
    fb = floor.data.materials[0].node_tree.nodes['Principled BSDF']
    fb.inputs['Base Color'].default_value = (0.26, 0.26, 0.27, 1); fb.inputs['Roughness'].default_value = 0.3
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    ck = cams.get('frontThreeQuarter') or next(iter(cams.values()))
    cpos = ck.matrix_world.translation; tgt = mathutils.Vector((cx, cy, 0))
    kpos = tgt + (cpos - tgt) * 0.12 + mathutils.Vector((0, 0, H + 2.2))
    key = softbox('hero_key', kpos, (0, 0, 0), L * 0.9, L * 0.6, float(os.environ.get('HERO_KEY', '450')))
    key.rotation_euler = (tgt - kpos).to_track_quat('-Z', 'Y').to_euler()

if a.hero:
    # Welcome still: everything the frames leave to the live engine is rendered here instead, as the first
    # four cars' Cycles stills were: real tyres, the shop's rim, a disc and caliper, a polished floor, the paint itself.
    if a.studio != 'dark' or not WHEELS: sys.exit('--hero needs --studio dark and the wheel positions (.wheels.json)')
    rim_files = (a.rims.split(',') + [''])[:2]
    if not rim_files[0]: sys.exit('--hero needs --rims <front.glb>[,<rear.glb>]')
    for o in [o for o in sc.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'rubber']:
        bpy.data.objects.remove(o, do_unlink=True)   # the stand-ins; real tyres below
    def matp(name, col, met, rough, coat=0.0):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = met
        b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat
        return m
    rubber = matp('hero_rubber', (0.022, 0.022, 0.023), 0.0, 0.62)
    disc_m = matp('hero_disc', (0.42, 0.42, 0.43), 1.0, 0.32)
    cal_m = matp('hero_caliper', (0.55, 0.02, 0.02), 0.0, 0.3, 1.0)
    def load_rim(path):
        before = set(bpy.data.objects)
        try: bpy.ops.import_scene.gltf(filepath=path)
        except RuntimeError as e: sys.exit(f'--rims {path}: {e}')
        parts = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        if not parts: sys.exit(f'--rims {path}: no meshes')
        for o in parts:   # bake transforms (the importer's Y-up root included) so the parts join and place as one object
            mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world = mathutils.Matrix()
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
        rim = bpy.context.view_layer.objects.active
        rad = max(max(abs(v.co.x), abs(v.co.z)) for v in rim.data.vertices)
        return rim, rad
    rims = [load_rim(f) for f in rim_files if f]
    for i, (x, y, z, r, wd) in enumerate(WHEELS):
        src, rad = rims[min(i // 2, len(rims) - 1)]   # wheels.json lists the front pair first
        sgn = 1 if x > 0 else -1
        ro = r * 0.78                                  # rim outer radius: a 20-inch rim on the car's own tyre
        rim = src.copy(); rim.data = src.data; sc.collection.objects.link(rim)
        rim.rotation_mode = 'XYZ'   # glTF imports use quaternions, which would ignore rotation_euler
        rim.scale = (ro / rad,) * 3; rim.rotation_euler = (0, 0, sgn * math.pi / 2)   # face (-Y) outwards (+-X)
        rim.location = (x, y, z)
        ri = ro * 0.97; bpy.ops.mesh.primitive_torus_add(major_radius=(r + ri) / 2, minor_radius=(r - ri) / 2,
                                                         major_segments=96, minor_segments=24, location=(x, y, z), rotation=(0, math.pi / 2, 0))
        ty = bpy.context.object; ty.scale = (1, 1, wd / (r - ri)); ty.data.materials.append(rubber)
        for pl in ty.data.polygons: pl.use_smooth = True
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=ri * 0.78, depth=0.03, location=(x - sgn * 0.07, y, z), rotation=(0, math.pi / 2, 0))
        bpy.context.object.data.materials.append(disc_m)
        cy_off = 0.62 * ri * 0.78; front = i < 2
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x - sgn * 0.045, y + (cy_off if front else -cy_off) * 0.7, z + cy_off * 0.7))
        cal = bpy.context.object; cal.scale = (0.07, 0.15, 0.09); cal.rotation_euler = (math.radians(45 if front else -45), 0, 0)
        cal.data.materials.append(cal_m)
    for o in (src for src, _ in rims): bpy.data.objects.remove(o, do_unlink=True)
    floor.is_shadow_catcher = False   # a real floor: the light pool and the car's reflection are in the picture
    fb = floor.data.materials[0].node_tree.nodes['Principled BSDF']
    fb.inputs['Base Color'].default_value = (0.26, 0.26, 0.27, 1); fb.inputs['Roughness'].default_value = 0.3
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0   # a black void, as the reference stills
    HERO_KEY = float(os.environ.get('HERO_KEY', '450'))   # the key light's watts: it throws the pool on the floor
    cam0 = cams.get((a.views or 'frontThreeQuarter').split(',')[0])
    if cam0:
        cpos = cam0.matrix_world.translation; tgt = mathutils.Vector((cx, cy, 0))
        kpos = tgt + (cpos - tgt) * 0.12 + mathutils.Vector((0, 0, H + 2.2))   # over the car: the pool falls off towards the camera
        key = softbox('hero_key', kpos, (0, 0, 0), L * 0.9, L * 0.6, HERO_KEY)
        key.rotation_euler = (tgt - kpos).to_track_quat('-Z', 'Y').to_euler()
        cam0.data.lens *= float(os.environ.get('HERO_ZOOM', '1.3'))
    hx, kind = (a.hero.split(',') + ['Metallic'])[:2]
    hx = hx.strip().lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', hx): sys.exit(f"--hero {a.hero!r}: expected '<#rrggbb>,<Metallic|Solid|Frozen>'")
    srgb = [int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    pb.inputs['Base Color'].default_value = (*lin, 1)
    met, rough, coat = {'Solid': (0.0, 0.35, 1.0), 'Frozen': (0.5, 0.55, 0.0)}.get(kind.strip(), (0.75, 0.38, 1.0))
    pb.inputs['Metallic'].default_value = met; pb.inputs['Roughness'].default_value = rough; pb.inputs['Coat Weight'].default_value = coat

def srgb_lin(hx, what):
    hx = hx.strip().lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', hx): sys.exit(f'{what}: {hx!r} is not a #rrggbb colour')
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))]

if a.wheel_layer:
    # Path-traced wheels for the configurator: what the live WebGL wheels draw, rendered in the frames' own studio so
    # they sit in it like the body does. Body and floor stay in the scene as holdouts: they shade the wheels (arch
    # shadows, reflections) and hide what they cover (the far wheels behind the body), but render transparent.
    if a.studio != 'dark' or not WHEELS: sys.exit('--wheel-layer needs --studio dark and the wheel positions (.wheels.json)')
    try:
        LAYERS = json.load(open(a.wheel_layer))
        for e in LAYERS: e['name'], e['rims'][0], e['finish'][3], float(e['inches'])
    except (OSError, ValueError, KeyError, IndexError, TypeError) as e:
        sys.exit(f'--wheel-layer {a.wheel_layer}: {e!r} (expected a list of {{name, rims, finish, inches}})')
    for e in LAYERS:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', e['name']): sys.exit(f'--wheel-layer: bad name {e["name"]!r}')
    for o in [o for o in sc.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'rubber']:
        bpy.data.objects.remove(o, do_unlink=True)   # the stand-in tyres; real ones below
    floor.is_shadow_catcher = False
    for o in sc.objects:
        if o.type == 'MESH': o.is_holdout = True
    receivers = bpy.data.collections.get('light_receivers')   # glass_unlink: the strips light only what is in it

    def matp(name, col, met, rough, coat=0.0, coat_rough=0.03):
        m = bpy.data.materials.new(name); b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = met
        b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = coat_rough
        return m
    rubber = matp('layer_rubber', (0.028, 0.027, 0.026), 0.0, 0.62)           # wheelKit's #302e2d
    # a faint grain on the rubber, as moulded tyres have, so the sidewall is not a flat black sheet
    _n = rubber.node_tree.nodes; _tex = _n.new('ShaderNodeTexNoise'); _tex.inputs['Scale'].default_value = 900
    _bump = _n.new('ShaderNodeBump'); _bump.inputs['Strength'].default_value = 0.08
    rubber.node_tree.links.new(_tex.outputs['Fac'], _bump.inputs['Height'])
    rubber.node_tree.links.new(_bump.outputs['Normal'], _n['Principled BSDF'].inputs['Normal'])
    disc_m = matp('layer_disc', (0.42, 0.42, 0.43), 1.0, 0.32)
    hat_m = matp('layer_hat', (0.08, 0.08, 0.085), 0.8, 0.45)                 # the dark disc bell
    cal_m = matp('layer_caliper', srgb_lin('c01824', 'caliper'), 0.0, 0.3, 1.0)   # wheelKit's M Competition Red
    rim_cache = {}
    def load_rim(path):
        if path in rim_cache: return rim_cache[path]
        before = set(bpy.data.objects)
        try: bpy.ops.import_scene.gltf(filepath=path)
        except RuntimeError as e: sys.exit(f'--wheel-layer rim {path}: {e}')
        parts = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        if not parts: sys.exit(f'--wheel-layer rim {path}: no meshes')
        for o in parts:
            mw = o.matrix_world.copy(); o.parent = None; o.data.transform(mw); o.matrix_world = mathutils.Matrix()
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts: o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
        rim = bpy.context.view_layer.objects.active
        for o in [o for o in bpy.data.objects if o not in before and o != rim]: bpy.data.objects.remove(o, do_unlink=True)
        sc.collection.objects.unlink(rim) if rim.name in sc.collection.objects else None
        for c in list(rim.users_collection): c.objects.unlink(rim)
        vs = rim.data.vertices
        rad = max(max(abs(v.co.x), abs(v.co.z)) for v in vs); ymin = min(v.co.y for v in vs)
        rim_cache[path] = (rim, rad, ymin)
        return rim_cache[path]

    def tyre(x, y, z, r, ri, wd):
        """A tyre turned from a profile around the axle (X): bead, gently bulged flat sidewalls, rounded shoulders and a
        tread with three circumferential grooves, as wheelKit's buildTyre, not a torus."""
        h = r - ri; hw = wd / 2; gd = min(0.008, h * 0.06)
        side = [(-0.90, ri), (-0.97, ri + 0.2 * h), (-1.0, ri + 0.5 * h), (-0.985, ri + 0.78 * h), (-0.94, r - 0.035 * h),
                (-0.86, r - 0.004), (-0.78, r)]
        tread = []
        for c in (-0.45, 0.0, 0.45):   # grooves 12 mm wide
            g = 0.012 / hw * 0.5 if hw > 0 else 0.03
            tread += [(c - g, r), (c - g, r - gd), (c + g, r - gd), (c + g, r)]
        prof = side + tread + [(-a, rr) for a, rr in reversed(side)]
        bm = bmesh.new()
        vs = [bm.verts.new((a * hw, 0, rr)) for a, rr in prof]
        es = [bm.edges.new((vs[k], vs[k + 1])) for k in range(len(vs) - 1)]
        bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(1, 0, 0), angle=2 * math.pi, steps=144, use_merge=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new('layer_tyre'); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new('layer_tyre', me); sc.collection.objects.link(ob)
        ob.location = (x, y, z); me.materials.append(rubber)
        for pl in me.polygons: pl.use_smooth = True
        return ob

    def caliper(x, y, z, disc_r, s, toward):
        """A fixed caliper over the top of the disc, towards the car's end (toward +1 front / -1 rear wheels): an
        annular sector that hugs the disc (76 degrees, from 0.56 to 1.1 x its radius), straddling it, bevelled so its
        edges catch the light like the engine's cast caliper."""
        bm = bmesh.new(); n = 14; a0, a1 = math.radians(16), math.radians(92); r0, r1 = disc_r * 0.56, disc_r * 1.1
        half = 0.065 * s
        ring = []
        for side in (-half, half):
            for r in (r0, r1):
                ring.append([bm.verts.new((side, -toward * math.cos(a0 + (a1 - a0) * k / n) * r, math.sin(a0 + (a1 - a0) * k / n) * r))
                             for k in range(n + 1)])
        (il, ol, ir, orr) = ring
        for k in range(n):
            for q in ((il[k], il[k + 1], ol[k + 1], ol[k]), (ir[k], orr[k], orr[k + 1], ir[k + 1]),
                      (ol[k], ol[k + 1], orr[k + 1], orr[k]), (il[k], ir[k], ir[k + 1], il[k + 1])):
                bm.faces.new(q)
        for e_ in (0, n):
            bm.faces.new((il[e_], ol[e_], orr[e_], ir[e_]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new('layer_caliper'); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new('layer_caliper', me); sc.collection.objects.link(ob)
        ob.location = (x, y, z); me.materials.append(cal_m)
        bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.006 * s; bv.segments = 3; bv.limit_method = 'ANGLE'
        for pl in me.polygons: pl.use_smooth = True
        return ob

    def build_wheels(e):
        """The four wheels of one layer, as the engine mounts them (mountRimModel, rimLayout): the rim's largest
        dimension is a 20-inch rim on a 0.35 m tyre, scaled by inches/20; its face sits 12 mm inside the tyre's outer
        plane; the tyre keeps its size and the sidewall thins as the rim grows."""
        hx, met, rough, coat = e['finish']
        fin = matp('finish_' + e['name'], srgb_lin(hx, e['name']), float(met), float(rough), float(coat))
        made = []
        for i, (x, y, z, r, wd) in enumerate(WHEELS):
            src, rad, ymin = load_rim(e['rims'][min(i // 2, len(e['rims']) - 1)])   # front pair first
            sgn = 1 if x > 0 else -1; s = r / 0.35
            ro = r * (0.26 / 0.35) * float(e['inches']) / 20
            rim = src.copy(); sc.collection.objects.link(rim)
            for sl in rim.material_slots: sl.link = 'OBJECT'; sl.material = fin
            k = ro / rad; rim.rotation_mode = 'XYZ'
            rim.scale = (k,) * 3; rim.rotation_euler = (0, 0, sgn * math.pi / 2)   # face (-Y) outwards (+-X)
            rim.location = (x + sgn * (wd / 2 - 0.012 * s + ymin * k), y, z)
            ri = min(ro * 0.97, r - 0.03)
            ty = tyre(x, y, z, r, ri, wd)
            bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=ro * 0.78, depth=0.03, location=(x - sgn * 0.07 * s, y, z),
                                                rotation=(0, math.pi / 2, 0))
            dk = bpy.context.object; dk.data.materials.append(disc_m)
            bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=ro * 0.78 * 0.5, depth=0.05, location=(x - sgn * 0.05 * s, y, z),
                                                rotation=(0, math.pi / 2, 0))
            hat = bpy.context.object; hat.data.materials.append(hat_m)
            cal = caliper(x - sgn * 0.07 * s, y, z, ro * 0.78, s, 1 if i < 2 else -1)
            made += [rim, ty, dk, hat, cal]
        if receivers:
            for o in made: receivers.objects.link(o)
        for o in made[0::5]: fill_rx.objects.link(o)   # the rims only: lit rubber turns grey
        return made, fin

    # The wheel fill: a low softbox beside the camera that lights only the wheels (light linking), as a car photographer
    # strips light along the wheels. Without it the dark studio leaves dark finishes (Hyper Black, Gloss Black) murky
    # where the live engine's environment gives their spoke edges a highlight. Placed per view in the render loop.
    WHEEL_FILL = float(os.environ.get('WHEEL_FILL', '90'))
    fill_rx = bpy.data.collections.new('wheel_fill_receivers')
    wheel_fill = softbox('wheel_fill', (0, 0, 0), (0, 0, 0), 3.0, 1.0, WHEEL_FILL)
    wheel_fill.visible_camera = False
    wheel_fill.light_linking.receiver_collection = fill_rx
    wz = sum(w[2] for w in WHEELS) / len(WHEELS)
    def place_fill(cam):
        tgt = mathutils.Vector((cx, cy, wz)); cpos = cam.matrix_world.translation
        flat = mathutils.Vector((cpos.x - tgt.x, cpos.y - tgt.y, 0))
        if flat.length < 1e-3: flat = mathutils.Vector((0, -1, 0))
        pos = tgt + flat.normalized() * 4.5 + mathutils.Vector((0, 0, 0.35))   # same distance in every view
        wheel_fill.location = pos
        wheel_fill.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()

    def wheel_box(cam):
        """The wheels' extent in this camera's frame (fractions, top-left origin), padded; None when off frame."""
        from bpy_extras.object_utils import world_to_camera_view
        us, vs = [], []
        for (x, y, z, r, wd) in WHEELS:
            for dx in (-wd / 2, wd / 2):
                for dy in (-r, r):
                    for dz in (-r, r):
                        p = world_to_camera_view(sc, cam, mathutils.Vector((x + dx, y + dy, z + dz)))
                        if p.z > 0: us.append(p.x); vs.append(1 - p.y)
        if not us: return None
        pad = 0.015
        box = [max(0.0, min(us) - pad), max(0.0, min(vs) - pad), min(1.0, max(us) + pad), min(1.0, max(vs) + pad)]
        return box if box[2] > box[0] and box[3] > box[1] else None

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
if a.threads: sc.render.threads_mode = 'FIXED'; sc.render.threads = a.threads
sc.cycles.seed = a.seed; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = a.width; sc.render.resolution_y = round(a.width / 1.6)
sc.view_settings.view_transform = 'Standard'  # linear-safe: the browser mixes black/white passes
sc.view_settings.exposure = -1.6 if a.studio == 'default' else DARK['exposure']
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'

FLAKE_ROUGH = 0.38   # metallic flake layer: a glossy-but-blurred metal reflection under the clear coat
PASSES = {  # name: (base value, metallic, roughness, coat)
    'gloss_w': (1.0, 0.0, 0.30, 1.0), 'gloss_b': (0.0, 0.0, 0.30, 1.0),
    'matte_w': (1.0, 0.0, 0.55, 0.0), 'matte_b': (0.0, 0.0, 0.55, 0.0),
}

def setup_derive():
    """One render gives W; the compositor derives B = W - DiffColor * (DiffDirect + DiffIndirect) * paintmask and writes both.
    Only the paint's diffuse depends on base colour (metallic 0; the coat and the dielectric specular layer do not), and the
    mask keeps every other material's diffuse in B. Inter-reflection between paint panels is the only (tiny) approximation."""
    vl = sc.view_layers[0]
    vl.use_pass_diffuse_direct = vl.use_pass_diffuse_indirect = vl.use_pass_diffuse_color = vl.use_pass_normal = True
    vl.cycles.denoising_store_passes = True   # gives the 'Noisy Image' pass
    aov = vl.aovs.add(); aov.name = 'paintmask'; aov.type = 'VALUE'
    ng = bpy.data.node_groups.new('derive', 'CompositorNodeTree'); sc.compositing_node_group = ng
    rl = ng.nodes.new('CompositorNodeRLayers'); rl.layer = vl.name
    def mix(op, x, y):
        m = ng.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.blend_type = op; m.clamp_result = False
        m.inputs[0].default_value = 1.0   # Factor
        for nm, v in (('A', x), ('B', y)):
            sock = [i for i in m.inputs if i.name == nm and i.type == 'RGBA'][0]
            if isinstance(v, tuple): sock.default_value = v
            else: ng.links.new(v, sock)
        return [o for o in m.outputs if o.type == 'RGBA'][0]
    light = mix('ADD', rl.outputs['Diffuse Direct'], rl.outputs['Diffuse Indirect'])
    # The passes are averaged per pixel like colour, so at anti-aliased edges the paint's share is already in them: multiplying by the
    # fractional mask would count it twice (bright seams along every panel edge). The mask is used as a plain 'any paint here' switch.
    has_paint = ng.nodes.new('ShaderNodeMath'); has_paint.operation = 'GREATER_THAN'; has_paint.inputs[1].default_value = 0.01
    ng.links.new(rl.outputs['paintmask'], has_paint.inputs[0])
    diff = mix('MULTIPLY', mix('MULTIPLY', light, rl.outputs['Diffuse Color']), has_paint.outputs[0])
    # W is Cycles' own denoised Combined, exactly what the two-render path writes. B on the paint is what a black-base render would be:
    # the NOISY combined minus the (raw) paint diffuse, then denoised the same way (guides: normal, and an albedo that is black on the paint).
    # Denoising W and subtracting a smooth diffuse term instead would leave W's denoiser texture in B, which shows on dark paints.
    # Off the paint nothing is subtracted, so there B is simply the noisy W denoised again; alpha is W's (already clean).
    raw_b = mix('SUBTRACT', rl.outputs['Noisy Image'], diff)
    alb_b = mix('MULTIPLY', rl.outputs['Diffuse Color'], mix('SUBTRACT', (1, 1, 1, 1), has_paint.outputs[0]))
    dn = ng.nodes.new('CompositorNodeDenoise')
    ng.links.new(raw_b, dn.inputs['Image']); ng.links.new(alb_b, dn.inputs['Albedo']); ng.links.new(rl.outputs['Normal'], dn.inputs['Normal'])
    sa = ng.nodes.new('CompositorNodeSetAlpha'); sa.inputs['Type'].default_value = 'Replace Alpha'
    ng.links.new(dn.outputs['Image'], sa.inputs['Image']); ng.links.new(rl.outputs['Alpha'], sa.inputs['Alpha'])
    out_w = rl.outputs['Image']; out_b = sa.outputs['Image']
    fo = ng.nodes.new('CompositorNodeOutputFile')
    fo.format.media_type = 'IMAGE'; fo.format.file_format = 'PNG'; fo.format.color_mode = 'RGBA'; fo.format.color_depth = '8'
    fo.format.color_management = 'FOLLOW_SCENE'
    fo.file_output_items.clear()
    fo.file_output_items.new('RGBA', 'W'); fo.file_output_items.new('RGBA', 'B')
    if os.environ.get('DEBUG_PASSES'):
        for nm in ('mask', 'light', 'diffcol'): fo.file_output_items.new('RGBA', nm)
    ng.links.new(out_w, fo.inputs[0]); ng.links.new(out_b, fo.inputs[1])
    if os.environ.get('DEBUG_PASSES'):
        ng.links.new(mix('MULTIPLY', rl.outputs['paintmask'], (1, 1, 1, 1)), fo.inputs[2]); ng.links.new(light, fo.inputs[3]); ng.links.new(rl.outputs['Diffuse Color'], fo.inputs[4])
    return fo

if DERIVE:
    # flake: the same coat over a white METAL base. The browser adds (flake_w - gloss_b) x paint colour for metallic
    # paints, which gives them coloured, angle-dependent specular (bright where the panel faces a light, dark as it
    # turns away) instead of the flat look of a diffuse-only tint. Only its W is used.
    SETS = {'gloss': (0.30, 1.0, 0.0), 'matte': (0.55, 0.0, 0.0), 'flake': (FLAKE_ROUGH, 1.0, 1.0)}
    fo = setup_derive()
views = a.views.split(',') if a.views else list(cams)
if a.plate:
    sc.render.film_transparent = False; sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.exposure += float(os.environ.get('HERO_EV', '0.0'))
    for v in views:
        if v not in cams: sys.exit(f'--plate: no camera CAM_{v} in {a.glb}')
        sc.camera = cams[v]; os.makedirs(os.path.join(a.out, v), exist_ok=True)
        sc.render.filepath = os.path.join(a.out, v, 'plate.png'); bpy.ops.render.render(write_still=True)
        if not os.path.exists(sc.render.filepath): sys.exit(f'--plate: no file written at {sc.render.filepath}')
        print('rendered', sc.render.filepath, flush=True)
    sys.exit(0)
if a.wheel_layer:
    sc.render.image_settings.color_mode = 'RGBA'
    for v in views:
        if v not in cams: sys.exit(f'--wheel-layer: no camera CAM_{v} in {a.glb}')
    for e in LAYERS:
        todo = [v for v in views if not os.path.exists(os.path.join(a.out, v, 'wheels', e['name'] + '.png'))]
        if not todo: continue
        made, fin = build_wheels(e)
        for v in todo:
            sc.camera = cams[v]; d = os.path.join(a.out, v, 'wheels')
            try: os.makedirs(d, exist_ok=True)
            except OSError as e: sys.exit(f'--wheel-layer: cannot create {d}: {e}')
            place_fill(cams[v])
            box = wheel_box(cams[v])
            if not box: print('no wheels in view', v, flush=True); continue
            try:
                with open(os.path.join(d, 'box.json'), 'w') as f: json.dump([round(b, 5) for b in box], f)
            except OSError as e: sys.exit(f'--wheel-layer: cannot write {d}/box.json: {e}')
            # Blender's border is bottom-left origin; the crop keeps only the wheels' rectangle
            sc.render.use_border = True; sc.render.use_crop_to_border = True
            sc.render.border_min_x, sc.render.border_max_x = box[0], box[2]
            sc.render.border_min_y, sc.render.border_max_y = 1 - box[3], 1 - box[1]
            out = os.path.join(d, e['name'] + '.png'); sc.render.filepath = out + '.tmp.png'
            bpy.ops.render.render(write_still=True)
            if not os.path.exists(sc.render.filepath): sys.exit(f'--wheel-layer: no file written at {sc.render.filepath}')
            try: os.replace(sc.render.filepath, out)   # only complete files count as done (a restart mid-write leaves .tmp)
            except OSError as e: sys.exit(f'--wheel-layer: cannot move {sc.render.filepath} to {out}: {e}')
            print('rendered', out, flush=True)
        for o in made: bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.materials.remove(fin)
    sys.exit(0)
if a.hero:
    v = views[0] if a.views else 'frontThreeQuarter'
    if v not in cams: sys.exit(f'--hero: no camera CAM_{v} in {a.glb}')
    sc.camera = cams[v]; sc.render.film_transparent = False
    sc.view_settings.exposure += float(os.environ.get('HERO_EV', '0.0'))
    sc.render.resolution_x = a.width; sc.render.resolution_y = round(a.width * 9 / 16)
    sc.render.image_settings.color_mode = 'RGB'
    os.makedirs(a.out, exist_ok=True); sc.render.filepath = os.path.join(a.out, 'hero.png')
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(sc.render.filepath): sys.exit(f'--hero: no file written at {sc.render.filepath}')
    print('rendered', sc.render.filepath, flush=True); sys.exit(0)
base_energy = {o.name: o.data.energy for o in sc.objects if o.type == 'LIGHT'}
for v in views:
    sc.camera = cams[v]
    for o in sc.objects:
        if o.type == 'LIGHT':
            g = next((f for k, f in fix.get('view_gain', {}).get(v, {}).items() if o.name.startswith(k)), 1.0)
            o.data.energy = base_energy[o.name] * g
    os.makedirs(os.path.join(a.out, v), exist_ok=True)
    if DERIVE:
        for sname, (rough, coat, metal) in SETS.items():
            if a.passes and not any(x.startswith(sname) for x in a.passes.split(',')): continue
            pb.inputs['Base Color'].default_value = (1, 1, 1, 1); pb.inputs['Metallic'].default_value = metal
            pb.inputs['Roughness'].default_value = rough; pb.inputs['Coat Weight'].default_value = coat
            fo.directory = os.path.join(a.out, v); fo.file_name = ''
            for it, nm in zip(fo.file_output_items, ('W', 'B')): it.name = f'{sname}_{nm.lower()}'
            bpy.ops.render.render(write_still=False)
            print('rendered', os.path.join(a.out, v, sname + '_[wb].png'), flush=True)
        continue
    for name, (base, met, rough, coat) in PASSES.items():
        if a.passes and name not in a.passes.split(','): continue
        pb.inputs['Base Color'].default_value = (base, base, base, 1)
        pb.inputs['Metallic'].default_value = met
        pb.inputs['Roughness'].default_value = rough
        pb.inputs['Coat Weight'].default_value = coat
        sc.render.filepath = os.path.join(a.out, v, name + '.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', sc.render.filepath, flush=True)
