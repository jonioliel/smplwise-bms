import { test, expect, type Page } from '@playwright/test';
import { FAKE_MEDIA, type LiveSocketEntry, type RtcMode } from './live-fake-media';

// Owner decision 2026-10-05: the system's default video transport prefers WebRTC always and falls back to MSE only when
// WebRTC cannot be used; the fallback is fast (a bounded connect attempt) and quiet (no error flashes, no retry loop of a
// WebRTC known to be unreachable), and the administrator may still choose WebRTC only or MSE only per installation.
// Checked here on the mocked backend (the built app; tests/live-fake-media.ts fakes the relay socket and the peer
// connection):
//   - an installation that never stored a transport (the server now answers `auto`, and a settings read without the key
//     falls back to `auto` too): WebRTC plays and no MSE socket is ever opened;
//   - `auto` with WebRTC that never connects (UDP blocked): MSE within the connect bound (WEBRTC_CONNECT_MS = 5 s);
//   - the tab then remembers WebRTC as unreachable: the next `auto` players start on MSE at once, with no WebRTC attempt,
//     and WebRTC is probed again once the memory expired;
//   - `auto` with a stream that connects but does not decode: MSE after the decode grace, remembered per camera (24 h),
//     while the tab memory stays empty (a per-camera fact, not a network fact);
//   - WebRTC only: never MSE, even when WebRTC never connects; MSE only: never a WebRTC attempt;
//   - the settings screen names the three choices in Hebrew, with automatic as the default and "MSE בלבד" deliberate.
// What it does not prove: real ICE timing on the lab (NOT_RUN in this spec; the connect bound is reasoned in the player).

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

type Transport = 'webrtc' | 'auto' | 'mse';

interface Setup {
  /** the installation default; `undefined` leaves the key out of GET /settings (a settings read without the key) */
  transport?: Transport | (() => Transport | undefined);
  rtc: Record<string, RtcMode>;
  /** `sw.live.webrtc_down` (sessionStorage) left over, ms ago */
  downAgoMs?: number;
  /** `sw.live.works` (0.1.148 per-camera memory) */
  works?: Record<string, { step: string; at: number }>;
  canEdit?: boolean;
}

const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };

async function setup(page: Page, o: Setup) {
  await page.addInitScript(
    (x) => {
      const w = window as unknown as Record<string, unknown>;
      w.__rtc = x.rtc;
      localStorage.setItem('sw.wall.count', '4');
      localStorage.removeItem('sw.wall.quality');
      localStorage.removeItem('sw.transport');
      if (x.works) localStorage.setItem('sw.live.works', JSON.stringify(x.works));
      else localStorage.removeItem('sw.live.works');
      if (x.downAgoMs != null) sessionStorage.setItem('sw.live.webrtc_down', String(Date.now() - x.downAgoMs));
      else sessionStorage.removeItem('sw.live.webrtc_down');
    },
    { rtc: o.rtc, works: o.works ?? null, downAgoMs: o.downAgoMs ?? null },
  );
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = o.canEdit ? ['video.live', 'system.configure'] : ['video.live'];
      return json({
        user: { id: 'u', username: 'owner', display_name: 'Owner', source: 'ingress' },
        channel: 'local',
        remote: null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'cameras') {
      const cams = [
        { id: 'c2', recorder_id: 'r', channel: 2, name: 'Street', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING },
        { id: 'c3', recorder_id: 'r', channel: 3, name: 'Yard', name_source: 'nvr', alias: null, enabled: true, sort_order: 1, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING },
      ];
      return json({ cameras: cams, recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') {
      const t = typeof o.transport === 'function' ? o.transport() : o.transport;
      const settings: Record<string, unknown> = { 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': 'false', 'snapshots.max_age_s': 60, 'ui.kiosk_cols': 2, 'ui.kiosk_rows': 2 };
      if (t) settings['media.transport_default'] = t;
      return json({ settings, can_edit: !!o.canEdit });
    }
    if (p === 'media/streams') return json({ go2rtc: {}, streams: [], foreign_streams: 0 });
    if (p === 'media/sessions') return json({ sessions: [], max_live_sessions: 16 });
    if (p === 'health' || p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const entries = (page: Page) => page.evaluate(() => (window as unknown as { __liveSockets: LiveSocketEntry[] }).__liveSockets.map((e) => ({ ...e })));
const sockets = async (page: Page) => (await entries(page)).map(({ profile, kind }) => `${profile}:${kind}`);
const kinds = async (page: Page) => [...new Set((await sockets(page)).map((s) => s.split(':')[1]).filter(Boolean))].sort();
const tabMemory = (page: Page) => page.evaluate(() => sessionStorage.getItem('sw.live.webrtc_down'));
const cameraMemory = (page: Page) => page.evaluate(() => localStorage.getItem('sw.live.works'));
const playerState = (page: Page, sel: string) => page.locator(sel).evaluate((p) => ({ status: (p as unknown as { status: string }).status, transport: (p as unknown as { transport: string }).transport }));

const cameraPage = async (page: Page, id = 'c2') => {
  await page.goto(`/?design=a#/live/cameras/${id}`);
  await page.waitForSelector('sw-app');
  await expect(page.locator('live-camera sw-live-player')).toHaveCount(1, { timeout: 15000 });
};
const wallPage = async (page: Page) => {
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await expect(page.locator('live-wall sw-camera-tile[data-cam="c2"] sw-live-player')).toHaveCount(1, { timeout: 15000 });
};

test.describe('WebRTC first, MSE only when WebRTC cannot be used (owner decision 2026-10-05)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
  });

  test('an installation that never stored a transport (no key in the settings read): WebRTC plays, no MSE socket', async ({ page }) => {
    await setup(page, { transport: undefined, rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await expect.poll(() => playerState(page, 'live-camera sw-live-player').then((s) => s.status), { timeout: 20000 }).toBe('playing');
    expect((await playerState(page, 'live-camera sw-live-player')).transport).toBe('webrtc');
    await page.waitForTimeout(1500);
    expect(await kinds(page), `sockets: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
    expect(await tabMemory(page)).toBeNull();
    // the camera page's own transport control shows the installation choice as automatic
    await expect(page.locator('live-camera .transport button.on')).toHaveText('אוטומטי');
  });

  test('the server default `auto` on the wall: every tile over WebRTC, no MSE socket', async ({ page }) => {
    await setup(page, { transport: 'auto', rtc: { main: 'ok', sub: 'ok' } });
    await wallPage(page);
    await expect.poll(() => playerState(page, 'live-wall sw-camera-tile[data-cam="c2"] sw-live-player').then((s) => s.status), { timeout: 20000 }).toBe('playing');
    await expect.poll(() => playerState(page, 'live-wall sw-camera-tile[data-cam="c3"] sw-live-player').then((s) => s.status), { timeout: 20000 }).toBe('playing');
    await page.waitForTimeout(1500);
    expect(await kinds(page), `sockets: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });

  test('auto, WebRTC never connects (UDP blocked): MSE within the connect bound, quietly, and the tab remembers', async ({ page }) => {
    await setup(page, { transport: 'auto', rtc: { main: 'hang', sub: 'hang' } });
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 9000 }).toContain('mse');
    const all = await entries(page);
    const rtc = all.find((e) => e.kind === 'webrtc');
    const mse = all.find((e) => e.kind === 'mse');
    expect(rtc && mse, `sockets: ${(await sockets(page)).join(', ')}`).toBeTruthy();
    const waited = mse!.at - rtc!.negotiatedAt;
    expect(waited, `the player gave ICE ${Math.round(waited)} ms before MSE`).toBeGreaterThanOrEqual(4500);
    expect(waited).toBeLessThan(7500);
    // quiet: the player went straight on connecting (no error state in between), one WebRTC attempt only
    expect((await playerState(page, 'live-camera sw-live-player')).status).toBe('connecting');
    expect((await sockets(page)).filter((s) => s.endsWith(':webrtc'))).toHaveLength(1);
    await expect(page.locator('live-camera sw-live-player [data-player-error]')).toHaveCount(0);
    // the tab memory carries it; the camera is not pinned to MSE for a day
    expect(await tabMemory(page)).not.toBeNull();
    expect(await cameraMemory(page)).toBeNull();
  });

  test('while the tab remembers WebRTC as unreachable, the next auto players start on MSE without a WebRTC attempt', async ({ page }) => {
    await setup(page, { transport: 'auto', rtc: { main: 'ok', sub: 'ok' }, downAgoMs: 60 * 1000 });
    await wallPage(page);
    await expect.poll(() => kinds(page), { timeout: 10000 }).toContain('mse');
    await page.waitForTimeout(1500);
    expect(await kinds(page), `sockets: ${(await sockets(page)).join(', ')}`).toEqual(['mse']);
    // nothing per camera was written: the memory is the tab's, and expires on its own
    expect(await cameraMemory(page)).toBeNull();
  });

  test('once the tab memory expired, WebRTC is probed again (and forgotten for good when it plays)', async ({ page }) => {
    await setup(page, { transport: 'auto', rtc: { main: 'ok', sub: 'ok' }, downAgoMs: 11 * 60 * 1000 });
    await cameraPage(page);
    await expect.poll(() => playerState(page, 'live-camera sw-live-player').then((s) => s.status), { timeout: 20000 }).toBe('playing');
    expect((await sockets(page))[0]).toBe('main:webrtc');
    expect(await kinds(page)).toEqual(['webrtc']);
    expect(await tabMemory(page)).toBeNull();
  });

  test('auto, the main stream connects but does not decode: MSE after the decode grace, remembered per camera, not per tab', async ({ page }) => {
    await setup(page, { transport: 'auto', rtc: { main: 'nodecode', sub: 'ok' } });
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 20000 }).toContain('mse');
    expect((await sockets(page)).slice(0, 2)).toEqual(['main:webrtc', 'main:mse']);
    expect(await tabMemory(page)).toBeNull();
  });

  test('WebRTC only: never MSE, even when WebRTC never connects; no tab memory', async ({ page }) => {
    await setup(page, { transport: 'webrtc', rtc: { main: 'hang', sub: 'hang' } });
    await cameraPage(page);
    await page.waitForTimeout(8000);
    expect(await kinds(page), `sockets: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
    expect(await tabMemory(page)).toBeNull();
    await expect(page.locator('live-camera .transport button.on')).toHaveText('WebRTC');
  });

  test('MSE only: no WebRTC attempt at all, even where WebRTC would work', async ({ page }) => {
    await setup(page, { transport: 'mse', rtc: { main: 'ok', sub: 'ok' } });
    await wallPage(page);
    await expect.poll(() => kinds(page), { timeout: 10000 }).toContain('mse');
    await page.waitForTimeout(1500);
    expect(await kinds(page), `sockets: ${(await sockets(page)).join(', ')}`).toEqual(['mse']);
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 10000 }).toEqual(['mse']);
    await expect(page.locator('live-camera .transport button.on')).toHaveText('MSE');
  });

  test('the settings screen: automatic is the default and named first, "MSE בלבד" is a deliberate choice', async ({ page }) => {
    await setup(page, { transport: undefined, rtc: {}, canEdit: true });
    await page.goto('/?design=a#/system/diagnostics?tab=media');
    const select = page.locator('system-diagnostics [data-set-transport-default]');
    await expect(select).toBeVisible({ timeout: 20000 });
    await expect(select).toHaveValue('auto');
    const labels = await select.locator('option').allTextContents();
    expect(labels.map((l) => l.trim())).toEqual(['אוטומטי (WebRTC, ואם אינו זמין MSE) — ברירת המחדל', 'WebRTC בלבד', 'MSE בלבד']);
    await expect(page.locator('system-diagnostics')).toContainText('MSE בלבד: בחירה מכוונת');
  });

  test('the settings screen shows a stored MSE choice as what it is (kept by the migration)', async ({ page }) => {
    await setup(page, { transport: 'mse', rtc: {}, canEdit: true });
    await page.goto('/?design=a#/system/diagnostics?tab=media');
    const select = page.locator('system-diagnostics [data-set-transport-default]');
    await expect(select).toBeVisible({ timeout: 20000 });
    await expect(select).toHaveValue('mse');
  });
});
