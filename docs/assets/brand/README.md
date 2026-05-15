# Brand Assets

Tento adresár obsahuje brand assety projektu **Inventario** ako aj historické assety **SFZ** (founding contributor).

> Po strategickom pivote v máji 2026 ([ADR-0010](../../decisions/0010-multi-tenant-white-label.md)) sa primárna brand identita zmenila z SFZ-internal na multi-tenant white-label **Inventario**. SFZ ostáva ako prvý reálny tenant a founding contributor.

## Štruktúra

```
docs/assets/brand/
├── README.md                       ← tento súbor
├── inventario/                     ← primárna brand identita (Inventario)
│   ├── logo.svg                    ← logo bez pozadia (currentColor)
│   ├── logo-container.svg          ← logo s navy rounded background
│   ├── logotype.svg                ← logo + wordmark
│   └── pattern.svg                 ← brand pattern (tile)
└── SFZ_Design-manual_2024-01.pdf   ← historický SFZ design manual (referenčný)
```

## 📘 Detailný brand guide

Plný brand guide nájdeš v **[`BRAND.md`](../../../BRAND.md)** v root repa. Obsahuje:

- Filozofia značky a hlasový tón
- Farebná paleta (primary, semantic, gradients)
- Typografia (Poppins + JetBrains Mono)
- Použitie loga (variants, do/don't)
- Brand pattern guidance
- Multi-tenant whitelabeling rules
- Print & ostatné materiály

## Rýchla referencia

### Primary brand farby (Inventario)

| Token             | HEX       | Použitie                             |
| ----------------- | --------- | ------------------------------------ |
| `--brand-primary` | `#1a2d47` | Navy — primary brand, headers, CTAs  |
| `--brand-accent`  | `#388fc3` | Blue — accent dot, links, highlights |
| `--brand-bg`      | `#f8f6f1` | Paper — page background              |
| `--brand-muted`   | `#6b7a8d` | Steel — secondary text, captions     |

### Typografia

- **Poppins** (sans) — telo + UI + headings
- **JetBrains Mono** (mono) — kód, IDs, technical labels

### Logo varianty

1. **`logo.svg`** — len logomark, používa `currentColor` pre 3 čiary (vrstvy majetku). Accent dot ostáva fixne v `#388fc3`. Najflexibilnejšia varianta.

2. **`logo-container.svg`** — logo na navy rounded square pozadí. Pre použitie na svetlom pozadí, ako app icon, alebo keď chceš logo "zarámcovať".

3. **`logotype.svg`** — kompletný logotype = logo + wordmark "Inventario". Pre hlavičky dokumentov, vizitky, prezentácie. Pomer 4:1 (240×60).

4. **`pattern.svg`** — repetičný tile. Pre použitie ako background pattern (hero sekcie, vizitky, brožúry). 120×120, opakuje sa nekonečne. Používa `currentColor` aby fungoval na ľubovoľnom pozadí.

## Multi-tenant whitelabeling

Keď organizácia (mesto, klub, škola, zväz) chce **vlastný branding** namiesto Inventario default:

1. **Cloud Multi-tenant (Pro plán)** — nahrá si vlastné logo + farby cez admin UI. Inventario branding ostáva v footri ("Powered by Inventario").

2. **Privátna inštancia (Enterprise plán)** — môže si nakonfigurovať custom doménu (`assets.bratislava.sk`) a kompletný rebrand. Inventario attribution v `/about` page.

3. **Self-hosted fork (EUPL-1.2)** — môže si forknúť kód a kompletne odstrániť Inventario branding. **Musí ostať**:
   - SPDX license headery v kóde (EUPL-1.2 compliance)
   - Attribution k pôvodnému projektu v dokumentácii (EUPL-1.2 §5)
   - REUSE 3.3 compliance

Viac v **[`BRAND.md` § Forks & Derivatives](../../../BRAND.md#forks--derivatives)**.

## Historický SFZ design manual

`SFZ_Design-manual_2024-01.pdf` je oficiálny design manual Slovenského futbalového zväzu (Codes Brand House, edícia 2024-01).

**Status**: **referenčný** — pre pochopenie SFZ ako jedného z tenants. SFZ logá a brand prvky **nie sú súčasťou EUPL-1.2 licencie** projektu — ich použitie mimo SFZ tenant prostredia vyžaduje samostatný súhlas SFZ.

## Licencia

- **Inventario logá a brand assety** (`inventario/`): CC-BY-4.0 (rovnako ako ostatná dokumentácia)
- **SFZ assety**: vlastníctvo SFZ, výlučne pre SFZ tenant prostredie
- **Brand pattern, design tokens**: CC-BY-4.0

## TODO

- [ ] Získať od SFZ vektorové SVG/EPS verzie SFZ logo variantov (A, B, C, D)
- [ ] Pripraviť PNG fallbacky pre starší email klient (Outlook 2016 a starší)
- [ ] OG image (1200×630) pre social sharing
- [ ] Print verzie loga (CMYK + Pantone equivalents)
- [ ] Brand video intro (animovaný pattern → logo reveal, 3 sekundy)
