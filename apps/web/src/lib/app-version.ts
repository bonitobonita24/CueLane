// Single source of the user-facing app version string, rendered in the sidebar-footer
// white-label (design-defaults Entry 3) and anywhere else the running build's version is shown.
//
// Derived at BUILD time from apps/web/package.json "version": next.config.ts sets
// `env.NEXT_PUBLIC_APP_VERSION` from it, and Next inlines the value into the bundle. The release
// tool (`gen-release-notes --apply`) rewrites every workspace package.json "version" on each
// release, so a version bump flows through here automatically — no hand-edited literal to drift
// (it was stuck at 1.0.0 while releases reached 1.2.1). Git tags `vX.Y.Z` remain the fleet
// source of truth (~/.claude/rules/versioning-standard.md). The '0.0.0' fallback only shows when
// the module runs outside a Next build (e.g. a bare unit test) — never in a built app.
export const APP_VERSION: string = process.env['NEXT_PUBLIC_APP_VERSION'] ?? '0.0.0';
