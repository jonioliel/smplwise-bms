import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, SKINS, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { installParityMock, type ParityMock } from './access-parity-mocks';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { settlePage } from './pixel-settle';

// CR-036 S12 against the mocked backend (tests/access-control-mocks.ts + tests/access-parity-mocks.ts: the wire shapes of the typed reads, checked
// against the real endpoints by backend/tests/test_access_control_wire.py and test_access_parity_wire.py). Nothing here reaches a WisKey, Home
// Assistant or a station. What it pins:
//   - Settings › כללי › מתגי מסכי כניסה: the stations-screen display card (call hint, talk button, announcement targets, quick phrases) saves
//     exactly what changed through PATCH /settings; read only without system.configure;
//   - the parity report: nothing is asked before the button; per screen the counts, the outcome and why, links to the native screen and the
//     classic panel; another user's view for a system administrator; busy and refused said plainly; the side-by-side checklist kept in this
//     browser;
//   - the intercom action log: the period and the person filters;
//   - the stations drawer's way to the entry log of the station.
// Evidence screenshots: docs/design/evidence/CR-036-S12/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-access-s12.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-S12');
const SETTINGS = '/system/diagnostics?tab=access-control';
const DISPLAY = 'sw-app system-diagnostics system-access-display';
const PARITY = 'sw-app system-diagnostics system-access-parity';
const AUDIT = 'sw-app system-access-control system-access-audit';

interface Booted {
  mock: AccessMock;
  parity: ParityMock;
  errors: string[];
}

async function boot(page: Page, opts: MockOptions = {}, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; parity?: ParityMock['mode']; ready?: string | false } = {}): Promise<Booted> {
  const mock = await installAccessMock(page, opts);
  const parity = await installParityMock(page, mock, o.parity ?? 'ready');
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? SETTINGS, o.skin ?? 'classic', o.scheme ?? 'light'));
  await page.waitForSelector('sw-app');
  const ready = o.ready === undefined ? `${DISPLAY} sw-card[data-access-display="ready"]` : o.ready;
  if (ready) await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  return { mock, parity, errors };
}

async function shot(page: Page, info: TestInfo, name: string, target?: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  const file = path.join(EVIDENCE, `${name}-${info.project.name}.png`);
  if (target) await page.locator(target).first().screenshot({ path: file });
  else await page.screenshot({ path: file });
}

async function choose(page: Page, scope: string, hook: string, id: string) {
  const dd = page.locator(`${scope} sw-dropdown[${hook}]`);
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`[role="option"][data-id="${id}"]`).click();
}

const rowsText = (page: Page) =>
  page.locator(`${PARITY} sw-table[data-parity-table] tbody tr`).evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
const outcomes = (page: Page) => page.locator(`${PARITY} sw-table[data-parity-table] sw-badge[data-parity-outcome]`).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-parity-outcome')));

