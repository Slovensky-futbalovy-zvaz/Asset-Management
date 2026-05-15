<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# Inventario docs site — Vercel deployment guide

> **Cieľ:** Nasadiť `apps/docs/` (Nextra v4 + Next.js) na `docs.inventario.sportup.sk`
> **Predpokladaná dĺžka:** ~15 minút (vrátane DNS propagácie)
> **Status:** Pripravené na execution

---

## 📋 Pred štartom

- [x] Vercel account (`asset-management-api` a `inventario-marketing` už existujú)
- [x] Prístup k Websupport DNS panelu pre `sportup.sk`
- [x] `apps/docs/` committed na main branch

---

## 🚀 Postup

### Krok 1: Vytvor nový Vercel projekt

1. Choď na https://vercel.com/new
2. **Import Git Repository** → vyber `Slovensky-futbalovy-zvaz/Asset-Management`
3. **Configure Project**:
   - **Project Name**: `inventario-docs`
   - **Framework Preset**: `Next.js` (auto-detect)
   - **Root Directory**: `apps/docs` ← DÔLEŽITÉ
   - **Build Command**: prázdne (z `vercel.json` sa použije custom)
   - **Output Directory**: `.next` (auto)
   - **Install Command**: prázdne (handled v build command)
4. **Environment Variables**: žiadne netreba pre static docs
5. Klik **Deploy**

### Krok 2: Skontroluj prvý deploy

Vercel pridelí preview URL (napr. `inventario-docs-xyz.vercel.app`). Otestuj:

- `/` → Welcome page s "Vitajte v _Inventariu_"
- `/getting-started` → Quick start guide
- `/architecture` → Multi-tenant architektúra
- `/api` → REST API dokumentácia
- `/deployment` → Tento dokument
- `/about` → História a tím

### Krok 3: Skontroluj Pagefind search

Po deploy klikni do search bar-u (Cmd+K) a vyhľadaj napr. "multi-tenant" alebo "EUPL". Mali by sa zobraziť relevantné výsledky.

> ⚠️ Ak search **nefunguje** (žiadne výsledky), znamená to že `postbuild` script (Pagefind) nezbehol. Pozri sa do Vercel build log-ov.

### Krok 4: Pridaj custom doménu

1. Vercel dashboard → projekt `inventario-docs` → **Settings** → **Domains**
2. Klik **Add** → zadaj: `docs.inventario.sportup.sk`
3. Vercel ukáže DNS údaje: CNAME `docs` → `cname.vercel-dns.com`

### Krok 5: DNS na Websupport

1. Login do https://admin.websupport.sk
2. Domény → `sportup.sk` → DNS záznamy
3. Klik **Pridať záznam**:
   - **Typ**: `CNAME`
   - **Názov / Host**: `docs`
   - **Hodnota**: `cname.vercel-dns.com.` (s bodkou na konci)
   - **TTL**: `300` alebo Default
4. Ulož

### Krok 6: Počkaj na propagáciu

```bash
# Kontroluj DNS propagáciu
dig docs.inventario.sportup.sk CNAME +short
# Očakávaný výsledok: cname.vercel-dns.com.

# Po DNS propagácii → SSL Let's Encrypt sa vystaví automaticky (cca 5 min)
curl -sI https://docs.inventario.sportup.sk
# HTTP/2 200 ✓
```

DNS propagácia trvá obvykle **5-30 min** pre Websupport.

### Krok 7: Final verification

```bash
# Homepage
curl -sI https://docs.inventario.sportup.sk

# Hlavné stránky
curl -sI https://docs.inventario.sportup.sk/getting-started
curl -sI https://docs.inventario.sportup.sk/architecture
curl -sI https://docs.inventario.sportup.sk/api
curl -sI https://docs.inventario.sportup.sk/deployment
curl -sI https://docs.inventario.sportup.sk/about

# Search index dostupný
curl -sI https://docs.inventario.sportup.sk/_pagefind/pagefind.js
```

