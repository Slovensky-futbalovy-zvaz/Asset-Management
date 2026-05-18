// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { UsersContent } from '@/components/UsersContent';

/**
 * /users — admin panel for managing users in the current tenant.
 *
 * Server component that defers everything interactive to AuthGate +
 * UsersContent. UsersContent itself gates non-ADMIN viewers behind
 * an AccessDenied state (rather than the page-level component
 * hiding the route entirely) so users with the wrong role land on
 * a clear message instead of an unexplained 404.
 *
 * RBAC:
 *   - GET /v1/users      ADMIN only
 *   - PATCH /v1/users/:id ADMIN only
 *
 * The backend additionally enforces guardrails on PATCH:
 *   - self-demote (can't strip your own ADMIN role)
 *   - self-deactivate
 *   - last-active-admin (can't demote / deactivate the last ADMIN)
 *
 * Both pre-emptive UI guards (for self) and the verbatim backend
 * message (for last-admin) live in UserEditDialog.
 */
export default function UsersPage(): JSX.Element {
  return (
    <AuthGate>
      <UsersContent />
    </AuthGate>
  );
}
