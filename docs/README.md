# Dokumentácia projektu

Tento adresár obsahuje všetku projektovú dokumentáciu. Dokumentácia je verzovaná spolu s kódom – akákoľvek zmena prechádza cez Pull Request.

## Štruktúra

```
docs/
├── functional-spec.md          # Funkčná špecifikácia (hlavný dokument)
├── architecture/               # Architektonické dokumenty
│   ├── README.md               # Prehľad
│   ├── overview.md             # C4 high-level pohľad
│   ├── data-model.md           # MongoDB kolekcie a vzťahy
│   ├── security.md             # Bezpečnostná architektúra
│   └── mcp-server.md           # Špecifikácia MCP servera
├── api/
│   ├── openapi.yaml            # OpenAPI 3.1 špecifikácia
│   └── README.md               # Pravidlá API designu
├── workflows/                  # Diagramy a popis workflow-ov
│   └── README.md
└── decisions/                  # Architecture Decision Records (ADR)
    ├── README.md
    ├── template.md             # Šablóna pre nové ADR
    └── 0001-monorepo-pnpm-turbo.md
```

## Konvencie

- **Markdown** ako primárny formát, s podporou Mermaid diagramov.
- **Diagramy** prednostne v Mermaid (renderované priamo v GitHube/GitLabe). Pre zložité diagramy (C4) možno použiť PlantUML alebo Draw.io (uložené aj ako SVG/PNG do `assets/`).
- **Slovenčina** v dokumentoch, **angličtina** v identifikátoroch, kóde a OpenAPI.
- Každý dokument má v hlavičke: verziu, status, dátum poslednej aktualizácie.

## Live dokumenty vs. archivované

Dokumenty v `docs/` sú **live** – aktualizujú sa s vývojom projektu. Konkrétne snapshoty pre formálne schválenia (napr. „verzia odovzdaná vedeniu") sa exportujú ako PDF do priečinka `docs/releases/` (pridáme podľa potreby).