test.describe('S12: the stations-screen display settings', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the widths are the layout guard\'s');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('the four controls start at the owner\'s defaults and save exactly what changed', async ({ page }, info) => {
    const { mock, errors } = await boot(page);
    const sel = (k: string) => page.locator(`${DISPLAY} select[data-set-access-display="${k}"]`);
    await expect(sel('access.call_hint')).toHaveValue('everyone');
    await expect(sel('access.talk_button')).toHaveValue('classic');
    await expect(sel('access.announce_scope')).toHaveValue('scope');
    const box = page.locator(`${DISPLAY} textarea[data-set-access-display="access.announce_phrases"]`);
    await expect(box).toHaveValue('');
    const save = page.locator(`${DISPLAY} sw-button[data-save-access-display]`);
    await expect(save).toHaveAttribute('disabled', '');
    await shot(page, info, 'display-default', `${DISPLAY} sw-card`);

    await sel('access.call_hint').selectOption('call');
    await box.fill('נא לפנות לקבלה\nהחניון סגור\n' + 'א'.repeat(170));
    await expect(page.locator(`${DISPLAY} sw-field[hint]`).last()).toHaveAttribute('hint', '2 משפטים יוצגו · 1 שורות ארוכות או עודפות לא יוצגו');
    await save.click();
    await expect(page.locator(`${DISPLAY} .msg.ok`)).toHaveText(/נשמר/);
    expect(mock.patches).toEqual([{ 'access.call_hint': 'call', 'access.announce_phrases': 'נא לפנות לקבלה\nהחניון סגור\n' + 'א'.repeat(170) }]);
    await expect(save).toHaveAttribute('disabled', '');
    // setting a value back to what is saved leaves nothing to save
    await sel('access.talk_button').selectOption('hidden');
    await sel('access.talk_button').selectOption('classic');
    await expect(save).toHaveAttribute('disabled', '');
    await shot(page, info, 'display-saved', `${DISPLAY} sw-card`);
    expect(errors).toEqual([]);
  });

  test('a failed save keeps the choices and says so; a site manager sees the card read only', async ({ page }) => {
    const { mock } = await boot(page, { settingsPatch: 'fail' });
    await page.locator(`${DISPLAY} select[data-set-access-display="access.announce_scope"]`).selectOption('station');
    await page.locator(`${DISPLAY} sw-button[data-save-access-display]`).click();
    await expect(page.locator(`${DISPLAY} .msg.err`)).toBeVisible();
    await expect(page.locator(`${DISPLAY} select[data-set-access-display="access.announce_scope"]`)).toHaveValue('station');
    expect(mock.patches).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { persona: 'siteAdmin' });
    await expect(page.locator(`${DISPLAY} select[data-set-access-display="access.call_hint"]`)).toBeDisabled();
    await expect(page.locator(`${DISPLAY} sw-button[data-save-access-display]`)).toHaveCount(0);
    await expect(page.locator(`${DISPLAY} [data-access-display-readonly]`)).toHaveText('שינוי ההגדרות דורש הרשאת מנהל מערכת.');
  });

  test('the switch lives in Settings only: no screen of the area offers it', async ({ page }) => {
    await boot(page, {}, { hash: '/wiskey/events', ready: 'sw-app wiskey-events' });
    await expect(page.locator('sw-app wiskey-events select[data-set-access-ui], sw-app wiskey-events [data-access-ui-switch]')).toHaveCount(0);
    await page.goto(url(SETTINGS));
    await expect(page.locator('sw-app system-diagnostics select[data-set-access-ui="events"]')).toHaveValue('smplwise', { timeout: 30_000 });
  });
});

