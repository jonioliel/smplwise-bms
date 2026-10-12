import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import { useSmplwiseWiskeyScreens } from './wiskey-ui-mode';

// The SMPLWISE WisKey screens, not the embedded WisKey panel (the default since the 2026-09-28 decision).
useSmplwiseWiskeyScreens();

// Evidence for the entry log ("פעילות", #/wiskey/events) against a LIVE backend: first CR-005 phase 1b (the activity log, read-only), now the
// native screen of CR-036 slice S8, which reads the typed endpoint GET /api/v1/access-control/events. The mocked-backend spec
// (evidence-access-events.spec.ts) covers every state and the wire shapes; this one proves the same screen against the real backend, its real
// permissions and WisKey's own event semantics.
//
// Part 1 runs against a plain developer backend (no Home Assistant, so no WisKey): the screen says plainly that the integration is not connected
// and shows no rows, and the tab is gated on access.events.read exactly like the typed read. Runs with SW_LIVE=1 (and NOT SW_WISKEY_FIXTURE=1).
//
// Part 2 runs only against the committed fixture backend tests/fixtures/wiskey_fake_ha.py (the real SMPLWISE backend with an in-process fake Home
// Assistant answering like WisKey; its events/list follows WisKey's own EventCache.query): the list, the result pills, the filters, "load more",
// the refetch on a change notice, the refusal of a DST wall time and an expired cursor. Runs with SW_LIVE=1 SW_WISKEY_FIXTURE=1, one project
// (desktop); how to start the fixture is at the top of that file. The fixture's WisKey does not list `events/detail`, `users/photo_get` or
// `events/export`, so the drawer shows the row alone and the export button is absent - the integration's own `api.commands` decides.

