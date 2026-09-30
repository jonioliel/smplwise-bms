import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_ALARM } from '../src/fixtures/alarm-demo';

// UI round 1 (2026-09-30), the security area: the snapshot setting (ui.security_snapshot), camera health as a tab of חקירה,
// and the alarm as a section of הגדרות › אבטחה - shown only to holders of the alarm permissions, only while an alarm panel
// exists (one cached request), with the old routes redirecting. Static preview + a mocked backend (page.route on api/v1),
// like evidence-shell.spec.ts: this checks what the client does with the permissions and the panel answer it is given;
// the server's own checks are backend tests/test_alarm*.py (untouched).
//   SW_BASE_URL=http://127.0.0.1:4611/ npx playwright test tests/evidence-security-r1.spec.ts --project=desktop --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-security');
const PANEL = DEMO_ALARM.panels[0].entity_id;

const OPERATOR = ['video.live', 'devices.read', 'alarm.view', 'alarm.arm', 'alarm.disarm', 'alarm.bypass']; // no settings permission
const ADMIN = [...OPERATOR, 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'sources.configure', 'rbac.assign'];

interface MockState {
  perms: string[];
  /** alarm panels the server lists (0 = none on the platform) */
  panels: number;
  snapshot: 'true' | 'false';
  panelRequests: number;
  configRequests: number;
}

