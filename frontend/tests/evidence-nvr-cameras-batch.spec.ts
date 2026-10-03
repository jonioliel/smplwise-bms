import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, newMock, type Mock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock, type BatchDriver, type BatchMock } from './nvr-batch-mock';

// CR-020 S2 phase C evidence: the multi-camera SVC change on הגדרות › אבטחה › מצלמות, against a STATEFUL mocked backend of the batch contract
// (tests/nvr-batch-mock.ts, PLAN_C section 2 - NOT a built backend; the real one is on pilot/CR020-s2c). The batch moves only when a test steps
// it, so each state is reached on purpose: the entry in the SVC dialog, the checklist (hundreds of cameras: a window of rows, "select all that
// match"), the ONE confirmation, progress, "עצור", a failure at camera k with a line per camera, an unknown outcome, an interruption, the undo
// through the result's confirmation and through the toast (the press IS the confirmation), a reload that finds the batch again, single changes
// refused while a batch runs, no-permission / read-only / stale views, a phone, hostile strings as text.
// Run on the Vite dev server of the runner, all three projects (desktop 1440 / tablet 1024 / mobile 390: the phone shows cards).
// Screenshots: SW_SHOTS=../docs/evidence/CR-020-s2c.
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const B = `${PAGE} nvr-camera-batch`;
const CONFIRM = 'sw-dialog[open][data-nvr-confirm-dialog]';
const SEL = `${B} sw-dialog[open][data-nvr-batch-select]`;
const PROG = `${B} sw-dialog[open][data-nvr-batch-progress]`;
const POLL = { timeout: 9_000 };

const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;
const cards = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900; // a holder of nvr.configure gets the cards below 900 px
const scope = (page: Page) => `${PAGE} ${cards(page) ? '[data-nvr-cards]' : '[data-nvr-table]'}`;
const rowOf = (page: Page, ch: number): Locator => page.locator(`${scope(page)} ${cards(page) ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:${ch}"][data-stream="${ch}01"]`);
const toggleOf = (page: Page, ch: number) => rowOf(page, ch).locator('sw-toggle[data-svc-toggle]');
const toast = (page: Page) => page.locator(`${PAGE} nvr-undo-toast`);
const item = (page: Page, i: number) => page.locator(`${PROG} [data-nvr-batch-item="${i}"]`);
const checked = (el: Locator) => expect(el).toHaveAttribute('checked', '');
const unchecked = (el: Locator) => expect(el).not.toHaveAttribute('checked');
const batchCalls = (bm: BatchMock, method: string, suffix = '') => bm.calls.filter((c) => c.method === method && c.path.endsWith(suffix || 'stream-batches'));

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

/** SVC switch of camera 1 -> the single dialog -> "החל גם על מצלמות נוספות" -> the checklist. */
async function openChecklist(page: Page) {
  await expect(toggleOf(page, 1)).toBeVisible(); // offered only after the camera's detail was read
  await toggleOf(page, 1).click();
  await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toBeVisible();
  await page.locator(`${CONFIRM} [data-nvr-extra]`).click();
  await expect(page.locator(`${SEL} [data-nvr-batch-next]`)).toBeVisible();
}

const tick = async (page: Page, chs: number[]) => {
  for (const ch of chs) await page.locator(`${SEL} [data-nvr-batch-cam="cam-${ch}"]`).click();
};

/** Through the whole UI to a running batch of camera 1 + `chs`. */
async function startBatch(page: Page, chs: number[]) {
  await openChecklist(page);
  await tick(page, chs);
  await page.locator(`${SEL} [data-nvr-batch-next]`).click();
  await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toBeVisible();
  await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
  await expect(page.locator(PROG)).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator(`${PROG} [data-nvr-batch-list]`)).toBeVisible();
}

