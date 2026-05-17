// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { ComingSoonContent } from '@/components/ComingSoonContent';

/**
 * /users — placeholder until the users admin UI ships.
 *
 * Backend is ready (slice #3 K10): GET /v1/users, GET /:id, PATCH
 * /:id with role + isActive editing and a last-active-admin guardrail.
 * The UI just needs the list page + edit modal — defensive checks
 * for self-demotion and the last-admin case are server-side and only
 * need to render a clean toast on 400.
 */
export default function UsersPage(): JSX.Element {
  return (
    <AuthGate>
      <ComingSoonContent
        title="Používatelia"
        description="Správa používateľov tenanta — roly, aktívnosť a oprávnenia."
        preview={[
          'Zoznam používateľov s filtrami podľa role a aktívnosti',
          'Povyšovanie a degradovanie rolí (EMPLOYEE / ASSET_MANAGER / ADMIN)',
          'Deaktivovanie účtov bez straty histórie',
          'Ochrana proti odobratiu poslednej aktívnej ADMIN role v tenante',
          'Audit log všetkých zmien rolí a aktívnosti',
        ]}
      />
    </AuthGate>
  );
}
