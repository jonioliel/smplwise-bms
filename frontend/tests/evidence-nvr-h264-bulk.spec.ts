import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { newMock, type Mock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock, type BatchDriver, type BatchMock } from './nvr-batch-mock';
import { installMulti } from './multi-nvr-mock';

// NVR-H264-BULK-2341 evidence (mocked backend, runner only - NOT run on the workstation): the one-click "המר את כל הזרמים ל־H.264" in
// "שינוי קידוד לכמה מצלמות" (scope + role, the reason line, the SAME preview / confirmation / progress / undo-all as any bulk change, the undo
// reading "החזר לערכים הקודמים") and the switch "אפשר שינויי הגדרות ב־NVR" in Settings › connections (off by default for Provision-ISR, the
// Hebrew confirmation before turning it on, off at once without a question). The server's rules are the backend tests
// (tests/test_nvr_h264_bulk_2341.py, fake NVR).
//   ~/run_remote.sh spec <branch> tests/evidence-nvr-h264-bulk.spec.ts      (SW_SHOTS=../docs/evidence/NVR-H264-BULK-2341 for screenshots)
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const ENC = `${PAGE} nvr-encoding-batch`;
const DLG = `${ENC} sw-dialog[open][data-nvr-enc]`;
const CONFIRM = `${ENC} sw-dialog[open][data-nvr-confirm-dialog]`;
const PROG = `${PAGE} nvr-camera-batch sw-dialog[open][data-nvr-batch-progress]`;
const CARD = 'sw-app system-setup nvr-recorders-card';
const POLL = { timeout: 9_000 };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

async function pick(page: Page, dd: string, id: string) {
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [data-dropdown-chip]`).click();
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [role="option"][data-id="${id}"]`).click();
}

test.describe('NVR-H264-BULK-2341: convert every stream to H.264 (mocked backend)', () => {
  let st: Mock;
  let bm: BatchMock;
  let d: BatchDriver;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(5, { h265: [2, 4], offline: [5] }); // mains 2, 4 on H.265; camera 5 offline
    bm = newBatchMock();
    d = await installBatch(page, st, bm);
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/security/cameras');
    await page.waitForSelector('sw-app');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    await page.locator(`${PAGE} [data-nvr-encoding-open]`).click();
    await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'select');
    await expect(page.locator(`${DLG} [data-nvr-enc-stream="cam-1:101"]`)).toHaveAttribute('aria-disabled', 'false');
  });

  test('the preset: the reason, all cameras + main streams, the same preview, ONE confirmation, progress and "החזר לערכים הקודמים"', async ({ page }) => {
    const preset = page.locator(`${DLG} [data-nvr-h264-preset]`);
    await expect(preset).toContainText('המר את כל הזרמים ל־H.264');
    await expect(preset.locator('[data-nvr-h264-why]')).toContainText('H.264 מנגן בשידור חי בכל דפדפן; H.265 חוסך נפח הקלטה אך לא מנגן ב-Chrome/Edge.');
    await expect(preset.locator('[data-nvr-h264-why]')).toContainText('נפח ההקלטה');
    await shot(page, 'h264-01-preset');
    await pick(page, 'h264-role', 'main');
    await expect(preset.locator('[data-nvr-h264-run]')).toHaveText('המר 4 זרמים ל־H.264'); // camera 5 is offline: not sent
    expect(bm.calls).toEqual([]); // choosing writes nothing and reads nothing
    await preset.locator('[data-nvr-h264-run]').click();
    await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
    const body = bm.calls.find((c) => c.path === 'nvr/encoding-batches/preview')?.body;
    expect(body.settings).toEqual({ codec: 'H.264' }); // only the codec: every other field "ללא שינוי"
    expect(body.targets.map((t: { stream_ref: string }) => t.stream_ref)).toEqual(['101', '201', '301', '401']);
    await expect(page.locator(`${DLG} [data-nvr-h264-preview-note]`)).toContainText('אפשר להחזיר לערכים הקודמים');
    await expect(page.locator(`${DLG} [data-nvr-enc-summary]`)).toContainText('ישתנו 2 זרמים');
    expect(st.writes).toEqual([]);
    await shot(page, 'h264-02-preview');
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    expect(bm.encodingStarts).toHaveLength(1);
    await expect(page.locator(PROG)).toHaveAttribute('data-kind', 'write', POLL);
    d.run();
    const toast = page.locator(`${PAGE} nvr-undo-toast`);
    await expect(toast.locator('[data-nvr-undo]')).toHaveText('החזר לערכים הקודמים', POLL);
    expect(st.cameras[1].streams[0].codec).toBe('H.264');
    await shot(page, 'h264-03-done');
    await toast.locator('[data-nvr-undo]').click();
    await expect(page.locator(PROG)).toHaveAttribute('data-kind', 'rollback', POLL);
    d.run();
    await expect(toast.locator('[data-nvr-toast-text]')).toContainText('בוטל', POLL);
    expect(st.cameras[1].streams[0].codec).toBe('H.265');
  });

  test('selected cameras: the ticked camera with both its streams; nothing ticked = a line, no request', async ({ page }) => {
    await pick(page, 'h264-scope', 'selected');
    await expect(page.locator(`${DLG} [data-nvr-h264-run]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${DLG} [data-nvr-h264-empty]`)).toContainText('יש לסמן');
    await page.locator(`${DLG} [data-nvr-enc-stream="cam-2:201"]`).click();
    await page.locator(`${DLG} [data-nvr-h264-run]`).click();
    await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
    const body = bm.calls.find((c) => c.path === 'nvr/encoding-batches/preview')?.body;
    expect(body.targets).toEqual([{ camera_id: 'cam-2', stream_ref: '201' }, { camera_id: 'cam-2', stream_ref: '202' }]);
    await page.locator(`${DLG} [data-nvr-enc-back]`).click();
    await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'select'); // the preset's back goes to the checklist, not the form
  });
});

