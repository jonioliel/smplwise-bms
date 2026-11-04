import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installParityMock } from './access-parity-mocks';
import { installTriageMock, openTriage, PAIRED, PANEL, SCREEN, type TriageOptions } from './wiskey-triage-mocks';

// WISKEY-CONFLICTS-2400 (integration plan task T5): the conflicts and fleet alerts screen (#/wiskey/conflicts, #/wiskey/alerts) and its
// section on the "מצב WisKey" card, behind the real shell against a MOCKED backend (tests/wiskey-triage-mocks.ts - no WisKey, no station,
// no Home Assistant). What it pins, desktop and phone:
//   - the lists: a person's conflict and a removal can be reviewed, a revocation says it has no resolution of its own; the alerts show
//     snooze / restore only (no acknowledge, no close);
//   - preview -> confirm -> apply: "בדיקה" asks the server for WisKey's preview and shows the impact (managed vs station, the fields that
//     differ, what would change, the stations involved); a resolution is offered only from there, behind a confirmation, sent once with
//     the review id and the command envelope - never a WisKey command name or token;
//   - honest results: accepted and queued, "the record changed - review again", refused with WisKey's code, sent without a clear answer;
//   - the alert snooze carries a closed duration and reason; restore; a concurrent change is said as such;
//   - without the manage right the lists are read only and say why; the notification setting is the system administrator's;
//   - the "מצב WisKey" card shows the compact section with a link to the screen. Evidence pictures: SW_SHOTS=1 ->
//     docs/design/evidence/wiskey-conflicts-2400.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-triage-2400.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-conflicts-2400');
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;
const DRAWER = `${PANEL} sw-drawer[data-wkt-drawer]`;

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

async function boot(page: Page, o: TriageOptions = {}, hash = '/wiskey/conflicts') {
  const mock = await installTriageMock(page, o);
  await openTriage(page, hash);
  await expect(page.locator(`${PANEL} [data-wkt-panel="full"]`)).toBeVisible({ timeout: 30_000 });
  return mock;
}

