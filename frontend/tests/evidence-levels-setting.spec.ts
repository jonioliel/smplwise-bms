import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// 0.1.89 (owner decision 2026-09-26): the `plan.levels` setting chooses the default levels view on every map - all
// levels together (default value, today's behaviour) or the floor's default level only. The level chips still switch
// levels from there. Against the running backend: the spec builds its own site / building / floor with two levels,
// flips the setting to "default", checks the live map and the editor both open on the floor's default level, then
// restores the setting to "all" and removes its test data. Runs only with SW_LIVE=1 (backend on 8099 behind the
// preview proxy) in real Chrome.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ids = { site: '', building: '', floor: '', version: '', camera: '', camAnchor: '' };
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

// local copies of the evidence-plan-studio-4.spec.ts helpers (Playwright refuses one spec file importing another)
type Desc = { estimated: boolean; parts: { id: string; kind: string; color: string; opacity: number; position: [number, number, number]; rotation: [number, number, number]; level_id: string | null; polygon?: [number, number][]; userData: { id: string; kind: string } }[] };
/** The element's description, read straight off the element (it is a public property). */
const describe3d = (page: Page, host: string) => page.locator(`${host} sw-plan-3d`).evaluate((node) => (node as unknown as { description: Desc }).description);
/** sw-button is not a native control, so toBeEnabled cannot fail on it: the host's disabled attribute can. */
async function expectEnabled(l: Locator, timeout = 30000): Promise<void> {
  await expect(l).toBeAttached({ timeout });
  await expect(l).not.toHaveAttribute('disabled', '', { timeout });
}

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
    // a camera on the non-default level L1: the history map has no level chip to recover it with if the 3D ever
    // culled anchors like the structure (owner review fix, 0.1.89) - anchorsEveryLevel must keep it regardless.
    const cams = (await (await api.get('api/v1/cameras')).json()).cameras as { id: string }[];
    ids.camera = cams[0]?.id ?? (await (await api.post('api/v1/cameras', { data: { channel: 62, alias: 'מצלמת מפלס' } })).json()).id;
    ids.camAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: ids.camera, x: 0.4, y: 0.6, rotation_degrees: 0, field_of_view_degrees: null, level_id: 'L1' } })).json()).id;
    expect(ids.camAnchor).toBeTruthy();
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
    // A goto to the exact URL already loaded is a same-document no-op (no new floor load, no fresh settings fetch);
    // a changing query param forces a real navigation each time, as a different link or a manual reload would.
    const floorUrl = (n: number) => `/?design=a&r=${n}#/explore/floors/${ids.floor}`;

    // baseline: plan.levels is "all" (the setting's default) - both levels' walls show, no chip is selected
    await page.goto(floorUrl(1));
    await waitWalls('explore-floor-map');
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall]')).toHaveCount(2);
    await expect(page.locator('explore-floor-map [data-level-chip="all"]')).toHaveAttribute('selected', '');

    await setLevelsSetting('default');

    // the live map: a fresh floor load opens on L0 (the default level) - only its wall shows, and its chip is active
    await page.goto(floorUrl(2));
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
    await page.goto(floorUrl(3));
    await waitWalls('explore-floor-map');
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-wall]')).toHaveCount(2);
    await expect(page.locator('explore-floor-map [data-level-chip="all"]')).toHaveAttribute('selected', '');
  });

  test('the history map has no level chip to recover a hidden anchor with: its 3D keeps the L1 camera even with plan.levels = default (owner review fix)', async ({ page }) => {
    await setLevelsSetting('default');
    try {
      const t = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${encodeURIComponent(t)}`);
      const host = page.locator('investigate-history-map');
      await expect(host.locator('sw-plan-canvas [data-wall]').first()).toBeAttached({ timeout: 20000 });
      // the 2D structure opens on L0 too (only the anchors are never filtered by level here); the camera marker
      // itself is on screen regardless, since apiMarkers never culls by level - only the 3D anchor cull was the bug
      await expect(host.locator('sw-plan-canvas [data-wall]')).toHaveCount(1);
      await expect(host.locator(`sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`)).toBeAttached();
      const toggle = host.locator('[data-view-3d]');
      await expectEnabled(toggle, 15000);
      await toggle.click();
      await expect(host.locator('sw-plan-3d[data-history-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
      const d = await describe3d(page, 'investigate-history-map');
      expect(d.parts.some((p) => p.id === `cam:${ids.camAnchor}`)).toBe(true); // L1's camera: not silently dropped
      // the structure itself still opens on L0: only the L0 wall's 3D part is present, matching the setting
      const wallIds = new Set(d.parts.filter((p) => p.kind === 'wall').map((p) => p.userData.id));
      expect([...wallIds]).toEqual(['w0']);
    } finally {
      await setLevelsSetting('all');
    }
  });
});