test.describe('CR-020 S2c multi-camera change (mocked backend)', () => {
  let st: Mock;
  let bm: BatchMock;
  let d: BatchDriver;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(5, { h265: [4], offline: [5] }); // 1,2,3 qualify; 4 is H.265, 5 is offline
    bm = newBatchMock();
    d = await installBatch(page, st, bm);
  });

  test('entry: the SVC dialog offers "החל גם על מצלמות נוספות" only with can_batch, only when turning SVC off', async ({ page }) => {
    st.canBatch = false;
    await open(page);
    await expect(toggleOf(page, 1)).toBeVisible();
    await toggleOf(page, 1).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toBeVisible();
    await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toHaveCount(0);
    await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
    // with the server's can_batch: the button; one candidate only is not enough (a single camera is the single write)
    st.canBatch = true;
    await page.reload();
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    await expect(toggleOf(page, 1)).toBeVisible();
    await toggleOf(page, 1).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toHaveText('החל גם על מצלמות נוספות');
    await shot(page, 'batch-01-entry');
    await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
    expect(bm.calls).toEqual([]);
    // turning SVC ON (camera 2 of a set where only it is off) never offers the batch (the server's allow-list is svc:false)
    st.cameras = batchCameras(5, { off: [2] });
    await page.reload();
    await expect(toggleOf(page, 2)).toBeVisible();
    await toggleOf(page, 2).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toHaveText('הפעל');
    await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toHaveCount(0);
  });

  test('checklist: only qualifying cameras, the current one ticked and fixed, at least two, select all / clear, search', async ({ page }) => {
    await open(page);
    await openChecklist(page);
    const sel = page.locator(SEL);
    await expect(sel).toHaveAttribute('heading', 'כיבוי SVC בכמה מצלמות');
    // cameras 1,2,3 qualify; 4 (H.265) and 5 (offline) are not listed and nothing explains why
    await expect(sel.locator('[data-nvr-batch-cam]')).toHaveCount(3);
    await expect(sel.locator('[data-nvr-batch-cam="cam-4"]')).toHaveCount(0);
    await expect(sel.locator('[data-nvr-batch-cam="cam-5"]')).toHaveCount(0);
    await expect(sel.locator('[data-nvr-batch-count]')).toHaveText('נבחרו 1 מתוך 3');
    const first = sel.locator('[data-nvr-batch-cam="cam-1"]');
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await expect(first).toHaveAttribute('aria-disabled', 'true');
    await expect(sel.locator('[data-nvr-batch-next]')).toHaveAttribute('disabled', '');
    await first.click({ force: true }); // fixed (aria-disabled): stays ticked
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await shot(page, 'batch-02-checklist');
    await sel.locator('[data-nvr-batch-cam="cam-2"]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toHaveText('נבחרו 2 מתוך 3');
    await expect(sel.locator('[data-nvr-batch-next]')).not.toHaveAttribute('disabled');
    await sel.locator('[data-nvr-batch-clear]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toHaveText('נבחרו 1 מתוך 3');
    await sel.locator('[data-nvr-batch-all]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toHaveText('נבחרו 3 מתוך 3');
    // search narrows the list; "select all" then adds the matches only
    await sel.locator('[data-nvr-batch-clear]').click();
    await sel.locator('[data-nvr-batch-search]').fill('מצלמה 3');
    await expect(sel.locator('[data-nvr-batch-cam]')).toHaveCount(1);
    await expect(sel.locator('[data-nvr-batch-count]')).toContainText('1 תוצאות');
    await expect(sel.locator('[data-nvr-batch-all]')).toHaveText('בחר הכל (1)');
    await sel.locator('[data-nvr-batch-all]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toContainText('נבחרו 2 מתוך 3');
    await sel.locator('[data-nvr-batch-search]').fill('אין כזו');
    await expect(sel.locator('[data-nvr-batch-none]')).toBeVisible();
    await sel.locator('[data-nvr-batch-cancel]').click();
    await expect(page.locator(SEL)).toHaveCount(0);
    expect(bm.calls).toEqual([]);
    expect(st.writes).toEqual([]);
  });

  test('ONE confirmation: the count in the heading, the names under "פרטים", cancel goes back to the checklist and sends nothing', async ({ page }) => {
    await open(page);
    await openChecklist(page);
    await tick(page, [2, 3]);
    await page.locator(`${SEL} [data-nvr-batch-next]`).click();
    const dlg = page.locator(CONFIRM);
    await expect(dlg).toHaveAttribute('heading', 'לכבות SVC ב־3 מצלמות?');
    await expect(dlg.locator('[data-nvr-confirm-lead]')).toHaveText('השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.');
    await expect(dlg.locator('[data-nvr-confirm-count]')).toHaveText('3 מצלמות');
    await expect(dlg.locator('[data-nvr-confirm]')).toHaveText('כבה');
    await expect(dlg.locator('[data-nvr-cancel]')).toHaveText('ביטול');
    await expect(dlg.locator('details[data-nvr-confirm-details]')).not.toHaveAttribute('open');
    await dlg.locator('details summary').click();
    await expect(dlg.locator('[data-nvr-confirm-names] li')).toHaveText(['מצלמה 1', 'מצלמה 2', 'מצלמה 3']);
    await shot(page, 'batch-03-confirm');
    await dlg.locator('[data-nvr-cancel]').click();
    await expect(page.locator(SEL)).toHaveCount(1); // back in the checklist with the choice intact
    await expect(page.locator(`${SEL} [data-nvr-batch-count]`)).toHaveText('נבחרו 3 מתוך 3');
    expect(bm.calls).toEqual([]);
    expect(st.writes).toEqual([]);
  });

  test('progress: the request body, "2 מתוך 3", a row per camera, completion closes the dialog and the toast carries the count', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    expect(batchCalls(bm, 'POST')).toHaveLength(1);
    expect(batchCalls(bm, 'POST')[0].body).toEqual({
      confirm: true, changes: { svc: false }, recorder_id: 'nvr-1',
      targets: [{ camera_id: 'cam-1', stream_ref: '101', if_match: '101e1' }, { camera_id: 'cam-2', stream_ref: '201', if_match: '201e1' }, { camera_id: 'cam-3', stream_ref: '301', if_match: '301e1' }],
    });
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', '0 מתוך 3');
    await expect(item(page, 0)).toHaveAttribute('data-status', 'running');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'queued');
    await expect(prog.locator('[data-nvr-batch-stop]')).toHaveText('עצור');
    await shot(page, 'batch-04-progress-start');
    d.step();
    await expect(prog).toHaveAttribute('heading', '1 מתוך 3', POLL);
    await expect(item(page, 0)).toHaveAttribute('data-status', 'applied');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'running');
    await expect(item(page, 0).locator('[data-nvr-batch-item-line]')).toHaveText('נשמר');
    await shot(page, 'batch-05-progress-mid');
    d.run();
    // the batch completed in front of the person: the dialog gets out of the way, the toast says it with the count and the undo
    await expect(page.locator(PROG)).toHaveCount(0, POLL);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר ב־3 מצלמות');
    await expect(toast(page).locator('[data-nvr-undo]')).toHaveText('בטל');
    await shot(page, 'batch-06-saved-toast');
    // the list was read again: the switches are off now
    await unchecked(toggleOf(page, 1));
    await unchecked(toggleOf(page, 3));
    expect(batchCalls(bm, 'POST')).toHaveLength(1); // no retry, no second start
    expect(st.writes.filter((w) => w.method === 'PUT')).toEqual([]); // the screen never made single writes
  });

  test('undo-all through the toast: the press IS the confirmation (no dialog), the request carries confirm:true, the rollback runs with its own progress', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.run();
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר ב־3 מצלמות', POLL);
    await toast(page).locator('[data-nvr-undo]').click();
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    await expect(page.locator(PROG)).toHaveCount(1);
    await expect.poll(() => batchCalls(bm, 'POST', '/rollback').length).toBe(1);
    expect(batchCalls(bm, 'POST', '/rollback')[0]).toEqual({ method: 'POST', path: 'nvr/stream-batches/batch-1/rollback', body: { confirm: true } });
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('data-kind', 'rollback');
    await expect(prog).toHaveAttribute('heading', '0 מתוך 3');
    // the rollback goes in reverse order
    expect(d.last.items.map((i) => i.camera_id)).toEqual(['cam-3', 'cam-2', 'cam-1']);
    await shot(page, 'batch-07-undo-progress');
    d.run();
    await expect(page.locator(PROG)).toHaveCount(0, POLL);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('בוטל ב־3 מצלמות');
    await expect(toast(page).locator('[data-nvr-undo]')).toHaveCount(0);
    await checked(toggleOf(page, 1));
    await checked(toggleOf(page, 2));
    expect(batchCalls(bm, 'POST', '/rollback')).toHaveLength(1);
  });

  test('stop: "עצור" is sent without a confirmation; the camera in flight finishes, the rest is "לא בוצע", the result offers the undo', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step(); // camera 1 applied, camera 2 in flight
    await expect(page.locator(PROG)).toHaveAttribute('heading', '1 מתוך 3', POLL);
    await page.locator(`${PROG} [data-nvr-batch-stop]`).click();
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    expect(batchCalls(bm, 'POST', '/stop')).toHaveLength(1);
    expect(batchCalls(bm, 'POST', '/stop')[0].path).toBe('nvr/stream-batches/batch-1/stop');
    await expect(page.locator(PROG)).toHaveAttribute('subheading', 'עוצר אחרי המצלמה הנוכחית');
    await expect(page.locator(`${PROG} [data-nvr-batch-stop]`)).toHaveCount(0);
    await expect(item(page, 2)).toHaveAttribute('data-status', 'not_attempted');
    d.step(); // the camera in flight finishes
    await expect(page.locator(PROG)).toHaveAttribute('heading', 'נעצר בבקשתך', POLL);
    await expect(page.locator(PROG)).toHaveAttribute('subheading', 'נשמר ב־2 מצלמות · לא בוצע במצלמה אחת');
    await expect(item(page, 2).locator('[data-nvr-batch-item-line]')).toHaveText('לא בוצע');
    await expect(page.locator(`${PROG} [data-nvr-batch-undo]`)).toHaveText('בטל את מה שנשמר');
    await expect(page.locator(`${PROG} [data-nvr-batch-undo]`)).not.toHaveAttribute('disabled');
    await shot(page, 'batch-08-stopped');
    // no toast for a stop, and the batch never moves by itself
    await expect(toast(page)).toHaveCount(0);
    expect(d.last.items.map((i) => i.status)).toEqual(['applied', 'applied', 'not_attempted']);
    // a second press on stop cannot happen (the button is gone); the server's stop is idempotent anyway
    await page.locator(`${PROG} [data-nvr-batch-close]`).click();
    await expect(page.locator(PROG)).toHaveCount(0);
  });

  test('failure at camera k: the header names it, applied rows ok, the failed row red with its line, the rest "לא בוצע"; "בטל את מה שנשמר" asks ONE confirmation', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step(); // camera 1 applied
    d.step('failed'); // camera 2 refused: the batch stops, camera 3 is never tried
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', 'נעצר במצלמה מצלמה 2', POLL);
    await expect(prog).toHaveAttribute('data-state', 'failed');
    await expect(prog).toHaveAttribute('subheading', 'נשמר במצלמה אחת · נכשל במצלמה אחת · לא בוצע במצלמה אחת');
    await expect(item(page, 0)).toHaveAttribute('data-status', 'applied');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'refused');
    await expect(item(page, 1).locator('[data-nvr-batch-item-line]')).toHaveText('ה־NVR עסוק. נסו שוב בעוד רגע.');
    await expect(item(page, 2).locator('[data-nvr-batch-item-line]')).toHaveText('לא בוצע');
    await expect(prog.locator('[data-nvr-batch-stop]')).toHaveCount(0);
    await shot(page, 'batch-09-failed');
    // the page did not retry anything
    expect(batchCalls(bm, 'POST')).toHaveLength(1);
    await prog.locator('[data-nvr-batch-undo]').click();
    const dlg = page.locator(CONFIRM);
    await expect(dlg).toHaveAttribute('heading', 'להחזיר SVC במצלמה אחת?');
    await expect(dlg.locator('[data-nvr-confirm]')).toHaveText('החזר');
    await dlg.locator('details summary').click();
    await expect(dlg.locator('[data-nvr-confirm-names] li')).toHaveText(['מצלמה 1']);
    await shot(page, 'batch-10-undo-confirm');
    await dlg.locator('[data-nvr-cancel]').click();
    await expect(page.locator(PROG)).toHaveCount(1); // back to the result
    expect(batchCalls(bm, 'POST', '/rollback')).toEqual([]);
    await prog.locator('[data-nvr-batch-undo]').click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect.poll(() => batchCalls(bm, 'POST', '/rollback').length).toBe(1);
    expect(batchCalls(bm, 'POST', '/rollback')[0].body).toEqual({ confirm: true });
    d.run();
    await expect(page.locator(PROG)).toHaveCount(0, POLL);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('בוטל במצלמה אחת');
    await checked(toggleOf(page, 1));
  });

  test('the undo itself fails at a camera: what was put back stays, the rest stays changed, "נסה שוב" is a NEW request with a new confirmation', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.run();
    await expect(toast(page).locator('[data-nvr-undo]')).toBeVisible(POLL);
    await toast(page).locator('[data-nvr-undo]').click();
    await expect.poll(() => batchCalls(bm, 'POST', '/rollback').length).toBe(1);
    d.step(); // cam-3 put back
    d.step('failed'); // cam-2 refused
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', 'ההחזרה נעצרה במצלמה מצלמה 2', POLL);
    await expect(prog).toHaveAttribute('subheading', 'הוחזר במצלמה אחת · לא הוחזר ב־2 מצלמות');
    await expect(prog.locator('[data-nvr-batch-undo]')).toHaveCount(0);
    await shot(page, 'batch-11-undo-partial');
    await prog.locator('[data-nvr-batch-retry]').click();
    await expect(page.locator(CONFIRM)).toHaveAttribute('heading', 'להחזיר SVC ב־2 מצלמות?');
    expect(batchCalls(bm, 'POST', '/rollback')).toHaveLength(1); // nothing was sent by the press alone
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect.poll(() => batchCalls(bm, 'POST', '/rollback').length).toBe(2);
    expect(batchCalls(bm, 'POST', '/rollback')[1].path).toBe('nvr/stream-batches/batch-1/rollback'); // the SOURCE batch, a new request
  });

  test('an unknown outcome PROVEN applied by the server\'s read-only check: "נבדק מול ה־NVR", then the batch goes on by itself; nothing is re-sent', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    d.step('unknown'); // camera 2: the answer was lost; the batch waits and the server reads the camera
    const prog = page.locator(PROG);
    await expect(item(page, 1).locator('[data-nvr-batch-item-line]')).toHaveText('לא ברור אם בוצע. נבדק מול ה־NVR.', POLL);
    await expect(prog).toHaveAttribute('subheading', 'נבדק מול ה־NVR');
    await expect(prog).toHaveAttribute('data-state', 'running');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'unknown');
    await shot(page, 'batch-12-unknown-checking');
    d.check('applied'); // the reading proves the new value: the server continues with camera 3
    await expect(item(page, 1)).toHaveAttribute('data-status', 'applied', POLL);
    await expect(item(page, 2)).toHaveAttribute('data-status', 'running', POLL);
    d.run();
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר ב־3 מצלמות', POLL);
    expect(batchCalls(bm, 'POST')).toHaveLength(1);
  });

  test('an unknown outcome the server could not prove: "נעצר: לא ברור אם בוצע", undo-all waits until the janitor settled the item, then it is offered', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    d.step('unknown');
    d.check('unverified'); // the camera could not be read: the batch ends `interrupted / unknown_unverified`, the item stays unknown
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', 'נעצר: לא ברור אם בוצע במצלמה מצלמה 2', POLL);
    await expect(prog).toHaveAttribute('data-state', 'interrupted');
    await expect(item(page, 1).locator('[data-nvr-batch-item-line]')).toHaveText('לא ברור אם בוצע. נבדק מול ה־NVR.');
    await expect(item(page, 2).locator('[data-nvr-batch-item-line]')).toHaveText('לא בוצע');
    await expect(prog.locator('[data-nvr-batch-undo]')).toHaveAttribute('disabled', '');
    await shot(page, 'batch-12-unknown');
    // the page keeps reading (read-only); the janitor settles the item as applied -> the undo is offered, nothing was re-sent
    d.settle('applied');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'applied', { timeout: 12_000 });
    await expect(prog.locator('[data-nvr-batch-undo]')).not.toHaveAttribute('disabled');
    await expect(prog).toHaveAttribute('subheading', 'נשמר ב־2 מצלמות · לא בוצע במצלמה אחת');
    expect(batchCalls(bm, 'POST')).toHaveLength(1);
  });

  test('an unknown outcome the camera did NOT take: the batch ends, the row says it failed, what was saved can be undone', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    d.step('unknown');
    d.check('not_applied');
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('data-state', 'interrupted', POLL);
    await expect(prog).toHaveAttribute('heading', 'נעצר במצלמה מצלמה 2');
    await expect(item(page, 1)).toHaveAttribute('data-status', 'no_effect');
    await expect(item(page, 1).locator('[data-nvr-batch-item-line]')).toHaveText('ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.');
    await expect(prog.locator('[data-nvr-batch-undo]')).not.toHaveAttribute('disabled');
  });

  test('interrupted (the server restarted): "השינוי נקטע באמצע", what was applied is listed and can be undone', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    d.interrupt();
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', 'השינוי נקטע באמצע', POLL);
    await expect(prog).toHaveAttribute('data-state', 'interrupted');
    await expect(prog.locator('[data-nvr-batch-undo]')).not.toHaveAttribute('disabled');
    await shot(page, 'batch-13-interrupted');
  });

  test('closing the page does not stop it: a reload finds the RUNNING batch (progress) and, later, the FINISHED one (result) until it is closed', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    await expect(page.locator(PROG)).toHaveAttribute('heading', '1 מתוך 3', POLL);
    await page.goto('about:blank'); // the tab is closed / navigated away; the server's batch goes on
    d.step();
    await page.goto('/?design=a#/system/security/cameras');
    await page.waitForSelector('sw-app');
    // reopened: the running batch is on screen again with its progress and the stop button
    await expect(page.locator(PROG)).toHaveAttribute('heading', '2 מתוך 3', { timeout: 15_000 });
    await expect(page.locator(`${PROG} [data-nvr-batch-stop]`)).toBeVisible();
    await expect(item(page, 0)).toHaveAttribute('data-status', 'applied');
    await shot(page, 'batch-14-reopened');
    // the person hides it: the strip says a multi-camera change runs and the single controls are off
    await page.keyboard.press('Escape');
    await expect(page.locator(PROG)).toHaveCount(0);
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toContainText('מתבצע שינוי מרובה');
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip-text]`)).toContainText('2');
    await expect(toggleOf(page, 2)).toHaveAttribute('disabled', '');
    await expect(toggleOf(page, 2)).toHaveAttribute('title', 'מתבצע שינוי מרובה');
    await page.locator(`${PAGE} [data-nvr-batch-show]`).click();
    await expect(page.locator(PROG)).toHaveCount(1);
    // it fails while the page is closed; reopening shows the finished result, once
    await page.goto('about:blank');
    d.step('failed');
    await page.goto('/?design=a#/system/security/cameras');
    await page.waitForSelector('sw-app');
    await expect(page.locator(PROG)).toHaveAttribute('heading', /^נעצר במצלמה/, { timeout: 15_000 });
    await page.locator(`${PROG} [data-nvr-batch-close]`).click();
    await expect(page.locator(PROG)).toHaveCount(0);
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toHaveCount(0);
    await page.reload();
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    await page.waitForTimeout(600);
    await expect(page.locator(PROG)).toHaveCount(0); // seen and closed: it does not come back
  });

  test('single changes while a batch runs: the switch and pencil are disabled, and a change the server refuses says "מתבצע שינוי מרובה" and shows the strip', async ({ page }) => {
    await open(page);
    await expect(toggleOf(page, 3)).toBeVisible();
    // another administrator started a batch after this page loaded: the controls are still on; the server refuses
    d.start(['cam-1', 'cam-2']);
    await toggleOf(page, 3).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(`${scope(page)} [data-nvr-line]`)).toHaveText('מתבצע שינוי מרובה');
    expect(bm.refusedSingles).toEqual(['PUT nvr/cameras/cam-3/streams/301']);
    await checked(toggleOf(page, 3)); // the data decides: not changed
    // the screen learned of the batch: strip + disabled controls + the progress opens on request
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toBeVisible();
    await expect(toggleOf(page, 3)).toHaveAttribute('disabled', '');
    await expect(rowOf(page, 3).locator('button[data-edit-stream]')).toHaveAttribute('disabled', '');
    await shot(page, 'batch-15-single-refused');
    // it ends: the strip goes away and the controls come back
    await page.keyboard.press('Escape');
    d.run();
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toHaveCount(0, POLL);
    await expect(toggleOf(page, 3)).not.toHaveAttribute('disabled');
  });

  test('a start the server refuses: batch in progress, a stale camera (named, list reloaded); nothing is retried', async ({ page }) => {
    await open(page);
    await openChecklist(page);
    await tick(page, [2, 3]);
    bm.startFault = 'in_progress';
    await page.locator(`${SEL} [data-nvr-batch-next]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(`${SEL} [data-nvr-batch-line]`)).toHaveText('מתבצע שינוי מרובה');
    await expect(page.locator(`${SEL} [data-nvr-batch-cam="cam-2"]`)).toHaveAttribute('aria-checked', 'true'); // the choice is kept
    expect(batchCalls(bm, 'POST')).toHaveLength(1);
    // stale: the line names the camera at the stale index and the cameras are read again
    bm.startFault = 'stale';
    const reads = st.hits.filter((h) => h === 'GET nvr/cameras').length;
    await page.locator(`${SEL} [data-nvr-batch-next]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(`${SEL} [data-nvr-batch-line]`)).toHaveText('הערכים של מצלמה 1 השתנו ב־NVR. נטען מחדש.');
    await expect.poll(() => st.hits.filter((h) => h === 'GET nvr/cameras').length).toBeGreaterThan(reads);
    expect(batchCalls(bm, 'POST')).toHaveLength(2);
    // a lost answer: sent ONCE, the active batch is read (a read), none -> "אין חיבור לשרת." and the checklist stays
    bm.startFault = 'abort';
    await page.locator(`${SEL} [data-nvr-batch-next]`).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(`${SEL} [data-nvr-batch-line]`)).toHaveText('אין חיבור לשרת.');
    expect(batchCalls(bm, 'POST')).toHaveLength(3);
    expect(st.hits.filter((h) => h === 'GET nvr/stream-batches?active=1').length).toBeGreaterThan(0);
    expect(bm.batches).toHaveLength(0);
  });

  test('progress reads that fail: "אין חיבור לשרת. ממשיך לנסות." and it recovers by itself (the batch goes on at the server)', async ({ page }) => {
    await open(page);
    await startBatch(page, [2, 3]);
    bm.getDown = true;
    await expect(page.locator(`${PROG} [data-nvr-batch-offline]`)).toBeVisible({ timeout: 9000 });
    await shot(page, 'batch-16-offline');
    d.step();
    bm.getDown = false;
    await expect(page.locator(PROG)).toHaveAttribute('heading', '1 מתוך 3', { timeout: 12_000 });
    await expect(page.locator(`${PROG} [data-nvr-batch-offline]`)).toHaveCount(0);
  });

  test('hostile strings: camera names and server lines are text, never markup', async ({ page }) => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    st.cameras = batchCameras(4, { names: { 1: evil, 2: '"><script>window.__pwned=2</script>', 3: '{{7*7}} ${8*8}' } });
    await open(page);
    await startBatch(page, [2, 3]);
    d.step();
    d.step('failed');
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('data-state', 'failed', POLL);
    await expect(item(page, 0)).toContainText(evil);
    await expect(item(page, 2)).toContainText('{{7*7}} ${8*8}');
    await expect(page.locator(`${B} img`)).toHaveCount(0);
    await expect(page.locator(`${B} script`)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwned)).toBeUndefined();
    await prog.locator('[data-nvr-batch-undo]').click();
    await page.locator(`${CONFIRM} details summary`).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm-names] li`).first()).toHaveText(evil);
    await expect(page.locator(`${CONFIRM} img`)).toHaveCount(0);
  });
});