test.describe('S12: the parity report and the side-by-side checklist', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the widths are the layout guard\'s');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('nothing is asked before the button; a report shows per screen the counts, the outcome and why, and the ways to look', async ({ page }, info) => {
    const { parity, errors } = await boot(page);
    await expect(page.locator(`${PARITY} [data-parity-idle]`)).toBeVisible();
    expect(parity.asked).toEqual([]);
    await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
    await expect(page.locator(`${PARITY} sw-card[data-parity-state="ready"]`)).toBeVisible({ timeout: 15_000 });
    expect(parity.asked).toEqual([{ hours: '24' }]);
    expect(await outcomes(page)).toEqual(['match', 'match', 'mismatch', 'match', 'unsupported', 'partial']);
    const rows = await rowsText(page);
    expect(rows[0]).toContain('תחנות ודלתות');
    await expect(page.locator(`${PARITY} sw-table[data-parity-table] sw-badge`).first()).toHaveAttribute('label', 'תואם');
    expect(rows[2]).toContain('212');
    expect(rows[2]).toContain('211');
    expect(rows[2]).toContain('הריצו שוב');
    expect(rows[4]).toContain('not_listed');
    expect(rows[5]).toContain('לפחות 1000');
    // integ-249: the mismatch sentence wraps inside the card instead of running off its edge (sw-table cells do not wrap)
    const card = await page.locator(`${PARITY} sw-card[data-access-card="parity"]`).boundingBox();
    const why = await page.locator(`${PARITY} sw-table[data-parity-table] tbody tr`).nth(2).locator('[data-parity-why]').boundingBox();
    expect(card && why && why.x >= card.x - 1 && why.x + why.width <= card.x + card.width + 1).toBe(true);
    // the native screen only where it is switched on (the mock switches overview / events / people); the classic panel per visit
    const people = page.locator(`${PARITY} sw-table[data-parity-table] tbody tr`).nth(1);
    await expect(people.locator('a[data-parity-open="native"]')).toHaveAttribute('href', '#/wiskey/people');
    await expect(people.locator('a[data-parity-open="classic"]')).toHaveAttribute('href', '#/wiskey/people?classic=1');
    const stations = page.locator(`${PARITY} sw-table[data-parity-table] tbody tr`).nth(0);
    await expect(stations.locator('a[data-parity-open="native"]')).toHaveCount(0);
    await expect(page.locator(`${PARITY} [data-parity-foot]`)).toContainText('3 תואמים · 0 מסוננים · 1 לא תואמים');
    const text = await page.locator(PARITY).evaluate((el) => (el as HTMLElement).innerText);
    expect(text).not.toMatch(/Home Assistant|Ingress/);
    await shot(page, info, 'parity-admin', `${PARITY} sw-card[data-access-card="parity"]`);
    expect(errors).toEqual([]);
  });

  test('a system administrator runs it as another user over seven days: filtered rows name the rule', async ({ page }, info) => {
    const { parity } = await boot(page);
    await choose(page, PARITY, 'data-parity-subject', 'u-operator-a');
    await choose(page, PARITY, 'data-parity-hours', '168');
    await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
    await expect(page.locator(`${PARITY} sw-card[data-parity-state="ready"]`)).toBeVisible({ timeout: 15_000 });
    expect(parity.asked.at(-1)).toEqual({ as_user: 'u-operator-a', hours: '168' });
    expect(await outcomes(page)).toEqual(['filtered', 'filtered', 'filtered', 'filtered', 'filtered', 'not_permitted']);
    const rows = await rowsText(page);
    expect(rows[1]).toContain('הוסרו רשומות של תחנות מחוץ לתחום ההרשאה');
    expect(rows[1]).toContain('צפוי 41');
    expect(rows[4]).toContain('המסך מוצג רק למי שמורשה לכל התחנות');
    expect(rows[5]).toContain('למשתמש אין הרשאה לפתוח את המסך');
    await expect(page.locator(`${PARITY} [data-parity-foot]`)).toContainText('מפעיל שער ראשי');
    await shot(page, info, 'parity-operator', `${PARITY} sw-card[data-access-card="parity"]`);
  });

  test('busy and refused are said plainly; a site manager has no subject picker', async ({ page }) => {
    await boot(page, {}, { parity: 'busy' });
    await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
    await expect(page.locator(`${PARITY} sw-state-panel`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`${PARITY} sw-state-panel`)).toHaveAttribute('hint', /כבר רצה/);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { persona: 'siteAdmin' }, { parity: 'forbidden' });
    await expect(page.locator(`${PARITY} sw-dropdown[data-parity-subject]`)).toHaveCount(0);
    await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
    await expect(page.locator(`${PARITY} sw-state-panel[data-access-state="forbidden"]`)).toBeVisible({ timeout: 15_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    // an operator never gets the card (no access.admin.read), and is not asked
    const { parity } = await boot(page, { persona: 'operator' }, { ready: false });
    await page.waitForTimeout(1500); // nothing to wait for: the card must simply not appear
    await expect(page.locator(PARITY)).toHaveCount(0);
    expect(parity.asked).toEqual([]);
  });

  test('the checklist: per switched screen the two ways to look and what to compare; ticks stay in this browser', async ({ page }, info) => {
    await boot(page);
    const item = page.locator(`${PARITY} input[data-parity-item="people:item_sample_person"]`);
    await expect(page.locator(`${PARITY} [data-parity-checklist]`)).toHaveCount(4); // overview, stations, people, events (schedules joins with its switch)
    await expect(page.locator(`${PARITY} [data-parity-checklist="events"] a[data-parity-open="native"]`)).toHaveAttribute('href', '#/wiskey/events');
    await expect(page.locator(`${PARITY} [data-parity-checklist="stations"] a[data-parity-open="native"]`)).toHaveCount(0);
    await expect(page.locator(`${PARITY} [data-parity-checklist="stations"] a[data-parity-open="classic"]`)).toHaveAttribute('href', '#/wiskey/devices?classic=1');
    await item.check();
    await expect(page.locator(`${PARITY} [data-parity-progress]`)).toHaveText(/^1 מתוך \d+$/);
    await page.reload();
    await expect(page.locator(`${PARITY} input[data-parity-item="people:item_sample_person"]`)).toBeChecked({ timeout: 30_000 });
    await shot(page, info, 'parity-checklist', `${PARITY} sw-card[data-access-card="parity-checklist"]`);
    await page.locator(`${PARITY} sw-button[data-parity-clear]`).click();
    await expect(page.locator(`${PARITY} input[data-parity-item="people:item_sample_person"]`)).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('sw.access.parity.checklist'))).toBeNull();
  });
});

