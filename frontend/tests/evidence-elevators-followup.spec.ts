import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBubbleMock, tree } from './bubble-mocks';
import { installGeneratorMock, url } from './generator-mocks';

// 2.9.1 (ELEVFU): browser-level evidence of (1) the home widget in mode "both" and (2) the 2.9.0 long-press history popup, desktop 1440 and
// phone 390, light and dark, from the REAL build against fake data. The history carries an explicit "not monitored" (unknown) stretch.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-elevators-followup.spec.ts --project=desktop --project=mobile
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/elevators');
const NOW = '2026-10-18T09:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string, history: unknown = null) => ({
  state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history,
});
// the screen clips to the last 24 hours of the REAL clock, so the fake history is relative to now
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const HISTORY = [
  { state: 'waiting', from: ago(24), to: ago(20) },
  { state: 'unknown', from: ago(20), to: ago(17) }, // the add-on was not running: not monitored, not "waiting"
  { state: 'fault', from: ago(17), to: ago(12) },
  { state: 'active', from: ago(12), to: ago(0) },
];
const ELEVATORS = [
  { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('active', HISTORY) },
  { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault', HISTORY) },
  { id: 'e4', name: 'מעלית משא', area_id: null, area_name: 'בניין B', ...live('out_of_service', HISTORY) },
  { id: 'e5', name: 'מעלית דרום', area_id: null, area_name: 'בניין A', ...live('fire_service', HISTORY) },
];
const listRoute = (page: Page) => page.route('**/api/v1/infra/elevators**', (route) => {
  const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
  if (p === 'infra/elevators') return json(route, { elevators: ELEVATORS, summary: {}, stale: false, at: NOW });
  return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
});

const W = 'sw-app devices-building home-widgets';

test.describe('elevators follow-up evidence (2.9.1)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    test(`home widget, mode both (${scheme})`, async ({ page }) => {
      await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'] });
      const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { elevators: { on: true, mode: 'both', hidden: [], filter: 'all' } }, data: {} };
      await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
      await listRoute(page);
      await page.goto('about:blank');
      await page.goto(`/?design=a&skin=classic&scheme=${scheme}#/devices/building`);
      await expect(page.locator(`${W} [data-home-widget="elevators"]`)).toHaveCount(1);
      await expect(page.locator(`${W} [data-home-elevators-top]`)).toContainText('מעלית דרום'); // fire service is the loudest
      await expect(page.locator(`${W} [data-home-widget-part="elevators-cards"] [data-home-elevator-card]`)).toHaveCount(4);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(OUT, `home-both-${test.info().project.name}-${scheme}.png`) });
    });

    test(`long press opens the history popup (${scheme})`, async ({ page }) => {
      await installGeneratorMock(page, { perms: ['devices.read'], count: 0 });
      await listRoute(page);
      await page.goto('about:blank');
      await page.goto(url('/infra/elevators', 'classic', scheme));
      const card = page.locator('sw-app infra-elevators [data-elevator="e2"]');
      await expect(card).toBeVisible();
      await expect(page.locator('sw-app infra-elevators [data-elevator-history-dialog]')).toHaveCount(0);
      // R5 (2.27.0): the taller KPI tiles and cards put this card's lower edge under the phone's fixed bottom bar (the press landed on a
      // tab link, not the card): bring the card into view and let its entrance cascade finish before measuring where to press
      await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await card.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const box = (await card.boundingBox())!;
      // a long press on the card body (not on its history button): 500 ms hold, no movement
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      const dlg = page.locator('sw-app infra-elevators [data-elevator-history-dialog]');
      await expect(dlg).toBeAttached(); // the dialog host itself has no box; its content is what is visible
      await expect(dlg.locator('[data-history-rows]')).toBeVisible();
      await expect(dlg).toContainText('מעלית דרומית');
      await expect(dlg.locator('[data-history-rows] li')).not.toHaveCount(0);
      await expect(dlg.locator('[data-history-state="unknown"]')).toHaveCount(1); // the not-monitored stretch is its own row
      await page.screenshot({ path: path.join(OUT, `history-popup-${test.info().project.name}-${scheme}.png`) });
    });
  }

  test('a short press does not open the history', async ({ page }) => {
    await installGeneratorMock(page, { perms: ['devices.read'], count: 0 });
    await listRoute(page);
    await page.goto('about:blank');
    await page.goto(url('/infra/elevators'));
    const card = page.locator('sw-app infra-elevators [data-elevator="e1"]');
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
    await page.waitForTimeout(200);
    await expect(page.locator('sw-app infra-elevators [data-elevator-history-dialog]')).toHaveCount(0);
  });
});