test.describe('NVR-H264-BULK-2341: the switch "אפשר שינויי הגדרות ב־NVR" (mocked backend)', () => {
  test('off by default; on only after the Hebrew confirmation; off at once without a question', async ({ page }) => {
    await installMulti(page, { count: 1 });
    const state = { enabled: false, explicit: false, at: '' };
    const sent: unknown[] = [];
    await page.route('**/api/v1/recorders/*/writes', async (route: Route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        const b = req.postDataJSON() as { enabled: boolean; confirm?: boolean };
        sent.push(b);
        state.enabled = b.enabled;
        state.explicit = true;
        state.at = '2026-11-01T08:00:00Z';
      }
      await route.fulfill({ json: { recorder_id: 'nvr-1', vendor: 'hikvision', supported: true, enabled: state.enabled, explicit: state.explicit, default: false,
        last_change: state.explicit ? { at: state.at, by: 'jon', enabled: state.enabled } : null, can_change: true } });
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/setup');
    await page.waitForSelector('sw-app');
    const sw = page.locator(`${CARD} nvr-writes-switch [data-nvr-writes]`);
    await expect(sw).toHaveAttribute('data-enabled', 'false', POLL);
    await expect(sw).toContainText('אפשר שינויי הגדרות ב־NVR');
    await expect(sw.locator('[data-nvr-writes-status]')).toHaveText('כבוי (ברירת המחדל)');
    await sw.locator('sw-toggle[data-nvr-writes-toggle]').click();
    const dlg = page.locator(`${CARD} nvr-writes-switch sw-dialog[open][data-nvr-writes-dialog]`);
    await expect(dlg).toHaveAttribute('heading', 'להפעיל שינויי הגדרות ב־NVR?');
    await expect(dlg.locator('li')).toHaveCount(3);
    expect(sent).toEqual([]); // nothing is sent before the confirmation
    await shot(page, 'h264-04-switch-confirm');
    await dlg.locator('[data-nvr-writes-confirm]').click();
    await expect(sw).toHaveAttribute('data-enabled', 'true', POLL);
    expect(sent).toEqual([{ enabled: true, confirm: true }]);
    await sw.locator('sw-toggle[data-nvr-writes-toggle]').click();
    await expect(sw).toHaveAttribute('data-enabled', 'false', POLL);
    expect(sent).toEqual([{ enabled: true, confirm: true }, { enabled: false }]); // off: no dialog, no confirmation
  });
});
