/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WheelFinish } from '../../types';
import type { ConfigCar, ConfigWheel, PlateCatalog } from './catalog';
import { PAINT_FINISHES, PaintFinish, PlateBox, PlatePaint, PlateView, wheelPlateKey } from './manifest';

/**
 * What the customer has chosen, and what they may choose next.
 *
 * A selection is five ids: car, view, paint, wheel, finish. A combination is "rendered" when its body
 * plate exists and, for a catalogue wheel, its wheel plate too. Everything here follows from that one
 * rule: an option is available when choosing it gives a rendered combination, `reconcileSelection`
 * finds the rendered combination closest to what was asked for (a link, a saved build, a change of
 * car), and the page never shows a combination that is not rendered.
 *
 * Pure: no DOM, no network, no React. Tested in tests/plates/selection.test.ts.
 */

/** The car's own wheel: not a catalogue wheel, so it has no finish, size or price. */
export const FACTORY_WHEEL = 'factory';

export interface Selection {
  /** Plate car id. */
  car: string;
  view: string;
  paint: string;
  /** A catalogue wheel's plate id, or FACTORY_WHEEL. */
  wheel: string;
  /** A catalogue finish id; FACTORY_WHEEL with the factory wheel. */
  finish: string;
}

/** A selection as it arrives from outside (a link, a saved build): any part may be missing or stale. */
export type WantedSelection = Partial<Selection>;

// ----------------------------------------------------
// Lookups
// ----------------------------------------------------

/** A car by its plate id or by its catalogue id (older links and saved builds carry the latter). */
export const findCar = (catalog: PlateCatalog, id?: string): ConfigCar | undefined =>
  id ? catalog.cars.find((car) => car.id === id) ?? catalog.cars.find((car) => car.model.id === id) : undefined;

export const findWheel = (catalog: PlateCatalog, id?: string): ConfigWheel | undefined =>
  id ? catalog.wheels.find((wheel) => wheel.id === id) ?? catalog.wheels.find((wheel) => wheel.design.id === id) : undefined;

/** A paint by its plate id, or by the id of the catalogue paint with the same BMW code. */
export const findPaint = (catalog: PlateCatalog, id?: string): PlatePaint | undefined => {
  if (!id) return undefined;
  return catalog.paints.find((paint) => paint.id === id) ?? catalog.paints.find((paint) => paint.id === catalog.paintAliases[id]);
};

export const findView = (catalog: PlateCatalog, id?: string): PlateView | undefined => (id ? catalog.views.find((view) => view.id === id) : undefined);

export const findFinish = (wheel: ConfigWheel | undefined, id?: string): WheelFinish | undefined => wheel?.finishes.find((finish) => finish.id === id);

const plateSet = (catalog: PlateCatalog, carId: string, viewId: string) => findCar(catalog, carId)?.plate.plates[viewId];

export const hasBodyPlate = (catalog: PlateCatalog, carId: string, viewId: string, paintId: string): boolean => !!plateSet(catalog, carId, viewId)?.body.includes(paintId);

/** The box of a catalogue wheel's plate, or null when it is not rendered. */
export const wheelPlateBox = (catalog: PlateCatalog, carId: string, viewId: string, wheelId: string, finishId: string): PlateBox | null =>
  plateSet(catalog, carId, viewId)?.wheels[wheelPlateKey(wheelId, finishId)] ?? null;

/** True when every picture this combination needs exists. The factory wheel needs the body plate only. */
export const isRendered = (catalog: PlateCatalog, selection: Selection): boolean =>
  hasBodyPlate(catalog, selection.car, selection.view, selection.paint) &&
  (selection.wheel === FACTORY_WHEEL || !!wheelPlateBox(catalog, selection.car, selection.view, selection.wheel, selection.finish));

/**
 * The wheel plate to draw over the body plate, or null for none. A catalogue wheel draws its plate. The
 * factory wheel draws the view's factory plate when there is one (the body plate then carries a neutral
 * stand-in rim in the floor reflection); a view without one shows the body plate as it is.
 */
export function wheelLayer(catalog: PlateCatalog, selection: Selection): { key: string; box: PlateBox } | null {
  const set = plateSet(catalog, selection.car, selection.view);
  if (!set) return null;
  const key = selection.wheel === FACTORY_WHEEL ? catalog.manifest.factoryWheel : wheelPlateKey(selection.wheel, selection.finish);
  const box = set.wheels[key];
  return box ? { key, box } : null;
}

// ----------------------------------------------------
// Options
// ----------------------------------------------------

export interface Option<T> {
  id: string;
  value: T;
  /** False = not rendered yet: shown disabled, never as a broken picture. */
  available: boolean;
  selected: boolean;
}

