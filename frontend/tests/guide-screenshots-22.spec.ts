import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PERMS, installCastMock } from './cast-mocks';

// Opt-in only (SW_GUIDE=1): the user guide's screenshots for the 2.2.0 features that have no committed evidence image
// (voice announcements, the Android download offer, the second factor in the account menu). Everything runs against mocked
// wire contracts with invented names; nothing touches a device. Output directory: SW_GUIDE_OUT (default: <repo>/.guide-out,
// copied into docs/user-guide/he/img after a visual review).
//   SW_GUIDE=1 SW_GUIDE_OUT=/tmp/guide-out SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/guide-screenshots-22.spec.ts --project=desktop --workers=1

const OUT = process.env.SW_GUIDE_OUT || path.resolve(process.cwd(), '..', '.guide-out');
// RUNNER-RUN: gate removed temporarily
test.use({ serviceWorkers: 'block' });
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const shot = async (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

test('voice announcements: configured, with history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCastMock(page, { perms: [...PERMS.admin, 'media.announce'] });
  const state = {
    config: { enabled: true, engine: 'tts.demo_engine', language: 'he', devices: ['sp-1'], max_per_minute: 6, max_text: 200, cooldown_s: 5 },
    speakers: [
      { key: 'sp-1', name: 'רמקול סלון', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'living', area_name: 'סלון', allowed: true },
      { key: 'sp-2', name: 'רמקול מטבח', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'kitchen', area_name: 'מטבח', allowed: false },
    ],
    history: [
      { id: 'h1', at: '2026-10-06T09:00:00Z', source: 'manual', username: 'משתמש 1', rule_id: null, scope: 'area', scope_ref: 'living', status: 'sent', targets: 1, text_len: 15 },
      { id: 'h2', at: '2026-10-06T08:40:00Z', source: 'test', username: 'משתמש 1', rule_id: null, scope: 'device', scope_ref: 'sp-1', status: 'sent', targets: 1, text_len: 12 },
    ] as Record<string, unknown>[],
  };
  await page.route(/\/api\/v1\/announcements(\/|\?|$)/, async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\/announcements\/?/, '');
    if (p === 'config') return json(route, { config: state.config, speakers: state.speakers, engines: ['tts.demo_engine'], history: state.history });
    if (p === 'areas') return json(route, { enabled: true, max_text: 200, areas: [{ area_id: 'living', name: 'סלון', floor_name: 'קומת קרקע', devices: ['sp-1'] }] });
    return json(route, {});
  });
  await page.goto('/?design=a#/system/multimedia?tab=announce');
  await expect(page.locator('sw-app system-multimedia system-announcements [data-announce]')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, 'announcements-settings');
});

test('android download offer on the sign-in page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.route('**/api/v1/auth/app-download', (route) => json(route, { android: { url: 'https://downloads.example.com/arx.apk', version: '0.9.1', sha256: 'ab'.repeat(32) } }));
  await page.goto('./');
  await page.evaluate(async () => {
    const src = '/src/arx/arx-login.ts';
    await import(/* @vite-ignore */ src);
    document.body.appendChild(document.createElement('arx-login'));
  });
  await expect(page.locator('arx-login [data-arx-submit]')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, 'android-offer-login');
});

test('second factor: enrolment in the account menu component', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 700 });
  await page.route('**/api/v1/auth/second-factor', (route) => json(route, { enabled: false, enabled_at: null, last_used_at: null, policy: 'optional' }));
  await page.route('**/api/v1/auth/second-factor/enroll', (route) =>
    json(route, { secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/Arx:demo?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Arx', issuer: 'Arx' }));
  await page.goto('./');
  await page.evaluate(async () => {
    const src = '/src/components/sw-second-factor.ts';
    await import(/* @vite-ignore */ src);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;padding:24px;background:var(--sw-surface,#fff);z-index:99999;direction:rtl';
    host.appendChild(document.createElement('sw-second-factor'));
    document.body.appendChild(host);
  });
  const el = page.locator('sw-second-factor');
  await expect(el.locator('[data-sf-enable]')).toBeVisible();
  await el.locator('[data-sf-enable]').click();
  await expect(el.locator('[data-sf-enrolment]')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, 'second-factor-enrol');
});
