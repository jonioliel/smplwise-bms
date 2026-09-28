import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for the WisKey people directory (CR-005 phase 1b, read-only, access.read): the "אנשים" tab at #/wiskey/people.
//
// Part 1 runs against a plain developer backend (no Home Assistant, so no WisKey): the tab is the third WisKey tab in
// both nav designs (reachable from the phone bottom nav too), says plainly that WisKey is not connected and shows no
// rows, and it is gated on access.read at installation scope exactly like the entry center and the activity log. Runs
// with SW_LIVE=1 (and NOT SW_WISKEY_FIXTURE=1).
//
// Part 2 runs only against the committed fixture backend tests/fixtures/wiskey_fake_ha.py (the real SMPLWISE backend
// with an in-process fake Home Assistant answering like WisKey; its users/query follows WisKey's own user_directory.py):
// the first page and its badges, the name / employee-number-only search, filters, paging with the snapshot, the stale
// and incomplete-scan notices, the details pane and a person WisKey no longer has. Runs with SW_LIVE=1
// SW_WISKEY_FIXTURE=1, one project (desktop); how to start the fixture is at the top of that file.

const HREF = '#/wiskey/people';
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';
const SCREEN = 'wiskey-people';

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('WisKey people directory without WisKey (CR-005 phase 1b)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');

  test('the people tab is the third WisKey tab and shows the honest not-configured state, in both designs', async ({ page, request }, testInfo) => {
    const reply = await (await request.get('/api/v1/intercom/people')).json();
    expect(reply.state).toBe('ha_not_configured');
    expect(reply.people).toBeNull();

    for (const design of ['a', 'b'] as const) {
      await open(page, '/wiskey/overview', design);
      // the WisKey area's own tab row: entry center, activity, people - in that order, nothing from other areas
      const tabs = page.locator('sw-tabs a[href^="#/wiskey/"]');
      await expect(tabs).toHaveCount(3, { timeout: 30000 });
      await expect(tabs.nth(0)).toHaveAttribute('href', '#/wiskey/overview');
      await expect(tabs.nth(1)).toHaveAttribute('href', '#/wiskey/events');
      await expect(tabs.nth(2)).toHaveAttribute('href', HREF);
      const tab = page.locator(`sw-tabs a[href="${HREF}"]`);
      await expect(tab).toContainText('אנשים');
      await tab.click();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);

      const screen = page.locator(SCREEN);
      const panel = screen.locator('sw-state-panel[data-wiskey-state="ha_not_configured"]');
      await expect(panel).toBeVisible({ timeout: 30000 });
      await expect(panel).toHaveAttribute('heading', 'WisKey אינו מחובר בסביבה הזו');
      await expect(screen.locator('[data-wiskey-feed="ha_not_configured"]')).toBeVisible();
      // the page says it is not live
      await expect(screen.locator('[data-wiskey-people-nopush]')).toContainText('אינה מתעדכנת בזמן אמת');
      // nothing invented: no search, no rows, no paging, no details, and no add / edit affordance anywhere
      await expect(screen.locator('[data-wiskey-people-filters]')).toHaveCount(0);
      await expect(screen.locator('[data-wiskey-people-table]')).toHaveCount(0);
      await expect(screen.locator('[data-wiskey-people-paging]')).toHaveCount(0);
      await expect(screen.locator('[data-wiskey-person-detail]')).toHaveCount(0);
      await expect(screen.getByText(/הוספת|עריכה|Edit/)).toHaveCount(0);
      if (design === 'a') await page.screenshot({ path: testInfo.outputPath('wiskey-people-not-configured.png') });
    }
  });

  test('the phone bottom nav reaches the people tab in both designs (design A: 5th icon; design B: the "עוד" overflow)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint; other projects are wider');
    // design A: WisKey is a direct bottom icon, and the tab row below the top bar carries the third tab
    await open(page, '/live', 'a');
    const bottomA = page.locator(BOTTOM);
    await expect(bottomA).toBeVisible({ timeout: 30000 });
    await bottomA.locator('a[href="#/wiskey/overview"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/overview');
    const tabA = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tabA).toBeVisible({ timeout: 30000 });
    await tabA.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
    await expect(page.locator(`${SCREEN} sw-state-panel[data-wiskey-state="ha_not_configured"]`)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-mobile-a.png') });

    // design B: WisKey sits behind the "עוד" overflow menu (the 6th of 7 groups)
    await open(page, '/live', 'b');
    const bottomB = page.locator(BOTTOM);
    await expect(bottomB).toBeVisible({ timeout: 30000 });
    await bottomB.locator('button').click();
    const overflowLink = page.locator('sw-app .bottom-overflow a[href="#/wiskey/overview"]');
    await expect(overflowLink).toBeVisible({ timeout: 5000 });
    await overflowLink.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/overview');
    const tabB = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tabB).toBeVisible({ timeout: 30000 });
    await tabB.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
    await expect(page.locator(`${SCREEN} sw-state-panel[data-wiskey-state="ha_not_configured"]`)).toBeVisible({ timeout: 30000 });
    await expect(bottomB.locator('button')).toHaveClass(/active/);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-mobile-b.png') });
  });

  test('the people tab is gated on access.read at installation scope, like the entry center and the activity log', async ({ page, browser, request }, testInfo) => {
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
      // 1. a role without access.read: no WisKey area, no people tab, the typed address refuses, and so does the API
      const role = await request.post('/api/v1/access/roles', { data: { name: `WisKey people no access (${tag})`, description: 'evidence', permissions: ['map.read', 'video.live'] } });
      expect(role.status()).toBeLessThan(300);
      roleId = ((await role.json()) as { id: string }).id;
      const noAccess = `wiskeyppno${tag}`;
      await bind(noAccess, roleId);
      const c1 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': noAccess } });
      const p1 = await c1.newPage();
      await open(p1, '/live');
      await expect(p1.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator(`${RAIL} a[href^="#/wiskey/"]`)).toHaveCount(0);
      await open(p1, '/wiskey/people');
      await expect(p1.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      await expect(p1.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      expect((await p1.request.get('/api/v1/intercom/people')).status()).toBe(403);
      expect((await p1.request.get('/api/v1/intercom/people/u001')).status()).toBe(403);
      await c1.close();

      // 2. access.read held only below installation scope (a floor-scoped viewer): the tab is not offered either
      const site = await request.post('/api/v1/sites', { data: { name: `WisKey people scoped (${tag})` } });
      expect(site.status()).toBe(201);
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'B' } });
      const floor = await request.post(`/api/v1/buildings/${((await building.json()) as { id: string }).id}/floors`, { data: { name: 'F' } });
      const floorUser = `wiskeyppfloor${tag}`;
      await bind(floorUser, 'viewer', 'floor', ((await floor.json()) as { id: string }).id);
      const c2 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': floorUser } });
      const p2 = await c2.newPage();
      const me2 = await (await p2.request.get('/api/v1/me')).json();
      expect(me2.permissions_any).toContain('access.read');
      expect(me2.permissions_installation).not.toContain('access.read');
      await open(p2, '/live');
      await expect(p2.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`${RAIL} a[href^="#/wiskey/"]`)).toHaveCount(0);
      await open(p2, '/wiskey/people');
      await expect(p2.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      await expect(p2.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      expect((await p2.request.get('/api/v1/intercom/people')).status()).toBe(403);
      await c2.close();

      // 3. a plain installation-wide viewer holds access.read: the tab is there and opens the screen
      const viewer = `wiskeyppviewer${tag}`;
      await bind(viewer, 'viewer');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p3 = await c3.newPage();
      await open(p3, '/wiskey/overview');
      await expect(p3.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await open(p3, '/wiskey/people');
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
type Query = { query: string; filters: Record<string, unknown>; offset: number; limit: number; snapshot: string };
type Sent = ({ id: number; type: string } & Partial<Query> & { user_id?: string })[];

test.describe('WisKey people directory against the fixture WisKey (CR-005 phase 1b)', () => {
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

  const rows = (page: Page) => page.locator(`${SCREEN} sw-table[data-wiskey-people-table] tbody tr`);
  const results = (page: Page) => page.locator(`${SCREEN} [data-wiskey-people-results]`);

  async function openPeople(page: Page) {
    await open(page, '/wiskey/people');
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(500);
  }

  async function queried(): Promise<Query[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/users/query').map(({ id: _id, type: _type, user_id: _uid, ...q }) => q as Query);
  }

  async function fetched(): Promise<string[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/users/get').map((m) => m.user_id ?? '');
  }

  test('the first page: 50 of 130 by employee number, WisKey fields only, a distinct badge per sync state, no phones or cards', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await expect(rows(page)).toHaveCount(50);
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '130');
    await expect(results(page)).toContainText('1–50 / 130');
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '1');
    await expect(screen.locator('[data-wiskey-people-page]')).toContainText('1 / 3');
    // exactly WisKey's users/query frame: an EMPTY query, the sort alone, WisKey's default page, no snapshot yet
    expect((await queried())[0]).toEqual({ query: '', filters: { sort: 'employee' }, offset: 0, limit: 50, snapshot: '' });
    // by employee number: the first row is 1000 (a Hebrew name, shown as such), the last of the page 1049
    const first = rows(page).first();
    await expect(first).toHaveAttribute('data-row-id', 'u001');
    await expect(first.locator('[data-wiskey-person-name]')).toHaveText('דנה כהן');
    await expect(first.locator('[data-wiskey-person-employee]')).toHaveText('1000');
    await expect(rows(page).last()).toHaveAttribute('data-row-id', 'u050');
    // sync badges: synced / pending / offline / error / unassigned, each in its own kind and words (WisKey personStatus)
    await expect(first.locator('sw-badge[data-wiskey-person-sync]')).toHaveAttribute('data-wiskey-person-sync', 'synced');
    await expect(first.locator('sw-badge[data-wiskey-person-sync]')).toHaveAttribute('label', 'מסונכרן');
    await expect(first.locator('[data-wiskey-person-assignments]')).toHaveAttribute('data-wiskey-person-assignments', '2');
    await expect(screen.locator('sw-badge[data-wiskey-person-sync="pending"]').first()).toHaveAttribute('kind', 'stale');
    await expect(screen.locator('sw-badge[data-wiskey-person-sync="offline"]').first()).toHaveAttribute('kind', 'offline');
    await expect(screen.locator('sw-badge[data-wiskey-person-sync="error"]').first()).toHaveAttribute('kind', 'error');
    await expect(screen.locator('sw-badge[data-wiskey-person-sync="unassigned"]').first()).toHaveAttribute('label', 'ללא שיוך');
    // the active flag and the validity state per row (u009 is inactive, u004's window ended, u007's has not begun)
    await expect(page.locator(`${SCREEN} tr[data-row-id="u009"] [data-wiskey-person-active]`)).toHaveAttribute('data-wiskey-person-active', 'false');
    await expect(page.locator(`${SCREEN} tr[data-row-id="u004"] [data-wiskey-person-validity]`)).toHaveAttribute('data-wiskey-person-validity', 'validity_expired');
    await expect(page.locator(`${SCREEN} tr[data-row-id="u007"] [data-wiskey-person-validity]`)).toHaveAttribute('data-wiskey-person-validity', 'validity_future');
    await expect(page.locator(`${SCREEN} tr[data-row-id="u010"] [data-wiskey-person-validity]`)).toHaveAttribute('data-wiskey-person-validity', 'validity_current');
    await expect(first.locator('[data-wiskey-person-validity]')).toHaveAttribute('data-wiskey-person-validity', 'permanent');
    // the projection drops WisKey's phones, masked cards, PIN flag and profile values: none of them reach the page
    await expect(screen.getByText(/\+9725/)).toHaveCount(0);
    await expect(screen.getByText(/••••/)).toHaveCount(0);
    await expect(screen.getByText(/PIN|Engineering|טלפון/)).toHaveCount(0);
    // no sync-now / selection / bulk affordances; "הוספת משתמש" (page actions) is the administrator's editor entry
    // (access.people.manage, CR-005 phase 2 A1; a viewer never sees it - evidence-wiskey-editor.spec.ts) and lives
    // outside the list, which itself stays read-only
    await expect(screen.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(screen.getByText(/סנכרון עכשיו|ייבוא קיימים|סנכרון הכול/)).toHaveCount(0);
    await expect(screen.locator('sw-table [data-wiskey-people-add], sw-table [data-wiskey-person-edit]')).toHaveCount(0);
    // the honest notes: not live, the search hint promises name / employee number only
    await expect(screen.locator('[data-wiskey-people-nopush]')).toContainText('אינה מתעדכנת בזמן אמת');
    await expect(screen.locator('[data-wiskey-people-fetched]')).toBeVisible();
    await expect(screen.locator('[data-wiskey-people-search]')).toHaveAttribute('placeholder', 'חיפוש לפי שם או מזהה עובד');
    await expect(screen.locator('[data-wiskey-person-none]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-ready.png'), fullPage: true });
  });

  test('search matches name or employee number only: a phone or card that WisKey itself would match finds nobody, and the text never reaches WisKey', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    const search = screen.locator('[data-wiskey-people-search]');
    await search.fill('dana');
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '12', { timeout: 15000 });
    await expect(rows(page)).toHaveCount(12);
    for (const r of await rows(page).all()) await expect(r.locator('[data-wiskey-person-name]')).toContainText(/Dana/);
    await expect(screen.locator('[data-wiskey-people-total-all]')).toHaveAttribute('data-wiskey-people-total-all', '130');
    await expect(screen.locator('[data-wiskey-people-clear]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-search.png'), fullPage: true });

    await search.fill('1017');
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '1', { timeout: 15000 });
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'u018');

    // every fixture phone contains 50000000 and u007's card ends in 7006: WisKey's own matcher finds them, SMPLWISE's must not
    await search.fill('50000000');
    await expect(screen.locator('[data-wiskey-people-empty]')).toBeVisible({ timeout: 15000 });
    await expect(screen.locator('[data-wiskey-people-empty]')).toHaveAttribute('heading', 'לא נמצאו משתמשים תואמים.');
    await search.fill('7006');
    await page.waitForTimeout(1500);
    await expect(screen.locator('[data-wiskey-people-empty]')).toBeVisible();
    const sent = await queried();
    expect(sent.length).toBeGreaterThanOrEqual(5);
    expect(sent.every((q) => q.query === '')).toBe(true);
    expect(JSON.stringify(sent)).not.toMatch(/dana|1017|50000000|7006/);

    // clearing brings the bare first page back
    await screen.locator('[data-wiskey-people-clear]').click();
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '130', { timeout: 15000 });
    await expect(search).toHaveValue('');
    expect((await queried()).at(-1)).toMatchObject({ query: '', filters: { sort: 'employee' }, offset: 0, limit: 50 });
  });

  test('filters and sort go to WisKey as its own filter keys, each change from offset 0; the rows match', async ({ page, request }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await screen.locator('[data-wiskey-people-filter="state"]').selectOption('inactive');
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '14', { timeout: 15000 });
    expect((await queried()).at(-1)).toMatchObject({ query: '', filters: { state: 'inactive', sort: 'employee' }, offset: 0 });
    for (const r of await rows(page).all()) await expect(r.locator('[data-wiskey-person-active]')).toHaveAttribute('data-wiskey-person-active', 'false');

    await screen.locator('[data-wiskey-people-filter="state"]').selectOption('');
    await screen.locator('[data-wiskey-people-filter="station"]').selectOption('lobby');
    await screen.locator('[data-wiskey-people-filter="rights"]').selectOption('assigned');
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ station: 'lobby', rights: 'assigned', sort: 'employee' });
    const direct = await (await request.get('/api/v1/intercom/people?station=lobby&rights=assigned&limit=50')).json();
    const expected = direct.people.total as number;
    expect(expected).toBeGreaterThan(0);
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', String(expected), { timeout: 15000 });
    await expect(rows(page)).toHaveCount(Math.min(50, expected));
    // the sort select: name descending puts the Hebrew names first (WisKey sorts by casefolded name)
    await screen.locator('[data-wiskey-people-filter="sort"]').selectOption('name_desc');
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ station: 'lobby', rights: 'assigned', sort: 'name_desc' });
    await expect(rows(page).first().locator('[data-wiskey-person-name]')).toHaveText('דנה כהן', { timeout: 15000 });
    // WisKey's credential and profile filters are not offered (the projection has nothing to filter on)
    await expect(screen.locator('[data-wiskey-people-filter="credential"]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-people-filter="group"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-filtered.png'), fullPage: true });
    // "clear search and filters" keeps the sort, as WisKey's does
    await screen.locator('[data-wiskey-people-clear]').click();
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ sort: 'name_desc' });
    await expect(results(page)).toHaveAttribute('data-wiskey-people-results', '130', { timeout: 15000 });
  });

  test('paging: next / previous carry the snapshot of the page before, the page size select restarts from page 1', async ({ page }) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    const first = (await queried())[0];
    // previous is disabled on page 1 (the inner native button carries `disabled`)
    await expect(screen.locator('[data-wiskey-people-prev] button')).toBeDisabled();
    await screen.locator('[data-wiskey-people-next]').click();
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '2', { timeout: 15000 });
    await expect(results(page)).toContainText('51–100 / 130');
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'u051');
    const second = (await queried()).at(-1)!;
    expect(second).toMatchObject({ offset: 50, limit: 50 });
    expect(second.snapshot).not.toBe('');
    expect(first.snapshot).toBe('');
    await screen.locator('[data-wiskey-people-next]').click();
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '3', { timeout: 15000 });
    await expect(results(page)).toContainText('101–130 / 130');
    await expect(rows(page)).toHaveCount(30);
    await expect(screen.locator('[data-wiskey-people-next] button')).toBeDisabled();
    await screen.locator('[data-wiskey-people-prev]').click();
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '2', { timeout: 15000 });
    expect((await queried()).at(-1)).toMatchObject({ offset: 50, snapshot: second.snapshot });
    // a bigger page: back to page 1 of 2
    await screen.locator('[data-wiskey-people-page-size]').selectOption('100');
    await expect(results(page)).toContainText('1–100 / 130', { timeout: 15000 });
    await expect(screen.locator('[data-wiskey-people-page]')).toContainText('1 / 2');
    expect((await queried()).at(-1)).toMatchObject({ offset: 0, limit: 100 });
  });

  test('a directory that changed under the paging is reported as stale, with a reload from page 1; a change notice refetches the shown page', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await screen.locator('[data-wiskey-people-next]').click();
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '2', { timeout: 15000 });
    await expect(screen.locator('[data-wiskey-people-stale]')).toHaveCount(0);
    const before = (await queried()).length;
    // someone edits a person in WisKey: its snapshot token changes and it pushes `refresh` -> the shown page (2) is
    // refetched with the snapshot it was loaded under, and WisKey answers `stale`
    expect((await control.post('/people/touch', { data: { id: 'u001' } })).status()).toBe(200);
    const stale = screen.locator('[data-wiskey-people-stale]');
    await expect(stale).toBeVisible({ timeout: 15000 });
    await expect(stale).toContainText('השתנתה');
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '2'); // the reader keeps their place
    const refetch = (await queried()).slice(before);
    expect(refetch.length).toBeGreaterThanOrEqual(1);
    expect(refetch[0]).toMatchObject({ offset: 50 });
    expect(refetch[0].snapshot).not.toBe('');
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-stale.png'), fullPage: true });
    // the offered reload starts over without a snapshot
    await stale.locator('sw-button').click();
    await expect(screen.locator('[data-wiskey-people-page]')).toHaveAttribute('data-wiskey-people-page', '1', { timeout: 15000 });
    await expect(stale).toHaveCount(0);
    expect((await queried()).at(-1)).toMatchObject({ offset: 0, snapshot: '' });
  });

  test('a search whose scan stopped early says its total is a minimum - the scan limit, and WisKey\'s rate limit', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    const search = screen.locator('[data-wiskey-people-search]');
    // the SMPLWISE backend scans WisKey's filtered directory in pages: shrink its page and cap the pages, so a search
    // over the 130-person fixture (58 names with an "o") stops after 100 people
    expect((await control.post('/limits', { data: { scan_page: 50, max_scan_pages: 2 } })).status()).toBe(200);
    await search.fill('o');
    const incomplete = screen.locator('[data-wiskey-people-incomplete]');
    await expect(incomplete).toBeVisible({ timeout: 15000 });
    await expect(incomplete).toHaveAttribute('data-wiskey-people-incomplete', 'scan_limit');
    await expect(incomplete).toContainText('צמצמו את החיפוש');
    await expect(results(page)).toContainText('+'); // the lower bound is marked
    const shown = Number(await results(page).getAttribute('data-wiskey-people-results'));
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(58);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-incomplete.png'), fullPage: true });

    // the caller's read budget runs out mid-scan: the first page is paid for, the second is not
    expect((await control.post('/limits', { data: { scan_page: 50, max_scan_pages: 10, user_burst: 1, user_rate: 0 } })).status()).toBe(200);
    await search.fill('a');
    await expect(incomplete).toHaveAttribute('data-wiskey-people-incomplete', 'rate_limited', { timeout: 15000 });
    await expect(incomplete).toContainText('הגביל את קצב הבקשות');
  });

  test('the details pane: a selected row loads users/get, survives a reload of the list, and a person WisKey no longer has is reported', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await rows(page).nth(1).click(); // u002: Yossi Levi, gate pending
    const detail = screen.locator('[data-wiskey-person-detail="u002"]');
    await expect(detail).toBeVisible({ timeout: 15000 });
    await expect(detail).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
    expect(await fetched()).toEqual(['u002']);
    await expect(detail.locator('[data-wiskey-person-grant="gate"]')).toContainText('שער ראשי');
    await expect(detail.locator('[data-wiskey-person-grant="gate"] sw-badge')).toHaveAttribute('label', 'ממתין');
    await expect(detail.locator('[data-wiskey-person-detail-active]')).toHaveAttribute('data-wiskey-person-detail-active', 'true');
    await expect(detail).not.toContainText(/\+9725|••••|PIN|Engineering|Operations|Security/);
    // no WhatsApp composer here; the "עריכה" button is the administrator's (access.people.manage, CR-005 phase 2 A1,
    // gated in evidence-wiskey-editor.spec.ts) and opens the editor - the pane itself still shows no phone / cards / PIN
    await expect(detail.getByText(/WhatsApp/)).toHaveCount(0);
    await expect(detail.locator('[data-wiskey-person-edit]')).toHaveCount(1);
    // u001 (Dana): two grants, groups shown as WisKey ids, disabled grants marked (u008 has one)
    await rows(page).nth(0).click();
    await expect(screen.locator('[data-wiskey-person-detail="u001"]')).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
    await expect(screen.locator('[data-wiskey-person-detail="u001"] [data-wiskey-person-grant]')).toHaveCount(2);
    await expect(screen.locator('[data-wiskey-person-detail="u001"] [data-wiskey-person-grant="lobby"]')).toContainText('1, 2');
    await expect(screen.locator('[data-wiskey-person-detail="u001"]')).toContainText('staff');
    await rows(page).nth(7).click();
    await expect(screen.locator('[data-wiskey-person-detail="u008"] [data-wiskey-person-grant-disabled="office"]')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-detail.png'), fullPage: true });

    // a change notice reloads the list; the selection stays because its row is still there, and the card is fetched
    // again only when its revision changed (WisKey's 60 s cache)
    await rows(page).nth(1).click();
    await expect(screen.locator('[data-wiskey-person-detail="u002"]')).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
    expect((await fetched()).filter((id) => id === 'u002')).toHaveLength(1); // cached from the first click
    expect((await control.post('/people/touch', { data: { id: 'u010' } })).status()).toBe(200);
    await expect(screen.locator('[data-wiskey-people-stale]')).toBeVisible({ timeout: 15000 });
    await expect(screen.locator('[data-wiskey-person-detail="u002"]')).toBeVisible();
    await expect(screen.locator('sw-table tbody tr.selected')).toHaveAttribute('data-row-id', 'u002');
    expect((await fetched()).filter((id) => id === 'u002')).toHaveLength(1);
    expect((await control.post('/people/touch', { data: { id: 'u002' } })).status()).toBe(200);
    await expect.poll(async () => (await fetched()).filter((id) => id === 'u002').length, { timeout: 15000 }).toBe(2);

    // deleted in WisKey without a notice: selecting the row says so and keeps the list's own record on view
    expect((await control.post('/people/remove', { data: { id: 'u003', notify: false } })).status()).toBe(200);
    await rows(page).nth(2).click();
    const error = screen.locator('[data-wiskey-person-detail="u003"] [data-wiskey-person-detail-error]');
    await expect(error).toBeVisible({ timeout: 15000 });
    await expect(error).toHaveAttribute('data-wiskey-person-detail-error', 'intercom_person_not_found');
    await expect(screen.locator('[data-wiskey-person-detail="u003"]')).toHaveAttribute('data-wiskey-person-detail-source', 'list');
    expect((await page.request.get('/api/v1/intercom/people/u003')).status()).toBe(404);
    expect(((await (await page.request.get('/api/v1/intercom/people/u003')).json()) as { code: string }).code).toBe('intercom_person_not_found');
  });
});
