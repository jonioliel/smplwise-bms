import { test, expect, type Page } from '@playwright/test';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';

// CR-036 slice S6 - the native stations and doors screen ("תחנות ודלתות") behind the real shell, against a MOCKED backend
// (tests/wiskey-stations-mocks.ts: invented stations, drawn stills, recorded writes; no WisKey, no Home Assistant, no station).
// Desktop / tablet / phone: the same behaviour at every width (the table is a tablet / desktop view). What it pins:
//   - the screen replaces the embedded panel only when `access.ui.stations` says so (default: the embedded panel stays);
//   - every control follows the caller's rights by ABSENCE (never greyed): doors / call / announce need access.release (today's
//     gate of the physical endpoints), the technical row needs access.stations.read, the call hint is for everyone;
//   - a door release: one confirmation sentence, ONE request, "sent" never "opened", an unknown outcome holds the button, never retried;
//   - call controls are two taps; the announcement goes station by station, once each; talk is a link to the classic panel;
//   - stale copies are for reading; the states (loading, empty, error, forbidden, feed states); no platform name on the screen.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-stations.spec.ts --workers=1

const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;

async function boot(page: Page, over: Partial<StationsMock> = {}, o: Parameters<typeof openStations>[1] = {}): Promise<StationsMock> {
  const mock = newMock(over);
  await installStationsMock(page, mock);
  await openStations(page, o);
  return mock;
}

