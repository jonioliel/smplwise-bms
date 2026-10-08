import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// LAT1 (owner bug report 2026-10-08: "a switch takes a thinking time"). Run against tests/fixtures/devices_fake_ha.py (the
// real backend, a fake Home Assistant behind the bridge; `run_smart.py fixture <branch> evidence-lat1-instant-toggle`), or any
// SW_LIVE developer backend for the mocked tests. No real device is ever reached.
//
// What is measured, in the page, on the performance clock: the tap (pointerdown on the toggle) -> the tile's own
// `data-active` turning true ("visual"), and -> the "אושר" line ("confirmed"). The numbers are printed (`LAT1 ...`) for the
// task report; the bounds asserted are behavioural and generous (the tile flips with the tap, not after a round trip).

const FLOORS = [{ floor_id: 'lat1_floor', name: 'קומת בדיקה', level: 5 }];
const AREAS = [{ area_id: 'lat1_room', name: 'חדר מהירות', floor_id: 'lat1_floor' }];
const ENTITIES = [
  { entity_id: 'switch.lat1_relay', area_id: 'lat1_room' },
  { entity_id: 'light.lat1_lamp', area_id: 'lat1_room' },
];
const STATES = [
  { entity_id: 'switch.lat1_relay', state: 'off', attributes: { friendly_name: 'ממסר בדיקה' } },
  { entity_id: 'light.lat1_lamp', state: 'off', attributes: { friendly_name: 'מנורת בדיקה' } },
];

async function seed(request: APIRequestContext) {
  // every spec of the fixture group seeds its own structure per test, so this one may rewrite the registry with its own
  const reg = await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } });
  expect(reg.status(), 'dev registry seed (developer identity mode only)').toBe(200);
  expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES } })).status()).toBe(200);
}

async function setState(request: APIRequestContext, entity_id: string, state: string, attributes: Record<string, unknown> = {}) {
  expect((await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id, state, attributes }] } })).status()).toBe(200);
}

async function open(page: Page) {
  await page.goto('/?design=a#/devices/areas/lat1_room');
  await page.waitForSelector('sw-app');
}

/** Stamps, in the page, the tap and the first moment the tile shows the target / the confirmation / a pending line. */
async function arm(page: Page, entity: string) {
  await page.evaluate((entity) => {
    const deep = (node: Document | ShadowRoot, sel: string): Element | null => {
      const hit = node.querySelector(sel);
      if (hit) return hit;
      for (const el of Array.from(node.querySelectorAll('*'))) {
        const found = el.shadowRoot ? deep(el.shadowRoot, sel) : null;
        if (found) return found;
      }
      return null;
    };
    const root = deep(document, 'devices-area')!.shadowRoot!;
    const w = window as unknown as { __lat: { tap: number; visual: number; confirmed: number; pendingSeenAt: number; target: string } };
    const tile0 = root.querySelector(`.tile[data-entity="${entity}"]`)!;
    w.__lat = { tap: 0, visual: 0, confirmed: 0, pendingSeenAt: 0, target: tile0.getAttribute('data-active') === 'true' ? 'false' : 'true' };
    root.addEventListener('pointerdown', () => { if (!w.__lat.tap) w.__lat.tap = performance.now(); }, { capture: true });
    const look = () => {
      const t = root.querySelector(`.tile[data-entity="${entity}"]`);
      if (!t || !w.__lat.tap) return;
      const now = performance.now();
      if (!w.__lat.visual && t.getAttribute('data-active') === w.__lat.target) w.__lat.visual = now;
      if (!w.__lat.pendingSeenAt && t.querySelector('[data-cmd-status="pending"]')) w.__lat.pendingSeenAt = now;
      if (!w.__lat.confirmed && t.querySelector('[data-cmd-status="confirmed"]')) w.__lat.confirmed = now;
    };
    new MutationObserver(look).observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  }, entity);
}

async function readLat(page: Page) {
  return page.evaluate(() => {
    const l = (window as unknown as { __lat: { tap: number; visual: number; confirmed: number; pendingSeenAt: number } }).__lat;
    const ms = (t: number) => (t ? Math.round(t - l.tap) : null);
    return { visual: ms(l.visual), confirmed: ms(l.confirmed), pendingShownAfter: ms(l.pendingSeenAt) };
  });
}

