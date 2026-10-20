import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';

// CR-INFRA-ELEVATORS evidence: תשתיות › מעליות and הגדרות › תשתיות › מעליות from the REAL build against fake data. The generator mock layer serves
// the session (me, prefs, settings); the elevator routes are layered on top (a later page.route wins). Fake data only.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-elevators.spec.ts
// The home tiles need the devices-tree mocks of the home specs and are covered by the node-only unit spec (unit-elevators.spec.ts).
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/elevators');
const NOW = '2026-10-18T09:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// 2.8.0: the owner's sensor set (waiting / fault / fire service / shutdown - no up / down), the lights and the 24-hour history
const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string) => ({
  state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history: [{ state: 'waiting', from: '2026-10-17T09:00:00Z', to: '2026-10-18T06:00:00Z' }, { state, from: '2026-10-18T06:00:00Z', to: NOW }],
});
const ELEVATORS = [
  { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('active') },
  { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault') },
  { id: 'e4', name: 'מעלית משא', area_id: null, area_name: 'בניין B', ...live('out_of_service') },
  { id: 'e5', name: 'מעלית דרום', area_id: null, area_name: 'בניין A', ...live('fire_service') },
  { id: 'e3', name: 'מעלית שירות', area_id: null, area_name: null, ...live('unknown') },
];

async function install(page: Page, list: typeof ELEVATORS) {
  await installGeneratorMock(page, { perms: ['devices.read', 'infra.elevators.manage'], count: 0 });
  await page.route('**/api/v1/infra/elevators**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/elevators') return json(route, { elevators: list, summary: {}, stale: false, at: NOW });
    if (p === 'infra/elevators/manage') {
      return json(route, { roles: [], max_extras: 4, elevators: list.map((e, i) => ({ ...e, enabled: true, sort_order: i, revision: 1, extras: [], sensors: { fault: { entity_id: `binary_sensor.${e.id}_fault`, entity_name: `${e.name} תקלה`, missing: false } } })) });
    }
    if (p === 'infra/elevators/candidates') return json(route, { items: [{ entity_id: 'binary_sensor.e1_fault', name: 'מעלית צפונית תקלה', device_class: 'problem', area_name: 'לובי' }] });
    return json(route, { code: 'elevator_not_found', user_message: 'המעלית לא נמצאה.', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

test.describe('elevators evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    test(`infrastructure list (${scheme})`, async ({ page }) => {
      await install(page, ELEVATORS);
      await page.goto('about:blank');
      await page.goto(url('/infra/elevators', 'classic', scheme));
      const rows = page.locator('sw-app infra-elevators [data-elevator]');
      await expect(rows).toHaveCount(5);
      await expect(page.locator('sw-app infra-elevators [data-elevator="e2"]')).toHaveAttribute('data-state', 'fault');
      await expect(page.locator('sw-app infra-elevators [data-elevator="e3"]')).toHaveAttribute('data-state', 'unknown');
      await expect(page.locator('sw-app infra-elevators [data-elevator="e4"]')).toHaveAttribute('data-look', 'off'); // shutdown: its own colour (9a)
      await expect(page.locator('sw-app infra-elevators [data-elevators-kpi="fire"] b')).toHaveText('1');
      await expect(page.locator('sw-app infra-elevators [data-elevator-bar]')).toHaveCount(5);
      await expect(page.locator('sw-app infra-elevators sw-icon[name^="arrow"]')).toHaveCount(0); // never a direction
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(OUT, `infra-${test.info().project.name}-${scheme}.png`) });
    });
  }

  test('door picture: active = shut doors, waiting = open doors (ELEVDOORS-293)', async ({ page }) => {
    await install(page, [
      { id: 'a1', name: 'מעלית צפון 4', area_id: null, area_name: null, ...live('active') },
      { id: 'w1', name: 'מעלית צפון 3', area_id: null, area_name: null, ...live('waiting') },
    ]);
    await page.goto('about:blank');
    await page.goto(url('/infra/elevators', 'classic', 'light'));
    await expect(page.locator('sw-app infra-elevators [data-elevator]')).toHaveCount(2);
    const gap = (id: string) => page.locator(`sw-app infra-elevators [data-elevator="${id}"] .eicon`).evaluate((el) => {
      const [a, b] = Array.from(el.querySelectorAll('u')).map((u) => u.getBoundingClientRect());
      return Math.abs(Math.min(a.left, b.left) === a.left ? b.left - a.right : a.left - b.right);
    });
    await expect(page.locator('sw-app infra-elevators [data-elevator="a1"] .eicon')).toHaveAttribute('data-doors', 'closed');
    await expect(page.locator('sw-app infra-elevators [data-elevator="w1"] .eicon')).toHaveAttribute('data-doors', 'open');
    expect(await gap('a1')).toBeLessThan(4);
    expect(await gap('w1')).toBeGreaterThan(6);
    await page.screenshot({ path: path.join(OUT, `doors-${test.info().project.name}.png`) });
  });

  test('settings: list and the add dialog with one select per role', async ({ page }) => {
    await install(page, ELEVATORS);
    await page.goto('about:blank');
    await page.goto(url('/system/infra/elevators'));
    await expect(page.locator('sw-app elevator-settings [data-elevator]')).toHaveCount(5);
    await page.locator('sw-app elevator-settings [data-elevator-add]').click();
    await expect(page.locator('sw-app elevator-settings [data-roles] select')).toHaveCount(4); // waiting, fault, fire service, shutdown
    await expect(page.locator('sw-app elevator-settings [data-roles-future]')).toBeVisible();
    await expect(page.locator('sw-app elevator-settings [data-elevator-save]')).toBeDisabled(); // no name, no sensor
    await page.screenshot({ path: path.join(OUT, `settings-dialog-${test.info().project.name}.png`) });
  });

  test('no elevators: no infrastructure tab', async ({ page }) => {
    await install(page, []);
    await page.goto('about:blank');
    await page.goto(url('/infra/elevators'));
    await expect(page.locator('sw-app infra-elevators [data-state="empty"]')).toBeVisible();
    await expect(page.locator('sw-app sw-tabs[data-infra-l1]')).toHaveCount(0);
  });
});
