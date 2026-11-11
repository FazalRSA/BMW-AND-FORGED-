/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CarConfiguratorEngine } from './services/CarConfiguratorEngine';
import { Catalog, STATIC_CATALOG, fetchCatalog, pickPaintForCar } from './services/catalogService';
import { nearestRimSize } from './services/pricing';
import { CarModel, PaintColor, WheelDesign } from './types';
import { BRAND, DEFAULT_REGION, Region } from './config/brand';
import { CREDITS, DELIVERY, TERMS } from './config/pages';
import { findConfiguration } from './services/journeyService';
import { peekOAuthError, signInWithGoogle } from './services/authService';
import { useCustomerAccount } from './services/useCustomerAccount';
import { IN_APP_STATE, appAddress, cameFromApp, goTo } from './services/nav';
import { layoutMode } from './services/layout';
import { configureHref, isConfigureAddress, parseConfigureAddress } from './services/plates/address';
import type { WantedSelection } from './services/plates/selection';
import { BootLoader } from './components/journey/BootLoader';
import { WelcomeGate } from './components/journey/WelcomeGate';
import { Showroom, ShowroomBackdrop } from './components/journey/Showroom';
import { TopBar } from './components/journey/TopBar';
import { EnquiryModal } from './components/journey/EnquiryModal';
import { AccountSheet } from './components/journey/AccountSheet';
import { Button, IconButton } from './components/journey/ui';
import { UserRound } from 'lucide-react';

// Pages off the main journey load on demand
const ForgedPage = lazy(() => import('./components/ForgedPage').then((m) => ({ default: m.ForgedPage })));
const RimDetailPage = lazy(() => import('./components/RimDetailPage').then((m) => ({ default: m.RimDetailPage })));
const InfoPage = lazy(() => import('./components/InfoPage').then((m) => ({ default: m.InfoPage })));
const AdminPage = lazy(() => import('./components/admin/AdminPage').then((m) => ({ default: m.AdminPage })));

// The site around the configurator: welcome -> showroom (choose the car), the wheel collection and its
// 360° wheel viewer, the info pages and the admin. One 3D studio lives behind the welcome and showroom
// stages. The configurator itself (/configure, drawn from pre-rendered plates, no 3D engine) is a
// separate half of the site: Root.tsx shows it instead of this component, and everything here that used
// to open the configurator now goes to its address (openConfigurator).

type Route =
  | { name: 'welcome' }
  | { name: 'showroom' }
  | { name: 'forged' }
  | { name: 'admin' }
  | { name: 'terms' }
  | { name: 'credits' }
  | { name: 'delivery' }
  | { name: 'rim'; rimId: string };

