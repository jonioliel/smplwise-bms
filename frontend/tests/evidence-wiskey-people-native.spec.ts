import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { install, newMock, push, type PeopleMock, type Role } from './wiskey-people-mock';
import { skinsUnderTest } from './helpers/frozen-skins';

// CR-036 S7: evidence for the NATIVE people screen (אנשים) against a mocked backend that answers like the typed reads of
// routers/access_control_reads.py - level by level (see tests/wiskey-people-mock.ts). No Home Assistant, no WisKey, no device, no
// phone: the message dialog runs against the message routes the mock answers (tests/wiskey-people-mock.ts, shapes from
// tests/fixtures/messaging_wire.json - checked against the real routes by the backend tests). Three projects (desktop / tablet / mobile), five skins, light and dark for the main states; the functional
// specs (filters, search, sort, paging, selection, drawer, photo, states, messaging) run on desktop; the phone / tablet specific
// ones on their own project. Screenshots go to the test's output folder (the committed pixel baselines are pixel-wiskey-people.spec.ts).
//   npx playwright test tests/evidence-wiskey-people-native.spec.ts        (against the built preview, or SW_BASE_URL)

const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
const SCHEMES = ['light', 'dark'] as const;
const SCREEN = 'wiskey-people';
const NOW = '2026-10-12T10:00:00Z';
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const desktopOnly = (info: TestInfo) => test.skip(info.project.name !== 'desktop', 'desktop project: functional spec');

interface Opts {
  skin?: (typeof SKINS)[number];
  scheme?: (typeof SCHEMES)[number];
  route?: string;
  role?: Role;
}

async function open(page: Page, st: PeopleMock, o: Opts = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW)); // the dates of the invented people are those of 2026-10-12: the clock does not move with the calendar
  await install(page, st);
  await page.goto(`/?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#${o.route ?? '/wiskey/people'}`);
  await page.waitForSelector('sw-app');
}

const root = (page: Page) => page.locator(`${SCREEN} sw-page`);
const rows = (page: Page) => page.locator(`${SCREEN} [data-person-row]`);
const ready = async (page: Page) => {
  await expect(root(page)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await expect(rows(page).first()).toBeVisible();
};
// TESTDEBT3-295: the screen asks the list ONE more time about 800 ms after its change-notice socket opens ("notices sent while the
// socket was down are gone: catch up now", NOTICE_COALESCE_MS). A spec that clicks "load more" right after `ready` raced that refetch:
// on a loaded runner the second request landed inside the first click's round trip (see the product fix in wiskey-people.ts) or wiped the
// "changed" notice before the spec looked at it. The paging specs wait for the catch-up to be answered, then act on a quiet screen.
const caughtUp = async (page: Page, st: PeopleMock) => {
  await expect.poll(() => st.sockets.length, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => st.answered, { timeout: 20_000 }).toBeGreaterThanOrEqual(2); // the first load and the catch-up
  await settle(page);
};
const drawer = (page: Page) => page.locator('wiskey-person-drawer');
const peopleHits = (st: PeopleMock) => st.hits.filter((h) => h.startsWith('GET access-control/people?'));
const lastQuery = (st: PeopleMock): URLSearchParams => new URLSearchParams(peopleHits(st).at(-1)!.split('?')[1]);
const shot = (page: Page, info: TestInfo, name: string) => settle(page).then(() => page.screenshot({ path: info.outputPath(`${name}.png`) }));
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'horizontal overflow of the page').toBeLessThanOrEqual(1);
const names = async (page: Page) => (await rows(page).locator('[data-wiskey-person-name]').allTextContents()).map((s) => s.trim());
const choose = async (page: Page, name: string, value: string) => page.locator(`${SCREEN} select[data-wiskey-people-filter="${name}"]`).selectOption(value);

test.describe('the people screen in every skin (light and dark, one project each)', () => {
  for (const skin of SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}: the list, the person's page, the sensitive section`, async ({ page }, info) => {
        const st = newMock('admin');
        st.messaging = true;
        await open(page, st, { skin, scheme });
        await ready(page);
        await expect(rows(page)).toHaveCount(9); // the archived person is listed only on request
        await noOverflow(page);
        await shot(page, info, `list-${skin}-${scheme}`);
        await rows(page).first().click();
        await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
        await expect(drawer(page).locator('[data-person-section="sensitive"]')).toBeVisible();
        await shot(page, info, `drawer-${skin}-${scheme}`);
      });
    }
  }
});

