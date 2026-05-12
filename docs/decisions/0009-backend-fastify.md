# 0009. Fastify ako backend framework (nahrádza NestJS)

|                   |                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**        | ✅ Accepted                                                                                                                                                   |
| **Dátum**         | máj 2026                                                                                                                                                      |
| **Autori**        | tím SFZ Asset Management                                                                                                                                      |
| **Nahrádza**      | [ADR-0002](0002-backend-nestjs.md) (NestJS)                                                                                                                   |
| **Súvisiace ADR** | [0001-monorepo-pnpm-turbo](0001-monorepo-pnpm-turbo.md), [0003-mongodb-atlas](0003-mongodb-atlas.md), [0005-mongo-native-driver](0005-mongo-native-driver.md) |

## Kontext

Pôvodne sme v [ADR-0002](0002-backend-nestjs.md) zvolili NestJS ako backend framework. Pri začiatku implementácie sme rozhodnutie revidovali na základe nasledujúcich zistení:

1. **Skutočný profil projektu** je read-heavy CRUD nad MongoDB s ~30-50 endpointami, nie komplexná doménová logika kde DI/CQRS prinášajú hodnotu úmernú nákladom.
2. **Mongo native driver** (per [ADR-0005](0005-mongo-native-driver.md)) v kombinácii s NestJS znamená písať vlastné repository wrappery a Mongo Provider — väčšina NestJS-Mongo ekosystému (`@nestjs/mongoose`) je nepoužiteľná.
3. **Zod schémy v `packages/shared-types`** sa s Fastify integrujú **natívne** (Fastify má built-in JSON schema validation engine), zatiaľ čo NestJS potrebuje adapter (`nestjs-zod`).
4. **Deployment na Railway** s potenciálnym scale-to-zero — Fastify má 5-10× rýchlejší cold start než NestJS bootstrap.
5. **MCP server** (samostatný projekt, neskôr) bude tak či tak používať čistý Node.js HTTP server (`@modelcontextprotocol/sdk`) — konzistencia naprieč backend službami v jednom architektonickom štýle (Fastify-based) je krajšia než miešať NestJS + plain Node.
6. **TypeScript-first dizajn** — Fastify je od základov navrhnutý pre TypeScript, NestJS pochádza z TS 2.x éry s decorators ktoré pridávajú "magic".

## Možnosti (revidované)

### Možnosť A: NestJS (pôvodne zvolené v ADR-0002)

Detailne pokryté v [ADR-0002](0002-backend-nestjs.md). Pre úplnosť tu uvádzame len **nové argumenty proti**, ktoré sme pri pôvodnom rozhodovaní podcenili:

- **Mínus:** Cold start 500-1500 ms — relevantné pre Railway scale-to-zero.
- **Mínus:** Cez native Mongo driver väčšina NestJS modul ekosystému nepoužiteľná.
- **Mínus:** Boilerplate na 50 endpointoch je výrazný — pre malý tím to spomaľuje dodávku.
- **Mínus:** DI kontainer + reflection metadata zvyšujú bundle size a runtime overhead bez úmernej hodnoty pre náš scale.

### Možnosť B: NestJS + Fastify adapter

Hybridný prístup — NestJS architektúra, Fastify pod kapotou. Zvážené, ale zamietnuté:

- **Mínus:** Stále zostáva NestJS boilerplate.
- **Mínus:** Niektoré NestJS knižnice predpokladajú Express API a v Fastify móde vyžadujú workarounds.
- **Mínus:** "Best of both worlds" v praxi znamená "problémy oboch" — Fastify performance s NestJS overhead.

### Možnosť C: Čistý Fastify (zvolené) ⭐

Minimalistický, rýchly TypeScript-first HTTP framework. K nemu doplňujeme:

- `@fastify/swagger` + `@fastify/swagger-ui` pre OpenAPI 3.1 generovanie zo schém.
- `fastify-type-provider-zod` pre Zod → JSON Schema bridge.
- `@fastify/jwt` + JWKS pre Entra ID JWT verifikáciu.
- `mongodb` native driver registrovaný ako Fastify plugin.
- `pino` (built-in v Fastify) pre štruktúrované logy.
- `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` pre štandardné middleware.
- BullMQ priamo (bez NestJS wrappera) pre background queue (notifikácie, bulk operácie).

