/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Check, FolderOpen, LogOut, Pencil, Trash2, UserRound } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { CarModel, PaintColor, WheelDesign, WheelFinish } from '../../types';
import {
  BRAKE_SYSTEMS,
  BrakeSystem,
  GarageBuild,
  Profile,
  deleteConfiguration,
  listMyConfigurations,
  renameConfiguration,
  signOut,
  takeOAuthError,
  updateMyProfile
} from '../../services/authService';
import { forgetLocalConfiguration } from '../../services/journeyService';
import { Button, Divider, Eyebrow, Modal, cx } from './ui';
import { shortModelName } from './Showroom';

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
}

const fieldCls = 'mt-1.5 h-12 w-full rounded-xl bg-ink/[0.04] px-4 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-gold/60 transition placeholder:text-mute/50';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">{label}</span>
    {children}
  </label>
);

/** Google's "G", as its sign-in button guidelines ask for. */
const GoogleMark: React.FC = () => (
  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
    <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  </span>
);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

type ProfileForm = { displayName: string; phone: string; city: string; primaryCarId: string; brakeSystem: string };
const formFrom = (p: Profile | null, u: User | null): ProfileForm => ({
  displayName: p?.displayName ?? (u?.user_metadata?.full_name as string | undefined) ?? '',
  phone: p?.phone ?? '',
  city: p?.city ?? '',
  primaryCarId: p?.primaryCarId ?? '',
  brakeSystem: p?.brakeSystem ?? ''
});

/**
 * The customer's account: Google sign-in, profile and garage of saved builds, in the viewer panel's glass
 * idiom. A full-height sheet on phones, a centred column on larger screens.
 */
