// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { USER_ROLE_VALUES } from '@inventario/shared-types';
import { AlertCircle, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { JSX, ReactNode } from 'react';

import { useUpdateUser, useUser } from '@/lib/api-hooks';
import { cn } from '@/lib/cn';

/**
 * Edit user dialog (admin).
 *
 * Loads the full UserDetail via `useUser(id)` so the dialog has
 * fresh data even if the list cache is stale. Two editable surfaces:
 *
 *   1. Roles (multi-select checkboxes — backend stores roles[] with
 *      a min-1 invariant, see UpdateUserBodySchema).
 *   2. isActive toggle.
 *
 * Pre-emptive self-guardrails (when isSelf is true):
 *   - The ADMIN checkbox is disabled with a tooltip ("Nemôžete si
 *     odobrať vlastnú admin rolu") so the user can't even try to
 *     submit a self-demote. Backend rejects it too, but the UI
 *     surfaces the constraint up-front.
 *   - The isActive toggle is disabled with a tooltip ("Nemôžete sa
 *     sami deaktivovať").
 *   - Other roles stay editable on self — promoting yourself from
 *     ADMIN+ASSET_MANAGER to just ADMIN is fine.
 *
 * Last-active-admin guardrail is server-side only: we can't detect
 * it client-side without a count query, and the backend already
 * returns a user-friendly message ("Cannot revoke ADMIN role: this
 * is the last active administrator in the tenant"). The dialog
 * surfaces that message verbatim through the error state.
 *
 * Submit semantics:
 *   - Only changed fields are sent. Submitting with no changes
 *     returns 200 with the user unchanged but generates noise; we
 *     skip the request entirely if no diff.
 *   - The dialog stays open after a refused mutation so the user
 *     can read the error and adjust.
 */

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrátor',
  ASSET_MANAGER: 'Správca majetku',
  TEAM_MANAGER: 'Vedúci tímu',
  EMPLOYEE: 'Zamestnanec',
  EXTERNAL: 'Externý',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Plný prístup, správa používateľov.',
  ASSET_MANAGER: 'Eviduje majetok, schvaľuje výpožičky.',
  TEAM_MANAGER: 'Spravuje výpožičky pre svoj tím.',
  EMPLOYEE: 'Bežný používateľ — môže si požičať pre seba.',
  EXTERNAL: 'Externý spolupracovník s obmedzeným prístupom.',
};

interface UserEditDialogProps {
  userId: string;
  isSelf: boolean;
  onClose: () => void;
}

