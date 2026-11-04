import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { NOW } from './access-control-mocks';
import { settlePage } from './pixel-settle';
import { installOpsMock, newOpsMock, type OpsMock } from './intercom-ops-mocks';

// WISKEY-OPS-VIEWS-2400 (integration plan T11): הגדרות › תפעול האינטרקום against the mocked backend (tests/intercom-ops-mocks.ts), desktop and
// phone. What a person sees and what is sent: the KPI row and the stations, operations and jobs (the cancel through its confirmation, ONCE;
// a refusal says nothing changed; an unknown outcome reloads instead of repeating), the timeline with hidden person fields, capacity with the
// trend chart, the events report with its chart and table twin, the exports (administrator only), the forbidden / unavailable / error states,
// the deep links that now land here. Pixel baselines ("pixel-stable" in the title: the gate's pixel group) are Linux ones generated on the
// runner with --update-snapshots; on an OS without a baseline the comparison is skipped, not failed.
//   run_smart.py preview <branch> tests/evidence-intercom-ops.spec.ts --project=desktop --project=mobile [--update-snapshots]

const ROOT = 'sw-app system-intercom-ops';
const DIALOG = `${ROOT} sw-dialog[data-cancel-dialog][open]`;

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

type Info = Parameters<typeof noBaseline>[0] & { project: { name: string } };

