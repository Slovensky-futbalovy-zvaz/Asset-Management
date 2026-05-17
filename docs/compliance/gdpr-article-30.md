<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# GDPR Article 30 — Records of processing activities

> **Phase D Blok 4 deliverable.** Štruktúrované záznamy o spracovateľských operáciách v Inventario podľa GDPR článku 30. Tento dokument je **interný/operatívny** — nie verejná Privacy Policy, ale technický inventár ktorý audit-or očakáva pri kontrole.

| Pole               | Hodnota                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **Verzia**         | 1.0                                                                                                       |
| **Dátum**          | 17. máj 2026                                                                                              |
| **Prevádzkovateľ** | LTK Solutions s. r. o., zastúpená Ján Letko (`inventario@sportup.sk`)                                     |
| **Spracovateľ**    | Inventario (hostovaná inštancia) → LTK Solutions; Inventario (self-hosted fork) → tenant samostatne       |
| **DPO**            | Nie je povinný (čl. 37 GDPR — žiadne large-scale special category data), kontakt: `inventario@sportup.sk` |
| **Záznam vedenie** | Tento dokument + audit log (Mongo `audit_logs`) + Git history (audit trail tohto súboru)                  |

---

## TL;DR

Inventario spracúva osobné údaje v štyroch hlavných kategóriách (autentifikácia, evidencia majetku, výpožičky, audit log). **Žiadne special category data** podľa čl. 9 GDPR. Hosting v EÚ (Vercel fra1/cdg1 + MongoDB Atlas eu-west-1/eu-central-1). Pri self-host fork zostáva prevádzkovateľská zodpovednosť na tenant-ovi.

Audit log zachytáva každú zmenu týkajúcu sa osobných údajov (čl. 5 ods. 2 — accountability). Retention 24 mesiacov pre štandardné záznamy, 60 mesiacov pre security a access-control udalosti.

---

## 1. Spracovateľské operácie (Article 30 inventory)

Každá operácia zachytená v tabuľke nižšie predstavuje samostatný "record of processing activity" v zmysle čl. 30 ods. 1 GDPR.

### 1.1. Autentifikácia a správa používateľov

