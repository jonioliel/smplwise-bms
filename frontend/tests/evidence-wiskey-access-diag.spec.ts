import { test, expect, type Page } from '@playwright/test';
import { NOW } from './access-control-mocks';
import { installDiagMock, type DiagOptions } from './wiskey-access-diag-mocks';
import { pickOption } from './helpers/wk-choose';

// WISKEY-ACCESS-DIAG-2400 (plan task T10): "אבחון הרשאות" behind the real shell against the MOCKED backend (tests/wiskey-access-diag-mocks.ts,
// layered over access-control-mocks.ts) - no access-control system, no station, no door. What it pins:
//   - "can X open door Y": a person picked by name, a door, now or a time -> the answer with the system's explanation lines;
//   - compare two people and two doors; the review list, one person's review and the decision (confirmation first, one POST with
//     `confirmed: true`, the saved line); view only + the panel link where the system or the operator's permission does not allow it;
//   - quality, lifecycle (the window re-reads), the station permission audit (read on demand), sync;
//   - the gates as the screen shows them (a station-scoped caller: the forbidden panel; no people permission: the people note);
//   - the phone: every view inside the screen width (no sideways scroll), 44 px targets; no platform name.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-access-diag.spec.ts --project=desktop --project=mobile

const SCREEN = 'sw-app wiskey-access-diag';
const READY = `${SCREEN} sw-page[data-diag-state="ready"]`;
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor/i;