async function compare(page: Page, info: Info, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

/** A part of the page (a section, a dialog box): its pixels do not depend on where the page behind it happens to be scrolled. */
async function compareEl(page: Page, info: Info, selector: string, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page.locator(selector)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function open(page: Page, m: OpsMock, hash = '/system/intercom-operations', ready = `${ROOT} sw-page[data-state="ready"]`) {
  await installOpsMock(page, m);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
}

test.describe('the intercom operations views', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('the overview: KPIs and stations, no device address; the tabs', async ({ page }) => {
    await open(page, newOpsMock());
    await expect(page.locator(`${ROOT} [data-ops-tab="overview"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`${ROOT} [data-ops-tab]`)).toHaveCount(6);
    await expect(page.locator(`${ROOT} sw-kpi[data-kpi="stations"]`)).toHaveAttribute('value', '3');
    await expect(page.locator(`${ROOT} sw-kpi[data-kpi="offline"]`)).toHaveAttribute('tone', 'error');
    await expect(page.locator(`${ROOT} sw-kpi[data-kpi="capacity"]`)).toHaveAttribute('value', '1');
    await expect(page.locator(`${ROOT} [data-station]`)).toHaveCount(3);
    await expect(page.locator(`${ROOT} [data-station="entry-b"] [data-pill="online"]`)).toHaveAttribute('data-tone', 'err');
    await expect(page.locator(`${ROOT} [data-station="entry-c"] [data-meter="users"]`)).toHaveAttribute('data-tone', 'warn');
    await expect(page.locator(ROOT)).not.toContainText('Home Assistant');
    await expect(page.locator(ROOT)).not.toContainText('WisKey');
  });

  test('operations and jobs: filters go to the server; failed rows show; a job is cancelled once through the confirmation', async ({ page }) => {
    const m = newOpsMock();
    await open(page, m, '/system/intercom-operations/operations', `${ROOT} [data-ops] [data-op]`);
    await expect(page.locator(`${ROOT} [data-op]`)).toHaveCount(3);
    await page.locator(`${ROOT} [data-ops] select[data-filter="state"]`).selectOption('failed');
    await expect(page.locator(`${ROOT} [data-op]`)).toHaveCount(1);
    expect(m.requests.some((u) => u.startsWith('operations?') && u.includes('state=failed'))).toBe(true);
    await expect(page.locator(`${ROOT} [data-op="op-sync-1"]`)).toContainText('authentication_failed');
    await page.locator(`${ROOT} [data-job="job-1"] [data-job-errors-toggle]`).click();
    await expect(page.locator(`${ROOT} [data-job="job-1"] [data-job-error-rows] li`)).toHaveCount(2);
    await expect(page.locator(`${ROOT} [data-job="job-2"] [data-job-cancel]`)).toHaveCount(0);
    await page.locator(`${ROOT} [data-job="job-1"] [data-job-cancel]`).click();
    await expect(page.locator(DIALOG)).toBeVisible();
    expect(m.cancels).toHaveLength(0);
    await page.locator(`${DIALOG} [data-cancel-confirm]`).click();
    await expect(page.locator(`${ROOT} [data-flash]`)).toContainText('בוטלה');
    expect(m.cancels).toHaveLength(1);
    expect(m.cancels[0]).toMatchObject({ path: 'jobs/job-1/cancel', body: { confirmed: true, revision: 3 } });
    expect(String(m.cancels[0].body.client_request_id)).toMatch(/^[0-9a-f]{32}$/);
    await expect(page.locator(`${ROOT} [data-job="job-1"] [data-pill="state"]`)).toContainText('בוטל');
    await expect(page.locator(`${ROOT} [data-job="job-1"] [data-job-cancel]`)).toHaveCount(0);
  });

  test('a refused cancel says nothing changed; an unknown outcome blocks a blind repeat', async ({ page }) => {
    const m = newOpsMock({ cancel: 'refused' });
    await open(page, m, '/system/intercom-operations/operations', `${ROOT} [data-jobs] [data-job]`);
    await page.locator(`${ROOT} [data-job="job-1"] [data-job-cancel]`).click();
    await page.locator(`${DIALOG} [data-cancel-confirm]`).click();
    await expect(page.locator(`${DIALOG} [data-cancel-error]`)).toContainText('לא בוצע שינוי');
    await expect(page.locator(`${DIALOG} [data-cancel-confirm]`)).toHaveAttribute('disabled', '');
    await page.locator(`${DIALOG} [data-cancel-keep]`).click();
    m.cancel = 'unknown';
    await page.locator(`${ROOT} [data-job="job-1"] [data-job-cancel]`).click();
    await page.locator(`${DIALOG} [data-cancel-confirm]`).click();
    await expect(page.locator(`${DIALOG} [data-cancel-error]`)).toContainText('ייתכן שהמשימה בוטלה');
    await expect(page.locator(`${DIALOG} [data-cancel-confirm]`)).toHaveAttribute('disabled', '');
    expect(m.cancels).toHaveLength(2);
  });

  test('an operator sees the jobs but cannot cancel or export', async ({ page }) => {
    await open(page, newOpsMock({ persona: 'operator' }), '/system/intercom-operations/operations', `${ROOT} [data-jobs] [data-job]`);
    await expect(page.locator(`${ROOT} [data-job-cancel]`)).toHaveCount(0);
    await expect(page.locator(`${ROOT} [data-job-errors-csv]`)).toHaveCount(0);
    await page.locator(`${ROOT} [data-ops-tab="exports"]`).click();
    await expect(page.locator(`${ROOT} [data-exports] [data-part-state="forbidden"]`)).toBeVisible();
  });

  test('the timeline: three sources side by side; hidden person fields say so', async ({ page }) => {
    const m = newOpsMock();
    await open(page, m, '/system/intercom-operations/investigations', `${ROOT} [data-timeline] [data-tl]`);
    await expect(page.locator(`${ROOT} [data-tl]`)).toHaveCount(4);
    await expect(page.locator(`${ROOT} [data-tl="change/12"] [data-actor]`)).toContainText('מנהל המערכת');
    expect(m.requests.some((u) => u.startsWith('investigations?') && u.includes('start=2026-09-20T10%3A30%3A00Z'))).toBe(true);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newOpsMock({ hidePeople: true, persona: 'viewer' }), '/system/intercom-operations/investigations', `${ROOT} [data-timeline] [data-tl]`);
    await expect(page.locator(`${ROOT} [data-hidden-fields]`)).toBeVisible();
    await expect(page.locator(`${ROOT} [data-person]`)).toHaveCount(0);
    await expect(page.locator(`${ROOT} [data-timeline] input[data-filter="query"]`)).toHaveCount(0);
  });

  test('capacity: meters by tone, the trend chart with its limit, a table twin', async ({ page }) => {
    const m = newOpsMock();
    await open(page, m, '/system/intercom-operations/capacity', `${ROOT} [data-capacity] [data-cap]`);
    await expect(page.locator(`${ROOT} [data-cap="entry-c"] [data-meter="users"]`)).toHaveAttribute('data-tone', 'warn');
    await expect(page.locator(`${ROOT} [data-cap="entry-c"] [data-pill="alert"]`)).toContainText('קרוב למגבלה');
    const chart = page.locator(`${ROOT} wk-ops-trend-chart`);
    await expect(chart.locator('[data-trend-chart]')).toBeVisible();
    await expect(chart.locator('[data-trend-limit]')).toHaveCount(1);
    await chart.locator('[data-chart-table-toggle]').click();
    await expect(chart.locator('[data-chart-table] tbody tr')).toHaveCount(10);
    await page.locator(`${ROOT} select[data-filter="trend-days"]`).selectOption('90');
    await expect.poll(() => m.requests.includes('capacity?days=90')).toBe(true);
  });

  test('the events report: KPIs, the day chart with its legend and tooltip, by station and anomalies', async ({ page }) => {
    await open(page, newOpsMock(), '/system/intercom-operations/events', `${ROOT} [data-events] wk-ops-day-chart`);
    await expect(page.locator(`${ROOT} sw-kpi[data-kpi="denied"]`)).toHaveAttribute('value', '14');
    const chart = page.locator(`${ROOT} wk-ops-day-chart`);
    await expect(chart.locator('[data-day]')).toHaveCount(7);
    await expect(chart.locator('[data-chart-legend] span')).toHaveCount(2);
    await chart.locator('[data-day="2026-09-23"]').focus();
    await expect(chart.locator('[data-chart-tip]')).toContainText('5');
    await expect(page.locator(`${ROOT} [data-ev-stations] tbody tr`)).toHaveCount(3);
    await expect(page.locator(`${ROOT} [data-ev-anomalies]`)).toContainText('דלת לא נסגרה');
  });

  test('exports: an administrator downloads each file once; nothing is downloaded by looking', async ({ page }) => {
    const m = newOpsMock();
    await open(page, m, '/system/intercom-operations/exports', `${ROOT} [data-exports] [data-export-btn="inventory"]`);
    expect(m.exports).toHaveLength(0);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(`${ROOT} [data-export-btn="inventory"]`).click()]);
    expect(dl.suggestedFilename()).toBe('intercom-export.csv');
    await expect(page.locator(`${ROOT} [data-export-msg="inventory"]`)).toContainText('3 שורות');
    await Promise.all([page.waitForEvent('download'), page.locator(`${ROOT} [data-export-btn="audit"]`).click()]);
    expect(m.exports).toEqual(['exports/fleet-inventory.csv', 'exports/audit.csv']);
  });

  test('forbidden without access.read at the installation; an unavailable view and a failed part say so', async ({ page }) => {
    await open(page, newOpsMock({ persona: 'scoped' }), '/system/intercom-operations', `${ROOT} sw-page[data-state="forbidden"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newOpsMock({ unsupported: new Set(['capacity']) }), '/system/intercom-operations/capacity', `${ROOT} [data-capacity] [data-part-state="unavailable"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newOpsMock({ fail: new Set(['events_report']) }), '/system/intercom-operations/events', `${ROOT} [data-events] [data-part-state="error"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newOpsMock({ fail: new Set(['summary']) }), '/system/intercom-operations', `${ROOT} [data-part-state="error"]`);
  });

  test('the settings column offers the area; a replaced deep link lands on its tab', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/events', `${ROOT} [data-ops-tab="events"][aria-current="page"]`);
    if (info.project.name === 'desktop') await expect(page.locator('sw-app system-nav a[href="#/system/intercom-operations"]').first()).toBeVisible();
    await page.locator(`${ROOT} [data-ops-tab="capacity"]`).click();
    await expect(page.locator(`${ROOT} [data-ops-tab="capacity"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`${ROOT} [data-capacity]`)).toBeVisible();
  });

  // ---------------------------------------------------------------- pixels (loading / empty / error / ready, desktop and phone)

  test('classic is pixel-stable: the overview', async ({ page }, info) => {
    await open(page, newOpsMock());
    await settlePage(page);
    await compare(page, info, 'intercom-ops-overview');
  });

  test('classic is pixel-stable: operations and jobs', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/operations', `${ROOT} [data-jobs] [data-job]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-ops-view="operations"]`, 'intercom-ops-operations');
  });

  test('classic is pixel-stable: the cancel confirmation box', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/operations', `${ROOT} [data-jobs] [data-job]`);
    await page.locator(`${ROOT} [data-job="job-1"] [data-job-cancel]`).click();
    await expect(page.locator(DIALOG)).toBeVisible();
    await settlePage(page);
    await compareEl(page, info, `${DIALOG} .box`, 'intercom-ops-cancel-box');
  });

  test('classic is pixel-stable: the investigations timeline', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/investigations', `${ROOT} [data-timeline] [data-tl]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-timeline]`, 'intercom-ops-timeline');
  });

  test('classic is pixel-stable: capacity and the trend chart', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/capacity', `${ROOT} wk-ops-trend-chart [data-trend-chart]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-ops-view="capacity"]`, 'intercom-ops-capacity');
  });

  test('classic is pixel-stable: the events report and its chart', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/events', `${ROOT} wk-ops-day-chart [data-day-chart]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-events]`, 'intercom-ops-events');
  });

  test('classic is pixel-stable: exports', async ({ page }, info) => {
    await open(page, newOpsMock(), '/system/intercom-operations/exports', `${ROOT} [data-export-btn="audit"]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-exports]`, 'intercom-ops-exports');
  });

  test('classic is pixel-stable: empty and error parts', async ({ page }, info) => {
    await open(page, newOpsMock({ empty: true }), '/system/intercom-operations/operations', `${ROOT} [data-jobs] [data-part-state="empty"]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-ops-view="operations"]`, 'intercom-ops-empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newOpsMock({ fail: new Set(['events_report']) }), '/system/intercom-operations/events', `${ROOT} [data-events] [data-part-state="error"]`);
    await settlePage(page);
    await compareEl(page, info, `${ROOT} [data-events]`, 'intercom-ops-error');
  });
});
