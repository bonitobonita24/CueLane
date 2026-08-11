// Single source of the user-facing app version string, rendered in the sidebar-footer
// white-label (design-defaults Entry 3) and anywhere else the running build's version is shown.
//
// Keep in sync with the root `package.json` "version" field and the annotated git tag
// `vX.Y.Z` (git tags are the fleet source of truth — see ~/.claude/rules/versioning-standard.md).
export const APP_VERSION = '1.0.0';
