<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# `product-screens/` — Inventario UI mockupy pre verejné demo

Tento priečinok obsahuje **6 self-contained HTML mockupov** Inventario aplikácie, ktoré sa renderujú v `<iframe>` z [`../interactive-demo.html`](../interactive-demo.html).

## Súbory

| Súbor                     | Popis                                                    |
| ------------------------- | -------------------------------------------------------- |
| `_login-page.html`        | 01 · Multi-tenant SSO login                              |
| `_dashboard-page.html`    | 02 · Role-aware dashboard (employee/asset_manager/admin) |
| `_assets-list-page.html`  | 03 · Zoznam majetku s filtrami                           |
| `_asset-detail-page.html` | 04 · Detail majetku s 5 tabmi                            |
| `_loan-request-page.html` | 05 · 3-step wizard pre výpožičku                         |
| `_my-loans-page.html`     | 06 · Osobné výpožičky (3 taby)                           |

## Vzťah k `/docs/design/screens/`

Tieto súbory sú **kópie** zo `docs/design/screens/_*.html`. Originál slúži ako interný design exploration, kópia tu je pre **verejné publikovanie** v marketing site bundli (deployovanom na Vercel).

Pre **sync** (po editácii originálu) spusti:

```bash
bash scripts/copy-product-screens.sh
```

## URL parametre

Každý mockup podporuje:

- `?tenant=<default|inter|pezinok|kremnica>` — branding (4 demo organizácie)
- `?role=<employee|asset_manager|admin>` — len pre `_dashboard-page.html`, ovplyvňuje obsah

Príklady:

- `_login-page.html?tenant=pezinok` — Pezinok branding
- `_dashboard-page.html?tenant=inter&role=asset_manager` — Inter asset manager view

## Technológie

Každý súbor je **self-contained**:

- Tailwind CSS cez CDN (`https://cdn.tailwindcss.com`)
- Poppins + JetBrains Mono cez Google Fonts
- Brand farby cez CSS custom properties
- Žiadne externé asset súbory, žiadne build kroky

To znamená že fungujú aj **offline** (po prvom načítaní fontov + Tailwind), a **dajú sa kopírovať** do akéhokoľvek kontextu (Notion embed, prezentácia, blog post, atď.).
