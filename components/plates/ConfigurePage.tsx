/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, RotateCw, UserRound } from 'lucide-react';
import { BRAND, LUXURY_THEME, applyTheme } from '../../config/brand';
import { PLATES_BASE, PLATES_CROSS_ORIGIN } from '../../config/plates';
import { peekOAuthError, signInWithGoogle } from '../../services/authService';
import { findConfiguration } from '../../services/journeyService';
import { IN_APP_STATE, appAddress, cameFromApp, goTo, linkTo } from '../../services/nav';
import { nearestRimSize, rimSizes } from '../../services/pricing';
import { useCustomerAccount } from '../../services/useCustomerAccount';
import { ConfigureStep, configureHref, parseConfigureAddress } from '../../services/plates/address';
import { ConfigWheel, joinCatalog, paintAsCatalogue, withoutPlates } from '../../services/plates/catalog';
import { Frame, PlateSource, frameFor, frameImages, pickSize } from '../../services/plates/frames';
import { createPlateLoader } from '../../services/plates/loader';
import type { PlateSize } from '../../services/plates/manifest';
import {
  FACTORY_WHEEL,
  Selection,
  WantedSelection,
  carOptions,
  changeSelection,
  describeSelection,
  findCar,
  findFinish,
  findPaint,
  findWheel,
  finishOptions,
  isRendered,
  neighbourViews,
  paintGroups,
  previewSelection,
  reconcileSelection,
  viewOptions,
  wheelOptions
} from '../../services/plates/selection';
import { AccountSheet } from '../journey/AccountSheet';
import { EnquiryModal } from '../journey/EnquiryModal';
import { Button, IconButton, Logo, Status, cx } from '../journey/ui';
import { Build, BuildSummary, leadConfiguration, savedConfiguration } from './BuildSummary';
import { OptionsMenu } from './OptionsMenu';
import { OptionsPanel, PriceBar } from './OptionsPanel';
import { PlateStage } from './PlateStage';
import { ViewTabs } from './ViewTabs';
import { prefersLessData, useElementWidth } from './hooks';
import { useBuildCode } from './useBuildCode';
import { usePlateManifest, useRegion, useSiteCatalogue } from './usePlateData';

const NO_BROKEN_PLATES: ReadonlySet<string> = new Set();
/** After this many pictures in a row fail to load, the page stops trying others and says so. */
const MAX_FAILURES_IN_A_ROW = 3;
const DEFAULT_SIZE = '20"';

/** A short message under the picture. `retry` offers to load the pictures that failed again. */
interface Notice {
  text: string;
  retry?: boolean;
}

/**
 * The configurator: every picture is a pre-rendered plate, chosen by car, view, paint, wheel and
 * finish. No 3D engine is loaded on this page.
 *
 * The page keeps what was asked for (the address, a saved build, the customer's changes) and shows the
 * closest combination that is rendered (services/plates/selection.ts). The address bar always holds
 * the configuration on screen. Names, sizes and prices are the site catalogue's.
 */
