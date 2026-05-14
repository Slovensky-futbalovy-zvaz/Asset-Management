# Slice #2c — Test Infrastructure + Pre-commit Hooks (Completed 2026-05-14)

## Cieľ

Po slice #2b máme funkčný CRUD plus RBAC plus audit log, ale **žiadne automatizované testy**.
Slice #2c zavádza vitest test infraštruktúru, jednotkové testy pre čistú logiku,
integration testy pre celý request/response cyklus, a CI/local guardrails ktoré
zabránia commitnúť rozbitý kód.

**Vyžaduje slice #2b** (Atlas Flex tier, asset CRUD, audit log) ako predpoklad.

## Výsledok

✅ **100 testov, lokálne aj CI:**

| Kategória   | Súbor                                     | Testov  | Pokrýva                                |
| ----------- | ----------------------------------------- | ------- | -------------------------------------- |
| Unit        | `tests/unit/assets-diff.test.ts`          | 30      | `computeShallowDiff` čistá funkcia     |
| Integration | `tests/integration/health.test.ts`        | 1       | smoke test infraštruktúry              |
| Integration | `tests/integration/auth.test.ts`          | 13      | JWT verifikácia + JIT provisioning     |
| Integration | `tests/integration/assets-post.test.ts`   | 11      | POST happy path, validácia, audit pole |
| Integration | `tests/integration/assets-patch.test.ts`  | 13      | PATCH happy path, not-found, validácia |
| Integration | `tests/integration/assets-delete.test.ts` | 9       | DELETE happy path, on-loan rule        |
| Integration | `tests/integration/rbac.test.ts`          | 14      | Role × endpoint matrix                 |
| Integration | `tests/integration/audit.test.ts`         | 12      | Audit log per akcia + atomicita        |
| **Spolu**   |                                           | **100** |                                        |

✅ **CI test runtime:**

- Lokálne: ~30-40s (Atlas dev cluster, Bratislava → AWS Frankfurt)
- GitHub Actions: ~3m (cold runner, väčšia latency)
- Hraničné prípady: `pluginTimeout: 30_000` v `buildTestApp` pokrýva Atlas TLS cold handshakes

✅ **Pre-commit hook:**

- `lint-staged` (eslint plus prettier) — z slice #1
- `pnpm typecheck` (nové) — celý monorepo typecheck cez turbo cache
- Turbo cache hit: ~200ms; cache miss: ~3-5s
- Verifikované že hook **blokuje** commit s TS chybou (exit code 2)

✅ **CI Atlas connectivity:**

- GitHub Actions repo secrets injectované do test job-u
- Atlas Network Access otvorený pre `0.0.0.0/0` na **dev clusteri** (production cluster zostáva chránený)
- Trade-off prijatý: dependency na Atlas availability v CI, výmenou za jednoduchú konfiguráciu

## Architektúra

### Test infraštruktúra

```
apps/api/
├── vitest.config.ts                          # NEW: singleFork pool, 10s timeout
├── tests/
│   ├── setup.ts                              # NEW: globalSetup, JWT keypair gen
│   ├── helpers/
│   │   ├── test-jwt.ts                       # NEW: signTestToken, generateTestKeyPair
│   │   ├── test-jwt-loader.ts                # NEW: createTokenSigner
│   │   ├── test-app.ts                       # NEW: buildTestApp, cleanTestDatabase
│   │   └── test-fixtures.ts                  # NEW: provisionUserAs, insertTestAsset
│   ├── unit/
│   │   └── assets-diff.test.ts               # NEW: 30 tests
│   └── integration/
│       ├── health.test.ts                    # NEW: smoke
│       ├── auth.test.ts                      # NEW: auth gate
│       ├── assets-post.test.ts               # NEW: POST contract
│       ├── assets-patch.test.ts              # NEW: PATCH contract
│       ├── assets-delete.test.ts             # NEW: DELETE contract
│       ├── rbac.test.ts                      # NEW: RBAC matrix
│       └── audit.test.ts                     # NEW: audit log contract
├── src/
│   ├── server.ts                             # +pluginTimeout option
│   ├── plugins/
│   │   ├── config.ts                         # +TEST_JWT_PUBLIC_KEY env var
│   │   └── auth.ts                           # +verifyTestToken (dev-only path)
│   └── modules/assets/
│       └── assets-diff.ts                    # EXTRACTED: pure module from service
```

### Test JWT strategy

Auth plugin podporuje **dve cesty** verifikácie:

1. **Produkčná**: Entra ID JWKS endpoint, full audience/issuer/scope kontrola
2. **Testovacia**: lokálna RS256 keypair z `TEST_JWT_PUBLIC_KEY` env var, route-uje podľa
   `iss=urn:sfz-test:dev` v JWT payload-i

Test path je **vyradená v produkcii** (`process.env.NODE_ENV === 'production'` ju blokuje).
Keypair sa generuje fresh v vitest `globalSetup`, public key sa exportuje do env, private
key sa zapíše do `/tmp/sfz-test-keys.json` (mode 0o600).

### Test DB isolation

`buildTestApp()` nastavuje `MONGO_DB_NAME=sfz_asset_management_test` cez env override.
`cleanTestDatabase()` má hard guard ktorý throw-uje ak by sa pokúsila zmazať akúkoľvek
inú DB. Iné testovacie procesy paralelne nemôžu bežať bez kolízie — v CI je
`concurrency: cancel-in-progress: true` v `ci.yml`.

