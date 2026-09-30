import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UI round 1 (2026-09-30), the tabs against a REAL backend on fixture data (a throwaway instance, no HA, no NVR): the
// settings round trip of `ui.tabs` and `map.default_floor` (editor -> PATCH /settings -> reload -> the shell follows), the map
// entry resolving to the default floor and falling back once the floor is deleted (the server clears the setting), the
// server refusing a non-admin's write, and the old #/explore/entities address for a viewer. Runs only with SW_LIVE=1.
//   SW_API_PORT=8741 SW_LIVE=1 SW_BASE_URL=http://127.0.0.1:4741/ npx playwright test tests/evidence-tabs-live.spec.ts --project=desktop --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-tabs');

async function json<T = Record<string, unknown>>(r: { ok(): boolean; status(): number; json(): Promise<unknown>; text(): Promise<string> }): Promise<T> {
  if (!r.ok()) throw new Error(`${r.status()} ${await r.text()}`);
  return (await r.json()) as T;
}

async function seed(request: APIRequestContext) {
  const site = await json<{ id: string }>(await request.post('/api/v1/sites', { data: { name: 'אתר בדיקה' } }));
  const b1 = await json<{ id: string }>(await request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'בניין א' } }));
  const b2 = await json<{ id: string }>(await request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'בניין ב' } }));
  const fa = await json<{ id: string }>(await request.post(`/api/v1/buildings/${b1.id}/floors`, { data: { name: 'קרקע א', level: 0 } }));
  const fb = await json<{ id: string }>(await request.post(`/api/v1/buildings/${b2.id}/floors`, { data: { name: 'קרקע ב', level: 0 } }));
  return { fa: fa.id, fb: fb.id };
}

test.describe('tabs configuration against a real backend', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running (SW_API_PORT)');
  test.describe.configure({ mode: 'serial' });

  test('ui.tabs and map.default_floor: editor -> server -> reload -> navigation and the map entry; a deleted default falls back', async ({ page, request }) => {
    // a clean start: nothing configured
    await json(await request.patch('/api/v1/settings', { data: { 'ui.tabs': {}, 'map.default_floor': '' } }));
    const { fa, fb } = await seed(request);

    // 1. the editor: hide "תיקים" of the investigation, put the map's floor tab first, and save
    await page.goto('/?design=a#/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed.locator('[data-tabs-section]')).toHaveCount(9);
    await ed.locator('li[data-sec="security.investigate"][data-tab="cases"] sw-toggle button').click();
    await ed.locator('li[data-sec="explore"][data-tab="floors"] .mv[data-move="up"]').click();
    await ed.locator('[data-tabs-save]').click();
    await expect(ed.locator('.ok')).toHaveText('הלשוניות נשמרו');
    const stored = (await json<{ settings: Record<string, unknown> }>(await request.get('/api/v1/settings'))).settings['ui.tabs'];
    expect(stored).toEqual({ explore: { order: ['floors', 'sites'], hidden: [] }, 'security.investigate': { order: [], hidden: ['cases'] } });
    await page.screenshot({ path: path.join(EVIDENCE, 'live-editor-saved-desktop.png') });

    // 2. a fresh load follows: the map rail entry lands on the floor map, no "תיקים" in the investigation, deep link still works
    await page.goto('about:blank');
    await page.goto('/?design=a#/investigate/events');
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app nav.rail a[data-nav="explore"]')).toHaveAttribute('href', '#/explore/floors/f0');
    await expect(page.locator('sw-app .subnav sw-tabs')).toBeVisible();
    const tabs = await page.locator('sw-app .subnav sw-tabs a').allTextContents();
    expect(tabs).not.toContain('תיקים');
    expect(tabs).toContain('מרכז אירועים');
    await page.goto('about:blank');
    await page.goto('/?design=a#/investigate/cases');
    await expect(page.locator('sw-app investigate-cases')).toHaveCount(1); // hidden is not closed

    // 3. the default floor: chosen in הגדרות › כללי › מפה, saved, and the map's entry resolves to it
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics?tab=map');
    const sel = page.locator('sw-app system-diagnostics [data-set-default-floor]');
    await expect(sel.locator(`option[value="${fb}"]`)).toHaveCount(1, { timeout: 15_000 });
    await expect(sel.locator('option').first()).toHaveText('אוטומטי');
    await sel.selectOption(fb);
    await page.locator('sw-app system-diagnostics [data-save-map]').click();
    await expect.poll(async () => (await json<{ settings: Record<string, unknown> }>(await request.get('/api/v1/settings'))).settings['map.default_floor']).toBe(fb);
    await page.goto('about:blank');
    await page.goto('/?design=a#/explore/floors/f0');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/explore/floors/${fb}`);
    await page.screenshot({ path: path.join(EVIDENCE, 'live-map-default-floor-desktop.png') });

    // 4. the default floor is deleted: the server clears the setting and the entry falls back to the first floor
    const del = await request.delete(`/api/v1/floors/${fb}`);
    expect(del.ok(), await del.text()).toBe(true);
    expect((await json<{ settings: Record<string, unknown> }>(await request.get('/api/v1/settings'))).settings['map.default_floor']).toBe('');
    await page.goto('about:blank');
    await page.goto('/?design=a#/explore/floors/f0');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/explore\/floors\/(?!f0$)[^/]+$/);
    expect(await page.evaluate(() => location.hash)).not.toBe(`#/explore/floors/${fb}`);
    void fa;

    // 5. the settings page for the catalogue, and its old address (this user is the bootstrap admin)
    await page.goto('about:blank');
    await page.goto('/?design=a#/explore/entities?q=light');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/entities?q=light');
    await expect(page.locator('sw-app explore-entities')).toHaveCount(1);

    // clean up: nothing configured again
    await json(await request.patch('/api/v1/settings', { data: { 'ui.tabs': {}, 'map.default_floor': '' } }));
  });

  test('a viewer: the server refuses the write, the old catalogue address lands on the map, the settings page shows no catalogue', async ({ browser, request }) => {
    // a dev principal exists after its first /me; bind it to the viewer role (the same technique as the least-privilege walk)
    const vee = { 'x-sw-dev-user': 'vee' };
    await request.get('/api/v1/me', { headers: vee });
    const bind = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: 'dev-vee', role_id: 'viewer', scope_type: 'installation', scope_id: '*' } });
    expect([200, 201, 409]).toContain(bind.status());
    const refused = await request.patch('/api/v1/settings', { headers: vee, data: { 'ui.tabs': { explore: { order: ['floors'], hidden: [] } } } });
    expect(refused.status()).toBe(403);
    const refusedFloor = await request.patch('/api/v1/settings', { headers: vee, data: { 'map.default_floor': '' } });
    expect(refusedFloor.status()).toBe(403);
    // the read is open to any signed-in user (the shell needs it)
    expect((await request.get('/api/v1/settings', { headers: vee })).status()).toBe(200);

    const ctx = await browser.newContext({ extraHTTPHeaders: vee, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/?design=a#/explore/entities?q=light');
    await page.waitForSelector('sw-app');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/explore\//);
    expect(await page.evaluate(() => location.hash)).not.toContain('entities');
    await expect(page.locator('sw-app explore-entities')).toHaveCount(0);
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/entities');
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app explore-entities [data-entities-forbidden]')).toHaveCount(1);
    await ctx.close();
    fs.mkdirSync(EVIDENCE, { recursive: true });
  });
});