const ready = async (page: Page) => {
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${SCREEN} [data-wk-station]`).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};
const station = (page: Page, id: string) => page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${id}"]`);
const drawer = (page: Page) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`);
const inDrawer = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
const phone = (info: { project: { name: string } }) => info.project.name === 'mobile';

test.describe('wiskey-stations: which screen the area shows', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the embedded panel stays the default; the native screen appears only when access.ui.stations says smplwise', async ({ page }) => {
    await boot(page, { settings: { 'access.ui.stations': 'wiskey' } });
    await expect(page.locator('wiskey-embed')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(SCREEN)).toHaveCount(0);
    // the same address, switched in Settings: the native screen
    await boot(page, { settings: { 'access.ui.stations': 'smplwise' } });
    await ready(page);
    await expect(page.locator(SCREEN)).toHaveCount(1);
    await expect(page.locator('wiskey-embed')).toHaveCount(0);
  });

  test('a visit can still reach the classic panel: ?classic=1 shows the embedded panel although the screen is set to Arx', async ({ page }) => {
    await boot(page, {}, { hash: '#/wiskey/overview?classic=1' });
    await expect(page.locator('wiskey-embed')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(SCREEN)).toHaveCount(0);
    // and the stations tab (the same segment as WisKey's own devices tab) is the native screen again, with the tab named for what it shows
    await page.goto('about:blank');
    await openStations(page);
    await ready(page);
    await expect(page.locator('sw-app sw-tabs a[href="#/wiskey/devices"]').first()).toContainText('תחנות ודלתות');
  });
});

test.describe('wiskey-stations: the station cards', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('an administrator sees six stations as cards with their state, call hint, doors and technical row', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const mock = await boot(page);
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-station]`)).toHaveCount(6);
    await expect(page.locator('sw-app sw-page[heading="תחנות ודלתות"]').first()).toHaveAttribute('subheading', '6 תחנות · 6 דלתות');
    // status words
    await expect(station(page, 'gate')).toHaveAttribute('data-status', 'ringing');
    await expect(station(page, 'lab')).toHaveAttribute('data-status', 'in_call');
    await expect(station(page, 'store')).toHaveAttribute('data-status', 'offline');
    await expect(station(page, 'lobby')).toHaveAttribute('data-status', 'online');
    // the call hint (no caller name): "incoming call" with the clock, "in a call"
    await expect(station(page, 'gate').locator('[data-wk-call-row]')).toContainText('שיחה נכנסת');
    await expect(station(page, 'gate').locator('[data-wk-call-clock]')).toHaveText('00:00');
    await expect(station(page, 'lab').locator('[data-wk-call-badge="in_call"]')).toContainText('בשיחה');
    // doors: one button per relay, named when there are two, disabled while the station is offline
    await expect(station(page, 'lobby').locator('[data-wk-door]')).toHaveCount(2);
    await expect(station(page, 'lobby').locator('[data-wk-door="lobby/2"]')).toContainText('פתח · מחסום');
    await expect(station(page, 'gate').locator('[data-wk-door="gate/1"]')).toHaveText('פתח');
    await expect(station(page, 'store').locator('[data-wk-door="store/1"]')).toHaveAttribute('disabled', '');
    await expect(station(page, 'park').locator('[data-wk-door]')).toHaveCount(0); // no integrated lock
    // technical row: sync pill and model; the offline station says how long ago
    await expect(station(page, 'park').locator('[data-wk-sync="pending"]')).toHaveAttribute('label', 'ממתין לסנכרון');
    await expect(station(page, 'mgmt').locator('[data-wk-sync="error"]')).toHaveAttribute('label', 'שגיאת סנכרון');
    await expect(station(page, 'gate').locator('[data-wk-tech-row] code')).toHaveText('DS-KD8003');
    await expect(station(page, 'store')).toContainText('אתמול');
    // the stills are drawn through the typed station id (never a host), and a station without a camera says so
    await expect(station(page, 'gate').locator('[data-wk-still] img')).toHaveAttribute('src', /intercom\/stations\/gate\/camera-snapshot\.jpg/);
    await expect(station(page, 'store').locator('[data-wk-still]')).toHaveAttribute('data-still-state', 'nocam');
    await expect(station(page, 'store').locator('[data-wk-still]')).toContainText('ללא מצלמה');
    // the active calls strip counts both calls and offers the list
    await expect(page.locator(`${SCREEN} [data-wk-strip]`)).toContainText('2 שיחות פעילות');
    // the browser only ever talked to Arx (typed endpoints), and nothing was written
    expect(mock.reads).toContain('stations');
    expect([mock.released, mock.signals, mock.spoken].map((x) => x.length)).toEqual([0, 0, 0]);
    expect(errors).toEqual([]);
  });

  test('an operator without access.release sees every station and the technical row, but no door, call or announce control', async ({ page }) => {
    await boot(page, { persona: 'operator' });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-door]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wk-call]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wk-announce], ${SCREEN} [data-wk-announce-at]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wk-talk]`)).toHaveCount(0);
    // the hint (no caller name) is for everyone who sees the station (owner answer 3 of 2026-10-12)
    await expect(station(page, 'gate').locator('[data-wk-call-row]')).toContainText('שיחה נכנסת');
    await expect(page.locator(`${SCREEN} [data-wk-tech-row]`)).toHaveCount(6);
    // error texts are for access.admin.read: the sync STATE shows, the text does not
    await station(page, 'mgmt').locator('button.open').click();
    await expect(drawer(page)).toHaveAttribute('open', '');
    await expect(inDrawer(page, '[data-wk-tech]')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-dsec="technical"]')).toBeVisible();
    await expect(inDrawer(page, '[data-wk-last-error]')).toHaveCount(0);
  });

  test('a viewer sees stations, state and the call hint - no technical row, no controls', async ({ page }) => {
    await boot(page, { persona: 'viewer' });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-station]`)).toHaveCount(6);
    await expect(page.locator(`${SCREEN} [data-wk-tech-row]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wk-door], ${SCREEN} [data-wk-call], ${SCREEN} [data-wk-announce]`)).toHaveCount(0);
    await expect(station(page, 'gate').locator('[data-wk-call-badge="ringing"]')).toBeVisible();
    await station(page, 'lobby').locator('button.open').click();
    await expect(inDrawer(page, '[data-wk-dsec="technical"]')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-dsec="settings"]')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-dsec="doors"]')).toBeVisible(); // the doors are listed, without a button
    await expect(inDrawer(page, '[data-wk-door]')).toHaveCount(0);
  });

  test('a door opener (access.release without the technical part) gets the controls and no technical row', async ({ page }) => {
    await boot(page, { persona: 'door' });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-grid] [data-wk-door]`)).toHaveCount(6);
    await expect(page.locator(`${SCREEN} [data-wk-tech-row]`)).toHaveCount(0);
  });

  test('without access.read the screen is the forbidden panel and the server is not asked for stations', async ({ page }) => {
    const mock = await boot(page, { persona: 'none' });
    await expect(page.locator(`${SCREEN} [data-wk-state="forbidden"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-wk-panel="forbidden"]`)).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
    expect(mock.reads).toEqual([]);
  });
});

test.describe('wiskey-stations: filters, search, views, places', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the filters, the search and the place tree narrow the cards; the counts stay', async ({ page }, info) => {
    await boot(page);
    await ready(page);
    const ids = async () => page.locator(`${SCREEN} [data-wk-grid] [data-wk-station]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-wk-station')));
    await page.locator(`${SCREEN} [data-wk-filter="online"]`).click();
    expect(await ids()).toEqual(['gate', 'lobby', 'park', 'lab', 'mgmt']);
    await page.locator(`${SCREEN} [data-wk-filter="attention"]`).click();
    expect(await ids()).toEqual(['park', 'store', 'mgmt']);
    await page.locator(`${SCREEN} [data-wk-filter="in_call"]`).click();
    expect(await ids()).toEqual(['gate', 'lab']);
    await page.locator(`${SCREEN} [data-wk-filter="all"]`).click();
    await page.locator(`${SCREEN} [data-wk-search]`).fill('לוב');
    expect(await ids()).toEqual(['lobby']);
    await page.locator(`${SCREEN} [data-wk-search]`).fill('קומה 1'); // the place is searchable too
    expect(await ids()).toEqual(['lab']);
    await page.locator(`${SCREEN} [data-wk-search]`).fill('אין כזה');
    await expect(page.locator(`${SCREEN} [data-wk-panel="empty-filter"]`)).toBeVisible();
    await page.locator(`${SCREEN} [data-wk-search]`).fill('');
    // places: floors and areas of the cameras (Arx's own floors / areas), counts, a floor narrows to its stations
    if (!phone(info)) {
      const tree = page.locator(`${SCREEN} sw-place-tree[data-wk-tree]`);
      await expect(tree.locator('[data-place-row="all"] .n')).toHaveText('6');
      await expect(tree.locator('[data-place-row="floor:f0"] .n')).toHaveText('3');
      await expect(tree.locator('[data-place-row="none"] .n')).toHaveText('1'); // the store has no camera, so no place
      await tree.locator('[data-place-pick="floor:f0"]').click();
      expect(await ids()).toEqual(['gate', 'lobby', 'park']);
      await tree.locator('[data-place-pick="area:a-lobby"]').click();
      expect(await ids()).toEqual(['lobby']);
      // a floor folds away its areas and remembers it
      await tree.locator('[data-place-fold="floor:f1"]').click();
      await expect(tree.locator('[data-place-row="area:a-lab"]')).toHaveCount(0);
      await tree.locator('[data-place-pick="all"]').click();
      expect(await ids()).toHaveLength(6);
    }
  });

  test('on a phone the tree is one chip that opens a sheet with the same places', async ({ page }, info) => {
    test.skip(!phone(info), 'phone layout');
    await boot(page);
    await ready(page);
    await expect(page.locator(`${SCREEN} aside.treecol`)).toBeHidden();
    const chip = page.locator(`${SCREEN} [data-wk-places-chip]`);
    await expect(chip).toContainText('מיקום: הכול');
    await chip.click();
    const sheet = page.locator(`${SCREEN} sw-drawer[data-wk-places-sheet]`);
    await expect(sheet).toHaveAttribute('open', '');
    await sheet.locator('[data-place-pick="floor:f1"]').click();
    await expect(chip).toContainText('מיקום: קומה 1');
    await expect(page.locator(`${SCREEN} [data-wk-grid] [data-wk-station]`)).toHaveCount(1); // the lab; the store has no camera, so no place
    await expect(station(page, 'lab')).toBeVisible();
  });

  test('cards, list and table are three views of the same stations; the choice is remembered; a phone has no table', async ({ page }, info) => {
    await boot(page);
    await ready(page);
    const views = page.locator(`${SCREEN} sw-view-switch[data-wk-views]`);
    await expect(views.locator('button[aria-pressed="true"]')).toHaveAttribute('data-view', 'cards');
    await views.locator('button[data-view="list"]').click();
    await expect(page.locator(`${SCREEN} [data-wk-rows] [data-wk-station]`)).toHaveCount(6);
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-view', 'list');
    if (phone(info)) await expect(views.locator('button[data-view="table"]')).toHaveCount(0);
    else {
      await views.locator('button[data-view="table"]').click();
      const table = page.locator(`${SCREEN} sw-table[data-wk-table]`);
      await expect(table.locator('tbody tr')).toHaveCount(6);
      await expect(table.locator('thead')).toContainText('סנכרון'); // the technical columns come with the technical part
      // who, is it up, a call and the buttons come first: what a narrow table cuts off is never the buttons
      const heads = (await table.locator('thead th').allTextContents()).map((h) => h.trim());
      const head = table.locator('thead');
      if (info.project.name === 'desktop') {
        expect(heads.slice(0, 4)).toEqual(['תחנה', 'מצב', 'שיחה', 'פעולות']);
        for (const col of ['מיקום', 'נראה לאחרונה', 'דלתות', 'דגם · קושחה']) await expect(head).toContainText(col);
      } else {
        // a tablet's table keeps what is read and done: place, door names and model wait in the drawer; a call that is on and the
        // offline station's last sighting move under its state
        expect(heads.slice(0, 3)).toEqual(['תחנה', 'מצב', 'פעולות']);
        for (const col of ['שיחה', 'מיקום', 'נראה לאחרונה', 'דלתות', 'דגם · קושחה']) await expect(head).not.toContainText(col);
        await expect(table.locator('tr[data-row-id="store"]')).toContainText('אתמול');
        await expect(table.locator('tr[data-row-id="gate"] td:nth-child(2) [data-wk-call-pill="ringing"]')).toContainText('שיחה נכנסת');
      }
      // a wide table scrolls inside its host and hides what is at its end: at the reference widths the whole table is in view
      expect(await table.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await expect(table.locator('[data-wk-open="lobby"]')).toHaveText('לובי');
      await expect(table.locator('[data-wk-call-pill="ringing"]')).toContainText('שיחה נכנסת');
      await table.locator('tr[data-row-id="park"]').click();
      await expect(drawer(page)).toHaveAttribute('open', '');
      await page.keyboard.press('Escape');
    }
    await page.reload();
    await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-view', phone(info) ? 'list' : 'table');
  });

  test("a laptop's table (1366 px) drops the door names and the model, keeps the place and the last sighting, and fits", async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is set here');
    await page.setViewportSize({ width: 1366, height: 800 });
    await boot(page);
    await ready(page);
    await page.locator(`${SCREEN} sw-view-switch[data-wk-views] button[data-view="table"]`).click();
    const table = page.locator(`${SCREEN} sw-table[data-wk-table]`);
    await expect(table.locator('tbody tr')).toHaveCount(6);
    const head = table.locator('thead');
    for (const col of ['תחנה', 'מצב', 'שיחה', 'פעולות', 'מיקום', 'נראה לאחרונה', 'סנכרון']) await expect(head).toContainText(col);
    for (const col of ['דלתות', 'דגם · קושחה']) await expect(head).not.toContainText(col);
    expect(await table.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    // and growing the window brings the columns back without a reload
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(head).toContainText('דגם · קושחה');
    await expect(head).toContainText('דלתות');
  });

  test('a narrow window (800 px) has no table: the list takes over, the choice comes back when the window grows', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is set here');
    await page.setViewportSize({ width: 1024, height: 800 });
    await boot(page);
    await ready(page);
    const views = page.locator(`${SCREEN} sw-view-switch[data-wk-views]`);
    await views.locator('button[data-view="table"]').click();
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-view', 'table');
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(views.locator('button[data-view="table"]')).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-view', 'list');
    await expect(page.locator(`${SCREEN} [data-wk-rows] [data-wk-station]`)).toHaveCount(6);
    await page.setViewportSize({ width: 820, height: 900 });
    await expect(views.locator('button[data-view="table"]')).toHaveCount(1);
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-view', 'table'); // the remembered choice
    // the narrowest table (820 px): the buttons are in view
    const table = page.locator(`${SCREEN} sw-table[data-wk-table]`);
    await expect(table.locator('tbody tr')).toHaveCount(6);
    const cut = await table.evaluate((host) => {
      const box = host.getBoundingClientRect();
      return Array.from(host.shadowRoot!.querySelectorAll('wk-action-button')).filter((b) => b.getBoundingClientRect().left < box.left - 1 || b.getBoundingClientRect().right > box.right + 1).length;
    });
    expect(cut).toBe(0);
  });
});

