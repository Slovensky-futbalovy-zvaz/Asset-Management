// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { JSX } from 'react';

/**
 * Reusable confirm delete dialog.
 *
 * Designed for the taxonomy entities (categories, locations) and the
 * users admin module, where delete is potentially destructive but
 * server-side FK protection catches the truly dangerous cases. The
 * UI's job is to:
 *
 *   1. Make the user confirm intent (no accidental clicks on a "..."
 *      row menu).
 *   2. Surface the backend's error message verbatim if the delete is
 *      refused — those messages are already phrased for end users
 *      (e.g. "12 assets reference it. Reassign or delete those
 *      assets first.").
 *   3. Keep the dialog open after a refused delete so the user can
 *      read the message and act on it (vs auto-closing, which would
 *      flash the message past them).
 *
 * Caller is responsible for wiring up the actual mutation — this
 * component is presentation only. See CategoriesContent for the
 * canonical wiring example.
 *
 * Accessibility:
 *   - role="alertdialog" (not "dialog") because this is a destructive
 *     confirm flow; AT will treat it with higher priority.
 *   - Escape closes (handled at document level so focus position
 *     doesn't matter).
 *   - The cancel button receives focus on mount (via useEffect +
 *     ref, not autoFocus — jsx-a11y flags the prop), so accidental
 *     Enter presses don't trigger the destructive action.
 *   - We deliberately do NOT close on backdrop click. The same
 *     reasoning as CategoryCreateDialog applies, with extra weight
 *     here: an accidental brush against the backdrop dismissing a
 *     destructive-action confirmation would be the worst possible
 *     close path.
 */
interface ConfirmDeleteDialogProps {
  /** Title shown as the dialog heading. Phrase as a question. */
  title: string;
  /** Description of what will happen. Plain prose, no markup. */
  description: string;
  /** Label for the destructive confirm button. */
  confirmLabel: string;
  /** Whether the mutation is currently running. Disables both buttons. */
  isPending: boolean;
  /** Error message from a previous attempt, if any. */
  error: string | null;
  /** Called when the user clicks the destructive button. */
  onConfirm: () => void;
  /** Called when the user clicks cancel, backdrop, or hits Escape. */
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps): JSX.Element {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close on Escape — same pattern as CategoryCreateDialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !isPending) {
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, isPending]);

  // Focus the cancel button on mount so accidental Enter presses
  // don't trigger the destructive action. Done via ref rather than
  // the `autoFocus` prop because eslint-plugin-jsx-a11y bans the
  // latter (it can be surprising on auto-mounted screens); a
  // programmatic focus on a deliberately-mounted dialog is fine.
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-description"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="relative flex w-full max-w-md flex-col gap-0 rounded-t-2xl bg-surface-card shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger-fg"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <h2 id="confirm-delete-title" className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            aria-label="Zatvoriť"
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 py-5">
          <p id="confirm-delete-description" className="text-sm text-text-secondary">
            {description}
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-danger-fg bg-danger-bg p-3 text-sm text-danger-fg"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-page/50 px-6 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            Zrušiť
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-danger-fg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
            aria-live="polite"
          >
            {isPending ? 'Mažem…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
