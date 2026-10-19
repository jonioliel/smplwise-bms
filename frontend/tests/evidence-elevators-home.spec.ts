import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBubbleMock, tree } from './bubble-mocks';

// CR-INFRA-ELEVATORS 2.8.0 (review L7): the elevators HOME widget from the REAL build against fake data - mode "both" (the combined card
// followed by one card per elevator), mode "cards", the per-elevator hide list, and no widget at all (no ghost) without elevators. The
// bubble mock layer serves the session and the devices tree; the tree's `home` block carries the widget configuration and the elevator
// route is layered on top (a later page.route wins). Fake data only; screenshots in docs/evidence/elevators/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-elevators-home.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/elevators');
const NOW = '2026-10-18T09:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string) => ({
  state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history: null,
});
const ELEVATORS = [
  { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('active') },
  { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault') },
  { id: 'e4', name: 'מעלית משא', area_id: null, area_name: 'בניין B', ...live('out_of_service') },
  { id: 'e5', name: 'מעלית דרום', area_id: null, area_name: 'בניין A', ...live('fire_service') },
  { id: 'e3', name: 'מעלית שירות', area_id: null, area_name: null, ...live('unknown') },
];

async function install(page: Page, list: typeof ELEVATORS, elevators: Record<string, unknown>) {
  await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'] });
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { elevators: { on: true, ...elevators } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  await page.route('**/api/v1/infra/elevators**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/elevators') return json(route, { elevators: list, summary: {}, stale: false, at: NOW });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

const W = 'sw-app devices-building home-widgets';

test.describe('elevators home widget evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('mode both: the combined card and one card per elevator, the hidden one left out', async ({ page }) => {
    await install(page, ELEVATORS, { mode: 'both', hidden: ['e3'], filter: 'all' });
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/building');
    const combined = page.locator(`${W} [data-home-widget="elevators"]`);
    await expect(combined).toHaveCount(1);
    await expect(combined.locator('[data-home-elevators-top]')).toContainText('מעלית דרום'); // fire service is the loudest
    const cards = page.locator(`${W} [data-home-widget-part="elevators-cards"] [data-home-elevator-card]`);
    await expect(cards).toHaveCount(4);
    await expect(page.locator(`${W} [data-home-elevator-card="e3"]`)).toHaveCount(0);
    await expect(page.locator(`${W} [data-home-elevator="e3"]`)).toHaveCount(0);
    await expect(page.locator(`${W} [data-home-elevator-card="e4"]`)).toHaveAttribute('data-look', 'off'); // shutdown: its own look
    await expect(page.locator(`${W} [data-home-elevator-card="e2"]`)).toHaveAttribute('data-elevator-state', 'fault');
    await expect(page.locator(`${W} sw-icon[name^="arrow"]`)).toHaveCount(0); // never a direction
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(OUT, `home-both-${test.info().project.name}.png`) });
  });

  test('mode cards: only the cards, no combined summary', async ({ page }) => {
    await install(page, ELEVATORS, { mode: 'cards', hidden: [], filter: 'all' });
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/building');
    await expect(page.locator(`${W} [data-home-elevator-card]`)).toHaveCount(5);
    await expect(page.locator(`${W} [data-home-elevators-top]`)).toHaveCount(0);
    await expect(page.locator(`${W} [data-home-widget-part="elevators-cards"]`)).toHaveCount(0);
  });

  test('no elevators: no widget at all', async ({ page }) => {
    await install(page, [], { mode: 'both', hidden: [], filter: 'all' });
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/building');
    await expect(page.locator(`${W} [data-home-widget]`).first()).toBeAttached(); // the home widgets are drawn
    await expect(page.locator(`${W} [data-home-widget="elevators"]`)).toHaveCount(0);
    await expect(page.locator(`${W} [data-home-elevator-card]`)).toHaveCount(0);
  });
});
