import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock } from './schedule-writes-mocks';
import { execRead, installExecMock, newExecMock, type ExecMock } from './schedule-exec-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-A2-EXEC-2530 - the read-only "status in WisKey" block of the schedule library's management view (owner 25.11, A2 option b:
// the owner approves and runs in WisKey's own screen; Arx shows the status only), behind the real shell, against the MOCKED backend
// (tests/schedule-exec-mocks.ts over tests/schedule-writes-mocks.ts: invented data). Desktop and phone. What it pins:
//   - off (the default): an administrator sees one line with the switch, nothing is read; without the switch right nothing at all;
//   - on: the hint that approval and running happen only in WisKey's screen; a status check posts ONLY .../{job}/status - there is no
//     control that approves, runs, previews or cancels; an executed read is final (no check offered);
//   - the deploy warning stays as it was until a read showed a job executed, then says what is still true (owner runs it in WisKey);
//   - unsupported: one honest line, checks disabled; no platform name anywhere; the block does not scroll.
// Evidence images: docs/design/evidence/wiskey-schedule-exec-2530/.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'wiskey-schedule-exec-2530');
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const BLOCK = `${LIB} wk-schedule-exec`;
const ON = { 'access.ui.schedules': 'smplwise' };
const BANNED = /home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
const DONE = execRead('job-a1', 'executed', { job_status: 'verified', deployment_status: 'verified', steps_total: 2, steps_verified: 2 });

async function boot(page: Page, over: Partial<ExecMock> = {}): Promise<ExecMock> {
  await installAccessMock(page, { settings: ON });
  await installSchedWritesMock(page, newSchedMock());
  const m = newExecMock(over);
  await installExecMock(page, m);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url('/wiskey/schedules?manage=1'));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${LIB} [data-se-row="sch-contractors"]`)).toBeVisible({ timeout: 30_000 });
  return m;
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.locator(BLOCK).scrollIntoViewIfNeeded();
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

const writes = (m: ExecMock) => m.calls.filter((c) => c.method !== 'GET');

test.describe('the read-only status in WisKey block', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('off by default: one switch line for the administrator, nothing read, the warning unchanged', async ({ page }, info) => {
    const m = await boot(page);
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveAttribute('data-sx-state', 'off');
    await expect(page.locator(`${BLOCK} [data-sx-switch]`)).toBeVisible();
    await expect(page.locator(`${BLOCK} [data-sx-job]`)).toHaveCount(0);
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toHaveAttribute('data-sx-owner-ran', 'no');
    expect(writes(m)).toEqual([]);
    await shot(page, info, 'sched-exec-off');
  });

  test('on: waiting for the owner, a check posts only the status read, an executed job softens the warning', async ({ page }, info) => {
    const m = await boot(page, {
      enabled: true,
      next: {
        'job-a1': DONE,
        'job-c1': execRead('job-c1', 'review_pending', { job_status: 'ready', station_id: 'entry-c', reviews: { pending: 1, approved: 0, rejected: 0 } }),
      },
    });
    const block = page.locator(`${BLOCK} [data-sx]`);
    await expect(block).toHaveAttribute('data-sx-state', 'supported');
    await expect(page.locator(`${BLOCK} [data-sx-job]`)).toHaveCount(3);
    await expect(page.locator(`${BLOCK} [data-sx-job="job-a2"]`)).toHaveAttribute('data-phase', 'not_read');
    // no control that approves, runs, previews or cancels: the only action is the status check
    const buttons = await page.locator(`${BLOCK} wk-action-button`).evaluateAll((els) => els.map((e) => Object.keys((e as HTMLElement).dataset)));
    expect(buttons.flat().every((k) => k === 'sxCheck')).toBe(true);
    await page.locator(`${BLOCK} [data-sx-check="job-a2"]`).click();
    await expect(page.locator(`${BLOCK} [data-sx-job="job-a2"]`)).toHaveAttribute('data-phase', 'waiting_owner');
    await page.locator(`${BLOCK} [data-sx-check="job-c1"]`).click();
    await expect(page.locator(`${BLOCK} [data-sx-job="job-c1"]`)).toHaveAttribute('data-phase', 'review_pending');
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toHaveAttribute('data-sx-owner-ran', 'no');
    await page.locator(`${BLOCK} [data-sx-check="job-a1"]`).click();
    await expect(page.locator(`${BLOCK} [data-sx-job="job-a1"]`)).toHaveAttribute('data-phase', 'executed');
    await expect(page.locator(`${BLOCK} [data-sx-check="job-a1"]`)).toHaveCount(0); // final: never read again
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toHaveAttribute('data-sx-owner-ran', 'yes');
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toContainText('במסך של WisKey');
    expect(writes(m).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST schedules/execution/job-a2/status',
      'POST schedules/execution/job-c1/status',
      'POST schedules/execution/job-a1/status',
    ]);
    expect(writes(m).every((c) => c.body === null || Object.keys(c.body ?? {}).length === 0)).toBe(true);
    expect(await block.innerText()).not.toMatch(BANNED);
    const scrolls = await page.locator(BLOCK).evaluate((el) => {
      const inner = el.shadowRoot?.querySelector('.block') as HTMLElement | null;
      return inner ? inner.scrollHeight > inner.clientHeight + 1 : false;
    });
    expect(scrolls).toBe(false);
    await shot(page, info, 'sched-exec-on');
  });

  test('unsupported: one honest line and no check is offered', async ({ page }, info) => {
    const m = await boot(page, { enabled: true, support: { state: 'unsupported', reason: 'not_listed', contract: 'wiskey-schedule-execution.v1' } });
    await expect(page.locator(`${BLOCK} [data-sx-support="unsupported"]`)).toBeVisible();
    for (const b of await page.locator(`${BLOCK} [data-sx-check]`).all()) await expect(b).toHaveAttribute('disabled', '');
    expect(writes(m)).toEqual([]);
    await shot(page, info, 'sched-exec-unsupported');
  });

  test('the switch turns it on and off, and off forgets the reads', async ({ page }) => {
    const m = await boot(page);
    await page.locator(`${BLOCK} [data-sx-switch]`).click();
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveAttribute('data-sx-state', 'supported');
    await page.locator(`${BLOCK} [data-sx-check="job-a2"]`).click();
    await expect(page.locator(`${BLOCK} [data-sx-job="job-a2"]`)).toHaveAttribute('data-phase', 'waiting_owner');
    await page.locator(`${BLOCK} [data-sx-switch]`).click();
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveAttribute('data-sx-state', 'off');
    expect(writes(m).filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ enabled: true }, { enabled: false }]);
  });

  test('a user who may not change the switch sees nothing while it is off', async ({ page }) => {
    await boot(page, { canConfigure: false });
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveCount(0);
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toBeVisible();
  });
});