test.describe('WISKEY-CONFLICTS-2400: conflicts', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  test('the list: a person and a removal can be reviewed; a revocation has no resolution of its own', async ({ page }, info) => {
    const mock = await boot(page);
    const rows = page.locator(`${PANEL} [data-wkt-conflicts] [data-wkt-conflict]`);
    await expect(rows).toHaveCount(3);
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"]`)).toContainText('אלי פרץ');
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"]`)).toContainText('חניון');
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"] [data-wkt-review]`)).toBeVisible();
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-b:u8"] [data-wkt-review]`)).toBeVisible();
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-c:u9"] [data-wkt-review]`)).toHaveCount(0);
    await expect(page.locator(`${PANEL} [data-wkt-conflict="entry-c:u9"]`)).toContainText('אין לו פתרון נפרד');
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('heading', 'התנגשויות והתראות עמדות');
    expect(await page.locator(SCREEN).innerText()).not.toMatch(BANNED);
    expect(mock.calls.filter((c) => c.method !== 'GET')).toEqual([]); // opening the screen writes nothing
    await shot(page, info, 'conflicts-list');
  });

  test('review -> impact -> confirm -> acknowledged, sent once with the review id and the envelope', async ({ page }, info) => {
    const mock = await boot(page);
    await page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"] [data-wkt-review]`).click();
    await expect(page.locator(DRAWER)).toHaveAttribute('open', '');
    await expect(page.locator(`${DRAWER} [data-wkt-compare]`)).toContainText('אלי פרץ (עמדה)');
    await expect(page.locator(`${DRAWER} [data-wkt-diffs]`)).toContainText('דלתות');
    await expect(page.locator(`${DRAWER} [data-wkt-diffs]`)).toContainText('קוד אישי');
    await expect(page.locator(`${DRAWER} [data-wkt-plan]`)).toContainText('יוגדר קוד אישי');
    await expect(page.locator(`${DRAWER} [data-wkt-affected]`)).toContainText('שער ראשי');
    await expect(page.locator(`${DRAWER} [data-wkt-choice="device"]`)).toHaveAttribute('data-allowed', 'false');
    await expect(page.locator(`${DRAWER} [data-wkt-choice="device"]`)).toContainText('האדם לא נמצא בעמדה');
    await shot(page, info, 'review-drawer');
    // nothing is sent before the confirmation
    expect(mock.calls.filter((c) => c.path.endsWith('/resolve'))).toEqual([]);
    await page.locator(`${DRAWER} [data-wkt-choose="central"]`).click();
    await expect(page.locator(`${DRAWER} sw-dialog[data-wkt-confirm]`)).toHaveAttribute('open', '');
    await shot(page, info, 'review-confirm');
    await page.locator(`${DRAWER} [data-wkt-confirm-ok]`).click();
    await expect(page.locator(`${DRAWER} [data-wkt-resolved] [data-wkt-result="acknowledged"]`)).toBeVisible();
    await expect(page.locator(`${DRAWER} [data-wkt-resolved]`)).toContainText('נכנס לתור');
    const review = mock.calls.find((c) => c.path === 'stations/entry-c/conflicts/u7/review');
    expect(review?.body).toEqual({ kind: 'person' });
    const sent = mock.calls.filter((c) => c.path.endsWith('/resolve'));
    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe('triage/reviews/rv_person000000000001/resolve');
    expect(Object.keys(sent[0].body ?? {}).sort()).toEqual(['client_request_id', 'confirmed', 'direction', 'expires_at']);
    expect(sent[0].body).toMatchObject({ direction: 'central', confirmed: true });
    // the choice cannot be sent twice from the same review
    await expect(page.locator(`${DRAWER} [data-wkt-choose="central"]`)).toHaveAttribute('disabled', '');
    expect(JSON.stringify(mock.calls)).not.toMatch(/review_token|hikvision_intercom|conflicts\/resolve"/);
    await shot(page, info, 'review-acknowledged');
  });

  test('a removal offers only "continue the deletion"', async ({ page }) => {
    const mock = await boot(page);
    await page.locator(`${PANEL} [data-wkt-conflict="entry-b:u8"] [data-wkt-review]`).click();
    await expect(page.locator(`${DRAWER} [data-wkt-choice]`)).toHaveCount(1);
    await expect(page.locator(`${DRAWER} [data-wkt-choice="delete"]`)).toContainText('להמשיך במחיקה מהעמדה');
    await page.locator(`${DRAWER} [data-wkt-choose="delete"]`).click();
    await page.locator(`${DRAWER} [data-wkt-confirm-ok]`).click();
    await expect(page.locator(`${DRAWER} [data-wkt-result="acknowledged"]`)).toBeVisible();
    expect(mock.calls.find((c) => c.path === 'stations/entry-b/conflicts/u8/review')?.body).toEqual({ kind: 'removal' });
    expect(mock.calls.find((c) => c.path.endsWith('/resolve'))?.body).toMatchObject({ direction: 'delete', confirmed: true });
  });

  test('honest results: a changed record, a refusal and no clear answer', async ({ page }, info) => {
    await boot(page, { resolve: 'stale' });
    const run = async () => {
      await page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"] [data-wkt-review]`).click();
      await page.locator(`${DRAWER} [data-wkt-choose="central"]`).click();
      await page.locator(`${DRAWER} [data-wkt-confirm-ok]`).click();
    };
    await run();
    await expect(page.locator(`${DRAWER} [data-wkt-result="stale"]`)).toContainText('השתנתה מאז הבדיקה');
    await expect(page.locator(`${DRAWER} [data-wkt-again]`)).toBeVisible();
    await shot(page, info, 'review-stale');
    for (const [mode, status, text] of [
      ['failed', 'failed', 'device_unavailable'],
      ['unknown', 'unknown', 'לא התקבלה תשובה ברורה'],
    ] as const) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await boot(page, { resolve: mode });
      await run();
      await expect(page.locator(`${DRAWER} [data-wkt-result="${status}"]`)).toContainText(text);
    }
  });

  test('without the manage right: read only, and it says why', async ({ page }, info) => {
    const mock = await boot(page, { persona: 'siteAdmin' });
    await expect(page.locator(`${PANEL} [data-wkt-readonly]`)).toContainText('הרשאת ניהול עמדות');
    await expect(page.locator(`${PANEL} [data-wkt-conflicts] [data-wkt-conflict]`).first()).toBeVisible();
    await expect(page.locator(`${PANEL} [data-wkt-review]`)).toHaveCount(0);
    await page.locator(`${PANEL} [data-wkt-tab="alerts"]`).click();
    await expect(page.locator(`${PANEL} [data-wkt-snooze]`)).toHaveCount(0);
    await expect(page.locator(`${PANEL} [data-wkt-notify-select]`)).toBeDisabled();
    expect(mock.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    await shot(page, info, 'read-only');
  });
});

