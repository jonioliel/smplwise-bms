import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import { useSmplwiseWiskeyScreens } from './wiskey-ui-mode';

// The SMPLWISE WisKey screens, not the embedded WisKey panel (the default since the 2026-09-28 decision).
useSmplwiseWiskeyScreens();

// Evidence for the people directory ("אנשים", #/wiskey/people) against REAL backends. First written for the CR-005 phase 1b
// screen (an sw-table fed by /intercom/people); STALE-FIXTURE-SPECS-2530 rewrote it for the native screen of CR-036 S7
// (screens/wiskey-people.ts: GET /api/v1/access-control/people, a table / list / cards view, "עוד N" paging, the person's page in
// a drawer) keeping what each test proved. The mocked behaviour of the same screen (every skin, the views, the bulk bar, the
// messages) is evidence-wiskey-people-native.spec.ts; this file is what only a real backend shows.
//
// Part 1 runs against tests/fixtures/no_ha_backend.py (the real backend with NO Home Assistant at all): the tab sits in the
// access-control tab row (and on the phone's bottom nav), the screen says plainly that access control is not available here and
// invents nothing, and it is gated on `access.people.read` (CR-036: the native screen's permission, at any scope). Runs with
// SW_LIVE=1 SW_NO_HA=1 (the release gate's fixture group `no_ha`).
//
// Part 2 runs against tests/fixtures/wiskey_fake_ha.py (the real backend with an in-process fake Home Assistant answering like
// WisKey; its users/query follows WisKey's own user_directory.py): the first page and its badges, the search Arx matches itself (the
// text never reaches WisKey), filters and sort as WisKey's own keys, "load more" carrying the snapshot, a directory that changed
// under the paging, a search whose scan stopped early, and the person's page - including a person WisKey no longer has. Runs with
// SW_LIVE=1 SW_WISKEY_FIXTURE=1, one project (desktop); how to start the fixture is at the top of that file.

