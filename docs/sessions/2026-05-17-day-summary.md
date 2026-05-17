<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Day summary · 2026-05-17 (Sunday)

> Slice #4 launch deň. Frontend `apps/web` od nuly k funkčnému login-flow + dashboard + assets list + assets detail page. Plus večerný debug maratón cez Microsoft Entra setup → JIT provisioning bug → live fix.

---

## TL;DR

Po dvoch backendových fázach (D EU compliance, E tech debt) sa konečne dostávame k **Slice #4 — frontend `apps/web`**. Plán bol B-C-D-E-A (frontend posledný, aby sa neprepisoval pri každej tenant/compliance migrácii); A nastalo dnes.

Na konci dňa:

- ✅ **5 frontend commitov** v Slice #4 queue (4 pushnuté, 1 čaká)
- ✅ **Microsoft Entra ID login funguje** end-to-end (SPA → API → JIT user + tenant provisioning)
- ✅ **`/assets`, `/assets/[id]`** stránky funkčné
- ✅ **327/327 backend testov stále green**
- ✅ **CI #84 green** po fix-e gitignored `api-types.ts`

A pekná **lekcia z debugovania** o legacy DB recordoch, defensive coding a tom prečo `String(undefined) === 'undefined'` je v TypeScripte ticha bomba.

---

## 🎯 Commit log

| #   | Commit         | Čo                                                                            | CI    |
| --- | -------------- | ----------------------------------------------------------------------------- | ----- |
| 1   | `0cac2e6`      | feat(web): MSAL auth shell + openapi-fetch client + AppShell/AuthGate/Login   | red   |
| 2   | `77b51e8`      | feat(web): dashboard with 4 stats cards + TanStack Query api-hooks            | red   |
| 3   | `a5e8b2e`      | feat(web): /assets list page with pagination + filter + search                | red   |
| 4   | `8766c93`      | fix(ci): regenerate gitignored api-types.ts via pretypecheck/prelint/prebuild | green |
| 5   | _(pre-commit)_ | docs(sessions): NEXT.md update + dnešný day-summary draft                     | n/a   |
| 6   | _(pending)_    | feat(web): /assets/[id] asset detail page with read + edit modes              | tbd   |

Commit #4 (`8766c93`) prepol CI z **červenej** (commits #1-3) na **zelenú** — gitignored generated file bola tichá bomba ktorá funguje lokálne ale padá na čistom CI checkout-e.

---

## 1. Slice #4 launch — bootstrap, auth, dashboard

### `0cac2e6` — MSAL auth shell

Najťažší commit zo všetkých, lebo definuje auth pipeline na ktorej stojí celá appka.

**Komponenty:**

- **MSAL Browser** + `@azure/msal-react` provider v `apps/web/src/app/providers.tsx`
- **`msal-config.ts`** — `clientId` / `tenantId` / `apiClientId` z `NEXT_PUBLIC_*` env vars, scope `api://<api-client-id>/access_as_user`
- **`api-client.ts`** — openapi-fetch wrapped do middleware ktorá pred každým API requestom volá `acquireTokenSilent()` a injectuje `Authorization: Bearer <token>` header
- **`AppShell.tsx`** — sticky header (logo + user name + role badge + Odhlásiť sa), sidebar (Dashboard / Majetok / Výpožičky / Kategórie / Lokality / Používatelia), responsive
- **`AuthGate.tsx`** — wrapper komponent ktorý buď renderuje children ak je user prihlásený, alebo redirect na `/login`
- **`/login` page** — pekný card layout s "Vitajte späť" + "Prihlásiť sa cez Microsoft" CTA + EU trust badges

### `77b51e8` — Dashboard

Po prihlásení sa user dostane na `/dashboard`. Komponenty:

- **Personalizovaný greeting** z `useMe()` — "Dobré ráno, Ján! / Dobrý deň, Ján! / Dobrý večer, Ján!" podľa `getHours()`
- **4 stats cards** — Majetok / Kategórie / Lokality / Výpožičky (posledné placeholder, loans API ešte neexistuje)
- **Quick navigation grid** — 4 large CTA boxy linkujúce na hlavné moduly
- **TanStack Query api-hooks vrstva** — `useMe()`, `useAssets()`, `useCategories()`, `useLocations()` v `apps/web/src/lib/api-hooks.ts`. Query keys ako `['me']`, `['assets', { limit, skip }]`, atď. Reusable v celej appke.

### `a5e8b2e` — `/assets` list page

Najpoctivejší kus dnešnej práce z UX/a11y stránky:

