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

/**
 * 'anonymous' when the plates are on another origin, so the browser fetches them with CORS (once, for
 * the page and the PDF alike); undefined for plates on this site.
 */
export const PLATES_CROSS_ORIGIN: 'anonymous' | undefined = (() => {
  try {
    return typeof window !== 'undefined' && new URL(PLATES_BASE, window.location.href).origin !== window.location.origin ? ('anonymous' as const) : undefined;
  } catch {
    return undefined; // not a URL the browser understands: treated as this site
  }
})();
