<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Day summary · 2026-05-16 (Saturday)

> Maratón session: 6+ hodín. Marketing site polish, interactive demo, Nextra docs deploy, kompletná infraštruktúra LIVE.

---

## 🎯 Highlights — čo sa stalo

### 1. Interactive demo na marketing site

**URL**: https://inventario.sportup.sk/interactive-demo

Postavený **marketing-styled wrapper** okolo 6 P0 product mockupov s:

- **6 cards grid** s preview obrazoviek (Login, Dashboard, Assets, Asset detail, Loan request, My loans)
- **Tenant switcher** (4 demo brandy: Inventario default, Inter Bratislava, Pezinok, Kremnica)
- **Viewport switcher** (mobile 420px / tablet 800px / desktop max)
- **Dual-mode sticky bar** (grid mode: tenant+viewport filters; viewer mode: breadcrumb + thumbnail strip + sub-bar so switchermi)
- **"Čo tu vidíš" callouts** — pre každú obrazovku stručný popis hodnoty
- **Prev/Next navigation** medzi obrazovkami
- **Keyboard shortcuts** — ESC zatvára viewer, ← → prepína obrazovky
- **Browser back tlačidlo** funguje (pushState/popState)
- **Deep linking** cez URL hash (`#login`, `#dashboard`, ...) pre shareability

**UX iterácia** — prvá verzia mala "stuck in viewer" problém (nedalo sa rýchlo prepnúť medzi mockupmi). Po user feedback-u som pridal thumbnail strip + dvojriadkový sticky bar.

### 2. Nextra docs site deploynutý

**URL**: https://docs.inventario.sportup.sk

