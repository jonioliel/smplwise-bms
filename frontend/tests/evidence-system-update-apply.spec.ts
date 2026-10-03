import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_PERMS, BASE_PERMS, BUILD, ENVELOPE, RUN_ID, freshMock, mockBackend, openUpdate as open, runView, withUpdate, type UpdateMock } from './update-run-mocks';

// CR-021 S3 (update and restarts UI): the apply flow (a plain confirmation with a backup choice), the status screen of a run
// (running, verifying, succeeded, version unchanged, interrupted, restart loop, abandoned, waiting for Arx to return, a page
// that reloads when the new version answers), the "הפעלות מחדש" card (Arx / the platform, one dialog), the "restart required" row and
// the user-menu dot, permission gating, error mapping, RTL, phone. Against a MOCKED backend (page.route on api/v1; npm run build first,
// the preview serves dist/) on the three projects. SW_SHOTS=1 writes evidence screenshots to docs/design/evidence/cr021-s3.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cr021-s3');

const isPhone = () => test.info().project.name === 'mobile';
const root = (page: Page) => page.locator('system-update');
const run = (page: Page) => page.locator('system-update sw-update-run');
const card = (page: Page) => page.locator('system-update sw-restarts-card');
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
const FORBIDDEN = /Home Assistant|Supervisor|Ingress|\bHA\b|Companion|HACS/i;

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

/** The visible text of the updates page through every shadow root (the screen, the status screen, the card, the dialogs). */
async function deepText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent ?? '');
      if (n instanceof Element && n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
      n.childNodes.forEach(walk);
    };
    const el = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-update');
    if (el) walk(el);
    return out.join(' ');
  });
}

async function openMenu(page: Page) {
  await page.locator(isPhone() ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  await expect(page.locator('sw-user-menu [data-user-menu]')).toBeVisible();
}

/** Opens the page with an update waiting and presses "עדכן", then the dialog's "עדכן עכשיו". */
async function apply(page: Page, mock: UpdateMock, backup = true) {
  await open(page, '/system/update');
  await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 15000 });
  await root(page).locator('[data-update-apply]').click();
  await expect(root(page).locator('[data-update-dialog]')).toBeVisible();
  if (!backup) await root(page).locator('[data-update-backup]').uncheck();
  await root(page).locator('[data-update-confirm]').click();
  await expect(run(page)).toBeVisible();
  expect(mock.applyBodies.length).toBe(1);
}