test.describe('the data path: typed reads only, filters are the server\'s', () => {
  test('the screen asks the typed endpoints and never a WisKey or legacy intercom route', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await rows(page).first().click();
    await expect(drawer(page).locator('[data-person-section="details"]')).toBeVisible();
    const used = new Set(st.hits.map((h) => h.split('?')[0].replace(/^(GET|POST|PUT|PATCH|DELETE) /, '')));
    for (const path of used) if (/people|stations|groups|features/.test(path)) expect(path, path).toMatch(/^access-control\//);
    expect([...used].some((p) => /^intercom\//.test(p))).toBe(false);
    expect(used.has('access-control/people')).toBe(true);
    expect(used.has('access-control/people/p1')).toBe(true);
  });

  test('every server-side filter becomes a query parameter and refetches from the first page', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    const before = peopleHits(st).length;
    await choose(page, 'group', 'lab');
    await expect.poll(() => lastQuery(st).get('group')).toBe('lab');
    expect(lastQuery(st).get('offset')).toBe('0');
    await expect(rows(page)).toHaveCount(2); // p1 and p5
    expect(peopleHits(st).length).toBeGreaterThan(before);
    await choose(page, 'station', 'mgmt');
    await expect.poll(() => lastQuery(st).get('station')).toBe('mgmt');
    await expect(rows(page)).toHaveCount(0); // nobody of the lab group is on the management station
    await expect(page.locator(`${SCREEN} [data-wiskey-people-empty]`)).toBeVisible();
    await page.locator(`${SCREEN} [data-wiskey-people-clear]`).click();
    await expect(rows(page)).toHaveCount(9);
    expect(lastQuery(st).get('group')).toBeNull();
    await choose(page, 'state', 'upcoming');
    await expect.poll(() => lastQuery(st).get('state')).toBe('upcoming');
    await expect(rows(page)).toHaveCount(1);
    await choose(page, 'state', 'archived');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('עומר דהן');
    await choose(page, 'state', '');
    await choose(page, 'rights', 'unassigned');
    await expect.poll(() => lastQuery(st).get('rights')).toBe('unassigned');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('שירה מזרחי');
    await choose(page, 'rights', '');
    await choose(page, 'credential', 'no_pin');
    await expect.poll(() => lastQuery(st).get('credential')).toBe('no_pin');
    await expect(rows(page)).toHaveCount(4);
  });

  test('a profile field filter is a field=value parameter and shows as a removable chip', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} select[data-people-profile-field]`).selectOption('department');
    await page.locator(`${SCREEN} select[data-people-profile-value]`).selectOption('אבטחה');
    await expect.poll(() => lastQuery(st).getAll('profile')).toEqual(['department=אבטחה']);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator(`${SCREEN} [data-people-profile-clear="department"]`)).toContainText('אבטחה');
    await page.locator(`${SCREEN} [data-people-profile-clear="department"]`).click();
    await expect.poll(() => lastQuery(st).getAll('profile')).toEqual([]);
    await expect(rows(page)).toHaveCount(9);
  });

  test('the text search includes the employee number and is debounced into one request', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    const search = page.locator(`${SCREEN} [data-wiskey-people-search]`);
    await expect(search).toHaveAttribute('placeholder', /מס׳ עובד/);
    const before = peopleHits(st).length;
    await search.pressSequentially('1005', { delay: 40 });
    await expect.poll(() => lastQuery(st).get('query')).toBe('1005');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('נועה בר');
    expect(peopleHits(st).length - before).toBeLessThanOrEqual(2); // typed four characters, debounced
    await search.fill('');
    await expect(rows(page)).toHaveCount(9);
  });

  test('the sort is a server parameter', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await choose(page, 'sort', 'name_desc');
    await expect.poll(() => lastQuery(st).get('sort')).toBe('name_desc');
    await expect(rows(page).first()).toContainText('תומר אדר'); // the answer, not the request
    const list = await names(page);
    expect(list).toEqual([...list].sort((a, b) => b.localeCompare(a, 'he')));
  });
});

test.describe('paging and the snapshot', () => {
  test('"load more" appends the next page with the snapshot; nothing is repeated', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.pageCap = 4;
    await open(page, st);
    await ready(page);
    await caughtUp(page, st);
    await expect(rows(page)).toHaveCount(4);
    await expect(page.locator(`${SCREEN} sw-page`)).toContainText('4 מתוך 9');
    await page.locator(`${SCREEN} [data-wiskey-people-more]`).click();
    await expect(rows(page)).toHaveCount(8);
    const q = lastQuery(st);
    expect(q.get('offset')).toBe('4');
    expect(q.get('snapshot')).toMatch(/^snap-/);
    await page.locator(`${SCREEN} [data-wiskey-people-more]`).click();
    await expect(rows(page)).toHaveCount(9);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-more]`)).toHaveCount(0);
    expect(new Set(await names(page)).size).toBe(9);
  });

  test('a directory that changed under the paging is said, and a restart goes back to page one', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.pageCap = 4;
    await open(page, st);
    await ready(page);
    await caughtUp(page, st);
    st.stale = true;
    await page.locator(`${SCREEN} [data-wiskey-people-more]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-stale]`)).toBeVisible();
    await shot(page, info, 'stale-page');
    st.stale = false;
    await page.locator(`${SCREEN} [data-wiskey-people-restart]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-stale]`)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(4);
    expect(lastQuery(st).get('offset')).toBe('0');
    expect(lastQuery(st).get('snapshot')).toBeNull();
  });

  test('a scan that stopped early says the count is partial', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.incomplete = 'rate_limited';
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-incomplete="rate_limited"]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} sw-page`)).toContainText('+');
  });

  test('a change notice refetches what is shown in one request', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await expect.poll(() => st.sockets.length).toBeGreaterThan(0);
    await page.waitForTimeout(1200); // the catch-up refetch of a connecting socket
    const before = peopleHits(st).length;
    st.people[0].display_name = 'דנה כהן-לוי';
    push(st);
    await expect.poll(() => peopleHits(st).length).toBeGreaterThan(before);
    await expect(rows(page).first()).toContainText('דנה כהן-לוי');
    expect(lastQuery(st).get('limit')).toBe('50');
  });
});

test.describe('views, columns, selection', () => {
  test('cards, list and table are three views of the same rows; the choice survives a reload', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-table]`)).toBeVisible(); // the desktop default
    await page.locator(`${SCREEN} [data-people-view="cards"]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-cards]`)).toBeVisible();
    await shot(page, info, 'cards');
    await page.locator(`${SCREEN} [data-people-view="list"]`).click();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-list]`)).toBeVisible();
    await expect(rows(page)).toHaveCount(9);
    await page.reload();
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-list]`)).toBeVisible();
  });

  test('the table: a column chooser, the credentials column only for the sensitive level, and the choice persists', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    const table = page.locator(`${SCREEN} [data-wiskey-people-table]`);
    await expect(table.locator('th[data-col="credentials"]')).toBeVisible();
    await expect(table.locator('th[data-col="sync"]')).toHaveCount(0);
    await page.locator(`${SCREEN} [data-people-columns]`).click();
    await page.locator(`${SCREEN} [data-people-column="sync"]`).check();
    await page.locator(`${SCREEN} [data-people-column="groups"]`).uncheck();
    await expect(table.locator('th[data-col="sync"]')).toBeVisible();
    await expect(table.locator('th[data-col="groups"]')).toHaveCount(0);
    await shot(page, info, 'table-columns');
    await page.reload();
    await ready(page);
    await expect(page.locator(`${SCREEN} th[data-col="sync"]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} th[data-col="groups"]`)).toHaveCount(0);
  });

  test('a names-level operator: no credentials column, no credential or profile filter, no phone flag anywhere', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('operator');
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} th[data-col="credentials"]`)).toHaveCount(0);
    await page.locator(`${SCREEN} [data-people-columns]`).click();
    await expect(page.locator(`${SCREEN} [data-people-column="credentials"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} select[data-wiskey-people-filter="credential"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} select[data-people-profile-field]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-add]`)).toHaveCount(0);
    expect(st.hits.filter((h) => /credential=|profile=/.test(h))).toEqual([]);
    await shot(page, info, 'operator-table');
  });

  test('the employee number follows the administrator\'s setting: hidden, the column, the hint and the number order go', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('operator');
    st.employeeNoVisible = false;
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} th[data-col="employee"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-search]`)).toHaveAttribute('placeholder', 'חיפוש לפי שם');
    await expect(page.locator(`${SCREEN} select[data-wiskey-people-filter="sort"] option[value="employee"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-person-employee]`)).toHaveCount(0);
  });

  test('selection: a mode, per-row checkboxes, the header checkbox, a count, and it is cleared with the filters', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-people-select-mode]`).click();
    await expect(page.locator(`${SCREEN} [data-people-bulk]`)).toBeVisible();
    await page.locator(`${SCREEN} [data-person-select="p1"]`).click();
    await page.locator(`${SCREEN} [data-person-select="p2"]`).click();
    await expect(page.locator(`${SCREEN} [data-people-bulk-count]`)).toHaveAttribute('data-people-bulk-count', '2');
    await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0); // a checkbox does not open the person's page
    await shot(page, info, 'bulk-bar');
    await page.locator(`${SCREEN} [data-people-select-all]`).click();
    await expect(page.locator(`${SCREEN} [data-people-bulk-count]`)).toHaveAttribute('data-people-bulk-count', '9');
    await page.locator(`${SCREEN} [data-people-select-all]`).click();
    await expect(page.locator(`${SCREEN} [data-people-bulk-count]`)).toHaveAttribute('data-people-bulk-count', '0');
    await page.locator(`${SCREEN} [data-person-select="p3"]`).click();
    await choose(page, 'group', 'lab');
    await expect(page.locator(`${SCREEN} [data-people-bulk-count]`)).toHaveAttribute('data-people-bulk-count', '0');
  });
});

test.describe("the person's page", () => {
  test('tabs: details with the validity and timing views, access with the per-station sync state, groups', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p3"]`).click();
    const d = drawer(page);
    await expect(d.locator('[data-person-validity]')).toHaveText('ללא הגבלה');
    await expect(d.locator('[data-person-timing]')).toContainText('ללא הגבלת שעות'); // p3 has no timing
    await expect(d.locator('[data-person-portrait] .frame')).toHaveText('מא'); // the portrait's letters are the avatar's (first letters of the first and last name)
    await d.locator('[data-person-tab="access"]').click();
    await expect(d.locator('[data-person-station]')).toHaveCount(4);
    await expect(d.locator('[data-person-station="gate"]')).toContainText('דלת 1'); // one door: the singular
    await expect(d.locator('[data-person-station="mgmt"] [data-person-sync="error"]')).toBeVisible();
    // the administrator sees the failure as a word; the platform's code stays in the tooltip
    await expect(d.locator('[data-person-station="mgmt"] [data-person-sync-error]')).toHaveText('העמדה אינה זמינה');
    await expect(d.locator('[data-person-station="mgmt"] [data-person-sync-error]')).toHaveAttribute('data-person-sync-error', 'device_unavailable');
    await shot(page, info, 'drawer-access');
    await d.locator('[data-person-tab="groups"]').click();
    await expect(d.locator('[data-person-group="board"]')).toContainText('הנהלה');
    await expect(d.locator('[data-person-group="board"]')).toContainText('4 תחנות');
    await d.locator('[data-person-tab="details"]').click();
    await expect(d.locator('[data-person-credentials]')).toContainText('2 כרטיסים');
    await page.keyboard.press('Escape');
    await expect(d.locator('sw-drawer[open]')).toHaveCount(0);
  });

  test('a failed-sync code without a word of its own is shown as it was sent', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.people.find((p) => p.id === 'p3')!.stations.find((s) => s.station_id === 'mgmt')!.last_error = 'brand_new_code';
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p3"]`).click();
    await drawer(page).locator('[data-person-tab="access"]').click();
    await expect(drawer(page).locator('[data-person-station="mgmt"] [data-person-sync-error]')).toHaveText('brand_new_code');
  });

  test('the timing view of a weekly schedule, and the validity states', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(page).locator('[data-person-timing]')).toContainText('ראשון, שני, שלישי, רביעי, חמישי');
    await expect(drawer(page).locator('[data-person-timing]')).toContainText('08:00–17:00');
    await expect(drawer(page).locator('[data-person-timing]')).toContainText('Asia/Jerusalem');
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} [data-person-row="p8"]`).click();
    await expect(drawer(page).locator('[data-person-state]')).toHaveAttribute('data-person-state', 'active'); // the window of p8 opened at 2026-10-12 00:00 +03:00
  });

  test('the sensitive section is absent (not greyed) for a names-level operator, and the server never sent it', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('operator');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    const d = drawer(page);
    await expect(d.locator('[data-person-section="details"]')).toBeVisible();
    await expect(d.locator('[data-person-section="sensitive"]')).toHaveCount(0);
    await expect(d.locator('[data-person-credentials]')).toHaveCount(0);
    await expect(d.locator('[data-person-phone]')).toHaveCount(0);
    await expect(d.locator('[data-person-message]')).toHaveCount(0);
    await expect(d.locator('[data-wiskey-person-edit]')).toHaveCount(0);
    await d.locator('[data-person-tab="access"]').click();
    await expect(d.locator('[data-person-sync-error]')).toHaveCount(0); // the operator sees the word, not the error text
    await shot(page, info, 'drawer-operator');
    expect(st.writes).toEqual([]);
  });

  test('the photo is fetched only when asked for - one audited view per click, none for opening the page', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    const d = drawer(page);
    await expect(d.locator('[data-person-portrait]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(st.hits.filter((h) => h.endsWith('/photo'))).toEqual([]);
    await d.locator('[data-person-photo-show]').click();
    await expect(d.locator('[data-person-photo-img]')).toBeVisible();
    expect(st.writes.filter((w) => w.path.endsWith('/photo'))).toHaveLength(1);
    await shot(page, info, 'drawer-photo');
    await d.locator('[data-person-photo-hide]').click();
    await expect(d.locator('[data-person-photo-img]')).toHaveCount(0);
    expect(st.writes.filter((w) => w.path.endsWith('/photo'))).toHaveLength(1); // hiding is not a view
    await d.locator('[data-person-photo-show]').click();
    await expect(d.locator('[data-person-photo-img]')).toBeVisible();
    expect(st.writes.filter((w) => w.path.endsWith('/photo'))).toHaveLength(2);
  });

  test('a person without a photo offers none; a refused or failing photo says so once', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p2"]`).click();
    await expect(drawer(page).locator('[data-person-photo-show]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    st.photo = 'down';
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-photo-show]').click();
    await expect(drawer(page).locator('[data-person-photo-error="unavailable"]')).toBeVisible();
  });

  test('the photo switch of the installation off: no photo control at all', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.photoEnabled = false;
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(page).locator('[data-person-section="sensitive"]')).toBeVisible();
    await expect(drawer(page).locator('[data-person-photo-show]')).toHaveCount(0);
  });

  test('a person who is gone, and a page that fails to load, keep the row and say so', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.detail = 'gone';
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(page).locator('[data-person-error="gone"]')).toBeVisible();
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    st.detail = 'failed';
    await page.locator(`${SCREEN} [data-person-row="p2"]`).click();
    await expect(drawer(page).locator('[data-person-error="failed"]')).toBeVisible();
    await shot(page, info, 'drawer-error');
  });

  test('the editor stays the existing component: "עריכה" and "הוספת אדם" open it, the page closes first', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-wiskey-people-add]`).click();
    await expect(page.locator('wiskey-person-editor')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    await expect(page.locator('wiskey-person-editor')).toHaveCount(1);
    await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0); // the editor is a page-level dialog: it must not sit behind the modal drawer
  });
});

test.describe('the editor hands back to the screen', () => {
  // the editor is the EXISTING component (its own flows are untouched); these specs prove only the events this screen answers.
  const fire = (page: Page, name: string, detail: Record<string, unknown>) =>
    page.locator('wiskey-person-editor').evaluate((el, [n, d]) => el.dispatchEvent(new CustomEvent(n as string, { detail: d, bubbles: true, composed: true })), [name, detail] as const);

  test('close brings the person page back; a save reloads the list, says so and shows the person; a delete closes the page', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    await expect(page.locator('wiskey-person-editor')).toHaveCount(1);
    await fire(page, 'editor-close', {});
    await expect(page.locator('wiskey-person-editor')).toHaveCount(0);
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    const before = peopleHits(st).length;
    st.people[0].display_name = 'דנה כהן (עודכן)';
    await fire(page, 'editor-saved', { person: { id: 'p1' }, notice: 'saved', note: '' });
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toContainText('נשמר');
    await expect.poll(() => peopleHits(st).length).toBeGreaterThan(before);
    await expect(page.locator('wiskey-person-editor')).toHaveCount(0);
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
    await expect(drawer(page)).toContainText('דנה כהן (עודכן)');
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} [data-person-row="p2"]`).click();
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    st.people = st.people.filter((p) => p.id !== 'p2');
    await fire(page, 'editor-deleted', { id: 'p2', notice: 'deleted', note: '' });
    await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(8);
    await expect(page.locator(`${SCREEN} [data-person-row="p2"]`)).toHaveCount(0);
  });
});

