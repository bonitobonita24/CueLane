# DESIGN.md — CueLane

Visual design reference for **CueLane** — inspired by **HashiCorp** from VoltAgent/awesome-design-md. Implementation uses shadcn/ui.

**Source:** https://getdesign.md/hashicorp/design-md
**Date adopted:** 2026-04-20
**Extracted sections:** 1 (Visual Theme & Atmosphere), 2 (Color Palette & Roles), 3 (Typography Rules), 5 (Layout Principles)

**Omitted sections (intentional):** Component Stylings (4), Depth & Elevation (6), Do's & Don'ts (7), Responsive Behavior (8), Agent Prompt Guide (9). shadcn/ui handles components, elevation, and responsive patterns. Do's/Don'ts are opinionated guardrails we're not wholesale adopting. The Agent Prompt Guide becomes redundant once tokens are in globals.css.

---

## 1. Visual Theme & Atmosphere

HashiCorp's website is enterprise infrastructure made tangible — a design system that must communicate the complexity of cloud infrastructure management while remaining approachable. The visual language splits between two modes: a clean white light-mode for informational sections and a dramatic dark-mode (`#15181e`, `#0d0e12`) for hero areas and product showcases, creating a day/night duality that mirrors the "build in light, deploy in dark" developer workflow.

The typography is anchored by a custom brand font (HashiCorp Sans, loaded as `__hashicorpSans_96f0ca`) that carries substantial weight — literally. Headings use 600–700 weights with tight line-heights (1.17–1.19), creating dense, authoritative text blocks that communicate enterprise confidence. The hero headline at 82px weight 600 with OpenType `"kern"` enabled is not decorative — it's infrastructure-grade typography.

What distinguishes HashiCorp is its multi-product color system. Each product in the portfolio has its own brand color — Terraform purple (`#7b42bc`), Vault yellow (`#ffcf25`), Waypoint teal (`#14c6cb`), Vagrant blue (`#1868f2`) — and these colors appear throughout as accent tokens via a CSS custom property system (`--mds-color-*`). This creates a design system within a design system: the parent brand is black-and-white with blue accents, while each child product injects its own chromatic identity.

The component system uses the `mds` (Markdown Design System) prefix, indicating a systematic, token-driven approach where colors, spacing, and states are all managed through CSS variables. Shadows are remarkably subtle — dual-layer micro-shadows using `rgba(97, 104, 117, 0.05)` that are nearly invisible but provide just enough depth to separate interactive surfaces from the background.

**Key Characteristics:**
- Dual-mode: clean white sections + dramatic dark (`#15181e`) hero/product areas
- Custom HashiCorp Sans font with 600–700 weights and `"kern"` feature
- Multi-product color system via `--mds-color-*` CSS custom properties
- Product brand colors: Terraform purple, Vault yellow, Waypoint teal, Vagrant blue
- Uppercase letter-spaced captions (13px, weight 600, 1.3px letter-spacing)
- Micro-shadows: dual-layer at 0.05 opacity — depth through whisper, not shout
- Token-driven `mds` component system with semantic variable names
- Tight border radius: 2px–8px, nothing pill-shaped or circular
- System-ui fallback stack for secondary text

## 2. Color Palette & Roles

### Brand Primary
- **Black** (`#000000`): Primary brand color, text on light surfaces, `--mds-color-hcp-brand`
- **Dark Charcoal** (`#15181e`): Dark mode backgrounds, hero sections
- **Near Black** (`#0d0e12`): Deepest dark mode surface, form inputs on dark

### Neutral Scale
- **Light Gray** (`#f1f2f3`): Light backgrounds, subtle surfaces
- **Mid Gray** (`#d5d7db`): Borders, button text on dark
- **Cool Gray** (`#b2b6bd`): Border accents (at 0.1–0.4 opacity)
- **Dark Gray** (`#656a76`): Helper text, secondary labels, `--mds-form-helper-text-color`
- **Charcoal** (`#3b3d45`): Secondary text on light, button borders
- **Near White** (`#efeff1`): Primary text on dark surfaces

