import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for custom roles and delegated administration (T082) against the running developer backend: a custom
// role is built in the dialog (ordinary + explicit sensitive grants), a user bound to it gets exactly those rights,
// editing the role shows the impact (who, what is removed) before saving and takes effect on the next request,
// deletion is refused while bound, and the delegation allowlist is edited from the screen. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T082-custom-roles-live');
const GUARD = { 'X-SW-Dev-User': 'guard' };

test.describe('custom roles (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('create, bind, impact preview, edit takes effect, delete guard, delegation allowlist', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const name = `שומר ראיות ${new Date().toISOString().slice(11, 19)}`;
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floor = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).find((f: { has_plan: boolean }) => f.has_plan);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string }[];
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
    const placed = map.anchors.find((a: { resource_type: string }) => a.resource_type === 'camera')?.resource_id ?? cams[0].id;

    await page.goto('/?design=a#/system/access');
    await page.waitForSelector('sw-app');
    const screen = page.locator('system-access');
    await screen.locator('sw-tabs').getByText('תפקידים').click();
    await expect(screen.locator('[data-role-new]')).toBeVisible({ timeout: 20000 });
    await screen.locator('[data-role-new]').click();
    const dlg = screen.locator('[data-role-dialog]');
    await dlg.locator('[data-role-name]').fill(name);
    // owner round 3 (4.1): a new role is auto-assigned to its creator by default - this test wants a clean role
    // with exactly the one binding it creates explicitly below (guard), so it opts out of that default.
    await dlg.locator('[data-role-assign-me]').uncheck();
    await dlg.locator('[data-role-perm="video.live"]').check();
    await dlg.locator('[data-role-perm="events.read"]').check();
    await dlg.locator('[data-role-sensitive="video.export"]').check();
    await expect(dlg.locator('[data-role-impact]')).toContainText('יתווספו', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, `role-dialog-${testInfo.project.name}.png`) });
    await dlg.locator('[data-role-save]').click();
    const card = screen.locator('[data-role-card]').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('מותאם');
    const roles = (await (await request.get('/api/v1/access/roles')).json()).roles as { id: string; name: string; permissions: string[]; revision: number }[];
    const mine = roles.find((r) => r.name === name)!;
    expect(mine.permissions).toEqual(['events.read', 'map.read', 'video.export', 'video.live']);

    // bind a dev user and check the exact rights
    await request.get('/api/v1/me', { headers: GUARD });
    const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: 'dev-guard', role_id: mine.id, scope_type: 'floor', scope_id: floor.id } });
    expect(b.status()).toBe(201);
    const bindingId = (await b.json()).id as string;
    expect((await request.get(`/api/v1/floors/${floor.id}/map`, { headers: GUARD })).status()).toBe(200);
    expect((await request.get(`/api/v1/media/live/${placed}`, { headers: GUARD })).status()).toBe(200);
    expect((await request.get(`/api/v1/cameras/${placed}/recordings?date=2026-09-16`, { headers: GUARD })).status()).toBe(403);
    const exp = await request.post('/api/v1/exports', { headers: GUARD, data: { camera_id: placed, from_at: '2026-09-16T08:00:00Z', to_at: '2026-09-16T08:01:00Z' } });
    expect(exp.status()).not.toBe(403);

    // edit: remove the export grant; the impact names the bound user; the change applies at once
    await page.reload();
    await page.waitForSelector('sw-app');
    await screen.locator('sw-tabs').getByText('תפקידים').click();
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.locator('[data-role-edit]').click();
    await expect(dlg.locator('[data-role-impact]')).toContainText('1 שיוכים', { timeout: 10000 });
    await dlg.locator('[data-role-sensitive="video.export"]').uncheck();
    await expect(dlg.locator('[data-role-impact]')).toContainText('יוסרו', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, `role-impact-${testInfo.project.name}.png`) });
    await dlg.locator('[data-role-save]').click();
    await expect(dlg).toHaveCount(0, { timeout: 15000 });
    await expect.poll(async () => (await request.post('/api/v1/exports', { headers: GUARD, data: { camera_id: placed, from_at: '2026-09-16T08:00:00Z', to_at: '2026-09-16T08:01:00Z' } })).status(), { timeout: 15000 }).toBe(403);
    expect((await request.get(`/api/v1/floors/${floor.id}/map`, { headers: GUARD })).status()).toBe(200);

    // delete is refused while bound; the delegation allowlist toggles from the screen
    const del1 = await request.delete(`/api/v1/access/roles/${mine.id}`);
    expect(del1.status()).toBe(409);
    await screen.locator(`[data-delegable="${mine.id}"]`).click();
    await expect.poll(async () => ((await (await request.get('/api/v1/access/delegation')).json()).delegable_roles as string[]).includes(mine.id), { timeout: 15000 }).toBe(true);
    await page.screenshot({ path: path.join(OUT, `roles-tab-${testInfo.project.name}.png`), fullPage: true });
    await screen.locator(`[data-delegable="${mine.id}"]`).click();
    // cleanup
    expect((await request.delete(`/api/v1/access/bindings/${bindingId}`)).status()).toBe(200);
    expect((await request.delete(`/api/v1/access/roles/${mine.id}`)).status()).toBe(200);
    expect((await request.get(`/api/v1/floors/${floor.id}/map`, { headers: GUARD })).status()).toBe(403);
  });
});
