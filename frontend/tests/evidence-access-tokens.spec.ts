import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// MFA-TOKENS-2490 (slice 6 of the MFA train): החשבון שלי › אסימוני גישה (MFA-SCREENS-2510: inside החשבון שלי › אבטחה), against a mocked wire contract of
// smplwise/routers/access_tokens.py (invented user and tokens). Home Assistant's tokens are read-only (no revoke button, a hint where
// to revoke them in Home Assistant); a long-lived token is marked "no repeated check" with a warning; the phone app's saved sign-ins
// (tokens Arx issued) have a revoke button, and "revoke all" asks once more.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-access-tokens.spec.ts --workers=2
// SW_SHOTS=1 also writes the compare-page screenshots (light + dark) to docs/design/evidence/MFA-TOKENS-2490.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/MFA-TOKENS-2490');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

const seen = (mins: number, address: string) => ({ used_in_arx: true, arx_first_seen_at: iso(mins + 600), arx_last_seen_at: iso(mins), arx_address: address, arx_agent: 'python-requests' });
const unseen = { used_in_arx: false, arx_first_seen_at: null, arx_last_seen_at: null, arx_address: null, arx_agent: null };

function rows() {
  return [
    { id: 'ha_0123456789abcdef0123', source: 'ha', kind: 'long_lived', name: 'Node-RED', client: null, created_at: '2026-09-29T08:00:00Z', last_used_at: iso(3),
      expires_at: null, current: false, revocable: false, ...seen(3, '203.0.113.0/24') },
    { id: 'ha_aaaaaaaaaaaaaaaaaaaa', source: 'ha', kind: 'short_lived', name: null, client: 'arx.example.test', created_at: '2026-11-20T08:00:00Z', last_used_at: iso(1),
      expires_at: null, current: true, revocable: false, ...unseen },
    { id: 'ha_bbbbbbbbbbbbbbbbbbbb', source: 'ha', kind: 'short_lived', name: null, client: 'home-assistant.io', created_at: '2026-10-02T08:00:00Z', last_used_at: iso(240),
      expires_at: null, current: false, revocable: false, ...unseen },
  ];
}

const app = (id: string, name: string) => ({ id, source: 'arx', kind: 'app', name, client: 'android', created_at: '2026-11-10T08:00:00Z', last_used_at: iso(30),
  expires_at: '2026-12-10T08:00:00Z', current: false, revocable: true, ...unseen });

interface Mock {
  calls: { method: string; path: string }[];
  apps: ReturnType<typeof app>[];
  listed: boolean;
  reason: string | null;
}

