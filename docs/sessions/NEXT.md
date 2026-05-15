<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# NEXT.md — Continuation Plan

> **Účel:** Single source of truth pre "čo robiť ďalej" pri začatí novej session s Claude.
> **Update protocol:** Aktualizuj na konci každej session.
> **Last updated:** 15. máj 2026, 22:00 (post A-B-C session)

---

## 🎯 Hneď ako otvoríš novú chat session

**Najprv povedz Claude-ovi:**

> _"Prečítaj si `NEXT.md` v root repa, potom `docs/sessions/2026-05-15-day-summary.md` aby si vedel kde sme skončili. Potom môžeme začať s [úlohou]."_

To Claude-ovi naloaduje kompletný kontext za 30 sekúnd.

---

## ✅ A-B-C dokončené dnes (15. máj 2026, večer)

Všetka **príprava dokumentácie** pre deploy je hotová. Zostáva už len **execution**:

### A. OG Image — ✅ pripravené

- `docs/marketing-site/og-image.html` — template 1200×630 s hero gradient + brand pattern + logo + tagline + trust badges
- `docs/marketing-site/assets/README.md` — návod ako spraviť screenshot (Chrome DevTools, Playwright, Puppeteer variants)
- OG meta tags pridané do všetkých 5 marketingových stránok (`og:image` → `https://inventario.sportup.sk/assets/og-image.png`)

**⚠️ Zostáva spraviť po prvom deploy:**

- [ ] Otvor `og-image.html` v Chrome, nastav viewport 1200×630, screenshot → ulož ako `assets/og-image.png`
- [ ] Otestuj OG preview cez https://www.opengraph.xyz/

### B. Vercel deploy config — ✅ pripravené

- `infra/vercel/marketing-site.vercel.json` — template config s clean URLs (`/use-cases`, `/pricing`, ...) + security headers (HSTS, X-Frame-Options, atď.) + cache control pre assety
- `infra/vercel/DEPLOYMENT.md` — krok-po-kroku návod (Dashboard variant + CLI variant + troubleshooting + Lighthouse audit)
- `infra/vercel/README.md` — index pre Vercel infra priečinok

**⚠️ Zostáva spraviť:**

- [ ] Vercel dashboard → vytvoriť projekt `inventario-marketing`
- [ ] Root Directory: `docs/marketing-site`, Framework: `Other`, Build Command: prázdny
- [ ] Skopíruj `infra/vercel/marketing-site.vercel.json` → `docs/marketing-site/vercel.json`
- [ ] Commit + push → automatický redeploy
- [ ] Settings → Domains → Add → `inventario.sportup.sk` (Vercel ti ukáže DNS údaje pre krok C)

### C. DNS setup guide — ✅ pripravené

- `infra/vercel/DNS-SETUP.md` — návod pre Cloudflare / Webglobe / Websupport / GoDaddy / Namecheap variants
- Verification cez `dig` / `nslookup` / online tools (whatsmydns.net, dnschecker.org)
- SSL verification (Let's Encrypt cez Vercel)
- Troubleshooting (proxy bug, cache flush, atď.)

**⚠️ Zostáva spraviť po Vercel deploy:**

- [ ] Zistiť DNS provider pre `sportup.sk` (https://whois.com/whois/sportup.sk → Registrar)
- [ ] Pridať CNAME záznam: `inventario` → `cname.vercel-dns.com` (TTL 300 alebo Auto)
- [ ] Cloudflare: **NIE** Proxied (sivé oblako, **nie** oranžové)
- [ ] Počkaj 5–60 min na propagáciu + SSL verification vo Vercel
- [ ] Otestuj `https://inventario.sportup.sk` — by mal loadovať homepage

---

## ⏭️ Najbližšie kroky (zajtra alebo pondelok)

### Priorita 1: Dokončiť A-B-C execution (~30–60 min)

1. **Vercel deploy** (postup B z `infra/vercel/DEPLOYMENT.md`)
2. **DNS setup** (postup C z `infra/vercel/DNS-SETUP.md`)
3. **OG image screenshot** (postup A z `assets/README.md`)
4. **Final verification**:
   - `https://inventario.sportup.sk` loaduje
   - Všetky 5 stránok funguje (Domov / Pre koho / Cenník / Technológia / O projekte)
   - SSL test cez https://www.ssllabs.com/ssltest/ → A+ rating
   - OG preview cez https://www.opengraph.xyz/
   - Lighthouse audit > 90 (Performance, Accessibility, SEO)

### Priorita 2: Backend slice #3 K10 (~3 hod)

- Users admin module (ADMIN-only)
- `apps/api/src/modules/users/`:
  - `repository.ts` — UsersRepository s `findAll`, `findById`, `updateRole`, `updateActive`
  - `service.ts` — business logic + edge cases
  - `routes.ts` — GET /v1/users (list + pagination + filtre), GET /:id, PATCH /:id
- Edge cases:
  - Admin sa nemôže deaktivovať sám (`assert actorId !== targetId`)
  - Posledný ADMIN je chránený (count ADMIN rolí pred PATCH)
- Audit log: nový typ `USER_ROLE_CHANGED`, `USER_DEACTIVATED`, `USER_ACTIVATED`
- ~30-40 integration testov

### Priorita 3: Slice #3 milestone (~1 hod)

- `docs/milestones/slice-3-categories-locations-users.md`
- Final test count + coverage report
- Lessons learned z categories + locations + users
- Pripraviť ground pre slice #4 (frontend Next.js)

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
- **Vercel + DNS guides**: pripravené v `infra/vercel/`

### Rozpracované / čaká 🟡

- **Backend slice #3 K10**: Users admin module (ADMIN-only, ~30-40 testov)
- **Backend slice #3 K11**: Milestone doc po K10
- **Marketing web deploy**: pripravený, čaká na execution (Vercel + DNS)

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
- [ ] OG image PNG vygenerovať a commitnúť (po Vercel deploy)

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
├── BRAND.md                     # Brand guide
├── README.md                    # Project overview
├── ROADMAP.md                   # Verejná roadmap
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
│   │   └── screens/             # 6 P0 mockupy
│   ├── marketing-site/          # Public marketing web
│   │   ├── og-image.html        # OG template (NEW today)
│   │   └── assets/
│   ├── milestones/              # Slice milestones
│   ├── sessions/                # Session docs
│   ├── api/
│   ├── user-guide/
│   ├── workflows/
│   ├── functional-spec.md
│   └── assets/
│       └── brand/
│           ├── inventario/      # Inventario brand assets
│           └── SFZ_Design-manual_2024-01.pdf
└── infra/
    ├── docker-compose.yml
    └── vercel/                  # NEW today
        ├── README.md
        ├── DEPLOYMENT.md
        ├── DNS-SETUP.md
        └── marketing-site.vercel.json
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