const routeFromLocation = (): Route => {
  if (typeof window === 'undefined') return { name: 'welcome' };
  const hash = window.location.hash.replace(/^#/, '');
  const path = (hash.startsWith('/') ? hash.split('?')[0] : window.location.pathname).toLowerCase().replace(/\/+$/, '');
  if (path === '/models') return { name: 'showroom' };
  if (path === '/forged' || hash === 'forged') return { name: 'forged' };
  if (path === '/admin' || hash === 'admin') return { name: 'admin' };
  if (path === '/terms') return { name: 'terms' };
  if (path === '/delivery') return { name: 'delivery' };
  if (path === '/credits') return { name: 'credits' };
  const rim = path.match(/^\/rims\/([^/]+)$/);
  if (rim) return { name: 'rim', rimId: decodeURIComponent(rim[1]) };
  return { name: 'welcome' };
};

/**
 * The configurator address a wheel page was opened from (`/rims/<id>?back=/configure?car=…`), so the
 * page can return to that build, or null. Only an address of the configurator is accepted.
 */
const buildToReturnTo = (): string | null => {
  const back = new URLSearchParams(appAddress().search).get('back');
  if (!back || !back.startsWith('/')) return null;
  const [path, query = ''] = back.split('?');
  return isConfigureAddress(path, `?${query}`) ? back : null;
};

const routePath = (route: Route, returnToBuild: string | null) =>
  ({
    welcome: '/',
    showroom: '/models',
    forged: '/forged',
    admin: '/admin',
    terms: '/terms',
    delivery: '/delivery',
    credits: '/credits',
    rim: route.name === 'rim' ? `/rims/${encodeURIComponent(route.rimId)}${returnToBuild ? `?back=${encodeURIComponent(returnToBuild)}` : ''}` : '/'
  })[route.name];

/** Opens the configurator (the plates half of the site) on what is known: a car, a wheel, a saved build's code. */
const openConfigurator = (target: Parameters<typeof configureHref>[0] = {}) => goTo(configureHref(target));

// Car fields that change what the engine renders for the body.
const carModelKey = (car: CarModel) =>
  JSON.stringify([car.id, car.modelUrl, car.modelRotationDeg, car.modelLengthM, car.paintMeshMatch, car.hideMeshMatch, car.bodyStyle]);

/** Cars with a real 3D body make the showroom; the simple procedural bodies are only a fallback. */
const showroomCars = (cars: CarModel[]) => {
  const active = cars.filter((c) => c.active !== false);
  const withModels = active.filter((c) => c.modelUrl);
  return withModels.length ? withModels : active.length ? active : cars;
};

/** First-visit paint when the car offers it (otherwise the car's first factory paint). */
const DEFAULT_PAINT_ID = 'isle_of_man_green';

/** The wheel the showroom cars stand on: the first wheel of the collection in its own finish, nearest to 20". */
const showroomWheel = (catalog: Catalog): { wheel: WheelDesign; size: string } | null => {
  const wheel = catalog.wheels[0];
  return wheel ? { wheel, size: nearestRimSize(wheel, '20"') } : null;
};
const showroomFinish = (catalog: Catalog, wheel: WheelDesign) => catalog.finishes[wheel.defaultVariant] ?? Object.values(catalog.finishes)[0];

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CarConfiguratorEngine | null>(null);
  const loadedCarKeyRef = useRef<string | null>(null);

  // Catalogue: bundled first, replaced by Supabase once it loads
  const [catalog, setCatalog] = useState<Catalog>(STATIC_CATALOG);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const reloadCatalog = useCallback(() => {
    fetchCatalog().then(({ catalog: next }) => {
      setCatalog(next);
      setCatalogLoaded(true);
    });
  }, []);
  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  const cars = useMemo(() => showroomCars(catalog.cars), [catalog.cars]);

  // The car on stage and its paint (the configurator has its own choices, in its address)
  const [selectedCar, setSelectedCar] = useState<CarModel>(() => showroomCars(STATIC_CATALOG.cars)[0]);
  const [selectedPaint, setSelectedPaint] = useState<PaintColor>(
    () => pickPaintForCar(STATIC_CATALOG.paints, showroomCars(STATIC_CATALOG.cars)[0], DEFAULT_PAINT_ID)!
  );
  const [region, setRegion] = useState<Region>(() => {
    try {
      return BRAND.regions.find((r) => r.id === localStorage.getItem('forged_region')) ?? DEFAULT_REGION;
    } catch {
      return DEFAULT_REGION;
    }
  });

  // Journey UI
  const [route, setRoute] = useState<Route>(routeFromLocation);
  const [returnToBuild, setReturnToBuild] = useState<string | null>(buildToReturnTo);
  const [booted, setBooted] = useState(false);
  const [bootProgress, setBootProgress] = useState(0.08);
  const [driving, setDriving] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  // Customer account (Google sign-in through Supabase): the profile prefills the enquiry form
  const account = useCustomerAccount();
  const [accountOpen, setAccountOpen] = useState(false);
  // A sign-in that came back with an error (the visitor cancelled on Google's consent screen) opens the
  // account sheet, which reads and shows the message itself (takeOAuthError). Not on /admin: an expired
  // "set your password" link lands there with the same error parameters, and that is the admin's business
  useEffect(() => {
    if (routeFromLocation().name !== 'admin' && peekOAuthError() !== null) setAccountOpen(true);
  }, []);

  const carIndex = Math.max(0, cars.findIndex((c) => c.id === selectedCar.id));

  // ----------------------------------------------------
  // Routing
  // ----------------------------------------------------
  useEffect(() => {
    const onPop = () => {
      setRoute(routeFromLocation());
      setReturnToBuild(buildToReturnTo());
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigateTo = useCallback(
    (next: Route, replace = false) => {
      setRoute(next);
      // only the wheel pages carry the build to return to (stepping through the designs keeps it)
      const path = routePath(next, next.name === 'rim' ? returnToBuild : null);
      if (next.name !== 'rim') setReturnToBuild(null);
      try {
        if (replace) window.history.replaceState(window.history.state, '', path);
        else window.history.pushState(IN_APP_STATE, '', path);
      } catch {
        window.location.hash = `#${path}`;
      }
    },
    [returnToBuild]
  );

  /** Back on a page reached from anywhere: the previous page when it is part of the app, else the welcome page. */
  const goBack = useCallback(() => (cameFromApp() ? window.history.back() : navigateTo({ name: 'welcome' })), [navigateTo]);

  // The rim page returns to the page that opened it (the collection, or the build it was opened from),
  // not to the rim before it when the visitor stepped through the designs; a direct link returns to the
  // configurator
  const lastRouteRef = useRef<Route | null>(null);
  const rimOpenedFromRef = useRef<Route | null>(null);
  // (during render, so the rim page's first render already knows where Back goes; repeat renders are no-ops)
  if (lastRouteRef.current !== route) {
    const prev = lastRouteRef.current;
    if (route.name === 'rim' && prev && prev.name !== 'rim') rimOpenedFromRef.current = prev;
    lastRouteRef.current = route;
  }
  /** What the build the wheel page was opened from had chosen (its finish and size open the wheel page in them). */
  const buildAddress = useMemo(() => {
    if (!returnToBuild) return null;
    const [path, query = ''] = returnToBuild.split('?');
    return parseConfigureAddress(path, `?${query}`);
  }, [returnToBuild]);

  // ----------------------------------------------------
  // Engine
  // ----------------------------------------------------
  const applyShowroomWheel = (engine: CarConfiguratorEngine, from: Catalog) => {
    const onStage = showroomWheel(from);
    if (!onStage) return;
    engine.applyWheelDesign(onStage.wheel);
    engine.applyWheelFinish(showroomFinish(from, onStage.wheel));
    engine.setRimSize(onStage.size);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new CarConfiguratorEngine(containerRef.current, () => setBootProgress((p) => Math.max(p, 0.3)));
    engineRef.current = engine;
    loadedCarKeyRef.current = carModelKey(selectedCar);
    engine.applyPaintColor(selectedPaint);
    applyShowroomWheel(engine, STATIC_CATALOG);
    engine.setCameraPreset('hero', { instant: true });

    const started = performance.now();
    const tick = setInterval(() => setBootProgress((p) => Math.min(0.9, p + 0.05)), 250);
    engine.loadCar(selectedCar).finally(() => {
      clearInterval(tick);
      setBootProgress(1);
      // Let the loader's line drawing finish; it reads as intentional rather than a spinner
      setTimeout(() => setBooted(true), Math.max(0, 1500 - (performance.now() - started)));
    });

    // Rotating a phone or resizing a window can change the aspect: the camera's inset and framing follow,
    // instead of keeping the previous orientation's composition
    let shape = `${layoutMode()}|${window.innerWidth > window.innerHeight}`;
    let reframe: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      engine.handleResize();
      applyInsetRef.current();
      const now = `${layoutMode()}|${window.innerWidth > window.innerHeight}`;
      if (now !== shape) {
        shape = now;
        clearTimeout(reframe);
        reframe = setTimeout(() => applyCameraRef.current(), 120);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearInterval(tick);
      window.removeEventListener('resize', onResize);
      engine.cleanup();
      engineRef.current = null;
    };
  }, []);

  // After a catalogue load or admin edit, point the stage at the fresh rows and push them to the engine.
  useEffect(() => {
    const car = catalog.cars.find((c) => c.id === selectedCar.id) ?? showroomCars(catalog.cars)[0];
    const paint = pickPaintForCar(catalog.paints, car, selectedPaint.id);
    if (!car || !paint) return;
    setSelectedCar(car);
    setSelectedPaint(paint);
    const engine = engineRef.current;
    if (!engine) return;
    const key = carModelKey(car);
    if (key !== loadedCarKeyRef.current) {
      loadedCarKeyRef.current = key;
      engine.loadCar(car);
    }
    engine.applyPaintColor(paint);
    applyShowroomWheel(engine, catalog);
  }, [catalog]);

  // Warm the neighbouring cars so showroom changes don't wait on downloads
  useEffect(() => {
    if (!booted || cars.length < 2) return;
    const engine = engineRef.current;
    engine?.preloadCar(cars[(carIndex + 1) % cars.length]);
    engine?.preloadCar(cars[(carIndex - 1 + cars.length) % cars.length]);
  }, [booted, cars, carIndex]);

  // Keep the car centred in the space the page leaves
  const applyInsetRef = useRef<() => void>(() => {});
  applyInsetRef.current = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (route.name === 'welcome') {
      // Car to the right of the welcome copy (above it when the copy sits underneath)
      if (layoutMode() === 'sheet') engine.setViewInset(0, window.innerHeight * 0.42);
      else engine.setViewInset(-window.innerWidth * 0.34, 0);
    } else if (route.name === 'showroom' && window.innerHeight < 520) {
      // a phone on its side: the model card takes the lower third, the car sits above it
      engine.setViewInset(0, window.innerHeight * 0.32);
    } else engine.setViewInset(0, 0);
  };
  // The current stage's camera preset (re-applied when the layout changes)
  const applyCameraRef = useRef<() => void>(() => {});
  applyCameraRef.current = () => {
    const engine = engineRef.current;
    if (!engine || !booted) return;
    if (route.name === 'welcome') engine.setCameraPreset('hero');
    else if (route.name === 'showroom') engine.setCameraPreset('showroom');
  };

  // Camera choreography per stage
  const revealedRef = useRef(false);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !booted) return;
    engine.setPaused(!['welcome', 'showroom'].includes(route.name));
    applyInsetRef.current();
    if (route.name === 'welcome') {
      engine.setCameraPreset('hero');
      engine.setAutoRotate(true);
      if (!revealedRef.current) engine.playReveal();
    } else if (route.name === 'showroom') {
      engine.setAutoRotate(false);
      engine.setCameraPreset('showroom');
      if (!revealedRef.current) engine.playReveal();
    }
    revealedRef.current = true;
  }, [route.name, booted]);

  // ----------------------------------------------------
  // Choices
  // ----------------------------------------------------
  /** Each car offers only its own factory paints: keep the paint if it has it, else take its first. */
  const mountCar = useCallback(
    (car: CarModel) => {
      setSelectedCar(car);
      loadedCarKeyRef.current = carModelKey(car);
      const paint = pickPaintForCar(catalog.paints, car, selectedPaint.id);
      if (paint && paint.id !== selectedPaint.id) {
        setSelectedPaint(paint);
        engineRef.current?.applyPaintColor(paint);
      }
    },
    [catalog.paints, selectedPaint.id]
  );

  const stepCar = useCallback(
    async (direction: 1 | -1, target?: number) => {
      if (driving || cars.length < 2) return;
      const next = cars[target ?? (carIndex + direction + cars.length) % cars.length];
      if (!next || next.id === selectedCar.id) return;
      setDriving(true);
      mountCar(next);
      try {
        await engineRef.current?.driveToCar(next, direction);
      } finally {
        setDriving(false);
      }
    },
    [driving, cars, carIndex, selectedCar.id, mountCar]
  );

  const changeRegion = useCallback((r: Region) => {
    setRegion(r);
    try {
      localStorage.setItem('forged_region', r.id);
    } catch {
      /* not persisted */
    }
  }, []);

  /** The configurator on the car that is on stage. */
  const buildThisCar = useCallback(() => openConfigurator({ selection: { car: selectedCar.id } }), [selectedCar.id]);

  /**
   * Google sign-in. The round trip reloads the page: from the showroom the visitor comes back to the
   * configurator on the car that was on stage, from any other page to that page.
   */
  const signIn = (): Promise<string | null> => signInWithGoogle(route.name === 'showroom' ? configureHref({ selection: { car: selectedCar.id } }) : undefined);

  const menuLinks = [
    { label: 'Home', onClick: () => navigateTo({ name: 'welcome' }) },
    { label: 'Models', onClick: () => navigateTo({ name: 'showroom' }) },
    { label: 'Configure', onClick: buildThisCar },
    { label: 'The wheels', onClick: () => navigateTo({ name: 'forged' }) },
    { label: 'Enquire', onClick: () => setEnquiryOpen(true) },
    { label: 'Delivery & fitment', onClick: () => navigateTo({ name: 'delivery' }) },
    { label: 'Terms & conditions', onClick: () => navigateTo({ name: 'terms' }) },
    { label: 'Credits', onClick: () => navigateTo({ name: 'credits' }) }
  ];

  const onJourney = ['welcome', 'showroom'].includes(route.name);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-stage select-none">
      <ShowroomBackdrop car={selectedCar} visible={booted && route.name === 'showroom'} />

      {/* The studio: transparent WebGL canvas over the backdrop */}
      <div ref={containerRef} className={`absolute inset-0 z-10 transition-opacity duration-700 ${onJourney ? 'opacity-100' : 'opacity-0'}`} />

      {booted && route.name === 'welcome' && (
        <WelcomeGate
          region={region}
          onRegionChange={changeRegion}
          onEnter={(carId) => {
            navigateTo({ name: 'showroom' });
            // Open the showroom on the car that was on stage, when it is in the line-up
            const i = cars.findIndex((c) => c.id === carId);
            if (i >= 0 && i !== carIndex) {
              // A failed drive leaves the showroom on the current car; it must not surface as an unhandled rejection
              stepCar(i > carIndex ? 1 : -1, i).catch((e) => console.warn('Could not open the showroom on that car:', e));
            }
          }}
          onOpenForged={() => navigateTo({ name: 'forged' })}
        />
      )}

      {booted && route.name === 'showroom' && (
        <>
          <TopBar
            links={menuLinks}
            onLogo={() => navigateTo({ name: 'welcome' })}
            actions={
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={buildThisCar}>
                  Configure
                </Button>
                {/* Phones: Enquire is in the menu (it overlapped the logo at 390 px) */}
                <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => setEnquiryOpen(true)}>
                  Enquire
                </Button>
                <IconButton label="Account" onClick={() => setAccountOpen(true)} className="ring-1 ring-line">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <UserRound className="h-5 w-5" strokeWidth={1.6} />
                  )}
                </IconButton>
              </>
            }
          />
          <Showroom cars={cars} index={carIndex} busy={driving} onStep={(d) => stepCar(d)} onJump={(i) => stepCar(i > carIndex ? 1 : -1, i)} onBuild={buildThisCar} />
        </>
      )}

      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={account.user}
        profile={account.profile}
        onProfile={account.setProfile}
        onSignIn={signIn}
        onOpenBuild={async (code) => {
          // a saved build opens in the configurator, which looks the code up itself
          const found = await findConfiguration(code).catch(() => null);
          if (!found) return false;
          openConfigurator({ code });
          return true;
        }}
        cars={catalog.cars}
        paints={catalog.paints}
        wheels={catalog.wheels}
        finishes={catalog.finishes}
      />

      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        summary={selectedCar.name}
        prefill={account.contactPrefill}
        context={{ configuration: { car: selectedCar.name, carId: selectedCar.id }, region: region.id }}
      />

      <Suspense fallback={null}>
      {route.name === 'forged' && (
        <div className="absolute inset-0 z-50 animate-fadeIn">
          <ForgedPage
            wheels={catalog.wheels}
            finishes={catalog.finishes}
            region={region}
            onBack={goBack}
            onOpenRim={(rimId) => navigateTo({ name: 'rim', rimId })}
            onConfigure={(wheel) => openConfigurator({ selection: { wheel: wheel.id } })}
          />
        </div>
      )}

      {route.name === 'rim' && (
        <div className="absolute inset-0 z-50 animate-fadeIn">
          <RimDetailPage
            key={route.rimId}
            wheels={catalog.wheels}
            finishes={catalog.finishes}
            wheelId={route.rimId}
            loading={!catalogLoaded}
            initialFinishId={buildAddress?.wanted.finish}
            initialSize={buildAddress?.size}
            region={region}
            backLabel={returnToBuild || !rimOpenedFromRef.current ? 'Back to your build' : 'Back'}
            onBack={() => {
              // to the build it was opened from; else to the page of this app that opened it; a direct link goes to the configurator
              if (returnToBuild) goTo(returnToBuild);
              else if (rimOpenedFromRef.current) navigateTo(rimOpenedFromRef.current);
              else openConfigurator({ selection: { wheel: route.rimId } });
            }}
            onOpenRim={(rimId) => navigateTo({ name: 'rim', rimId })}
            onConfigure={(wheel, finish, size) => {
              // this wheel, finish and size on the build the page was opened from (or on the default car)
              const wanted: WantedSelection = { ...buildAddress?.wanted, wheel: wheel.id, finish: finish.id };
              openConfigurator({ selection: wanted, size });
            }}
          />
        </div>
      )}

      {(route.name === 'terms' || route.name === 'delivery' || route.name === 'credits') && (
        <div className="absolute inset-0 z-50 animate-fadeIn">
          <InfoPage
            key={route.name}
            content={route.name === 'terms' ? TERMS : route.name === 'delivery' ? DELIVERY : CREDITS}
            onBack={goBack}
            onEnquire={() => setEnquiryOpen(true)}
          />
        </div>
      )}

      {route.name === 'admin' && (
        <div className="absolute inset-0 z-[60] animate-fadeIn">
          <AdminPage onBack={() => navigateTo({ name: 'welcome' })} onCatalogChanged={reloadCatalog} />
        </div>
      )}
      </Suspense>

      {onJourney && <BootLoader progress={bootProgress} ready={booted} />}
    </div>
  );
};

export default App;