const hasAnyBodyPlate = (car: ConfigCar): boolean => Object.values(car.plate.plates).some((set) => set.body.length > 0);

/** A car is available when any body plate of it exists. */
export const carOptions = (catalog: PlateCatalog, selection: Selection): Option<ConfigCar>[] =>
  catalog.cars.map((car) => ({ id: car.id, value: car, available: hasAnyBodyPlate(car), selected: car.id === selection.car }));

export const viewOptions = (catalog: PlateCatalog, selection: Selection): Option<PlateView>[] =>
  catalog.views.map((view) => ({ id: view.id, value: view, available: isRendered(catalog, { ...selection, view: view.id }), selected: view.id === selection.view }));

export const paintOptions = (catalog: PlateCatalog, selection: Selection): Option<PlatePaint>[] =>
  catalog.paints.map((paint) => ({
    id: paint.id,
    value: paint,
    available: hasBodyPlate(catalog, selection.car, selection.view, paint.id),
    selected: paint.id === selection.paint
  }));

export interface PaintGroup {
  finish: PaintFinish;
  options: Option<PlatePaint>[];
}

/** Paints grouped by finish type, in the order solid, metallic, pearl, frozen, satin; empty groups left out. */
export const paintGroups = (catalog: PlateCatalog, selection: Selection): PaintGroup[] => {
  const options = paintOptions(catalog, selection);
  return PAINT_FINISHES.map((finish) => ({ finish, options: options.filter((option) => option.value.finish === finish) })).filter((group) => group.options.length > 0);
};

/** The catalogue wheels. A wheel is available when one of its finishes is rendered on this car in this view. */
export const wheelOptions = (catalog: PlateCatalog, selection: Selection): Option<ConfigWheel>[] =>
  catalog.wheels.map((wheel) => ({
    id: wheel.id,
    value: wheel,
    available:
      hasBodyPlate(catalog, selection.car, selection.view, selection.paint) &&
      wheel.finishes.some((finish) => !!wheelPlateBox(catalog, selection.car, selection.view, wheel.id, finish.id)),
    selected: wheel.id === selection.wheel
  }));

/** The finishes of the selected wheel (none for the factory wheel). */
export const finishOptions = (catalog: PlateCatalog, selection: Selection): Option<WheelFinish>[] =>
  (findWheel(catalog, selection.wheel)?.finishes ?? []).map((finish) => ({
    id: finish.id,
    value: finish,
    available: !!wheelPlateBox(catalog, selection.car, selection.view, selection.wheel, finish.id),
    selected: finish.id === selection.finish
  }));

// ----------------------------------------------------
// Reconcile: the rendered combination closest to what was asked for
// ----------------------------------------------------

/** The `preferred` ids that exist (in the order given), then the rest, without repeats. */
const preferredFirst = (all: string[], ...preferred: (string | undefined)[]): string[] => [
  ...new Set([...preferred.filter((id): id is string => !!id && all.includes(id)), ...all])
];

/** A wheel's finishes in the order to try them: the wanted one, the wheel's default, then the others. */
const finishesToTry = (wheel: ConfigWheel, wantedFinishId?: string): string[] =>
  preferredFirst(wheel.finishes.map((finish) => finish.id), wantedFinishId, wheel.design.defaultVariant);

/**
 * The selection to show for what was asked. Ids that are unknown or stale are ignored, silently. What is
 * kept, in order of importance: the car; the wheel and its finish (a wheel that was asked for is only
 * given up when it is not rendered on this car at all); the paint; the view. So a link to a combination
 * whose picture is missing in one view opens in a view that has it, and never shows a different wheel
 * design under that link.
 *
 * With no wheel asked for (a first visit) the car is shown in the wanted paint and view on the first
 * catalogue wheel rendered there, else on its own wheels.
 *
 * Returns null only when the catalogue has no cars.
 */