Stack: **Nextra v4.6.0 + Next.js 15.5** (Next 16 incompatibility issue #5003 obídené).

**7 stránok** v `apps/docs/content/`:

1. `index.mdx` — Vitajte v Inventariu
2. `getting-started.mdx` — Quick start guide
3. `architecture.mdx` — Multi-tenant architecture
4. `api.mdx` — REST API reference
5. `product-ui-tour.mdx` — Tech UI tour (pendant interactive demo)
6. `deployment.mdx` — Deployment guide
7. `about.mdx` — História a tím

**Pagefind search** Cmd+K funguje, dark mode toggle, mobile responsive.

### 3. Clean URLs po celom marketing site

Odstránené `.html` suffixy zo všetkých interných linkov — Vercel `cleanUrls: true` ich strip-uje. Logo + 6 nav linkov + 4 footer linkov + 5 homepage CTAs + ďalšie cross-page references.

**Bug fix**: `href="index.html"` v shared.js generoval `/_home` v URL bar-e na production. Po zmene na `href="/"` to funguje správne.

### 4. Cache problem solved

Predošlý `vercel.json` mal `max-age=31536000, immutable` pre `/assets/(.*)` — to znamenalo že `shared.js` (bez content hashu) sa cachoval **1 rok** v browser-i. Po update navigácie sa zmeny **neprejavili** dokým ľudia nedali hard refresh.

**Fix**: rozdelené cache rules

- `shared.js/css` → `max-age=300, must-revalidate` (5 min)
- Binary assets (img/font) → `max-age=31536000, immutable` (1 rok)

### 5. Vercel docs deploy battle 🔥

**6 pokusov**, 4 chyby, 1 success. Postupne sme zisťovali že pre **pnpm monorepo** Vercel auto-detect zlyháva pri Turbo:

```
> Detected Turbo. Adjusting default settings...
Error: No Next.js version detected.
```

**Riešenie**:

1. Root Directory: `apps/docs` (predtým bolo zle `docs`)
2. Install Command override: `cd ../.. && pnpm install --frozen-lockfile`
3. Build Command override: `cd ../.. && pnpm --filter @sfz/docs build`
4. `apps/docs/vercel.json` redukovaný len na headers (žiadny buildCommand — UI override má prednosť)

**Kľúčový insight**: Vercel hľadá `next` package **pred** spustením custom Build Command, takže Install Command **musí** nainštalovať dependencies z root workspace-u, nie byť `echo "skip"`.

### 6. "Čoskoro" badge revertnutý

Po deploy docs treba marketing site update aby vodne odkazoval na `docs.inventario.sportup.sk`. Spravil som **forward-fix** (nie git revert) na 4 miestach:

- Nav desktop: `Dokumentácia [Čoskoro]` → `Dokumentácia` (s anchor na docs)
- Nav mobile: rovnako
- Footer Zdroje: rovnako
- `technology.html` CTA: `docs.inventario.sportup.sk [Čoskoro]` → live anchor

---

## 📊 Commit log (today)

Approximate sequence:

1. `feat(marketing): add interactive demo page with 6 product mockups`
2. `chore(docs): bootstrap Nextra v4 documentation site for apps/docs`
3. Lint/typecheck fixes (React imports, sourceCode prop, commitlint header length)
4. `fix(marketing): use clean URL paths for internal links`
5. `fix(marketing): remove immutable cache for shared.js and shared.css`
6. `chore(docs): simplify vercel.json for monorepo auto-detect`
7. `chore(docs): add buildCommand to vercel.json for monorepo workspace`
8. `chore(docs): clean up vercel.json for ui-based build override`
9. `chore(docs): remove buildCommand from vercel.json use ui override`
10. `feat(marketing): activate live links to docs.inventario.sportup.sk`

Plus pravdepodobne 1-2 medzi-commits ktoré som sám/sama prepol/a.

---

## 🐛 Bugs squashed today

1. **`_home` URL bug** — Vercel cleanUrls + `href="index.html"` produced weird path
2. **`/_technology` cache bug** — immutable 1-year cache on `shared.js`
3. **Nextra v4.6.0 sourceCode prop** — API change required Wrapper props update
4. **React 'is not defined' ESLint** — needed explicit `import type` from 'react'
5. **Commitlint header-max-length 1135** — too long single-line commit
6. **Vercel No Next.js version detected** — monorepo workspace config quirks

---

## 📦 Files created/modified

### New files

- `docs/marketing-site/interactive-demo.html` (~37 KB)
- `docs/marketing-site/product-screens/` (6 mockup HTML files + README)
- `apps/docs/` (full Nextra setup: package.json, tsconfig, next.config, vercel.json, app/, content/, public/)
- `apps/docs/content/product-ui-tour.mdx`
- `scripts/copy-product-screens.sh`
- `infra/vercel/DOCS-DEPLOYMENT.md`
- `docs/sessions/2026-05-16-day-summary.md` (this file)

### Modified files

- `docs/marketing-site/assets/shared.js` — nav + footer + clean URLs + Docs activated
- `docs/marketing-site/index.html` — CTAs leading with "Pozrieť demo"
- `docs/marketing-site/technology.html` — docs CTA activated
- `docs/marketing-site/vercel.json` — cache headers split
- `apps/docs/vercel.json` — minimal (headers only, build cez UI override)
- `infra/vercel/README.md` — added inventario-docs project
- `REUSE.toml` — added apps/docs/ coverage
- `docs/sessions/NEXT.md` — completely rewritten for next session

---

## 🌐 Production status (end of day)

```
✅ inventario.sportup.sk                    → Static, Vercel cleanUrls
✅ inventario.sportup.sk/interactive-demo   → 6 mockups, UX polished
✅ inventario.sportup.sk/product-screens/*  → Self-contained mockups
✅ docs.inventario.sportup.sk               → Nextra 7 stránok
⏳ api.inventario.sportup.sk                → Q3 2026 (backend ready, čaká na frontend)
```

3 Vercel projekty, všetky v `ltksolutions-projects` team, všetky deployed cez auto-deploy z `main` branch.

---

## 🥂 End-of-day mood

Začalo o ~16:00, skončilo o ~00:55 (skoro 9 hodín v session). Marketing site mal jeden bug po druhom (cache, clean URLs, `_home`), Vercel deploy bol 6-pokusový maratón. Ale na konci: **kompletná infraštruktúra LIVE, všetky 3 subdomény funkčné**.

Zajtra je sobota — možno backend slice #3 K10 (Users admin), alebo deň pauza a v nedeľu.

**Druhá fľaša Brut z Čajkova naozaj zaslúžená.** 🍇✨

---

## 🔗 Quick links pre next session

- **Continuation plan**: [`NEXT.md`](NEXT.md)
- **Yesterday's design pivot**: [`2026-05-15-day-summary.md`](2026-05-15-day-summary.md)
- **Pricing strategy**: [`2026-05-15-pricing-strategy.md`](2026-05-15-pricing-strategy.md)
- **Multi-tenant ADR**: [`docs/decisions/0010-multi-tenant-white-label.md`](../decisions/0010-multi-tenant-white-label.md)
- **Backend tests**: 257 prechádza, ~158s, slice #3 K9 hotové, K10 next