test.describe('CR-020 S2c permissions and read-only modes (mocked backend)', () => {
  test('no nvr.configure: no switch, no batch control, and not one batch request', async ({ page }) => {
    const st = newMock(ADMIN);
    st.canWrite = false;
    st.canBatch = true; // even if a server said so, the screen offers nothing to a person who cannot write
    st.cameras = batchCameras(4);
    const bm = newBatchMock();
    await installBatch(page, st, bm);
    await open(page);
    await expect(page.locator(`${scope(page)} sw-toggle[data-svc-toggle]`)).toHaveCount(0);
    await expect(page.locator(`${PAGE} nvr-camera-batch`)).toHaveCount(0);
    await expect(page.locator(`${PAGE} [data-nvr-batch-strip]`)).toHaveCount(0);
    expect(st.hits.filter((h) => h.includes('stream-batches'))).toEqual([]);
  });

  test('the NVR is unreadable (the registry\'s last reading): no switch is offered, so no batch entry; nothing is requested', async ({ page }) => {
    const st = newMock();
    st.canBatch = true;
    st.stale = true;
    st.cameras = batchCameras(4);
    const bm = newBatchMock();
    await installBatch(page, st, bm);
    await open(page).catch(() => undefined);
    await expect(page.locator(`${PAGE} [data-nvr-stale]`)).toBeVisible();
    for (const t of await page.locator(`${scope(page)} sw-toggle[data-svc-toggle]`).all()) await expect(t).toHaveAttribute('disabled', '');
    expect(st.hits.filter((h) => h.includes('stream-batches'))).toEqual([]);
    expect(bm.calls).toEqual([]);
  });

  test('can_batch false from the server: the entry does not exist (the gate is the server\'s)', async ({ page }) => {
    const st = newMock();
    st.canBatch = false;
    st.cameras = batchCameras(4);
    const bm = newBatchMock();
    await installBatch(page, st, bm);
    await open(page);
    await expect(toggleOf(page, 1)).toBeVisible();
    await toggleOf(page, 1).click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toBeVisible();
    await expect(page.locator(`${CONFIRM} [data-nvr-extra]`)).toHaveCount(0);
  });
});

