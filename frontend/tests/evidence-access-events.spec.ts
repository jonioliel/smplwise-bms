import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, SKINS, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// CR-036 S8: the native entry log ("פעילות", #/wiskey/events) against the mocked backend (tests/access-control-mocks.ts: the wire shapes of the
// typed reads GET /api/v1/access-control/..., checked against the real endpoints by backend/tests/test_access_control_wire.py). The app runs for
// real - shell, navigation, permissions - only the server and the two sockets are mocked; the clock is fixed (Sunday 2026-09-27, 13:30 in
// Jerusalem). Behaviour first (desktop project), then the screens in every state at desktop / tablet / phone, then the skins x light / dark.
// Evidence screenshots go to docs/design/evidence/CR-036-S8/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-access-events.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-S8');
const SCREEN = 'wiskey-events';

const rows = (page: Page) => page.locator(`${SCREEN} button.row[data-row-id]`);
const row = (page: Page, id: string) => page.locator(`${SCREEN} button.row[data-row-id="${id}"]`);
const eventCalls = (mock: AccessMock) => mock.calls.filter((c) => c.path === 'access-control/events');
const lastEvents = (mock: AccessMock) => eventCalls(mock).at(-1)!.query;
const drawer = (page: Page) => page.locator(`${SCREEN} sw-drawer[open] wiskey-event-drawer`);
const panel = (page: Page, state: string) => page.locator(`${SCREEN} sw-state-panel[data-wiskey-state="${state}"]`);

interface Booted {
  mock: AccessMock;
  errors: string[];
}

/** The app on the entry log with the mocked backend; `ready: false` does not wait for a row (a state with none). */
async function boot(page: Page, opts: MockOptions = {}, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; ready?: boolean } = {}): Promise<Booted> {
  const mock = await installAccessMock(page, opts);
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errors.push(m.text());
  });
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? '/wiskey/events', o.skin ?? 'classic', o.scheme ?? 'light'));
  await page.waitForSelector('sw-app');
  if (o.ready !== false) await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function choose(page: Page, filter: 'range' | 'station' | 'result' | 'method' | 'door', id: string) {
  const dd = page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="${filter}"]`);
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`[role="option"][data-id="${id}"]`).click();
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const closeDrawer = async (page: Page) => {
  await page.locator(`${SCREEN} sw-drawer[open] [data-drawer-close]`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[open]`)).toHaveCount(0);
};

const text = (l: Locator) => l.evaluate((el) => (el as HTMLElement).innerText);

