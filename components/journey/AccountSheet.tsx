/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, UserRound } from 'lucide-react';
import { CarModel, PaintColor, WheelDesign, WheelFinish } from '../../types';
import { Profile, signOut, takeOAuthError } from '../../services/authService';
import { Alert, Button, Modal, cx } from './ui';
import { SignedOutPanel } from './account/SignedOutPanel';
import { GarageTab } from './account/GarageTab';
import { ProfileTab } from './account/ProfileTab';
import { PrivacyTab } from './account/PrivacyTab';

export interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  profile: Profile | null;
  /** The profile as saved from the sheet (the app keeps it to prefill the enquiry and PDF forms). */
  onProfile: (profile: Profile) => void;
  /** Starts the Google sign-in (the app decides where the visitor lands back). Resolves with an error message or null. */
  onSignIn: () => Promise<string | null>;
  /** Reopens a saved build in the configurator (the app's existing ?config= flow). */
  onOpenBuild: (code: string) => Promise<boolean>;
  /** The catalogue, to describe builds and offer the primary-car choice. */
  cars: CarModel[];
  paints: PaintColor[];
  wheels: WheelDesign[];
  finishes: Record<string, WheelFinish>;
  /** Bumped when a build was saved to the garage elsewhere (the summary), so the list refreshes. */
  garageVersion?: number;
  /** Called once a build has been deleted from the garage (the app stops showing its code as saved). */
  onDeleted?: (code: string) => void;
  /** The car on stage, so the sign-in shows the same car (its welcome still); the first welcome car otherwise. */
  stageCarId?: string;
}

type Tab = 'garage' | 'profile' | 'privacy';
const TABS: { id: Tab; label: string }[] = [
  { id: 'garage', label: 'Garage' },
  { id: 'profile', label: 'Profile' },
  { id: 'privacy', label: 'Privacy' }
];

/**
 * The customer's account, in the viewer panel's glass idiom: a full-height sheet on phones, a centred column on larger
 * screens. Signed out it is a short pitch and the Google button; signed in it is three tabs (the garage of saved builds,
 * the profile that fills the forms, and privacy: email choice, data download, account deletion). The same account is the
 * website's (docs/ACCOUNTS.md).
 */
export const AccountSheet: React.FC<AccountSheetProps> = (p) => {
  const signedIn = !!p.user;
  const [tab, setTab] = useState<Tab>('garage');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null);

  // A sign-in that came back with an error in the URL is read (once) when the sheet opens and shown in either state;
  // closing the sheet forgets it (and the tab, and the deleted notice), so none of them comes back later.
  useEffect(() => {
    if (!p.open) {
      setSignInError(null);
      setSignInBusy(false);
      setTab('garage');
      setDeletedNotice(null);
      return;
    }
    const e = takeOAuthError();
    if (e) setSignInError(e);
  }, [p.open]);
  // Back from Google without a reload (the page restored from the back/forward cache keeps its state): the button must offer the sign-in again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setSignInBusy(false);
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  /** Hands over to Google; on success the page leaves, so only a failure comes back here. */
  const startSignIn = async () => {
    setSignInBusy(true);
    setSignInError(null);
    let err: string | null;
    try {
      err = await p.onSignIn();
    } catch (e) {
      err = e instanceof Error ? e.message : 'Google sign-in could not be started. Please try again.';
    }
    if (err) {
      setSignInError(err);
      setSignInBusy(false);
    }
  };

  const avatar = p.profile?.avatarUrl ?? (p.user?.user_metadata?.avatar_url as string | undefined) ?? (p.user?.user_metadata?.picture as string | undefined) ?? null;
  const name = p.profile?.displayName ?? (p.user?.user_metadata?.full_name as string | undefined) ?? '';
  const email = p.profile?.email ?? p.user?.email ?? '';

  return (
    <Modal
      open={p.open}
      onClose={p.onClose}
      title={signedIn ? 'Your garage' : 'Sign in'}
      width="max-w-md"
      panelClassName="bg-surface/[0.82] backdrop-blur-xl ring-1 ring-line rounded-none sm:rounded-[14px] h-[100dvh] sm:h-auto sm:max-h-[88dvh]"
    >
      {!p.user ? (
        <SignedOutPanel stageCarId={p.stageCarId} busy={signInBusy} error={signInError} notice={deletedNotice} onSignIn={startSignIn} onClose={p.onClose} />
      ) : (
        <div className="pb-2">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-line" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] ring-1 ring-line">
                <UserRound className="h-6 w-6 text-mute" strokeWidth={1.5} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[17px] font-bold tracking-[-0.01em]">{name || email}</div>
              <div className="truncate text-[12.5px] text-mute">{email}</div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" aria-label="Sign out" onClick={() => signOut()} icon={<LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />}>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
          {signInError && <Alert className="mt-3">{signInError}</Alert>}

          <div role="tablist" aria-label="Your account" className="mt-6 grid grid-cols-3 gap-1 rounded-full bg-ink/[0.05] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`account-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`account-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                  e.preventDefault();
                  const i = TABS.findIndex((x) => x.id === tab);
                  const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
                  setTab(next);
                  document.getElementById(`account-tab-${next}`)?.focus();
                }}
                className={cx(
                  'h-9 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold',
                  tab === t.id ? 'bg-gold font-bold text-carbon' : 'text-mute hover:text-ink'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`} className="mt-5">
            {tab === 'garage' && (
              <GarageTab open={p.open} user={p.user} cars={p.cars} paints={p.paints} wheels={p.wheels} finishes={p.finishes} garageVersion={p.garageVersion} onOpenBuild={p.onOpenBuild} onDeleted={p.onDeleted} />
            )}
            {tab === 'profile' && <ProfileTab open={p.open} user={p.user} profile={p.profile} onProfile={p.onProfile} cars={p.cars} />}
            {tab === 'privacy' && (
              <PrivacyTab
                user={p.user}
                profile={p.profile}
                onProfile={p.onProfile}
                onAccountDeleted={() => setDeletedNotice('Your account has been deleted.')}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
