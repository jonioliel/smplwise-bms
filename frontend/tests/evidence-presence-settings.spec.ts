import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-027: הגדרות › אפליקציה לנייד - the administrator's side of the phone app's data sharing: the master switch (off by default),
// the allowed sensors, the employee notice with its version, retention, the required-sensors policy with its break-glass, and the
// registered devices. Plus the shell's gate: a /me that says `presence_gate.blocked` shows one clean state instead of the app.
// Against a MOCKED backend (page.route on api/v1; npm run build first, the preview serves dist/). Runs on the three projects.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/CR-027-presence');
const ALL_PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign', 'presence.report', 'presence.sensors.view'];
const SENSORS = ['location', 'activity', 'steps', 'altitude', 'battery', 'network', 'beacon', 'app_state'];
const DEFAULTS = {
  enabled: false, mode: 'continuous', interval_s: 60, distance_filter_m: 50, notice_text: '', notice_version: 1, sensors_allowed: SENSORS, intervals_s: {}, sites: [], beacons: [], wifi_sites: [],
  retention_days: 30, required_sensors: { enabled: false, sensors: [], apply_to_web: false, max_stale_hours: 48, roles: [], users: [], exempt_users: [] }, break_glass: { until: null, reason: '', by: null },
};
const DEVICE = {
  device_id: 'dev_1', name: 'הנייד של יוסי', platform: 'ios', app_version: '1.0.0', registered_at: '2026-10-05T08:00:00Z', last_seen_at: '2026-10-05T09:00:00Z', last_event_at: '2026-10-05T09:00:00Z',
  notice_ack_version: 1, status: { location_auth: 'always', precise: true, sharing: true, sensors: Object.fromEntries(SENSORS.map((k) => [k, k === 'location' || k === 'battery' ? 'on' : 'off'])) },
  presence: { inside: true, site_id: 'site_main', at: '2026-10-05T09:00:00Z' }, push: { registered: true, platform: 'ios', muted: [], last_ok_at: null, failures: 0 },
  user: { id: 'u-yossi', username: 'yossi', display_name: 'יוסי', active: true },
};

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function mockBackend(page: Page, opts: { gate?: Record<string, unknown> | null; settings?: Record<string, unknown> } = {}) {
  const state = { settings: { ...DEFAULTS, ...(opts.settings ?? {}) } as Record<string, unknown>, puts: [] as Record<string, unknown>[], glass: [] as Record<string, unknown>[] };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ALL_PERMS, permissions_any: ALL_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
        ...(opts.gate !== undefined ? { presence_gate: opts.gate } : {}),
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'presence/settings' && req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.puts.push(body);
      const prev = state.settings;
      const next = { ...prev, ...body, required_sensors: { ...(prev.required_sensors as object), ...((body.required_sensors as object) ?? {}) } } as Record<string, unknown>;
      if (typeof body.notice_text === 'string' && body.notice_text !== prev.notice_text) next.notice_version = (prev.notice_version as number) + 1;
      state.settings = next;
      return json({ settings: state.settings, sensors: [], devices: 1 });
    }
    if (p === 'presence/settings') return json({ settings: state.settings, sensors: [], devices: 1 });
    if (p === 'presence/settings/break-glass') {
      const body = req.postDataJSON() as { hours: number; reason: string };
      state.glass.push(body);
      const bg = body.hours ? { until: '2026-10-06T09:00:00Z', reason: body.reason, by: 'u-admin' } : { until: null, reason: '', by: null };
      state.settings = { ...state.settings, break_glass: bg };
      return json({ break_glass: bg });
    }
    if (p === 'presence/devices') return json({ devices: [DEVICE] });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return state;
}