### Product Brand Colors
- **Terraform Purple** (`#7b42bc`): `--mds-color-terraform-button-background`
- **Vault Yellow** (`#ffcf25`): `--mds-color-vault-button-background`
- **Waypoint Teal** (`#14c6cb`): `--mds-color-waypoint-button-background-focus`
- **Waypoint Teal Hover** (`#12b6bb`): `--mds-color-waypoint-button-background-hover`
- **Vagrant Blue** (`#1868f2`): `--mds-color-vagrant-brand`
- **Purple Accent** (`#911ced`): `--mds-color-palette-purple-300`
- **Visited Purple** (`#a737ff`): `--mds-color-foreground-action-visited`

### Semantic Colors
- **Action Blue** (`#1060ff`): Primary action links on dark
- **Link Blue** (`#2264d6`): Primary links on light
- **Bright Blue** (`#2b89ff`): Active links, hover accent
- **Amber** (`#bb5a00`): `--mds-color-palette-amber-200`, warning states
- **Amber Light** (`#fbeabf`): `--mds-color-palette-amber-100`, warning backgrounds
- **Vault Faint Yellow** (`#fff9cf`): `--mds-color-vault-radar-gradient-faint-stop`
- **Orange** (`#a9722e`): `--mds-color-unified-core-orange-6`
- **Red** (`#731e25`): `--mds-color-unified-core-red-7`, error states
- **Navy** (`#101a59`): `--mds-color-unified-core-blue-7`

### Shadows
- **Micro Shadow** (`rgba(97, 104, 117, 0.05) 0px 1px 1px, rgba(97, 104, 117, 0.05) 0px 2px 2px`): Default card/button elevation
- **Focus Outline**: `3px solid var(--mds-color-focus-action-external)` — systematic focus ring

## 3. Typography Rules