test.describe('wiskey-stations: the drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('a station opens in a drawer with its call, doors, announcement and technical sections; Escape closes it; the address follows', async ({ page }) => {
    await boot(page);
    await ready(page);
    await station(page, 'gate').locator('button.open').click();
    await expect(drawer(page)).toHaveAttribute('open', '');
    await expect(drawer(page)).toHaveAttribute('heading', 'שער ראשי');
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('station=gate');
    for (const sec of ['call', 'doors', 'announce', 'technical', 'settings']) await expect(inDrawer(page, `[data-wk-dsec="${sec}"]`)).toBeVisible();
    // live video stays in the classic panel: the slot says so and links there
    await expect(inDrawer(page, '[data-wk-live]')).toContainText('שידור חי בלוח הקלאסי');
    await expect(inDrawer(page, '[data-wk-classic-link]')).toHaveAttribute('href', '#/wiskey/overview?classic=1');
    await expect(inDrawer(page, '[data-wk-dsec="technical"]')).toContainText('DS-KD8003');
    await expect(inDrawer(page, '[data-wk-dsec="technical"]')).toContainText('V2.2.62');
    await page.keyboard.press('Escape');
    await expect(drawer(page)).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('station=');
  });

  test('a link with ?station= opens that station; a station outside the caller\'s scope is a calm placeholder with no data', async ({ page }) => {
    await boot(page, {}, { hash: '#/wiskey/devices?station=lobby' });
    await ready(page);
    await expect(drawer(page)).toHaveAttribute('open', '');
    await expect(drawer(page)).toHaveAttribute('data-wk-drawer-station', 'lobby');
    await page.goto('about:blank');
    await boot(page, {}, { hash: '#/wiskey/devices?station=elsewhere' });
    await ready(page);
    await expect(drawer(page)).toHaveAttribute('open', '');
    await expect(inDrawer(page, '[data-wk-panel="scoped"]')).toHaveAttribute('heading', 'התחנה אינה בתחום שלך');
    await expect(inDrawer(page, '[data-wk-dsec]')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-live]')).toHaveCount(0);
  });

  test('door settings are read only: programs, hours, holidays, and only whether a public code is set - never a code', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await station(page, 'lobby').locator('button.open').click();
    await expect(inDrawer(page, '[data-wk-dsec="settings"]')).toBeVisible();
    expect(mock.reads.filter((r) => r.startsWith('programs') || r.startsWith('codes'))).toEqual([]); // nothing is read until the section is opened
    await inDrawer(page, '[data-wk-settings-toggle]').click();
    const first = inDrawer(page, '[data-wk-program="1"]');
    await expect(first).toContainText('כניסה');
    await expect(first).toContainText('מופעלת');
    await expect(first).toContainText('פתוחה בהחזקה');
    // the hours are left-to-right isolates inside the Hebrew line (CR-036 S12: never shown reversed)
    await expect(first).toContainText(/א׳–ה׳ \u206608:00–17:00\u2069/);
    await expect(first).toContainText(/ו׳ \u206608:00–13:00\u2069/);
    await expect(first).toContainText('חגים: 1');
    await expect(inDrawer(page, '[data-wk-program="2"]')).toContainText('כבויה');
    const codes = inDrawer(page, '[data-wk-codes="set"]');
    await expect(codes).toContainText('קוד ציבורי');
    await expect(codes).toContainText('קוד 1: מוגדר');
    await expect(codes).toContainText('קוד 2: לא מוגדר');
    expect(mock.reads).toEqual(expect.arrayContaining(['programs:lobby', 'codes:lobby']));
    // the section offers no edit control of any kind
    await expect(inDrawer(page, '[data-wk-dsec="settings"] input, [data-wk-dsec="settings"] textarea, [data-wk-dsec="settings"] select')).toHaveCount(0);
  });

  test('door settings that cannot be read say so, and a retry reads again; features the installed version lacks hide the section', async ({ page }) => {
    const mock = await boot(page, { programs: 'busy' });
    await ready(page);
    await station(page, 'lobby').locator('button.open').click();
    await inDrawer(page, '[data-wk-settings-toggle]').click();
    await expect(inDrawer(page, '[data-wk-fetch="busy"]')).toContainText('הקריאה עסוקה');
    mock.programs = 'ok';
    await inDrawer(page, '[data-wk-fetch="busy"] wk-action-button').click();
    await expect(inDrawer(page, '[data-wk-program="1"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('about:blank');
    await boot(page, { features: { door_programs: false, public_codes: false } });
    await ready(page);
    await station(page, 'lobby').locator('button.open').click();
    await expect(inDrawer(page, '[data-wk-dsec="settings"]')).toHaveCount(0);
  });
});

