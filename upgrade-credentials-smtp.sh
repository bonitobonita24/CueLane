#!/bin/bash
# upgrade-credentials-smtp.sh
# ────────────────────────────────────────────────────────────────────
# Replaces the "## 📧 Resend API Key" section in CREDENTIALS.md with
# the V31 "## 📧 SMTP" section (6 fields: Host, Port, Username, Password,
# From address, From name).
#
# Tailored for CueLane: generic SMTP relay, same account staging + prod.
#
# Runs entirely in YOUR terminal — credential values NEVER enter AI context.
# Idempotent: safe to re-run.
# Generated per Scenario 34 (CREDENTIALS.md Format Upgrade — Agent-Proof).
# ────────────────────────────────────────────────────────────────────

set -euo pipefail

FILE="CREDENTIALS.md"
BACKUP="CREDENTIALS.md.pre-smtp.bak"

# 1. Sanity check
if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found in current directory."
  echo "   Run this script from the project root."
  exit 1
fi

# 2. Idempotency — only checks header text, never echoes file contents
if grep -q "^## 📧 SMTP (Email" "$FILE"; then
  echo "✅ SMTP section already present in $FILE — nothing to do."
  exit 0
fi

# 3. Verify the Resend section exists to replace
if ! grep -q "^## 📧 Resend API Key" "$FILE"; then
  echo "❌ Could not find '## 📧 Resend API Key' section in $FILE."
  echo "   Either the section was already removed or has a different header."
  echo "   No changes made."
  exit 1
fi

# 4. Confirm with user before modifying
echo "About to swap email section in $FILE:"
echo "  1. Backup       → $BACKUP"
echo "  2. Find         → '## 📧 Resend API Key' section"
echo "  3. Replace with → '## 📧 SMTP (Email ...)' V31 section (6 fields)"
echo ""
read -r -p "Proceed? [y/N] " REPLY
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. No changes made."
  exit 0
fi

# 5. Backup
cp "$FILE" "$BACKUP"
echo "✓ Backed up: $BACKUP"

# 6. Write the new SMTP section to a temp file (template text only — no values)
SMTP_TMP=$(mktemp)
cat > "$SMTP_TMP" <<'SMTP_EOF'
## 📧 SMTP (Email — verification, password reset, OTP, transactional)  ⏳ FILL LATER

Generic SMTP relay. Same account used for staging + prod (per DECISIONS_LOG.md
2026-05-17 entry: "Email provider: SMTP (was Resend)").

| Field        | Value                                                    |
|--------------|----------------------------------------------------------|
| SMTP Host    | ⏳ (your SMTP server hostname)                           |
| SMTP Port    | ⏳ (587 for TLS / 465 for SSL)                           |
| Username     | ⏳ (your SMTP login)                                     |
| Password     | ⏳ (your SMTP password)                                  |
| From address | ⏳ (e.g. noreply@cuelane.powerbyte.app)                  |
| From name    | ⏳ (e.g. "CueLane")                                      |

For dev: MailHog runs locally in Docker (no real SMTP needed) — SMTP fields above
are only required for staging/prod. Dev uses MailHog on port 41711 (set in .env.dev).

After filling: run `bash scripts/sync-credentials-to-env.sh` to propagate values
into .env.staging and .env.prod. The sync script greps the table rows by field
name — do NOT change the leading `| SMTP Host |`, `| Username |`, etc. column text.

---
SMTP_EOF

# 7. Perform the swap using awk:
#    - When we hit "## 📧 Resend API Key", flush the new SMTP section, then skip
#      lines until we hit the next "---" (the Resend section terminator).
#    - Skip that "---" too (the new section already ends with its own "---").
#    - Resume printing normally.
#    - Safety: if we hit another "## " header before "---", bail out (malformed file).
OUTPUT_TMP=$(mktemp)
awk -v smtp_file="$SMTP_TMP" '
  /^## 📧 Resend API Key/ {
    while ((getline line < smtp_file) > 0) print line
    close(smtp_file)
    skipping = 1
    next
  }
  skipping && /^## / {
    # Hit a new section header before "---" — malformed Resend section
    print "ERROR_MALFORMED_SECTION" > "/dev/stderr"
    exit 2
  }
  skipping && /^---$/ {
    skipping = 0
    next
  }
  !skipping { print }
' "$FILE" > "$OUTPUT_TMP" || {
  echo "❌ awk swap failed (malformed Resend section in $FILE)."
  echo "   Backup preserved at $BACKUP. No changes applied."
  rm -f "$SMTP_TMP" "$OUTPUT_TMP"
  exit 1
}

# 8. Atomic replace
mv "$OUTPUT_TMP" "$FILE"
rm -f "$SMTP_TMP"

echo "✓ SMTP section inserted into $FILE"
echo ""

# 9. Show ONLY the added lines (unified=0 hides context = no credential leak)
echo "─── Lines added (no context shown — credential values never echoed) ───"
diff --unified=0 "$BACKUP" "$FILE" | grep -E "^\+" | grep -v "^+++" | head -25
echo "──────────────────────────────────────────────────────────────────────"
echo ""

# 10. Verify final state
RESEND_LEFT=$(grep -c "^## 📧 Resend" "$FILE" || true)
SMTP_COUNT=$(grep -c "^## 📧 SMTP (Email" "$FILE" || true)

if [ "$SMTP_COUNT" -eq 1 ] && [ "$RESEND_LEFT" -eq 0 ]; then
  echo "✅ Verified: SMTP section present (1), Resend section removed (0)."
else
  echo "⚠ Unexpected: SMTP=$SMTP_COUNT (want 1), Resend=$RESEND_LEFT (want 0)."
  echo "   Restore the backup if anything looks wrong:"
  echo "     mv $BACKUP $FILE"
  exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Open CREDENTIALS.md in your editor and fill the 6 SMTP fields:"
echo "       Host, Port, Username, Password, From address, From name"
echo "  2. Run: bash scripts/sync-credentials-to-env.sh"
echo "       (propagates SMTP values into .env.staging and .env.prod)"
echo "  3. Verify the section looks correct, then: rm $BACKUP"
echo "  4. If something is wrong: mv $BACKUP $FILE  (restores original)"
echo ""
echo "Then tell Claude Code: 'CREDENTIALS.md SMTP section swapped.'"
