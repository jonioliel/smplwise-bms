import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { newMock, type Mock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock, type BatchDriver, type BatchMock } from './nvr-batch-mock';

// CAM-H264-VERIFY-2361 evidence (mocked backend, no device): (1) the skip / stop row of the encoding preview and what the confirmation and the
// start carry; (2) the verification report dialog "דוח בדיקה" that opens when an encoding change completes - summary, tabs, a row per stream
// with its chip and line, the skipped tab - and the read-only "בדוק שוב". The server's own verification is proven by the backend tests with a
// fake NVR and a fake go2rtc; here the mock only answers what the contract says (docs/changes/CAM-H264-VERIFY-2361.md).
// Runs on the Vite dev server of the runner, all three projects. Screenshots: SW_SHOTS=../docs/evidence/CAM-H264-VERIFY-2361.
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const ENC = `${PAGE} nvr-encoding-batch`;
const DLG = `${ENC} sw-dialog[open][data-nvr-enc]`;
const CONFIRM = `${ENC} sw-dialog[open][data-nvr-confirm-dialog]`;
const PROG = `${PAGE} nvr-camera-batch sw-dialog[open][data-nvr-batch-progress]`;
const REPORT = `${PAGE} nvr-verify-report sw-dialog[open][data-nvr-verify]`;
const POLL = { timeout: 9_000 };
// The main streams of cameras 1..4: 1 and 3 are H.264 with SVC on, 2 and 4 are H.265, so all four really change under H.264 + SVC off.
// (A sub stream such as cam-2:202 is already H.264 and has no SVC: the preview rightly counts it as "כבר מוגדרים", not as a change.)
const STREAMS = ['cam-1:101', 'cam-2:201', 'cam-3:301', 'cam-4:401'];

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

async function open(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/security/cameras');
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
}

async function pick(page: Page, dd: string, id: string) {
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [data-dropdown-chip]`).click();
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [role="option"][data-id="${id}"]`).click();
}

