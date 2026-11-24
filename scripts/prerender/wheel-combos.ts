/**
 * The wheel layers to render (render_car.py --wheel-layer), from the bundled catalogue: every active stock wheel with a
 * rim model, in each of its finishes, at one of its sizes. Writes the JSON list render_car.py reads.
 *
 *   bun scripts/prerender/wheel-combos.ts <decoded rims dir> <size index: 0 = first size, 1 = second> > combos.json
 *
 * The rims dir holds the rim GLBs decoded for Blender (bpy has no meshopt decoder; see docs/ADD_PREPARED_CAR.md,
 * "Path-traced wheel layers"), named as in public/models/rims/. Names are <wheel id>__<finish id>__<inches>, the key
 * the configurator looks up (services/renderedBody.ts wheelLayerFor). The finish values are the catalogue's, so a
 * finish changed in /admin needs its layers rendered again.
 */
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { STATIC_CATALOG } from '../../services/catalogService';

const [dir, which] = process.argv.slice(2);
if (!dir || !['0', '1'].includes(which ?? '')) {
  console.error('usage: bun scripts/prerender/wheel-combos.ts <decoded rims dir> <0|1>');
  process.exit(2);
}
const sizeIndex = Number(which);
const rimFile = (url: string) => {
  const f = join(dir, basename(url));
  if (!existsSync(f)) {
    console.error(`${f}: missing (decode ${url} first)`);
    process.exit(1);
  }
  return f;
};

/**
 * Photo-matched Cycles recipes per catalogue finish, replacing the catalogue's own numbers for the path-traced layers only:
 * [hex, metalness, roughness, clearcoat, coatRoughness, brush, grain, barrelTone]. The catalogue's numbers are tuned for the
 * live WebGL wheels; Cycles reflects the studio properly, so the same numbers come out glossier than the website's product
 * photographs. `brush` is the anisotropy of the brushed streaks (along the spokes on the face, spun on the barrel and cap;
 * 0 keeps a plain colour), `grain` the +-roughness spread of those streaks, `barrelTone` the barrel's colour multiplier (the
 * photos' barrels are darker and satin). See scripts/prerender/rim_finish.py. Calibrated against the website photographs with
 * scripts/prerender/finish_calibrate.py (white studio, face-on) by median colour and by looking at full and macro crops side
 * by side (.scratch/finish2): silver on FSA004, hyper_black and gold on FSA003; pure_bronze, liquid_metal and polished_face
 * have no matching photo in the repo and follow the same surface family. A finish not listed uses the catalogue's numbers
 * (gloss black and satin black already matched) with the cap mark and steel lugs only.
 */
const PHOTO_RECIPES: Record<string, (string | number)[]> = {
  hyper_black: ['#727276', 1, 0.38, 0, 0.03, 0.8, 0.3, 0.9],
  silver: ['#cecece', 1, 0.42, 0, 0.03, 0.8, 0.3, 1],
  pure_bronze: ['#9a6f55', 1, 0.45, 0, 0.03, 0.7, 0.25, 0.9],
  liquid_metal: ['#d8dbdf', 1, 0.12, 0, 0.03, 0.4, 0.08, 0.95],
  polished_face: ['#e0e0e0', 1, 0.16, 0, 0.03, 0.3, 0.06, 0.9],
  gold: ['#d6c39d', 1, 0.5, 0, 0.03, 0.5, 0.2, 0.95]
};

const combos = [];
for (const w of STATIC_CATALOG.wheels) {
  if (!w.modelUrl) continue; // the live-only legacy wheels have no rim model to render
  // the larger size first: 20" is the configurator's default, and FSA001 comes in 19" and 20"
  const sizes = [...(w.standardSizes ?? [])].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  const ordered = sizes.length > 1 && parseInt(sizes[0], 10) > 20 ? [sizes[1], sizes[0]] : sizes;
  const size = ordered[sizeIndex];
  if (!size) continue;
  const rims = [rimFile(w.modelUrl), ...(w.rearModelUrl ? [rimFile(w.rearModelUrl)] : [])];
  for (const id of w.availableVariants ?? []) {
    const f = STATIC_CATALOG.finishes[id];
    if (!f) {
      console.error(`${w.id}: finish ${id} is not in the catalogue`);
      process.exit(1);
    }
    combos.push({ name: `${w.id}__${id}__${parseInt(size, 10)}`, rims, finish: PHOTO_RECIPES[id] ?? [f.hex, f.metalness, f.roughness, f.clearcoat ?? 0], inches: parseInt(size, 10) });
  }
}
console.log(JSON.stringify(combos, null, 1));
