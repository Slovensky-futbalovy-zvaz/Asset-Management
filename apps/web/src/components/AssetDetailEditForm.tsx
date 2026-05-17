// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import {
  ASSET_CONDITION_VALUES,
  ASSET_STATUS_VALUES,
  ASSET_TYPE_VALUES,
} from '@inventario/shared-types';
import { AlertCircle, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  AssetDetail,
  AssetUpdatePatch,
  CategorySummary,
  LocationSummary,
} from '@/lib/api-hooks';
import type { JSX, ReactNode } from 'react';

import { useUpdateAsset } from '@/lib/api-hooks';
import { cn } from '@/lib/cn';

/**
 * Edit form for an asset. Built on react-hook-form so we get dirty
 * tracking, validation error display, and uncontrolled inputs (fewer
 * re-renders per keystroke) without writing it ourselves.
 *
 * Form ↔ wire shape:
 *   The form fields are flat strings/numbers/booleans, mirroring the
 *   AssetDetail wire shape exactly. On submit we filter to only the
 *   fields the user actually changed (`dirtyFields`) and pass that as
 *   the PATCH body — smaller payloads, fewer last-write-wins races.
 *
 * Validation strategy:
 *   We do NOT plug shared-types' Zod UpdateAssetSchema in as the
 *   resolver. Reasons:
 *     - That schema accepts every field as optional, so it can't
 *       catch "this required field went blank" — the form needs its
 *       own min-length rule on name + inventory-style fields.
 *     - The wire shape uses ISO date strings; the Zod schema parses
 *       to Date. Wrapping ISO→Date→ISO on every keystroke is wasteful.
 *   Instead we rely on react-hook-form's built-in `required` /
 *   `maxLength` / `pattern` rules, which cover the same surface the
 *   server-side schema rejects.
 *
 *   The server still validates with the full Zod schema, so a buggy
 *   client can't sneak invalid data through.
 *
 * Not editable here:
 *   - `inventoryNumber` (server identity, immutable per schema)
 *   - `organisationId` (tenant scope, immutable per schema)
 *   - `currentLoanId` (managed by loans module)
 *   - `specs` (free-form JSON; a JSON-aware editor lands when we
 *     wire up category-specific specs schemas)
 *   - `imageIds`, `internalNotes` deferred to a later iteration
 */

/**
 * Form value shape. Strings + null because every native HTML input
 * surfaces values as strings; numbers and dates get parsed at submit
 * time. We use empty string instead of null for unset values because
 * react-hook-form's <input> binding requires a string.
 */
interface FormValues {
  name: string;
  description: string;
  type: string;
  categoryId: string;
  status: string;
  condition: string;
  locationId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  acquiredAt: string; // ISO date (YYYY-MM-DD), <input type="date">
  acquisitionCost: string; // string for the input, parsed at submit
  warrantyUntil: string; // ISO date or empty
  tags: string; // comma-separated, joined/split at edit/submit
  isLoanable: boolean;
  requiresApproval: boolean;
}

/**
 * ISO datetime → YYYY-MM-DD for <input type="date">. The backend
 * sends a full ISO string; date inputs only accept the calendar
 * portion.
 */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // toISOString() always returns UTC; split off the date portion.
  return d.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD → ISO datetime at start of day UTC. Empty → null.
 */
function dateInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Dostupné',
  RESERVED: 'Rezervované',
  BORROWED: 'Zapožičané',
  IN_SERVICE: 'V servise',
  DISPOSED: 'Vyradené',
  LOST: 'Stratené',
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nové',
  EXCELLENT: 'Vynikajúce',
  GOOD: 'Dobré',
  FAIR: 'Použiteľné',
  POOR: 'Opotrebované',
  UNUSABLE: 'Nepoužiteľné',
};

const TYPE_LABELS: Record<string, string> = {
  IT: 'IT majetok',
  SPORTS_GEAR: 'Športová výstroj',
  TRAINING_EQUIPMENT: 'Tréningové vybavenie',
  OFFICE_EQUIPMENT: 'Kancelárske vybavenie',
  MEDIA: 'Médiá a video',
  COMMUNICATION: 'Komunikácia',
  OTHER: 'Iné',
};