test.describe('WISKEY-CONFLICTS-2400: fleet alerts', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  test('the alerts tab: snooze with a duration and a reason, sent once; no acknowledge or close', async ({ page }, info) => {
    const mock = await boot(page, {}, '/wiskey/alerts');
    await expect(page.locator(`${PANEL} [data-wkt-tab="alerts"]`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`${PANEL} [data-wkt-alerts] [data-wkt-alert]`)).toHaveCount(2); // the snoozed one is hidden by default
    await expect(page.locator(`${PANEL} [data-wkt-no-ack]`)).toContainText('אין לה אישור קבלה או סגירה');
    await expect(page.locator(`${PANEL} [data-wkt-alert] sw-button`)).toHaveCount(2);
    await shot(page, info, 'alerts-list');
    await page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-snooze]`).click();
    const dlg = page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog]`);
    await expect(dlg).toHaveAttribute('open', '');
    await dlg.locator('[data-wkt-duration]').selectOption('240');
    await dlg.locator('[data-wkt-reason]').selectOption('network_work');
    await shot(page, info, 'alerts-snooze-dialog');
    await dlg.locator('[data-wkt-alert-ok]').click();
    await expect(page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-result="completed"]`)).toBeVisible();
    const sent = mock.calls.filter((c) => c.method === 'POST');
    expect(sent.map((c) => c.path)).toEqual(['stations/entry-c/alerts/offline/snooze']);
    expect(sent[0].body).toMatchObject({ confirmed: true, duration_minutes: 240, reason: 'network_work' });
    expect(Object.keys(sent[0].body ?? {}).sort()).toEqual(['client_request_id', 'confirmed', 'duration_minutes', 'expires_at', 'reason']);
  });

  test('a station-wide snooze, a restore, and a concurrent change said as such', async ({ page }) => {
    const mock = await boot(page, {}, '/wiskey/alerts');
    await page.locator(`${PANEL} [data-wkt-alert="entry-b/sync_stalled"] [data-wkt-snooze]`).click();
    const dlg = page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog]`);
    await dlg.locator('[data-wkt-whole-station]').check();
    await dlg.locator('[data-wkt-alert-ok]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(['stations/entry-b/alerts/maintenance/snooze']);
    await page.locator(`${PANEL} [data-wkt-show-snoozed]`).check();
    await page.locator(`${PANEL} [data-wkt-alert="entry-a/clock_drift"] [data-wkt-restore]`).click();
    await page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog] [data-wkt-alert-ok]`).click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'POST').map((c) => c.path).at(-1)).toBe('stations/entry-a/alerts/clock_drift/restore');
    expect(mock.calls.filter((c) => c.method === 'POST').at(-1)?.body).not.toHaveProperty('duration_minutes');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { alert: 'conflict' }, '/wiskey/alerts');
    await page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-snooze]`).click();
    await page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog] [data-wkt-alert-ok]`).click();
    await expect(page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-result="stale"]`)).toContainText('revision_conflict');
  });

  test('the notification setting: off by default, the system administrator turns it on', async ({ page }) => {
    const mock = await boot(page, {}, '/wiskey/alerts');
    const sel = page.locator(`${PANEL} [data-wkt-notify-select]`);
    await expect(page.locator(`${PANEL} [data-wkt-notify]`)).toHaveAttribute('data-wkt-notify', 'off');
    await expect(page.locator(`${PANEL} [data-wkt-notify]`)).toContainText('שעות שקט');
    await sel.selectOption('on');
    await expect(page.locator(`${PANEL} [data-wkt-notify]`)).toHaveAttribute('data-wkt-notify', 'on');
    expect(mock.calls.filter((c) => c.method === 'PUT')).toEqual([{ method: 'PUT', path: 'triage/settings', body: { notify: true } }]);
  });

  test('the tab follows the address and the address follows the tab', async ({ page }) => {
    await boot(page);
    await page.locator(`${PANEL} [data-wkt-tab="alerts"]`).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/alerts');
    await page.locator(`${PANEL} [data-wkt-tab="conflicts"]`).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/conflicts');
    await expect(page.locator('sw-app wiskey-embed')).toHaveCount(0); // a native screen, never the embedded panel
  });
});

test.describe('WISKEY-CONFLICTS-2400: the "מצב WisKey" section', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  test('the card shows both lists in the compact size, with a link to the screen', async ({ page }, info) => {
    const mock = await installTriageMock(page, {});
    await installParityMock(page, mock.access, 'ready');
    await page.route('**/api/v1/system/wiskey-pairing**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAIRED) }));
    await openTriage(page, '/system/diagnostics?tab=access-control');
    const section = page.locator('sw-app system-wiskey-pairing [data-wkp-triage]');
    await expect(section.locator('wk-triage-panel [data-wkt-panel="compact"]')).toBeVisible({ timeout: 30_000 });
    await expect(section.locator('wk-triage-panel [data-wkt-conflict]')).toHaveCount(3);
    await expect(section.locator('wk-triage-panel [data-wkt-alert]')).toHaveCount(2);
    await expect(section.locator('wk-triage-panel [data-wkt-open-full]')).toHaveAttribute('href', '#/wiskey/conflicts');
    await section.scrollIntoViewIfNeeded();
    if (process.env.SW_SHOTS) {
      fs.mkdirSync(OUT, { recursive: true });
      await section.screenshot({ path: path.join(OUT, `status-section-${info.project.name}.png`) });
    }
    await section.locator('wk-triage-panel [data-wkt-open-full]').click();
    await expect(page.locator(`${PANEL} [data-wkt-panel="full"]`)).toBeVisible({ timeout: 30_000 });
  });
});
