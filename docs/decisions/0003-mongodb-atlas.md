# 0003. MongoDB Atlas ako primárna databáza

| | |
|---|---|
| **Status** | Accepted |
| **Dátum** | máj 2026 |
| **Autori** | tím SFZ Asset Management |
| **Súvisiace ADR** | [0001-monorepo](0001-monorepo-pnpm-turbo.md), [0002-nestjs](0002-backend-nestjs.md) |

## Kontext

Potrebujeme zvoliť databázu pre systém asset managementu. Charakteristiky dátového modelu:

- **Zmiešaný majetok** – IT, šport, kancelária. Každá kategória má **odlišné atribúty** (notebook má RAM/disk, dres má veľkosť/číslo).
- **Spoločné jadro + custom fields** – flexibilná schéma pre kategórie.
- **Stredný rozsah** – očakávaných 5–20 tisíc položiek majetku, 30 tisíc zápožičiek ročne.
- **Read-heavy** – väčšina operácií je čítanie (vyhľadávanie, katalóg, dashboard).
- **Audit log a história** – append-only, môžu narásť do miliónov záznamov.
- **Plné full-text vyhľadávanie** v názvoch, popisoch, sériových číslach.

## Možnosti

### Možnosť A: MongoDB Atlas (zvolené)

Dokumentová NoSQL databáza ako managed cloud service.

- **Plus:** Flexibilná schéma – ideálne pre `customFields` per kategória (každý notebook môže mať iné polia ako dres bez zložitých EAV antipatternov).
- **Plus:** Atlas je managed – backupy, monitoring, auto-scaling, encryption at-rest "out of the box".
- **Plus:** Vstavané full-text search (Atlas Search nad Apache Lucene) – nemusíme nasadzovať osobitný ElasticSearch.
- **Plus:** Skvelá integrácia s NestJS (`@nestjs/mongoose`) a TypeScriptom.
- **Plus:** Geo-distribuované clustre, multi-region replication.
- **Plus:** Aggregation framework je výborný pre reporty.
- **Mínus:** Cena Atlas pre produkciu je vyššia ako self-hosted PostgreSQL. Pre náš scale (M10–M20 cluster) odhad ~$60–200/mesiac.
- **Mínus:** Žiadne striktné cudzie kľúče – integrita sa zaručuje na úrovni aplikácie.
- **Mínus:** Slabšie pre komplexné JOIN scenáre (ale my ich nemáme veľa).

### Možnosť B: PostgreSQL s JSONB

Relačná DB s JSONB stĺpcami pre flexibilitu.

- **Plus:** ACID, cudzie kľúče, výborné pre integrity-critical use cases.
- **Plus:** JSONB pre flexibilné custom fields.
- **Plus:** Open-source, výborný hosting (Azure Database for PostgreSQL, AWS RDS, self-hosted).
- **Plus:** Full-text search vstavaný (`tsvector`), prípadne `pgvector` pre AI features.
- **Plus:** Cenovo výhodnejší.
- **Mínus:** Pre dokumentovo orientované dáta (assets s custom fields) menej idiomatický.
- **Mínus:** Migrácie schémy sú formálnejšie – pre zmeny v custom fields by sme aj tak končili v JSONB.
- **Mínus:** Pre nás zložitejší schema design (kedy normalizovať, kedy JSONB).

### Možnosť C: PostgreSQL striktne relačne (EAV pre custom fields)

Plne relačná schéma s Entity-Attribute-Value tabuľkami pre flexibilitu.

- **Plus:** Krásna integrita.
- **Mínus:** EAV je antipattern, zložité query, pomalé pre filtrovanie.
- **Diskvalifikované** pre zložitosť custom fields.

### Možnosť D: MySQL / MariaDB

- **Plus:** Dobre známe.
- **Mínus:** Slabšia podpora pre JSON ako PostgreSQL, ekosystém v Node.js je menej vyspelý ako Postgres alebo Mongo.
- **Diskvalifikované** – neponúka výhody nad PostgreSQL.

### Možnosť E: SQLite

- **Diskvalifikované** pre produkciu so 100-500 paralelnými používateľmi.

## Rozhodnutie

Zvolili sme **MongoDB Atlas (Možnosť A)**.

Hlavné dôvody:
1. **Match s dátovým modelom** – zmiešaný majetok s kategóriovo špecifickými custom fields je presne use case, na ktorý MongoDB sedí lepšie ako relačné DB.
2. **Atlas Search** zaheduje plnotextové vyhľadávanie bez extra infraštruktúry.
3. **Managed service** – nemusíme spravovať DB infraštruktúru, čo je v open-source SFZ projekte s malým tímom dôležité.
4. **Aggregation framework** dobre slúži pre reporty (overdue loans, utilization stats, ...).
5. **Cena akceptovateľná** pre rozsah projektu – v ranom štádiu stačí M10 cluster (~$60/mes), pri raste M20 (~$140/mes).

## Dôsledky

### Pozitívne
- Schéma sa môže evolovať ľahko – pridanie custom field pre kategóriu neznamená migráciu.
- Atlas backup/restore a point-in-time recovery sú zdarma v cluster cene.
- Full-text search bez ďalšieho komponentu.

### Negatívne / kompromisy
- **Integrita na úrovni aplikácie** – nemáme cudzie kľúče. Musíme striktne validovať referencie v aplikačnej vrstve (NestJS guards + service-level checks).
- **Žiadne klasické JOIN-y** – musíme používať `$lookup` v aggregation pipelines alebo manuálne resolve. Pre náš dátový model je to OK.
- **Atomicita len v rámci dokumentu** – pre cross-collection operácie (vytvorenie loan + update assetu) potrebujeme multi-document transactions (Mongo 4+ ich podporuje, Atlas tiež).
- **Vendor exposure** – Atlas je MongoDB Inc. service. Mitigácia: MongoDB samotná je open-source, môžeme migrovať na self-hosted Mongo alebo iný hosting (DocumentDB, CosmosDB Mongo API).

### Riziká, ktoré treba sledovať
- Náklady pri raste objemu dát (audit log môže narásť).
- Pravidelne archivovať staré audit_log a history záznamy do S3/Blob storage.
- Atlas má rate limits – sledovať Atlas Search query patterns.

## Implementačné poznámky

- **ODM:** Mongoose (cez `@nestjs/mongoose`). Schémy definované ako TS triedy s decorators.
- **Validácia:** Zod schémy v `packages/shared-types/` sú single source of truth; Mongoose schémy sa odvodzujú z nich. Pre defensive depth si pre kritické kolekcie nastavíme aj `$jsonSchema` validator na strane Mongo.
- **Transakcie:** používame multi-document transactions pre operácie ako "vytvoriť loan + zmeniť stav assetov + zapísať protokol" – musia byť atomické.
- **Indexy:** definované v migráciách, nie ad-hoc cez Mongoose `index: true` (lepšia kontrola).
- **Connection pooling:** default Mongoose nastavenie + monitoring cez Atlas dashboard.

## Plán nákladov (orientačne)

| Fáza | Cluster | Approx cena |
|------|---------|-------------|
| Vývoj | M0 (free) | $0 |
| Staging | M10 | ~$60/mesiac |
| Produkcia (rok 1) | M10 alebo M20 | $60–140/mesiac |
| Produkcia (po 2-3 rokoch) | M20 alebo M30 | $140–340/mesiac |

## Referencie

- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Atlas Search](https://www.mongodb.com/docs/atlas/atlas-search/)
- [Mongoose dokumentácia](https://mongoosejs.com/)
- [NestJS Mongoose integration](https://docs.nestjs.com/techniques/mongodb)
