/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { SavedConfiguration } from './journeyService';

/**
 * Customer accounts: Google sign-in through Supabase Auth, the profile row and the garage of saved
 * builds (see supabase/migrations/20261110150000_customer_accounts.sql and docs/ACCOUNTS.md).
 *
 * The session is cached here so that saves and enquiries can stamp the visitor's id synchronously
 * (journeyService never waits on the network for it). The admin's own sign-in (components/admin, the
 * `type=recovery` handling in supabaseClient.ts) shares the same client and is left alone.
 */

export const BRAKE_SYSTEMS = ['M Compound Steel', 'M Carbon Ceramic', 'Bespoke Big Brake Kit'] as const;
export type BrakeSystem = (typeof BRAKE_SYSTEMS)[number];

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  city: string | null;
  primaryCarId: string | null;
  chassisCode: string | null;
  exteriorPaintId: string | null;
  brakeSystem: BrakeSystem | null;
  preferredFinishId: string | null;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The editable part of a profile. */
export type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>;

/** A build in the garage. */
export interface GarageBuild {
  code: string;
  name: string | null;
  payload: SavedConfiguration;
  createdAt: string;
  updatedAt: string | null;
}

// ----------------------------------------------------
// Session cache
// ----------------------------------------------------

type Listener = (session: Session | null) => void;
let cached: Session | null = null;
let resolved = false;
const listeners = new Set<Listener>();

const publish = (session: Session | null) => {
  cached = session;
  resolved = true;
  listeners.forEach((l) => l(session));
};

// Did this page load come back from the OAuth provider? Decided before supabase-js reads (and
// clears) the hash. A "set your password" link (#access_token=…&type=recovery) also matches: the
// admin page captured authFlags.passwordRecovery at load (supabaseClient.ts), so tidying the URL
// afterwards is harmless for it.
const OAUTH_RETURN = /(^|[#&?])(access_token|refresh_token|provider_token|error_description|error_code)=/;
const arrivedFromOAuth =
  typeof window !== 'undefined' &&
  (OAUTH_RETURN.test(window.location.hash) || (/[?&]code=/.test(window.location.search) && /[?&]state=/.test(window.location.search)));
let oauthError: string | null = null;
if (typeof window !== 'undefined') {
  const m = /error_description=([^&]*)/.exec(window.location.hash) || /[?&]error_description=([^&]*)/.exec(window.location.search);
  if (m) oauthError = decodeURIComponent(m[1].replace(/\+/g, ' '));
}

/**
 * After supabase-js has read the session from the URL (it empties the hash, leaving a trailing "#",
 * or removes ?code= itself in the PKCE flow), the address is set back to the page the visitor left
 * from: path and the app's own query (e.g. ?config=CODE) without the token fragment, so
 * routeFromLocation and share links see nothing of the round trip.
 */
function tidyOAuthReturnUrl() {
  if (typeof window === 'undefined' || !arrivedFromOAuth) return;
  const hash = window.location.hash;
  // supabase-js has not processed the fragment yet (the admin's recovery link, or an error): wait
  if (OAUTH_RETURN.test(hash) && !/error_description=|error_code=/.test(hash)) return;
  const params = new URLSearchParams(window.location.search);
  for (const k of ['code', 'state', 'flow_id', 'error', 'error_code', 'error_description']) params.delete(k);
  const search = params.toString();
  const clean = window.location.pathname + (search ? `?${search}` : '');
  if (window.location.href === window.location.origin + clean) return;
  try {
    window.history.replaceState(window.history.state, '', clean);
  } catch {
    /* the fragment stays; the app ignores it */
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  // Never await supabase calls in here (supabase-js holds a lock while notifying)
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    publish(session);
  }
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') tidyOAuthReturnUrl();
});
// A failed OAuth return never fires SIGNED_IN: tidy the address once the client has initialised.
if (arrivedFromOAuth && oauthError) supabase.auth.getSession().then(() => tidyOAuthReturnUrl());

/** The cached session (null when signed out or not yet known). */
export const getSession = (): Session | null => cached;

/** The signed-in customer's id, synchronously, for stamping writes. */
export const currentUserId = (): string | null => cached?.user.id ?? null;

/** The message of a sign-in that came back with an error in the URL, if any (read once). */
export function takeOAuthError(): string | null {
  const e = oauthError;
  oauthError = null;
  return e;
}

/**
 * Subscribes to sign-in/out. The callback runs at once with the current session when it is known.
 * Returns the unsubscribe function.
 */
export function onAuthChange(cb: Listener): () => void {
  listeners.add(cb);
  if (resolved) cb(cached);
  return () => {
    listeners.delete(cb);
  };
}

/** The signed-in user, or null; re-renders on sign-in and sign-out. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(() => cached?.user ?? null);
  useEffect(() => onAuthChange((s) => setUser(s?.user ?? null)), []);
  return user;
}

// ----------------------------------------------------
// Sign in / out
// ----------------------------------------------------

/**
 * Sends the visitor to Google. Supabase brings them back to `returnTo` (default: the page they are
 * on, path and query, so a `/?config=CODE` link survives) with the session in the URL fragment,
 * which supabase-js reads and tidyOAuthReturnUrl removes. Resolves with an error message, or null
 * once the redirect has started.
 */
export async function signInWithGoogle(returnTo?: string): Promise<string | null> {
  const path = returnTo ?? window.location.pathname + window.location.search;
  const redirectTo = window.location.origin + (path.startsWith('/') ? path : `/${path}`);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } }
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('Sign out:', error.message);
  publish(null);
}

