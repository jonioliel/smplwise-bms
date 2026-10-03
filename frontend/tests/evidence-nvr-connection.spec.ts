import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// CR-022 slice C: the NVR connection screens - the shared form (vendor choice, test, save, offline save, remove NVR), the settings
// card, the wizard's NVR step and the restart-required banner (AT-022-21 ... AT-022-24). Against a MOCKED backend (page.route on
// api/v1; npm run build first, the preview serves dist/) on the three projects (desktop, tablet, mobile). The server side
// (encryption, SSRF policy, rate limits, the restart route) is tests/test_nvr_connection.py; the real-backend flow is
// evidence-nvr-connection-live.spec.ts. SW_SHOTS=1 writes evidence screenshots to docs/design/evidence/nn4.
// Every value here is fake: no real host, serial number or credential. The "password" below is a canary the page must never echo.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn4');
const ADMIN = ['video.live', 'video.playback', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const OPERATOR = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'events.read'];
const CANARY = 'canary-pass-7431';
const QUICK = !!process.env.LAYOUT_QUICK;

const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

const VENDORS = [
  { id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [
    { key: 'host', label: 'כתובת', kind: 'host', required: true, secret: false }, { key: 'http_port', label: 'פורט HTTP', kind: 'port', required: true, secret: false },
    { key: 'rtsp_port', label: 'פורט RTSP', kind: 'port', required: true, secret: false }, { key: 'username', label: 'שם משתמש', kind: 'text', required: true, secret: false },
    { key: 'password', label: 'סיסמה', kind: 'password', required: true, secret: true } ] },
  { id: 'provision_isr', label: 'Provision-ISR', status: 'planned', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [] },
  { id: 'frigate', label: 'Frigate', status: 'planned', default_ports: { http_port: 5000, rtsp_port: 8554 }, fields: [] },
  { id: 'none', label: 'ללא NVR', status: 'available', default_ports: {}, fields: [] },
];

interface View {
  vendor: string | null; host: string | null; http_port: number | null; rtsp_port: number | null; username: string | null; has_password: boolean; state: string; revision: number | null;
  cameras: number; vendor_locked: boolean; legacy_options_differ: boolean; restart: 'addon' | 'manual';
}

interface Mock {
  perms: string[];
  mode: 'full' | 'ha_only';
  pending: boolean;
  /** The restart route: the system comes back (the pending flag clears, the page reloads) or never does. */
  comesBack: boolean;
  restartStatus: number;
  view: View;
  test: { status: number; body: Record<string, unknown> };
  /** PUT answers in order (an error first, then the default behaviour); null = default. */
  saveFail: { status: number; body: Record<string, unknown> } | null;
  nvrStep: 'todo' | 'done';
  calls: { vendors: number; connection: number; tests: Record<string, unknown>[]; saves: Record<string, unknown>[]; removes: Record<string, unknown>[]; restarts: number };
}

function freshMock(over: Partial<Mock> = {}, view: Partial<View> = {}): Mock {
  return {
    perms: ADMIN, mode: 'full', pending: false, comesBack: true, restartStatus: 202,
    view: { vendor: null, host: null, http_port: null, rtsp_port: null, username: null, has_password: false, state: 'not_chosen', revision: null, cameras: 0, vendor_locked: false, legacy_options_differ: false, restart: 'addon', ...view },
    test: { status: 200, body: { ok: true, code: 'ok', model: 'DS-FAKE-7616', firmware: 'V4 fake', channels: 8 } },
    saveFail: null, nvrStep: 'todo',
    calls: { vendors: 0, connection: 0, tests: [], saves: [], removes: [], restarts: 0 }, ...over,
  };
}

const HEALTH = (mode: string) => ({
  status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: mode === 'full', go2rtc_configured: true, mode,
  discovery: { cameras_last_ok: '2026-10-03T08:00:00Z', cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 4, interval_s: 600 },
  events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: '2026-10-03T08:00:00Z', last_error: null, reconnects: 0, events_stored: 3, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 3 },
  home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 10, started_at: null, ha_version: '2026.9' },
  identity_source: 'ingress', renderer: 'fake',
});

