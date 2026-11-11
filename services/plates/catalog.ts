/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CarModel, PaintColor, WheelDesign, WheelFinish } from '../../types';
import { PaintFinish, PlateBox, PlateCar, PlateManifest, PlatePaint, PlateView, bodyPlatePath, wheelPlatePath } from './manifest';

/**
 * The manifest joined with the site's catalogue (Supabase, or the bundled fallback).
 *
 * The manifest says which pictures exist; the catalogue says what is for sale, under which name and at
 * which price. The configurator shows the join, so it can never disagree with the rest of the site:
 *
 * - **Cars** come from the manifest and take their specs from the catalogue car. A plate car without a
 *   catalogue car (or with a hidden one) is not shown. The car is named as the plates name it: the
 *   picture is of that model, so when the catalogue row says otherwise the difference is reported and
 *   the picture's name is shown.
 * - **Wheels** are the catalogue's active wheels, in catalogue order, with the catalogue's names, sizes,
 *   finishes and prices. A catalogue wheel without plates is shown as "not rendered yet"; a plate wheel
 *   or finish the catalogue does not offer is not shown.
 * - **Paints and views** come from the manifest alone: the plates are rendered in the paints of the
 *   owner's render list, which is not the catalogue's per-car factory palette.
 *
 * Pure: no DOM, no network.
 */

/** The parts of the catalogue the join reads (services/catalogService.ts `Catalog` fits). */
export interface CatalogSource {
  cars: CarModel[];
  paints: PaintColor[];
  wheels: WheelDesign[];
  finishes: Record<string, WheelFinish>;
}

export interface ConfigCar {
  /** The plate id: used in plate URLs and in the page's address. */
  id: string;
  plate: PlateCar;
  /**
   * The catalogue car: specs, and the id saved with builds and leads. Its `name` and `badge` say what
   * the plates show (see joinCatalog), so the summary and the PDF name the car in the picture.
   */
  model: CarModel;
  /** The name without the make, for chips: "M2 CS". */
  shortName: string;
}

export interface ConfigWheel {
  /** The plate id (equal to the catalogue id for every stocked wheel). */
  id: string;
  design: WheelDesign;
  /** The finishes the catalogue offers on this wheel, in its order. */
  finishes: WheelFinish[];
}

export interface PlateCatalog {
  manifest: PlateManifest;
  cars: ConfigCar[];
  wheels: ConfigWheel[];
  paints: PlatePaint[];
  views: PlateView[];
  /** Catalogue paint id -> plate paint id with the same BMW code, so builds saved before the plates still open in their colour. */
  paintAliases: Record<string, string>;
  /** What the join left out, for the console. */
  warnings: string[];
}

/**
 * Plate car id -> catalogue car id, where they differ. The render pipeline names the M2 CS
 * `m2_cs_g87`; the catalogue row has been `m2_g87` since it was the standard M2 (saved builds and
 * leads point at it), as in scripts/make-hero-stills.py.
 */