| Pole                           | Hodnota                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Účel spracovania**           | Overenie totožnosti používateľa pri prihlásení, JIT-provisioning nového účtu v rámci tenantu, vedenie základných údajov o používateľovi (rola, organizačná jednotka)                                                                 |
| **Právny základ**              | Čl. 6 ods. 1 písm. b) GDPR — plnenie zmluvy (prevádzka platformy); pre verejný sektor aj čl. 6 ods. 1 písm. e) — verejný záujem                                                                                                      |
| **Kategórie osobných údajov**  | Identifikačné: meno, priezvisko, displayName, Entra ID OID, organisationId. Kontaktné: e-mailová adresa. Účtové: roly, isActive, lastLoginAt, accountType, preferences                                                               |
| **Kategórie subjektov údajov** | Zamestnanci tenantov (zväzy, mestá, kluby, školy). Externí spolupracovníci s prístupom k tenant účtu                                                                                                                                 |
| **Príjemcovia**                | Tenant administrátor (read prístup k vlastným používateľom); LTK Solutions (technický prevádzkovateľ pri hosted variante)                                                                                                            |
| **Cezhraničné prenosy**        | Žiadne — všetky dáta v EÚ (Vercel fra1/cdg1, Atlas eu-region). Microsoft Entra ID je sub-processor v EÚ region (configurable per tenant)                                                                                             |
| **Retention**                  | Aktívne účty: počas trvania zmluvy. Deaktivované: 24 mesiacov od `deletedAt`, potom pseudonymizácia. Audit záznamy o prihlasovaní: 60 mesiacov                                                                                       |
| **Technické opatrenia**        | TLS 1.3 in transit; encryption at rest (Atlas default); JWT podpisované Entra ID kľúčmi (RS256, JWKS rotation); password-less authentication (žiadne uložené heslá v Inventario DB)                                                  |
| **Organizačné opatrenia**      | RBAC s 5 rolami; principle of least privilege; audit log každej zmeny role + isActive                                                                                                                                                |
| **Mongo collection**           | `users`                                                                                                                                                                                                                              |
| **Audit log actions**          | `USER_LOGIN`, `USER_LOGIN_FAILED`, `USER_LOGOUT`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_REACTIVATED`, `USER_ROLE_GRANTED`, `USER_ROLE_REVOKED`, `USER_PASSWORD_CHANGED`, `USER_MFA_ENABLED`, `USER_MFA_DISABLED` |

### 1.2. Evidencia a správa majetku

| Pole                           | Hodnota                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Účel spracovania**           | Vedenie inventáru fyzických aktív organizácie; sledovanie ich umiestnenia, stavu a histórie. Osobné údaje sa vyskytujú nepriamo cez `createdBy`/`updatedBy`/`deletedBy` polia |
| **Právny základ**              | Čl. 6 ods. 1 písm. b) — plnenie zmluvy s tenantom; čl. 6 ods. 1 písm. f) — oprávnený záujem (vedenie majetkovej evidencie, prevencia strát)                                   |
| **Kategórie osobných údajov**  | Identifikátor zamestnanca, ktorý záznam vytvoril/upravil/zmazal (`userId`); displayName-snapshot v audit logu                                                                 |
| **Kategórie subjektov údajov** | Zamestnanci s rolou ASSET_MANAGER alebo ADMIN, ktorí spravujú inventár                                                                                                        |
| **Príjemcovia**                | Tenant administrátor, asset manager, employee (read-only); LTK Solutions (technický prevádzkovateľ)                                                                           |
| **Cezhraničné prenosy**        | Žiadne                                                                                                                                                                        |
| **Retention**                  | Aktívne assety: počas životnosti majetku. Soft-deleted: 60 mesiacov (potreba pre účtovné a daňové audity dlhšia než štandardný GDPR cyklus)                                   |
| **Technické opatrenia**        | Tenant-scoped queries (organisationId filter); soft delete s `deletedAt`/`deletedBy`; transactional writes; immutability `inventoryNumber`                                    |
| **Organizačné opatrenia**      | RBAC: GET = všetci v tenant-e, POST/PATCH = ASSET_MANAGER+ADMIN, DELETE = ADMIN only                                                                                          |
| **Mongo collection**           | `assets`, `categories`, `locations`                                                                                                                                           |
| **Audit log actions**          | `ASSET_CREATED`, `ASSET_UPDATED`, `ASSET_DELETED`, `ASSET_STATUS_CHANGED`, `ASSET_LOCATION_CHANGED`, `ASSET_DISPOSED`, `CATEGORY_*`, `LOCATION_*`                             |

### 1.3. Vypožičiavanie majetku (loans)

> Slice plán — sub-modul `loans` zatiaľ neexistuje (slice #5+). Záznam pridaný preemptívne pre úplnosť GDPR inventára.

| Pole                           | Hodnota                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Účel spracovania**           | Záznam o tom, kto má aktuálne vypožičaný konkrétny majetok; schvaľovací workflow; protokoly o prevzatí a vrátení                                                                                                 |
| **Právny základ**              | Čl. 6 ods. 1 písm. b) — plnenie zmluvy o výpožičke; čl. 6 ods. 1 písm. f) — oprávnený záujem (ochrana majetku)                                                                                                   |
| **Kategórie osobných údajov**  | Identifikátor vypožičiavateľa (`borrowerId`), schvaľovateľa (`approverId`), kuriéra (`handoverBy`/`returnBy`). Snapshot mena na protokole; podpis (čl. 9 sa neaplikuje — nejde o biometriku, len o sken obrázka) |
| **Kategórie subjektov údajov** | Zamestnanci, manažéri klubov, rodičia (proxy pre maloletých — vyžaduje rodičovský súhlas v UI), externí spolupracovníci                                                                                          |
| **Príjemcovia**                | Tenant administrátor, schvaľovateľ; LTK Solutions (technický prevádzkovateľ)                                                                                                                                     |
| **Cezhraničné prenosy**        | Žiadne                                                                                                                                                                                                           |
| **Retention**                  | Aktívne pôžičky: počas trvania. Ukončené: 60 mesiacov (účtovné a kontrolné účely)                                                                                                                                |
| **Technické opatrenia**        | Tenant-scoped queries; transakčné writes pri loan state transitions; PDF protokoly podpísané server-side timestamp-om                                                                                            |
| **Organizačné opatrenia**      | Schvaľovací workflow; principle of separation of duties (vypožičiavateľ ≠ schvaľovateľ)                                                                                                                          |
| **Mongo collection**           | `loans`, `loan_requests`, `loan_protocols` (planned)                                                                                                                                                             |
| **Audit log actions**          | `LOAN_REQUEST_CREATED`, `LOAN_REQUEST_APPROVED`, `LOAN_REQUEST_REJECTED`, `LOAN_REQUEST_CANCELLED`, `LOAN_PICKED_UP`, `LOAN_RETURNED`, `LOAN_EXTENDED`, `LOAN_MARKED_OVERDUE`, `LOAN_MARKED_LOST`                |

### 1.4. Audit log (cross-cutting)

| Pole                           | Hodnota                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Účel spracovania**           | Vedenie immutable append-only záznamu o významných akciách v systéme. Forenzika, GDPR čl. 5 ods. 2 accountability, security incident response                                                                                                                                               |
| **Právny základ**              | Čl. 6 ods. 1 písm. c) — splnenie zákonnej povinnosti (čl. 5 ods. 2 GDPR sám osebe je právny dôvod); čl. 6 ods. 1 písm. f) — oprávnený záujem (bezpečnosť)                                                                                                                                   |
| **Kategórie osobných údajov**  | `actor.userId`, `actor.displayName` (snapshot v čase akcie), `actor.accountType`, `actor.ipAddress`, `actor.userAgent`; `target.entityId` referencujúci dotknutý záznam; voliteľný `changes` diff (pred/po)                                                                                 |
| **Kategórie subjektov údajov** | Všetci používatelia systému ako aktéri; subjekty údajov v target entities                                                                                                                                                                                                                   |
| **Príjemcovia**                | Tenant administrátor (read prístup k tenant audit logu — planned v slice #5); LTK Solutions security operations                                                                                                                                                                             |
| **Cezhraničné prenosy**        | Žiadne                                                                                                                                                                                                                                                                                      |
| **Retention**                  | **24 mesiacov** pre štandardné akcie (CRUD); **60 mesiacov** pre auth + role-change + security udalosti. Po retention pseudonymizácia (nahradenie `actor.userId` s `'PSEUDONYMIZED'`, vymazanie `actor.displayName` a `actor.ipAddress`, zachovanie typu akcie a timestampu pre štatistiky) |
| **Technické opatrenia**        | Append-only collection (žiadny UPDATE/DELETE z aplikácie); index na `(target.entityType, target.entityId)`, `actor.userId`, `at`, `action`, `severity`                                                                                                                                      |
| **Organizačné opatrenia**      | Read access len pre ADMIN role (planned); retention job spúšťaný cron-om (planned)                                                                                                                                                                                                          |
| **Mongo collection**           | `audit_logs`                                                                                                                                                                                                                                                                                |
| **Schema**                     | `packages/shared-types/src/schemas/audit-log.ts` — Zod schéma + 50+ enum hodnôt pre `action`                                                                                                                                                                                                |

#### GDPR-relevantné polia v audit log zázname

Každý novo zapísaný audit záznam (od Phase D) obsahuje dve dodatočné polia, ktoré priamo mapujú čl. 30 GDPR:

| Field             | Typ                                        | Účel                                                                                                                                                                             |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legalBasis`      | enum (`contract`, `legal_obligation`, ...) | Právny základ spracovania podľa čl. 6 ods. 1 GDPR. Mapping na akciu rieši helper `defaultLegalBasisFor()` v `audit.service.ts`. Override možný cez `RecordEventInput.legalBasis` |
| `dataCategories`  | array kategórií                            | Ktoré kategórie osobných údajov sa akcia dotýka (čl. 30 ods. 1 písm. c). Defaultne odvodené cez `defaultDataCategoriesFor()`. Prázdne pole = akcia nespracuje os. údaje          |
| `pseudonymizedAt` | timestamp \| null                          | Kedy retention job pseudonymizoval záznam. `null` pre aktuálne ne-pseudonymizované záznamy                                                                                       |

