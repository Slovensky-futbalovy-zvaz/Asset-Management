// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { useAccount, useMsal } from '@azure/msal-react';
import { Boxes, ClipboardList, Home, Layers, MapPin, Tags, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogoutButton } from './LogoutButton';

import type { JSX, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Authenticated app shell — header with branding, user menu, and a
 * sidebar with primary navigation. Wraps the page content (`children`).
 *
 * Rendered ONLY for authenticated users — the page-level component
 * decides whether to render this or the LoginScreen.
 *
 * Layout:
 *
 *   ┌─ Header ────────────────────────────────────────────────┐
 *   │ [logo] Inventario          [user name] [logout]         │
 *   ├──────┬──────────────────────────────────────────────────┤
 *   │ Side │                                                  │
 *   │ bar  │  <main id="main">  page content                  │
 *   │      │                                                  │
 *   └──────┴──────────────────────────────────────────────────┘
 *
 * Sidebar is collapsible on mobile (hamburger pattern) but for K2
 * bootstrap we keep it always visible — mobile responsive lands in K9.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/assets', label: 'Majetok', icon: Boxes },
  { href: '/loans', label: 'Výpožičky', icon: ClipboardList },
  { href: '/categories', label: 'Kategórie', icon: Tags },
  { href: '/locations', label: 'Lokality', icon: MapPin },
  { href: '/users', label: 'Používatelia', icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { accounts } = useMsal();
  const account = useAccount(accounts[0]);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-page">
      <Header userName={account?.name ?? account?.username ?? 'Používateľ'} />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar pathname={pathname} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function Header({ userName }: { userName: string }): JSX.Element {
  return (
    <header className="border-b border-border-subtle bg-surface-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-brand-primary transition hover:opacity-80"
        >
          <Layers aria-hidden="true" className="h-6 w-6" />
          Inventario
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-text-secondary sm:inline">{userName}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

function Sidebar({ pathname }: { pathname: string }): JSX.Element {
  return (
    <nav aria-label="Hlavná navigácia" className="hidden w-56 shrink-0 md:block">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-primary text-brand-primary-fg'
                    : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
