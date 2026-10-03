import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN, install, newMock, type Mock } from './nvr-cameras-write-mock';

// CR-020 S2 phase B evidence: הגדרות › אבטחה › מצלמות with the write controls - the SVC switch, the ONE confirmation, the undo toast, the
// editor drawer and every failure line. API mode against a STATEFUL mocked backend (tests/nvr-cameras-write-mock.ts), so each outcome
// of the contract is shown without a device: success + undo, stale, busy, no effect, capabilities unreadable, an unknown outcome
// (never retried), write in progress, a reboot request, a no-op, the no-permission view, dark, a phone, device strings as text only.
// The server's own checks are the backend tests (tests/test_nvr_stream_write.py ...); the real backend + fake NVR flow is
// evidence-nvr-cameras-fixture.spec.ts.
// Run on the Vite dev server of the runner (`~/run_remote.sh spec <branch> tests/evidence-nvr-cameras-write.spec.ts`), all three
// projects (desktop 1440 / tablet 1024 / mobile 390: the phone shows cards). Screenshots: SW_SHOTS=../docs/evidence/CR-020-s2.
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const CONFIRM = 'sw-dialog[open][data-nvr-confirm-dialog]';

const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;
const scope = (page: Page) => `${PAGE} ${phone(page) ? '[data-nvr-cards]' : '[data-nvr-table]'}`;
const rowOf = (page: Page, ch: number, ref: string): Locator => page.locator(`${scope(page)} ${phone(page) ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:${ch}"][data-stream="${ref}"]`);
const toggleOf = (page: Page, ch: number, ref: string) => rowOf(page, ch, ref).locator('sw-toggle[data-svc-toggle]');
const lineOf = (page: Page) => page.locator(`${scope(page)} [data-nvr-line]`);
const toast = (page: Page) => page.locator(`${PAGE} nvr-undo-toast`);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

async function open(page: Page, q = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${q}#/system/security/cameras`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
}

const checked = (el: Locator) => expect(el).toHaveAttribute('checked', '');
const unchecked = (el: Locator) => expect(el).not.toHaveAttribute('checked');
const putCount = (st: Mock) => st.writes.filter((w) => w.method === 'PUT').length;
const detailReads = (st: Mock, id: string) => st.hits.filter((h) => h === `GET nvr/cameras/${id}`).length;

/** Presses the SVC switch of 101 and confirms the dialog. */
async function toggleSvc101(page: Page) {
  await toggleOf(page, 1, '101').click();
  await expect(page.locator(CONFIRM)).toBeVisible();
  await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
}