Staršie záznamy z pred-Phase-D obdobia tieto polia nemajú (Zod schema ich má ako `optional` — správne sa čítajú bez fail), no nové záznamy ich vždy zapíšu. V budúcnosti môžeme spustiť jednorazový backfill skript, ktorý doplne `legalBasis` + `dataCategories` aj na historické záznamy.

### 1.5. Tenant lifecycle (Organisations)

| Pole                           | Hodnota                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Účel spracovania**           | Vedenie tenant identity (názov organizácie, slug, Entra tenant ID, brand kit, plán, status). JIT provisioning pri prvom kontakte z nového Entra tenant-u |
| **Právny základ**              | Čl. 6 ods. 1 písm. b) — plnenie zmluvy s tenant-om                                                                                                       |
| **Kategórie osobných údajov**  | `primaryContactEmail` (e-mail tenant administrátora). Nepriamo cez `createdBy`/`updatedBy` audit poliach                                                 |
| **Kategórie subjektov údajov** | Štatutári a IT administrátori tenant-ovských organizácií                                                                                                 |
| **Príjemcovia**                | Platform ADMIN (LTK Solutions); tenant samotný                                                                                                           |
| **Cezhraničné prenosy**        | Žiadne                                                                                                                                                   |
| **Retention**                  | Aktívne tenanty: počas trvania zmluvy. Po ukončení zmluvy: 60 mesiacov (účtovné), potom anonymizácia s zachovaním štatistík                              |
| **Technické opatrenia**        | Soft delete cez `deletedAt`/`deletedBy`; status enum (ACTIVE, SUSPENDED, ARCHIVED); auth middleware reject pre suspended/archived tenants                |
| **Mongo collection**           | `organisations`                                                                                                                                          |
| **Audit log actions**          | `ORGANISATION_CREATED`, `ORGANISATION_UPDATED`, `ORGANISATION_DELETED`                                                                                   |

