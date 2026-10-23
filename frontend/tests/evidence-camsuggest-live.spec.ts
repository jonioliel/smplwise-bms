import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// CAMSUGGEST138-295 (board r138): the zone inspector's "suggest nearby camera" block and the Settings > Map rows, against the
// fixture backend (SW_LIVE=1). The spec builds its own site / floor / plan / zone / camera pins and removes them at the end.
// Looks: the block is present, shows at most three rows, nothing is saved by asking, accept saves, the page does not
// overflow sideways; light and dark. Pictures go to the test output.
const ED = 'explore-plan-editor';
const ids = { site: '', building: '', floor: '', zone: '' };
const cams: string[] = [];
let api: APIRequestContext;

test.describe.serial('zone: suggest nearby camera', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת מצלמה ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת הצעות', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    const v = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${v}/publish`)).status()).toBe(200);
    const sq = [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.6, y: 0.6 }, { x: 0.4, y: 0.6 }];
    ids.zone = (await (await api.post(`api/v1/floors/${ids.floor}/zones`, { data: { name: 'לובי הצעות', kind: 'room', polygon: sq } })).json()).id;
    // four pins: three near the zone (one inside, one facing it, one facing away), one far beyond the default range
    const pins: [string, number, number, number, number | null][] = [['inside', 0.5, 0.5, 0, 90], ['facing', 0.25, 0.5, 90, 90], ['away', 0.3, 0.5, 270, 90], ['far', 0.95, 0.95, 0, 90]];
    for (const [i, [alias, x, y, rot, fov]] of pins.entries()) {
      const cam = (await (await api.post('api/v1/cameras', { data: { channel: 40 + i, alias: `הצעה ${alias}` } })).json()).id as string;
      cams.push(cam);
      const r = await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: cam, x, y, rotation_degrees: rot, field_of_view_degrees: fov } });
      expect(r.status()).toBe(201);
    }
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (ids.zone) await api.delete(`api/v1/zones/${ids.zone}`);
      if (ids.floor) await api.delete(`api/v1/floors/${ids.floor}?force=true`);
      if (ids.building) await api.delete(`api/v1/buildings/${ids.building}`);
      if (ids.site) await api.delete(`api/v1/sites/${ids.site}`);
      for (const c of cams) await api.delete(`api/v1/cameras/${c}`);
    } finally {
      await api.dispose();
    }
  });

  async function openZone(page: Page) {
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit?zone=${ids.zone}`);
    await expect(page.locator(`${ED} [data-zone-inspector]`)).toBeVisible({ timeout: 20000 });
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`ask, three rows at most, accept saves (${scheme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openZone(page);
      const block = page.locator(`${ED} [data-cam-suggest]`);
      await expect(block).toBeVisible();
      await expect(block.locator('[data-cam-suggestion]')).toHaveCount(0); // nothing offered until asked
      expect((await (await api.get(`api/v1/zones/${ids.zone}/suggested-camera`)).json()).anchor_id).toBeNull();
      await block.locator('[data-cam-suggest-ask]').click();
      const rows = block.locator('[data-cam-suggestion]');
      const n = await rows.count();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
      await expect(block).not.toContainText('הצעה far');
      // the block and its accept buttons are inside the viewport and the page does not scroll sideways
      const vp = page.viewportSize()!;
      const box = (await rows.first().boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`camsuggest-${scheme}.png`) });
      await rows.first().locator('[data-cam-suggest-accept]').click();
      await expect(block.locator('[data-zone-camera]')).toBeVisible({ timeout: 10000 });
      const link = (await (await api.get(`api/v1/zones/${ids.zone}/suggested-camera`)).json()) as { anchor_id: string | null };
      expect(link.anchor_id).not.toBeNull();
      await expect(block.locator('[data-cam-suggestion]')).toHaveCount(0); // the list closes after accept
      await block.locator('[data-cam-suggest-clear]').click();
      await expect(block.locator('[data-zone-camera]')).toHaveCount(0, { timeout: 10000 });
      expect((await (await api.get(`api/v1/zones/${ids.zone}/suggested-camera`)).json()).anchor_id).toBeNull();
    });
  }

  test('Settings > Map: the three rows save the installation defaults', async ({ page }, testInfo) => {
    await page.goto('/?design=a#/system/diagnostics?tab=map');
    const map = page.locator('system-diagnostics [data-settings-map]');
    await expect(map).toBeVisible({ timeout: 20000 });
    for (const k of ['distance', 'fov', 'count']) await expect(map.locator(`[data-camsuggest-${k}]`)).toBeVisible();
    await map.locator('select[data-set="camsuggest-distance"]').selectOption('20');
    await map.locator('select[data-set="camsuggest-count"]').selectOption('2');
    await page.screenshot({ path: testInfo.outputPath('camsuggest-settings.png') });
    await map.locator('[data-save-map]').click();
    await expect.poll(async () => ((await (await api.get('api/v1/settings')).json()) as { settings: Record<string, string> }).settings['plan.camsuggest_distance']).toBe('20');
    // put the defaults back so the installation is as it was
    await map.locator('select[data-set="camsuggest-distance"]').selectOption('35');
    await map.locator('select[data-set="camsuggest-count"]').selectOption('3');
    await map.locator('[data-save-map]').click();
    await expect.poll(async () => ((await (await api.get('api/v1/settings')).json()) as { settings: Record<string, string> }).settings['plan.camsuggest_count']).toBe('3');
  });
});
