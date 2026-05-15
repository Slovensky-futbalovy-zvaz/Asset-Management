<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Changelog

Všetky významné zmeny v projekte sú zaznamenané v tomto súbore.

Formát vychádza zo štandardu [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), verziovanie podľa [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Strategický pivot z _SFZ Asset Management_ na **Inventario** — multi-tenant white-label platformu pre športové zväzy, mestá a obce, VÚC, kluby, školy a neziskové organizácie.
- Licencia zmenená z MIT na **EUPL-1.2** (zdrojový kód) + **CC-BY-4.0** (dokumentácia) — pripravené pre EU verejný sektor a EU rozvojové fondy.
- Brand identita prevzatá z [SportUp ekosystému](https://github.com/ltksolutions/sportup.sk) — Navy `#1A2D47`, Blue `#388FC3`, Paper `#F8F6F1`, font Poppins.
- README.md kompletne prepísaný — Inventario branding, SFZ pozícia ako _founding contributor_.

### Added

- ADR-0010: Multi-tenant white-label architektúra (logical multi-tenancy + open-source fork stratégia).
- ADR-0011: Open-source licensing — EUPL-1.2 + CC-BY-4.0 + REUSE 3.3 compliance.
- `LICENSE-DOCS` (CC-BY-4.0 plný text) pre dokumentáciu.
- `LICENSES/CC-BY-4.0.txt` (REUSE 3.3 konvencia).
- `REUSE.toml` — centrálne licenčné mapovanie podľa REUSE 3.3 špecifikácie.
- `CITATION.cff` — citačné metadata pre verejné a vedecké inštitúcie.
- `CHANGELOG.md` — tento súbor (Keep a Changelog formát).
- `docs/sessions/2026-05-15-design-pivot.md` — plán strategickej design session.

## [0.3.0] — 2026-05-14 — Slice #3 (čiastočne)

### Added

- **Categories modul** — hierarchická správa kategórií majetku.
  - CRUD endpointy s RBAC (GET pre EMPLOYEE+, POST/PATCH pre ASSET_MANAGER+, DELETE pre ADMIN).
  - Automatické generovanie slug-ov z mien (s podporou slovenčiny — diakritika sa transliteruje).
  - Hierarchia s detekciou cyklov a max hĺbkou 5 úrovní (root + 4 nested).
  - Audit log s typmi CATEGORY_CREATED/UPDATED/DELETED.
- **Locations modul** — hierarchická správa lokácií majetku (rovnaký pattern ako categories).
- **FK protection (K7)** — assets nemôžu byť vytvorené/updatnuté s neexistujúcim `categoryId` alebo `locationId`.
- **FK protection (K9)** — categories/locations nemôžu byť deletnuté ak na nich nezávislé (non-deleted) assets ukazujú.
- **Slugify utility** (`src/lib/slugify.ts`) — Unicode NFD-based transliterácia, dedikované unit testy.
- **Hierarchy utility** (`src/lib/hierarchy.ts`) — cycle detection + max depth check pre CREATE aj PATCH operácie.
- **Test helper `seedAssetFkRefs`** — vytvorí real category + location pre asset testy.
- **257 integration testov** pokrývajúcich celý backend (vrátane FK protection, audit, RBAC).

## [0.2.0] — 2026-05-13 — Slice #2c

### Added

- **CI Atlas** integration tests — testy bežia proti reálnej MongoDB Atlas dev instancii pri každom PR.
- **Pre-commit hooks** — Husky + lint-staged + TypeScript typecheck pred každým commit-om.
- **Atlas dev cluster** (`sfz-asset-mgmt-dev`) + production cluster (`sfz-asset-mgmt-prod`).
- **Milestone dokument** `docs/milestones/slice-2c-tests-and-pre-commit.md`.

## [0.1.5] — 2026-05-12 — Slice #2b

### Added

- **Assets modul** — kompletný CRUD s RBAC, audit log, MongoDB transactions, soft-delete.
- **Inventory number generator** — automatické generovanie sekvenčných čísel `PREFIX-YYYY-NNN`.
- **AuditLogService** — append-only kolekcia s ActorContext, target referencom a JSON diff-om zmien.

## [0.1.0] — 2026-05-10 — Slice #2

### Added

- **Microsoft Entra ID autentifikácia** — JWT verifikácia s JWKS rotáciou.
- **JIT user provisioning** — pri prvom prihlásení sa user automaticky pridá do DB.
- **RBAC matrix** — UserRole enum (EMPLOYEE, ASSET_MANAGER, ADMIN).

## [0.0.1] — 2026-05-09 — Slice #1 (Backend bootstrap)

### Added

- pnpm monorepo s Turborepo (apps/api, apps/web, apps/mcp-server, packages/shared-types, packages/design-tokens).
- Fastify backend skeleton (TypeScript, Vitest, ESLint, Prettier).
- MongoDB Atlas Flex tier setup + Native driver + Zod schema validation.
- Conventional Commits + commitlint + Husky.
- ADR-čká 0001-0005 (monorepo, MongoDB, Entra ID, native driver) + 0009 (Fastify nahrádza NestJS).

---

[Unreleased]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/releases/tag/v0.3.0
[0.2.0]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/releases/tag/v0.2.0
[0.1.5]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/releases/tag/v0.1.5
[0.1.0]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/releases/tag/v0.1.0
[0.0.1]: https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/releases/tag/v0.0.1