const HREF = '#/wiskey/events';
const RAIL = 'sw-app nav.rail';
const SCREEN = 'wiskey-events';

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('the entry log without WisKey (CR-005 phase 1b, CR-036 S8)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');

  test('the screen says plainly that the integration is not connected and shows nothing invented', async ({ page, request }, testInfo) => {
    const reply = await (await request.get('/api/v1/access-control/events')).json();
    expect(reply.state).toBe('ha_not_configured');
    expect(reply.events).toBeNull();

    await open(page, '/wiskey/overview');
    // the WisKey area's own tab row: the entry center and the activity log, nothing from other areas
    const tab = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tab).toHaveCount(1, { timeout: 30000 });
    await expect(tab).toContainText('פעילות');
    await expect(page.locator('sw-tabs a[href="#/wiskey/overview"]')).toContainText('מרכז הכניסה');
    await tab.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);

    const screen = page.locator(SCREEN);
    const panel = screen.locator('sw-state-panel[data-wiskey-state="ha_not_configured"]');
    await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(panel).toHaveAttribute('heading', 'בקרת הכניסה אינה מחוברת בסביבה הזו');
    // nothing invented: no rows, no "load more", and no platform name on an operator screen
    await expect(screen.locator('button.row')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-events-more]')).toHaveCount(0);
    expect(await screen.evaluate((el) => (el as HTMLElement).innerText)).not.toMatch(/WisKey|Home Assistant|hikvision/i);
    await page.screenshot({ path: testInfo.outputPath('wiskey-events-not-configured.png') });
  });

  test('the tab and the screen are gated on access.events.read: a viewer has neither, an operator has both', async ({ page, browser, request }, testInfo) => {
    const bindings: string[] = [];
    let roleId: string | undefined;
    const tag = testInfo.project.name; // unique per project: the viewport projects may run this test concurrently
    const bind = async (username: string, role: string, scopeType = 'installation', scopeId = '*') => {
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
      const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role, scope_type: scopeType, scope_id: scopeId } });
      expect(r.status()).toBeLessThan(300);
      bindings.push(((await r.json()) as { id: string }).id);
    };
    try {
      // 1. a role without access.read: no WisKey area, no activity tab, the typed address shows the panel, and so does the API
      const role = await request.post('/api/v1/access/roles', { data: { name: `Entry log no access (${tag})`, description: 'evidence', permissions: ['map.read', 'video.live'] } });
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
      expect((await p1.request.get('/api/v1/access-control/events')).status()).toBe(403);
      await c1.close();

      // 2. a plain installation-wide viewer holds access.read only: the entry center is theirs, the log is not - no tab, the panel, a refusal
      const viewer = `wiskeyevviewer${tag}`;
      await bind(viewer, 'viewer');
      const c2 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p2 = await c2.newPage();
      await open(p2, '/wiskey/overview');
      await expect(p2.locator('sw-tabs a[href="#/wiskey/overview"]')).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      await open(p2, '/wiskey/events');
      await expect(p2.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      expect((await p2.request.get('/api/v1/access-control/events')).status()).toBe(403);
      await c2.close();

      // 3. an operator holds access.events.read: the tab is there and opens the screen (no integration here, so the plain state)
      const operator = `wiskeyevoperator${tag}`;
      await bind(operator, 'operator');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': operator } });
      const p3 = await c3.newPage();
      await open(p3, '/wiskey/overview');
      await expect(p3.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await open(p3, '/wiskey/events');
      await expect(p3.locator(`${SCREEN} sw-state-panel[data-wiskey-state="ha_not_configured"]`)).toBeVisible({ timeout: 30000 });
      await c3.close();

      // 4. and the administrator (the bootstrap identity of this backend)
      await open(page, '/wiskey/overview');
      await expect(page.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------- fixture WisKey

const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
type Sent = { type: string; filters?: Record<string, unknown> }[];

test.describe('the entry log against the fixture WisKey (CR-005 phase 1b, CR-036 S8)', () => {
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

  const rows = (page: Page) => page.locator(`${SCREEN} button.row[data-row-id]`);

  async function openEvents(page: Page) {
    await open(page, '/wiskey/events');
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(500);
  }

  async function choose(page: Page, filter: string, id: string) {
    const dd = page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="${filter}"]`);
    await dd.locator('[data-dropdown-chip]').click();
    await dd.locator(`[role="option"][data-id="${id}"]`).click();
  }

  async function listed(): Promise<Record<string, unknown>[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/events/list').map((m) => m.filters ?? {});
  }

  test('the first page: 100 rows newest first, WisKey fields only, and a distinct pill per kind of row', async ({ page }, testInfo) => {
    await openEvents(page);
    const screen = page.locator(SCREEN);
    await expect(rows(page)).toHaveCount(100);
    expect((await listed())[0]).toEqual({ limit: 100 });
    // newest first: the first row is the fixture's newest event (08:00 Asia/Jerusalem, shown in the station's zone)
    const first = rows(page).first();
    await expect(first).toHaveAttribute('data-row-id', 'ev-0000');
    await expect(first.locator('[data-wiskey-event-time]')).toContainText('08:00');
    await expect(first.locator('[data-wiskey-event-station]')).toContainText('שער ראשי');
    // granted / denied pills each in their own kind and words; the fixture's "unknown" rows are door records (neutral)
    await expect(screen.locator('button.row sw-badge[data-wiskey-event-result="granted"]').first()).toHaveAttribute('kind', 'live');
    await expect(screen.locator('button.row sw-badge[data-wiskey-event-result="granted"]').first()).toHaveAttribute('label', 'אושר');
    await expect(screen.locator('button.row sw-badge[data-wiskey-event-result="denied"]').first()).toHaveAttribute('kind', 'error');
    await expect(screen.locator('button.row sw-badge[data-wiskey-event-result="denied"]').first()).toHaveAttribute('label', 'נדחה');
    // the fixture's first record is a door record (result "unknown", event type door_unlocked, a person on it): the title keeps the
    // person, the pill says what happened in the neutral kind - not a green or red access verdict
    await expect(first.locator('[data-wiskey-event-person]')).toHaveText('Dana Cohen');
    await expect(first.locator('sw-badge[data-wiskey-event-result="unknown"]')).toHaveAttribute('kind', 'neutral');
    await expect(first.locator('sw-badge[data-wiskey-event-result="unknown"]')).toHaveAttribute('label', 'המנעול שוחרר');
    // an event without identity says so instead of inventing one
    await expect(page.locator(`${SCREEN} button.row[data-row-id="ev-0004"] [data-wiskey-event-person]`)).toHaveText('לא זוהה');
    // the projection drops WisKey's masked card: it never reaches the page
    await expect(screen.getByText(/\*{4}1234/)).toHaveCount(0);
    // the drawer follows the opened row
    await rows(page).nth(1).click();
    await expect(page.locator(`${SCREEN} wiskey-event-drawer[data-wiskey-event-detail="ev-0001"]`)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('wiskey-events-ready.png'), fullPage: true });
  });

  test('"load more" appends the next page over the cursor and then the matching records end', async ({ page }) => {
    await openEvents(page);
    const more = page.locator(`${SCREEN} [data-wiskey-events-more]`);
    await expect(more).toBeVisible();
    await more.click();
    await expect(rows(page)).toHaveCount(130, { timeout: 15000 });
    // appended, not replaced: the first row is still the newest, the last is the oldest
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-0000');
    await expect(rows(page).last()).toHaveAttribute('data-row-id', 'ev-0129');
    const sent = await listed();
    expect(sent.at(-1)).toEqual({ limit: 100, before: 'ev-0099' });
    await expect(more).toHaveCount(0);
  });

  test('filters: the chips and the search become WisKey\'s own filters, a period is typed in the station\'s zone, and "clear" puts the bare page back', async ({ page, request }) => {
    await openEvents(page);
    const screen = page.locator(SCREEN);
    // the fixture's generator gives exactly ev-0041 and ev-0061 for these (lobby, Yossi 1017, granted by PIN at door 1,
    // 00:00-07:00 local); the count is taken from the backend below rather than trusted from this comment
    await choose(page, 'result', 'granted');
    await choose(page, 'method', 'pin');
    await choose(page, 'station', 'lobby');
    await choose(page, 'door', '1');
    await screen.locator('[data-wiskey-search]').fill('yossi');
    await choose(page, 'range', 'custom');
    const dialog = screen.locator('sw-dialog[data-wiskey-custom-range]');
    // the filter zone is the selected station's clock zone
    await expect(dialog.locator('[data-wiskey-events-zone]')).toContainText('Asia/Jerusalem');
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-09-27T00:00');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-09-27T07:00');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    // exactly WisKey's filter keys; the local times became absolute instants in the station's zone (UTC+03:00)
    await expect.poll(async () => (await listed()).at(-1)).toEqual({ station_id: 'lobby', person: 'yossi', result: 'granted', authentication: 'pin', door: 1, start: '2026-09-26T21:00:00.000Z', end: '2026-09-27T04:00:00.000Z', limit: 100 });
    // the screen shows what the backend returns for the same filters, and every row matches them
    const direct = await (await request.get('/api/v1/access-control/events?station_id=lobby&person=yossi&result=granted&authentication=pin&door=1&start=2026-09-26T21:00:00.000Z&end=2026-09-27T04:00:00.000Z')).json();
    const expected = direct.events.records.length as number;
    expect(expected).toBeGreaterThan(0);
    await expect(rows(page)).toHaveCount(expected, { timeout: 15000 });
    for (const r of await rows(page).all()) {
      await expect(r.locator('sw-badge[data-wiskey-event-result]')).toHaveAttribute('data-wiskey-event-result', 'granted');
      await expect(r.locator('[data-wiskey-event-station]')).toContainText('לובי');
      await expect(r.locator('[data-wiskey-event-station]')).toContainText('קוד');
      await expect(r.locator('[data-wiskey-event-person]')).toContainText('Yossi Levi');
    }

    // a filter with no match says so
    await screen.locator('[data-wiskey-search]').fill('nobody-here');
    await expect(screen.locator('sw-state-panel[data-wiskey-events-empty]')).toBeVisible({ timeout: 15000 });

    // clearing sends the bare first page again
    await screen.locator('[data-wiskey-filter-clear]').click();
    await expect(rows(page)).toHaveCount(100, { timeout: 15000 });
    expect((await listed()).at(-1)).toEqual({ limit: 100 });
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

  test('a change notice that lands while "load more" is in flight does not silently drop the new page (review fix 1)', async ({ page }) => {
    await openEvents(page);
    // hold every events/list answer 2 s, so the notice below arrives while page 2 is still being fetched
    expect((await control.post('/events/delay', { data: { seconds: 2 } })).status()).toBe(200);
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-events-more]`)).toContainText('טוען…');
    expect((await control.post('/events/add', { data: { count: 1 } })).status()).toBe(200);
    // page 2 lands and stays: the queued notice reload is judged when it runs (two pages shown by then) and turns
    // into the "something changed" note instead of a silent page-1 reload
    const pending = page.locator(`${SCREEN} [data-wiskey-events-pending]`);
    await expect(pending).toBeVisible({ timeout: 15000 });
    await expect(rows(page)).toHaveCount(130);
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-0000');
    await page.waitForTimeout(3000); // longer than one delayed answer: no late page-1 reload replaces the list
    await expect(rows(page)).toHaveCount(130);
    await expect(pending).toBeVisible();
    // only the reader's refresh brings page 1 (with the new record) back
    expect((await control.post('/events/delay', { data: { seconds: 0 } })).status()).toBe(200);
    await pending.locator('sw-button').click();
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-1001', { timeout: 15000 });
    await expect(rows(page)).toHaveCount(100);
    await expect(pending).toHaveCount(0);
  });

  test('a from / until wall time that a DST change repeats or skips is refused, never coerced (review fix 2)', async ({ page, request }) => {
    // the fixture's stations and default zone are Asia/Jerusalem; its 2026 transitions (checked against ICU):
    // 2026-03-27 02:00 +02:00 -> 03:00 +03:00 (02:30 does not exist) and 2026-10-25 02:00 +03:00 -> 01:00 +02:00
    // (01:30 happens twice)
    const feed = await (await request.get('/api/v1/access-control/stations')).json();
    const gate = (feed.stations as { id: string; zone: { kind: string; name: string } }[]).find((s) => s.id === 'gate');
    expect(gate?.zone).toEqual({ kind: 'iana', name: 'Asia/Jerusalem' });
    expect(feed.default_zone).toEqual({ kind: 'iana', name: 'Asia/Jerusalem' });

    await openEvents(page);
    const screen = page.locator(SCREEN);
    await choose(page, 'station', 'gate');
    await expect.poll(async () => (await listed()).at(-1)).toEqual({ station_id: 'gate', limit: 100 });
    await choose(page, 'range', 'custom');
    const dialog = screen.locator('sw-dialog[data-wiskey-custom-range]');
    await expect(dialog.locator('[data-wiskey-events-zone]')).toContainText('Asia/Jerusalem');
    const sentBefore = (await listed()).length;
    const error = dialog.locator('[data-wiskey-events-filter-error]');

    // fall-back: 01:30 on 2026-10-25 is both 01:30+03:00 and 01:30+02:00 -> ambiguous, refused
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-10-25T01:30');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(error).toHaveAttribute('data-wiskey-events-filter-error', 'clock_ambiguous');
    await expect(error).toContainText('מופיעה פעמיים בסיום שעון הקיץ');

    // spring-forward: 02:30 on 2026-03-27 never happens -> nonexistent, refused (in the "until" field this time)
    await dialog.locator('[data-wiskey-filter-start]').fill('');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-03-27T02:30');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(error).toHaveAttribute('data-wiskey-events-filter-error', 'clock_nonexistent');
    await expect(error).toContainText('אינה קיימת בתחילת שעון הקיץ');

    // neither refusal sent anything to WisKey
    await page.waitForTimeout(500);
    expect((await listed()).length).toBe(sentBefore);

    // control: an unambiguous time right after each transition is converted exactly (03:30 is +03:00 on 2026-03-27, +02:00 on 2026-10-25)
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-03-27T03:30');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-10-25T03:30');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect.poll(async () => (await listed()).at(-1)).toEqual({ station_id: 'gate', start: '2026-03-27T00:30:00.000Z', end: '2026-10-25T01:30:00.000Z', limit: 100 });
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
