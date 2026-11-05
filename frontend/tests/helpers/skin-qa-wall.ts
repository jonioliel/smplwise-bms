import { expect, type Page } from '@playwright/test';
import { FAKE_MEDIA } from '../live-fake-media';
import { over, parseRgba, ratio } from './skin-qa-probe';

// SKIN-QA-2403 / SKIN-QA-FOLLOWUP-2404: the camera wall of the skin x scheme specs - 4 live cameras over the drawn video of
// tests/live-fake-media.ts, cameras c1 and c2 remembered as "sub gives nothing" (they open on main and carry the fallback tag), and the
// facts of a tile's tag (its box, every other overlay on the tile, its worst-case contrast). Mocked backend only.

export type Scheme = 'light' | 'dark';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };
export const CAMS = 4;

/** The wall with 4 live cameras (drawn video, tests/live-fake-media.ts); cameras c1 and c2 are remembered as "sub gives nothing", so they
 * open on main and carry the tag. `bar` = the installation's ui.wall_phone_bar; `cols` = the columns chosen on this device (0 = auto). */
export async function openWall(page: Page, skin: string, scheme: Scheme, o: { bar?: 'icons' | 'labels'; cols?: number; channel?: 'local' | 'remote'; names?: Record<string, string>; still?: boolean } = {}) {
  const channel = o.channel ?? 'local';
  await page.addInitScript(
    (x) => {
      try {
        localStorage.setItem('sw.wall.count', '4');
        localStorage.removeItem('sw.wall.quality');
        if (x.cols) localStorage.setItem('sw.wall.cols', String(x.cols));
        else localStorage.removeItem('sw.wall.cols');
        localStorage.removeItem('sw.live.works');
        const now = Date.now();
        sessionStorage.setItem('sw.live.sub_down', JSON.stringify({ c1: now, c2: now }));
      } catch {
        /* storage unavailable */
      }
      (window as unknown as Record<string, unknown>).__rtc = x.still ? { sub: 'still', main: 'still' } : { sub: 'ok', main: 'ok' };
    },
    { cols: o.cols ?? 0, still: !!o.still },
  );
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live', 'sources.configure'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: channel === 'remote' ? 'remote' : 'ingress' },
        channel,
        remote: channel === 'remote' ? { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': 'main', 'remote.mse_fallback': 'true' } : null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'media/video-policy') return json({ choice: 'webrtc', source: 'installation', explicit: true, installation: 'webrtc', personal: null, channel, order: ['webrtc'], remote: channel === 'remote' ? { default_profile: 'main', mse_fallback: true } : null });
    if (p === 'cameras') {
      const cameras = Array.from({ length: CAMS }, (_, i) => ({
        id: `c${i + 1}`, recorder_id: 'r', channel: i + 1, name: o.names?.[`c${i + 1}`] ?? `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING,
      }));
      return json({ cameras, recorder: null, can_sync: true, media: {} });
    }
    if (p === 'settings') {
      return json({ settings: { 'media.transport_default': 'webrtc', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': 'false', 'snapshots.max_age_s': 60, 'remote.max_live_streams': 16, 'remote.wall_profile': 'sub', 'remote.mse_fallback': 'true', 'ui.wall_phone_bar': o.bar ?? 'icons' }, can_edit: false });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-04T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#/live/wall`);
  await page.waitForSelector('live-wall');
  await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
  await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
  await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(CAMS, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** The tag of a tile: its box, the tile's, every other overlay drawn on the tile, and its contrast (rendered, and the worst case: the
 * scrim over a pure white / black picture). */
export async function tagFacts(page: Page, cam: string) {
  const tag = page.locator(`live-wall sw-camera-tile[data-cam="${cam}"] sw-live-player [data-sub-fallback]`);
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.locator(`live-wall sw-camera-tile[data-cam="${cam}"] sw-live-player`).evaluate((p) => (p as unknown as { status: string }).status), { timeout: 20_000 }).toBe('playing');
  const f = await tag.evaluate((el) => {
    const player = (el.getRootNode() as ShadowRoot).host as HTMLElement;
    const tile = (player.getRootNode() as ShadowRoot).host as HTMLElement;
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const others = [
      ...[...(player.shadowRoot?.querySelectorAll('.status, .vbadge, .h265tag, .plan, .served, .mute, .vnotice, .tap') ?? [])],
      ...[...(tile.shadowRoot?.querySelectorAll('.label, .demo, .pill, .stamp, .meta') ?? [])],
    ].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ cls: e.className, ...box(e) }));
    const cs = getComputedStyle(el);
    return { tag: box(el), tile: box(tile), others, color: cs.color, bg: cs.backgroundColor, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), text: el.textContent ?? '' };
  });
  const overlaps = f.others.filter((o) => o.x < f.tag.r && o.r > f.tag.x && o.y < f.tag.b && o.b > f.tag.y).map((o) => o.cls);
  const fg = parseRgba(f.color);
  const scrim = parseRgba(f.bg);
  const worst = Math.min(...[[255, 255, 255], [0, 0, 0], [128, 128, 128]].map((pic) => {
    const bg = over(scrim, pic);
    return ratio(over(fg, bg), bg);
  }));
  return { ...f, overlaps, worst: Math.round(worst * 100) / 100 };
}
