import { test, expect, type Page, type Locator, type APIRequestContext } from '@playwright/test';

// DEVHIST-JOIN (CR-032, 2026-10-05): the device activity popup against the REAL backend, no mocks. The fixture backend
// (tests/fixtures/devhist_fixture_backend.py) is the real SmplWise Arx backend whose only fake is Home Assistant: a seeded state stream goes through
// the backend's own ha_sync.handle_state_event, so every row the popup shows was produced by the real capture code and served by the real route.
//
//   SW_PORT=8361 SW_DATA_DIR=<empty dir> <venv-python> frontend/tests/fixtures/devhist_fixture_backend.py        (after `npm run build`)
//   SW_LIVE=1 SW_DEVHIST_FIXTURE=1 SW_API_PORT=8361 SW_BASE_URL=http://127.0.0.1:4361/ npx playwright test tests/evidence-device-activity-live.spec.ts --project=desktop --workers=1
const LIVE = process.env.SW_LIVE === '1' && process.env.SW_DEVHIST_FIXTURE === '1';
const API = `http://127.0.0.1:${process.env.SW_API_PORT || '8361'}/api/v1`;
const LONG = 650;

async function bind(request: APIRequestContext, name: string, role: string) {
  await request.get(`${API}/me`, { headers: { 'x-sw-dev-user': name } }); // a dev principal exists only after its first /me
  const r = await request.post(`${API}/access/bindings`, { data: { subject_kind: 'user', subject_id: `dev-${name}`, role_id: role, scope_type: 'installation', scope_id: '*' } });
  expect([200, 201, 409]).toContain(r.status());
}

async function open(page: Page, query = '&skin=classic') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#/devices/areas/salon`);
  await page.waitForSelector('sw-app devices-area [data-entity]');
  await page.waitForTimeout(700);
}

const area = (page: Page) => page.locator('sw-app devices-area');
const tile = (page: Page, id: string) => area(page).locator(`.tile[data-entity="${id}"], .row[data-entity="${id}"]`).first();
const opened = (page: Page) => page.locator('sw-app device-activity sw-sheet[data-device-activity][open]');
const panel = (page: Page) => page.locator('sw-app device-activity #da-panel');

