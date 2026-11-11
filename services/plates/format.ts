/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlateFormat } from './manifest';

/**
 * Which plate encoding this browser gets: AVIF where it can decode it, else WebP.
 *
 * The page decides once and builds plain URLs, instead of leaving the choice to a <picture> element,
 * because it decodes the next picture off screen before swapping it in (and warms pictures ahead of
 * the customer): it has to know the exact file the stage will show.
 */

/** A 2 x 2 px AVIF (305 bytes, written with Pillow / libavif). */
const AVIF_PROBE =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAHgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAJm1kYXQSAAoIGAA2iAhoNCAyEBlHh4Yhh5555oJAAJBAzeg=';

let avif: Promise<boolean> | null = null;

/** True when the browser decodes AVIF (asked once per page load). */
export const supportsAvif = (): Promise<boolean> =>
  (avif ??= new Promise<boolean>((resolve) => {
    if (typeof Image === 'undefined') return resolve(false);
    const img = new Image();
    img.onload = () => resolve(img.width === 2);
    img.onerror = () => resolve(false);
    img.src = AVIF_PROBE;
  }));

/** The first of the manifest's formats this browser can show (the manifest lists the best first). */
export async function chooseFormat(formats: PlateFormat[], avifSupport: () => Promise<boolean> = supportsAvif): Promise<PlateFormat> {
  for (const f of formats) if (f !== 'avif' || (await avifSupport())) return f;
  return formats[formats.length - 1];
}
