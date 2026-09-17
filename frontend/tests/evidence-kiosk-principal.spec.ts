import { test, expect } from '@playwright/test';

// Evidence for T057 (0.1.55) against the running developer backend: the kiosk restores its exact page after a reload,
// and a user whose only role is 'kiosk' is kept on the kiosk by the shell whatever route is asked for.
// Runs only with SW_LIVE=1.

test.describe('kiosk page restore and kiosk-only users (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('the page survives a reload', async ({ page, request }) => {
    test.setTimeout(120000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    expect(cams.length).toBeGreaterThan(2);
    await page.goto('/?design=a#/kiosk/all?cols=1&rows=1&rotate=2');
    const wall = page.locator('kiosk-wall');
    await expect(wall.locator('[data-kiosk-page]')).toContainText(`עמוד 1/${cams.length}`, { timeout: 30000 });
    await expect(wall.locator('[data-kiosk-page]')).toContainText(`עמוד 2/${cams.length}`, { timeout: 15000 });
    await page.reload();
    await expect(wall.locator('[data-kiosk-page]')).toContainText(/עמוד [23]\//, { timeout: 30000 });
    await expect(wall.locator('[data-kiosk-page]')).not.toContainText('עמוד 1/');
  });

  test('a kiosk-only user is kept on the kiosk', async ({ browser, request }) => {
    test.setTimeout(120000);
    // a user whose only role is kiosk, bound by the admin (dev identity headers)
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': 'kioskonly' } })).json();
    const existing = (await (await request.get('/api/v1/access/bindings')).json()) as { bindings?: { id: string; role_id: string; subject_id: string }[] };
    if (!(existing.bindings ?? []).some((b) => b.role_id === 'kiosk' && b.subject_id === me.user.id)) {
      const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'kiosk', scope_type: 'installation', scope_id: '*' } });
      expect([200, 201, 409]).toContain(r.status());
    }
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'kioskonly' } });
    const page = await ctx.newPage();
    await page.goto('/?design=a#/live/wall');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 30000 }).toBe('#/kiosk/all');
    await expect(page.locator('kiosk-wall')).toBeVisible({ timeout: 30000 });
    await page.goto('/?design=a#/system/diagnostics');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 30000 }).toBe('#/kiosk/all');
    await ctx.close();
  });
});