test.describe('wiskey-stations: opening a door', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('one button, one confirmation sentence, ONE request that carries the confirmation; the result says "sent", never "opened"', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await station(page, 'lobby').locator('[data-wk-door="lobby/1"]').click();
    const dialog = page.locator(`${SCREEN} sw-dialog[data-wk-release-dialog]`);
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-wk-release-sentence]')).toHaveText('לפתוח את "כניסה" בלובי?');
    expect(mock.released).toHaveLength(0); // the press alone sends nothing
    // cancel sends nothing either
    await dialog.locator('[data-wk-release-cancel]').click();
    await expect(dialog).toHaveCount(0);
    expect(mock.released).toHaveLength(0);
    await station(page, 'lobby').locator('[data-wk-door="lobby/1"]').click();
    await page.locator(`${SCREEN} [data-wk-release-confirm]`).click();
    await expect(station(page, 'lobby').locator('[data-wk-result="lobby"]')).toHaveAttribute('data-tone', 'ok');
    const text = (await station(page, 'lobby').locator('[data-wk-result="lobby"]').innerText()).trim();
    expect(text).toContain('פתיחה נשלחה');
    expect(text).not.toMatch(/נפתח|נפתחה/);
    expect(mock.released).toHaveLength(1);
    expect(mock.released[0].station).toBe('lobby');
    expect(mock.released[0].body).toMatchObject({ lock: 1, confirmed: true });
    expect(String(mock.released[0].body.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(String(mock.released[0].body.expires_at)).toMatch(/Z$/);
  });

  test('a single-door station asks without a door name; an offline station offers no release', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await station(page, 'mgmt').locator('[data-wk-door="mgmt/1"]').click();
    await expect(page.locator(`${SCREEN} [data-wk-release-sentence]`)).toHaveText('לפתוח את "הנהלה" בהנהלה?');
    await page.locator(`${SCREEN} [data-wk-release-cancel]`).click();
    await expect(station(page, 'store').locator('[data-wk-door]')).toHaveAttribute('disabled', '');
    expect(mock.released).toHaveLength(0);
  });

  test('an unknown outcome is amber, holds that relay\'s button, and nothing is ever sent twice', async ({ page }) => {
    const mock = await boot(page, { release: 'unknown' });
    await ready(page);
    await station(page, 'lobby').locator('[data-wk-door="lobby/1"]').click();
    await page.locator(`${SCREEN} [data-wk-release-confirm]`).click();
    const line = station(page, 'lobby').locator('[data-wk-result="lobby"]');
    await expect(line).toHaveAttribute('data-tone', 'warn');
    await expect(line).toContainText('לא ידוע אם הפתיחה בוצעה');
    const held = station(page, 'lobby').locator('[data-wk-door="lobby/1"]');
    await expect(held).toHaveAttribute('data-state', 'held');
    await expect(held).toHaveAttribute('disabled', '');
    await expect(station(page, 'lobby').locator('[data-wk-door="lobby/2"]')).not.toHaveAttribute('disabled', ''); // another relay is not held
    await page.waitForTimeout(1500);
    expect(mock.released).toHaveLength(1);
  });

  test('a refusal before sending is a plain failure with the server\'s words and no hold', async ({ page }) => {
    const mock = await boot(page, { release: 'not_sent' });
    await ready(page);
    await station(page, 'gate').locator('[data-wk-door="gate/1"]').click();
    await page.locator(`${SCREEN} [data-wk-release-confirm]`).click();
    const line = station(page, 'gate').locator('[data-wk-result="gate"]');
    await expect(line).toHaveAttribute('data-tone', 'err');
    await expect(line).toContainText('הפקודה לא נשלחה');
    await expect(station(page, 'gate').locator('[data-wk-door="gate/1"]')).toHaveAttribute('data-state', 'idle');
    expect(mock.released).toHaveLength(1);
  });

  test('the release dialog is also reachable from the drawer (it renders inside it), and the result sticks to the drawer\'s top', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await station(page, 'lobby').locator('button.open').click();
    await inDrawer(page, '[data-wk-door="lobby/2"]').click();
    const dialog = page.locator(`${SCREEN} sw-drawer sw-dialog[data-wk-release-dialog]`);
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-wk-release-sentence]')).toHaveText('לפתוח את "מחסום" בלובי?');
    await dialog.locator('[data-wk-release-confirm]').click();
    await expect(inDrawer(page, '[data-wk-result="lobby"].sticky')).toContainText('פתיחה נשלחה');
    expect(mock.released.map((r) => r.body.lock)).toEqual([2]);
  });
});