test.describe('הגדרות › אפליקציה לנייד (CR-027)', () => {
  test('the tab shows the defaults: sharing off, every sensor allowed, notice version 1, retention 30, policy off, one device', async ({ page }) => {
    await mockBackend(page);
    await open(page, '/system/diagnostics?tab=mobile');
    const card = page.locator('system-diagnostics system-presence [data-presence-card]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-presence-enabled]')).not.toHaveAttribute('checked', '');
    await expect(card.locator('[data-presence-sensor]')).toHaveCount(8);
    for (const k of SENSORS) await expect(card.locator(`[data-presence-sensor="${k}"]`)).toBeChecked();
    await expect(card.locator('[data-presence-row="notice"] .muted')).toContainText('גרסה 1');
    await expect(card.locator('[data-presence-retention]')).toHaveValue('30');
    const policy = page.locator('system-presence [data-presence-policy]');
    await expect(policy.locator('[data-presence-policy-enabled]')).not.toHaveAttribute('checked', '');
    await expect(policy.locator('[data-presence-required-sensor="location"]')).toBeDisabled();
    await expect(policy.locator('[data-presence-save] button')).toBeDisabled();
    const devices = page.locator('system-presence [data-presence-devices]');
    for (const text of ['יוסי', 'הנייד של יוסי', 'מיקום, סוללה', 'כן', 'רשום']) await expect(devices.locator('[data-presence-device="dev_1"]')).toContainText(text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'presence-settings-defaults');
  });

  test('the save sends the whole patch; the notice version follows the server; the policy needs an allowed sensor', async ({ page }) => {
    const mock = await mockBackend(page);
    await open(page, '/system/diagnostics?tab=mobile');
    const card = page.locator('system-presence [data-presence-card]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.locator('[data-presence-enabled]').click();
    await card.locator('[data-presence-sensor="beacon"]').uncheck();
    await card.locator('[data-presence-notice]').fill('הודעה לעובדים: המערכת אוספת מיקום לצורך נוכחות.');
    await card.locator('[data-presence-retention]').selectOption('90');
    const policy = page.locator('system-presence [data-presence-policy]');
    await policy.locator('[data-presence-policy-enabled]').click();
    await expect(policy.locator('[data-presence-policy-problem]')).toContainText('בחרו לפחות חיישן אחד');
    await policy.locator('[data-presence-required-sensor="location"]').check();
    await expect(policy.locator('[data-presence-policy-problem]')).toHaveCount(0);
    await policy.locator('[data-presence-save]').click();
    await expect(policy.locator('[data-presence-message]')).toHaveText('ההגדרות נשמרו');
    expect(mock.puts).toHaveLength(1);
    expect(mock.puts[0]).toMatchObject({ enabled: true, retention_days: 90, sensors_allowed: SENSORS.filter((k) => k !== 'beacon'), required_sensors: { enabled: true, sensors: ['location'], apply_to_web: false } });
    expect(mock.puts[0].notice_text).toContain('הודעה לעובדים');
    await expect(card.locator('[data-presence-row="notice"] .muted')).toContainText('גרסה 2');
    await expect(policy.locator('[data-presence-save] button')).toBeDisabled();
    // a required sensor that is not allowed is flagged before the save
    await card.locator('[data-presence-sensor="location"]').uncheck();
    await expect(policy.locator('[data-presence-policy-problem]')).toContainText('חייב להיות מאושר');
    await shot(page, 'presence-settings-policy');
  });

  test('break-glass needs a reason, suspends with the server answer and can be ended', async ({ page }) => {
    const mock = await mockBackend(page, { settings: { enabled: true, required_sensors: { ...DEFAULTS.required_sensors, enabled: true, sensors: ['location'] } } });
    await open(page, '/system/diagnostics?tab=mobile');
    const policy = page.locator('system-presence [data-presence-policy]');
    await expect(policy).toBeVisible({ timeout: 15000 });
    await expect(policy.locator('[data-presence-glass] button')).toBeDisabled();
    await policy.locator('[data-presence-glass-reason]').fill('תקלה באפליקציה');
    await policy.locator('[data-presence-glass]').click();
    await expect(policy.locator('[data-presence-row="glass"] .muted')).toContainText('מושעה עד');
    await expect(policy.locator('[data-presence-row="glass"] .muted')).toContainText('תקלה באפליקציה');
    expect(mock.glass).toEqual([{ hours: 24, reason: 'תקלה באפליקציה' }]);
    await policy.locator('[data-presence-glass-end]').click();
    await expect(policy.locator('[data-presence-row="glass"] .muted')).toContainText('24 שעות');
    expect(mock.glass).toHaveLength(2);
  });

  test('a blocked presence gate shows one clean state naming the missing sensor; an open gate changes nothing', async ({ page }) => {
    await mockBackend(page, { gate: { required: ['location'], missing: ['location'], blocked: true, applies: true, channel: 'app', break_glass_until: null, reason: 'missing_sensors' } });
    await open(page, '/devices');
    const gate = page.locator('sw-app [data-presence-gate]');
    await expect(gate).toContainText('נדרש להפעיל שיתוף נתונים');
    await expect(gate).toContainText('מיקום');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'presence-gate-blocked');
    await page.unroute('**/api/v1/**');
    await mockBackend(page, { gate: { required: ['location'], missing: [], blocked: false, applies: true, channel: 'app', break_glass_until: null, reason: null } });
    await open(page, '/devices');
    await expect(page.locator('sw-app [data-presence-gate]')).toHaveCount(0);
  });
});
