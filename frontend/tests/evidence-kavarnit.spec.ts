import { test, expect, type Page, type Route } from '@playwright/test';
import { ScheduleDemoStore } from '../src/api/schedules-mock';

// 0.1.154: the home area's tabs are "מבט על" | "קברניט"; the schedules are the first segment of קברניט (the address
// #/devices/schedules is unchanged and draws the segment strip), followed by אוטומציות · סצנות · סקריפטים.
// Demo mode (no backend) for the default segment, the strip and the old deep links; a mocked session for the gates
// (schedules.enabled, permissions) and the migration of a stored `ui.tabs`. Desktop, tablet and phone projects.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-kavarnit.spec.ts --workers=2

const rowTabs = (page: Page) => page.locator('sw-app .subnav sw-tabs a').allTextContents();
const hashOf = (page: Page) => page.evaluate(() => location.hash);
const segments = (page: Page, host: 'devices-schedules' | 'devices-automations') => page.locator(`sw-app ${host} button[data-segment]`);
const segmentIds = (page: Page, host: 'devices-schedules' | 'devices-automations') => segments(page, host).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-segment')));

async function openDemo(page: Page, hash: string) {
  // demo mode whatever runs on the preview's proxy target: no backend answers this page
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('sw.schedules.view');
      localStorage.removeItem('sw.schedules.filters');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

// ------------------------------------------------------------------------------------------------ demo mode

test.describe('קברניט (demo mode)', () => {
  test('the home tabs are מבט על | קברניט and the tab opens on the schedules, the first segment', async ({ page }) => {
    await openDemo(page, '/devices/building');
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(page.locator('sw-app devices-schedules')).toHaveCount(1);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
    await expect.poll(() => segmentIds(page, 'devices-schedules')).toEqual(['schedules', 'automations', 'scenes', 'scripts']);
    await expect(page.locator('sw-app devices-schedules button[data-segment="schedules"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app devices-schedules button[data-segment="automations"]')).toHaveAttribute('aria-selected', 'false');
    // the segment labels, with a count each
    await expect(page.locator('sw-app devices-schedules button[data-segment="schedules"]')).toContainText('תזמונים');
    await expect(page.locator('sw-app devices-schedules button[data-segment="schedules"] small')).toHaveCount(1);
    await expect(page.locator('sw-app devices-schedules button[data-segment="scenes"]')).toContainText('סצנות');
  });

  test('the segments lead between the screens, each with its own search and counts; the strip of the automations starts with תזמונים', async ({ page }, info) => {
    await openDemo(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-toolbar]')).toBeVisible();
    await expect(page.locator('sw-app devices-schedules [data-filter="q"]')).toHaveCount(1); // the schedules' own search
    await page.locator('sw-app devices-schedules button[data-segment="automations"]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/automations');
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
    await expect.poll(() => segmentIds(page, 'devices-automations')).toEqual(['schedules', 'automations', 'scenes', 'scripts']);
    await expect(page.locator('sw-app devices-automations button[data-segment="automations"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('sw-app devices-automations button[data-segment="schedules"] small')).toHaveCount(1);
    const search = page.locator('sw-app devices-automations input[data-search]');
    await expect(search).toBeVisible(); // the automations' own search (not the schedules')
    if (info.project.name !== 'mobile') await expect(search).toHaveAttribute('placeholder', 'חיפוש אוטומציה או מכשיר');
    await page.locator('sw-app devices-automations button[data-segment="scenes"]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/automations/scenes');
    await page.locator('sw-app devices-automations button[data-segment="schedules"]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(page.locator('sw-app devices-schedules')).toHaveCount(1);
  });

  test('old deep links keep working: the schedule list, a drawer, the trash and the editor stay under קברניט', async ({ page }) => {
    await openDemo(page, '/devices/schedules/4d6e0a');
    await expect(page.locator('sw-app devices-schedules')).toHaveCount(1);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules/4d6e0a');
    await expect(page.locator('sw-app devices-schedules schedule-drawer')).toHaveCount(1);
    await openDemo(page, '/devices/schedules/trash');
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
    await expect(page.locator('sw-app devices-schedules [data-kavarnit-segments]')).toHaveCount(0); // a sub-page (the trash) has its own way back
    await openDemo(page, '/devices/schedules/new/edit');
    await expect(page.locator('sw-app schedule-editor')).toHaveCount(1);
  });

  test('targets are 44px at least (the automations strip on the phone, as it always was) and the strip never makes the page scroll sideways', async ({ page }, info) => {
    await openDemo(page, '/devices/schedules');
    const strip = page.locator('sw-app devices-schedules [data-kavarnit-segments]');
    await expect(strip).toBeVisible();
    for (const id of ['schedules', 'automations', 'scenes', 'scripts']) {
      const b = await page.locator(`sw-app devices-schedules button[data-segment="${id}"]`).boundingBox();
      expect(b!.height, id).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('sw-app devices-schedules button[data-segment="automations"]').click();
    await expect(page.locator('sw-app devices-automations [data-auto-header]')).toBeVisible();
    for (const id of info.project.name === 'mobile' ? ['schedules', 'automations'] : []) {
      const b = await page.locator(`sw-app devices-automations button[data-segment="${id}"]`).boundingBox();
      expect(b!.height, id).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ with a session

const VIEWER_PERMS = ['video.live', 'video.playback', 'devices.read', 'map.read', 'entity.state.read', 'events.read'];

interface ApiState {
  perms: string[];
  settings: Record<string, unknown>;
  store: ScheduleDemoStore;
}

async function install(page: Page, st: ApiState) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const err = (status: number, code: string, msg: string) => json({ code, user_message: msg, retryable: false, correlation_id: '', details: {} }, status);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.security_snapshot': 'true', ...st.settings }, can_edit: false });
    if (p === 'schedules/status') return st.perms.includes('schedule.view') ? json(await st.store.status()) : err(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
    if (p === 'schedules' && req.method() === 'GET') return json(await st.store.list({ limit: 500 }));
    if (p.startsWith('schedules/condition-candidates')) return json(await st.store.conditionCandidates({}));
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ panels: [], counts: { panels: 0 } });
    return err(404, 'not_found', 'לא נמצא (בדיקה)');
  });
}

async function openApi(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

test.describe('קברניט with a session: the gates and a stored ui.tabs', () => {
  let st: ApiState;

  test.beforeEach(async ({ page }) => {
    st = { perms: [...VIEWER_PERMS, 'schedule.view', 'schedule.manage', 'automation.manage'], settings: {}, store: new ScheduleDemoStore() };
    await install(page, st);
  });

  test('both gates open: the tab opens on the schedules, whose strip leads on to the automations', async ({ page }) => {
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    await expect.poll(() => segmentIds(page, 'devices-schedules')).toEqual(['schedules', 'automations']); // the automations status is not mocked: the base segment only
  });

  test('schedules.enabled off: the segment is gone and the tab opens on the automations', async ({ page }) => {
    st.settings = { 'schedules.enabled': 'false' };
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/automations');
    await expect(page.locator('sw-app devices-automations')).toHaveCount(1);
    await expect(page.locator('sw-app devices-automations button[data-segment="schedules"]')).toHaveCount(0);
  });

  test('no schedule permission: the tab opens on the automations', async ({ page }) => {
    st.perms = [...VIEWER_PERMS, 'automation.manage'];
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/automations');
    await expect(page.locator('sw-app devices-automations button[data-segment="schedules"]')).toHaveCount(0);
  });

  test('only the schedules (no automation right): one segment, so no strip', async ({ page }) => {
    st.perms = [...VIEWER_PERMS, 'schedule.view'];
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    await expect(page.locator('sw-app devices-schedules [data-kavarnit-segments]')).toHaveCount(0);
  });

  test('neither right: no קברניט tab and no tab row', async ({ page }) => {
    st.perms = VIEWER_PERMS;
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
  });

  test('a stored ui.tabs of the old layout migrates: no dead "תזמונים" tab, no hidden segment', async ({ page }) => {
    st.perms = [...VIEWER_PERMS, 'schedule.view'];
    st.settings = { 'ui.tabs': { devices: { order: ['schedules', 'building', 'automations'], hidden: ['schedules'] } } };
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
  });

  test('a stored hidden "automations" (the old tab) does not take the schedules segment away', async ({ page }) => {
    st.perms = [...VIEWER_PERMS, 'schedule.view'];
    st.settings = { 'ui.tabs': { devices: { order: [], hidden: ['automations'] } } };
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
  });
});
