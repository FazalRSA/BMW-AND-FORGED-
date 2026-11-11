"""Window glass.

OWNER: look-dev (shared helpers; car adapters decide which meshes are glass). Target: the cabin is visible
through every window, the windscreen carries at most a soft gradient band, nothing goes white or opaque black.

Helpers (signatures are stable; tune the insides and the config's look.glass values):
    window_material(ctx, name="PL_Glass", tint_hex=None, darkness=1.0) -> material
    assign(material, objects, slot_filter=None)
"""
import bpy

from .core import hex_to_linear


def _principled(mat):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")
    return nt, bsdf, out


def set_input(node, name, value):
    """Set a socket if this Blender version has it; returns True when it did."""
    sock = node.inputs.get(name)
    if sock is None:
        return False
    sock.default_value = value
    return True


def transmissive_material(name, colour, ior, thin_wall=True, shadow_transparency=0.85, roughness=0.0):
    """Clear dielectric that lets light through to what is behind it (shadow rays pass, partly)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True
    nt, bsdf, out = _principled(mat)
    set_input(bsdf, "Base Color", colour)
    set_input(bsdf, "Metallic", 0.0)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "IOR", ior)
    set_input(bsdf, "Transmission Weight", 1.0)
    set_input(bsdf, "Coat Weight", 0.0)
    if thin_wall:
        set_input(bsdf, "Thin Wall", True)
    for link in list(out.inputs["Surface"].links):
        nt.links.remove(link)
    if shadow_transparency > 0:
        path = nt.nodes.new("ShaderNodeLightPath")
        clear = nt.nodes.new("ShaderNodeBsdfTransparent")
        clear.inputs["Color"].default_value = (*colour[:3], 1.0)
        scale = nt.nodes.new("ShaderNodeMath")
        scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = shadow_transparency
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(path.outputs["Is Shadow Ray"], scale.inputs[0])
        nt.links.new(scale.outputs[0], mix.inputs[0])
        nt.links.new(bsdf.outputs[0], mix.inputs[1])
        nt.links.new(clear.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
    else:
        nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def window_material(ctx, name="PL_Glass", tint_hex=None, darkness=1.0):
    look = ctx.cfg.get("look", {}).get("glass", {})
    r, g, b, _ = hex_to_linear(tint_hex or look.get("tint_hex", "#D9E4E0"))
    colour = (r * darkness, g * darkness, b * darkness, 1.0)
    return transmissive_material(name, colour, float(look.get("ior", 1.52)), bool(look.get("thin_wall", True)),
                                 float(look.get("shadow_transparency", 0.85)))


def assign(material, objects, slot_filter=None):
    """Put material on every slot of the objects (or only on slots whose material name passes slot_filter)."""
    n = 0
    for o in objects:
        for slot in o.material_slots:
            if slot.material is not None and (slot_filter is None or slot_filter(slot.material.name)):
                slot.material = material
                n += 1
    return n


def apply(ctx):
    pass