Pôvodné riešenie používalo `db.dropDatabase()` ale Atlas user nemá `dropDatabase`
permission. Vymenené za per-collection `deleteMany({})`. Trade-off: indexes
pretrvávajú medzi behmi (akceptovateľné — `ensureIndexes` v repository je idempotentné).

### Atlas connectivity stratégia

Po zvažovaní 3 možností:

| Variant                                | Výhody                      | Nevýhody                                      |
| -------------------------------------- | --------------------------- | --------------------------------------------- |
| **A**: `mongodb-memory-server`         | Hermetické, paralelne-safe  | +80MB binary, slow first run, version drift   |
| **B**: GitHub Secret + Atlas allowlist | Real Atlas, minimálny setup | External dependency, IP allowlist `0.0.0.0/0` |
| **C**: Skip-on-CI, do-later            | Žiadny okamžitý setup       | Permanent dlh, žiadna CI safety net           |

**Vybraná B** kvôli:

- Atlas dev cluster nemá reálne dáta — IP allowlist riziko akceptovateľné
- DB user credentials sú stále kontrolované, IP samotná nedáva prístup
- Eliminuje 3-5s `mongodb-memory-server` startup per test file

### Bugfixes nájdené testami

1. **`auth.ts` base64url decode**: payload decoding manuálne pridával `=`-padding ktoré
   bolo nesprávne pre payloads s dĺžkou nemod-4. Mangloval JWT-y so špecifickými dĺžkami
   claim-ov. Fix: použiť `Buffer.from(str, 'base64url')` priamo, ktorý handle-uje unpadded.

2. **`turbo.json` globalEnv**: zastaralé `ENTRA_CLIENT_ID` (z pred slice #2 refactoru)
   namiesto `ENTRA_API_CLIENT_ID`. Turbo filter-oval env vars do subprocesov, vitest
   nedostával GUID. Fix: oprava názvu plus pridanie `TEST_JWT_PUBLIC_KEY`.

3. **`server.ts` pluginTimeout**: Fastify default 10s nestačil pri 4-5. cold Atlas TLS
   handshake v rade počas test suite. Riešenie: optional `pluginTimeout` parameter do
   `buildServer`, test path passne 30_000.

## Commit-y v slice

1. `0561c64` — test(api): bootstrap vitest plus unit tests for computeShallowDiff
2. `e847a60` — test(api): fix two bugs surfaced by first auth integration tests
3. `8e2943f` — test(api): add CRUD integration tests (slice #2c-beta, K5)
4. `7e4c406` — test(api): add RBAC and audit log tests, enable integration tests in CI
5. `da0bd74` — chore(ci): debug step for secret-length diagnosis
6. `0985589` — fix(ci): correct ENTRA_API_CLIENT_ID name in turbo globalEnv
7. (TBD) — docs(milestones): slice #2c summary plus debug step cleanup

## Pre-commit hook (K8)

```
.husky/pre-commit:
  pnpm exec lint-staged    ← lint + format on staged files
  pnpm typecheck           ← turbo run typecheck (full repo, cached)
```

Verifikácia: vytvoril sa `apps/api/src/broken-test.ts` s `const wrong: number = "string"`,
pokus o commit → husky zachytí TS chybu, commit zablokovaný s exit code 2.

## Performance baseline

| Metrika                             | Lokálne (Bratislava → Atlas) | CI (GitHub Actions → Atlas) |
| ----------------------------------- | ---------------------------- | --------------------------- |
| Test suite duration                 | ~30-40s                      | ~3m                         |
| Atlas cold TLS handshake (per file) | 3-5s                         | 8-15s                       |
| Vitest pool                         | singleFork                   | singleFork                  |
| Test files                          | 8                            | 8                           |
| Total tests                         | 100                          | 100                         |

## Nasledujúce slice-y

**Slice #3** (plánované): kategórie, lokácie, admin endpointy pre používateľov.
Reuse vytvorenej test infraštruktúry — pridať `categories.test.ts`, `locations.test.ts`,
`users-admin.test.ts` v rovnakom štýle. RBAC, audit log a transactions už máme.

**Slice #4** (plánované): frontend `apps/web` (Vite + React). E2E testy cez
Playwright (vitest infra zostáva pre API unit/integration).

## Lessons learned

1. **Server-side env passthrough v turbo monorepo** — `globalEnv` má dva efekty:
   cache invalidation **a** filter env vars do subprocesov. Vždy keď pribudne nový
   required env var v code-e, MUSÍ ísť aj do `turbo.json` aby ho task-y videli.

2. **`pluginTimeout` v Fastify má default 10s** — pre testy kde každý súbor reštartuje
   Fastify instanciu plus connect-uje na Atlas, 10s je príliš málo. 30s je pohodlné
   pre cold handshakes.

3. **Atlas user permissions** — readWrite na DB level neimplikuje `dropDatabase`.
   Atlas Flex user-i sú scoped striktnejšie ako self-hosted MongoDB admin. Test
   cleanup musí používať per-collection `deleteMany`, nie `dropDatabase`.

4. **`describe.skipIf(isCI)` je easy escape hatch** — pohodlné dočasne, ale ľahko sa
   stane permanentným dlh-om. Slice #2c-α to malo a museli sme to odstrániť v K9.
   Lekcia: skip on environment je červená vlajka, nie riešenie.