function setupState(m: Mock) {
  const base = { warnings: [], problem: null, checked_at: '2026-10-03T08:00:00Z', facts: [], evidence: {}, settings_link: { href: '#/system/setup', label: 'הגדרות › חיבורים' }, source: 'local' };
  const step = (id: string, index: number, title: string, status: string, summary: string, extra: Record<string, unknown> = {}) => ({ ...base, id, index, title, status, summary, ...extra });
  const nvr = m.nvrStep === 'done'
    ? step('nvr', 2, 'חיבור ל־NVR', 'done', m.view.vendor === 'none' ? 'ללא NVR - נבחר במפורש.' : 'DS-FAKE-7616 · 8 ערוצים', m.view.vendor === 'none' ? { status_label: 'ללא NVR' } : {})
    : step('nvr', 2, 'חיבור ל־NVR', 'todo', 'עדיין לא נבחר סוג NVR להתקנה.', { problem: { code: 'nvr_choice_needed', message: 'עדיין לא נבחר סוג NVR להתקנה.', action: 'בחרו את סוג ה־NVR והזינו את פרטי החיבור, או בחרו "ללא NVR".', link: null } });
  const steps = [step('install', 1, 'התקנת המערכת', 'done', 'גרסה test'), nvr, step('ha', 3, 'תשתית המערכת והגשר', 'done', 'מחובר'), step('go2rtc', 4, 'go2rtc (וידאו חי)', 'done', 'מחובר'), step('floor', 5, 'קומה ותוכנית', 'done', 'קומה אחת'),
    step('camera', 6, 'מצלמה על המפה', 'not_applicable', 'דילוג', { status_label: 'דילוג - מצב ללא NVR' })];
  const required = steps.filter((s) => s.status !== 'not_applicable');
  const done = required.filter((s) => s.status === 'done').length;
  return { version: 'test', mode: 'ha_only', checked_at: '2026-10-03T08:00:00Z', steps, done, total: required.length, ready: done === required.length, next: required.find((s) => s.status !== 'done')?.id ?? null, thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600 };
}

