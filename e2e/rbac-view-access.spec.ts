import { test, expect, type Page } from '@playwright/test';

/**
 * RBAC Wave 3 — verify-all-pages per role (Rule 34 Part B, matrix-driven view-access).
 *
 * Logs in LIVE (real admin-credentials name+PIN flow) as each principal on the `demo`
 * tenant and asserts the admin-shell nav + per-page server guards match the resolver
 * (apps/web/src/lib/rbac + admin/_lib/access.ts):
 *
 *   tenant_superadmin (owner)      → all 9 tabs incl. Users + Roles
 *   tenant_admin                   → 7 tabs; Users + Roles HIDDEN and URL-guarded
 *   employee + `contributor` role  → 4 tabs (dashboard/services/windows/media only)
 *   employee, no custom role       → bounced out of /admin entirely
 *
 * Requires the RBAC fixtures (e2e/fixtures/seed-rbac-fixtures.ts) seeded on `demo`.
 */

const TENANT = 'demo';
const ADMIN = `/${TENANT}/admin`;

// All admin-tab hrefs, in ADMIN_TABS order (apps/web/src/app/[tenant]/admin/_lib/access.ts).
const HREF = {
  dashboard: ADMIN, // admin root (href '')
  services: `${ADMIN}/services`,
  windows: `${ADMIN}/windows`,
  users: `${ADMIN}/users`,
  roles: `${ADMIN}/roles`,
  media: `${ADMIN}/media`,
  settings: `${ADMIN}/settings`,
  theme: `${ADMIN}/theme`,
  usage: `${ADMIN}/usage`,
} as const;

type TabKey = keyof typeof HREF;
const ALL_TABS = Object.keys(HREF) as TabKey[];

/** Log in via the real tenant admin-credentials flow (name + PIN), targeting /admin. */
async function login(page: Page, identifier: string, pin: string): Promise<void> {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(ADMIN)}`);
  await page.getByLabel('Username').fill(identifier);
  await page.getByLabel('Password').fill(pin);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Assert the admin sidebar shows EXACTLY `present` tab hrefs and none of the rest. */
async function expectTabs(page: Page, present: TabKey[]): Promise<void> {
  const absent = ALL_TABS.filter((t) => !present.includes(t));
  for (const t of present) {
    await expect(page.locator(`a[href="${HREF[t]}"]`).first(), `tab ${t} should be visible`).toBeVisible();
  }
  for (const t of absent) {
    await expect(page.locator(`a[href="${HREF[t]}"]`), `tab ${t} should be hidden`).toHaveCount(0);
  }
}

test.describe('RBAC view-access — nav + per-page guards per principal', () => {
  test('tenant_superadmin (Branch Admin) sees all 9 tabs incl. Users + Roles', async ({ page }) => {
    await login(page, 'Branch Admin', '0000');
    await page.waitForURL(`**${ADMIN}`);
    await expectTabs(page, ALL_TABS);
    // Positive guard: owner-only page renders.
    await page.goto(HREF.roles);
    await expect(page).toHaveURL(new RegExp(`${ADMIN}/roles/?$`));
  });

  test('tenant_admin (QA Branch Manager) sees 7 tabs; Users + Roles hidden AND URL-guarded', async ({ page }) => {
    await login(page, 'QA Branch Manager', '4321');
    await page.waitForURL(`**${ADMIN}`);
    await expectTabs(page, ['dashboard', 'services', 'windows', 'media', 'settings', 'theme', 'usage']);
    // Defense-in-depth: direct-URL to an OWNER_ONLY page must NOT stay on it.
    await page.goto(HREF.roles);
    await expect(page, 'tenant_admin must be redirected off /roles').not.toHaveURL(new RegExp(`${ADMIN}/roles`));
    await page.goto(HREF.users);
    await expect(page, 'tenant_admin must be redirected off /users').not.toHaveURL(new RegExp(`${ADMIN}/users`));
  });

  test('employee + contributor custom role sees only 4 permitted tabs', async ({ page }) => {
    await login(page, 'QA Contributor Emp', '2020');
    await page.waitForURL(`**${ADMIN}`);
    await expectTabs(page, ['dashboard', 'services', 'windows', 'media']);
    // Permitted page renders.
    await page.goto(HREF.services);
    await expect(page).toHaveURL(new RegExp(`${ADMIN}/services/?$`));
    // Non-permitted page (theme has view:false in the contributor matrix) is URL-guarded.
    await page.goto(HREF.theme);
    await expect(page, 'contributor employee must be redirected off /theme').not.toHaveURL(new RegExp(`${ADMIN}/theme`));
  });

  test('employee with NO custom role is bounced out of the admin shell', async ({ page }) => {
    await login(page, 'Alice Santos', '1234');
    // No admin-module grants → layout redirects out of /admin (to /{tenant}/kiosk).
    await page.waitForURL(`**/${TENANT}/kiosk`);
    await expect(page).toHaveURL(new RegExp(`/${TENANT}/kiosk`));
  });
});
