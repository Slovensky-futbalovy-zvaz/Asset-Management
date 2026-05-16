<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# @inventario/design-tokens

Design tokens pre Inventario — **jediný zdroj pravdy** pre brand farby, typografiu, spacing, radii a shadows naprieč celým systémom (web app, marketing, docs, e-maily, mobile v budúcnosti).

> **Status**: v0.2.0 — post-pivot Inventario brand (Navy + Blue + Paper + Poppins). Predchádzajúca SFZ-only verzia (v0.1.x) je v git histórii.

---

## Zdroj pravdy

Hodnoty pochádzajú z [`BRAND.md`](../../BRAND.md) v1.0 (2026-05-15). Token štruktúra (`tokens.json`) drží W3C Design Tokens formát aby sa dala neskôr generovať cez Style Dictionary, Tokens Studio for Figma, alebo iný tooling.

```
packages/design-tokens/
├── tokens.json                    # W3C Design Tokens — source of truth
├── src/
│   ├── index.ts                   # TypeScript exports (primitive/semantic/brand)
│   ├── tokens.css                 # CSS custom properties (--inv-*)
│   ├── tailwind-preset.js         # Tailwind preset config
│   └── brand-kit.schema.json      # JSON schema pre per-tenant overrides
├── dist/                          # tsc build output
└── package.json
```

---

## Architektúra — 3 vrstvy