test.describe('CR-020 S2b cameras write (mocked backend)', () => {
  let st: Mock;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    await install(page, st);
  });

  test('success: the switch does not move on a press; the ONE confirmation, then it moves, the toast offers the undo, the undo restores', async ({ page }) => {
    await open(page);
    const tog = toggleOf(page, 1, '101');
    await expect(tog).toBeVisible(); // offered only after the camera's detail was read (writable is null in the list)
    await checked(tog);
    await shot(page, 'write-01-ready');
    await tog.click();
    // the switch has NOT moved, nothing was sent, ONE short dialog: heading, camera · stream, the count, two buttons, details collapsed
    const dlg = page.locator(CONFIRM);
    await expect(dlg).toBeVisible();
    await checked(tog);
    expect(st.writes).toEqual([]);
    await expect(dlg).toHaveAttribute('heading', 'לכבות SVC?');
    await expect(dlg.locator('[data-nvr-confirm-lead]')).toHaveText('כניסה ראשית · ראשי. השידור ייקטע לכמה שניות.');
    await expect(dlg.locator('[data-nvr-confirm-count]')).toHaveText('שינוי אחד');
    await expect(dlg.locator('[data-nvr-confirm]')).toHaveText('כבה');
    await expect(dlg.locator('[data-nvr-cancel]')).toHaveText('ביטול');
    await expect(dlg.locator('details[data-nvr-confirm-details]')).not.toHaveAttribute('open');
    await dlg.locator('details summary').click();
    await expect(dlg.locator('li[data-field="svc"]')).toContainText('SVC');
    await expect(dlg.locator('li[data-field="svc"]')).toContainText('פעיל');
    await expect(dlg.locator('li[data-field="svc"]')).toContainText('כבוי');
    await shot(page, 'write-02-confirm');
    await dlg.locator('[data-nvr-confirm]').click();
    // the data decides: the switch moved, the toast with the undo
    await unchecked(tog);
    expect(st.writes).toHaveLength(1);
    expect(st.writes[0]).toEqual({ method: 'PUT', path: 'nvr/cameras/cam-1/streams/101', body: { if_match: '101e1', confirm: true, changes: { svc: false } } });
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר');
    await expect(toast(page).locator('[data-nvr-undo]')).toHaveText('בטל');
    await shot(page, 'write-03-saved-toast');
    // the undo: the press IS the confirmation, so the request carries confirm: true and no dialog opens
    await toast(page).locator('[data-nvr-undo]').click();
    await checked(tog);
    expect(st.writes).toHaveLength(2);
    expect(st.writes[1]).toEqual({ method: 'POST', path: 'nvr/changes/chg-1/rollback', body: { confirm: true } });
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('השינוי בוטל');
    await expect(lineOf(page)).toHaveCount(0);
  });

  test('cancel in the dialog sends nothing; the switch stays', async ({ page }) => {
    await open(page);
    const tog = toggleOf(page, 1, '101');
    await tog.click();
    await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    await checked(tog);
    expect(st.writes).toEqual([]);
  });

  test('turning SVC on asks "להפעיל SVC?"', async ({ page }) => {
    await open(page);
    await toggleOf(page, 2, '201').click();
    await expect(page.locator(CONFIRM)).toHaveAttribute('heading', 'להפעיל SVC?');
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toHaveText('הפעל');
  });

  test('stale: the row is replaced by the server current stream, the camera is read again, one line', async ({ page }) => {
    await open(page);
    const before = detailReads(st, 'cam-1');
    st.put = 'stale';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('הערכים השתנו ב־NVR. נטען מחדש.');
    await unchecked(toggleOf(page, 1, '101')); // the server's stream (someone switched it off on the NVR) replaced ours
    await expect.poll(() => detailReads(st, 'cam-1')).toBeGreaterThan(before); // a READ of the camera, not a repeat of the write
    expect(putCount(st)).toBe(1);
    await shot(page, 'write-04-stale');
  });

  test('busy: the switch stays, one line, exactly one PUT (never retried)', async ({ page }) => {
    await open(page);
    st.put = 'busy';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('ה־NVR עסוק. נסו שוב בעוד רגע.');
    await checked(toggleOf(page, 1, '101'));
    await page.waitForTimeout(1500);
    expect(putCount(st)).toBe(1);
    await expect(toast(page)).toHaveCount(0);
    await shot(page, 'write-05-busy');
    // a new press clears the line and may try again by hand
    st.put = 'ok';
    await toggleSvc101(page);
    await unchecked(toggleOf(page, 1, '101'));
    await expect(lineOf(page)).toHaveCount(0);
    expect(putCount(st)).toBe(2);
  });

  test('no effect: the NVR answered OK and kept the old value - a line, the switch stays', async ({ page }) => {
    await open(page);
    st.put = 'no_effect';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.');
    await checked(toggleOf(page, 1, '101'));
    expect(putCount(st)).toBe(1);
    await shot(page, 'write-06-no-effect');
  });

  test('write in progress: wait, no automatic retry', async ({ page }) => {
    await open(page);
    st.put = 'in_progress';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע.');
    await page.waitForTimeout(1500);
    expect(putCount(st)).toBe(1);
  });

  test('rejected / diverged answers get their own line', async ({ page }) => {
    await open(page);
    st.put = 'rejected';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('ה־NVR דחה את השינוי.');
    st.put = 'diverged';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('ה־NVR שינה רק חלק מההגדרות. נטען מחדש.');
    expect(putCount(st)).toBe(2); // one per press, never a repeat
  });

  test('capabilities unreadable (detail): the switch is disabled, the reason only in its tooltip, no dialog', async ({ page }) => {
    st.noOptions = ['101'];
    await open(page);
    const tog = toggleOf(page, 1, '101');
    await expect(tog).toBeVisible();
    await expect(tog).toHaveAttribute('disabled', '');
    await expect(tog).toHaveAttribute('title', 'יכולות הזרם אינן ידועות');
    await tog.click({ force: true });
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    await expect(lineOf(page)).toHaveCount(0); // no visible explanation paragraph
    expect(st.writes).toEqual([]);
    await shot(page, 'write-07-caps-disabled');
  });

  test('capabilities unreadable (answer of the write): a line, nothing was sent to the device by the screen twice', async ({ page }) => {
    await open(page);
    st.put = 'caps';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('יכולות הזרם אינן ידועות, ולכן השינוי בוטל.');
    await checked(toggleOf(page, 1, '101'));
    expect(putCount(st)).toBe(1);
  });

  test('unknown outcome: "הסטטוס נבדק", the camera is read again, the write is NEVER retried', async ({ page }) => {
    await open(page);
    const before = detailReads(st, 'cam-1');
    st.put = 'unknown';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('הסטטוס נבדק');
    await expect.poll(() => detailReads(st, 'cam-1')).toBeGreaterThan(before);
    await page.waitForTimeout(2000);
    expect(putCount(st)).toBe(1);
    await expect(page.locator(`${scope(page)} [data-nvr-retry], ${scope(page)} [data-nvr-line] button`)).toHaveCount(0); // no retry control
    await shot(page, 'write-08-unknown');
  });

  test('a lost answer (network failure after the request left) is an unknown outcome too', async ({ page }) => {
    await open(page);
    st.put = 'abort';
    await toggleSvc101(page);
    await expect(lineOf(page).first()).toHaveText('הסטטוס נבדק');
    await page.waitForTimeout(1500);
    expect(putCount(st)).toBe(1);
  });

  test('reboot required: the toast says so and links to the NVR page', async ({ page }) => {
    await open(page);
    st.put = 'reboot';
    await toggleSvc101(page);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר. ה־NVR מבקש הפעלה מחדש.');
    await expect(toast(page).locator('[data-nvr-toast-link]')).toHaveAttribute('href', '#/system/security/nvr');
    await expect(toast(page).locator('[data-nvr-undo]')).toHaveText('בטל');
  });

  test('a no-op answer (200, change null): "ללא שינוי", no undo', async ({ page }) => {
    await open(page);
    st.put = 'noop';
    await toggleSvc101(page);
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('ללא שינוי');
    await expect(toast(page).locator('[data-nvr-undo]')).toHaveCount(0);
  });

  test('the undo toast leaves after ten seconds', async ({ page }) => {
    await page.clock.install();
    await open(page);
    await toggleSvc101(page);
    await expect(toast(page)).toHaveCount(1);
    await page.clock.fastForward(10_500);
    await expect(toast(page)).toHaveCount(0);
  });

  test('undo refused because the stream changed since (stale): a line, the row reloaded', async ({ page }) => {
    await open(page);
    await toggleSvc101(page);
    await unchecked(toggleOf(page, 1, '101'));
    st.cameras[0].streams[0].etag = '101e999'; // somebody else changed it on the NVR
    await toast(page).locator('[data-nvr-undo]').click();
    await expect(lineOf(page).first()).toHaveText('הערכים השתנו ב־NVR. נטען מחדש.');
  });

  test('controls: no switch on a stream without SVC; an offline camera gets a disabled one; the pencil follows', async ({ page }) => {
    await open(page);
    await expect(toggleOf(page, 1, '102')).toHaveCount(0); // sub: no <SVC> element, a dash as in S1
    await expect(rowOf(page, 1, '102').locator(phone(page) ? '.svcline' : 'td[data-col="svc"]')).toContainText('—');
    const off = toggleOf(page, 3, '301');
    await expect(off).toHaveAttribute('disabled', '');
    await expect(off).toHaveAttribute('title', 'המצלמה אינה מקוונת');
    await expect(rowOf(page, 1, '101').locator('button[data-edit-stream]')).toBeEnabled();
    await expect(rowOf(page, 3, '301').locator('button[data-edit-stream]')).toBeDisabled();
  });

  test('device down while the detail is read: the controls of that camera are disabled with the reason in the tooltip', async ({ page }) => {
    st.detailDown = ['cam-1'];
    await open(page);
    const tog = toggleOf(page, 1, '101');
    await expect(tog).toHaveAttribute('disabled', '');
    await expect(tog).toHaveAttribute('title', 'ה־NVR אינו זמין');
    await expect(toggleOf(page, 2, '201')).not.toHaveAttribute('disabled');
  });

  test('the registry list (NVR unreadable): no controls at all, the S1 note stays', async ({ page }) => {
    st.stale = true;
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/security/cameras');
    await expect(page.locator(`${PAGE} [data-nvr-stale]`)).toBeVisible();
    await expect(page.locator(`${PAGE} sw-toggle[data-svc-toggle], ${PAGE} button[data-edit-stream]`)).toHaveCount(0);
    expect(st.hits.filter((h) => h.startsWith('GET nvr/cameras/'))).toEqual([]); // no detail reads for a list that cannot be written
  });

  test('no-permission view: system.configure without nvr.configure sees the S1 table - no switch, no pencil, no detail reads, no writes', async ({ page }) => {
    st = newMock(ADMIN);
    st.canWrite = false;
    await install(page, st);
    await open(page);
    await expect(page.locator(`${PAGE} tr[data-stream-row]`).first()).toBeAttached();
    await expect(page.locator(`${PAGE} sw-toggle, ${PAGE} button[data-edit-stream], ${PAGE} th[data-col="edit"], ${PAGE} nvr-camera-editor`)).toHaveCount(0);
    await expect(rowOf(page, 1, '101').locator(phone(page) ? '.svcline' : 'td[data-col="svc"]')).toContainText('פעיל');
    await page.waitForTimeout(500);
    expect(st.hits.filter((h) => h.startsWith('GET nvr/cameras/'))).toEqual([]);
    expect(st.writes).toEqual([]);
    await shot(page, 'write-09-no-permission');
  });

  test('the editor: fields from the options, locks, codec reload, one confirmation with the count, the history with the undo', async ({ page }) => {
    await open(page);
    await expect(rowOf(page, 1, '101').locator('button[data-edit-stream]')).toBeEnabled();
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const drawer = page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`);
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('heading', 'כניסה ראשית');
    const field = (f: string) => drawer.locator(`[data-field="${f}"]`);
    for (const f of ['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'svc', 'smart_codec']) await expect(field(f)).toHaveCount(1);
    const save = drawer.locator('[data-nvr-editor-save]');
    await expect(save).toBeDisabled(); // nothing changed yet
    await shot(page, 'write-10-editor');
    // codec change: the resolution / profile lists are re-read for the new codec; the profile High is not offered -> unset, Save stays off
    await field('codec').locator('select').selectOption('H.265');
    await expect.poll(() => st.hits.some((h) => h.includes('/streams/101/options?codec=H.265'))).toBe(true);
    await expect(field('profile').locator('select')).toHaveValue('');
    await expect(save).toBeDisabled();
    await field('profile').locator('select').selectOption('Main');
    await field('gop').locator('input').fill('60');
    await expect(save).toBeEnabled();
    await save.click();
    const dlg = page.locator(CONFIRM);
    await expect(dlg).toHaveAttribute('heading', 'לשמור את השינויים?');
    await expect(dlg.locator('[data-nvr-confirm-count]')).toHaveText('3 שינויים');
    await expect(dlg.locator('details[data-nvr-confirm-details]')).not.toHaveAttribute('open');
    await shot(page, 'write-11-editor-confirm');
    expect(st.writes).toEqual([]);
    await dlg.locator('[data-nvr-confirm]').click();
    await expect(drawer).toHaveCount(0); // closed on success
    expect(st.writes).toHaveLength(1);
    expect(st.writes[0].body).toEqual({ if_match: '101e1', confirm: true, changes: { codec: 'H.265', profile: 'Main', gop: 60 } });
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('נשמר');
    // the history of the stream (last five, no XML anywhere) with the undo on the newest applied change
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const hist = page.locator(`${PAGE} nvr-camera-editor [data-nvr-history]`);
    await expect(hist).toBeAttached();
    await hist.locator('summary').click();
    await expect(hist.locator('li')).toHaveCount(1);
    await expect(hist.locator('li').first()).toContainText('GOP');
    await expect(hist.locator('li').first()).toContainText('60');
    expect(await page.locator(`${PAGE} nvr-camera-editor`).evaluate((el) => (el.shadowRoot?.textContent ?? '').includes('<?xml'))).toBe(false);
    await shot(page, 'write-12-editor-history');
    await hist.locator('[data-nvr-undo-change]').click();
    await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`)).toHaveCount(0);
    expect(st.writes[1]).toEqual({ method: 'POST', path: 'nvr/changes/chg-1/rollback', body: { confirm: true } });
    await expect(toast(page).locator('[data-nvr-toast-text]')).toHaveText('השינוי בוטל');
  });

  test('the editor: a field another field locks is disabled (reason in the tooltip), a stale save shows the line inside the drawer', async ({ page }) => {
    await open(page);
    await rowOf(page, 2, '201').locator('button[data-edit-stream]').click();
    const drawer = page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`);
    await expect(drawer).toBeVisible();
    // smart codec is on: GOP, bit-rate type and quality are locked
    await expect(drawer.locator('[data-field="gop"] input')).toBeDisabled();
    await expect(drawer.locator('[data-field="gop"] input')).toHaveAttribute('title', 'GOP נעול');
    await expect(drawer.locator('[data-field="bitrate_mode"] select')).toBeDisabled();
    await expect(drawer.locator('[data-field="bitrate_kbps"] input')).toBeEnabled();
    await drawer.locator('[data-field="bitrate_kbps"] input').fill('5000');
    st.put = 'stale';
    await drawer.locator('[data-nvr-editor-save]').click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(drawer.locator('[data-nvr-editor-line]')).toHaveText('הערכים השתנו ב־NVR. נטען מחדש.');
    await expect(drawer).toBeVisible(); // stays open, nothing was lost
    expect(putCount(st)).toBe(1);
  });

  test('device strings are text only: a hostile camera name and profile never become markup', async ({ page }) => {
    st.cameras[0].name = '<img src=x onerror="window.__pwn=1">כניסה';
    st.cameras[0].streams[0].profile = '<b id="pwn">High</b>';
    await open(page);
    await toggleOf(page, 1, '101').click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm-lead]`)).toContainText('<img src=x onerror="window.__pwn=1">כניסה');
    await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`)).toHaveAttribute('heading', '<img src=x onerror="window.__pwn=1">כניסה');
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__pwn)).toBeUndefined();
    expect(await page.locator('img[src="x"], #pwn').count()).toBe(0);
  });

  test('keyboard: the switch opens the dialog with Space, Escape closes it', async ({ page }) => {
    test.skip(phone(page), 'keyboard path, desktop and tablet');
    await open(page);
    const btn = toggleOf(page, 1, '101').locator('button[role="switch"]');
    await btn.focus();
    await page.keyboard.press('Space');
    await expect(page.locator(CONFIRM)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    expect(st.writes).toEqual([]);
  });

  test('no horizontal page scroll with the controls (and the dialog / drawer / toast open)', async ({ page }) => {
    await open(page);
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await expect(toggleOf(page, 1, '101')).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
    await toggleOf(page, 1, '101').click();
    await expect(page.locator(CONFIRM)).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
    const box = await page.locator(`${CONFIRM}`).evaluate((el) => (el.shadowRoot!.querySelector('.box') as HTMLElement).getBoundingClientRect().toJSON());
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(toast(page)).toHaveCount(1);
    expect(await over()).toBeLessThanOrEqual(0);
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`)).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
    await shot(page, 'write-13-editor-open-again');
  });
});

