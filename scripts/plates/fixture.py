"""Stand-in plates for working on the web configurator without real renders. Needs Pillow, not Blender.

    python3 -I scripts/plates/fixture.py --out DIR [--from BOOTSTRAP_DIR]

Writes DIR/manifest.json and DIR/<car>/<view>/{body,wheels}/*.{avif,webp} in the layout of
docs/PLATES_MASTER_PLAN.md section 5, at both manifest sizes. What it makes is deliberately uneven, so
the page's "not pictured yet" states can be seen next to working ones:

  body plates   every car, view front34: copied from --from when given (the bootstrap stills), else drawn;
                m2_cs_g87 and m5_g90, views side / rear34 / wheel: drawn, flat colour, in SOME paints only
  wheel plates  m2_cs_g87 only: factory, FSA002 in gold and hyper black (not polished face), FSA004 in
                silver, FF-3 in pure bronze. With --from, the front34 ones are cut from the real body
                plate (the car's own rims, recoloured), so the overlay can be judged against a real car.

Everything drawn here is obviously a drawing. Never ship this folder: it is a development fixture, the
manifest says "placeholder": true, and the site reads public/plates (PLATES_BASE), not this.

Serve it for the dev server with a link and an environment variable:
    ln -s DIR public/plates-fixture && VITE_PLATES_BASE=/plates-fixture bunx vite
"""
import argparse
import json
import math
import os
import shutil
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FRAME = (1920, 1080)
SIZES = [{"w": 1920, "suffix": ""}, {"w": 1280, "suffix": "-1280w"}]
FORMATS = ("avif", "webp")
FACTORY = "factory__factory"

DRAWN_VIEWS = ("side", "rear34", "wheel")
CARS_WITH_ALL_VIEWS = ("m2_cs_g87", "m5_g90")
DRAWN_PAINTS = ("portimao_blue_metallic", "alpine_white", "fire_red_vegas_red_metallic", "frozen_pure_grey_metallic", "satin_slate_blue", "jet_black")
WHEEL_PLATES = (("forged_fsa002", "gold"), ("forged_fsa002", "hyper_black"), ("forged_fsa004", "silver"), ("sixnine_ff3", "pure_bronze"))
CAR_WITH_WHEELS = "m2_cs_g87"

# Where the drawn wheels sit in each drawn view: (centre x, centre y, radius x, radius y) in frame fractions
DRAWN_WHEELS = {
    "front34": [(0.52, 0.60, 0.050, 0.105), (0.80, 0.56, 0.030, 0.085)],
    "side": [(0.30, 0.66, 0.062, 0.110), (0.72, 0.66, 0.062, 0.110)],
    "rear34": [(0.47, 0.62, 0.046, 0.100), (0.20, 0.57, 0.028, 0.080)],
    "wheel": [(0.50, 0.56, 0.190, 0.338)],
}
# The M2 CS's wheels in the bootstrap front34 still (measured on the 1920 x 1080 frame): rim + tyre
REAL_WHEELS = {"m2_cs_g87": [(994, 640, 88, 121), (1534, 604, 52, 106)]}


def rgb(hex_code):
    hex_code = hex_code.lstrip("#")
    return tuple(int(hex_code[i:i + 2], 16) for i in (0, 2, 4))


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # older Pillow: one fixed size
        return ImageFont.load_default()


def save_plate(image, out_root, plate_path, alpha):
    """Every size and format of one plate. `image` is at full-frame scale (a crop for a wheel plate)."""
    target = os.path.join(out_root, *plate_path.split("/"))
    os.makedirs(os.path.dirname(target), exist_ok=True)
    for size in SIZES:
        scale = size["w"] / FRAME[0]
        scaled = image if scale == 1 else image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
        scaled.save(f"{target}{size['suffix']}.avif", quality=60, speed=8)
        scaled.save(f"{target}{size['suffix']}.webp", quality=82, method=4, **({"exact": True} if alpha else {}))


def copy_plate(src_root, out_root, plate_path):
    """Links the files of a plate that already exists (the bootstrap stills). True when every file was there."""
    files = [f"{plate_path}{size['suffix']}.{fmt}" for size in SIZES for fmt in FORMATS]
    if not all(os.path.isfile(os.path.join(src_root, f)) for f in files):
        return False
    for f in files:
        target = os.path.join(out_root, f)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if os.path.lexists(target):
            os.remove(target)
        shutil.copyfile(os.path.join(src_root, f), target)
    return True


