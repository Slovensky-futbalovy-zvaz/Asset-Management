#!/usr/bin/env bash
# ============================================================================
# Local dev: get an Entra ID access token via OAuth 2.0 device code flow
# and exercise the protected API endpoints end-to-end.
#
# Usage:
#   1. Ensure `pnpm dev` is running in another terminal (apps/api).
#   2. Add this line to .env.local (with the CLI app's client ID from Azure):
#        ENTRA_CLI_CLIENT_ID=<guid>
#      (This is the CLI/test app registration, NOT the API one.)
#   3. Run from anywhere:  bash apps/api/scripts/dev-auth-test.sh
#
# Prereqs: jq, curl, a browser to complete the device login flow.
#
# Output is redacted: real _id / email never appear in full.
# ============================================================================

set -u

# ----- CONFIG (all from .env.local) -----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.local"
API_BASE="${API_BASE:-http://localhost:3000}"

# ----- VALIDATE PREREQS -----
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Cannot find $ENV_FILE"
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq not installed. Run: brew install jq"
  exit 1
fi

# ----- READ ENV VARS -----
TENANT_ID=$(grep -E '^ENTRA_TENANT_ID=' "$ENV_FILE" | cut -d= -f2-)
API_CLIENT_ID=$(grep -E '^ENTRA_API_CLIENT_ID=' "$ENV_FILE" | cut -d= -f2-)
CLI_CLIENT_ID=$(grep -E '^ENTRA_CLI_CLIENT_ID=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$TENANT_ID" ] || [ -z "$API_CLIENT_ID" ]; then
  echo "❌ ENTRA_TENANT_ID or ENTRA_API_CLIENT_ID missing in $ENV_FILE"
  exit 1
fi
if [ -z "$CLI_CLIENT_ID" ]; then
  echo "❌ ENTRA_CLI_CLIENT_ID missing in $ENV_FILE"
  echo ""
  echo "   Add this line (with your CLI app's Application (client) ID from Azure):"
  echo "     ENTRA_CLI_CLIENT_ID=<guid>"
  echo ""
  echo "   The CLI app is the public-client app registration you created for testing,"
  echo "   separate from the API app registration."
  exit 1
fi

echo "Tenant:  ${TENANT_ID:0:8}…"
echo "API:     ${API_CLIENT_ID:0:8}…"
echo "CLI:     ${CLI_CLIENT_ID:0:8}…"
echo "API URL: $API_BASE"

# ----- 1. DEVICE CODE -----
echo ""
echo "📞 Requesting device code…"
DEVICECODE_RESPONSE=$(curl -s -X POST \
  "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode" \
  -d "client_id=${CLI_CLIENT_ID}" \
  -d "scope=api://${API_CLIENT_ID}/access_as_user openid profile email")

echo "$DEVICECODE_RESPONSE" | jq

USER_CODE=$(echo "$DEVICECODE_RESPONSE" | jq -r '.user_code // empty')
VERIFICATION_URI=$(echo "$DEVICECODE_RESPONSE" | jq -r '.verification_uri // empty')
DEVICE_CODE=$(echo "$DEVICECODE_RESPONSE" | jq -r '.device_code // empty')

if [ -z "$DEVICE_CODE" ]; then
  echo ""
  echo "❌ No device_code in response — check error fields above."
  echo "   Common causes:"
  echo "     - CLI app: 'Allow public client flows' is OFF (Azure → CLI app → Authentication)"
  echo "     - CLI app: missing API permission for 'access_as_user' on the API app"
  echo "     - Wrong CLI_CLIENT_ID or ENTRA_TENANT_ID"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "🔐 SIGN IN STEP"
echo ""
echo "   1. Open in browser: $VERIFICATION_URI"
echo "   2. Enter code:      $USER_CODE"
echo "   3. Sign in with your SFZ Entra account"
echo "   4. Accept the consent prompt"
echo "════════════════════════════════════════"
echo ""
echo "The script will now poll Microsoft for the token every 5 seconds."
echo "You have up to 15 minutes to complete sign-in."
echo ""

# ----- 2. POLL FOR TOKEN -----
#
# Device code flow requires polling the token endpoint at the interval
# specified by Microsoft (typically 5 seconds). We get one of three results:
#   - access_token → success
#   - error: authorization_pending → keep polling
#   - error: anything else → stop and report

MAX_POLLS=180  # 180 polls × 5s = 15 minutes total
POLL_COUNT=0
TOKEN=""

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  POLL_COUNT=$((POLL_COUNT + 1))

  TOKEN_RESPONSE=$(curl -s -X POST \
    "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
    -d "client_id=${CLI_CLIENT_ID}" \
    -d "device_code=${DEVICE_CODE}")

  TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
  if [ -n "$TOKEN" ]; then
    # Success! Bail out of the polling loop.
    echo "✓ Token received after ${POLL_COUNT} poll(s)."
    break
  fi

  ERROR=$(echo "$TOKEN_RESPONSE" | jq -r '.error // empty')

  case "$ERROR" in
    authorization_pending)
      # User hasn't completed sign-in yet — keep waiting.
      # Use printf so we can overwrite the same line with the dot counter.
      printf "\r⏳ Waiting for sign-in\u2026 (poll %d/%d)   " "$POLL_COUNT" "$MAX_POLLS"
      sleep 5
      ;;
    slow_down)
      # Microsoft asks us to slow down — add 5s to interval.
      printf "\r🐢 Slowing down\u2026 (poll %d/%d)   " "$POLL_COUNT" "$MAX_POLLS"
      sleep 10
      ;;
    expired_token)
      echo ""
      echo "❌ Device code expired (15 min limit). Re-run the script to start over."
      exit 1
      ;;
    "")
      # No error field but also no token — shouldn't happen, but be defensive.
      echo ""
      echo "❌ Unexpected token response:"
      echo "$TOKEN_RESPONSE" | jq
      exit 1
      ;;
    *)
      # Any other error — print full response and stop.
      echo ""
      echo "❌ Token endpoint returned error: $ERROR"
      echo "$TOKEN_RESPONSE" | jq
      exit 1
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  echo ""
  echo "❌ Timed out after $MAX_POLLS polls (~15 min). Re-run if you want to retry."
  exit 1