interface AssetDetailEditFormProps {
  asset: AssetDetail;
  categories: readonly CategorySummary[];
  locations: readonly LocationSummary[];
  onCancel: () => void;
  onSaved: () => void;
}

export function AssetDetailEditForm({
  asset,
  categories,
  locations,
  onCancel,
  onSaved,
}: AssetDetailEditFormProps): JSX.Element {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const updateAsset = useUpdateAsset();

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      name: asset.name,
      description: asset.description ?? '',
      type: asset.type,
      categoryId: asset.categoryId,
      status: asset.status,
      condition: asset.condition,
      locationId: asset.locationId,
      manufacturer: asset.manufacturer ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      acquiredAt: isoToDateInput(asset.acquiredAt),
      acquisitionCost: asset.acquisitionCost == null ? '' : String(asset.acquisitionCost),
      warrantyUntil: isoToDateInput(asset.warrantyUntil),
      tags: asset.tags.join(', '),
      isLoanable: asset.isLoanable,
      requiresApproval: asset.requiresApproval,
    },
  });

  function onSubmit(values: FormValues): void {
    setSubmitError(null);

    // Build a patch that only includes fields the user actually
    // touched. dirtyFields only flags fields whose value differs from
    // the default — exactly what we want.
    const patch: AssetUpdatePatch = {};

    if (dirtyFields.name) patch.name = values.name.trim();
    if (dirtyFields.description) {
      const trimmed = values.description.trim();
      patch.description = trimmed.length === 0 ? null : trimmed;
    }
    if (dirtyFields.type) patch.type = values.type;
    if (dirtyFields.categoryId) patch.categoryId = values.categoryId;
    if (dirtyFields.status) patch.status = values.status;
    if (dirtyFields.condition) patch.condition = values.condition;
    if (dirtyFields.locationId) patch.locationId = values.locationId;
    if (dirtyFields.manufacturer) {
      const trimmed = values.manufacturer.trim();
      patch.manufacturer = trimmed.length === 0 ? null : trimmed;
    }
    if (dirtyFields.model) {
      const trimmed = values.model.trim();
      patch.model = trimmed.length === 0 ? null : trimmed;
    }
    if (dirtyFields.serialNumber) {
      const trimmed = values.serialNumber.trim();
      patch.serialNumber = trimmed.length === 0 ? null : trimmed;
    }
    if (dirtyFields.acquiredAt) {
      const iso = dateInputToISO(values.acquiredAt);
      // Required field — only send if we have a valid value; otherwise
      // the server-side validator catches it.
      if (iso) patch.acquiredAt = iso;
    }
    if (dirtyFields.acquisitionCost) {
      const trimmed = values.acquisitionCost.trim();
      if (trimmed === '') {
        patch.acquisitionCost = null;
      } else {
        const parsed = Number(trimmed.replace(',', '.'));
        if (!Number.isNaN(parsed)) {
          patch.acquisitionCost = parsed;
        }
      }
    }
    if (dirtyFields.warrantyUntil) {
      patch.warrantyUntil = dateInputToISO(values.warrantyUntil);
    }
    if (dirtyFields.tags) {
      patch.tags = values.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }
    if (dirtyFields.isLoanable) patch.isLoanable = values.isLoanable;
    if (dirtyFields.requiresApproval) patch.requiresApproval = values.requiresApproval;

    if (Object.keys(patch).length === 0) {
      // Nothing actually changed (e.g. user edited and reverted) —
      // just bounce back to read mode without bothering the server.
      onSaved();
      return;
    }

    updateAsset.mutate(
      { id: asset._id, patch },
      {
        onSuccess: () => onSaved(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Section title="Identifikácia">
        <Field
          label="Inventárne číslo"
          hint="Nedá sa zmeniť — slúži ako trvalý identifikátor v evidencii."
        >
          <input
            type="text"
            value={asset.inventoryNumber}
            disabled
            className={inputClasses({ disabled: true })}
          />
        </Field>

        <Field label="Názov" required error={errors.name?.message}>
          <input
            type="text"
            {...register('name', {
              required: 'Názov je povinný.',
              maxLength: { value: 300, message: 'Maximálne 300 znakov.' },
              setValueAs: (v: string) => v,
            })}
            className={inputClasses()}
          />
        </Field>

        <Field label="Typ majetku" required>
          <select {...register('type', { required: true })} className={inputClasses()}>
            {ASSET_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kategória" required>
          <select {...register('categoryId', { required: true })} className={inputClasses()}>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sériové číslo">
          <input
            type="text"
            {...register('serialNumber', {
              maxLength: { value: 200, message: 'Maximálne 200 znakov.' },
            })}
            className={inputClasses()}
          />
        </Field>
      </Section>

      <Section title="Stav a lokalita">
        <Field label="Stav" required>
          <select {...register('status', { required: true })} className={inputClasses()}>
            {ASSET_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kondícia" required>
          <select {...register('condition', { required: true })} className={inputClasses()}>
            {ASSET_CONDITION_VALUES.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Lokalita" required>
          <select {...register('locationId', { required: true })} className={inputClasses()}>
            {locations.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Výrobca a model">
        <Field label="Výrobca">
          <input
            type="text"
            {...register('manufacturer', {
              maxLength: { value: 200, message: 'Maximálne 200 znakov.' },
            })}
            className={inputClasses()}
          />
        </Field>

        <Field label="Model">
          <input
            type="text"
            {...register('model', {
              maxLength: { value: 200, message: 'Maximálne 200 znakov.' },
            })}
            className={inputClasses()}
          />
        </Field>
      </Section>

      <Section title="Nadobudnutie">
        <Field label="Dátum nadobudnutia" required>
          <input
            type="date"
            {...register('acquiredAt', { required: true })}
            className={inputClasses()}
          />
        </Field>

        <Field label="Nadobúdacia cena (€)" hint="Voliteľné. Použite desatinnú bodku alebo čiarku.">
          <input
            type="text"
            inputMode="decimal"
            {...register('acquisitionCost', {
              pattern: {
                value: /^$|^\d+([.,]\d{1,2})?$/,
                message: 'Neplatné číslo (napr. 1489,00).',
              },
            })}
            className={inputClasses()}
          />
        </Field>

        <Field label="Záruka do">
          <input type="date" {...register('warrantyUntil')} className={inputClasses()} />
        </Field>
      </Section>

      <Section title="Popis a štítky">
        <Field label="Popis">
          <textarea
            rows={4}
            {...register('description', {
              maxLength: { value: 2000, message: 'Maximálne 2000 znakov.' },
            })}
            className={inputClasses()}
          />
        </Field>

        <Field label="Štítky" hint="Oddeľte čiarkou. Bez # — pridáme automaticky pri zobrazení.">
          <input
            type="text"
            placeholder="napr. it-oddelenie, dev, docking"
            {...register('tags')}
            className={inputClasses()}
          />
        </Field>
      </Section>

      <Section title="Pravidlá výpožičky">
        <Field label="Možno zapožičať">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              {...register('isLoanable')}
              className="h-4 w-4 rounded border-border-default text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
            <span>Áno — položku je možné si vypožičať</span>
          </label>
        </Field>

        <Field label="Vyžaduje schválenie">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              {...register('requiresApproval')}
              className="h-4 w-4 rounded border-border-default text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
            <span>Áno — žiadosti musí potvrdiť správca</span>
          </label>
        </Field>
      </Section>

      {submitError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-fg bg-danger-bg p-4 text-sm text-danger-fg"
        >
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border-subtle bg-surface-page/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-b-xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={updateAsset.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Zrušiť
        </button>
        <button
          type="submit"
          disabled={!isDirty || updateAsset.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
          aria-live="polite"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {updateAsset.isPending ? 'Ukladám…' : 'Uložiť zmeny'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-card shadow-sm">
      <h2 className="border-b border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary">
        {title}
      </h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
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

function inputClasses(opts: { disabled?: boolean } = {}): string {
  return cn(
    'w-full rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
    opts.disabled && 'cursor-not-allowed bg-surface-subtle text-text-muted',
  );
}