async function setup(page: Page, o: Partial<Pick<Mock, 'listed' | 'reason'>> = {}): Promise<Mock> {
  const st: Mock = { calls: [], apps: [app('arf_pixel7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Pixel 7 של דנה'), app('arf_tabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'טאבלט בכניסה')],
    listed: o.listed ?? true, reason: o.reason ?? null };
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
    if (p.startsWith('auth/tokens')) {
      st.calls.push({ method, path: p });
      if (p === 'auth/tokens' && method === 'GET') {
        const ha = st.listed ? rows() : rows().slice(0, 1).map((r) => ({ ...r, source: 'arx', name: null, created_at: null, last_used_at: null }));
        return json(route, { ha_listed: st.listed, ha_reason: st.reason, tokens: [...ha, ...st.apps], app_enabled: true });
      }
      if (p === 'auth/tokens' && method === 'DELETE') {
        const n = st.apps.length;
        st.apps = [];
        return json(route, { revoked: n });
      }
      const id = decodeURIComponent(p.slice('auth/tokens/'.length));
      if (method === 'DELETE' && id.startsWith('ha_'))
        return json(route, { code: 'token_managed_in_ha', user_message: 'את האסימון הזה יצר Home Assistant, ו־Arx אינו משנה או מבטל אותו.', retryable: false, correlation_id: 'mock', details: {} }, 409);
      if (method === 'DELETE' && st.apps.some((a) => a.id === id)) {
        st.apps = st.apps.filter((a) => a.id !== id);
        return json(route, { revoked: 1 });
      }
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}

async function openAccount(page: Page) {
  await page.goto('/?design=a#/live/cameras');
  await page.waitForSelector('sw-app');
  await page.locator(phone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-account]').click();
  return menu;
}

async function openSection(page: Page) {
  const menu = await openAccount(page);
  await menu.locator('[data-my-security] summary').click();
  const section = menu.locator('[data-my-security] sw-access-tokens');
  await expect(section.locator('[data-access-tokens-list]')).toBeVisible();
  return section;
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator('sw-app sw-user-menu [data-profile-menu-panel]').screenshot({ path: path.join(OUT, `${name}-${phone(page) ? 'phone' : 'desktop'}.png`) });
}

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');

test('my tokens: HA tokens read-only, the long-lived one marked, the app sign-ins revocable', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await setup(page);
  const section = await openSection(page);
  const ha = section.locator('[data-source="ha"]');
  await expect(ha).toHaveCount(3);
  await expect(ha.locator('[data-revoke-token]')).toHaveCount(0); // Arx never revokes a Home Assistant token
  const ll = section.locator('[data-kind="long_lived"]');
  await expect(ll).toContainText('Node-RED');
  await expect(ll.locator('[data-exempt]')).toBeVisible();
  await expect(ll.locator('[data-used-in-arx]')).toBeVisible();
  await expect(ll).toContainText('203.0.113.0/24');
  await expect(section.locator('[data-current]')).toHaveCount(1);
  await expect(section.locator('[data-long-lived-note]')).toContainText('בטל אותו ב־Home Assistant');
  await expect(section.locator('[data-ha-hint]')).toContainText('פרופיל › אבטחה');
  const apps = section.locator('[data-kind="app"]');
  await expect(apps).toHaveCount(2);
  await expect(apps.locator('[data-revoke-token]')).toHaveCount(2);
  await shot(page, 'after-list');

  // one saved sign-in revoked
  await apps.first().locator('[data-revoke-token]').click();
  await expect(section.locator('[data-access-tokens-message]')).toHaveText('הכניסה השמורה בוטלה.');
  await expect(section.locator('[data-kind="app"]')).toHaveCount(1);
  expect(mock.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['auth/tokens/arf_pixel7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
  // with one left there is no "revoke all"; nothing was ever sent for an HA token
  await expect(section.locator('[data-revoke-all-tokens]')).toHaveCount(0);
  expect(mock.calls.some((c) => c.path.includes('ha_'))).toBe(false);
  expect(errors).toEqual([]);
});

test('revoke all asks once more, then revokes only the saved sign-ins', async ({ page }) => {
  skipTablet();
  const mock = await setup(page);
  const section = await openSection(page);
  const all = section.locator('[data-revoke-all-tokens]');
  await all.click();
  await expect(all).toContainText('לאשר?');
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  await shot(page, 'after-confirm');
  await all.click();
  await expect(section.locator('[data-access-tokens-message]')).toHaveText('בוטלו 2 כניסות שמורות.');
  await expect(section.locator('[data-kind="app"]')).toHaveCount(0);
  await expect(section.locator('[data-source="ha"]')).toHaveCount(3);
  expect(mock.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['auth/tokens']);
});

test('without Home Assistant\'s list the section says so and shows what Arx saw', async ({ page }) => {
  skipTablet();
  await setup(page, { listed: false, reason: 'ha_unavailable' });
  const section = await openSection(page);
  await expect(section.locator('[data-tokens-note="ha_unavailable"]')).toContainText('Home Assistant לא זמין כרגע');
  await expect(section.locator('[data-source="arx"][data-kind="long_lived"]')).toHaveCount(1);
  await expect(section.locator('[data-ha-hint]')).toBeVisible();
});

test('compare shots: the account level and the open section, light and dark', async ({ page }) => {
  skipTablet();
  test.skip(!process.env.SW_SHOTS, 'SW_SHOTS=1 writes the compare-page screenshots');
  for (const scheme of ['light', 'dark'] as const) {
    await setup(page);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const menu = await openAccount(page);
    await expect(menu.locator('[data-my-security]')).toBeVisible();
    await shot(page, `after-account-${scheme}`);
    await menu.locator('[data-my-security] summary').click();
    await expect(menu.locator('[data-my-security] sw-access-tokens [data-access-tokens-list]')).toBeVisible();
    await shot(page, `after-tokens-${scheme}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});
