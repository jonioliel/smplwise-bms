import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settle } from './helpers/settle';

// WISKEY-RELAY-INV-2520: the "מיפוי ממסרים" card (Settings › הגדרת מערכת › WisKey) with WisKey's relay inventory per station
// (stations/relay_inventory_v1, READ only), mounted alone on the styleguide route with a mocked backend (invented sample data: no real
// name, id or address). Screenshots for the compare page, desktop 1440 and phone 390, light and dark; the "before" phase runs the same
// file on the base commit, where the card has no inventory toggle.
//   SW_SHOTS=1 SW_SHOT_PHASE=before|after SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-relay-inv-2520.spec.ts --project=desktop --workers=1
const PHASE = process.env.SW_SHOT_PHASE || 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'evidence', 'WISKEY-RELAY-INV-2520', PHASE);
const SIZES = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

const row = (api: number, physical: number | null) => ({ api_relay: api, physical_relay: physical, active: physical !== null, row_revision: 1, updated_at: '2026-11-11T08:00:00Z' });
const MAP = {
  state: 'ready',
  has_copy: true,
  can_edit: true,
  confirm_word: 'אישור',
  stations: [
    { id: 'st-a', name: 'כניסה ראשית', in_copy: true, online: true, relays: [{ physical_index: 1, name: 'דלת' }, { physical_index: 2, name: null }], revision: 2,
      approved_by: 'מנהלת המערכת', approved_at: '2026-11-11T08:00:00Z', rows: [row(1, 1), row(2, null)], automated_relays: [] },
    { id: 'st-b', name: 'חניון', in_copy: true, online: true, relays: [{ physical_index: 1, name: null }], revision: 1,
      approved_by: 'מנהלת המערכת', approved_at: '2026-11-11T08:00:00Z', rows: [row(1, 1), row(2, null)], automated_relays: [] },
  ],
};
const READY = {
  station_id: 'st-a', state: 'ready', reason: null, wiskey_code: null, fetched_at: '2026-11-25T08:00:00Z',
  data: {
    station_id: 'st-a',
    api_outputs: { ids: [1, 2], count: 2, evidence: 'device_capability_at_load', roles: [{ api_id: 1, role: 'unknown' }, { api_id: 2, role: 'unknown' }] },
    configured_mapping: [{ physical_index: 1, api_id: 1, confirmation: 'saved_configuration', role: 'unknown' }],
    physical_relay_count: null, physical_verified: false, non_actuating_test: { supported: false, reason: 'relay_test_unsupported_v1' },
  },
};
const UNSUPPORTED = { station_id: 'st-b', state: 'unsupported', reason: 'not_listed', wiskey_code: null, fetched_at: null, data: null };

async function install(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/wiskey/relay-map**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'wiskey/relay-map') return json(route, MAP);
    if (p === 'wiskey/relay-map/inventory/st-a') return json(route, READY);
    if (p === 'wiskey/relay-map/inventory/st-b') return json(route, UNSUPPORTED);
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, details: {} }, 404);
  });
}

async function mount(page: Page, size: Size, scheme: 'light' | 'dark') {
  await page.setViewportSize(SIZES[size]);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await install(page);
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#/system/styleguide`);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  await page.evaluate(async () => {
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    await import('/src/screens/wiskey-relay-map.ts' as string);
    await customElements.whenDefined('sw-wiskey-relay-map');
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:960px;margin:24px auto;padding:0 16px;';
    wrap.append(document.createElement('sw-wiskey-relay-map'));
    document.body.append(wrap);
  });
  await expect(page.locator('sw-wiskey-relay-map [data-relay-map-card]')).toBeVisible({ timeout: 15_000 });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

test('relay map card with WisKey relay inventory: compare shots', async ({ page }) => {
  test.skip(!process.env.SW_SHOTS, 'SW_SHOTS=1 writes the compare-page screenshots');
  test.skip(test.info().project.name !== 'desktop', 'one project; the phone width is set per shot');
  test.setTimeout(180_000);
  for (const size of ['1440', '390'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      await mount(page, size, scheme);
      await shot(page, `card-${size}-${scheme}`);
      const toggles = page.locator('sw-wiskey-relay-map [data-relay-inventory-toggle]');
      if (PHASE === 'after') {
        await expect(toggles).toHaveCount(2);
        await toggles.nth(0).click();
        await expect(page.locator('sw-wiskey-relay-map [data-relay-inventory="ready"]')).toBeVisible();
        await toggles.nth(1).click();
        await expect(page.locator('sw-wiskey-relay-map [data-relay-inventory="unsupported"]')).toBeVisible();
        await expect(page.locator('sw-wiskey-relay-map [data-relay-inventory-line="count"]')).toHaveText('לא ידוע');
        await expect(page.locator('sw-wiskey-relay-map [data-relay-inventory-line="roles"]')).toHaveText('לא ידוע');
        await shot(page, `inventory-${size}-${scheme}`);
        await settle(page); // the gate's lint: geometry is read only after the opened lists' animations settled
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(sideways, 'no sideways scroll').toBeLessThanOrEqual(0);
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  }
});
