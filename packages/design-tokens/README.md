# @sfz/design-tokens

Design tokens pre SFZ Asset Management. **Jediný zdroj pravdy** pre brand farby, typografiu, spacing a ostatné vizuálne konštanty naprieč celým systémom (web, mobile, dokumentácia, e-maily).

## Zdroj

Tokeny vychádzajú z oficiálneho **SFZ Design Manual 2024-01** (Codes Brand House) – uloženého v [`docs/assets/brand/SFZ_Design-manual_2024-01.pdf`](../../docs/assets/brand/).

## Štruktúra

```
packages/design-tokens/
├── tokens.json          # Zdrojový súbor (W3C Design Tokens formát)
├── src/
│   ├── index.ts        # TypeScript export (TODO)
│   └── tokens.css      # CSS custom properties (TODO)
├── dist/                # Build output (generovaný)
└── package.json
```

## Použitie

### V TypeScript / React
```typescript
import { tokens } from '@sfz/design-tokens';

const primaryColor = tokens.color.brand.blue; // '#1450df'
```

### V CSS / Tailwind
```css
@import '@sfz/design-tokens/tokens.css';

.btn-primary {
  background: var(--color-brand-blue);
  color: var(--color-brand-white);
}
```

### V Tailwind config
```js
// tailwind.config.js
import tokens from '@sfz/design-tokens/tokens.json';

export default {
  theme: {
    extend: {
      colors: {
        'sfz-blue': tokens.color.brand.blue.value,
        'sfz-red': tokens.color.brand.red.value,
        // ...
      }
    }
  }
}
```

## Build

```bash
pnpm build
```

Generuje:
- `dist/index.js` – CommonJS export
- `dist/index.esm.js` – ESM export
- `dist/index.d.ts` – TypeScript typy
- `dist/tokens.css` – CSS custom properties
- `dist/tailwind.config.js` – Tailwind preset

## Pravidlá pridávania tokenov

1. **Zdroj musí byť v `tokens.json`.** Nikdy nepridávaj farby/spacing priamo do CSS alebo komponentov.
2. **Pre brand farby** – overenie cez SFZ Design Manual. Ak nová farba nie je v manuáli, konzultuj s brand managerom SFZ.
3. **Pre sémantické tokeny** (success/warning/danger/...) – preferuj referencie na existujúce brand/accent farby, nie nové hex hodnoty.
4. **Token názvy v kebab-case**, s logickou hierarchiou: `color.brand.blue`, nie `colors.primaryBlue`.

## Spätná kompatibilita

Tokeny majú semver verziovanie. Major bump pri:
- Odstránení existujúceho tokenu
- Zmene hodnoty existujúceho brand tokenu
- Zmene štruktúry kategórií

Minor bump pri:
- Pridaní nového tokenu
- Pridaní nového variantu

Patch bump pri:
- Zmene popisov, metadata
- Drobných úpravách sémantických tokenov

## Referencie

- [W3C Design Tokens Community Group Format](https://design-tokens.github.io/community-group/format/)
- [Tokens Studio for Figma](https://tokens.studio/)
- [Style Dictionary](https://amzn.github.io/style-dictionary/) – build tooling (TODO: zvážiť integráciu)
