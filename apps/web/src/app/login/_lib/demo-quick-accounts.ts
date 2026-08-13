// Demo quick-login accounts — one per RBAC tier, mirroring the `demo` tenant seed
// (packages/db/prisma/seed.ts → demoSpec.users). Powers the dev/demo-only quick-login rail.
//
// These are INTENTIONALLY-PUBLIC demo credentials for the seeded `demo` tenant. They are only
// ever rendered when the login page's server component enables the rail (APP_ENV development|demo,
// tenant === 'demo') — never in staging or production bundles. Keep in sync with the seed.

export type DemoQuickTarget = 'admin' | 'station';

export interface DemoQuickAccount {
  /** Stable key for React lists + button ordering. */
  key: string;
  /** RBAC tier label shown on the button. */
  label: string;
  /** The seeded account this logs in as. */
  sublabel: string;
  emoji: string;
  /** Username (matched by `name` per tenant — see auth/config.ts). */
  identifier: string;
  /** PIN = the credential the tenant provider bcrypt-checks against `user.pin`. */
  pin: string;
  /** Where this role lands after sign-in. */
  target: DemoQuickTarget;
}

export const DEMO_QUICK_ACCOUNTS: readonly DemoQuickAccount[] = [
  { key: 'owner',    label: 'Owner',    sublabel: 'Branch Admin',   emoji: '👑', identifier: 'Branch Admin',   pin: '0000', target: 'admin' },
  { key: 'admin',    label: 'Admin',    sublabel: 'Branch Manager', emoji: '🛡️', identifier: 'Branch Manager', pin: '4321', target: 'admin' },
  { key: 'employee', label: 'Employee', sublabel: 'Alice Santos',   emoji: '👤', identifier: 'Alice Santos',   pin: '1234', target: 'station' },
];
