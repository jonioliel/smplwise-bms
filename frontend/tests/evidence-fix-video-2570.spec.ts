import { expect, test, type Page, type Route } from '@playwright/test';
import { appReady } from './helpers/app-ready';

// FIX-VIDEO-2570 (final deep review 2.56, SCR-29 and SCR-54) against mocked backends / the demo store - nothing is sent anywhere, no
// recorder is contacted:
// - SCR-29: the camera's OSD controls show what the NVR holds after a write that did not succeed (the date-format list included), a write
//   whose answer was lost says "unknown" (never "failed", never re-sent), and one press writes once;
// - SCR-54: the schedules bulk bar acts only on the schedules picked on the page on screen.
//   SW_BASE_URL=http://127.0.0.1:4791/ npx playwright test tests/evidence-fix-video-2570.spec.ts --project=desktop --workers=1

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PERMS = ['video.live', 'media.read', 'devices.read', 'nvr.config.osd'];
const CAMERA = {
  id: 'cam-1', recorder_id: 'r1', channel: 1, name: 'כניסה', name_source: 'nvr', alias: null, enabled: true, sort_order: 1, grid_col_span: 1,
  main_track: 101, sub_track: 102, status: 'online', last_seen_at: '2026-11-13T10:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 },
  encoding: null, can_view_live: true,
};

type PutMode = 'ok' | 'refuse' | 'unknown' | 'abort' | 'slow';
interface OsdMock { nameOn: boolean; dateStyle: string; mode: PutMode; puts: unknown[]; gets: number }

async function installCamera(page: Page): Promise<OsdMock> {
  const m: OsdMock = { nameOn: false, dateStyle: 'YYYY-MM-DD', mode: 'ok', puts: [], gets: 0 };
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-fv', username: 'fv', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: [CAMERA], recorders: [{ id: 'r1', name: 'NVR' }], recorder: { id: 'r1', name: 'NVR', model: null, firmware: null, last_seen_at: null }, can_sync: false });
    if (/^cameras\/[^/]+\/snapshot/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'cameras/cam-1/osd' && method === 'GET') {
      m.gets += 1;
      return json(route, { camera_id: 'cam-1', channel: 1, vms_name: 'כניסה', nvr_name: 'כניסה', can_write: true, writes_enabled: true, date_styles: ['YYYY-MM-DD', 'DD-MM-YYYY'], screen: { width: 704, height: 576 },
        channel_name: { enabled: m.nameOn, x: 10, y: 10 }, datetime: { enabled: true, x: 10, y: 40, date_style: m.dateStyle, time_style: '24', display_week: false } });
    }
    if (p === 'cameras/cam-1/osd' && method === 'PUT') {
      const body = req.postDataJSON() as { name_enabled?: boolean; date_style?: string };
      m.puts.push(body);
      if (m.mode === 'refuse') return json(route, { code: 'nvr_rejected', user_message: 'המקליט סירב לשינוי (דוגמה).', retryable: false, correlation_id: 'mock', details: {} }, 409);
      if (m.mode === 'unknown') {
        return json(route, { code: 'action_outcome_unknown', user_message: 'לא ידוע אם השינוי נשמר ב־NVR (דוגמה).', retryable: false, correlation_id: 'mock', details: { outcome: 'unknown' } }, 504);
      }
      if (m.mode === 'abort') return route.abort('connectionreset');
      if (m.mode === 'slow') await new Promise((r) => setTimeout(r, 800));
      if (typeof body.name_enabled === 'boolean') m.nameOn = body.name_enabled;
      if (typeof body.date_style === 'string') m.dateStyle = body.date_style;
      return json(route, { id: `chg-${m.puts.length}`, kind: 'osd', permission: 'nvr.config.osd', target: 'osd-1', path: '', status: 'applied' });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return m;
}

const cam = (page: Page) => page.locator('sw-app live-camera');

async function openOsd(page: Page) {
  await page.goto('/?design=a#/live/cameras/cam-1');
  await page.waitForSelector('sw-app');
  await expect(cam(page).locator('[data-camera-settings]')).toBeVisible({ timeout: 20_000 });
  await cam(page).locator('[data-camera-settings] > summary').click();
  await cam(page).locator('[data-acc-osd] > summary').click();
  await expect(cam(page).locator('[data-osd-date-style]')).toBeVisible();
}

test.describe('FIX-VIDEO-2570 camera OSD (SCR-29)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
  });

  test('a refused date format does not stay on screen: the list goes back to what the NVR holds', async ({ page }) => {
    const m = await installCamera(page);
    m.mode = 'refuse';
    await openOsd(page);
    const sel = cam(page).locator('[data-osd-date-style]');
    await expect(sel).toHaveValue('YYYY-MM-DD');
    await sel.selectOption('DD-MM-YYYY');
    await expect.poll(() => m.puts.length).toBe(1);
    expect(m.puts[0]).toEqual({ date_style: 'DD-MM-YYYY' });
    await expect(cam(page).locator('[data-osd-msg]')).toContainText('סירב');
    await expect(sel).toBeEnabled();
    await expect(sel).toHaveValue('YYYY-MM-DD');
    await expect(cam(page).locator('[data-osd-msg]')).toHaveAttribute('data-osd-outcome', 'refused');
    // an accepted change shows the new format (read back from the NVR)
    m.mode = 'ok';
    await sel.selectOption('DD-MM-YYYY');
    await expect.poll(() => m.puts.length).toBe(2);
    await expect(cam(page).locator('[data-osd-msg]')).toContainText('נכתב למקליט');
    await expect(sel).toHaveValue('DD-MM-YYYY');
  });

  test('a write whose answer was lost says "unknown", re-reads the NVR and sends nothing again', async ({ page }) => {
    const m = await installCamera(page);
    await openOsd(page);
    const sw = cam(page).locator('[data-osd-name-enabled]');
    const btn = sw.locator('button');
    for (const mode of ['unknown', 'abort'] as const) {
      m.mode = mode;
      const before = { puts: m.puts.length, gets: m.gets };
      await btn.click();
      await expect.poll(() => m.puts.length).toBe(before.puts + 1);
      const msg = cam(page).locator('[data-osd-msg]');
      await expect(msg).toContainText('לא ידוע');
      await expect(msg).not.toContainText('נכשל');
      await expect.poll(() => m.gets).toBeGreaterThan(before.gets); // the switch shows what the NVR reports now
      await expect(msg).toHaveAttribute('data-osd-outcome', 'unknown');
      await expect(btn).toBeEnabled();
      await expect(btn).toHaveAttribute('aria-checked', 'false');
      await page.waitForTimeout(500);
      expect(m.puts.length, 'never re-sent').toBe(before.puts + 1);
    }
  });

  test('one press writes once, even when pressed again while the write is on its way', async ({ page }) => {
    const m = await installCamera(page);
    m.mode = 'slow';
    await openOsd(page);
    const btn = cam(page).locator('[data-osd-name-enabled] button');
    await btn.click();
    await btn.click({ force: true }).catch(() => undefined); // a second tap while the first write is on its way
    await cam(page).locator('[data-osd-name-enabled]').locator('xpath=..').click({ force: true }).catch(() => undefined); // and a tap on the label text
    await expect(cam(page).locator('[data-osd-msg]')).toContainText('נכתב למקליט');
    expect(m.puts).toEqual([{ name_enabled: true }]);
    await expect(btn).toHaveAttribute('aria-checked', 'true');
  });
});

