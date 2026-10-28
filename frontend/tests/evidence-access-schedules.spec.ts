import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, SKINS, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// CR-036 S9: the native, READ-ONLY schedules screen ("לוחות זמנים", #/wiskey/schedules) against the mocked backend
// (tests/access-control-mocks.ts: the wire shapes of the typed reads GET /api/v1/access-control/..., checked against the real endpoints by
// backend/tests/test_access_control_wire.py). The app runs for real - shell, navigation, permissions - only the server and the sockets are
// mocked; the clock is fixed. Behaviour first (desktop project), then the screen in its states at desktop / tablet / phone, then the skins x
// light / dark. Evidence screenshots go to docs/design/evidence/CR-036-S9/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-access-schedules.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-S9');
const SCREEN = 'sw-app wiskey-schedules';
const HOME = '/wiskey/schedules';
const ON = { 'access.ui.schedules': 'smplwise' };

const reads = (mock: AccessMock) => mock.calls.filter((c) => c.path.startsWith('access-control/')).map((c) => c.path.slice('access-control/'.length));
const count = (mock: AccessMock, p: string) => reads(mock).filter((x) => x === p).length;

interface Booted {
  mock: AccessMock;
  errors: string[];
}

async function boot(page: Page, opts: MockOptions = {}, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; ready?: string | false } = {}): Promise<Booted> {
  const mock = await installAccessMock(page, { ...opts, settings: { ...ON, ...(opts.settings ?? {}) } });
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errors.push(m.text());
  });
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? HOME, o.skin ?? 'classic', o.scheme ?? 'light'));
  await page.waitForSelector('sw-app');
  const ready = o.ready === undefined ? `${SCREEN} [data-sch-program]` : o.ready;
  if (ready) await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string, full = false) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: full });
}

const tabRow = (page: Page) => page.locator('sw-app sw-tabs').first();
const doorTitle = (page: Page) => page.locator(`${SCREEN} [data-sch-door-title]`);
const programState = (page: Page) => page.locator(`${SCREEN} sw-badge[data-sch-program-state]`);
/** The texts of the matched elements without the left-to-right isolates around times and dates. */
const texts = (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()));
const pickDoor = (page: Page, key: string) => page.locator(`${SCREEN} [data-sch-door-list="side"] button[data-sch-door="${key}"]`).click();