---

## 2. Sub-processors (Article 28)

Hosted Inventario inštancia využíva nasledovných sub-processorov. Pri self-host fork tieto závislosti samotný tenant zvládne podľa vlastnej infraštruktúry.

| Sub-processor            | Účel                                        | Lokalita dát                 | Zmluva                                      |
| ------------------------ | ------------------------------------------- | ---------------------------- | ------------------------------------------- |
| **Microsoft (Entra ID)** | Identity provider (SSO)                     | EÚ tenant configurable       | Microsoft DPA / SCC                         |
| **Vercel Inc.**          | Hosting Fastify API + static marketing/docs | EÚ (cdg1, fra1 regions)      | Vercel DPA + EU SCC                         |
| **MongoDB Inc. (Atlas)** | Database hosting                            | EÚ (eu-west-1, eu-central-1) | MongoDB Atlas DPA + EU SCC                  |
| **Google (Fonts)**       | Webfonty (Poppins, JetBrains Mono)          | CDN — global, žiadne PII     | Verejne dostupné fonty, žiadne PII transfer |
| **GitHub Inc.**          | Hosting zdrojového kódu (verejne)           | US                           | GitHub Terms, žiadne customer PII v repe    |

> **Poznámka**: Google Fonts a GitHub spadajú pod **strict-necessary** infrastructure. Pri Google Fonts iba browser-to-CDN HTTP request, žiadny server-side prenos PII. Sa preto neuplatňuje sub-processor DPA. Pri samostatnom self-host nasadení sa **odporúča** Poppins fonty self-host (`/assets/fonts/`) — eliminuje aj tento minimal-risk prenos.

---

## 3. Práva subjektov údajov (chapter III)

Implementačný stav podľa práv:

