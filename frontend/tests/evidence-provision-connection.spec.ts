import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMulti, type MultiState } from './multi-nvr-mock';

// CR-025: the Provision-ISR connection in the shared NVR connection form - the vendor's own fields from the catalogue (select
// fields, an "advanced" section), HTTPS with certificate pinning from the connection test, the dismissible warning for Basic
// over plain HTTP, and the save body. Against a MOCKED backend (page.route on api/v1; `npm run build` first, the preview serves
// dist/) on the three projects. The server side is tests/test_provision_wiring.py. SW_SHOTS=1 writes screenshots to
// docs/design/evidence/cr025. Every value is fake; the password is a canary the page must never echo.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cr025');
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
    F('time_basis', 'זמני ההקלטות', 'select', false, { options: [['device', 'לפי שעון המכשיר'], ['iana', 'תמיד שעון ישראל']] }),
    F('poll_interval_s', 'מרווח דגימה (שניות)', 'text', false, { advanced: true }),
    F('push_port', 'פורט קבלת דחיפות', 'port', false, { advanced: true }),
    F('suppress_insecure_warning', 'להסתיר את אזהרת החיבור הלא מוצפן', 'bool', false, { advanced: true }),
  ] };
const VENDORS = [
  { id: 'hikvision', label: 'Hikvision', status: 'available', default_ports: { http_port: 80, rtsp_port: 554 }, fields: PROVISION.fields.slice(0, 5) },
  PROVISION,
  { id: 'none', label: 'ללא NVR', status: 'available', default_ports: {}, fields: [] },
];

interface Mock { tests: Record<string, unknown>[]; st: MultiState | null; testAnswer: (b: Record<string, unknown>) => Record<string, unknown> }

/** The CR-024 recorders mock (Settings › connections), with the vendor catalogue and the connection test answered for
 * Provision-ISR on top (routes registered later win in Playwright). */
async function mockBackend(page: Page, m: Mock) {
  m.st = await installMulti(page, { count: 1 });
  await page.route('**/api/v1/nvr/vendors', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vendors: VENDORS }) }));
  await page.route('**/api/v1/nvr/connection/test', (route) => {
    const b = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    m.tests.push(b);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m.testAnswer(b)) });
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

const CARD = 'sw-app system-setup nvr-recorders-card';
const FORM = `${CARD} sw-dialog[open][data-recorder-add-dialog] nvr-connection-form`;
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function fill(page: Page) {
  await page.locator(`${CARD} [data-recorder-add]`).click({ timeout: 20000 });
  const form = page.locator(FORM);
  await expect(form.locator('[data-conn-name]')).toBeVisible();
  await form.locator('[data-conn-name]').fill('NVR פרוויז׳ן');
  await form.locator('[data-conn-vendor]').selectOption('provision_isr');
  await form.locator('[data-conn-field="host"]').fill('provision.fake.test');
  await form.locator('[data-conn-field="username"]').fill('admin');
  await form.locator('[data-conn-field="password"]').fill(CANARY);
  return form;
}

test('CR-025: Provision-ISR over HTTPS - the test shows the device certificate, "נעץ" pins it, the save carries the pin', async ({ page }) => {
  const m: Mock = { tests: [], st: null, testAnswer: (b) => {
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
  await expect.poll(() => m.st!.writes.filter((w) => w.method === 'POST' && w.path === 'recorders').length).toBe(1);
  const saved = m.st!.writes.find((w) => w.method === 'POST' && w.path === 'recorders')!.body as { vendor: string; extra: Record<string, string> };
  expect(saved.vendor).toBe('provision_isr');
  expect(saved.extra).toMatchObject({ scheme: 'https', tls_mode: 'pin', tls_pin: PIN, event_mode: 'poll', time_basis: 'device' });
  expect(await page.locator(CARD).evaluate((el) => el.shadowRoot!.innerHTML)).not.toContain(CANARY);
  await noOverflow(page);
});

test('CR-025: Basic over plain HTTP - the warning appears after the test and can be closed', async ({ page }) => {
  const m: Mock = { tests: [], st: null, testAnswer: () => ({ ok: true, code: 'ok', model: 'NVR-FAKE-16', firmware: 'fake', channels: 16,
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