### Font Families
- **Primary Brand**: `__hashicorpSans_96f0ca` (HashiCorp Sans), with fallback: `__hashicorpSans_Fallback_96f0ca`
- **System UI**: `system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | HashiCorp Sans | 82px (5.13rem) | 600 | 1.17 (tight) | normal | `"kern"` enabled |
| Section Heading | HashiCorp Sans | 52px (3.25rem) | 600 | 1.19 (tight) | normal | `"kern"` enabled |
| Feature Heading | HashiCorp Sans | 42px (2.63rem) | 700 | 1.19 (tight) | -0.42px | Negative tracking |
| Sub-heading | HashiCorp Sans | 34px (2.13rem) | 600–700 | 1.18 (tight) | normal | Feature blocks |
| Card Title | HashiCorp Sans | 26px (1.63rem) | 700 | 1.19 (tight) | normal | Card and panel headings |
| Small Title | HashiCorp Sans | 19px (1.19rem) | 700 | 1.21 (tight) | normal | Compact headings |
| Body Emphasis | HashiCorp Sans | 17px (1.06rem) | 600–700 | 1.18–1.35 | normal | Bold body text |
| Body Large | system-ui | 20px (1.25rem) | 400–600 | 1.50 | normal | Hero descriptions |
| Body | system-ui | 16px (1.00rem) | 400–500 | 1.63–1.69 (relaxed) | normal | Standard body text |
| Nav Link | system-ui | 15px (0.94rem) | 500 | 1.60 (relaxed) | normal | Navigation items |
| Small Body | system-ui | 14px (0.88rem) | 400–500 | 1.29–1.71 | normal | Secondary content |
| Caption | system-ui | 13px (0.81rem) | 400–500 | 1.23–1.69 | normal | Metadata, footer links |
| Uppercase Label | HashiCorp Sans | 13px (0.81rem) | 600 | 1.69 (relaxed) | 1.3px | `text-transform: uppercase` |

### Principles
- **Brand/System split**: HashiCorp Sans for headings and brand-critical text; system-ui for body, navigation, and functional text. The brand font carries the weight, system-ui carries the words.
- **Kern always on**: All HashiCorp Sans text enables OpenType `"kern"` — letterfitting is non-negotiable.
- **Tight headings**: Every heading uses 1.17–1.21 line-height, creating dense, stacked text blocks that feel infrastructural — solid, load-bearing.
- **Relaxed body**: Body text uses 1.50–1.69 line-height (notably generous), creating comfortable reading rhythm beneath the dense headings.
- **Uppercase labels as wayfinding**: 13px uppercase with 1.3px letter-spacing serves as the systematic category/section marker — always HashiCorp Sans weight 600.

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 2px, 3px, 4px, 6px, 7px, 8px, 9px, 11px, 12px, 16px, 20px, 24px, 32px, 40px, 48px

### Grid & Container
- Max content width: ~1150px (xl breakpoint)
- Full-width dark hero sections with contained content
- Card grids: 2–3 column layouts
- Generous horizontal padding at desktop scale

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile Small | <375px | Tight single column |
| Mobile | 375–480px | Standard mobile |
| Small Tablet | 480–600px | Minor adjustments |
| Tablet | 600–768px | 2-column grids begin |
| Small Desktop | 768–992px | Full nav visible |
| Desktop | 992–1120px | Standard layout |
| Large Desktop | 1120–1440px | Max-width content |
| Ultra-wide | >1440px | Centered, generous margins |

### Whitespace Philosophy
- **Enterprise breathing room**: Generous vertical spacing between sections (48px–80px+) communicates stability and seriousness.
- **Dense headings, spacious body**: Tight line-height headings sit above relaxed body text, creating visual "weight at the top" of each section.
- **Dark as canvas**: Dark hero sections use extra vertical padding to let 3D illustrations and gradients breathe.

### Border Radius Scale
- Minimal (2px): Links, small inline elements
- Subtle (3px): Checkboxes, small inputs
- Standard (4px): Secondary buttons
- Comfortable (5px): Primary buttons, badges, inputs
- Card (8px): Cards, containers, images

---

## shadcn/ui Translation Guide

See `scenarios.md` Scenario 33 for how Claude Code maps these tokens into `globals.css` + `layout.tsx` + Tailwind config during Phase 4 implementation. In brief:

- HashiCorp **Black** (`#000000`) → shadcn `--foreground` (light mode) and `--primary` foreground (dark mode)
- HashiCorp **Dark Charcoal** (`#15181e`) → shadcn `--background` (dark mode), retained for CueLane's Big Display background
- HashiCorp **Link Blue** (`#2264d6`) → shadcn `--primary` (light mode) + link hover states
- HashiCorp **Charcoal** (`#3b3d45`) → shadcn `--foreground` dark-on-light body text
- HashiCorp **Light Gray** (`#f1f2f3`) → shadcn `--muted` / `--secondary`
- HashiCorp **Dark Gray** (`#656a76`) → shadcn `--muted-foreground`
- HashiCorp **Mid Gray** (`#d5d7db`) → shadcn `--border` (light mode)
- HashiCorp product brand colors (Terraform `#7b42bc`, Vault `#ffcf25`, Waypoint `#14c6cb`) map to CueLane's 8 theme presets — each tenant on Premium tier picks one as their `--primary` accent, preserving the "multi-product color system" pattern.
- HashiCorp Sans → CueLane keeps DM Sans + Outfit for display text (see PRODUCT.md Design Identity) as heading-family substitutes, applying HashiCorp's weight/line-height/tracking discipline
- Space Mono → retained for ticket numbers and timestamps (CueLane-specific)
- HashiCorp's 13px uppercase 600/1.3px-tracked label pattern → becomes a CueLane utility class for section wayfinding in Admin Panel sub-tabs and Big Display metadata

The HashiCorp gold (`--mds-color-vault-button-background` = `#ffcf25`) is notably close to CueLane's existing gold token (`#FCD34D`) used for Big Display "Now Serving" window names. CueLane's existing gold will be retained; HashiCorp's yellow would only appear if a tenant selects the "Amber Gold" theme preset.