test.describe('the states', () => {
  test('loading: a skeleton, no spinner text', async ({ page }, info) => {
    const st = newMock('admin');
    st.delay = 3000;
    await open(page, st);
    await expect(page.locator(`${SCREEN} [data-people-skeleton]`)).toBeVisible({ timeout: 20_000 });
    await shot(page, info, 'state-loading');
    await ready(page);
  });

  test('empty: no people at all; and no results with filters offers to clear them', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.mode = 'empty';
    await open(page, st);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-empty]`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${SCREEN} [data-wiskey-people-empty]`)).toHaveAttribute('heading', 'אין אנשים להצגה');
    await shot(page, info, 'state-empty');
  });

  test('error: the list could not be loaded - retry', async ({ page }, info) => {
    const st = newMock('admin');
    st.mode = 'error';
    await open(page, st);
    const panel = page.locator(`${SCREEN} [data-wiskey-state="load_error"]`);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await shot(page, info, 'state-error');
    st.mode = 'ready';
    await panel.getByRole('button').click();
    await ready(page);
  });

  test('forbidden: a viewer (access.read only) sees the panel, never an empty list, and no people request is made', async ({ page }, info) => {
    const st = newMock('viewer');
    await open(page, st);
    const panel = page.locator(`${SCREEN} [data-wiskey-state="no_permission"]`);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-empty]`)).toHaveCount(0);
    expect(peopleHits(st)).toEqual([]);
    expect(st.hits.filter((h) => /access-control\/(people|groups)/.test(h))).toEqual([]);
    await shot(page, info, 'state-forbidden');
  });

  test('forbidden by the server: a 403 on the list is the same panel', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.mode = 'forbidden';
    await open(page, st);
    await expect(page.locator(`${SCREEN} [data-wiskey-state="no_permission"]`)).toBeVisible({ timeout: 20_000 });
  });

  test('unavailable and unsupported: one calm panel each; the settings link only for an administrator', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.mode = 'unavailable';
    await open(page, st);
    const panel = page.locator(`${SCREEN} [data-wiskey-state="unavailable"]`);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.locator('a.settings-link')).toHaveAttribute('href', '#/system/diagnostics?tab=access-control');
    await shot(page, info, 'state-unavailable');
    const st2 = newMock('admin');
    st2.mode = 'unsupported';
    const p2 = await page.context().newPage();
    await open(p2, st2);
    await expect(p2.locator(`${SCREEN} [data-wiskey-state="unsupported"]`)).toBeVisible({ timeout: 20_000 });
  });

  test('stale: when the service drops after a list was shown, the list stays marked as the last known', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.mode = 'down_after_ready';
    await open(page, st);
    await ready(page);
    await expect.poll(() => st.sockets.length).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    push(st);
    await expect(page.locator(`${SCREEN} [data-wiskey-stale]`)).toBeVisible({ timeout: 10_000 });
    await expect(rows(page)).toHaveCount(9);
    await shot(page, info, 'state-stale');
  });
});

test.describe('who is offered the screen', () => {
  test('a viewer is not offered the People tab; an operator is; a station-scoped operator is', async ({ page, browser }, info) => {
    desktopOnly(info);
    const tab = 'sw-tabs a[href="#/wiskey/people"]';
    const viewer = newMock('viewer');
    await open(page, viewer, { route: '/wiskey/overview' });
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
    await expect(page.locator(tab)).toHaveCount(0);
    for (const role of ['operator', 'scoped'] as const) {
      const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
      const p = await ctx.newPage();
      await open(p, newMock(role), { route: '/wiskey/overview' });
      await expect(p.locator(tab).first()).toBeVisible({ timeout: 20_000 });
      await ctx.close();
    }
  });

  test('a station-scoped operator sees only the people of their stations, no count of the rest', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('scoped');
    await open(page, st);
    await ready(page);
    const list = await names(page);
    expect(list).not.toContain('אורי שמש'); // park / store only
    expect(list).toContain('דנה כהן');
    await expect(page.locator(`${SCREEN} sw-page`)).not.toContainText('מתוך 10');
    await rows(page).first().click();
    await drawer(page).locator('[data-person-tab="access"]').click();
    const stations = await drawer(page).locator('[data-person-station]').evaluateAll((els) => els.map((e) => e.getAttribute('data-person-station')));
    expect(stations.every((s) => ['gate', 'lobby'].includes(s!))).toBe(true); // an out-of-scope assignment is omitted, not greyed
    await shot(page, info, 'scoped-operator');
  });

  test('copy hygiene: no platform name, no internal code, no permission id on the operator screen', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    await open(page, st);
    await ready(page);
    await rows(page).first().click();
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
    const text = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (n: Node) => {
        if (n instanceof Element) {
          for (const a of ['aria-label', 'title', 'placeholder', 'heading', 'label']) {
            const v = n.getAttribute(a);
            if (v) out.push(v);
          }
        }
        if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) out.push(n.textContent.trim());
        if (n instanceof Element && n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
        n.childNodes.forEach(walk);
      };
      // this screen only (the shell around it has its own labels): the first <wiskey-people> found through the shadow roots
      const find = (root: Document | ShadowRoot): Element | null => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'WISKEY-PEOPLE') return el;
          const inner = el.shadowRoot && find(el.shadowRoot);
          if (inner) return inner;
        }
        return null;
      };
      walk(find(document)!);
      return out.join('\n');
    });
    expect(text).not.toMatch(/WisKey|Home Assistant|Ingress|hikvision|add-on|תוסף|\bHA\b/i);
    expect(text).not.toMatch(/\bCR-\d+|\bS\d+\b|access\.[a-z]+\.[a-z]+/);
  });
});

test.describe('the phone and the tablet', () => {
  test('the phone: no table view, a scrolling filter row, the person\'s page is a bottom sheet', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile project');
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-people-view="table"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-table]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-list]`)).toBeVisible();
    await noOverflow(page);
    await shot(page, info, 'phone-list');
    await rows(page).first().click();
    const box = await drawer(page).locator('sw-drawer').evaluate((el) => el.shadowRoot!.querySelector('dialog')!.getBoundingClientRect().toJSON());
    expect(box.width).toBeGreaterThan(380); // full width: a sheet
    expect(box.bottom).toBeLessThanOrEqual(844 + 1);
    await shot(page, info, 'phone-drawer');
  });

  test('the tablet: the table fits without a page scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'tablet project');
    const st = newMock('admin');
    await open(page, st);
    await ready(page);
    await noOverflow(page);
    await shot(page, info, 'tablet-table');
  });
});

