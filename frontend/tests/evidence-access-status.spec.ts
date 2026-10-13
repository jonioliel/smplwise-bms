import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, SKINS, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// CR-036 S10: the Settings page "בקרת כניסה" (#/system/access-control: system status, the intercom's own action log, groups and fields) against
// the mocked backend (tests/access-control-mocks.ts: the wire shapes of the typed reads GET /api/v1/access-control/..., checked against the real
// endpoints by backend/tests/test_access_control_wire.py). The app runs for real - shell, navigation, permissions - only the server and the two
// sockets are mocked; the clock is fixed (Sunday 2026-09-27, 13:30 in Jerusalem). Behaviour first (desktop project), then the page in every state
// at desktop / tablet / phone, then the skins x light / dark. Evidence screenshots go to docs/design/evidence/CR-036-S10/. Needs the Vite dev
// server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-access-status.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-S10');
const PAGE = 'sw-app system-access-control';
const STATUS = `${PAGE} system-access-status`;
const AUDIT = `${PAGE} system-access-audit`;
const GROUPS = `${PAGE} system-access-groups`;
const POLICY = `${PAGE} system-access-policy`;
const HOME = '/system/access-control';

/** The typed reads the page asked, by path (`status/stations`, `stations/entry-c/health`...). */
const reads = (mock: AccessMock) => mock.calls.filter((c) => c.path.startsWith('access-control/'));
const paths = (mock: AccessMock) => reads(mock).map((c) => c.path.slice('access-control/'.length));
const last = (mock: AccessMock, p: string) => reads(mock).filter((c) => c.path === `access-control/${p}`).at(-1)!.query;
const count = (mock: AccessMock, p: string) => reads(mock).filter((c) => c.path === `access-control/${p}`).length;

interface Booted {
  mock: AccessMock;
  errors: string[];
}

/** The app on the Settings page with the mocked backend; `ready` is the selector to wait for (false: do not wait). */
async function boot(page: Page, opts: MockOptions = {}, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; ready?: string | false } = {}): Promise<Booted> {
  const mock = await installAccessMock(page, opts);
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errors.push(m.text());
  });
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? HOME, o.skin ?? 'classic', o.scheme ?? 'light'));
  await page.waitForSelector('sw-app');
  const ready = o.ready === undefined ? `${STATUS} [data-access-status="ready"]` : o.ready;
  if (ready) await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string, full = false) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: full });
}

async function choose(page: Page, scope: string, hook: string, id: string) {
  const dd = page.locator(`${scope} sw-dropdown[${hook}]`);
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`[role="option"][data-id="${id}"]`).click();
}

const stationRow = (page: Page, id: string) => page.locator(`${STATUS} [data-access-station="${id}"]`);
const alertRows = (page: Page) => page.locator(`${STATUS} [data-access-alert]`);
const drawer = (page: Page) => page.locator(`${STATUS} sw-drawer[open] system-access-health`);
const text = (l: Locator) => l.evaluate((el) => (el as HTMLElement).innerText);
const badges = (l: Locator) => l.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('sw-badge')).map((b) => b.getAttribute('label'))));
const cells = (l: Locator) => l.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));

