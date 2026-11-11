"""Headlights and tail lights: clear lenses, reflectors and the daytime running lights.

OWNER: look-dev (shared helpers; car adapters decide which meshes are lens, reflector and light guide).
Target: crystal-clear lenses with the internals visible, DRLs lit in selective yellow (config look.drl),
bright enough to read as on, not so bright that the tone curve washes them to white.

Helpers (signatures are stable; tune the insides and the config's look.lens / look.drl values):
    lens_material(ctx, name="PL_Lens") -> material
    reflector_material(ctx, name="PL_Reflector") -> material
    emitter_material(ctx, name, hex_code, strength) -> material
    drl_material(ctx, name="PL_DRL") -> material
"""
import bpy

from .core import hex_to_linear
from .glass import _principled, set_input, transmissive_material


def lens_material(ctx, name="PL_Lens"):
    look = ctx.cfg.get("look", {}).get("lens", {})
    return transmissive_material(name, (1.0, 1.0, 1.0, 1.0), float(look.get("ior", 1.585)),
                                 bool(look.get("thin_wall", True)), 1.0)


def reflector_material(ctx, name="PL_Reflector", roughness=0.1):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True
    nt, bsdf, out = _principled(mat)
    set_input(bsdf, "Base Color", (0.91, 0.92, 0.92, 1.0))
    set_input(bsdf, "Metallic", 1.0)
    set_input(bsdf, "Roughness", roughness)
    if not out.inputs["Surface"].is_linked:
        nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def emitter_material(ctx, name, hex_code, strength):
    """A lit light guide. It is not sampled as a lamp (that only makes fireflies); it just glows."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True
    nt, bsdf, out = _principled(mat)
    colour = hex_to_linear(hex_code)
    set_input(bsdf, "Base Color", (0.0, 0.0, 0.0, 1.0))
    set_input(bsdf, "Roughness", 0.4)
    set_input(bsdf, "Emission Color", colour)
    set_input(bsdf, "Emission Strength", float(strength))
    if not out.inputs["Surface"].is_linked:
        nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    try:
        mat.cycles.emission_sampling = 'NONE'
    except (AttributeError, TypeError):
        pass
    return mat


def drl_material(ctx, name="PL_DRL"):
    look = ctx.cfg.get("look", {}).get("drl", {})
    return emitter_material(ctx, name, look.get("hex", "#FFBA00"), look.get("strength", 6.0))


def apply(ctx):
    pass
