import type { Page, Route } from '@playwright/test';
import { mockGaps, type GapOpts } from './home-v3-gaps-mocks';
import type { HomeMock } from './home-simple-mocks';

// HOME-T120-REST-2530: the mock layer of "החשבון שלי" in the home interface - the gaps mocks (the whole home, every category) plus the
// person's OWN account routes the sheet's blocks read (the wire shapes of routers/second_factor.py, local_passkeys.py, device_keys.py,
// access_tokens.py, remote sessions and /me/prefs, as tests/mfa-screens-mocks.ts answers them). Invented values only. Every write is
// recorded in `calls`; nothing is sent anywhere.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface AccountOpts extends GapOpts {
  /** the person is a home-only resident (default) or a wall panel */
  who?: 'resident' | 'wall';
}

export async function mockAccount(page: Page, o: AccountOpts = {}): Promise<HomeMock> {
  const policy = o.who === 'wall'
    ? { home_only: true, may_switch: false, kiosk: true, kiosk_area_id: 'living', ...(o.policy ?? {}) }
    : { home_only: true, may_switch: false, ...(o.policy ?? {}) };
  const mock = await mockGaps(page, { ...o, policy });
  const rec = (r: Route) => { const u = new URL(r.request().url()); mock.calls.push({ method: r.request().method(), path: u.pathname.replace(/^.*api\/v1\//, '') + u.search, body: r.request().postDataJSON?.() ?? null }); };
  await page.route('**/api/v1/auth/second-factor', (r) => json(r, { enabled: true, enabled_at: '2026-11-01T08:00:00Z', last_used_at: '2026-11-02T07:00:00Z' }));
  await page.route('**/api/v1/auth/recovery-codes', (r) => json(r, { available: true, remaining: 8, total: 10, created_at: '2026-11-01T08:00:00Z', last_used_at: null, low: false, low_at: 3 }));
  await page.route('**/api/v1/auth/passkeys', (r) => json(r, { available: true, rp_id: new URL(r.request().url()).hostname, origin: new URL(r.request().url()).origin, first_allowed: false, first_on: false, only_on: false, only_effective: false,
    credentials: [{ id: 'pk1', label: 'הטלפון של נועה', created_at: '2026-11-02T08:00:00+00:00', last_used_at: null, synced: true, backed_up: true, transports: ['internal'], usable: true, user_verifying: true }],
    recent_auth: false, recent_auth_left_s: 0, totp: true, user_kind: 'user' }));
  await page.route('**/api/v1/auth/device-keys', (r) => json(r, { keys: [], auth_kind: 'biometric_or_screen_lock', attestation: 'preferred', max: 5 }));
  await page.route('**/api/v1/auth/tokens', (r) => json(r, { ha_listed: false, ha_reason: null, app_enabled: true, tokens: [] }));
  await page.route('**/api/v1/auth/step-up', (r) => json(r, { enabled: false, minutes: 5, local_channel: false, applies: false, reason: 'off', methods: ['totp'], valid_until: null }));
  await page.route('**/api/v1/auth/sessions?**', (r) => json(r, { scope: 'own', can_manage: false, channel: 'local', sessions: [] }));
  await page.route('**/api/v1/me/prefs', (r) => {
    if (r.request().method() === 'PUT') { rec(r); return json(r, { prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }); }
    return json(r, { prefs: {}, stored: [], updated_at: null });
  });
  return mock;
}
