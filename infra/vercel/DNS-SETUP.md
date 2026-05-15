<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# DNS setup pre `inventario.sportup.sk`

> **Cieľ:** Nasmerovať subdoménu `inventario.sportup.sk` na Vercel hosting.
> **Predpokladaná dĺžka:** 5–10 minút setup + 5–60 minút DNS propagácia
> **Status:** Pripravený, závisí na úspešnom Vercel deploy (viď `DEPLOYMENT.md`)

---

## 📋 Pred štartom — predpoklady

- [x] **Vercel deploy hotový** (preview URL funguje) — viď `infra/vercel/DEPLOYMENT.md`
- [x] **Doména `inventario.sportup.sk` pridaná** vo Vercel projekte (Settings → Domains)
- [x] Vercel ti ukázal **DNS záznam ktorý treba pridať** (typicky CNAME na `cname.vercel-dns.com`)
- [x] **Prístup k DNS panelu** doména `sportup.sk`

---

## 🗺️ Kde sa nachádza DNS panel pre `sportup.sk`?

DNS pre `sportup.sk` doménu spravuje **registrátor alebo DNS provider**. Možné scenáre:

| Provider       | Pravdepodobnosť                    | Login URL                           |
| -------------- | ---------------------------------- | ----------------------------------- |
| **Cloudflare** | Vysoká (moderný stack)             | https://dash.cloudflare.com         |
| **Webglobe**   | Stredná (SK populárny registrátor) | https://www.webglobe.sk/profil      |
| **Websupport** | Stredná (SK populárny registrátor) | https://admin.websupport.sk         |
| **GoDaddy**    | Nízka                              | https://dcc.godaddy.com             |
| **Namecheap**  | Nízka                              | https://www.namecheap.com/myaccount |

> **Ak nevieš kde to máš:** Choď na https://www.whois.com/whois/sportup.sk a pozri sa na "Registrar" pole — povie ti kto doménu spravuje.

---

## 🎯 Krok-po-kroku setup

### Krok 1: Vercel — získaj DNS údaje

1. Vo Vercel dashboard → Project: `inventario-marketing` → Settings → Domains
2. Pri doméne `inventario.sportup.sk` Vercel ukáže buď:

   **Variant A (odporúčaný — CNAME):**

   ```
   Type: CNAME
   Name: inventario
   Value: cname.vercel-dns.com
   TTL: 300 (alebo Auto)
   ```

   **Variant B (apex doména alebo ak CNAME nepodporovaný):**

   ```
   Type: A
   Name: inventario
   Value: 76.76.21.21
   TTL: 300 (alebo Auto)
   ```

> 💡 **CNAME je preferovaný**, lebo ak Vercel zmení IP, tvoja konfigurácia ostane platná.

### Krok 2: Pridaj DNS záznam — Cloudflare

Ak používaš **Cloudflare**:

1. https://dash.cloudflare.com → vyber `sportup.sk` doménu
2. Sidebar → **DNS** → **Records**
3. **Add record**:
   - **Type**: `CNAME`
   - **Name**: `inventario` (Cloudflare automaticky pridá `.sportup.sk`)
   - **Target**: `cname.vercel-dns.com`
   - **Proxy status**: **DNS only** (sivé oblak ikona) — **NIE** Proxied (oranžová)
     > Vercel má vlastný CDN, Cloudflare proxy by spôsobil double-CDN problém
   - **TTL**: Auto
4. **Save**

### Krok 3: Pridaj DNS záznam — Webglobe / Websupport

Ak používaš **Webglobe** alebo **Websupport** (SK providers):

1. Login do admin panelu
2. Doména `sportup.sk` → **Správa DNS** alebo **DNS záznamy**
3. **Pridaj nový záznam**:
   - **Typ**: `CNAME`
   - **Názov / Subdoména**: `inventario`
   - **Hodnota / Cieľ**: `cname.vercel-dns.com.` (s bodkou na konci!)
   - **TTL**: `300` alebo default
4. **Uložiť**

### Krok 4: Pridaj DNS záznam — GoDaddy / Namecheap / iné

Postup je vždy podobný:

1. Login do registrar-u
2. Nájdi DNS management pre `sportup.sk`
3. Pridaj **CNAME záznam**:
   - **Host / Name**: `inventario`
   - **Points to / Value**: `cname.vercel-dns.com`
   - **TTL**: nízky (300 sek alebo Auto)

---

## ⏳ DNS propagácia

Po pridaní záznamu DNS propagácia trvá **5 minút až 1 hodinu** (zriedkavo až 24h).

### Overenie propagácie

**Cez terminál (najrýchlejšie):**

```bash
# CNAME lookup
dig inventario.sportup.sk CNAME +short
# Expected output: cname.vercel-dns.com.

# Alebo cez nslookup
nslookup inventario.sportup.sk
# Expected: cname.vercel-dns.com → IP Vercel-u
```

**Cez online tool:**

- https://www.whatsmydns.net/#CNAME/inventario.sportup.sk
- https://dnschecker.org/#CNAME/inventario.sportup.sk

