/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Region } from '../../config/brand';
import type { WheelFinish } from '../../types';
import type { SavedConfiguration } from '../../services/journeyService';
import type { ConfigCar, ConfigWheel } from '../../services/plates/catalog';
import type { PlatePaint } from '../../services/plates/manifest';

/**
 * A finished build (a car in a paint on a catalogue wheel, finish and size) and the two shapes the
 * rest of the site takes it in: the record on a lead, and a saved configuration.
 */
/** The build as the site's leads, PDF and share codes know it (catalogue ids; the paint by its plate id). */
export interface Build {
  car: ConfigCar;
  paint: PlatePaint;
  wheel: ConfigWheel;
  finish: WheelFinish;
  size: string;
}

/** The record the enquiry form, the PDF lead and the owner's email read (names for people, ids for lookups). */
export const leadConfiguration = (build: Build): Record<string, string> => ({
  car: build.car.model.name,
  paint: build.paint.name,
  wheel: build.wheel.design.name,
  size: build.size,
  finish: build.finish.name,
  carId: build.car.model.id,
  paintId: build.paint.id,
  wheelId: build.wheel.design.id,
  finishId: build.finish.id
});

export const savedConfiguration = (build: Build, region: Region): SavedConfiguration => ({
  carId: build.car.model.id,
  paintId: build.paint.id,
  wheelId: build.wheel.design.id,
  finishId: build.finish.id,
  size: build.size,
  regionId: region.id
});