test.describe('wiskey-stations: calls', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('answering takes two taps: the first arms the button, the second sends once', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    const answer = station(page, 'gate').locator('[data-wk-call="answer"]');
    await answer.click();
    await expect(answer).toHaveAttribute('armed', '');
    await expect(answer).toContainText('לחצו שוב');
    expect(mock.signals).toHaveLength(0);
    await page.waitForTimeout(700); // a double-tap is one gesture: the second tap must come after a moment
    await answer.click();
    await expect(station(page, 'gate').locator('[data-wk-result="gate"]')).toContainText('מענה נשלח');
    expect(mock.signals).toHaveLength(1);
    expect(mock.signals[0]).toMatchObject({ station: 'gate', body: { command: 'answer' } });
    expect(String(mock.signals[0].body.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  test('an arm that is not followed up runs out; a tap on the other control re-arms instead of sending', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    const answer = station(page, 'gate').locator('[data-wk-call="answer"]');
    await answer.click();
    await expect(answer).toHaveAttribute('armed', '');
    await station(page, 'gate').locator('[data-wk-call="reject"]').click();
    await expect(station(page, 'gate').locator('[data-wk-call="reject"]')).toHaveAttribute('armed', '');
    await expect(answer).not.toHaveAttribute('armed', '');
    await expect(station(page, 'gate').locator('[data-wk-call="reject"]')).not.toHaveAttribute('armed', '', { timeout: 6000 }); // ARM_MS = 4 s
    expect(mock.signals).toHaveLength(0);
  });

  test('in a call: hang up (two taps) and "talk in the classic panel", a link - not a microphone', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    const talk = station(page, 'lab').locator('[data-wk-talk="classic"]');
    await expect(talk).toHaveAttribute('href', '#/wiskey/overview?classic=1');
    await expect(talk).toContainText('לוח קלאסי');
    const hang = station(page, 'lab').locator('[data-wk-call="hangUp"]');
    await hang.click();
    await page.waitForTimeout(700);
    await hang.click();
    await expect(station(page, 'lab').locator('[data-wk-result="lab"]')).toContainText('סיום נשלח');
    expect(mock.signals.map((s) => s.body.command)).toEqual(['hangUp']);
  });

  test('the talk link leaves the native screen for the classic panel, for this visit only', async ({ page }) => {
    await boot(page);
    await ready(page);
    await station(page, 'lab').locator('[data-wk-talk="classic"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('/wiskey/overview?classic=1');
    await expect(page.locator('wiskey-embed')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(SCREEN)).toHaveCount(0);
  });

  test('a change notice makes the screen read again: a station starts ringing and the strip follows', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await expect(station(page, 'park').locator('[data-wk-call-row]')).toHaveCount(0);
    mock.stations.find((s) => s.id === 'park')!.call_state = 'ringing';
    mock.push();
    await expect(station(page, 'park').locator('[data-wk-call-row]')).toContainText('שיחה נכנסת');
    await expect(page.locator(`${SCREEN} [data-wk-strip]`)).toContainText('3 שיחות פעילות');
  });
});

