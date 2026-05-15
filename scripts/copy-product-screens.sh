#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
# SPDX-License-Identifier: EUPL-1.2
#
# copy-product-screens.sh
#
# Skopíruje 6 product mockup HTML súborov z docs/design/screens/
# do docs/marketing-site/product-screens/ pre verejné publikovanie.
#
# Mockupy v docs/design/screens/ slúžia ako interný design exploration.
# Po pivote na public marketing site potrebujeme tie isté súbory aj
# v deploy bundli marketing site.
#
# Po spustení tohto skriptu, marketing-site/product-screens/ obsahuje
# 6 self-contained HTML súborov ktoré sa renderujú v <iframe> z
# interactive-demo.html (marketing-styled wrapper s tenant + viewport switcherom).
#
# Použitie:
#   bash scripts/copy-product-screens.sh
#
# Volaj z root repa.

set -euo pipefail

SRC="docs/design/screens"
DEST="docs/marketing-site/product-screens"

if [[ ! -d "$SRC" ]]; then
    echo "❌ Source directory not found: $SRC"
    echo "   Run this from the repo root."
    exit 1
fi

mkdir -p "$DEST"

# Skopíruj všetkých 6 underscore-prefixed súborov (skutočné stránky)
for page in _login-page.html _dashboard-page.html _assets-list-page.html _asset-detail-page.html _loan-request-page.html _my-loans-page.html; do
    if [[ -f "$SRC/$page" ]]; then
        cp "$SRC/$page" "$DEST/$page"
        echo "✓ Copied $page"
    else
        echo "⚠ Missing: $SRC/$page"
    fi
done

echo ""
echo "✅ Done. 6 product screens copied to $DEST/"
echo "   Marketing wrapper: docs/marketing-site/interactive-demo.html"