/** The toolbar -> four main streams (cameras 1..4) -> codec H.264 + SVC off -> the preview (four changes, none already set). */
async function toPreview(page: Page) {
  await expect(page.locator(`${PAGE} [data-nvr-encoding-open]`)).toBeVisible();
  await page.locator(`${PAGE} [data-nvr-encoding-open]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'select');
  await expect(page.locator(`${DLG} [data-nvr-enc-stream="cam-1:101"]`)).toHaveAttribute('aria-disabled', 'false');
  for (const k of STREAMS) await page.locator(`${DLG} [data-nvr-enc-stream="${k}"]`).click();
  await page.locator(`${DLG} [data-nvr-enc-next]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'settings');
  await pick(page, 'codec-target', 'H.264');
  await pick(page, 'svc-target', 'off');
  await page.locator(`${DLG} [data-nvr-enc-preview]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
  await expect(page.locator(`${DLG} [data-nvr-enc-summary]`)).toHaveText('ישתנו 4 זרמים');
}

test.describe('CAM-H264-VERIFY-2361 refusal choice and verification report (mocked backend)', () => {
  let st: Mock;
  let bm: BatchMock;
  let d: BatchDriver;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(5, { h265: [2, 4], offline: [5] });
    bm = newBatchMock();
    d = await installBatch(page, st, bm);
  });

  test('preview: the skip / stop row is preselected from the server default, the confirmation says what a refusal does, the start carries the choice', async ({ page }) => {
    bm.onRefusal = 'skip';
    await open(page);
    await toPreview(page);
    const row = page.locator(`${DLG} [data-nvr-enc-refusal]`);
    await expect(row).toBeVisible();
    await expect(row.locator('sw-dropdown[data-nvr-enc-dd="on-refusal"] [data-dropdown-chip]')).toContainText('לדלג ולהמשיך');
    await expect(row.locator('[data-nvr-enc-refusal-hint]')).toContainText('וההמרה ממשיכה לשאר המצלמות');
    await shot(page, 'verify-01-preview-skip');
    await pick(page, 'on-refusal', 'stop');
    await expect(row.locator('[data-nvr-enc-refusal-hint]')).toContainText('ההמרה נעצרת במצלמה הראשונה');
    await shot(page, 'verify-02-preview-stop');
    expect(st.writes).toEqual([]); // choosing never writes
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    const confirm = page.locator(CONFIRM);
    await expect(confirm.locator('[data-nvr-confirm-lead]')).toContainText('ויעצור בשגיאה הראשונה');
    await expect(confirm.locator('[data-nvr-confirm-lead]')).toContainText('תוצג בדיקה');
    await confirm.locator('[data-nvr-confirm]').click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    expect(bm.encodingStarts).toHaveLength(1);
    expect(bm.encodingStarts[0].on_refusal).toBe('stop');
  });

  test('preview: a server that names no default (older server) shows no refusal row and the start carries no on_refusal', async ({ page }) => {
    await open(page);
    await toPreview(page);
    await expect(page.locator(`${DLG} [data-nvr-enc-refusal]`)).toHaveCount(0);
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm-lead]`)).not.toContainText('תדולג');
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    expect(bm.encodingStarts).toHaveLength(1);
    expect('on_refusal' in bm.encodingStarts[0]).toBe(false);
  });

  test('a completed change opens the report: summary, a chip and a line per stream, the worklist and skipped tabs, then a read-only re-check', async ({ page }) => {
    bm.onRefusal = 'skip';
    await open(page);
    await toPreview(page);
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    const b = d.last;
    // the report the server would keep: 1 confirmed, 1 still H.265, 1 skipped (refused by the NVR), 1 accepted but not checked at the camera
    b.items[0].verify = { outcome: 'confirmed', label: 'המצלמה אישרה (H.264)', detail: 'המצלמה שולחת H.264.', expected: 'H.264' };
    b.items[1].verify = { outcome: 'still_old', label: 'עדיין H.265', detail: 'ה־NVR קיבל, אבל המצלמה עדיין שולחת H.265.', media_codec: 'H.265' };
    b.items[2].verify = { outcome: 'failed', label: 'נכשל: ה־NVR דחה את השינוי', detail: 'דולג, וההמרה המשיכה לשאר המצלמות.', skipped: true };
    b.items[3].verify = { outcome: 'nvr_accepted', label: 'המקליט קיבל', detail: 'המצלמה לא נבדקה: שרת המדיה לא ענה.' };
    const counts = { confirmed: 1, nvr_accepted: 1, still_old: 1, restart_needed: 0, failed: 1, unchanged: 0 };
    const at = '2026-11-02T10:00:00Z';
    b.extra = {
      on_refusal: 'skip', skipped: 1, created_at: at,
      verify: {
        state: 'done', kind: 'after_apply', counts, can_recheck: true, checked_at: at, started_at: at,
        worklist: [{ index: 1, camera_id: 'cam-2', stream_ref: '201', outcome: 'still_old' }, { index: 2, camera_id: 'cam-3', stream_ref: '301', outcome: 'failed', skipped: true }],
        skipped: [{ index: 2, camera_id: 'cam-3', stream_ref: '301', outcome: 'failed', skipped: true }],
      },
    };
    bm.recheck = (x) => {
      x.items[1].verify = { outcome: 'confirmed', label: 'המצלמה אישרה (H.264)', detail: 'המצלמה שולחת H.264.', expected: 'H.264' };
      const v = (x.extra as { verify: { counts: Record<string, number>; worklist: unknown[] } }).verify;
      v.counts = { ...counts, confirmed: 2, still_old: 0 };
      v.worklist = [{ index: 2, camera_id: 'cam-3', stream_ref: '301', outcome: 'failed', skipped: true }];
    };
    // item 2 is refused by the NVR and stepped over (the batch goes on), the others are applied
    d.step();
    d.step();
    b.items[2].status = 'refused';
    b.items[2].error_code = 'nvr_rejected';
    b.items[2].skipped = true;
    d.step(); // claims the next stream
    d.step();
    expect(b.state).toBe('completed');

    const report = page.locator(REPORT);
    await expect(report).toHaveAttribute('heading', 'דוח בדיקה · שינוי קידוד', POLL);
    await expect(report.locator('[data-nvr-verify-summary]')).toContainText('המצלמה אישרה: זרם אחד');
    await expect(report.locator('[data-nvr-verify-summary]')).toContainText('עדיין בקידוד הקודם: זרם אחד');
    await expect(report.locator('[data-nvr-verify-summary]')).toContainText('דולגו: זרם אחד');
    await expect(report.locator('[data-nvr-verify-item]')).toHaveCount(4);
    await expect(report.locator('[data-nvr-verify-item="0"] [data-nvr-verify-chip]')).toHaveText('המצלמה אישרה (H.264)');
    await expect(report.locator('[data-nvr-verify-item="1"] [data-nvr-verify-chip]')).toHaveText('עדיין H.265');
    await expect(report.locator('[data-nvr-verify-item="1"] [data-nvr-verify-detail]')).toContainText('המצלמה עדיין שולחת H.265');
    await expect(report.locator('[data-nvr-verify-item="2"] [data-nvr-verify-chip]')).toContainText('נכשל');
    await expect(report.locator('[data-nvr-verify-item="3"] [data-nvr-verify-chip]')).toHaveText('המקליט קיבל');
    await expect(report.locator('[data-nvr-verify-item="0"] .nm')).toContainText('מצלמה 1 · ראשי');
    await expect(report.locator('[data-nvr-verify-hint]')).toContainText('קוראת בלבד');
    await shot(page, 'verify-03-report');

    // the worklist ("מצלמות שלא השתנו") and the skipped tab
    await report.locator('sw-tabs[data-nvr-verify-tabs]').getByText('מצלמות שלא השתנו').click();
    await expect(report.locator('[data-nvr-verify-item]')).toHaveCount(2);
    await shot(page, 'verify-04-worklist');
    await report.locator('sw-tabs[data-nvr-verify-tabs]').getByText('דולגו').click();
    await expect(report.locator('[data-nvr-verify-item]')).toHaveCount(1);
    await expect(report.locator('[data-nvr-verify-item="2"]')).toHaveAttribute('data-outcome', 'failed');

    // "בדוק שוב": one read-only POST, the report updates in place, nothing is written to a camera
    const writes = st.writes.length;
    await report.locator('sw-tabs[data-nvr-verify-tabs]').getByText('מצלמות שלא השתנו').click();
    await report.locator('[data-nvr-verify-recheck]').click();
    await expect(report.locator('[data-nvr-verify-summary]')).toContainText('המצלמה אישרה: 2 זרמים', POLL);
    await expect(report.locator('[data-nvr-verify-item]')).toHaveCount(1);
    expect(bm.calls.filter((c) => c.method === 'POST' && c.path === `nvr/stream-batches/${b.batch_id}/verify`)).toHaveLength(1);
    expect(st.writes.length).toBe(writes);
    await shot(page, 'verify-05-rechecked');

    await report.locator('[data-nvr-verify-close]').click();
    await expect(page.locator(REPORT)).toHaveCount(0);
  });

  test('a re-check the server refuses shows its line in the report (nothing to check again)', async ({ page }) => {
    await open(page);
    await toPreview(page);
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    const b = d.last;
    const at = '2026-11-02T10:00:00Z';
    b.items.forEach((i) => (i.verify = { outcome: 'confirmed', label: 'המצלמה אישרה (H.264)', detail: '', expected: 'H.264' }));
    b.extra = { verify: { state: 'done', kind: 'after_apply', counts: { confirmed: 4, nvr_accepted: 0, still_old: 0, restart_needed: 0, failed: 0, unchanged: 0 }, worklist: [], skipped: [], can_recheck: true, checked_at: at, started_at: at } };
    d.run();
    const report = page.locator(REPORT);
    await expect(report.locator('[data-nvr-verify-summary]')).toContainText('המצלמה אישרה: 4 זרמים', POLL);
    await report.locator('sw-tabs[data-nvr-verify-tabs]').getByText('מצלמות שלא השתנו').click();
    await expect(report.locator('[data-nvr-verify-empty]')).toHaveText('כל המצלמות השתנו.');
    await report.locator('[data-nvr-verify-recheck]').click(); // the mock answers 409 nothing_to_verify
    await expect(report.locator('[data-nvr-verify-line]')).toHaveText('אין מצלמות לבדיקה חוזרת.', POLL);
    await shot(page, 'verify-06-nothing-to-check');
  });
});