Tokeny sú organizované do troch vrstiev, ktoré zodpovedajú [W3C Design Tokens reference architecture](https://design-tokens.github.io/community-group/format/) (Primitives → Semantic → Brand):

### 1. Primitive

Raw hodnoty — hex farby, font weights, spacing rem hodnoty, atď. **Komponenty ich nikdy nečítajú priamo.** Existujú len aby semantic a brand vrstvy mali na čo referncovať. Príklad:

```
--inv-primitive-navy-700: #1a2d47;
--inv-primitive-blue-500: #388fc3;
--inv-primitive-paper-100: #f8f6f1;
```

### 2. Semantic

UI roly — text, surface, border, success, warning, danger, info, asset-status. **Toto je vrstva ktorú by mali komponenty čítať väčšinou.** Mení sa v dark mode (mapping z primitives sa prehodí). Príklad:

```
--inv-semantic-text-primary: var(--inv-primitive-navy-700);
--inv-semantic-surface-page: var(--inv-primitive-paper-100);
--inv-semantic-success-fg: var(--inv-primitive-emerald);
```

### 3. Brand

Inventario default identita — primary, accent, logo-dot. **Toto je vrstva ktorú override-uje každý tenant.** Príklad:

```
--inv-brand-primary: var(--inv-primitive-navy-700);
--inv-brand-accent: var(--inv-primitive-blue-500);
```

Komponent siahne po `brand.*` keď chce "naša primárna farba" (mení sa per-tenant), po `semantic.*` keď chce "primárny text" (rovnaké naprieč tenantmi).

---

## Použitie

### CSS custom properties

Najjednoduchšia integrácia, funguje vo všetkých web kontextoch a podporuje multi-tenant override out-of-the-box:

```css
@import '@inventario/design-tokens/tokens.css';

.btn-primary {
  background: var(--inv-brand-primary);
  color: var(--inv-brand-primary-fg);
  border-radius: var(--inv-radius-lg); /* 10px per BRAND.md */
  box-shadow: var(--inv-shadow-cta);
  font-family: var(--inv-font-family-sans);
  padding: var(--inv-spacing-3) var(--inv-spacing-6);
}

.card {
  background: var(--inv-semantic-surface-card);
  border: 1px solid var(--inv-semantic-border-subtle);
  border-radius: var(--inv-radius-xl); /* 16px per BRAND.md */
}
```

### TypeScript / React

```ts
import { brand, semantic, primitive } from '@inventario/design-tokens';

const buttonStyle = {
  background: brand.primary,
  color: brand.primaryFg,
  borderRadius: primitive.radius.lg,
  fontFamily: primitive.font.family.sans,
} satisfies React.CSSProperties;
```

Pre dynamický runtime kontext (tenant overrides) preferuj CSS custom properties — TypeScript export je statický snapshot Inventario default values.

### Tailwind

```ts
// tailwind.config.ts
import inventarioPreset from '@inventario/design-tokens/tailwind';

export default {
  presets: [inventarioPreset],
  content: ['./src/**/*.{ts,tsx}'],
};
```

Trieda dostupné po pridaní presetu:

```tsx
<button className="bg-brand-primary text-brand-primary-fg rounded-lg shadow-cta">
  Pridať majetok
</button>

<div className="bg-surface-card border border-border-subtle rounded-xl">
  <h3 className="text-text-primary">Nadpis karty</h3>
  <p className="text-text-secondary">Popis...</p>
</div>

<span className="bg-success-bg text-success-fg">Dostupné</span>
<span className="bg-asset-borrowed text-text-inverse">Vypožičané</span>
```

Tailwind utility classy mapujú **iba semantic a brand** vrstvy. Primitive je accessible cez CSS custom properties priamo, ak naozaj treba.

---

## Multi-tenant white-labeling

Inventario je white-label platforma (per [ADR-0010](../../docs/decisions/0010-multi-tenant-white-label.md)). Každý tenant môže nahrať vlastný brand kit s custom farbami.

### Override mechanizmus

Brand vrstvu override-uje selector `:root[data-tenant='X']`:

```css
:root[data-tenant='bratislava'] {
  --inv-brand-primary: #003d7a;
  --inv-brand-primary-fg: #ffffff;
  --inv-brand-accent: #ffd700;
  --inv-brand-accent-fg: #1a2d47;
}
```

HTML root element nastaví `data-tenant` na základe domény alebo organisation identity:

```html
<html data-tenant="bratislava">
  ...
</html>
```

Komponenty potom **automaticky** dostanú správnu farbu — bez extra setupu.

### Brand kit JSON schema

Per-tenant brand kit má strict schema ([`src/brand-kit.schema.json`](src/brand-kit.schema.json)). Validuje sa pri uploade z admin UI a pri runtime injectování do `<head>`.

```jsonc
{
  "tenantId": "bratislava",
  "version": 1,
  "displayName": "Mesto Bratislava",
  "colors": {
    "primary": "#003d7a",
    "primaryFg": "#ffffff",
    "accent": "#ffd700",
    "accentFg": "#1a2d47",
  },
}
```

Backend validuje proti tomuto schema cez `ajv` alebo Zod (TBD pri implementácii API endpointu).

### Čo sa NEdá override-núť

Per design, primitive a semantic vrstvy sú **stabilné naprieč tenantmi**. To znamená:

- ✅ Tenant si môže zmeniť `--inv-brand-primary` (napr. Bratislava navy → Bratislava modrá)
- ❌ Tenant **nemôže** zmeniť `--inv-semantic-success-fg` (zelená pre success je univerzálna)
- ❌ Tenant **nemôže** zmeniť `--inv-primitive-emerald` (raw value)
- ❌ Tenant **nemôže** zmeniť radii ani spacing (UI by sa rozpadlo)

Toto zabezpečuje že UI je predvídateľné — admin Inventaria vie že tlačidlo má vždy `rounded-lg`, len jeho farba sa môže líšiť.

---

## Dark mode

V1 scope: opt-in cez `data-theme` attribute na `<html>`:

```html
<html data-theme="dark">
  ...
</html>
```

Mení **iba semantic mapping** (text, surface, border). Primitive a brand layers ostávajú nemenné — tenant overrides fungujú konzistentne v oboch módoch.

```css
:root[data-theme='dark'] {
  --inv-semantic-text-primary: var(--inv-primitive-paper-100);
  --inv-semantic-surface-page: var(--inv-primitive-navy-900);
  /* ...etc */
}
```

Slice #4 frontend si zvolí switching mechanizmus (system preference vs explicit toggle).

---

## Pravidlá pridávania tokenov

1. **Zdroj musí byť v `tokens.json`** — nikdy nepridávaj hodnoty priamo do CSS alebo TypeScript exportu. Tieto sa **regenerujú** z JSON (zatiaľ ručne, neskôr cez Style Dictionary).

2. **Nový primitive iba ak chýba v palete** — overuj proti BRAND.md, či nová farba je naozaj nutná. Často stačí použiť existujúci primitive z navy/blue/steel scale.

3. **Nový semantic vždy referencuje primitive** — nikdy nie raw hex hodnotu. Príklad: `text-primary` → `{primitive.color.navy.700.value}`, nie `"#1a2d47"`.

4. **Nový brand vždy referencuje primitive** — rovnaké pravidlo ako semantic. Brand layer existuje aby ho tenant override-oval, takže value MUSÍ byť token reference, nie inline hex.

5. **WCAG 2.1 AA contrast** — všetky farebné páry (text na surface, accent na primary, atď.) musia mať contrast ≥ 4.5:1 v normal text size. Overuj cez [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

6. **Token názvy v kebab-case** — `text-primary` nie `textPrimary`. CSS custom properties používajú kebab-case nativne; TypeScript export ich transformuje na camelCase pri exporte.

---

## Build

```bash
pnpm --filter @inventario/design-tokens build
```

Generuje `dist/index.{js,d.ts}` z `src/index.ts` cez tsc. CSS, Tailwind preset a JSON schema **nie sú** generované — sú maintained ručne v `src/` (a v package files pole sú referenced priamo).

```bash
pnpm --filter @inventario/design-tokens typecheck
pnpm --filter @inventario/design-tokens lint
```

---

## Spätná kompatibilita

Tokeny majú semver verziovanie. Major bump pri:

- Odstránení existujúceho semantic alebo brand tokenu
- Zmene CSS custom property prefixu (`--inv-` → niečo iné)
- Zmene `brand-kit.schema.json` version (1 → 2)
- Zmene 3-vrstvovej architektúry

Minor bump pri:

- Pridaní nového tokenu v ktorejkoľvek vrstve
- Pridaní novej dark mode / theme variácie
- Pridaní nového field do brand-kit schema (backward-compatible)

Patch bump pri:

- Zmene popisov, JSON schema descriptions
- Zmene primitive hodnoty ktorá nemení vizuálny output (napr. zaokrúhlenie hex farby)

---

## Roadmap

- ✅ **v0.2.0** (2026-05-16) — Post-pivot Inventario brand, 3-vrstvová architektúra, dark mode v1, Tailwind preset, brand-kit JSON schema
- ⏳ **v0.3.0** — Style Dictionary integration ak token set narastie nad ~100 tokenov
- ⏳ **v0.4.0** — Flutter theme export pre mobile app
- ⏳ **v1.0.0** — Public stabilita po prvom external tenant onboarding

---

## Referencie

- [BRAND.md v1.0](../../BRAND.md) — Brand guide
- [ADR-0010 Multi-tenant white-label](../../docs/decisions/0010-multi-tenant-white-label.md)
- [W3C Design Tokens Community Group Format](https://design-tokens.github.io/community-group/format/)
- [Tokens Studio for Figma](https://tokens.studio/)
- [Style Dictionary](https://amzn.github.io/style-dictionary/) — future build tooling
