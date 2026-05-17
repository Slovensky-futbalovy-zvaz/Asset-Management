// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import type { JSX } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { ComingSoonContent } from '@/components/ComingSoonContent';

/**
 * /loans — placeholder until the loans module ships.
 *
 * The loans module is cross-cutting: it touches assets (status flips
 * to BORROWED + currentLoanId), users (borrower), audit log, and
 * notifications. Scheduled for slice #5 — until then this page keeps
 * the sidebar entry alive without breaking the product tour.
 */
export default function LoansPage(): JSX.Element {
  return (
    <AuthGate>
      <ComingSoonContent
        title="Výpožičky"
        description="Evidencia zápožičiek majetku — kto má čo, dokedy, a kto schvaľuje."
        preview={[
          'Žiadosť o výpožičku s automatickou kontrolou dostupnosti',
          'Schvaľovací workflow podľa kategórie a politiky tenanta',
          'Aktívne výpožičky s upozorneniami pred koncom termínu',
          'História výpožičiek s preberacími a odovzdávacími protokolmi',
          'Self-service vrátenie cez QR kód',
        ]}
      />
    </AuthGate>
  );
}
