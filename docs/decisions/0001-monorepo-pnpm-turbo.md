# 0001. Monorepo s pnpm workspaces + Turborepo

| | |
|---|---|
| **Status** | Accepted |
| **Dátum** | máj 2026 |
| **Autori** | tím SFZ Asset Management |
| **Súvisiace ADR** | – |

## Kontext

Projekt SFZ Asset Management bude pozostávať z viacerých aplikácií a balíkov:
- `apps/api` – NestJS backend (REST + OpenAPI)
- `apps/web` – Next.js webový frontend
- `apps/mcp-server` – MCP server pre AI asistentov
- `apps/mobile` – Flutter aplikácia (fáza 3)
- `packages/shared-types` – zdieľané TypeScript typy a Zod schémy medzi BE a FE
- `packages/api-client` – TypeScript klient vygenerovaný z OpenAPI
- `packages/ui` – zdieľané React komponenty (shadcn/ui base)
- `packages/config` – zdieľané konfigurácie (ESLint, TSConfig, Prettier)

Potrebujeme zvoliť, ako organizovať kód: viacero samostatných repov alebo jeden monorepo.

## Možnosti

### Možnosť A: Polyrepo (viacero samostatných git repov)
- **Plus:** jednoduchšie permissions per repo, menšie repo per developer, ostrejšie hranice.
- **Mínus:** komplikované zdieľanie typov medzi BE a FE (publikovanie balíkov), viacnásobné CI pipelines, ťažšie cross-cutting zmeny (zmena v API si vyžaduje 3 PR-y v 3 repos).

### Možnosť B: Monorepo s npm/yarn workspaces (bez Turborepo)
- **Plus:** jeden repo, zdieľanie cez workspaces je natívne.
- **Mínus:** bez caching nástroja sa build/test zbytočne opakuje aj pre nezmenené balíky, pomalé CI.

### Možnosť C: Monorepo s pnpm workspaces + Turborepo (zvolené)
- **Plus:** pnpm má efektívne disk/install (content-addressable store), Turborepo poskytuje incremental build, remote caching, parallel execution.
- **Plus:** zdieľanie typov BE ↔ FE bez publikovania.
- **Plus:** atomické commits pre cross-cutting zmeny (zmena API + FE + dokumentácia v jednom PR).
- **Plus:** dobre podporované VS Code, GitHub Actions.
- **Mínus:** vyššia počiatočná konfiguračná réžia oproti polyrepo.
- **Mínus:** Flutter app (`apps/mobile`) bude v monorepe technicky cudzia – Flutter má vlastný Dart toolchain, nezdieľa balíky cez pnpm. Bude tam v samostatnom subdire s vlastným `pubspec.yaml`, monorepo poskytuje len lokačné zarovnanie a spoločný CI.

### Možnosť D: Nx
- **Plus:** podobné výhody ako Turborepo, mocnejšie nástroje (graf závislostí, generators).
- **Mínus:** strmšia krivka učenia, viac „opinionated", väčšia konfigurácia.

## Rozhodnutie

Zvolili sme **monorepo s pnpm workspaces + Turborepo (Možnosť C)**.

Dôvody:
- Projekt má silné zdieľanie typov medzi BE a FE (zod schémy, OpenAPI typy) – monorepo to robí triviálne.
- Tím je malý, polyrepo by pridalo komplexitu bez prínosu.
- Turborepo je ľahší než Nx a pre náš rozsah úplne postačuje.
- Flutter app pôjde do `apps/mobile/` ako sused, bez integrácie s pnpm – jasne oddelený toolchain.

## Dôsledky

### Pozitívne
- Jeden PR môže obsahovať zmenu API + FE + dokumentáciu.
- Lokálne `pnpm dev` spustí celý stack paralelne.
- CI cache cez Turborepo dramaticky skráti build time.

### Negatívne / kompromisy
- Repo bude rásť – treba dbať o `.gitignore` (žiadne `node_modules`, žiadne buildy).
- Flutter v monorepo je trochu „cudzí element" – nutné zdokumentovať osobitne v `apps/mobile/README.md`.

### Riziká, ktoré treba sledovať
- Ak by sa projekt rozrástol na 10+ aplikácií, môže byť potrebné prejsť na Nx.
- Veľkosť repa – ak presiahne 5 GB, zvážiť git-lfs alebo split.

## Referencie

- [pnpm workspaces](https://pnpm.io/workspaces)
- [Turborepo](https://turborepo.com/)
- [Monorepo.tools – porovnanie](https://monorepo.tools/)
