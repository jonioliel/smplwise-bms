import { test, expect, type APIRequestContext } from '@playwright/test';

// 0.1.89 (owner decision 2026-09-26): the `plan.levels` setting chooses the default levels view on every map - all
// levels together (default value, today's behaviour) or the floor's default level only. The level chips still switch
// levels from there. Against the running backend: the spec builds its own site / building / floor with two levels,
// flips the setting to "default", checks the live map and the editor both open on the floor's default level, then
// restores the setting to "all" and removes its test data. Runs only with SW_LIVE=1 (backend on 8099 behind the
// preview proxy) in real Chrome.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;

type P = [number, number];
const LEVEL = (id: string, name: string, elevation: number, ceiling: number, isDefault = false) => ({ id, name, elevation_m: elevation, ceiling_height_m: ceiling, is_default: isDefault, external_ids: {} });
const WALL = (id: string, levelId: string, polyline: P[]) => ({ id, level_id: levelId, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });

interface Draft {
  geometry: { revision: number };
  doc: Record<string, unknown> & { levels: { id: string }[]; walls: { id: string; level_id: string }[] };
}
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;
const saveDraft = async (patch: Record<string, unknown>) => {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
const publish = async () => expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
const setLevelsSetting = async (value: 'all' | 'default') => expect((await api.patch('api/v1/settings', { data: { 'plan.levels': value } })).status()).toBe(200);

test.describe.serial('the plan.levels setting opens every map on the floor default level (0.1.89)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת מפלס ברירת מחדל ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת בדיקה', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    // L0 (default) has one wall, L1 a second wall on its own: the level filter is the only thing that can hide either.
    await saveDraft({
      levels: [LEVEL('L0', 'מפלס ראשי', 0, 2.8, true), LEVEL('L1', 'מרתף', -1.2, 2.8)],
      walls: [WALL('w0', 'L0', [[0.2, 0.3], [0.6, 0.3]]), WALL('w1', 'L1', [[0.2, 0.6], [0.6, 0.6]])],
    });
    await publish();
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
    const remove = async (what: string, path: string) => {
      try {
        const status = (await api.delete(path)).status();
        if (status !== 204) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    };
    try {
      await setLevelsSetting('all'); // restore the owner-visible default regardless of test outcome
      if (ids.floor) await remove('test floor', `api/v1/floors/${ids.floor}?force=true`);
      if (ids.building) await remove('test building', `api/v1/buildings/${ids.building}`);
      if (ids.site) await remove('test site', `api/v1/sites/${ids.site}`);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('plan.levels = default: the live map and the editor both open on the floor default level; all shows every wall', async ({ page }) => {
    const waitWalls = (screen: string) => expect(page.locator(`${screen} sw-plan-canvas [data-wall]`)).not.toHaveCount(0, { timeout: 20000 });

    // baseline: plan.levels is "all" (the setting's default) - both levels' walls show, no chip is selected
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await waitWalls('explore-floor-map');
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall]')).toHaveCount(2);
    await expect(page.locator('explore-floor-map [data-level-chip="all"]')).toHaveAttribute('selected', '');

    await setLevelsSetting('default');

    // the live map: a fresh floor load opens on L0 (the default level) - only its wall shows, and its chip is active
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await waitWalls('explore-floor-map');
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall="w0"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map [data-level-chip="L0"]')).toHaveAttribute('selected', '');
    // the chips still switch levels: L1 shows its own wall instead
    await page.locator('explore-floor-map [data-level-chip="L1"]').click();
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall="w1"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall="w0"]')).toHaveCount(0);

    // the editor: a fresh floor load also opens on L0
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await waitWalls('explore-plan-editor');
    await expect(page.locator('explore-plan-editor sw-plan-canvas [data-wall]')).toHaveCount(1);
    await expect(page.locator('explore-plan-editor sw-plan-canvas [data-wall="w0"]')).toHaveCount(1);
    await expect(page.locator('explore-plan-editor [data-level-chip="L0"]')).toHaveAttribute('selected', '');

    await setLevelsSetting('all');
    // back to "all": a fresh load of the same floor shows every level's wall again
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await waitWalls('explore-floor-map');
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall]')).toHaveCount(2);
    await expect(page.locator('explore-floor-map [data-level-chip="all"]')).toHaveAttribute('selected', '');
  });
});
