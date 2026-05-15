#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
# SPDX-License-Identifier: EUPL-1.2
#
# rename-marketing-pages.sh
# One-shot migration: odstráni technický `_` prefix z marketing site stránok
# a zjednoduší Vercel routing (rieši infinite redirect loop bug).
#
# Pred:                          Po:
#   _home.html         →           index.html       (production homepage)
#   _use-cases.html    →           use-cases.html
#   _pricing.html      →           pricing.html
#   _technology.html   →           technology.html
#   _about.html        →           about.html
#   index.html (redirect) →        (deleted)
#   demo.html          →           demo.html        (unchanged)
#
# Po behu sa zjednoduší vercel.json — nepotrebuje rewrites (Vercel
# default behavior + cleanUrls: true vyrieši všetko).
#
# Usage:  bash scripts/rename-marketing-pages.sh
#         (z root repa)

set -euo pipefail

MARKETING_DIR="docs/marketing-site"

if [ ! -d "$MARKETING_DIR" ]; then
    echo "❌ Error: $MARKETING_DIR not found. Run from repo root."
    exit 1
fi

# Detekuj sed flavor (macOS BSD vs GNU)
if sed --version 2>/dev/null | grep -q GNU; then
    SED_INPLACE=(-i)
else
    SED_INPLACE=(-i '')
fi

echo "📦 Inventario marketing site URL simplification"
echo "================================================"
echo ""

echo "📋 Step 1: Remove fallback index.html (will be replaced by _home.html)"
if [ -f "$MARKETING_DIR/index.html" ]; then
    SIZE=$(wc -c < "$MARKETING_DIR/index.html" | tr -d ' ')
    if [ "$SIZE" -lt "2000" ]; then
        rm "$MARKETING_DIR/index.html"
        echo "   ✓ Removed fallback index.html ($SIZE bytes)"
    else
        echo "   ⚠️  index.html is $SIZE bytes — looks like real content, skipping"
        echo "      (this is OK if you already migrated — script will overwrite below)"
    fi
fi

echo ""
echo "📋 Step 2: Rename pages (remove _ prefix)"
declare -a renames=(
    "_home.html:index.html"
    "_use-cases.html:use-cases.html"
    "_pricing.html:pricing.html"
    "_technology.html:technology.html"
    "_about.html:about.html"
)

for rename in "${renames[@]}"; do
    src="${rename%%:*}"
    dst="${rename##*:}"
    if [ -f "$MARKETING_DIR/$src" ]; then
        mv "$MARKETING_DIR/$src" "$MARKETING_DIR/$dst"
        echo "   ✓ $src → $dst"
    else
        echo "   ⏭  $src not found (already renamed?)"
    fi
done

echo ""
echo "📋 Step 3: Update internal links in HTML + JS files"
TARGETS=(
    "$MARKETING_DIR/index.html"
    "$MARKETING_DIR/use-cases.html"
    "$MARKETING_DIR/pricing.html"
    "$MARKETING_DIR/technology.html"
    "$MARKETING_DIR/about.html"
    "$MARKETING_DIR/demo.html"
    "$MARKETING_DIR/assets/shared.js"
)

for file in "${TARGETS[@]}"; do
    if [ -f "$file" ]; then
        # _home.html → index.html
        sed "${SED_INPLACE[@]}" -e 's|_home\.html|index.html|g' "$file"
        # Other _*.html → *.html (preserve hash anchors like #enterprise)
        sed "${SED_INPLACE[@]}" -e 's|_use-cases\.html|use-cases.html|g' "$file"
        sed "${SED_INPLACE[@]}" -e 's|_pricing\.html|pricing.html|g' "$file"
        sed "${SED_INPLACE[@]}" -e 's|_technology\.html|technology.html|g' "$file"
        sed "${SED_INPLACE[@]}" -e 's|_about\.html|about.html|g' "$file"
        echo "   ✓ Updated $(basename $file)"
    fi
done

echo ""
echo "📋 Step 4: Special fix for demo.html JS (home → index, others ostávajú)"
# demo.html JavaScript: `_${page}.html` template literal needs special handling
# Change to: page === 'home' ? 'index.html' : `${page}.html`
if [ -f "$MARKETING_DIR/demo.html" ]; then
    # Replace the JS pattern
    perl -i -pe 's|pageFrame\.src\s*=\s*`_\$\{page\}\.html`;|pageFrame.src = page === "home" ? "index.html" : `${page}.html`;|g' "$MARKETING_DIR/demo.html"
    echo "   ✓ Updated demo.html iframe src logic"
fi

echo ""
echo "📋 Step 5: Simplify vercel.json (no more rewrites needed)"
cat > "$MARKETING_DIR/vercel.json" <<'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*).html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
EOF
echo "   ✓ vercel.json simplified (no rewrites, just cleanUrls + headers)"

echo ""
echo "📋 Step 6: Final state of marketing-site/"
ls -la "$MARKETING_DIR"/*.html 2>/dev/null | awk '{print "   " $9, "(" $5 " bytes)"}' || true

echo ""
echo "✅ Migration complete!"
echo ""
echo "URL mapping after deploy:"
echo "   inventario.sportup.sk/             → index.html"
echo "   inventario.sportup.sk/use-cases    → use-cases.html  (via cleanUrls)"
echo "   inventario.sportup.sk/pricing      → pricing.html"
echo "   inventario.sportup.sk/technology   → technology.html"
echo "   inventario.sportup.sk/about        → about.html"
echo "   inventario.sportup.sk/demo         → demo.html"
echo ""
echo "Next steps:"
echo "   1. Review changes:  git diff $MARKETING_DIR/"
echo "   2. Test locally:    open $MARKETING_DIR/index.html"
echo "   3. Commit + push:   GitHub Desktop"
echo "   4. Vercel will auto-redeploy with clean URLs"
