"""Catalogue wheels: swap the rim, keep the car's own tyres, discs and calipers.

OWNER: wheels. The render driver calls these; fill them in.

    prepare_body(ctx)             once per scene, before body plates (for example: stop the factory rim
                                  colouring the floor reflection)
    fit(ctx, wheel_id, finish_id) hide the factory rims, mount the catalogue rim on all four hubs
    factory(ctx)                  put the factory rims back
    plate_mode(ctx, on)           wheel-plate mode: transparent film, everything that is not tyre, rim or
                                  brake becomes a holdout
    plate_region(ctx)             (left, top, right, bottom) frame fractions around the wheels in view
"""
from .core import fail


def prepare_body(ctx):
    pass


def fit(ctx, wheel_id, finish_id):
    fail("wheels.fit is not written yet")


def factory(ctx):
    pass


def plate_mode(ctx, on=True):
    fail("wheels.plate_mode is not written yet")


def plate_region(ctx):
    return None
