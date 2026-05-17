// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { DashboardContent } from '@/components/DashboardContent';

/**
 * Home — the authenticated dashboard.
 *
 * Server component that defers all interactive bits (auth gate, query
 * hooks) into the AuthGate client subtree. AuthGate picks between the
 * LoginScreen and the AppShell wrapper; once inside AppShell the
 * DashboardContent renders the stats grid + quick nav.
 */
export default function HomePage(): JSX.Element {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
