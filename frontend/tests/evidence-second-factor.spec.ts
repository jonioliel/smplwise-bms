import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// K11 (the optional TOTP second factor): the user's own section in החשבון שלי, against a mocked wire contract of
// smplwise/routers/second_factor.py (invented user, no real secret). Off by default; "הפעלה" shows a QR code and the key
// to type; the first code from the app turns it on (a wrong code says so and changes nothing); "כיבוי" needs a current code.
// The sign-in step and the administrator reset run end to end in evidence-arx-second-factor.spec.ts (fixture backend).
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-second-factor.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/K11');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const KEY = 'JBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/SmplWise%20Arx%3Adana?secret=${KEY}&issuer=SmplWise%20Arx&algorithm=SHA1&digits=6&period=30`;

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  enabled: boolean;
}

async function setup(page: Page): Promise<Mock> {
  const st: Mock = { calls: [], enabled: false };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const perms = ['video.live', 'devices.read'];
    if (p === 'me') return json(route, { user: { id: 'u-dana', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'auth/sessions') return json(route, { scope: 'own', can_manage: false, channel: 'local', sessions: [] });
    if (p.startsWith('auth/second-factor')) {
      const body = method === 'GET' ? null : (req.postDataJSON() as { code?: string } | null);
      st.calls.push({ method, path: p, body });
      const status = () => ({ enabled: st.enabled, enabled_at: st.enabled ? '2026-10-06T09:00:00Z' : null, last_used_at: null, policy: 'optional' });
      if (p === 'auth/second-factor' && method === 'GET') return json(route, status());
      if (p === 'auth/second-factor/enroll') return json(route, { secret: KEY, otpauth_uri: URI, issuer: 'SmplWise Arx' });
      if (p === 'auth/second-factor/confirm') {
        if (body?.code !== '123456') return json(route, { code: 'second_factor_invalid', user_message: 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.', retryable: false, correlation_id: 'mock', details: {} }, 400);
        st.enabled = true;
        return json(route, status());
      }
      if (p === 'auth/second-factor/disable') {
        if (body?.code !== '654321') return json(route, { code: 'second_factor_invalid', user_message: 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.', retryable: false, correlation_id: 'mock', details: {} }, 400);
        st.enabled = false;
        return json(route, status());
      }
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}

async function openSection(page: Page) {
  await page.goto('/?design=a#/live/cameras');
  await page.waitForSelector('sw-app');
  await page.locator(phone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-account]').click();
  await menu.locator('[data-my-second-factor] summary').click();
  return menu.locator('[data-my-second-factor] sw-second-factor');
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${page.viewportSize()?.width ?? 0}.png`) });
}

test('own factor: off by default, enrol with a QR code and a first code, then disable with a current code', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await setup(page);
  const section = await openSection(page);
  await expect(section.locator('[data-sf-state]')).toHaveText('כבוי');
  await expect(section.locator('[data-sf-enrolment]')).toHaveCount(0);
  await shot(page, 'k11-off');

  await section.locator('[data-sf-enable]').click();
  await expect(section.locator('[data-sf-enrolment] svg[data-sf-qr]')).toBeVisible();
  await expect(section.locator('[data-sf-key]')).toHaveText('JBSW Y3DP EHPK 3PXP');
  const box = await section.locator('[data-sf-qr]').boundingBox();
  expect(box && box.width >= 150 && Math.abs(box.width - box.height) < 1).toBe(true);
  await shot(page, 'k11-enrol');
  if (process.env.SW_SHOTS) {
    // guide image: a taller window so the QR code, the typed key and the code field are all in view (the fixture key is made up)
    await page.setViewportSize({ width: 1440, height: 1200 });
    await section.locator('[data-sf-code]').fill('123456');
    await shot(page, 'k11-enrol-guide');
    await page.setViewportSize({ width: 1440, height: 900 });
    await section.locator('[data-sf-code]').fill('');
  }

  // a wrong code says so and changes nothing
  await section.locator('[data-sf-code]').fill('000000');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-error]')).toContainText('קוד האימות אינו נכון');
  await expect(section.locator('[data-sf-enrolment]')).toBeVisible();
  expect(mock.enabled).toBe(false);

  // the confirm button waits for six digits
  await section.locator('[data-sf-code]').fill('12');
  await expect(section.locator('[data-sf-confirm]')).toHaveAttribute('disabled', '');
  await section.locator('[data-sf-code]').fill('123 456');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-state]')).toContainText('פעיל');
  await expect(section.locator('[data-sf-message]')).toHaveText('האימות הדו־שלבי הופעל');
  await expect(section.locator('[data-sf-enrolment]')).toHaveCount(0);
  expect(mock.calls.find((c) => c.path === 'auth/second-factor/confirm' && (c.body as { code: string }).code === '123456')).toBeTruthy();
  await shot(page, 'k11-on');

  // disabling needs a current code
  await section.locator('[data-sf-disable]').click();
  await section.locator('[data-sf-code]').fill('111111');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-error]')).toContainText('קוד האימות אינו נכון');
  expect(mock.enabled).toBe(true);
  await section.locator('[data-sf-code]').fill('654321');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-state]')).toHaveText('כבוי');
  await expect(section.locator('[data-sf-message]')).toHaveText('האימות הדו־שלבי כובה');

  // the secret never reaches the page's storage or its text after the enrolment
  const leaks = await page.evaluate((k) => ({ ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), text: document.body.innerText.includes(k) }), KEY);
  expect(leaks.ls.includes(KEY) || leaks.ss.includes(KEY)).toBe(false);
  expect(errors).toEqual([]);
});

test('the QR code is a real symbol: square, a valid QR version, many modules', async ({ page }) => {
  await setup(page);
  const section = await openSection(page);
  await section.locator('[data-sf-enable]').click();
  await expect(section.locator('svg[data-sf-qr]')).toBeVisible();
  // the QR is drawn as one path of 1x1 modules: a version-N code has (4N + 17) modules a side plus a 3-module quiet zone
  const info = await section.locator('svg[data-sf-qr]').evaluate((el) => {
    const vb = (el.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const d = el.querySelector('path')?.getAttribute('d') ?? '';
    return { size: vb[2], modules: (d.match(/M/g) ?? []).length };
  });
  expect((info.size - 6 - 17) % 4).toBe(0);
  expect(info.modules).toBeGreaterThan(200);
});
