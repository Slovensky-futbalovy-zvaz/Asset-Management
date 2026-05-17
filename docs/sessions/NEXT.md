<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Inventario · Continuation plan

> **Living document** — vždy aktuálny stav projektu, najbližšie kroky, technical debt.
> Pri novej Claude session si prečítaj **najprv toto**, potom najnovší day-summary.

**Aktualizované**: 2026-05-17 (po Slice #4 launch — auth shell + dashboard + `/assets` list page + CI fix pre gitignored api-types)

---

## 🎯 Stratégia: B → C → D → E → A

Frontend (Slice #4) je posledný **zámerne**, aby sa minimalizovali prerábky. Logika:

- 🅱 **Design tokens** → definovať vizuálny jazyk **pred** tým, než ho frontend začne používať ✅ **DONE**
- 🅲 **OrganisationId migration** → stabilný API contract s tenant scoping **pred** frontend integráciou ✅ **DONE**
- 🅳 **EU compliance** (OpenAPI export, SBOM, WCAG, GDPR) → fundamenty pre type generation a verejný sektor ✅ **DONE**
- 🅴 **Tech debt cleanup** → posledný refresh pred veľkým kusom ✅ **DONE**
- 🅰 **Slice #4 frontend** → na zelenú lúku s čistým API, tokens, multi-tenancy in place ⬅ **IN PROGRESS** (bootstrap + auth + dashboard + assets list done)

---

## 🌐 Production stav — všetko LIVE

| URL                                        | Stav       | Posledný update | Stack                            |
| ------------------------------------------ | ---------- | --------------- | -------------------------------- |
| **inventario.sportup.sk**                  | ✅ LIVE    | 2026-05-17      | Static HTML/CSS/JS (Vercel)      |
| **inventario.sportup.sk/interactive-demo** | ✅ LIVE    | 2026-05-17      | + 6 product mockups v iframe     |
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
│   ├── api/                         → backend Fastify (production-ready, 327 tests)
│   ├── docs/                        → Nextra docs site
│   │   └── content/                 → 7 MDX stránok
│   ├── mcp-server/                  → MCP for AI (future)
│   └── web/                         → frontend Next.js 15 (slice #4 in progress: bootstrap + auth + dashboard + assets list)
├── packages/
│   ├── design-tokens/               → @inventario/design-tokens (post-pivot v0.2.0)
│   │   ├── tokens.json              → W3C source of truth
│   │   ├── src/index.ts             → TypeScript exports
│   │   ├── src/tokens.css           → CSS vars (--inv-* prefix)
│   │   ├── src/tailwind-preset.js   → Tailwind preset
│   │   └── src/brand-kit.schema.json → per-tenant brand kit schema
│   └── shared-types/                → @inventario/shared-types (28 schém)
├── docs/
│   ├── marketing-site/              → Static HTML marketing (LIVE, WCAG 2.1 AA)
│   │   ├── interactive-demo.html    → 6 mockup viewer + aria-live announcements
│   │   ├── product-screens/         → 6 self-contained mockup HTML súborov
│   │   └── assets/shared.{css,js}   → Nav + footer injected do každej stránky
│   ├── design/screens/              → Design exploration (originály mockupov)
│   ├── decisions/                   → ADRs (0001-0010)
│   ├── compliance/                  → WCAG audit + GDPR Article 30 inventory
│   ├── milestones/                  → Phase + slice complete docs
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
- ✅ **Phase C COMPLETE** — Multi-tenant whitelabel backend (5 blokov, 2026-05-16). Milestone doc `docs/milestones/phase-c-multi-tenant-migration.md`. 327 testov green, 17 nových cross-tenant isolation testov, per-tenant unique indexes, JIT tenant provisioning, partial-filter indexes pre Organisation nullable fields
- ✅ **Phase D COMPLETE** — EU compliance foundations (4 bloky, 2026-05-17). Milestone doc `docs/milestones/phase-d-eu-compliance.md`
  - **D1**: OpenAPI 3.1 export + Swagger re-branding (commit `69d2092`)
  - **D2**: CycloneDX SBOM v CI (commit `0dc6ea0`)
  - **D3**: WCAG 2.1 AA baseline audit (commit `0e8ed9a`)
  - **D4**: GDPR Article 30 hardening + audit log polia (commit `d79233f`)
- ✅ **Phase E COMPLETE** — Tech debt cleanup (5 blokov, 2026-05-17). Milestone doc `docs/milestones/phase-e-tech-debt-cleanup.md`
  - **E1**: WCAG P1 marketing fixy (commit `9ed9521`) — `<main>` landmark, aria-hidden na SVG/emoji, `--brand-link` token (4.6:1 contrast), `.sr-only` utility, skip-link injection, broken footer link cleanup
  - **E2**: WCAG P2 marketing fixy (commit `6aeb578`) — `<span lang="en">` na anglické termíny, `aria-live` region v interactive-demo pre tenant/viewport announcements
  - **E3**: Shared-types exports + `isActive` boolean query bug (commit `c8ea924`) — nový `LocationType` enum, `UpdateCategorySchema` + `UpdateLocationSchema` exported, `BooleanQueryParam` helper. JSON schema 26 → 28
  - **E4**: Root metadata cleanup post-pivot (commit `8dffa49`) — package.json: SFZ → Inventario rebrand, MIT → EUPL-1.2, repo URL fix
  - **E5**: `audit.test.ts` flaky timeout (commit `4a98ec4`) — drop redundant `afterEach`, testTimeout 10s → 30s. 327 testov green v 212s

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

- ✅ Marketing site (6 stránok) LIVE na inventario.sportup.sk, **WCAG 2.1 AA compliant** po Phase E
- ✅ Interactive demo (6 obrazoviek, 4 tenanty, 3 viewporty, aria-live announcements)
- ✅ Clean URLs (no `.html` suffixes, `/_home` bug fixed)
- ✅ Cache headers správne (5 min revalidate pre `shared.js/css`)
- ✅ Docs site Nextra deployed → `docs.inventario.sportup.sk`
- ✅ "Čoskoro" badge revertovaný — všetky docs linky active

### Slice #4 frontend (apps/web) — in progress

- ✅ **Bootstrap** — Next.js 15 + Tailwind + design tokens preset wired up
- ✅ **MSAL auth shell** (2026-05-17, commit `0cac2e6`) — Entra ID login/logout, openapi-fetch klient s token middleware, AuthGate / AppShell
- ✅ **Dashboard** (2026-05-17, commit `77b51e8`) — personalizovaný greeting z `/v1/me`, 4 stats cards (Majetok/Kategórie/Lokality/Výpožičky), quick navigation grid, TanStack Query api-hooks vrstva (`useMe`, `useAssets`, `useCategories`, `useLocations`)
- ✅ **`/assets` list page** (2026-05-17, commit `a5e8b2e`) — server-side pagination + client-side filter/search (status + free text), FK resolution cez `Map<id, summary>` O(1) lookup, accessible semantic `<table>` so `<th scope>` + `aria-live` výsledkový stav, page sizes 20/50/100, status badge tone mapping
- ✅ **CI infra fix** (2026-05-17, commit `8766c93`) — `pretypecheck`/`prelint`/`prebuild` lifecycle hooks v `apps/web/package.json` automaticky regenerujú gitignored `api-types.ts` z `apps/api/openapi.json`. CI #84 green.

### Compliance + brand

- ✅ EUPL-1.2 + CC-BY-4.0 + REUSE 3.3 (272/272 súborov)
- ✅ Brand identity (Navy/Blue/Paper/Poppins), zdieľaná so SportUp ekosystémom
- ✅ ADR-0010 multi-tenant white-label
- ✅ WCAG 2.1 AA audit + remediation
- ✅ GDPR Article 30 inventory
- ✅ OpenAPI 3.1 spec ako repo artifact + CI freshness check
- ✅ CycloneDX SBOM weekly + per-PR

---

## 🎯 Next session — Slice #4 continue

Slice #4 frontend je **rozbehnutý**: bootstrap + auth + dashboard + assets list page fungujú. CI green. Pokračovaná cesta podľa mockup-ov v `docs/design/screens/`:

### Horúci kandidát — `/assets/[id]` asset detail page ⬅ **PRÍŠTÍ KROK**

Logicky druhý z 6 P0 obrazoviek. Riadky tabuľky na `/assets` už majú `<Link href="/assets/${_id}">` na inventory number — ten link teraz vedie do 404.

**Z mockupu (`docs/design/screens/`)**:

- **Detail header**: inventory number + name + status badge + akcie (Edit / Vyradiť / Zapožičať)
- **Vlastnosti** — form-style read view: kategória, lokalita, popis, nákupná cena, dátum nákupu, supplier, ...
- **História zmien** — audit log entries pre daný asset (vyžaduje admin audit endpoint zo Slice #5, alebo placeholder)
- **História výpožičiek** — zoznam minulých a aktuálnej výpožičky (loans modul, ešte neexistuje)
- **Prílohy** — attachments (ešte neexistuje endpoint)

Pre tento moment **realistický scope**:

- `GET /v1/assets/:id` — fetch hook (`useAsset(id)`)
- Render vlastností + FK lookup pre kategóriu/lokalitu
- Edit form mode (PATCH `/v1/assets/:id`) s `UpdateAssetSchema` zo shared-types pre validation
- Placeholders pre históriu + prílohy s "Modul čoskoro" badge — rovnaký pattern ako dashboard "Výpožičky: 0" karta
- RBAC: edit gombík len pre ASSET_MANAGER+ — číta sa z `useMe()` (`roles`)

### Ďalej v Slice #4 queue (poradie podľa P0 priority)

- **`/categories` + `/locations`** list pages — jednoduchšie ako assets (nepotrebujú pagination v pilote, ale potrebujú dať dobrý feedback keď delete zlyhá lebo asset referencuje FK)
- **`/loans/request`** — loan request form (P0, ale **vyžaduje loans API ktoré ešte neexistuje** — možno cross-slice)
- **`/my-loans`** — user's vlastné výpožičky (rovnaký block ako vyššie)
- **Polish**: empty states, error boundaries, loading skeletons, mobile responsive overrides, dark mode

### Slice #4 deployment plan

Keď budú približne 4 z 6 stran funkčných: vytvoriť Vercel projekt pre `apps/web`. Pravdepodobne **app.inventario.sportup.sk** subdoména. Nutné zmeny:

- `apps/web/vercel.json` — framework: nextjs + buildCommand override `pnpm build` (z monorepo root, kvôli prebuild hooku)
- Vercel UI — Root Directory: `apps/web`, Install Command: `cd ../.. && pnpm install --frozen-lockfile`
- DNS — CNAME `app` → cname.vercel-dns.com (rovnaký pattern ako `docs`)
- ENV vars — `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_ENTRA_*` (z `.env.example`)

---

## 🐛 Technical debt

Tracked pre eventuálnu cleanup session. Po Phase E je toto už značne zoštíhlený zoznam:

### Z Phase E — deferred (nie urgentné)

- **`marketing-site/shared.css`** migrate `--brand-*` → `@inventario/design-tokens/tokens.css` — marketing site funguje samostatne so svojimi inline CSS vars; migration na shared package je čistá konsolidácia bez user-facing benefitu. Robí sa keď budeme upravovať tokens.css beztak
- **`AssetUpdatePatch / CategoryUpdatePatch / LocationUpdatePatch types`** type-narrow cez `Pick` — schema layer (Zod) už blokuje mutation `organisationId`, type-level narrowing je estetické vylepšenie pre IDE autocomplete
- **`apps/docs/vercel.json`** UI override migration — **closed/non-issue**: `vercel.json` už obsahuje len headers, žiadny UI override netreba migrovať (Build Command / Install Command pre docs sú prázdne v UI, čo je rovnaké ako neuvedené v vercel.json)

### Z Phase D — GDPR retention infra (Slice #5)

- **Audit log retention job** — automatická pseudonymizácia po 24/60/84 mesiacoch. Vercel cron entry + script ktorý rewritne `actor.userId/displayName/ipAddress` na `'PSEUDONYMIZED'` placeholder a vyplne `pseudonymizedAt`
- **Audit log read API** — ADMIN-only `/v1/audit-logs` endpoint pre tenant administrátorov. Tenant-scoped (`AuditLogRepository` už nemá read paths, treba doplniť). Filtre na `action`, `severity`, `actor.userId`, time range, `legalBasis`, `dataCategories`
- **DSAR endpointy** — `GET /v1/me/export` (Art. 15 + 20), `DELETE /v1/me` self-service (Art. 17 s 30-day grace period)
- **Audit log backfill skript** — voliteľný, doplne `legalBasis` + `dataCategories` na pred-Phase-D rows. Použije ten istý `defaultLegalBasisFor()` + `defaultDataCategoriesFor()` mapping ako service layer

### Z Phase D — EU compliance docs (post-launch)

- **DPIA template** `docs/compliance/dpia-template.md` pre municipálne tenants pred prvým produkčným launchom
- **Threat model (STRIDE)** `docs/compliance/threat-model.md`
- **Conformity assessment** (CE marking pod CRA) keď zaintegrujeme AI features (MCP server s Claude)

### Pre-Phase-D debt (stále platný, malé)

- **`PENDING_TENANT_ID` placeholder** stále existuje v `lib/organisation-scoping.ts` ako exported konštanta, ale od Phase C Blok 3 sa už nikdy nezapisuje. Po production migration je možné konštantu úplne odstrániť zo `src/lib/` (alebo nechať pre forensic queries — "ktoré rows boli pre-Blok-3")
- **AuditLogRepository nie tenant-scoped** — zámerne nezmenené v Phase C. Read paths zatiaľ nemáme — keď príde admin audit endpoint v Slice #5, vtedy doplne tenant-scoping aj sem

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

| Téma                          | Súbor                                                    |
| ----------------------------- | -------------------------------------------------------- |
| Multi-tenant architecture     | `docs/decisions/0010-multi-tenant-white-label.md`        |
| Brand identity                | `BRAND.md` (root)                                        |
| Design tokens package         | `packages/design-tokens/README.md`                       |
| OpenAPI spec                  | `apps/api/openapi.json`                                  |
| WCAG 2.1 AA audit             | `docs/compliance/wcag-2.1-aa-audit.md`                   |
| GDPR Article 30 inventory     | `docs/compliance/gdpr-article-30.md`                     |
| Roadmap                       | `ROADMAP.md` (root)                                      |
| Pricing strategy              | `docs/sessions/2026-05-15-pricing-strategy.md`           |
| Design pivot history          | `docs/sessions/2026-05-15-design-pivot.md`               |
| Phase C session               | `docs/sessions/2026-05-16-day-summary.md`                |
| Slice #4 launch + CI debug    | `docs/sessions/2026-05-17-day-summary.md` ← **NEW**      |
| Vercel docs deploy guide      | `infra/vercel/DOCS-DEPLOYMENT.md`                        |
| All Vercel projects           | `infra/vercel/README.md`                                 |
| Backend slice completion logs | `docs/milestones/`                                       |
| Latest milestone (Phase E)    | `docs/milestones/phase-e-tech-debt-cleanup.md` ← **NEW** |
| Previous milestone (Phase D)  | `docs/milestones/phase-d-eu-compliance.md`               |
| Phase C milestone             | `docs/milestones/phase-c-multi-tenant-migration.md`      |
| Slice #3 milestone            | `docs/milestones/slice-3-categories-locations-users.md`  |