async function install(page: Page, st: MockState) {
  await page.route('**/api/v1/**', (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.security_snapshot': st.snapshot }, can_edit: st.perms.includes('system.configure') });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 8, cameras_last_ok: '2026-09-30T08:00:00Z', cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') {
      st.panelRequests += 1;
      if (!st.perms.includes('alarm.view')) return json({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: '', details: {} }, 403);
      return json({ ...DEMO_ALARM, panels: DEMO_ALARM.panels.slice(0, st.panels), counts: { ...DEMO_ALARM.counts, panels: st.panels } });
    }
    if (p === 'alarm/config') {
      st.configRequests += 1;
      if (!st.perms.includes('system.configure')) return json({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: '', details: {} }, 403);
      return json({ panels: DEMO_ALARM.panels.slice(0, st.panels), excluded: [], overrides: [], candidates: { controls: [], sensors: [] }, integrations: {}, settings: { remote_control: true, remote_disarm: true, remote_codeless: true, code_mode: 'personal_pin' } });
    }
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

const hashOf = (page: Page) => page.evaluate(() => location.hash);
const SETTINGS_TABS = 'sw-app .subnav sw-tabs a';
const SUB_TABS = 'sw-app system-security [data-security-settings-tabs] sw-tabs a';

test.describe('security area, UI round 1 (mocked backend)', () => {
  let st: MockState;

  test.beforeEach(async ({ page }) => {
    st = { perms: ADMIN, panels: 1, snapshot: 'true', panelRequests: 0, configRequests: 0 };
    await install(page, st);
  });

  test('ui.security_snapshot off: the live section starts on כל המצלמות and the old address redirects', async ({ page }, info) => {
    await open(page, '/live');
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['תמונת מצב', 'כל המצלמות', 'תצוגות שמורות']);
    await expect(page.locator('sw-app live-overview')).toHaveCount(1);
    st.snapshot = 'false';
    await open(page, '/live');
    await expect.poll(() => hashOf(page)).toBe('#/live/wall');
    await expect(page.locator('sw-app live-overview')).toHaveCount(0);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['כל המצלמות', 'תצוגות שמורות']);
    // the section still opens on its first visible page from the switch and from #/security
    await expect(page.locator('sw-app nav[data-security-sections] a[data-section="live"]')).toHaveAttribute('href', '#/live/wall');
    await open(page, '/security');
    await expect.poll(() => hashOf(page)).toBe('#/live/wall');
    if (info.project.name === 'desktop') await page.screenshot({ path: path.join(EVIDENCE, 'after-snapshot-hidden-desktop.png') });
  });

  test('camera health: the last tab of חקירה (video.live, as before); #/system/devices redirects with its query', async ({ page }) => {
    await open(page, '/system/devices?sort=offline');
    await expect.poll(() => hashOf(page)).toBe('#/investigate/health?sort=offline');
    await expect(page.locator('sw-app system-devices')).toHaveCount(1);
    await expect(page.locator('sw-app nav[data-security-sections] a[data-section="investigate"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(SETTINGS_TABS).last()).toHaveText('בריאות מצלמות');
    // gated by the same permission as before: without video.live the tab is gone
    st.perms = ['events.read', 'devices.read'];
    await open(page, '/investigate/events');
    await expect(page.locator(SETTINGS_TABS).filter({ hasText: 'בריאות מצלמות' })).toHaveCount(0);
  });

  test('an operator with the alarm permissions and no settings permission: Settings offers only אבטחה › אזעקה; the alarm screen is unchanged', async ({ page }, info) => {
    st.perms = OPERATOR;
    await open(page, '/devices/building');
    // the user menu offers "מערכת", opening on the alarm
    const me = page.locator(info.project.name === 'mobile' ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]');
    await me.click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-settings]')).toHaveAttribute('href', '#/system/security');
    await page.keyboard.press('Escape');
    await open(page, '/system/security');
    await expect.poll(() => hashOf(page)).toBe('#/system/security/alarm');
    await expect(page.locator('sw-app system-security security-alarm section.hero')).toHaveCount(1);
    // Settings shows the security page (and their own notifications), nothing administrative
    await expect(page.locator(SETTINGS_TABS)).toHaveText(['התראות', 'אבטחה']);
    // one page only: no sub-tab row; management and NVR are not offered
    await expect(page.locator(SUB_TABS)).toHaveCount(0);
    for (const sub of ['manage', 'nvr']) {
      await open(page, `/system/security/${sub}`);
      await expect.poll(() => hashOf(page), sub).toBe('#/system/security/alarm');
    }
    // the fast path: the alarm's controls are there (arm modes, disarm) as they always were
    await expect(page.locator('security-alarm [data-arm]')).toHaveCount(3);
    if (info.project.name === 'desktop') await page.screenshot({ path: path.join(EVIDENCE, 'after-operator-alarm-desktop.png') });
  });

  test('a holder of alarm.arm alone (no alarm.view) sees no alarm page', async ({ page }) => {
    st.perms = ['video.live', 'alarm.arm', 'alarm.disarm', 'alarm.bypass'];
    await open(page, '/system/security');
    await expect(page.locator('sw-app system-security [data-security-settings-forbidden]')).toHaveCount(1);
    await expect(page.locator(SETTINGS_TABS).filter({ hasText: 'אבטחה' })).toHaveCount(0);
    expect(st.panelRequests).toBe(0);
  });

  test('a system administrator without alarm.view: management and NVR only (the discovery config answers "is there a panel")', async ({ page }) => {
    st.perms = ['system.configure', 'sources.configure', 'video.live'];
    await open(page, '/system/security');
    await expect.poll(() => hashOf(page)).toBe('#/system/security/manage');
    await expect(page.locator(SUB_TABS)).toHaveText(['ניהול אזעקה', 'NVR']);
    await expect(page.locator('sw-app system-security system-alarm-settings')).toHaveCount(1);
    await open(page, '/system/security/alarm'); // not permitted: lands on the first page they may open
    await expect.poll(() => hashOf(page)).toBe('#/system/security/manage');
    expect(st.panelRequests).toBe(0);
  });

  test('no alarm panel on the platform: the alarm pages are not offered at all (no empty state); the NVR page stays for an administrator', async ({ page }) => {
    st.panels = 0;
    await open(page, '/system/security');
    await expect.poll(() => hashOf(page)).toBe('#/system/security/nvr');
    await expect(page.locator(SETTINGS_TABS).filter({ hasText: 'אבטחה' })).toHaveCount(1);
    await expect(page.locator(SUB_TABS)).toHaveCount(0); // one page left: no row
    await expect(page.locator('sw-app system-security system-security-nvr')).toHaveCount(1);
    // an operator with no settings permission has nothing left there: no section, no "מערכת" item
    st.perms = OPERATOR;
    await open(page, '/system/security');
    await expect(page.locator('sw-app system-security [data-security-settings-forbidden]')).toHaveCount(1);
    await expect(page.locator(SETTINGS_TABS).filter({ hasText: 'אבטחה' })).toHaveCount(0);
  });

  test('the "is there a panel" answer is one cached request, not one per screen', async ({ page }) => {
    st.perms = OPERATOR;
    await open(page, '/devices/building');
    for (const hash of ['/explore/sites', '/live/wall', '/devices/building', '/investigate/events']) {
      await page.evaluate((h) => (location.hash = `#${h}`), hash);
      await page.waitForTimeout(150);
    }
    expect(st.panelRequests).toBe(1);
  });

  test('links written before the move keep their panel: #/security/alarm?panel= lands on the same panel in Settings', async ({ page }) => {
    await open(page, `/security/alarm?panel=${PANEL}`);
    await expect.poll(() => hashOf(page)).toBe(`#/system/security/alarm?panel=${PANEL}`);
    await expect(page.locator('sw-app system-security security-alarm section.hero')).toHaveAttribute('data-alarm-panel', PANEL);
    await open(page, '/security/alarm');
    await expect.poll(() => hashOf(page)).toBe('#/system/security/alarm');
  });

  test('the alarm is no section and no flat entry of the security area', async ({ page }) => {
    await open(page, '/investigate/events');
    await expect(page.locator('sw-app nav[data-security-sections] a')).toHaveText(['לייב', 'חקירה']);
    await expect(page.locator('sw-app nav.rail a[href="#/security/alarm"]')).toHaveCount(0);
    fs.mkdirSync(EVIDENCE, { recursive: true });
  });
});

// The setting against the real backend (any fixture backend: SW_LIVE=1 SW_API_PORT=<port> SW_BASE_URL=<preview on that proxy>).
test.describe('ui.security_snapshot against the real backend', () => {
  test.skip(process.env.SW_LIVE !== '1', 'needs a backend (SW_LIVE=1)');

  test('הגדרות › וידאו ומדיה › תמונת מצב באבטחה: hiding it lands the live section on כל המצלמות; restored afterwards', async ({ page, request }) => {
    const before = (await (await request.get('/api/v1/settings')).json()).settings['ui.security_snapshot'];
    expect(before, 'the default is shown').toBe('true');
    try {
      await open(page, '/system/diagnostics?tab=media');
      const select = page.locator('system-diagnostics select[data-set-security-snapshot]');
      await expect(select).toBeVisible({ timeout: 30000 });
      await select.selectOption('false');
      await page.locator('system-diagnostics sw-button', { hasText: 'שמור' }).first().click();
      await expect.poll(async () => (await (await request.get('/api/v1/settings')).json()).settings['ui.security_snapshot']).toBe('false');
      await open(page, '/live');
      await expect.poll(() => hashOf(page)).toBe('#/live/wall');
      await expect(page.locator('sw-app .subnav sw-tabs a').first()).toHaveText('כל המצלמות');
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.security_snapshot': before } });
    }
    await open(page, '/live');
    await expect(page.locator('sw-app live-overview')).toHaveCount(1);
  });
});
