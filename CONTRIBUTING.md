# Príspevok do projektu

Ďakujeme, že prispievate do projektu SFZ Asset Management. Tento dokument popisuje pravidlá a procesy.

## Workflow

1. **Branch z `main`** – pomenovanie: `feat/krátky-popis`, `fix/krátky-popis`, `docs/krátky-popis`, `refactor/...`.
2. **Commits** – používame [Conventional Commits](https://www.conventionalcommits.org/).
3. **Pull Request** – aspoň jeden reviewer, CI musí byť zelená.
4. **Squash & merge** – pri merge do `main`.

## Conventional Commits

Formát: `typ(scope): krátky popis`

| Typ | Použitie |
|-----|----------|
| `feat` | Nová funkcionalita |
| `fix` | Oprava bugu |
| `docs` | Iba dokumentácia |
| `style` | Formátovanie, bez funkčnej zmeny |
| `refactor` | Refactor bez zmeny správania |
| `perf` | Výkonová optimalizácia |
| `test` | Pridanie/úprava testov |
| `chore` | Údržba, build, dependencies |
| `ci` | CI/CD zmeny |

**Príklady:**
```
feat(api): add bulk loan endpoint
fix(web): correct QR scanner on Safari iOS
docs(adr): add ADR-0002 for NestJS choice
refactor(api): extract loan validation to use case
```

## Pred commitom

```bash
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # unit testy
pnpm format:check   # prettier
```

Husky + lint-staged toto presadia automaticky.

## Code Review – očakávania

- Reviewer odpovie do 1 pracovného dňa (ak je urgentné, doplň `[urgent]` v title).
- Komentáre delíme:
  - `nit:` – kozmetické, nemusí byť vyriešené.
  - `suggestion:` – návrh, autor zváži.
  - `must:` – blokujúci, treba opraviť.
  - `question:` – pýtam sa, nie nevyhnutne treba zmeniť.

## Dokumentácia

- Každá nová funkcionalita → aktualizovaná `docs/functional-spec.md` (ak relevantné).
- Každé významné architektonické rozhodnutie → nové ADR v `docs/decisions/`.
- Verejné API zmeny → aktualizovaný OpenAPI spec + changelog.

## Testovanie

Cieľová coverage:
- **Backend (NestJS):** 70 %+ na business logiku (use cases, services).
- **Frontend (Next.js):** 60 %+, dôraz na E2E (Playwright) pre kritické flows.
- **MCP server:** 80 %+ – malý povrch, mali by sme to vedieť dobre otestovať.

## Bezpečnosť

- **Nikdy** necommitovať `.env`, kľúče, certifikáty, heslá.
- Ak si nájdeš secret v commit histórii, **okamžite** to nahlás tech leadovi a rotuj credentials.
- Závislosti pravidelne aktualizujeme cez Dependabot / Renovate.

## Otázky?

Otvor diskusiu v GitHub Discussions alebo kontaktuj tech leada.
