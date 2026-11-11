/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Where the configurator's pre-rendered pictures ("plates") are served from: `<base>/manifest.json`
 * and `<base>/<car>/<view>/…` (docs/PLATES_MASTER_PLAN.md, section 5). The files are in public/plates
 * today; set VITE_PLATES_BASE at build time to serve them from somewhere else (a storage bucket or CDN).
 * A bucket on another origin must send CORS headers: the PDF draws the plates onto a canvas.
 */
export const PLATES_BASE: string = (import.meta.env.VITE_PLATES_BASE || '/plates').replace(/\/+$/, '');