test.describe('the access-control Settings page: behaviour', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the screens run on all three below');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('the status page: the subtitle, the four tiles, the stations, the alerts, the sync counts and the conflicts - and exactly the typed reads', async ({ page }, info) => {
    const { mock, errors } = await boot(page);
    // the subtitle keeps the technical truth: the integration's version, whether it is connected, when it was last asked
    await expect(page.locator(`${PAGE} sw-page`)).toHaveAttribute('subheading', 'WisKey 4.37.0 · מחובר דרך תשתית המערכת · נבדק עכשיו');
    const tile = (k: string) => page.locator(`${STATUS} [data-access-tile="${k}"]`);
    await expect(tile('online')).toContainText('2');
    await expect(tile('online')).toContainText('מתוך 3');
    await expect(tile('pending').locator('.v')).toHaveText('4');
    await expect(tile('conflicts').locator('.v')).toHaveText('2');
    await expect(tile('last-sync')).toContainText('13:25');
    await expect(tile('last-sync')).toContainText('לפני 5 דק׳');

    // the stations: name, model and firmware, sync word, when last seen
    await expect(page.locator(`${STATUS} [data-access-station]`)).toHaveCount(3);
    await expect(stationRow(page, 'entry-a')).toContainText('שער ראשי');
    await expect(stationRow(page, 'entry-a')).toContainText('DS-KD8003 V2.2.62');
    await expect(stationRow(page, 'entry-a').locator('sw-badge')).toHaveAttribute('label', 'מסונכרן');
    await expect(stationRow(page, 'entry-a')).toContainText('עכשיו');
    await expect(stationRow(page, 'entry-b').locator('sw-badge')).toHaveAttribute('label', 'ממתין לסנכרון');
    await expect(stationRow(page, 'entry-c').locator('sw-badge')).toHaveAttribute('label', 'לא מחובר');
    await expect(stationRow(page, 'entry-c')).toContainText('אתמול 22:10');
    await expect(stationRow(page, 'entry-c').locator(':scope > .dot')).toHaveClass(/off/);
    await expect(stationRow(page, 'entry-a').locator(':scope > .dot')).toHaveClass(/ok/);

    // the alerts of the fleet (the muted one waits for its switch)
    await expect(alertRows(page)).toHaveCount(2);
    await expect(alertRows(page).nth(0)).toContainText('חניון: לא מחובר');
    await expect(alertRows(page).nth(0)).toContainText('מאז אתמול 22:10 · 15 שע׳');
    await expect(alertRows(page).nth(0)).toHaveAttribute('data-tone', 'err');
    await expect(alertRows(page).nth(1)).toContainText('לובי: סנכרון תקוע');
    await expect(alertRows(page).nth(1)).toHaveAttribute('data-tone', 'warn');
    await expect(page.locator(`${STATUS} [data-access-card="alerts"] .sub`)).toHaveText('fleet/alerts · 2');

    // the sync table: counts only, a zero is a dash, the error of an offline station in words
    const sync = page.locator(`${STATUS} sw-table[data-access-sync]`);
    const syncRows = await cells(sync);
    expect(syncRows).toHaveLength(3);
    expect(syncRows[0]).toContain('שער ראשי');
    expect(syncRows[1]).toContain('3'); // pending people at the lobby
    expect(syncRows[2]).toContain('חניון');
    expect(syncRows[2]).toContain('המכשיר לא זמין');
    expect(await badges(sync)).toEqual([['מסונכרן'], ['ממתין לסנכרון'], ['לא מחובר']]);

    // the conflicts (an installation-wide administrator): a named person, an unnamed revocation, each in words
    const conflictTable = page.locator(`${STATUS} sw-table[data-access-conflicts]`);
    const conflicts = await cells(conflictTable);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]).toContain('אלי פרץ');
    expect(conflicts[1]).toContain('ביטול הרשאה');
    expect(conflicts[1]).toContain('לא ידוע');
    expect(conflicts[1]).toContain('התנגשות גרסה');
    expect(await badges(conflictTable)).toEqual([['שגיאת סנכרון'], ['התנגשות']]);

    // exactly the page's reads - no health read before a station is opened, nothing that is not a GET, nothing unhandled
    expect([...new Set(paths(mock))].sort()).toEqual(['status/alerts', 'status/conflicts', 'status/stations', 'status/sync']);
    expect(reads(mock).every((c) => c.method === 'GET')).toBe(true);
    expect(mock.unhandled.filter((u) => u.includes('access-control'))).toEqual([]); // the shell's own settings-area reads (setup, alarm, health summary) are not this page's
    expect(errors).toEqual([]);
    expect(await text(page.locator(PAGE))).not.toMatch(/Home Assistant|Ingress/);
    await shot(page, info, 'status-classic-light', true);
  });

  test('a station opens its health card and its seven days; closing it stops what is in flight', async ({ page }, info) => {
    const { mock } = await boot(page);
    await stationRow(page, 'entry-c').click();
    await expect(drawer(page).locator('[data-health-strip]')).toBeVisible({ timeout: 15_000 });
    expect(count(mock, 'stations/entry-c/health')).toBe(1);
    expect(count(mock, 'stations/entry-c/health/history')).toBe(1);
    const h = drawer(page);
    await expect(h.locator('[data-health-section="connection"]')).toContainText('לא מחובר');
    await expect(h.locator('[data-health-section="connection"]')).toContainText('V2.2.62 build 240901'); // the health card's own firmware text
    await expect(h.locator('[data-health-section="connection"]')).toContainText('1420 · כשלים 3');
    await expect(h.locator('[data-health-section="sync"]')).toContainText('מסונכרן 38 · ממתין לסנכרון 2');
    await expect(h.locator('[data-health-section="sync"]')).toContainText('המכשיר לא זמין 1');
    await expect(h.locator('[data-health-section="events"]')).toContainText('מנותק');
    await expect(h.locator('[data-health-section="events"]')).toContainText('חלקית');
    await expect(h.locator('[data-health-section="clock"]')).toContainText('השעון לא נקרא'); // a clock the station never read
    // seven local days, today last: online all day (green), a day it was never online (red), days with no sample (a dash)
    const days = h.locator('[data-health-day]');
    await expect(days).toHaveCount(7);
    await expect(days.first()).toHaveAttribute('data-health-day', '2026-09-21');
    await expect(days.last()).toHaveAttribute('data-health-day', '2026-09-27');
    await expect(h.locator('[data-health-day="2026-09-21"]')).toHaveClass(/ok/);
    await expect(h.locator('[data-health-day="2026-09-23"]')).toHaveClass(/err/);
    await expect(h.locator('[data-health-day="2026-09-23"]')).toContainText('0%');
    await expect(h.locator('[data-health-day="2026-09-26"]')).toContainText('—');
    await shot(page, info, 'status-drawer-classic-light');
    await page.locator(`${STATUS} sw-drawer[open] [data-drawer-close]`).click();
    await expect(page.locator(`${STATUS} sw-drawer[open]`)).toHaveCount(0);
    // another station: the card of THAT station (a clock that was read, a stream that is connected)
    await stationRow(page, 'entry-a').click();
    await expect(drawer(page).locator('[data-health-section="clock"]')).toContainText('בטווח התקין', { timeout: 15_000 });
    await expect(drawer(page).locator('[data-health-section="events"]')).toContainText('מחובר');
    expect(count(mock, 'stations/entry-a/health')).toBe(1);
    expect(reads(mock).every((c) => c.method === 'GET')).toBe(true);
  });

  test('a station whose health read fails says so in the drawer, calmly, and offers to try again', async ({ page }) => {
    const { mock } = await boot(page);
    mock.opts.status = 'rate';
    await stationRow(page, 'entry-a').click();
    const panel = page.locator(`${STATUS} sw-drawer[open] sw-state-panel[data-access-state="rate"]`);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    mock.opts.status = 'ready';
    await panel.locator('button').first().click();
    await expect(drawer(page).locator('[data-health-section="connection"]')).toBeVisible({ timeout: 15_000 });
  });

  test('the alerts: a kind filter, the muted ones on request (with why and until when), and paging over the offset', async ({ page }) => {
    const { mock } = await boot(page, { alertsPage: 1 });
    await expect(alertRows(page)).toHaveCount(1);
    expect(last(mock, 'status/alerts')).toEqual({ offset: '0', limit: '50' });
    const more = page.locator(`${STATUS} [data-access-alerts-more]`);
    await more.click();
    await expect(alertRows(page)).toHaveCount(2);
    expect(last(mock, 'status/alerts')).toEqual({ offset: '1', limit: '50' }); // the cursor exactly as served
    await expect(more).toHaveCount(0);

    mock.opts.alertsPage = undefined;
    await page.locator(`${STATUS} [data-access-alerts-muted]`).click();
    await expect(alertRows(page)).toHaveCount(3);
    expect(last(mock, 'status/alerts')).toEqual({ include_suppressed: 'true', offset: '0', limit: '50' });
    const muted = page.locator(`${STATUS} [data-access-alert][data-tone="muted"]`);
    await expect(muted).toContainText('שער ראשי: סטיית שעון');
    await expect(muted).toContainText('מושתקת · בבדיקה · עד מחר 09:00');
    await expect(page.locator(`${STATUS} [data-access-alerts-muted]`)).toHaveAttribute('aria-pressed', 'true');

    await choose(page, STATUS, 'data-access-alert-kind', 'sync_stalled');
    await expect(alertRows(page)).toHaveCount(1);
    expect(last(mock, 'status/alerts')).toEqual({ kind: 'sync_stalled', include_suppressed: 'true', offset: '0', limit: '50' });
    await expect(alertRows(page).first()).toContainText('לובי: סנכרון תקוע');
    await choose(page, STATUS, 'data-access-alert-kind', 'event_gap');
    await expect(page.locator(`${STATUS} [data-access-alerts-empty]`)).toBeVisible();
  });

  test('the refresh button reads every card again, and nothing else', async ({ page }) => {
    const { mock } = await boot(page);
    const before = reads(mock).length;
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    await expect.poll(() => reads(mock).length).toBe(before * 2);
    expect(count(mock, 'status/stations')).toBe(2);
    expect(count(mock, 'status/sync')).toBe(2);
    expect(count(mock, 'status/alerts')).toBe(2);
    expect(count(mock, 'status/conflicts')).toBe(2);
  });

  test('stale: a read that stops answering keeps what was shown, says since when, and the next good answer clears it', async ({ page }) => {
    const { mock } = await boot(page);
    mock.opts.status = 'rate';
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    const stale = page.locator(`${STATUS} [data-access-stale="page"]`);
    await expect(stale).toBeVisible({ timeout: 10_000 });
    await expect(stale).toContainText('הנתונים אינם עדכניים · עודכן');
    await expect(page.locator(`${STATUS} [data-access-station]`)).toHaveCount(3); // the rows stay
    mock.opts.status = 'ready';
    await stale.locator('sw-button').click();
    await expect(stale).toHaveCount(0, { timeout: 10_000 });
    // a copy the server itself marks as served from its cache (fresh: false) is shown the same way
    mock.opts.status = 'stale';
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    await expect(page.locator(`${STATUS} [data-access-stale="page"]`)).toBeVisible({ timeout: 10_000 });
  });

  test('the intercom\'s own log: a table of what was done in its window, in words, newest first, with its length and how long it is kept', async ({ page }, info) => {
    const { mock } = await boot(page, {}, { hash: `${HOME}/audit`, ready: `${AUDIT} [data-access-audit-table]` });
    const table = page.locator(`${AUDIT} sw-table[data-access-audit-table]`);
    const rows = await cells(table);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('היום 11:11');
    expect(rows[0]).toContain('מנהל אתר');
    expect(rows[0]).toContain('עדכון אדם');
    expect(rows[0]).toContain('שדות: תוקף');
    expect(rows[0]).toContain('דנה כהן');
    expect(rows[0]).toContain('מס׳ 1001');
    expect(rows[1]).toContain('יצירת אדם');
    expect(rows[1]).toContain('שדות: שם, מספר עובד');
    expect(rows[2]).toContain('עדכון קבוצות ושדות');
    expect(rows[2]).toContain('אתמול 18:20');
    expect(rows[3]).toContain('מחיקת אדם');
    expect(rows[3]).toContain('התנגשות גרסה');
    expect(await badges(table)).toEqual([['בוצע'], ['בוצע'], ['בוצע'], ['נכשל']]);
    expect(rows[3]).toContain('מס׳ 1090'); // a person the server named only by number
    await expect(page.locator(`${AUDIT} [data-access-audit-foot]`)).toHaveText('31 רשומות · היומן נשמר 30 ימים');
    await expect(page.locator(`${PAGE} sw-page`)).toHaveAttribute('subheading', /WisKey 4\.37\.0/);
    await shot(page, info, 'audit-classic-light', true);

    // paging: the cursor exactly as served, the older record appended, then the end
    expect(last(mock, 'status/audit')).toEqual({ limit: '50' });
    await page.locator(`${AUDIT} [data-access-audit-more]`).click();
    await expect(table.locator('tbody tr')).toHaveCount(5);
    expect(last(mock, 'status/audit')).toEqual({ before: '28', limit: '50' });
    await expect(page.locator(`${AUDIT} [data-access-audit-more]`)).toHaveCount(0);
    expect((await cells(table))[4]).toContain('נועה בר');

    // the filters become the server's own, and clear puts the bare page back
    await choose(page, AUDIT, 'data-access-audit-station', 'entry-a');
    await expect.poll(() => last(mock, 'status/audit')).toEqual({ station_id: 'entry-a', limit: '50' });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await choose(page, AUDIT, 'data-access-audit-action', 'users/delete');
    await expect.poll(() => last(mock, 'status/audit')).toEqual({ station_id: 'entry-a', action: 'users/delete', limit: '50' });
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await choose(page, AUDIT, 'data-access-audit-action', 'cards/add');
    await expect(page.locator(`${AUDIT} [data-access-audit-empty]`)).toContainText('אין פעולות שמתאימות למסנן');
    await page.locator(`${AUDIT} [data-access-audit-clear]`).click();
    await expect.poll(() => last(mock, 'status/audit')).toEqual({ limit: '50' });
    await expect(table.locator('tbody tr')).toHaveCount(4);
    expect(reads(mock).every((c) => c.method === 'GET')).toBe(true);
  });

  test('groups and fields: the groups with the stations they open, the profile fields, and the history of that policy with its paging', async ({ page }, info) => {
    const { mock } = await boot(page, {}, { hash: `${HOME}/groups`, ready: `${GROUPS} [data-access-groups]` });
    const groups = page.locator(`${GROUPS} [data-access-group]`);
    await expect(groups).toHaveCount(4);
    await expect(page.locator(`${GROUPS} [data-access-group="staff"]`)).toContainText('עובדים');
    await expect(page.locator(`${GROUPS} [data-access-group="staff"]`)).toContainText('שער ראשי, לובי');
    await expect(page.locator(`${GROUPS} [data-access-group="night"]`)).toContainText('חניון');
    await expect(page.locator(`${GROUPS} [data-access-group="visitors"]`)).toContainText('לא צוין'); // a group the integration did not give a station rule for
    await expect(page.locator(`${GROUPS} [data-access-group="visitors"] sw-badge`)).toHaveAttribute('label', 'כבויה');
    await expect(page.locator(`${GROUPS} [data-access-revision]`)).toContainText('גרסה 7');
    const fields = await cells(page.locator(`${GROUPS} sw-table[data-access-fields]`));
    expect(fields).toHaveLength(2);
    expect(fields[0]).toContain('מחלקה');
    expect(fields[0]).toContain('בחירה');
    expect(fields[0]).toContain('חובה');
    expect(fields[0]).toContain('הנדסה, אבטחה, תפעול');
    expect(fields[1]).toContain('חברה');
    expect(fields[1]).toContain('רשות');
    expect(fields[1]).toContain('תלוי בשדה מחלקה'); // the other field's label, not its code
    const versions = page.locator(`${GROUPS} sw-table[data-access-versions]`);
    const vrows = await cells(versions);
    expect(vrows).toHaveLength(3);
    expect(vrows[0]).toContain('7');
    expect(vrows[0]).toContain('עדכון קבוצות ושדות');
    expect(await badges(versions)).toEqual([['נוכחית'], [], []]); // only the current revision is marked
    expect(vrows[1]).toContain('מדיניות קבוצות');
    expect(vrows[2]).toContain('בסיס');
    await expect(page.locator(`${GROUPS} [data-access-versions-retained]`)).toContainText('נשמרות גרסאות מגרסה 1');
    await shot(page, info, 'groups-classic-light', true);
    await page.locator(`${GROUPS} [data-access-versions-more]`).click();
    await expect(versions.locator('tbody tr')).toHaveCount(5);
    expect(last(mock, 'groups/versions')).toEqual({ offset: '3', limit: '20' });
    await expect(page.locator(`${GROUPS} [data-access-versions-more]`)).toHaveCount(0);
    expect([...new Set(paths(mock))].sort()).toEqual(['groups', 'groups/versions', 'status/stations']);
    expect(reads(mock).every((c) => c.method === 'GET')).toBe(true);
  });

  test('policy: the four administrator settings at their defaults; a switch saves at once, and a failed save puts it back and says so', async ({ page }, info) => {
    const { mock } = await boot(page, {}, { hash: `${HOME}/policy`, ready: `${POLICY} [data-access-status="ready"]` });
    const sw = (key: string) => page.locator(`${POLICY} [data-access-policy="${key}"]`);
    // the owner's answers as defaults: the picture's views are logged; the picture, the employee number and the error texts follow the roles
    await expect(sw('access.event_portrait_audit')).toHaveAttribute('aria-checked', 'true');
    await expect(sw('access.event_portrait_sensitive')).toHaveAttribute('aria-checked', 'false');
    await expect(sw('access.employee_no_sensitive')).toHaveAttribute('aria-checked', 'false');
    await expect(sw('access.sync_errors_everyone')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator(`${POLICY} [data-access-policy]`)).toHaveCount(4);
    await expect(sw('access.employee_no_sensitive')).toContainText('מספר עובד כפרט רגיש');
    // every switch is a whole row and a real touch target
    for (const b of await page.locator(`${POLICY} [data-access-policy]`).all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, info, 'policy-classic-light');
    // saved at once, one setting at a time, exactly that key
    await sw('access.employee_no_sensitive').click();
    await expect(sw('access.employee_no_sensitive')).toHaveAttribute('aria-checked', 'true');
    expect(mock.patches).toEqual([{ 'access.employee_no_sensitive': 'true' }]);
    await sw('access.event_portrait_audit').click();
    await expect(sw('access.event_portrait_audit')).toHaveAttribute('aria-checked', 'false');
    expect(mock.patches.at(-1)).toEqual({ 'access.event_portrait_audit': 'false' });
    // a save the server refuses: the switch goes back and the page says so
    mock.opts.settingsPatch = 'fail';
    await sw('access.sync_errors_everyone').click();
    await expect(page.locator(`${POLICY} [data-access-policy-error]`)).toContainText('השמירה נכשלה');
    await expect(sw('access.sync_errors_everyone')).toHaveAttribute('aria-checked', 'false');
    expect(mock.patches).toHaveLength(2);
    // reading the page again shows what the server holds
    mock.opts.settingsPatch = 'ok';
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    await expect(sw('access.employee_no_sensitive')).toHaveAttribute('aria-checked', 'true');
    await expect(sw('access.event_portrait_audit')).toHaveAttribute('aria-checked', 'false');
    // nothing but the settings is written, and nothing is asked of the integration
    expect(paths(mock)).toEqual([]);
  });

  test('only a system administrator has the policy segment: a site manager neither sees it nor, at a typed address, gets it', async ({ page }) => {
    const { mock } = await boot(page, { persona: 'siteAdmin' }, { hash: `${HOME}/policy`, ready: `${PAGE} [data-access-segment]` });
    await expect(page.locator(`${PAGE} [data-access-segment="status"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/policy"]`)).toHaveCount(0);
    expect(mock.patches).toEqual([]);
  });

  test('who gets which segments: a system administrator all five, a site manager of every station the first three, a station-scoped one the status and the groups only', async ({ page }) => {
    for (const [persona, segments] of [['admin', 5], ['siteAdmin', 3]] as const) {
      await installAccessMock(page, { persona });
      await page.clock.setFixedTime(NOW);
      await page.goto('about:blank');
      await page.goto(url(HOME));
      await expect(page.locator(`${STATUS} [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a`)).toHaveCount(segments);
      await expect(page.locator('sw-app sw-tabs:not([data-access-segments]) a[href="#/system/access-control"]')).toHaveCount(1);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
    const { mock } = await boot(page, { persona: 'scopedAdmin' });
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a`)).toHaveCount(2);
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/audit"]`)).toHaveCount(0);
    await expect(page.locator('sw-app sw-tabs:not([data-access-segments]) a[href="#/system/access-control"]')).toHaveCount(1);
    // the installation-wide views are never asked of them (the server would audit a refusal), and the counts are over their stations only
    expect(paths(mock)).not.toContain('status/conflicts');
    await expect(page.locator(`${STATUS} [data-access-tile="conflicts"]`)).toHaveCount(0);
    await expect(page.locator(`${STATUS} [data-access-conflicts-empty], ${STATUS} [data-access-card="conflicts"]`)).toHaveCount(0);
    await expect(page.locator(`${STATUS} [data-access-station]`)).toHaveCount(1);
    await expect(page.locator(`${STATUS} [data-access-tile="online"]`)).toContainText('מתוך 1');
    await expect(page.locator(`${STATUS} [data-access-tile="pending"] .v`)).toHaveText('0');
    // a typed address of the log is not offered a view they cannot have: the status opens
    await page.goto(url(`${HOME}/audit`));
    await expect(page.locator(`${PAGE} [data-access-segment="status"]`)).toBeVisible({ timeout: 30_000 });
    expect(paths(mock)).not.toContain('status/audit');
    // their groups: only the groups whose every station they see
    await page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/groups"]`).click();
    await expect(page.locator(`${GROUPS} [data-access-card="groups"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${GROUPS} [data-access-group]`)).toHaveCount(0);
    await expect(page.locator(`${GROUPS} [data-access-card="versions"]`)).toHaveCount(0);
    expect(paths(mock)).not.toContain('groups/versions');
  });

  test('a caller without access.admin.read gets the plain panel and nothing is asked of the server', async ({ page }) => {
    for (const persona of ['viewer', 'operator', 'nobody'] as const) {
      const { mock } = await boot(page, { persona }, { ready: false });
      const panel = page.locator(`${PAGE} sw-state-panel[data-access-state="no_permission"]`);
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(panel).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
      expect(await panel.evaluate((el) => el.shadowRoot?.querySelectorAll('p').length ?? 0)).toBe(0); // no second sentence
      expect(paths(mock).filter((p) => p.startsWith('status/') || p.startsWith('groups'))).toEqual([]);
      await expect(page.locator('sw-app sw-tabs:not([data-access-segments]) a[href="#/system/access-control"]')).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
});

test.describe('the access-control Settings page: states', () => {
  test.beforeEach(() => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('loading: skeletons while the first answers are on their way', async ({ page }, info) => {
    const { mock } = await boot(page, { status: 'hold' }, { ready: false });
    await expect(page.locator(`${STATUS} [data-access-status="loading"]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${STATUS} [data-access-station]`)).toHaveCount(0);
    await shot(page, info, 'status-loading-classic-light');
    mock.release();
    await expect(page.locator(`${STATUS} [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
  });

  test('empty: no stations says so in one line, and the tiles do not invent a number', async ({ page }, info) => {
    await boot(page, { status: 'empty' });
    await expect(page.locator(`${STATUS} [data-access-card="health"] .empty`)).toBeVisible();
    await expect(page.locator(`${STATUS} [data-access-tile="online"] .v`)).toHaveText('0');
    await expect(page.locator(`${STATUS} [data-access-alerts-empty]`)).toBeVisible();
    await shot(page, info, 'status-empty-classic-light');
  });

  test('the integration is busy: said calmly, with a retry that works', async ({ page }, info) => {
    const { mock } = await boot(page, { status: 'rate' }, { ready: `${STATUS} [data-access-status="rate"]` });
    const panel = page.locator(`${STATUS} sw-state-panel[data-access-state="rate"]`);
    await expect(panel).toHaveAttribute('heading', 'האינטרקום עסוק כרגע');
    await shot(page, info, 'status-busy-classic-light');
    mock.opts.status = 'ready';
    await panel.locator('button').first().click();
    await expect(page.locator(`${STATUS} [data-access-status="ready"]`)).toBeVisible({ timeout: 15_000 });
  });

  test('not connected in this environment, and a version that does not offer the status', async ({ page }, info) => {
    await boot(page, { status: 'not_configured' }, { ready: `${STATUS} [data-access-status="not_configured"]` });
    await expect(page.locator(`${STATUS} sw-state-panel`)).toHaveAttribute('heading', 'בקרת הכניסה אינה מחוברת בסביבה הזו');
    await shot(page, info, 'status-not-connected-classic-light');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { status: 'unsupported' }, { ready: `${STATUS} [data-access-status="unsupported"]` });
    await expect(page.locator(`${STATUS} sw-state-panel`)).toHaveAttribute('heading', 'הגרסה המותקנת אינה מספקת מידע זה');
  });

  test('forbidden: a caller without the permission sees the plain panel', async ({ page }, info) => {
    await boot(page, { persona: 'viewer' }, { ready: false });
    await expect(page.locator(`${PAGE} sw-state-panel[data-access-state="no_permission"]`)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'status-forbidden-classic-light');
  });

  test('every screen of the matrix at this width: status, a station\'s card, the log, the groups - no page error, no sideways scroll, targets of 44 px', async ({ page }, info) => {
    const { errors } = await boot(page);
    await shot(page, info, 'status-classic-light', true);
    await page.locator(`${STATUS} [data-access-card="conflicts"]`).scrollIntoViewIfNeeded();
    await shot(page, info, 'status-lower-classic-light');
    await page.locator(`${PAGE} [data-access-refresh]`).scrollIntoViewIfNeeded();
    await stationRow(page, 'entry-b').click();
    await expect(drawer(page).locator('[data-health-strip]')).toBeVisible({ timeout: 15_000 });
    await shot(page, info, 'status-drawer-classic-light');
    await page.locator(`${STATUS} sw-drawer[open] [data-drawer-close]`).click();
    await expect(page.locator(`${STATUS} sw-drawer[open]`)).toHaveCount(0);
    await page.goto(url(`${HOME}/audit`));
    await expect(page.locator(`${AUDIT} [data-access-audit-table]`)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'audit-classic-light', true);
    await page.goto(url(`${HOME}/groups`));
    await expect(page.locator(`${GROUPS} [data-access-groups]`)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'groups-classic-light', true);
    await page.goto(url(`${HOME}/policy`));
    await expect(page.locator(`${POLICY} [data-access-policy]`).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'policy-classic-light');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over, 'horizontal overflow of the page').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    // the actions of the page are real touch targets
    const box = await page.locator(`${PAGE} [data-access-refresh]`).evaluate((el) => {
      const r = el.shadowRoot!.querySelector('button')!.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box.h).toBeGreaterThanOrEqual(44);
  });

  test('on a phone a station row is two lines - the name and the chevron, then the sync word and when it was last seen - nothing clipped', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'phone only');
    await boot(page);
    const row = stationRow(page, 'entry-a');
    const geo = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const q = (s: string) => el.querySelector(s)!.getBoundingClientRect();
      const side = q('.side');
      const when = q('.when');
      return { row: { l: r.left, r: r.right }, side: { l: side.left, r: side.right, t: side.top }, main: { b: q('.main').bottom }, when: { l: when.left, r: when.right }, chev: { t: q('.chev').top } };
    });
    expect(geo.side.t).toBeGreaterThan(geo.main.b - 2); // the second line is below the name
    expect(geo.when.l).toBeGreaterThanOrEqual(geo.row.l - 1); // "now" is whole, not cut at the edge
    expect(geo.when.r).toBeLessThanOrEqual(geo.row.r + 1);
  });
});

test.describe('the access-control Settings page: the skins', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the skin matrix runs on desktop; the other widths are covered by the states above and the layout guard');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: the status page and a station's card`, async ({ page }, info) => {
        const { errors } = await boot(page, {}, { skin, scheme });
        await expect(page.locator(`${STATUS} [data-access-tile]`)).toHaveCount(4);
        await shot(page, info, `status-${skin}-${scheme}`);
        await stationRow(page, 'entry-a').click();
        await expect(drawer(page).locator('[data-health-strip]')).toBeVisible({ timeout: 15_000 });
        await shot(page, info, `status-drawer-${skin}-${scheme}`);
        expect(errors).toEqual([]);
      });
    }
  }
});
