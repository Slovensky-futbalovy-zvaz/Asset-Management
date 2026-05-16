<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Inventario · Continuation plan

> **Living document** — vždy aktuálny stav projektu, najbližšie kroky, technical debt.
> Pri novej Claude session si prečítaj **najprv toto**, potom najnovší day-summary.

**Aktualizované**: 2026-05-16 (po dokončení Phase B — design tokens refactor)

---

## 🎯 Stratégia: B → C → D → E → A

Frontend (Slice #4) je posledný **zámerne**, aby sa minimalizovali prerábky. Logika:

- 🅱 **Design tokens** → definovať vizuálny jazyk **pred** tým, než ho frontend začne používať ✅ **DONE**
- 🅲 **OrganisationId migration** → stabilný API contract s tenant scoping **pred** frontend integráciou
- 🅳 **EU compliance** (OpenAPI export, SBOM, WCAG) → fundamenty pre type generation a verejný sektor
- 🅴 **Tech debt cleanup** → posledný refresh pred veľkým kusom
- 🅰 **Slice #4 frontend** → na zelenú lúku s čistým API, tokens, multi-tenancy in place

---

## 🌐 Production stav — všetko LIVE

| URL                                        | Stav       | Posledný update | Stack                            |
| ------------------------------------------ | ---------- | --------------- | -------------------------------- |
| **inventario.sportup.sk**                  | ✅ LIVE    | 2026-05-16      | Static HTML/CSS/JS (Vercel)      |
| **inventario.sportup.sk/interactive-demo** | ✅ LIVE    | 2026-05-16      | + 6 product mockups v iframe     |
| **docs.inventario.sportup.sk**             | ✅ LIVE    | 2026-05-16      | Nextra v4.6.0 + Next.js 15.5     |
| **api.inventario.sportup.sk**              | ⏳ Q3 2026 | Backend ready   | Fastify + MongoDB Atlas + Vercel |

**Tri Vercel projekty v `ltksolutions-projects` team**:

1. `inventario-marketing` → marketing site, Root: `docs/marketing-site`
2. `inventario-docs` → docs site, Root: `apps/docs`, custom build+install commands cez UI override
3. `asset-management-api` → existing, Root: `apps/api`

---

## 📦 Repo Architecture

```
Asset-Management/                    (root, pnpm monorepo, EUPL-1.2)
├── apps/
│   ├── api/                         → backend Fastify (production-ready, 310 tests)
│   ├── docs/                        → Nextra docs site
│   │   └── content/                 → 7 MDX stránok
│   ├── mcp-server/                  → MCP for AI (future)
│   └── web/                         → frontend (slice #4, neexistuje)
├── packages/
│   ├── design-tokens/               → @inventario/design-tokens (post-pivot v0.2.0)
│   │   ├── tokens.json              → W3C source of truth
│   │   ├── src/index.ts             → TypeScript exports
│   │   ├── src/tokens.css           → CSS vars (--inv-* prefix)
│   │   ├── src/tailwind-preset.js   → Tailwind preset
│   │   └── src/brand-kit.schema.json → per-tenant brand kit schema
│   └── shared-types/                → TypeScript types
├── docs/
│   ├── marketing-site/              → Static HTML marketing (LIVE)
│   │   ├── interactive-demo.html    → 6 mockup viewer s tenant/viewport switcherom
│   │   ├── product-screens/         → 6 self-contained mockup HTML súborov
│   │   └── assets/shared.js         → Nav + footer injected do každej stránky
│   ├── design/screens/              → Design exploration (originály mockupov)
│   ├── decisions/                   → ADRs (0001-0010)
│   ├── milestones/                  → Slice complete docs
│   └── sessions/                    → Session notes (toto)
├── infra/vercel/                    → Vercel deployment guides
└── scripts/
    └── copy-product-screens.sh      → Sync mockupy z design/ do marketing-site/
```

---

## ✅ Hotovo (history snapshot)

### Backend (Fastify + MongoDB)

- ✅ **Slice #1**: Bootstrap (Fastify + Mongo + TypeScript + pnpm)
- ✅ **Slice #2**: Microsoft Entra ID auth + JIT provisioning + JWKS
- ✅ **Slice #2b**: Assets CRUD + RBAC + audit + transactions (2026-05-13)
- ✅ **Slice #2c**: Tests + pre-commit + CI (100 testov, 2026-05-14)
- ✅ **Slice #3 K1-K9**: Categories + Locations + FK protection (2026-05-15, 257 testov, ~158s)
- ✅ **Slice #3 K10**: Users admin module — GET /v1/users, GET /:id, PATCH /:id (2026-05-16, +53 testov)
- ✅ **Slice #3 K11**: Milestone doc `slice-3-categories-locations-users.md` (2026-05-16, 310 testov total, ~168s)

### Design system

- ✅ **Phase B — Design tokens refactor** (2026-05-16) — `@inventario/design-tokens` v0.2.0
  - 3-vrstvová architektúra: Primitive → Semantic → Brand
  - Post-pivot Inventario brand (Navy/Blue/Paper/Steel + status colors)
  - CSS custom properties s `--inv-` prefix
  - Dark mode v1 (opt-in cez `data-theme="dark"`)
  - TypeScript exports s plnou type safety
  - Tailwind preset (`@inventario/design-tokens/tailwind`)
  - JSON schema pre per-tenant brand kit
  - Multi-tenant override pattern `:root[data-tenant='X']`

### Frontend marketing + demo

- ✅ Marketing site (6 stránok) LIVE na inventario.sportup.sk
- ✅ Interactive demo (6 obrazoviek, 4 tenanty, 3 viewporty, UX iterácia)
- ✅ Clean URLs (no `.html` suffixes, `/_home` bug fixed)
- ✅ Cache headers správne (5 min revalidate pre `shared.js/css`)
- ✅ Docs site Nextra deployed → `docs.inventario.sportup.sk`
- ✅ "Čoskoro" badge revertovaný — všetky docs linky active

### Compliance + brand

- ✅ EUPL-1.2 + CC-BY-4.0 + REUSE 3.3 (175/175 súborov)
- ✅ Brand identity (Navy/Blue/Paper/Poppins), zdieľaná so SportUp ekosystémom
- ✅ ADR-0010 multi-tenant white-label

---

## 🎯 Next session — výber tém

Podľa stratégie hore je ďalší krok 🅰 OrganisationId migration, ale berie sa ohľad aj na energiu a kontext dňom.

### 🅰️ OrganisationId migration — multi-tenant data isolation (~2 hod) ⬅ **PRÍŠTÍ KROK**

**Per ADR-0010, treba pridať tenant scoping do všetkých collections. Robíme to PRED frontend, aby UI nemuselo prerábať API calls neskôr.**

- Pridať `organisationId: ObjectId` field do: `users`, `assets`, `categories`, `locations`, `loans`, `audit_logs`
- Update všetky repositories aby filtrovali by `organisationId`
- Migration script existing data → default tenant
- Update auth middleware → extract `organisationId` z JWT claim
- Update tests (~40 zmenených z 310)
- ADR upgrade alebo nový ADR-0011 pre execution detaily

### 🅱️ EU compliance roadmap items

Voľne pickable. **OpenAPI 3.1 export je užitočný PRED frontend** (umožní auto-generate TypeScript klienta).

- **OpenAPI 3.1 export** z Zod schém → `apps/api/openapi.json` (~1 hod) — useful for Slice #4 type generation
- **SBOM CycloneDX export** v CI (~30 min) — pre EU verejné súťaže
- **WCAG 2.1 AA audit** marketing site (~30 min) — Lighthouse + axe
- **GDPR Article 30 audit log hardening** (~1-2 hod)

### 🅲 Tech debt cleanup session (~1-2 hod)

**Quick wins z technical debt sekcie nižšie. Dobrý "lite" deň ak nemáš
energiu na veľký feature work.**

- `categories.routes.ts isActive` fix (rovnaký pattern ako K10) — ~15 min
- Export `LOCATION_TYPE_VALUES`, `UpdateCategorySchema`, `UpdateLocationSchema` do shared-types — ~30 min
- `audit.test.ts` flaky timeout investigation — ~30-60 min
- Marketing footer link cleanup — ~10 min
- Root `package.json` cleanup — stále "SFZ Asset Management", author "Slovenský futbalový zväz", MIT license (apps/docs už EUPL-1.2). Mismatch s pivotom.

### 🅳 Slice #4 — Frontend (apps/web) — multi-day projekt 🏁 **FINÁLNY KROK**

**Veľký krok — frontend aplikácia ktorú zatiaľ máme len ako mockupy. Backend je
production-ready a čaká na konzumenta. Robíme posledný — design tokens, tenant scoping
aj OpenAPI export už budú hotové.**

- Stack: Next.js 15 + TanStack Query + shadcn/ui + Tailwind
- Tailwind preset z `@inventario/design-tokens/tailwind` (ready ✅)
- 6 P0 stránok podľa mockupov v `docs/design/screens/`
- Microsoft Entra ID SSO login flow
- API integration s `apps/api` (cez auto-generated TS klient z OpenAPI)
- Multi-tenant data-tenant root attribute (ready ✅)
- WCAG 2.1 AA accessibility v plánoch
- Sub-tasks: bootstrap → auth → assets list → asset detail → loan workflow → polish

---

## 🐛 Technical debt

Trackované pre eventuálnu cleanup session:

- **`audit.test.ts`** flaky timeout — beží občas 30s+ na Atlas. Treba zvýšiť timeout alebo singleFork
- **`LOCATION_TYPE_VALUES`** export do `packages/shared-types/` (currently duplicated)
- **`UpdateCategorySchema`** + **`UpdateLocationSchema`** → presunúť do `packages/shared-types/`
- **`categories.routes.ts isActive` query param** — rovnaký `z.coerce.boolean()` bug ako bol v K10 users (string `"false"` interpretovaný ako `true`). Fix: replace s `z.enum(['true','false','1','0']).transform(...)` pattern
- **Marketing footer link** `../decisions/0010-multi-tenant-white-label.md` — broken na production (decisions sa nedeployujú do marketing bundli)
- **`apps/docs/vercel.json`** — momentálne len headers, buildCommand riešené UI override (cleaner to mať v `vercel.json` raz keď zistíme správny pattern pre monorepo)
- **Root `package.json`** post-pivot cleanup — name `sfz-asset-management`, author `Slovenský futbalový zväz`, license `MIT`, repository `jletko/Asset-Management` (správne má byť `Slovensky-futbalovy-zvaz/Asset-Management`). Mismatch s `apps/docs` ktoré už má EUPL-1.2 a Inventario brand
- **Marketing-site `shared.css`** & **`docs/design/screens/`** — používajú inline `--brand-*` CSS vars namiesto `@inventario/design-tokens/tokens.css`. Cleanup migration ich premostí na nový package (žiadny breaking change, len konsolidácia source of truth)

---

## 🔮 Future ideas (long-term)

- **Onboarding wizard** s info iconmi linkujúcimi na docs
- **In-app chatbot** nad docs + MCP server (Claude Code style)
- **Public GitHub repo** (preklopiť z private)
- **Annual contract paperwork** pre verejný sektor (DOCX template + e-podpis)
- **Pilot tenant onboarding** — Mesto Pezinok? Stredná škola Kremnica? ŠK Inter?
- **Founding customer rabat** -25% prvý rok výmenou za case study súhlas

---

## 📚 Kde nájsť konkrétne info

| Téma                          | Súbor                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Multi-tenant architecture     | `docs/decisions/0010-multi-tenant-white-label.md`       |
| Brand identity                | `BRAND.md` (root)                                       |
| Design tokens package         | `packages/design-tokens/README.md` ← **NEW**            |
| Roadmap                       | `ROADMAP.md` (root)                                     |
| Pricing strategy              | `docs/sessions/2026-05-15-pricing-strategy.md`          |
| Design pivot history          | `docs/sessions/2026-05-15-design-pivot.md`              |
| Yesterday's progress          | `docs/sessions/2026-05-16-day-summary.md`               |
| Vercel docs deploy guide      | `infra/vercel/DOCS-DEPLOYMENT.md`                       |
| All Vercel projects           | `infra/vercel/README.md`                                |
| Backend slice completion logs | `docs/milestones/`                                      |
| Latest milestone (Slice #3)   | `docs/milestones/slice-3-categories-locations-users.md` |