test.describe('LAT1: a switch flips at the tap and confirms on the pushed state', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('through the REAL action route (fixture bridge, device reports 400 ms after the call): tile at the tap, confirmed by the push', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    await open(page);
    const tile = page.locator('devices-area .tile[data-entity="switch.lat1_relay"]');
    await expect(tile).toHaveAttribute('data-active', 'false', { timeout: 30000 });
    const rows: { visual: number | null; confirmed: number | null; pendingShownAfter: number | null }[] = [];
    for (let i = 0; i < 4; i++) {
      await arm(page, 'switch.lat1_relay');
      const want = i % 2 === 0 ? 'true' : 'false';
      await tile.locator('sw-toggle[data-control="power"]').click();
      await expect(tile.locator('[data-cmd-status="confirmed"]')).toBeVisible({ timeout: 8000 });
      await expect(tile).toHaveAttribute('data-reported', want, { timeout: 5000 });
      rows.push(await readLat(page));
      await expect(tile.locator('[data-cmd-status]')).toHaveCount(0, { timeout: 6000 }); // the "אושר" line clears before the next tap
    }
    console.log(`LAT1 real route (fixture effect 400 ms): ${JSON.stringify(rows)}`);
    for (const r of rows) {
      expect(r.visual, 'the tile shows the target at the tap').not.toBeNull();
      expect(r.visual!).toBeLessThan(250);
      // the device itself takes 400 ms here: the confirmation follows its push, not a poll interval after it
      expect(r.confirmed!).toBeLessThan(400 + 450);
      expect(r.pendingShownAfter, 'a device that reports within 700 ms never shows the pending line').toBeNull();
    }
    const timings = await page.evaluate(() => (window as unknown as { __swCommandTimings?: { via: string }[] }).__swCommandTimings ?? []);
    expect(timings.length).toBeGreaterThan(0);
    expect(timings.every((t) => t.via === 'push'), JSON.stringify(timings)).toBe(true);
    await seed(request);
  });

  test('the push confirms even while the record still reads pending, and the tile flips before the add-on answered (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page);
    const tile = page.locator('devices-area .tile[data-entity="light.lat1_lamp"]');
    await expect(tile).toHaveAttribute('data-active', 'false', { timeout: 30000 });
    const record = (status: string) => JSON.stringify({ id: 'lat1-a', entity_id: 'light.lat1_lamp', action_id: 'light.turn_on', status, error: null, requested_at: new Date().toISOString(), confirmed_at: null, confirmation: 'state' });
    // the add-on answers only after 600 ms, and every poll says "pending": only the pushed state can confirm
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      await new Promise((res) => setTimeout(res, 600));
      await r.fulfill({ status: 202, contentType: 'application/json', body: record('pending') });
    });
    await page.route('**/api/v1/ha/actions/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: record('pending') }));
    await arm(page, 'light.lat1_lamp');
    await tile.locator('sw-toggle[data-control="power"]').click();
    await expect(tile).toHaveAttribute('data-active', 'true', { timeout: 300 });
    await expect(tile).toHaveClass(/\bon\b/);
    await expect(tile.locator('.s')).toHaveText('דולק');
    await expect(tile).toHaveAttribute('data-reported', 'false');
    await setState(request, 'light.lat1_lamp', 'on', { friendly_name: 'מנורת בדיקה' }); // HA reports the new state (the real /ha/ws push)
    await expect(tile.locator('[data-cmd-status="confirmed"]')).toBeVisible({ timeout: 3000 });
    await expect(tile).toHaveAttribute('data-reported', 'true', { timeout: 3000 });
    const lat = await readLat(page);
    console.log(`LAT1 mocked answer 600 ms, push-only confirmation: ${JSON.stringify(lat)}`);
    expect(lat.visual!).toBeLessThan(250);
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await page.unroute('**/api/v1/ha/actions/*');
    await seed(request);
  });

  test('a refused command rolls the tile back with the bridge\'s reason, and an unavailable bridge too (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page);
    const tile = page.locator('devices-area .tile[data-entity="switch.lat1_relay"]');
    await expect(tile).toHaveAttribute('data-active', 'false', { timeout: 30000 });
    await page.route('**/api/v1/ha/entities/*/actions', (r) =>
      r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'lat1-d', entity_id: 'switch.lat1_relay', action_id: 'switch.turn_on', status: 'denied', error: 'ha_unauthorized', requested_at: new Date().toISOString(), confirmed_at: null, confirmation: 'state' }) }),
    );
    await tile.locator('sw-toggle[data-control="power"]').click();
    await expect(tile.locator('.rollback-note')).toContainText('תשתית המערכת דחתה את הפעולה', { timeout: 3000 });
    await expect(tile).toHaveAttribute('data-active', 'false');
    await expect(tile.locator('sw-toggle[data-control="power"]')).not.toHaveAttribute('checked', '');
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await expect(tile.locator('.rollback-note')).toHaveCount(0, { timeout: 6000 });
    // the add-on cannot reach Home Assistant: 503 - rolled back with the reason, the tile shows the reported "off" again
    await page.route('**/api/v1/ha/entities/*/actions', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ha_unavailable', message: 'תשתית המערכת אינה זמינה כרגע.' }) }));
    await tile.locator('sw-toggle[data-control="power"]').click();
    await expect(tile.locator('.rollback-note')).toBeVisible({ timeout: 3000 });
    await expect(tile).toHaveAttribute('data-active', 'false');
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await seed(request);
  });
});
