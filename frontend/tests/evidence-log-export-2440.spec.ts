import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033 acceptance 2): הגדרות › בריאות ועבודות › "ייצוא יומן מצונזר" against a MOCKED backend
// (page.route on api/v1; every value is fake). Proven on the desktop and the mobile project, Domus (the default skin):
//   1. the card offers the window (60 minutes by default, up to 24 hours) and the level (information and above by default);
//   2. the button asks first: the confirmation says the window and the level, what is hidden and that nothing visual is included;
//      "ביטול" posts nothing and says no file was created;
//   3. "אישור והורדה" posts consent: true with the chosen window and level, and the browser saves the server's JSON under its own name;
//   4. a refusal (403), a missing consent (422 consent_required) and a failure (500) stay on the card with a retry;
//   5. English: the card, the options and the dialog in English, no platform name; a user without settings rights sees no card;
//   no sideways page scroll anywhere.
//   npx playwright test tests/evidence-log-export-2440.spec.ts --project=desktop --project=mobile --workers=1

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-FE-LOGEXPORT-TARIFF-EN-2440');
const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign', 'sources.configure', 'notify.manage'];
const VIEWER = ['video.live', 'map.read', 'events.read'];
const FILE = 'arx-logs-20261119T081500Z.json';
const DOC = { format: 'arx.logs/1', version: 'test', records: [{ at: '2026-11-19T08:10:00Z', level: 'ERROR', logger: 'smplwise.nvr', correlation_id: 'req-1234abcd', message: 'NVR request failed for <ip>' }] };

type Answer = 'ok' | 'forbidden' | 'consent' | 'fail';
interface Mock {
  posts: Record<string, unknown>[];
  answer: Answer;
}

