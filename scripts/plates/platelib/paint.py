"""Body paint: one shader, driven by the paint table in plates.config.json.

OWNER: look-dev (shared). This is the baseline rig from the approved hero stills: the studio's Paint material
(Principled base, Voronoi flake on the base normal, noise-driven coat roughness). Each finish class (solid,
metallic, pearl, frozen, satin) must read as what it is at a glance; see docs/PLATES_MASTER_PLAN.md.
"""
import bpy

from .core import fail, hex_to_linear

REF_FLAKE = 0.32          # 'metallic' flake strength the studio's flake nodes were tuned for
METAL_GAIN = 1.2          # table metalness 0.75 -> 0.9, the value the reference render used
THIN_FILM_NM = 300.0      # pearl colour flop: thin-film thickness per unit of table iridescence


class PaintRig:
    def __init__(self, ctx):
        mat = bpy.data.materials.get("Paint")
        if mat is None or mat.node_tree is None:
            fail("studio Paint material missing")
        self.mat = mat
        nt = mat.node_tree
        self.bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if self.bsdf is None:
            fail("Paint material has no Principled BSDF")
        self.flake = next((n for n in nt.nodes if n.type == 'VECT_MATH' and n.operation == 'MULTIPLY_ADD'), None)
        self.coat = next((n for n in nt.nodes if n.type == 'MAP_RANGE'), None)
        self.flake_mul = tuple(self.flake.inputs[1].default_value) if self.flake else None
        self.flake_add = tuple(self.flake.inputs[2].default_value) if self.flake else None
        self.current = None

    def set_input(self, name, value):
        sock = self.bsdf.inputs.get(name)
        if sock is not None and not sock.is_linked:
            sock.default_value = value

    def apply(self, p):
        """p is Config.paint(...): hex plus metalness, roughness, clearcoat, clearcoatRoughness, flake, iridescence."""
        self.set_input("Base Color", hex_to_linear(p["hex"]))
        self.set_input("Metallic", min(1.0, p["metalness"] * METAL_GAIN))
        self.set_input("Roughness", p["roughness"])
        self.set_input("Coat Weight", p["clearcoat"])
        irid = p.get("iridescence", 0.0)
        self.set_input("Thin Film Thickness", THIN_FILM_NM * irid)
        self.set_input("Thin Film IOR", p.get("iridescenceIOR", 1.5))
        if self.flake:
            f = p.get("flake", 0.0) / REF_FLAKE
            self.flake.inputs[1].default_value = tuple(v * f for v in self.flake_mul)
            self.flake.inputs[2].default_value = tuple(v * f for v in self.flake_add)
        if self.coat:
            cr = p["clearcoatRoughness"]
            self.coat.inputs["To Min"].default_value = cr * 0.5
            self.coat.inputs["To Max"].default_value = cr * 4.0 / 3.0
        self.current = p