test.describe('CR-020 S2b cameras write: dark and RTL', () => {
  test('dark: switch, confirmation, toast, editor and a failure line', async ({ page }) => {
    const st = newMock();
    await install(page, st);
    await open(page, '&scheme=dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    st.put = 'ok';
    await expect(toggleOf(page, 1, '101')).toBeVisible();
    await shot(page, 'dark-01-ready');
    await toggleOf(page, 1, '101').click();
    await expect(page.locator(CONFIRM)).toBeVisible();
    await shot(page, 'dark-02-confirm');
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(toast(page)).toHaveCount(1);
    await shot(page, 'dark-03-toast');
    // the dialog box is not the light surface: its background is dark
    st.put = 'busy';
    await toggleOf(page, 2, '201').click();
    const bg = await page.locator(CONFIRM).evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.box') as HTMLElement).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3, 'dialog background in dark').toBeLessThan(110);
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(lineOf(page).first()).toHaveText('ה־NVR עסוק. נסו שוב בעוד רגע.');
    await shot(page, 'dark-04-line');
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    await expect(page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`)).toBeVisible();
    await shot(page, 'dark-05-editor');
  });

  test('RTL: the page is right-to-left, the values in the dialog and the editor stay left-to-right', async ({ page }) => {
    const st = newMock();
    await install(page, st);
    await open(page);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!).direction)).toBe('rtl');
    await toggleOf(page, 1, '101').click();
    await page.locator(`${CONFIRM} details summary`).click();
    expect(await page.locator(`${CONFIRM} li[data-field="svc"] bdi`).first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    await page.locator(`${CONFIRM} [data-nvr-cancel]`).click();
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    expect(await page.locator(`${PAGE} nvr-camera-editor [data-field="resolution"] select`).evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  });
});

test.describe('CR-020 S2b cameras write (demo mode, no backend)', () => {
  test('the in-memory demo offers the same controls', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/security/cameras');
    await page.waitForSelector('sw-app');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    const tog = page.locator(`${scope(page)} ${phone(page) ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:1"][data-stream="101"] sw-toggle[data-svc-toggle]`);
    await expect(tog).toBeVisible();
    await tog.click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await unchecked(tog);
    await toast(page).locator('[data-nvr-undo]').click();
    await checked(tog);
  });
});
