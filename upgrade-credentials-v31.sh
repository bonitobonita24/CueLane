#!/bin/bash
# upgrade-credentials-v31.sh
# ────────────────────────────────────────────────────────────────────
# Adds the V31 "🚨 FILL THESE IN BEFORE PHASE 5" overview header block
# to CREDENTIALS.md.
#
# Runs entirely in YOUR terminal — credential values NEVER enter AI context.
# Idempotent: safe to re-run.
# Generated per Scenario 34 (CREDENTIALS.md Format Upgrade — Agent-Proof).
# ────────────────────────────────────────────────────────────────────

set -euo pipefail

FILE="CREDENTIALS.md"
BACKUP="CREDENTIALS.md.pre-v31.bak"

# 1. Sanity checks
if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found in current directory."
  echo "   Run this script from the project root."
  exit 1
fi

# 2. Idempotency — only checks header text, never echoes file contents
if grep -q "^## 🚨 FILL THESE IN BEFORE PHASE 5" "$FILE"; then
  echo "✅ V31 header already present in $FILE — nothing to do."
  exit 0
fi

# 3. Confirm with user before modifying
echo "About to upgrade $FILE to V31 format:"
echo "  1. Backup    → $BACKUP"
echo "  2. Insert    → '## 🚨 FILL THESE IN BEFORE PHASE 5' block"
echo "                  before the first '## ' section in the file"
echo ""
read -r -p "Proceed? [y/N] " REPLY
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. No changes made."
  exit 0
fi

# 4. Backup
cp "$FILE" "$BACKUP"
echo "✓ Backed up: $BACKUP"

# 5. Build the V31 header block in a temp file (template text only — no values)
HEADER_TMP=$(mktemp)
cat > "$HEADER_TMP" <<'HEADER_EOF'
## 🚨 FILL THESE IN BEFORE PHASE 5

The sections marked with `⏳ FILL LATER` below contain blank placeholders.
Bootstrap did NOT collect these — AI cannot generate them because they come
from external services you own. Fill them in before Phase 5 validation runs,
or Phase 5 will fail at the credential check.

Required-before-Phase-5 sections:
- 🐙 GitHub (username + PAT)
- 🐳 Docker Hub (username + token)       [if docker.publish: true]
- 📧 SMTP / Resend (host + credentials)  [always required]
- 🦎 Komodo (UI URL)                     [if deploying via Komodo]
- 💳 Xendit (API keys)                   [if payment.gateway: xendit]
- 🛡️ Cloudflare Turnstile (prod keys)    [always required for production]
- 🔑 Third-Party API Keys                [project-specific]

Optional until needed:
- Komodo webhook URLs (only if using legacy webhook-triggered deploys)

---

HEADER_EOF

# 6. Verify file has at least one "## " section header to insert before
if ! grep -q "^## " "$FILE"; then
  echo "❌ $FILE has no '## ' section headers — nothing to insert before."
  echo "   Aborting. Backup preserved at $BACKUP."
  rm -f "$HEADER_TMP"
  exit 1
fi

# 7. Insert the V31 header block before the FIRST line starting with "## ".
OUTPUT_TMP=$(mktemp)
awk -v header_file="$HEADER_TMP" '
  /^## / && !inserted {
    while ((getline line < header_file) > 0) print line
    close(header_file)
    inserted = 1
  }
  { print }
' "$FILE" > "$OUTPUT_TMP"

# 8. Atomic replace
mv "$OUTPUT_TMP" "$FILE"
rm -f "$HEADER_TMP"

echo "✓ V31 header inserted into $FILE"
echo ""

# 9. Show ONLY the added lines (unified=0 hides context lines = no credential leak)
echo "─── Lines added (no context shown — values never echoed) ───"
diff --unified=0 "$BACKUP" "$FILE" | grep -E "^\+" | grep -v "^+++" | head -30
echo "─────────────────────────────────────────────────────────────"
echo ""

# 10. Verify final state
NEW_COUNT=$(grep -c "^## 🚨 FILL THESE IN BEFORE PHASE 5" "$FILE" || true)
if [ "$NEW_COUNT" -eq 1 ]; then
  echo "✅ Verified: V31 header is now present exactly once."
else
  echo "⚠ Unexpected: V31 header count = $NEW_COUNT (should be 1)."
  echo "   Restore the backup if anything looks wrong:"
  echo "     mv $BACKUP $FILE"
  exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Visually inspect CREDENTIALS.md in your editor."
echo "  2. If everything looks correct: rm $BACKUP"
echo "  3. If anything is wrong: mv $BACKUP $FILE  (restores original)"
echo ""
echo "Then tell Claude Code: 'CREDENTIALS.md V31 header added, Phase A done.'"
