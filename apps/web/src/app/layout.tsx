// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { JSX, ReactNode } from 'react';

/**
 * Root metadata for the Inventario web app.
 *
 * Tenants will eventually override displayName, ogImage, and theme color
 * at runtime via the brand-kit endpoint, but the static defaults here are
 * the canonical Inventario branding (used pre-login and on the default
 * tenant `inventario`).
 */
export const metadata: Metadata = {
  title: {
    default: 'Inventario',
    template: '%s · Inventario',
  },
  description:
    'Transparentná správa majetku pre športové zväzy, mestá, kluby a školy. Bez vendor lock-in.',
  applicationName: 'Inventario',
  authors: [{ name: 'Ján Letko / LTK Solutions' }],
  generator: 'Next.js',
  referrer: 'strict-origin-when-cross-origin',
  robots: {
    // The authenticated app should not be indexed — public marketing lives
    // on inventario.sportup.sk; this is the gated product surface.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  // Brand primary (Navy #1A2D47) — used by mobile browsers for the URL bar
  // tint. Matches the Inventario default tenant; per-tenant theme color
  // is injected client-side once the tenant resolves.
  themeColor: '#1A2D47',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="sk">
      <body>
        {/*
          Skip link — first focusable element, jumps past nav for keyboard
          users. WCAG 2.4.1 Bypass Blocks. Same pattern as marketing site
          (Phase E1 added it there).
        */}
        <a href="#main" className="skip-link">
          Preskočiť na hlavný obsah
        </a>
        {children}
      </body>
    </html>
  );
}
