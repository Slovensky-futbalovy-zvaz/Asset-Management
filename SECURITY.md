# Bezpečnostná politika

## Hlásenie zraniteľností

Bezpečnosť projektu SFZ Asset Management berieme vážne. Ďakujeme, že nám pomáhate zodpovedným hlásením bezpečnostných problémov.

### ⚠️ Nehláste bezpečnostné chyby cez verejné GitHub issues

Verejné issues sú viditeľné pre všetkých a útočníci by mohli zraniteľnosť zneužiť skôr, než ju opravíme.

### Ako nahlásiť

Použite jeden z týchto kanálov:

1. **GitHub Security Advisories** (preferované)
   - Choďte na záložku **Security** tohto repa → **Report a vulnerability**
   - Toto je súkromný kanál priamo medzi vami a údržbárami repa

2. **E-mail:** `security@futbalsfz.sk` _(doplniť reálnu adresu)_
   - Predmet: `[SECURITY] SFZ Asset Management - krátky popis`
   - Voliteľne PGP šifrované – kľúč na vyžiadanie

### Čo zahrnúť do hlásenia

Pre čo najrýchlejšie vyriešenie nám prosím poskytnite:

- **Popis** zraniteľnosti a potenciálny dopad
- **Kroky na reprodukciu** (proof of concept ak je možný)
- **Postihnuté verzie** alebo komponenty
- **Návrh riešenia**, ak ho máte
- **Vaše kontaktné údaje** pre prípadné doplňujúce otázky

### Čo môžete očakávať

| Časový rámec | Akcia                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Do 48 hodín  | Potvrdenie prijatia hlásenia                                                      |
| Do 7 dní     | Prvotné posúdenie a klasifikácia (severity)                                       |
| Do 30 dní    | Plán opravy alebo finálne vyjadrenie                                              |
| Po oprave    | Verejné zverejnenie (CVE ak relevantné) a poďakovanie reportérovi (ak si to želá) |

### Rozsah

**V rozsahu (in-scope):**

- Kód v tomto repe (`apps/`, `packages/`, `infra/`)
- Verejne dostupné inštancie projektu (po nasadení)
- Závislosti, ak ich zraniteľnosť priamo ovplyvňuje náš projekt

**Mimo rozsahu (out-of-scope):**

- Sociálne inžinierstvo voči zamestnancom SFZ
- Fyzický prístup k zariadeniam
- DDoS útoky
- Zraniteľnosti v third-party službách (hláste priamo dodávateľovi)
- Spam alebo obsahové problémy bez bezpečnostného dopadu

## Bezpečnostné postupy v projekte

- Závislosti sú monitorované cez Dependabot (GitHub) a pravidelne aktualizované.
- Pre kritické závislosti je nastavený automatický PR pri bezpečnostných záplatách.
- Pred releaseom prebieha `pnpm audit` a `npm audit` ako súčasť CI.
- Bezpečnostné záplaty sa releasujú prioritne, mimo bežného release cyklu.

## Poďakovanie (Hall of Fame)

Po vyriešení zraniteľnosti radi uvedieme reportéra (ak si to želá) v zozname nižšie.

_Zatiaľ žiadne nahlásenia._

---

Ďakujeme, že nám pomáhate udržiavať SFZ Asset Management v bezpečí. 🛡️
