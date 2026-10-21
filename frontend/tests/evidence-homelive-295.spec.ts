import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { installBubbleMock, tree } from './bubble-mocks';
import { bv1Config, bv1Data, BV1_PERMS } from './bv1-mocks';

// HOMELIVE-295 evidence: the home screen's widgets (weather from the structure tree, the elevators) update by themselves after the phone slept and
// woke up - no manual refresh, no reload. The mock layer answers; nothing real is called. Desktop and mobile projects.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-homelive-295.spec.ts --project=desktop --project=mobile
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ENVELOPE = { code: 'internal_error', user_message: '', retryable: true, correlation_id: 'x', details: {} };
const NOW = '2026-10-21T09:00:00Z';

const elevator = (id: string, name: string, state: string) => ({ id, name, area_id: null, area_name: 'לובי', state, reason: state, partial: false, stale: false, since: NOW, roles: ['waiting', 'fault'], extras: [], flags: { fault: state === 'fault' }, history: null });

interface Srv {
  temp: number;
  lift: string;
  treeOk: boolean;
  liftsOk: boolean;
  reads: { tree: number; elevators: number };
}

async function homeScreen(page: Page, srv: Srv) {
  await installBubbleMock(page, { perms: [...BV1_PERMS, 'devices.read'] });
  await page.route('**/api/v1/devices/tree', (route) => {
    srv.reads.tree++;
    if (!srv.treeOk) return json(route, ENVELOPE, 500);
    const d = bv1Data();
    d.weather.values.temperature = { v: srv.temp, unit: '°C' };
    const config = { ...bv1Config(), order: ['clock', 'weather', 'elevators'], elevators: { on: true, mode: 'both', hidden: [], filter: 'all' } };
    return json(route, { ...tree(), home: { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config, data: d } });
  });
  await page.route('**/api/v1/infra/elevators**', (route) => {
    srv.reads.elevators++;
    if (!srv.liftsOk) return json(route, ENVELOPE, 500);
    return json(route, { elevators: [elevator('e3', 'מעלית צפון 3', srv.lift), elevator('e4', 'מעלית צפון 4', 'waiting')], summary: {}, stale: false, at: NOW });
  });
}

/** The phone goes to sleep: the page is hidden (visibilityState is overridden the way the browser reports it) and the timers are frozen. */
const sleep = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
const wake = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
  });

test('after the phone sleeps and wakes, the weather and the elevators update without a manual refresh', async ({ page }, info) => {
  const OUT = `../docs/design/evidence/HOMELIVE-295/${info.project.name}`;
  fs.mkdirSync(OUT, { recursive: true });
  const srv: Srv = { temp: 26, lift: 'waiting', treeOk: true, liftsOk: true, reads: { tree: 0, elevators: 0 } };
  await homeScreen(page, srv);
  await page.clock.install({ time: new Date(NOW) });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  const W = 'sw-app devices-building home-widgets';
  await expect(page.locator(`${W} [data-home-temp]`).first()).toContainText('26');
  await expect(page.locator(`${W} [data-home-elevator-card="e3"], ${W} [data-home-elevator="e3"]`).first()).toHaveAttribute('data-elevator-state', 'waiting');
  await page.screenshot({ path: `${OUT}/1-before-sleep.png` });

  await sleep(page);
  srv.temp = 31; // the world moves on while the phone sleeps
  srv.lift = 'fault';
  const before = { ...srv.reads };
  await page.clock.fastForward(20 * 60_000); // twenty minutes: the frozen timers do nothing visible
  await page.waitForTimeout(300);
  expect(srv.reads.tree - before.tree).toBe(0); // hidden: no request at all
  expect(srv.reads.elevators - before.elevators).toBe(0);
  await expect(page.locator(`${W} [data-home-temp]`).first()).toContainText('26'); // still the old picture, as on the phone
  await page.screenshot({ path: `${OUT}/2-asleep-stale.png` });

  await wake(page); // the app comes back to the front
  await page.clock.runFor(2_000); // the staggered reads
  await expect(page.locator(`${W} [data-home-temp]`).first()).toContainText('31', { timeout: 8000 });
  await expect(page.locator(`${W} [data-home-elevator-card="e3"], ${W} [data-home-elevator="e3"]`).first()).toHaveAttribute('data-elevator-state', 'fault', { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/3-after-wake-live.png` });
  // no storm: one read of each, not a burst, even though visibilitychange + focus + pageshow all fired
  expect(srv.reads.tree - before.tree).toBeLessThanOrEqual(2);
  expect(srv.reads.elevators - before.elevators).toBeLessThanOrEqual(2);
  console.log(`${info.project.name}: reads after wake tree=${srv.reads.tree - before.tree} elevators=${srv.reads.elevators - before.elevators}`);

  // and it keeps polling by itself afterwards (no event needed): the lift moves again
  srv.lift = 'waiting';
  await page.clock.runFor(35_000);
  await expect(page.locator(`${W} [data-home-elevator-card="e3"], ${W} [data-home-elevator="e3"]`).first()).toHaveAttribute('data-elevator-state', 'waiting', { timeout: 8000 });
});

test('a failed read after wake shows the tiny stale dot and the widget failure panel; the next poll heals both without a refresh press', async ({ page }, info) => {
  const OUT = `../docs/design/evidence/HOMELIVE-295/${info.project.name}`;
  fs.mkdirSync(OUT, { recursive: true });
  const srv: Srv = { temp: 26, lift: 'waiting', treeOk: true, liftsOk: true, reads: { tree: 0, elevators: 0 } };
  await homeScreen(page, srv);
  await page.clock.install({ time: new Date(NOW) });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  const W = 'sw-app devices-building home-widgets';
  await expect(page.locator(`${W} [data-home-temp]`).first()).toContainText('26');
  await expect(page.locator('sw-app devices-building [data-home-stale]')).toHaveCount(0);

  srv.treeOk = false;
  srv.liftsOk = false;
  await sleep(page);
  await wake(page);
  await page.clock.runFor(2_000);
  await expect(page.locator('sw-app devices-building [data-home-stale]')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator(`${W} [data-home-widget-failed="elevators"]`)).toHaveCount(1, { timeout: 8000 }); // UXREST2-295 panel still works
  await expect(page.locator(`${W} [data-home-widget="clock"]`)).toHaveCount(1); // the other widgets did not blank
  await page.screenshot({ path: `${OUT}/4-failed-stale-dot.png` });

  srv.treeOk = true;
  srv.liftsOk = true;
  srv.temp = 24;
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); // the network is back
  await page.clock.runFor(2_000);
  await expect(page.locator(`${W} [data-home-temp]`).first()).toContainText('24', { timeout: 8000 });
  await expect(page.locator(`${W} [data-home-widget-failed="elevators"]`)).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('sw-app devices-building [data-home-stale]')).toHaveCount(0, { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/5-healed.png` });
});
