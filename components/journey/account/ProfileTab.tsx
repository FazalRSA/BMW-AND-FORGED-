/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Check } from 'lucide-react';
import { CarModel } from '../../../types';
import { BRAKE_SYSTEMS, BrakeSystem, Profile, updateMyProfile } from '../../../services/authService';
import { Alert, Button, Status } from '../ui';
import { Field, fieldCls } from './accountUi';

type ProfileForm = { displayName: string; phone: string; city: string; primaryCarId: string; brakeSystem: string };
const formFrom = (p: Profile | null, u: User | null): ProfileForm => ({
  displayName: p?.displayName ?? (u?.user_metadata?.full_name as string | undefined) ?? '',
  phone: p?.phone ?? '',
  city: p?.city ?? '',
  primaryCarId: p?.primaryCarId ?? '',
  brakeSystem: p?.brakeSystem ?? ''
});

const carLabel = (c: CarModel) => `${c.name}${c.generation ? ` (${c.generation})` : ''}`;

export interface ProfileTabProps {
  open: boolean;
  user: User;
  profile: Profile | null;
  onProfile: (profile: Profile) => void;
  cars: CarModel[];
}

/** The details the enquiry and PDF forms are filled from. The email is the Google account's and is shown, not edited. */
export const ProfileTab: React.FC<ProfileTabProps> = (p) => {
  const [form, setForm] = useState<ProfileForm>(() => formFrom(p.profile, p.user));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Fields the customer has typed in since the sheet opened: a profile arriving late must not overwrite them. */
  const touched = useRef(new Set<keyof ProfileForm>());

  // The save status lasts until the customer edits a field, closes the sheet or the account changes.
  // (Before the form effect below: it must start from a clean set of touched fields.)
  useEffect(() => {
    touched.current.clear();
    setState('idle');
    setError(null);
  }, [p.open, p.user.id]);
  // The fields follow the profile prop (it changes right after our own save too, and when the app's fetch completes after the
  // sheet was opened), so this effect refreshes the values only: it must not touch the save status.
  useEffect(() => {
    setForm((f) => {
      const fresh = formFrom(p.profile, p.user);
      touched.current.forEach((k) => {
        fresh[k] = f[k];
      });
      return fresh;
    });
    // (the user's id, not the object: a token refresh must not wipe what is being typed)
  }, [p.profile, p.user.id, p.open]);

  const setField = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    touched.current.add(k);
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setState('idle');
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      const saved = await updateMyProfile({
        displayName: form.displayName,
        phone: form.phone,
        city: form.city,
        primaryCarId: form.primaryCarId || null,
        brakeSystem: (form.brakeSystem || null) as BrakeSystem | null
      });
      touched.current.clear(); // the stored row is the truth again
      p.onProfile(saved);
      setState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The profile could not be saved.');
      setState('error');
    }
  };

  // The cars on offer, plus the customer's stored car when it has since been hidden: a controlled select whose
  // value matches no option would show "Not set" while the form still holds (and would save) the old id.
  const carOptions = p.cars.filter((c) => c.active !== false).map((c) => ({ id: c.id, label: carLabel(c) }));
  if (form.primaryCarId && !carOptions.some((o) => o.id === form.primaryCarId)) {
    const stored = p.cars.find((c) => c.id === form.primaryCarId);
    carOptions.push({ id: form.primaryCarId, label: stored ? `${carLabel(stored)} (no longer offered)` : 'A car no longer offered' });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Email">
        <input value={p.profile?.email ?? p.user.email ?? ''} readOnly aria-readonly className={`${fieldCls} cursor-default text-mute`} />
      </Field>
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
            {carOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
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
      {error && <Alert>{error}</Alert>}
      <Button type="submit" variant="secondary" className="w-full" disabled={state === 'saving'} icon={state === 'saved' ? <Check className="h-4 w-4" /> : undefined}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Profile saved' : 'Save profile'}
      </Button>
      {/* The button's label swap is not read out by every screen reader; this live region is */}
      <Status className="sr-only">{state === 'saving' ? 'Saving your profile…' : state === 'saved' ? 'Profile saved' : ''}</Status>
    </form>
  );
};
