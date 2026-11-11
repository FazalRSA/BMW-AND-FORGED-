/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { PLATES_BASE } from './config/plates';
import { appAddress } from './services/nav';
import { isConfigureAddress } from './services/plates/address';
import { primeManifest } from './services/plates/manifest';

// Two halves, loaded on demand:
// - the configurator, drawn from pre-rendered plates (no 3D engine, no three.js);
// - the rest of the site (welcome, showroom, the wheel pages, admin), which still uses the 3D engine.
// A visitor who opens /configure never downloads the engine.
const ConfigurePage = lazy(() => import('./components/plates/ConfigurePage'));
const App = lazy(() => import('./App'));

const onConfigurator = () => {
  const { path, search } = appAddress();
  return isConfigureAddress(path, search);
};

// Arriving on the configurator: its manifest is requested now, alongside its code, not after it
if (typeof window !== 'undefined' && onConfigurator()) primeManifest(PLATES_BASE);

/** Chooses the half of the site for the current address, and follows the address as it changes. */
export const Root: React.FC = () => {
  const [configurator, setConfigurator] = useState(onConfigurator);
  useEffect(() => {
    const follow = () => setConfigurator(onConfigurator());
    window.addEventListener('popstate', follow);
    window.addEventListener('hashchange', follow);
    return () => {
      window.removeEventListener('popstate', follow);
      window.removeEventListener('hashchange', follow);
    };
  }, []);
  // (the page colour of index.html shows while a half loads: no flash, nothing to lay out)
  return <Suspense fallback={null}>{configurator ? <ConfigurePage /> : <App />}</Suspense>;
};

export default Root;
