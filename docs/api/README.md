# API špecifikácia

|                  |                              |
| ---------------- | ---------------------------- |
| **Verzia API**   | v1                           |
| **Špecifikácia** | OpenAPI 3.1                  |
| **Súbor**        | [openapi.yaml](openapi.yaml) |
| **Status**       | 🟡 Draft v0.1                |

## Princípy API dizajnu

### RESTful konvencie

- **Kolekcie** v plurále: `/assets`, `/loans`, `/users`.
- **HTTP metódy** podľa sémantiky:
  - `GET` – čítanie (idempotentné, bezpečné)
  - `POST` – vytvorenie alebo akcia
  - `PATCH` – čiastočná aktualizácia (preferujeme pred PUT)
  - `PUT` – kompletná náhrada (zriedka)
  - `DELETE` – mazanie (soft-delete na úrovni aplikácie)
- **Statusové kódy:**
  - `200 OK` – úspech s telom
  - `201 Created` – vytvorenie (s `Location` headerom)
  - `204 No Content` – úspech bez tela
  - `400 Bad Request` – validačná chyba
  - `401 Unauthorized` – chýbajúci/neplatný token
  - `403 Forbidden` – nedostatok oprávnení
  - `404 Not Found` – entita neexistuje
  - `409 Conflict` – konflikt stavu (napr. asset už vypožičaný)
  - `422 Unprocessable Entity` – sémanticky neplatný request
  - `429 Too Many Requests` – rate limit
  - `500 Internal Server Error` – serverová chyba

### Verzovanie

- URL versioning: `/api/v1/...`
- Breaking changes = nová major verzia (`v2`).
- Backward-compatible zmeny (nové polia, nové endpointy) v rámci `v1`.

### Pagination

Cursor-based pagination pre veľké kolekcie:

```http
GET /api/v1/assets?limit=50&cursor=eyJ...
```

Odpoveď:

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJ...",
    "hasMore": true,
    "limit": 50
  }
}
```

### Filtrovanie

```http
GET /api/v1/assets?status=available&categoryId=...&search=notebook
```

### Triedenie

```http
GET /api/v1/assets?sort=createdAt:desc,name:asc
```

### Chybové odpovede (RFC 7807 Problem Details)

```json
{
  "type": "https://api.sfz.sk/errors/asset-already-borrowed",
  "title": "Asset is already borrowed",
  "status": 409,
  "detail": "Asset SFZ-2026-00042 is currently borrowed by user@sfz.sk",
  "instance": "/api/v1/loan-requests",
  "errors": [
    {
      "field": "items[0].assetId",
      "code": "asset_not_available"
    }
  ],
  "requestId": "req-abc123"
}
```

### Autentifikácia

Bearer token v `Authorization` headeri:

```http
Authorization: Bearer eyJhbGciOiJ...
```

Tokeny získané cez Entra ID OIDC flow. Pre externých používateľov možnosť dlhoplatných personal access tokens (PAT).

### Rate limiting

- Default: 100 req/min per používateľ
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headery v odpovedi

### Request ID

Každý request má v odpovedi `X-Request-ID` header pre traceability. Klient môže poslať vlastné `X-Request-ID` pre korreláciu.

### Idempotency

Pre `POST` operácie, ktoré majú vedľajšie efekty (napr. vytvorenie loanu, odoslanie notifikácie), podporujeme `Idempotency-Key` header. Server zaručí, že rovnaký kľúč s rovnakým telom vykoná operáciu len raz.

```http
POST /api/v1/loans
Idempotency-Key: 0a1b2c3d-...
```

## OpenAPI nástroje

- **Generovanie TS klienta:** `pnpm generate:api-client` (skript v `packages/api-client/`)
- **Generovanie Dart klienta** (pre Flutter): `pnpm generate:dart-client`
- **Swagger UI:** dostupné na `/api/docs` v dev a staging prostredí (v produkcii vypnuté, alebo za auth gate)
- **Validácia spec-u v CI:** `redocly lint docs/api/openapi.yaml`

## Štruktúra súboru

Hlavná špecifikácia je v jedinom `openapi.yaml`. Ak narastie nad ~3000 riadkov, rozdelíme cez `$ref` do `paths/`, `schemas/`, `responses/` súborov.

## Generovanie dokumentácie

```bash
# Pekná HTML dokumentácia
npx @redocly/cli build-docs docs/api/openapi.yaml -o docs/api/index.html

# Lokálny preview Swagger UI
npx @redocly/cli preview-docs docs/api/openapi.yaml
```
