// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { AlertCircle, ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AssetDetailEditForm } from './AssetDetailEditForm';
import { AssetDetailReadView } from './AssetDetailReadView';

import type { JSX } from 'react';

import { useAsset, useCanEditAssets, useCategories, useLocations } from '@/lib/api-hooks';

/**
 * Asset detail page content.
 *
 * Three runtime states:
 *   1. Loading → skeleton (uses the same visual language as the list
 *      page so the navigation between the two doesn't feel jarring).
 *   2. Error → either "not found" (404 from server) or "could not
 *      load" (every other failure). Both stay inside AppShell so the
 *      user can navigate elsewhere; we don't redirect away because
 *      the URL might still be valid in seconds (transient outage).
 *   3. Loaded → toggleable read view / edit form.
 *
 * Composition note: AuthGate (in the page-level component) already
 * wraps children in AppShell, so this component renders only the
 * page-body content. Earlier iterations wrapped a second AppShell
 * here, which silently nested two headers + (post mobile-polish) two
 * hamburger drawers. The fix is to trust the page wrapper.
 *
 * Reference-data fetching (categories, locations):
 *   Done at this level rather than inside the read view so the edit
 *   form can show the same name resolution + use the same options
 *   list for its select inputs, with one round-trip and one cache
 *   entry per resource.
 */
export function AssetDetailContent({ assetId }: { assetId: string }): JSX.Element {
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const assetQuery = useAsset(assetId);
  const categoriesQuery = useCategories({ limit: 200 });
  const locationsQuery = useLocations({ limit: 200 });
  const canEdit = useCanEditAssets();

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-6 flex items-center gap-2 text-sm" aria-label="Drobky">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1 rounded text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Späť na zoznam
        </Link>
      </nav>

      {assetQuery.isLoading ? (
        <DetailSkeleton />
      ) : assetQuery.isError ? (
        <ErrorState error={assetQuery.error} assetId={assetId} />
      ) : assetQuery.data ? (
        <>
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-text-muted">
                {assetQuery.data.inventoryNumber}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">
                {assetQuery.data.name}
              </h1>
            </div>

            {canEdit && mode === 'read' ? (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Upraviť
              </button>
            ) : null}
          </header>

          {mode === 'read' ? (
            <AssetDetailReadView
              asset={assetQuery.data}
              categoriesById={new Map((categoriesQuery.data?.data ?? []).map((c) => [c._id, c]))}
              locationsById={new Map((locationsQuery.data?.data ?? []).map((l) => [l._id, l]))}
            />
          ) : (
            <AssetDetailEditForm
              asset={assetQuery.data}
              categories={categoriesQuery.data?.data ?? []}
              locations={locationsQuery.data?.data ?? []}
              onCancel={() => setMode('read')}
              onSaved={() => setMode('read')}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * Two distinct error states keyed off the HTTP status the hook
 * attached to the thrown error. 404 means the asset is gone or never
 * existed; everything else is a transient failure.
 */
function ErrorState({ error, assetId }: { error: Error; assetId: string }): JSX.Element {
  const status = (error as Error & { status?: number }).status;
  const isNotFound = status === 404;

  return (
    <div
      role="alert"
      className="rounded-xl border border-border-default bg-surface-card p-8 text-center shadow-sm"
    >
      <AlertCircle aria-hidden="true" className="mx-auto h-10 w-10 text-text-muted" />
      <h2 className="mt-3 text-lg font-semibold text-text-primary">
        {isNotFound ? 'Položka neexistuje' : 'Položku sa nepodarilo načítať'}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {isNotFound
          ? `Pre ID ${assetId} sa nenašiel žiadny záznam, alebo k nej nemáte prístup v rámci vašej organizácie.`
          : 'Skontrolujte pripojenie a skúste obnoviť stránku. Ak problém pretrváva, kontaktujte správcu.'}
      </p>
      <Link
        href="/assets"
        className="mt-4 inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-card px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Späť na zoznam
      </Link>
    </div>
  );
}

function DetailSkeleton(): JSX.Element {
  return (
    <div aria-busy="true" aria-label="Načítavam detail položky">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface-subtle" />
        <div className="h-8 w-72 animate-pulse rounded bg-surface-subtle" />
      </div>
      <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-card p-6 shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-subtle" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
