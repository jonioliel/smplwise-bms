import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-006 phase 2, slice 2a against a running backend (a throwaway instance: SW_LIVE=1 SW_BASE_URL=<its preview>
// SW_API_PORT=<its port>), WITHOUT an OpenAI key: nothing can reach a provider from this spec. (1) The settings section
// renders what leaves the premises and what never does, the key's presence (not the key), the budgets, and the
// connection test is refused with a clear message without the acknowledgement and then without the key. (2) The floor
// map's 3D "control images" button captures both synthetic states from the published structure and uploads them; a
// second press gives the same bytes (the backend reports them identical). The floor, with its control images, is
// removed at the end.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;
const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const OBJ = (id: string, item_id: string, position: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

test.describe.serial('plan skins 2a (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with a (throwaway) backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const status = await (await api.get('api/v1/skins/status')).json();
    expect(status.key_configured, 'this spec runs only against a backend without an OpenAI key').toBe(false);
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סקינים ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה סקינים' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת סקינים', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    const doc = { ...g.doc,
      walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('m', [[0.5, 0.1], [0.5, 0.6]])],
      objects: [OBJ('t1', 'chair.basic', [0.3, 0.3]), OBJ('lk', 'light.ceiling', [0.7, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 })],
      circuits: [{ id: 'k', name: 'מעגל', switch_entity_id: 'switch.skins_k', member_ids: ['lk'], color_token: 'circuit-1', power_w: 0 }] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    for (const [name, x0] of [['מערב', 0.1], ['מזרח', 0.5]] as const) {
      expect((await api.post(`api/v1/floors/${ids.floor}/zones`, { data: { name, polygon: [{ x: x0, y: 0.1 }, { x: x0 + 0.4, y: 0.1 }, { x: x0 + 0.4, y: 0.6 }, { x: x0, y: 0.6 }] } })).status()).toBe(201);
    }
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      await api.patch('api/v1/settings', { data: { 'skins.privacy_ack': 'false' } });
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status()).toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status()).toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('settings: what leaves and what never does, the key presence, the budgets; the test is refused without the acknowledgement, then without the key', async ({ page }) => {
    expect((await api.patch('api/v1/settings', { data: { 'skins.privacy_ack': 'false' } })).status()).toBe(200);
    await page.goto('/?design=a#/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics sw-card[data-skins]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.locator('[data-skins-leaves]')).toContainText('תמונת הבקרה הסכמטית');
    await expect(card.locator('[data-skins-leaves]')).toContainText('תמונת התוכנית המקורית');
    await expect(card.locator('[data-skins-leaves]')).toContainText('תמונות ממצלמות');
    await expect(card.locator('[data-skins-key] sw-badge')).toHaveAttribute('label', 'לא מוגדר');
    await expect(card.locator('[data-set-skins-ack]')).toHaveValue('false');
    await expect(card.locator('[data-set-skins-per-floor]')).toHaveValue('4');
    await expect(card.locator('[data-set-skins-monthly]')).toHaveValue('20');
    await expect(card.locator('[data-skins-estimate]')).toContainText('הערכה בלבד');
    await card.locator('[data-skins-test]').click();
    await expect(card.locator('[data-skins-test-error]')).toContainText('יש לאשר קודם');
    await card.locator('[data-set-skins-ack]').selectOption('true');
    await expect(card.locator('[data-skins-test]')).toHaveAttribute('disabled', ''); // unsaved: the test uses the saved settings
    await card.locator('[data-save-skins]').click();
    await expect(card.locator('[data-skins-test]')).not.toHaveAttribute('disabled', '', { timeout: 10000 });
    await card.locator('[data-skins-test]').click();
    await expect(card.locator('[data-skins-test-error]')).toContainText('openai_api_key');
    const st = await (await api.get('api/v1/skins/status')).json();
    expect(st.privacy_ack).toBe(true);
    expect(st.budget.used_month).toBe(0);
    expect(st.last_test).toBeNull(); // nothing was sent, nothing recorded
    await page.screenshot({ path: test.info().outputPath('skins-settings.png'), fullPage: true });
  });

  test('floor map: the 3D control-images button uploads both states from the published structure; a second press gives identical bytes', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator('explore-floor-map');
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const button = host.locator('[data-skin-controls-export]');
    await expect(button).toBeVisible();
    await button.click();
    await expect(host.locator('[data-skin-note]')).toContainText('נשמרו במתקן בלבד', { timeout: 30000 });
    const info = await (await api.get(`api/v1/floors/${ids.floor}/skins`)).json();
    expect(info.controls.map((c: { state: string }) => c.state)).toEqual(['all_off', 'all_on']);
    expect(info.controls.every((c: { current: boolean; width: number; height: number }) => c.current && c.width === 1536 && c.height === 1024)).toBe(true);
    const shas = info.controls.map((c: { sha256: string }) => c.sha256);
    expect(shas[0]).not.toBe(shas[1]);
    await expect(button).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await button.click();
    await expect(host.locator('[data-skin-note]')).toContainText('זהות לשמורות', { timeout: 30000 });
    const again = await (await api.get(`api/v1/floors/${ids.floor}/skins`)).json();
    expect(again.controls.map((c: { sha256: string }) => c.sha256)).toEqual(shas);
    await page.screenshot({ path: test.info().outputPath('skins-floor-map.png') });
  });
});
