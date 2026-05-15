<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Príspevok do projektu Inventario

Ďakujeme, že prispievate do projektu **Inventario** — otvorenej platformy pre správu majetku organizácií. Tento dokument popisuje pravidlá a procesy.

## O projekte

Inventario je open-source projekt licencovaný pod **EUPL-1.2** (zdrojový kód) a **CC-BY-4.0** (dokumentácia). Repozitár je [REUSE 3.3 compliant](https://reuse.software/spec/). Detaily v [ADR-0011](docs/decisions/0011-licensing-eupl-reuse.md).

## Workflow

1. **Branch z `main`** — pomenovanie: `feat/krátky-popis`, `fix/krátky-popis`, `docs/krátky-popis`, `refactor/...`.
2. **Commits** — používame [Conventional Commits](https://www.conventionalcommits.org/).
3. **DCO sign-off** — každý commit musí byť podpísaný (`git commit -s`). Viď sekciu nižšie.
4. **Pull Request** — aspoň jeden reviewer, CI musí byť zelená (vrátane REUSE lint).
5. **Squash & merge** — pri merge do `main`.

## Developer Certificate of Origin (DCO)

Namiesto Contributor License Agreement (CLA) používame **DCO** — jednoduchý záväzok že máš právo prispieť svoj kód pod licenciou projektu.

### Ako sign-off

Pridaj `--signoff` (alebo skratku `-s`) ku každému commit-u:

```bash
git commit -s -m "feat(api): add bulk asset import"
```

To pridá riadok na koniec commit message:

```
Signed-off-by: Tvoje Meno <tvoj@email.sk>
```

### Čo DCO znamená

Pridaním `Signed-off-by:` potvrdzuješ že:

1. Príspevok bol vytvorený tebou v celosti, alebo
2. Príspevok je založený na predchádzajúcej práci ktorú máš právo predložiť pod licenciou projektu (EUPL-1.2 alebo CC-BY-4.0 v závislosti od typu súboru), alebo
3. Príspevok ti bol poskytnutý priamo treťou stranou ktorá potvrdila bod 1 alebo 2.

Plný text: [developercertificate.org](https://developercertificate.org/)

### Bez sign-off CI zlyhá

GitHub Action `dco-check` overuje prítomnosť `Signed-off-by:` v každom commit-e v PR. Bez toho PR nemôže byť mergnutý.

## Conventional Commits

Formát: `typ(scope): krátky popis`

| Typ        | Použitie                         |
| ---------- | -------------------------------- |
| `feat`     | Nová funkcionalita               |
| `fix`      | Oprava bugu                      |
| `docs`     | Iba dokumentácia                 |
| `style`    | Formátovanie, bez funkčnej zmeny |
| `refactor` | Refactor bez zmeny správania     |
| `perf`     | Výkonová optimalizácia           |
| `test`     | Pridanie/úprava testov           |
| `chore`    | Údržba, build, dependencies      |
| `ci`       | CI/CD zmeny                      |

**Príklady:**

```
feat(api): add bulk loan endpoint
fix(web): correct QR scanner on Safari iOS
docs(adr): add ADR-0010 for multi-tenant architecture
refactor(api): extract loan validation to use case
```

### Bullety v commit message

Pri commit-och s viacerými zmenami **nepoužívaj `Fix:` ako prefix bullet-u** — commitlint to interpretuje ako footer keyword a rozbije parsing.

✅ OK:

```
feat(api): add bulk import

- Pridáva endpoint POST /v1/assets/bulk
- Validácia max 100 items per request
- Rollback pri partial failure
```

❌ NIE:

```
- Fix: validation error message
```

## REUSE compliance

Každý nový súbor musí mať buď:

1. **SPDX header** priamo v súbore (pre `.ts`, `.tsx`, `.dart`, `.md`):
   ```ts
   // SPDX-FileCopyrightText: 2026 Tvoje Meno
   // SPDX-License-Identifier: EUPL-1.2
   ```
2. Alebo byť **mapovaný cez `REUSE.toml`** (pre súbory bez komentárov ako JSON, YAML).

CI overuje `reuse lint` pri každom PR. Lokálna validácia:

```bash
# Inštalácia (raz)
pip install reuse

# Validácia
reuse lint
```

## Pred commitom

```bash
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # unit + integration testy
pnpm format:check   # prettier
reuse lint          # licenčná čistota
```

Husky + lint-staged toto presadia automaticky pri `git commit`.

## Code Review — očakávania

- Reviewer odpovie do 1 pracovného dňa (ak je urgentné, doplň `[urgent]` v title).
- Komentáre delíme:
  - `nit:` — kozmetické, nemusí byť vyriešené.
  - `suggestion:` — návrh, autor zváži.
  - `must:` — blokujúci, treba opraviť.
  - `question:` — pýtam sa, nie nevyhnutne treba zmeniť.

## Dokumentácia

- Každá nová funkcionalita → aktualizovaná `docs/functional-spec.md` (ak relevantné).
- Každé významné architektonické rozhodnutie → nové ADR v `docs/decisions/`.
- Verejné API zmeny → aktualizovaný OpenAPI spec + `CHANGELOG.md`.
- Každý merge do `main` → zápis do `[Unreleased]` sekcie v `CHANGELOG.md`.

## Testovanie

Cieľová coverage:

- **Backend (Fastify):** 70 %+ na business logiku (services, repositories).
- **Frontend (React):** 60 %+, dôraz na E2E (Playwright) pre kritické flows.
- **MCP server:** 80 %+ — malý povrch, mali by sme to vedieť dobre otestovať.

Aktuálny stav: **257 integration testov** (slice #3, máj 2026).

## Bezpečnosť

- **Nikdy** necommitovať `.env`, kľúče, certifikáty, heslá.
- Ak si nájdeš secret v commit histórii, **okamžite** to nahlás cez `inventario@ltk.solutions` a rotuj credentials.
- Závislosti pravidelne aktualizujeme cez Dependabot / Renovate.
- Bezpečnostné zraniteľnosti hláste cez [SECURITY.md](SECURITY.md), nie cez verejné Issues.

## Multi-tenant safety

Inventario je multi-tenant platforma (viď [ADR-0010](docs/decisions/0010-multi-tenant-white-label.md)). Pri písaní kódu pre business logiku:

- **Vždy filtruj queries** podľa `organisationId` z `ctx.user.organisationId`.
- **Nikdy nevracaj dáta** z inej organizácie ako tej, do ktorej patrí aktuálny user.
- **Audit log zapisuje `organisationId`** — nezabudni to pri novej operácii.
- **Integration testy musia overiť cross-tenant isolation** — minimálne jeden test per modul.

## Otázky?

- 💬 Otvor diskusiu v [GitHub Discussions](../../discussions)
- 📧 Maintaineri: `inventario@ltk.solutions`
- 🛡️ Bezpečnosť: [SECURITY.md](SECURITY.md)

---

Vďaka za príspevok do Inventario! 🛠️ Powered by [SportUp ecosystem](https://sportup.sk).
