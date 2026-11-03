import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { lobbyFeed } from './notice-tv-fixtures';

// TV-CHIPS-2381 evidence (owner answers 03.11), the REAL build against fake data (the notices routes layered on the generator mock):
//  - Q3 = B: a board's "מצב הבניין" list is ordered (move up / down = the priority of the portrait one-row footer) and is saved in that order;
//  - Q4 = A: Settings › Notice board offers the parking / gym chip sources (entities of the system, saved at once), and a picked parking /
//    gym chip without a source says it will not show.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tv-chips-2381.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/tv-chips-2381');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: 'weather.home', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: [],
  parking_entities: ['sensor.lot_free'], gym_entities: [] as string[],
};
const INFO_ENTITIES = {
  parking: [{ entity_id: 'sensor.lot_free', name: 'חניון: מקומות פנויים', domain: 'sensor' }, { entity_id: 'binary_sensor.spot_1', name: 'מקום חניה 1', domain: 'binary_sensor' }],
  gym: [{ entity_id: 'input_boolean.gym_open', name: 'חדר כושר פתוח', domain: 'input_boolean' }, { entity_id: 'schedule.gym_hours', name: 'שעות חדר הכושר', domain: 'schedule' }],
};
const BOARD = { id: 'b1', name: 'לוח הלובי', slug: 'lobby', enabled: true, display: { ...lobbyFeed().board.display, blocks: { ...lobbyFeed().board.display.blocks, info: ['elevators', 'generator', 'parking', 'gym'] } },
  has_token: true, token_rotated_at: '2026-10-15T08:00:00Z', last_seen_at: '2026-10-23T06:11:40Z', item_count: 0, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-23T06:12:00Z' };

async function install(page: Page, settings: Partial<typeof SETTINGS> = {}): Promise<{ method: string; path: string; body: unknown }[]> {
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'], count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
  const calls: { method: string; path: string; body: unknown }[] = [];
  let st = { ...SETTINGS, ...settings };
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' ? null : req.postDataJSON(); } catch { body = null; }
    calls.push({ method, path: p, body });
    if (p === 'notices/module') return json(route, { enabled: true, can: CAN });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: st, can: CAN, weather_entities: [{ entity_id: 'weather.home', name: 'בית' }], info_entities: INFO_ENTITIES, company_logo: false, listener: true, building_fallback: 'מגדל הים' });
    if (p === 'notices/settings') { st = { ...st, ...(body as object) }; return json(route, { settings: st }); }
    if (p === 'notices' && method === 'GET') return json(route, { notices: [], can: CAN, now: '2026-10-23T06:12:00Z', defaults: { default_days: 7, default_severity: 'info' } });
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards: [BOARD], full: true, max: 10, remote: false });
    if (p === 'notices/boards/b1' && method === 'GET') return json(route, { board: BOARD, notices: [] });
    if (p === 'notices/boards/b1' && method === 'PATCH') return json(route, { board: { ...BOARD, display: { ...BOARD.display, ...((body as { display?: object }).display ?? {}) } } });
    if (p === 'notices/boards/b1/preview') return json(route, lobbyFeed(((body as { display?: object } | null)?.display ?? {}) as never));
    if (p === 'notices/audience/options') return json(route, { floors: [], groups: [], roles: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return calls;
}

async function noOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('settings: the parking / gym sources - listed by name, added and removed, saved at once, no platform words', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const box = page.locator('sw-app system-notices notice-info-sources');
  await expect(box).toBeVisible();
  const parking = box.locator('[data-info-source="parking"]');
  const gym = box.locator('[data-info-source="gym"]');
  await expect(parking.locator('[data-info-source-item="sensor.lot_free"]')).toContainText('חניון: מקומות פנויים');
  await expect(gym.locator('[data-info-source-none]')).toHaveText('לא נבחרה ישות');
  // the pick list offers only what is not picked yet
  await expect(parking.locator('select option')).toHaveCount(2);
  await gym.locator('select').selectOption('schedule.gym_hours');
  await gym.locator('[data-info-source-add]').click();
  await expect.poll(() => calls.filter((c) => c.method === 'PATCH' && c.path === 'notices/settings').map((c) => c.body)).toEqual([{ gym_entities: ['schedule.gym_hours'] }]);
  await expect(gym.locator('[data-info-source-item="schedule.gym_hours"]')).toContainText('שעות חדר הכושר');
  await parking.locator('[data-info-source-item="sensor.lot_free"] button').click();
  await expect.poll(() => calls.filter((c) => c.method === 'PATCH' && c.path === 'notices/settings').map((c) => c.body).at(-1)).toEqual({ parking_entities: [] });
  await expect(parking.locator('[data-info-source-none]')).toBeVisible();
  expect(await box.evaluate((el) => el.shadowRoot?.textContent ?? '')).not.toMatch(/Home Assistant|\bHA\b/);
  await noOverflow(page);
  fs.mkdirSync(OUT, { recursive: true });
  await box.screenshot({ path: path.join(OUT, `sources-${test.info().project.name}.png`) });
});

test('board: the chip list is ordered - move up / down, saved in that order; a gym chip without a source says so', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  const picker = root.locator('notice-display-info');
  const order = () => picker.locator('[data-info-row]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.infoRow));
  await expect.poll(order).toEqual(['elevators', 'generator', 'parking', 'gym']);
  await expect(picker.locator('[data-info-up="elevators"]')).toBeDisabled();
  await expect(picker.locator('[data-info-down="gym"]')).toBeDisabled();
  await expect(picker.locator('[data-info-no-source="gym"]')).toBeVisible(); // no gym source in the settings
  await expect(picker.locator('[data-info-no-source="parking"]')).toHaveCount(0);
  await expect(picker.locator('[data-info-up="parking"]')).toHaveAttribute('aria-label', 'הזזה למעלה: חניה פנויה');
  await picker.locator('[data-info-up="parking"]').click();
  await picker.locator('[data-info-up="parking"]').click();
  await expect.poll(order).toEqual(['parking', 'elevators', 'generator', 'gym']);
  await picker.locator('[data-info="gym"]').uncheck();
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: { blocks?: { info?: string[] } } } | undefined)?.display?.blocks?.info)
    .toEqual(['parking', 'elevators', 'generator']);
  await expect(picker.locator('[data-info-order-hint]')).toContainText('סדר העדיפות');
  await noOverflow(page);
  fs.mkdirSync(OUT, { recursive: true });
  await picker.screenshot({ path: path.join(OUT, `order-${test.info().project.name}.png`) });
});
