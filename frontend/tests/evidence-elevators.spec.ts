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

const live = (state: string) => ({ state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ['fault', 'moving_up', 'moving_down'], extras: [] });
const ELEVATORS = [
  { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('moving_up') },
  { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault') },
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
      await expect(rows).toHaveCount(3);
      await expect(page.locator('sw-app infra-elevators [data-elevator="e2"]')).toHaveAttribute('data-state', 'fault');
      await expect(page.locator('sw-app infra-elevators [data-elevator="e3"]')).toHaveAttribute('data-state', 'unknown');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(OUT, `infra-${test.info().project.name}-${scheme}.png`) });
    });
  }

  test('settings: list and the add dialog with one select per role', async ({ page }) => {
    await install(page, ELEVATORS);
    await page.goto('about:blank');
    await page.goto(url('/system/infra/elevators'));
    await expect(page.locator('sw-app elevator-settings [data-elevator]')).toHaveCount(3);
    await page.locator('sw-app elevator-settings [data-elevator-add]').click();
    await expect(page.locator('sw-app elevator-settings [data-roles] select')).toHaveCount(6);
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