fi

echo ""
echo "🎟️  Access token acquired."

# ----- 3. PEEK INSIDE TOKEN -----
echo ""
echo "📋 Token claims (redacted):"
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{
  iss,
  aud,
  ver,
  scp,
  has_oid: (.oid != null),
  has_email: ((.email // .preferred_username) != null),
  name_first_char: ((.name // "?") | .[0:1] + "…"),
  exp_utc: (.exp | strftime("%Y-%m-%d %H:%M:%S UTC"))
}'

# ----- 4. CALL API: /v1/me (FIRST CALL = JIT PROVISIONING) -----
echo ""
echo "🚀 GET /v1/me (first call — should JIT-provision)…"
ME_BODY=$(curl -s "$API_BASE/v1/me" -H "Authorization: Bearer ${TOKEN}")
echo "$ME_BODY" | jq '. + {
  _id: ((._id // "") | .[0:4] + "…"),
  email: ((.email // "") | .[0:4] + "…")
}'

# ----- 5. CALL API: /v1/assets -----
echo ""
echo "🚀 GET /v1/assets…"
curl -s -w "\nHTTP %{http_code}\n" "$API_BASE/v1/assets" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.' 2>/dev/null || true

# ----- 6. IDEMPOTENCY CHECK -----
echo ""
echo "🔁 GET /v1/me again (idempotency check)…"
ME_BODY_2=$(curl -s "$API_BASE/v1/me" -H "Authorization: Bearer ${TOKEN}")
ID_1=$(echo "$ME_BODY" | jq -r '._id // empty')
ID_2=$(echo "$ME_BODY_2" | jq -r '._id // empty')

if [ -n "$ID_1" ] && [ "$ID_1" = "$ID_2" ]; then
  echo "✅ Same _id (${ID_1:0:4}…) returned on both calls — JIT is idempotent."
else
  echo "❌ _id mismatch! Call 1: ${ID_1:-<none>} / Call 2: ${ID_2:-<none>}"
fi

echo ""
echo "🎉 Done."
