import { test, expect, type Page } from '@playwright/test';

// Remote channel (/arx/): the routes in backend/smplwise/remote_channel.py BLOCKED_ON_REMOTE answer 404 on purpose, so the UI must
// not call them there and must not show a raw "Not found" with a retry button. Against a MOCKED backend (page.route on api/v1;
// npm run build first, the preview serves dist/ - or the Vite dev server) on desktop, tablet and mobile. The mock says
// `channel: 'remote'` (the server's confirmation in /me) and answers every blocked path 404 exactly like the real remote channel,
// counting the calls: the specs assert the count stays zero. Every value is fake.
const ADMIN = ['video.live', 'video.playback', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const BLOCKED = ['nvr/connection', 'nvr/vendors', 'system/restart', 'ha/bridge', 'recorders', 'multimedia/admin/ma-connection', 'nvr/encoding-batches'];
const LOCAL_ONLY = 'חיבור ה־NVR מנוהל רק מהרשת המקומית';
const NOT_FOUND = { code: 'not_found', user_message: 'Not found', retryable: false, correlation_id: '', details: {} };

const HEALTH = (mode: string) => ({
  status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: mode === 'full', go2rtc_configured: true, mode,
  discovery: { cameras_last_ok: '2026-10-03T08:00:00Z', cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 4, interval_s: 600 },
  events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: '2026-10-03T08:00:00Z', last_error: null, reconnects: 0, events_stored: 3, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 3 },
  home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 10, started_at: null, ha_version: '2026.9' },
  identity_source: 'ingress', renderer: 'fake',
});

function setupState() {
  const base = { warnings: [], problem: null, checked_at: '2026-10-03T08:00:00Z', facts: [], evidence: {}, settings_link: { href: '#/system/setup', label: 'הגדרות › חיבורים' }, source: 'local' };
  const step = (id: string, index: number, title: string, status: string, summary: string) => ({ ...base, id, index, title, status, summary });
  const steps = [step('install', 1, 'התקנת המערכת', 'done', 'גרסה test'), step('nvr', 2, 'חיבור ל־NVR', 'todo', 'עדיין לא נבחר סוג NVR להתקנה.'), step('ha', 3, 'תשתית המערכת והגשר', 'done', 'מחובר')];
  return { version: 'test', mode: 'full', checked_at: '2026-10-03T08:00:00Z', steps, done: 2, total: 3, ready: false, next: 'nvr', threshold: 0 };
}

async function mockRemote(page: Page, calls: string[], channel: 'remote' | 'local' = 'remote') {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (BLOCKED.some((b) => p === b || p.startsWith(`${b}/`))) {
      calls.push(`${req.method()} ${p}`);
      return json(NOT_FOUND, 404);
    }
    if (p === 'me') {
      return json({
        channel, remote: channel === 'remote' ? { path: '/arx/', session: 'rolling_90d', idle_lock_minutes: 720 } : null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'remote' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
        connection_pending_restart: true,
      });
    }

    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-03T00:00:00Z', version: 'test' });
    if (p === 'health') return json(HEALTH('full'));
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'setup/state' || p.startsWith('setup/check/')) return json(setupState());
    return json({ ...NOT_FOUND, user_message: 'לא נמצא (בדיקה)' }, 404);
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
}

test.describe('remote channel: calls blocked on remote are not made', () => {
  test('Settings: the NVR connection card is one calm line - no error, no retry, no raw English, no blocked call', async ({ page }) => {
    const calls: string[] = [];
    await mockRemote(page, calls);
    await open(page, '/system/setup');
    const note = page.locator('system-setup nvr-recorders-card [data-nvr-local-only]');
    await expect(note).toBeVisible({ timeout: 20000 });
    await expect(note).toHaveText(LOCAL_ONLY);
    const text = await page.locator('system-setup').innerText();
    expect(text).not.toContain('Not found');
    expect(text).not.toContain('פרטי החיבור לא נטענו');
    await expect(page.locator('system-setup nvr-recorders-card sw-state-panel')).toHaveCount(0);
    await expect(page.locator('system-setup nvr-recorders-card [data-conn-vendor]')).toHaveCount(0);
    expect(calls).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test('the restart banner stays away: no button to a route the remote channel refuses, and no probe of it', async ({ page }) => {
    const calls: string[] = [];
    await mockRemote(page, calls);
    await open(page, '/system/setup');
    await page.waitForTimeout(1000);
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-banner]')).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test('the same screen on a local channel still loads the connection (control)', async ({ page }) => {
    const calls: string[] = [];
    await mockRemote(page, calls, 'local');
    await open(page, '/system/setup');
    await expect.poll(() => calls.length, { timeout: 20000 }).toBeGreaterThan(0);
  });
});
