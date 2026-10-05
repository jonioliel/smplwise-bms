import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, PERMS, SKINS, url, type GenMockOptions } from './generator-mocks';

// CR-031 GEN1 evidence: the generator screens from the REAL build against the mock layer (fake data), per project (desktop 1440 / tablet 1024 / mobile 390),
// three capability levels, light and dark, four skins on the live screen. Also asserts behaviour: no control buttons, capability-driven pieces, view mode,
// empty routing, diagram not mirrored by RTL, no horizontal overflow.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-generator.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/generator');
const S = 'sw-app infra-generator';
const phone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 900;

test.describe('generator evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }) => void (await page.emulateMedia({ reducedMotion: 'reduce' })));

  async function shoot(page: Page, hash: string, name: string, wait: string, opts: GenMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic', then?: (p: Page) => Promise<void>) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const mock = await installGeneratorMock(page, opts);
    await page.goto('about:blank');
    await page.goto(url(hash, skin, scheme));
    await page.waitForSelector(wait, { timeout: 20_000 });
    if (then) await then(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}${skin === 'classic' ? '' : `-${skin}`}.png`) });
    return mock;
  }

  test('live: capability levels, scenarios, picker, states', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) await shoot(page, '/infra/generator/live', 'live-typical-run', `${S} [data-gen-live] [data-flow]`, {}, scheme);
    await shoot(page, '/infra/generator/live', 'live-full-run', `${S} [data-gen-live] [data-gauge="oil_pressure"]`, { level: 'full' });
    await shoot(page, '/infra/generator/live', 'live-full-standby', `${S} [data-gen-live] [data-flow]`, { level: 'full', scenario: 'standby' });
    await shoot(page, '/infra/generator/live', 'live-minimal', `${S} [data-gen-live] [data-flow]`, { level: 'minimal' });
    await shoot(page, '/infra/generator/live', 'live-unavailable', `${S} [data-banner="offline"]`, { scenario: 'unavail' });
    await shoot(page, '/infra/generator/live', 'live-two-generators', `${S} [data-picker]`, { level: 'full', count: 2 });
    await shoot(page, '/infra/generator/live', 'live-many-generators', `${S} [data-picker]`, { level: 'full', count: 8 });
    await shoot(page, '/infra/generator/live', 'live-loading', `${S} [data-state="loading"], ${S} [data-gen-live]`, { slowLive: true });
  });

  test('live: capability-driven pieces, no control buttons, diagram not mirrored', async ({ page }) => {
    await shoot(page, '/infra/generator/live', 'check-minimal', `${S} [data-gen-live] [data-flow]`, { level: 'minimal' });
    const q = (s: string) => page.locator(`${S} ${s}`);
    await expect(q('[data-flow]')).toHaveAttribute('data-layout', phone(page) ? 'vertical' : 'compact');
    await expect(q('[data-gauge]')).toHaveCount(0);
    await expect(q('[data-flow-card="grid"]')).toHaveCount(0);
    await expect(q('[data-flow-card="ats"]')).toHaveCount(0);
    await expect(q('[data-card="phases"] tbody tr')).toHaveCount(1);
    await shoot(page, '/infra/generator/live', 'check-full', `${S} [data-gen-live] [data-gauge="oil_pressure"]`, { level: 'full' });
    await expect(q('[data-gauge]')).toHaveCount(4);
    await expect(q('[data-flow-card="ats"]')).toHaveCount(1);
    await expect(q('[data-card="phases"] tbody tr')).toHaveCount(3);
    expect(await page.locator(`${S} svg.flow`).evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    for (const w of ['התנעה', 'עצירה', 'הפעלה', 'הפעל', 'כבה']) expect(await page.locator(`${S} [data-gen-live] button`).filter({ hasText: w }).count(), w).toBe(0);
    expect(await page.locator(`${S} [data-gen-live]`).innerText()).not.toMatch(/Home Assistant|Ingress/i);
  });

  test('live: dials or charts, one at a time, stored per user', async ({ page }) => {
    const mock = await shoot(page, '/infra/generator/live', 'live-dials', `${S} [data-view="gauges"]`, { level: 'full' });
    await expect(page.locator(`${S} [data-view="charts"]`)).toHaveCount(0);
    await page.locator(`${S} [data-view-mode] button`).nth(1).click();
    await expect(page.locator(`${S} gen-chart-set`).locator('[data-metric]').first()).toBeVisible();
    await expect(page.locator(`${S} [data-view="gauges"]`)).toHaveCount(0);
    expect(mock.calls.some((c) => c.method === 'PUT' && c.path === 'me/prefs' && (c.body as Record<string, string>)['generator.view_mode'] === 'charts')).toBe(true);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `live-charts-${test.info().project.name}-light.png`) });
    await shoot(page, '/infra/generator/live', 'live-charts-stored', `${S} [data-view="charts"]`, { level: 'full', viewMode: 'charts' });
    await expect(page.locator(`${S} [data-view="gauges"]`)).toHaveCount(0);
  });

  test('live: four skins', async ({ page }) => {
    for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) await shoot(page, '/infra/generator/live', 'skin-live', `${S} [data-gen-live] [data-flow]`, { level: 'full' }, scheme, skin);
  });

  test('charts: full view, ranges, custom, minimal controller', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) await shoot(page, '/infra/generator/charts', 'charts-24h', `${S} gen-chart-set [data-chart]`, { level: 'full' }, scheme);
    for (const r of [0, 2, 3]) {
      await shoot(page, '/infra/generator/charts', `charts-range-${r}`, `${S} gen-chart-set [data-chart]`, { level: 'full' }, 'light', 'classic', async (p) => {
        await p.locator(`${S} [data-range] button`).nth(r).click();
        await p.waitForSelector(`${S} gen-chart-set [data-chart]`);
      });
    }
    await shoot(page, '/infra/generator/charts', 'charts-custom', `${S} [data-range]`, { level: 'full' }, 'light', 'classic', async (p) => {
      await p.locator(`${S} [data-range] button`).nth(4).click();
      await p.waitForSelector(`${S} [data-custom]`);
      await p.waitForSelector(`${S} gen-chart-set [data-chart]`);
    });
    await shoot(page, '/infra/generator/charts', 'charts-minimal', `${S} gen-chart-set [data-chart]`, { level: 'minimal' });
    await expect(page.locator(`${S} [data-metrics] button`)).toHaveCount(1);
  });

  test('alerts: list, empty, detail with acknowledge, history filters', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) await shoot(page, '/infra/generator/alerts', 'alerts-active', `${S} [data-gen-alerts] [data-alert]`, {}, scheme);
    await shoot(page, '/infra/generator/alerts', 'alerts-empty', `${S} [data-state="empty"]`, { alerts: 'none' });
    await shoot(page, '/infra/generator/history', 'history', `${S} [data-gen-alerts="history"] [data-alert]`);
    await shoot(page, '/infra/generator/history', 'history-filtered', `${S} [data-gen-alerts="history"] [data-alert]`, {}, 'light', 'classic', async (p) => {
      await p.locator(`${S} [data-filter="severity"]`).selectOption('critical');
    });
    const mock = await shoot(page, '/infra/generator/alerts/al1', 'alert-detail', `${S} [data-detail]`);
    await page.locator(`${S} [data-ack-detail]`).click();
    await expect(page.locator(`${S} [data-acked]`)).toBeVisible();
    expect(mock.calls.some((c) => c.method === 'POST' && /alerts\/al1\/ack/.test(c.path))).toBe(true);
  });

  test('settings: not found, detection, routing starts empty with template preview, mapping, thresholds', async ({ page }) => {
    await shoot(page, '/infra/generator/live', 'not-found-manager', `${S} [data-state="not-found"]`, { count: 0 });
    await shoot(page, '/system/infra/generator/routing', 'settings-not-found', 'sw-app gen-settings [data-detection="none"]', { count: 0 });
    await shoot(page, '/system/infra/generator/routing', 'settings-routing-empty', 'sw-app gen-routing [data-routing-empty]', { level: 'typical' });
    await expect(page.locator('sw-app gen-routing tr.na, sw-app gen-routing .li.dis').first()).toBeAttached();
    await shoot(page, '/system/infra/generator/routing', 'settings-routing-full', 'sw-app gen-routing [data-routing-empty]', { level: 'full' }, 'dark');
    await shoot(page, '/system/infra/generator/routing', 'settings-routing-edit', 'sw-app gen-routing [data-type="battery_low"]', { level: 'typical' }, 'light', 'classic', async (p) => {
      await p.locator('sw-app gen-routing [data-type="battery_low"]').first().click({ force: true });
      await p.waitForSelector('sw-app gen-routing [data-preview]');
    });
    await expect(page.locator('sw-app gen-routing [data-preview]')).toContainText('מתח מצבר');
    await shoot(page, '/system/infra/generator/mapping', 'settings-mapping', 'sw-app gen-settings [data-section="mapping"]');
    await shoot(page, '/system/infra/generator/thresholds', 'settings-thresholds', 'sw-app gen-settings [data-section="thresholds"]');
    await shoot(page, '/system/infra/generator/retention', 'settings-retention', 'sw-app gen-settings [data-section="retention"]', { count: 2 });
  });

  test('permissions: a view-only user and a user without the permission', async ({ page }) => {
    await shoot(page, '/infra/generator/live', 'viewonly-live', `${S} [data-gen-live]`, { perms: PERMS.view });
    await shoot(page, '/infra/generator/live', 'forbidden', `${S} [data-state="forbidden"]`, { perms: PERMS.none });
  });
});