test.describe('wiskey-stations: announcements', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('to one station: the text and a quick phrase, one request, "sent - playback not verified"', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await station(page, 'lobby').locator('[data-wk-announce-at="lobby"]').click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await expect(dlg.locator('sw-dialog[data-wk-announce-dialog]')).toHaveAttribute('open', '');
    await expect(dlg.locator('[data-wk-target="station:lobby"]')).toHaveAttribute('aria-pressed', 'true'); // the station it was opened from
    const send = dlg.locator('[data-wk-announce-send]');
    await expect(send).toHaveAttribute('disabled', ''); // no text yet
    await dlg.locator('[data-wk-phrase]').first().click();
    await expect(dlg.locator('[data-wk-announce-message]')).toHaveValue('נא להמתין, מישהו בדרך אליך');
    await expect(dlg.locator('.cnt')).toHaveText('26/500');
    await expect(send).not.toHaveAttribute('disabled', '');
    await send.click();
    await expect(dlg.locator('[data-wk-announce-result]')).toHaveAttribute('data-tone', 'ok');
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('ההכרזה נשלחה');
    expect((await dlg.locator('[data-wk-announce-result]').innerText())).not.toMatch(/הושמעה/);
    expect(mock.spoken).toHaveLength(1);
    expect(mock.spoken[0]).toMatchObject({ station: 'lobby', body: { engine_id: 'tts.local', language: 'he', message: 'נא להמתין, מישהו בדרך אליך' } });
  });

  test('to all stations: one request per ONLINE station, in order, once each', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await expect(dlg.locator('[data-wk-target="all"]')).toContainText('כל התחנות (5)'); // the offline store cannot speak
    await dlg.locator('[data-wk-target="all"]').click();
    await dlg.locator('[data-wk-announce-message]').fill('בדיקת הכרזה');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('ההכרזה נשלחה ל־5 תחנות');
    expect(mock.spoken.map((s) => s.station)).toEqual(['gate', 'lobby', 'park', 'lab', 'mgmt']);
    // and the composer still names what happened, so a second press is the operator's own decision
    await expect(dlg.locator('[data-wk-announce-send]')).toContainText('שליחה נוספת');
  });

  test('to a place: the floor chip addresses the online stations whose cameras are there', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await expect(dlg.locator('[data-wk-target="place:floor:f0"]')).toContainText('קומת קרקע (3)');
    await dlg.locator('[data-wk-target="place:floor:f0"]').click();
    await dlg.locator('[data-wk-announce-message]').fill('הודעה לקומה');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('3 תחנות');
    expect(mock.spoken.map((s) => s.station).sort()).toEqual(['gate', 'lobby', 'park']);
  });

  test('a failure at one station is named, the others still get it, and nothing is repeated', async ({ page }) => {
    const mock = await boot(page, { ttsFail: { lobby: { status: 409, code: 'intercom_station_offline', details: { outcome: 'not_sent' } } } });
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await dlg.locator('[data-wk-target="all"]').click();
    await dlg.locator('[data-wk-announce-message]').fill('בדיקה');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect(dlg.locator('[data-wk-announce-result]')).toHaveAttribute('data-tone', 'warn');
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('נשלחה ל־4');
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('לובי');
    expect(mock.spoken.map((s) => s.station)).toEqual(['gate', 'lobby', 'park', 'lab', 'mgmt']);
  });

  test('a busy speaker holds the send button for the seconds the server names; the administrator may narrow targets to one station', async ({ page }) => {
    const mock = await boot(page, { ttsFail: { gate: { status: 409, code: 'tts_refused', details: { outcome: 'refused', wiskey_code: 'audio_busy', retry_after_s: 12 } } }, settings: { 'access.announce_scope': 'station' } });
    await ready(page);
    await station(page, 'gate').locator('[data-wk-announce-at="gate"]').click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await expect(dlg.locator('[data-wk-target]')).toHaveCount(5); // one chip per online station: no place, no "all"
    await expect(dlg.locator('[data-wk-target="all"]')).toHaveCount(0);
    await dlg.locator('[data-wk-announce-message]').fill('בדיקה');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('העמדה עדיין משמיעה');
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('אפשר לשלוח שוב בעוד');
    await expect(dlg.locator('[data-wk-announce-send]')).toHaveAttribute('disabled', '');
    expect(mock.spoken).toHaveLength(1);
  });

  test('no speech engine and an unsupported version are said in words, and nothing can be sent', async ({ page }) => {
    for (const engines of ['none', 'unsupported'] as const) {
      await page.goto('about:blank');
      const mock = await boot(page, { engines });
      await ready(page);
      await page.locator(`${SCREEN} [data-wk-announce]`).click();
      const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
      await expect(dlg.locator('[data-wk-announce-engines-state]')).toContainText(engines === 'none' ? 'אין מנוע הקראה זמין' : 'ההכרזות אינן נתמכות');
      await dlg.locator('[data-wk-announce-message]').fill('שלום');
      await expect(dlg.locator('[data-wk-announce-send]')).toHaveAttribute('disabled', '');
      expect(mock.spoken).toHaveLength(0);
    }
  });

  test('the engine and the language live behind "more"; the choice goes with the request', async ({ page }) => {
    const mock = await boot(page);
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await expect(dlg.locator('[data-wk-engine]')).toHaveCount(0); // not in the way of the clean composer
    await dlg.locator('[data-wk-announce-more]').click();
    await expect(dlg.locator('[data-wk-engine] option')).toHaveCount(2);
    await expect(dlg.locator('[data-wk-language]')).toHaveValue('he');
    await dlg.locator('[data-wk-engine]').selectOption('tts.cloud');
    await expect(dlg.locator('[data-wk-language] option')).toHaveCount(1);
    await dlg.locator('[data-wk-announce-message]').fill('test');
    await dlg.locator('[data-wk-target]').first().click();
    await dlg.locator('[data-wk-announce-send]').click();
    await expect.poll(() => mock.spoken.length).toBe(1);
    expect(mock.spoken[0].body).toMatchObject({ engine_id: 'tts.cloud', language: 'en', message: 'test' });
  });
});