export const AccountSheet: React.FC<AccountSheetProps> = (p) => {
  const signedIn = !!p.user;
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  useEffect(() => {
    if (p.open) setSignInError((e) => e ?? takeOAuthError());
  }, [p.open]);

  // Profile form
  const [form, setForm] = useState<ProfileForm>(() => formFrom(p.profile, p.user));
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  useEffect(() => {
    setForm(formFrom(p.profile, p.user));
    setProfileState('idle');
    // (the user's id, not the object: a token refresh must not wipe what is being typed)
  }, [p.profile, p.user?.id, p.open]);
  const setField = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setProfileState('idle');
  };
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileState('saving');
    setProfileError(null);
    try {
      const saved = await updateMyProfile({
        displayName: form.displayName,
        phone: form.phone,
        city: form.city,
        primaryCarId: form.primaryCarId || null,
        brakeSystem: (form.brakeSystem || null) as BrakeSystem | null
      });
      p.onProfile(saved);
      setProfileState('saved');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'The profile could not be saved.');
      setProfileState('error');
    }
  };

  // Garage
  const [builds, setBuilds] = useState<GarageBuild[] | null>(null);
  const [garageError, setGarageError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ code: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  useEffect(() => {
    if (!p.open || !signedIn) {
      setBuilds(null);
      return;
    }
    let live = true;
    setGarageError(null);
    listMyConfigurations()
      .then((b) => live && setBuilds(b))
      .catch((err) => live && setGarageError(err instanceof Error ? err.message : 'Your garage could not be loaded.'));
    return () => {
      live = false;
    };
  }, [p.open, signedIn, p.user?.id, p.garageVersion]);

  const describe = (b: GarageBuild) => {
    const car = p.cars.find((c) => c.id === b.payload.carId);
    const paint = p.paints.find((x) => x.id === b.payload.paintId);
    const wheel = p.wheels.find((w) => w.id === b.payload.wheelId);
    const finish = p.finishes[b.payload.finishId];
    return [car ? shortModelName(car) : b.payload.carId, paint?.name ?? b.payload.paintId, wheel?.name ?? b.payload.wheelId, b.payload.size, finish?.name ?? b.payload.finishId]
      .filter(Boolean)
      .join(' · ');
  };
  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const { code, name } = renaming;
    setBusyCode(code);
    try {
      await renameConfiguration(code, name);
      setBuilds((bs) => bs?.map((b) => (b.code === code ? { ...b, name: name.trim() || null } : b)) ?? null);
      setRenaming(null);
    } catch (err) {
      setGarageError(err instanceof Error ? err.message : 'The build could not be renamed.');
    } finally {
      setBusyCode(null);
    }
  };
  const remove = async (code: string) => {
    setBusyCode(code);
    try {
      await deleteConfiguration(code);
      forgetLocalConfiguration(code);
      setBuilds((bs) => bs?.filter((b) => b.code !== code) ?? null);
      setConfirmDelete(null);
    } catch (err) {
      setGarageError(err instanceof Error ? err.message : 'The build could not be deleted.');
    } finally {
      setBusyCode(null);
    }
  };

  const avatar = p.profile?.avatarUrl ?? (p.user?.user_metadata?.avatar_url as string | undefined) ?? (p.user?.user_metadata?.picture as string | undefined) ?? null;
  const name = p.profile?.displayName ?? (p.user?.user_metadata?.full_name as string | undefined) ?? '';
  const email = p.profile?.email ?? p.user?.email ?? '';
  const activeCars = p.cars.filter((c) => c.active !== false);

  return (
    <Modal
      open={p.open}
      onClose={p.onClose}
      title="Your garage"
      width="max-w-md"
      panelClassName="bg-surface/[0.82] backdrop-blur-xl ring-1 ring-line rounded-none sm:rounded-[14px] h-[100dvh] sm:h-auto sm:max-h-[88dvh]"
    >
      {!signedIn ? (
        <div className="pb-2">
          <p className="text-[13.5px] leading-relaxed text-mute">
            An account keeps your saved builds together on every device and fills in your details when you enquire.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full"
            aria-label="Continue with Google"
            disabled={signInBusy}
            icon={<GoogleMark />}
            onClick={async () => {
              setSignInBusy(true);
              setSignInError(null);
              const err = await p.onSignIn();
              if (err) {
                setSignInError(err);
                setSignInBusy(false);
              }
            }}
          >
            {signInBusy ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          {signInError && <p className="mt-3 text-[12.5px] text-red-400">{signInError}</p>}
          <p className="mt-5 text-[11px] leading-relaxed text-mute">
            We store your name, email and saved builds to run your garage. Delete your account any time via{' '}
            <a href={`mailto:${BRAND.contact.email}`} className="underline decoration-line underline-offset-2 hover:text-gold">
              {BRAND.contact.email}
            </a>{' '}
            or the enquiry form.
          </p>
        </div>
      ) : (
        <div className="pb-2">
          {/* Who */}
          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-line" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] ring-1 ring-line">
                <UserRound className="h-6 w-6 text-mute" strokeWidth={1.5} />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-[17px] font-bold tracking-[-0.01em]">{name || email}</div>
              <div className="truncate text-[12.5px] text-mute">{email}</div>
            </div>
          </div>

          {/* Profile */}
          <form onSubmit={saveProfile} className="mt-7 space-y-4">
            <Eyebrow>Profile</Eyebrow>
            <Field label="Display name">
              <input value={form.displayName} onChange={setField('displayName')} autoComplete="name" maxLength={80} className={fieldCls} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={setField('phone')} autoComplete="tel" placeholder="082 123 4567" maxLength={40} className={fieldCls} />
              </Field>
              <Field label="City">
                <input value={form.city} onChange={setField('city')} autoComplete="address-level2" maxLength={120} className={fieldCls} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your car">
                <select value={form.primaryCarId} onChange={setField('primaryCarId')} className={fieldCls}>
                  <option value="">Not set</option>
                  {activeCars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.generation ? `(${c.generation})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brake system">
                <select value={form.brakeSystem} onChange={setField('brakeSystem')} className={fieldCls}>
                  <option value="">Not set</option>
                  {BRAKE_SYSTEMS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {profileError && <p className="text-[12.5px] text-red-400">{profileError}</p>}
            <Button type="submit" variant="secondary" className="w-full" disabled={profileState === 'saving'} icon={profileState === 'saved' ? <Check className="h-4 w-4" /> : undefined}>
              {profileState === 'saving' ? 'Saving…' : profileState === 'saved' ? 'Profile saved' : 'Save profile'}
            </Button>
          </form>

          <Divider className="my-7" />

          {/* Garage */}
          <div className="flex items-baseline justify-between">
            <Eyebrow>Garage</Eyebrow>
            {builds && builds.length > 0 && <span className="text-[11px] text-mute">{builds.length} saved</span>}
          </div>
          {garageError && <p className="mt-3 text-[12.5px] text-red-400">{garageError}</p>}
          {!builds && !garageError && <p className="mt-3 text-[13px] text-mute">Loading your builds…</p>}
          {builds && builds.length === 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-mute">
              Nothing saved yet. Configure a car, open the summary and use “Save to garage” next to your configuration code.
            </p>
          )}
          {builds && builds.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {builds.map((b) => {
                const label = b.name || b.code;
                const busy = busyCode === b.code;
                return (
                  <li key={b.code} className="rounded-[14px] bg-ink/[0.035] ring-1 ring-line p-4">
                    {renaming?.code === b.code ? (
                      <form onSubmit={rename} className="flex gap-2">
                        <input
                          autoFocus
                          aria-label="Build name"
                          value={renaming.name}
                          maxLength={80}
                          onChange={(e) => setRenaming({ code: b.code, name: e.target.value })}
                          className="h-10 min-w-0 flex-1 rounded-xl bg-ink/[0.04] px-3 text-[13.5px] text-ink outline-none ring-1 ring-line focus:ring-gold/60"
                        />
                        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
                          {busy ? 'Saving…' : 'Save'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cx('truncate text-[14.5px] font-semibold', !b.name && 'font-mono tracking-[0.14em]')}>{label}</div>
                          <div className="mt-0.5 truncate text-[12px] text-mute">{describe(b)}</div>
                          <div className="mt-0.5 text-[11px] text-mute/80">
                            {formatDate(b.createdAt)}
                            {b.name && <span className="font-mono tracking-[0.1em]"> · {b.code}</span>}
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" className="shrink-0" aria-label={`Open ${label}`} disabled={busy} onClick={() => p.onOpenBuild(b.code)} icon={<FolderOpen className="h-3.5 w-3.5" strokeWidth={1.8} />}>
                          Open
                        </Button>
                      </div>
                    )}
                    {confirmDelete === b.code ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="text-mute">Delete this build from your garage?</span>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => remove(b.code)} className="ring-red-400/50 text-red-400">
                          {busy ? 'Deleting…' : 'Delete'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      renaming?.code !== b.code && (
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => {
                              setConfirmDelete(null);
                              setRenaming({ code: b.code, name: b.name ?? '' });
                            }}
                            aria-label={`Rename ${label}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mute hover:text-ink hover:bg-ink/[0.06] transition"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} /> Rename
                          </button>
                          <button
                            onClick={() => {
                              setRenaming(null);
                              setConfirmDelete(b.code);
                            }}
                            aria-label={`Delete ${label}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mute hover:text-red-400 hover:bg-ink/[0.06] transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Delete
                          </button>
                        </div>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Divider className="my-7" />
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] leading-relaxed text-mute">
              Your name, email and builds are stored to run this garage. To delete your account, write to{' '}
              <a href={`mailto:${BRAND.contact.email}`} className="underline decoration-line underline-offset-2 hover:text-gold">
                {BRAND.contact.email}
              </a>
              .
            </p>
            <Button variant="ghost" size="sm" className="shrink-0" aria-label="Sign out" onClick={() => signOut()} icon={<LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
