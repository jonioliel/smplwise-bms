import { test, expect, type Locator, type Page } from '@playwright/test';
import { installAccessMock, NOW, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { installWiskeyStatusMock, type WkMock, type WkMode } from './wiskey-system-status-mock';

// WISKEY-STATUS-UI-2520 (row R2 of docs/changes/WISKEY-RESYNC-2520.md): the segment "מערכת האינטרקום" of the Settings page "בקרת כניסה"
// (#/system/access-control/wiskey) against the mocked backend - WisKey's system/status_v1 and jobs/status_v1 as row R1's two GET routes
// answer them. Behaviour on the desktop project; the pictures are tests/pixel-access-wiskey-status-2520.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-access-wiskey-status-2520.spec.ts --project=desktop --workers=1
const PAGE = 'sw-app system-access-control';
const WK = `${PAGE} system-access-wiskey`;
const HOME = '/system/access-control/wiskey';

interface Booted {
  access: AccessMock;
  wk: WkMock;
  errors: string[];
}

async function boot(page: Page, modes: { system?: WkMode; jobs?: WkMode } = {}, opts: MockOptions = {}, hash = HOME, ready: string | false = `${WK} [data-wk-status]:not([data-wk-status="loading"])`): Promise<Booted> {
  const access = await installAccessMock(page, opts);
  const wk = await installWiskeyStatusMock(page, modes);
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('sw-app');
  if (ready) await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  return { access, wk, errors };
}

const text = (l: Locator) => l.evaluate((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
const cells = (l: Locator) => l.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
// the visible badges only: a table with phone card marks also draws the phone's meta line, hidden on the desktop
const badges = (l: Locator) =>
  l.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('sw-badge')).filter((b) => (b as HTMLElement).checkVisibility()).map((b) => b.getAttribute('label'))));
/** The reads of the access mock that are not the shell's own (the segment may read the stations' names only). */
const accessReads = (m: AccessMock) => m.calls.filter((c) => c.path.startsWith('access-control/')).map((c) => c.path.slice('access-control/'.length));

