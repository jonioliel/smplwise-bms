import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { installSchedWritesMock, newRead, newSchedMock, type SchedMock } from './schedule-writes-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-SCHED-READS-2520 - the signed schedule READS block (WisKey `wiskey-schedule-reads.v1`) inside the schedule library's management
// view, behind the real shell, against the MOCKED backend (tests/schedule-writes-mocks.ts: invented data, no station, no integration).
// Desktop and phone. What it pins:
//   - unsupported (the default: WisKey does not list the two commands): one honest line, no start control, nothing posted;
//   - supported: a start posts exactly {action, parameters} (the browser never makes or sends a request id), the row says "accepted"
//     (not done), a status check moves it on, the completed result is summarised read-only;
//   - an UNKNOWN row says that only a status check can tell and offers a status check only - never a second start;
//   - the existing deploy warning ("Arx does not change the stations") stays; no platform name anywhere; the block does not scroll.
// Evidence images: docs/design/evidence/wiskey-schedule-reads-2520/.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'wiskey-schedule-reads-2520');
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const BLOCK = `${LIB} wk-schedule-reads`;
const ON = { 'access.ui.schedules': 'smplwise' };
const BANNED = /home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
const SUPPORTED = { state: 'supported', reason: null, contract: 'wiskey-schedule-reads.v1' };

async function boot(page: Page, over: Partial<SchedMock> = {}): Promise<SchedMock> {
  await installAccessMock(page, { settings: ON });
  const m = newSchedMock(over);
  await installSchedWritesMock(page, m);
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

const posts = (m: SchedMock, action: string) => m.posts.filter((p) => p.action === action);

test.describe('the signed schedule reads block', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('unsupported: one honest line, no start control, nothing sent; the deploy warning stays', async ({ page }, info) => {
    const m = await boot(page);
    const block = page.locator(`${BLOCK} [data-sr]`);
    await expect(block).toHaveAttribute('data-sr-state', 'unsupported');
    await expect(page.locator(`${BLOCK} [data-sr-support="unsupported"]`)).toContainText('אינה מציעה');
    await expect(page.locator(`${BLOCK} [data-sr-start]`)).toHaveCount(0);
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toBeVisible();
    expect(posts(m, 'reads')).toEqual([]);
    expect(await block.innerText()).not.toMatch(BANNED);
    await shot(page, info, 'sched-reads-unsupported');
  });

  test('supported: start -> accepted -> status checks -> completed, read only, one start only', async ({ page }, info) => {
    const m = await boot(page, { readsSupport: SUPPORTED });
    await expect(page.locator(`${BLOCK} [data-sr]`)).toHaveAttribute('data-sr-state', 'supported');
    await expect(page.locator(`${BLOCK} [data-sr-none]`)).toBeVisible();
    await page.locator(`${BLOCK} [data-sr-start="readiness"]`).click();
    const row = page.locator(`${BLOCK} [data-sr-read]`).first();
    await expect(row).toHaveAttribute('data-state', 'accepted');
    expect(posts(m, 'reads').map((p) => p.body)).toEqual([{ action: 'readiness', parameters: { station_id: posts(m, 'reads')[0].body.parameters.station_id } }]);
    expect(Object.keys(posts(m, 'reads')[0].body).sort()).toEqual(['action', 'parameters']);
    await row.locator('[data-sr-check]').click();
    await expect(row).toHaveAttribute('data-state', 'running');
    await row.locator('[data-sr-check]').click();
    await expect(row).toHaveAttribute('data-state', 'completed');
    await expect(row).toContainText('3 מתוך 4');
    await expect(row.locator('[data-sr-check]')).toHaveCount(0);
    expect(posts(m, 'reads')).toHaveLength(1);
    expect(posts(m, 'reads_status')).toHaveLength(2);
    expect(await page.locator(`${BLOCK} [data-sr]`).innerText()).not.toMatch(BANNED);
    await shot(page, info, 'sched-reads-completed');
  });

  test('an unknown start is settled by a status check only, never by a second start', async ({ page }, info) => {
    const lost = newRead('dependencies', 'entry-a', 'unknown', { wiskey_code: 'media_outcome_unknown' });
    const m = await boot(page, { readsSupport: SUPPORTED, reads: [lost] });
    const row = page.locator(`${BLOCK} [data-sr-read="${lost.request_id}"]`);
    await expect(row).toHaveAttribute('data-state', 'unknown');
    await expect(row).toContainText('רק בדיקת מצב');
    await shot(page, info, 'sched-reads-unknown');
    await row.locator('[data-sr-check]').click();
    await expect(row).toHaveAttribute('data-state', 'completed');
    await expect(row).toContainText('14');
    expect(posts(m, 'reads')).toEqual([]);
    expect(posts(m, 'reads_status').map((p) => p.body.request_id)).toEqual([lost.request_id]);
  });

  test('refused and not-sent rows say why and offer nothing; the block never scrolls', async ({ page }) => {
    const reads = [
      newRead('readiness', 'entry-a', 'refused', { wiskey_code: 'station_offline' }),
      newRead('readiness', 'entry-b', 'not_sent', { wiskey_code: 'connection_closed' }),
    ];
    await boot(page, { readsSupport: SUPPORTED, reads });
    await expect(page.locator(`${BLOCK} [data-sr-read="${reads[0].request_id}"]`)).toContainText('העמדה אינה מחוברת');
    await expect(page.locator(`${BLOCK} [data-sr-check]`)).toHaveCount(0);
    const overflow = await page.locator(`${BLOCK} [data-sr]`).evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
