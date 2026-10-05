import type { Page } from '@playwright/test';

// LV1 mock layer: a wall with 24 visible cameras across two recorders, plus cameras the wall must NOT count: a disabled camera and the
// cameras of a disabled recorder (CR-024). No backend; snapshots only (can_view_live=false: no relay, no WebRTC).
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
export const VISIBLE = 24;
export const R1 = 10; // recorder "NVR 1"
export const R2 = 14; // recorder "NVR 2"

export async function mockWall(page: Page, opts: { count?: string | null; cols?: string | null } = {}): Promise<void> {
  await page.addInitScript((o) => {
    try {
      // only a first load: a reload keeps what the page itself saved
      if (o.count && localStorage.getItem('sw.wall.count') === null) localStorage.setItem('sw.wall.count', o.count);
      if (o.cols && localStorage.getItem('sw.wall.cols') === null) localStorage.setItem('sw.wall.cols', o.cols);
    } catch {
      /* private mode */
    }
  }, opts);
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({ user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'cameras') {
      const mk = (i: number, recorder: string, extra: Record<string, unknown> = {}) => ({
        id: `c${i + 1}`, recorder_id: recorder, channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: false, recorder_enabled: true, encoding: { main: { codec: 'H.264', webrtc: 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } }, ...extra,
      });
      const cameras = [
        ...Array.from({ length: R1 }, (_, i) => mk(i, 'r1')),
        ...Array.from({ length: R2 }, (_, i) => mk(R1 + i, 'r2')),
        mk(90, 'r1', { id: 'off1', enabled: false }),
        ...Array.from({ length: 4 }, (_, i) => mk(100 + i, 'r3', { id: `dis${i}`, recorder_enabled: false })),
      ];
      return json({ cameras, recorder: null, recorders: [{ id: 'r1', name: 'NVR 1' }, { id: 'r2', name: 'NVR 2' }], can_sync: false, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: false });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

/** Opens the wall and waits until it renders `expectTiles` camera tiles (the tiles live inside nested shadow roots). */
export async function openWall(page: Page, expectTiles: number): Promise<void> {
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await page.locator('live-wall sw-camera-tile[data-cam]').first().waitFor({ timeout: 20000 });
  await page.waitForFunction(
    (n) => {
      const find = (root: Document | ShadowRoot): Element | null => {
        const hit = root.querySelector('live-wall');
        if (hit) return hit;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const r = el.shadowRoot && find(el.shadowRoot);
          if (r) return r;
        }
        return null;
      };
      return find(document)?.shadowRoot?.querySelectorAll('sw-camera-tile[data-cam]').length === n;
    },
    expectTiles,
    { timeout: 20000 },
  );
}
