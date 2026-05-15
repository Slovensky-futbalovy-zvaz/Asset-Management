<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Marketing site assets

Tento priečinok obsahuje statické assety pre Inventario marketingový web.

## Súbory

| Súbor          | Účel                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| `shared.css`   | Global design system (CSS custom properties, utilities, nav, footer, responsive) |
| `shared.js`    | Auto-injekt nav + footer modul (mobile menu, lang switcher, external links)      |
| `favicon.svg`  | Browser tab icon (32×32 SVG s navy container)                                    |
| `logo.svg`     | Standalone logomark s `currentColor`                                             |
| `logotype.svg` | Logo + wordmark "Inventario" (240×60)                                            |
| `og-image.png` | Open Graph image pre social sharing (1200×630) — viď nižšie                      |

---

## OG image — ako vytvoriť `og-image.png`

OG image sa zobrazuje keď niekto linkneš stránku na LinkedIn, Slack, Discord, Twitter alebo Facebook. Generujeme ju zo šablóny `docs/marketing-site/og-image.html`.

### Možnosť 1: Cez Chrome DevTools (najjednoduchšie)

1. **Otvor template v Chrome:**

   ```
   open docs/marketing-site/og-image.html
   ```

2. **DevTools** → Cmd+Shift+I (Mac) alebo F12 (Windows)

3. **Toggle device toolbar** → Cmd+Shift+M (Mac) alebo Ctrl+Shift+M (Windows)

4. **Nastav viewport na 1200 × 630**:
   - V hornom drop-down zvoľ "Responsive"
   - Šírka: `1200`
   - Výška: `630`

5. **Capture screenshot**:
   - Cmd+Shift+P (Mac) alebo Ctrl+Shift+P (Windows)
   - Napíš "Capture screenshot"
   - Vyber "Capture full size screenshot" alebo "Capture screenshot"

6. **Ulož ako** `docs/marketing-site/assets/og-image.png`

### Možnosť 2: Cez Playwright (programovo)

Ak máš Playwright nainštalované:

```bash
npx playwright screenshot \
  --viewport-size=1200,630 \
  --full-page=false \
  file://$(pwd)/docs/marketing-site/og-image.html \
  docs/marketing-site/assets/og-image.png
```

### Možnosť 3: Cez Puppeteer

```bash
npx @puppeteer/browsers install chrome@latest
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto('file://$(pwd)/docs/marketing-site/og-image.html');
  await page.screenshot({ path: 'docs/marketing-site/assets/og-image.png' });
  await browser.close();
})();
"
```

### Po vytvorení

1. Skontroluj že `og-image.png` má rozmery **presne 1200 × 630 px**
2. File size by mal byť pod **300 KB** (LinkedIn limit pre OG images)
3. Commitni do repa: `git add docs/marketing-site/assets/og-image.png`

### Testovanie

Po deploy na produkciu otestuj OG image:

- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- OpenGraph.xyz: https://www.opengraph.xyz/

---

## Logo variants

Ak potrebuješ logo v inej veľkosti / forme, pozri:

- `docs/assets/brand/inventario/` — primárny brand assets repo
- `BRAND.md` v root repa — kompletný brand guide