test.describe('CR-020 S2c hundreds of cameras (mocked backend)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('300 cameras: a window of rows (not 300), select all that match, progress and the failing camera kept in view', async ({ page }) => {
    const st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(300, { names: { 150: 'שער ראשי' } });
    const bm = newBatchMock();
    bm.pageMax = 100; // the server pages the items: the screen must read every page
    const d = await installBatch(page, st, bm);
    await open(page);
    await openChecklist(page);
    const sel = page.locator(SEL);
    await expect(sel.locator('[data-nvr-batch-count]')).toHaveText('נבחרו 1 מתוך 300');
    await expect(sel.locator('[data-nvr-batch-list]')).toHaveAttribute('data-rows', '300');
    const drawn = await sel.locator('[data-nvr-batch-cam]').count();
    expect(drawn).toBeGreaterThan(5);
    expect(drawn).toBeLessThan(40);
    await shot(page, 'batch-17-hundreds-checklist');
    // scroll far down: other rows are drawn, still a window
    await sel.locator('[data-nvr-batch-list]').evaluate((el) => (el.scrollTop = 44 * 250));
    await expect(sel.locator('[data-nvr-batch-cam="cam-260"]')).toBeAttached();
    expect(await sel.locator('[data-nvr-batch-cam]').count()).toBeLessThan(40);
    // the search finds one camera by name; select all matching adds every match (not only the drawn rows) and keeps the rest of the choice
    await sel.locator('[data-nvr-batch-search]').fill('שער');
    await expect(sel.locator('[data-nvr-batch-cam]')).toHaveCount(1);
    await sel.locator('[data-nvr-batch-all]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toContainText('נבחרו 2 מתוך 300');
    await sel.locator('[data-nvr-batch-search]').fill('מצלמה 29');
    const matches = Array.from({ length: 300 }, (_, i) => i + 1).filter((k) => k !== 150 && String(k).includes('29')).length; // 29, 129, 229, 290-299
    await expect(sel.locator('[data-nvr-batch-all]')).toHaveText(`בחר הכל (${matches})`);
    await sel.locator('[data-nvr-batch-all]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toContainText(`נבחרו ${matches + 2} מתוך 300`);
    // every camera named "מצלמה ..." (299; the gate camera was ticked already): 300 of 300, no cap
    await sel.locator('[data-nvr-batch-search]').fill('מצלמה');
    await expect(sel.locator('[data-nvr-batch-all]')).toHaveText('בחר הכל (299)');
    await sel.locator('[data-nvr-batch-all]').click();
    await expect(sel.locator('[data-nvr-batch-count]')).toContainText('נבחרו 300 מתוך 300');
    await sel.locator('[data-nvr-batch-next]').click();
    const dlg = page.locator(CONFIRM);
    const n = 300;
    await expect(dlg).toHaveAttribute('heading', `לכבות SVC ב־${n} מצלמות?`);
    await expect(dlg.locator('[data-nvr-confirm-count]')).toHaveText(`${n} מצלמות`);
    await dlg.locator('details summary').click();
    // the names scroll inside the list: the dialog keeps its size
    const box = await dlg.locator('[data-nvr-confirm-names]').evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
    expect(box.sh).toBeGreaterThan(box.h);
    await shot(page, 'batch-18-hundreds-confirm');
    await dlg.locator('[data-nvr-confirm]').click();
    const prog = page.locator(PROG);
    await expect(prog).toHaveAttribute('heading', `0 מתוך ${n}`, { timeout: 8000 });
    expect(batchCalls(bm, 'POST')[0].body.targets).toHaveLength(n);
    const rows = await page.locator(`${PROG} [data-nvr-batch-item]`).count();
    expect(rows).toBeLessThan(40);
    d.run(150);
    await expect(prog).toHaveAttribute('heading', `150 מתוך ${n}`, POLL);
    expect(bm.pages).toContain('100,100'); // paged reads: offset 0, 100, 200 (the mock caps the page at 100)
    expect(bm.pages).toContain('200,100');
    // the list follows the camera in flight (a window far below the start)
    await expect(item(page, 150)).toBeAttached();
    d.step('failed'); // camera #151 fails: the list scrolls to it and the header names it
    await expect(prog).toHaveAttribute('data-state', 'failed', POLL);
    await expect(item(page, 150)).toBeAttached();
    await expect(item(page, 150)).toHaveAttribute('data-status', 'refused');
    expect(await page.locator(`${PROG} [data-nvr-batch-item]`).count()).toBeLessThan(40);
    await expect(prog).toHaveAttribute('subheading', `נשמר ב־150 מצלמות · נכשל במצלמה אחת · לא בוצע ב־${n - 151} מצלמות`);
    await shot(page, 'batch-19-hundreds-failed');
  });
});