test.describe('the entry log: behaviour', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the screens run on all three below');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('the first page: grouped by local day, the words of each row, no platform name anywhere', async ({ page }, info) => {
    const { mock, errors } = await boot(page);
    // 130 rows exist, the first page is 100 (the server's own page size) and says there is more
    await expect(rows(page)).toHaveCount(100);
    await expect(page.locator(`${SCREEN} [data-wiskey-events-more]`)).toBeVisible();
    expect(eventCalls(mock)[0].query).toEqual({ limit: '100' });
    // two days: today and yesterday of the station's clock zone, then dates
    const days = await page.locator(`${SCREEN} [data-wiskey-day]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim()));
    expect(days.slice(0, 2)).toEqual(['היום', 'אתמול']);
    // the newest row: the person, station, door and method; the time in the station's zone (09:52 UTC = 12:52 in Jerusalem)
    const first = row(page, 'ev-0001');
    await expect(first.locator('[data-wiskey-event-person]')).toHaveText('דנה כהן');
    await expect(first.locator('[data-wiskey-event-station]')).toHaveText('שער ראשי · דלת 1 · כרטיס');
    await expect(first.locator('[data-wiskey-event-time]')).toContainText('12:52');
    // a distinct pill per result: granted / denied / a ring / a door record
    await expect(first.locator('sw-badge')).toHaveAttribute('kind', 'live');
    await expect(first.locator('sw-badge')).toHaveAttribute('label', 'אושר');
    await expect(row(page, 'ev-0003').locator('[data-wiskey-event-person]')).toHaveText('לא זוהה');
    await expect(row(page, 'ev-0003').locator('sw-badge')).toHaveAttribute('kind', 'error');
    await expect(row(page, 'ev-0003').locator('sw-badge')).toHaveAttribute('label', 'נדחה');
    await expect(row(page, 'ev-0005').locator('[data-wiskey-event-person]')).toHaveText('שיחה מהעמדה');
    await expect(row(page, 'ev-0005').locator('sw-badge')).toHaveAttribute('kind', 'recorded');
    await expect(row(page, 'ev-0005').locator('[data-wiskey-event-station]')).toHaveText('שער ראשי');
    await expect(row(page, 'ev-0008').locator('[data-wiskey-event-person]')).toHaveText('פתיחה');
    // an operator screen: no hint paragraph, no platform name, no internal code
    const body = await text(page.locator(SCREEN));
    expect(body).not.toMatch(/WisKey|Home Assistant|Ingress|hikvision|\bHA\b|CR-0|\bS8\b|access\.[a-z]+\.[a-z]+/i);
    expect(await page.locator(`${SCREEN} .note`).count()).toBe(1); // the history gap of the parking station, nothing else
    expect(errors).toEqual([]);
    expect(mock.portraitViews).toBe(0); // no picture is fetched for a list nobody opened
    expect(mock.detailViews).toBe(0);
    await shot(page, info, 'events-list-classic-light');
  });

  test('"load more" passes the server\'s cursor back exactly as served and appends the older rows', async ({ page }) => {
    const { mock } = await boot(page);
    const served = page.waitForResponse((r) => r.url().includes('access-control/events') && r.url().includes('before='));
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    const reply = await (await served).json();
    await expect(rows(page)).toHaveCount(130, { timeout: 15_000 });
    expect(reply.events.next).toBeNull();
    expect(eventCalls(mock).at(-1)!.query).toEqual({ limit: '100', before: 'ev-0100' });
    await expect(page.locator(`${SCREEN} [data-wiskey-events-more]`)).toHaveCount(0);
    // appended, not replaced: the newest row is still first, the oldest last
    await expect(rows(page).first()).toHaveAttribute('data-row-id', 'ev-0001');
    await expect(rows(page).last()).toHaveAttribute('data-row-id', 'ev-0130');
  });

  test('a restricted caller\'s opaque cursor (an Arx token, not an event id) goes back unchanged, page after page', async ({ page }) => {
    // what each request asked (`before`) and what its answer said the next page is (`next`), in the order they happened
    const pairs = new Map<string, string>();
    page.on('response', async (r) => {
      if (!r.url().includes('access-control/events?')) return;
      const before = new URL(r.url()).searchParams.get('before') ?? 'first';
      pairs.set(before, ((await r.json()) as { events: { next: string | null } }).events.next ?? '');
    });
    const { mock } = await boot(page, { persona: 'scoped', pageSize: 10 });
    await expect(rows(page)).toHaveCount(10);
    for (let i = 0; i < 2; i++) {
      const more = page.locator(`${SCREEN} [data-wiskey-events-more]`);
      await expect(more).toBeVisible();
      await more.click();
      await expect(rows(page)).toHaveCount(10 * (i + 2), { timeout: 15_000 });
    }
    const afters = eventCalls(mock).filter((c) => c.query.before).map((c) => c.query.before);
    expect(afters).toHaveLength(2);
    for (const token of afters) expect(token).toMatch(/^c\.ev-\d{4}$/);
    expect(afters[0]).toBe(pairs.get('first')); // byte for byte what the first answer said
    expect(afters[1]).toBe(pairs.get(afters[0])); // and the second answer's, for the third page
  });

  test('every chip becomes the server\'s own filter, and only that one; "clear" sends the bare first page again', async ({ page }) => {
    const { mock } = await boot(page);
    await choose(page, 'station', 'entry-b');
    await expect.poll(() => lastEvents(mock).station_id).toBe('entry-b');
    await choose(page, 'result', 'denied');
    await expect.poll(() => lastEvents(mock).result).toBe('denied');
    await choose(page, 'method', 'pin');
    await choose(page, 'door', '2');
    await expect.poll(() => lastEvents(mock)).toEqual({ station_id: 'entry-b', result: 'denied', authentication: 'pin', door: '2', limit: '100' });
    // every row shown matches (the lobby, denied, by code) - once the filtered page has arrived (the request is recorded before its answer renders)
    await expect
      .poll(async () => {
        const subs = await page.locator(`${SCREEN} [data-wiskey-event-station]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText));
        return subs.length > 0 && subs.every((s) => s.includes('לובי'));
      })
      .toBe(true);
    // the period chip: "today" is the local day of the filter zone (the station's clock zone), sent as an instant
    await choose(page, 'range', 'today');
    await expect.poll(() => lastEvents(mock).start).toBe('2026-09-26T21:00:00.000Z');
    expect(lastEvents(mock).end).toBeUndefined();
    // the clear control puts everything back
    await page.locator(`${SCREEN} [data-wiskey-filter-clear]`).click();
    await expect.poll(() => lastEvents(mock)).toEqual({ limit: '100' });
    await expect(page.locator(`${SCREEN} [data-wiskey-filter-clear]`)).toHaveCount(0);
    // the search is the person filter, after a short pause
    await page.locator('[data-wiskey-search]').fill('דנה');
    await expect.poll(() => lastEvents(mock).person, { timeout: 5_000 }).toBe('דנה');
    await expect
      .poll(() => page.locator(`${SCREEN} [data-wiskey-event-person]`).evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).innerText))]))
      .toEqual(['דנה כהן']);
    await expect(page.locator(`${SCREEN} [data-wiskey-filter-clear]`)).toBeVisible();
  });

  test('a custom period is typed in the station\'s zone; a wall time that DST repeats or skips is refused and nothing is sent', async ({ page }) => {
    const { mock } = await boot(page);
    const before = eventCalls(mock).length;
    await choose(page, 'range', 'custom');
    const dialog = page.locator(`${SCREEN} sw-dialog[data-wiskey-custom-range]`);
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('[data-wiskey-events-zone]')).toContainText('Asia/Jerusalem');
    // Jerusalem 2026: 01:30 on 2026-10-25 happens twice; 02:30 on 2026-03-27 never happens
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-10-25T01:30');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(dialog.locator('[data-wiskey-events-filter-error]')).toHaveAttribute('data-wiskey-events-filter-error', 'clock_ambiguous');
    await dialog.locator('[data-wiskey-filter-start]').fill('');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-03-27T02:30');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(dialog.locator('[data-wiskey-events-filter-error]')).toHaveAttribute('data-wiskey-events-filter-error', 'clock_nonexistent');
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-09-27T00:00');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-09-26T00:00');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(dialog.locator('[data-wiskey-events-filter-error]')).toHaveAttribute('data-wiskey-events-filter-error', 'filter_start_before_end');
    await page.waitForTimeout(400);
    expect(eventCalls(mock).length).toBe(before); // none of the three refusals reached the server
    // a good period converts exactly (UTC+03:00 in September)
    await dialog.locator('[data-wiskey-filter-start]').fill('2026-09-27T00:00');
    await dialog.locator('[data-wiskey-filter-end]').fill('2026-09-27T07:00');
    await dialog.locator('[data-wiskey-custom-apply]').click();
    await expect(dialog).not.toHaveAttribute('open', '');
    await expect.poll(() => lastEvents(mock)).toEqual({ start: '2026-09-26T21:00:00.000Z', end: '2026-09-27T04:00:00.000Z', limit: '100' });
  });

  test('the drawer: a row without a picture asks for none; a row with one asks once per opening, only after it is opened', async ({ page }, info) => {
    const { mock } = await boot(page);
    // ev-0002 has no picture: the drawer opens, the evidence is read, no picture is asked for and no picture section exists
    await row(page, 'ev-0002').click();
    await expect(drawer(page).locator('[data-ev-section="event"]')).toBeVisible();
    await expect(drawer(page).locator('[data-ev-field="identity"]')).toHaveText('זוהה לפי מספר עובד ושם');
    await expect(drawer(page).locator('[data-ev-section="portrait"]')).toHaveCount(0);
    expect(mock.portraitViews).toBe(0);
    expect(mock.detailViews).toBe(1);
    await closeDrawer(page);
    // ev-0001 has one: exactly one request, with the row's own station and instant
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-portrait="ready"]')).toBeVisible();
    await expect(drawer(page).locator('[data-ev-portrait-img]')).toHaveAttribute('src', /^blob:/);
    expect(mock.portraitViews).toBe(1);
    const view = mock.calls.filter((c) => c.path === 'access-control/events/ev-0001/portrait').at(-1)!;
    expect(view.query).toEqual({ station_id: 'entry-a', at: '2026-09-27T09:52:07+00:00' });
    // the drawer shows what the row says
    await expect(drawer(page).locator('[data-ev-field="station"]')).toHaveText('שער ראשי');
    await expect(drawer(page).locator('[data-ev-field="method"]')).toHaveText('כרטיס');
    await expect(drawer(page).locator('[data-ev-field="employee"]')).toHaveText('1001');
    await expect(drawer(page).locator('[data-ev-field="time"]')).toContainText('היום 12:52:07');
    await expect(drawer(page).locator('[data-ev-field="time"]')).toContainText('UTC+03:00');
    await shot(page, info, 'events-drawer-portrait-classic-light');
    // a change notice re-reads the list under an open drawer: the picture is not asked for again
    mock.push();
    await page.waitForTimeout(800);
    expect(mock.portraitViews).toBe(1);
    await closeDrawer(page);
    // opening it again is a new view (and a new audit row on the server)
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-portrait="ready"]')).toBeVisible();
    expect(mock.portraitViews).toBe(2);
  });

  test('a picture that is gone says so, calmly, and is not asked for again', async ({ page }) => {
    const { mock } = await boot(page, { portrait: 'gone' });
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-portrait="gone"]')).toContainText('התמונה אינה זמינה');
    await expect(drawer(page).locator('[data-ev-portrait-retry]')).toHaveCount(0);
    expect(mock.portraitViews).toBe(1);
  });

  test('a failed picture request offers "try again" - one more view, asked for by the person', async ({ page }) => {
    const { mock } = await boot(page, { portrait: 'error' });
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-portrait="error"]')).toContainText('לא ניתן לטעון את התמונה');
    mock.opts.portrait = 'ok';
    await drawer(page).locator('[data-ev-portrait-retry]').click();
    await expect(drawer(page).locator('[data-ev-portrait="ready"]')).toBeVisible();
    expect(mock.portraitViews).toBe(2);
  });

  test('an integration without the picture and evidence reads shows the row alone: nothing is asked, no empty frame', async ({ page }) => {
    const { mock } = await boot(page, { hideFeatures: ['event_portrait', 'event_detail'] });
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-section="event"]')).toBeVisible();
    await expect(drawer(page).locator('[data-ev-section="portrait"]')).toHaveCount(0);
    await expect(drawer(page).locator('[data-ev-field="identity"]')).toHaveCount(0);
    expect(mock.portraitViews).toBe(0);
    expect(mock.detailViews).toBe(0);
  });

  test('a caller the administrator\'s picture setting excludes sees no picture section at all (absent, never greyed)', async ({ page }) => {
    const { mock } = await boot(page, { persona: 'operator', portraitSensitive: true });
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-section="event"]')).toBeVisible();
    await expect(drawer(page).locator('[data-ev-section="portrait"]')).toHaveCount(0);
    expect(mock.portraitViews).toBe(0);
    // the employee number is a names-level field (owner answer 2 of 2026-10-12): the person section carries it
    await expect(drawer(page).locator('[data-ev-field="employee"]')).toHaveText('1001');
  });

  test('an operator has no export and keeps print; an administrator has both; an integration without the export hides it', async ({ page }) => {
    await boot(page, { persona: 'operator' });
    await expect(page.locator(`${SCREEN} [data-wiskey-export]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-wiskey-print]`)).toBeVisible();
  });

  test('an administrator has the export button', async ({ page }) => {
    await boot(page, { persona: 'admin' });
    await expect(page.locator(`${SCREEN} [data-wiskey-export]`)).toBeVisible();
  });

  test('an integration that does not offer the export hides the button', async ({ page }) => {
    await boot(page, { persona: 'admin', hideFeatures: ['events_export'] });
    await expect(page.locator(`${SCREEN} [data-wiskey-export]`)).toHaveCount(0);
  });

  test('a viewer (access.read only) gets the plain "not available" panel and no tab - nothing is asked of the server', async ({ page }) => {
    const v = await boot(page, { persona: 'viewer' }, { hash: '/wiskey/overview', ready: false });
    await expect(page.locator('sw-tabs a[href="#/wiskey/overview"]')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('sw-tabs a[href="#/wiskey/events"]')).toHaveCount(0);
    await page.goto(url('/wiskey/events'));
    const p = panel(page, 'no_permission');
    await expect(p).toBeVisible({ timeout: 30_000 });
    await expect(p).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
    expect(await p.evaluate((el) => el.shadowRoot?.querySelectorAll('p').length ?? 0)).toBe(0); // no second sentence
    expect(eventCalls(v.mock)).toHaveLength(0);
  });

  test('a station-scoped caller still gets the tab and the rows of their station only', async ({ page }) => {
    await boot(page, { persona: 'scoped' });
    // no installation-wide permission at all, and still the area in the rail (the one tab they may open is the log, held at their station)
    await expect(page.locator('sw-app nav.rail a[href^="#/wiskey/"]')).toHaveCount(1, { timeout: 30_000 });
    const stations = await page.locator(`${SCREEN} [data-wiskey-event-station]`).evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).innerText.split(' · ')[0]))]);
    expect(stations).toEqual(['שער ראשי']);
    // the station chip lists only what the caller sees
    await page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="station"] [data-dropdown-chip]`).click();
    const options = await page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="station"] [role="option"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    expect(options).toEqual(['', 'entry-a']);
  });

  test('the export: a file named for the local date with the server\'s own row count, the filters of the list, and a clear end state', async ({ page }, info) => {
    const { mock } = await boot(page);
    await choose(page, 'result', 'denied');
    await expect.poll(() => lastEvents(mock).result).toBe('denied');
    await page.locator(`${SCREEN} [data-wiskey-export]`).click();
    const dialog = page.locator(`${SCREEN} wiskey-events-export sw-dialog[open]`);
    await expect(dialog.locator('[data-ev-export-body]')).toHaveText('קובץ CSV לפי המסננים הנוכחיים · ללא תמונות');
    await expect(dialog.locator('[data-ev-export-logged]')).toHaveText('הייצוא נרשם ביומן הפעולות.');
    await shot(page, info, 'events-export-dialog-classic-light');
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-ev-export-go]').click()]);
    expect(download.suggestedFilename()).toBe('access-events-2026-09-27.csv');
    const file = fs.readFileSync((await download.path())!, 'utf8');
    expect(file.charCodeAt(0)).toBe(0xfeff); // UTF-8 with a byte-order mark, as the server serves it
    const lines = file.split('\r\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(2);
    expect(mock.exports.at(-1)).toEqual({ result: 'denied' }); // the filters of the list, nothing else
    await expect(dialog.locator('[data-ev-export-result="done"]')).toHaveText(new RegExp(`הקובץ הורד · ${lines.length - 1} שורות`));
    await shot(page, info, 'events-export-done-classic-light');
    await dialog.locator('[data-ev-export-close]').click();
    await expect(page.locator(`${SCREEN} wiskey-events-export sw-dialog[open]`)).toHaveCount(0);
  });

  test('the export of a caller who does not see every station names one station first (the server says so, the dialog asks)', async ({ page }) => {
    const { mock } = await boot(page, { persona: 'scopedAdmin' });
    await page.locator(`${SCREEN} [data-wiskey-export]`).click();
    const dialog = page.locator(`${SCREEN} wiskey-events-export sw-dialog[open]`);
    await dialog.locator('[data-ev-export-go]').click();
    await expect(dialog.locator('[data-ev-export-result="station_required"]')).toContainText('יש לבחור תחנה לייצוא');
    await expect(dialog.locator('[data-ev-export-go]')).toHaveAttribute('disabled', ''); // until a station is chosen
    await dialog.locator('[data-ev-export-station]').selectOption('entry-a');
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-ev-export-go]').click()]);
    expect(download.suggestedFilename()).toMatch(/^access-events-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mock.exports.map((e) => e.station_id)).toEqual([undefined, 'entry-a']);
  });

  test('the export\'s refusals are said in plain words and the dialog can try again', async ({ page }) => {
    const { mock } = await boot(page, { exportMode: 'unavailable' });
    await page.locator(`${SCREEN} [data-wiskey-export]`).click();
    const dialog = page.locator(`${SCREEN} wiskey-events-export sw-dialog[open]`);
    await dialog.locator('[data-ev-export-go]').click();
    await expect(dialog.locator('[data-ev-export-result="unavailable"]')).toContainText('בקרת הכניסה אינה זמינה כרגע');
    mock.opts.exportMode = 'unsupported';
    await dialog.locator('[data-ev-export-go]').click();
    await expect(dialog.locator('[data-ev-export-result="unsupported"]')).toContainText('אינה תומכת בייצוא');
    mock.opts.exportMode = 'ok';
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-ev-export-go]').click()]);
    expect(download.suggestedFilename()).toContain('access-events');
    await expect(dialog.locator('[data-ev-export-result="done"]')).toBeVisible();
  });

  test('print: the loaded rows go to a document of their own in a hidden frame - only what is on the screen, every value escaped', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      // a headless run has nobody to answer a print dialog: the frame's own print() is counted instead of opened
      const w = window as unknown as { __printed?: number };
      const original = HTMLIFrameElement.prototype.addEventListener;
      HTMLIFrameElement.prototype.addEventListener = function (this: HTMLIFrameElement, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        if (type === 'load' && this.hasAttribute('data-sw-print')) {
          return original.call(
            this,
            'load',
            (e: Event) => {
              const frame = this.contentWindow as (Window & { print: () => void }) | null;
              if (frame) frame.print = () => void (w.__printed = (w.__printed ?? 0) + 1);
              (typeof listener === 'function' ? listener : listener.handleEvent.bind(listener))(e);
            },
            options,
          );
        }
        return original.call(this, type, listener, options);
      } as typeof original;
    });
    await page.locator(`${SCREEN} [data-wiskey-print]`).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: number }).__printed ?? 0)).toBe(1);
    const html = await page.evaluate(() => document.querySelector<HTMLIFrameElement>('iframe[data-sw-print]')?.srcdoc ?? '');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<h1>פעילות</h1>');
    expect(html).toContain('דנה כהן');
    expect((html.match(/<tr>/g) ?? []).length).toBe(101); // the header row and the 100 rows shown
    expect(html).not.toMatch(/WisKey/);
    await expect(page.locator('iframe[data-sw-print]')).toHaveCount(0, { timeout: 5_000 }); // the frame removes itself
  });

  test('a change notice re-reads page 1 while it is the only page; with more pages the reader keeps their place and is told', async ({ page }) => {
    const { mock } = await boot(page);
    const n0 = eventCalls(mock).length;
    mock.push();
    await expect.poll(() => eventCalls(mock).length).toBeGreaterThan(n0);
    // two pages shown: a notice does not throw the second page away
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    await expect(rows(page)).toHaveCount(130, { timeout: 15_000 });
    const n1 = eventCalls(mock).length;
    mock.push();
    const pending = page.locator(`${SCREEN} [data-wiskey-events-pending]`);
    await expect(pending).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(eventCalls(mock).length).toBe(n1);
    await expect(rows(page)).toHaveCount(130);
    await pending.locator('sw-button').click();
    await expect(rows(page)).toHaveCount(100, { timeout: 10_000 });
    await expect(pending).toHaveCount(0);
  });

  test('an expired cursor is reported, what was shown stays, and a reload starts from the first page', async ({ page }) => {
    const { mock } = await boot(page, { cursor: 'expired' });
    await page.locator(`${SCREEN} [data-wiskey-events-more]`).click();
    const expired = page.locator(`${SCREEN} [data-wiskey-events-cursor-expired]`);
    await expect(expired).toBeVisible({ timeout: 10_000 });
    await expect(rows(page)).toHaveCount(100);
    mock.opts.cursor = 'ok';
    await expired.locator('sw-button').click();
    await expect(expired).toHaveCount(0, { timeout: 10_000 });
    await expect(rows(page)).toHaveCount(100);
  });

  test('the table view: the same rows, the time cell opens the drawer, the choice is kept', async ({ page }) => {
    await boot(page);
    await page.locator(`${SCREEN} [data-wiskey-view="table"]`).click();
    const table = page.locator(`${SCREEN} sw-table[data-wiskey-events-table]`);
    await expect(table.locator('tbody tr')).toHaveCount(100);
    await expect(table.locator('tbody tr').first().locator('[data-wiskey-event-person]')).toContainText('דנה כהן');
    await table.locator('tbody tr[data-row-id="ev-0002"] button[data-wiskey-event]').click();
    await expect(drawer(page).locator('[data-ev-section="event"]')).toBeVisible();
    await closeDrawer(page);
    await page.reload();
    await expect(page.locator(`${SCREEN} sw-table[data-wiskey-events-table] tbody tr`).first()).toBeVisible({ timeout: 30_000 });
  });

  test('an address can carry filters (the station screen\'s deep link): they are applied from the first request', async ({ page }) => {
    const { mock } = await boot(page, {}, { hash: '/wiskey/events?station=entry-b&result=denied&range=today' });
    expect(eventCalls(mock)[0].query).toEqual({ station_id: 'entry-b', result: 'denied', start: '2026-09-26T21:00:00.000Z', limit: '100' });
    await expect(page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="station"]`)).toContainText('לובי');
    await expect(page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter="result"]`)).toContainText('נדחה');
  });
});

test.describe('the entry log: states', () => {
  test.beforeEach(() => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('loading: the skeleton while the first answer is on its way', async ({ page }, info) => {
    // held until released: the picture is taken while the answer is genuinely still out (a timed delay raced the screenshot's settle)
    const { mock } = await boot(page, { events: 'hold' }, { ready: false });
    await expect(page.locator(`${SCREEN} [data-wiskey-events-loading]`)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await shot(page, info, 'events-loading-classic-light');
    await expect(page.locator(`${SCREEN} [data-wiskey-events-loading]`)).toBeVisible();
    mock.release();
    await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-wiskey-events-loading]`)).toHaveCount(0);
  });

  test('empty: nothing to show says so in one line', async ({ page }, info) => {
    await boot(page, { events: 'empty' }, { ready: false });
    await expect(page.locator(`${SCREEN} sw-state-panel[data-wiskey-events-empty]`)).toHaveAttribute('heading', 'אין פעילות להצגה', { timeout: 30_000 });
    await shot(page, info, 'events-empty-classic-light');
  });

  test('error: the request did not complete - the reason, and a retry that works', async ({ page }, info) => {
    const { mock } = await boot(page, { events: 'error' }, { ready: false });
    const err = panel(page, 'load_error');
    await expect(err).toHaveAttribute('heading', 'לא ניתן לטעון את הפעילות', { timeout: 30_000 });
    await shot(page, info, 'events-error-classic-light');
    mock.opts.events = 'ready';
    await err.locator('sw-button').click();
    await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
  });

  test('busy: the integration is rate limited - said calmly, retried by the person', async ({ page }) => {
    await boot(page, { events: 'rate' }, { ready: false });
    await expect(panel(page, 'error')).toHaveAttribute('heading', 'בקרת הכניסה עמוסה כרגע', { timeout: 30_000 });
  });

  test('not installed: an administrator is pointed to Settings', async ({ page }) => {
    await boot(page, { events: 'not_installed', persona: 'admin' }, { ready: false });
    const p = panel(page, 'not_installed');
    await expect(p).toHaveAttribute('heading', 'בקרת הכניסה אינה מותקנת', { timeout: 30_000 });
    await expect(p).toHaveAttribute('actionlabel', 'להגדרות בקרת כניסה');
  });

  test('not installed: an operator is not (nothing to do for them)', async ({ page }) => {
    await boot(page, { events: 'not_installed', persona: 'operator' }, { ready: false });
    const p = panel(page, 'not_installed');
    await expect(p).toBeVisible({ timeout: 30_000 });
    expect(await p.getAttribute('actionlabel')).toBe('');
  });

  test('not connected in this environment, and a version that does not support the log', async ({ page }) => {
    await boot(page, { events: 'not_configured' }, { ready: false });
    await expect(panel(page, 'ha_not_configured')).toHaveAttribute('heading', 'בקרת הכניסה אינה מחוברת בסביבה הזו', { timeout: 30_000 });
  });

  test('an unsupported version of the integration', async ({ page }) => {
    await boot(page, { events: 'unsupported' }, { ready: false });
    await expect(panel(page, 'unsupported')).toHaveAttribute('heading', 'הגרסה המותקנת אינה תומכת ביומן הפעילות', { timeout: 30_000 });
  });

  test('forbidden: a caller without the permission sees the plain panel', async ({ page }, info) => {
    await boot(page, { persona: 'viewer' }, { ready: false });
    await expect(panel(page, 'no_permission')).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'events-forbidden-classic-light');
  });

  test('a filter with no match says so and offers the way back', async ({ page }) => {
    await boot(page);
    await page.locator('[data-wiskey-search]').fill('nobody-here');
    const empty = page.locator(`${SCREEN} sw-state-panel[data-wiskey-events-empty]`);
    await expect(empty).toHaveAttribute('heading', 'אין פעילות בטווח הזה', { timeout: 10_000 });
    await empty.locator('sw-button').click();
    await expect(rows(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test('stale: the feed drops after rows were shown - they stay, marked as not current, with when they were read', async ({ page }, info) => {
    const { mock } = await boot(page);
    mock.opts.events = 'unavailable';
    await page.locator(`${SCREEN} [data-wiskey-events-refresh]`).click();
    const stale = page.locator(`${SCREEN} [data-wiskey-stale]`);
    await expect(stale).toBeVisible({ timeout: 10_000 });
    await expect(stale).toContainText('הנתונים אינם עדכניים · עודכן 13:29');
    await expect(rows(page)).toHaveCount(100);
    await shot(page, info, 'events-stale-classic-light');
    mock.opts.events = 'ready';
    await stale.locator('sw-button').click();
    await expect(stale).toHaveCount(0, { timeout: 10_000 });
  });

  test('every screen of the matrix at this width: list, drawer, table (where the width has one), no page error, no sideways scroll', async ({ page }, info) => {
    const { errors } = await boot(page);
    await shot(page, info, 'events-list-classic-light');
    await row(page, 'ev-0001').click();
    await expect(drawer(page).locator('[data-ev-portrait="ready"]')).toBeVisible();
    await shot(page, info, 'events-drawer-classic-light');
    await closeDrawer(page);
    if (info.project.name !== 'mobile') {
      await page.locator(`${SCREEN} [data-wiskey-view="table"]`).click();
      await expect(page.locator(`${SCREEN} sw-table[data-wiskey-events-table] tbody tr`).first()).toBeVisible();
      await shot(page, info, 'events-table-classic-light');
    } else {
      await expect(page.locator(`${SCREEN} [data-wiskey-view]`)).toHaveCount(0); // a phone has no table
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over, 'horizontal overflow of the page').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('on a phone the three actions are 44 px icons on the search\'s row, their words kept for assistive technology', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'phone only');
    await boot(page);
    for (const hook of ['export', 'print']) {
      const box = await page.locator(`${SCREEN} [data-wiskey-${hook}]`).evaluate((el) => {
        const r = el.shadowRoot!.querySelector('button')!.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      expect(box.w).toBeGreaterThanOrEqual(44);
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
    const search = await page.locator(`${SCREEN} label.search`).boundingBox();
    const exportBtn = await page.locator(`${SCREEN} [data-wiskey-export]`).boundingBox();
    expect(Math.abs(search!.y - exportBtn!.y)).toBeLessThan(12); // the same row
    // ... and the box a person types in is a real one, not what is left of a shrink-wrapped header (it was 0 px wide once)
    const typing = await page.locator(`${SCREEN} [data-wiskey-search]`).evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(typing).toBeGreaterThanOrEqual(120);
    expect(await page.locator(`${SCREEN} [data-wiskey-export] .lbl`).evaluate((el) => (el as HTMLElement).textContent)).toBe('ייצוא');
  });
});

test.describe('the entry log: the skins', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the skin matrix runs on desktop; the other widths are covered by the states above and the layout guard');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: the list and the drawer`, async ({ page }, info) => {
        const { errors } = await boot(page, {}, { skin, scheme });
        await expect(page.locator(`${SCREEN} sw-dropdown[data-wiskey-filter]`)).toHaveCount(5);
        await shot(page, info, `events-list-${skin}-${scheme}`);
        await row(page, 'ev-0004').click();
        await expect(drawer(page).locator('[data-ev-portrait="ready"]')).toBeVisible();
        await shot(page, info, `events-drawer-${skin}-${scheme}`);
        expect(errors).toEqual([]);
      });
    }
  }
});
