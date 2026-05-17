// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { Sparkles } from 'lucide-react';

import type { JSX } from 'react';

/**
 * Placeholder content rendered inside the AppShell for sidebar
 * entries whose backend modules / UI pages are not yet implemented.
 *
 * Why this exists:
 *   The sidebar lists every primary navigation entry (Dashboard,
 *   Majetok, Výpožičky, Kategórie, Lokality, Používatelia). Hitting
 *   a 404 when clicking one of them breaks the feeling that the app
 *   is a coherent product tour and surfaces an implementation
 *   detail (slice ordering) to the user.
 *
 *   A friendly "modul čoskoro" placeholder keeps the user inside the
 *   authenticated shell (sidebar visible, header consistent) and
 *   sets the expectation that the feature is planned, not missing.
 *
 * Used by `/loans`, `/categories`, `/locations`, `/users` until each
 * gets its own real list page. When that happens, the placeholder
 * route file is replaced — the component itself stays for any future
 * "modul čoskoro" needs.
 *
 * Wrapping pattern (same as DashboardContent / AssetsListContent):
 *   The route file mounts <AuthGate><ComingSoonContent ... /></AuthGate>;
 *   AuthGate provides the AppShell + sidebar. This component renders
 *   only the page body that lives inside AppShell's <main>.
 *
 * Accessibility:
 *   - H1 is the page title (matches the heading-order convention
 *     elsewhere in the app — AppShell does NOT emit its own H1).
 *   - The Sparkles icon is decorative; the textual message
 *     communicates the state to assistive tech, so the icon is
 *     `aria-hidden`.
 *   - The bullet markers in the preview list are also decorative;
 *     the surrounding <ul> already conveys the list semantics.
 */
interface ComingSoonContentProps {
  /** Page title — also used as the H1. */
  title: string;
  /** Short one-line description of what the module will do once live. */
  description: string;
  /** Optional bulleted preview of capabilities the module will offer. */
  preview?: readonly string[];
}

export function ComingSoonContent({
  title,
  description,
  preview,
}: ComingSoonContentProps): JSX.Element {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </header>

      <section
        aria-labelledby="coming-soon-heading"
        className="rounded-xl border border-dashed border-border-default bg-surface-card p-8 text-center sm:p-12"
      >
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary"
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 id="coming-soon-heading" className="mt-4 text-lg font-semibold text-text-primary">
          Modul čoskoro
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          Tento modul je v príprave. Pracujeme na ňom v ďalšej iterácii frontend slice-u.
        </p>

        {preview && preview.length > 0 ? (
          <div className="mx-auto mt-6 max-w-md text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Čo bude obsahovať
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
              {preview.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-primary"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
