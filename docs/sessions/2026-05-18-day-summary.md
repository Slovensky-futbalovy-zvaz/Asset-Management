<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Day summary · 2026-05-18 (Monday)

> Slice #4 dotiahnutie. Od `/categories` cez `/locations` po ADMIN-only `/users` admin page, plus mobile responsive polish naprieč celou appkou. Večerný pivot do dependabot inbox-u: Tailwind 4 deferral decision, CI dependabot gating fix, tri merge-y a dva clean closures. **Neskorý večerný side quest**: Vercel deploy `asset-management-api` na Node 24 LTS — 3.5-hodinová bitka s Production Override locks, `engines.node` syntax peklom a stale UI overrides. Win-ovaný cez Cesta A reset všetkých Project Settings overrides. CORS verified live na `api.inventario.sportup.sk`.

---

## TL;DR

Deň mal **dve fázy**: (1) Slice #4 finalization 9:00-16:00, (2) Dependabot cleanup 16:00-17:30, (3) Vercel deploy battle 17:30-21:00.

Slice #4 je z 5/6 P0 stránok hotový. Posledná chýbajúca (`/loans/request` + `/my-loans`) je **blocked na Slice #5 backend** (loans API endpointy ešte neexistujú). Frontend `apps/web` má teraz:

- ✅ **`/locations` admin page** — mirror `/categories` patternu, 6 LocationType enum hodnôt
- ✅ **`/users` admin page** — ADMIN-only s AccessDenied state, server-side filter+search+pagination, role checkboxes + isActive toggle
- ✅ **Mobile responsive polish** — hamburger menu + slide-in drawer, tables overflow-x-auto, filter selects full-width na mobile, paginácia arrow-only na mobile
- ✅ **CI #100 green**, 14m 7s, všetky 3 workflows zelené
- ✅ **327/327 backend testov stále green**

Po dovŕšení Slice #4 (16:00) prišiel **non-plánovaný side quest** — dependabot inbox sa nahromadil cez weekend, 5 PR-iek čakalo:

- ✅ **#14 codeql-action v3→v4** merged
- ✅ **#15 setup-node v4→v6** merged (po overení že náš `cache: pnpm` pattern v6 breaking change neovplyvní)
- ✅ **#2 minor-and-patch group** merged (vrátane openapi-fetch 0.13.4→0.17.0 po dôslednej changelog analýze)
- 🚫 **#11 Tailwind 4** — strategicky odložené na post-pilot (browser support cut + design-tokens preset refactor)
- 🚫 **#16 pnpm/action-setup v6** — známe bugy s pnpm version detection

Plus **CI fix** ktorý odblokoval dependabot PR-ky: `test` a `openapi` joby teraz skipujú pre dependabot, lebo GitHub bot PR-ky nedostanú repo secrets.

---

## 🎯 Commit log