| Právo (čl.)                         | Stav         | Spôsob plnenia                                                                                                                       |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Art. 15 Right of access**         | ⏳ Plánované | API endpoint `GET /v1/me/export` — vráti JSON s úplným profilom + audit log výpis subjektu. Plánovaný v slice #5                     |
| **Art. 16 Right to rectification**  | ✅ Hotové    | Tenant admin cez `PATCH /v1/users/:id`; self-service `PATCH /v1/me` planned v slice #5                                               |
| **Art. 17 Right to erasure**        | ⏳ Plánované | Soft delete cez `DELETE /v1/users/:id` (existuje); skutočná erasure cez asynchronous job po 30 dni od soft delete (planned slice #5) |
| **Art. 18 Right to restrict**       | ⏳ Plánované | Cez nový `isRestricted` flag na User; UI v slice #5                                                                                  |
| **Art. 19 Notification obligation** | n/a          | Žiadny tretí príjemca PII (sub-processors sú processors, nie recipients v zmysle čl. 19)                                             |
| **Art. 20 Data portability**        | ⏳ Plánované | Súčasť `GET /v1/me/export` z čl. 15                                                                                                  |
| **Art. 21 Right to object**         | n/a          | Spracovanie nie je založené na čl. 6 ods. 1 písm. f) ani priame marketing                                                            |
| **Art. 22 Automated decisions**     | n/a          | Žiadne automated decision making s legal/significant effect                                                                          |

Operatívne procesy pre žiadosti subjektov údajov:

1. Žiadosť príde na `inventario@sportup.sk` (alebo cez UI keď bude implementované).
2. Identita žiadateľa overená cez Entra ID — t.j. žiadateľ sa musí prihlásiť, aby preukázal že je vlastníkom účtu.
3. Spracovanie do 30 dní (čl. 12 ods. 3).
4. Audit log akcia `DATA_EXPORT_REQUESTED` alebo `DATA_DELETION_REQUESTED`.
5. Tenant administrátor je notifikovaný pre väčšie zásahy (napríklad celý tenant data export).

---

## 4. Bezpečnostné opatrenia (Article 32)

### Technické

