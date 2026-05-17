// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { Boxes, ClipboardList, MapPin, Tags } from 'lucide-react';
import Link from 'next/link';

import type { JSX, ReactNode } from 'react';

import { AuthGate } from '@/components/AuthGate';

/**
 * Dashboard landing page. Server component that defers all interactive
 * bits (auth gate, query hooks) into the AuthGate client subtree.
 *
 * The placeholder shown here lists the four primary surfaces (assets,
 * loans, categories, locations) as navigation cards. K4 swaps this
 * for real stats from the backend — counts, recent activity, open
 * loan requests requiring approval, etc.
 */
export default function HomePage(): JSX.Element {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent(): JSX.Element {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Prehľad</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Vitajte v Inventariu. Tu pribudnú štatistiky organizácie v ďalšom kroku.
        </p>
      </header>

      <section
        aria-labelledby="quick-nav-heading"
        className="rounded-xl border border-border-subtle bg-surface-card p-6 shadow-md"
      >
        <h2 id="quick-nav-heading" className="text-lg font-semibold text-text-primary">
          Rýchla navigácia
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <NavCard
            href="/assets"
            icon={<Boxes aria-hidden="true" className="h-5 w-5" />}
            title="Majetok"
            description="Evidencia, hľadanie a editácia položiek."
          />
          <NavCard
            href="/loans"
            icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />}
            title="Výpožičky"
            description="Aktuálne výpožičky a žiadosti o vypožičanie."
          />
          <NavCard
            href="/categories"
            icon={<Tags aria-hidden="true" className="h-5 w-5" />}
            title="Kategórie"
            description="Hierarchická taxonómia majetku."
          />
          <NavCard
            href="/locations"
            icon={<MapPin aria-hidden="true" className="h-5 w-5" />}
            title="Lokality"
            description="Fyzické miesta, kde sa majetok nachádza."
          />
        </ul>
      </section>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-2 rounded-lg border border-border-subtle bg-surface-subtle p-4 transition hover:border-border-default hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
      >
        <span className="flex items-center gap-2 text-brand-primary">
          {icon}
          <span className="text-base font-semibold text-text-primary">{title}</span>
        </span>
        <span className="text-sm text-text-secondary">{description}</span>
      </Link>
    </li>
  );
}