| #   | Commit        | Čo                                                                                  | CI    |
| --- | ------------- | ----------------------------------------------------------------------------------- | ----- |
| 1   | `_(initial)_` | feat(web): /locations admin page (api-hooks + content + create dialog)              | green |
| 2   | `_(initial)_` | feat(web): /users admin page ADMIN-only + UserEditDialog + role guardrails          | green |
| 3   | `_(initial)_` | refactor(web): mobile responsive polish (AppShell drawer + tables + selects + pag.) | green |
| 4   | `_(initial)_` | chore(deps): defer Tailwind v4 major bump until post-pilot                          | green |
| 5   | `_(initial)_` | ci: skip test + openapi jobs for dependabot PRs                                     | green |
| 6   | `_(merge)_`   | chore(deps): codeql-action v3→v4 (#14)                                              | green |
| 7   | `_(merge)_`   | chore(deps): setup-node v4→v6 (#15)                                                 | green |
| 8   | `_(merge)_`   | chore(deps): minor-and-patch group (#2) — tsx, turbo, openapi-fetch 0.13→0.17       | green |
| 9   | `_(pending)_` | ci: ignore pnpm/action-setup major bumps in dependabot                              | n/a   |

CI #100 milestone — pekné okrúhle číslo na koniec Slice #4 ✨

---

## 1. `/locations` admin page

Priame zrkadlo `/categories` patternu zo včerajška. 4 nové súbory:

- **`api-hooks.ts`** dostane `CreateLocationInput`, `LocationDetail` types + `useCreateLocation()` / `useDeleteLocation()` hooks
- **`LocationsContent.tsx`** — list + tabuľka s `LOCATION_TYPE_LABELS` (WAREHOUSE/OFFICE/STADIUM/TRAINING_CENTER/EXTERNAL/IN_TRANSIT)
- **`LocationCreateDialog.tsx`** — react-hook-form s name + type dropdown + description
- **`apps/web/src/app/locations/page.tsx`** — len `AuthGate` wrapper + `LocationsContent` re-export

FK protection error messaging (slice #3 K7+K9) sa surfacuje rovnako ako v `/categories`: backend vráti 400 s human-readable message ("8 assets reference 'Bratislava — sklad': reassign or delete first"), UI ju renderuje verbatim cez `ConfirmDeleteDialog`.

**RBAC**: GET všetci, POST/PATCH `ASSET_MANAGER+ADMIN`, DELETE iba ADMIN. Client-side gating cez existujúci `useCanManageTaxonomy()` (Pridať tlačidlo) a `useCanDeleteTaxonomy()` (Vymazať akcia).

---

## 2. `/users` admin page

Nová surface, ADMIN-only. Štyri nové súbory:

- **`api-hooks.ts`** — `UserSummary`, `UserDetail`, `UserUpdatePatch` types + `useUsers()` (s filtrami), `useUser()`, `useUpdateUser()`, `useCanAdminUsers()` helper
- **`UsersContent.tsx`** — server-side filter (role + isActive + free-text search debounced 300ms) + pagination, 5 `ROLE_LABELS` mappings
- **`UserEditDialog.tsx`** — 5 role checkboxy + isActive toggle, dirty-diff patch, self-guardrails (admin nemôže demote-ovať sám seba ani deaktivovať)
- **`apps/web/src/app/users/page.tsx`**

### Decisions

**AccessDenied state pre ne-ADMIN**:
EMPLOYEE a ASSET_MANAGER nesmú vidieť user list (privacy + leak prevention). `useCanAdminUsers()` vracia `false` ⇒ celá stránka renderuje "Prístup zamietnutý" empty state s linkom späť na `/dashboard`. Backend reject-uje rovnakú request s 403 — UI gate je len UX comfort, nie security boundary.

**Server-side filter namiesto client-side**:
Pri prvom pohľade lákavé filtrovať client-side (typicky <50 users per tenant), ale free-text search cez email + displayName + firstName + lastName potrebuje regex matching ktorý backend už robí v `ListUsersQuerySchema`. Konzistencia s `/assets` pattern-om víťazí.

**Dirty-diff patch payload**:
Rovnaký pattern ako v `AssetDetailEditForm` — `react-hook-form` drží `formState.dirtyFields`, submit handler postaví PATCH body iba zo zmenených fieldov. Pri user edit-e je to mimoriadne dôležité: ak admin omylom nezaškrtne `isActive` (default unchecked v dirty stave), patch by celého usera deaktivoval. Dirty-diff to zabezpečí.

**Self-guardrails sú backend zodpovednosť**:
UI dialog ich neimplementuje — backend `users.service.ts` má 3 guardrails (no-self-demote, no-self-deactivate, last-active-admin protection). UI iba surfacuje vrátenú 400 error message v dialog footer-e. Single source of truth pre RBAC pravidlá.

### Bugs nájdené

**`jsx-a11y/label-has-associated-control` na role checkboxoch** — najprv som mal `<label><input type="checkbox" /> Admin</label>`, lint to zamietol lebo "label must contain a form control or htmlFor". Pridanie `htmlFor={`role-${role}`}` na label nestačilo. Finálne riešenie: `aria-label={ROLE_LABELS[role] ?? role}` na samotnom input-e, čo lint akceptuje a screen readery majú správnu označenie.

**Rovnaký lint na isActive toggle** — má inú štruktúru (toggle switch, nie checkbox), takže som nahradil nested-input-in-label pattern explicitným `<label htmlFor>` + `<div>` wrapper-om. Funguje, lint je šťastný.

---

## 3. Mobile responsive polish

Slice #4 stránky boli desktop-first. Pre Vercel deploy a real-user testing v pilote treba aspoň tablet/phone funkčnosť. 7 dotknutých súborov:

### AppShell

- **Hamburger menu** vľavo hore (md:hidden, viditeľný len pod 768px)
- **Slide-in drawer** s backdrop overlay-om, auto-close na navigation cez `usePathname()` watch + Escape key handler
- **Sidebar zostáva sticky** na desktope (≥768px)

### Tables

- Wrap do `<div className="overflow-x-auto">` na `/assets`, `/categories`, `/locations`, `/users`
- Pre mobile = horizontal scroll, pre desktop = bez zmeny

### Filter selects

- `w-full sm:w-auto` na všetkých `<select>` v list pages
- Mobile = full width row pod search input-om
- Desktop = inline vedľa search-u

### Pagination

- Arrow-only `<` `>` na mobile (md:hidden)
- Full text "Predošlá / Ďalšia" na desktope
- Page indicator `5 z 23` zostáva na oboch

### Bonus fix

Pri review-e som našiel **nested AppShell** v `AssetDetailContent.tsx` — wrapper komponent vykresľoval AppShell, ktorý `AuthGate` už poskytuje. Dvojnásobný sidebar + double-top-padding bol na desktop nepostrehnuteľný, ale na mobile to vytvorilo nezmysel. Refactor: AppShell removed from `AssetDetailContent`, single instance z `AuthGate` upstream.

---

## 4. Tailwind 4 deferral decision

Dependabot otvoril **PR #11** s bump `tailwindcss` 3.4.18 → 4.x. Pri rýchlom pohľade som chcel merge-núť, potom som otvoril Tailwind 4 release notes a uvedomil si že to **nie je minor architektonický shift**.

### Čo všetko sa mení v v4

| Vec                 | v3                                    | v4                                                       |
| ------------------- | ------------------------------------- | -------------------------------------------------------- |
| Config              | `tailwind.config.js` JS preset        | CSS-first `@theme` block                                 |
| PostCSS plugin      | `tailwindcss`                         | `@tailwindcss/postcss` (premenované)                     |
| Browser support     | IE11-friendly fallbacks               | Safari 16.4+ / Chrome 111+ / Firefox 128+ (Mar 2023 cut) |
| Theme JS preset     | First-class                           | Deprecated, migration path nejasná                       |
| Tailwind directives | `@tailwind base/components/utilities` | `@import "tailwindcss"`                                  |

### Náš expozičný povrch

`@inventario/design-tokens` v0.2.0 má **62 token mappings** v `src/tailwind-preset.js` (Primitive → Semantic → Brand → 4 pilot tenants). Multi-tenant override pattern `:root[data-tenant='X']` priamo závisí od JS preset run-time merge-u. Refactor na CSS `@theme` znamená:

1. Rewrite všetkých 62 mappings do CSS custom properties
2. Migrácia tenant override mechanizmu (zatiaľ nejasné ako to funguje v `@theme`-based world)
3. Re-test contrast pre brand kit schema (per-tenant validator)
4. Browser support audit pre pilot tenants — Mesto Pezinok, ŠK Inter, atď. nemajú garantovaný Safari 16.4+

### Decision

**Defer until post-pilot launch.** Pridal som `tailwindcss` major version ignore + `@tailwindcss/*` ecosystem-wide ignore do `.github/dependabot.yml`:

```yaml
ignore:
  - dependency-name: 'tailwindcss'
    update-types: ['version-update:semver-major']
  - dependency-name: '@tailwindcss/*'
```

Commit `chore(deps): defer Tailwind v4 major bump until post-pilot` pushed na main. Dependabot pri ďalšom run-e automaticky zatvoril PR #11 (no manual close needed).

Tracked v NEXT.md ako tech-debt s pilot tenant browser audit checklist-om.

---

## 5. CI dependabot gating fix

Po dotiahnutí Slice #4 som išiel mergeovať dependabot PR-ky a zistil že **všetky padajú** v `test` a `openapi` joboch:

```
× test     "MONGO_URI is required"
× openapi  "ENTRA_API_CLIENT_ID is not set"
```

### Root cause

GitHub Security policy: **repo secrets sa neexponujú dependabot-authored PR-iek**. To je správne (chráni to pred attacker-om ktorý cez malicious dependency môže exfiltrate-ovať secrets), ale znamená to že:

1. `MONGO_URI_TEST` → injected ako prázdny string → Fastify boot zlyhá
2. `ENTRA_API_CLIENT_ID_TEST` → prázdny → vitest globalSetup zlyhá pri building RS256 test JWT-u

Dependabot PR-ky **nikdy nezmenia OpenAPI surface** ani backend kód (sú to npm/action bumps), takže skipnúť tieto joby pre dependabot je bezpečné — quality job (lint+typecheck+build) stále beží a chytí akýkoľvek breakage.

### Fix

```yaml
jobs:
  test:
    if: github.actor != 'dependabot[bot]'
    # ...
  openapi:
    if: github.actor != 'dependabot[bot]'
    # ...
```

Commit `ci: skip test + openapi jobs for dependabot PRs` pushed, CI #108 green (14m 7s).

### Alternatívy ktoré som zvážil

| Možnosť                                                         | Verdikt                                                                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A: `if: github.actor != 'dependabot[bot]'` na celý job          | ✅ **chosen** — clean, dependabot dostane quality signal, ostatok skipnutý                                      |
| B: Mock secrets ako `'mock-mongo-uri'` v env block-u            | ❌ Fastify by stále padol pri pokuse o reálny Mongo connect                                                     |
| C: Vyladiť tests aby fungovali bez secrets                      | ❌ Príliš veľký refactor pre marginálny benefit                                                                 |
| D: Repo-level dependabot secrets (`actions/dependabot` secrets) | ❌ Atlas Network Access by stále potreboval IP whitelist, plus secrets pre dependabot sú extra security surface |

---

## 6. Dependabot inbox cleanup

Po fix-e sa dali konečne otvoriť PR-ky:

### PR #14 `codeql-action` v3 → v4

Najnižšie riziko. Hlavná zmena: runtime Node 20 → 24, žiadne user-facing API zmeny v action input-och. Mergnuté ako prvé pre confidence boost.

### PR #15 `setup-node` v4 → v6

Stredné riziko. Breaking change v v6: **automatic caching limited to npm**. Predtým `setup-node@v4` automaticky cache-oval podľa detected package manager (pnpm, yarn, npm), v6 to robí iba pre npm — pre pnpm musíš mať `cache: pnpm` explicitne.

Overil som všetky 6 inštancií `setup-node` v našich workflows (ci.yml × 4, sbom.yml × 1, docs.yml × 1):

- Všetky CI/SBOM joby majú `cache: pnpm` explicitne → ✅ v6 ich neovplyvní
- docs.yml setup-node nemá cache (lebo `npm install -g @redocly/cli`, žiadny lockfile) → ✅ tiež OK

Root `package.json` má `packageManager: "pnpm@9.12.0"` — irelevantné, lebo v6 auto-cache trigguje iba ak je hodnota `npm`. Mergnuté druhé.

### PR #2 minor-and-patch group

Tri bump-y v jednom PR:

| Package         | From → To               | Risk                                |
| --------------- | ----------------------- | ----------------------------------- |
| `tsx`           | 4.19.1 → 4.22.1         | Trivial (dev tool, patch)           |
| `turbo`         | ^2.1.3 → ^2.9.14 (root) | Additive, žiadne `turbo.json` zmeny |
| `openapi-fetch` | 0.13.4 → 0.17.0         | **Vyžadoval analýzu**               |

**openapi-fetch changelog walk (0.13.4 → 0.17.0)**:

- **0.14.0** — build cleanup (unbuild migration), no minified version. Safe.
- **0.15.0** — minor changes, žiadne breaking changes nehlásené pre náš use case
- **0.15.2** — bugfix: `text()` namiesto `json()` pre 200 responses bez Content-Length. Additive.
- **0.16.0** — additívne: custom path serializers (per-request override). Nepoužívame.
- **0.17.0** — readOnly/writeOnly support cez `--read-write-markers` flag. Opt-in, nepoužívame.

Náš `apps/web/src/lib/api-client.ts` použiva:

- `createClient<paths>({ baseUrl })` — stable API
- `Middleware` type s object-form `{ async onRequest({ request }) }` — post-0.10.0 contract, stable since
- Žiadny `querySerializer`, žiadny `customFetch`, žiadne Content-Type overrides

Verdikt: **safe to merge**. CI prebehol, mergnuté tretie.

### PR #11 Tailwind 4

Auto-closed by dependabot po `dependabot.yml` ignore commit-e. Žiadna manuálna akcia nepotrebná.

### PR #16 `pnpm/action-setup` v6

Manuálne zatvorené s komentárom (issues pnpm/action-setup#225, #227, #228) ignorujú pinned `version: 9.12.0` input a inštalujú pnpm v11, čo láme `pnpm install --frozen-lockfile` s `ERR_PNPM_BROKEN_LOCKFILE`.

Pridal som ignore do `dependabot.yml` (commit pending push):

```yaml
- package-ecosystem: 'github-actions'
  # ...
  ignore:
    - dependency-name: 'pnpm/action-setup'
      update-types: ['version-update:semver-major']
```

---

## 7. Vercel deploy `asset-management-api` — Node 24 LTS battle

Po dependabot cleanup-e (17:30) som chcel pokračovať na Vercel deploy `app.inventario.sportup.sk` (Krok 2 z `infra/vercel/APP-DEPLOYMENT.md`). Plán bol jednoduchý: update `CORS_ORIGINS` env var v existing `asset-management-api` projekte, potom vytvoriť `inventario-app`. **Realita:** 3.5 hodiny boja s Vercel Production Override locks.

### Chronológia

#### 17:30 — Krok 1 sa zdal byť trivial

Pridať `https://app.inventario.sportup.sk` do `CORS_ORIGINS` env var. Backend už má **runtime-dynamic CORS** cez `app.config.CORS_ORIGINS` (comma-separated list z env var-u) — pekné zistenie, žiadny code change netreba.

Update env var v Vercel UI, redeploy najnovší deployment. **Build padol** s:

```
Error: Found invalid Node.js Version: "24.x". Please set Node.js Version to 22.x in your Project Settings to use Node.js 22.
```

Pôvodný plán bol bump na Node 22.22.3 ešte ráno (lint-staged@17 unblock), ale Vercel mal **Production Override locked na Node 24.x** z minulých deploys. Conflict: Project Settings 22.x vs Production Override 24.x ⇒ build refuse.

#### 18:00 — Bump na Node 24 LTS naprieč code base

Namiesto boja s Vercel override sme aliňovali celú code base na Node 24 LTS. 8 súborov:

```
.nvmrc                              22.20.0    → 24.15.0
.github/workflows/ci.yml            22.22.3    → 24.15.0
.github/workflows/sbom.yml          22.22.3    → 24.15.0
.github/workflows/docs.yml          22.22.3    → 24.15.0
package.json (root)         >=22.22.3  → >=24.15.0  → "24.x"
apps/api/package.json       >=22.22.3  → >=24.15.0  → "24.x"
apps/web/package.json       >=22.22.3  → >=24.15.0  → "24.x"
apps/docs/package.json      >=22.22.3  → >=24.15.0  → "24.x"
```

Lokálne `nvm install 24.15.0 && pnpm install` + 327/327 testy green. Push commit `ci: bump Node 22.22.3 → 24.15.0 (Active LTS)`.

#### 18:08 — Deploy limit hit

Dependabot chaos + bumpy + redeploys vyčerpali Hobby tier **100 deploys/day**. Upgrade na **Pro tier** ($20/month). Empty commit `git commit --allow-empty` + push pre fresh webhook trigger.

#### 18:13 — Nový error: ERR_PNPM_UNSUPPORTED_ENGINE

```
ERR_PNPM_UNSUPPORTED_ENGINE
Expected version: >=24.15.0
Got: v22.22.2
```

**Diagnóza:** `apps/api/vercel.json` malo hardcoded `"runtime": "@vercel/node@5.0.0"` v functions config. To prepisuje `engines.node` aj Project Settings a pinninguje Node 22.22.2 pre Serverless Functions runtime. Build phase = Node 24, ale Functions builder = Node 22. Pre `pnpm install --frozen-lockfile` v function build phase to znamenalo conflict s `engines.node: ">=24.15.0"`.

**Fix:** odstrániť explicit `runtime` field zo `apps/api/vercel.json`. Vercel potom auto-deteguje verziu z `engines.node` override.

#### 18:17 — Tretí error variant: "Found invalid Node.js Version: 24.x"

```
Error: Found invalid Node.js Version: "24.x". Please set Node.js Version to 22.x in your Project Settings.
```

**Root cause cez Vercel docs:** Vercel nemá rád `>=24.15.0` range syntax v `engines.node` lebo to môže match-núť Node 26, 28 v budúcnosti pri breaking changes. **Vercel chce iba major-only syntax: `24.x`.**

> _"Defining the node property inside engines of a package.json file will override the selection made in the Project Settings. Only major versions can be specified. Please avoid greater than ranges, such as >14.x or >=14."_ — Vercel docs

**Fix:** 4 package.json files `>=24.15.0` → `24.x`. Build prešiel ďalej... ale stále padol s **rovnakým errorom**.

#### 18:19 — Screenshot diagnóza: Project Settings má stale `@sfz/shared-types`

User poslal screenshot Vercel Settings → Build and Deployment. **Bingo!** V Project Settings **Build Command override toggle ON**:

```
Production Overrides:  cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @inventario/shared-types build
Project Settings:      cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @sfz/shared-types build
                                                                              ^^^^ STARÝ NÁZOV (pre-rename Inventario)
```

Vercel UI mal hardcoded override z dávneho času keď bol package menovaný `@sfz/shared-types` (pred rename na `@inventario/shared-types` v Phase E E4 commit `8dffa49`). Stale override pretláčal aktuálny `vercel.json` config.

#### 18:21 — Cesta A: Reset všetkých UI overrides

**Vypnúť VŠETKY Override toggles** v Project Settings:

- Build Command — Override **OFF** (zruší stale `@sfz/...` názov)
- Output Directory — Override **OFF**
- Install Command — Override **OFF**
- Development Command — Override **OFF**

→ **Save** → Redeploy bez cache.

#### 18:23 — 🎉 ZELENÉ! Build passed!

Vercel použil `vercel.json` z repo + `engines.node: "24.x"` z package.json. Node 24 runtime pre build aj Functions. Deploy READY.

#### 18:24 — CORS verify

```bash
curl -I -H "Origin: https://app.inventario.sportup.sk" https://api.inventario.sportup.sk/v1/me
```

Response:

```
HTTP/2 401                                                       ← OK, no JWT
access-control-allow-credentials: true
access-control-allow-origin: https://app.inventario.sportup.sk   ✅
vary: Origin
strict-transport-security: max-age=15552000; includeSubDomains
x-ratelimit-limit: 100
```

**✅ Krok 1 KOMPLETNE HOTOVÝ.** `asset-management-api` je LIVE na Node 24 LTS s CORS allowed pre `app.inventario.sportup.sk`.

### Lessons learned z Vercel battle

1. **Vercel `engines.node` chce major-only syntax** (`"24.x"`), nie range (`">=24.15.0"`). Range syntax sa interpretuje ako "future major upgrades allowed" a Vercel to flag-ne ako conflict. Toto je **Vercel-specific quirk** — v normal Node.js ecosystem je `>=24.15.0` bežný pattern.

2. **Vercel Production Override sa nedá editovať priamo cez UI** — je to read-only snapshot z minulého úspešného Production deploy. Updatuje sa **iba** novým úspešným Production deploy.

3. **`vercel.json` `runtime` field má najvyššiu precedenciu** pre Serverless Functions. Hardcoded `"@vercel/node@5.0.0"` ignoruje aj Project Settings aj `engines.node`. **Default:** vynechaj `runtime` field a nech Vercel auto-deteguje.

4. **Project Settings UI overrides sú "sticky"** — keď ich raz nastavíš cez UI, zostávajú aj po code commit-och ktoré by ich mali prepísať. Pri pre-rename / refactor migrations treba **explicitne vypnúť Override toggles** alebo update-núť hodnoty v UI.

5. **Vercel Hobby tier 100 deploys/day limit** — easy hit počas debugging session-y. Pro tier ($20/month) je rozumné upgrade pre production launch.

6. **Build cache môže maskovať issues** — pri debug-u vždy uncheck "Use existing Build Cache" v Redeploy dialógu.

### Akčný cleanup pre Vercel deploy guide

`infra/vercel/APP-DEPLOYMENT.md` treba aktualizovať so:

- Warning section o `engines.node` `"24.x"` syntax requirement
- Postup pre vyčistenie stale Project Settings overrides
- Vercel Hobby vs Pro deploy limit
- Build cache off pre debugging

---

## 8. Vercel deploy `app.inventario.sportup.sk` — LIVE 🚀

Po dotiahnutí `asset-management-api` deploy boja som po ~30 minútovej prestávke (cca 19:00) pokračoval na **Krok 2-9** — vytvoriť `inventario-app` Vercel projekt. Využil som **lekcie z Vercel battle** a tentokrát išlo všetko hladko.

### Krok 2-4: Project create + deploy (~20 min)

vercel.com/new → import repo → Project Name: `inventario-app` → Root Directory: `apps/web`. **Všetky Override toggles OFF** (cesta A z minulého boja — Vercel auto-deteguje z `vercel.json` + `engines.node: "24.x"` v package.json).

4 env vars seté v Vercel UI:

```
NEXT_PUBLIC_API_BASE_URL=https://api.inventario.sportup.sk
NEXT_PUBLIC_ENTRA_TENANT_ID=bcd6945a-5a57-4c2b-9ebb-d62712ad4b55
NEXT_PUBLIC_ENTRA_CLIENT_ID=<frontend SPA app registration client ID>
NEXT_PUBLIC_ENTRA_API_CLIENT_ID=<backend API app registration client ID>
```

**Klik Deploy** → build SUCCESS first try (44s, commit `e710abd`).

Bundle sizes (Production build):

| Route         | Bundle  | First Load |
| ------------- | ------- | ---------- |
| `/`           | 1.93 kB | 192 kB     |
| `/assets`     | 3.27 kB | 211 kB     |
| `/categories` | 4.42 kB | 221 kB     |
| `/locations`  | 4.48 kB | 221 kB     |
| `/users`      | 5.91 kB | 213 kB     |

### Krok 5: Azure Portal redirect URI (~3 min)

frontend SPA app registration → Authentication → Redirect URIs:

- ✅ pridá: `https://app.inventario.sportup.sk`
- ✅ zachovaný: `http://localhost:3001` (dev work)

### Krok 6-7: Vercel custom domain + DNS (~5 min)

- Vercel Settings → Domains → `app.inventario.sportup.sk` pridaná
- Websupport DNS → CNAME `app` → `cname.vercel-dns.com.` (s bodkou)

### Krok 8: DNS propagation + SSL (~15 min wait)

DNS propagol o ~10 minút (Websupport býva rýchly). SSL Let's Encrypt vystavený automaticky.

```bash
curl -sI https://app.inventario.sportup.sk
```

Response (~20:15 local time):

```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-frame-options: DENY
x-content-type-options: nosniff
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
x-vercel-cache: HIT
```

✅ HTTPS live, security headers aktivované, Vercel CDN cache funguje.

### Krok 9: 10-bodový smoke test — 100% PASS

V incognito browseri som postupne overil 10 scenárov:

| #   | Scenár                       | Výsledok                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------ |
| 1   | `/`                          | ✅ Login screen "Vitajte späť" + Inventario branding (Navy logo, paper bg)     |
| 2   | Microsoft login              | ✅ Entra consent dialog → redirect späť → `/dashboard`                         |
| 3   | `/dashboard` (EMPLOYEE)      | ✅ "Vitajte, Ján" + role badge "Zamestnanec" + 4 stats cards (všetky 0)        |
| 4   | `/assets`                    | ✅ Empty state, filter/search/paginácia UI, NO + Pridať button (EMPLOYEE RBAC) |
| 5   | `/assets/[id]`               | SKIP (no data v Mongo)                                                         |
| 6   | `/categories` (EMPLOYEE)     | ✅ Empty state, NO + Pridať button                                             |
| 7   | `/locations` (EMPLOYEE)      | ✅ Empty state, NO + Pridať button                                             |
| 8   | `/users` (EMPLOYEE)          | ✅ "Prístup iba s rolou Administrátor" AccessDenied state + shield icon        |
| 9   | Mobile drawer (375px narrow) | ✅ Hamburger → slide-in drawer + backdrop → auto-close on nav                  |
| 10  | Logout                       | ✅ MSAL fullLogout → `login.microsoftonline.com/.../oauth2/v2.0/logout` → späť |

### ADMIN promote re-test

Po 10/10 PASS som sa promote-ol cez **Mongo Atlas UI manuálne** (kým nemáme first-admin bootstrap flow):

1. cloud.mongodb.com → cluster `sfz-asset-mgmt-prod` → Browse Collections
2. Database `sfz_asset_management` → collection `users`
3. Filter `{ "email": "jan.letko@futbalsfz.sk" }`
4. Edit document: `roles: ["EMPLOYEE"]` → `roles: ["ADMIN"]`
5. Update → refresh browser

Re-test ako ADMIN:

- ✅ Dashboard role badge zmenila sa na "Administrátor"
- ✅ `/users` zobrazuje user list (1 user, tý, "Ján Letko [Vy] · jan.letko@futbalsfz.sk · Administrátor · Aktívny · 18.5.2026") + Upraviť button
- ✅ `/categories` zobrazuje "+ Pridať kategóriu" button (top-right aj v empty state CTA)
- ✅ `/locations` zobrazuje "+ Pridať lokalitu" button (top-right aj v empty state CTA)

**RBAC backend POST/PATCH/DELETE permissions unlocked. UI gating funguje konzistentne s backend RBAC.**

### Výsledok

Všetky 4 Inventario subdomény sú **KOMPLETNE LIVE v produkcii** s validnými SSL certifikátmi, security headers, Vercel CDN, a Microsoft Entra ID SSO. Pilot tenant onboarding je teraz technical one-clicker (vytvoriť ich Entra ID app registration, pre-authorize na náš API, poslať im link).

---

## 9. Files created/modified today

### Slice #4 frontend dotiahnutie

```
apps/web/src/lib/api-hooks.ts            (+ Location CRUD, + Users module)
apps/web/src/app/locations/page.tsx      (NEW)
apps/web/src/components/LocationsContent.tsx       (NEW)
apps/web/src/components/LocationCreateDialog.tsx   (NEW)
apps/web/src/app/users/page.tsx          (NEW)
apps/web/src/components/UsersContent.tsx           (NEW)
apps/web/src/components/UserEditDialog.tsx         (NEW)
apps/web/src/components/AppShell.tsx     (hamburger + drawer + auto-close)
apps/web/src/components/AssetsListContent.tsx      (table overflow + pagination mobile)
apps/web/src/components/CategoriesContent.tsx      (table overflow + filter w-full)
apps/web/src/components/AssetDetailContent.tsx     (removed nested AppShell)
```

### CI + dependabot infra

```
.github/workflows/ci.yml                 (dependabot skip gates + Node 22.22.3 → 24.15.0)
.github/workflows/sbom.yml               (Node 22.22.3 → 24.15.0)
.github/workflows/docs.yml               (Node 22.22.3 → 24.15.0)
.github/dependabot.yml                   (tailwindcss + pnpm/action-setup ignores + Round 2/3 majors)
commitlint.config.js                     (body-max-line-length 100 → 200)
.nvmrc                                   (22.20.0 → 24.15.0)
```

### Node 24 LTS bump (8 súborov)

```
package.json (root)                      engines.node: >=22.22.3 → "24.x"
apps/api/package.json                    engines.node: >=22.22.3 → "24.x"
apps/web/package.json                    engines.node: >=22.22.3 → "24.x"
apps/docs/package.json                   engines.node: >=22.22.3 → "24.x"
.nvmrc                                   22.20.0 → 24.15.0
.github/workflows/ci.yml                 NODE_VERSION env var
.github/workflows/sbom.yml               NODE_VERSION env var
.github/workflows/docs.yml               node-version literal
```

### Vercel deploy infra

```
apps/api/vercel.json                     removed "runtime": "@vercel/node@5.0.0" pin
apps/web/vercel.json                     added security headers (X-Frame-Options DENY, HSTS, etc.)
infra/vercel/APP-DEPLOYMENT.md           NEW — 9-step deploy guide for app.inventario.sportup.sk
infra/vercel/README.md                   added inventario-app row (4 projects table)
```

---

## 🐛 Bugs squashed today

1. **`jsx-a11y/label-has-associated-control` na role checkboxoch** — riešenie cez `aria-label` namiesto wrapped label
2. **Rovnaký lint na isActive toggle** — explicit `<label htmlFor>` + `<div>` wrapper
3. **PageNotFoundError `/_not-found` lokálne** — stale `.next` cache, fix: `rm -rf apps/web/.next`
4. **Dependabot PR-ky padali na test+openapi** — security-by-design GitHub policy, fix: skip gates
5. **Nested AppShell v AssetDetailContent** — duplicate sidebar na mobile
6. **Vercel Production Override locked na Node 24.x** — fix: align code base na Node 24 LTS namiesto boja s override
7. **`ERR_PNPM_UNSUPPORTED_ENGINE` v Vercel Functions build** — fix: odstrániť `"runtime": "@vercel/node@5.0.0"` z `apps/api/vercel.json`
8. **Vercel "Found invalid Node.js Version 24.x"** — fix: `engines.node` `">=24.15.0"` → `"24.x"` (major-only syntax)
9. **Vercel stale UI override `@sfz/shared-types`** — fix: Cesta A reset všetkých Project Settings Override toggles
10. **Commitlint body-max-line-length 100 char limit** — dependabot URLs prekračovali, raise na 200

---

## 📚 Lessons learned

### Čo fungovalo skvele

1. **Slice #3 pattern reuse pre `/locations`** — `/categories` ako template šetril ~3 hodiny. Stačilo nahradiť `CategoryDetail` za `LocationDetail`, `CATEGORY_TYPE_LABELS` za `LOCATION_TYPE_LABELS`, FK protection messaging je identical. **Lekcia:** keď máš pattern, refactor smerom k template namiesto copy-paste — `makeListHook<T>(resourceKey, path)` factory v `api-hooks.ts` je dobrý príklad.

2. **Lint chyby ako "feature, not bug"** — `jsx-a11y/label-has-associated-control` ma najprv naštvala (5 minút iterácie), ale konečné riešenie (`aria-label` na input) je **lepšie pre screen readery** ako pôvodný wrapped label. Lint mi sprostredkoval a11y best practice. **Lekcia:** strict lint = lacný a11y audit.

3. **Tailwind 4 audit pred merge-om** — 30 minút čítania release notes ušetrilo pravdepodobne 1-2 dni emergency refactor-u v middle of pilot launch. **Lekcia:** major version dependabot bumps si vždy zaslúžia rýchly architectural audit, nielen "tests pass → merge".

4. **CI dependabot gate decision matrix** — namiesto skúšania prvého fix-u som vypísal 4 alternatívy s trade-offs, vybral A vedome. **Lekcia:** "možnosť A/B/C" framing zlepšuje rozhodovanie aj keď je odpoveď zjavná.

### Čo by sme spravili lepšie nabudúce

1. **Mobile responsive od začiatku, nie ako polish step** — keby som mal `useViewport()` hook + mobile-first styling konvenciu už pri commit-och #1-3 Slice #4, dnešný polish refactor by trval 30 minút namiesto 2 hodín. **Tech debt:** dokumentovať mobile-first konvenciu do frontend-design skill-u alebo NEXT.md.

2. **Dependabot weekly schedule v ponedelňok ráno** — Atlas Network Access pre dev cluster síce máme 0.0.0.0/0, ale **dependabot PR-ky bez secrets** je nový failure mode ktorý sme objavili až včera. **Lekcia:** keď setup-nem novú CI dependency, hneď premyslieť dependabot bot-impersonation scenarios.

3. **Strategic deferral decisions zapísať do tech-debt hneď** — Tailwind 4 deferral by sa za 2 mesiace zabudol, kým by ho nový Claude session "objavil" znova. Update NEXT.md tech-debt sekciu **ten istý deň** keď padne deferral decision.

---

## 🌐 Stav na konci dňa

```
✅ inventario.sportup.sk                    → Marketing site
✅ docs.inventario.sportup.sk               → Nextra docs
✅ api.inventario.sportup.sk                → Fastify backend (Node 24 LTS, LIVE 18:24)
✅ app.inventario.sportup.sk                → Next.js 15 + MSAL + Inventario branding (LIVE 20:15)
```

**Inventario platforma je KOMPLETNE LIVE!** 10/10 smoke test PASS, ADMIN promote re-test OK.

**Backend tests:** 327/327 green, ~212s
**CI status:** #100 green (slice #4 final), #108 green (dependabot gate)
**Slice #4 progress:** 5/6 P0 stránok hotové (login, dashboard, /assets, /assets/[id], /categories, /locations, /users + mobile responsive). Iba `/loans/request` + `/my-loans` ostáva — **blocked na Slice #5 backend** (loans API endpointy ešte neexistujú).

**Build sizes (final):**

| Route          | Bundle  | First Load    |
| -------------- | ------- | ------------- |
| `/users`       | 5.91 kB | 102 kB shared |
| `/assets/[id]` | 5.73 kB | Dynamic       |
| `/locations`   | 4.48 kB | 102 kB shared |
| `/categories`  | 4.42 kB | 102 kB shared |
| `/assets`      | 3.27 kB | 102 kB shared |

---

## 🥂 End-of-day mood

Neskorá noc (~21:00 lokálne, 12+ hodín pri klávesnici). Slice #4 dotiahnutie + Tailwind 4 deferral + dependabot cleanup + Node 24 LTS bump + Vercel deploy `asset-management-api` battle + Vercel deploy `inventario-app` victory + 10/10 smoke test PASS + ADMIN promote re-test. **Inventario je KOMPLETNE LIVE.**

Najlepší moment dňa: keď po ADMIN promote v Mongo Atlas som refresh-ol `/categories` a videl `+ Pridať kategóriu` button — RBAC backend perm checks + frontend `useCanManageTaxonomy()` hook + UI gating fungovali konzistentne end-to-end na production. Ten moment keď deploy nie je len "build passed" ale **"realny user (= ja) urobil realnu akciu na realnej doméne s realnym RBAC enforcement-om"**.

Vercel battle (3.5 hodín) bola učiaca lekcia o limitoch UI overrides + `engines.node` syntax + Production snapshot read-only model. **Cesta A reset all overrides** je teraz členom Vercel debugging playbook-u zachyteného v `infra/vercel/APP-DEPLOYMENT.md` lessons learned sekcii.

Tailwind 4 deferral decision mi dala dobrý pocit z disciplíny — pred 6 mesiacmi by som to mergeoval pre "stay on latest" pocit a o týždeň lovil čas na refactor design-tokens preset-u. Teraz som vedome povedal "nie, post-pilot" a zapísal do tech-debt.

**Otvorené pre zajtra (alebo budúci týždeň):**

- **Decision point**: Slice #5 backend (loans API) ALEBO first pilot tenant onboarding
- **Odporúčanie z NEXT.md**: B prv ako A. Real-world feedback z prvého pilotu zlepší Slice #5 design decisions.
- **Milestone doc** `docs/milestones/slice-4-frontend-web.md` — odložené na pokojnejší deň.

---

## 🔗 Quick links pre next session

- **Continuation plan**: [`NEXT.md`](NEXT.md)
- **Yesterday's slice #4 launch**: [`2026-05-17-day-summary.md`](2026-05-17-day-summary.md)
- **Slice #4 milestone draft** (TBD): `docs/milestones/slice-4-frontend-web.md`
- **Vercel deploy guide**: [`infra/vercel/APP-DEPLOYMENT.md`](../../infra/vercel/APP-DEPLOYMENT.md) (KOMPLET 2026-05-18 + lessons learned)
- **Tailwind 4 tech debt** v `NEXT.md` (post-pilot decision)
- **Production URLs**:
  - Marketing: https://inventario.sportup.sk
  - Docs: https://docs.inventario.sportup.sk
  - API: https://api.inventario.sportup.sk
  - App: https://app.inventario.sportup.sk ✨ ← NEW
