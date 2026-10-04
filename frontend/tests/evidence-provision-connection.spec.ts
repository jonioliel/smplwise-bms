import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-025: the Provision-ISR connection in the shared NVR connection form - the vendor's own fields from the catalogue (select
// fields, an "advanced" section), HTTPS with certificate pinning from the connection test, the dismissible warning for Basic
// over plain HTTP, and the save body. Against a MOCKED backend (page.route on api/v1; `npm run build` first, the preview serves
// dist/) on the three projects. The server side is tests/test_provision_wiring.py. SW_SHOTS=1 writes screenshots to
// docs/design/evidence/cr025. Every value is fake; the password is a canary the page must never echo.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cr025');
const ADMIN = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign'];
const CANARY = 'canary-pass-9902';
const PIN = 'a1'.repeat(32);

const F = (key: string, label: string, kind: string, required = false, extra: Record<string, unknown> = {}) => ({ key, label, kind, required, secret: kind === 'password', options: [], advanced: false, ...extra });
// the catalogue entry exactly as services/recorders/provision_isr.register() builds it (labels in Hebrew)
const PROVISION = {
  id: 'provision_isr', label: 'Provision-ISR', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: [
    F('host', 'כתובת', 'host', true), F('http_port', 'פורט HTTP', 'port', true), F('rtsp_port', 'פורט RTSP', 'port', true), F('username', 'שם משתמש', 'text', true),
    F('password', 'סיסמה', 'password', true),
    F('scheme', 'חיבור', 'select', false, { options: [['https', 'HTTPS (מוצפן)'], ['http', 'HTTP']] }),
    F('https_port', 'פורט HTTPS', 'port'),
    F('tls_mode', 'תעודת HTTPS', 'select', false, { options: [['pin', 'נעיצת תעודת המכשיר'], ['verify', 'אימות רגיל'], ['trust', 'לסמוך על כל תעודה']] }),
    F('tls_pin', 'טביעת אצבע של התעודה (SHA-256)', 'text', false, { advanced: true }),
    F('auth', 'שיטת אימות', 'select', false, { options: [['', 'אוטומטי'], ['basic', 'Basic'], ['digest', 'Digest']] }),
    F('event_mode', 'אירועים', 'select', false, { options: [['poll', 'דגימה כל 2 שניות'], ['push', 'דחיפה מהמכשיר']] }),
    F('poll_interval_s', 'מרווח דגימה (שניות)', 'text', false, { advanced: true }),
    F('push_port', 'פורט קבלת דחיפות', 'port', false, { advanced: true }),
    F('suppress_insecure_warning', 'להסתיר את אזהרת החיבור הלא מוצפן', 'bool', false, { advanced: true }),
  ] };
const VENDORS = [
  { id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: PROVISION.fields.slice(0, 5) },
  PROVISION,
  { id: 'none', label: 'ללא NVR', status: 'available', default_ports: {}, fields: [] },
];

interface Mock { tests: Record<string, unknown>[]; saves: Record<string, unknown>[]; testAnswer: (b: Record<string, unknown>) => Record<string, unknown> }