test.describe('apply: the confirmation (CR-021 S3)', () => {
  test('"עדכן" opens a plain dialog: versions, one note, the backup box ticked, no typed word', async ({ page }) => {
    const mock = withUpdate(freshMock());
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await root(page).locator('[data-update-apply]').click();
    const dlg = root(page).locator('[data-update-dialog]');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('לעדכן את SmplWise Arx?');
    await expect(dlg.locator('[data-update-dialog-versions]')).toContainText('0.1.156');
    await expect(dlg.locator('[data-update-dialog-versions]')).toContainText('0.1.157');
    await expect(dlg).toContainText('המערכת לא תהיה זמינה כמה דקות');
    await expect(dlg.locator('[data-update-backup]')).toBeChecked();
    await expect(dlg).toContainText('צור גיבוי לפני העדכון');
    await expect(dlg.locator('input[type="text"], input:not([type="checkbox"]), textarea')).toHaveCount(0);
    await expect(dlg.locator('[data-update-confirm]')).toContainText('עדכן עכשיו');
    expect(((await dlg.textContent()) ?? '')).not.toMatch(FORBIDDEN);
    await shot(page, 'apply-dialog');
    await dlg.locator('[data-update-cancel]').click();
    await expect(dlg).toBeHidden();
    expect(mock.applyBodies).toEqual([]);
  });

  test('confirming sends the target version, the backup choice and confirm: true, then the status screen takes the page', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'backing_up', step: 'sending' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock);
    expect(mock.applyBodies[0]).toMatchObject({ target_version: '0.1.157', backup: true, confirm: true });
    expect(String(mock.applyBodies[0].idempotency_key)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await expect(root(page).locator('[data-update-run-page]')).toBeVisible();
    await expect(root(page).locator('[data-update-installed]')).toHaveCount(0);
    await expect(run(page).locator('[data-run-step]')).toHaveCount(4);
    await expect(run(page).locator('[data-run-step="backup"]')).toHaveAttribute('data-run-step-state', 'current');
    await expect(run(page).locator('[data-run-elapsed]')).toHaveText(/^\d\d:\d\d$/);
    await noOverflow(page);
    await shot(page, 'run-backing-up');
  });

  test('without the backup box the backup step is not listed and backup: false is sent', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.startRun = runView({ backup: false });
    mock.runReplies = [runView({ backup: false, state: 'updating', step: 'sending' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock, false);
    expect(mock.applyBodies[0]).toMatchObject({ backup: false, confirm: true });
    await expect(run(page).locator('[data-run-step]')).toHaveCount(3);
    await expect(run(page).locator('[data-run-step="backup"]')).toHaveCount(0);
    await expect(run(page).locator('[data-run-step="install"]')).toHaveAttribute('data-run-step-state', 'current');
  });

  test('a double press of "עדכן עכשיו" sends one request', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'updating' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await root(page).locator('[data-update-apply]').click();
    const btn = root(page).locator('[data-update-confirm]');
    await btn.dblclick();
    await expect(run(page)).toBeVisible();
    expect(mock.applyBodies.length).toBe(1);
  });

  const REFUSALS: [string, number, string, string, Record<string, unknown>?][] = [
    ['update_in_progress', 409, 'עדכון או הפעלה מחדש אחרת עדיין מתבצעים', 'in-progress'],
    ['update_not_available', 409, 'אין עדכון זמין', 'not-available'],
    ['target_version_mismatch', 409, 'הגרסה האחרונה השתנתה', 'mismatch'],
    ['platform_busy', 409, 'תשתית המערכת עסוקה כרגע', 'busy'],
    ['nvr_write_in_progress', 409, 'מתבצעת כעת פעולה במכשירי ההקלטה', 'nvr'],
    ['platform_not_permitted', 503, 'ל-Arx אין הרשאה לעדכן את עצמו', 'not-permitted'],
    ['infrastructure_unreachable', 503, 'תשתית המערכת אינה זמינה כרגע', 'unreachable'],
    ['rate_limited', 429, 'עדכון הופעל לאחרונה. נסו שוב בעוד 8 דקות', 'too-soon', { retry_after_s: 470 }],
    ['forbidden', 403, 'אין הרשאה לבצע את הפעולה', 'forbidden'],
  ];
  for (const [code, status, text, name, details] of REFUSALS) {
    test(`a refused update (${name}) is worded in plain Hebrew inside the dialog, which stays open`, async ({ page }) => {
      const mock = withUpdate(freshMock());
      mock.applyReply = { status, body: ENVELOPE(code, 'RAW-SERVER-TEXT', details ?? {}) };
      await mockBackend(page, ADMIN_PERMS, mock);
      await open(page, '/system/update');
      await root(page).locator('[data-update-apply]').click();
      await root(page).locator('[data-update-confirm]').click();
      const err = root(page).locator('[data-update-apply-error]');
      await expect(err).toContainText(text);
      await expect(err).not.toContainText('RAW-SERVER-TEXT');
      await expect(root(page).locator('[data-update-dialog]')).toBeVisible();
      await expect(run(page)).toHaveCount(0);
      expect(await err.textContent()).not.toMatch(FORBIDDEN);
      await noOverflow(page);
      if (name === 'not-permitted') await shot(page, 'apply-error');
    });
  }

  test('an unknown refusal falls back to the server text, a dropped connection to a plain failure line', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.applyReply = { status: 502, body: ENVELOPE('infrastructure_error', 'תשתית המערכת החזירה שגיאה.') };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await root(page).locator('[data-update-apply]').click();
    await root(page).locator('[data-update-confirm]').click();
    await expect(root(page).locator('[data-update-apply-error]')).toContainText('תשתית המערכת החזירה שגיאה');
  });

  test('while the add-on role is the default: no button, the one-time manual step with instructions', async ({ page }) => {
    const mock = withUpdate(freshMock(), { permitted: 'no', check_result: 'not_permitted' });
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const blocked = root(page).locator('[data-update-blocked]');
    await expect(blocked).toBeVisible({ timeout: 15000 });
    await expect(blocked).toContainText('ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה');
    await expect(root(page).locator('[data-update-apply]')).toHaveCount(0);
    await blocked.locator('[data-update-manual-open]').click();
    await expect(blocked.locator('[data-update-manual] li')).toHaveCount(3);
    await noOverflow(page);
    await shot(page, 'apply-blocked');
  });
});