def studio():
    """Black backdrop with a lit grey floor, roughly like the real plates."""
    image = Image.new("RGB", FRAME, (2, 2, 4))
    floor = Image.linear_gradient("L").resize(FRAME)  # black at the top, white at the bottom
    floor = floor.point(lambda v: 0 if v < 150 else min(150, (v - 150) * 2))
    return Image.composite(Image.new("RGB", FRAME, (150, 150, 152)), image, floor)


def draw_body(car, view, paint):
    """A flat-colour stand-in: studio, a car-shaped block in the paint colour, dark wheels, and a label."""
    image = studio()
    draw = ImageDraw.Draw(image)
    colour = rgb(paint["hex"])
    w, h = FRAME
    if view["id"] == "wheel":
        draw.rounded_rectangle((0.05 * w, 0.10 * h, 0.95 * w, 0.62 * h), radius=90, fill=colour)
        draw.ellipse((0.27 * w, 0.17 * h, 0.73 * w, 0.95 * h), fill=(10, 10, 12))  # wheel arch
    else:
        draw.rounded_rectangle((0.10 * w, 0.44 * h, 0.90 * w, 0.68 * h), radius=70, fill=colour)
        draw.rounded_rectangle((0.30 * w, 0.30 * h, 0.72 * w, 0.50 * h), radius=80, fill=colour)
        draw.rounded_rectangle((0.34 * w, 0.33 * h, 0.68 * w, 0.44 * h), radius=50, fill=(16, 18, 22))  # glass
    for cx, cy, rx, ry in DRAWN_WHEELS[view["id"]]:
        box = ((cx - rx * 1.25) * w, (cy - ry * 1.25) * h, (cx + rx * 1.25) * w, (cy + ry * 1.25) * h)
        draw.ellipse(box, fill=(14, 14, 16))  # tyre
        inner = ((cx - rx) * w, (cy - ry) * h, (cx + rx) * w, (cy + ry) * h)
        draw.ellipse(inner, fill=(70, 72, 76))  # a plain grey factory rim
    draw.text((0.04 * w, 0.05 * h), f"FIXTURE  {car['label']}  {view['label']}  {paint['name']}", fill=(120, 120, 126), font=font(34))
    return image


def draw_wheels(view_id, colour):
    """Drawn rims (a disc with spokes) for a drawn view -> (RGBA crop, box in frame fractions)."""
    w, h = FRAME
    layer = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for cx, cy, rx, ry in DRAWN_WHEELS[view_id]:
        draw.ellipse(((cx - rx * 1.25) * w, (cy - ry * 1.25) * h, (cx + rx * 1.25) * w, (cy + ry * 1.25) * h), fill=(14, 14, 16, 255))
        draw.ellipse(((cx - rx) * w, (cy - ry) * h, (cx + rx) * w, (cy + ry) * h), fill=colour + (255,))
        dark = tuple(int(c * 0.25) for c in colour) + (255,)
        for spoke in range(5):  # five windows between the spokes
            angle = spoke * 2 * math.pi / 5 + 0.3
            sx, sy = cx + math.cos(angle) * rx * 0.55, cy + math.sin(angle) * ry * 0.55
            draw.ellipse(((sx - rx * 0.22) * w, (sy - ry * 0.22) * h, (sx + rx * 0.22) * w, (sy + ry * 0.22) * h), fill=dark)
        draw.ellipse(((cx - rx * 0.16) * w, (cy - ry * 0.16) * h, (cx + rx * 0.16) * w, (cy + ry * 0.16) * h), fill=dark)
    return crop_to_content(layer)


def crop_to_content(layer, pad=6):
    left, top, right, bottom = layer.getbbox()
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(FRAME[0], right + pad), min(FRAME[1], bottom + pad)
    box = [round(left / FRAME[0], 6), round(top / FRAME[1], 6), round(right / FRAME[0], 6), round(bottom / FRAME[1], 6)]
    return layer.crop((left, top, right, bottom)), box


