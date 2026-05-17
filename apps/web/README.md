<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# @inventario/web

> Frontend webová aplikácia pre Inventario.
> Stack: Next.js 15 · React 19 · TanStack Query · Tailwind · shadcn/ui-style komponenty · `@inventario/design-tokens`.

---

## Status

**Slice #4 K1 — Bootstrap** ✅
Príde postupne: K2 OpenAPI klient + auth, K3-K8 P0 stránky, K9 polish + Vercel deploy.

## Lokálny dev

```bash
# z repo root-u (jediný spôsob s pnpm workspace deps)
pnpm install
pnpm --filter @inventario/web dev
```

Štartuje na `http://localhost:3001`. Apps/api dev server beží na `:3000`, takže žiadny konflikt portov.

## Skripty

| Script           | Čo robí                               |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Next.js dev server (port 3001)        |
| `pnpm build`     | Production build                      |
| `pnpm start`     | Spustí production build (port 3001)   |
| `pnpm lint`      | ESLint + jsx-a11y, fail na warning    |
| `pnpm typecheck` | TypeScript bez emitu                  |
| `pnpm clean`     | Vymaže `.next`, `.turbo`, tsbuildinfo |

## Štruktúra

```
apps/web/
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx      # Root layout, skip-link, html lang
│   │   ├── page.tsx        # Landing / dashboard placeholder
│   │   └── globals.css     # Tailwind + design tokens import
│   └── lib/
│       └── cn.ts           # clsx + tailwind-merge helper
├── public/                 # Static assets (favicon, brand)
├── package.json
├── tsconfig.json           # extends ../../tsconfig.base.json
├── next.config.mjs
├── tailwind.config.js      # imports @inventario/design-tokens/tailwind
├── postcss.config.js
├── eslint.config.js        # flat config + jsx-a11y errors
└── vercel.json
```

## Design tokens

Apps/web vôbec nemá vlastné brand farby — všetko prichádza z `@inventario/design-tokens` cez Tailwind preset. Komponent píše `bg-brand-primary`, `text-text-primary`, atď. Tieto utility mapujú na `var(--inv-...)` CSS custom properties, ktoré sa per-tenant override-ujú v `:root[data-tenant="..."]`. Žiadny `style={{ color: ... }}` v komponentoch.

## Accessibility

`eslint-plugin-jsx-a11y` beží v error mode už pri PR — accessibility regressions sú gated rovnako ako type errors. CI workflow doplníme v K2 (`@axe-core/cli` proti deployed preview URL).

## License

EUPL-1.2 (zdrojový kód). README ako dokumentácia pod CC-BY-4.0.
