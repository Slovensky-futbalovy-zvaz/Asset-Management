// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { LocationsContent } from '@/components/LocationsContent';

/**
 * /locations — admin list page for the physical-locations taxonomy.
 *
 * Server component that defers everything interactive to AuthGate +
 * LocationsContent. Same shape as /categories and /assets:
 *   pre-login → LoginScreen
 *   authenticated → AppShell with the locations list
 *
 * RBAC:
 *   - GET (list) — all authenticated roles
 *   - POST (create) — ASSET_MANAGER + ADMIN
 *   - DELETE — ADMIN only
 *
 * The UI gates the create button via `useCanManageTaxonomy()` and
 * the delete buttons via `useCanDeleteTaxonomy()` — same helpers as
 * /categories, because the role matrix is identical on the backend.
 */
export default function LocationsPage(): JSX.Element {
  return (
    <AuthGate>
      <LocationsContent />
    </AuthGate>
  );
}