test.describe('wiskey-stations: states', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('loading says so while the stations are read', async ({ page }) => {
    await boot(page, { stationsDelay: 2500 });
    await expect(page.locator(`${SCREEN} [data-wk-state="loading"] [data-wk-panel="loading"]`)).toHaveAttribute('heading', 'טוען תחנות…', { timeout: 30_000 });
    await ready(page);
  });

  for (const [feed, heading] of [
    ['ha_not_configured', 'בקרת הכניסה אינה מחוברת בסביבה הזו'],
    ['connecting', 'מתחבר לבקרת הכניסה…'],
    ['ha_unavailable', 'אין חיבור לבקרת הכניסה כרגע'],
    ['not_installed', 'בקרת הכניסה אינה זמינה'],
    ['forbidden', 'בקרת הכניסה דחתה את הגישה'],
    ['error', 'בקרת הכניסה החזירה שגיאה'],
  ] as const) {
    test(`the feed state ${feed} has its own words and does not name the platform`, async ({ page }) => {
      await boot(page, { feed });
      const panel = page.locator(`${SCREEN} [data-wk-panel="feed:${feed}"]`);
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(panel).toHaveAttribute('heading', heading);
      expect(heading).not.toMatch(BANNED);
      // an installation without the integration offers the Settings link to an administrator only
      if (feed === 'not_installed') await expect(panel).toHaveAttribute('actionlabel', 'להגדרות');
      else await expect(panel).not.toHaveAttribute('actionlabel', /./);
    });
  }

  test('without the integration a viewer gets no Settings link', async ({ page }) => {
    await boot(page, { feed: 'not_installed', persona: 'viewer' });
    const panel = page.locator(`${SCREEN} sw-state-panel[data-wk-panel="feed:not_installed"]`);
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel).not.toHaveAttribute('actionlabel', /./);
  });

  test('an empty installation, a failed read with a retry, and a refused read', async ({ page }) => {
    await boot(page, { stations: [] });
    await expect(page.locator(`${SCREEN} [data-wk-state="empty"] [data-wk-panel="empty"]`)).toHaveAttribute('heading', 'אין תחנות להצגה', { timeout: 30_000 });
    await page.goto('about:blank');
    const mock = await boot(page, { stationsStatus: 500 });
    const panel = page.locator(`${SCREEN} [data-wk-panel="error"]`);
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel).toHaveAttribute('heading', 'לא ניתן לטעון את התחנות');
    mock.stationsStatus = null;
    await panel.locator('sw-button').click(); // "try again" reads once more
    await ready(page);
    await page.goto('about:blank');
    await boot(page, { stationsStatus: 403 });
    await expect(page.locator(`${SCREEN} [data-wk-state="forbidden"]`)).toBeVisible({ timeout: 30_000 });
  });

  test('a last-known copy is for reading: the pill says how old it is and no physical control works', async ({ page }) => {
    const mock = await boot(page, { feed: 'stale' });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-stations]`)).toHaveAttribute('data-live', 'false');
    await expect(page.locator('sw-app sw-badge[data-wk-feed]').first()).toHaveAttribute('label', 'עודכן לפני 4 דק׳');
    for (const sel of ['[data-wk-door="lobby/1"]', '[data-wk-call="answer"]']) await expect(station(page, sel.includes('door') ? 'lobby' : 'gate').locator(sel)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${SCREEN} [data-wk-announce]`)).toHaveAttribute('disabled', '');
    expect(mock.released.length + mock.signals.length + mock.spoken.length).toBe(0);
  });
});

