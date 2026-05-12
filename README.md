# SFZ Asset Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-planning-orange)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> **Otvorený interný systém Slovenského futbalového zväzu na evidenciu a vypožičiavanie majetku.**

|                           |                                                   |
| ------------------------- | ------------------------------------------------- |
| **Status**                | 🟡 Plánovanie / Funkčná špecifikácia + foundation |
| **Verzia**                | 0.1 (draft)                                       |
| **Posledná aktualizácia** | máj 2026                                          |
| **Licencia**              | MIT                                               |

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

| Vrstva            | Technológia                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Backend           | Node.js 20+, NestJS, TypeScript                                                                              |
| Frontend (web)    | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui                                         |
| Mobilná aplikácia | Flutter (plánované, fáza 3)                                                                                  |
| Databáza          | MongoDB Atlas + Native driver + Zod (žiadne ORM, viď [ADR-0005](docs/decisions/0005-mongo-native-driver.md)) |
| Autentifikácia    | Microsoft Entra ID (OIDC / SSO)                                                                              |
| MCP server        | Node.js, `@modelcontextprotocol/sdk`                                                                         |
| Monorepo          | pnpm workspaces + Turborepo                                                                                  |
| CI/CD             | GitHub Actions                                                                                               |
| Hosting           | Cloud (preferovane Azure) – TBD                                                                              |

---

## Štruktúra repa

```
Asset-Management/
├── apps/                     # (TBD)
│   ├── api/                  # NestJS backend (REST API + OpenAPI)
│   ├── web/                  # Next.js webový frontend
│   ├── mcp-server/           # MCP server pre AI asistentov
│   └── mobile/               # Flutter aplikácia (fáza 3)
├── packages/
│   ├── shared-types/         # ✅ Zod schémy + TS typy + JSON Schema generátor
│   ├── design-tokens/        # ✅ SFZ brand farby, typografia, spacing
│   ├── api-client/           # 📅 Vygenerovaný TS klient z OpenAPI (TBD)
│   ├── ui/                   # 📅 Zdieľané React komponenty (TBD)
│   └── config/               # 📅 ESLint, TSConfig, Prettier presety (TBD)
├── docs/
│   ├── functional-spec.md    # ✅ Funkčná špecifikácia
│   ├── architecture/         # ✅ Dátový model, MCP server spec
│   ├── api/                  # ✅ OpenAPI 3.1
│   ├── decisions/            # ✅ 5× ADR
│   ├── user-guide/           # ✅ Diátaxis dokumentácia (4 sekcie)
│   ├── assets/brand/         # ✅ SFZ Design Manual 2024-01
│   └── workflows/            # 📅 Workflow diagramy (TBD)
├── infra/
│   ├── docker-compose.yml    # ✅ Mongo + Mongo Express + MailHog + MinIO
│   └── terraform/            # 📅 IaC pre cloudovú infraštruktúru (TBD)
└── .github/                  # ✅ CI/CD, issue/PR templates, CODEOWNERS
```

Legenda: ✅ hotové · 🟡 v progrese · 📅 plánované

---

## Dokumentácia

### Pre používateľov

📖 **[Používateľská príručka](docs/user-guide/)** — onboarding tutoriály, how-to návody, reálne scenáre, slovník pojmov. Tykáme čitateľovi, písané prirodzene v slovenčine.

### Pre vývojárov a integrátorov

| Dokument                                                 | Popis                                       | Status        |
| -------------------------------------------------------- | ------------------------------------------- | ------------- |
| [Funkčná špecifikácia](docs/functional-spec.md)          | Čo systém robí (moduly, roly, user stories) | ✅ v0.1 draft |
| [Architektúra](docs/architecture/README.md)              | Architektonický prehľad, C4 diagramy        | 🟡 čiastočne  |
| [Dátový model](docs/architecture/data-model.md)          | MongoDB kolekcie a vzťahy                   | ✅ v0.1 draft |
| [API špecifikácia](docs/api/openapi.yaml)                | OpenAPI 3.1 (57 endpointov)                 | ✅ v0.1 draft |
| [MCP server](docs/architecture/mcp-server.md)            | Špecifikácia MCP integrácie                 | ✅ v0.1 draft |
| [ADR](docs/decisions/README.md)                          | Architecture Decision Records               | ✅ 5× ADR     |
| [shared-types README](packages/shared-types/README.md)   | Single source of truth pre dátový model     | ✅            |
| [design-tokens README](packages/design-tokens/README.md) | SFZ brand farby a typografia                | ✅            |

---

## Lokálny vývoj

> ⚠️ Repo je momentálne v plánovacej fáze. Kód aplikácií (`apps/`) bude doplnený po dokončení foundation v packages/.

### Predpoklady

- **Node.js** `20.11.0` (riadi `.nvmrc`)
- **pnpm** `9.12.0+`
- **Docker + Docker Compose** (pre lokálnu Mongo, MinIO, MailHog)
- **VS Code** (odporúčané — automaticky ti ponúkne potrebné rozšírenia)

### Spustenie

```bash
# 1. Klonuj repo a nainštaluj závislosti
git clone https://github.com/jletko/Asset-Management.git
cd Asset-Management
pnpm install

# 2. Nakopíruj environment template
cp .env.example .env
# (uprav podľa potreby — predvolené hodnoty sú pre lokálny dev OK)

# 3. Spusti lokálnu infraštruktúru
docker compose -f infra/docker-compose.yml up -d
#   → MongoDB na :27017
#   → Mongo Express UI na http://localhost:8081
#   → MailHog UI na http://localhost:8025
#   → MinIO Console na http://localhost:9001

# 4. Build packages (zatiaľ len shared-types a design-tokens)
pnpm build

# 5. Spustenie testov
pnpm test
```

Detaily o lokálnej infraštruktúre v [`infra/README.md`](infra/README.md).

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

**Pozor:** Logá a brand prvky SFZ ([`docs/assets/brand/`](docs/assets/brand/)) **nie sú súčasťou MIT licencie**. Ak forkneš tento repozitár pre vlastnú organizáciu, musíš ich nahradiť vlastnými.

---

## Kontakty

| Rola          | Osoba     | Kontakt                 |
| ------------- | --------- | ----------------------- |
| Product owner | _doplniť_ | _doplniť_               |
| Tech lead     | _doplniť_ | _doplniť_               |
| IT SFZ        | _doplniť_ | _doplniť_               |
| Bezpečnosť    | _doplniť_ | `security@futbalsfz.sk` |

---

## Poďakovanie

Tento projekt by nevznikol bez Slovenského futbalového zväzu, ktorý sa rozhodol prispieť späť do komunity tým, že interný nástroj sprístupní pod otvorenou licenciou. Ďakujeme tiež všetkým prispievateľom a komunite okolo NestJS, Next.js, MongoDB a Model Context Protocol.

Brand a vizuál: **Codes Brand House** (autori SFZ Design Manual 2024-01).
