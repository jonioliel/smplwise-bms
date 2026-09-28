import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for the WisKey activity log (CR-005 phase 1b, read-only, access.read): the "פעילות" tab at #/wiskey/events.
//
// Part 1 runs against a plain developer backend (no Home Assistant, so no WisKey): the tab is reachable, says plainly
// that WisKey is not connected and shows no records, and it is gated on access.read at installation scope exactly like
// the entry center. Runs with SW_LIVE=1 (and NOT SW_WISKEY_FIXTURE=1).
//
// Part 2 runs only against the committed fixture backend tests/fixtures/wiskey_fake_ha.py (the real SMPLWISE backend
// with an in-process fake Home Assistant answering like WisKey; its events/list follows WisKey's own EventCache.query):
// the list, the result badges, filters, "load more", the refetch on a change notice, and an expired cursor. Runs with
// SW_LIVE=1 SW_WISKEY_FIXTURE=1, one project (desktop); how to start the fixture is at the top of that file.

const HREF = '#/wiskey/events';
const RAIL = 'sw-app nav.rail';
const SCREEN = 'wiskey-events';

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('WisKey activity log without WisKey (CR-005 phase 1b)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');

  test('the activity tab sits beside the entry center and shows the honest not-configured state', async ({ page, request }, testInfo) => {
    const reply = await (await request.get('/api/v1/intercom/events')).json();
    expect(reply.state).toBe('ha_not_configured');
    expect(reply.events).toBeNull();

    await open(page, '/wiskey/overview');
    // the WisKey area's own tab row: entry center and activity, nothing from other areas
    const tab = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tab).toHaveCount(1, { timeout: 30000 });
    await expect(tab).toContainText('פעילות');
    await expect(page.locator('sw-tabs a[href="#/wiskey/overview"]')).toContainText('מרכז הכניסה');
    await tab.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);

    const screen = page.locator(SCREEN);
    const panel = screen.locator('sw-state-panel[data-wiskey-state="ha_not_configured"]');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(panel).toHaveAttribute('heading', 'WisKey אינו מחובר בסביבה הזו');
    await expect(screen.locator('[data-wiskey-feed="ha_not_configured"]')).toBeVisible();
    // the page says it is not a live feed
    await expect(screen.locator('[data-wiskey-events-nopush]')).toContainText('אינו זרם חי');
    // nothing invented: no filters, no rows, no "load more"
    await expect(screen.locator('[data-wiskey-events-filters]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-events-table]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-events-more]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-events-not-configured.png') });
  });

  test('the activity tab is gated on access.read at installation scope, like the entry center', async ({ page, browser, request }, testInfo) => {
    const bindings: string[] = [];
    let roleId: string | undefined;
    let siteId: string | undefined;
    const tag = testInfo.project.name; // unique per project: the viewport projects may run this test concurrently
    const bind = async (username: string, role: string, scopeType = 'installation', scopeId = '*') => {
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
      const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role, scope_type: scopeType, scope_id: scopeId } });
      expect(r.status()).toBeLessThan(300);
      bindings.push(((await r.json()) as { id: string }).id);
    };
    try {
      // 1. a role without access.read: no WisKey area, no activity tab, the typed address refuses, and so does the API
      const role = await request.post('/api/v1/access/roles', { data: { name: `WisKey events no access (${tag})`, description: 'evidence', permissions: ['map.read', 'video.live'] } });
      expect(role.status()).toBeLessThan(300);
      roleId = ((await role.json()) as { id: string }).id;
      const noAccess = `wiskeyevno${tag}`;
      await bind(noAccess, roleId);
      const c1 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': noAccess } });
      const p1 = await c1.newPage();
      await open(p1, '/live');
      await expect(p1.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator(`${RAIL} a[href^="#/wiskey/"]`)).toHaveCount(0);
      await open(p1, '/wiskey/events');
      await expect(p1.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      await expect(p1.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      expect((await p1.request.get('/api/v1/intercom/events')).status()).toBe(403);
      await c1.close();

      // 2. access.read held only below installation scope (a floor-scoped viewer): the tab is not offered either
      const site = await request.post('/api/v1/sites', { data: { name: `WisKey events scoped (${tag})` } });
      expect(site.status()).toBe(201);
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'B' } });
      const floor = await request.post(`/api/v1/buildings/${((await building.json()) as { id: string }).id}/floors`, { data: { name: 'F' } });
      const floorUser = `wiskeyevfloor${tag}`;
      await bind(floorUser, 'viewer', 'floor', ((await floor.json()) as { id: string }).id);
      const c2 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': floorUser } });
      const p2 = await c2.newPage();
      const me2 = await (await p2.request.get('/api/v1/me')).json();
      expect(me2.permissions_any).toContain('access.read');
      expect(me2.permissions_installation).not.toContain('access.read');
      await open(p2, '/live');
      await expect(p2.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`${RAIL} a[href^="#/wiskey/"]`)).toHaveCount(0);
      await open(p2, '/wiskey/events');
      await expect(p2.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      await expect(p2.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      expect((await p2.request.get('/api/v1/intercom/events')).status()).toBe(403);
      await c2.close();

      // 3. a plain installation-wide viewer holds access.read: the tab is there and opens the screen
      const viewer = `wiskeyevviewer${tag}`;
      await bind(viewer, 'viewer');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p3 = await c3.newPage();
      await open(p3, '/wiskey/overview');
      await expect(p3.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await open(p3, '/wiskey/events');
      await expect(p3.locator(`${SCREEN} sw-state-panel[data-wiskey-state="ha_not_configured"]`)).toBeVisible({ timeout: 30000 });
      await c3.close();

      // 4. and the admin
      await open(page, '/wiskey/overview');
      await expect(page.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------- fixture WisKey

const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
type Sent = { type: string; filters?: Record<string, unknown> }[];

test.describe('WisKey activity log against the fixture WisKey (CR-005 phase 1b)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    await api.dispose();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version})`);
    control = await pwRequest.newContext({ baseURL: CONTROL });
  });

  test.beforeEach(async () => {
    expect((await control.post('/reset')).status()).toBe(200);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
  });

  const rows = (page: Page) => page.locator(`${SCREEN} sw-table[data-wiskey-events-table] tbody tr`);

  async function openEvents(page: Page) {
    await open(page, '/wiskey/events');
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(500);
  }

  async function listed(): Promise<Record<string, unknown>[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/events/list').map((m) => m.filters ?? {});
  }

  test('the first page: 100 rows newest first, WisKey fields only, and a distinct badge per result', async ({ page }, testInfo) => {
    await openEvents(page);
    const screen = page.locator(SCREEN);
    await expect(rows(page)).toHaveCount(100);
    await expect(screen.locator('[data-wiskey-events-count]')).toHaveAttribute('data-wiskey-events-count', '100');
    expect((await listed())[0]).toEqual({ limit: 100 });
    // newest first: the first row is the fixture's newest event (08:00 Asia/Jerusalem, shown in the station's zone)
    const first = rows(page).first();
    await expect(first).toHaveAttribute('data-row-id', 'ev-0000');
    await expect(first.locator('[data-wiskey-event-time]')).toContainText('UTC+03:00');
    await expect(first.locator('[data-wiskey-event-station]')).toContainText('שער ראשי');
    // result badges: granted / denied / unknown each in its own kind and words
    await expect(screen.locator('sw-badge[data-wiskey-event-result="granted"]').first()).toHaveAttribute('kind', 'live');
    await expect(screen.locator('sw-badge[data-wiskey-event-result="granted"]').first()).toHaveAttribute('label', 'אושר');
    await expect(screen.locator('sw-badge[data-wiskey-event-result="denied"]').first()).toHaveAttribute('kind', 'error');
    await expect(screen.locator('sw-badge[data-wiskey-event-result="denied"]').first()).toHaveAttribute('label', 'נדחה');
    await expect(screen.locator('sw-badge[data-wiskey-event-result="unknown"]').first()).toHaveAttribute('kind', 'unknown');
    // an event without identity says so instead of inventing one
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="ev-0004"] [data-wiskey-event-person]`)).toHaveText('משתמש לא מזוהה');
    // the projection drops WisKey's masked card: it never reaches the page
    await expect(screen.getByText(/\*{4}1234/)).toHaveCount(0);
    // the inspector follows the selected row
    await rows(page).nth(1).click();
    await expect(screen.locator('[data-wiskey-event-detail="ev-0001"]')).toBeVisible();
    await expect(screen.locator('[data-wiskey-events-nopush]')).toContainText('אינו זרם חי');
    await page.screenshot({ path: testInfo.outputPath('wiskey-events-ready.png'), fullPage: true });
  });

  test('"load more" appends the next page over the cursor and then says the matching records ended', async ({ page }) => {
    await openEvents(page);
    const more = page.locator(`${SCREEN} [data-wiskey-events-more]`);
    await expect(more).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-wiskey-events-end]`)).toHaveCount(0);
    await more.click();
    await expect(rows(page)).toHaveCount(130, { timeout: 15000 });
    // appended, not replaced: the first row is still the newest, the last is the oldest
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-0000');
    await expect(rows(page).last()).toHaveAttribute('data-row-id', 'ev-0129');
    const sent = await listed();
    expect(sent.at(-1)).toEqual({ limit: 100, before: 'ev-0099' });
    await expect(more).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-events-end]`)).toBeVisible();
  });

  test('filters: set, flagged as not applied until applied, sent as WisKey filters, and cleared again', async ({ page, request }, testInfo) => {
    await openEvents(page);
    const screen = page.locator(SCREEN);
    // the fixture's generator gives exactly ev-0041 and ev-0061 for these (lobby, Yossi 1017, granted by PIN at door 1,
    // 00:00-07:00 local); the count is taken from the backend below rather than trusted from this comment
    await screen.locator('[data-wiskey-filter-result]').selectOption('granted');
    await screen.locator('[data-wiskey-filter-auth]').selectOption('pin');
    await screen.locator('[data-wiskey-filter-station]').selectOption('lobby');
    await screen.locator('[data-wiskey-filter-door]').selectOption('1');
    await screen.locator('[data-wiskey-filter-person]').fill('yossi');
    // the filter zone is the selected station's clock zone
    await expect(screen.locator('[data-wiskey-events-zone]')).toContainText('Asia/Jerusalem');
    await screen.locator('[data-wiskey-filter-start]').fill('2026-09-27T00:00');
    await screen.locator('[data-wiskey-filter-end]').fill('2026-09-27T07:00');
    await expect(screen.locator('[data-wiskey-events-dirty]')).toBeVisible();
    await expect(rows(page)).toHaveCount(100); // nothing re-queried before "סינון"
    await screen.locator('[data-wiskey-filter-apply]').click();
    await expect(screen.locator('[data-wiskey-events-dirty]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-events-filter-count]')).toHaveAttribute('data-wiskey-events-filter-count', '7');
    // exactly WisKey's filter keys; the local times became absolute instants in the station's zone (UTC+03:00)
    await expect.poll(async () => (await listed()).at(-1)).toEqual({ station_id: 'lobby', person: 'yossi', result: 'granted', authentication: 'pin', door: 1, start: '2026-09-26T21:00:00.000Z', end: '2026-09-27T04:00:00.000Z', limit: 100 });
    // the screen shows what the backend returns for the same filters, and every row matches them
    const direct = await (await request.get('/api/v1/intercom/events?station_id=lobby&person=yossi&result=granted&authentication=pin&door=1&start=2026-09-26T21:00:00.000Z&end=2026-09-27T04:00:00.000Z')).json();
    const expected = direct.events.records.length as number;
    expect(expected).toBeGreaterThan(0);
    await expect(rows(page)).toHaveCount(expected, { timeout: 15000 });
    for (const r of await rows(page).all()) {
      await expect(r.locator('sw-badge[data-wiskey-event-result]')).toHaveAttribute('data-wiskey-event-result', 'granted');
      await expect(r.locator('[data-wiskey-event-auth]')).toHaveAttribute('data-wiskey-event-auth', 'pin');
      await expect(r.locator('[data-wiskey-event-station]')).toContainText('לובי');
      await expect(r.locator('[data-wiskey-event-person]')).toContainText('Yossi Levi');
    }
    await page.screenshot({ path: testInfo.outputPath('wiskey-events-filtered.png'), fullPage: true });

    // a filter with no match says so
    await screen.locator('[data-wiskey-filter-person]').fill('nobody-here');
    await screen.locator('[data-wiskey-filter-person]').press('Enter');
    await expect(screen.locator('[data-wiskey-events-empty]')).toBeVisible({ timeout: 15000 });

    // clearing sends the bare first page again
    await screen.locator('[data-wiskey-filter-clear]').click();
    await expect(rows(page)).toHaveCount(100, { timeout: 15000 });
    expect((await listed()).at(-1)).toEqual({ limit: 100 });
    await expect(screen.locator('[data-wiskey-events-filter-count]')).toHaveAttribute('data-wiskey-events-filter-count', '0');

    // the quick "denied entries" chip applies result=denied alone
    await screen.locator('[data-wiskey-events-quick="denied"]').click();
    await expect.poll(async () => (await listed()).at(-1)).toEqual({ result: 'denied', limit: 100 });
  });

  test('a WisKey change notice refetches page 1; with more pages loaded the reader keeps their place and is told', async ({ page }) => {
    await openEvents(page);
    // only page 1 shown: the notice reloads it and the new record is on top
    expect((await control.post('/events/add', { data: { count: 1 } })).status()).toBe(200);
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-1001', { timeout: 15000 });
    await expect(rows(page)).toHaveCount(100);

    // two pages loaded: a notice does not throw the second page away ...
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    await expect(rows(page)).toHaveCount(131, { timeout: 15000 });
    expect((await control.post('/events/add', { data: { count: 1 } })).status()).toBe(200);
    const pending = page.locator(`${SCREEN} [data-wiskey-events-pending]`);
    await expect(pending).toBeVisible({ timeout: 15000 });
    await expect(rows(page)).toHaveCount(131);
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-1001');
    // ... and a refresh brings page 1 back with the newer record
    await pending.locator('sw-button').click();
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-1002', { timeout: 15000 });
    await expect(rows(page)).toHaveCount(100);
    await expect(pending).toHaveCount(0);
  });

  test('a cursor WisKey already pruned is reported, with a reload from the start', async ({ page }) => {
    await openEvents(page);
    expect((await control.post('/events/prune', { data: { keep: 50 } })).status()).toBe(200);
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    const expired = page.locator(`${SCREEN} [data-wiskey-events-cursor-expired]`);
    await expect(expired).toBeVisible({ timeout: 15000 });
    await expect(rows(page)).toHaveCount(100); // what was shown stays
    await expired.locator('sw-button').click();
    await expect(rows(page)).toHaveCount(50, { timeout: 15000 });
    await expect(expired).toHaveCount(0);
  });
});
