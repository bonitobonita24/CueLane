# Decisions Log — CueLane

Chronological record of locked architectural, product, and design decisions.
Append-only. Each entry documents what was decided, when, why, and whether it can be reversed.

---

## 2026-04-20 — Adopt HashiCorp visual aesthetic

**Decision:** Adopt HashiCorp visual aesthetic (color + typography + layout + theme) with shadcn/ui component implementation.

**Source:** https://getdesign.md/hashicorp/design-md (underlying: VoltAgent/awesome-design-md, `design-md/hashicorp/DESIGN.md`)

**Rationale:** HashiCorp's dual-mode aesthetic (clean white light-mode for informational surfaces + dramatic dark `#15181e`/`#0d0e12` for hero/product areas) directly mirrors CueLane's declared surface split in PRODUCT.md Design Identity — Big Display is dark-themed while Employee Station, Admin Panel, and Kiosk are light. The HashiCorp `--mds-color-*` token-driven component system maps cleanly onto CueLane's 9-token custom theme system (primary, primaryDark, primaryLight, primaryBorder, primaryGlow, gold, displayBg1/2/3). Tight heading line-heights (1.17–1.21) over relaxed body (1.50–1.69) and whisper-level shadows (0.05 opacity dual-layer) communicate enterprise-grade stability appropriate for B2B customers in banking, government, and healthcare sectors. Uppercase letter-spaced section labels (13px, weight 600, 1.3px tracking) provide systematic wayfinding for data-dense admin screens.

**Reversible:** YES — can be swapped by re-running prompt 4.8 with a different design (e.g. Linear, Vercel, Resend) from the VoltAgent/awesome-design-md collection.

**Affected files:**
- `docs/PRODUCT.md` — added Visual design reference line in Non-functional Requirements
- `docs/DESIGN.md` — created as authoritative visual reference (extracted sections 1, 2, 3, 5)
- `docs/DECISIONS_LOG.md` — this entry

**NOT affected (intentionally out of scope per prompt 4.8):**
- No changes to `inputs.yml`, `.env` files, code, or component implementations
- No changes to other PRODUCT.md sections
- Implementation of these tokens into `globals.css`, `layout.tsx`, and Tailwind config is handled separately during Phase 4 by Claude Code via scenarios.md Scenario 33

---

## Dev Environment Mode
Decision: MODE A — WSL2 native (the only supported mode as of V25)
Rationale: Devcontainer adds 4 virtualisation layers on WSL2 + Docker Desktop causing
permission errors, shell server crashes, and socket failures. WSL2 native eliminates all of this.
Docker Desktop provides the Docker socket to WSL2 natively. No DinD needed.
Locked: yes — do not re-ask or scaffold devcontainer files.