async function mockBackend(page: Page, m: Mock) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const admin = m.perms.includes('system.configure');
    const body = () => (req.postDataJSON() ?? {}) as Record<string, unknown>;
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: m.perms, permissions_any: m.perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: m.mode,
        ...(admin ? { connection_pending_restart: m.pending } : {}),
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-03T00:00:00Z', version: 'test' });
    if (p === 'health') return json(HEALTH(m.mode));
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'setup/state' || p.startsWith('setup/check/')) return json(setupState(m));
    if (p === 'nvr/vendors') {
      m.calls.vendors += 1;
      return admin ? json({ vendors: VENDORS }) : json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
    }
    if (p === 'nvr/connection' && req.method() === 'GET') {
      m.calls.connection += 1;
      if (!admin) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      return json({ ...m.view, user: m.view.username, extra: {}, source: m.view.vendor ? 'ui' : null, updated_at: null, updated_by: null, pending_restart: m.pending, placeholder: false, in_addon: true });
    }
    if (p === 'nvr/connection/test') {
      m.calls.tests.push(body());
      return json(m.test.body, m.test.status);
    }
    if (p === 'nvr/connection' && req.method() === 'PUT') {
      const b = body();
      m.calls.saves.push(b);
      if (m.saveFail) {
        const f = m.saveFail;
        if (!b.save_untested) return json(f.body, f.status);
      }
      m.view = { ...m.view, vendor: String(b.vendor), host: (b.host as string) ?? null, http_port: (b.http_port as number) ?? null, rtsp_port: (b.rtsp_port as number) ?? null, username: (b.username as string) ?? null, has_password: b.vendor !== 'none' && (!!b.password || m.view.has_password), state: b.vendor === 'none' ? 'ok' : 'ok', revision: (m.view.revision ?? 0) + 1 };
      m.pending = true;
      if (b.vendor === 'none') m.nvrStep = 'done';
      return json({ saved: true, restart_required: true, restarting: false, device: b.save_untested ? null : { model: 'DS-FAKE-7616', firmware: 'V4 fake', channels: 8 }, untested: !!b.save_untested, ...m.view, user: m.view.username, extra: {}, source: 'ui', updated_at: null, updated_by: null, pending_restart: true, in_addon: true });
    }
    if (p === 'nvr/connection' && req.method() === 'DELETE') {
      m.calls.removes.push(body());
      m.view = { ...m.view, vendor: 'none', host: null, http_port: null, rtsp_port: null, username: null, has_password: false, state: 'ok', revision: (m.view.revision ?? 0) + 1, vendor_locked: false };
      m.pending = true;
      return json({ removed: true, restart_required: true, revision: m.view.revision, cameras_disabled: m.view.cameras });
    }
    if (p === 'system/restart' && req.method() === 'POST') {
      m.calls.restarts += 1;
      if (m.restartStatus !== 202) return json(m.restartStatus === 409 ? ENVELOPE('restart_manual', 'יש להפעיל מחדש את השירות באופן ידני.') : ENVELOPE('rate_limited', 'המערכת הופעלה מחדש לפני רגע'), m.restartStatus);
      if (m.comesBack) setTimeout(() => { m.pending = false; if (m.view.vendor && m.view.vendor !== 'none') m.nvrStep = 'done'; }, 1500);
      return json({ restarting: true }, 202);
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

async function open(page: Page, hash: string, query = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

const FORM = 'system-setup nvr-connection-form';
const WIZ = 'system-wizard [data-wizard-nvr-form] nvr-connection-form';
const BANNER = 'sw-app nvr-restart-banner [data-restart-banner]';
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function fillHikvision(page: Page, root: string, over: { host?: string; user?: string; password?: string } = {}) {
  await page.locator(`${root} [data-conn-vendor]`).selectOption('hikvision');
  await page.locator(`${root} [data-conn-field="host"]`).fill(over.host ?? 'nvr.fake.test');
  await page.locator(`${root} [data-conn-field="username"]`).fill(over.user ?? 'viewer');
  await page.locator(`${root} [data-conn-field="password"]`).fill(over.password ?? CANARY);
}

test.describe('NVR connection form (settings card)', () => {
  test('AT-022-21: the vendor list comes from the catalogue - Hikvision and "ללא NVR" selectable, the planned vendors greyed with "בקרוב"', async ({ page }) => {
    const m = freshMock();
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    const opts = form.locator('[data-conn-vendor] option');
    await expect(opts).toHaveText(['בחרו סוג NVR', 'Hikvision', 'Provision-ISR · בקרוב', 'Frigate · בקרוב', 'ללא NVR']);
    await expect(form.locator('[data-conn-vendor] option:disabled')).toHaveText(['בחרו סוג NVR', 'Provision-ISR · בקרוב', 'Frigate · בקרוב']);
    // nothing chosen: no fields, and no test or removal to offer
    await expect(form.locator('[data-conn-field]')).toHaveCount(0);
    await expect(form.locator('[data-conn-remove]')).toHaveCount(0);
    await expect(form.locator('[data-conn-save]')).toHaveAttribute('disabled', '');
    await page.locator(`${FORM} [data-conn-vendor]`).selectOption('hikvision');
    await expect(form.locator('[data-conn-field]')).toHaveCount(4 + 1);
    await expect(form.locator('[data-conn-field="http_port"]')).toHaveValue('80');
    await expect(form.locator('[data-conn-field="rtsp_port"]')).toHaveValue('554');
    await expect(form.locator('[data-conn-test]')).toHaveAttribute('disabled', '');
    await shot(page, 'settings-form-empty');
    await noOverflow(page);
  });

  test('AT-022-21: test, then save - the password is write-only: sent once, cleared after the save, never shown back ("הוגדרה סיסמה" + "שנה")', async ({ page }) => {
    const m = freshMock();
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    await fillHikvision(page, FORM);
    await expect(form.locator('[data-conn-field="password"]')).toHaveAttribute('type', 'password');
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveText('מחובר · DS-FAKE-7616 · 8 ערוצים');
    expect(m.calls.tests).toHaveLength(1);
    expect(m.calls.tests[0]).toMatchObject({ vendor: 'hikvision', host: 'nvr.fake.test', username: 'viewer', password: CANARY, use_stored_password: false });
    await shot(page, 'settings-test-ok');
    await form.locator('[data-conn-save]').click();
    await expect(form.locator('[data-conn-msg]')).toContainText('החיבור נבדק ונשמר', { timeout: 10000 });
    expect(m.calls.saves).toHaveLength(1);
    expect(m.calls.saves[0]).toMatchObject({ vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', password: CANARY, if_revision: 0 });
    expect(m.calls.saves[0]).not.toHaveProperty('save_untested');
    // after the save: a summary, the typed password is gone from the page, the form never holds a stored one
    await expect(form.locator('[data-conn-summary]')).toContainText('Hikvision');
    await expect(form.locator('[data-conn-summary]')).toContainText('הוגדרה סיסמה');
    expect(await page.evaluate((c) => document.documentElement.outerHTML.includes(c) || [...document.querySelectorAll('*')].some((e) => e.shadowRoot && e.shadowRoot.innerHTML.includes(c)), CANARY)).toBe(false);
    await form.locator('[data-conn-edit]').click();
    await expect(form.locator('[data-conn-password-set]')).toBeVisible();
    await expect(form.locator('[data-conn-field="password"]')).toHaveCount(0);
    // keeping the stored password sends none, and the test asks the server to use the stored one
    await form.locator('[data-conn-field="username"]').fill('viewer2');
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toBeVisible();
    expect(m.calls.tests[1]).not.toHaveProperty('password');
    expect(m.calls.tests[1]).toMatchObject({ use_stored_password: true, username: 'viewer2' });
    await form.locator('[data-conn-password-change]').click();
    await expect(form.locator('[data-conn-field="password"]')).toHaveValue('');
    await shot(page, 'settings-edit-password');
    // the restart banner appears (the shell follows the save)
    await expect(page.locator(BANNER)).toContainText('נדרשת הפעלה מחדש כדי להחיל את השינוי');
  });

  test('AT-022-21: wrong credentials and a refused address get one short line and no way to save anyway', async ({ page }) => {
    const m = freshMock();
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    await fillHikvision(page, FORM);
    m.test = { status: 200, body: { ok: false, code: 'source_forbidden' } };
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveText('שם משתמש או סיסמה שגויים');
    await expect(form.locator('[data-conn-save-anyway]')).toHaveCount(0);
    m.test = { status: 422, body: ENVELOPE('host_refused', 'הכתובת אינה מותרת לחיבור NVR.', { field: 'host' }) };
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveText('כתובת לא מותרת');
    await expect(form.locator('[data-conn-save-anyway]')).toHaveCount(0);
    // a rejected save says so, still no "save anyway"
    m.saveFail = { status: 502, body: ENVELOPE('source_forbidden', 'ה־NVR דחה את שם המשתמש או הסיסמה.', { can_save_untested: false }) };
    await form.locator('[data-conn-save]').click();
    await expect(form.locator('[data-conn-msg]')).toHaveText('ה־NVR דחה את שם המשתמש או הסיסמה.');
    await expect(form.locator('[data-conn-save-anyway]')).toHaveCount(0);
    expect(m.view.vendor).toBeNull();
  });

  test('AT-022-21: an unreachable NVR is saved only after typing "שמור"', async ({ page }) => {
    const m = freshMock();
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    await fillHikvision(page, FORM);
    m.test = { status: 200, body: { ok: false, code: 'source_unavailable' } };
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveText('לא ניתן להתחבר');
    await expect(form.locator('[data-conn-save-anyway]')).toBeVisible();
    await shot(page, 'settings-unreachable');
    await form.locator('[data-conn-save-anyway]').click();
    const dlg = form.locator('[data-conn-untested-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg.locator('[data-conn-untested-confirm]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-conn-untested-word]').fill('שמרו');
    await expect(dlg.locator('[data-conn-untested-confirm]')).toHaveAttribute('disabled', '');
    await shot(page, 'settings-untested-dialog');
    expect(m.calls.saves).toHaveLength(0);
    await dlg.locator('[data-conn-untested-word]').fill('שמור');
    await dlg.locator('[data-conn-untested-confirm]').click();
    await expect(form.locator('[data-conn-msg]')).toHaveText('נשמר בלי בדיקת חיבור', { timeout: 10000 });
    expect(m.calls.saves).toHaveLength(1);
    expect(m.calls.saves[0]).toMatchObject({ save_untested: true, confirm_text: 'שמור', password: CANARY });
    // the save route itself can answer "unreachable" too (the test line was skipped): the offer appears from its answer
    m.saveFail = { status: 503, body: ENVELOPE('source_unavailable', 'לא ניתן להתחבר ל־NVR.', { can_save_untested: true }) };
    await form.locator('[data-conn-edit]').click();
    await form.locator('[data-conn-field="host"]').fill('other.fake.test');
    // security review: a changed address never inherits the stored password - the "kept" state is gone and a password must be typed
    await expect(form.locator('[data-conn-password-set]')).toHaveCount(0);
    await expect(form.locator('[data-conn-save]')).toHaveAttribute('disabled', '');
    await form.locator('[data-conn-field="host"]').fill('nvr.fake.test'); // back to the stored address: kept again
    await expect(form.locator('[data-conn-password-set]')).toBeVisible();
    await form.locator('[data-conn-field="host"]').fill('other.fake.test');
    await form.locator('[data-conn-field="password"]').fill(CANARY);
    await form.locator('[data-conn-save]').click();
    await expect(form.locator('[data-conn-msg]')).toHaveText('לא ניתן להתחבר ל־NVR.');
    await expect(form.locator('[data-conn-save-anyway]')).toBeVisible();
  });

  test('AT-022-21: "הסר NVR" asks for the typed word "הסר", says the cameras stay disabled, and a vendor change with cameras is locked until then', async ({ page }) => {
    const m = freshMock({}, { vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 3, cameras: 4, vendor_locked: true });
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-summary]')).toContainText('nvr.fake.test', { timeout: 20000 });
    await form.locator('[data-conn-edit]').click();
    await expect(form.locator('[data-conn-vendor]')).toBeDisabled();
    await expect(form.locator('[data-conn-vendor-locked]')).toHaveText('יש להסיר את ה־NVR לפני החלפת סוג');
    await shot(page, 'settings-vendor-locked');
    await form.locator('[data-conn-cancel]').click();
    await form.locator('[data-conn-remove]').first().click();
    const dlg = form.locator('[data-conn-remove-dialog]');
    await expect(dlg).toContainText('המצלמות יישארו במערכת ויושבתו');
    await expect(dlg.locator('[data-conn-remove-confirm]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-conn-remove-word]').fill('הסרה');
    await expect(dlg.locator('[data-conn-remove-confirm]')).toHaveAttribute('disabled', '');
    await shot(page, 'settings-remove-dialog');
    await dlg.locator('[data-conn-remove-word]').fill('הסר');
    await dlg.locator('[data-conn-remove-confirm]').click();
    await expect(form.locator('[data-conn-msg]')).toHaveText('ה־NVR הוסר', { timeout: 10000 });
    expect(m.calls.removes).toEqual([{ confirm_text: 'הסר', if_revision: 3 }]);
    await expect(form.locator('[data-conn-summary]')).toContainText('ללא NVR');
    await expect(page.locator(BANNER)).toBeVisible();
    // the server's own 409 (a vendor change attempted while cameras exist) shows the same line
    m.view = { ...m.view, vendor: 'hikvision', vendor_locked: false, host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, cameras: 4 };
    m.saveFail = { status: 409, body: ENVELOPE('remove_first', 'יש להסיר את ה־NVR לפני החלפת סוג.') };
    await page.reload();
    await expect(form.locator('[data-conn-edit]')).toBeVisible({ timeout: 20000 });
    await form.locator('[data-conn-edit]').click();
    await form.locator('[data-conn-save]').click();
    await expect(form.locator('[data-conn-vendor-locked]')).toBeVisible();
  });

  test('security review: a save on a connection that changed meanwhile (409 stale) asks to reload, and sends the loaded revision', async ({ page }) => {
    const m = freshMock({}, { vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 5 });
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-edit]')).toBeVisible({ timeout: 20000 });
    await form.locator('[data-conn-edit]').click();
    await form.locator('[data-conn-field="username"]').fill('viewer3');
    m.saveFail = { status: 409, body: ENVELOPE('stale', 'פרטי החיבור השתנו בינתיים; טענו את הדף מחדש.', { revision: 6 }) };
    await form.locator('[data-conn-save]').click();
    await expect(form.locator('[data-conn-msg]')).toContainText('השתנו בינתיים');
    expect(m.calls.saves[0]).toMatchObject({ if_revision: 5 });
    await expect(form.locator('[data-conn-reload]')).toBeVisible();
    m.view = { ...m.view, revision: 6, username: 'other-admin' };
    await form.locator('[data-conn-reload]').click();
    await expect(form.locator('[data-conn-summary]')).toContainText('other-admin');
    await expect(form.locator('[data-conn-reload]')).toHaveCount(0);
  });

  test('permission: without system.configure nothing writable is shown and the connection routes are never asked', async ({ page }) => {
    const m = freshMock({ perms: OPERATOR });
    await mockBackend(page, m);
    await open(page, '/system/setup');
    await expect(page.locator('sw-app')).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator('nvr-connection-form')).toHaveCount(0);
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-banner]')).toHaveCount(0);
    expect(m.calls.vendors + m.calls.connection).toBe(0);
    await open(page, '/system/wizard');
    await page.waitForTimeout(800);
    await expect(page.locator('nvr-connection-form')).toHaveCount(0);
    expect(m.calls.vendors + m.calls.connection).toBe(0);
  });
});

test.describe('restart-required banner', () => {
  test('AT-022-22: the banner follows the server flag - it survives a reload and shows for any administrator; no administrator, no banner', async ({ page }) => {
    const m = freshMock({ pending: true }, { vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 2 });
    await mockBackend(page, m);
    await open(page, '/explore/sites');
    await expect(page.locator(BANNER)).toContainText('נדרשת הפעלה מחדש כדי להחיל את השינוי', { timeout: 20000 });
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-open]')).toHaveText('הפעל מחדש');
    await shot(page, 'banner');
    await page.reload();
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 20000 });
    // a second administrator (a different page, the same server state) sees it too
    const second = await page.context().newPage();
    await mockBackend(second, m);
    await open(second, '/devices/building');
    await expect(second.locator(BANNER)).toBeVisible({ timeout: 20000 });
    await second.close();
    // someone without system.configure: the server omits the flag, the shell shows nothing
    const op = freshMock({ perms: OPERATOR, pending: true });
    const third = await page.context().newPage();
    await mockBackend(third, op);
    await open(third, '/devices/building');
    await expect(third.locator('sw-app')).toBeVisible();
    await third.waitForTimeout(800);
    await expect(third.locator(BANNER)).toHaveCount(0);
    await third.close();
  });

  test('AT-022-22: the button asks first, calls the restart route once, waits, and the page reloads when the system is back', async ({ page }) => {
    const m = freshMock({ pending: true });
    await mockBackend(page, m);
    await open(page, '/explore/sites');
    await page.locator('sw-app nvr-restart-banner [data-restart-open]').click();
    const dlg = page.locator('sw-app nvr-restart-banner [data-restart-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await shot(page, 'restart-dialog');
    expect(m.calls.restarts).toBe(0);
    await dlg.locator('sw-button', { hasText: 'ביטול' }).click();
    await expect(dlg).not.toHaveAttribute('open', '');
    expect(m.calls.restarts).toBe(0);
    await page.locator('sw-app nvr-restart-banner [data-restart-open]').click();
    await dlg.locator('[data-restart-confirm]').click();
    await expect(page.locator(BANNER)).toContainText('המערכת מופעלת מחדש…');
    expect(m.calls.restarts).toBe(1);
    await shot(page, 'restart-waiting');
    // the "system" comes back (pending cleared by the mock): the next poll reloads the page and the banner is gone
    await expect(page.locator(BANNER)).toHaveCount(0, { timeout: 20000 });
    expect(m.calls.restarts).toBe(1);
  });

  test('AT-022-22: a system that does not come back is told to be started by hand ("הפעילו ידנית")', async ({ page }) => {
    await page.clock.install({ time: new Date() });
    const m = freshMock({ pending: true, comesBack: false });
    await mockBackend(page, m);
    await open(page, '/explore/sites');
    await page.locator('sw-app nvr-restart-banner [data-restart-open]').click();
    await page.locator('sw-app nvr-restart-banner [data-restart-confirm]').click();
    await expect(page.locator(BANNER)).toContainText('המערכת מופעלת מחדש…');
    await page.clock.fastForward(130_000);
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-manual]')).toHaveText('המערכת לא חזרה. הפעילו ידנית.', { timeout: 15000 });
    await shot(page, 'restart-manual');
    await noOverflow(page);
    await page.locator('sw-app nvr-restart-banner [data-restart-again]').click();
    await expect(page.locator(BANNER)).toContainText('המערכת מופעלת מחדש…');
  });

  test('AT-022-22: outside the platform the service is restarted by hand - no button, one line (restart route answers 409 restart_manual)', async ({ page }) => {
    const m = freshMock({ pending: true, restartStatus: 409 }, { vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 2, restart: 'manual' });
    await mockBackend(page, m);
    await open(page, '/explore/sites');
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-text]')).toHaveText('יש להפעיל מחדש את השירות כדי להחיל את השינוי', { timeout: 20000 });
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-open]')).toHaveCount(0);
    // and a button pressed while the answer is not yet known falls back to the same line
    const b = freshMock({ pending: true, restartStatus: 409 });
    const p2 = await page.context().newPage();
    await mockBackend(p2, b);
    await open(p2, '/explore/sites');
    await p2.locator('sw-app nvr-restart-banner [data-restart-open]').click();
    await p2.locator('sw-app nvr-restart-banner [data-restart-confirm]').click();
    await expect(p2.locator('sw-app nvr-restart-banner [data-restart-text]')).toHaveText('יש להפעיל מחדש את השירות כדי להחיל את השינוי', { timeout: 10000 });
    await expect(p2.locator('sw-app nvr-restart-banner [data-restart-open]')).toHaveCount(0);
    await p2.close();
  });
});