**Plus:**

- Rýchlejší (~50k req/s vs 25k pre NestJS) — relevantné nie kvôli rýchlosti, ale kvôli **cold start** na Railway.
- **JSON Schema-first** validácia — perfektná synergia so Zod schémami v `packages/shared-types`.
- **Plugin systém** — modulárna štruktúra bez DI boilerplate.
- **OpenAPI generovanie** z route schém out-of-the-box.
- **Menej kódu** — 30-50% menej riadkov pre rovnakú funkcionalitu vs NestJS.
- **Lepší TypeScript** — `FastifyInstance` má kompletne typované rozšírenia, žiadne reflection metadata.
- **Kratšie cold starty** na Railway / Fly.io.

**Mínus / kompromisy:**

- **Žiadny built-in DI kontainer** — pre testovanie sa služby injektujú cez Fastify plugin pattern alebo `awilix` (zatiaľ nepotrebujeme).
- **Modulárnu štruktúru robíme sami** — definujeme konvenciu `src/modules/<name>/` (routes, service, repository, schemas) ako náhradu za NestJS moduly.
- **Menej tutoriálov v slovenčine/češtine** — Fastify dokumentácia je len v angličtine.
- **Onboarding nového developera** mierne dlhší — musí pochopiť plugin pattern namiesto klasickej `controller → service` štruktúry.

### Možnosť D: Hono

Veľmi rýchly TS-first framework, podobný Fastify. Zvážené, ale zamietnuté:

- **Mínus:** Mladší ekosystém než Fastify (Fastify od 2016, Hono od 2022).
- **Mínus:** Menej production-grade plugin-ov (napr. nie je rovnocenné `@fastify/jwt` s JWKS support).
- **Mínus:** Optimalizovaný hlavne pre edge runtimes (Cloudflare Workers, Deno Deploy) — našou cieľovou platformou je dlhotrvajúci Node.js proces na Railway.

## Rozhodnutie

Zvolili sme **čistý Fastify (Možnosť C)**.

Hlavné dôvody:

1. **Synergia s existujúcim stack-om** — Zod schémy + Mongo native driver + Railway sa s Fastify spájajú prirodzene, bez wrapperov.
2. **Správny nástroj pre scale projektu** — pre 30-50 endpointov a malý tím je NestJS overhead nadbytočný.
3. **Performance + cold starts** — relevantné pre Railway deploy s potenciálnym scale-to-zero.
4. **OpenAPI generovanie** funguje out-of-the-box cez `@fastify/swagger` + `fastify-type-provider-zod`.
5. **Single architectural style** naprieč `apps/api` + `apps/mcp-server` + budúce backend služby.

## Dôsledky

### Pozitívne

- Menej boilerplate kódu, rýchlejší development.
- Lepšie cold starty a runtime performance.
- Priame použitie Zod schém pre validáciu request/response + auto-generated OpenAPI.
- Jednoduchší mental model — žiadny "framework magic" cez decorators a reflection.
- Konzistencia naprieč backend službami v repo.

### Negatívne / kompromisy

- Vlastnú modulárnu štruktúru si musíme definovať a držať dohodu (riziko inconsistency v rastúcom tíme — riešime cez ESLint pravidlá + code review).
- Žiadny built-in DI kontainer — keď v budúcnosti budeme komplexnejšie závislosti, pridáme `awilix` (rozhodne nie hneď).
- Žiadne pripravené patterns pre cron jobs / queues — manuálna integrácia s `node-cron` a `bullmq`.

### Riziká, ktoré treba sledovať

- **Architectural drift** — bez "názorového" frameworku ako NestJS môže každý vývojár písať inak. Mitigácia: striktné ESLint pravidlá pre import order, súborovú štruktúru, naming conventions. Code review na PR.
- **Plugin ekosystém** — niektoré pluginy môžu byť menej udržiavané. Mitigácia: preferovať `@fastify/*` officiálne pluginy.

## Implementačné poznámky

### Štruktúra `apps/api/`

