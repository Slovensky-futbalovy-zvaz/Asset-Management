# Slice #2b — Assets CRUD + RBAC + Audit Log (Completed 2026-05-13)

## Cieľ

Plný write path pre assety s atomickým audit logom, role-based access control,
a server-side `inventoryNumber` generátor. Posun z M0 MongoDB clusteru na
Atlas Flex tier kvôli podpore transakcií.

**Vyžaduje slice #2** (Entra ID auth + JIT provisioning) ako predpoklad.

## Výsledok

✅ **Plný CRUD na `/v1/assets` lokálne aj v prod:**

- Production URL: `https://asset-management-api-theta.vercel.app`
- Server-side `inventoryNumber` generátor (auto-increment per prefix + rok)
- Atomické multi-document transakcie (asset + audit log)
- Soft-delete s návratom 404 po vymazaní
- Role-based access control overený 4-scenárovým sweep testom

✅ **Endpointy:**

| Endpoint                | Auth   | RBAC                 | Účel                            | Verified |
| ----------------------- | ------ | -------------------- | ------------------------------- | -------- |
| `GET /v1/assets`        | Bearer | EMPLOYEE+            | List with pagination            | ✅       |
| `GET /v1/assets/:id`    | Bearer | EMPLOYEE+            | Single asset by ID              | ✅       |
| `POST /v1/assets`       | Bearer | ASSET_MANAGER, ADMIN | Create (server generates invNo) | ✅       |
| `PATCH /v1/assets/:id`  | Bearer | ASSET_MANAGER, ADMIN | Partial update + diff audit     | ✅       |
| `DELETE /v1/assets/:id` | Bearer | **ADMIN only**       | Soft delete + audit             | ✅       |

✅ **Audit log:**

- Append-only `audit_logs` collection s 5 indexmi
- Každý POST/PATCH/DELETE zapisuje `ASSET_CREATED` / `ASSET_UPDATED` / `ASSET_DELETED`
  záznam **v rámci tej istej transakcie** ako write na asset
- Snapshot actor metadát (userId, displayName, accountType, IP, UA)
- Per-field diff pre updates (top-level shallow diff)

✅ **Infraštruktúra:**

- Migrácia M0 → **Atlas Flex tier** pre prod aj dev (oddelené clustery)
- `sfz-asset-mgmt-prod` (Vercel Production) + `sfz-asset-mgmt-dev`
  (Vercel Preview + lokálny dev)
- M0 cluster `sfz-asset-dev` zmazaný po dokončení migrácie

## Architektúra

### Stack (pribudlo oproti slice #2)

Žiadne nové npm packages. Slice #2b je čistý applicational rozšírenie —
využíva existujúce `mongodb`, `fastify`, `zod` z slice #1/#2.

### Štruktúra zmien

```
apps/api/
├── scripts/
│   └── dev-auth-test.sh                  # +CRUD smoke tests (POST/PATCH/DELETE)
├── src/
│   ├── server.ts                         # +auditPlugin registrácia
│   ├── plugins/
│   │   └── auth.ts                       # +loadCurrentUser, +requireRole factory
│   └── modules/
│       ├── audit/                        # NEW MODULE
│       │   ├── audit.repository.ts       # append-only, ensureIndexes(5 idx)
│       │   ├── audit.service.ts          # record() helper, IP/UA extraction
│       │   └── audit.plugin.ts           # fastify.auditLog decorator (fp-wrapped)
│       ├── assets/
│       │   ├── assets.repository.ts      # +insert/update/softDelete/findById
│       │   │                             # +findHighestInventorySequence
│       │   │                             # +ensureIndexes (6 indexes vrátane unique invNo)
│       │   ├── assets.service.ts         # +create/update/delete s transakciami
│       │   │                             # +runInTransaction helper
│       │   │                             # +computeShallowDiff pre audit
│       │   └── assets.routes.ts          # +GET /:id, POST, PATCH, DELETE
│       └── users/
│           └── users.routes.ts           # BUGFIX: wrap do fp() (decorator
│                                         # bol v plugin scope, nedostupný globálne)
└── .gitignore                            # +.vercel/, +.env.local.*
```

## Kľúčové vzory

### RBAC trojvrstvový preHandler reťazec

```typescript
app.post(
  '/v1/assets',
  {
    preHandler: [
      fastify.requireAuth, // 1. JWT validation (zo slice #2)
      fastify.loadCurrentUser, // 2. load User document z DB → request.currentUser
      fastify.requireRole(['ASSET_MANAGER', 'ADMIN']), // 3. check roles
    ],
    // ...
  },
  handler,
);
```

