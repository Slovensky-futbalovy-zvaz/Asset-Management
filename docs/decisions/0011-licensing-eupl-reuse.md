<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# 0011. Open-source licensing — EUPL-1.2 + CC-BY-4.0 + REUSE 3.3

|                   |                                                                   |
| ----------------- | ----------------------------------------------------------------- |
| **Status**        | ✅ Accepted                                                       |
| **Dátum**         | 2026-05-15                                                        |
| **Autori**        | Ján Letko, Claude (LTK Solutions)                                 |
| **Súvisiace ADR** | [0010 Multi-tenant white-label](0010-multi-tenant-white-label.md) |

## Kontext

Projekt Inventario (pôvodne SFZ Asset Management) sa pivotuje z interného nástroja na **otvorenú multi-tenant platformu** určenú pre športové zväzy, mestá a obce, VÚC, kluby, školy a neziskové organizácie. Ide o subjekty prevažne **vo verejnom sektore Slovenskej republiky a Európskej únie**, mnohé z nich financované z verejných alebo európskych zdrojov.

Súčasne plánujeme:

1. **Publikovať repo verejne** na GitHube (z aktuálne private na public).
2. **Uchádzať sa o EU rozvojové fondy** (OPII, OP Slovensko, Digital Europe Programme, prípadne Horizon Europe) — to vyžaduje splnenie podmienok pre _Open Source Software (OSS) odporúčaných verejnému sektoru_.
3. **Umožniť veľkým organizáciám fork + self-host** ako súčasť multi-tenant stratégie (viď [ADR-0010](0010-multi-tenant-white-label.md)).
4. **Integrácia s SportUp ekosystémom** — `sportup.sk` repo už používa EUPL-1.2 + CC-BY-4.0 + REUSE 3.3 (viď [github.com/ltksolutions/sportup.sk](https://github.com/ltksolutions/sportup.sk)). Konzistencia licencií naprieč ekosystémom uľahčuje budúce code-sharing.

Aktuálny stav repa používa licenciu **MIT** (deklarovanú v `LICENSE` a v badge v README). MIT je permissive licencia, ale nie je optimálna pre verejný sektor EÚ z týchto dôvodov:

- MIT nemá oficiálny preklad do slovenčiny (ani iných EU jazykov) — pri spore by sa interpretovala anglická verzia.
- MIT neobsahuje explicitné riešenie patent rights, právomocí súdov v EÚ a interakcie s GDPR.
- MIT nie je _odporúčaná_ licencia Európskej komisie pre verejný sektor — tou je EUPL.
- Mnohé EU výzvy a programy explicitne preferujú alebo vyžadujú EUPL pre svoje výstupy.

### Obmedzenia

- **Žiadny breaking change pre existujúcich kontributorov** — repo zatiaľ nemá externých prispievateľov, takže prechod z MIT na EUPL-1.2 je jednoduchý (žiadne CLA, žiadne odsúhlasovanie).
- **REUSE 3.3 compliance je strojovo overiteľná** — každý súbor musí mať SPDX-FileCopyrightText a SPDX-License-Identifier header (alebo byť mapovaný cez `REUSE.toml`).
- **Časový tlak**: chceme byť pripravení pre prvú EU výzvu jeseň 2026.

## Možnosti

### Možnosť A: Zostať pri MIT

Status quo. Žiadna zmena licencie.

- **Plus**: jednoduchosť; MIT je široko známa a akceptovaná.
- **Mínus**: nie je odporúčaná Európskou komisiou pre verejný sektor; chýba SK preklad; nie je optimálna pre EU fondy.

### Možnosť B: Apache 2.0

Permissive licencia s explicitnými patent rights.

- **Plus**: industry standard; patent grant je explicitný; široko používaná v open-source ekosystéme.
- **Mínus**: rovnako ako MIT, nie je odporúčaná EK; chýba SK preklad; nie je _EU-native_.

### Možnosť C: EUPL-1.2 (European Union Public Licence)

Licencia vytvorená Európskou komisiou v 23 jazykoch (vrátane slovenčiny), všetky verzie sú právne ekvivalentné.

- **Plus**: oficiálne odporúčaná EK pre verejný sektor; má SK preklad; kompatibilná s GPL/AGPL/MPL; výslovne pokrýva právomoci súdov v EÚ a interakcie s GDPR; používa ju aj sportup.sk.
- **Mínus**: menej známa mimo EÚ; copyleft pri redistribúcii zdrojového kódu (môže byť pre niektorých prispievateľov prekážka), ale pre web hosting (SaaS) nevzniká povinnosť zverejniť zmeny.

### Možnosť D: Dual licensing — EUPL-1.2 (kód) + CC-BY-4.0 (dokumentácia)

Pre kód EUPL, pre dokumentáciu CC-BY-4.0 (vrátane brand assets, design materials, written guides).

- **Plus**: kombinuje výhody EUPL pre kód s vhodnejšou licenciou pre dokumentáciu; CC-BY-4.0 je _de facto_ štandard pre open content; presne to robí sportup.sk.
- **Mínus**: žiadne významné; potrebuje precízne REUSE mapovanie.

## Rozhodnutie

Zvolili sme **Možnosť D: Dual licensing s REUSE 3.3 compliance**.

Konkrétne:

| Obsah                                                               | Licencia                    | SPDX identifier |
| ------------------------------------------------------------------- | --------------------------- | --------------- |
| Zdrojový kód (`apps/`, `packages/`)                                 | **EUPL-1.2**                | `EUPL-1.2`      |
| Dokumentácia (`docs/`, `README.md`, `CHANGELOG.md`)                 | **CC-BY-4.0**               | `CC-BY-4.0`     |
| Brand assets (logo, ikony, og-image)                                | **CC-BY-4.0**               | `CC-BY-4.0`     |
| Konfiguračné súbory (`.gitignore`, `package.json`, `tsconfig.json`) | **CC0-1.0** (public domain) | `CC0-1.0`       |
| Tretie strany (vendor knižnice, externé fonty)                      | Pôvodná licencia            | Per-file SPDX   |

### Implementácia

1. **`LICENSE`** — plný text EUPL-1.2 v anglickej verzii (kanonická).
2. **`LICENSE-DOCS`** — plný text CC-BY-4.0.
3. **`LICENSES/`** adresár (REUSE konvencia):
   - `LICENSES/EUPL-1.2.txt`
   - `LICENSES/CC-BY-4.0.txt`
   - `LICENSES/CC0-1.0.txt`
4. **`REUSE.toml`** — centrálne licenčné mapovanie pre súbory bez explicitných SPDX headers.
5. **SPDX headers** v zdrojových súboroch (TypeScript, Dart, Markdown):
   ```ts
   // SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
   // SPDX-License-Identifier: EUPL-1.2
   ```
6. **CI overovanie**: GitHub Actions job ktorý spúšťa `reuse lint` pri každom PR.
7. **REUSE badge** v README.md a v `.github/README` linkujúci na api.reuse.software status.

### Copyright holders

- Primárny: **Ján Letko / LTK Solutions**
- Sekundárny: **Slovenský futbalový zväz** (founding contributor, financoval pôvodný vývoj)
- Budúce: každý kontributor pridáva svoj copyright header pre svoje commity (DCO sign-off).

### Developer Certificate of Origin (DCO)

Namiesto Contributor License Agreement (CLA) zavedieme **DCO sign-off** — kontributor pridá `Signed-off-by: Name <email>` do commit message. GitHub Action `dco-check` overí prítomnosť signature.

Dôvody pre DCO namiesto CLA:

- Žiadne právne dokumenty na podpis; len `git commit -s`.
- Štandard v Linux kernel, Docker, Kubernetes, GitLab — známy ekosystém.
- Žiadny central authority drží práva — kompatibilné s pluralitnou open-source správou.

## Dôsledky

### Pozitívne

- **Eligible pre EU fondy**: OPII, OP Slovensko, Digital Europe Programme aktívne odporúčajú EUPL. Niektoré výzvy ju vyžadujú.
- **Právna istota v SR**: EUPL má oficiálny SK preklad, právne ekvivalentný s anglickou verziou. Pri spore slovenský súd nepotrebuje robiť právny preklad.
- **Konzistencia s SportUp ekosystémom**: rovnaká licenčná stratégia ako sportup.sk uľahčuje budúce code-sharing.
- **Otvorené pre veľké tenanty**: EUPL umožňuje fork + self-host bez nutnosti zverejňovať zmeny (na rozdiel od AGPL pri hostovaní). Toto je kritické pre [ADR-0010](0010-multi-tenant-white-label.md).
- **Auditovateľnosť**: REUSE 3.3 garantuje, že každý súbor má jednoznačné licenčné a copyright metadata. Užitočné pri due diligence, code audits, právnej kontrole pre samosprávy.
- **Verejná reputácia**: byť na [api.reuse.software](https://api.reuse.software/) je signál seriózneho open-source projektu.

### Negatívne / kompromisy

- **Migrácia z MIT na EUPL** je formálne **nové licencovanie**. Keďže projekt nemá externých kontributorov (Ján Letko + SFZ ako copyright holders), zmena je administratívne triviálna — žiadne CLA, žiadne ratifikácie.
- **Učenie sa EUPL špecifík**: copyleft je triggerovaný iba pri _redistribúcii zdrojového kódu_, nie pri hostovaní (SaaS). Toto musíme jasne komunikovať v dokumentácii pre potenciálnych forkerov.
- **REUSE prísnosť**: každý nový súbor musí mať SPDX header alebo byť v REUSE.toml. Pre developerov je to malý overhead, ale CI to vynucuje.

### Riziká, ktoré treba sledovať

- **Tretie strany s nekompatibilnou licenciou**: ak v budúcnosti pridáme dependency s licenciou nekompatibilnou s EUPL (napríklad proprietary fonty alebo GPL-only knižnicu pre desktop app), musíme to vyriešiť — buď nájsť alternativu, alebo izolovať dependency.
- **Kontributor odmietne EUPL**: zatiaľ teoretické riziko. Ak by sa stalo, vysvetlíme dôvody a ponúkneme možnosť contribute pod EUPL alebo nepriaty pull request.
- **Brand assets mimo SportUp ekosystému**: ak tenant používa vlastné logá (mesto, klub), tie nie sú súčasťou projektu — sú vlastníctvom organizácie. README to musí jasne uvádzať.

## EU compliance roadmap

Okrem EUPL + REUSE plánujeme nasledujúce kroky pre plnú EU verejný-sektor pripravenosť:

| Požiadavka                                      | Status                   | Slice/Termín            |
| ----------------------------------------------- | ------------------------ | ----------------------- |
| EUPL-1.2 + CC-BY-4.0 dual licensing             | ✅ tento ADR             | Slice #3.5              |
| REUSE 3.3 compliance + CI lint                  | ✅ tento ADR             | Slice #3.5              |
| Verejný GitHub repo                             | 📅 plánované             | Po slice #3.5           |
| `CITATION.cff`                                  | 📅 plánované             | Slice #3.5              |
| `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) | 📅 plánované             | Slice #3.5              |
| `CONTRIBUTING.md` s DCO workflow                | 📅 plánované             | Slice #3.5              |
| `SECURITY.md` s CVD policy                      | 📅 plánované             | Slice #3.5              |
| `CHANGELOG.md` (Keep a Changelog)               | 📅 plánované             | Slice #3.5              |
| WCAG 2.1 AA accessibility (zákon 95/2019)       | 📅 plánované             | Slice #4 (web frontend) |
| GDPR Article 30 records of processing           | 🟡 čiastočné (audit log) | Slice #5                |
| SBOM (CycloneDX) v CI                           | 📅 plánované             | Slice #4                |
| OpenAPI 3.1 publikovaný export                  | 🟡 vygenerujeme z Zod    | Slice #4                |
| Vercel EU región hosting (cdg1/fra1)            | 🟡 default               | Pri prvom deploy        |
| DPIA (Data Protection Impact Assessment)        | 📅 pred produkciou       | Slice #8                |
| Threat Model (STRIDE)                           | 📅 pred produkciou       | Slice #8                |

## Referencie

- [European Union Public Licence v1.2](https://eupl.eu/) — oficiálna stránka, plný text vo všetkých 23 EU jazykoch
- [EUPL compatibility matrix](https://joinup.ec.europa.eu/collection/eupl/matrix-eupl-compatible-open-source-licences) — kompatibilita s GPL, AGPL, MPL, atď.
- [REUSE Software 3.3 specification](https://reuse.software/spec/) — strojovo overiteľná licenčná čistota
- [SPDX License List](https://spdx.org/licenses/) — kanonické identifikátory licencií
- [Joinup — Open Source Observatory](https://joinup.ec.europa.eu/collection/open-source-observatory-osor) — EU OSS odporúčania
- [github.com/ltksolutions/sportup.sk](https://github.com/ltksolutions/sportup.sk) — referenčná implementácia EUPL + REUSE
- [Developer Certificate of Origin](https://developercertificate.org/) — DCO text
- [ADR-0010: Multi-tenant white-label](0010-multi-tenant-white-label.md) — fork + self-host stratégia
- [Session plán 2026-05-15](../sessions/2026-05-15-design-pivot.md)
