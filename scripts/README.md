<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: CC-BY-4.0
-->

# `scripts/` — Development helper scripts

One-shot bash skripty pre rôzne maintenance úlohy v repe Inventario.

## Konvencie

- **Idempotentné**: spustenie 2× za sebou musí byť bezpečné (žiadny `rm -rf` bez `if` check-u)
- **Verbose**: každý skript hovorí čo robí (`echo "✓ ..."`) — žiadne tiché operácie
- **Cross-platform**: macOS BSD sed aj GNU sed (Linux/CI)
- **From repo root**: skripty sa spúšťajú z root repa (`bash scripts/<name>.sh`)
- **EUPL-1.2**: licenčný header na začiatku každého skriptu

## Dostupné skripty

| Skript                                                   | Účel                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`rename-marketing-pages.sh`](rename-marketing-pages.sh) | Migrácia: odstránenie `_` prefix-u z marketing site stránok (`_home.html` → `index.html`, atď.) + zjednodušenie `vercel.json` |

## Spustenie

```bash
# Z root repa:
bash scripts/<name>.sh

# Alebo executable:
chmod +x scripts/<name>.sh
./scripts/<name>.sh
```