async function open(page: Page, o: DiagOptions = {}, view = '') {
  const mock = await installDiagMock(page, o);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/access-diag${view ? `?view=${view}` : ''}`);
  await page.waitForSelector('sw-app');
  return mock;
}

async function pick(page: Page, slot: string, text: string, id: string) {
  const input = page.locator(`${SCREEN} input[data-diag-picker="${slot}"]`);
  await input.fill(text);
  await page.locator(`${SCREEN} [data-diag-options="${slot}"] [data-diag-option="${id}"]`).click();
  await expect(page.locator(`${SCREEN} [data-diag-chosen="${slot}"]`)).toBeVisible();
}

test.describe('אבחון הרשאות', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone'));

  test('"can X open door Y": the answer with the system\'s explanation', async ({ page }) => {
    const mock = await open(page);
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-diag-tab="scenario"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`${SCREEN} sw-button[data-diag-check]`)).toHaveAttribute('disabled', '');
    await pick(page, 'scenario', 'דנה', 'p1');
    await pickOption(page.locator(`${SCREEN} [data-diag-door="scenario"]`), 'entry-b:2');
    await page.locator(`${SCREEN} sw-button[data-diag-check]`).click();
    const answer = page.locator(`${SCREEN} [data-diag-answer]`);
    await expect(answer).toHaveAttribute('data-diag-answer', 'no');
    await expect(answer).toHaveAttribute('data-diag-reason', 'outside_schedule');
    await expect(answer).toContainText('לא מורשה לפתוח');
    await expect(answer).toContainText('מחוץ ללוח הזמנים שלו בשעה הזו.');
    await expect(answer).toContainText('ההרשאה מגיעה מקבוצה: צוות');
    await expect(answer).toContainText('חניון · מחסום');
    await expect(answer).toContainText('מערכת בקרת הכניסה אינה מחשבת חגים');
    for (const id of ['reason', 'source', 'validity', 'schedule', 'holidays', 'station', 'sync', 'evidence']) await expect(answer.locator(`[data-diag-line="${id}"]`)).toHaveCount(1);
    const read = mock.reads.find((r) => r.startsWith('/scenario'))!;
    expect(read).toContain('user_id=p1');
    expect(read).toContain('station_id=entry-b');
    expect(read).toContain('lock_id=2');
    expect(read).not.toContain('at='); // "now": the server's clock
    // a chosen time is sent as an instant in the installation's zone
    await page.locator(`${SCREEN} [data-diag-when="at"]`).click();
    await page.locator(`${SCREEN} input[data-diag-at]`).fill('2026-09-28T21:30');
    await page.locator(`${SCREEN} sw-button[data-diag-check]`).click();
    await expect.poll(() => mock.reads.filter((r) => r.startsWith('/scenario')).length).toBe(2);
    expect(decodeURIComponent(mock.reads.filter((r) => r.startsWith('/scenario'))[1])).toContain('at=2026-09-28T18:30:00.000Z');
    expect(await page.locator(SCREEN).innerText()).not.toMatch(BANNED);
  });

  test('compare two people, then two doors', async ({ page }) => {
    const mock = await open(page, {}, 'compare');
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    await pick(page, 'left', 'דנה', 'p1');
    await pick(page, 'right', 'יוסי', 'p2');
    await page.locator(`${SCREEN} sw-button[data-diag-run]`).click();
    const result = page.locator(`${SCREEN} [data-diag-comparison]`);
    await expect(result.locator('[data-diag-row]')).toHaveCount(4);
    await expect(result.locator('[data-diag-row="entry-b:1"] [data-diag-relation]')).toHaveAttribute('label', 'רק דנה לוי');
    await expect(result).toContainText('חסימה אישית בעמדה הזו');
    await page.locator(`${SCREEN} [data-diag-kind="doors"]`).click();
    await pickOption(page.locator(`${SCREEN} [data-diag-door="left"]`), 'entry-a:1');
    await pickOption(page.locator(`${SCREEN} [data-diag-door="right"]`), 'entry-b:1');
    await page.locator(`${SCREEN} sw-button[data-diag-run]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-door-comparison] [data-diag-person]`)).toHaveCount(3);
    expect(decodeURIComponent(mock.reads.find((r) => r.startsWith('/compare-doors'))!)).toContain('left=entry-a:1&right=entry-b:1');
  });

  test('a periodic review: confirmation first, one decision, the saved line', async ({ page }) => {
    const mock = await open(page, {}, 'reviews');
    await expect(page.locator(`${SCREEN} [data-diag-review]`)).toHaveCount(3, { timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-diag-review="p1"]`)).toContainText('על ידי מנהל אתר');
    await page.locator(`${SCREEN} [data-diag-state-filter="stale"]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-review]`)).toHaveCount(1);
    await page.locator(`${SCREEN} [data-diag-state-filter="all"]`).click();
    await page.locator(`${SCREEN} [data-diag-review="p1"] sw-button[data-diag-open-review]`).click();
    const dialog = page.locator(`${SCREEN} sw-dialog[data-diag-review-dialog]`);
    await expect(dialog.locator('[data-diag-decide]')).toBeVisible();
    await expect(dialog.locator('sw-button[data-diag-decide-go]')).toHaveAttribute('disabled', ''); // no reason yet
    await dialog.locator('[data-diag-decision="followup"]').click();
    await pickOption(dialog.locator('[data-diag-cadence]'), '30');
    await dialog.locator('textarea[data-diag-reason]').fill('לבדוק מול רשימת הקבלנים');
    await dialog.locator('sw-button[data-diag-decide-go]').click();
    await expect(dialog.locator('[data-diag-confirm]')).toContainText('למעקב את ההרשאה של דנה לוי לכניסה ראשית');
    expect(mock.posts).toEqual([]); // nothing sent before the confirmation
    await dialog.locator('sw-button[data-diag-confirm-yes]').click();
    await expect(dialog.locator('[data-diag-decide-line]')).toContainText('ההחלטה נרשמה');
    expect(mock.posts).toHaveLength(1);
    expect(mock.posts[0].body).toMatchObject({ user_id: 'p1', station_id: 'entry-a', lock_id: 1, person_revision: 6, fingerprint: 'e'.repeat(64), latest_id: 'b'.repeat(32),
                                               decision: 'followup', reason: 'לבדוק מול רשימת הקבלנים', cadence_days: 30, confirmed: true });
    expect(String(mock.posts[0].body.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    await dialog.locator('sw-button[slot="footer"]').click();
    await expect(page.locator(`${SCREEN} [data-diag-review="p1"]`)).toHaveAttribute('data-diag-status', 'completed');
  });

  test('a stale review is refused and said so; nothing is resent', async ({ page }) => {
    const mock = await open(page, { decide: 'stale' }, 'reviews');
    await page.locator(`${SCREEN} [data-diag-review="p2"] sw-button[data-diag-open-review]`).click({ timeout: 30_000 });
    const dialog = page.locator(`${SCREEN} sw-dialog[data-diag-review-dialog]`);
    await dialog.locator('textarea[data-diag-reason]').fill('נבדק');
    await dialog.locator('sw-button[data-diag-decide-go]').click();
    await dialog.locator('sw-button[data-diag-confirm-yes]').click();
    await expect(dialog.locator('[data-diag-decide-line]')).toContainText('הנתונים השתנו');
    expect(mock.posts).toHaveLength(1);
  });

  test('view only: an operator without people management, and a system that does not offer the decision', async ({ page }) => {
    await open(page, { persona: 'operator' }, 'reviews');
    await page.locator(`${SCREEN} [data-diag-review="p1"] sw-button[data-diag-open-review]`).click({ timeout: 30_000 });
    let dialog = page.locator(`${SCREEN} sw-dialog[data-diag-review-dialog]`);
    await expect(dialog.locator('[data-diag-view-only]')).toContainText('אין לך הרשאה לנהל אנשים');
    await expect(dialog.locator('[data-diag-decide]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { decide: 'unsupported' }, 'reviews');
    await page.locator(`${SCREEN} [data-diag-review="p1"] sw-button[data-diag-open-review]`).click({ timeout: 30_000 });
    dialog = page.locator(`${SCREEN} sw-dialog[data-diag-review-dialog]`);
    await expect(dialog.locator('[data-diag-view-only]')).toContainText('אפשר לרשום אותה בחלון האינטרקום');
    await expect(dialog.locator('a[data-diag-panel]')).toHaveAttribute('href', '#/wiskey/tools/access_reviews');
  });

  test('quality, lifecycle, the station audit and sync', async ({ page }) => {
    const mock = await open(page, {}, 'quality');
    await expect(page.locator(`${SCREEN} [data-diag-quality-row]`)).toHaveCount(3, { timeout: 30_000 });
    await expect(page.locator(`${SCREEN} [data-diag-quality-row="p2"]`)).toContainText('חסר שדה חובה: מחלקה');
    await page.locator(`${SCREEN} [data-diag-tab="lifecycle"]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-lifecycle] [data-diag-life="p6"]`).first()).toContainText('בעוד 3 ימים');
    await page.locator(`${SCREEN} [data-diag-days="7"]`).click();
    await expect.poll(() => mock.reads.filter((r) => r.startsWith('/lifecycle?days=7')).length).toBe(1);
    await expect(page.locator(`${SCREEN} [data-diag-lifecycle]`)).not.toContainText('נועה גל');
    await page.locator(`${SCREEN} [data-diag-tab="audit"]`).click();
    expect(mock.reads.some((r) => r.includes('permission-audit'))).toBe(false); // read on demand only
    await page.locator(`${SCREEN} sw-button[data-diag-run-audit]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-audit] [data-diag-audit-row]`)).toHaveCount(4);
    await expect(page.locator(`${SCREEN} [data-diag-audit] [data-diag-audit-row]`).first()).toHaveAttribute('data-diag-audit-row', 'drift');
    await page.locator(`${SCREEN} [data-diag-tab="sync"]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-sync] [data-diag-sync-station]`)).toHaveCount(2);
    await expect(page.locator(`${SCREEN} [data-diag-failure="authentication_failed"]`)).toBeVisible();
  });

  test('the gates: a station-scoped caller, a caller without people, a view the system does not offer', async ({ page }) => {
    await open(page, { persona: 'scoped' });
    await expect(page.locator(`${SCREEN} sw-page sw-state-panel[data-diag-state="forbidden"]`)).toBeVisible({ timeout: 30_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { persona: 'viewer' }, 'quality');
    await expect(page.locator(`${SCREEN} [data-diag-people-needed]`)).toBeVisible({ timeout: 30_000 });
    await page.locator(`${SCREEN} [data-diag-tab="sync"]`).click();
    await expect(page.locator(`${SCREEN} [data-diag-sync]`)).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { unsupported: ['lifecycle'] }, 'lifecycle');
    await expect(page.locator(`${SCREEN} [data-diag-unsupported="lifecycle"] a[data-diag-panel]`)).toHaveAttribute('href', '#/wiskey/tools/identity_lifecycle', { timeout: 30_000 });
  });

  test('the phone: every view inside the screen, 44 px targets', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone project');
    await open(page, {});
    await expect(page.locator(READY)).toBeVisible({ timeout: 30_000 });
    for (const view of ['scenario', 'compare', 'reviews', 'quality', 'lifecycle', 'audit', 'sync']) {
      await page.evaluate((v) => (location.hash = `#/wiskey/access-diag?view=${v}`), view);
      await expect(page.locator(`${SCREEN} sw-page[data-diag-view="${view}"]`)).toBeVisible();
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), view).toBe(true);
    }
    for (const h of await page.locator(`${SCREEN} [data-diag-tab]`).evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
    for (const h of await page.locator(`${SCREEN} .seg button`).evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  });
});
