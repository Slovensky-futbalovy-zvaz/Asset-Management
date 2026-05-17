// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { CategoriesContent } from '@/components/CategoriesContent';

/**
 * /categories — admin list page for category taxonomy.
 *
 * Server component that defers everything interactive to AuthGate +
 * CategoriesContent. Same shape as /assets and /:
 *   pre-login → LoginScreen
 *   authenticated → AppShell with the categories list
 *
 * RBAC:
 *   - GET (list) — all authenticated roles
 *   - POST (create) — ASSET_MANAGER + ADMIN
 *   - DELETE — ADMIN only
 *
 * The UI gates the create button via `useCanManageTaxonomy()` and
 * the delete buttons via `useCanDeleteTaxonomy()`.
 */
export default function CategoriesPage(): JSX.Element {
  return (
    <AuthGate>
      <CategoriesContent />
    </AuthGate>
  );
}