export function reconcileSelection(catalog: PlateCatalog, wanted: WantedSelection = {}): Selection | null {
  if (!catalog.cars.length) return null;
  const car = findCar(catalog, wanted.car) ?? catalog.cars.find(hasAnyBodyPlate) ?? catalog.cars[0];
  const viewIds = preferredFirst(catalog.views.map((view) => view.id), wanted.view);
  const paintIds = preferredFirst(catalog.paints.map((paint) => paint.id), findPaint(catalog, wanted.paint)?.id, car.plate.defaultPaint);
  const selectionAt = (view: string, paint: string, wheel: string, finish: string): Selection => ({ car: car.id, view, paint, wheel, finish });

  const firstRenderedWith = (wheelId: string, finishId: string): Selection | null => {
    for (const paintId of paintIds) {
      for (const viewId of viewIds) {
        const candidate = selectionAt(viewId, paintId, wheelId, finishId);
        if (isRendered(catalog, candidate)) return candidate;
      }
    }
    return null;
  };

  const wantedWheel = wanted.wheel === FACTORY_WHEEL ? undefined : findWheel(catalog, wanted.wheel);
  if (wantedWheel) {
    for (const finishId of finishesToTry(wantedWheel, wanted.finish)) {
      const found = firstRenderedWith(wantedWheel.id, finishId);
      if (found) return found;
    }
  }

  // The car on its own wheels, in the paint and view closest to what was asked
  const onFactoryWheels = firstRenderedWith(FACTORY_WHEEL, FACTORY_WHEEL) ?? selectionAt(viewIds[0], paintIds[0] ?? '', FACTORY_WHEEL, FACTORY_WHEEL);
  // The factory wheel was asked for, or a wheel that is not rendered on this car: stay on the factory wheel
  if (wanted.wheel === FACTORY_WHEEL || wantedWheel) return onFactoryWheels;

  // Nothing (or a retired wheel) was asked for: the first catalogue wheel rendered in this paint and view
  for (const wheel of catalog.wheels) {
    for (const finishId of finishesToTry(wheel)) {
      const candidate = selectionAt(onFactoryWheels.view, onFactoryWheels.paint, wheel.id, finishId);
      if (isRendered(catalog, candidate)) return candidate;
    }
  }
  return onFactoryWheels;
}

/** The selection after the customer changes something: the change applied, then reconciled. */
export const changeSelection = (catalog: PlateCatalog, current: Selection, change: WantedSelection): Selection =>
  reconcileSelection(catalog, { ...current, ...change }) ?? current;

export const SELECTION_KEYS = ['car', 'view', 'paint', 'wheel', 'finish'] as const;

export const sameSelection = (a: Selection, b: Selection): boolean => SELECTION_KEYS.every((key) => a[key] === b[key]);

// ----------------------------------------------------
// The address bar
// ----------------------------------------------------

const PARAMETER_VALUE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** The selection named in a query string. Missing or malformed values are left out (never an error). */
export function parseSelection(search: string | URLSearchParams): WantedSelection {
  const query = typeof search === 'string' ? new URLSearchParams(search) : search;
  const wanted: WantedSelection = {};
  for (const key of SELECTION_KEYS) {
    const value = query.get(key);
    if (value && PARAMETER_VALUE.test(value)) wanted[key] = value;
  }
  return wanted;
}

/** The selection as query parameters, in a fixed order (the finish is left out for the factory wheel). */
export function selectionParams(selection: Selection): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of SELECTION_KEYS) if (!(key === 'finish' && selection.wheel === FACTORY_WHEEL)) query.set(key, selection[key]);
  return query;
}

// ----------------------------------------------------
// Preloading on intent
// ----------------------------------------------------

/** The other views of the current combination that are rendered, nearest in the view list first. */
export function neighbourViews(catalog: PlateCatalog, selection: Selection): Selection[] {
  const current = catalog.views.findIndex((view) => view.id === selection.view);
  return catalog.views
    .map((view, index) => ({ view: view.id, distance: Math.abs(index - current) }))
    .filter((entry) => entry.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => ({ ...selection, view: entry.view }))
    .filter((candidate) => isRendered(catalog, candidate));
}

/** The combination an option would give, when it is rendered and differs from the current one (the picture to warm on hover or focus). */
export function previewSelection(catalog: PlateCatalog, selection: Selection, change: WantedSelection): Selection | null {
  const next = changeSelection(catalog, selection, change);
  return !sameSelection(next, selection) && isRendered(catalog, next) ? next : null;
}

// ----------------------------------------------------
// Words
// ----------------------------------------------------

/** One sentence naming the configuration, for the picture's alternative text and the page title. */
export function describeSelection(catalog: PlateCatalog, selection: Selection): string {
  const car = findCar(catalog, selection.car);
  const paint = findPaint(catalog, selection.paint);
  const wheel = findWheel(catalog, selection.wheel);
  const finish = findFinish(wheel, selection.finish);
  const view = findView(catalog, selection.view);
  const wheels = wheel ? `on ${wheel.design.name} wheels${finish ? ` in ${finish.name}` : ''}` : 'on its factory wheels';
  return [car?.model.name ?? 'Car', paint ? `in ${paint.name}` : '', wheels].filter(Boolean).join(' ') + (view ? `, ${view.label.toLowerCase()} view` : '');
}
