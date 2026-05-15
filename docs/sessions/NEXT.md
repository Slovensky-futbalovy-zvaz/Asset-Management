# Inventario · Lokálna deploy príprava

> **Action required**: 5 mockup súborov treba lokálne skopírovať pred Vercel deployom.
>
> Toto sa robí lokálne lebo cez Claude write_file by to bolo pomalé (~250 KB textu).
> Bash `cp` to spraví za sekundu.

## Skopíruj 5 product screens

V termináli, z root repa:

```bash
cd /Users/janletko/Documents/GitHub/Asset-Management

# Skopíruj 5 zostávajúcich mockupov (login už máš)
cp docs/design/screens/_dashboard-page.html docs/marketing-site/product-screens/
cp docs/design/screens/_assets-list-page.html docs/marketing-site/product-screens/
cp docs/design/screens/_asset-detail-page.html docs/marketing-site/product-screens/
cp docs/design/screens/_loan-request-page.html docs/marketing-site/product-screens/
cp docs/design/screens/_my-loans-page.html docs/marketing-site/product-screens/

# Alebo všetko cez skript:
bash scripts/copy-product-screens.sh
```

## Verify

```bash
ls -la docs/marketing-site/product-screens/
```

Mal by si vidieť **6 .html súborov + 1 README.md**.

## Test demo lokálne

```bash
# Spusti jednoduchý HTTP server (Python má, alebo npx serve)
cd docs/marketing-site
python3 -m http.server 8080

# Alebo:
npx serve .
```

Otvor v prehliadači: **http://localhost:8080/interactive-demo.html**

Mal by si vidieť:

- ✅ Hero "Vidieť je _pochopiť_"
- ✅ 6 cards s preview obrazoviek
- ✅ Tenant switcher (default / inter / pezinok / kremnica)
- ✅ Viewport switcher (mobile / tablet / desktop)
- ✅ Klik na card → otvorí iframe s daným mockupom
- ✅ "Čo tu vidíš" callout s detailmi
- ✅ Prev / Next medzi obrazovkami
- ✅ Final CTA "Páči sa ti čo vidíš?"

## Po teste — commit + push

```bash
git add docs/marketing-site/product-screens/
git add docs/marketing-site/interactive-demo.html
git add docs/marketing-site/assets/shared.js
git add docs/marketing-site/index.html
git add apps/docs/content/product-ui-tour.mdx
git add apps/docs/content/_meta.ts
git add scripts/copy-product-screens.sh
```

Vercel automaticky redeployne marketing site.

---

🥂 **Hotovo!** Demo je live na `inventario.sportup.sk/interactive-demo`.
