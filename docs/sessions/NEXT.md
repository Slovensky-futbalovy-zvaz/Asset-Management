<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# NEXT.md — Continuation Plan

> **Účel:** Single source of truth pre "čo robiť ďalej" pri začatí novej session s Claude.
> **Update protocol:** Aktualizuj na konci každej session.
> **Last updated:** 15. máj 2026, 21:00

---

## 🎯 Hneď ako otvoríš novú chat session

**Najprv povedz Claude-ovi:**

> _"Prečítaj si `NEXT.md` v root repa, potom `docs/sessions/2026-05-15-day-summary.md` aby si vedel kde sme skončili. Potom môžeme začať s [úlohou]."_

To Claude-ovi naloaduje kompletný kontext za 30 sekúnd.

---

## ⏭️ Najbližšie kroky (16. máj 2026, zajtra)

Plán je **A → B → C** z dnešného konca:

### A. OG Image pre social sharing (15 min)

**Cieľ:** Pekný preview keď niekto linkneš `inventario.sportup.sk` na LinkedIn / Slack / Discord / Twitter.

**Postup:**

1. Vytvor `docs/marketing-site/og-image.html` — HTML template 1200×630
2. Hero gradient background + brand pattern overlay
3. Logo + wordmark "Inventario"
4. Tagline: "Transparentná správa majetku. Bez vendor lock-in."
5. Trust badges (EUPL, REUSE, GDPR)
6. "Powered by SportUp ecosystem" v rohu
7. User otvorí v prehliadači, spraví screenshot → uloží ako `og-image.png` v `assets/`
8. Pridať do `<meta property="og:image">` všetkých 5 marketingových stránok

### B. Vercel deploy pipeline (~20 min)

**Cieľ:** Web dostupný na `inventario.sportup.sk` (alebo `inventario-asset-management.vercel.app` ako fallback).

**Postup:**

1. Skontroluj že máš Vercel account + CLI nainštalované (`vercel --version`)
2. V root repa: `vercel link` — nalinkovať existujúci projekt `asset-management-api` alebo vytvoriť nový pre marketing site
3. Vytvor `vercel.json` config s:
   - `outputDirectory: docs/marketing-site`
   - Redirects pre `index.html` → `_home.html`
   - Headers pre security (CSP, X-Frame-Options)
4. Test deploy: `vercel deploy` (preview URL)
5. Po overení: `vercel --prod`

**Alternatíva:** GitHub Pages (lacnejšie, ale obmedzená flexibilita). Vercel je odporúčaný.

### C. DNS setup pre `inventario.sportup.sk` (~5 min)

**Cieľ:** Web dostupný na production doméne.

**Postup:**

1. V DNS panelu `sportup.sk` (kde to spravuješ — Cloudflare? Webglobe?) pridaj:
   - `inventario` → CNAME → `cname.vercel-dns.com`
