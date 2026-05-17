// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { ComingSoonContent } from '@/components/ComingSoonContent';

/**
 * /locations — placeholder until the locations admin UI ships.
 *
 * Backend mirrors categories (slice #3 K1-K9): full CRUD with FK
 * protection against assets that reference the location. The UI
 * pattern will mirror /categories as well — same list+edit+delete
 * surface, different domain model (LocationType vs AssetType).
 */
export default function LocationsPage(): JSX.Element {
  return (
    <AuthGate>
      <ComingSoonContent
        title="Lokality"
        description="Fyzické umiestnenia, kde sa majetok nachádza — sklady, kancelárie, šatne."
        preview={[
          'Zoznam lokalít s typom (sklad, kancelária, šatňa, sklad výstroje, ...)',
          'Vytváranie a úpravy lokalít pre správcov majetku',
          'Ochrana proti zmazaniu, ak v lokalite leží aspoň jeden kus majetku',
          'Per-tenant slug a možnosť deaktivácie bez zmazania',
        ]}
      />
    </AuthGate>
  );
}