test.describe('CR-020 S2c phone and layout facts (mocked backend)', () => {
  test('every dialog fits the viewport (no horizontal scroll), rows are at least 44 px, the page is right-to-left', async ({ page }) => {
    const st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(40);
    const bm = newBatchMock();
    const d = await installBatch(page, st, bm);
    await open(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl');
    const fits = async (sel: string) => {
      const r = await page.locator(sel).evaluate((el) => {
        const box = (el.shadowRoot as ShadowRoot).querySelector('.box') as HTMLElement;
        const b = box.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth };
      });
      expect(r.l).toBeGreaterThanOrEqual(-0.5);
      expect(r.r).toBeLessThanOrEqual(r.w + 0.5);
      expect(r.t).toBeGreaterThanOrEqual(-0.5);
      expect(r.b).toBeLessThanOrEqual(r.h + 0.5);
      expect(r.sw).toBeLessThanOrEqual(r.w);
    };
    await openChecklist(page);
    await fits(SEL);
    const row = await page.locator(`${SEL} [data-nvr-batch-cam]`).first().boundingBox();
    expect(row!.height).toBeGreaterThanOrEqual(43.5);
    await tick(page, [2, 3, 4]);
    await page.locator(`${SEL} [data-nvr-batch-next]`).click();
    await page.locator(`${CONFIRM} details summary`).click();
    await fits(CONFIRM);
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(page.locator(PROG)).toHaveCount(1);
    await fits(PROG);
    d.step();
    d.step('failed');
    await expect(page.locator(PROG)).toHaveAttribute('data-state', 'failed', POLL);
    await fits(PROG);
    if (phone(page)) await shot(page, 'batch-20-phone-result');
  });
});
