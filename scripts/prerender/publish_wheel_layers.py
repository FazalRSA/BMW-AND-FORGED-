"""Publishes the path-traced wheel layers (render_car.py --wheel-layer) for the configurator.

Each layer PNG is the frames' studio as rendered (linear-safe 'Standard' view, flat exposure). The browser shows the
body through recolourInto (services/renderedBody.ts): x BODY_EXPOSURE, a toe, then Khronos PBR Neutral. The wheels go
through the same curve here, once, so they sit on the body with the same contrast; then they are saved as WebP with
alpha, cropped to the wheels:

  public/renders/<car>/<view>/wheels/<design>__<finish>__<inches>.webp
  public/renders/wheels.json   {"names": [...], "cars": {car: {view: [[x0, y0, x1, y1], [name index, ...]]}}}

The box is where the crop sits in the frame, as fractions from the top left. A car, view or combination missing from
the index draws the live WebGL wheels instead, so a batch can be published while it is still running.

  python3 scripts/prerender/publish_wheel_layers.py .scratch/wl/out [public/renders]
"""
import glob, json, os, sys

import numpy as np
from PIL import Image

BODY_EXPOSURE = 1.25            # services/renderedBody.ts BODY_EXPOSURE
START, DESAT = 0.8 - 0.04, 0.15  # recolourInto's Neutral constants
D = 1 - START
VIEWS = ['frontThreeQuarter', 'side', 'rearThreeQuarter', 'frontWheel', 'top', 'front']


def tone(rgb8: np.ndarray) -> np.ndarray:
    """recolourInto's curve on straight (unpremultiplied) 8-bit sRGB colour; returns 8-bit sRGB."""
    c = rgb8.astype(np.float32) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4) * BODY_EXPOSURE
    x = np.minimum(lin.min(axis=-1, keepdims=True), 0.08)
    lin = lin - (x - 6.25 * x * x)
    peak = lin.max(axis=-1, keepdims=True)
    hot = peak >= START
    safe = np.where(hot, peak, 1.0)
    np_ = 1 - (D * D) / (safe + D - START)
    k = np_ / safe
    mix = 1 - 1 / (DESAT * (safe - np_) + 1)
    lin = np.where(hot, lin * k * (1 - mix) + np_ * mix, lin)
    lin = np.clip(lin, 0, 1)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.round(s * 255), 0, 255).astype(np.uint8)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'public/renders'
    if not os.path.isdir(src):
        sys.exit(f'{src}: no such folder (render_car.py --wheel-layer output)')
    names, cars, written = [], {}, 0
    for car in sorted(os.listdir(src)):
        for view in VIEWS:
            d = os.path.join(src, car, view, 'wheels')
            box_path = os.path.join(d, 'box.json')
            if not os.path.exists(box_path):
                continue
            try:
                with open(box_path) as f:
                    box = json.load(f)
            except (OSError, ValueError) as e:
                sys.exit(f'{box_path}: {e}')
            out_dir = os.path.join(dst, car, view, 'wheels')
            os.makedirs(out_dir, exist_ok=True)
            idx = []
            for png in sorted(glob.glob(os.path.join(d, '*.png'))):
                if png.endswith('.tmp.png'):
                    continue   # a render a restart cut short
                name = os.path.basename(png)[:-4]
                webp = os.path.join(out_dir, name + '.webp')
                if not os.path.exists(webp) or os.path.getmtime(webp) < os.path.getmtime(png):
                    try:
                        im = np.asarray(Image.open(png).convert('RGBA'))
                    except OSError as e:
                        sys.exit(f'{png}: {e}')
                    out = np.dstack([tone(im[..., :3]), im[..., 3]])
                    try:
                        Image.fromarray(out, 'RGBA').save(webp, 'WEBP', quality=84, alpha_quality=90, method=6)
                    except OSError as e:
                        sys.exit(f'{webp}: {e}')
                    written += 1
                if name not in names:
                    names.append(name)
                idx.append(names.index(name))
            if idx:
                cars.setdefault(car, {})[view] = [box, sorted(idx)]
    os.makedirs(dst, exist_ok=True)
    index = os.path.join(dst, 'wheels.json')
    try:
        with open(index, 'w') as f:
            json.dump({'names': names, 'cars': cars}, f, separators=(',', ':'))
    except OSError as e:
        sys.exit(f'{index}: {e}')
    n = sum(len(v[1]) for c in cars.values() for v in c.values())
    print(f'{index}: {len(cars)} cars, {n} layers ({written} new WebP files)')


if __name__ == '__main__':
    main()
