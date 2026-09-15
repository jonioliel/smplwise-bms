import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend connected to the lab Home Assistant (T023/T024/T025):
// the synced catalogue, an entity placed on the real floor plan with its live state, the action path
// (refused as bridge_not_paired until the integration is installed) and the settings bridge tab.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy, HA_URL/HA_TOKEN in the backend env).
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Entity names and plans are customer data: this evidence stays in the gitignored private-evidence/.
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T025-live');

test.describe('home assistant bridge evidence', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('catalogue is the synced mirror of Home Assistant', async ({ page, request }, testInfo) => {
    const status = await (await request.get('/api/v1/ha/status')).json();
    expect(status.configured).toBeTruthy();
    expect(status.sync.connected).toBeTruthy();
    expect(status.sync.entities).toBeGreaterThan(100);
    const cat = await (await request.get('/api/v1/ha/entities?limit=5')).json();
    expect(Object.keys(cat.domains).length).toBeGreaterThan(3);
    expect(cat.entities[0]).toHaveProperty('fresh', true);
    await open(page, '/explore/entities');
    await page.waitForTimeout(1500);
    const shell = page.locator('explore-entities');
    await expect(shell.locator('sw-table tbody tr').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `catalogue-${testInfo.project.name}.png`) });
    // domain filter narrows the table server-side
    await shell.locator('sw-chip', { hasText: 'lock' }).first().click();
    await page.waitForTimeout(900);
    const rows = shell.locator('sw-table tbody tr');
    expect(await rows.count()).toBe(cat.domains.lock);
    await rows.first().click();
    await page.waitForTimeout(600);
    await expect(shell.locator('sw-drawer')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `catalogue-drawer-${testInfo.project.name}.png`) });
  });

  test('entity on the map: live state, actions refused until the bridge is paired', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    let placed: { floor: string; entity: string } | null = null;
    for (const f of floors) {
      const map = await (await request.get(`/api/v1/floors/${f.id}/map`)).json();
      const a = map.anchors.find((x: { resource_type: string; entity?: unknown }) => x.resource_type === 'ha_entity' && x.entity);
      if (a) {
        placed = { floor: f.id, entity: a.resource_id };
        expect(map.ha_sync.connected).toBeTruthy();
        expect(a.entity.state).toBeTruthy();
        break;
      }
    }
    expect(placed, 'place an entity on a floor first (plan editor → הוספת ישות)').not.toBeNull();
    await open(page, `/explore/floors/${placed!.floor}`);
    await page.waitForTimeout(1500);
    const fm = page.locator('explore-floor-map');
    const marker = fm.locator('sw-plan-canvas g.marker').filter({ has: page.locator('text') }).last();
    await fm.locator('sw-plan-canvas g.marker').last().click({ force: true });
    await page.waitForTimeout(800);
    const card = fm.locator('sw-popover, sw-drawer').first();
    await expect(card).toBeVisible();
    await expect(card.locator('sw-badge').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `map-entity-card-${testInfo.project.name}.png`) });
    void marker;
    // a non-sensitive action is sent and comes back refused (no integration yet) — recorded and audited server-side
    const status = await (await request.get('/api/v1/ha/status')).json();
    if (!status.bridge.paired) {
      const buttons = card.locator('sw-button');
      const n = await buttons.count();
      let clicked = false;
      for (let i = 0; i < n; i++) {
        const label = (await buttons.nth(i).textContent())?.trim();
        if (label && label !== 'עריכה' && label !== 'צפייה חיה' && label !== 'פתיחה') {
          await buttons.nth(i).click();
          clicked = true;
          break;
        }
      }
      if (clicked) {
        await page.waitForTimeout(1500);
        await expect(card.getByText(/אינו מצומד/)).toBeVisible();
        await page.screenshot({ path: path.join(OUT, `map-action-not-paired-${testInfo.project.name}.png`) });
      }
    }
  });

  test('settings: bridge tab shows sync and pairing state', async ({ page }, testInfo) => {
    await open(page, '/system/diagnostics');
    await page.locator('system-diagnostics sw-tabs').getByText('גשר Home Assistant').click();
    await page.waitForTimeout(1500);
    const sd = page.locator('system-diagnostics');
    await expect(sd.getByText('סנכרון מצבים (WebSocket)')).toBeVisible();
    await expect(sd.getByText('קוד צימוד')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `settings-bridge-${testInfo.project.name}.png`), fullPage: true });
  });
});
