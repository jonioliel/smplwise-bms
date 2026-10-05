import { expect, type Page, type WebSocketRoute } from '@playwright/test';

// Shared by evidence-playback-stall.spec.ts and layout-playback-stall.spec.ts: the mocked backend for the 2.0.0 playback stall states
// (page.route on api/v1, page.routeWebSocket for the relay socket) and a stub of the player's media clock driven from the test.
const PERMS = ['video.live', 'video.playback', 'events.read', 'map.read'];
const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');

export interface MockState {
  creates: number;
  seeks: { id: string; start_at: string }[];
  groupCreates: number;
  groupSeeks: { start_at: string }[];
  closes: string[];
  seekFails: boolean;
  sockets: WebSocketRoute[];
}

export async function mock(page: Page, opts: { group?: boolean } = {}): Promise<MockState> {
  const now = Date.now();
  const from = iso(now - 30 * 60000);
  const to = iso(now - 2 * 60000);
  const st: MockState = { creates: 0, seeks: [], groupCreates: 0, groupSeeks: [], closes: [], seekFails: false, sockets: [] };
  const gens: Record<string, number> = {};
  const session = (id: string, cam: string, startAt: string) => ({
    id, camera_id: cam, generation: gens[id], state: 'playing', requested_at: startAt, actual_start_at: startAt, actual_end_at: null, media_anchor: null,
    time_precision: 'keyframe_limited', media_handle: `api/v1/playback/sessions/${id}/ws?generation=${gens[id]}`, expires_at: iso(now + 600000),
    capabilities: { seek: true, pause: true, frame_step: true, supported_speeds: [0.25, 0.5, 1] }, playback_end_at: to,
  });
  const cam = (id: string, name: string, order: number) => ({ id, recorder_id: 'r', channel: order + 1, name, name_source: 'nvr', alias: null, enabled: true, sort_order: order, grid_col_span: 1, main_track: 101 + order * 100, sub_track: 102 + order * 100, status: 'online', last_seen_at: null, can_view_live: true });
  await page.routeWebSocket(/playback\/sessions\/.+\/ws/, (ws) => {
    st.sockets.push(ws); // held open, never connected to a server: the test drives the player's clock itself
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u1', username: 'u1', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'תפקיד', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem', 'playback.stall_s': 2, 'playback.auto_resume_attempts': 2, 'playback.diagnostics': 'all' }, can_edit: false });
    if (p === 'cameras') return json({ cameras: [cam('c1', 'כניסה', 0), cam('c2', 'חניה', 1)], recorder: null, can_sync: false });
    if (/^cameras\/c\d\/recordings/.test(p)) return json({ camera_id: p.split('/')[1], from, to, track_id: 101, segments: [{ start_at: from, end_at: to, kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' }], coverage: 'complete', matches: 1, pages: 1, searched_at: from, timezone: 'Asia/Jerusalem', note: '' });
    if (p === 'playback/sessions' && req.method() === 'POST') {
      st.creates += 1;
      const id = `s${st.creates}`;
      gens[id] = 1;
      const body = req.postDataJSON() as { camera_id: string; start_at: string };
      return json(session(id, body.camera_id, body.start_at));
    }
    const seek = p.match(/^playback\/sessions\/(s\d+)\/seek$/);
    if (seek) {
      const body = req.postDataJSON() as { start_at: string };
      st.seeks.push({ id: seek[1], start_at: body.start_at });
      if (st.seekFails) return json({ code: 'upstream_unavailable', user_message: 'שרת הווידאו לא זמין (בדיקה)', retryable: true, correlation_id: '', details: {} }, 503);
      gens[seek[1]] += 1;
      return json(session(seek[1], 'c1', body.start_at));
    }
    if (p === 'playback/groups' && req.method() === 'POST') {
      st.groupCreates += 1;
      const body = req.postDataJSON() as { camera_ids: string[]; start_at: string };
      gens.ga = 1;
      gens.gb = 1;
      return json({ id: 'g1', requested_at: body.start_at, generation: 1, sessions: [session('ga', body.camera_ids[0], body.start_at), session('gb', body.camera_ids[1], body.start_at)], missing: {}, sync: 'best_effort' });
    }
    if (p === 'playback/groups/g1/seek') {
      const body = req.postDataJSON() as { start_at: string };
      st.groupSeeks.push({ start_at: body.start_at });
      gens.ga += 1;
      gens.gb += 1;
      return json({ id: 'g1', requested_at: body.start_at, generation: gens.ga, sessions: [session('ga', 'c1', body.start_at), session('gb', 'c2', body.start_at)], missing: {}, sync: 'best_effort' });
    }
    if (p.startsWith('playback/groups/g1/sync')) return json({ ok: true, sync_report: null });
    if (req.method() === 'DELETE' && p.startsWith('playback/')) {
      st.closes.push(p);
      return json({ ok: true });
    }
    if (p.includes('events')) return json({ events: [] });
    if (p.startsWith('cases/bookmarks')) return json({ bookmarks: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p.includes('/frame')) return route.fulfill({ status: 404, body: '' });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __mt: number; __adv: boolean };
    w.__mt = 0;
    w.__adv = false;
    setInterval(() => {
      if (w.__adv) w.__mt += 0.25;
    }, 250);
  });
  return st;
}

/** The players' media clock comes from window.__mt (per tile: window.__mtc[cam] when set) and they report "playing". */
export async function fakePlay(page: Page) {
  for (const el of await page.locator('investigate-playback sw-live-player').all()) {
    await el.evaluate((p) => {
      const host = p as HTMLElement & { status: string; __fake?: boolean };
      if (!host.__fake) {
        Object.defineProperty(host, 'mediaTime', {
          configurable: true,
          get: () => {
            const w = window as unknown as { __mt: number; __mtc?: Record<string, number> };
            return w.__mtc?.[host.dataset.camera ?? ''] ?? w.__mt;
          },
        });
        host.__fake = true;
      }
      host.status = 'playing';
      host.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'playing', transport: 'mse' }, bubbles: true, composed: true }));
    });
  }
}

export const stage = (page: Page) => page.locator('investigate-playback .stage');
export const overlay = (page: Page) => page.locator('investigate-playback .stage .stall');
export const setAdv = (page: Page, on: boolean) => page.evaluate((v) => ((window as unknown as { __adv: boolean }).__adv = v), on);

export async function openAndPlay(page: Page, hashQuery = '', urlQuery = 'design=a') {
  const at = iso(Date.now() - 20 * 60000);
  await page.goto('about:blank');
  await page.goto(`/?#/investigate/playback?camera=c1&t=${at}${hashQuery}`);
  await expect(page.locator('investigate-playback sw-live-player').first()).toBeAttached({ timeout: 20000 });
  await fakePlay(page);
  await setAdv(page, true);
  await page.waitForTimeout(1500);
  await expect(stage(page)).toHaveAttribute('data-stall-phase', 'ok');
}

