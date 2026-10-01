import { test, expect, type Page } from '@playwright/test';

// CR-008 amendment (owner request 2026-10-01): remote.admins_default. Against tests/fixtures/arx_fake_ha.py (see
// evidence-arx-remote.spec.ts for how to run it: SW_LIVE=1 SW_ARX_FIXTURE=1 SW_API_PORT=<fixture port>). The seeded
// administrator (joni, Arx system_admin) loses the personal remote flag; the default still admits them, so the users screen
// shows "ברירת מחדל (מנהל)" with a disabled switch, and the settings tab carries the setting (default on).

const ENABLED = process.env.SW_ARX_FIXTURE === '1';
const PORT = process.env.SW_API_PORT || '8349';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.SW_FAKE_HA_PORT || String(Number(PORT) + 2)}`;
const ARX = `${ORIGIN}/arx/`;

test.skip(!ENABLED, 'needs the Arx fixture backend (SW_ARX_FIXTURE=1, tests/fixtures/arx_fake_ha.py)');
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': `198.19.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
});

async function routeHa(page: Page) {
  await page.route(`${ORIGIN}/auth/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${FAKE}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
}

type FlagResult = { remote_access: boolean; remote_access_basis: string | null; sessions_ended: number };

test('an administrator without the personal flag is admitted by the default, shown disabled with its reason', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport is enough');
  await routeHa(page);
  await page.goto(ARX);
  const login = page.locator('arx-login');
  await login.locator('#username').fill('joni');
  await login.locator('#password').fill('pw-joni');
  await login.locator('[data-arx-submit]').click();
  await expect(page.locator('sw-app')).toBeVisible();

  const setFlag = (enabled: boolean) =>
    page.evaluate(async (on) => {
      const r = await fetch('api/v1/access/users/u-owner/remote-access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: on }) });
      return { status: r.status, body: await r.json() };
    }, enabled);
  try {
    const off = await setFlag(false);
    expect(off.status).toBe(200);
    const body = off.body as FlagResult;
    expect(body).toMatchObject({ remote_access: true, remote_access_basis: 'admin_default', sessions_ended: 0 });
    expect((await page.evaluate(async () => (await fetch('api/v1/me')).status))).toBe(200); // the sign-in stays

    await page.goto(`${ARX}#/system/access`);
    await page.locator('system-access sw-table').getByText('יוני אוליאל').first().click();
    const toggle = page.locator('system-access [data-remote-access-toggle]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('disabled', '');
    await expect(page.locator('system-access [data-remote-admin-default]')).toContainText('ברירת מחדל (מנהל)');
    await expect(page.locator('system-access [data-remote-col]').first()).toBeVisible();
    await expect(page.locator('system-access sw-table')).toContainText('ברירת מחדל (מנהל)');
    await page.screenshot({ path: test.info().outputPath('access-admin-default.png') });

    // a viewer keeps the personal switch (enabled)
    await page.getByRole('button', { name: 'סגור' }).click();
    await page.locator('system-access sw-table').getByText('דנה כהן').first().click();
    await expect(page.locator('system-access [data-remote-access-toggle]')).not.toHaveAttribute('disabled', '');
    await expect(page.locator('system-access [data-remote-admin-default]')).toHaveCount(0);

    await page.goto(`${ARX}#/system/diagnostics`);
    await page.locator('system-diagnostics sw-tabs').getByText('גישה מרחוק', { exact: true }).click();
    const row = page.locator('system-diagnostics [data-remote-admins-default-row]');
    await expect(row).toContainText('מנהלים – גישה מרחוק כברירת מחדל');
    await expect(row.locator('select')).toHaveValue('true');
    await page.screenshot({ path: test.info().outputPath('settings-admin-default.png') });
  } finally {
    await setFlag(true);
  }
});
