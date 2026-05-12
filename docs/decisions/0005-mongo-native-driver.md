# 0005. Natívny MongoDB driver + Repository pattern (bez Mongoose)

| | |
|---|---|
| **Status** | Accepted |
| **Dátum** | máj 2026 |
| **Autori** | tím SFZ Asset Management |
| **Súvisiace ADR** | [0002-nestjs](0002-backend-nestjs.md), [0003-mongodb-atlas](0003-mongodb-atlas.md) |

## Kontext

V [ADR-0003](0003-mongodb-atlas.md) sme zvolili MongoDB Atlas. Teraz potrebujeme zvoliť spôsob práce s databázou v NestJS backend-e:

- **Mongoose** (ODM) – tradičná voľba v Node.js + NestJS svete
- **Natívny driver** (`mongodb` npm balík) – nižšia úroveň, plná kontrola
- **Prisma s Mongo connectorom** – moderný ORM s Mongo podporou
- iné (Typegoose, MikroORM, ...) – varianty nad Mongoose, nepriniesli by zmenu

Kľúčový kontext z predchádzajúcich rozhodnutí:

- **Zod schémy v `packages/shared-types/`** sú definované ako **single source of truth** pre doménové entity. Generujeme z nich:
  - TypeScript typy (cez `z.infer<>`)
  - JSON Schema (cez `zod-to-json-schema`)
  - OpenAPI komponenty (cez `nestjs-zod` + `@nestjs/swagger`)
- API kontrakt (`docs/api/openapi.yaml`) je odvodený z Zod schém.
- Validácia request/response prebieha cez Zod (`nestjs-zod` ZodValidationPipe).

## Možnosti

### Možnosť A: Mongoose

Najpopulárnejší ODM pre MongoDB v Node.js.

**Plus:**
- `@nestjs/mongoose` – oficiálny modul s NestJS, dobre dokumentovaný
- Decorators pre schémy (`@Schema`, `@Prop`)
- Validácia, hooks (pre/post save), virtuals, populate
- Veľká komunita, veľa návodov
- Statické metódy a inštancie metódy na modeloch

**Mínus:**
- **Duplicita schém:** Zod schéma + Mongoose schéma → dve definície tej istej entity, ktoré sa musia držať v sync
- **Skrytá komplexnosť:** `Document` vs lean objekty, hydratácia, populate – ťažšie debugovať
- **Performance overhead:** wrapper-y, populate je často N+1 problem
- **Verzia bumpy bolia:** Mongoose 5 → 6 → 7 → 8 znamenali viaceré breaking changes
- **TypeScript support:** zlepšil sa, ale stále nie je first-class (DocumentType, lean<T>(), discriminator typing)
- Pre aggregation pipelines a multi-document transactions je natívny driver idiomatickejší
- Mongoose middleware (hooks) sa v NestJS aplikácii lepšie modeluje cez NestJS interceptors a explicitné service metódy

### Možnosť B: Natívny driver (`mongodb` balík) + Repository pattern (zvolené)

Oficiálny MongoDB driver, ktorý Mongoose interne tiež používa.

**Plus:**
- **Jeden zdroj pravdy:** Zod schémy v `packages/shared-types/` definujú doménu. Validácia v aplikačnej vrstve cez Zod. Defense in depth cez `$jsonSchema` validator na strane Mongo (vygenerovaný zo Zod cez `zod-to-json-schema`).
- **Plná kontrola:** vidíme presne, čo posielame do Mongo. Žiadna magic abstrakcia.
- **Idiomatic MongoDB:** aggregation pipelines, transactions, change streams, bulk operations sú v natívnom drivere prvotriedne.
- **TypeScript:** plné generické typy od MongoDB Inc., `Collection<T>` s `T` priamo z našich Zod schém.
- **Performance:** žiadny ODM overhead, žiadne hydratácia/lean rozhodnutia.
- **Repository pattern** poskytuje konzistentnú API vrstvu (`findById`, `findMany`, `insert`, `updateById`, `softDelete`, `paginate`) a izoluje doménové služby od konkrétneho úložiska.

**Mínus:**
- Viac boilerplate kódu na začiatku – Repository musíme napísať. Mitigácia: jedna generická `MongoRepository<T>` base trieda pokryje 80 % use cases.
- Žiadne magic `populate` – pre relácie použijeme manuálne `$lookup` v aggregation alebo dva queries. V dokumentových databázach je toto často aj tak lepší dizajn.
- Žiadne built-in middleware/hooks – nahradíme NestJS interceptors a explicitnými service metódami (pre `audit_log` a `asset_history` je tento prístup čistejší).

### Možnosť C: Prisma s Mongo connectorom

Moderný ORM s deklaratívnou schémou.