2. Vo Vercel projekte: Settings → Domains → Add → `inventario.sportup.sk`
3. Počkaj na SSL certifikát (Vercel automaticky cez Let's Encrypt, ~5 min)
4. Otestuj v prehliadači

**Možný problém:** Wildcard SSL na `*.sportup.sk` — overiť či to nepotrebuje špeciálne nastavenie.

### D. (odložené na pondelok 14:00) Ďalšie sliceové práce

Po reseti Claude weekly limitu môžeme robiť veľké veci. Viď sekciu "Backlog" nižšie.

---

## 📋 Stav projektu (snapshot)

### Hotové ✅

- **Backend slice #1**: pnpm monorepo, Fastify, MongoDB Atlas, Entra ID
- **Backend slice #2**: Auth + Assets CRUD + RBAC + Audit log + Transactions
- **Backend slice #2c**: Tests + CI + Pre-commit
- **Backend slice #3 K1-K9**: Categories + Locations + FK protection (257 testov)
- **Strategický pivot**: SFZ-internal → multi-tenant Inventario
- **EU compliance**: EUPL-1.2 + CC-BY-4.0 + REUSE 3.3 (175/175)
- **Design exploration**: 6 P0 mockupov (Login, Dashboard, Assets list, Asset detail, Loan request, My loans)
- **Marketing site**: 5 stránok + brand assets + favicon
- **Brand system v1.0**: Logo, pattern, BRAND.md
- **Pricing strategy v1.0**: Hybrid C + Annual Contract pre verejný sektor

### Rozpracované / čaká 🟡

- **Backend slice #3 K10**: Users admin module (ADMIN-only, ~30-40 testov)
- **Backend slice #3 K11**: Milestone doc po K10
- **Marketing web deploy**: Pripravený, čaká na Vercel + DNS

### Plánované 🚀

- **Fáza B**: Design tokens refactor (primitives/semantic/brand vrstvy, dark mode, CSS/Tailwind/Flutter exports)
- **Backend slice #4**: Frontend implementácia (`apps/web` Next.js) podľa mockupov
- **Backend slice #5**: GDPR Article 30 hardening + DPIA + Threat Model
- **Backend slice #6**: MCP server pre AI agentov + chatbot infraštruktúra
- **Documentation site**: `docs.inventario.sportup.sk` (Astro alebo Docusaurus)

---

## 🧠 Long-term ideas (pre budúcnosť)

### 1. Inteligentný onboarding (slice #4+)

**Implementácia:**

```tsx
<InfoIcon contextId="inventory-number" />
```

- Tooltip s 1-2 vetami vysvetlenia
- Link na `docs.inventario.sportup.sk/concepts/inventory-number`
- 3-vrstvová stratégia:
  1. Inline info ikony (ⓘ)
  2. Empty states ako mikro-onboarding (s GIF / video)
  3. Contextual nudges po prvom prihlásení (dismissible cards)

### 2. AI Chatbot v aplikácii

**Infrastruktúra na budovanie už dnes:**

- Docs písané v markdown so frontmatter (`topics: []`, `concepts: []`) pre RAG
- Backend endpoint `/api/help/search` (slice #6+)
- MCP server (už máme `apps/mcp-server`!) ako wrapper pre Claude API
- Vector embedding kolekcia v MongoDB pre semantic search
- Chat UI komponent v `apps/web` (slice #6)

### 3. Multi-tenant onboarding flow

Po každej registrácii nového tenanta:

- Auto-import demo dát (10 položiek vybraných pre typ organizácie)
- Quick tour cez 6 P0 obrazoviek
- "Skip tour" + "Resume later" options

### 4. Mobile app (Flutter)

- Backend už ready (REST API + OpenAPI 3.1)
- Design system kompatibilný (design tokens export pre Flutter)
- Hlavné use cases: QR scan pre vrátenie / prevzatie / žiadosť o výpožičku
- Plánované cca slice #7-8

### 5. Pricing kalkulátor na webe

Interaktívny kalkulátor: zákazník zadá počet zamestnancov + odhadované položky → kalkulátor mu povie:

- Odporúčaný tier
- Cena mesačne + ročne
- Annual contract alternatíva (ak verejný sektor)
- Kontakt button s pre-fill informáciami

### 6. Public benchmark page (`/why-inventario`)

Transparentné porovnanie s konkurenciou (Asset Panda, EZOfficeInventory, Cheqroom, Sortly) — features, cena, EU compliance, atď.

---

## 🐛 Známe technické dlhy (pre slice #4+)

Z dnešnej session a predošlých:

- [ ] `audit.test.ts` flaky timeout fix (občas zlyhá v CI)
- [ ] `LOCATION_TYPE_VALUES` export do `shared-types`
- [ ] `UpdateCategorySchema` + `UpdateLocationSchema` do `shared-types`
- [ ] Migrácia: pridať `organisationId: ObjectId` field do všetkých kolekcií (per ADR-0010)
- [ ] Refactor design tokens (Phase B z dnešnej session — odložené)

---

## 🇪🇺 EU compliance roadmapa

- [x] EUPL-1.2 licencia
- [x] CC-BY-4.0 pre docs
- [x] REUSE 3.3 (175/175)
- [x] DCO sign-off workflow
- [x] GDPR Article 30 audit log (basic)
- [ ] Public GitHub repo (čaká na produkčné nasadenie)
- [ ] WCAG 2.1 AA accessibility audit (slice #4)
- [ ] GDPR Article 30 hardening + DPIA (slice #5)
- [ ] SBOM CycloneDX export (slice #4)
- [ ] OpenAPI 3.1 export (slice #4)
- [ ] DPIA + Threat Model + Disaster Recovery Plan (slice #8, pred produkciou)
- [ ] CRA (Cyber Resilience Act) compliance (2027 deadline)

---

## 🗣️ Communication kontakty

| Téma                  | Kontakt                                                     |
| --------------------- | ----------------------------------------------------------- |
| Všeobecné / Sales     | inventario@ltk.solutions                                    |
| Priame na maintainera | jan.letko@ltk.solutions                                     |
| GitHub issues         | github.com/Slovensky-futbalovy-zvaz/Asset-Management/issues |
| Security disclosures  | Cez SECURITY.md (CVD policy)                                |

---

## 📂 Štruktúra repa (pre Claude reference)

```
Asset-Management/
├── BRAND.md                     # Brand guide (NEW today)
├── README.md                    # Project overview
├── ROADMAP.md                   # Verejná roadmap (TO UPDATE)
├── CHANGELOG.md                 # Keep a Changelog
├── LICENSE                      # EUPL-1.2
├── LICENSE-DOCS                 # CC-BY-4.0
├── REUSE.toml                   # Licensing metadata
├── apps/
│   ├── api/                     # Fastify backend
│   ├── web/                     # (planned) Next.js frontend
│   └── mcp-server/              # MCP for AI agents
├── packages/
│   ├── shared-types/            # Zod schemas
│   └── design-tokens/           # Design system tokens
├── docs/
│   ├── README.md
│   ├── decisions/               # ADRs (0001-0011)
│   ├── architecture/
│   ├── design/
│   │   └── screens/             # 6 P0 mockupy (NEW today)
│   ├── marketing-site/          # Public marketing web (NEW today)
│   ├── milestones/              # Slice milestones
│   ├── sessions/                # Session docs (this folder)
│   ├── api/
│   ├── user-guide/
│   ├── workflows/
│   ├── functional-spec.md
│   └── assets/
│       └── brand/
│           ├── inventario/      # Inventario brand assets (NEW today)
│           └── SFZ_Design-manual_2024-01.pdf
└── infra/
```

---

## 🍷 Personal notes (pre Claude — kontext o user-ovi)

- **Ján Letko** je primary maintainer
- LTK Solutions je jeho firma
- Pracuje cez **GitHub Desktop** (nie command-line git)
- Claude robí súbory cez **filesystem MCP server**
- User commit-uje a push-uje manuálne
- **Slovenčina** je preferovaný jazyk
- User **rád oceňuje** kreativitu + strategické myslenie
- User **chce dlhodobý systém**, nie quick hack
- Má **extra balance €160** na Claude (môžeme pokračovať veľa)
- **Vinonichta** je gastro partner — winový pohon dlhých session-ov

---

**Update tento súbor** na konci každej session aby zachytil aktuálny stav!
