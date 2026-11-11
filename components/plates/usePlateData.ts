/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { BRAND, DEFAULT_REGION, Region } from '../../config/brand';
import { Catalog, STATIC_CATALOG, fetchCatalog } from '../../services/catalogService';
import { chooseFormat } from '../../services/plates/format';
import { ManifestError, PlateFormat, PlateManifest, loadManifest, takePrimedManifest } from '../../services/plates/manifest';

/** The manifest and the picture format this browser gets, or why there is none. */
export type PlateData =
  | { status: 'loading' }
  | { status: 'failed'; error: ManifestError; retry: () => void }
  | { status: 'ready'; manifest: PlateManifest; format: PlateFormat };

/**
 * Loads the plate manifest from `base` and picks the picture format. A failure is a state with a
 * `retry`, never an exception. Problems are written to the console, as is the note that stand-in
 * pictures remain (`placeholder`): none of that is shown to customers.
 */
export function usePlateManifest(base: string): PlateData {
  const [data, setData] = useState<PlateData>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    const abort = new AbortController();
    let current = true;
    setData({ status: 'loading' });
    (async () => {
      // the request Root.tsx started while this code was downloading, when there is one
      const result = await (takePrimedManifest(base) ?? loadManifest(base, { signal: abort.signal }));
      if (!current) return;
      if (result.ok === false) {
        console.warn(`Plates: ${result.error.message}`);
        setData({ status: 'failed', error: result.error, retry });
        return;
      }
      for (const warning of result.warnings) console.warn(`Plates manifest: ${warning}`);
      if (result.manifest.placeholder) console.info('Plates: the manifest is marked "placeholder": some pictures are stand-ins until the final renders replace them.');
      const format = await chooseFormat(result.manifest.formats);
      if (current) setData({ status: 'ready', manifest: result.manifest, format });
    })();
    return () => {
      current = false;
      abort.abort();
    };
  }, [base, attempt, retry]);

  return data;
}

/**
 * The site's catalogue: the bundled one at once, replaced by Supabase's when it answers
 * (fetchCatalog falls back to the bundled catalogue itself when Supabase cannot be reached).
 */
export function useSiteCatalogue(): Catalog {
  const [catalogue, setCatalogue] = useState<Catalog>(STATIC_CATALOG);
  useEffect(() => {
    let current = true;
    fetchCatalog()
      .then(({ catalog }) => current && setCatalogue(catalog))
      .catch((error) => console.warn('Catalogue: using the bundled catalogue', error));
    return () => {
      current = false;
    };
  }, []);
  return catalogue;
}

const REGION_KEY = 'forged_region';

/** The visitor's region (currency), remembered in this browser under the key the rest of the site uses. */
export function useRegion(): [Region, (region: Region) => void] {
  const [region, setRegion] = useState<Region>(() => {
    try {
      return BRAND.regions.find((candidate) => candidate.id === localStorage.getItem(REGION_KEY)) ?? DEFAULT_REGION;
    } catch {
      return DEFAULT_REGION; // storage blocked (private mode): the default region
    }
  });
  const chooseRegion = useCallback((next: Region) => {
    setRegion(next);
    try {
      localStorage.setItem(REGION_KEY, next.id);
    } catch {
      /* not remembered; the choice still holds for this visit */
    }
  }, []);
  return [region, chooseRegion];
}