async function boot(page: Page, o: { admin?: boolean; lang?: 'he' | 'en' } = {}): Promise<Mock> {
  const st: Mock = { posts: [], answer: 'ok' };
  const perms = o.admin === false ? VIEWER : ADMIN;
  if (o.lang === 'en') await page.addInitScript(() => localStorage.setItem('sw.ui.lang', 'en'));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: o.lang === 'en' ? { 'ui.lang': 'en' } : {}, stored: o.lang === 'en' ? ['ui.lang'] : [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: o.admin !== false, nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-19T08:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full', discovery: { cameras_last_ok: '2026-11-19T08:00:00Z', cameras_last_error: null, streams_last_error: null, interval_s: 300 } });
    if (p.startsWith('health/report')) return json({ status: 'warn', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-11-19T08:00:00Z', probe_ttl_s: 20, checks: [{ id: 'db', label: 'מסד נתונים', status: 'ok', detail: 'תקין', meta: {} }, { id: 'nvr', label: 'NVR', status: 'warn', detail: 'זמן תגובה ארוך', meta: {} }] });
    if (p === 'health/logs/export' && req.method() === 'POST') {
      st.posts.push(req.postDataJSON() as Record<string, unknown>);
      if (st.answer === 'forbidden') return json({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'req-f', details: {} }, 403);
      if (st.answer === 'consent') return json({ code: 'consent_required', user_message: 'ייצוא היומן דורש אישור מפורש (consent).', retryable: false, correlation_id: 'req-c', details: {} }, 422);
      if (st.answer === 'fail') return json({ code: 'internal', user_message: 'שגיאה פנימית (בדיקה)', retryable: true, correlation_id: 'req-x', details: {} }, 500);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Content-Disposition': `attachment; filename="${FILE}"`, 'Cache-Control': 'no-store' }, body: JSON.stringify(DOC) });
    }
    if (p === 'recorder-health') return json({ recorders: [], interval_s: 60, can_manage: true });
    if (p === 'camera-image-health/settings') return json({ values: { enabled: false }, ranges: {}, cameras: [], source: 'camera.image' });
    if (p.startsWith('notify/policies/')) return json({ code: 'forbidden', user_message: 'x', retryable: false, correlation_id: '', details: {} }, 403);
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto('/?scheme=light#/system/diagnostics?tab=health');
  return st;
}

const CARD = 'health-log-export';
const DLG = 'sw-confirm-dialog';

async function noSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no sideways page scroll').toBeLessThanOrEqual(0);
}

test.describe('redacted log export (T033)', () => {
  test('defaults, consent first, cancel creates nothing, confirm downloads the JSON', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => { errors.push(`native dialog: ${d.message()}`); void d.dismiss(); });
    const st = await boot(page);
    const card = page.locator(`${CARD} [data-log-export]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('ייצוא יומן מצונזר');
    await expect(page.locator(`${CARD} [data-log-window]`)).toHaveValue('60');
    await expect(page.locator(`${CARD} [data-log-level]`)).toHaveValue('INFO');
    await expect(page.locator(`${CARD} [data-log-window] option`)).toHaveText(['15 דקות', 'שעה (ברירת מחדל)', '3 שעות', '6 שעות', '12 שעות', '24 שעות']);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE, `log-export-card-${info.project.name}.png`) });

    await page.locator(`${CARD} [data-log-window]`).selectOption('180');
    await page.locator(`${CARD} [data-log-export-go]`).click();
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toBeVisible();
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toContainText('ב־3 השעות האחרונות (מידע, אזהרות ושגיאות)');
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toContainText('אין בו וידאו, תמונות או תוכניות');
    await expect(page.locator(`${DLG} [data-confirm-ok]`)).toHaveText('אישור והורדה');
    await page.screenshot({ path: path.join(EVIDENCE, `log-export-consent-${info.project.name}.png`) });
    await page.locator(`${DLG} [data-confirm-cancel]`).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-log-export-toast]`)).toHaveText('הייצוא בוטל; לא נוצר קובץ');
    expect(st.posts, 'cancel posts nothing').toEqual([]);

    await page.locator(`${CARD} [data-log-level]`).selectOption('WARNING');
    await page.locator(`${CARD} [data-log-export-go]`).click();
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toContainText('(אזהרות ושגיאות)');
    const download = page.waitForEvent('download');
    await page.locator(`${DLG} [data-confirm-ok]`).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe(FILE);
    expect(st.posts).toEqual([{ consent: true, minutes: 180, min_level: 'WARNING', include_health: true }]);
    await expect(page.locator(`${CARD} [data-log-export-toast]`)).toHaveText(`הקובץ ${FILE} הורד`);
    await expect(page.locator(`${CARD} [data-log-export-error]`)).toHaveCount(0);
    await noSideways(page);
    expect(errors, 'page errors').toEqual([]);
  });

  test('refusal, missing consent and a failure stay on the card with a retry', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const st = await boot(page);
    await expect(page.locator(`${CARD} [data-log-export]`)).toBeVisible({ timeout: 20_000 });
    const run = async (via: string) => {
      await page.locator(`${CARD} ${via}`).click();
      await page.locator(`${DLG} [data-confirm-ok]`).click();
      await expect(page.locator(DLG)).toHaveCount(0);
    };
    st.answer = 'forbidden';
    await run('[data-log-export-go]');
    await expect(page.locator(`${CARD} [data-log-export-error]`)).toHaveText('רק מי שמורשה לנהל את הגדרות המערכת יכול לייצא את היומן.');
    await expect(page.locator(`${CARD} [data-log-export-retry]`)).toBeVisible();
    st.answer = 'consent';
    await run('[data-log-export-retry]');
    await expect(page.locator(`${CARD} [data-log-export-error]`)).toHaveText('השרת לא קיבל את האישור. נסו שוב ואשרו את הייצוא.');
    st.answer = 'fail';
    await run('[data-log-export-retry]');
    await expect(page.locator(`${CARD} [data-log-export-error]`)).toHaveText('הייצוא נכשל: שגיאה פנימית (בדיקה)');
    await page.locator(`${CARD} [data-log-export]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE, `log-export-error-${info.project.name}.png`) });
    st.answer = 'ok';
    const download = page.waitForEvent('download');
    await run('[data-log-export-retry]');
    await download;
    await expect(page.locator(`${CARD} [data-log-export-error]`)).toHaveCount(0);
    expect(st.posts).toHaveLength(4);
    expect(st.posts.every((b) => b.consent === true && b.minutes === 60 && b.min_level === 'INFO')).toBe(true);
    await noSideways(page);
    expect(errors, 'page errors').toEqual([]);
  });

  test('English interface; no card without the settings right', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page, { lang: 'en' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const card = page.locator(`${CARD} [data-log-export]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText('Redacted log export');
    await expect(page.locator(`${CARD} [data-log-window] option`)).toHaveText(['15 minutes', '1 hour (default)', '3 hours', '6 hours', '12 hours', '24 hours']);
    await expect(page.locator(`${CARD} [data-log-level] option`)).toHaveText(['Information and above (default)', 'Warnings and errors', 'Errors only']);
    await expect(page.locator(`${CARD} [data-log-export-go]`)).toHaveText('Export the log');
    const text = (await card.innerText()) ?? '';
    expect(text).not.toMatch(/[֐-׿]/);
    expect(text).not.toMatch(/home assistant/i);
    await page.locator(`${CARD} [data-log-export-go]`).click();
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toContainText('in the last hour (information, warnings and errors)');
    await expect(page.locator(`${DLG} [data-confirm-ok]`)).toHaveText('Confirm and download');
    await page.screenshot({ path: path.join(EVIDENCE, `log-export-consent-en-${info.project.name}.png`) });
    await page.locator(`${DLG} [data-confirm-cancel]`).click();
    await expect(page.locator(`${CARD} [data-log-export-toast]`)).toHaveText('The export was cancelled; no file was created');
    await noSideways(page);

    const viewer = await page.context().newPage();
    await boot(viewer, { admin: false });
    await expect(viewer.locator('sw-app')).toBeAttached({ timeout: 20_000 });
    await viewer.waitForTimeout(1500);
    await expect(viewer.locator(CARD)).toHaveCount(0);
    await viewer.close();
    expect(errors, 'page errors').toEqual([]);
  });
});
