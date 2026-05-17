// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { Boxes, FileText, ShieldCheck } from 'lucide-react';

import type { JSX, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Bootstrap landing page for apps/web.
 *
 * This is intentionally minimal — it proves the design-token pipeline is
 * wired end-to-end (Tailwind utilities → CSS vars → tokens.css) and acts
 * as a smoke test for the K1 bootstrap commit. The real dashboard lands
 * in Slice #4 K4 with auth gating, tenant routing, and real data.
 *
 * Layout: a centered hero with three feature pills below, all using
 * design-token utilities (bg-surface-card, text-text-primary, etc.) so
 * a tenant switching their brand kit will see the page re-color
 * automatically without any code change here.
 */
export default function HomePage(): JSX.Element {
  return (
    <main id="main" className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent">
            Slice #4 · K1 bootstrap
          </p>
          <h1 className="mt-4 text-4xl font-bold text-text-primary sm:text-5xl">Inventario</h1>
          <p className="mt-4 text-lg text-text-secondary">
            Transparentná správa majetku.{' '}
            <span lang="en" className="whitespace-nowrap">
              Bez vendor lock-in.
            </span>
          </p>
        </header>

        <section
          aria-labelledby="stack-heading"
          className="mt-12 rounded-xl border border-border-subtle bg-surface-card p-6 shadow-md sm:p-8"
        >
          <h2 id="stack-heading" className="text-xl font-semibold text-text-primary">
            Frontend pripravený
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Next.js 15, Tailwind, design tokens a accessibility-first nástroje sú nastavené. Auth,
            API klient a P0 obrazovky pribudnú v ďalších krokoch Slice #4.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            <Pill icon={<Boxes aria-hidden="true" className="h-5 w-5" />} label="Design tokens" />
            <Pill
              icon={<FileText aria-hidden="true" className="h-5 w-5" />}
              label="OpenAPI klient"
            />
            <Pill
              icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
              label="WCAG 2.1 AA"
            />
          </ul>
        </section>
      </div>
    </main>
  );
}

function Pill({ icon, label }: { icon: ReactNode; label: string }): JSX.Element {
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border-subtle',
        'bg-surface-subtle px-4 py-3 text-sm font-medium text-text-primary',
      )}
    >
      <span className="text-brand-primary">{icon}</span>
      {label}
    </li>
  );
}
