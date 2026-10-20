import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBubbleMock, tree } from './bubble-mocks';

// GENWIDGET 2.9.3: the generator HOME widget from the REAL build against fake data - one generator on mains (light and dark), one running
// with the site on the generator, a fault, two generators (rows), and no widget at all (no ghost) without a generator or without
// generator.view. The bubble mock layer serves the session and the devices tree; the tree's `home` block carries the widget configuration
// and GET /generator/devices/live is layered on top (a later page.route wins). Fake data only; screenshots in docs/evidence/generator-widget/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-generator-home.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/generator-widget');
const NOW = '2026-10-20T09:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Sum = Record<string, { value: number | string | boolean | null; unit: string }>;
const v = (value: number | string | boolean | null, unit = '') => ({ value, unit });
const gen = (id: string, name: string, summary: Sum, extra: Record<string, unknown> = {}) => ({
  id, name, area_id: null, status: 'detected', availability: 'online', stale: false, open_alerts: 0, open_critical: 0, roles: Object.keys(summary), summary, ...extra,
});
const STANDBY: Sum = { engine_state: v('stopped'), controller_mode: v('auto'), mains_available: v(true), ats_position: v('mains'), fuel_pct: v(92, '%'), load_pct: v(0, '%') };
const RUNNING: Sum = { engine_state: v('running'), controller_mode: v('auto'), mains_available: v(false), ats_position: v('generator'), fuel_pct: v(71, '%'), load_pct: v(48, '%'), gen_kw: v(62, 'kW') };
const FAULT: Sum = { ...STANDBY, engine_state: v('fault') };

const PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read', 'generator.view'];

async function install(page: Page, devices: unknown[], perms = PERMS) {
  await installBubbleMock(page, { perms });
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { generators: { on: true } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  let calls = 0;
  await page.route('**/api/v1/generator/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'generator/devices/live') {
      calls++;
      return json(route, { devices, open_alerts: 0, at: NOW });
    }
    if (p === 'generator/devices') return json(route, { devices: [], detected: 0, partial: 0, open_alerts: 0, last_detect_at: null });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return () => calls;
}

const W = 'sw-app devices-building home-widgets';
const widget = (page: Page) => page.locator(`${W} [data-home-widget="generators"]`);

async function open(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#/devices/building`);
  await expect(page.locator(`${W} [data-home-widget]`).first()).toBeAttached({ timeout: 30_000 });
}

async function shots(page: Page, name: string) {
  const project = test.info().project.name;
  await widget(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `${name}-${project}.png`) });
  await widget(page).screenshot({ path: path.join(OUT, `${name}-card-${project}.png`) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('generator home widget evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('normal: standby, the site on mains (light and dark)', async ({ page }) => {
    await install(page, [gen('g1', 'גנרטור ראשי', STANDBY)]);
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, scheme);
      const w = widget(page);
      await expect(w).toHaveCount(1);
      await expect(w.locator('[data-home-generators-supply]')).toHaveAttribute('data-home-generators-supply', 'mains');
      await expect(w.locator('[data-home-generators-line]')).toHaveText('על רשת החשמל');
      await expect(w.locator('[data-home-generator-chip]')).toHaveText('בהמתנה');
      await expect(w.locator('[data-home-generator-chip]')).toHaveAttribute('data-home-generator-chip', 'standby');
      await expect(w.locator('a[data-home-generators-supply]')).toHaveAttribute('href', '#/infra/generator/live?device=g1');
      await expect(w.locator('[data-home-generator]')).toHaveCount(0); // one generator: no rows
      await expect(w).not.toContainText(/Home Assistant|WisKey/);
      await shots(page, `mains-${scheme}`);
    }
  });

  test('running: the site on the generator', async ({ page }) => {
    await install(page, [gen('g1', 'גנרטור ראשי', RUNNING)]);
    await open(page);
    const w = widget(page);
    await expect(w.locator('[data-home-generators-line]')).toHaveText('על גנרטור');
    await expect(w.locator('[data-home-generator-chip]')).toHaveAttribute('data-home-generator-chip', 'running');
    await expect(w.locator('[data-home-generator-chip]')).toHaveText('פועל');
    await shots(page, 'running');
  });

  test('fault: the engine reports a fault', async ({ page }) => {
    await install(page, [gen('g1', 'גנרטור ראשי', FAULT, { open_alerts: 1, open_critical: 1 })]);
    await open(page);
    const w = widget(page);
    await expect(w.locator('[data-home-generator-chip]')).toHaveAttribute('data-home-generator-chip', 'fault');
    await expect(w.locator('[data-home-generator-chip]')).toHaveText('תקלה');
    await expect(w).toHaveAttribute('data-tone', 'fault');
    await shots(page, 'fault');
  });

  test('two generators: the summary, one row each (the loudest first), each row opens its generator', async ({ page }) => {
    await install(page, [gen('g1', 'גנרטור צפון', STANDBY), gen('g2', 'גנרטור דרום', RUNNING)]);
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, scheme);
      const w = widget(page);
      await expect(w.locator('[data-home-generators-line]')).toHaveText('על גנרטור');
      await expect(w.locator('[data-home-generators-summary]')).toHaveText('2 גנרטורים · 1 פועלים');
      const rows = w.locator('[data-home-generator]');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toHaveAttribute('data-home-generator', 'g2'); // running outranks standby
      await expect(rows.nth(0)).toHaveAttribute('href', '#/infra/generator/live?device=g2');
      await expect(rows.nth(1)).toHaveAttribute('data-generator-state', 'standby');
      await expect(w.locator('a[data-home-generators-supply]')).toHaveAttribute('href', '#/infra/generator/live');
      await shots(page, `two-${scheme}`);
    }
  });

  test('none: no generator, or no generator.view - no widget at all (no ghost)', async ({ page }) => {
    const calls = await install(page, []);
    await open(page);
    await expect(widget(page)).toHaveCount(0);
    await expect(page.locator(`${W} [data-home-ghost="generators"]`)).toHaveCount(0);
    expect(calls()).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(OUT, `none-${test.info().project.name}.png`) });
    // a viewer without generator.view is never asked and never sees it
    const page2 = await page.context().newPage();
    const calls2 = await install(page2, [gen('g1', 'גנרטור ראשי', STANDBY)], PERMS.filter((p) => p !== 'generator.view'));
    await open(page2);
    await expect(widget(page2)).toHaveCount(0);
    expect(calls2()).toBe(0);
    await page2.close();
  });
});
