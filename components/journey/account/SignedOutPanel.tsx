/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, FolderOpen, Lock, MonitorSmartphone } from 'lucide-react';
import { BRAND } from '../../../config/brand';
import { Alert, Eyebrow, Status } from '../ui';
import { HERO_SLIDES } from '../HeroStage';
import { GoogleButton } from './accountUi';

/** What an account is for, in the customer's terms (each line is something the app really does with it). */
const PERKS = [
  { icon: MonitorSmartphone, title: 'One account, both sites', body: `Sign in here or on ${BRAND.contact.website}: it is the same garage.` },
  { icon: FolderOpen, title: 'Every build, every device', body: 'Builds you save wait for you on your phone and on your computer.' },
  { icon: FileText, title: 'Your details, filled in', body: 'Your name, email and number go straight into the enquiry and PDF forms.' }
] as const;

// The fade is on the frame, not the image: the image is taller than the frame, so a fade on it would happen
// out of sight and leave the backdrop and the floor's pool of light cut off by straight edges.
const STILL_FADE_Y = 'linear-gradient(to bottom, transparent 0%, #000 16%, #000 58%, transparent 100%)';
const STILL_FADE_X = 'linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%)';

/** The car on stage, as on the welcome: a studio still that fades into the sheet. */
const StageStill: React.FC<{ carId?: string }> = ({ carId }) => {
  const slide = HERO_SLIDES.find((s) => s.carId === carId) ?? HERO_SLIDES[0];
  return (
    <div
      className="relative -mx-7 h-40 overflow-hidden sm:h-44"
      aria-hidden
      style={{
        WebkitMaskImage: `${STILL_FADE_Y}, ${STILL_FADE_X}`,
        WebkitMaskComposite: 'source-in',
        maskImage: `${STILL_FADE_Y}, ${STILL_FADE_X}`,
        maskComposite: 'intersect'
      }}
    >
      <img src={`/hero/${slide.carId}-960.webp`} alt="" draggable={false} decoding="async" className="absolute left-1/2 top-1/2 w-[122%] max-w-none -translate-x-1/2 -translate-y-1/2 select-none" />
    </div>
  );
};

export interface SignedOutPanelProps {
  stageCarId?: string;
  busy: boolean;
  error: string | null;
  /** Set right after an account was deleted: said once, above the pitch. */
  notice?: string | null;
  onSignIn: () => void;
  onClose: () => void;
}

/** The sheet before sign-in: the pitch, the Google button and the one line POPIA asks for. Full height on phones, so the button sits within thumb reach. */
export const SignedOutPanel: React.FC<SignedOutPanelProps> = ({ stageCarId, busy, error, notice, onSignIn, onClose }) => (
  <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col sm:min-h-0">
    <StageStill carId={stageCarId} />
    <Status className="text-gold">{notice ?? ''}</Status>
    <Eyebrow className="mt-2 text-gold">{BRAND.name} garage</Eyebrow>
    <h3 className="mt-2.5 font-display text-[27px] font-extrabold leading-[1.06] tracking-[-0.025em] text-ink">Keep every build you make</h3>
    <p className="mt-2.5 text-[13.5px] leading-relaxed text-mute">Sign in to save your builds and pick them up again on any device.</p>
    <ul className="mt-6 space-y-4">
      {PERKS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/[0.08] ring-1 ring-gold/35">
            <Icon className="h-4 w-4 text-gold" strokeWidth={1.7} aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="text-[13.5px] font-semibold text-ink">{title}</div>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-mute">{body}</div>
          </div>
        </li>
      ))}
    </ul>
    <div className="mt-auto pt-8 sm:pt-7">
      <GoogleButton busy={busy} onClick={onSignIn} />
      {error && <Alert className="mt-3">{error}</Alert>}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-mute">
        <Lock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden /> Google signs you in. We never see your password.
      </p>
      <button type="button" onClick={onClose} className="mt-4 h-11 w-full rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] text-mute transition hover:bg-ink/[0.05] hover:text-ink">
        Not now, keep configuring
      </button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-mute/80">
        We store your name, email and saved builds to run your garage, and nothing else. You can download your data or delete your account from the sheet once you are signed in, or write to{' '}
        <a href={`mailto:${BRAND.contact.email}`} className="underline decoration-line underline-offset-2 hover:text-gold">
          {BRAND.contact.email}
        </a>
        .
      </p>
    </div>
  </div>
);
