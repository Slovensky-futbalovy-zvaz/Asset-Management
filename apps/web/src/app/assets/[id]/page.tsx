// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AssetDetailContent } from '@/components/AssetDetailContent';
import { AuthGate } from '@/components/AuthGate';

/**
 * /assets/[id] — detail of a single asset.
 *
 * Server component that mirrors the shape of /assets and /: parse the
 * URL segment here, hand the id off to a client component, wrap the
 * whole thing in AuthGate so unauthenticated visitors get the login
 * screen instead of a 404 for a route they can't see.
 *
 * In Next.js 15, dynamic route params arrive as a Promise that must
 * be awaited even when there's a single segment. See the Next.js
 * "Dynamic Route Segments" docs.
 */
export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  return (
    <AuthGate>
      <AssetDetailContent assetId={id} />
    </AuthGate>
  );
}