def cut_real_wheels(body, ellipses, tint):
    """The car's own wheels cut out of a real body plate, the rim recoloured to `tint` (None = as it is)."""
    mask = Image.new("L", FRAME, 0)
    draw = ImageDraw.Draw(mask)
    for cx, cy, rx, ry in ellipses:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    pixels = body.convert("RGB")
    if tint is not None:
        # the rim is the warm (gold) part of the wheel: swap its colour, keep its light and shade
        red, green, blue = pixels.split()
        warm = ImageChops.subtract(red, blue).point(lambda v: 255 if v > 45 else 0).filter(ImageFilter.GaussianBlur(1))
        grey = pixels.convert("L")
        recoloured = Image.merge("RGB", [grey.point(lambda v, c=c: min(255, int(v * c / 150))) for c in tint])
        pixels = Image.composite(recoloured, pixels, warm)
    layer = pixels.convert("RGBA")
    layer.putalpha(mask)
    return crop_to_content(layer)


def main():
    parser = argparse.ArgumentParser(description="Write stand-in plates and a manifest for the web configurator")
    parser.add_argument("--out", required=True, help="folder to write (created; existing fixture files are replaced)")
    parser.add_argument("--from", dest="source", help="a plates folder to take real front34 body plates from (the bootstrap stills)")
    args = parser.parse_args()

    with open(os.path.join(HERE, "plates.config.json"), encoding="utf-8") as fh:
        config = json.load(fh)
    finishes = config["wheel_finishes"]
    paints = {p["id"]: p for p in config["paints"]}
    views = {v["id"]: v for v in config["views"]}
    os.makedirs(args.out, exist_ok=True)

    cars = []
    for car in config["cars"]:
        plates = {view_id: {"body": [], "wheels": {}} for view_id in views}
        real_front = False
        for paint in config["paints"]:
            plate = f"{car['id']}/front34/body/{paint['id']}"
            if args.source and copy_plate(args.source, args.out, plate):
                real_front = True
            else:
                save_plate(draw_body(car, views["front34"], paint), args.out, plate, alpha=False)
            plates["front34"]["body"].append(paint["id"])
        if car["id"] in CARS_WITH_ALL_VIEWS:
            for view_id in DRAWN_VIEWS:
                for paint_id in DRAWN_PAINTS:
                    save_plate(draw_body(car, views[view_id], paints[paint_id]), args.out, f"{car['id']}/{view_id}/body/{paint_id}", alpha=False)
                    plates[view_id]["body"].append(paint_id)
        if car["id"] == CAR_WITH_WHEELS:
            real_body = None
            if real_front and car["id"] in REAL_WHEELS:
                real_body = Image.open(os.path.join(args.source, f"{car['id']}/front34/body/{car['default_paint']}.webp"))
            for view_id in views:
                wanted = [(FACTORY, None)] + [(f"{wheel}__{finish}", rgb(finishes[finish]["hex"])) for wheel, finish in WHEEL_PLATES]
                for name, colour in wanted:
                    if view_id == "front34" and real_body is not None:
                        # gold is the car's own rim colour in the still: left as it is
                        tint = None if name in (FACTORY, "forged_fsa002__gold") else colour
                        image, box = cut_real_wheels(real_body, REAL_WHEELS[car["id"]], tint)
                    else:
                        image, box = draw_wheels(view_id, colour or (70, 72, 76))
                    save_plate(image, args.out, f"{car['id']}/{view_id}/wheels/{name}", alpha=True)
                    plates[view_id]["wheels"][name] = box
        cars.append({"id": car["id"], "label": car["label"], "chassis": car["chassis"], "defaultPaint": car["default_paint"], "plates": plates})
        print(f"fixture: {car['id']}: " + ", ".join(f"{v} {len(p['body'])} body / {len(p['wheels'])} wheel" for v, p in plates.items()), flush=True)

    manifest = {
        "version": 1,
        "frame": {"w": FRAME[0], "h": FRAME[1]},
        "formats": list(FORMATS),
        "sizes": SIZES,
        "factoryWheel": FACTORY,
        "placeholder": True,
        "views": [{"id": v["id"], "label": v["label"]} for v in config["views"]],
        "paints": [{k: p[k] for k in ("id", "name", "code", "group", "finish", "hex")} for p in config["paints"]],
        "wheels": [{"id": w["id"], "name": w["name"], "finishes": [{"id": f, "name": finishes[f]["name"], "hex": finishes[f]["hex"]} for f in w["finishes"]]}
                   for w in config["wheels"]],
        "cars": cars,
    }
    with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print(f"fixture: wrote {os.path.join(args.out, 'manifest.json')}")


if __name__ == "__main__":
    sys.exit(main())
