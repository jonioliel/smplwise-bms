import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_ALARM } from '../src/fixtures/alarm-demo';

// CR-020 S1 evidence: הגדרות › אבטחה › מצלמות - the read-only table of every stream's video settings. Two kinds of runs:
//  - API mode against a mocked backend (page.route on api/v1, like evidence-security-r1.spec.ts): the real HTTP adapter and the
//    real screen get the answers of GET /nvr/cameras and /nvr/recorders - ready (a lab-shaped ten-camera NVR), the device
//    unreachable with the last readings, the device unreachable with nothing known, empty, loading, forbidden, NVR-less - plus
//    the tab's permission gate. The server's own checks are backend tests/test_nvr_cameras_settings.py.
//  - DEMO mode (no backend): the in-memory demo answers, the screen works the same.
// Lab-shaped data only (structure of the 2026-09-14 probe, generic values); no address, serial or MAC anywhere.
//   npx vite --host 127.0.0.1 --port 5210   then
//   SW_BASE_URL=http://127.0.0.1:5210/ SW_SHOTS=../docs/evidence/CR-020-s1 npx playwright test evidence-nvr-cameras --project=desktop --workers=1
// One project only: the spec sets the three widths itself (1440 / 820 / 390, light - settings has no dark mode).
const SHOTS = process.env.SW_SHOTS ?? '';
const SIZES = [
  { name: '1440', w: 1440, h: 900 },
  { name: '820', w: 820, h: 1180 },
  { name: '390', w: 390, h: 844 },
] as const;

const OPERATOR = ['video.live', 'devices.read', 'alarm.view'];
const ADMIN = [...OPERATOR, 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'sources.configure', 'rbac.assign'];

type Mode = 'ready' | 'empty' | 'stale' | 'down' | 'forbidden' | 'none' | 'slow';

interface Mock {
  perms: string[];
  mode: Mode;
  /** requests the screen made, by path */
  hits: string[];
  /** non-GET requests (must stay empty: S1 never writes) */
  writes: string[];
  mePerms?: string[];
}

// ---------------------------------------------------------------- lab-shaped data

type Stream = Record<string, unknown>;

function stream(ref: string, role: string, v: Partial<Stream> = {}): Stream {
  const s = {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: null, resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: null, smart_codec: false, b_frames: null, webrtc: 'ok', webrtc_reason: 'h264',
    fields: { b_frames: { supported: false, editable: false } } as Record<string, unknown>, writable: false, not_writable_reason: 'read_only', etag: `${ref}etag`, ...v,
  };
  if (s.svc === null) s.fields.svc = { supported: false, editable: false };
  return s;
}

const NAMES = ['כניסה ראשית', 'חניה', 'חצר אחורית', 'לובי', 'מסדרון קומה 1', 'מחסן', 'גג', 'שער צדדי', 'קבלה', 'חדר שרתים'];

