import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';

// BOARD-ANSWERS-2400 evidence (owner answers 04.11, Q16 = A), the REAL build against fake data: in Settings › Notice board a picked
// on / off source carries a "הפוך" checkbox, saved at once as `<kind>_inverted`; a number source has none.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-board-answers-2400.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/board-answers-2400');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: [],
  parking_entities: ['sensor.lot_free', 'binary_sensor.spot_1'], gym_entities: ['input_boolean.gym_closed'],
  parking_inverted: [] as string[], gym_inverted: ['input_boolean.gym_closed'],
};
const INFO_ENTITIES = {
  parking: [{ entity_id: 'sensor.lot_free', name: 'חניון: מקומות פנויים', domain: 'sensor' }, { entity_id: 'binary_sensor.spot_1', name: 'מקום חניה 1', domain: 'binary_sensor' }],
  gym: [{ entity_id: 'input_boolean.gym_closed', name: 'חדר כושר סגור', domain: 'input_boolean' }],
};

async function install(page: Page): Promise<{ method: string; path: string; body: unknown }[]> {
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'], count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
  const calls: { method: string; path: string; body: unknown }[] = [];
  let st = { ...SETTINGS };
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' ? null : req.postDataJSON(); } catch { body = null; }
    calls.push({ method, path: p, body });
    if (p === 'notices/module') return json(route, { enabled: true, can: CAN });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: st, can: CAN, weather_entities: [], info_entities: INFO_ENTITIES, company_logo: false, listener: true, building_fallback: 'מגדל הים' });
    if (p === 'notices/settings') { st = { ...st, ...(body as object) }; return json(route, { settings: st }); }
    if (p === 'notices' && method === 'GET') return json(route, { notices: [], can: CAN, now: '2026-11-04T06:12:00Z', defaults: { default_days: 7, default_severity: 'info' } });
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards: [], full: true, max: 10, remote: false });
    if (p === 'notices/audience/options') return json(route, { floors: [], groups: [], roles: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return calls;
}

test('settings: "הפוך" on a picked on / off source, saved at once; a number source has none', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const box = page.locator('sw-app system-notices notice-info-sources');
  await expect(box).toBeVisible();
  const parking = box.locator('[data-info-source="parking"]');
  const gym = box.locator('[data-info-source="gym"]');
  await expect(parking.locator('[data-info-source-item="sensor.lot_free"] [data-info-source-invert]')).toHaveCount(0);
  const spot = parking.locator('[data-info-source-item="binary_sensor.spot_1"] [data-info-source-invert]');
  await expect(spot).not.toBeChecked();
  await expect(gym.locator('[data-info-source-item="input_boolean.gym_closed"] [data-info-source-invert]')).toBeChecked();
  await expect(parking.locator('[data-info-source-invert-hint]')).toContainText('פעיל = פנוי');
  await spot.check();
  await expect.poll(() => calls.filter((c) => c.method === 'PATCH' && c.path === 'notices/settings').map((c) => c.body).at(-1)).toEqual({ parking_inverted: ['binary_sensor.spot_1'] });
  await gym.locator('[data-info-source-item="input_boolean.gym_closed"] [data-info-source-invert]').uncheck();
  await expect.poll(() => calls.filter((c) => c.method === 'PATCH' && c.path === 'notices/settings').map((c) => c.body).at(-1)).toEqual({ gym_inverted: [] });
  expect(await box.evaluate((el) => el.shadowRoot?.textContent ?? '')).not.toMatch(/Home Assistant|\bHA\b/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  fs.mkdirSync(OUT, { recursive: true });
  await box.screenshot({ path: path.join(OUT, `invert-${test.info().project.name}.png`) });
});
