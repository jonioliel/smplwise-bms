import { test, expect, type Page, type Route } from '@playwright/test';

// LIVECAM-DRAFT-RESET-2435 (code review 2026-11-13, LC-1 / LC-2): the shell re-uses <live-camera> when only the camera id in the route
// changes. A draft opened on camera A (the motion grid here) must never be written to camera B, a late answer for A must never be drawn
// on B, and the manual-recording poll must stop when the screen is left. Mocked API only (invented cameras, no device is contacted).

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PERMS = ['video.live', 'media.read', 'devices.read', 'nvr.config.detection'];

const CAMERAS = [1, 2].map((n) => ({
  id: `cam-${n}`, recorder_id: 'r1', channel: n, name: ['כניסה', 'חניה'][n - 1], name_source: 'nvr', alias: null, enabled: true, sort_order: n, grid_col_span: 1,
  main_track: n * 100 + 1, sub_track: n * 100 + 2, status: 'online', last_seen_at: '2026-11-13T10:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 },
  encoding: null, can_view_live: true,
}));

/** Camera 1 senses at 40, camera 2 at 80: the motion chip says which camera's NVR answer is on screen. */
const zones = (id: string) => ({
  camera_id: id, channel: id === 'cam-1' ? 1 : 2, source: 'nvr', read_only: true, write_reason: '', can_edit_motion: true, sensitivity_caps: { min: 0, max: 100, step: 20 },
  fetched_at: '2026-11-13T10:00:00Z', cached: false,
  motion: { enabled: true, region_type: 'grid', sensitivity: id === 'cam-1' ? 40 : 80, rows: 2, cols: 2, cells: [[false, false], [false, false]], coverage_pct: 0, target_types: [] },
  privacy_mask: null, intrusion: null, line_crossing: null, unsupported: {},
});

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  /** Delay (ms) of the zones answer per camera. */
  zonesDelay: Record<string, number>;
  /** Camera ids with a manual recording running. */
  recording: Set<string>;
}

async function install(page: Page): Promise<Mock> {
  const m: Mock = { calls: [], zonesDelay: {}, recording: new Set() };
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    m.calls.push({ method, path: p, body: method === 'GET' ? null : req.postDataJSON() });
    if (p === 'me') return json(route, { user: { id: 'u-lc', username: 'lc', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: CAMERAS, recorders: [{ id: 'r1', name: 'NVR' }], recorder: { id: 'r1', name: 'NVR', model: null, firmware: null, last_seen_at: null }, can_sync: false });
    if (/^cameras\/[^/]+\/snapshot/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    const zm = /^cameras\/([^/]+)\/zones$/.exec(p);
    if (zm) {
      const delay = m.zonesDelay[zm[1]] ?? 0;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return json(route, zones(zm[1])).catch(() => undefined);
    }
    const mm = /^cameras\/([^/]+)\/motion$/.exec(p);
    if (mm && method === 'PUT') return json(route, { id: 'chg-0000000001', status: 'applied' });
    const rm = /^cameras\/([^/]+)\/record$/.exec(p);
    if (rm) {
      const active = m.recording.has(rm[1]) ? { camera_id: rm[1], started_at: '2026-11-13T10:00:00Z', stop_at: '2026-11-13T10:30:00Z', remaining_s: 1500, minutes: 30 } : null;
      return json(route, { camera_id: rm[1], active, can_write: true, max_minutes: 120, track_id: 101 });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return m;
}

const screen = (page: Page) => page.locator('sw-app live-camera');

async function openCamera(page: Page, id: string) {
  await page.goto(`/?design=a#/live/cameras/${id}`);
  await page.waitForSelector('sw-app');
  await expect(screen(page).locator('[data-camera-settings]')).toBeVisible({ timeout: 20_000 });
}

/** The settings accordion and its zones row (a camera change re-draws the screen, so both start closed again). */
async function openZones(page: Page) {
  await expect(screen(page).locator('[data-camera-settings]')).toBeVisible({ timeout: 20_000 });
  await screen(page).locator('[data-camera-settings] > summary').click();
  await screen(page).locator('[data-acc-zones] > summary').click();
}

const switchTo = (page: Page, id: string) => page.evaluate((cam) => { location.hash = `#/live/cameras/${cam}`; }, id);
const motionChip = (page: Page) => screen(page).locator('[data-zone-layer="motion"]');
const motionWrites = (m: Mock) => m.calls.filter((c) => c.method === 'PUT' && /\/motion$/.test(c.path));

test.describe('live camera: switching the camera in place', () => {
  test('a motion grid drawn on camera A is closed on the switch and never written to camera B', async ({ page }) => {
    const m = await install(page);
    await openCamera(page, 'cam-1');
    await openZones(page);
    await expect(motionChip(page)).toContainText('רגישות 40');
    await screen(page).locator('[data-motion-edit]').click();
    const cell = screen(page).locator('[data-motion-cell="0-0"]');
    await cell.dispatchEvent('pointerdown', { button: 0 });
    await cell.dispatchEvent('pointerup');
    await expect(screen(page).locator('[data-motion-save]')).not.toHaveAttribute('disabled', '');

    await switchTo(page, 'cam-2');
    await openZones(page);
    await expect(motionChip(page)).toContainText('רגישות 80');
    // whatever save is still offered on B is pressed through: it must not carry A's draft to B
    const save = screen(page).locator('[data-motion-save]');
    if (await save.count()) {
      await save.click();
      await screen(page).locator('[data-motion-confirm-run]').click();
      await page.waitForTimeout(500);
    }
    expect(motionWrites(m), 'no motion write after the switch').toEqual([]);
    await expect(screen(page).locator('[data-motion-editor]')).toHaveCount(0);
    await expect(screen(page).locator('[data-motion-edit]')).toBeVisible(); // B's own grid can still be edited
  });

  test('a late zones answer for camera A is not drawn on camera B', async ({ page }) => {
    const m = await install(page);
    m.zonesDelay['cam-1'] = 2500;
    await openCamera(page, 'cam-1');
    await expect.poll(() => m.calls.some((c) => c.path === 'cameras/cam-1/zones')).toBe(true);
    await switchTo(page, 'cam-2'); // A's answer is still on its way
    await openZones(page);
    await page.waitForTimeout(3000); // A's answer has landed by now
    await expect(motionChip(page)).toContainText('רגישות 80');
    await expect(motionChip(page)).not.toContainText('רגישות 40');
    expect(m.calls.some((c) => c.path === 'cameras/cam-2/zones'), 'B read its own zones').toBe(true);
  });

  test('the manual-recording poll runs on the screen and stops when the screen is left', async ({ page }) => {
    await page.clock.install();
    const m = await install(page);
    m.recording.add('cam-1');
    await openCamera(page, 'cam-1');
    const reads = () => m.calls.filter((c) => c.path === 'cameras/cam-1/record').length;
    await expect.poll(reads).toBeGreaterThan(0);
    const first = reads();
    await page.clock.runFor(16_000);
    await expect.poll(reads).toBeGreaterThan(first); // polled every 15 s while the recording runs
    await page.evaluate(() => { location.hash = '#/live/views'; });
    await expect(screen(page)).toHaveCount(0);
    const left = reads();
    await page.clock.runFor(46_000);
    await page.waitForTimeout(300);
    expect(reads(), 'no record read after leaving the screen').toBe(left);
  });
});