- **Šifrovanie at-rest**: Atlas default (AES-256). Vercel runtime ephemeral storage tiež šifrovaný
- **Šifrovanie in-transit**: TLS 1.3 minimum, HSTS preload pre `inventario.sportup.sk`
- **Authentication**: Microsoft Entra ID OAuth 2.0 / OIDC; JWT RS256 podpisy; žiadne uložené heslá
- **Authorization**: Tenant-scoped RBAC s 5 rolami (EMPLOYEE, TEAM_MANAGER, ASSET_MANAGER, ADMIN, EXTERNAL); FK protection cez transactions
- **Network**: Atlas allowlist (Vercel IPs in prod, 0.0.0.0/0 only na dev cluster pre CI); Vercel firewall default-deny
- **Tenant isolation**: `organisationId` field na všetkých tenant-scoped collections, validated v každom service call cez `requireTenantId + tenantFilter` utility (apps/api/src/lib/organisation-scoping.ts). 17 cross-tenant isolation testov v test suite
- **Input validation**: Zod schémy v `@inventario/shared-types` ako single source of truth; Fastify type provider odmieta neplatný request payload pred handlerom
- **Output validation**: Response schémy filtrujú citlivé fields (passwordHash sa odstraňuje vrstve repository, nie na UI)
- **Audit log**: append-only, immutable z aplikácie; tenant-scoped read access (planned slice #5)

### Organizačné

- **Conventional Commits** + PR review proces pre každú zmenu
- **CodeQL** týždenný security scan (`security-extended` query pack)
- **SBOM** generovaný v CI pre každý push (CycloneDX 1.6, 90-day retention) — Phase D
- **REUSE 3.3** compliance check v lint stage
- **Open source verejnosť**: kód auditovateľný komunitou (no security through obscurity)
- **Incident response**: žiadny formálny tím v aktuálnej fáze (pre-production), incident → e-mail `inventario@sportup.sk` + GitHub issue (s príslušnou closed-source diskréciou pre security)
- **DPIA**: nie je vyžadované pred prvým hosted-production tenant-om (čl. 35 — naše spracovanie nie je high-risk podľa pre-listu článku 35 ods. 4 ani podľa Working Party 29 guidelines). Pre municipálne tenanty pripravíme DPIA template do `docs/compliance/dpia-template.md` (budúci deliverable)

---

## 5. Postupy pre incidenty (Article 33–34)

V prípade osobnostného úniku dát (data breach):

1. **Detekcia** — cez Atlas Anomaly Detection alebo manuálny audit log review. Severity `ERROR` alebo `CRITICAL` v audit_logs aktivuje alert
2. **Containment** — okamžitý revoke ohrozených JWT, rotácia Entra ID app secrets ak dotknuté, isolation dotknutého tenant-u (`status: SUSPENDED`)
3. **Notifikácia ÚOOÚ** (Úrad na ochranu osobných údajov SR) do 72 hodín od zistenia (čl. 33 ods. 1)
4. **Notifikácia subjektov údajov** ak hrozí "high risk to the rights and freedoms" (čl. 34 ods. 1) — cez tenant-administrátora, ktorý ďalej notifikuje svojich používateľov
5. **Post-mortem** verejný (pre open-source komunitu) cez GitHub Security Advisory + CVE registration (ak relevantné)

Aktuálny stav: pre-production, ešte žiadny produkčný tenant ani incident response cvičenie. Plánujeme **tabletop exercise** pred prvým municipálnym launchom.

---

## 6. Retention schedule (sumár)

| Kolekcia / kategória          | Retention         | Akcia po expirácii                                                                  |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| Aktívne `users`               | Trvanie zmluvy    | —                                                                                   |
| Soft-deleted `users`          | 24 mesiacov       | Pseudonymizácia (`PSEUDONYMIZED` placeholder), `USER_PSEUDONYMIZED` audit log entry |
| Aktívne `organisations`       | Trvanie zmluvy    | —                                                                                   |
| Soft-deleted `organisations`  | 60 mesiacov       | Anonymizácia s zachovaním štatistík                                                 |
| Aktívne `assets`              | Životnosť majetku | —                                                                                   |
| Soft-deleted `assets`         | 60 mesiacov       | Hard delete                                                                         |
| Aktívne `loans` (planned)     | Trvanie pôžičky   | —                                                                                   |
| Ukončené `loans` (planned)    | 60 mesiacov       | Hard delete                                                                         |
| Audit log — bežné akcie       | 24 mesiacov       | Pseudonymizácia osobných polí v audit entry                                         |
| Audit log — auth / role / sec | 60 mesiacov       | Pseudonymizácia osobných polí                                                       |
| Audit log — `ORGANISATION_*`  | 84 mesiacov       | Pseudonymizácia (tenant lifecycle udalosti potrebné pre účtovný audit dlhšie)       |

> **Implementačná poznámka**: retention job nie je v aktuálnej fáze automatizovaný — beží manuálne pred prvým produkčným launchom a potom mesačne ako Vercel cron (`vercel.json` schedule). Plánované v slice #5.

---

## 7. Zmenová história

| Verzia | Dátum        | Zmena                                                                                       |
| ------ | ------------ | ------------------------------------------------------------------------------------------- |
| 1.0    | 17. máj 2026 | Prvá verzia. Phase D Blok 4 — Article 30 inventár, sub-processors, rights, security, breach |

---

## 8. Referencie

- [Nariadenie (EÚ) 2016/679 (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj) — najmä čl. 5, 6, 7, 9, 12–22, 30, 32, 33, 34, 35, 37
- [Zákon 18/2018 Z. z. o ochrane osobných údajov](https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2018/18/) — slovenská implementácia GDPR
- [ÚOOÚ — Záznamy o spracovateľských činnostiach (čl. 30)](https://dataprotection.gov.sk/) — slovenský dozorný orgán
- [Microsoft Entra ID GDPR Compliance](https://learn.microsoft.com/en-us/compliance/regulatory/gdpr)
- [MongoDB Atlas Data Protection Addendum](https://www.mongodb.com/legal/dpa)
- [Vercel Data Processing Addendum](https://vercel.com/legal/dpa)

---

**Tento dokument je živý** — po každom väčšom feature changu (nový modul, nové sub-processor, zmena retention) sa aktualizuje a inkrementuje verzia. Git history slúži ako audit trail jeho samotného.
