import { test, expect, type Page } from '@playwright/test';
import { FLOOR, ZONE_FREE, ZONE_LINKED, installK88Mock } from './k88-mocks';

// K88 (2.0.1) - Plan Studio advanced, on a mocked backend (k88-mocks.ts): the room <-> area link on the map (the room card
// and its "פתח אזור"), the floor's own picture under the state layer and its layer toggle, "הצג על המפה" from the area
// page and its live plan card, the devices screen's plan view with the area summary on a room tap, the settings map tab
// (plan.surfaces and the link table with "אשר הצעות"), and the phone pass (the side list as a bottom sheet, the short
// landscape form). The built app on the preview server; no device, no platform.

async function open(page: Page, hash: string) {
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const deep = `(root, sel) => { const seen = new Set(); const walk = (n) => { if (!n || seen.has(n)) return null; seen.add(n); const hit = n.querySelector?.(sel); if (hit) return hit; for (const c of n.querySelectorAll?.('*') ?? []) { if (c.shadowRoot) { const h = walk(c.shadowRoot); if (h) return h; } } return null; }; return walk(root); }`;

test.describe('floor map', () => {
  test('a room tap opens the room card; a linked room offers its area; the own picture is a layer', async ({ page }) => {
    await installK88Mock(page);
    await open(page, `/explore/floors/${FLOOR}`);
    const map = page.locator('explore-floor-map');
    const canvas = map.locator('sw-plan-canvas');
    await expect(canvas.locator('[data-zone]')).toHaveCount(2);
    // the own picture, placed by its corners (an affine transform, not the identity), under the rooms
    const img = canvas.locator('[data-floor-image]');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('transform', /^matrix\(0\.9 0 0 0\.9 60 40\)$/);
    await expect(canvas.locator('[data-floor-image-off]')).toHaveCount(1);
    // the linked room: the card with the way to the area
    await canvas.locator(`[data-zone="${ZONE_LINKED}"] [data-zone-body]`).click({ position: { x: 10, y: 10 } });
    const card = map.locator('[data-room-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-zone-id', ZONE_LINKED);
    await expect(card.locator('[data-room-open-area]')).toHaveAttribute('href', '#/devices/areas/living');
    // the unlinked room: the card without the link
    await canvas.locator(`[data-zone="${ZONE_FREE}"] [data-zone-body]`).click({ position: { x: 10, y: 10 } });
    await expect(map.locator('[data-room-card]')).toHaveAttribute('data-zone-id', ZONE_FREE);
    await expect(map.locator('[data-room-open-area]')).toHaveCount(0);
    // the layer toggle hides the picture
    const toggle = map.locator('.layers button[title="תמונת הקומה"]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(canvas.locator('[data-floor-image]')).toHaveCount(0);
    await toggle.click();
    await expect(canvas.locator('[data-floor-image]')).toHaveCount(1);
  });

  test('without an own picture the layer button is not offered', async ({ page }) => {
    await installK88Mock(page, { images: false });
    await open(page, `/explore/floors/${FLOOR}`);
    const map = page.locator('explore-floor-map');
    await expect(map.locator('sw-plan-canvas [data-zone]')).toHaveCount(2);
    await expect(map.locator('.layers button[title="תמונת הקומה"]')).toHaveCount(0);
    await expect(map.locator('sw-plan-canvas [data-floor-image]')).toHaveCount(0);
  });

  test('?zone= focuses the linked room (the "הצג על המפה" target)', async ({ page }) => {
    await installK88Mock(page);
    await open(page, `/explore/floors/${FLOOR}?zone=${ZONE_LINKED}`);
    const map = page.locator('explore-floor-map');
    await expect(map.locator(`sw-plan-canvas [data-zone="${ZONE_LINKED}"]`)).toHaveClass(/selected/);
    await expect(map.locator('[data-room-card] [data-room-open-area]')).toHaveAttribute('href', '#/devices/areas/living');
  });
});

test.describe('devices screens', () => {
  test('the area page offers "הצג על המפה" and carries the live plan card', async ({ page }) => {
    await installK88Mock(page);
    await open(page, '/devices/areas/living');
    const area = page.locator('devices-area');
    await expect(area.locator('[data-show-on-map]')).toBeVisible();
    const card = area.locator('[data-area-plan-card]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-area-plan-open]')).toHaveAttribute('href', `#/explore/floors/${FLOOR}?zone=${ZONE_LINKED}`);
    const embedded = card.locator('explore-floor-map');
    await expect(embedded).toHaveAttribute('embedded', '');
    await expect(embedded).toHaveAttribute('compact', '');
    await expect(embedded.locator(`sw-plan-canvas [data-zone="${ZONE_LINKED}"]`)).toHaveClass(/selected/);
    await expect(embedded.locator('[data-head] h1')).toHaveCount(0); // no title / crumbs inside a card
    // the popover of the area's actions links to the map too
    await area.locator('[data-bulk-area] sw-button').first().click();
    await expect(area.locator('[data-open-map]')).toHaveAttribute('href', `#/explore/floors/${FLOOR}?zone=${ZONE_LINKED}`);
    await page.keyboard.press('Escape');
    // "הצג על המפה" goes to the map with the room focused
    await area.locator('[data-show-on-map]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/explore/floors/${FLOOR}?zone=${ZONE_LINKED}`);
  });

  test('the area page has no plan card when plan.surfaces leaves it out', async ({ page }) => {
    await installK88Mock(page, { surfaces: ['devices'] });
    await open(page, '/devices/areas/living');
    const area = page.locator('devices-area');
    await expect(area.locator('[data-show-on-map]')).toBeVisible();
    await expect(area.locator('[data-area-plan-card]')).toHaveCount(0);
  });

  test('the building screen shows the plan view with the tree at the side; a room tap opens the area summary', async ({ page }) => {
    await installK88Mock(page);
    await page.addInitScript(() => localStorage.setItem('sw.devices.layout', 'plan'));
    await open(page, '/devices/building');
    const building = page.locator('devices-building');
    const view = building.locator('[data-plan-view]');
    await expect(view).toBeVisible();
    await expect(building.locator('[data-layout-view="plan"] [data-devices-tree]')).toBeVisible();
    const embedded = view.locator('explore-floor-map[data-plan-map]');
    await expect(embedded).toHaveAttribute('embedded', '');
    await expect(view.locator('[data-plan-floors] button')).toHaveCount(2);
    await expect(view.locator('[data-plan-floors] button.on')).toHaveAttribute('data-plan-floor', FLOOR); // the floor the areas link to
    await embedded.locator(`sw-plan-canvas [data-zone="${ZONE_LINKED}"] [data-zone-body]`).click({ position: { x: 10, y: 10 } });
    const pop = view.locator('[data-plan-pop-menu]');
    await expect(pop).toHaveCount(1);
    await expect(pop.locator('[data-open-area]')).toHaveAttribute('href', '#/devices/areas/living');
    await expect(pop.locator('[data-chip]').first()).toBeVisible();
    // the tree row's popover carries the map link
    await expect(building.locator('[data-tree-area="living"]')).toHaveAttribute('maphref', `#/explore/floors/${FLOOR}?zone=${ZONE_LINKED}`);
    await expect(building.locator('[data-tree-area="kitchen"]')).toHaveAttribute('maphref', '');
  });

  test('the plan view is not offered when plan.surfaces leaves it out (a stored choice falls back)', async ({ page }) => {
    await installK88Mock(page, { surfaces: ['area'] });
    await page.addInitScript(() => localStorage.setItem('sw.devices.layout', 'plan'));
    await open(page, '/devices/building');
    const building = page.locator('devices-building');
    await expect(building.locator('[data-devices-tree]')).toBeVisible();
    await expect(building.locator('[data-plan-view]')).toHaveCount(0);
    await expect(building.locator('[data-layout-view="cards"]')).toHaveCount(1);
  });
});

test.describe('settings', () => {
  test('plan.surfaces is saved per place; the link table proposes by name and applies the ticked rows', async ({ page }) => {
    const st = await installK88Mock(page);
    await open(page, '/system/diagnostics?tab=map');
    const diag = page.locator('system-diagnostics');
    const row = diag.locator('[data-plan-surfaces]');
    await expect(row).toBeVisible();
    await expect(row.locator('[data-set-plan-surface="devices"]')).toBeChecked();
    await expect(row.locator('[data-set-plan-surface="area"]')).toBeChecked();
    await row.locator('[data-set-plan-surface="area"]').uncheck();
    await diag.locator('[data-save-map]').click();
    await expect.poll(() => st.settingsPatches.length).toBe(1);
    expect(st.settingsPatches[0]).toEqual({ 'plan.surfaces': ['devices'] });
    // the link table: the linked room, the suggestion for the unlinked one
    const admin = diag.locator('plan-area-links-admin');
    await expect(admin.locator('[data-area-links-table] [data-area-link-row]')).toHaveCount(2);
    await expect(admin.locator(`[data-area-link-row="${ZONE_LINKED}"]`)).toHaveAttribute('data-status', 'linked');
    const free = admin.locator(`[data-area-link-row="${ZONE_FREE}"]`);
    await expect(free).toHaveAttribute('data-status', 'suggested');
    await expect(free.locator('[data-area-link-suggestion]')).toContainText('מחסן');
    await expect(admin.locator('[data-area-links-counts]')).toContainText('הצעות 1');
    await free.locator('input[type="checkbox"]').check();
    await admin.locator('[data-area-links-accept]').click();
    await expect.poll(() => st.linkPosts.length).toBe(1);
    expect(st.linkPosts[0]).toEqual({ links: [{ zone_id: ZONE_FREE, area_id: 'store' }] });
    await expect(free).toHaveAttribute('data-status', 'linked');
    await expect(admin.locator('[data-area-links-counts]')).toContainText('מקושרים 2');
    // unlink from the row
    await free.locator('[data-area-link-clear]').click();
    await expect.poll(() => st.linkPosts.length).toBe(2);
    expect(st.linkPosts[1]).toEqual({ links: [{ zone_id: ZONE_FREE, area_id: null }] });
    await expect(free).toHaveAttribute('data-status', 'suggested');
  });
});

test.describe('phone pass', () => {
  test.skip(({ viewport }) => !viewport || viewport.width > 500, 'phone project only');

  test('the side list is a bottom sheet over the lower part of the map; the tool row fades at its edges', async ({ page }) => {
    await installK88Mock(page);
    await open(page, `/explore/floors/${FLOOR}`);
    const map = page.locator('explore-floor-map');
    await expect(map.locator('sw-plan-canvas [data-zone]')).toHaveCount(2);
    await map.locator('[data-sidelist-toggle]').click();
    const sheet = map.locator('[data-sidelist]');
    await expect(sheet).toBeVisible();
    const stage = await map.locator('[data-stage]').boundingBox();
    const box = await sheet.boundingBox();
    expect(stage && box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(stage!.width - 4); // full width
    expect(Math.abs(box!.y + box!.height - (stage!.y + stage!.height))).toBeLessThan(3); // at the bottom
    expect(box!.height).toBeLessThan(stage!.height * 0.45); // most of the map stays visible
    await sheet.locator('[data-sheet-grab]').click();
    await expect(sheet).toHaveAttribute('data-sheet-tall', '1');
    const tall = await sheet.boundingBox();
    expect(tall!.height).toBeGreaterThan(box!.height);
    const mask = await map.locator('[data-tools]').evaluate((n) => getComputedStyle(n).maskImage || (getComputedStyle(n) as unknown as { webkitMaskImage: string }).webkitMaskImage);
    expect(mask).toContain('linear-gradient');
  });

  test('a short landscape viewport keeps the map and drops the title block', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await installK88Mock(page);
    await open(page, `/explore/floors/${FLOOR}`);
    const map = page.locator('explore-floor-map');
    await expect(map.locator('sw-plan-canvas [data-zone]')).toHaveCount(2);
    await expect(map.locator('.crumbs')).toBeHidden();
    const head = await map.locator('[data-head]').boundingBox();
    expect(head!.height).toBeLessThan(64);
    const stage = await map.locator('[data-stage]').boundingBox();
    expect(stage!.height).toBeGreaterThan(200);
  });
});

test.describe('3D night mode', () => {
  test('the night chip switches the 3D to its night look and remembers it', async ({ page }) => {
    await page.goto('/#/styleguide');
    await page.waitForSelector('styleguide-screen');
    await page.locator('styleguide-screen [data-3d-demo-load]').click();
    const el = page.locator('styleguide-screen sw-plan-3d');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).not.toHaveAttribute('data-night', '');
    await el.locator('[data-night-toggle]').click();
    await expect(el).toHaveAttribute('data-night', '');
    expect(await page.evaluate(() => localStorage.getItem('sw.plan3d.night'))).toBe('1');
    const bg = await el.evaluate((n) => getComputedStyle(n).backgroundImage);
    expect(bg).toContain('linear-gradient');
    await el.locator('[data-night-toggle]').click();
    await expect(el).not.toHaveAttribute('data-night', '');
    expect(await page.evaluate(() => localStorage.getItem('sw.plan3d.night'))).toBeNull();
  });
});
