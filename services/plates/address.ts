/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SELECTION_KEYS, Selection, WantedSelection, parseSelection, selectionParams } from './selection';

/**
 * The configurator's address: `/configure?car=…&view=…&paint=…&wheel=…&finish=…&size=20&step=summary`.
 * Everything the page shows is in it, so a configuration can be shared, bookmarked and reloaded.
 * `?config=CODE` (a saved build's share code, on any path) opens that build.
 *
 * Reading never fails: a parameter that is missing, malformed or stale is left out, and the page falls
 * back to its default for it. Pure; tested in tests/plates/address.test.ts.
 */

export const CONFIGURE_PATH = '/configure';
/** The older address of the summary; it opens the configurator on its summary step. */
const SUMMARY_PATH = '/summary';

export type ConfigureStep = 'configure' | 'summary';

export interface ConfigureAddress {
  wanted: WantedSelection;
  /** Rim size as the catalogue writes it, e.g. `20"`. */
  size?: string;
  step: ConfigureStep;
  /** A saved build's share code. */
  code?: string;
}

const cleanPath = (pathname: string) => pathname.toLowerCase().replace(/\/+$/, '') || '/';

const SHARE_CODE = /^[A-Z0-9]{10}$/;

/** A share code as typed or linked ("k7qm-4xr2pd") in its stored form, or undefined when it is not one. */
export const cleanShareCode = (value: string | null | undefined): string | undefined => {
  const code = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SHARE_CODE.test(code) ? code : undefined;
};

/** `20` or `20"` -> `20"`; anything else is not a size. */
const parseSize = (value: string | null): string | undefined => {
  const inches = /^(\d{2})(?:"|in)?$/.exec((value ?? '').trim());
  return inches ? `${inches[1]}"` : undefined;
};

/** True when this address belongs to the configurator (and not to the rest of the site). */
export function isConfigureAddress(pathname: string, search: string): boolean {
  const path = cleanPath(pathname);
  if (path === CONFIGURE_PATH || path === SUMMARY_PATH) return true;
  // a shared build: /?config=CODE
  return path === '/' && cleanShareCode(new URLSearchParams(search).get('config')) !== undefined;
}

export function parseConfigureAddress(pathname: string, search: string): ConfigureAddress {
  const query = new URLSearchParams(search);
  return {
    wanted: parseSelection(query),
    size: parseSize(query.get('size')),
    step: cleanPath(pathname) === SUMMARY_PATH || query.get('step') === 'summary' ? 'summary' : 'configure',
    code: cleanShareCode(query.get('config'))
  };
}

/**
 * The address of a configuration. `selection` may be partial (a link from elsewhere in the site that
 * only knows the car, or the wheel); the page fills in the rest.
 */
export function configureHref(target: { selection?: Selection | WantedSelection; size?: string; step?: ConfigureStep; code?: string } = {}): string {
  const selection = target.selection ?? {};
  const complete = SELECTION_KEYS.every((key) => !!selection[key]);
  const query = complete ? selectionParams(selection as Selection) : new URLSearchParams();
  if (!complete) for (const key of SELECTION_KEYS) if (selection[key]) query.set(key, selection[key]!);
  const size = parseSize(target.size ?? null);
  if (size) query.set('size', size.replace('"', ''));
  if (target.code) query.set('config', target.code);
  if (target.step === 'summary') query.set('step', 'summary');
  const search = query.toString();
  return search ? `${CONFIGURE_PATH}?${search}` : CONFIGURE_PATH;
}