test.describe('the segment "מערכת האינטרקום": behaviour', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the pictures are the pixel spec');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('a system administrator has the segment; the reads are the two WisKey reads (+ the stations\' names), each once, GET only', async ({ page }) => {
    const { access, wk, errors } = await boot(page);
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/wiskey"]`)).toHaveCount(1);
    await expect(page.locator(`${PAGE} [data-access-segment="wiskey"]`)).toBeVisible();
    await expect(page.locator(`${WK} [data-wk-card="jobs"] sw-table[data-wk-jobs]`)).toBeVisible({ timeout: 20_000 });
    expect(wk.calls).toEqual([
      { read: 'system', method: 'GET' },
      { read: 'jobs', method: 'GET' },
    ]);
    expect(accessReads(access)).toEqual(['status/stations']);
    expect(access.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ready: the integration, every station as WisKey keeps it, the job families (a missing one said as missing), writes never "open"', async ({ page }) => {
    await boot(page);
    await expect(page.locator(`${WK} [data-wk-status="ready"]`)).toBeVisible();
    // D1: version, contract, profile
    await expect(page.locator(`${WK} [data-wk-tile="version"]`)).toContainText('2.0.1-rc.19');
    await expect(page.locator(`${WK} [data-wk-tile="version"]`)).toContainText('חוזה API 1');
    await expect(page.locator(`${WK} [data-wk-tile="profile"] .v`)).toHaveText('משתמשים קיימים');
    // one station connected of three; the one whose connection WisKey did not state is counted as unknown, never as connected
    await expect(page.locator(`${WK} [data-wk-tile="stations"] .v`)).toHaveText('1');
    await expect(page.locator(`${WK} [data-wk-tile="stations"]`)).toContainText('מתוך 3 · 1 במצב לא ידוע');
    // D3: per command - the page never says writes are open
    await expect(page.locator(`${WK} [data-wk-tile="writes"] .v`)).toHaveText('לכל פקודה');
    // D2: the stations, named from Arx's own station list
    const stations = page.locator(`${WK} sw-table[data-wk-stations]`);
    const rows = await cells(stations);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('שער ראשי');
    expect(rows[0]).toContain('V2.2.62 build 240611');
    expect(rows[0]).toContain('האפקט לא הוכח'); // a synced last result is still not a proof of effect
    expect(rows[1]).toContain('לובי');
    expect(rows[1]).toContain('החשבון נעול');
    expect(rows[1]).toContain('HTTP 401 · ISAPI 4 · userlocked');
    expect(rows[1]).toContain('בקשה ממתינה');
    expect(rows[2]).toContain('חניון');
    expect(rows[2]).toContain('לא נטענה');
    expect(await badges(stations)).toEqual([
      ['מחובר', 'מסונכרן', 'מסונכרן'],
      ['האימות נכשל', 'ממתין לסנכרון'],
      ['לא ידוע', 'לא ידוע'],
    ]);
    // D4: every family a row; two not reported (missing, never 0); a null count is "unknown", a real zero stays 0; no total anywhere
    const fam = page.locator(`${WK} sw-table[data-wk-families]`);
    const famRows = await cells(fam);
    expect(famRows).toHaveLength(4);
    expect(famRows[0]).toContain('אנשים וכרטיסים');
    expect(famRows[1]).toContain('לוחות זמנים');
    expect(famRows[1]).toContain('לא דווח: הרכיב אינו טעון');
    expect(famRows[1]).not.toMatch(/\b0\b/);
    expect(famRows[2]).toContain('תחזוקה');
    expect(famRows[2]).toContain('לא ידוע');
    expect(famRows[3]).toContain('לא דווח: הרכיב אינו טעון');
    await expect(page.locator(`${WK} [data-wk-card="families"]`)).toContainText('אין סכום כולל');
    // D3 / D5: writes, schedules, templates - with WisKey's reasons in words, unknown counts as unknown
    await expect(page.locator(`${WK} [data-wk-line="writes"]`)).toContainText('אין הרשאה כללית: כל פקודה נבדקת בנפרד');
    await expect(page.locator(`${WK} [data-wk-line="legacy-schedules"]`)).toContainText('כבויה');
    await expect(page.locator(`${WK} [data-wk-line="legacy-schedules"]`)).toContainText('כתיבת לוחות זמנים לא אומתה');
    await expect(page.locator(`${WK} [data-wk-line="physical"]`)).toContainText('לא נמדדה');
    await expect(page.locator(`${WK} [data-wk-line="installation"]`)).toContainText('לא זמינה');
    await expect(page.locator(`${WK} [data-wk-line="accounts"]`)).toContainText('לא ידוע');
    await expect(page.locator(`${WK} [data-wk-line="templates"]`)).toContainText('לא ידוע');
    // nothing on the segment says writes are open or enabled
    const all = await text(page.locator(WK));
    expect(all).not.toMatch(/כתיבה פתוחה|פתוחה לכתיבה|writes open/i);
    // B3: the retained jobs, counts WisKey did not give are unknown (not 0)
    const jobs = await cells(page.locator(`${WK} sw-table[data-wk-jobs]`));
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toContain('3f2a9c1e');
    expect(jobs[0]).toContain('נשמרו 38 · נכשלו 2 · ממתינות 0 · מתוך 40');
    expect(jobs[0]).toContain('2 שגיאות');
    expect(jobs[0]).toContain('ממתין לאישור · ניסיון חוזר לשורות שנכשלו');
    expect(jobs[1]).toContain('נשמרו 12 · נכשלו 0 · ממתינות לא ידוע · מתוך לא ידוע');
    await expect(page.locator(`${WK} [data-wk-card="jobs"]`)).toContainText('ההיסטוריה אינה שלמה');
  });

  test('the lab\'s WisKey rc10 does not list either read: "not offered" twice, no retry, and no other read is tried instead', async ({ page }) => {
    const { access, wk } = await boot(page, { system: 'unsupported', jobs: 'unsupported' });
    const sys = page.locator(`${WK} sw-state-panel[data-wk-read="system"]`);
    await expect(sys).toHaveAttribute('data-wk-state', 'unsupported');
    await expect(sys).toHaveAttribute('heading', 'WisKey המותקן אינו מספק מידע זה');
    await expect(sys).toHaveAttribute('hint', 'הקריאה אינה ברשימת הפקודות ש-WisKey מפרסם. לא נשלחה בקשה.');
    await expect(sys).toHaveAttribute('actionLabel', '');
    await expect(page.locator(`${WK} sw-state-panel[data-wk-read="jobs"]`)).toHaveAttribute('data-wk-state', 'unsupported');
    // no data card is drawn from anything else, and nothing but the two reads (and the names) was asked
    await expect(page.locator(`${WK} [data-wk-tiles], ${WK} [data-wk-card="stations"]`)).toHaveCount(0);
    expect(wk.calls.map((c) => c.read)).toEqual(['system', 'jobs']);
    expect(accessReads(access)).toEqual(['status/stations']);
  });

  test('WisKey refuses the jobs read for Arx\'s identity: said as a refusal, the system part still shows, no fallback read', async ({ page }) => {
    const { access, wk } = await boot(page, { system: 'ready', jobs: 'refused' });
    const panel = page.locator(`${WK} sw-state-panel[data-wk-read="jobs"]`);
    await expect(panel).toHaveAttribute('data-wk-state', 'refused');
    await expect(panel).toHaveAttribute('state', 'forbidden');
    await expect(panel).toHaveAttribute('heading', 'WisKey סירב לקריאה');
    await expect(panel).toHaveAttribute('hint', 'את רשימת העבודות WisKey מראה לבעלים שלו בלבד. לא נעשה ניסיון בדרך אחרת. קוד: unauthorized');
    await expect(page.locator(`${WK} [data-wk-tiles]`)).toBeVisible();
    expect(wk.calls.map((c) => c.read)).toEqual(['system', 'jobs']);
    expect(accessReads(access)).toEqual(['status/stations']);
  });

  test('an answer outside WisKey\'s contract is refused whole; busy, unavailable and "job component not loaded" are said as such', async ({ page }) => {
    await boot(page, { system: 'mismatch', jobs: 'jobs_unavailable' });
    await expect(page.locator(`${WK} sw-state-panel[data-wk-read="system"]`)).toHaveAttribute('heading', 'WisKey ענה שלא לפי החוזה');
    await expect(page.locator(`${WK} [data-wk-tiles]`)).toHaveCount(0);
    const jobs = page.locator(`${WK} sw-state-panel[data-wk-read="jobs"]`);
    await expect(jobs).toHaveAttribute('heading', 'רכיב העבודות של WisKey אינו טעון');
    await expect(jobs).toHaveAttribute('hint', /זה לא אומר שאין עבודות/);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { system: 'busy', jobs: 'unavailable' });
    await expect(page.locator(`${WK} sw-state-panel[data-wk-read="system"]`)).toHaveAttribute('data-wk-state', 'busy');
    await expect(page.locator(`${WK} sw-state-panel[data-wk-read="jobs"]`)).toHaveAttribute('hint', 'WisKey לא ענה. לא מוצגים נתונים קודמים.');
  });

  test('ready but empty (WisKey\'s own synthetic example): no station, all four families missing - not four zeros - and no jobs', async ({ page }) => {
    await boot(page, { system: 'empty', jobs: 'empty' });
    await expect(page.locator(`${WK} [data-wk-stations-empty]`)).toBeVisible();
    await expect(page.locator(`${WK} [data-wk-tile="stations"] .v`)).toHaveText('0');
    const fam = await cells(page.locator(`${WK} sw-table[data-wk-families]`));
    expect(fam).toHaveLength(4);
    for (const r of fam) expect(r).toContain('לא דווח: הרכיב אינו טעון');
    await expect(page.locator(`${WK} [data-wk-jobs-empty]`)).toBeVisible();
  });

  test('the page\'s refresh reads WisKey again; a later failure of the answer replaces the shown data (no stale data shown as current)', async ({ page }) => {
    const { wk } = await boot(page);
    await expect(page.locator(`${WK} [data-wk-tiles]`)).toBeVisible();
    wk.system = 'unavailable';
    await page.locator(`${PAGE} [data-access-refresh]`).click();
    await expect(page.locator(`${WK} sw-state-panel[data-wk-read="system"]`)).toHaveAttribute('data-wk-state', 'unavailable');
    await expect(page.locator(`${WK} [data-wk-tiles]`)).toHaveCount(0);
    expect(wk.calls.filter((c) => c.read === 'system')).toHaveLength(2);
  });

  test('a station-scoped administrator has no segment: a typed address opens the status, and WisKey is never asked', async ({ page }) => {
    const { wk } = await boot(page, {}, { persona: 'scopedAdmin' }, HOME, `${PAGE} [data-access-segment="status"]`);
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/wiskey"]`)).toHaveCount(0);
    await expect(page.locator(WK)).toHaveCount(0);
    expect(wk.calls).toEqual([]);
  });

  test('Arx itself refuses the caller (403): the plain "administrators of every station" panel, never WisKey\'s refusal', async ({ page }) => {
    await boot(page, { system: 'http403', jobs: 'http403' });
    const panel = page.locator(`${WK} sw-state-panel[data-access-state="forbidden"]`).first();
    await expect(panel).toHaveAttribute('heading', 'התצוגה הזו זמינה למנהלים של כל התחנות בלבד');
    await expect(page.locator(`${WK} [data-wk-state="refused"]`)).toHaveCount(0);
  });
});
