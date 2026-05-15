<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# `apps/docs` — Inventario dokumentačný web

**Production URL**: [docs.inventario.sportup.sk](https://docs.inventario.sportup.sk)

Tento priečinok obsahuje **dokumentačný web** projektu Inventario, postavený na **Nextra v4** a **Next.js 16**.

## 🚀 Lokálny development

```bash
# Z root repa:
pnpm --filter @sfz/docs dev

# Alebo cd-čko:
cd apps/docs
pnpm dev
```

Dev server bude na `http://localhost:3000` (alebo 3001 ak API beží na 3000).

## 🏗️ Build

```bash
pnpm --filter @sfz/docs build
```

Build zahŕňa:

1. `next build` — Next.js production build
2. `pagefind` — generovanie full-text search indexu

## 📂 Štruktúra

```
apps/docs/
├── app/                      Next.js App Router
│   ├── layout.tsx            Root layout s Nextra Layout + Navbar + Footer
│   ├── [[...mdxPath]]/       Catch-all route pre MDX content
│   │   └── page.tsx
│   └── globals.css           Inventario brand override Nextra theme
├── content/                  MDX content (mapuje sa na URL)
│   ├── index.mdx             → /  (Welcome)
│   ├── getting-started.mdx   → /getting-started
│   ├── architecture.mdx      → /architecture
│   ├── api.mdx               → /api
│   ├── deployment.mdx        → /deployment
│   ├── about.mdx             → /about
│   └── _meta.ts              Sidebar nav konfigurácia
├── public/
│   └── favicon.svg
├── mdx-components.tsx        Custom MDX komponenty (override Nextra defaults)
├── next.config.mjs           Next + Nextra config
├── tsconfig.json
└── package.json
```

## 🎨 Brand identity

Web používa **Inventario brand identitu** zdielanú so [`docs/marketing-site/`](../../docs/marketing-site):

- **Farby**: Navy `#1a2d47`, Blue `#388fc3`, Paper `#f8f6f1`, Muted `#6b7a8d`
- **Font**: Poppins (sans), JetBrains Mono (code)
- **Logo**: 3 vrstvené čiary + accent dot (zdielaný SVG s marketing webom)

Override Nextra theme cez `app/globals.css` (`--nextra-primary-hue`, atď.).

## 🔍 Search

Inventario docs používa **Pagefind** — Rust-powered static search engine. Index sa generuje pri build cez `postbuild` script. Search funguje **offline** (žiadne API calls), je rýchly a má **zero vendor lock-in**.

## ✏️ Pridávanie nového obsahu

1. Vytvor nový `.mdx` súbor v `content/`
2. Pridaj ho do `content/_meta.ts` pre sidebar nav
3. Pridaj **frontmatter** s `title` a `description`:

```mdx
---
title: Moja nová stránka
description: Krátky popis pre SEO a OG.
---

# Moja nová stránka

Obsah tu...
```

4. Otestuj lokálne (`pnpm dev`)
5. Commit + push → Vercel automaticky redeployne

## 🌍 i18n (multi-language)

Aktuálne **iba slovensky**. Anglická verzia v plánovaní pre Q4 2026.

Postup pridania EN:

1. Vytvor `content/en/` priečinok
2. Skopíruj všetky `.mdx` súbory
3. Prelož ich
4. Aktualizuj `app/layout.tsx` s i18n routing

Detaily v [Nextra i18n docs](https://nextra.site/docs/features/i18n).

## 📦 Dependencies

- **Nextra**: 4.6.0 (downgrade z 4.6.1 kvôli kompatibilite — viď níssie)
- **Next.js**: ~15.5 (Next 16 má známy issue s Nextra v4 — [issue #4830](https://github.com/shuding/nextra/issues/4830))
- **React**: 19.x
- **Pagefind**: 1.x (dev dependency, len pre build)

### Prečo nie Next.js 16?

Nextra v4.6.x oficiálne podporuje Next.js 15.x. S Next 16 sa zlomilo viacero things:

- `Invalid input` Zod validation error pri page render (Next 16.1 + Nextra 4.6.1)
- `createContext only works in Client Components` ([issue #4830](https://github.com/shuding/nextra/issues/4830))
- `next-mdx-import-source-file` module not found pri Turbopack (Next 16.2 + Nextra 4.6.1)

Nextra core team plánuje fix v **Nextra v5** (Q3 2026). Do tej doby ostávame na Next 15.5 + Nextra 4.6.0.

## 🚢 Deploy

Druhý Vercel projekt v rovnakom repe (popri `inventario-marketing` a `asset-management-api`):

- **Vercel Project**: `inventario-docs`
- **Root Directory**: `apps/docs`
- **Framework**: Next.js (auto-detect)
- **Build Command**: `pnpm build` (z monorepo root, Vercel to vyrieši cez Turbo)
- **Output Directory**: `.next`
- **Production URL**: `docs.inventario.sportup.sk` (CNAME na Websupport DNS)

Detaily v [infra/vercel/DEPLOYMENT.md](../../infra/vercel/DEPLOYMENT.md).

## 🧪 Testovanie

Nextra je predominantne **content-driven**, takže nemáme unit testy. Pre regression testing používame:

- **TypeScript strict mode** — chytí MDX import errors
- **next build** — chytí broken links pri SSG (každý `<a href="...">` musí existovať)
- **Pagefind build** — chytí broken anchors v search indexe

## 📚 Resources

- [Nextra docs](https://nextra.site/docs)
- [Next.js App Router docs](https://nextjs.org/docs/app)
- [Pagefind docs](https://pagefind.app)
