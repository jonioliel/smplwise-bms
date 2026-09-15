import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend (T078/T083): the users screen driven by the HA directory
// (simulated bridge push in dev), role assignment with preview, effective permissions and the RBAC audit.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy, dev identity joni = system admin).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T078-live');

test.describe('users and roles evidence', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('directory, assignment wizard, effective preview, audit', async ({ page, request }, testInfo) => {
    const dir = await (await request.get('/api/v1/identity/users')).json();
    expect(dir.users.length).toBeGreaterThan(1);
    expect(dir.can_assign).toBeTruthy();
    const target = dir.users.find((u: { id: string; is_self: boolean; active: boolean }) => !u.is_self && u.active);
    expect(target).toBeTruthy();
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floor = tree.sites[0].buildings[0].floors[0];

    await open(page, '/system/access');
    await page.waitForTimeout(1500);
    const screen = page.locator('system-access');
    await expect(screen.locator('sw-table tbody tr').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `users-${testInfo.project.name}.png`) });

    // assign through the API the way the wizard does, then show the drawer with the binding
    const created = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: target.id, role_id: 'editor', scope_type: 'floor', scope_id: floor.id } });
    expect([201, 409]).toContain(created.status());
    await open(page, '/system/access');
    await page.waitForTimeout(1500);
    const row = screen.locator('sw-table tbody tr', { hasText: target.name }).first();
    await row.click();
    await page.waitForTimeout(700);
    const drawer = screen.locator('sw-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('שיוכים')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `user-drawer-${testInfo.project.name}.png`) });
    await drawer.locator('sw-button', { hasText: 'שיוך תפקיד' }).click();
    await page.waitForTimeout(500);
    await expect(drawer.locator('sw-steps')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `assign-wizard-${testInfo.project.name}.png`) });

    // effective permissions of that user on that floor: editor rights present, playback absent
    const preview = await (await request.post('/api/v1/access/preview', { data: { user_id: target.id, scope_type: 'floor', scope_id: floor.id } })).json();
    expect(preview.allowed).toContain('map.edit');
    expect(preview.allowed).not.toContain('video.playback');
    await screen.locator('sw-tabs').getByText('הרשאות אפקטיביות').click();
    await page.waitForTimeout(600);
    await screen.locator('sw-field select').first().selectOption(target.id);
    await screen.locator('sw-field select').nth(1).selectOption(`floor:${floor.id}`);
    await screen.locator('sw-button', { hasText: 'חשב' }).click();
    await page.waitForTimeout(1200);
    await expect(screen.getByText('מותר בהיקף')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `effective-${testInfo.project.name}.png`) });

    // audit tab lists the binding
    await screen.locator('sw-tabs').getByText('אודיט הרשאות').click();
    await page.waitForTimeout(1500);
    await expect(screen.locator('sw-table tbody tr').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `audit-${testInfo.project.name}.png`) });

    // clean up: revoke what this run created (keeps the dev database tidy)
    if (created.status() === 201) {
      const b = await created.json();
      expect((await request.delete(`/api/v1/access/bindings/${b.id}`)).status()).toBe(200);
    }
  });
});