```
apps/api/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts                      # entry point + bootstrap
    ├── server.ts                     # Fastify factory (test-friendly)
    │
    ├── plugins/                      # Fastify plugins (cross-cutting concerns)
    │   ├── config.ts                 # env validation cez Zod
    │   ├── mongo.ts                  # MongoClient lifecycle
    │   ├── auth.ts                   # JWT verification (Entra ID)
    │   ├── swagger.ts                # OpenAPI generation
    │   └── error-handler.ts          # global error handler
    │
    └── modules/                      # domain modules (route + service + repo)
        ├── assets/
        │   ├── assets.routes.ts      # Fastify route definitions
        │   ├── assets.service.ts     # business logic
        │   ├── assets.repository.ts  # Mongo collection wrapper
        │   └── assets.schemas.ts     # re-export from @sfz/shared-types
        ├── users/...
        └── health/
            └── health.routes.ts
```

### Konvencie

- **Routes** — vždy v `*.routes.ts`, registrované cez `fastify.register()` ako plugin.
- **Service** — funkcie alebo trieda, **bez decorators**, injektované cez Fastify decorate (`fastify.decorate('assetsService', ...)`).
- **Repository** — wrapper nad `MongoClient.db().collection<T>()` so štandardnými CRUD operáciami.
- **Schemas** — re-export Zod schém z `packages/shared-types/`, nikdy nedefinovať lokálne.
- **Error handling** — globálny error handler v `plugins/error-handler.ts`, throwni `BadRequestError` / `NotFoundError` / `UnauthorizedError` v service vrstve.

### Kľúčové dependencies

```jsonc
{
  "fastify": "^5.x",
  "@fastify/swagger": "^9.x",
  "@fastify/swagger-ui": "^5.x",
  "@fastify/jwt": "^9.x",
  "@fastify/cors": "^10.x",
  "@fastify/helmet": "^12.x",
  "@fastify/rate-limit": "^10.x",
  "fastify-type-provider-zod": "^4.x",
  "mongodb": "^6.x",
  "zod": "^3.x",
  "pino": "^9.x",
  "pino-pretty": "^11.x", // dev only
}
```

### Migrácia z ADR-0002 plánovania

| Pôvodné rozhodnutie v ADR-0002           | Náhrada vo Fastify                                   |
| ---------------------------------------- | ---------------------------------------------------- |
| `@nestjs/swagger`                        | `@fastify/swagger` + `fastify-type-provider-zod`     |
| `nestjs-zod`                             | `fastify-type-provider-zod` (direct Zod integration) |
| `@nestjs/passport` + `passport-azure-ad` | `@fastify/jwt` + `jwks-rsa` (Entra ID JWKS endpoint) |
| `@nestjs/config` + Zod env               | Custom plugin `plugins/config.ts` so Zod             |
| `nestjs-pino`                            | Built-in Fastify `logger: pino()`                    |
| `@nestjs/bullmq`                         | `bullmq` priamo (žiadny wrapper)                     |
| `@nestjs/throttler`                      | `@fastify/rate-limit`                                |

## Deployment: Vercel Serverless Functions

**Cieľová platforma:** Vercel (oba `apps/web` aj `apps/api` v jednom Vercel projekte).

### Prečo Vercel pre Fastify backend

Pôvodne sme zvažovali Railway (long-running proces) ako lepší fit pre Node.js backend. Po prechode z NestJS na Fastify však Vercel sa stáva praktickou voľbou:

1. **Fastify cold start je 50-150 ms** (vs NestJS 500-1500 ms) — pri Vercel serverless invoke je to prijateľné.
2. **Plugin pattern je stateless-friendly** — Fastify inštancia sa dá vytvoriť per-request alebo zdieľať medzi invocations cez modul-level cache.
3. **Jeden vendor** pre celý stack (web + api) — jeden dashboard, jeden billing, jeden Git deploy hook.
4. **Free tier (Vercel Hobby) stačí na dev a skôr-produkčnú fázu.**
5. **Vercel rozumie pnpm monorepo + turbo** natívne.

### Architektúra na Verceli

