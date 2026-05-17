# @inventario/api — Inventario Backend

Fastify-based REST API serving Inventario — a multi-tenant, white-label asset management platform. Deployed on Vercel Serverless Functions.

See [ADR-0009](../../docs/decisions/0009-backend-fastify.md) for the architectural rationale.

## Quick start

```bash
# From repo root: install all dependencies (only first time)
pnpm install

# Copy env template and fill in MONGO_URI from MongoDB Atlas
# and ENTRA_TENANT_ID + ENTRA_API_CLIENT_ID from Azure Portal
cd apps/api
cp .env.example .env.local
# Edit .env.local

# Start dev server (auto-reload on file changes)
pnpm dev
```

The API will be running at <http://localhost:3000>.

## Verifying it works

```bash
# Health check (no auth required)
curl http://localhost:3000/health
# → { "status": "ok", "uptime": 12.345, "timestamp": "2026-05-12T..." }

# List assets (requires valid Entra ID JWT — see "Getting a test token" below)
curl http://localhost:3000/v1/assets \
  -H "Authorization: Bearer $TOKEN"
# → { "data": [...], "pagination": { "hasMore": false, ... } }

# Without a token — should fail with 401
curl http://localhost:3000/v1/assets
# → { "statusCode": 401, "error": "Unauthorized", "message": "Missing Authorization header" }
```

Open <http://localhost:3000/docs> in your browser for interactive Swagger UI —
click the **Authorize** button to paste your JWT and try authenticated endpoints.

## Getting a test token (Entra ID device code flow)

To call protected endpoints from `curl` or Postman, you need an access token.
The simplest way is the OAuth 2.0 device code flow:

```bash
# Set these from your .env.local
TENANT_ID="<ENTRA_TENANT_ID>"
API_CLIENT_ID="<ENTRA_API_CLIENT_ID>"
# This is the CLI app registration's client ID (different from the API one!)
CLI_CLIENT_ID="<your-cli-app-client-id>"

# 1. Request a device code
curl -s -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode" \
  -d "client_id=${CLI_CLIENT_ID}" \
  -d "scope=api://${API_CLIENT_ID}/access_as_user" | tee /tmp/devicecode.json

# 2. Open the verification URL and enter the user_code shown above.
#    Sign in with your Entra account.

# 3. Poll for the token (run this AFTER signing in)
DEVICE_CODE=$(jq -r .device_code /tmp/devicecode.json)
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
  -d "client_id=${CLI_CLIENT_ID}" \
  -d "device_code=${DEVICE_CODE}" | jq -r .access_token)

# 4. Use it!
curl http://localhost:3000/v1/me -H "Authorization: Bearer $TOKEN"
# → { "_id": "...", "email": "...", "roles": ["EMPLOYEE"], ... }
```

The token is valid for ~1 hour. After that, repeat the flow.

**First-time call to `/v1/me`** triggers JIT provisioning: a new `users` document
is created with the default `EMPLOYEE` role. Subsequent calls return the
existing record and update `lastLoginAt`.

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
│   │   ├── auth.ts           # Entra ID JWT verification (requireAuth)
│   │   ├── error-handler.ts  # Global error handling
│   │   └── swagger.ts        # OpenAPI generation + Swagger UI
│   │
│   └── modules/              # Domain modules
│       ├── health/
│       │   └── health.routes.ts   # GET /health, /health/ready (public)
│       ├── users/
│       │   ├── users.routes.ts    # GET /v1/me
│       │   ├── users.service.ts   # JIT provisioning logic
│       │   └── users.repository.ts
│       └── assets/
│           ├── assets.routes.ts    # GET /v1/assets (protected)
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

OpenAPI 3.1 spec is auto-generated from Fastify route schemas via `@fastify/swagger` + `fastify-type-provider-zod`. The Zod schemas are pulled directly from `@inventario/shared-types`.

In development, Swagger UI is available at `/docs`. In production, set `ENABLE_SWAGGER=false` to disable.

#### Static export (`openapi.json`)

The live OpenAPI document is exported to [`openapi.json`](./openapi.json) at the apps/api root. This file is committed to git and is the canonical contract for downstream consumers:

- **`apps/web` (Slice #4)** — generates a typed HTTP client from this file (planned via `openapi-typescript` + `openapi-fetch`).
- **External integration partners** — third parties can read the spec without booting the API server.
- **EU procurement / interoperability** — a static OpenAPI 3.1 artefact is a checkbox item in many public-sector tenders (European Interoperability Framework, ISA²).

Regenerate the file after any route or schema change:

```bash
pnpm --filter @inventario/api openapi:export
git add apps/api/openapi.json
git commit -m "chore(api): refresh openapi.json"
```

CI fails the `OpenAPI Spec Freshness` job (`pnpm openapi:export -- --check`) if the committed file is stale, so any API change that forgets to regenerate is caught before merge.

### Auth (Entra ID)

Protected routes use the `fastify.requireAuth` preHandler, which:

1. Reads `Authorization: Bearer <token>` from the request
2. Validates the JWT signature against Microsoft's JWKS (cached for 10 min via `get-jwks`)
3. Checks `iss`, `aud`, `ver`, and the `access_as_user` scope
4. Attaches the parsed claims to `request.entraClaims` for downstream handlers

On first request, `users.service.ts` JIT-provisions a new `users` document with the
default `EMPLOYEE` role. Role escalation (e.g. promoting someone to `ADMIN`) is
currently a manual DB edit — admin endpoints come in slice #2b.

See `src/plugins/auth.ts` for the verification flow and `src/modules/users/users.service.ts`
for JIT provisioning logic.
