/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CarModel } from '../../types';

/** "M4 G82" -> "M4", "X5 M F95" -> "X5 M": the model name without the chassis code. */
export const shortModelName = (car: CarModel) =>
  car.badge.split(' ').filter((t) => !/^[A-Z]\d{2}$/.test(t)).join(' ') || car.badge;