export const PLATE_CAR_ALIASES: Record<string, string> = { m2_cs_g87: 'm2_g87' };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The file name of a rim model without its extension: `/models/rims/forged_fsa002.glb` -> `forged_fsa002`. */
const modelName = (url?: string | null) => (url ? url.split(/[?#]/)[0].split('/').pop()!.replace(/\.[a-z0-9]+$/i, '') : '');

function findCatalogCar(plate: PlateCar, cars: CarModel[]): CarModel | undefined {
  return (
    cars.find((car) => car.id === plate.id) ??
    cars.find((car) => car.id === PLATE_CAR_ALIASES[plate.id]) ??
    // a renamed row: the same model name on the same chassis ("G90")
    cars.find((car) => !!plate.chassis && (same(car.generation, plate.chassis) || same(car.chassisCode, plate.chassis)) && same(car.name, plate.label))
  );
}

export function joinCatalog(manifest: PlateManifest, catalog: CatalogSource): PlateCatalog {
  const warnings: string[] = [];

  const cars: ConfigCar[] = [];
  for (const plate of manifest.cars) {
    const model = findCatalogCar(plate, catalog.cars);
    if (!model) warnings.push(`car ${plate.id}: no catalogue car, not shown`);
    else if (model.active === false) warnings.push(`car ${plate.id}: catalogue car ${model.id} is hidden, not shown`);
    else {
      if (!same(model.name, plate.label)) warnings.push(`car ${plate.id}: the catalogue calls ${model.id} "${model.name}", the plates show "${plate.label}"; the plates' name is used`);
      const shortName = plate.label.replace(/^BMW\s+/i, '');
      cars.push({ id: plate.id, plate, shortName, model: { ...model, name: plate.label, badge: [shortName, plate.chassis].filter(Boolean).join(' ') } });
    }
  }

  // The plate wheel of a catalogue wheel: the same id, or the id the wheel's 3D file is named after
  // (the plates are rendered from those files: scripts/plates/plates.config.json "front": "<id>.glb")
  const plateWheels = new Map(manifest.wheels.map((w) => [w.id, w]));
  const claimed = new Set<string>();
  const wheels: ConfigWheel[] = [];
  for (const design of catalog.wheels) {
    if (design.active === false) continue;
    const plate = plateWheels.get(design.id) ?? plateWheels.get(modelName(design.modelUrl));
    const finishes = design.availableVariants.map((id) => catalog.finishes[id]).filter((f): f is WheelFinish => !!f);
    if (!finishes.length) {
      warnings.push(`wheel ${design.id}: the catalogue offers it in no known finish, not shown`);
      continue;
    }
    if (plate) {
      claimed.add(plate.id);
      for (const f of plate.finishes) if (!finishes.some((x) => x.id === f.id)) warnings.push(`wheel ${plate.id}: plate finish ${f.id} is not offered in the catalogue, not shown`);
    }
    // no plate wheel: still listed, and never available ("not rendered yet")
    wheels.push({ id: plate?.id ?? design.id, design, finishes });
  }
  for (const w of manifest.wheels) if (!claimed.has(w.id)) warnings.push(`wheel ${w.id}: plates exist but the catalogue has no such active wheel, not shown`);

  const paintAliases: Record<string, string> = {};
  for (const p of catalog.paints) {
    const match = p.code && manifest.paints.find((x) => x.code && same(x.code, p.code));
    if (match) paintAliases[p.id] = match.id;
  }

  return { manifest, cars, wheels, paints: manifest.paints, views: manifest.views, paintAliases, warnings };
}

/**
 * The catalogue without the plates named in `brokenPlates` (plate paths, see manifest.ts): a picture
 * that failed to load is treated like one that was never rendered, so its option shows as unavailable
 * and no selection lands on it again until the page clears the list.
 */
export function withoutPlates(catalog: PlateCatalog, brokenPlates: ReadonlySet<string>): PlateCatalog {
  if (!brokenPlates.size) return catalog;
  const strip = (car: PlateCar): PlateCar => ({
    ...car,
    plates: Object.fromEntries(
      Object.entries(car.plates).map(([viewId, set]) => [
        viewId,
        {
          body: set.body.filter((paintId) => !brokenPlates.has(bodyPlatePath(car.id, viewId, paintId))),
          wheels: Object.fromEntries(Object.entries(set.wheels).filter(([wheelKey]) => !brokenPlates.has(wheelPlatePath(car.id, viewId, wheelKey)))) as Record<string, PlateBox>
        }
      ])
    )
  });
  const cars = catalog.cars.map((car) => ({ ...car, plate: strip(car.plate) }));
  return { ...catalog, cars, manifest: { ...catalog.manifest, cars: catalog.manifest.cars.map(strip) } };
}

// ----------------------------------------------------
// Paints, in the shapes the rest of the site takes
// ----------------------------------------------------

export const PAINT_FINISH_LABEL: Record<PaintFinish, string> = {
  solid: 'Solid',
  metallic: 'Metallic',
  pearl: 'Pearl',
  frozen: 'Frozen',
  satin: 'Satin'
};

/** "Metallic · C31" (the finish alone when the paint has no BMW code). */
export const paintDetail = (p: Pick<PlatePaint, 'finish' | 'code'>) => [PAINT_FINISH_LABEL[p.finish], p.code].filter(Boolean).join(' · ');

const CATALOGUE_TYPE: Record<PaintFinish, PaintColor['type']> = { solid: 'Uni', metallic: 'Metallic', pearl: 'Pearl', frozen: 'Frozen', satin: 'Frozen' };

/**
 * A plate paint in the catalogue's `PaintColor` shape, for the summary, the PDF and the lead (which
 * read its name, code and colour). The material numbers are not used there; `type` is the nearest
 * catalogue type (Satin has none: pass `paintDetail` where the exact finish must be printed).
 */
export const paintAsCatalogue = (p: PlatePaint): PaintColor => ({
  id: p.id,
  name: p.name,
  code: p.code || '—',
  hex: p.hex,
  type: CATALOGUE_TYPE[p.finish],
  roughness: 0.45,
  metalness: p.finish === 'solid' ? 0 : 0.8,
  clearcoat: p.finish === 'frozen' ? 0 : 1,
  clearcoatRoughness: 0.05
});
