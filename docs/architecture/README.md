# Architektúra systému

> **Status:** 📅 V príprave – bude dopracované po schválení funkčnej špecifikácie.

Tento dokument popisuje technickú architektúru systému SFZ Asset Management.

## Obsah (plánovaný)

- [Prehľad architektúry](overview.md) – C4 model (kontext, kontajnery, komponenty) 📅 v príprave
- [Dátový model](data-model.md) – MongoDB kolekcie, indexy, vzťahy ✅
- [Bezpečnostná architektúra](security.md) – autentifikácia, autorizácia, šifrovanie 📅 v príprave
- [MCP server](mcp-server.md) – špecifikácia MCP integrácie ✅
- [Deployment](deployment.md) – infraštruktúra, CI/CD, monitoring 📅 v príprave

## High-level prehľad

```
┌────────────────┐       ┌────────────────┐       ┌─────────────────┐
│  Web (Next.js) │       │ Mobile (Flutter)│       │ AI Asistenti    │
│                │       │   (fáza 3)      │       │ (cez MCP)       │
└────────┬───────┘       └────────┬────────┘       └────────┬────────┘
         │                        │                         │
         │ HTTPS / REST           │ HTTPS / REST            │ MCP (SSE)
         │                        │                         │
         ▼                        ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API Gateway / Load Balancer                    │
└─────────┬──────────────────────────────────────────┬─────────────────┘
          │                                          │
          ▼                                          ▼
┌─────────────────────┐                  ┌──────────────────────┐
│   API (NestJS)      │                  │   MCP Server         │
│   - REST endpoints  │                  │   (Node.js)          │
│   - OpenAPI 3.1     │                  │                      │
│   - RBAC            │                  │                      │
└──────────┬──────────┘                  └──────────┬───────────┘
           │                                        │
           └────────────────┬───────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       ┌─────────────┐ ┌────────┐ ┌────────────────┐
       │  MongoDB    │ │ Object │ │ Microsoft      │
       │  Atlas      │ │ Storage│ │ Entra ID       │
       │             │ │ (S3)   │ │ + Graph API    │
       └─────────────┘ └────────┘ └────────────────┘
```

## Technologické rozhodnutia (zhrnutie)

Podrobné odôvodnenia jednotlivých rozhodnutí sú v [ADR](../decisions/).

| Vrstva   | Voľba                       | Hlavný dôvod                                          |
| -------- | --------------------------- | ----------------------------------------------------- |
| Backend  | NestJS + TypeScript         | Modulárna architektúra, OpenAPI integrácia, ekosystém |
| Frontend | Next.js 14+ App Router      | SSR/RSC, dobré DX, kompatibilita s SFZ ekosystémom    |
| Databáza | MongoDB Atlas               | Flexibilný dátový model pre zmiešaný majetok, managed |
| Auth     | Microsoft Entra ID          | Existujúca IT infraštruktúra SFZ                      |
| Mobil    | Flutter                     | Jedna codebase pre iOS + Android                      |
| MCP      | `@modelcontextprotocol/sdk` | Štandard pre AI integrácie                            |
| Monorepo | pnpm + Turborepo            | Rýchlosť, zdieľanie kódu medzi appkami                |
| CI/CD    | GitHub Actions              | Štandard, dobre integrované                           |

## Ďalšie kroky

Po schválení funkčnej špecifikácie:

1. Dopracovať detail dátového modelu (`data-model.md`)
2. Pripraviť OpenAPI 3.1 spec (`../api/openapi.yaml`)
3. Špecifikovať MCP server tools (`mcp-server.md`)
4. C4 diagramy (Context, Container, Component)
