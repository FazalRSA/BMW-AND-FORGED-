/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { CarModel, PaintColor, WheelDesign, WheelFinish } from '../../../types';
import { BuildMissingError, GarageBuild, deleteConfiguration, listMyConfigurations, renameConfiguration } from '../../../services/authService';
import { forgetLocalConfiguration } from '../../../services/journeyService';
import { Alert, Button, cx } from '../ui';
import { shortModelName } from '../carNames';
import { formatDate } from './accountUi';

export interface GarageTabProps {
  /** True while the sheet is open (the list is loaded then and dropped on close). */
  open: boolean;
  user: User;
  cars: CarModel[];
  paints: PaintColor[];
  wheels: WheelDesign[];
  finishes: Record<string, WheelFinish>;
  /** Bumped when a build was saved to the garage elsewhere (the summary), so the list refreshes. */
  garageVersion?: number;
  onOpenBuild: (code: string) => Promise<boolean>;
  onDeleted?: (code: string) => void;
}

/** The customer's saved builds: open, rename, delete. */
export const GarageTab: React.FC<GarageTabProps> = (p) => {
  const [builds, setBuilds] = useState<GarageBuild[] | null>(null);
  /** Why the list could not be loaded, or that a build acted on is gone (the list is then reloaded). */
  const [garageError, setGarageError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  /** True for the one reload a "no longer in your garage" message caused: that message stays above the fresh list. */
  const keepGarageError = useRef(false);
  const [renaming, setRenaming] = useState<{ code: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  /** The build being reopened in the configurator (its "Open" button waits). */
  const [openingCode, setOpeningCode] = useState<string | null>(null);
  /** Why the last open, rename or delete of a build failed, shown under that build. */
  const [rowError, setRowError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    // A reload (open, account change, a save elsewhere, a build found gone) starts from a quiet list:
    // no editor open, no delete armed, no stale message. Closing the sheet clears them too.
    setRowError(null);
    setRenaming(null);
    setConfirmDelete(null);
    if (!p.open) {
      setBuilds(null);
      return;
    }
    let live = true;
    if (keepGarageError.current) keepGarageError.current = false;
    else setGarageError(null);
    listMyConfigurations()
      .then((b) => live && setBuilds(b))
      .catch((err) => live && setGarageError(err instanceof Error ? err.message : 'Your garage could not be loaded.'));
    return () => {
      live = false;
    };
  }, [p.open, p.user.id, p.garageVersion, refreshTick]);

  const describe = (b: GarageBuild) => {
    const car = p.cars.find((c) => c.id === b.payload.carId);
    const paint = p.paints.find((x) => x.id === b.payload.paintId);
    const wheel = p.wheels.find((w) => w.id === b.payload.wheelId);
    const finish = p.finishes[b.payload.finishId];
    return [car ? shortModelName(car) : b.payload.carId, paint?.name ?? b.payload.paintId, wheel?.name ?? b.payload.wheelId, b.payload.size, finish?.name ?? b.payload.finishId]
      .filter(Boolean)
      .join(' · ');
  };
  /** A build that is gone (deleted elsewhere, or the session lapsed): say so above the list and reload it. */
  const buildGone = (err: unknown) => {
    if (!(err instanceof BuildMissingError)) return false;
    setGarageError(err.message);
    keepGarageError.current = true;
    setRefreshTick((t) => t + 1);
    return true;
  };
  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const { code, name } = renaming;
    setBusyCode(code);
    setGarageError(null);
    setRowError(null);
    try {
      await renameConfiguration(code, name);
      setBuilds((bs) => bs?.map((b) => (b.code === code ? { ...b, name: name.trim() || null } : b)) ?? null);
      setRenaming(null);
    } catch (err) {
      if (!buildGone(err)) setRowError({ code, message: err instanceof Error ? err.message : 'The build could not be renamed.' });
    } finally {
      setBusyCode(null);
    }
  };
  const remove = async (code: string) => {
    setBusyCode(code);
    setGarageError(null);
    setRowError(null);
    try {
      await deleteConfiguration(code);
      forgetLocalConfiguration(code);
      setBuilds((bs) => bs?.filter((b) => b.code !== code) ?? null);
      setConfirmDelete(null);
      p.onDeleted?.(code);
    } catch (err) {
      // Nothing was deleted (the row is gone already, or not this session's): the local copy and the summary's code stay
      if (!buildGone(err)) setRowError({ code, message: err instanceof Error ? err.message : 'The build could not be deleted.' });
    } finally {
      setBusyCode(null);
    }
  };
  /** Reopens a build; when the app declines (its car or wheel is no longer offered, or the code is gone) the build says so. */
  const openBuild = async (code: string) => {
    setRowError(null);
    setOpeningCode(code);
    try {
      const opened = await p.onOpenBuild(code);
      if (!opened) setRowError({ code, message: 'This build can’t be opened: its car or wheel is no longer offered.' });
    } catch (err) {
      setRowError({ code, message: err instanceof Error ? err.message : 'This build could not be opened.' });
    } finally {
      setOpeningCode(null);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h4 className="text-[13.5px] font-semibold text-ink">Saved builds</h4>
        {builds && builds.length > 0 && <span className="text-[11px] text-mute">{builds.length} saved</span>}
      </div>
      {garageError && <Alert className="mt-3">{garageError}</Alert>}
      {/* Mounted throughout, as a live region should be (a plain <p>: the Status wrapper's 12.5px would change this 13px line) */}
      <p role="status" aria-live="polite" aria-atomic="true" className={cx('text-[13px] text-mute', !builds && !garageError && 'mt-3')}>
        {!builds && !garageError ? 'Loading your builds…' : ''}
      </p>
      {builds && builds.length === 0 && (
        <p className="mt-3 text-[13px] leading-relaxed text-mute">Nothing saved yet. Configure a car, open the summary and use “Save to garage” next to your configuration code.</p>
      )}
      {builds && builds.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {builds.map((b) => {
            const label = b.name || b.code;
            const busy = busyCode === b.code;
            const opening = openingCode === b.code;
            return (
              <li key={b.code} className="rounded-[14px] bg-ink/[0.035] p-4 ring-1 ring-line">
                {renaming?.code === b.code ? (
                  <form onSubmit={rename} className="flex gap-2">
                    <input
                      autoFocus
                      aria-label="Build name"
                      value={renaming.name}
                      maxLength={80}
                      onChange={(e) => setRenaming({ code: b.code, name: e.target.value })}
                      onKeyDown={(e) => {
                        // Escape cancels the rename only (the sheet's own Escape handler listens on window)
                        if (e.key !== 'Escape') return;
                        e.stopPropagation();
                        setRenaming(null);
                      }}
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
                    <Button variant="secondary" size="sm" className="shrink-0" aria-label={`Open ${label}`} disabled={busy || opening} onClick={() => openBuild(b.code)} icon={<FolderOpen className="h-3.5 w-3.5" strokeWidth={1.8} />}>
                      {opening ? 'Opening…' : 'Open'}
                    </Button>
                  </div>
                )}
                {rowError?.code === b.code && <Alert className="mt-2">{rowError.message}</Alert>}
                {confirmDelete === b.code ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-mute">Delete this build from your garage?</span>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => remove(b.code)} className="text-red-400 ring-red-400/50">
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
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:bg-ink/[0.06] hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} /> Rename
                      </button>
                      <button
                        onClick={() => {
                          setRenaming(null);
                          setConfirmDelete(b.code);
                        }}
                        aria-label={`Delete ${label}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:bg-ink/[0.06] hover:text-red-400"
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
    </div>
  );
};
