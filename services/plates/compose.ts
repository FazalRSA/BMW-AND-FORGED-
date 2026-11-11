/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Frame } from './frames';

/**
 * Flattens a frame (body plate with its wheel plate over it) into one JPEG, for the PDF, which takes
 * JPEG data URLs. A 2D canvas, no WebGL. Returns null when a plate cannot be read (a failed download,
 * or plates on another origin without CORS headers): the PDF is then built without that picture.
 */
const readImage = (url: string, crossOrigin: string | null): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin !== null) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });

export async function composeJpeg(frame: Frame, opts: { width: number; height: number; quality?: number; crossOrigin?: string | null }): Promise<string | null> {
  try {
    const crossOrigin = opts.crossOrigin ?? null;
    const [body, wheel] = await Promise.all([readImage(frame.body.url, crossOrigin), frame.wheel ? readImage(frame.wheel.url, crossOrigin) : null]);
    const canvas = document.createElement('canvas');
    canvas.width = opts.width;
    canvas.height = opts.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(body, 0, 0, opts.width, opts.height);
    if (wheel && frame.wheel) {
      const [left, top, right, bottom] = frame.wheel.box;
      context.drawImage(wheel, left * opts.width, top * opts.height, (right - left) * opts.width, (bottom - top) * opts.height);
    }
    return canvas.toDataURL('image/jpeg', opts.quality ?? 0.9);
  } catch (error) {
    console.warn('Plates: a picture for the PDF could not be composed', error);
    return null;
  }
}
