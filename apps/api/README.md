# @sfz/api — SFZ Asset Management Backend

Fastify-based REST API serving the SFZ Asset Management system. Deployed on Vercel Serverless Functions.

See [ADR-0009](../../docs/decisions/0009-backend-fastify.md) for the architectural rationale.

## Quick start

```bash
# From repo root: install all dependencies (only first time)
pnpm install

# Copy env template and fill in MONGO_URI from MongoDB Atlas
cd apps/api
cp .env.example .env.local
# Edit .env.local — set MONGO_URI from Atlas dashboard

# Start dev server (auto-reload on file changes)
pnpm dev
```

The API will be running at <http://localhost:3000>.

## Verifying it works

```bash
# Health check (no auth required)
curl http://localhost:3000/health
# → { "status": "ok", "uptime": 12.345, "timestamp": "2026-05-12T..." }

# List assets (requires Mongo connection)
curl http://localhost:3000/v1/assets
# → { "data": [...], "pagination": { "hasMore": false, ... } }
```

Open <http://localhost:3000/docs> in your browser for interactive Swagger UI.

## Project structure

```
apps/api/
├── api/
│   └── index.ts              # Vercel entry point (serverless handler)
├── src/
│   ├── index.ts              # Local dev entry point (long-running)
│   ├── server.ts             # buildServer() factory — test-friendly
│   │
│   ├── plugins/              # Fastify plugins (cross-cutting concerns)
│   │   ├── config.ts         # Zod env validation
│   │   ├── mongo.ts          # MongoDB client (module-level cache)
│   │   ├── error-handler.ts  # Global error handling
│   │   └── swagger.ts        # OpenAPI generation + Swagger UI
│   │
│   └── modules/              # Domain modules
│       ├── health/
│       │   └── health.routes.ts   # GET /health
│       └── assets/
│           ├── assets.routes.ts    # GET /v1/assets
│           ├── assets.service.ts
│           └── assets.repository.ts
├── package.json
├── tsconfig.json
├── vercel.json               # Vercel deploy config
└── .env.example
```

## Adding a new module

Convention: every domain module lives in `src/modules/<name>/` with three files:

- `<name>.routes.ts` — Fastify route definitions (request validation + response shape)
- `<name>.service.ts` — Business logic (orchestrates repository calls, applies rules)
- `<name>.repository.ts` — MongoDB collection wrapper (CRUD primitives)

Routes are registered in `src/server.ts` via `fastify.register(...)`.

Schemas come from `@sfz/shared-types` — never define Zod schemas locally in `apps/api`.

## Deployment

### Vercel (production)

Vercel auto-deploys on every push to `main` (production) or any other branch (preview).

The `vercel.json` in this directory configures:

- All requests routed to `api/index.ts` (single serverless function)
- Function timeout: 30s
- Node.js 22 runtime

Environment variables must be set in Vercel Dashboard → Project Settings → Environment Variables.

### Local dev

`pnpm dev` runs a long-lived Fastify server on port 3000 via `tsx watch`. This is **not** how production runs (production uses serverless invokes), but the Fastify code is identical — only the entry point differs.

## Architecture notes

### Why Fastify (not NestJS)?

See [ADR-0009](../../docs/decisions/0009-backend-fastify.md).

### Why module-level Mongo cache?

Vercel Serverless Functions are stateless across cold starts but **warm invocations share module state** (~5-15 minutes of inactivity). We cache the `MongoClient` at module scope so warm invokes reuse the connection instead of opening a fresh one (which would quickly exhaust Atlas connection limits).

See `src/plugins/mongo.ts` and the [Vercel deployment section in ADR-0009](../../docs/decisions/0009-backend-fastify.md#deployment-vercel-serverless-functions).

### OpenAPI

OpenAPI 3.1 spec is auto-generated from Fastify route schemas via `@fastify/swagger` + `fastify-type-provider-zod`. The Zod schemas are pulled directly from `@sfz/shared-types`.

In development, Swagger UI is available at `/docs`. In production, set `ENABLE_SWAGGER=false` to disable.