async function mockBackend(page: Page, m: Mock) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = () => (req.postDataJSON() ?? {}) as Record<string, unknown>;
    if (p === 'me') {
      return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'מנהל', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', connection_pending_restart: false });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-04T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'nvr/vendors') return json({ vendors: VENDORS });
    if (p === 'nvr/connection' && req.method() === 'GET') {
      return json({ vendor: null, host: null, http_port: null, rtsp_port: null, username: null, user: null, extra: {}, has_password: false, state: 'not_chosen', source: null,
        revision: 0, updated_at: null, updated_by: null, pending_restart: false, legacy_options_differ: false, placeholder: false, in_addon: true, restart: 'addon', cameras: 0, vendor_locked: false });
    }
    if (p === 'nvr/connection/test') {
      const b = body();
      m.tests.push(b);
      return json(m.testAnswer(b));
    }
    if (p === 'nvr/connection' && req.method() === 'PUT') {
      const b = body();
      m.saves.push(b);
      return json({ saved: true, restart_required: true, restarting: false, device: { model: 'NVR-FAKE-16', firmware: 'fake', channels: 16 }, untested: false,
        vendor: 'provision_isr', host: b.host, http_port: b.http_port, rtsp_port: b.rtsp_port, username: b.username, user: b.username, extra: b.extra ?? {}, has_password: true,
        state: 'ok', source: 'ui', revision: 1, updated_at: null, updated_by: null, pending_restart: true, legacy_options_differ: false, in_addon: true, restart: 'addon', cameras: 0, vendor_locked: false });
    }
    if (p.startsWith('setup/')) return json({ version: 'test', mode: 'full', checked_at: '2026-10-04T00:00:00Z', steps: [], done: 0, total: 0, ready: true, next: null, thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function open(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/setup');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`), fullPage: true });
}

const FORM = 'system-setup nvr-connection-form';
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function fill(page: Page) {
  const form = page.locator(FORM);
  await expect(form.locator('[data-conn-vendor]')).toBeVisible({ timeout: 20000 });
  await form.locator('[data-conn-vendor]').selectOption('provision_isr');
  await form.locator('[data-conn-field="host"]').fill('provision.fake.test');
  await form.locator('[data-conn-field="username"]').fill('admin');
  await form.locator('[data-conn-field="password"]').fill(CANARY);
  return form;
}

test('CR-025: Provision-ISR over HTTPS - the test shows the device certificate, "נעץ" pins it, the save carries the pin', async ({ page }) => {
  const m: Mock = { tests: [], saves: [], testAnswer: (b) => {
    const extra = (b.extra ?? {}) as Record<string, string>;
    return { ok: true, code: 'ok', model: 'NVR-FAKE-16', firmware: 'fake', channels: 16, transport: { scheme: 'https', auth: 'basic', insecure: false }, warnings: [],
      certificate: { sha256: PIN, self_signed: true, matches_pin: extra.tls_pin ? extra.tls_pin === PIN : null }, ...(extra.tls_pin ? {} : { pin_required: true }) };
  } };
  await mockBackend(page, m);
  await open(page);
  const form = await fill(page);
  // defaults from the catalogue: HTTPS, pin, automatic auth, sampling; the advanced fields are folded away
  await expect(form.locator('[data-conn-field="scheme"]')).toHaveValue('https');
  await expect(form.locator('[data-conn-field="tls_mode"]')).toHaveValue('pin');
  await expect(form.locator('[data-conn-field="event_mode"]')).toHaveValue('poll');
  await expect(form.locator('[data-conn-advanced]')).not.toHaveAttribute('open', '');
  await form.locator('[data-conn-test]').click();
  await expect(form.locator('[data-conn-test-result]')).toHaveText('מחובר · NVR-FAKE-16 · 16 ערוצים');
  await expect(form.locator('[data-conn-certificate]')).toContainText('חתומה עצמית');
  await shot(page, 'provision-https-certificate');
  await form.locator('[data-conn-pin]').click();
  await form.locator('[data-conn-test]').click();
  await expect(form.locator('[data-conn-certificate]')).toContainText('ננעצה');
  await form.locator('[data-conn-save]').click();
  await expect.poll(() => m.saves.length).toBe(1);
  const saved = m.saves[0] as { extra: Record<string, string> };
  expect(saved.extra).toMatchObject({ scheme: 'https', tls_mode: 'pin', tls_pin: PIN, event_mode: 'poll' });
  expect(await page.content()).not.toContain(CANARY);
  await noOverflow(page);
});

test('CR-025: Basic over plain HTTP - the warning appears after the test and can be closed', async ({ page }) => {
  const m: Mock = { tests: [], saves: [], testAnswer: () => ({ ok: true, code: 'ok', model: 'NVR-FAKE-16', firmware: 'fake', channels: 16,
    transport: { scheme: 'http', auth: 'basic', insecure: true }, warnings: ['basic_over_http'] }) };
  await mockBackend(page, m);
  await open(page);
  const form = await fill(page);
  await form.locator('[data-conn-field="scheme"]').selectOption('http');
  await expect(form.locator('[data-conn-field="tls_mode"]')).toHaveCount(0);
  await form.locator('[data-conn-test]').click();
  const warn = form.locator('[data-conn-warning="basic_over_http"]');
  await expect(warn).toBeVisible();
  await shot(page, 'provision-http-warning');
  await form.locator('[data-conn-warning-dismiss="basic_over_http"]').click();
  await expect(warn).toHaveCount(0);
  // the permanent suppression is an advanced option of the recorder
  await form.locator('[data-conn-advanced] summary').click();
  await expect(form.locator('[data-conn-field="suppress_insecure_warning"]')).toBeVisible();
  await shot(page, 'provision-advanced');
  await noOverflow(page);
});
