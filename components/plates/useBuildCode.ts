/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { SavedCode, SavedConfiguration, accountColumnsMissing, configKey, saveConfiguration } from '../../services/journeyService';

/** The share code of the build on screen. `shared`: undefined while the copy every device can open is being written, false when it could not be. */
export interface BuildCode {
  /** Which build the code is for (journeyService configKey). */
  key: string;
  code: string;
  shared?: boolean;
}

const NOT_SHARED = 'This build is not on the server yet (saved on this device only). Check your connection and try again.';
const NO_GARAGE = 'Saving to a garage is not switched on for this site yet. Your build is kept under its code: copy the link to come back to it.';

/**
 * Share codes for the configurator, through the site's existing saved-configuration service
 * (services/journeyService.ts): the code is usable at once in this browser, the shared copy is written
 * in the background, and a save started for an earlier build can never overwrite a newer one.
 */
export function useBuildCode() {
  const [buildCode, setBuildCode] = useState<BuildCode | null>(null);
  const latestSave = useRef(0);
  /** The build the current code is for, known at once (the state follows a render later), so one build is never saved twice. */
  const codedBuild = useRef<string | null>(null);

  /** Saves the build under a fresh code and shows the code at once. */
  const save = useCallback((build: SavedConfiguration, name?: string): SavedCode => {
    const token = ++latestSave.current;
    const saved = saveConfiguration(build, name);
    const key = configKey(build);
    codedBuild.current = key;
    setBuildCode({ key, code: saved.code });
    saved.shared
      .then((shared) => token === latestSave.current && setBuildCode((current) => (current && current.code === saved.code ? { ...current, shared } : current)))
      .catch(() => token === latestSave.current && setBuildCode((current) => (current && current.code === saved.code ? { ...current, shared: false } : current)));
    return saved;
  }, []);

  /** Makes sure the build on screen has a code (a build that already has one keeps it). */
  const ensure = useCallback(
    (build: SavedConfiguration) => {
      if (codedBuild.current !== configKey(build)) save(build);
    },
    [save]
  );

  /** Takes over the code a build was opened with. */
  const adopt = useCallback((build: SavedConfiguration, code: string, shared: boolean | undefined) => {
    codedBuild.current = configKey(build);
    setBuildCode({ key: codedBuild.current, code, shared });
  }, []);

  /** The code belongs to a build that was deleted (from the garage): it is no longer shown, and the build gets a new one when it is next needed. */
  const forget = useCallback((code: string) => {
    setBuildCode((current) => {
      if (current?.code !== code) return current;
      codedBuild.current = null;
      return null;
    });
  }, []);

  /**
   * "Save to garage": a new copy of the build under a fresh code owned by the signed-in customer.
   * Resolves true once it is in the garage, else the message to show.
   */
  const saveToGarage = useCallback(
    async (build: SavedConfiguration, name: string): Promise<true | string> => {
      if (accountColumnsMissing()) return NO_GARAGE;
      const saved = save(build, name);
      try {
        if (!(await saved.shared)) return NOT_SHARED;
        if (!(await saved.stamped)) return NO_GARAGE;
      } catch {
        return NOT_SHARED;
      }
      return true;
    },
    [save]
  );

  return { buildCode, ensure, adopt, forget, saveToGarage };
}