```
Vercel project: sfz-asset-management
├── apps/web   → Next.js (Edge + Node functions)
│   │
│   └── deploy: https://sfz-asset-management.vercel.app
│
└── apps/api   → Fastify (Vercel Node Functions)
    │
    └── deploy: https://api.sfz-asset-management.vercel.app
            (alebo subdomain custom: api.sfz.sk)
```

### Implementačné detaily Vercel deploymentu

Fastify aplikácia sa zabalí do Vercel Serverless Function pomocou wrappera:

```typescript
// apps/api/api/index.ts — Vercel entry point
import { buildServer } from '../src/server.js';

const server = await buildServer();
await server.ready();

export default async function handler(req, res) {
  server.server.emit('request', req, res);
}
```

`vercel.json` v `apps/api/`:

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/api/index.ts" }]
}
```

### Vercel-specifické ohraničenia a mitigácie

| Ohraničenie                                   | Dopad                                 | Mitigácia                                                                                                      |
| --------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Execution timeout** 10s (Hobby) / 60s (Pro) | Bulk import 10k assets neprežije      | Bulk operations cez separátny endpoint s chunkovaním po 500 položkách                                          |
| **No long-running processes**                 | BullMQ neexistuje kvôli scale-to-zero | Pre queue: Upstash QStash, Inngest, alebo Trigger.dev (HTTP-driven queues)                                     |
| **No SSE/WebSocket** (cez Vercel functions)   | MCP server cez SSE nefunguje          | MCP server presunieme na Railway/Fly v neštartovanej fáze 3 (má inú architektúru)                              |
| **Cold start na každý invoke**                | +100ms latencia občas                 | Vercel Edge Functions (ne pre Mongo) alebo Vercel Functions s `maxDuration` + Atlas connection cache           |
| **Mongo connection per invoke**               | Atlas connection limit (500 na M0)    | Mongo connection cache pattern: modul-level pripojenie, `maxPoolSize: 1`, lazy connect; alebo MongoDB Data API |
| **Stateless filesystem**                      | Žiadne lokálne súbory medzi requestmi | Pre attachments: Cloudflare R2 / S3 (per ADR-0003 navrhnuté)                                                   |

### MongoDB connection v serverless prostredí

Klasický Mongo connection pool nepasuje na serverless model. Používame **module-level cache pattern**:

```typescript
// apps/api/src/plugins/mongo.ts
import { MongoClient } from 'mongodb';

let cachedClient: MongoClient | null = null;

export async function getMongoClient() {
  if (cachedClient) return cachedClient;

  cachedClient = new MongoClient(process.env.MONGO_URI!, {
    maxPoolSize: 1, // serverless: jedno pripojenie per invoke
    minPoolSize: 0,
    maxIdleTimeMS: 10000, // close po nedostupnosti
  });
  await cachedClient.connect();
  return cachedClient;
}
```

Vercel zachováva modul-level state medzi warm invocations (~5-15 minút), takže `cachedClient` sa zdieľa. Pri cold start sa znova vytvorí.

### Migrácia na inú platformu (Railway, Fly)

Fastify kód je platform-agnostic. Ak v budúcnosti narazne na Vercel limity (typicky pri pridávaní BullMQ alebo MCP servera), migrácia spočíva v:

1. Vytvoriť nový Railway/Fly projekt napojený na rovnaký GitHub repo
2. Konfigurovať build command (`pnpm --filter @sfz/api build`) a start command (`node apps/api/dist/index.js`)
3. Skopírovať env premenné z Vercel do Railway
4. Prepísať DNS pre `api.sfz.sk` na nový hosting
5. (Voliteľné) zvýšiť `maxPoolSize` na 10-20 pre long-running proces

**Žiadny code change v aplikácii** — len `apps/api/api/index.ts` (Vercel entry) sa odstráni a `apps/api/src/index.ts` sa stane hlavným entry pointom.

## Referencie

- [Fastify dokumentácia](https://fastify.dev/)
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [Fastify ecosystem](https://fastify.dev/ecosystem/)
- [Benchmark: Fastify vs NestJS](https://github.com/fastify/benchmarks)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [MongoDB best practices for serverless](https://www.mongodb.com/developer/products/atlas/serverless-mongodb-vercel/)
- [ADR-0002 (Superseded)](0002-backend-nestjs.md)