test.describe('S12: the intercom action log filters', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('a period sends its start; a person on a record narrows the log to them and a chip takes it away', async ({ page }, info) => {
    const { mock } = await boot(page, {}, { hash: '/system/access-control/audit', ready: `${AUDIT} [data-access-audit-table]` });
    const last = () => mock.calls.filter((c) => c.path === 'access-control/status/audit').at(-1)!.query;
    await choose(page, AUDIT, 'data-access-audit-period', '24h');
    await expect.poll(() => last().start).toBe('2026-09-26T10:30:00Z');
    await page.locator(`${AUDIT} [data-access-audit-person="u1"]`).click();
    await expect.poll(() => last().user_id).toBe('u1');
    await expect(page.locator(`${AUDIT} [data-access-audit-person-chip]`)).toBeVisible();
    await expect(page.locator(`${AUDIT} sw-table[data-access-audit-table] tbody tr`)).toHaveCount(1);
    await shot(page, info, 'audit-person');
    await page.locator(`${AUDIT} [data-access-audit-person-chip]`).click();
    await expect.poll(() => last().user_id).toBeUndefined();
    await expect(page.locator(`${AUDIT} [data-access-audit-person-chip]`)).toHaveCount(0);
    await page.locator(`${AUDIT} [data-access-audit-clear]`).click();
    await expect.poll(() => last().start).toBeUndefined();
  });
});

test.describe('S12: the stations drawer leads to the station\'s entry log', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('only while the entry log is the native screen and the caller reads it', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project');
    const m = newMock({ settings: { 'access.ui.events': 'smplwise' } });
    await installStationsMock(page, m);
    await openStations(page);
    await page.locator('wiskey-stations [data-wk-grid] [data-wk-station="lobby"] button.open').click();
    await expect(page.locator('wiskey-stations sw-drawer[data-wk-drawer] [data-wk-station-events="lobby"]')).toHaveAttribute('href', '#/wiskey/events?station=lobby');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installStationsMock(page, newMock());
    await openStations(page);
    await page.locator('wiskey-stations [data-wk-grid] [data-wk-station="lobby"] button.open').click();
    await expect(page.locator('wiskey-stations sw-drawer[data-wk-drawer]')).toBeVisible();
    await expect(page.locator('wiskey-stations sw-drawer[data-wk-drawer] [data-wk-station-events]')).toHaveCount(0);
  });
});

test.describe('S12: every width and the skins', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the switches page with the display card and a parity report: no page error, no sideways scroll, targets of 44 px', async ({ page }, info) => {
    const { errors } = await boot(page);
    await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
    await expect(page.locator(`${PARITY} sw-card[data-parity-state="ready"]`)).toBeVisible({ timeout: 15_000 });
    await shot(page, info, 'switches-page');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over, 'horizontal overflow of the page').toBeLessThanOrEqual(1);
    const small = await page.locator(`${PARITY} label.item, ${PARITY} .chk-head a, ${PARITY} sw-table a`).evaluateAll((els) =>
      els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => Math.round(el.getBoundingClientRect().height)).filter((h) => h < 44),
    );
    expect(small).toEqual([]);
    expect(errors).toEqual([]);
  });

  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: the display card and the parity report`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the skin matrix runs on desktop');
        const { errors } = await boot(page, {}, { skin, scheme });
        await page.locator(`${PARITY} sw-button[data-parity-run]`).click();
        await expect(page.locator(`${PARITY} sw-card[data-parity-state="ready"]`)).toBeVisible({ timeout: 15_000 });
        await shot(page, info, `parity-${skin}-${scheme}`, `${PARITY} sw-card[data-access-card="parity"]`);
        await shot(page, info, `display-${skin}-${scheme}`, `${DISPLAY} sw-card`);
        expect(errors).toEqual([]);
      });
    }
  }
});