test.describe('wiskey-stations: the administrator\'s decisions', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('access.call_hint = call hides the hint from who may not act on calls; access.talk_button = hidden removes the talk link', async ({ page }) => {
    await boot(page, { persona: 'viewer', settings: { 'access.call_hint': 'call' } });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-call-row], ${SCREEN} [data-wk-call-badge]`)).toHaveCount(0);
    await page.goto('about:blank');
    await boot(page, { settings: { 'access.talk_button': 'hidden' } });
    await ready(page);
    await expect(page.locator(`${SCREEN} [data-wk-call-row]`)).toHaveCount(2); // the hint and the controls stay
    await expect(page.locator(`${SCREEN} [data-wk-talk]`)).toHaveCount(0);
    await station(page, 'lab').locator('button.open').click();
    await expect(inDrawer(page, '[data-wk-talk]')).toHaveCount(0);
  });

  test('the quick phrases are the administrator\'s when set', async ({ page }) => {
    await boot(page, { settings: { 'access.announce_phrases': 'שלום לכולם\nנא לפנות את המעבר' } });
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const phrases = page.locator(`${SCREEN} wk-announce-dialog [data-wk-phrase]`);
    await expect(phrases).toHaveCount(2);
    await expect(phrases.first()).toContainText('שלום לכולם');
  });
});

test.describe('wiskey-stations: hygiene', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('no platform name on the operator screen, the drawer or the dialogs, and the browser talks only to Arx', async ({ page }) => {
    const hosts = new Set<string>();
    const paths: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http')) hosts.add(u.host);
      if (u.pathname.includes('/api/v1/')) paths.push(`${r.method()} ${u.pathname.replace(/^.*\/api\/v1\//, '')}`);
    });
    await boot(page);
    await ready(page);
    const text = async () => (await page.locator(SCREEN).evaluate((el) => (el.shadowRoot?.textContent ?? '') + ' ' + (el as HTMLElement).innerText));
    expect(await text()).not.toMatch(BANNED);
    await station(page, 'gate').locator('button.open').click();
    await inDrawer(page, '[data-wk-settings-toggle]').click();
    await expect(inDrawer(page, '[data-wk-program="1"]')).toBeVisible();
    expect(await text()).not.toMatch(BANNED);
    await inDrawer(page, '[data-wk-door="gate/1"]').click();
    expect(await text()).not.toMatch(BANNED);
    await page.locator(`${SCREEN} [data-wk-release-cancel]`).click();
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    await page.locator(`${SCREEN} wk-announce-dialog [data-wk-announce-more]`).click();
    expect(await text()).not.toMatch(BANNED);
    // typed endpoints only: one origin, no WisKey command, no generic proxy
    expect([...hosts]).toHaveLength(1);
    const own = paths.filter((p) => /access-control|intercom\/|devices\/(tree|entities)/.test(p));
    expect(own.length).toBeGreaterThan(3);
    for (const p of own) expect(p).toMatch(/^(GET access-control\/(stations|features)(\/[^/]+\/(programs|codes))?|GET intercom\/stations\/[^/]+\/camera-snapshot\.jpg(\?.*)?|GET intercom\/tts\/engines|GET devices\/(tree|entities)(\?.*)?)$/);
    expect(paths.filter((p) => /hikvision|\/command|\/proxy/.test(p))).toEqual([]);
  });

  test('the cards and the controls work from the keyboard: Tab reaches a door button, Enter opens the confirmation, Escape cancels', async ({ page }, info) => {
    test.skip(phone(info), 'a keyboard is not the phone\'s input');
    const mock = await boot(page);
    await ready(page);
    const button = station(page, 'mgmt').locator('[data-wk-door="mgmt/1"] button');
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${SCREEN} [data-wk-release-dialog]`)).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator(`${SCREEN} [data-wk-release-dialog]`)).toHaveCount(0);
    expect(mock.released).toHaveLength(0);
    // a card opens from its own focusable button
    const open = station(page, 'park').locator('button.open');
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toHaveAttribute('open', '');
  });
});
