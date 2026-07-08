# CueLane — Pending Owner Decisions (`[WHAT]` / product / scope)

Non-blocking. The full-auto loop keeps advancing un-gated work; these re-surface each session until answered.
When answered, back-port to `docs/PRODUCT.md` + `docs/DECISIONS_LOG.md` before acting.

## Open

- [ ] **Free-tier Theme tab visibility (raised Wave 7.7b, 2026-07-09).**
  Wave 7.7b **un-gated the Theme tab for the Free tier** — Free tenants now see the Theme tab with the 8 presets
  available, but the **custom color picker disabled** behind upgrade copy (Premium-only). This **reverses the
  Wave 7.6-T7 decision**, which hid the *entire* Theme tab from Free tenants.
  - Followed this wave's explicit brief ("Free tier = presets only, custom disabled w/ upgrade copy"), which implies
    the tab is visible. Recorded in `docs/DECISIONS_LOG.md`.
  - **Question for owner:** Is showing Free tenants the Theme tab (presets yes, custom no) the intended product
    behavior, or should the whole tab stay hidden from Free (revert to 7.6-T7)?
  - **Impact if unanswered:** cosmetic/product-positioning only; no functional or security impact. Loop proceeds.