**Prečo nie role z JWT?** Role sú v DB, nie v Entra ID. Admin môže
povýšiť/degradovať usera kedykoľvek a zmena musí byť **okamžitá**, nie
čakať na refresh tokenu (~1h). DB lookup pri každom protected requeste je
preto by-design — `entraOid` index zaručuje O(log n) lookup.

**`loadCurrentUser` tiež enforcuje `isActive: true`** — deaktivovaní
užívatelia majú stále valid Entra JWT (nemôžeme revokovať), ale 401 ich
zarazí pred RBAC vrstvou. Test scenár #4 (`isActive: false`) overil že
**aj ADMIN dostane 401** ak je deaktivovaný.

### `requireRole(...)` factory

OR-semantics (any-of):

```typescript
const canWrite = fastify.requireRole(['ASSET_MANAGER', 'ADMIN']);
// User s ktoroukoľvek z týchto rolí prejde.
```

Pri 403 sa loguje `userId`, `userRoles`, `requiredRoles`, `path` pre forensics.
Klient dostane:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Action requires one of: ASSET_MANAGER, ADMIN"
}
```

### Server-side `inventoryNumber` generátor

API body POST `/v1/assets` posiela **prefix**, nie celé číslo:

```json
{ "inventoryNumberPrefix": "LT", ... }
```

Server vnútri transakcie:

1. `findHighestInventorySequence('LT', 2026, session)` — regex
   `^LT-2026-(\d{3,6})$` na `inventoryNumber`, sort desc, najvyššie získa
2. Zvýši o 1, sformátuje na `LT-2026-001` (3-digit pad)
3. Insert s týmto číslom

Konkurenčný safety: **unique index `inventoryNumber_unique`** + transakčné
retries (Mongo `withTransaction` automaticky retry-uje pri
`TransientTransactionError`). Ak by sa medzi find-max a insert vlomil iný
insert, druhá transakcia dostane duplicate-key error a retry s aktualizovaným
max. Klient o tom nevie.

### Atomické transakcie (asset + audit)

```typescript
private async runInTransaction<T>(work): Promise<T> {
  const session = this.mongoClient.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
```

Použitie v `create`:

```typescript
await this.runInTransaction(async (session) => {
  const inv = generate(session);
  const inserted = await repo.insert(doc, session);
  await auditLog.record(user, request, { ... }, session);  // ← rovnaká session
  return inserted;
});
```

Ak `auditLog.record` zlyhá, **celá transakcia sa abortuje** — asset sa
nezapíše. Žiadne orphan zápisy bez audit záznamu. **Vyžaduje replica set**
(Flex tier). Na M0 single-node by `startTransaction()` failovala s
`Transaction numbers are only allowed on a replica set member`.

### Shallow diff pre audit log

`computeShallowDiff(before, after, skip=['updatedAt','updatedBy'])`
porovná top-level polia a vyrobí pole `{ field, before, after }`. Nested
object diff je future enhancement — momentálne zmena vnútri `specs` sa
zaloguje ako jeden change s celým objektom.

**No-op PATCH** (rovnaké hodnoty) nezapíše audit log — empty `changes` →
skip. Zabraňuje audit pollution.

### `fastify-plugin` (`fp`) wrap pre decorators

**Bugfix počas implementácie:** `users.routes.ts` v slice #2 NEbol
wrappnutý cez `fp(...)`. Bez toho je každý Fastify plugin v **vlastnom
encapsulated scope** a decorators (vrátane `fastify.usersService`) sú
viditeľné **len v tom scope**, nie globálne.

Bug sa neprejavil v slice #2 lebo `GET /v1/me` používa `usersService` z
**rovnakého** scope-u (samotná `users.routes.ts`). V slice #2b sa
prejavil okamžite — `loadCurrentUser` v `auth.ts` (iný plugin scope)
volal `fastify.usersService.findOrProvision(...)` → `Cannot read
properties of undefined (reading 'findOrProvision')`.

Fix: `export default fp(usersRoutes, { name: 'users-routes', dependencies: ['mongo', 'auth'] })`.

**Lesson:** Plugin ktorý dekoruje `fastify.X` MUSÍ byť wrapnutý cez
`fastify-plugin`. Plugin ktorý len registruje routes (žiadne decorators)
nemusí, ale neuškodí to.

### Audit log indexy

```js
{ at: -1 }                                          // time-range queries
{ 'actor.userId': 1 }                               // "what did user X do?"
{ 'target.entityType': 1, 'target.entityId': 1 }    // entity history
{ action: 1 }                                       // filter by action type
{ severity: 1 }                                     // alerting on WARNING/ERROR
```

Žiadny index na `description`, `changes`, `metadata` — read-on-demand only.

### Assets indexy (pribudlo k existujúcim)

```js
{ inventoryNumber: 1 }, { unique: true }   // schema-level dedup
{ categoryId: 1 }                          // common filter
{ locationId: 1 }                          // common filter
{ status: 1 }                              // common filter
{ createdAt: -1 }                          // default sort
{ deletedAt: 1 }                           // soft-delete filter
```

## RBAC verifikácia — 4-scenárový sweep

Pri vývoji slice #2b sme overili kompletnú RBAC matrix manuálnou
manipuláciou `roles` a `isActive` v Atlas UI, opakovaným spustením
`dev-auth-test.sh`:

| Scenár            | `roles`             | `isActive` | GET /v1/me | GET /v1/assets | POST       | DELETE     |
| ----------------- | ------------------- | ---------- | ---------- | -------------- | ---------- | ---------- |
| Plain ADMIN       | `["ADMIN"]`         | `true`     | 200 ✅     | 200 ✅         | 201 ✅     | 204 ✅     |
| EMPLOYEE          | `["EMPLOYEE"]`      | `true`     | 200 ✅     | 200 ✅         | **403** ✅ | **403** ✅ |
| ASSET_MANAGER     | `["ASSET_MANAGER"]` | `true`     | 200 ✅     | 200 ✅         | 201 ✅     | **403** ✅ |
| Deactivated ADMIN | `["ADMIN"]`         | `false`    | 200 ✅     | **401** ✅     | **401** ✅ | **401** ✅ |

**Kľúčový dôkaz** zo scenára 4: aj ADMIN dostane 401 ak je deaktivovaný.
`isActive` má prednosť pred `roles`. To je presne želaná semantika — admin
ktorý odišiel z firmy a má stále valid Entra token nesmie nič urobiť.

## Issues vyriešené počas sedenia

### 1. **MongoDB Atlas M0 → Flex migrácia**

Slice #2b vyžaduje transakcie. M0 (single-node free tier) ich nepodporuje.
Krátka analýza:

| Tier  | Cena  | Replica set | Transakcie |
| ----- | ----- | ----------- | ---------- |
| M0    | $0    | ❌          | ❌         |
| M2/M5 | $9-25 | ❌          | ❌         |
| Flex  | $8-30 | ✅          | ✅         |
| M10   | $57+  | ✅          | ✅         |

**Flex tier vybraný** ($8-30/mes s hard cap) — Replica set pod kapotou,
transakcie fungujú, hard cap zabraňuje overage bills. Vytvorené 2
clustre:

- `sfz-asset-mgmt-prod` → Vercel Production env
- `sfz-asset-mgmt-dev` → Vercel Preview env + lokálny dev

M0 cluster `sfz-asset-dev` zmazaný po overení že Flex funguje
end-to-end.

### 2. **`fastify-plugin` wrap missing in slice #2**

Popísané vyššie v "Kľúčové vzory". Reálne pri tom sme stratili ~10 min
debugovaním "Cannot read properties of undefined (reading
'findOrProvision')" — clean stacktrace nás priviedol presne k `auth.ts:374`
kde `fastify.usersService` bol `undefined`. Pochopenie že je to plugin
scope problem trvalo dlhšie.

**Lesson:** Pravidlo "ak dekorujem `fastify.X`, MUSÍ to ísť cez `fp()`"
zaradiť do internej review checklist.

### 3. **Vercel CLI inštalácia na macOS bash**

`npm install -g vercel` zlyhal s `EACCES` (system-wide directory).
`pnpm add -g vercel` zlyhal s `ERR_PNPM_NO_GLOBAL_BIN_DIR`.

Riešenie:

1. `pnpm setup` (vytvoril `~/Library/pnpm`, pridal do `~/.bashrc`)
2. Pridať aj `$PNPM_HOME/bin` do PATH (defaultný setup pridal len
   `$PNPM_HOME`, ale pnpm očakáva `bin/` subdirectory)
3. `source ~/.bashrc` v každom novom terminále (macOS bash login flow
   nelloadne `.bashrc` automaticky — alebo upraviť `.bash_profile`
   aby ho sourcoval)

### 4. **Vercel `env rm production` zmaže aj `preview`**

Pri pridaní `MONGO_URI` v slice #2 sme to spravili "naraz pre obe
environments" cez Dashboard UI. Vercel to uložil ako **jeden záznam s
multi-scope membership**, nie 2 záznamy.

Pri `vercel env rm MONGO_URI production` Vercel CLI ohlásil:

> Removing Environment Variable "MONGO_URI" from Production, **Preview**

— a zmazal oba. `vercel env rm MONGO_URI preview` potom failol s
"not found".

Nie chyba ani regresia, len matúce. Riešenie: pridať každý scope
samostatne cez `vercel env add MONGO_URI production` + `vercel env add
MONGO_URI preview` (2 separate commands). To vytvorí **2 separate
recordy**, čo je ľahšie spravovať pri budúcich rotáciách.

### 5. **Atlas UI Edit Document — boolean vs string**

Pri prvom pokuse o `isActive: false` test, Atlas Edit Document UI
(field-style editor) uložil hodnotu ako **string `"false"`**, nie boolean
`false`. JavaScript `!"false"` je `false` (truthy string!), takže
`loadCurrentUser` check neprešiel a všetko zostalo "active".

Diagnostika: GET `/v1/me` ukázal `"isActive": false` v JSON outpute (ale
to bola serializácia string-u, vyzeralo to identicky ako boolean). Test
prešiel celý ako ADMIN run.

Fix: Použiť **JSON editor mód** v Atlas UI (`{ }` ikona vpravo hore na
document panel-e). Tam priamo editovať raw JSON `"isActive": false` bez
úvodzoviek.

**Lesson:** Pri kritickom boolean field-e v test scenári vždy verifikuj
typ priamo v JSON view, nie field-style editor.

### 6. **`jq` parse error pri "Token claims (redacted)" output**

Skript v slice #2 dekóduje base64 JWT payload a pipe-uje cez `jq`:

```bash
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{ ... }'
```

V niektorých runoch (asi pri určitej dĺžke base64 padding) `base64 -d` na
macOS zlyhá tichom a `jq` dostane truncated input → "Unfinished JSON term
at EOF at line 1, column 1011".

**Nie blocker** — token sa získa korektne, ostatné kroky bežia. Ale
cosmetic noise v output-e. **Follow-up todo** pre slice #2c: prepnúť na
`python3 -c "import base64, json, sys; ..."` rovnako ako pre iné JWT
operácie.

## Environment Variables

Žiadne nové env vars oproti slice #2. Jediná zmena: **MONGO_URI v Vercel
sa zmenil**:

| Scope      | Pred slice #2b     | Po slice #2b               |
| ---------- | ------------------ | -------------------------- |
| Production | M0 `sfz-asset-dev` | Flex `sfz-asset-mgmt-prod` |
| Preview    | M0 `sfz-asset-dev` | Flex `sfz-asset-mgmt-dev`  |

Lokálny `apps/api/.env.local` ukazuje na **Flex dev** cluster.

## Čo NIE JE v slice #2b

Vedome odložené:

- ❌ **Vitest integration testy** — manuálny `dev-auth-test.sh` ostáva
  baseline; vitest+supertest plánujeme v slice #2c
- ❌ **Admin endpointy** (`PATCH /v1/users/:id/roles`, `PATCH /v1/users/:id/active`)
  → slice #3
- ❌ **Categories / Locations endpointy** → slice #3+ (POST asset používa
  dummy ObjectIds pre testovanie; MongoDB nemá foreign keys, takže to
  prejde, ale FE príde s reálnymi kategorias)
- ❌ **Restore (un-delete) deleted asset** → admin-only, slice #3
- ❌ **`GET /v1/audit-logs` query endpoint** → slice #3 (zatiaľ admin
  číta priamo cez Atlas UI)
- ❌ **Inventory number prefix validation proti category** (napr. IT →
  prefix "IT", Media → "MED") → biznis pravidlo na neskôr
- ❌ **Bulk operations** (POST many, DELETE many) → keď príde potreba
- ❌ **Pagination beyond skip/limit** (cursor-based) → keď collection
  prerastie ~10k záznamov

## Známé drobnosti (follow-up)

1. **`jq` parse error v token redact** — bod 6 vyššie. Fix v slice #2c.
2. **DELETE response body sa zahadzuje v skripte** — `dev-auth-test.sh`
   používa `-o /dev/null` pre DELETE, takže pri 403 nevidíme JSON
   error body. Status code stačí na overenie, ale dianostika by bola
   lepšia keby sme body tiež zachytili. 5-line fix.
3. **`GET /v1/assets` list test má false-positive logiku** — keď
   endpoint vráti error object (napr. 401 pri deactivated user),
   `jq -r '.pagination.total'` vráti `null`, ale skript to vyhodnotí ako
   `pass`. Treba pridať HTTP status check pred parse.

## Časová investícia

~4 hodiny spoločnej práce. Najviac času:

1. **M0 → Flex migrácia** (~30 min) — Atlas UI cluster creation,
   Vercel env vars setup, healthcheck verifikácia v každom kroku
2. **Vercel CLI install na macOS** (~15 min) — `EACCES`, `pnpm setup`,
   PATH editing, `source .bashrc`
3. **RBAC 4-scenario sweep** (~20 min) — manuálna manipulácia v Atlas,
   `isActive` boolean-vs-string discovery
4. **`fastify-plugin` wrap bugfix** (~10 min) — stacktrace identifikácia,
   pochopenie plugin scope semantiky
5. **Kód samotný** (~2h) — repository/service/routes rozšírenie, audit
   modul, skript rozšírenie

## Commity (plánované)

Single commit, ~10 zmenených/nových súborov:

```
feat(api): add asset CRUD with RBAC + audit log + transactions (slice #2b)

- New audit module (repository + service + plugin)
- AssetsRepository: insert/update/softDelete/findById + inventory number generator
- AssetsService: transactional create/update/delete with audit log atomicity
- Assets routes: GET /:id, POST, PATCH, DELETE with role-based access
- RBAC: loadCurrentUser preHandler + requireRole factory in auth.ts
- Fix: wrap users.routes.ts in fastify-plugin (decorator scope bug from #2)
- Migration: M0 → Atlas Flex tier for transaction support
- dev-auth-test.sh: end-to-end CRUD smoke tests
- .gitignore: .vercel/, .env.local.*
```

## End-to-end verifikácia

### Lokálne (proti `sfz-asset-mgmt-dev` Flex cluster)

```bash
cd apps/api
pnpm dev                            # spustí server na :3000
bash scripts/dev-auth-test.sh       # auth + CRUD smoke tests
```

Test prejde s `roles: ["ADMIN"]` na users collection:

```
✅ Created asset #1: TEST-2026-NNN
✅ Created asset #2: TEST-2026-NNN+1
✅ Inventory sequence is contiguous: NNN → NNN+1
✅ Retrieved asset #1
✅ Renamed asset #1
✅ List endpoint returned total=N asset(s)
✅ DELETE returned 204 for asset #2
✅ GET on deleted asset returns 404 (soft-delete works)
✅ Cleanup OK

✅ ALL CRUD TESTS PASSED — slice #2b smoke tests green
```

### Produkčný Vercel (proti `sfz-asset-mgmt-prod` Flex cluster)

```bash
API_BASE="https://asset-management-api-theta.vercel.app" \
  bash scripts/dev-auth-test.sh
```

### Audit log verifikácia v Atlas

Po každom smoke teste, `sfz_asset_management.audit_logs` collection má:

- 2× `ASSET_CREATED` (severity INFO)
- 1× `ASSET_UPDATED` (severity INFO, s `changes` array)
- 1× `ASSET_DELETED` (severity WARNING)
- 1× `ASSET_DELETED` (severity WARNING, cleanup)

Každý záznam má:

- `at` timestamp (ISO 8601)
- `actor.userId`, `actor.displayName`, `actor.accountType: ENTRA_ID`
- `actor.ipAddress` (`::1` pre lokálny localhost)
- `actor.userAgent` (`curl/8.x` pre script)
- `target.entityType: "Asset"`, `target.entityId`, `target.snapshot`
- `isPseudonymized: false`

## Ďalšie kroky (slice #2c / slice #3)

### Slice #2c — "qualitatívne dokončenie"

1. **Vitest + supertest integration tests** — automatizovať manuálne
   `dev-auth-test.sh` flows
2. **Drobné fixy** zo sekcie "Známé drobnosti"
3. **Audit log query endpoint** (`GET /v1/audit-logs?entityId=X`) pre admin UI

### Slice #3 — Reálne kategórie & lokácie

1. **Categories module** — CRUD + admin endpoint
2. **Locations module** — CRUD + admin endpoint
3. **Admin users endpointy** — `PATCH /v1/users/:id/roles`, `PATCH /v1/users/:id/active`
4. **Validácia FK** pri POST/PATCH asset — overiť že `categoryId` a `locationId`
   existujú (zatiaľ MongoDB nemá FK constraints, validuje len Zod regex)

## Referencie

- [Slice #2 milestone](slice-2-entra-id-auth.md)
- [Slice #1 milestone](slice-1-backend-bootstrap.md)
- [ADR-0009: Backend Fastify on Vercel](../decisions/0009-backend-fastify.md)
- [MongoDB Flex tier limitations](https://www.mongodb.com/docs/atlas/reference/flex-limitations/)
- [Fastify plugin encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/)
- [MongoDB Transactions guide](https://www.mongodb.com/docs/manual/core/transactions/)
