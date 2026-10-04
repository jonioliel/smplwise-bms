import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, newMock, type Mock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock, type BatchDriver, type BatchMock } from './nvr-batch-mock';

// CR-020 phase D evidence: "שינוי קידוד לכמה מצלמות" on מערכת › אבטחה › מצלמות against a STATEFUL mocked backend (tests/nvr-batch-mock.ts:
// a small model of the server's plan; the server's own plan and runner are proven by the backend tests with a fake NVR). The flow: the entry
// (toolbar, and the multi-camera checklist's link), the checklist with its filters and "select all", the target settings ("ללא שינוי" by
// default), the preview (before → after, adjusted values, streams that cannot be changed, the WebRTC line), ONE confirmation, the progress of
// the multi-camera dialog, the toast's undo-all, a stale start (the preview is read again), a failure at a stream, no permission, a phone.
// Runs on the Vite dev server of the runner, all three projects. Screenshots: SW_SHOTS=../docs/evidence/CR-020-encoding.
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const ENC = `${PAGE} nvr-encoding-batch`;
const DLG = `${ENC} sw-dialog[open][data-nvr-enc]`;
const CONFIRM = `${ENC} sw-dialog[open][data-nvr-confirm-dialog]`;
const PROG = `${PAGE} nvr-camera-batch sw-dialog[open][data-nvr-batch-progress]`;
const POLL = { timeout: 9_000 };

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

const streamRow = (page: Page, key: string) => page.locator(`${DLG} [data-nvr-enc-stream="${key}"]`);

async function pick(page: Page, dd: string, id: string) {
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [data-dropdown-chip]`).click();
  await page.locator(`${DLG} sw-dropdown[data-nvr-enc-dd="${dd}"] [role="option"][data-id="${id}"]`).click();
}

/** The toolbar button -> the checklist (waits until every camera's detail was read: rows become selectable). */
async function openEncoding(page: Page) {
  await expect(page.locator(`${PAGE} [data-nvr-encoding-open]`)).toBeVisible();
  await page.locator(`${PAGE} [data-nvr-encoding-open]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'select');
  await expect(streamRow(page, 'cam-1:101')).toHaveAttribute('aria-disabled', 'false');
}

