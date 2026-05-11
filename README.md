# SFZ Asset Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-planning-orange)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> **Otvorený interný systém Slovenského futbalového zväzu na evidenciu a vypožičiavanie majetku.**

| | |
|---|---|
| **Status** | 🟡 Plánovanie / Funkčná špecifikácia |
| **Verzia** | 0.1 (draft) |
| **Posledná aktualizácia** | máj 2026 |
| **Licencia** | MIT |

---

## O projekte

Systém slúži na centrálnu evidenciu zmiešaného majetku SFZ (IT technika, športové vybavenie, kancelárske vybavenie) a na riadenie jeho životného cyklu vrátane vypožičiavania, vrátenia a vyradenia.

**Dôležité:** Ide o **evidenčný**, nie účtovný systém. Neslúži na odpisy, fakturáciu ani účtovné súvzťažnosti.

### Kľúčové vlastnosti

- 📦 Evidencia zmiešaného majetku s flexibilným dátovým modelom
- 🔖 QR kódy a čiarové kódy pre rýchlu fyzickú identifikáciu
- 🔄 Workflow vypožičania, predĺženia a vrátenia s elektronickými protokolmi
- 📜 Plná história pohybov a audit log
- 🔐 SSO cez Microsoft Entra ID
- 🌐 Otvorené REST API (OpenAPI 3.1) pre budúcu mobilnú aplikáciu (Flutter)
- 🤖 MCP server pre integráciu s AI asistentmi

### Prečo open-source?

SFZ sa rozhodol publikovať tento systém ako open-source, aby:
- ďalšie športové zväzy a organizácie mohli z neho ťažiť bez nákladov,
- vývoj bol transparentný pre verejnosť,
- komunita vývojárov mohla prispievať vylepšeniami,
- bezpečnostné audity mohli prebiehať otvorene.

---

## Technologický stack

| Vrstva | Technológia |
|--------|-------------|
| Backend | Node.js 20+, NestJS, TypeScript |
| Frontend (web) | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui |
| Mobilná aplikácia | Flutter (plánované, fáza 3) |
| Databáza | MongoDB Atlas |
| Autentifikácia | Microsoft Entra ID (OIDC / SSO) |
| MCP server | Node.js, `@modelcontextprotocol/sdk` |
| Monorepo | pnpm workspaces + Turborepo |
| CI/CD | GitHub Actions |
| Hosting | Cloud (preferovane Azure) – TBD |

---

## Štruktúra repa

```
Asset-Management/
├── apps/
│   ├── api/                # NestJS backend (REST API + OpenAPI)
│   ├── web/                # Next.js webový frontend
│   ├── mcp-server/         # MCP server pre AI asistentov
│   └── mobile/             # Flutter aplikácia (fáza 3)
├── packages/
│   ├── shared-types/       # Zdieľané TS typy a Zod schémy
│   ├── api-client/         # Vygenerovaný TS klient z OpenAPI
│   ├── ui/                 # Zdieľané React komponenty
│   └── config/             # ESLint, TSConfig, Prettier presety
├── docs/
│   ├── functional-spec.md  # Funkčná špecifikácia
│   ├── architecture/       # Architektonické dokumenty (C4, dátový model)
│   ├── api/                # API špecifikácia (OpenAPI 3.1)
│   ├── workflows/          # Diagramy workflow-ov
│   └── decisions/          # ADR (Architecture Decision Records)
├── infra/
│   ├── docker/             # Dockerfile pre každú appku
│   ├── docker-compose.yml  # Lokálny dev (Mongo, Redis, MailHog)
│   └── terraform/          # IaC pre cloudovú infraštruktúru
└── .github/                # CI/CD, issue/PR templates, CODEOWNERS
```

---

## Dokumentácia

| Dokument | Popis | Status |
|----------|-------|--------|
| [Funkčná špecifikácia](docs/functional-spec.md) | Čo systém robí (moduly, roly, user stories) | ✅ v0.1 draft |
| [Architektúra](docs/architecture/README.md) | Architektonický prehľad, C4 diagramy | 🟡 čiastočne |
| [Dátový model](docs/architecture/data-model.md) | MongoDB kolekcie a vzťahy | ✅ v0.1 draft |
| [API špecifikácia](docs/api/openapi.yaml) | OpenAPI 3.1 | ✅ v0.1 draft |
| [MCP server](docs/architecture/mcp-server.md) | Špecifikácia MCP integrácie | ✅ v0.1 draft |
| [Workflows](docs/workflows/README.md) | Diagramy a popis kľúčových workflow-ov | 📅 v príprave |
| [ADR](docs/decisions/README.md) | Architecture Decision Records | ✅ ADR-0001 až ADR-0004 |

---

## Lokálny vývoj

> ⚠️ Repo je momentálne v plánovacej fáze. Kód aplikácií bude doplnený po schválení funkčnej špecifikácie.

### Predpoklady

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- MongoDB Atlas účet (alebo lokálny Mongo cez Docker)

### Spustenie (po doplnení kódu)

```bash
pnpm install
pnpm dev          # spustí všetky aplikácie paralelne (Turborepo)
```

---

## Ako prispieť

Vítame príspevky! Či už ide o opravu typu v dokumentácii, návrh novej funkcionality alebo refaktoring kódu – sme radi za každý PR.

- 📖 Prečítaj si [CONTRIBUTING.md](CONTRIBUTING.md) – workflow, conventional commits, code review pravidlá
- 📋 [Kódex správania](CODE_OF_CONDUCT.md) – Contributor Covenant 2.1
- 🐛 [Nahlás bug](../../issues/new?template=bug_report.yml)
- 💡 [Navrhni funkcionalitu](../../issues/new?template=feature_request.yml)
- 🛡️ [Bezpečnostné hlásenia](SECURITY.md) – pre zraniteľnosti použite Security Advisories, nie verejné issues

### Dobré first issues

Hľadáte spôsob ako začať? Pozrite si [issues s label `good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

---

## Licencia

Tento projekt je licencovaný pod [MIT licenciou](LICENSE) – môžete ho voľne používať, upravovať a distribuovať.

---

## Kontakty

| Rola | Osoba | Kontakt |
|------|-------|---------|
| Product owner | _doplniť_ | _doplniť_ |
| Tech lead | _doplniť_ | _doplniť_ |
| IT SFZ | _doplniť_ | _doplniť_ |
| Bezpečnosť | _doplniť_ | `security@futbalsfz.sk` |

---

## Poďakovanie

Tento projekt by nevznikol bez Slovenského futbalového zväzu, ktorý sa rozhodol prispieť späť do komunity tým, že interný nástroj sprístupní pod otvorenou licenciou. Ďakujeme tiež všetkým prispievateľom a komunite okolo NestJS, Next.js, MongoDB a Model Context Protocol.
