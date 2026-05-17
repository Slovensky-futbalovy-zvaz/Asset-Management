// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { ASSET_TYPE_VALUES } from '@inventario/shared-types';
import { AlertCircle, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { CategorySummary } from '@/lib/api-hooks';
import type { JSX, ReactNode } from 'react';

import { useCreateCategory } from '@/lib/api-hooks';
import { cn } from '@/lib/cn';

/**
 * Create category modal.
 *
 * MVP form scope: name + assetType + description + parent. Other
 * fields (color, icon, approvers, maxLoanDays, sortOrder) use backend
 * defaults — they're rarely needed at creation time, and editing them
 * later will live in the (yet-to-be-built) edit form.
 *
 * Validation:
 *   - `name` required, 1-200 chars (matches CategorySchema).
 *   - `assetType` required, must be one of ASSET_TYPE_VALUES.
 *   - `description` optional, max 1000 chars.
 *   - `parentId` optional; the select lists existing categories.
 *
 * Accessibility:
 *   - role="dialog" + aria-modal + aria-labelledby on the panel.
 *   - First text input auto-focused via useEffect so keyboard users
 *     can start typing immediately.
 *   - Escape key closes the dialog (handled at the document level so
 *     it fires regardless of which input has focus).
 *   - The close button (X icon) is the only mouse path to dismiss
 *     without submitting. We deliberately do NOT bind a click handler
 *     on the backdrop — a click-anywhere-to-close pattern on a
 *     non-interactive <div> requires a parallel keyboard handler
 *     that essentially duplicates the Escape one, plus a fake
 *     `role` to satisfy jsx-a11y, and the resulting widget acts like
 *     an interactive element to AT but isn't really. Escape + the
 *     visible Close button is the more accessible default.
 */

interface FormValues {
  name: string;
  assetType: string;
  description: string;
  parentId: string; // empty string = no parent (root category)
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  IT: 'IT majetok',
  SPORTS_GEAR: 'Športová výstroj',
  TRAINING_EQUIPMENT: 'Tréningové vybavenie',
  OFFICE_EQUIPMENT: 'Kancelárske vybavenie',
  MEDIA: 'Médiá a video',
  COMMUNICATION: 'Komunikácia',
  OTHER: 'Iné',
};

interface CategoryCreateDialogProps {
  existingCategories: readonly CategorySummary[];
  onClose: () => void;
  onCreated: () => void;
}

export function CategoryCreateDialog({
  existingCategories,
  onClose,
  onCreated,
}: CategoryCreateDialogProps): JSX.Element {
  const createCategory = useCreateCategory();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    mode: 'onBlur',
    defaultValues: {
      name: '',
      assetType: 'IT',
      description: '',
      parentId: '',
    },
  });

  // Focus the name input on mount. We can't pass ref directly to
  // register() output without merging, so we expose this via the
  // register's own ref forwarding.
  const { ref: nameInputRef, ...nameInputProps } = register('name', {
    required: 'Názov je povinný.',
    minLength: { value: 1, message: 'Názov nesmie byť prázdny.' },
    maxLength: { value: 200, message: 'Maximálne 200 znakov.' },
  });

  // Close on Escape — attached at the document level so it fires
  // regardless of which input has focus. Re-attached only when the
  // close handler identity changes (effectively once).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Auto-focus on mount.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  function onSubmit(values: FormValues): void {
    setSubmitError(null);

    createCategory.mutate(
      {
        name: values.name.trim(),
        assetType: values.assetType,
        description: values.description.trim() || null,
        parentId: values.parentId || null,
      },
      {
        onSuccess: () => onCreated(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-category-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="relative flex w-full max-w-lg flex-col gap-0 rounded-t-2xl bg-surface-card shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="create-category-title" className="text-lg font-semibold text-text-primary">
              Nová kategória
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Slug sa odvodí z názvu automaticky. Ostatné polia môžeš upraviť neskôr.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvoriť"
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5" noValidate>
          <Field label="Názov" required error={errors.name?.message}>
            <input
              ref={(el) => {
                nameInputRef(el);
                firstInputRef.current = el;
              }}
              type="text"
              placeholder="napr. Notebooky"
              autoComplete="off"
              className={inputClasses()}
              {...nameInputProps}
            />
          </Field>

          <Field label="Typ majetku" required>
            <select {...register('assetType', { required: true })} className={inputClasses()}>
              {ASSET_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Nadradená kategória"
            hint="Nepovinné. Vyber, ak nová kategória patrí pod existujúcu."
          >
            <select {...register('parentId')} className={inputClasses()}>
              <option value="">— Žiadna (root) —</option>
              {existingCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Popis" error={errors.description?.message}>
            <textarea
              rows={3}
              placeholder="Voliteľný popis pre používateľov."
              {...register('description', {
                maxLength: { value: 1000, message: 'Maximálne 1000 znakov.' },
              })}
              className={inputClasses()}
            />
          </Field>

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger-fg bg-danger-bg p-3 text-sm text-danger-fg"
            >
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="-mx-6 -mb-5 flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-page/50 px-6 py-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={createCategory.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              Zrušiť
            </button>
            <button
              type="submit"
              disabled={!isValid || createCategory.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
              aria-live="polite"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {createCategory.isPending ? 'Vytváram…' : 'Vytvoriť'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean | undefined;
  hint?: string | undefined;
  error?: string | undefined;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1 text-sm font-medium text-text-secondary">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger-fg">
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-xs text-danger-fg">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function inputClasses(): string {
  return cn(
    'w-full rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  );
}
