// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { Layers, ShieldCheck, Sparkles, Zap } from 'lucide-react';

import { LoginButton } from './LoginButton';

import type { JSX, ReactNode } from 'react';

/**
 * Pre-login landing screen. Shown when the user has no MSAL account
 * yet. The login button kicks off the redirect flow; once back, the
 * page re-renders and `<AppShell>` takes over.
 *
 * Tone: short, factual, branded. No marketing copy — that's what
 * inventario.sportup.sk is for. Here we just say "click to log in"
 * and remind users what kind of platform this is.
 */
export function LoginScreen(): JSX.Element {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border-subtle bg-surface-card p-8 shadow-md sm:p-10">
          <div className="mb-6 flex items-center gap-3 text-brand-primary">
            <Layers aria-hidden="true" className="h-9 w-9" />
            <span className="text-2xl font-bold">Inventario</span>
          </div>

          <h1 className="text-xl font-semibold text-text-primary">Vitajte späť</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Prihláste sa cez svoje firemné Microsoft konto, aby ste sa dostali k majetku vašej
            organizácie.
          </p>

          <div className="mt-6">
            <LoginButton />
          </div>

          <ul className="mt-8 space-y-3 border-t border-border-subtle pt-6">
            <Feature
              icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
              text="Single sign-on cez Microsoft Entra ID"
            />
            <Feature
              icon={<Zap aria-hidden="true" className="h-4 w-4" />}
              text="Žiadne ďalšie heslá na zapamätanie"
            />
            <Feature
              icon={<Sparkles aria-hidden="true" className="h-4 w-4" />}
              text="Inventár pripravený do pár sekúnd"
            />
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Problémy s prihlásením? Kontaktujte svojho IT správcu.
        </p>
      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: ReactNode; text: string }): JSX.Element {
  return (
    <li className="flex items-center gap-3 text-sm text-text-secondary">
      <span className="text-brand-accent">{icon}</span>
      {text}
    </li>
  );
}