test.describe('the schedules screen: behaviour', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the screens run on all three below');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('the switch is OFF by default: no tab in the row and the native screen is never shown', async ({ page }) => {
    const mock = await installAccessMock(page, {});
    await page.clock.setFixedTime(NOW);
    await page.goto(url('/wiskey/overview'));
    await page.waitForSelector('sw-app');
    await expect(tabRow(page)).toContainText('מרכז הכניסה', { timeout: 30_000 });
    await expect(tabRow(page)).not.toContainText('לוחות זמנים');
    await page.goto(url(HOME));
    await page.waitForTimeout(500);
    await expect(page.locator(SCREEN)).toHaveCount(0);
    expect(reads(mock).filter((p) => p.startsWith('schedules') || p.endsWith('/programs'))).toEqual([]);
  });

  test('switched to Arx: the tab, the first door with its program, the week grid, the code presence, the library and the proposals - and exactly the typed reads', async ({ page }) => {
    const { mock, errors } = await boot(page);
    await expect(tabRow(page)).toContainText('לוחות זמנים');
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('subheading', '4 דלתות · 2 לוחות זמנים בספרייה');
    await expect(doorTitle(page)).toHaveText('שער · שער ראשי');
    await expect(programState(page)).toHaveAttribute('label', 'פעיל');
    await expect(page.locator(`${SCREEN} [data-sch-program-name]`)).toHaveText('בוקר ובצהריים');
    await expect(page.locator(`${SCREEN} [data-sch-execution]`)).toHaveText('מוחזק פתוח · התחנה אישרה קבלה');
    // Sunday..Thursday 07-09 (2 cells) and 12-13 (1 cell), Friday 08-12 (4 cells): 19 hourly cells held open
    await expect(page.locator(`${SCREEN} sw-week-grid .c.on`)).toHaveCount(19);
    await expect.poll(() => texts(page, `${SCREEN} [data-sch-lines] li`)).toEqual(['א׳–ה׳ 07:00–09:00, 12:00–13:00', 'ו׳ 08:00–12:00']);
    await expect.poll(() => texts(page, `${SCREEN} [data-sch-dates] li`)).toEqual(['ערב חג · 06.10 · 08:00–11:00']);
    // times and dates are left-to-right isolates inside the Hebrew line (else "07:00–09:00" shows as "09:00–07:00")
    expect(await page.locator(`${SCREEN} [data-sch-lines] li`).first().evaluate((e) => e.textContent ?? '')).toContain('⁦07:00–09:00');
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveAttribute('data-sch-code', 'set');
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveAttribute('label', 'קוד ציבורי: מוגדר');
    // the library and the proposals (installation-wide reads): honest words - nothing is "applied"
    await expect(page.locator(`${SCREEN} [data-sch-lib-row]`)).toHaveCount(2);
    await expect(page.locator(`${SCREEN} [data-sch-lib-row="sch-office"]`)).toContainText('הוצע ל־שער ראשי, לובי');
    await expect(page.locator(`${SCREEN} [data-sch-plan-row]`)).toHaveCount(3);
    await expect(page.locator(`${SCREEN} [data-sch-plan-row="plan-a"] sw-badge`)).toHaveAttribute('label', 'חסום');
    await expect(page.locator(`${SCREEN} [data-sch-plan-row="plan-a"]`)).toContainText('לא הוחל על התחנה');
    await expect(page.locator(`${SCREEN} [data-sch-plan-row="plan-b"]`)).toContainText('הוכן מגרסה קודמת');
    // only the door shown is read; never a write, never a station the view does not need
    expect(reads(mock).sort()).toEqual(['features', 'schedules', 'schedules/operations', 'schedules/plans', 'stations', 'stations/entry-a/codes', 'stations/entry-a/programs'].sort());
    expect(mock.calls.filter((c) => c.method !== 'GET' && c.path.startsWith('access-control/'))).toEqual([]);
    expect(mock.unhandled.filter((u) => u.includes('access-control/'))).toEqual([]); // the shell's own reads are not this mock's
    expect(errors).toEqual([]);
    // RTL, Hebrew
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  });

  test('another door: paused, an older saved draft, an error at an offline station - and the address keeps the door', async ({ page }) => {
    const { mock } = await boot(page);
    await pickDoor(page, 'entry-b:1');
    await expect(doorTitle(page)).toHaveText('כניסה · לובי');
    await expect(programState(page)).toHaveAttribute('label', 'מושהה');
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveAttribute('data-sch-code', 'unset');
    expect(page.url()).toContain('door=entry-b%3A1');
    await pickDoor(page, 'entry-b:2');
    await expect(programState(page)).toHaveAttribute('label', 'טיוטה שמורה');
    await expect(page.locator(`${SCREEN} [data-sch-execution]`)).toHaveCount(0);
    expect(count(mock, 'stations/entry-b/programs')).toBe(1); // the same station is not read again within its 30 s
    await pickDoor(page, 'entry-c:1');
    await expect(programState(page)).toHaveAttribute('label', 'שגיאה');
    await expect(page.locator(`${SCREEN} [data-sch-offline]`)).toHaveText('לא מחוברת');
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveAttribute('data-sch-code', 'unknown');
    await expect(page.locator(`${SCREEN} [data-sch-execution]`)).toHaveText('לא ידוע אם בוצע');
  });

  test('a link to a door opens it; a door the caller does not have falls back to the first one', async ({ page }) => {
    await boot(page, {}, { hash: `${HOME}?door=entry-b:2` });
    await expect(doorTitle(page)).toHaveText('מחסום · לובי');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, {}, { hash: `${HOME}?door=elsewhere:1` });
    await expect(doorTitle(page)).toHaveText('שער · שער ראשי');
  });

  test('the table across doors reads every station once; a row opens that door', async ({ page }) => {
    const { mock } = await boot(page);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
    await expect(page.locator(`${SCREEN} sw-table[data-sch-table] tbody tr`)).toHaveCount(4);
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-c:1"]`)).toContainText('שגיאה', { timeout: 15_000 });
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-b:2"]`)).toContainText('טיוטה');
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-a:1"]`)).toContainText('מוגדר');
    for (const id of ['entry-a', 'entry-b', 'entry-c']) expect(count(mock, `stations/${id}/programs`)).toBe(1);
    await page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-b:1"]`).click();
    await expect(page.locator(`${SCREEN} [data-sch-view="door"]`)).toBeVisible();
    await expect(doorTitle(page)).toHaveText('כניסה · לובי');
  });

  test('refresh reads again; the edit button (administrators) opens the classic panel\'s tools', async ({ page }) => {
    const { mock } = await boot(page);
    const before = count(mock, 'stations/entry-a/programs');
    await page.locator(`${SCREEN} sw-button[data-sch-refresh]`).click();
    await expect.poll(() => count(mock, 'stations/entry-a/programs')).toBe(before + 1);
    await expect.poll(() => count(mock, 'schedules')).toBe(2);
    await page.locator(`${SCREEN} sw-button[data-sch-edit]`).click();
    await expect.poll(() => page.url()).toContain('#/wiskey/tools');
  });

  test('an operator (installation scope) sees the library but no edit button', async ({ page }) => {
    await boot(page, { persona: 'operator' });
    await expect(page.locator(`${SCREEN} [data-sch-lib-row]`)).toHaveCount(2);
    await expect(page.locator(`${SCREEN} sw-button[data-sch-edit]`)).toHaveCount(0);
  });

  test('a station-scoped operator: only their station\'s door, and the installation-wide reads are never asked', async ({ page }) => {
    const { mock } = await boot(page, { persona: 'scoped' });
    await expect(page.locator(`${SCREEN} [data-sch-door-list="side"] button[data-sch-door]`)).toHaveCount(1);
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('subheading', 'דלת אחת');
    await expect(page.locator(`${SCREEN} [data-sch-library]`)).toHaveCount(0);
    expect(reads(mock).filter((p) => p.startsWith('schedules'))).toEqual([]);
  });

  test('a viewer is not offered the tab; a typed address says only "not available"', async ({ page }) => {
    const { mock } = await boot(page, { persona: 'viewer' }, { ready: `${SCREEN} [data-sch-panel="forbidden"]` });
    await expect(tabRow(page)).not.toContainText('לוחות זמנים');
    await expect(page.locator(`${SCREEN} [data-sch-panel="forbidden"]`)).toHaveAttribute('heading', 'המסך הזה אינו זמין לך');
    expect(reads(mock).filter((p) => p.startsWith('schedules') || p.startsWith('stations'))).toEqual([]);
  });

  // FLAKY-2250-297: five states were five page loads in ONE test, so on a loaded runner the sum (not any one wait) passed the 60 s
  // test timeout; one test per state, the same assertions.
  test('states: error with retry', async ({ page }) => {
    await boot(page, { schedules: 'error' }, { ready: `${SCREEN} [data-sch-panel="door-error"]` });
    await expect(page.locator(`${SCREEN} [data-sch-panel="library-error"]`)).toBeVisible();
  });

  test('states: busy', async ({ page }) => {
    await boot(page, { schedules: 'busy' }, { ready: `${SCREEN} [data-sch-panel="door-busy"]` });
  });

  test('states: unsupported (the blocks are absent)', async ({ page }) => {
    await boot(page, { schedules: 'unsupported' }, { ready: `${SCREEN} [data-sch-panel="door-unsupported"]` });
    await expect(page.locator(`${SCREEN} [data-sch-library]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveCount(0);
  });

  test('states: empty', async ({ page }) => {
    await boot(page, { schedules: 'empty' }, { ready: `${SCREEN} [data-sch-panel="no-program"]` });
    await expect(page.locator(`${SCREEN} [data-sch-panel="library-empty"]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-sch-panel="plans-empty"]`)).toBeVisible();
  });

  test('states: stale', async ({ page }) => {
    await boot(page, { schedules: 'stale' });
    await expect.poll(() => texts(page, `${SCREEN} [data-sch-stale="door"]`)).toEqual(['הנתונים אינם עדכניים · עודכן 27.09.2026 12:58']);
  });

  test('a feature the installed version does not list hides its block, and it is never asked', async ({ page }) => {
    const { mock } = await boot(page, { hideFeatures: ['schedules', 'schedule_plans', 'schedule_operations', 'public_codes'] });
    await expect(page.locator(`${SCREEN} [data-sch-library]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} sw-badge[data-sch-code]`)).toHaveCount(0);
    expect(reads(mock).filter((p) => p.startsWith('schedules') || p.endsWith('/codes'))).toEqual([]);
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('subheading', '4 דלתות');
  });

  test('the loading state holds until the answers arrive', async ({ page }) => {
    const { mock } = await boot(page, { schedules: 'hold' }, { ready: `${SCREEN} [data-sch-panel="door-loading"]` });
    mock.release();
    await expect(programState(page)).toHaveAttribute('label', 'פעיל', { timeout: 15_000 });
  });
});

test.describe('the schedules screen: phone and tablet', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the door chip opens the door sheet; the table is not offered on a phone', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await boot(page);
    await expect(page.locator(`${SCREEN} [data-sch-door-list="side"]`)).toBeHidden();
    await expect(page.locator(`${SCREEN} sw-view-switch`)).toHaveCount(0);
    const chip = page.locator(`${SCREEN} [data-sch-door-chip]`);
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await shot(page, info, 'schedules-door');
    await chip.click();
    const sheet = page.locator(`${SCREEN} sw-drawer[data-sch-sheet][open]`);
    await expect(sheet).toBeVisible();
    await shot(page, info, 'schedules-sheet');
    await sheet.locator('button[data-sch-door="entry-b:1"]').click();
    await expect(page.locator(`${SCREEN} sw-drawer[data-sch-sheet][open]`)).toHaveCount(0);
    await expect(doorTitle(page)).toHaveText('כניסה · לובי');
  });

  test('the door view and the table at tablet width', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'tablet only');
    await boot(page);
    await shot(page, info, 'schedules-door', true);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-c:1"]`)).toContainText('שגיאה', { timeout: 15_000 });
    await shot(page, info, 'schedules-table');
  });

  test('the desktop door view and table (evidence)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only');
    await boot(page);
    await shot(page, info, 'schedules-door', true);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
    await expect(page.locator(`${SCREEN} sw-table tbody tr[data-row-id="entry-c:1"]`)).toContainText('שגיאה', { timeout: 15_000 });
    await shot(page, info, 'schedules-table', true);
  });
});

test.describe('the schedules screen: skins x light / dark', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: renders without errors`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'skins on desktop');
        const { errors } = await boot(page, {}, { skin, scheme });
        await expect(page.locator(`${SCREEN} [data-sch-lib-row]`)).toHaveCount(2);
        await shot(page, info, `schedules-${skin}-${scheme}`, true);
        expect(errors).toEqual([]);
      });
    }
  }
});