test.describe('the status screen of a run', () => {
  test('running: the update step is current, the earlier steps are done, no failure text', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'updating', step: 'job_running' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock);
    const steps = run(page).locator('[data-run-step]');
    await expect(steps.nth(0)).toHaveAttribute('data-run-step-state', 'done');
    await expect(steps.nth(1)).toHaveAttribute('data-run-step-state', 'current');
    await expect(steps.nth(2)).toHaveAttribute('data-run-step-state', 'pending');
    await expect(steps).toContainText(['גיבוי', 'הורדה והתקנה', 'הפעלה מחדש', 'בדיקת תקינות']);
    await expect(run(page).locator('[data-run-reason]')).toHaveCount(0);
  });

  test('verifying: the last step is current; success shows the new version and "המשך" back to the page', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'verifying', step: 'health_check' }), runView({ state: 'succeeded', to_version: BUILD, finished_at: new Date().toISOString() })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock);
    await expect(run(page).locator('[data-run-step="verify"]')).toHaveAttribute('data-run-step-state', 'current');
    await shot(page, 'run-verifying');
    await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 15000 });
    await expect(run(page).locator('[data-run-outcome]')).toContainText(`המערכת עודכנה לגרסה ${BUILD}`);
    await shot(page, 'run-succeeded');
    mock.state = { ...mock.state, installed: BUILD, latest: BUILD, update_available: false, check_result: 'current' };
    await run(page).locator('[data-run-continue]').click();
    await expect(root(page).locator('[data-update-installed]')).toHaveText(BUILD);
    await expect(root(page).locator('[data-update-apply]')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('sw.update.run'))).toBeNull();
  });

  const FAILURES: [string, string, string, boolean, string?][] = [
    ['version_unchanged', 'failed', 'העדכון לא הוחל: המערכת חזרה באותה גרסה', true],
    ['interrupted', 'failed', 'הפעולה נקטעה לפני שהסתיימה', true],
    ['restart_loop', 'failed', 'הגרסה החדשה לא עולה כראוי', true],
    ['health_check_failed', 'failed', 'בדיקת התקינות נכשלה', true],
    ['update_job_failed', 'failed', 'הגרסה הקודמת נשארה במקומה', true],
    ['platform_not_permitted', 'failed', 'ל-Arx אין הרשאה לעדכן את עצמו', false],
    ['infrastructure_busy', 'failed', 'תשתית המערכת עסוקה', false],
    ['timeout', 'abandoned', 'העדכון לא הסתיים בזמן', true, 'abandoned'],
  ];
  for (const [code, state, text, guide, label] of FAILURES) {
    test(`a finished update: ${label ?? code} - plain reason${guide ? ', rollback guidance as text only' : ''}`, async ({ page }) => {
      const mock = withUpdate(freshMock());
      mock.runReplies = [runView({ state, error_code: code, finished_at: new Date().toISOString() })];
      await mockBackend(page, ADMIN_PERMS, mock);
      await apply(page, mock);
      const out = run(page).locator(`[data-run-state="${state === 'abandoned' ? 'abandoned' : 'failed'}"]`);
      await expect(out).toBeVisible({ timeout: 15000 });
      await expect(out).toHaveAttribute('data-run-error', code);
      await expect(out.locator('[data-run-reason]')).toContainText(text);
      expect((await out.textContent()) ?? '').not.toMatch(FORBIDDEN);
      const open = run(page).locator('[data-run-guidance-open]');
      if (guide) {
        await expect(open).toBeVisible();
        await expect(run(page).locator('[data-run-guidance]')).toHaveCount(0);
        await open.click();
        await expect(run(page).locator('[data-run-guidance] li')).toHaveCount(3);
        await expect(run(page).locator('[data-run-guidance]')).toContainText('auto-pre-upgrade');
        // guidance only: nothing in the screen restores or downgrades
        await expect(run(page).locator('sw-button, button').filter({ hasText: /^(שחזר|שחזור|הורד גרסה|בצע שחזור)/ })).toHaveCount(0);
        await expect(run(page).locator('[data-run-restore]')).toHaveCount(0);
        if (code === 'restart_loop') await shot(page, 'run-restart-loop');
        if (code === 'version_unchanged') await shot(page, 'run-version-unchanged');
        if (state === 'abandoned') await shot(page, 'run-abandoned');
      } else {
        await expect(open).toHaveCount(0);
      }
      await noOverflow(page);
      await run(page).locator('[data-run-close]').click();
      await expect(root(page).locator('[data-update-installed]')).toBeVisible();
    });
  }

  test('while Arx is down the screen says it waits and keeps asking; the answer after the return ends it', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'restarting', step: 'job_done' }), 'down', { status: 502 }, { status: 503 }, { status: 401 }, runView({ state: 'verifying', step: 'health_check' }), runView({ state: 'succeeded', to_version: BUILD })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock);
    await expect(run(page).locator('[data-run-waiting]')).toBeVisible({ timeout: 15000 });
    await expect(run(page).locator('[data-run-waiting]')).toContainText('ממתין לחזרת המערכת');
    await expect(run(page).locator('[data-run-step="restart"]')).toHaveAttribute('data-run-step-state', 'current');
    await shot(page, 'run-waiting');
    await expect(run(page).locator('[data-run-waiting]')).toHaveCount(0, { timeout: 40000 });
    await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 40000 });
    expect(mock.runGets).toBeGreaterThanOrEqual(7);
  });

  test('a system that never returns: the screen gives up with the guidance in the bundle', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = ['down'];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 15000 });
    await root(page).locator('[data-update-apply]').click();
    await root(page).locator('[data-update-confirm]').click();
    await run(page).evaluate((el) => ((el as unknown as { waitLimitMs: number }).waitLimitMs = 2500));
    const out = run(page).locator('[data-run-state="abandoned"]');
    await expect(out).toBeVisible({ timeout: 20000 });
    await run(page).locator('[data-run-guidance-open]').click();
    await expect(run(page).locator('[data-run-guidance] li')).toHaveCount(3);
  });

  test('the page reloads once when the update finished on another version and still shows the result', async ({ page }) => {
    const mock = withUpdate(freshMock(), { latest: '9.9.9' });
    mock.startRun = runView({ to_version: '9.9.9' });
    mock.runReplies = [runView({ to_version: '9.9.9', state: 'restarting' }), 'down', runView({ to_version: '9.9.9', state: 'succeeded', finished_at: new Date().toISOString() })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await root(page).locator('[data-update-apply]').click();
    let loads = 0;
    page.on('load', () => (loads += 1));
    await root(page).locator('[data-update-confirm]').click();
    await expect.poll(() => loads, { timeout: 30000 }).toBe(1);
    // after the reload: the stored run id brings the outcome back (the state no longer has an open run)
    mock.state = { ...mock.state, installed: '9.9.9', latest: '9.9.9', update_available: false, check_result: 'current', run: null };
    await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 20000 });
    await expect(run(page).locator('[data-run-outcome]')).toContainText('המערכת עודכנה לגרסה 9.9.9');
    await page.waitForTimeout(2500);
    expect(loads).toBe(1); // never a second reload for the same run
    expect(await page.evaluate(() => sessionStorage.getItem('sw.update.reloaded'))).toBe(RUN_ID);
    await run(page).locator('[data-run-continue]').click();
    await expect(root(page).locator('[data-update-installed]')).toHaveText('9.9.9');
    expect(await page.evaluate(() => sessionStorage.getItem('sw.update.run'))).toBeNull();
  });

  test('opening the page while a run is open resumes its status screen from the state', async ({ page }) => {
    const mock = withUpdate(freshMock(), { run: { id: RUN_ID, state: 'updating', step: 'job_running', created_at: new Date().toISOString(), finished_at: null, from_version: '0.1.156', to_version: '0.1.157', error_code: null, kind: 'update' } });
    mock.runReplies = [runView({ state: 'updating', step: 'job_running' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await expect(run(page)).toBeVisible({ timeout: 15000 });
    await expect(run(page).locator('[data-run-step="install"]')).toHaveAttribute('data-run-step-state', 'current');
    await expect(root(page).locator('[data-update-installed]')).toHaveCount(0);
  });

  test('an unknown run id (a stale tab) says so and closes', async ({ page }) => {
    const mock = freshMock();
    mock.runReplies = [];
    await mockBackend(page, ADMIN_PERMS, mock);
    await page.addInitScript(() => sessionStorage.setItem('sw.update.run', 'ffffffffffffffff'));
    await open(page, '/system/update');
    await expect(run(page).locator('[data-run-reason]')).toContainText('הפעולה לא נמצאה', { timeout: 15000 });
    await run(page).locator('[data-run-close]').click();
    await expect(root(page).locator('[data-update-installed]')).toBeVisible();
  });
});

test.describe('the restarts card (CR-021 S3)', () => {
  test('one card, two buttons; no extra hints; no platform wording beyond "תשתית המערכת"', async ({ page }) => {
    await mockBackend(page, ADMIN_PERMS, freshMock());
    await open(page, '/system/update');
    const c = card(page);
    await expect(c).toBeVisible({ timeout: 15000 });
    await expect(c).toContainText('הפעלות מחדש');
    await expect(c.locator('[data-restart-arx]')).toContainText('הפעל מחדש את Arx');
    await expect(c.locator('[data-restart-platform]')).toContainText('הפעל מחדש את תשתית המערכת');
    await expect(c.locator('[data-restart-required]')).toHaveCount(0);
    expect((await c.textContent()) ?? '').not.toMatch(FORBIDDEN);
    await noOverflow(page);
    await shot(page, 'restarts-card');
  });

  test('the platform restart: a plain dialog, confirm: true, then the status screen with its own steps', async ({ page }) => {
    const mock = freshMock();
    mock.startRun = runView({ kind: 'platform_restart', state: 'requested', step: 'config_check' });
    mock.runReplies = [runView({ kind: 'platform_restart', state: 'requested', step: 'config_check' }), runView({ kind: 'platform_restart', state: 'restarting', step: 'restart_accepted' }), runView({ kind: 'platform_restart', state: 'succeeded', finished_at: new Date().toISOString() })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-platform]').click();
    const dlg = card(page).locator('[data-restart-dialog]');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('data-restart-which', 'platform');
    await expect(dlg).toContainText('להפעיל מחדש את תשתית המערכת?');
    await expect(dlg.locator('input')).toHaveCount(0);
    await shot(page, 'restart-platform-dialog');
    await dlg.locator('[data-restart-confirm]').click();
    await expect(run(page)).toBeVisible();
    expect(mock.restartBodies[0]).toMatchObject({ confirm: true });
    expect(String(mock.restartBodies[0].idempotency_key)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await expect(run(page).locator('[data-run-step]')).toContainText(['בדיקת תצורה', 'הפעלה מחדש של תשתית המערכת', 'בדיקת תקינות']);
    await expect(run(page).locator('[data-run-step="config"]')).toHaveAttribute('data-run-step-state', 'current');
    await expect(run(page).locator('[data-run-expect]')).toContainText('עד 10 דקות');
    await shot(page, 'run-platform-config-check');
    await expect(run(page).locator('[data-run-state="succeeded"]')).toBeVisible({ timeout: 20000 });
    await expect(run(page).locator('[data-run-outcome]')).toHaveText('תשתית המערכת הופעלה מחדש');
    await shot(page, 'run-platform-succeeded');
  });

  test('the configuration check failure is shown as the state of the run, in plain language, and no rollback guidance', async ({ page }) => {
    const mock = freshMock();
    mock.startRun = runView({ kind: 'platform_restart', step: 'config_check' });
    mock.runReplies = [runView({ kind: 'platform_restart', state: 'failed', step: 'config_check', error_code: 'platform_config_invalid', finished_at: new Date().toISOString() })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-platform]').click();
    await card(page).locator('[data-restart-confirm]').click();
    const out = run(page).locator('[data-run-state="failed"]');
    await expect(out).toBeVisible({ timeout: 15000 });
    await expect(out).toHaveAttribute('data-run-error', 'platform_config_invalid');
    await expect(out.locator('[data-run-outcome]')).toHaveText('ההפעלה מחדש נכשלה');
    await expect(out.locator('[data-run-reason]')).toContainText('בדיקת התצורה של תשתית המערכת נכשלה, ולכן לא בוצעה הפעלה מחדש');
    await expect(run(page).locator('[data-run-guidance-open]')).toHaveCount(0);
    expect((await out.textContent()) ?? '').not.toMatch(FORBIDDEN);
    await shot(page, 'run-platform-config-invalid');
  });

  for (const [code, text] of [['platform_not_back', 'תשתית המערכת לא חזרה לפעולה בזמן'], ['bridge_not_loaded', 'הגשר שלה לא נטען']] as const) {
    test(`a platform restart that ends with ${code} says why`, async ({ page }) => {
      const mock = freshMock();
      mock.startRun = runView({ kind: 'platform_restart' });
      mock.runReplies = [runView({ kind: 'platform_restart', state: 'failed', error_code: code, finished_at: new Date().toISOString() })];
      await mockBackend(page, ADMIN_PERMS, mock);
      await open(page, '/system/update');
      await card(page).locator('[data-restart-platform]').click();
      await card(page).locator('[data-restart-confirm]').click();
      await expect(run(page).locator('[data-run-reason]')).toContainText(text, { timeout: 15000 });
    });
  }

  test('a refused platform restart (a run is open) stays on the page with a plain line', async ({ page }) => {
    const mock = freshMock();
    mock.restartReply = { status: 409, body: ENVELOPE('update_in_progress', 'RAW') };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-platform]').click();
    await card(page).locator('[data-restart-confirm]').click();
    await expect(card(page).locator('[data-restart-error]')).toContainText('עדכון או הפעלה מחדש אחרת עדיין מתבצעים');
    await expect(run(page)).toHaveCount(0);
  });

  test('cancelling sends nothing', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    for (const which of ['arx', 'platform']) {
      await card(page).locator(`[data-restart-${which}]`).click();
      await expect(card(page).locator('[data-restart-dialog]')).toBeVisible();
      await card(page).locator('[data-restart-cancel]').click();
      await expect(card(page).locator('[data-restart-dialog]')).toBeHidden();
    }
    expect(mock.restartBodies).toEqual([]);
    expect(mock.arxRestarts).toBe(0);
  });

  test('restart Arx: the same dialog, then "המערכת מופעלת מחדש", and the page reloads once Arx answers again', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-arx]').click();
    const dlg = card(page).locator('[data-restart-dialog]');
    await expect(dlg).toHaveAttribute('data-restart-which', 'arx');
    await expect(dlg).toContainText('להפעיל מחדש את Arx?');
    await shot(page, 'restart-arx-dialog');
    mock.meDown = true; // the process ends right after the answer
    await card(page).locator('[data-restart-confirm]').click();
    await expect(card(page).locator('[data-restart-phase="waiting"]')).toContainText('המערכת מופעלת מחדש');
    expect(mock.arxRestarts).toBe(1);
    await shot(page, 'restart-arx-waiting');
    let loads = 0;
    page.on('load', () => (loads += 1));
    await page.waitForTimeout(3500);
    mock.meDown = false; // Arx is back
    await expect.poll(() => loads, { timeout: 15000 }).toBe(1);
  });

  test('restart Arx: a system that does not return shows the manual line and "בדקו שוב"', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-arx]').click();
    mock.meDown = true;
    await page.clock.install();
    await card(page).locator('[data-restart-confirm]').click();
    await expect(card(page).locator('[data-restart-phase="waiting"]')).toBeVisible();
    await page.clock.fastForward(130_000);
    await expect(card(page).locator('[data-restart-manual]')).toContainText('המערכת לא חזרה. הפעילו ידנית.');
    await expect(card(page).locator('[data-restart-again]')).toBeVisible();
  });

  test('restart Arx outside the platform (route says manual): a plain line, no waiting screen', async ({ page }) => {
    const mock = freshMock();
    mock.arxRestartReply = { status: 409, body: ENVELOPE('restart_manual', 'RAW') };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await card(page).locator('[data-restart-arx]').click();
    await card(page).locator('[data-restart-confirm]').click();
    await expect(card(page).locator('[data-restart-error]')).toContainText('יש להפעיל את השירות ידנית');
    await expect(card(page).locator('[data-restart-phase="waiting"]')).toHaveCount(0);
  });

  test('both buttons wait while a run is open', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'updating' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await apply(page, mock);
    // the status screen replaces the cards: nothing else can be started from the page
    await expect(card(page)).toHaveCount(0);
  });
});