Tieto tools ti ukážu DNS resolution z rôznych miest sveta — uvidíš ako propagácia postupuje.

### Cache buster

Ak ti `dig` na lokálnom stroji ešte ukazuje stari záznam, môžeš:

```bash
# Mac
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Alebo skús cez iný DNS server
dig @1.1.1.1 inventario.sportup.sk CNAME +short
dig @8.8.8.8 inventario.sportup.sk CNAME +short
```

---

## 🔒 SSL/TLS certifikát

Po úspešnej DNS propagácii Vercel **automaticky vygeneruje SSL certifikát** cez Let's Encrypt:

1. Vo Vercel dashboard → Domains → `inventario.sportup.sk`
2. Status by sa mal zmeniť z **"Pending verification"** → **"Valid configuration"**
3. SSL certifikát sa vystaví do **5 minút** po úspešnej verifikácii
4. Po vystavení môžeš otvoriť `https://inventario.sportup.sk` v prehliadači

---

## 🧪 Finálna verifikácia

Po SSL setup-e otestuj:

### 1. HTTPS funguje

```bash
curl -I https://inventario.sportup.sk
# HTTP/2 200 ← OK
```

### 2. Stránka loaduje správne

- Otvor https://inventario.sportup.sk
- Skontroluj že load-uje homepage (Inventario hero)
- Naviguj cez menu

### 3. Stránky cez clean URLs

- https://inventario.sportup.sk/ → homepage
- https://inventario.sportup.sk/use-cases
- https://inventario.sportup.sk/pricing
- https://inventario.sportup.sk/technology
- https://inventario.sportup.sk/about

### 4. SSL certifikát info

```bash
echo | openssl s_client -connect inventario.sportup.sk:443 2>/dev/null | openssl x509 -noout -issuer -dates
# Issuer: Let's Encrypt
# notBefore + notAfter: aktuálny dátum + 90 dní
```

### 5. Security headers

```bash
curl -I https://inventario.sportup.sk
# Mali by si vidieť:
# strict-transport-security: max-age=63072000; includeSubDomains; preload
# x-content-type-options: nosniff
# x-frame-options: SAMEORIGIN
# referrer-policy: strict-origin-when-cross-origin
```

### 6. SSL test online

- https://www.ssllabs.com/ssltest/analyze.html?d=inventario.sportup.sk
- Target: **A or A+** rating

---

## 🌍 Subdomény pre budúce projekty

Pre budúce subdomény pod `sportup.sk` postupuj rovnako:

| Subdoména                       | Účel                  | Plánovaná      |
| ------------------------------- | --------------------- | -------------- |
| `inventario.sportup.sk`         | Marketing site (toto) | TERAZ          |
| `app.inventario.sportup.sk`     | Aplikácia (Next.js)   | v0.4 (Q2 2026) |
| `api.inventario.sportup.sk`     | REST API              | v0.4 (Q2 2026) |
| `docs.inventario.sportup.sk`    | Dokumentácia          | v0.5 (Q3 2026) |
| `staging.inventario.sportup.sk` | Staging environment   | v0.5 (Q3 2026) |

> **Note**: `app.inventario.sportup.sk` znamená že potrebujeme **wildcard SSL** alebo per-doména SSL.
> Cloudflare automaticky vystavuje pre `*.sportup.sk` ak máš Cloudflare jako DNS provider.
> Vercel vystavuje per-doména SSL automaticky.

---

## 🆘 Troubleshooting

### "Invalid Configuration" vo Vercel

**Príčina**: DNS sa ešte nepropagoval, alebo CNAME ukazuje na zlú hodnotu.

**Riešenie**:

1. Overiť cez `dig inventario.sportup.sk CNAME +short`
2. Ak vracia inú hodnotu než `cname.vercel-dns.com.`, oprav DNS záznam
3. Ak vracia správnu hodnotu, počkaj 5–15 min na refresh vo Vercel
4. Cez Vercel UI: Domain → Refresh

### Otvorenie URL ukazuje "Not Found"

**Príčina**: Browser cache alebo DNS cache.

**Riešenie**:

1. Hard reload: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
2. Incognito window
3. Vyčisti DNS cache (viď vyššie)

### SSL certifikát "Pending"

**Príčina**: Vercel skúša vystaviť certifikát, ale DNS ešte nie je správne nastavený.

**Riešenie**: Počkaj 10–15 min, alebo skús cez Vercel UI re-verify.

### Cloudflare proxy bug

**Príčina**: Ak je v Cloudflare záznam **Proxied** (oranžové oblako), Vercel nemôže vystaviť SSL.

**Riešenie**: Zmeň na **DNS only** (sivé oblako).

---

## 📚 Resources

- Vercel custom domains: https://vercel.com/docs/projects/domains
- DNS propagation checker: https://www.whatsmydns.net
- SSL test: https://www.ssllabs.com/ssltest/
- Security headers test: https://securityheaders.com

---

**Last updated:** 15. máj 2026
