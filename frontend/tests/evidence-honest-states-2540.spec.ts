import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHonestHome } from './honest-states-2540-mocks';

// HONEST-STATES-2540 (deep review SCR-09, SCR-10, SCR-29 / FC-01) against mocked backends (nothing is sent anywhere, no device is
// contacted, no panel is armed):
// - the home interface says "unknown" / "not available" for a lock or an alarm panel it cannot read - never an open door, never "armed";
// - the camera OSD switches are controlled: a refused NVR write leaves them on the state the NVR reports.
// The automation editor's enable switch is covered in evidence-automations-builder.spec.ts (it needs that file's editor harness).

const home = (page: Page) => page.locator('sw-home');

async function openHome(page: Page, c: 'offline' | 'mixed' | 'normal', route: string) {
  await page.goto('about:blank');
  await mockHonestHome(page, c);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await home(page).locator('.hs.v2').waitFor();
  await settle(page);
}

test.describe('HONEST-STATES-2540 home: a lock or a panel that cannot be read', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('offline lock + unknown lock + unavailable panel: the home screen says unknown / not available', async ({ page }) => {
    await openHome(page, 'offline', 'r/home');
    const pill = home(page).locator('a.st-pill[href*="doors"]');
    await expect(pill).toContainText('מצב הדלתות לא ידוע');
    await expect(pill).toHaveAttribute('data-tone', 'neutral');
    await expect(pill).not.toContainText('פתוח');
    const doors = home(page).locator('.chip3[data-cat="doors"]');
    await expect(doors).toContainText('לא ידוע');
    await expect(doors).not.toContainText('פתוח');
    const sec = home(page).locator('.chip3[data-cat="security"]');
    await expect(sec).toContainText('לא זמין');
    await expect(sec).not.toContainText('דרוך');
  });

  test('the doors screen: the offline lock says "not available", the unknown one "unknown", both neutral, both kept by the not-locked filter', async ({ page }) => {
    await openHome(page, 'offline', 'doors');
    const front = home(page).locator('.drow[data-fid="lock.front"] .dst');
    const gate = home(page).locator('.drow[data-fid="lock.gate"] .dst');
    await expect(front).toContainText('לא זמינה כרגע');
    await expect(front).toHaveAttribute('data-tone', 'neutral');
    await expect(gate).toContainText('לא ידוע');
    await expect(gate).toHaveAttribute('data-tone', 'neutral');
    await expect(home(page).locator('.drow[data-fid="lock.gate"] .di')).toHaveAttribute('data-tone', 'neutral');
  });

  test('mixed: one locked door and one offline lock never read "all the doors are locked"; an unknown panel offers no arming', async ({ page }) => {
    await openHome(page, 'mixed', 'r/home');
    const pill = home(page).locator('a.st-pill[href*="doors"]');
    await expect(pill).toContainText('מצב שער החניה לא ידוע');
    await expect(pill).not.toContainText('כל הדלתות נעולות');
    await expect(home(page).locator('.chip3[data-cat="security"]')).toContainText('לא ידוע');
    await page.goto('/#/home/security');
    await settle(page);
    const main = home(page).locator('[data-home-alarm]');
    await expect(main).toContainText('לא ידוע');
    await expect(main).toContainText('מצב המערכת לא ידוע כרגע.');
    await expect(home(page).locator('[data-act="almDisarm"]')).toHaveCount(0);
    const arm = home(page).locator('[data-act="almArm"]');
    await expect(arm.first()).toBeVisible();
    for (const b of await arm.all()) await expect(b).toBeDisabled();
  });

  test('the demo house as before: every lock locked, the panel disarmed', async ({ page }) => {
    await openHome(page, 'normal', 'r/home');
    const pill = home(page).locator('a.st-pill[href*="doors"]');
    await expect(pill).toContainText('כל הדלתות נעולות');
    await expect(pill).toHaveAttribute('data-tone', 'ok');
    await expect(home(page).locator('.chip3[data-cat="doors"]')).toContainText('נעול');
    await expect(home(page).locator('.chip3[data-cat="security"]')).toContainText('לא דרוך');
  });
});

// ------------------------------------------------------------------------------------------------ the camera OSD switches (SCR-29)

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PERMS = ['video.live', 'media.read', 'devices.read', 'nvr.config.osd'];
const CAMERA = {
  id: 'cam-1', recorder_id: 'r1', channel: 1, name: 'כניסה', name_source: 'nvr', alias: null, enabled: true, sort_order: 1, grid_col_span: 1,
  main_track: 101, sub_track: 102, status: 'online', last_seen_at: '2026-11-13T10:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 },
  encoding: null, can_view_live: true,
};

interface OsdMock { nameOn: boolean; refuse: boolean; puts: unknown[] }

async function installCamera(page: Page): Promise<OsdMock> {
  const m: OsdMock = { nameOn: false, refuse: true, puts: [] };
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-hs', username: 'hs', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: [CAMERA], recorders: [{ id: 'r1', name: 'NVR' }], recorder: { id: 'r1', name: 'NVR', model: null, firmware: null, last_seen_at: null }, can_sync: false });
    if (/^cameras\/[^/]+\/snapshot/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'cameras/cam-1/osd' && method === 'GET') {
      return json(route, { camera_id: 'cam-1', channel: 1, vms_name: 'כניסה', nvr_name: 'כניסה', can_write: true, writes_enabled: true, date_styles: ['YYYY-MM-DD'], screen: { width: 704, height: 576 },
        channel_name: { enabled: m.nameOn, x: 10, y: 10 }, datetime: { enabled: true, x: 10, y: 40, date_style: 'YYYY-MM-DD', time_style: '24', display_week: false } });
    }
    if (p === 'cameras/cam-1/osd' && method === 'PUT') {
      const body = req.postDataJSON() as { name_enabled?: boolean };
      m.puts.push(body);
      if (m.refuse) return json(route, { code: 'nvr_write_refused', user_message: 'המקליט סירב לשינוי (דוגמה).', retryable: false, correlation_id: 'mock', details: {} }, 409);
      if (typeof body.name_enabled === 'boolean') m.nameOn = body.name_enabled;
      return json(route, { id: 'chg-1', kind: 'osd', permission: 'nvr.config.osd', target: 'cam-1', path: '', status: 'applied' });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return m;
}

const cam = (page: Page) => page.locator('sw-app live-camera');

test.describe('HONEST-STATES-2540 camera OSD switches (SCR-29 / FC-01)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
  });

  test('a refused NVR write leaves the "name on the picture" switch off; an accepted one turns it on after the NVR answers', async ({ page }) => {
    const m = await installCamera(page);
    await page.goto('/?design=a#/live/cameras/cam-1');
    await page.waitForSelector('sw-app');
    await expect(cam(page).locator('[data-camera-settings]')).toBeVisible({ timeout: 20_000 });
    await cam(page).locator('[data-camera-settings] > summary').click();
    await cam(page).locator('[data-acc-osd] > summary').click();
    const sw = cam(page).locator('[data-osd-name-enabled]');
    const btn = sw.locator('button');
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await btn.click();
    await expect.poll(() => m.puts.length).toBe(1);
    expect(m.puts[0]).toEqual({ name_enabled: true });
    await expect(cam(page).locator('[data-osd-msg]')).toContainText('סירב');
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toHaveJSProperty('checked', false);

    m.refuse = false;
    await btn.click();
    await expect.poll(() => m.puts.length).toBe(2);
    await expect(cam(page).locator('[data-osd-msg]')).toContainText('נכתב למקליט');
    await expect(btn).toHaveAttribute('aria-checked', 'true');
  });
});