**Plus:**
- Pekná schéma DSL
- Generovaný klient s vynikajúcim TypeScript supportom
- Dobré migračné nástroje (pre SQL)

**Mínus:**
- **Mongo connector je `Preview`/obmedzený** – nepodporuje plne aggregation pipelines, change streams, transactions cez všetky scenáre, niektoré BSON typy.
- Pridáva ďalší layer (Prisma client), ktorý je „blackbox" pre debug.
- Pridáva ďalší source of truth (Prisma schema), čo presúva problém duplicity zo Zod ↔ Mongoose na Zod ↔ Prisma.
- Zaviazali by sme sa na ekosystém Prismy a jej rytmus Mongo podpory.

**Diskvalifikované** kvôli neúplnej Mongo podpore.

### Možnosť D: Typegoose / MikroORM

Wrappery nad Mongoose alebo s vlastným ODM. Zdieľajú väčšinu nevýhod Mongoose (duplicita schém), pridávajú ďalšiu vrstvu závislostí. **Diskvalifikované.**

## Rozhodnutie

Zvolili sme **natívny MongoDB driver + vlastný Repository pattern (Možnosť B)**.

Hlavný dôvod: **vyhnúť sa duplicite definícií schém**. Zod je už zvolený ako single source of truth (kvôli zdieľaniu medzi BE/FE, OpenAPI generovaniu, runtime validácii). Mongoose by pridal druhú definíciu tých istých entít, ktorú musíme udržiavať v sync, a to je presne ten typ technického dlhu, ktorý sa po roku nepríjemne ozve.

## Dôsledky

### Pozitívne
- **Jeden zdroj pravdy pre doménový model:** Zod schémy v `packages/shared-types/`.
- **Transparentnosť:** kód repository priamo zodpovedá Mongo operáciám – ľahké debugovať, profilovať, optimalizovať.
- **Idiomatický Mongo:** aggregation pipelines, multi-document transactions, change streams sú prvotriedne.
- **Bez ODM overhead:** rýchlejšie operácie, menší bundle, jasné pamäťové správanie.
- **Defense in depth:** Mongo `$jsonSchema` validator (generovaný zo Zod) chytí chybné inserty na úrovni DB, aj keby aplikačná validácia zlyhala.
- **Lepší onboarding:** prispievateľ, ktorý vie SQL/MongoDB, vidí presne, čo sa s DB deje. Žiadna magic abstrakcia.

### Negatívne / kompromisy
- **Viac kódu na začiatku:** musíme implementovať `MongoRepository<T>` base triedu a per-modul repository. Mitigácia: base trieda pokryje generické operácie (CRUD, pagination, soft-delete, audit).
- **Žiadne `populate`:** pre relácie použijeme `$lookup` v aggregation pipeline alebo manuálny resolve v service vrstve. Toto je často čistejšie, ale je to explicitne kódovať.
- **Žiadne lifecycle hooks:** namiesto Mongoose pre/post save použijeme NestJS interceptors a explicitné service metódy (napr. `assetsService.update()` zapíše do `asset_history` explicitne, nie cez hook). Toto je v skutočnosti **výhoda** – tok dát je viditeľnejší.

### Riziká, ktoré treba sledovať
- **Konzistencia repository implementácií:** musíme cez code review držať konzistentný štýl v rôznych repositoroch. Mitigácia: lint rules, base trieda, generátor pre nové moduly.
- **Indexovanie:** keďže nemáme Mongoose `Schema.index()`, indexy definujeme v migráciach. Treba striktný proces pri pridávaní nových query patterns.

## Implementačné poznámky

### Štruktúra dátovej vrstvy

```
apps/api/src/
├── common/
│   ├── database/
│   │   ├── database.module.ts        # NestJS modul, exportuje MongoClient
│   │   ├── mongodb.provider.ts       # MongoClient s connection lifecycle
│   │   ├── transactions.ts           # withTransaction helper
│   │   └── change-streams.service.ts # (fáza 2) realtime updates
│   └── repository/
│       ├── base.repository.ts        # generická MongoRepository<T>
│       ├── pagination.ts             # cursor pagination utils
│       └── filters.ts                # filter builder
└── modules/
    └── assets/
        ├── assets.module.ts
        ├── assets.controller.ts
        ├── assets.service.ts         # business logika, audit, history
        └── assets.repository.ts      # extends MongoRepository<Asset>
```

### `MongoRepository<T>` (base trieda)

Pokrýva tieto generické operácie:

```typescript
abstract class MongoRepository<T extends BaseDocument> {
  // CRUD
  findById(id: ObjectId | string): Promise<T | null>;
  findOne(filter: Filter<T>): Promise<T | null>;
  findMany(filter, options): Promise<T[]>;
  insertOne(doc: Omit<T, '_id' | 'createdAt' | 'updatedAt'>, ctx: AuditContext): Promise<T>;
  insertMany(docs, ctx): Promise<T[]>;
  updateById(id, update, ctx): Promise<T | null>;
  updateMany(filter, update, ctx): Promise<UpdateResult>;
  softDelete(id, ctx): Promise<T | null>;
  hardDelete(id, ctx): Promise<DeleteResult>;

  // Pagination
  paginate(filter, opts: { cursor?, limit?, sort? }): Promise<PaginatedResult<T>>;

  // Aggregation
  aggregate<R>(pipeline: Document[]): Promise<R[]>;

  // Counts
  count(filter: Filter<T>): Promise<number>;

  // Bulk
  bulkWrite(ops: AnyBulkWriteOperation<T>[]): Promise<BulkWriteResult>;

  // Transactions
  protected getCollection(session?: ClientSession): Collection<T>;
}
```

### Schema validácia

1. **Zod schémy** v `packages/shared-types/src/schemas/`:
   ```typescript
   export const AssetSchema = z.object({
     _id: z.instanceof(ObjectId),
     inventoryNumber: z.string().regex(/^SFZ-\d{4}-.+/),
     name: z.string().min(1).max(200),
     // ...
   });
   export type Asset = z.infer<typeof AssetSchema>;
   ```

2. **JSON Schema** generovaná zo Zod pri builde:
   ```bash
   pnpm generate:json-schemas  # zod-to-json-schema → packages/shared-types/dist/schemas/*.json
   ```

3. **Mongo `$jsonSchema` validator** aplikovaný pri migráciach:
   ```typescript
   await db.command({
     collMod: 'assets',
     validator: { $jsonSchema: jsonSchemaFromZod(AssetSchema) },
     validationLevel: 'strict',
     validationAction: 'error',
   });
   ```

4. **Runtime validácia** v repository pri zápise:
   ```typescript
   async insertOne(doc: unknown) {
     const validated = AssetSchema.parse(doc);  // throws ZodError
     return this.collection.insertOne(validated);
   }
   ```

### Audit a history

Namiesto Mongoose `post('save')` hookov:
- `MongoRepository` base trieda pri každom zápise zavolá `AuditService.log()` cez injected dependency.
- Service vrstva (napr. `AssetsService`) explicitne volá `AssetHistoryService.recordEvent()` pri biznisových udalostiach.

Tento prístup je explicitnejší a ľahšie testovateľný.

### Migrácie

Migrácie sú TypeScript skripty v `apps/api/src/migrations/{NNNN-popis}.ts`:

```typescript
export default {
  async up(db: Db) {
    await db.createCollection('assets', {
      validator: { $jsonSchema: assetJsonSchema },
    });
    await db.collection('assets').createIndex({ inventoryNumber: 1 }, { unique: true });
    await db.collection('assets').createIndex({ qrCode: 1 }, { unique: true });
  },
  async down(db: Db) {
    await db.collection('assets').drop();
  },
};
```

Migračný runner sleduje stav v kolekcii `_migrations`.

### Transactions

Helper `withTransaction()`:

```typescript
await withTransaction(client, async (session) => {
  await loansRepo.insertOne(loan, { session, ctx });
  await assetsRepo.updateMany(
    { _id: { $in: assetIds } },
    { $set: { status: 'borrowed' } },
    { session, ctx }
  );
  await protocolsRepo.insertOne(protocol, { session, ctx });
});
```

### Aggregation pipelines

Pre komplexné queries (reporty, hľadanie s populáciou súvisiacich entít) píšeme aggregation pipelines explicitne v repository:

```typescript
async getOverdueLoansWithBorrower() {
  return this.aggregate<OverdueLoanReport>([
    { $match: { status: 'overdue' } },
    { $lookup: {
        from: 'users',
        localField: 'borrowerId',
        foreignField: '_id',
        as: 'borrower',
      }
    },
    { $unwind: '$borrower' },
    { $project: { /* ... */ } },
  ]);
}
```

## Konvencie

- **Repository v module** – každý modul má vlastný repository v `{module}.repository.ts`
- **Žiadne raw `collection.findOne()` v service vrstve** – vždy cez repository
- **Žiadne business logic v repository** – repository je čisto perzistencia, business logic je v service
- **Audit context** prechádza ako parameter (`ctx: AuditContext`) cez všetky write operácie – nikdy implicitne

## Referencie

- [MongoDB Node.js Driver dokumentácia](https://www.mongodb.com/docs/drivers/node/current/)
- [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)
- [MongoDB $jsonSchema validator](https://www.mongodb.com/docs/manual/core/schema-validation/specify-json-schema/)
- [Repository pattern in TypeScript](https://martinfowler.com/eaaCatalog/repository.html)