const HREF = '#/wiskey/people';
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';
const SCREEN = 'wiskey-people';
const PAGE = `${SCREEN} sw-page[data-people-screen]`;
/** AUDIT30-H (finding 16): the people filters are <sw-dropdown> (no native <select>): open the chip, press the option. */
const pickIn = async (page: Page, dropdown: string, id: string) => {
  const dd = page.locator(dropdown);
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`[role="option"][data-id="${id}"]`).click();
};
const choose = (page: Page, name: string, id: string) => pickIn(page, `${SCREEN} sw-dropdown[data-wiskey-people-filter="${name}"]`, id);

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('the people screen without Home Assistant (no_ha_backend.py)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_NO_HA !== '1', 'set SW_LIVE=1 SW_NO_HA=1 with tests/fixtures/no_ha_backend.py as the backend');

  test('the people tab is the third access-control tab and the screen says honestly that access control is not available here', async ({ page, request }, testInfo) => {
    const reply = await (await request.get('/api/v1/access-control/people')).json();
    expect(reply.state, 'no Home Assistant: nothing to ask').toBe('ha_not_configured');
    expect(reply.people).toBeNull();

    await open(page, '/wiskey/overview');
    // the access-control area's own tab row: entry center, activity, people - in that order, nothing from other areas first
    const tabs = page.locator('sw-tabs a[href^="#/wiskey/"]');
    await expect(tabs.nth(2)).toHaveAttribute('href', HREF, { timeout: 30000 });
    await expect(tabs.nth(0)).toHaveAttribute('href', '#/wiskey/overview');
    await expect(tabs.nth(1)).toHaveAttribute('href', '#/wiskey/events');
    const tab = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tab).toContainText('אנשים');
    await tab.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);

    const screen = page.locator(SCREEN);
    await expect(page.locator(PAGE)).toHaveAttribute('data-people-phase', 'unavailable', { timeout: 30000 });
    const panel = screen.locator('sw-state-panel[data-wiskey-state="unavailable"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('heading', 'בקרת הכניסה אינה זמינה');
    // nothing invented: no search, no filters, no rows, no paging, no person's page, and no add affordance
    await expect(screen.locator('[data-wiskey-people-search]')).toHaveCount(0);
    await expect(screen.locator('[data-people-filters]')).toHaveCount(0);
    await expect(screen.locator('[data-person-row]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-people-more]')).toHaveCount(0);
    await expect(page.locator('wiskey-person-drawer')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-people-add]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-not-configured.png') });
  });

  test('the phone bottom nav reaches the people tab', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint; other projects are wider');
    await open(page, '/live', 'a');
    const bottom = page.locator(BOTTOM);
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('a[href="#/wiskey/overview"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/overview');
    const tab = page.locator(`sw-tabs a[href="${HREF}"]`);
    await expect(tab).toBeVisible({ timeout: 30000 });
    await tab.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
    await expect(page.locator(`${SCREEN} sw-state-panel[data-wiskey-state="unavailable"]`)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-mobile.png') });
  });

  test('the people tab is gated on access.people.read: without it no tab, the typed address and the API refuse; with it the screen opens', async ({ page, browser, request }, testInfo) => {
    const bindings: string[] = [];
    let roleId: string | undefined;
    const tag = testInfo.project.name; // unique per project: the viewport projects may run this test concurrently
    const bind = async (username: string, role: string, scopeType = 'installation', scopeId = '*') => {
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
      const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role, scope_type: scopeType, scope_id: scopeId } });
      expect(r.status()).toBeLessThan(300);
      bindings.push(((await r.json()) as { id: string }).id);
    };
    const refused = async (p: Page) => {
      await open(p, '/wiskey/people');
      await expect(p.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 30000 });
      await expect(p.locator(`${SCREEN} sw-state-panel[data-wiskey-state="no_permission"]`)).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
      await expect(p.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(0);
      expect((await p.request.get('/api/v1/access-control/people')).status()).toBe(403);
      expect((await p.request.get('/api/v1/access-control/people/u001')).status()).toBe(403);
    };
    try {
      // 1. no access permission at all: no access-control area, the typed address and the API refuse
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
      await refused(p1);
      await c1.close();

      // 2. access.read alone (the built-in viewer): the area's other screens, but the NATIVE people screen needs access.people.read
      const viewer = `wiskeyppviewer${tag}`;
      await bind(viewer, 'viewer');
      const c2 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p2 = await c2.newPage();
      const me2 = await (await p2.request.get('/api/v1/me')).json();
      expect(me2.permissions_installation).toContain('access.read');
      expect(me2.permissions_any).not.toContain('access.people.read');
      await refused(p2);
      await c2.close();

      // 3. access.people.read (the built-in operator): the tab is there and opens the screen
      const operator = `wiskeyppoperator${tag}`;
      await bind(operator, 'operator');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': operator } });
      const p3 = await c3.newPage();
      await open(p3, '/wiskey/overview');
      await expect(p3.locator(`sw-tabs a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await open(p3, '/wiskey/people');
      await expect(p3.locator(`${SCREEN} sw-state-panel[data-wiskey-state="unavailable"]`)).toBeVisible({ timeout: 30000 });
      expect((await p3.request.get('/api/v1/access-control/people')).status()).toBe(200);
      await c3.close();

      // 4. and the administrator
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
type Query = { query: string; filters: Record<string, unknown>; offset: number; limit: number; snapshot: string };
type Sent = ({ id: number; type: string } & Partial<Query> & { user_id?: string })[];
/** The table view with every column the administrator is offered, the sync column included (a per-browser choice of the screen). */
const COLUMNS = ['name', 'employee', 'groups', 'stations', 'credentials', 'validity', 'state', 'sync'];

test.describe('the people screen against the fixture WisKey (wiskey_fake_ha.py)', () => {
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

  test.beforeEach(async ({ page }) => {
    expect((await control.post('/reset')).status()).toBe(200);
    await page.addInitScript((cols) => {
      try {
        localStorage.setItem('sw.people.view', 'table');
        localStorage.setItem('sw.people.columns', JSON.stringify(cols));
      } catch { /* the defaults (table, no sync column) */ }
    }, COLUMNS);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
  });

  const rows = (page: Page) => page.locator(`${SCREEN} [data-person-row]`);
  const row = (page: Page, id: string) => page.locator(`${SCREEN} [data-person-row="${id}"]`);
  const subtitle = (page: Page) => page.locator(PAGE);
  const more = (page: Page) => page.locator(`${SCREEN} [data-wiskey-people-more]`);
  const drawer = (page: Page) => page.locator('wiskey-person-drawer sw-drawer[data-person-drawer]');

  async function queried(): Promise<Query[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/users/query').map(({ id: _id, type: _type, user_id: _uid, ...q }) => q as Query);
  }

  async function fetched(): Promise<string[]> {
    const sent = (await (await control.get('/sent')).json()) as Sent;
    return sent.filter((m) => m.type === 'hikvision_intercom/users/get').map((m) => m.user_id ?? '');
  }

  /** Opens the screen and waits until the first page is drawn AND the catch-up read the screen makes once its change-notice socket
   * opens has been answered (TESTDEBT3-295): a test then acts on a quiet screen. */
  async function openPeople(page: Page) {
    await open(page, '/wiskey/people');
    await expect(subtitle(page)).toHaveAttribute('data-people-phase', 'ready', { timeout: 30000 });
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => (await queried()).length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
  }

  async function openPerson(page: Page, id: string) {
    await row(page, id).click();
    await expect(drawer(page)).toBeVisible({ timeout: 15000 });
  }

  async function closePerson(page: Page) {
    await drawer(page).locator('[data-drawer-close]').first().click();
    await expect(drawer(page)).toBeHidden();
  }

  test('the first page: 50 of 130 by employee number, WisKey fields only, a distinct badge per sync state, no phones or cards', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await expect(rows(page)).toHaveCount(50);
    await expect(subtitle(page)).toHaveAttribute('subheading', '50 מתוך 130');
    await expect(more(page)).toContainText('עוד 50');
    // exactly WisKey's users/query frame: an EMPTY query, the sort alone, the first page of 50, no snapshot yet
    expect((await queried())[0]).toMatchObject({ query: '', filters: { sort: 'employee' }, offset: 0, limit: 50, snapshot: '' });
    // by employee number: the first row is 1000 (a Hebrew name, shown as such), the last of the page 1049
    const first = rows(page).first();
    await expect(first).toHaveAttribute('data-person-row', 'u001');
    await expect(first.locator('[data-wiskey-person-name]')).toHaveText('דנה כהן');
    await expect(first.locator('[data-wiskey-person-employee]')).toHaveText('1000');
    await expect(rows(page).last()).toHaveAttribute('data-person-row', 'u050');
    await expect(first.locator('[data-wiskey-person-assignments]')).toHaveAttribute('data-wiskey-person-assignments', '2');
    // the sync column: synced / pending / offline / error / unassigned, each in its own kind (screens/wiskey-person-drawer.ts syncKind)
    const sync = (id: string) => row(page, id).locator('td[data-col="sync"] sw-badge');
    await expect(sync('u001')).toHaveAttribute('kind', 'recorded');
    const kinds = new Set(await screen.locator('td[data-col="sync"] sw-badge').evaluateAll((els) => els.map((e) => e.getAttribute('kind'))));
    for (const k of ['recorded', 'stale', 'offline', 'error', 'neutral']) expect(kinds, `a "${k}" sync badge on the first page`).toContain(k);
    // the person's state per row (u009 is inactive, u004's window ended, u007's has not begun, u010's is running)
    const state = (id: string) => row(page, id).locator('td[data-col="state"] sw-badge');
    await expect(state('u009')).toHaveAttribute('kind', 'offline');
    await expect(state('u004')).toHaveAttribute('kind', 'error');
    await expect(state('u007')).toHaveAttribute('kind', 'stale');
    await expect(state('u010')).toHaveAttribute('kind', 'live');
    await expect(state('u001')).toHaveAttribute('kind', 'live');
    // a list row carries no phone, card number, PIN or profile value (a person's page shows them, at the sensitive level only)
    await expect(screen.getByText(/\+9725/)).toHaveCount(0);
    await expect(screen.getByText(/••••/)).toHaveCount(0);
    await expect(screen.getByText(/Engineering|Operations/)).toHaveCount(0);
    // the administrator's entries live outside the list (page actions); the rows themselves carry no edit control
    await expect(screen.locator('[data-person-row] [data-wiskey-person-edit]')).toHaveCount(0);
    await expect(screen.locator('[data-wiskey-people-add]')).toBeVisible();
    await expect(screen.locator('[data-wiskey-people-search]')).toHaveAttribute('placeholder', 'חיפוש לפי שם או מס׳ עובד');
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-ready.png'), fullPage: true });
  });

  test('search matches name or employee number in Arx: a phone or card that WisKey itself would match finds nobody, and the text never reaches WisKey', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    const search = screen.locator('[data-wiskey-people-search]');
    await search.fill('dana');
    await expect(rows(page)).toHaveCount(12, { timeout: 15000 });
    for (const r of await rows(page).all()) await expect(r.locator('[data-wiskey-person-name]')).toContainText(/Dana/);
    await expect(screen.locator('[data-wiskey-people-clear]')).toBeVisible();
    await expect(subtitle(page)).toHaveAttribute('subheading', /12/);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-search.png'), fullPage: true });

    await search.fill('1017');
    await expect(rows(page)).toHaveCount(1, { timeout: 15000 });
    await expect(rows(page).first()).toHaveAttribute('data-person-row', 'u018');

    // every fixture phone contains 50000000 and u007's card ends in 7006: WisKey's own matcher finds them, Arx's must not
    await search.fill('50000000');
    const empty = screen.locator('[data-wiskey-people-empty]');
    await expect(empty).toBeVisible({ timeout: 15000 });
    await expect(empty).toHaveAttribute('heading', 'לא נמצאו אנשים');
    await search.fill('7006');
    await page.waitForTimeout(1500);
    await expect(empty).toBeVisible();
    const sent = await queried();
    expect(sent.length).toBeGreaterThanOrEqual(5);
    expect(sent.every((q) => q.query === '')).toBe(true);
    expect(JSON.stringify(sent)).not.toMatch(/dana|1017|50000000|7006/);

    // clearing brings the bare first page back
    await screen.locator('[data-wiskey-people-clear]').click();
    await expect(rows(page)).toHaveCount(50, { timeout: 15000 });
    await expect(search).toHaveValue('');
    expect((await queried()).at(-1)).toMatchObject({ query: '', filters: { sort: 'employee' }, offset: 0, limit: 50 });
  });

  test('filters and sort go to WisKey as its own filter keys, each change from offset 0; the rows match', async ({ page, request }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await choose(page, 'state', 'inactive');
    await expect(rows(page)).toHaveCount(14, { timeout: 15000 });
    expect((await queried()).at(-1)).toMatchObject({ query: '', filters: { state: 'inactive', sort: 'employee' }, offset: 0 });
    for (const id of await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-person-row') ?? ''))) {
      await expect(row(page, id).locator('td[data-col="state"] sw-badge'), `${id} is inactive`).toHaveAttribute('kind', 'offline');
    }

    await choose(page, 'state', '');
    await choose(page, 'station', 'lobby');
    await choose(page, 'rights', 'assigned');
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ station: 'lobby', rights: 'assigned', sort: 'employee' });
    const direct = await (await request.get('/api/v1/access-control/people?station=lobby&rights=assigned&limit=50')).json();
    const expected = direct.people.total as number;
    expect(expected).toBeGreaterThan(0);
    await expect(rows(page)).toHaveCount(Math.min(50, expected), { timeout: 15000 });
    // the sort: name descending puts the Hebrew names first (WisKey sorts by casefolded name)
    await choose(page, 'sort', 'name_desc');
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ station: 'lobby', rights: 'assigned', sort: 'name_desc' });
    await expect(rows(page).first().locator('[data-wiskey-person-name]')).toHaveText('דנה כהן', { timeout: 15000 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-filtered.png'), fullPage: true });
    // "clear" keeps the sort, as WisKey's own does
    await screen.locator('[data-wiskey-people-clear]').click();
    await expect.poll(async () => (await queried()).at(-1)?.filters).toEqual({ sort: 'name_desc' });
    await expect(rows(page)).toHaveCount(50, { timeout: 15000 });
  });

  test('paging: "עוד N" carries the snapshot of the page before and appends; the last page ends the paging', async ({ page }) => {
    await openPeople(page);
    const first = (await queried())[0];
    expect(first.snapshot).toBe('');
    await more(page).click();
    await expect(rows(page)).toHaveCount(100, { timeout: 15000 });
    await expect(rows(page).nth(50)).toHaveAttribute('data-person-row', 'u051');
    await expect(subtitle(page)).toHaveAttribute('subheading', '100 מתוך 130');
    const second = (await queried()).at(-1)!;
    expect(second).toMatchObject({ offset: 50, limit: 50 });
    expect(second.snapshot).not.toBe('');
    await expect(more(page)).toContainText('עוד 30');
    await more(page).click();
    await expect(rows(page)).toHaveCount(130, { timeout: 15000 });
    expect((await queried()).at(-1)).toMatchObject({ offset: 100, snapshot: second.snapshot });
    await expect(more(page)).toHaveCount(0);
    await expect(subtitle(page)).toHaveAttribute('subheading', '130 אנשים');
  });

  test('a directory that changed under the paging is said, with a reload from the first page; a change notice reads the shown list again', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    await expect(screen.locator('[data-wiskey-people-stale]')).toHaveCount(0);
    // someone deletes a person in WisKey and no notice arrives: the directory's snapshot changes under the paging, so the next
    // page, asked with the snapshot of the first, is answered `stale`
    expect((await control.post('/people/remove', { data: { id: 'u120', notify: false } })).status()).toBe(200);
    await more(page).click();
    const stale = screen.locator('[data-wiskey-people-stale]');
    await expect(stale).toBeVisible({ timeout: 15000 });
    await expect(stale).toContainText('הרשימה השתנתה');
    const paged = (await queried()).at(-1)!;
    expect(paged).toMatchObject({ offset: 50 });
    expect(paged.snapshot).not.toBe('');
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-stale.png'), fullPage: true });
    // the offered reload starts over without a snapshot
    await stale.locator('[data-wiskey-people-restart]').click();
    await expect(stale).toHaveCount(0, { timeout: 15000 });
    await expect(rows(page)).toHaveCount(50);
    expect((await queried()).at(-1)).toMatchObject({ offset: 0, snapshot: '' });
    // someone edits a person in WisKey: it pushes `refresh` and the shown list is read again (one request, from the first row)
    const before = (await queried()).length;
    expect((await control.post('/people/touch', { data: { id: 'u001' } })).status()).toBe(200);
    await expect.poll(async () => (await queried()).length, { timeout: 15000 }).toBeGreaterThan(before);
    expect((await queried()).at(-1)).toMatchObject({ offset: 0, snapshot: '' });
    expect((await queried()).at(-1)!.limit).toBeGreaterThanOrEqual(50);
  });

  test('a search whose scan stopped early says its total is a minimum - the scan limit, and WisKey\'s rate limit', async ({ page }, testInfo) => {
    await openPeople(page);
    const screen = page.locator(SCREEN);
    const search = screen.locator('[data-wiskey-people-search]');
    // the backend scans WisKey's filtered directory in pages: shrink its page and cap the pages, so a search over the 130-person
    // fixture (58 names with an "o") stops after 100 people
    expect((await control.post('/limits', { data: { scan_page: 50, max_scan_pages: 2 } })).status()).toBe(200);
    await search.fill('o');
    const incomplete = screen.locator('[data-wiskey-people-incomplete]');
    await expect(incomplete).toBeVisible({ timeout: 15000 });
    await expect(incomplete).toHaveAttribute('data-wiskey-people-incomplete', 'scan_limit');
    await expect(incomplete).toContainText('החיפוש נעצר לפני סופו');
    await expect(subtitle(page)).toHaveAttribute('subheading', /\+/); // the lower bound is marked
    const shown = await rows(page).count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(58);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-incomplete.png'), fullPage: true });

    // the caller's read budget runs out mid-scan: the first page is paid for, the second is not
    expect((await control.post('/limits', { data: { scan_page: 50, max_scan_pages: 10, user_burst: 1, user_rate: 0 } })).status()).toBe(200);
    await search.fill('a');
    await expect(incomplete).toHaveAttribute('data-wiskey-people-incomplete', 'rate_limited', { timeout: 15000 });
    await expect(incomplete).toContainText('הבקשה הוגבלה בקצב');
  });

  test('the person\'s page: a selected row reads the person (users/get), follows a change of THAT person only, and a person WisKey no longer has is said', async ({ page }, testInfo) => {
    await openPeople(page);
    await openPerson(page, 'u002'); // Yossi Levi: gate pending
    const d = drawer(page);
    await expect(d).toHaveAttribute('heading', 'Yossi Levi');
    await expect(d.locator('[data-person-station="gate"]')).toContainText('שער ראשי', { timeout: 15000 });
    await expect(d.locator('[data-person-station="gate"] [data-person-sync]')).toHaveAttribute('data-person-sync', 'pending');
    await expect(d.locator('[data-person-state]')).toHaveAttribute('data-person-state', 'active');
    await expect.poll(fetched).toContain('u002');
    // the administrator holds the sensitive level: the edit entry is on the page; a PIN or a card number never is
    await expect(d.locator('[data-wiskey-person-edit]')).toHaveCount(1);
    await expect(d).not.toContainText(/••••\s*\d{4}\d|PIN:/);
    await page.screenshot({ path: testInfo.outputPath('wiskey-people-detail.png'), fullPage: true });
    // u001 (Dana): two stations
    await closePerson(page);
    await openPerson(page, 'u001');
    await expect(drawer(page).locator('[data-person-station]')).toHaveCount(2, { timeout: 15000 });

    // a change notice reads the list again; the open person is read again only when ITS revision changed
    await closePerson(page);
    await openPerson(page, 'u002');
    await expect(d).toHaveAttribute('heading', 'Yossi Levi');
    await expect.poll(async () => (await fetched()).filter((id) => id === 'u002').length, { timeout: 15000 }).toBeGreaterThanOrEqual(1);
    const reads = (await fetched()).filter((id) => id === 'u002').length;
    let queries = (await queried()).length;
    expect((await control.post('/people/touch', { data: { id: 'u010' } })).status()).toBe(200);
    await expect.poll(async () => (await queried()).length, { timeout: 15000 }).toBeGreaterThan(queries);
    await page.waitForTimeout(1500);
    expect((await fetched()).filter((id) => id === 'u002').length, 'another person changed: u002 is not read again').toBe(reads);
    await expect(d).toBeVisible();
    queries = (await queried()).length;
    expect((await control.post('/people/touch', { data: { id: 'u002' } })).status()).toBe(200);
    await expect.poll(async () => (await fetched()).filter((id) => id === 'u002').length, { timeout: 15000 }).toBeGreaterThan(reads);

    // deleted in WisKey without a notice: opening the row says so
    await closePerson(page);
    expect((await control.post('/people/remove', { data: { id: 'u003', notify: false } })).status()).toBe(200);
    await openPerson(page, 'u003');
    await expect(drawer(page).locator('[data-person-error="gone"]')).toBeVisible({ timeout: 15000 });
    await expect(drawer(page).locator('[data-person-error="gone"]')).toHaveAttribute('heading', 'האדם לא נמצא');
    expect((await page.request.get('/api/v1/access-control/people/u003')).status()).toBe(404);
  });
});