const ConfigurePage: React.FC = () => {
  useEffect(() => applyTheme(LUXURY_THEME), []);

  const plates = usePlateManifest(PLATES_BASE);
  const siteCatalogue = useSiteCatalogue();
  const [region, setRegion] = useRegion();
  const account = useCustomerAccount();
  const loader = useMemo(() => createPlateLoader({ crossOrigin: PLATES_CROSS_ORIGIN ?? null }), []);

  // ----------------------------------------------------
  // The catalogue of plates, less the pictures that failed to load
  // ----------------------------------------------------
  const manifest = plates.status === 'ready' ? plates.manifest : null;
  const joined = useMemo(() => (manifest ? joinCatalog(manifest, siteCatalogue) : null), [manifest, siteCatalogue]);
  useEffect(() => {
    for (const warning of joined?.warnings ?? []) console.warn(`Plates catalogue: ${warning}`);
  }, [joined]);
  const [brokenPlates, setBrokenPlates] = useState<ReadonlySet<string>>(NO_BROKEN_PLATES);
  const catalog = useMemo(() => (joined ? withoutPlates(joined, brokenPlates) : null), [joined, brokenPlates]);

  // ----------------------------------------------------
  // What was asked for (address, saved build, the customer's changes) and what is shown
  // ----------------------------------------------------
  const arrival = useMemo(() => {
    const { path, search } = appAddress();
    return parseConfigureAddress(path, search);
  }, []);
  const [wanted, setWanted] = useState<WantedSelection>(arrival.wanted);
  const [wantedSize, setWantedSize] = useState<string | undefined>(arrival.size);
  const [step, setStep] = useState<ConfigureStep>(arrival.step);
  /** A share code from the address that is still being looked up; the page waits for it before showing a build. */
  const [arrivalCode, setArrivalCode] = useState<string | undefined>(arrival.code);

  const selection = useMemo(() => (catalog ? reconcileSelection(catalog, wanted) : null), [catalog, wanted]);
  const car = catalog && selection ? findCar(catalog, selection.car) : undefined;
  const paint = catalog && selection ? findPaint(catalog, selection.paint) : undefined;
  const wheel = catalog && selection ? findWheel(catalog, selection.wheel) : undefined;
  const finish = findFinish(wheel, selection?.finish);
  const sizes = useMemo(() => (wheel ? rimSizes(wheel.design) : []), [wheel]);
  const size = wheel ? nearestRimSize(wheel.design, wantedSize ?? DEFAULT_SIZE) : undefined;
  const build: Build | null = car && paint && wheel && finish && size ? { car, paint, wheel, finish, size } : null;
  const showSummary = step === 'summary' && !!build;

  // ----------------------------------------------------
  // The picture
  // ----------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  const stageWidth = useElementWidth(stageRef);
  const [plateSize, setPlateSize] = useState<PlateSize | null>(null);
  useEffect(() => {
    if (!manifest || !stageWidth) return;
    // a bigger encoding when the stage grows; never back to a smaller one (no reload on a small resize)
    setPlateSize((current) => {
      const next = pickSize(manifest.sizes, stageWidth, window.devicePixelRatio || 1, current ?? undefined);
      return current && current.suffix === next.suffix ? current : next;
    });
  }, [manifest, stageWidth]);
  const source = useMemo<PlateSource | null>(
    () => (plates.status === 'ready' && plateSize ? { base: PLATES_BASE, format: plates.format, size: plateSize } : null),
    [plates, plateSize]
  );

  const [failuresInARow, setFailuresInARow] = useState(0);
  const picturesDown = failuresInARow >= MAX_FAILURES_IN_A_ROW;
  /** The selection each frame was made for, so the stage's reports can be traced back to it. */
  const selectionOfFrame = useRef(new WeakMap<Frame, Selection>());
  const frame = useMemo(() => {
    if (!catalog || !selection || !source || arrivalCode || picturesDown || !isRendered(catalog, selection)) return null;
    const next = frameFor(catalog, selection, source);
    selectionOfFrame.current.set(next, selection);
    return next;
  }, [catalog, selection, source, arrivalCode, picturesDown]);

  /** The selection whose picture is on the stage: what the page returns to when another picture fails. */
  const shownSelection = useRef<Selection | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!notice || notice.retry) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onShown = useCallback((shown: Frame) => {
    shownSelection.current = selectionOfFrame.current.get(shown) ?? null;
    setFailuresInARow(0);
  }, []);
  const onFailed = useCallback((_failed: Frame, failedPlates: string[]) => {
    console.warn(`Plates: could not load ${failedPlates.join(', ')}`);
    // the failed pictures become "not pictured" and the page goes back to the picture that is showing
    setBrokenPlates((current) => new Set([...current, ...failedPlates]));
    setFailuresInARow((count) => count + 1);
    if (shownSelection.current) setWanted(shownSelection.current);
    setNotice({ text: 'That picture could not be loaded.', retry: true });
  }, []);
  const retryPictures = useCallback(() => {
    setBrokenPlates(NO_BROKEN_PLATES);
    setFailuresInARow(0);
    setNotice(null);
  }, []);

  // Pictures the customer is likely to ask for next: the other views of this combination
  const neighbourUrls = useMemo(
    () => (catalog && selection && source && frame ? neighbourViews(catalog, selection).flatMap((neighbour) => frameImages(frameFor(catalog, neighbour, source)).map((image) => image.url)) : []),
    [catalog, selection, source, frame]
  );
  useEffect(() => {
    if (neighbourUrls.length && !prefersLessData()) loader.warm(neighbourUrls);
  }, [loader, neighbourUrls]);

  // ----------------------------------------------------
  // Changes
  // ----------------------------------------------------
  const change = useCallback(
    (requested: WantedSelection) => {
      if (!catalog || !selection) return;
      setNotice(null);
      setWanted(changeSelection(catalog, selection, requested));
    },
    [catalog, selection]
  );
  /** The pointer or focus is on an option: fetch what a click would show, ahead of the other views. */
  const warmChange = useCallback(
    (requested: WantedSelection) => {
      if (!catalog || !selection || !source || prefersLessData()) return;
      const next = previewSelection(catalog, selection, requested);
      if (next) loader.warm([...frameImages(frameFor(catalog, next, source)).map((image) => image.url), ...neighbourUrls]);
    },
    [catalog, selection, source, loader, neighbourUrls]
  );
  const notPictured = useCallback((what: string) => setNotice({ text: `${what}: picture coming soon.` }), []);

  // ----------------------------------------------------
  // The address bar
  // ----------------------------------------------------
  useEffect(() => {
    if (!selection || arrivalCode) return;
    const href = configureHref({ selection, size, step: showSummary ? 'summary' : 'configure' });
    if (window.location.pathname + window.location.search === href) return;
    try {
      window.history.replaceState(window.history.state, '', href);
    } catch {
      /* a sandboxed frame without history access: the page works, the address is not updated */
    }
  }, [selection, size, showSummary, arrivalCode]);
  useEffect(() => {
    // Back and Forward (the summary is its own history entry): show what that address says
    const onPopState = () => {
      const { path, search } = appAddress();
      const address = parseConfigureAddress(path, search);
      if (Object.keys(address.wanted).length) setWanted(address.wanted);
      if (address.size) setWantedSize(address.size);
      setStep(address.step);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (!catalog || !selection) return;
    const before = document.title;
    document.title = `${describeSelection(catalog, selection).split(',')[0]} | ${BRAND.name}`;
    return () => {
      document.title = before;
    };
  }, [catalog, selection]);

  const openSummary = useCallback(() => {
    if (!selection || !build) return;
    try {
      window.history.pushState(IN_APP_STATE, '', configureHref({ selection, size: build.size, step: 'summary' }));
    } catch {
      /* no history access: the summary still opens */
    }
    setStep('summary');
  }, [selection, build]);
  const closeSummary = useCallback(() => {
    // the summary was opened from the configurator: Back returns to it; a direct link has nothing to go back to
    if (cameFromApp()) window.history.back();
    else setStep('configure');
  }, []);

  // ----------------------------------------------------
  // Saved builds, account, enquiry
  // ----------------------------------------------------
  const codes = useBuildCode();
  const [garageVersion, setGarageVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  // a sign-in that came back with an error opens the account sheet, which shows the message
  useEffect(() => {
    if (peekOAuthError() !== null) setAccountOpen(true);
  }, []);

  /** Opens the saved build with this share code. False when there is none (or it cannot be looked up). */
  const openCode = useCallback(
    async (code: string): Promise<boolean> => {
      let found: Awaited<ReturnType<typeof findConfiguration>> = null;
      try {
        found = await findConfiguration(code);
      } catch (error) {
        console.warn(`Saved build ${code} could not be looked up`, error);
      }
      if (!found) return false;
      const saved = found.config;
      // ids of the catalogue (and of builds saved before the plates) are understood by reconcileSelection
      setWanted({ car: saved.carId, paint: saved.paintId, wheel: saved.wheelId, finish: saved.finishId });
      if (saved.size) setWantedSize(saved.size);
      const savedRegion = BRAND.regions.find((candidate) => candidate.id === saved.regionId);
      if (savedRegion) setRegion(savedRegion);
      codes.adopt(saved, code, found.source === 'server' ? true : undefined);
      setStep('configure');
      return true;
    },
    [codes.adopt, setRegion]
  );
  useEffect(() => {
    if (!arrivalCode) return;
    let current = true;
    // a code that is unknown or cannot be looked up opens the default configuration, silently
    openCode(arrivalCode).finally(() => current && setArrivalCode(undefined));
    return () => {
      current = false;
    };
  }, [arrivalCode, openCode]);

  const saveToGarage = useCallback(
    async (saved: Parameters<typeof codes.saveToGarage>[0], name: string) => {
      const result = await codes.saveToGarage(saved, name);
      if (result === true) setGarageVersion((version) => version + 1);
      return result;
    },
    [codes.saveToGarage]
  );

  const enquirySummary = [car?.model.name, paint?.name, build ? `${build.wheel.design.name} ${build.size} in ${build.finish.name}` : 'factory wheels'].filter(Boolean).join(' · ');
  const enquiryContext = useMemo(
    () => ({
      configCode: build && codes.buildCode ? codes.buildCode.code : undefined,
      configuration: build
        ? leadConfiguration(build)
        : car && paint
          ? { car: car.model.name, paint: paint.name, wheel: 'Factory wheels (no wheel chosen)', carId: car.model.id, paintId: paint.id }
          : undefined,
      region: region.id
    }),
    [build, car, paint, region.id, codes.buildCode]
  );

  /** The wheel's own page (details, the 360° viewer), which returns to this build. */
  const openWheelDetails = useCallback(
    (detailWheel: ConfigWheel) => {
      const back = selection ? configureHref({ selection, size }) : configureHref();
      goTo(`/rims/${encodeURIComponent(detailWheel.design.id)}?back=${encodeURIComponent(back)}`);
    },
    [selection, size]
  );

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  const aspectRatio = manifest ? manifest.frame.w / manifest.frame.h : 16 / 9;
  /** The catalogue and selection once there is something to show (a share code from the address is looked up first). */
  const live = catalog && selection && !arrivalCode ? { catalog, selection } : null;
  const nothingPictured = !!live && !picturesDown && !isRendered(live.catalog, live.selection);
  const description = live ? describeSelection(live.catalog, live.selection) : 'The configurator is loading';
  // garage builds made here carry plate paint ids; older ones the catalogue's
  const garagePaints = useMemo(() => [...siteCatalogue.paints, ...(joined?.paints ?? []).map(paintAsCatalogue)], [siteCatalogue.paints, joined]);

  return (
    <div className="fixed inset-0 flex select-none bg-carbon text-ink sheet:flex-col">
      <h1 className="sr-only">{BRAND.name} configurator</h1>

      {/* The picture: the hero. Chrome around it stays quiet */}
      <div className="relative flex min-w-0 flex-1 flex-col sheet:flex-none">
        <header className="flex h-16 shrink-0 items-center justify-between pl-6 pr-4 short:h-12 sheet:h-14 sheet:pl-4 sheet:pr-2">
          <a href="/" onClick={linkTo('/')} aria-label={`${BRAND.name} home`} className="flex min-h-11 items-center">
            <Logo size="sm" />
          </a>
          <div className="flex items-center gap-1">
            <IconButton label="Account" onClick={() => setAccountOpen(true)} className="h-11 w-11">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <UserRound className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              )}
            </IconButton>
            <IconButton label="Menu" onClick={() => setMenuOpen(true)} className="h-11 w-11">
              <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </IconButton>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-4 short:px-3 short:pb-1 sheet:px-0 sheet:pb-0">
          {/* As wide as fits: the stage is 16:9, so its width is also limited by the height left for it */}
          <div ref={stageRef} className="relative w-full max-w-[calc((100dvh_-_9.5rem)_*_16_/_9)] short:max-w-[calc((100dvh_-_6.5rem)_*_16_/_9)] sheet:max-w-none">
            <PlateStage frame={frame} loader={loader} aspectRatio={aspectRatio} description={description} crossOrigin={PLATES_CROSS_ORIGIN} onShown={onShown} onFailed={onFailed} />
            {plates.status === 'failed' && (
              <StageMessage title="The pictures could not be loaded" action="Try again" onAction={plates.retry}>
                {plates.error.kind === 'network' ? 'Check your connection and try again.' : 'Please try again in a moment.'}
              </StageMessage>
            )}
            {picturesDown && (
              <StageMessage title="The pictures could not be loaded" action="Try again" onAction={retryPictures}>
                Check your connection and try again.
              </StageMessage>
            )}
            {nothingPictured && <StageMessage title="Pictures coming soon">This car is being photographed in the studio. You can still enquire about any wheel.</StageMessage>}
            {/* One line of feedback over the picture's lower edge, announced politely; it takes no room of its own */}
            <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center px-3">
              <div className={cx('pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 transition-opacity duration-200', notice ? 'bg-carbon/85 opacity-100 ring-1 ring-line backdrop-blur' : 'opacity-0')}>
                <Status className="min-h-9 content-center truncate text-[12px] leading-9 text-ink">{notice?.text ?? ''}</Status>
                {notice?.retry && (
                  <button type="button" onClick={retryPictures} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold">
                    <RotateCw className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex min-h-11 w-full flex-col items-center short:mt-0 sheet:mt-0">
            {live && (
              <ViewTabs
                views={viewOptions(live.catalog, live.selection)}
                onSelect={(view) => change({ view })}
                onIntent={(view) => warmChange({ view })}
                onUnavailable={(view) => notPictured(`${view.label} view of this combination`)}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* The choices: a column beside the picture, a scrolling sheet under it on phones */}
      <aside aria-label="Options" className="flex w-[var(--panel-w)] shrink-0 flex-col border-l border-line bg-surface sheet:min-h-0 sheet:w-auto sheet:flex-1 sheet:border-l-0 sheet:border-t">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 sheet:px-4 sheet:py-4">
          {live ? (
            <OptionsPanel
              cars={carOptions(live.catalog, live.selection)}
              paintGroups={paintGroups(live.catalog, live.selection)}
              wheels={wheelOptions(live.catalog, live.selection)}
              finishes={finishOptions(live.catalog, live.selection)}
              paint={paint}
              wheel={wheel}
              finish={finish}
              factoryWheelSelected={live.selection.wheel === FACTORY_WHEEL}
              sizes={sizes}
              size={size}
              region={region}
              onChange={change}
              onIntent={warmChange}
              onUnavailable={notPictured}
              onSize={setWantedSize}
              onWheelDetails={openWheelDetails}
            />
          ) : plates.status === 'failed' ? (
            <p className="text-[13px] leading-relaxed text-mute">The configurator could not load its pictures. You can still enquire, or see the wheel collection from the menu.</p>
          ) : (
            <PanelPlaceholder />
          )}
        </div>
        <div className="shrink-0 border-t border-line px-6 py-4 sheet:px-4 sheet:py-3">
          <PriceBar ready={!!live} wheel={wheel} finish={finish} size={size} region={region} onViewBuild={openSummary} onEnquire={() => setEnquiryOpen(true)} />
        </div>
      </aside>

      {showSummary && build && catalog && selection && source && (
        <BuildSummary
          catalog={catalog}
          selection={selection}
          build={build}
          region={region}
          source={source}
          crossOrigin={PLATES_CROSS_ORIGIN}
          buildCode={codes.buildCode}
          onEnsureCode={codes.ensure}
          onSaveToGarage={saveToGarage}
          signedIn={!!account.user}
          contactPrefill={account.contactPrefill}
          onBack={closeSummary}
          onEnquire={() => setEnquiryOpen(true)}
          onSignIn={() => setAccountOpen(true)}
        />
      )}

      <OptionsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        region={region}
        onRegion={setRegion}
        onOpenCode={openCode}
        onOpenAccount={() => setAccountOpen(true)}
        onEnquire={() => setEnquiryOpen(true)}
        onNavigate={goTo}
      />

      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={account.user}
        profile={account.profile}
        onProfile={account.setProfile}
        // the address holds the configuration, so the customer comes back from Google to this build
        onSignIn={() => signInWithGoogle()}
        onOpenBuild={async (code) => {
          const opened = await openCode(code);
          if (opened) setAccountOpen(false);
          return opened;
        }}
        onDeleted={codes.forget}
        cars={siteCatalogue.cars}
        paints={garagePaints}
        wheels={siteCatalogue.wheels}
        finishes={siteCatalogue.finishes}
        garageVersion={garageVersion}
      />

      <EnquiryModal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} summary={enquirySummary} prefill={account.contactPrefill} context={enquiryContext} />
    </div>
  );
};

/** A calm message over the empty stage (never a blank or broken picture), with one action when there is one. */
const StageMessage: React.FC<{ title: string; children: React.ReactNode; action?: string; onAction?: () => void }> = ({ title, children, action, onAction }) => (
  <div role={action ? 'alert' : 'status'} className="absolute inset-0 flex flex-col items-center justify-center px-8 pb-[4%] text-center">
    <p className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
    <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-mute">{children}</p>
    {action && onAction && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onAction} icon={<RotateCw className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />}>
        {action}
      </Button>
    )}
  </div>
);

/** The shape of the options while the manifest loads, so the panel does not jump when they arrive. */
const PanelPlaceholder: React.FC = () => (
  <div aria-hidden className="space-y-8">
    {[5, 7, 4].map((count, row) => (
      <div key={row}>
        <div className="h-2.5 w-16 rounded-full bg-ink/[0.07]" />
        <div className="mt-4 flex flex-wrap gap-3">
          {Array.from({ length: count }, (_, index) => (
            <span key={index} className={cx('h-9 rounded-full bg-ink/[0.05]', row === 0 ? 'w-20' : 'w-9')} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default ConfigurePage;