// ------------------------------------------------------------------------------------------------ schedules bulk (SCR-54)

const scr = (page: Page) => page.locator('sw-app devices-schedules');

async function openSchedules(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode: api/schedules-mock.ts answers
  await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.demo.schedules', JSON.stringify({}));
      localStorage.removeItem('sw.schedules.view');
      localStorage.removeItem('sw.schedules.filters');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto('/?design=a&sched_view=cards&page_size=5&fit=off#/devices/schedules');
  await appReady(page);
  await expect(scr(page).locator('[data-sched-grid]')).toBeVisible();
}

/** Walk the pages from the first one until the schedule is on screen; its `data-enabled`. */
async function enabledOf(page: Page, id: string): Promise<string | null> {
  const prev = scr(page).locator('[data-sched-pager] [data-pager-prev]');
  while (await prev.isEnabled()) await prev.click();
  for (;;) {
    const card = scr(page).locator(`article.acard[data-schedule="${id}"]`);
    if (await card.count()) return card.getAttribute('data-enabled');
    const next = scr(page).locator('[data-sched-pager] [data-pager-next]');
    if (!(await next.isEnabled())) return null;
    await next.click();
  }
}

test.describe('FIX-VIDEO-2570 schedules bulk (SCR-54)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
  });

  test('a schedule picked on another page is neither counted nor changed by the bulk bar', async ({ page }) => {
    await openSchedules(page);
    const s = scr(page);
    await expect(s.locator('article.acard')).toHaveCount(5);
    const first = s.locator('article.acard[data-enabled="true"]').first();
    const firstId = (await first.getAttribute('data-schedule'))!;
    await first.locator('input[data-select]').check();
    await expect(s.locator('[data-bulk-bar]')).toContainText('1 נבחרו');

    await s.locator('[data-sched-pager] [data-pager-next]').click();
    await expect(s.locator('[data-sched-pager] [data-pager-at]')).toHaveText(/^2 \/ \d+$/);
    await expect(s.locator(`article.acard[data-schedule="${firstId}"]`)).toHaveCount(0);
    const second = s.locator('article.acard[data-enabled="true"]').first();
    const secondId = (await second.getAttribute('data-schedule'))!;
    await second.locator('input[data-select]').check();
    await expect(s.locator('[data-bulk-bar]')).toContainText('1 נבחרו'); // the page-1 pick is not on screen: not counted
    await s.locator('[data-bulk-disable]').click();
    await expect(s.locator('[data-sched-note]')).toContainText('הושבתו 1');

    expect(await enabledOf(page, secondId)).toBe('false');
    expect(await enabledOf(page, firstId)).toBe('true'); // the schedule picked on page 1 was not touched
  });
});
