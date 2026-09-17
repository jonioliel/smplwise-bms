import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for R3 (0.1.70) against the running developer backend: the lighting tool lists switches only, the other
// tool lists any HA entity, the manual name is edited from the card and shows on the map and in the side list.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

test.describe('owner round 7: HA entity tools and card (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('lighting tool = switches only; other tool = any domain', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    const ents = (await (await request.get('/api/v1/ha/entities?limit=500')).json()).entities as { entity_id: string; domain: string }[];
    test.skip(!ents.some((e) => e.domain === 'switch'), 'no switch entities in the dev catalogue');
    await open(page, `/explore/floors/${floor.id}/edit`);
    const editor = page.locator('explore-plan-editor');
    await editor.locator('[data-tool="lights"]').click();
    const panel = editor.locator('[data-tool-panel="lights"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.list button').first()).toBeVisible({ timeout: 15000 });
    const ids = await panel.locator('.list button .ltr').allTextContents();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.trim().startsWith('switch.')).toBeTruthy();
    await page.screenshot({ path: path.join(OUT, `lights-tool-${testInfo.project.name}.png`) });
    await editor.locator('[data-tool="entity"]').click();
    const other = editor.locator('[data-tool-panel="entity"]');
    await expect(other).toBeVisible();
    await expect(other.locator('.list button').first()).toBeVisible({ timeout: 15000 });
    const ids2 = await other.locator('.list button .ltr').allTextContents();
    expect(ids2.some((id) => !id.trim().startsWith('switch.'))).toBeTruthy();
  });

  test('rename from the card: map label, side list and API', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    let floor: { id: string } | undefined;
    let anchor: { id: string; resource_id: string; label: string | null; revision: number } | undefined;
    for (const f of floors.filter((x: { has_plan: boolean }) => x.has_plan)) {
      const map = await (await request.get(`/api/v1/floors/${f.id}/map`)).json();
      const a = map.anchors.find((x: { resource_type: string; entity: unknown }) => x.resource_type === 'ha_entity' && x.entity);
      if (a) { floor = f; anchor = a; break; }
    }
    test.skip(!anchor, 'no placed HA entity on a floor with a plan');
    const before = anchor!.label;
    const name = `מפסק בדיקה ${Date.now() % 1000}`;
    try {
      await open(page, `/explore/floors/${floor!.id}`);
      const viewer = page.locator('explore-floor-map');
      await expect(viewer.locator('[data-sidelist-toggle]')).toBeVisible({ timeout: 30000 });
      await expect(viewer.locator('[data-floorchip]')).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(800);
      if (!(await viewer.locator('[data-sidelist]').isVisible())) await viewer.locator('[data-sidelist-toggle]').click();
      await viewer.locator(`[data-side-entity="${anchor!.resource_id}"]`).click();
      await expect(viewer.locator('[data-entity-card]')).toBeVisible({ timeout: 15000 });
      await viewer.locator('[data-rename]').click();
      const form = viewer.locator('[data-rename-form]');
      await expect(form).toBeVisible();
      await form.locator('input').fill(name);
      await form.locator('[data-rename-save]').click();
      await expect(viewer.locator('[data-notice]')).toContainText('נשמר', { timeout: 15000 });
      await expect(viewer.locator(`[data-side-entity="${anchor!.resource_id}"] .nm`)).toHaveText(name);
      const saved = (await (await request.get(`/api/v1/floors/${floor!.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor!.id);
      expect(saved.label).toBe(name);
      await page.screenshot({ path: path.join(OUT, `entity-card-${testInfo.project.name}.png`) });
    } finally {
      const cur = (await (await request.get(`/api/v1/floors/${floor!.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor!.id);
      if (cur) await request.patch(`/api/v1/map-anchors/${anchor!.id}`, { data: { revision: cur.revision, label: before } });
    }
  });
});
