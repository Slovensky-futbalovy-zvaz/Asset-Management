<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Inventario · Continuation plan

> **Living document** — vždy aktuálny stav projektu, najbližšie kroky, technical debt.
> Pri novej Claude session si prečítaj **najprv toto**, potom najnovší day-summary.

**Aktualizované**: 2026-05-17 (po dokončení Phase D Blok 1-4 — OpenAPI export + SBOM + WCAG audit + GDPR Article 30 — **CELÁ PHASE D COMPLETE**)

---

## 🎯 Stratégia: B → C → D → E → A

Frontend (Slice #4) je posledný **zámerne**, aby sa minimalizovali prerábky. Logika:

- 🅱 **Design tokens** → definovať vizuálny jazyk **pred** tým, než ho frontend začne používať ✅ **DONE**
- 🅲 **OrganisationId migration** → stabilný API contract s tenant scoping **pred** frontend integráciou ✅ **DONE**
- 🅳 **EU compliance** (OpenAPI export, SBOM, WCAG, GDPR) → fundamenty pre type generation a verejný sektor ✅ **DONE**
- 🅴 **Tech debt cleanup** → posledný refresh pred veľkým kusom ⬅ **PRÍŠTÍ KROK**
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
- ✅ **Phase C Blok 1**: Organisation schema + OrganisationScoped mixin + organisationId field na 5 collections (2026-05-16, commit `eab853a`)
  - `@inventario/shared-types` package (rename z `@sfz/shared-types` v0.1.0 → v0.2.0, EUPL-1.2)
  - `OrganisationSchema` + `OrganisationBrandKitSchema` + Create/Update variants
  - `OrganisationScopedSchema` mixin merge-nutý do User/Asset/Category/Location
  - `organisationId` direct field na AuditLogSchema
  - JSON schema generator emits 26 schém (predtým 23)
  - Services propaguju `organisationId` z aktora pri create paths
  - JIT user provisioning používa `PENDING_TENANT_ID` placeholder (`'000000000000000000000000'`) kým nepríde tenant resolution v Blok 3
- ✅ **Phase C Blok 2**: Tenant-scoped repositories pre assets, categories, locations (2026-05-16)
  - Nový `apps/api/src/lib/organisation-scoping.ts` — `requireTenantId(orgId)` validátor + `tenantFilter<T>(orgId, callerFilter, opts)` filter composer s default soft-delete exclusion + `PENDING_TENANT_ID` konštanta
  - **Architektonický výber**: utility funkcie namiesto base class. Heterogénne kolekcie (assets má `inventoryNumber`, cats/locs má `slug`, audit má `at`, users má `entraOid`) by base class type signature lámali. Flat repos s explicit `requireTenantId + tenantFilter` calls na začiatku každej metódy sú čitateľnejšie a easier-to-debug
  - **AssetsRepository, CategoriesRepository, LocationsRepository**: každá metóda berie `organisationId` ako prvý param, validuje cez `requireTenantId`, composes cez `tenantFilter`. Composite indexy `{organisationId: 1, X}` namiesto plain `{X}` (unique slugs sú teraz per-tenant)
  - **AssetsService, CategoriesService, LocationsService**: thread `actor.organisationId` cez všetky repo calls. Read paths (`list`, `getById`) berú `actor: WithId<User>` parameter. Hierarchy helper `makeParentLookup(tenantId, session)` bind-uje aj tenant aj session
  - **Routes** (categories, locations): `service.list({...}, request.currentUser)` a `service.getById(id, request.currentUser)` pridané `currentUser` arg
  - **UsersRepository + AuditLogRepository**: zámerne nezmenené. Users JIT provisioning beží PRED tenant resolution (Blok 3). Audit log `insert(record)` dostáva tenantId v record obsahu od service
  - Typecheck zelený. shared-types unit testy zelené. apps/api integration testy stále intentionally broken (per-test tenant provisioning land-uje v Blok 5)
  - 10 modified files + 1 new file, +679/-357 riadkov
- ✅ **Phase C Blok 3**: Auth middleware tenant resolution + Organisations module (2026-05-16)
  - Nový modul `apps/api/src/modules/organisations/` — `OrganisationsRepository` + `OrganisationsService` + `organisations.routes.ts`
  - **OrganisationsRepository**: root-level (NIE tenant-scoped — Organisation sedí nad tenancy boundary). Indexy: `slug` unique, `entraTenantId` unique-sparse, `customDomain` unique-sparse, `status+deletedAt`. Read metódy `findById`, `findBySlug`, `findByEntraTenantId`, `findByCustomDomain` filtrujú soft-deleted out
  - **OrganisationsService**: 2 callers — auth middleware (high-frequency, low-privilege cez `findOrProvisionByEntraTenantId(claims)` — JIT provision nového tenanta na first contact, slug = lowercased Entra UUID bez dashes) + admin API (low-frequency cez `list`, `getById`, `create`, `update`, `delete` — všetky transactional + audit-logged). Race-condition handling cez 11000 duplicate-key catch & re-query
  - **organisations.routes.ts**: ADMIN-only CRUD na `/v1/organisations`. POST + PATCH + DELETE + GET (list/single). Slug + entraTenantId omitted z PATCH body (immutable stable identifiers)
  - **auth.ts loadCurrentUser refactor**: workflow začína tenant resolution PRED user resolution. `request.organisation: WithId<Organisation>` + `request.organisationId: string` decorators. SUSPENDED/ARCHIVED tenants reject login s 401 pred user lookup-om. Soft-deleted tenants tiež reject 401 ("tenant unavailable")
  - **UsersRepository tenant-scoped refactor**: 3 cross-tenant metódy zámerne (auth flow beží PRED tenant resolution) — `findByEntraOid` (globally unique Entra OID lookup), `insertNew` (doc už nesie resolved organisationId), `touchLastLogin` (cross-tenant by Entra oid). Všetky ostatné — `findById`, `update`, `list`, `countActiveAdminsExcluding` — tenant-scoped. Indexy: `entraOid` zostáva cross-tenant unique, `email` teraz `organisationId+email` composite (dvaja tenants môžu mať `admin@x.sk`)
  - **UsersService refactor**: `findOrProvision(claims, organisation)` berie tenant param a píše real `organisationId` (nie viac PENDING_TENANT_ID placeholder). `list`, `getById`, `update` všetky berú `actor: WithId<User>` a tenant-scoped voči `actor.organisationId`. Last-admin guardrail per-tenant scoped
  - **users.routes.ts**: `/v1/me` migroval z `requireAuth` na `[requireAuth, loadCurrentUser]` chain (handler vracia `request.currentUser`). Admin endpoints prešli na threading `request.currentUser` actor argument do `service.list/getById/update`
  - **shared-types audit-log.ts**: 3 nové action enum hodnoty `ORGANISATION_CREATED/UPDATED/DELETED` + `Organisation` entityType
  - **server.ts**: organisationsRoutes registered PRED usersRoutes (decorator order — loadCurrentUser potrebuje `fastify.organisationsService` decorator)
  - Typecheck zelený. 9 changed files (1 v shared-types, 8 v apps/api) + 3 nové súbory v organisations/. Commits: shared-types audit-log enum + api organisations module (separated)
  - apps/api integration testy stále broken (Blok 5 fix)
- ✅ **Phase C Blok 4**: Migration script + per-tenant unique indexes (2026-05-16)
  - Nový skript `apps/api/scripts/migrate-organisation-id.ts` — idempotent, supports `--dry-run`, standalone (žiadny Fastify plugin chain — pure Mongo driver). Npm entry `pnpm --filter @inventario/api migrate:organisation-id`
  - **Step 1**: Vytvorí default `inventario` tenant document (slug `inventario`, displayName `Inventario`, status ACTIVE, plan FREE, entraTenantId null). Idempotent — ak už existuje, reuse
  - **Step 2**: Backfill `organisationId` na všetkých 5 tenant-scoped collections (users, assets, categories, locations, audit_logs) z `PENDING_TENANT_ID` placeholder na real `_id` defaultného tenanta. Single `updateMany` per collection
  - **Step 3**: Drop 5 legacy single-field unique indexes (`users.email_unique`, `users.isActive_deletedAt`, `assets.inventoryNumber_unique`, `categories.slug_unique`, `locations.slug_unique`). Index list obsahuje aj alternatívne názvy `_1` z auto-gen Mongo formy pre kolekcie vytvorené v rôznych dobách. Race-condition tolerantné. Nové composite indexes vytvorí každý repository `ensureIndexes()` pri ďalšom server bootu
  - **Dev DB tested**: dry-run reportoval 0 PENDING rows + 5 legacy indexes na drop. Real run vytvoril Inventario tenant (\_id `6a088128a0922e418181d257`), dropped 5 indexes. Druhý dry-run potvrdil idempotency — 0 zmien
  - **tsconfig.eslint.json**: pridaný `scripts/**/*.ts` do `include` aby skript bol covered cez project typecheck
  - **Production pripravenosť**: skript zostáva runnable proti production DB — stačí dočasne prepnúť `MONGO_URI` v `.env.local` na production cluster. Operátor je audit trail (žiadny audit log write v skripte zámerne)
  - 3 changed files (1 new + 2 modified). Typecheck zelený
- ✅ **Phase C Blok 5**: Cross-tenant isolation tests + partial-filter indexes (2026-05-16)
  - Nový file `apps/api/tests/integration/cross-tenant-isolation.test.ts` — **17 testov** pokrývajúcich isoláciu cez všetky 4 tenant-scoped resources (assets, categories, locations, users) + audit log scope. Kontrakt: GET list iba tenant A rows, GET/PATCH/DELETE cross-tenant id → **404 (nie 403)**, slug/email/inventoryNumber per-tenant unikatné
  - **Test fixtures multi-tenant aware**: pridané `resolveTestTenantId(app)` (lazy-resolve JIT tenant z TEST_ENTRA_TENANT_ID slug-u, alebo inline-create ak chyba) + `seedTestTenant(app, opts)` (vytvori druhý tenant pre cross-tenant testy). Všetky `insertTestX` helpers dostali optional `organisationId` parameter s defaultom `await resolveTestTenantId(app)`
  - **3 inline insert fixes** v existujúcich test súboroch (assets-patch, categories-patch, locations-patch "advances updatedAt to a newer timestamp" testy) ktoré obádzali fixture helpers a robili priame `db.collection().insertOne(...)` bez `organisationId`
  - **auth.test.ts kontrakt update**: "deactivated user GET /v1/me" test prepisaný zo `200 isActive:false` na `401 deactivated`. Po Blok 3 `/v1/me` používa `[requireAuth, loadCurrentUser]` chain ktorý reject-uje deactivated users na všetkých endpointoch vřtane self-lookup
  - **Partial-filter index fix** v `OrganisationsRepository`: `entraTenantId` a `customDomain` indexy migrated zo sparse na `partialFilterExpression: { $type: 'string' }`. Dôvod: Mongo sparse indexy v skutočnosti indexujú rows kde je hodnota explicitne `null` (len `missing` field je preskoceny). Náš Zod schema píše `null` ako default pre nullable fields, číže dvaja LOCAL tenanti s `customDomain: null` by kolidovali na sparse unique indexe
  - **Migration script extension**: drop-uje aj obsolete `entraTenantId_unique_sparse` + `customDomain_unique_sparse` z `organisations` collection cez novú `dropLegacyOrganisationIndexes()` funkciu. Dev aj test DB migrated
  - **All 327 tests green**: 310 existujúcich + 17 nových cross-tenant. Test suite duration ~5min (Atlas Flex)
  - 7 modified files + 1 new file. Typecheck zelený
- ✅ **Phase C COMPLETE** — Multi-tenant whitelabel backend ready. Milestone doc `docs/milestones/phase-c-multi-tenant-migration.md`
- ✅ **Phase D Blok 1**: OpenAPI 3.1 export + Swagger re-branding (2026-05-17, commit `69d2092`)
  - Swagger plugin: SFZ → Inventario, MIT → EUPL-1.2, tagy rozsahy z 3 → 6 (Health, Organisations, Users, Assets, Categories, Locations)
  - Nový skript `apps/api/scripts/export-openapi.ts` — boot-uje server s pluginTimeout 30s, volá `app.swagger()`, zapíše deterministicky pretty JSON do `apps/api/openapi.json` (73 KiB, 14 paths, 27 endpoints). Flags `--check` (CI freshness) + `--output PATH`
  - Nový CI job `openapi` v `.github/workflows/ci.yml` beží `pnpm openapi:export -- --check` proti Atlas + Entra secrets. Existing commitlint job renamed Job 3 → Job 4
  - `apps/api/README.md` re-branded na @inventario/api + nová Static export sekcia s consumer-side workflow popisom
  - `.prettierignore` exclude pre `openapi.json` (deterministic JSON.stringify formatting)
- ✅ **Phase D Blok 2**: CycloneDX SBOM v CI (2026-05-17, commit `0dc6ea0`)
  - Nový workflow `.github/workflows/sbom.yml` — trigger push/PR/weekly cron (ne 07:00 UTC)/workflow_dispatch. Generuje root-level monorepo SBOM cez `pnpm sbom`, upload ako 90-day artifact (matches EU procurement audit window)
  - Root `pnpm sbom` script: `pnpm dlx @cyclonedx/cdxgen@^11 -r -t js -o sbom.cdx.json --spec-version 1.6 --no-babel`
  - `.gitignore` exclude pre `sbom.cdx.json` + `.cdxgen-cache/`
  - Compliance rationale: EU CRA Reg. 2024/2847 vyžaduje machine-readable SBOM od dec 2027. CycloneDX 1.6 je formát ktorý EU Commission reference architecture endorse-uje
- ✅ **Phase D Blok 3**: WCAG 2.1 AA baseline audit (2026-05-17, commit `0e8ed9a`)
  - Nový dokument `docs/compliance/wcag-2.1-aa-audit.md` — 30 in-scope kriterií pre WCAG 2.1 AA proti marketing site. 24 čistých, 3 P1 + 3 P2 nálezov
  - P1: SVG/emoji bez `aria-hidden`, chýba `<main>` landmark, link color contrast 3.5:1 fails 4.5:1
  - P2: chyba skip-link, anglické termíny bez `lang="en"`, demo bez `aria-live`
  - Plan pre apps/web accessibility setup: `eslint-plugin-jsx-a11y` v CI, `@axe-core/react` v dev, `@axe-core/cli` proti deployed URL
  - Nová zložka `docs/compliance/` ako hostiteľ buduúcich compliance artifactov
- ✅ **Phase D Blok 4**: GDPR Article 30 hardening (2026-05-17, commit `d79233f`)
  - `packages/shared-types/src/schemas/audit-log.ts` — 3 nové optional polia: `legalBasis` (enum mapping na čl. 6 ods. 1 GDPR), `dataCategories` (array kategórií os. údajov), `pseudonymizedAt` (timestamp retention job-u). `.optional()` namiesto `.default()` — spätne kompatibilné s pred-Phase-D rows, žiadna migration
  - `apps/api/src/modules/audit/audit.service.ts` — `RecordEventInput` rozšírený o nové polia, service auto-fill cez `defaultLegalBasisFor()` + `defaultDataCategoriesFor()` helpers s hardcoded mapping pre 50+ action enum hodnôt
  - Nový dokument `docs/compliance/gdpr-article-30.md` — Article 30 inventár pre 5 spracovateľských operácií, sub-processors s EU residency, rights implementation roadmap (Art. 15-22), tech + organizačné opatrenia (Art. 32), retention schedule
  - Typecheck zelený na celom workspace, shared-types testy 54/54, openapi.json `--check` stále pass (audit log read API až v Slice #5)
- ✅ **Phase D COMPLETE** — EU compliance foundations ready. Milestone doc `docs/milestones/phase-d-eu-compliance.md`

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

Phase D EU compliance je **COMPLETE** (Blok 1-4 všetko done). Ďalej:

### 🅴 Phase E — Tech debt cleanup (~1-2 hod) ⬅ **PRÍŠTÍ KROK**

**Posledný refresh pred Slice #4. Quick wins z technical debt sekcie nižšie. Dobrý "lite" deň ak nemáš energiu na veľký feature work.**

Priority pre Phase E (zoradené od najsilňujších quick winov):

- **WCAG P1 marketing fixy** (~60-90 min) — z Phase D audit doc-u:
  - `aria-hidden="true"` na dešekoratívne SVG/emoji v `index.html`, `use-cases.html`, `technology.html`, `pricing.html`, `interactive-demo.html`, `shared.js`
  - Wrap content `<section>`-y do `<main id="main">` na všetkých 6 mar­ke­ting stránkach
  - Pridanie `--brand-link: #1f6699` semantic token + override default `a { color }` v `shared.css`
- **WCAG P2 fixy** (~30 min) — skip-link cez `shared.js`, `<span lang="en">` na 2 najfrequentnejšie termíny, `aria-live` v demo viewer mode-switch
- **`audit.test.ts` flaky timeout** (~30-60 min) — investícia do `singleFork: false` per-test override alebo zvýšenie default timeoutu
- **`categories.routes.ts isActive` fix** (~15 min) — rovnaký pattern ako K10 users, `z.coerce.boolean()` → `z.enum([...]).transform(...)`
- **Shared-types exports** (~30 min) — `LOCATION_TYPE_VALUES`, `UpdateCategorySchema`, `UpdateLocationSchema` → `packages/shared-types/`
- **Marketing footer link cleanup** (~10 min)
- **Root `package.json` post-pivot cleanup** — name, author, license, repo URL
- **`apps/docs/vercel.json`** migrate UI override → repo file
- **`marketing-site/shared.css`** migrate `--brand-*` → `@inventario/design-tokens/tokens.css`

### 🅵 Slice #4 — Frontend (apps/web) — multi-day projekt 🏁 **FINÁLNY KROK**

**Veľký krok — frontend aplikácia ktorú zatiaľ máme len ako mockupy. Backend je production-ready a čaká na konzumenta. Robiíme posledný — design tokens, tenant scoping, OpenAPI export, GDPR audit log polia, WCAG plan — všetko už bude hotové.**

- Stack: Next.js 15 + TanStack Query + shadcn/ui + Tailwind
- Tailwind preset z `@inventario/design-tokens/tailwind` (ready ✅)
- HTTP klient: `openapi-typescript` + `openapi-fetch` z `apps/api/openapi.json` (ready ✅)
- 6 P0 stránok podľa mockupov v `docs/design/screens/`
- Microsoft Entra ID SSO login flow
- Multi-tenant `data-tenant` root attribute (ready ✅)
- Accessibility: `eslint-plugin-jsx-a11y` + `@axe-core/react` + `@axe-core/cli` v CI (plan ✅ — viz `docs/compliance/wcag-2.1-aa-audit.md`)
- Sub-tasks: bootstrap → auth → assets list → asset detail → loan workflow → polish

---

## 🐛 Technical debt

Tracked pre eventuálnu cleanup session:

### Z Phase D — WCAG marketing site fixy

- **WCAG P1 — SVG/emoji `aria-hidden`** v 6 marketing HTML súboroch + `shared.js`. Dekoratívne SVG (chevron-right, GitHub logo) potrebujú `aria-hidden="true"`. Emoji ikony pre kategórie organizácií (`⚽`, `🏛️`, etc.) tiež
- **WCAG P1 — chýba `<main>` landmark** všetky marketing stránky + interactive demo. Content `<section>`-y wrap-núť do `<main id="main">`
- **WCAG P1 — link color contrast**. Default `a { color: var(--brand-accent #388fc3) }` na bielom má 3.5:1, fails AA 4.5:1. Pridanie `--brand-link: #1f6699` semantic token pre body-text linky, `--brand-accent` zachovať pre UI komponenty (badge, focus outline)
- **WCAG P2 — skip-link** "Preskočiť na hlavný obsah" do `shared.js` ako prvý body element
- **WCAG P2 — `<span lang="en">`** na 2-3 najfrequentnejšie anglické termíny ("vendor lock-in")
- **WCAG P2 — `aria-live`** region v `interactive-demo.html` pre status announcements pri mode/tenant switch

Detailný plan v `docs/compliance/wcag-2.1-aa-audit.md`.

### Z Phase D — GDPR retention infra (Slice #5)

- **Audit log retention job** — automatická pseudonymizácia po 24/60/84 mesiacoch. Vercel cron entry + script ktorý rewritne `actor.userId/displayName/ipAddress` na `'PSEUDONYMIZED'` placeholder a vyplne `pseudonymizedAt`
- **Audit log read API** — ADMIN-only `/v1/audit-logs` endpoint pre tenant adminátorov. Tenant-scoped (`AuditLogRepository` už nemá read paths, treba doplniť). Filtre na `action`, `severity`, `actor.userId`, time range, `legalBasis`, `dataCategories`
- **DSAR endpointy** — `GET /v1/me/export` (Art. 15 + 20), `DELETE /v1/me` self-service (Art. 17 s 30-day grace period)
- **Audit log backfill skript** — volitený, doplne `legalBasis` + `dataCategories` na pred-Phase-D rows. Použije ten istý `defaultLegalBasisFor()` + `defaultDataCategoriesFor()` mapping ako service layer

### Z Phase D — EU compliance docs

- **DPIA template** `docs/compliance/dpia-template.md` pre municipálne tenants pred prvým produkcným launchom
- **Threat model (STRIDE)** `docs/compliance/threat-model.md`
- **Conformity assessment** (CE marking pod CRA) keď zaintegrujeme AI features (MCP server s Claude)

### Pre-Phase-D debt (stále platný)

- **`PENDING_TENANT_ID` placeholder** stále existuje v `lib/organisation-scoping.ts` ako exported konštanta, ale od Blok 3 sa už nikdy nezapisuje do nových row-ov a Blok 4 migration script potvrdil že v dev DB nie sú žiadne PENDING rows. Po production migration je možné konštantu úplne odstrániť zo `src/lib/` (alebo nechať pre forensic queries — "ktoré rows boli pre-Blok-3")
- **AuditLogRepository nie tenant-scoped** — zámerne nezmenené v Blok 2 a 3. Read paths zatiaľ nemáme — keď príde admin audit endpoint v Slice #5, vtedy doplne tenant-scoping aj sem
- **`audit.test.ts`** flaky timeout — beží občas 30s+ na Atlas. Treba zvýšiť timeout alebo singleFork
- **`LOCATION_TYPE_VALUES`** export do `packages/shared-types/` (currently duplicated)
- **`UpdateCategorySchema`** + **`UpdateLocationSchema`** → presunúť do `packages/shared-types/`
- **`categories.routes.ts isActive` query param** — rovnaký `z.coerce.boolean()` bug ako bol v K10 users (string `"false"` interpretovaný ako `true`). Fix: replace s `z.enum(['true','false','1','0']).transform(...)` pattern
- **Marketing footer link** `../decisions/0010-multi-tenant-white-label.md` — broken na production (decisions sa nedeployujú do marketing bundli)
- **`apps/docs/vercel.json`** — momentálne len headers, buildCommand riešené UI override (cleaner to mať v `vercel.json` raz keď zistíme správny pattern pre monorepo). Po Phase C overený rename na `@inventario/docs`
- **Root `package.json`** post-pivot cleanup — name `sfz-asset-management`, author `Slovenský futbalový zväz`, license `MIT`, repository `jletko/Asset-Management` (správne má byť `Slovensky-futbalovy-zvaz/Asset-Management`). Mismatch s `apps/docs` ktoré už má EUPL-1.2 a Inventario brand
- **Marketing-site `shared.css`** & **`docs/design/screens/`** — používajú inline `--brand-*` CSS vars namiesto `@inventario/design-tokens/tokens.css`. Cleanup migration ich premostí na nový package (žiadny breaking change, len konsolidácia source of truth)
- **AssetUpdatePatch / CategoryUpdatePatch / LocationUpdatePatch types** — sú `Partial<Omit<X, '_id' | ...>>` ktoré stále obsahujú `organisationId` ako mutable. Schema layer blokuje (Body schema má `omit({organisationId})`), takže prakticky to nie je exploit, ale stojí za to type-narrow neskôr cez `Pick` ako v UsersRepository

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

| Téma                           | Súbor                                                   |
| ------------------------------ | ------------------------------------------------------- |
| Multi-tenant architecture      | `docs/decisions/0010-multi-tenant-white-label.md`       |
| Brand identity                 | `BRAND.md` (root)                                       |
| Design tokens package          | `packages/design-tokens/README.md`                      |
| OpenAPI spec                   | `apps/api/openapi.json` ← **NEW (Phase D)**             |
| WCAG 2.1 AA audit              | `docs/compliance/wcag-2.1-aa-audit.md` ← **NEW**        |
| GDPR Article 30 inventory      | `docs/compliance/gdpr-article-30.md` ← **NEW**          |
| Roadmap                        | `ROADMAP.md` (root)                                     |
| Pricing strategy               | `docs/sessions/2026-05-15-pricing-strategy.md`          |
| Design pivot history           | `docs/sessions/2026-05-15-design-pivot.md`              |
| Yesterday's progress (Phase C) | `docs/sessions/2026-05-16-day-summary.md`               |
| Vercel docs deploy guide       | `infra/vercel/DOCS-DEPLOYMENT.md`                       |
| All Vercel projects            | `infra/vercel/README.md`                                |
| Backend slice completion logs  | `docs/milestones/`                                      |
| Latest milestone (Phase D)     | `docs/milestones/phase-d-eu-compliance.md` ← **NEW**    |
| Previous milestone (Phase C)   | `docs/milestones/phase-c-multi-tenant-migration.md`     |
| Slice #3                       | `docs/milestones/slice-3-categories-locations-users.md` |