test.describe('setup wizard: the NVR step', () => {
  test('AT-022-23: nothing chosen keeps the step "לביצוע"; "ללא NVR" reaches "הושלם" without a test', async ({ page }) => {
    const m = freshMock({ mode: 'ha_only' });
    await mockBackend(page, m);
    await open(page, '/system/wizard');
    const step = page.locator('system-wizard section[data-step="nvr"]');
    await expect(step).toHaveAttribute('data-status', 'todo', { timeout: 20000 });
    await expect(step.locator('[data-step-status]')).toHaveText('לביצוע');
    await expect(step.locator('nvr-connection-form [data-conn-vendor]')).toBeVisible();
    await shot(page, 'wizard-todo');
    await page.waitForTimeout(500);
    expect(m.calls.saves).toHaveLength(0); // opening the wizard never chooses for the installer
    await step.locator('[data-conn-vendor]').selectOption('none');
    await expect(step.locator('[data-conn-field]')).toHaveCount(0);
    await expect(step.locator('[data-conn-test]')).toHaveCount(0);
    await step.locator('[data-conn-save]').click();
    await expect(step).toHaveAttribute('data-status', 'done', { timeout: 10000 });
    expect(m.calls.saves).toEqual([{ vendor: 'none', if_revision: 0 }]);
    expect(m.calls.tests).toHaveLength(0);
    await expect(step.locator('[data-step-status]')).toHaveText('ללא NVR');
    await expect(step.locator('nvr-connection-form')).toHaveCount(0);
    await shot(page, 'wizard-done-none');
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-banner]')).toBeVisible();
  });

  test('AT-022-23: the Hikvision path - choose, fill, test, save; the step reaches "הושלם" once the system is back', async ({ page }) => {
    const m = freshMock({ mode: 'ha_only' });
    await mockBackend(page, m);
    await open(page, '/system/wizard');
    const step = page.locator('system-wizard section[data-step="nvr"]');
    await expect(step.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    await fillHikvision(page, WIZ);
    await step.locator('[data-conn-test]').click();
    await expect(step.locator('[data-conn-test-result]')).toHaveText('מחובר · DS-FAKE-7616 · 8 ערוצים');
    await shot(page, 'wizard-tested');
    await step.locator('[data-conn-save]').click();
    await expect(step.locator('[data-conn-msg]')).toContainText('החיבור נבדק ונשמר', { timeout: 10000 });
    expect(m.calls.saves[0]).toMatchObject({ vendor: 'hikvision', host: 'nvr.fake.test', password: CANARY });
    await expect(step.locator('[data-conn-password-set]')).toBeVisible(); // the typed password is gone: the form shows the write-only "kept" state
    await expect(page.locator(BANNER)).toContainText('נדרשת הפעלה מחדש');
    await page.locator('sw-app nvr-restart-banner [data-restart-open]').click();
    await page.locator('sw-app nvr-restart-banner [data-restart-confirm]').click();
    await expect(page.locator('system-wizard section[data-step="nvr"]')).toHaveAttribute('data-status', 'done', { timeout: 25000 });
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});

test.describe('operator wording, RTL and layout (AT-022-24)', () => {
  const FORBIDDEN = /home\s*assistant|\bHA\b|ingress|add-?on|supervisor|options|אפשרויות ה/i;

  async function textOf(page: Page, sel: string): Promise<string> {
    return page.locator(sel).first().evaluate((el) => {
      const walk = (n: Node): string => {
        let out = '';
        if (n.nodeType === Node.TEXT_NODE) out += (n.textContent ?? '') + ' ';
        if (n instanceof Element) {
          out += ['aria-label', 'title', 'placeholder', 'heading', 'subheading', 'hint', 'label'].map((a) => n.getAttribute(a) ?? '').join(' ') + ' ';
          if (n.shadowRoot) for (const c of n.shadowRoot.childNodes) out += walk(c);
        }
        for (const c of n.childNodes) out += walk(c);
        return out;
      };
      return walk(el);
    });
  }

  test('no platform wording on any CR-022 screen: the form (every state and dialog), the wizard step, the banner and the no-NVR panel; hosts stay LTR in an RTL page', async ({ page }) => {
    const m = freshMock({ mode: 'ha_only', pending: true });
    await mockBackend(page, m);
    // the form, nothing chosen / chosen / the dialogs
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)).toBe('rtl');
    await fillHikvision(page, FORM);
    m.test = { status: 200, body: { ok: false, code: 'source_unavailable' } };
    await form.locator('[data-conn-test]').click();
    await form.locator('[data-conn-save-anyway]').click();
    const texts = [await textOf(page, FORM)];
    expect(await form.locator('[data-conn-field="host"]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    expect(await form.locator('[data-conn-field="http_port"]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    await form.locator('[data-conn-untested-dialog] sw-button', { hasText: 'ביטול' }).click();
    texts.push(await textOf(page, 'system-setup [data-nvr-connection]'));
    texts.push(await textOf(page, 'sw-app nvr-restart-banner'));
    m.view = { ...m.view, vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'unreadable', cameras: 2, vendor_locked: true, legacy_options_differ: true };
    await page.reload();
    await expect(form.locator('[data-conn-unreadable]')).toBeVisible({ timeout: 20000 });
    await form.locator('[data-conn-remove]').first().click();
    texts.push(await textOf(page, FORM));
    // the wizard step
    await open(page, '/system/wizard');
    await expect(page.locator('system-wizard section[data-step="nvr"] nvr-connection-form')).toBeVisible({ timeout: 20000 });
    texts.push(await textOf(page, 'system-wizard section[data-step="nvr"]'));
    // the shell's panel of an NVR area in the NVR-less mode
    await open(page, '/live/wall');
    await expect(page.locator('sw-app sw-state-panel[data-nvr-less]')).toBeVisible({ timeout: 20000 });
    texts.push(await textOf(page, 'sw-app sw-state-panel[data-nvr-less]'));
    for (const t of texts) expect(t.match(FORBIDDEN)?.[0] ?? null, t.slice(0, 120)).toBeNull();
    expect(texts.join(' ')).toContain('בקרוב');
  });

  test('every state fits the screen: no horizontal overflow on desktop, tablet and phone (settings card, dialogs, wizard step, banner)', async ({ page }) => {
    const m = freshMock({ pending: true }, { vendor: 'hikvision', host: 'a-very-long-host-name-for-the-recorder.office.example.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 2, cameras: 3, vendor_locked: true, legacy_options_differ: true });
    await mockBackend(page, m);
    await open(page, '/system/setup');
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-summary]')).toBeVisible({ timeout: 20000 });
    await noOverflow(page);
    await shot(page, 'settings-summary');
    await form.locator('[data-conn-edit]').click();
    await noOverflow(page);
    await shot(page, 'settings-edit');
    await form.locator('[data-conn-cancel]').click();
    await form.locator('[data-conn-remove]').first().click();
    await noOverflow(page);
    await form.locator('[data-conn-remove-dialog] sw-button', { hasText: 'ביטול' }).click();
    await open(page, '/system/wizard');
    await noOverflow(page);
  });
});

// ------------------------------------------------------------------ every skin, light and dark (the layout guard of tests/layout-guard.ts)
// decorative layers; and the open dialog (sw-dialog's fixed backdrop sits inside the card in the DOM - its box is asserted separately)
const SKIP = '.vh, .skl, .gbox, .bg, .veil, .backdrop, .backdrop *';
const SKINS = QUICK ? ['classic', 'bubble'] : ['classic', 'domus', 'tesla', 'bubble'];
const SCHEMES = QUICK ? ['light'] : ['light', 'dark'];

test.describe('skins x schemes', () => {
  for (const skin of SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} / ${scheme}: the connection card, the dialogs and the banner keep to their boxes (layout guard)`, async ({ page }, testInfo) => {
        const m = freshMock({ pending: true }, { vendor: 'hikvision', host: 'nvr.fake.test', http_port: 80, rtsp_port: 554, username: 'viewer', has_password: true, state: 'ok', revision: 2 });
        await mockBackend(page, m);
        await open(page, '/system/setup', `&skin=${skin}&scheme=${scheme}`);
        const form = page.locator(FORM);
        await expect(form.locator('[data-conn-summary]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('system-setup sw-button[slot="actions"]')).toContainText('רענון', { timeout: 20000 }); // the page's own loading is over (its button text changes while it loads)
        const findings: Finding[] = [];
        const check = async (label: string) => {
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          findings.push(...(await page.evaluate(inPageCheck, { ctx: `${skin}/${scheme}/${testInfo.project.name}/${label}`, skip: SKIP })));
        };
        await check('summary');
        await shot(page, `skin-${skin}-${scheme}-summary`);
        await form.locator('[data-conn-edit]').click();
        await check('edit');
        await shot(page, `skin-${skin}-${scheme}-edit`);
        await form.locator('[data-conn-field="username"]').fill('viewer2');
        m.test = { status: 200, body: { ok: false, code: 'source_unavailable' } };
        await form.locator('[data-conn-test]').click();
        await expect(form.locator('[data-conn-save-anyway]')).toBeVisible();
        await form.locator('[data-conn-save-anyway]').click();
        await check('dialog');
        const box = await form.locator('[data-conn-untested-dialog]').evaluate((d) => { const r = d.shadowRoot!.querySelector('.box')!.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
        expect(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h, JSON.stringify(box)).toBe(true);
        await shot(page, `skin-${skin}-${scheme}-dialog`);
        // the guard walks the whole screen: what the rest of the page already reports (the baseline, measured with the form and the
        // banner taken out) is not this change's; anything else is
        // (for a failure message: the buttons under 44 px high and the host that draws them)
        const smallButtons = await page.evaluate(() => {
          const out: string[] = [];
          const walk = (root: Document | ShadowRoot) => {
            for (const el of root.querySelectorAll('*')) {
              if (el.tagName === 'BUTTON' && el.getBoundingClientRect().height < 44 && el.getBoundingClientRect().height > 0) out.push(`${(el.getRootNode() as ShadowRoot).host?.outerHTML.slice(0, 110)} h=${Math.round(el.getBoundingClientRect().height)}`);
              if (el.shadowRoot) walk(el.shadowRoot);
            }
          };
          walk(document);
          return out;
        });
        await page.locator('nvr-connection-form').evaluate((e) => e.remove());
        await page.locator('sw-app nvr-restart-banner').evaluate((e) => e.remove());
        await page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('main')?.scrollTo(0, 0)); // the same view the first check saw (the page's own top buttons)
        const base: Finding[] = [];
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        base.push(...(await page.evaluate(inPageCheck, { ctx: 'baseline', skip: SKIP })));
        const key = (f: Finding) => `${f.cls}|${f.el}|${f.detail}`;
        const known = new Set(base.map(key));
        // a touch target below 44 px is a finding on a phone (the product's rule, sw-button / sw-field); the open dialog is sw-dialog's own box (position: fixed inside the card)
        const phone = (page.viewportSize()?.width ?? 1440) <= 767;
        const own = findings.filter((f) => !known.has(key(f)) && (f.cls !== 'target' || phone));
        expect(own.length, summarize(own).lines.join('\n') + '\n' + JSON.stringify(smallButtons)).toBe(0);
      });
    }
  }
});