export function UserEditDialog({ userId, isSelf, onClose }: UserEditDialogProps): JSX.Element {
  const userQuery = useUser(userId);
  const updateUser = useUpdateUser();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  // Form state — initialised from the fetched user, then user-edited.
  // We don't use react-hook-form here because the form is genuinely
  // small (5 checkboxes + 1 toggle) and form-state explicitness helps
  // readers see the dirty-diff logic at the bottom.
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(true);
  const [initialised, setInitialised] = useState(false);

  // Initialise form state from fetched user, exactly once. We use a
  // `initialised` flag rather than a JSON.stringify dependency to
  // avoid resetting the user's in-progress edits if the server
  // returns a stale refetch mid-edit.
  useEffect(() => {
    if (userQuery.data && !initialised) {
      setSelectedRoles(new Set(userQuery.data.roles));
      setIsActive(userQuery.data.isActive);
      setInitialised(true);
    }
  }, [userQuery.data, initialised]);

  // Close on Escape, focus cancel on mount — same patterns as the
  // other dialogs in the codebase.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !updateUser.isPending) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, updateUser.isPending]);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  // Compute what (if anything) has changed against the original.
  // Memoised so the disabled-submit and the payload share a single
  // truth without recomputing on every render.
  const patch = useMemo(() => {
    if (!userQuery.data || !initialised) {
      return null;
    }
    const original = userQuery.data;
    const rolesChanged =
      selectedRoles.size !== original.roles.length ||
      original.roles.some((r) => !selectedRoles.has(r));
    const activeChanged = isActive !== original.isActive;

    if (!rolesChanged && !activeChanged) {
      return null;
    }

    const result: { roles?: string[]; isActive?: boolean } = {};
    if (rolesChanged) {
      result.roles = Array.from(selectedRoles);
    }
    if (activeChanged) {
      result.isActive = isActive;
    }
    return result;
  }, [userQuery.data, initialised, selectedRoles, isActive]);

  function toggleRole(role: string, isAdminSelfLock: boolean): void {
    // Pre-emptive guardrail: ADMIN role on self is fixed.
    if (isAdminSelfLock) {
      return;
    }
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  function onSubmit(): void {
    if (!patch) {
      return;
    }
    updateUser.mutate(
      { id: userId, patch },
      {
        onSuccess: onClose,
        // onError surfaces via updateUser.error — dialog stays open
        // so the user can read the backend's message and adjust.
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="relative flex w-full max-w-lg flex-col gap-0 rounded-t-2xl bg-surface-card shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="edit-user-title" className="text-lg font-semibold text-text-primary">
              Upraviť používateľa
            </h2>
            {userQuery.data ? (
              <p className="mt-0.5 text-xs text-text-secondary">
                {userQuery.data.displayName} · {userQuery.data.email}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={updateUser.isPending}
            aria-label="Zatvoriť"
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 py-5">
          {userQuery.isLoading || !initialised ? (
            <LoadingShimmer />
          ) : userQuery.isError ? (
            <ErrorPanel
              message={
                (userQuery.error as Error & { status?: number })?.status === 404
                  ? 'Používateľ nebol nájdený. Pravdepodobne ho už zmazal niekto iný.'
                  : 'Detail používateľa sa nepodarilo načítať. Skúste znova.'
              }
            />
          ) : (
            <DialogBody
              roles={selectedRoles}
              isActive={isActive}
              isSelf={isSelf}
              onToggleRole={toggleRole}
              onToggleActive={() => {
                if (!isSelf) {
                  setIsActive((v) => !v);
                }
              }}
            />
          )}

          {updateUser.error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-danger-fg bg-danger-bg p-3 text-sm text-danger-fg"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{updateUser.error.message}</span>
            </div>
          ) : null}

          {selectedRoles.size === 0 && initialised && !updateUser.error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-warning-fg bg-warning-bg p-3 text-sm text-warning-fg"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Používateľ musí mať aspoň jednu rolu.</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-page/50 px-6 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={updateUser.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Zrušiť
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={
              patch === null || updateUser.isPending || !initialised || selectedRoles.size === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
            aria-live="polite"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {updateUser.isPending ? 'Ukladám…' : 'Uložiť zmeny'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog body — role checkboxes + isActive toggle
// ---------------------------------------------------------------------------

interface DialogBodyProps {
  roles: ReadonlySet<string>;
  isActive: boolean;
  isSelf: boolean;
  onToggleRole: (role: string, isAdminSelfLock: boolean) => void;
  onToggleActive: () => void;
}

function DialogBody({
  roles,
  isActive,
  isSelf,
  onToggleRole,
  onToggleActive,
}: DialogBodyProps): JSX.Element {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-text-primary">Roly</legend>
        <p className="mt-0.5 text-xs text-text-secondary">
          Používateľ musí mať aspoň jednu rolu. Roly môžu byť kombinované.
        </p>
        <ul className="mt-3 space-y-2">
          {USER_ROLE_VALUES.map((role) => {
            const checked = roles.has(role);
            const isAdminSelfLock = isSelf && role === 'ADMIN';
            return (
              <li key={role}>
                <label
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-card p-3 transition',
                    isAdminSelfLock
                      ? 'cursor-not-allowed opacity-70'
                      : 'cursor-pointer hover:border-border-default hover:bg-surface-subtle',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isAdminSelfLock}
                    onChange={() => onToggleRole(role, isAdminSelfLock)}
                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border-default text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-medium text-text-primary">
                      {ROLE_LABELS[role] ?? role}
                      {isAdminSelfLock ? (
                        <span className="ml-2 text-xs font-normal text-text-muted">
                          (nemôžete si odobrať vlastnú rolu)
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {ROLE_DESCRIPTIONS[role] ?? null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <Field
        label="Aktívny účet"
        hint={
          isSelf
            ? 'Nemôžete sa sami deaktivovať. Požiadajte iného administrátora.'
            : 'Deaktivovaný účet nemôže pristupovať do aplikácie, ale jeho história zostane zachovaná.'
        }
      >
        <label
          className={cn(
            'inline-flex items-center gap-2',
            isSelf ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          )}
        >
          <input
            type="checkbox"
            checked={isActive}
            disabled={isSelf}
            onChange={onToggleActive}
            className="h-4 w-4 rounded border-border-default text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed"
          />
          <span className="text-sm text-text-primary">Účet je aktívny</span>
        </label>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </div>
  );
}

function LoadingShimmer(): JSX.Element {
  return (
    <div aria-busy="true" aria-label="Načítavam detail" className="space-y-3">
      <div className="h-4 w-24 animate-pulse rounded bg-surface-subtle" />
      <div className="h-14 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-14 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-14 animate-pulse rounded-lg bg-surface-subtle" />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }): JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger-fg bg-danger-bg p-3 text-sm text-danger-fg"
    >
      <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