async function hold(page: Page, loc: Locator, ms: number) {
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width - 34, b.y + 14);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const flaggedIds = (page: Page) => area(page).locator('[data-activity]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.entity));

test.describe('device activity popup against the real backend', () => {
  test.skip(!LIVE, 'needs devhist_fixture_backend.py (SW_LIVE=1 SW_DEVHIST_FIXTURE=1)');

  // the security section (lock, alarm panel) is drawn on the area screen only where a layout is stored: the fixture stores one for the area
  test.beforeAll(async ({ request }) => {
    await bind(request, 'vi', 'viewer');
    await bind(request, 'op', 'operator');
    const items = Object.fromEntries(['lighting', 'switches', 'climate', 'covers', 'security', 'media', 'sensors'].map((c, i) => [`card:${c}`, { x: (i % 2) * 6, y: Math.floor(i / 2) * 10, w: 6, h: 10 }]));
    const r = await request.put(`${API}/devices/layouts/area/salon`, { data: { variant: 'desktop', revision: 0, layout: { v: 1, cols: 12, items } } });
    expect(r.status()).toBe(200);
  });
  test.afterAll(async ({ request }) => {
    await request.delete(`${API}/devices/layouts/area/salon`);
  });

  test('which tiles carry the gesture, with which kind (admin)', async ({ page }) => {
    await open(page);
    const flagged = await flaggedIds(page);
    for (const id of ['light.lobby', 'light.dimmer', 'switch.sign', 'switch.plug', 'cover.blind', 'cover.garage', 'climate.ac', 'climate.floor_heat', 'fan.vent', 'lock.front', 'alarm_control_panel.house']) expect(flagged, id).toContain(id);
    for (const id of ['sensor.temp', 'media_player.tv']) expect(flagged, id).not.toContain(id);
    const kinds = await area(page).locator('[data-activity]').evaluateAll((els) => Object.fromEntries(els.map((e) => [(e as HTMLElement).dataset.entity, JSON.parse((e as HTMLElement).getAttribute('data-activity')!).kind])));
    expect(kinds['switch.plug']).toBe('outlet');
    expect(kinds['cover.garage']).toBe('garage_door');
    expect(kinds['light.lobby']).toBe('light');
  });

  test('long press opens the popup with real rows; the click after it toggles nothing; filters, load more, tracked since', async ({ page, request }) => {
    await open(page);
    const actions: string[] = [];
    page.on('request', (r) => r.method() === 'POST' && /\/actions/.test(r.url()) && actions.push(r.url()));
    const feed: string[] = [];
    page.on('request', (r) => /\/devices\/light\.lobby\/activity/.test(r.url()) && feed.push(r.url()));
    await hold(page, tile(page, 'light.lobby'), LONG);
    await expect(opened(page)).toHaveCount(1);
    const p = panel(page);
    await expect(p.locator('.ev').first()).toBeVisible();
    await expect(p.locator('.ev')).toHaveCount(50);
    expect(actions).toEqual([]);
    // the newest row on screen is the newest row of the API
    const api = await (await request.get(`${API}/devices/light.lobby/activity?limit=3`)).json();
    expect(api.items.length).toBe(3);
    await expect(p.locator('[data-day]').first()).toContainText('היום');
    await expect(p.locator('[data-foot]')).toContainText('נשמר 90 יום');
    await expect(p.locator('[data-tracked-since]')).toContainText('מתועד מ־');
    // time zone: the first row's clock time is the API's UTC instant written in Asia/Jerusalem
    const expected = new Date(api.items[0].at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false });
    await expect(p.locator('.ev').first()).toContainText(expected);
    // wording: people by name, the availability row is the system, never a raw id
    const text = await p.innerText();
    expect(text).toContain('דנה כהן');
    expect(text).not.toMatch(/u-dana|u-avi|dev-/);
    // load more: 50 + 50 + the rest, no duplicates
    await p.locator('[data-load-more]').click();
    await expect(p.locator('.ev')).toHaveCount(100);
    expect(feed.at(-1)).toContain('cursor=');
    await p.locator('[data-load-more]').click();
    await expect.poll(() => p.locator('.ev').count()).toBeGreaterThan(100);
    await expect(p.locator('[data-load-more]')).toHaveCount(0);
    const total = await p.locator('.ev').count();
    let n = 0;
    let cursor = '';
    for (;;) {
      const r = await (await request.get(`${API}/devices/light.lobby/activity?limit=200${cursor}`)).json();
      n += r.items.length;
      if (!r.next_cursor) break;
      cursor = `&cursor=${encodeURIComponent(r.next_cursor)}`;
    }
    expect(total).toBe(n);
    // filters re-query with the server's own parameters
    const before = feed.length;
    await page.locator('sw-app device-activity [data-filter="kind"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'availability' }, bubbles: true, composed: true })));
    await expect.poll(() => feed.length).toBeGreaterThan(before);
    expect(feed.at(-1)).toContain('kind=availability');
    await expect(p.locator('.ev')).toHaveCount(2);
    await page.locator('sw-app device-activity [data-filter="kind"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: '' }, bubbles: true, composed: true })));
    await page.locator('sw-app device-activity [data-filter="actor"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'automation' }, bubbles: true, composed: true })));
    await expect.poll(() => feed.at(-1)).toContain('actor=automation');
    await expect(p.locator('.ev')).toHaveCount(1);
    await expect(p.locator('.ev').first()).toContainText('Evening lights');
    await page.keyboard.press('Escape');
    await expect(opened(page)).toHaveCount(0);
  });

  test('every kind of device opens a feed with its own rows (the twelve kinds on the API, the rest on the tiles)', async ({ page }) => {
    await open(page);
    for (const id of ['light.dimmer', 'switch.sign', 'switch.plug', 'cover.blind', 'cover.garage', 'climate.ac', 'fan.vent', 'lock.front', 'alarm_control_panel.house']) {
      await hold(page, tile(page, id), LONG);
      await expect(opened(page), id).toHaveCount(1);
      await expect(panel(page).locator('.ev').first(), id).toBeVisible();
      const text = await panel(page).innerText();
      expect(text, id).not.toMatch(/undefined|NaN|\[object/);
      await page.keyboard.press('Escape');
      await expect(opened(page)).toHaveCount(0);
      await page.waitForTimeout(500); // the sheet's scroll lock is released after its close animation
    }
  });

  test('the schedules tab lists the real schedules and the edit button opens the existing editor', async ({ page }) => {
    await open(page);
    await hold(page, tile(page, 'light.lobby'), LONG);
    await page.locator('sw-app device-activity [data-tab="schedules"]').click();
    const rows = panel(page).locator('[data-schedule]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('תאורת ערב');
    await rows.nth(0).locator('[data-sched-edit]').click();
    const ed = page.locator('sw-app device-activity sw-sheet[data-device-activity-editor]');
    await expect(ed).toHaveAttribute('open', '');
    await expect(ed.locator('schedule-editor')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ed).toHaveCount(0);
  });

  test('a viewer sees no entry on the lock and the alarm panel (and the route says 403); lights stay', async ({ page, request, context }) => {
    for (const id of ['lock.front', 'alarm_control_panel.house']) {
      expect((await request.get(`${API}/devices/${id}/activity`, { headers: { 'x-sw-dev-user': 'vi' } })).status(), id).toBe(403);
      expect((await request.get(`${API}/devices/${id}/activity`, { headers: { 'x-sw-dev-user': 'op' } })).status(), id).toBe(200);
    }
    expect((await request.get(`${API}/devices/light.lobby/activity`, { headers: { 'x-sw-dev-user': 'vi' } })).status()).toBe(200);
    await context.setExtraHTTPHeaders({ 'x-sw-dev-user': 'vi' });
    await open(page);
    const flagged = await flaggedIds(page);
    expect(flagged).toContain('light.lobby');
    expect(flagged).not.toContain('lock.front');
    expect(flagged).not.toContain('alarm_control_panel.house');
    await context.setExtraHTTPHeaders({ 'x-sw-dev-user': 'op' });
    await open(page);
    const opFlagged = await flaggedIds(page);
    expect(opFlagged).toContain('lock.front');
  });

  test('the 403 state of the popup (the feed route is answered 403 by the real server for a non-permitted device)', async ({ page }) => {
    await open(page);
    // the real route answers 403 only for a person without the operating permission, who never gets the entry; to see the popup's own 403 state
    // the response of the real route is replaced with a real-shaped 403 body for one call
    await page.route('**/devices/light.dimmer/activity*', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'forbidden', message: 'אין הרשאה לצפות בפעילות ההתקן הזה.' } }) }));
    await hold(page, tile(page, 'light.dimmer'), LONG);
    await expect(panel(page).locator('[data-feed-state="forbidden"]')).toBeVisible();
  });
  test('the period filter sends a UTC since the route accepts and narrows the feed to what the API returns for it', async ({ page, request }) => {
    await open(page);
    const feed: string[] = [];
    page.on('request', (r) => /\/devices\/light\.lobby\/activity/.test(r.url()) && feed.push(r.url()));
    await hold(page, tile(page, 'light.lobby'), LONG);
    await expect(panel(page).locator('.ev').first()).toBeVisible();
    await page.locator('sw-app device-activity [data-filter="period"]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'day' }, bubbles: true, composed: true })));
    await expect.poll(() => feed.at(-1) ?? '').toContain('since=');
    const since = new URL(feed.at(-1)!).searchParams.get('since')!;
    expect(since).toMatch(/Z$/);
    const api = await (await request.get(`${API}/devices/light.lobby/activity?limit=200&since=${encodeURIComponent(since)}`)).json();
    expect(api.items.length).toBeGreaterThan(0);
    expect(api.items.length).toBeLessThan(60);
    await expect.poll(() => panel(page).locator('.ev').count()).toBe(api.items.length);
  });

  test('a tap after the popup closed toggles again (the swallowed click is only the one that ended the press); a hold on the slider opens nothing', async ({ page }) => {
    await open(page);
    const actions: string[] = [];
    page.on('request', (r) => r.method() === 'POST' && /\/actions/.test(r.url()) && actions.push(r.url()));
    const light = tile(page, 'light.lobby');
    await hold(page, light, LONG);
    await expect(opened(page)).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(actions.length).toBe(0);
    await page.keyboard.press('Escape');
    await expect(opened(page)).toHaveCount(0);
    await page.waitForTimeout(900);
    await light.locator('sw-toggle').click();
    await expect.poll(() => actions.length).toBe(1);
    // the brightness slider of the tile keeps its own press: a long hold on it opens no popup
    const slider = light.locator('sw-slider, input[type="range"], [role="slider"]').first();
    if (await slider.count()) {
      const b = (await slider.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(LONG);
      await page.mouse.up();
      await expect(opened(page)).toHaveCount(0);
    }
  });

  test('the bubble skin: pills open the popup by a long press and still tap', async ({ page }) => {
    await open(page, '&skin=bubble&scheme=light');
    const actions: string[] = [];
    page.on('request', (r) => r.method() === 'POST' && /\/actions/.test(r.url()) && actions.push(r.url()));
    const pill = area(page).locator('sw-pill[data-entity="light.lobby"]');
    await hold(page, pill, LONG);
    await expect(opened(page)).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(actions.length).toBe(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    await pill.click({ position: { x: 150, y: 20 } });
    await expect.poll(() => actions.length).toBe(1);
  });

  test('layout edit mode: a long press on a tile opens nothing', async ({ page }) => {
    await open(page);
    await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click();
    await page.locator('sw-app sw-user-menu [data-menu-screen-edit="devices-layout"]').click();
    await expect(area(page).locator('[data-layout-bar]')).toBeVisible();
    await page.waitForTimeout(500);
    await hold(page, tile(page, 'light.lobby'), LONG);
    await page.waitForTimeout(400);
    await expect(opened(page)).toHaveCount(0);
    await area(page).locator('[data-layout-cancel], sw-button[data-layout-cancel]').first().click().catch(() => {});
  });

  test('the building screen tiles panel (the items of the building) carries the gesture too', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic#/devices/building');
    await page.waitForSelector('sw-app devices-building');
    await page.waitForTimeout(1200);
    await page.locator('sw-app devices-building [data-floor-chip="lights"]').first().click();
    const tp = page.locator('sw-app devices-tiles-panel [data-entity="light.lobby"]').first();
    await expect(tp).toBeVisible();
    await hold(page, tp, LONG);
    await expect(opened(page)).toHaveCount(1);
    await expect(panel(page).locator('.ev').first()).toBeVisible();
  });
  test('settings: the retention field (7..365) saves through the real route and the server refuses values outside the range', async ({ page, request }) => {
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app');
    const input = page.locator('sw-app input[data-set-activity-retention]');
    await page.locator('sw-app sw-tabs[data-settings-tabs]').evaluate((el) => el.dispatchEvent(new CustomEvent('change', { detail: { id: 'media' }, bubbles: true, composed: true }))); // the tab of the retention rows
    await expect(input).toBeVisible({ timeout: 20000 });
    expect(await input.inputValue()).toBe('90');
    await expect(page.locator('sw-app').getByText('שמירת היסטוריית פעילות (ימים)')).toBeVisible();
    await input.fill('30');
    await input.blur();
    await page.locator('sw-app sw-button').filter({ hasText: 'שמור' }).first().click();
    await expect.poll(async () => (await (await request.get(`${API}/settings`)).json()).settings['device_activity.retention_days']).toBe(30);
    const feed = await (await request.get(`${API}/devices/light.lobby/activity?limit=1`)).json();
    expect(feed.retention_days).toBe(30);
    for (const bad of [6, 366]) expect((await request.patch(`${API}/settings`, { data: { 'device_activity.retention_days': bad } })).status()).toBe(422);
    expect((await request.patch(`${API}/settings`, { data: { 'device_activity.retention_days': 90 } })).status()).toBe(200);
  });
});
