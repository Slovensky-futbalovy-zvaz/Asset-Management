// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AssetsListContent } from '@/components/AssetsListContent';
import { AuthGate } from '@/components/AuthGate';

/**
 * /assets — list of all assets visible to the current user.
 *
 * Server component that defers everything interactive to AuthGate +
 * AssetsListContent (both 'use client'). The page itself only exists
 * to register the route and wrap the client tree in the auth gate.
 *
 * Same shape as the dashboard page (`/`): pre-login users hit the
 * LoginScreen automatically, authenticated users get AppShell with
 * the list rendered inside.
 */
export default function AssetsPage(): JSX.Element {
  return (
    <AuthGate>
      <AssetsListContent />
    </AuthGate>
  );
}