- **Server-side pagination** (page size 20/50/100) + skip/limit
- **Client-side filter** podľa statusu + free-text search (debounced)
- **FK resolution cez `Map<id, summary>`** — categories + locations sa fetchnu raz, držia v `Map` štruktúre pre O(1) lookup pri rendrovaní riadkov tabuľky
- **Accessible `<table>`** so `<th scope="col">` headers + `aria-live="polite"` region pre announcement výsledkov pri filtri
- **Status badge tone mapping** — `STORED / IN_USE / IN_REPAIR / RETIRED` → semantic tokens cez `@inventario/design-tokens`
- **Row link** na `/assets/${_id}` — pripravená cesta pre detail page (vtedy ešte 404, opravené v commit-e #6)

---

## 2. CI fix — gitignored generated file (`8766c93`)

Commits #1-3 mali **zelený lokálny lint+typecheck+build**, ale na CI padali červené. Postupné debugovanie:

### Krok 1: lokálna repro CI sekvencie

```bash
# CI workflow má:
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm openapi:export
```

Lokálne všetko prešlo. Žiadny rozdiel medzi env premennými. **Single difference**: CI začína z **čistého git checkout-u**, lokál má roky histórie a build artifacts.

### Krok 2: hľadanie gitignored súborov ktoré build očakáva

`apps/web/src/lib/api-types.ts` je generovaný z `apps/api/openapi.json` cez `pnpm generate:api-types`. Je v `.gitignore` (deterministická projekcia, nie zdrojový kód). Lokálne je prítomný z predchádzajúceho behu. Na CI nie je. → `TS2307: Cannot find module './api-types'`.

### Krok 3: tri možné riešenia

| Možnosť | Popis                                                            | Verdikt                                                      |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| A       | npm lifecycle hooks v `package.json` (`pretypecheck`, `prelint`) | ✅ chosen — zero CI změn, lokálne aj CI dostanú rovnaký flow |
| B       | Pridať `pnpm generate:api-types` do CI workflow                  | CI-only fix, lokálne by sa stále dalo zabudnúť               |
| C       | Commitnúť `api-types.ts` (zo gitignore von)                      | Otvára otázku merge konfliktov + duplicitnej truth           |

**Výsledok:** `apps/web/package.json`:

```json
{
  "scripts": {
    "pretypecheck": "pnpm generate:api-types",
    "prelint": "pnpm generate:api-types",
    "prebuild": "pnpm generate:api-types",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "build": "next build"
  }
}
```

Bonus fix v tom istom commite: `apps/docs/public/_pagefind/` pridaný do `.prettierignore` (rovnaký pattern — gitignored generated content z Nextra build-u, ktorý lokálne existuje a pri format:check by sa formátoval, ale na CI by zlyhal lebo neexistuje).

### Try-failed odbočka

Pred fix-om A som skúsil rýchlu cestu — sandbox shell, `gh` CLI, ručne triggernuť CI re-run. Failed: Claude sandbox proxy blokuje `api.github.com` aj `release-assets.githubusercontent.com`. `apt install gh` prejde (Ubuntu archive je v allowliste), ale auth/exec cesta je zatvorená. Pridané do mentálneho modelu: **`gh` CLI cez Claude Code nikdy nepôjde**, vždy ručný push cez GitHub Desktop alebo terminál na host-e.

---

## 3. `/assets/[id]` asset detail page (čaká na commit)

Logicky druhý z 6 P0 obrazoviek. Riadky tabuľky na `/assets` mali `<Link href="/assets/${_id}">` na inventory number → ten link doteraz viedol do 404.

### Rozhodnutia

**Toggle read/edit mode** namiesto kariet s tabmi:

- ✅ Možnosť A (chosen): jedna stránka s tlačidlom "Upraviť" → page swap na edit formulár → "Uložiť"/"Zrušiť" späť na read view
- ❌ Možnosť B: tabs "Vlastnosti / História zmien / Výpožičky / Prílohy" — odložené, lebo 3 zo 4 tabov vyžadujú API endpointy ktoré ešte neexistujú (audit log read, loans, attachments)

**HTML5 validation namiesto Zod resolver**:

- Shared `UpdateAssetSchema` je fully `.partial()` → nedokáže rozpoznať required-blank stav
- Date polia: backend čaká ISO string na wire, Zod by parsoval do `Date` objektu
- HTML5 `required` + `maxLength` + `pattern` attribútov stačí pre user-facing validáciu, backend je pravý source of truth

**Dirty-fields-only PATCH payload**:

- React Hook Form drží `formState.dirtyFields` — submit handler posiela iba zmenené fieldy, nie celý form
- Menší payload + menšie riziko lost-update race pri concurrent edit-och
- Backend `PATCH /v1/assets/:id` už správne handluje partial updates (computeShallowDiff)

**Generic specs key-value table**:

- Asset má `specs: Record<string, unknown>` (free-form JSON pre per-category vlastnosti)
- `humanizeKey('ramGb')` → "Ram Gb" cez regex split na camelCase boundary
- `formatSpecValue(unknown)` → `JSON.stringify(value)` s 200-character truncation pre nested objekty

**RBAC gating cez `useCanEditAssets()` hook**:

- Pessimistic: vracia `false` kým `/v1/me` loaduje (UI sa nemiha medzi režimami)
- EMPLOYEE: vidí read view + žiadny "Upraviť" gombík
- ASSET_MANAGER + ADMIN: vidí read view + "Upraviť" gombík → klik → edit form

### Komponentová štruktúra

```
apps/web/src/app/assets/[id]/page.tsx          # Next.js dynamic route, async Server Component
apps/web/src/components/AssetDetailContent.tsx # Orchestrator: skeleton, ErrorState, mode toggle
apps/web/src/components/AssetDetailReadView.tsx # Sectioned read layout, FK resolution, sk-SK dates
apps/web/src/components/AssetDetailEditForm.tsx # react-hook-form + dirty-fields PATCH
```

### Bugs nájdené počas lokálnej CI sekvencie

1. **`import/order` ESLint pravidlo** — type-imports z `react` musia ísť **po** internal value imports z `./...`, ale **pred** `@/...` value imports (alphabetical within type group)
2. **`exactOptionalPropertyTypes: true` typecheck** — Field prop `error?: string` odmietol `string | undefined`. Fix: `error?: string | undefined` (a rovnako pre `required` a `hint`)
3. **`useAsset` hook attaching HTTP status** — openapi-fetch typoval `response` ako `never` (spec nedeklaruje error responses). Fix: cast cez `(result as unknown as { response?: Response }).response` + `if (response?.status != null)` guard pred priradením

### Final local CI sequence

```
✓ pnpm format:check       7 packages cached
✓ pnpm lint               7 packages cached
✓ pnpm typecheck          7 packages cached
✓ pnpm build              5 apps built, /assets/[id] dynamic route 15.2 kB / 221 kB First Load
✓ pnpm test               327/327 passed in 212s
```

---

## 4. Večerný debug maratón — Entra ID setup + JIT bug (~22:00–23:30)

Toto je samostatný príbeh ktorý nezačal kódom ale Microsoft Entra konfiguráciou.

### Krok 1: prvý pokus o login → `AADSTS900144: client_id missing`

Frontend `apps/web/.env.local` chýba. MSAL pošle prázdne `client_id` do `login.microsoftonline.com`. Triviálny fix, ale...

### Krok 2: backend API registration nemá "Expose an API"

Vytvorenie frontend SPA app registration v Azure Portal prešlo, ale pri kroku "API permissions → My APIs" sa nezobrazila backend API registration. Dôvod: backend bol pôvodne nakonfigurovaný len pre device-code flow (CLI testing), nikdy nebol exponovaný ako web API pre SPA klientov.

**Recipe (jednorazové nastavenie, zaznamenané pre dokumentáciu):**

1. Backend app registration → **Expose an API**
2. Set Application ID URI = `api://<backend-client-id>`
3. Add a scope: `access_as_user`, Admins+users consent, Enabled
4. Authorized client applications → pridať frontend SPA client ID + autorizovať scope (pre-authorization, vyhneme sa consent dialógu)
5. Frontend SPA app registration → API permissions → My APIs → vyber backend → `access_as_user` Delegated permission → Grant admin consent

### Krok 3: `.env.local` vytvorené, login prešiel, ale 3 z 4 endpointov padajú s 400

```
GET /v1/me                  → 200 OK ✅
GET /v1/assets?limit=20     → 400 "Malformed organisationId 'undefined' on a tenant-scoped operation"
GET /v1/categories?limit=200 → 400 (same)
GET /v1/locations?limit=200  → 400 (same)
```

Pinakl: backend log hovorí

```
[Current user + tenant loaded]
  userId: "6a042e3602e24f74e24c535f"
  roles: ["ADMIN"]
  organisationId: "6a0a2d5bc256d32e636a9501"   ← request.organisationId je platný
```

ale o 2 ms neskôr:

```
[Application error]
  message: "Malformed organisationId \"undefined\" on a tenant-scoped operation"
```

**Diagnóza:** literál `"undefined"` (string) v error message → niekde sa robí `String(undefined)`. Service vrstva má `String(actor.organisationId)`. Ak `actor.organisationId` je `undefined`, výsledok je `"undefined"` (string), ktorý prejde regex check na hex format → `BadRequestError` so spätnou referenciou na hodnotu.

**Root cause:** user record v MongoDB s `entraOid: "0c437485-..."` bol vytvorený **pred Phase C Blok 3** (multi-tenant migration). Document nemá `organisationId` pole vôbec. `findByEntraOid()` ho našiel, vrátil ako-je, JIT provisioning sa preskočil → `actor.organisationId` je `undefined`.

`request.organisationId` (z `loadCurrentUser` plugin-u) je platný, lebo ten sa resolvol z JWT `tid` claim → JIT-provisioned nová organisation. Ale service nepoužíva `request.organisationId`, používa `actor.organisationId` z user dokumentu.

### Krok 4: fix (manuálny v MongoDB Atlas)

1. MongoDB Atlas → `sfz_asset_management.users` → delete user record s `entraOid: "0c437485-..."`
2. MongoDB Atlas → `sfz_asset_management.organisations` → delete pre-Phase-C orgs (ak nejaké existujú)
3. Frontend refresh → MSAL silent token → backend `loadCurrentUser` → JIT-provisioning prebehne **znova**, tentoraz s plnou Phase C semantikou:
   - `findOrProvisionByEntraTenantId({ entraTenantId: claims.tid, ... })` vytvorí novú Organisation
   - `findOrProvision(claims, organisation)` vytvorí nového User s `organisationId: String(organisation._id)`
4. Refreshni `/assets` → **200 OK, empty list** (čerstvá tenant, nič v nej ešte nie je)

### Tech debt pre defensive coding (do NEXT.md)

`loadCurrentUser` v `apps/api/src/plugins/auth.ts` by mal po `findOrProvision` defenzívne overiť:

```typescript
if (!user.organisationId || user.organisationId !== request.organisationId) {
  throw new UnauthorizedError(
    'User record is missing tenant binding — re-provision required. ' +
      'This usually means a legacy user record from pre-Phase-C exists in the database.',
  );
}
```

To by chytilo legacy users s jasnou error message namiesto silent corruption v service vrstve neskôr. Pridané do tech-debt zoznamu v NEXT.md — nie hot fix, len defensive hardening.

### Bonus: tvoja prvá rola po JIT provisioning je EMPLOYEE

JIT-provisioned user dostane defaultne `roles: ["EMPLOYEE"]`. Aby si mohol vidieť "Administrátor" badge + používať admin-only akcie, ručne v MongoDB Atlas zmeniť na `["ADMIN"]`. Toto je očakávané správanie (slice #3 K10 prináša admin endpoint na povýšenie iných users), ale pre prvého usera v novej organizácii je inštalačný step.

---

## 5. Files created/modified today

### New files (apps/web)

- `apps/web/src/lib/msal-config.ts` — Entra ID configuration
- `apps/web/src/lib/api-client.ts` — openapi-fetch klient s token middleware
- `apps/web/src/lib/api-hooks.ts` — TanStack Query hooks vrstva
- `apps/web/src/components/AppShell.tsx` — sticky header + sidebar layout
- `apps/web/src/components/AuthGate.tsx` — redirect-to-login wrapper
- `apps/web/src/app/login/page.tsx` — login screen
- `apps/web/src/app/dashboard/page.tsx` + content komponent
- `apps/web/src/app/assets/page.tsx` + `AssetsListContent.tsx`
- `apps/web/src/app/assets/[id]/page.tsx` _(čaká na commit)_
- `apps/web/src/components/AssetDetailContent.tsx` _(čaká na commit)_
- `apps/web/src/components/AssetDetailReadView.tsx` _(čaká na commit)_
- `apps/web/src/components/AssetDetailEditForm.tsx` _(čaká na commit)_

### Modified files

- `apps/web/package.json` — lifecycle hooks + `react-hook-form` + `@hookform/resolvers`
- `apps/web/src/lib/api-hooks.ts` — +`useAsset` +`useUpdateAsset` +`useCanEditAssets`
- `.prettierignore` — `apps/docs/public/_pagefind/`, `apps/web/src/lib/api-types.ts`
- `docs/sessions/NEXT.md` — Slice #4 launch + day-summary reference

---

## 🐛 Bugs squashed today

1. **CI fail po `0cac2e6`/`77b51e8`/`a5e8b2e`** — gitignored `api-types.ts` neexistoval pri čistom CI checkout
2. **`AADSTS900144: client_id missing`** — chýbal `apps/web/.env.local`
3. **Frontend SPA neuvidí backend API v "My APIs"** — backend nemal "Expose an API" konfiguráciu
4. **`Malformed organisationId "undefined"`** — legacy user record bez `organisationId` z pre-Phase-C éry
5. **`import/order` ESLint** — type-imports z `react` v zlej pozícii
6. **`exactOptionalPropertyTypes` typecheck** — Field prop `error?: string` vs `string | undefined`

---

## 📚 Lessons learned

### Čo fungovalo skvele

1. **Lokálna repro CI sekvencie pred guess-fix-push cyklom** — namiesto skúšania náhodných opráv som pustil presne tú istú sekvenciu príkazov ako CI workflow. Rozdiel medzi green a red bol 1 príkaz (chýbajúci `pnpm generate:api-types` v pre-test fáze)
2. **Backend logy ako primárny diagnostický nástroj** — keď frontend ukáže červené hlášky "Položky sa nepodarilo načítať", pozri sa do **backend logu** kde je presná chyba. Pri Entra/auth/multi-tenant bugu by frontend-only debug trval hodiny, backend log to dal za 30 sekúnd
3. **"String(undefined) === 'undefined'" ako tichý killer** — TypeScript nezakázal `String(actor.organisationId)` keď field môže byť `undefined`. Defensive check v `loadCurrentUser` to zachytí pri zdroji namiesto stratenia sa v každom service-i jeden po druhom
4. **Workflow Possibility A/B/C pre rozhodovanie** — pri CI fixe som ponúkol 3 možnosti s trade-offs namiesto silnej preferencie, Ján sa rozhodol vedome

### Čo by sme spravili lepšie nabudúce

1. **Backend "Expose an API" malo byť hotové už pri Slice #2** — auth slice sme dotiahli iba pre device-code CLI testing, nie pre SPA klientov. Spôsobilo to **3-krokový recipe v Azure Portal** o niekoľko mesiacov neskôr keď frontend potreboval backend
2. **Wipe testovacej databázy po veľkých migration-och** — pre-Phase-C user record prežil 3 fázy backendu a explodol až keď frontend volal API. Lepšie by bolo mať `pnpm db:reset` skript ktorý vymaže legacy data po každom Phase milestone
3. **Defensive `loadCurrentUser` validation od začiatku** — kontrola `user.organisationId !== request.organisationId` mohla byť priamo v Phase C Blok 3 ako súčasť migration safety net

---

## 🌐 Stav na konci dňa

```
✅ inventario.sportup.sk                    → Marketing site
✅ docs.inventario.sportup.sk               → Nextra docs
⏳ app.inventario.sportup.sk                → Slice #4 (lokálne dev funguje, deploy plánovaný keď 4/6 P0 stránok hotové)
⏳ api.inventario.sportup.sk                → Q3 2026 plán
```

**Backend tests:** 327/327 green, ~212s
**CI status:** #84 green (po `8766c93`)
**Slice #4 progress:** 4 z 6 P0 stránok aspoň naskica (login + dashboard + /assets + /assets/[id])

---

## 🥂 End-of-day mood

Začalo o ~14:00 (CI debug + Slice #4 commity), pokračovalo cez 22:30 (Entra setup), skončilo o 23:30 (login working). 9 hodín so 4-hodinovou prestávkou medzi backend fix-om a večerným Entra/JIT debug session-om.

Najsilnejší pocit dňa: keď konečne klikne **"Prihlásiť sa cez Microsoft"** → Microsoft consent dialóg → späť na `/dashboard` → "Vitajte, Ján Letko" + sidebar so 6 modulmi. Po mesiacoch backendu vidieť celý loop (browser → Entra → backend → Atlas → späť na UI) je úplne iný level satisfaction.

Mini-debug story s `Malformed organisationId "undefined"` bola **prvá reálna multi-tenant chyba** ktorá sa dala diagnostikovať len cez backend log. Defensive coding tech-debt položka je pre presentation about Claude workflow veľmi pekný "ukáž čo by sa malo" príklad.

---

## 🔗 Quick links pre next session

- **Continuation plan**: [`NEXT.md`](NEXT.md)
- **Yesterday's Nextra docs + interactive demo**: [`2026-05-16-day-summary.md`](2026-05-16-day-summary.md)
- **Multi-tenant ADR**: [`../decisions/0010-multi-tenant-white-label.md`](../decisions/0010-multi-tenant-white-label.md)
- **Phase E milestone**: [`../milestones/phase-e-tech-debt-cleanup.md`](../milestones/phase-e-tech-debt-cleanup.md)
- **Marketing site**: https://inventario.sportup.sk
- **Docs site**: https://docs.inventario.sportup.sk