test.describe('the message dialog (the typed message routes, answered by the mock; the WisKey side behind them has only run against a fake)', () => {
  const dialog = (page: Page) => page.locator('wiskey-message-dialog');
  const line = (page: Page) => dialog(page).locator('[data-msg-line]');
  // the dialog's host has no box of its own (its box is a fixed layer): wait for what is inside it
  const dialogReady = (page: Page) => expect(dialog(page).locator('[data-msg-recipient], [data-msg-preview], [data-msg-line="cant"]').first()).toBeVisible();
  const disabled = (l: Locator) => expect(l).toHaveAttribute('disabled', '');
  const enabled = (l: Locator) => expect(l).not.toHaveAttribute('disabled', '');

  async function single(page: Page, st: PeopleMock, id = 'p1'): Promise<Locator> {
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="${id}"] [data-person-message-row]`).first().click();
    await dialogReady(page);
    return dialog(page);
  }

  test('the action exists only for a caller who may message, once an administrator switched messaging on', async ({ page }, info) => {
    desktopOnly(info);
    // no permission: no action, and the screen never even asks the message routes
    const none = newMock('admin');
    await open(page, none);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-person-message-row]`)).toHaveCount(0);
    expect(none.hits.filter((h) => /access-control\/messaging/.test(h))).toEqual([]);
    // the permission, but the administrator's switch is off: the screen asks once and offers nothing
    const ctx = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
    const p2 = await ctx.newPage();
    const off = newMock('admin');
    off.messaging = true;
    off.msg.feature = false;
    await open(p2, off);
    await ready(p2);
    await expect(p2.locator(`${SCREEN} [data-person-message-row]`)).toHaveCount(0);
    expect(off.hits.filter((h) => /access-control\/messaging/.test(h))).toEqual(['GET access-control/messaging']);
    await p2.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(p2).locator('[data-person-section="details"]')).toBeVisible();
    await expect(drawer(p2).locator('[data-person-message], [data-person-tab="messages"]')).toHaveCount(0);
    await ctx.close();
  });

  test('one person: pick a template, send, "sent" never means "delivered", the quota moves, the text is the server\'s', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    const d = await single(page, st);
    await expect(d.locator('[data-msg-recipient]')).toContainText('דנה כהן');
    await expect(d.locator('[data-msg-phone]')).toHaveText(/••.*01$/);
    await expect(d.locator('[data-msg-consent="unknown"]')).toBeVisible();
    await disabled(d.locator('[data-msg-send]'));
    await d.locator('[data-msg-template="card_ready"]').click();
    await expect(d.locator('[data-msg-text]')).toHaveValue(/שלום דנה כהן/);
    await shot(page, info, 'msg-single');
    await d.locator('[data-msg-send]').click();
    await expect(line(page)).toHaveAttribute('data-msg-line', 'sent');
    await expect(line(page)).toContainText('אין אישור מסירה');
    await expect(line(page)).not.toContainText('נמסר');
    const sends = st.writes.filter((w) => /messages$/.test(w.path));
    expect(sends).toHaveLength(1);
    // a template send carries the template and the revision of the catalogue the sender saw - and NO text (the server renders its own)
    expect(sends[0].body).toMatchObject({ template_id: 'card_ready', templates_revision: 3, confirmed: true });
    expect(sends[0].body).not.toHaveProperty('text');
    expect((sends[0].body as { client_request_id: string }).client_request_id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(st.msg.quota!.used).toBe(2);
    expect(JSON.stringify(st.writes)).not.toMatch(/\d{4,}.{0,10}קוד|pin/i);
    await shot(page, info, 'msg-sent');
  });

  test('free text starts empty and a template is copied in only when picked; editing a template makes it free text', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    const d = await single(page, st);
    await expect(d.locator('[data-msg-text]')).toHaveValue('');
    await d.locator('[data-msg-free]').click();
    await d.locator('[data-msg-text]').fill('שלום, אפשר לעבור במשרד?');
    await d.locator('[data-msg-send]').click();
    await expect(line(page)).toHaveAttribute('data-msg-line', 'sent');
    const sent = st.writes.filter((w) => /messages$/.test(w.path)).at(-1)!.body as { template_id: string | null; text: string };
    expect(sent.template_id).toBeUndefined(); // a free text names no template and carries no revision
    expect(sent).not.toHaveProperty('templates_revision');
    expect(sent.text).toBe('שלום, אפשר לעבור במשרד?');
  });

  test('free text switched off by the administrator: templates only, the text is read-only', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    st.msg.freeText = false;
    const d = await single(page, st);
    await expect(d.locator('[data-msg-free]')).toHaveCount(0);
    await d.locator('[data-msg-template="closure"]').click();
    await expect(d.locator('[data-msg-text]')).toHaveAttribute('readonly', '');
    await enabled(d.locator('[data-msg-send]'));
  });

  test('a PIN or an access code never goes out: a typed one blocks sending, a template with a placeholder is not offered', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    st.msg.credentialTemplate = true;
    const d = await single(page, st);
    await expect(d.locator('[data-msg-template="bad"]')).toHaveCount(0);
    await d.locator('[data-msg-free]').click();
    await d.locator('[data-msg-text]').fill('הקוד שלך 4821');
    await disabled(d.locator('[data-msg-send]'));
    await expect(line(page)).toHaveAttribute('data-msg-tone', 'err');
    await expect(line(page)).toContainText('אי אפשר לשלוח קוד גישה');
    await d.locator('[data-msg-text]').fill('הכניסה סגורה בין 12:00 ל־14:00');
    await enabled(d.locator('[data-msg-send]'));
    await shot(page, info, 'msg-credential-blocked');
    expect(st.writes.filter((w) => /messages$/.test(w.path))).toEqual([]);
  });

  test('a person with no phone has no message action at all (the row, the person page)', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    await open(page, st);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-person-row="p5"] [data-person-message-row]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-person-row="p1"] [data-person-message-row]`)).toHaveCount(1);
    await page.locator(`${SCREEN} [data-person-row="p5"]`).click();
    await expect(drawer(page).locator('[data-person-section="details"]')).toBeVisible();
    await expect(drawer(page).locator('[data-person-message]')).toHaveCount(0);
  });

  test('the person asked not to be messaged: the consent is shown, the text is dimmed, one amber line, send disabled', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    const d = await single(page, st, 'p4');
    await expect(d.locator('[data-msg-consent="declined"]')).toBeVisible();
    await expect(line(page)).toContainText('האדם ביקש לא לקבל הודעות');
    await expect(line(page)).toHaveAttribute('data-msg-tone', 'warn');
    await expect(d.locator('[data-msg-text]')).toBeDisabled();
    await disabled(d.locator('[data-msg-send]'));
    await shot(page, info, 'msg-no-consent');
  });

  test('the service is not connected: one amber line, send disabled', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    st.msg.enabled = false;
    const d = await single(page, st);
    await expect(line(page)).toContainText('שירות ההודעות אינו מחובר');
    await disabled(d.locator('[data-msg-send]'));
    await shot(page, info, 'msg-service-down');
  });

  test('refusals and an uncertain outcome are said as such; a rate refusal gives minutes; nothing is retried', async ({ page }, info) => {
    desktopOnly(info);
    for (const [mode, expected, tone] of [['not_registered', 'המספר אינו רשום בוואטסאפ', 'err'], ['uncertain', 'לא ידוע אם ההודעה נשלחה', 'err'], ['rate', '14 דק׳', 'warn'], ['service_down', 'שירות ההודעות אינו מחובר', 'err']] as const) {
      const st = newMock('admin');
      st.messaging = true;
      st.msg.mode = mode;
      const ctx = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
      const p = await ctx.newPage();
      await open(p, st);
      await ready(p);
      await p.locator(`${SCREEN} [data-person-row="p1"] [data-person-message-row]`).first().click();
      const d = p.locator('wiskey-message-dialog');
      await d.locator('[data-msg-template="closure"]').click();
      await d.locator('[data-msg-send]').click();
      await expect(d.locator('[data-msg-line]')).toContainText(expected);
      await expect(d.locator('[data-msg-line]')).toHaveAttribute('data-msg-tone', tone);
      expect(st.writes.filter((w) => /messages$/.test(w.path)), mode).toHaveLength(1); // one attempt, no automatic retry
      if (mode === 'rate') await shot(p, info, 'msg-rate');
      if (mode === 'not_registered') await shot(p, info, 'msg-failed');
      await ctx.close();
    }
  });

  test('hidden-phone mode: a sender who may not see the number still sends; the number is never on screen', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('operator');
    st.messaging = true; // may message (the permission), may not see phone numbers (no sensitive level)
    const d = await single(page, st, 'p2');
    await expect(d.locator('[data-msg-phone="hidden"]')).toHaveText('מספר מוסתר');
    await d.locator('[data-msg-template="validity_reminder"]').click();
    await d.locator('[data-msg-send]').click();
    await expect(line(page)).toHaveAttribute('data-msg-line', 'sent');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/050-?000-?0002|0500000002/);
    await shot(page, info, 'msg-hidden-phone');
  });

  test('bulk: one text for the selection, a preview that names who will not get it, sequential sends, a failure does not stop the rest', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    st.msg.mode = 'ok';
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-people-select-mode]`).click();
    for (const id of ['p1', 'p2', 'p4', 'p5']) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
    await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
    const d = dialog(page);
    await dialogReady(page);
    await expect(d.locator('[data-msg-preview]')).toContainText('יישלח ל־2');
    await expect(d.locator('[data-msg-preview]')).toContainText('לא יישלח ל־2');
    await expect(d.locator('[data-msg-preview]')).toContainText('אורי שמש');
    await disabled(d.locator('[data-msg-send]'));
    await d.locator('[data-msg-template="closure"]').click();
    await enabled(d.locator('[data-msg-send]'));
    await expect(d.locator('[data-msg-send]')).toContainText('שלח ל־2');
    await shot(page, info, 'msg-bulk');
    // ONE confirmation before a run; nothing has been sent yet
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="confirm"]')).toContainText('לשלוח ל־2 אנשים?');
    expect(st.writes.filter((w) => /messages$/.test(w.path))).toEqual([]);
    await shot(page, info, 'msg-bulk-confirm');
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toContainText('נשלח ל־2');
    const sends = st.writes.filter((w) => /messages$/.test(w.path));
    expect(sends).toHaveLength(2);
    expect(new Set(sends.map((w) => (w.body as { bulk_id: string }).bulk_id)).size).toBe(1); // one run, one id
    expect(sends.every((w) => (w.body as { bulk_total: number }).bulk_total === 2)).toBe(true);
    // the per-recipient result table: everyone the sender picked, in the order they picked, with the reason for the ones that did not get it
    const table = d.locator('[data-msg-results]');
    await expect(table.locator('[data-msg-result]')).toHaveCount(4);
    await expect(table.locator('[data-msg-result="p1"]')).toHaveAttribute('data-msg-outcome', 'sent');
    await expect(table.locator('[data-msg-result="p2"]')).toHaveAttribute('data-msg-outcome', 'sent');
    await expect(table.locator('[data-msg-result="p4"]')).toContainText('האדם ביקש לא לקבל הודעות');
    await expect(table.locator('[data-msg-result="p5"]')).toContainText('אין מספר טלפון');
    await shot(page, info, 'msg-bulk-sent');
  });

  test('bulk: more people than the administrator allows, and more than the quota has left, are blocked before anything is sent', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    st.msg.bulkMax = 2;
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-people-select-mode]`).click();
    for (const id of ['p1', 'p2', 'p3']) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
    await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await expect(d.locator('[data-msg-line="too-many"]')).toBeVisible();
    await disabled(d.locator('[data-msg-send]'));
    await d.locator('[data-msg-cancel]').click();
    expect(st.writes.filter((w) => /messages$/.test(w.path))).toEqual([]);
    st.msg.bulkMax = 10;
    st.msg.quota = { limit: 3, used: 2 };
    await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
    await dialog(page).locator('[data-msg-template="closure"]').click();
    await expect(dialog(page).locator('[data-msg-line="over-quota"]')).toBeVisible();
    await disabled(dialog(page).locator('[data-msg-send]'));
  });

  test('a message sent from the person\'s page opens inside it (the top layer) and returns to it', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('admin');
    st.messaging = true;
    await open(page, st);
    await ready(page);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-message]').click();
    await dialogReady(page);
    await dialog(page).locator('[data-msg-template="card_ready"]').click();
    await dialog(page).locator('[data-msg-send]').click();
    await expect(dialog(page).locator('[data-msg-line="sent"]')).toBeVisible();
    await dialog(page).locator('[data-msg-cancel]').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
  });
});