Všetko by malo vrátiť **HTTP/2 200**.

---

## 🔧 Po deploy — revertni "Čoskoro" badge v marketing site

Marketing site má momentálne **`<span>Dokumentácia <span>Čoskoro</span></span>`** namiesto live linkov. Po úspešnom deploy docs site treba revertnúť.

Najjednoduchšie: `git revert` commit ktorý pridal "Čoskoro" badge:

```bash
# Nájdi commit hash
git log --oneline --grep="defer docs.inventario"

# Revertni ho
git revert <hash>

# Push
git push origin main
```

Vercel `inventario-marketing` automaticky redeployne s aktívnymi linkmi na `docs.inventario.sportup.sk`.

---

## 🐛 Troubleshooting

### Problem: "Nextra build fails with metadata export error"

```
You are attempting to export 'metadata' from a component marked with 'use client'
```

**Príčina**: Next.js 16.2+ je nekompatibilný s Nextra v4.6.1 ([issue #5003](https://github.com/shuding/nextra/issues/5003)).

**Riešenie**: Nextra v4.6.1 + Next.js 16.1.x funguje. V `package.json` máme `"next": "~16.1.0"` čo zabezpečuje. Ak by Vercel auto-upgradnul na 16.2+, pin to na `"next": "16.1.0"` (bez `~`).

### Problem: "Module not found: next-mdx-import-source-file" (Turbopack)

**Príčina**: Turbopack alias issue v Next.js 16.2+.

**Riešenie**: Použiť Webpack (default v Next 16.1.x). Žiadny `--turbo` flag v `pnpm dev`.

### Problem: Pagefind search nezobrazuje výsledky

**Príčina**: `postbuild` script nezbehol alebo index sa negeneroval správne.

**Riešenie**:

```bash
cd apps/docs
pnpm build
ls -la public/_pagefind/  # mal by obsahovať pagefind.js + JSON indexy
```

Ak je `public/_pagefind/` prázdny, skontroluj `pagefind --site .next/server/app` command v package.json scripts.

### Problem: Custom doména "Invalid Configuration" vo Vercel

**Príčina**: DNS sa ešte len propaguje, alebo CNAME má chybu.

**Riešenie**:

```bash
# Skontroluj DNS
dig docs.inventario.sportup.sk CNAME +short

# Ak je prázdne → DNS ešte nepropagoval, počkaj
# Ak je niečo iné než cname.vercel-dns.com → oprav CNAME na Websupporte
```

---

## 📊 Architektúra deployu (full picture)

```
Asset-Management repo
├── apps/api/                  → Vercel: asset-management-api
│                                URL: api.inventario.sportup.sk (Q3)
├── apps/docs/                 → Vercel: inventario-docs
│                                URL: docs.inventario.sportup.sk ← NEW
└── docs/marketing-site/       → Vercel: inventario-marketing
                                 URL: inventario.sportup.sk (LIVE)
```

3 Vercel projekty z jedného repa, každý na svojej subdoméne. Všetko cez Websupport DNS pre `sportup.sk`.

---

## ✅ Sukcess kritéria

Deploy je **úspešný** keď:

- [x] `https://docs.inventario.sportup.sk` vráti HTTP/2 200
- [x] Všetky 6 stránok funguje (homepage, getting-started, architecture, api, deployment, about)
- [x] Sidebar nav funguje (kliknutia)
- [x] Search funguje (Cmd+K)
- [x] Dark/light theme toggle funguje
- [x] Mobile responsive (375px viewport)
- [x] SSL A+ na https://www.ssllabs.com/ssltest/
- [x] Lighthouse score > 90 (Performance, Accessibility, SEO)
- [x] OG preview funguje na https://www.opengraph.xyz/

Po splnení → revertnúť "Čoskoro" badge v marketing site (viď vyššie).

🥂 Druhá fľaša Nichta Brut sektu odporúčaná na oslavu!