test.describe('"restart required": the row in Settings and the dot in the user menu', () => {
  test('a system administrator sees the row on the card and "נדרשת הפעלה מחדש" with a dot in the menu', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, requires_platform_restart: true, platform_restart_reasons: [{ code: 'bridge', version: '1.2.3' }] };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    const row = page.locator('sw-user-menu [data-menu-restart]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('נדרשת הפעלה מחדש');
    await expect(row.locator('.dot')).toBeVisible();
    await expect(page.locator('sw-user-menu [data-menu-update]')).toHaveCount(0);
    expect(((await row.textContent()) ?? '')).not.toMatch(FORBIDDEN);
    await shot(page, 'menu-restart-dot');
    await row.click();
    await expect(page).toHaveURL(/#\/system\/update/);
    const need = card(page).locator('[data-restart-required]');
    await expect(need).toBeVisible({ timeout: 15000 });
    await expect(need).toContainText('נדרשת הפעלה מחדש של תשתית המערכת');
    await expect(card(page).locator('[data-restart-platform]')).toHaveAttribute('variant', 'primary');
    await noOverflow(page);
    await shot(page, 'restart-required-row');
  });

  test('an update row has priority over the restart row, and a current system shows neither', async ({ page }) => {
    const mock = withUpdate(freshMock(), { requires_platform_restart: true });
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    await expect(page.locator('sw-user-menu [data-menu-update]')).toBeVisible();
    await expect(page.locator('sw-user-menu [data-menu-restart]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const calm = freshMock();
    const page2 = await page.context().newPage();
    await mockBackend(page2, ADMIN_PERMS, calm);
    await open(page2, '/devices/building');
    await page2.locator(isPhone() ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
    await expect(page2.locator('sw-user-menu [data-menu-settings]')).toBeVisible();
    await expect(page2.locator('sw-user-menu [data-menu-restart]')).toHaveCount(0);
    await expect(page2.locator('sw-user-menu [data-menu-update]')).toHaveCount(0);
  });

  test('someone without system.update sees no row and the server is never asked', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, requires_platform_restart: true };
    await mockBackend(page, BASE_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    await expect(page.locator('sw-user-menu [data-menu-settings]')).toBeVisible();
    await expect(page.locator('sw-user-menu [data-menu-restart]')).toHaveCount(0);
    expect(mock.stateCalls).toBe(0);
  });
});

test.describe('permission gating, RTL, phone', () => {
  test('without system.update the updates page offers no apply, no restart and sends nothing', async ({ page }) => {
    const mock = withUpdate(freshMock());
    await mockBackend(page, BASE_PERMS, mock);
    await open(page, '/system/update');
    await page.waitForTimeout(800);
    await expect(root(page).locator('[data-update-apply]')).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);
    expect(mock.applyBodies).toEqual([]);
    expect(mock.restartBodies).toEqual([]);
    expect(mock.arxRestarts).toBe(0);
  });

  test('RTL: the page and the dialog run right to left, version numbers stay left to right', async ({ page }) => {
    const mock = withUpdate(freshMock());
    mock.runReplies = [runView({ state: 'updating' })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl');
    expect(await root(page).locator('[data-update-installed]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    await root(page).locator('[data-update-apply]').click();
    expect(await root(page).locator('[data-update-dialog-versions] .ver').first().evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    // the apply button sits at the inline start (right edge) of the notes card
    const card0 = await root(page).locator('[data-update-notes]').boundingBox();
    const btn = await root(page).locator('[data-update-apply]').boundingBox();
    expect(card0 && btn && btn.x + btn.width > card0.x + card0.width / 2).toBeTruthy();
  });

  test('layout: no overflow, 44 px targets on touch layouts, in every screen state', async ({ page }) => {
    const mock = withUpdate(freshMock(), { requires_platform_restart: true });
    mock.runReplies = [runView({ state: 'failed', error_code: 'restart_loop', finished_at: new Date().toISOString() })];
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    await expect(root(page).locator('[data-update-apply]')).toBeVisible({ timeout: 15000 });
    await noOverflow(page);
    if (isPhone()) {
      // the checkbox row and the buttons of the apply flow
      await root(page).locator('[data-update-apply]').click();
      expect(await root(page).locator('.chk').boundingBox().then((b) => b?.height ?? 0)).toBeGreaterThanOrEqual(44);
      await root(page).locator('[data-update-cancel]').click();
      await card(page).locator('[data-restart-platform]').click();
      await expect(card(page).locator('[data-restart-confirm]')).toBeVisible();
      await card(page).locator('[data-restart-cancel]').click();
    }
    await root(page).locator('[data-update-apply]').click();
    await root(page).locator('[data-update-confirm]').click();
    await expect(run(page).locator('[data-run-guidance-open]')).toBeVisible({ timeout: 15000 });
    await run(page).locator('[data-run-guidance-open]').click();
    await noOverflow(page);
    expect(await deepText(page)).not.toMatch(FORBIDDEN);
  });
});