/** Through the checklist (every main + sub of cameras 1..3) and the settings (codec H.264) to the preview. */
async function toPreview(page: Page, chs = [1, 2, 3], settings: [string, string][] = [['codec-target', 'H.264']]) {
  await openEncoding(page);
  for (const ch of chs) for (const k of ['01', '02']) await streamRow(page, `cam-${ch}:${ch}${k}`).click();
  await page.locator(`${DLG} [data-nvr-enc-next]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'settings');
  for (const [dd, id] of settings) await pick(page, dd, id);
  await page.locator(`${DLG} [data-nvr-enc-preview]`).click();
  await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'preview');
}

test.describe('CR-020 phase D bulk encoding change (mocked backend)', () => {
  let st: Mock;
  let bm: BatchMock;
  let d: BatchDriver;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(5, { h265: [2, 4], offline: [5] }); // mains 1, 3 H.264; 2, 4 H.265; 5 offline
    bm = newBatchMock();
    d = await installBatch(page, st, bm);
  });

  test('entry: the toolbar button and the multi-camera checklist link; nothing is requested by opening', async ({ page }) => {
    await open(page);
    await openEncoding(page);
    await expect(page.locator(DLG)).toHaveAttribute('heading', 'שינוי קידוד לכמה מצלמות');
    await shot(page, 'enc-01-checklist');
    await page.locator(`${DLG} [data-nvr-enc-cancel]`).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    // the SVC dialog's "החל גם על מצלמות נוספות" -> the checklist -> its "שינוי קידוד לכמה מצלמות"
    const tog = page.locator(`${PAGE} ${(page.viewportSize()?.width ?? 1440) < 900 ? '[data-nvr-cards] [data-stream-card]' : '[data-nvr-table] tr[data-stream-row]'}[data-camera="nvr-1:1"][data-stream="101"] sw-toggle[data-svc-toggle]`);
    await tog.click();
    await page.locator('sw-dialog[open][data-nvr-confirm-dialog] [data-nvr-extra]').click();
    await page.locator(`${PAGE} nvr-camera-batch [data-nvr-batch-to-encoding]`).click();
    await expect(page.locator(DLG)).toHaveAttribute('data-phase', 'select');
    expect(st.hits.filter((h) => h.includes('encoding-batches'))).toEqual([]);
    expect(bm.calls).toEqual([]);
  });

  test('checklist: every stream, offline not selectable, filters by role / codec / SVC / WebRTC, select all that match, search', async ({ page }) => {
    await open(page);
    await openEncoding(page);
    const dlg = page.locator(DLG);
    await expect(dlg.locator('[data-nvr-enc-count]')).toHaveText('נבחרו 0 מתוך 8');
    await expect(streamRow(page, 'cam-5:501')).toHaveAttribute('aria-disabled', 'true');
    await expect(streamRow(page, 'cam-5:501')).toContainText('המצלמה אינה מקוונת');
    await expect(dlg.locator('[data-nvr-enc-next]')).toHaveAttribute('disabled', '');
    await pick(page, 'role', 'main');
    await expect(dlg.locator('[data-nvr-enc-stream]')).toHaveCount(5);
    await pick(page, 'codec', 'h265');
    await expect(dlg.locator('[data-nvr-enc-stream]')).toHaveCount(2);
    await dlg.locator('[data-nvr-enc-all]').click();
    await expect(dlg.locator('[data-nvr-enc-count]')).toHaveText('נבחרו 2 מתוך 8 · 2 תוצאות');
    await dlg.locator('[data-nvr-enc-unfilter]').click();
    await pick(page, 'svc', 'none');
    await expect(dlg.locator('[data-nvr-enc-stream]')).toHaveCount(5); // the subs
    await dlg.locator('[data-nvr-enc-unfilter]').click();
    await dlg.locator('[data-nvr-enc-search]').fill('ערוץ 3');
    await expect(dlg.locator('[data-nvr-enc-stream]')).toHaveCount(2);
    await dlg.locator('[data-nvr-enc-all]').click();
    await expect(dlg.locator('[data-nvr-enc-count]')).toContainText('נבחרו 4 מתוך 8');
    await shot(page, 'enc-02-filters');
    await dlg.locator('[data-nvr-enc-clear]').click();
    await expect(dlg.locator('[data-nvr-enc-count]')).toContainText('נבחרו 0 מתוך 8');
  });

  test('settings "ללא שינוי" by default, preview with before → after, adjusted values and the WebRTC line, then ONE confirmation, progress, toast and undo-all', async ({ page }) => {
    await open(page);
    await openEncoding(page);
    for (const k of ['cam-1:101', 'cam-2:201', 'cam-2:202', 'cam-3:301']) await streamRow(page, k).click();
    await page.locator(`${DLG} [data-nvr-enc-next]`).click();
    const dlg = page.locator(DLG);
    await expect(dlg).toHaveAttribute('heading', 'ההגדרות החדשות');
    await expect(dlg.locator('[data-nvr-enc-preview]')).toHaveAttribute('disabled', ''); // nothing chosen: nothing to preview
    await expect(dlg.locator('sw-dropdown[data-nvr-enc-dd="codec-target"] [data-dropdown-chip]')).toContainText('ללא שינוי');
    await pick(page, 'codec-target', 'H.264');
    await expect(dlg.locator('[data-nvr-enc-webrtc]')).toHaveText('הצפייה החיה מנגנת ב־WebRTC רק H.264.');
    await dlg.locator('[data-nvr-enc-input="gop"]').fill('9999');
    await expect(dlg.locator('[data-nvr-enc-preview]')).toHaveAttribute('disabled', ''); // out of every device's range
    await dlg.locator('[data-nvr-enc-input="gop"]').fill('25');
    await pick(page, 'svc-target', 'off');
    await shot(page, 'enc-03-settings');
    await dlg.locator('[data-nvr-enc-preview]').click();
    await expect(dlg).toHaveAttribute('data-phase', 'preview');
    const body = bm.calls.find((c) => c.path === 'nvr/encoding-batches/preview')?.body;
    expect(body).toEqual({ settings: { codec: 'H.264', gop: 25, svc: false }, targets: [{ camera_id: 'cam-1', stream_ref: '101' }, { camera_id: 'cam-2', stream_ref: '201' }, { camera_id: 'cam-2', stream_ref: '202' }, { camera_id: 'cam-3', stream_ref: '301' }], recorder_id: 'nvr-1' });
    await expect(dlg.locator('[data-nvr-enc-summary]')).toHaveText('ישתנו 4 זרמים');
    await expect(dlg.locator('[data-nvr-enc-webrtc]')).toBeVisible();
    // the H.265 main: codec and GOP change; the H.265 sub: codec + GOP, SVC kept (no SVC on that stream)
    const m2 = dlg.locator('[data-nvr-enc-item="1"]');
    await expect(m2).toContainText('מצלמה 2 · ראשי');
    await expect(m2.locator('[data-nvr-enc-delta]')).toContainText('H.265');
    await expect(m2.locator('[data-nvr-enc-delta]')).toContainText('H.264');
    await expect(dlg.locator('[data-nvr-enc-item="2"] [data-nvr-enc-kept]')).toContainText('SVC');
    expect(st.writes).toEqual([]); // the preview never writes
    await shot(page, 'enc-04-preview');
    await dlg.locator('[data-nvr-enc-apply]').click();
    const confirm = page.locator(CONFIRM);
    await expect(confirm).toHaveAttribute('heading', 'לשנות את הקידוד ב־4 זרמים?');
    await expect(confirm.locator('[data-nvr-confirm]')).toHaveText('החל');
    await confirm.locator('details summary').click();
    await expect(confirm.locator('[data-nvr-confirm-names] li')).toHaveText(['מצלמה 1 · ראשי', 'מצלמה 2 · ראשי', 'מצלמה 2 · משני', 'מצלמה 3 · ראשי']);
    await shot(page, 'enc-05-confirm');
    await confirm.locator('[data-nvr-confirm]').click();
    // the start carries exactly the preview's changes; the multi-camera dialog follows the batch
    expect(bm.encodingStarts).toHaveLength(1);
    expect(bm.encodingStarts[0].targets.map((t: { stream_ref: string }) => t.stream_ref)).toEqual(['101', '201', '202', '301']);
    await expect(page.locator(PROG)).toHaveAttribute('data-kind', 'write', POLL);
    await expect(page.locator(`${PROG} [data-nvr-batch-item="2"]`)).toContainText('מצלמה 2 · משני');
    await shot(page, 'enc-06-progress');
    d.run();
    const toast = page.locator(`${PAGE} nvr-undo-toast`);
    await expect(toast.locator('[data-nvr-toast-text]')).toHaveText('נשמר ב־4 זרמים', POLL);
    expect(st.cameras[1].streams[0].codec).toBe('H.264');
    // the toast's "בטל" IS the confirmation: a reversed batch
    await toast.locator('[data-nvr-undo]').click();
    await expect(page.locator(PROG)).toHaveAttribute('data-kind', 'rollback', POLL);
    d.run();
    await expect(toast.locator('[data-nvr-toast-text]')).toHaveText('בוטל ב־4 זרמים', POLL);
    expect(st.cameras[1].streams[0].codec).toBe('H.265');
  });

  test('a stream that cannot be changed is listed with its reason and left out of the start', async ({ page }) => {
    bm.encSkip['cam-3:301'] = 'codec_not_offered';
    await open(page);
    await toPreview(page, [1, 3], [['codec-target', 'H.265']]);
    const dlg = page.locator(DLG);
    await expect(dlg.locator('[data-nvr-enc-summary]')).toContainText('לא ניתן: זרם אחד');
    await dlg.locator('sw-tabs[data-nvr-enc-tabs]').getByText('לא ניתן').click();
    await expect(dlg.locator('[data-nvr-enc-item] [data-nvr-enc-reason]')).toHaveText('המצלמה אינה תומכת בקידוד הזה.');
    await shot(page, 'enc-07-skips');
    await dlg.locator('[data-nvr-enc-apply]').click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    expect(bm.encodingStarts[0].targets.map((t: { stream_ref: string }) => t.stream_ref)).not.toContain('301');
  });

  test('a stale start reads the preview again and asks for a new confirmation; a failure at a stream shows the result with the reason', async ({ page }) => {
    await open(page);
    await toPreview(page, [1, 3], [['codec-target', 'H.265']]);
    bm.startFault = 'stale';
    const previews = () => bm.calls.filter((c) => c.path === 'nvr/encoding-batches/preview').length;
    expect(previews()).toBe(1);
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(`${DLG} [data-nvr-enc-line]`)).toHaveText('ההגדרות במצלמות השתנו. התצוגה המקדימה נטענה מחדש.');
    expect(previews()).toBe(2);
    expect(bm.batches).toHaveLength(0);
    // confirmed again: it starts; the second stream fails -> the result names it, the rest is not attempted, "בטל את מה שנשמר" is offered
    await page.locator(`${DLG} [data-nvr-enc-apply]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1, POLL);
    d.step();
    d.step('failed');
    await expect(page.locator(PROG)).toHaveAttribute('data-state', 'failed', POLL);
    await expect(page.locator(PROG)).toHaveAttribute('heading', /^נעצר במצלמה מצלמה 1 · משני/);
    await expect(page.locator(`${PROG} [data-nvr-batch-undo]`)).toBeVisible();
    await shot(page, 'enc-08-failed');
  });
});

test.describe('CR-020 phase D permissions (mocked backend)', () => {
  test('no nvr.configure / no can_batch / a stale list: no button and not one encoding request', async ({ page }) => {
    const st = newMock(ADMIN);
    st.canWrite = false;
    st.canBatch = true;
    st.cameras = batchCameras(3);
    const bm = newBatchMock();
    await installBatch(page, st, bm);
    await open(page);
    await expect(page.locator(`${PAGE} [data-nvr-encoding-open]`)).toHaveCount(0);
    await expect(page.locator(ENC)).toHaveCount(0);
    st.perms = newMock().perms;
    st.canWrite = true;
    st.canBatch = false;
    await page.reload();
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    await expect(page.locator(`${PAGE} [data-nvr-encoding-open]`)).toHaveCount(0);
    st.canBatch = true;
    st.stale = true;
    await page.reload();
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'stale');
    await expect(page.locator(`${PAGE} [data-nvr-encoding-open]`)).toHaveCount(0);
    expect(st.hits.filter((h) => h.includes('encoding-batches'))).toEqual([]);
  });
});