// ----------------------------------------------------
// Profile
// ----------------------------------------------------

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  primary_car_id: string | null;
  chassis_code: string | null;
  exterior_paint_id: string | null;
  brake_system: string | null;
  preferred_finish_id: string | null;
  marketing_opt_in: boolean | null;
  created_at: string;
  updated_at: string;
};

const fromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  phone: r.phone,
  city: r.city,
  primaryCarId: r.primary_car_id,
  chassisCode: r.chassis_code,
  exteriorPaintId: r.exterior_paint_id,
  brakeSystem: (BRAKE_SYSTEMS as readonly string[]).includes(r.brake_system ?? '') ? (r.brake_system as BrakeSystem) : null,
  preferredFinishId: r.preferred_finish_id,
  marketingOptIn: !!r.marketing_opt_in,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

const PATCH_COLUMNS: Record<keyof ProfilePatch, keyof ProfileRow> = {
  email: 'email',
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  phone: 'phone',
  city: 'city',
  primaryCarId: 'primary_car_id',
  chassisCode: 'chassis_code',
  exteriorPaintId: 'exterior_paint_id',
  brakeSystem: 'brake_system',
  preferredFinishId: 'preferred_finish_id',
  marketingOptIn: 'marketing_opt_in'
};

const toRow = (patch: ProfilePatch) => {
  const row: Partial<ProfileRow> = {};
  for (const k of Object.keys(patch) as (keyof ProfilePatch)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    // Blank text clears the field
    (row as Record<string, unknown>)[PATCH_COLUMNS[k]] = typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v;
  }
  return row;
};

/** What the Google account tells us, used when the profile row is missing a value. */
const metaName = (u: User) => (u.user_metadata?.full_name || u.user_metadata?.name || null) as string | null;
const metaAvatar = (u: User) => (u.user_metadata?.avatar_url || u.user_metadata?.picture || null) as string | null;

/** The signed-in customer's profile (created from the Google account when the row is missing). */
export async function getMyProfile(): Promise<Profile | null> {
  const user = cached?.user;
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) {
    console.warn('Profile:', error.message);
    return null;
  }
  if (data) {
    const p = fromRow(data as ProfileRow);
    return { ...p, email: p.email ?? user.email ?? null, displayName: p.displayName ?? metaName(user), avatarUrl: p.avatarUrl ?? metaAvatar(user) };
  }
  // No row (user created before the trigger existed): make it from the account
  const fresh = { id: user.id, email: user.email ?? null, display_name: metaName(user), avatar_url: metaAvatar(user) };
  const { data: created, error: insertError } = await supabase.from('profiles').upsert(fresh, { onConflict: 'id' }).select('*').single();
  if (insertError || !created) {
    console.warn('Profile:', insertError?.message);
    return null;
  }
  return fromRow(created as ProfileRow);
}

/** Saves the given fields of the signed-in customer's profile and returns the row as stored. */
export async function updateMyProfile(patch: ProfilePatch): Promise<Profile> {
  const user = cached?.user;
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('profiles').update(toRow(patch)).eq('id', user.id).select('*').single();
  if (error) throw new Error(error.message);
  return fromRow(data as ProfileRow);
}

// ----------------------------------------------------
// Garage
// ----------------------------------------------------

/** The signed-in customer's saved builds, newest first. */
export async function listMyConfigurations(): Promise<GarageBuild[]> {
  const user = cached?.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('saved_configurations')
    .select('code, name, payload, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    code: r.code as string,
    name: (r.name as string | null) ?? null,
    payload: r.payload as SavedConfiguration,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at as string | null) ?? null
  }));
}

export async function renameConfiguration(code: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 80);
  const { error } = await supabase.from('saved_configurations').update({ name: clean || null }).eq('code', code);
  if (error) throw new Error(error.message);
}

/** Deletes the shared copy (the row); a copy kept in this browser is the caller's to forget. */
export async function deleteConfiguration(code: string): Promise<void> {
  const { error } = await supabase.from('saved_configurations').delete().eq('code', code);
  if (error) throw new Error(error.message);
}

/**
 * Puts a build saved anonymously (before sign-in) into the garage and names it; also renames a build
 * that is already the customer's. False when the code is unknown on the server or belongs to someone
 * else (see claim_configuration in the migration).
 */
export async function claimConfiguration(code: string, name?: string): Promise<boolean> {
  if (!cached?.user) return false;
  const { data, error } = await supabase.rpc('claim_configuration', { p_code: code, p_name: name?.trim() || null });
  if (error) throw new Error(error.message);
  return data === true;
}
