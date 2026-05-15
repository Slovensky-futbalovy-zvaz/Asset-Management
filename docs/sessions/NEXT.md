<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Inventario · Continuation plan

> **Living document** — vždy aktuálny stav projektu, najbližšie kroky, technical debt.
> Pri novej Claude session si prečítaj **najprv toto**, potom najnovší day-summary.

**Aktualizované**: 2026-05-16 (skoro polnoc, koniec maratón session)

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
│   ├── api/                         → backend Fastify (production-ready, 257 tests)
│   ├── docs/                        → Nextra docs site
│   │   └── content/                 → 7 MDX stránok
│   ├── mcp-server/                  → MCP for AI (future)
│   └── web/                         → frontend (slice #4, neexistuje)
├── packages/
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

Vyber jednu z týchto **alebo iné podľa toho čo dňom prichytí**:

### 🅰️ Backend Slice #3 K10 — Users admin module (~3 hod)

**Najlogickejší ďalší krok pre backend completeness.**

- **Súbor**: `apps/api/src/modules/users/`
- **Endpoints**:
  - `GET /v1/users` (ADMIN only, paginate)
  - `GET /v1/users/:id` (ADMIN only)
  - `PATCH /v1/users/:id` — role + isActive (ADMIN only)
- **Edge cases**:
  - Admin nemôže deaktivovať seba
  - Posledný ADMIN nesmie byť odstránený / deaktivovaný
  - `USER_ROLE_CHANGED` audit log entry
- **Tests**: ~30-40 nových (cieľ ~290-300 total)
- **Po K10**: K11 = milestone doc `docs/milestones/slice-3-categories-locations-users.md`

### 🅱️ Backend Slice #4 — Frontend (apps/web) — multi-day projekt

**Veľký krok — frontend aplikácia ktorú zatiaľ máme len ako mockupy.**

- Stack: Next.js 15 + TanStack Query + shadcn/ui + Tailwind
- 6 P0 stránok podľa mockupov v `docs/design/screens/`
- Microsoft Entra ID SSO login flow
- API integration s `apps/api`
- WCAG 2.1 AA accessibility v plánoch
- Sub-tasks: bootstrap → auth → assets list → asset detail → loan workflow → polish

### 🅲 Phase B — Design tokens refactor (~1-2 hod)

**Reorganizácia design systému z `docs/design/`.**

- Primitives → Semantic → Brand layers
- Dark mode tokens
- Export pipeline:
  - CSS custom properties (`tokens.css`)
  - Tailwind config (`tailwind.config.ts`)
  - Flutter theme (`tokens.dart`) pre future mobile
- Brand kit JSON pre tenant customization API

### 🅳 OrganisationId migration — multi-tenant data isolation (~2 hod)

**Per ADR-0010, treba pridať tenant scoping do všetkých collections.**

- Pridať `organisationId: ObjectId` field do: `users`, `assets`, `categories`, `locations`, `loans`, `audit_logs`
- Update všetky repositories aby filtrovali by `organisationId`
- Migration script existing data → default tenant
- Update auth middleware → extract `organisationId` z JWT claim
- Update tests (~40 zmenených)

### 🅴 EU compliance roadmap items

Voľne pickable:

- **SBOM CycloneDX export** v CI (~30 min) — pre EU verejné súťaže
- **OpenAPI 3.1 export** z Zod schém → `apps/api/openapi.json` (~1 hod)
- **WCAG 2.1 AA audit** marketing site (~30 min) — Lighthouse + axe
- **GDPR Article 30 audit log hardening** (~1-2 hod)

---

## 🐛 Technical debt

Trackované pre eventuálnu cleanup session:

- **`audit.test.ts`** flaky timeout — beží občas 30s+ na Atlas. Treba zvýšiť timeout alebo singleFork
- **`LOCATION_TYPE_VALUES`** export do `packages/shared-types/` (currently duplicated)
- **`UpdateCategorySchema`** + **`UpdateLocationSchema`** → presunúť do `packages/shared-types/`
- **Marketing footer link** `../decisions/0010-multi-tenant-white-label.md` — broken na production (decisions sa nedeployujú do marketing bundli)
- **`apps/docs/vercel.json`** — momentálne len headers, buildCommand riešené UI override (cleaner to mať v `vercel.json` raz keď zistíme správny pattern pre monorepo)

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

| Téma                          | Súbor                                               |
| ----------------------------- | --------------------------------------------------- |
| Multi-tenant architecture     | `docs/decisions/0010-multi-tenant-white-label.md`   |
| Brand identity                | `BRAND.md` (root)                                   |
| Roadmap                       | `ROADMAP.md` (root)                                 |
| Pricing strategy              | `docs/sessions/2026-05-15-pricing-strategy.md`      |
| Design pivot history          | `docs/sessions/2026-05-15-design-pivot.md`          |
| Yesterday's progress          | `docs/sessions/2026-05-16-day-summary.md` ← **NEW** |
| Vercel docs deploy guide      | `infra/vercel/DOCS-DEPLOYMENT.md`                   |
| All Vercel projects           | `infra/vercel/README.md`                            |
| Backend slice completion logs | `docs/milestones/`                                  |