function labCameras(opts: { stale?: boolean } = {}) {
  return NAMES.map((name, i) => {
    const ch = i + 1;
    const h265 = [2, 5, 8].includes(ch); // the lab: three cameras are H.265 in both streams
    const main = h265
      ? stream(`${ch}01`, 'main', { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '2688x1520', bitrate_kbps: 4096, svc: false, smart_codec: true, codec_plus: true, webrtc: 'unknown', webrtc_reason: 'h265' })
      : stream(`${ch}01`, 'main', { resolution: '2560x1440', fps: null, fps_full: true, bitrate_kbps: 3072, svc: true, webrtc: 'unknown', webrtc_reason: 'svc', profile: ch % 2 ? 'High' : 'Main' });
    const sub = stream(`${ch}02`, 'sub', h265
      ? { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '640x360', fps: 20, bitrate_kbps: 512, svc: ch === 5 ? true : false, webrtc: 'unknown', webrtc_reason: 'h265' }
      : { resolution: '640x360', fps: 20, bitrate_kbps: 1024, profile: 'Baseline', webrtc_reason: 'h264_no_b_frames', gop: 40 });
    const streams = ch === 3 ? [main, sub, stream('303', 'third', { resolution: '1280x720', fps: 12, bitrate_kbps: 1536, bitrate_mode: 'CBR', gop: 24 })] : ch === 6 ? [] : [main, sub];
    const stale = opts.stale ? streams.map((s) => ({ ...s, etag: null, bitrate_mode: null, bitrate_kbps: null, quality: null, fields: {} })) : streams;
    return {
      camera_id: ch === 10 ? null : `cam-${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: ch !== 6 && ch !== 7, enabled_in_arx: ch !== 7, streams: stale,
      error: ch === 6 ? 'source_error' : null,
    };
  });
}

const RECORDER = {
  recorder_id: 'nvr-1', name: 'NVR ראשי', vendor: 'hikvision', model: 'DS-7616NI-DEMO', firmware: 'V4.84 demo', enabled: true, online: true, checked_at: '2026-10-01T09:00:00Z', error: null,
  capabilities: { read_encodings: true, write_encodings: false, add_channel: false, remove_channel: false, max_channels: null, used_channels: 10, encoding_fields: ['codec', 'svc'] },
};

const err = (code: string, user_message: string) => ({ code, user_message, retryable: false, correlation_id: '', details: {} });

async function install(page: Page, st: Mock) {
  await page.routeWebSocket(/\/api\/v1\/ha\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() !== 'GET') st.writes.push(`${req.method()} ${p}`);
    if (p === 'me') {
      const perms = st.mePerms ?? st.perms;
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: st.mode === 'none' ? 'ha_only' : 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {} }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 10, cameras_last_ok: '2026-10-01T08:00:00Z', cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ ...DEMO_ALARM, panels: DEMO_ALARM.panels.slice(0, 1), counts: { ...DEMO_ALARM.counts, panels: 1 } });
    if (p === 'alarm/config') return json({ panels: DEMO_ALARM.panels.slice(0, 1), excluded: [], overrides: [], candidates: { controls: [], sensors: [] }, integrations: {}, settings: {} });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    if (p === 'nvr/recorders' || p === 'nvr/cameras') {
      st.hits.push(p);
      if (!st.perms.includes('system.configure') || st.mode === 'forbidden') return json(err('forbidden', 'אין הרשאה לפעולה הזו.'), 403);
      if (st.mode === 'none') return json(err('nvr_not_configured', 'ההתקנה פועלת במצב ללא NVR.'), 409);
      if (p === 'nvr/recorders') return json({ recorders: [RECORDER], can_write: false });
      if (st.mode === 'slow') await new Promise((r) => setTimeout(r, 4000));
      if (st.mode === 'down') return json({ cameras: [], recorders_failed: ['nvr-1'], stale: true, error: 'source_unavailable', can_write: false });
      if (st.mode === 'empty') return json({ cameras: [], recorders_failed: [], stale: false, error: null, can_write: false });
      const stale = st.mode === 'stale';
      return json({ cameras: labCameras({ stale }), recorders_failed: stale ? ['nvr-1'] : [], stale, error: stale ? 'source_unavailable' : null, can_write: false });
    }
    return json(err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const PAGE = 'sw-app system-security system-security-cameras';
const ROWS = `${PAGE} tr[data-stream-row]`;
const hashOf = (page: Page) => page.evaluate(() => location.hash);

async function sizes(page: Page, name: string, ready: () => Promise<void>) {
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(250);
    await ready();
    await shot(page, `${name}-${s.name}`);
  }
  await page.setViewportSize({ width: SIZES[0].w, height: SIZES[0].h }); // back to the desktop table for the steps that follow
  await page.waitForTimeout(150);
}

test.describe('CR-020 S1 cameras table (mocked backend)', () => {
  let st: Mock;

  test.beforeEach(async ({ page }) => {
    st = { perms: ADMIN, mode: 'ready', hits: [], writes: [] };
    await install(page, st);
  });

  test.afterEach(() => {
    expect(st.writes, 'S1 never sends a write').toEqual([]);
  });

  test('ready: every stream of every camera, in channel order, with the lab values', async ({ page }) => {
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    await expect(page.locator(PAGE + ' sw-page')).toHaveAttribute('subheading', 'NVR ראשי · DS-7616NI-DEMO');
    // 10 cameras: eight with two streams, channel 3 with a third, channel 6 unreadable -> 19 streams + 1 placeholder row
    await expect(page.locator(ROWS)).toHaveCount(20);
    await expect(page.locator(`${PAGE} [data-nvr-count]`)).toHaveText('19 זרמים');
    const row = (ref: string) => page.locator(`${ROWS}[data-stream="${ref}"]`);
    const cell = (ref: string, col: string) => row(ref).locator(`td[data-col="${col}"]`);
    // an SVC main of the lab: H.264 High, SVC on, full frame rate, 3072 kbps VBR, GOP 50, WebRTC unknown (tried, not skipped)
    await expect(cell('101', 'role')).toHaveText('ראשי');
    await expect(cell('101', 'codec')).toHaveText('H.264 High');
    await expect(cell('101', 'svc')).toHaveText('פעיל');
    await expect(cell('101', 'resolution')).toHaveText('2560×1440');
    await expect(cell('101', 'fps')).toHaveText('מלא');
    await expect(cell('101', 'bitrate')).toHaveText('3072 kbps VBR');
    await expect(cell('101', 'gop')).toHaveText('50');
    await expect(cell('101', 'webrtc').locator('[data-verdict]')).toHaveAttribute('data-verdict', 'unknown');
    await expect(cell('101', 'webrtc').locator('[data-verdict]')).toHaveAttribute('aria-label', 'לא ידוע');
    // the sub stream of the same camera: no SVC element -> a dash (never "off"), plays
    await expect(cell('102', 'role')).toHaveText('משני');
    await expect(cell('102', 'svc')).toHaveText('—');
    await expect(cell('102', 'codec')).toHaveText('H.264 Baseline');
    await expect(cell('102', 'webrtc').locator('[data-verdict]')).toHaveAttribute('data-verdict', 'ok');
    // H.265+ (smart codec on) main, SVC off
    await expect(cell('201', 'codec')).toHaveText('H.265+ Main');
    await expect(cell('201', 'svc')).toHaveText('כבוי');
    // a third stream, CBR
    await expect(cell('303', 'role')).toHaveText('שלישי');
    await expect(cell('303', 'bitrate')).toHaveText('1536 kbps CBR');
    // the unreadable camera: one placeholder row, dashes, "לא נקרא"
    const unread = page.locator(`${ROWS}[data-camera="nvr-1:6"]`);
    await expect(unread).toHaveCount(1);
    await expect(unread.locator('[data-unread]')).toHaveText('לא נקרא');
    await expect(unread.locator('td[data-col="codec"]')).toHaveText('—');
    // an offline camera has the grey dot; a camera disabled in Arx is muted but listed
    await expect(page.locator(`${ROWS}[data-camera="nvr-1:7"]`)).toHaveCount(2);
    await expect(page.locator(`${ROWS}[data-camera="nvr-1:7"].off`)).toHaveCount(2);
    await expect(page.locator(`${ROWS}[data-camera="nvr-1:7"] [data-offline]`)).toHaveCount(2);
    await expect(page.locator(`${ROWS}[data-camera="nvr-1:6"] [data-offline]`)).toHaveCount(1);
    await expect(page.locator(`${ROWS}[data-camera="nvr-1:1"] [data-offline]`)).toHaveCount(0);
    // read-only: no controls in the cells
    await expect(page.locator(`${PAGE} tbody input, ${PAGE} tbody select, ${PAGE} tbody sw-toggle, ${PAGE} tbody button`)).toHaveCount(0);
    // the tab sits after NVR in the section's row, and the screen reads once (two GETs)
    await expect(page.locator('sw-app system-security [data-security-settings-tabs] sw-tabs a').last()).toHaveText('מצלמות');
    expect(st.hits.filter((h) => h === 'nvr/cameras')).toHaveLength(1);
    await sizes(page, 'ready', async () => {
      await expect(page.locator(PAGE + ' [data-nvr-table]')).toBeVisible({ visible: await page.evaluate(() => innerWidth >= 768) });
    });
  });

  test('search, filters and sort', async ({ page }) => {
    await open(page, '/system/security/cameras');
    await expect(page.locator(ROWS)).toHaveCount(20);
    const search = page.locator(`${PAGE} [data-nvr-search]`);
    await search.fill('חצר');
    await expect(page.locator(ROWS)).toHaveCount(3); // channel 3: main, sub, third
    await expect(page.locator(`${PAGE} [data-nvr-count]`)).toHaveText('3 מתוך 19 זרמים');
    await search.fill('ערוץ 1');
    await expect(page.locator(ROWS)).toHaveCount(2); // not channel 10, 11...
    await search.fill('');
    await page.locator(`${PAGE} [data-nvr-filter="codec"]`).selectOption('h265');
    await expect(page.locator(ROWS)).toHaveCount(6);
    await page.locator(`${PAGE} [data-nvr-filter="role"]`).selectOption('main');
    await expect(page.locator(ROWS)).toHaveCount(3);
    await page.locator(`${PAGE} [data-nvr-clear]`).click();
    await page.locator(`${PAGE} [data-nvr-filter="svc"]`).selectOption('on');
    await expect(page.locator(ROWS)).toHaveCount(7); // the six H.264 mains that have streams + the H.265 sub of channel 5
    await page.locator(`${PAGE} [data-nvr-filter="svc"]`).selectOption('');
    await page.locator(`${PAGE} [data-nvr-filter="webrtc"]`).selectOption('ok');
    await expect(page.locator(ROWS)).toHaveCount(7); // the six H.264 subs + the third stream of channel 3
    await page.locator(`${PAGE} [data-nvr-clear]`).click();
    // a filter nothing matches
    await search.fill('zzz');
    await expect(page.locator(`${PAGE} [data-nvr-no-match]`)).toBeVisible();
    await shot(page, 'no-match-1440');
    await page.locator(`${PAGE} [data-nvr-clear]`).click();
    await expect(page.locator(ROWS)).toHaveCount(20);
    // sort by bit-rate: ascending then descending, unread rows last in both
    const bitrates = () => page.locator(`${ROWS} td[data-col="bitrate"]`).allInnerTexts();
    await page.locator(`${PAGE} [data-nvr-sort="bitrate"]`).click();
    await expect(page.locator(`${PAGE} th[data-col="bitrate"]`)).toHaveAttribute('aria-sort', 'ascending');
    expect((await bitrates())[0]).toBe('512 kbps VBR');
    await page.locator(`${PAGE} [data-nvr-sort="bitrate"]`).click();
    await expect(page.locator(`${PAGE} th[data-col="bitrate"]`)).toHaveAttribute('aria-sort', 'descending');
    expect((await bitrates())[0]).toBe('4096 kbps VBR');
    expect((await bitrates()).at(-1)).toBe('—');
    await page.locator(`${PAGE} [data-nvr-sort="channel"]`).click(); // another column starts ascending
    expect(await page.locator(`${ROWS} td[data-col="channel"]`).first().innerText()).toBe('1');
    await page.locator(`${PAGE} [data-nvr-search]`).fill('');
  });

  test('device unreachable with last readings: the stale line, the values stay, retry reads again', async ({ page }) => {
    st.mode = 'stale';
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${PAGE} [data-nvr-stale]`)).toContainText('ה־NVR אינו זמין. מוצגים הערכים האחרונים.');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'stale');
    await expect(page.locator(ROWS).first()).toBeVisible();
    await expect(page.locator(`${ROWS}[data-stream="101"] td[data-col="bitrate"]`)).toHaveText('—'); // the registry has no bit-rate: a dash
    await expect(page.locator(`${ROWS}[data-stream="101"] td[data-col="svc"]`)).toHaveText('פעיל');
    await sizes(page, 'stale', async () => {
      await expect(page.locator(`${PAGE} [data-nvr-stale]`)).toBeVisible();
    });
    st.mode = 'ready';
    await page.locator(`${PAGE} [data-nvr-retry]`).click();
    await expect(page.locator(`${PAGE} [data-nvr-stale]`)).toHaveCount(0);
    await expect(page.locator(`${ROWS}[data-stream="101"] td[data-col="bitrate"]`)).toHaveText('3072 kbps VBR');
  });

  test('device unreachable and nothing known: the error panel with a retry', async ({ page }) => {
    st.mode = 'down';
    await open(page, '/system/security/cameras');
    const panel = page.locator(`${PAGE} [data-nvr-error]`);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('heading', 'ה־NVR אינו זמין.');
    await sizes(page, 'error', async () => {
      await expect(panel).toBeVisible();
    });
    st.mode = 'ready';
    await panel.getByRole('button', { name: 'נסה שוב' }).click();
    await expect(page.locator(ROWS).first()).toBeVisible();
  });

  test('empty NVR: the empty state with a refresh', async ({ page }) => {
    st.mode = 'empty';
    await open(page, '/system/security/cameras');
    const panel = page.locator(`${PAGE} [data-nvr-empty]`);
    await expect(panel).toHaveAttribute('heading', 'לא נמצאו מצלמות ב־NVR.');
    await expect(page.locator(`${PAGE} [data-nvr-toolbar]`)).toHaveCount(0);
    await sizes(page, 'empty', async () => {
      await expect(panel).toBeVisible();
    });
  });

  test('loading: the loading state while the NVR answers slowly', async ({ page }) => {
    st.mode = 'slow';
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'loading');
    await expect(page.locator(`${PAGE} [data-nvr-loading]`)).toBeVisible();
    await sizes(page, 'loading', async () => {
      await expect(page.locator(`${PAGE} [data-nvr-loading]`)).toBeVisible();
    });
    await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 15_000 });
  });

  test('refused by the server (403) shows the no-permission state; no NVR (409) shows the no-NVR panel', async ({ page }) => {
    st.mode = 'forbidden';
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${PAGE} [data-nvr-forbidden]`)).toBeVisible();
    await shot(page, 'forbidden-1440');
    st.mode = 'none';
    await open(page, '/system/security/cameras');
    // NVR-less installations get the shell's own "no NVR" panel for this address, and no tab
    await expect(page.locator(PAGE)).toHaveCount(0);
    await expect(page.locator('sw-app')).toContainText('ללא NVR');
    await shot(page, 'no-nvr-1440');
  });

  test('the tab is offered to system administrators only', async ({ page }) => {
    await open(page, '/system/security/nvr');
    await expect(page.locator('sw-app system-security [data-security-settings-tabs] sw-tabs a')).toHaveText(['אזעקה', 'ניהול אזעקה', 'NVR', 'מצלמות']);
    // the NVR status page links to it
    await expect(page.locator('sw-app system-security-nvr sw-button', { hasText: 'הגדרות מצלמות' })).toHaveCount(1);
    // an operator: no tab, the address falls back to what they may open
    st.perms = OPERATOR;
    await open(page, '/system/security/cameras');
    await expect.poll(() => hashOf(page)).not.toBe('#/system/security/cameras');
    await expect(page.locator(PAGE)).toHaveCount(0);
    // sources.configure alone (the NVR connection page's holder) does not open the table
    st.perms = [...OPERATOR, 'sources.configure'];
    await open(page, '/system/security/cameras');
    await expect.poll(() => hashOf(page)).not.toBe('#/system/security/cameras');
    await expect(page.locator(PAGE)).toHaveCount(0);
  });

  test('RTL: the page is right-to-left, numbers and codecs stay left-to-right', async ({ page }) => {
    await open(page, '/system/security/cameras');
    await expect(page.locator(ROWS).first()).toBeVisible();
    const dir = await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!).direction);
    expect(dir).toBe('rtl');
    const ltr = await page.locator(`${ROWS}[data-stream="101"] td[data-col="resolution"] bdi`).evaluate((el) => getComputedStyle(el).direction);
    expect(ltr).toBe('ltr');
  });

  test('no horizontal page scroll at 820 and 390', async ({ page }) => {
    await open(page, '/system/security/cameras');
    await expect(page.locator(ROWS).first()).toBeVisible();
    for (const w of [820, 390]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `page overflow at ${w}`).toBeLessThanOrEqual(0);
      if (w === 820) {
        // the table itself fits too: its own scroll box has nothing to scroll
        const inner = await page.locator(`${PAGE} [data-nvr-table]`).evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(inner, 'table scroll at 820').toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('CR-020 S1 cameras table (demo mode, no backend)', () => {
  test('the in-memory demo fills the same screen', async ({ page }) => {
    await open(page, '/system/security/cameras');
    await expect(page.locator(ROWS).first()).toBeVisible();
    await expect(page.locator(`${PAGE} [data-nvr-count]`)).toContainText('זרמים');
    await expect(page.locator(`${PAGE} sw-page`)).toHaveAttribute('subheading', 'NVR ראשי · DS-7616NI-DEMO');
    await sizes(page, 'demo', async () => {
      await expect(page.locator(PAGE)).toBeVisible();
    });
  });
});
