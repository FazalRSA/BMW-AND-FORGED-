/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import type { Region } from '../../config/brand';
import type { WheelFinish } from '../../types';
import { PdfContact, SavedConfiguration, configKey, submitEnquiry } from '../../services/journeyService';
import { rimPrice } from '../../services/pricing';
import { ConfigCar, ConfigWheel, PlateCatalog, paintAsCatalogue, paintDetail } from '../../services/plates/catalog';
import { composeJpeg } from '../../services/plates/compose';
import { PlateSource, frameFor, pickSize } from '../../services/plates/frames';
import type { PlatePaint } from '../../services/plates/manifest';
import { Selection, describeSelection, summaryViews } from '../../services/plates/selection';
import { SummaryPage } from '../journey/SummaryPage';
import { PlateStill } from './PlateStage';
import type { BuildCode } from './useBuildCode';

/** The build as the site's leads, PDF and share codes know it (catalogue ids; the paint by its plate id). */
export interface Build {
  car: ConfigCar;
  paint: PlatePaint;
  wheel: ConfigWheel;
  finish: WheelFinish;
  size: string;
}

/** The record the enquiry form, the PDF lead and the owner's email read (names for people, ids for lookups). */
export const leadConfiguration = (build: Build): Record<string, string> => ({
  car: build.car.model.name,
  paint: build.paint.name,
  wheel: build.wheel.design.name,
  size: build.size,
  finish: build.finish.name,
  carId: build.car.model.id,
  paintId: build.paint.id,
  wheelId: build.wheel.design.id,
  finishId: build.finish.id
});

export const savedConfiguration = (build: Build, region: Region): SavedConfiguration => ({
  carId: build.car.model.id,
  paintId: build.paint.id,
  wheelId: build.wheel.design.id,
  finishId: build.finish.id,
  size: build.size,
  regionId: region.id
});

/** The width the PDF's pictures are composed at (the brochure prints them about 18 cm wide). */
const PDF_PICTURE_WIDTH = 1280;

export interface BuildSummaryProps {
  catalog: PlateCatalog;
  selection: Selection;
  build: Build;
  region: Region;
  /** Where the page's pictures come from (the summary shows the same files the stage has loaded). */
  source: PlateSource;
  crossOrigin?: 'anonymous';
  buildCode: BuildCode | null;
  onEnsureCode: (build: SavedConfiguration) => void;
  onSaveToGarage: (build: SavedConfiguration, name: string) => Promise<true | string>;
  signedIn: boolean;
  contactPrefill?: Partial<PdfContact>;
  onBack: () => void;
  onEnquire: () => void;
  onSignIn: () => void;
}

/**
 * The summary and quote step: the site's existing summary page (share code, PDF gate, garage, enquiry)
 * fed from the plate configuration. The pictures are the build's rendered views; the PDF gets the same
 * views flattened to JPEG. The lead is saved before the PDF is made, exactly as before.
 */
export const BuildSummary: React.FC<BuildSummaryProps> = (p) => {
  const { build, region } = p;
  const price = rimPrice(build.wheel.design, build.size, build.finish.id);
  const paint = useMemo(() => paintAsCatalogue(build.paint), [build.paint]);
  const saved = useMemo(() => savedConfiguration(build, region), [build, region]);
  // a code made for another build (the one before a change) is not this build's code
  const code = p.buildCode && p.buildCode.key === configKey(saved) ? p.buildCode : null;

  // the build gets its share code as the summary opens (and a new one when the build changes under it)
  const { onEnsureCode } = p;
  useEffect(() => onEnsureCode(saved), [onEnsureCode, saved]);

  const views = useMemo(() => summaryViews(p.catalog, p.selection), [p.catalog, p.selection]);
  const stills = views.map((view) => (
    <PlateStill key={view.view} frame={frameFor(p.catalog, view, p.source)} description={describeSelection(p.catalog, view)} crossOrigin={p.crossOrigin} />
  ));

  const downloadPdf = useCallback(
    async (contact: PdfContact) => {
      // Saved as a lead first (submitEnquiry keeps a local copy if the server cannot be reached; only a
      // refusal from the server, e.g. the rate limit, stops the PDF and is shown)
      const lead = await submitEnquiry({ ...contact, consultation: false, source: 'pdf', configCode: code?.code, configuration: leadConfiguration(build), region: region.id });
      if (lead.status === 'rejected') throw new Error(lead.message);
      const pdfSource: PlateSource = { ...p.source, size: pickSize(p.catalog.manifest.sizes, PDF_PICTURE_WIDTH, 1) };
      const { w, h } = p.catalog.manifest.frame;
      const pictures = await Promise.all(
        views.map((view) => composeJpeg(frameFor(p.catalog, view, pdfSource), { width: PDF_PICTURE_WIDTH, height: Math.round((PDF_PICTURE_WIDTH * h) / w), crossOrigin: p.crossOrigin }))
      );
      // loaded on demand: the PDF library is not part of the configurator's own code
      const { downloadBrochurePdf } = await import('../../services/brochurePdf');
      await downloadBrochurePdf({
        car: build.car.model,
        paint,
        paintDetail: paintDetail(build.paint),
        wheel: build.wheel.design,
        finish: build.finish,
        size: build.size,
        price,
        region,
        code: code?.code ?? '',
        images: pictures.filter((picture): picture is string => !!picture)
      });
    },
    [build, region, code?.code, views, p.catalog, p.source, p.crossOrigin, paint, price]
  );

  return (
    <SummaryPage
      car={build.car.model}
      paint={paint}
      paintDetail={paintDetail(build.paint)}
      wheel={build.wheel.design}
      finish={build.finish}
      size={build.size}
      price={price}
      region={region}
      images={[]}
      stills={stills}
      code={code?.code ?? null}
      codeShared={code?.shared}
      onBack={p.onBack}
      onEnquire={p.onEnquire}
      signedIn={p.signedIn}
      onSaveToGarage={(name) => p.onSaveToGarage(saved, name)}
      onSignIn={p.onSignIn}
      contactPrefill={p.contactPrefill}
      onDownloadPdf={downloadPdf}
    />
  );
};
