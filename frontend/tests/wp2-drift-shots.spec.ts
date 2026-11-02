import { test, expect, type Page, type Route } from '@playwright/test';

// POLISH4-WP2 TEMPORARY drift harness (removed before the branch joins a train): the WP2 screens at 1024 (tablet) and 390 (mobile), light +
// dark, classic, shot with toHaveScreenshot so `run_smart.py preview ... -u` copies the pictures back for review. Demo mode plus a mocked
// backend (page.route) for the API-only states: rules / alerts icon tiles, the search loading + error panels, camera health loading and rows.
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const PERMS = ['video.live', 'video.playback', 'map.read', 'events.read', 'events.ack', 'devices.read', 'rules.manage', 'system.configure', 'sources.configure', 'cases.read'];
const cam = (id: string, channel: number, name: string, status = 'online') => ({ id, recorder_id: 'nvr-1', channel, name, alias: name, name_source: `Camera ${channel}`, status, enabled: true,
  stream: { fps: 15, bitrate_kbps: 2048, resolution: '1920x1080', codec: 'H.264' }, last_seen_at: '2026-10-23T08:00:00Z', main_track: channel * 100 + 1, sub_track: channel * 100 + 2, can_view_live: true, recorder_enabled: true });
const CAMS = [cam('cam-a', 1, 'לובי'), cam('cam-b', 2, 'כניסה ראשית לחניון התחתון'), cam('cam-c', 3, 'רמפה', 'offline'), cam('cam-d', 4, 'גג')];
const rule = (id: string, name: string, owner = 'local') => ({ id, name, description: '', enabled: true, owner, ha_automation_id: null, trigger: { types: ['person'], sources: [], severity_min: 'info' },
  scope: { site_ids: [], building_ids: [], floor_ids: [], zone_ids: [], camera_ids: [], entity_ids: [] }, window: { days: [], from: '22:00', to: '06:00' }, cooldown_s: 300,
  actions: [{ kind: 'notify', message: 'זוהה אדם' }], revision: 1, created_by_username: 'dana', updated_by_username: 'dana', created_at: ago(900), updated_at: ago(60), last_fired_at: ago(30), alerts: { total: 4, open: 1 } });
const alert = (id: string, acked: boolean) => ({ id, rule_id: 'r1', rule_name: 'אדם בלילה', event_id: 'e1', camera_id: 'cam-a', entity_id: null, fired_at: ago(20), reasons: ['סוג: אדם', 'בחלון 22:00-06:00'],
  message: 'זוהה אדם בשעות הסגירה', acked_at: acked ? ago(5) : null, acked_by_username: acked ? 'dana' : null });

async function mock(page: Page, opts: { camerasHang?: boolean; providersFail?: boolean }) {
  await page.routeWebSocket('**/events/ws', () => { /* silent */ });
  await page.route('**/api/v1/**', async (route: Route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u1', username: 'dana', display_name: 'דנה', source: 'ingress' }, active: true, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: false, nvr_channels: 16, warnings: [] });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full', discovery: { cameras_last_ok: '2026-10-23T08:00:00Z', cameras_last_error: null, streams_last_error: null, interval_s: 300 } });
    if (p === 'cameras') {
      if (opts.camerasHang) return; // the request never answers: the loading state stays on screen
      return json({ cameras: CAMS, recorders: [{ id: 'nvr-1', name: 'מקליט ראשי', vendor: 'hikvision' }], recorder: { id: 'nvr-1', name: 'מקליט ראשי', model: 'DS-7616', firmware: 'V4', last_seen_at: '2026-10-23T08:00:00Z' }, can_sync: true, media: {} });
    }
    if (p === 'rules') return json({ rules: [rule('r1', 'אדם בלילה'), rule('r2', 'מצלמה מנותקת'), rule('r3', 'דלת אחרי שעות', 'ha')], types: ['person', 'offline', 'door'], sources: ['nvr', 'ha'], action_kinds: ['notify'], days: ['sun', 'mon'] });
    if (p.startsWith('rules/alerts')) return json({ alerts: [alert('a1', false), alert('a2', true)], unacked: 1 });
    if (p === 'search/providers') return opts.providersFail ? json({ code: 'unavailable', user_message: 'שירות החיפוש לא זמין כרגע', retryable: true, correlation_id: 'mock', details: {} }, 503) : json({ providers: [], active: 'none', settings: { 'ai.provider': 'none', 'ai.privacy_ack': 'false', 'ai.budget_daily': 0 }, note: '' });
    if (p.startsWith('search/semantic')) return; // never answers: the loading panel
    if (p.startsWith('cameras/') && p.endsWith('snapshot.jpg')) return route.fulfill({ status: 404, body: '' });
    if (p === 'incidents/summary') return json({ enabled: false, open: 0, latest_id: null, red_dot: 'off' });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

interface Shot { hash: string; api?: { camerasHang?: boolean; providersFail?: boolean }; act?: (page: Page) => Promise<void> }
const ONLY = ['api-rules', 'api-alerts', 'api-search', 'api-health-loading', 'api-health', 'sync', 'search', 'health'];
const SHOTS_ALL: Record<string, Shot> = {
  overview: { hash: '/live' },
  wall: { hash: '/live/wall' },
  views: { hash: '/live/views' },
  camera: { hash: '/live/cameras/cam-1' },
  kiosk: { hash: '/kiosk/all' },
  playback: { hash: '/investigate/playback' },
  sync: { hash: '/investigate/playback/sync' },
  history: { hash: '/investigate/floors/f0/history' },
  incidents: { hash: '/investigate/incidents' },
  reviews: { hash: '/investigate/reviews' },
  search: { hash: '/investigate/search' },
  rules: { hash: '/investigate/rules' },
  health: { hash: '/investigate/health' },
  'api-rules': { hash: '/investigate/rules', api: {} },
  'api-alerts': { hash: '/investigate/rules?tab=alerts', api: {} },
  'api-search': {
    hash: '/investigate/search',
    api: { providersFail: true },
    act: async (page) => {
      await page.locator('investigate-search [data-semantic-q]').fill('אדם בלובי אתמול');
      await page.locator('investigate-search [data-semantic-run] button').click();
    },
  },
  'api-health-loading': { hash: '/investigate/health', api: { camerasHang: true } },
  'api-health': { hash: '/investigate/health', api: {} },
};
const SHOTS: Record<string, Shot> = Object.fromEntries(Object.entries(SHOTS_ALL).filter(([id]) => ONLY.includes(id)));

test.describe('wp2 drift shots', () => {
  test.describe.configure({ timeout: 90_000 });
  for (const scheme of ['light', 'dark'] as const) {
    for (const [id, s] of Object.entries(SHOTS)) {
      test(`${id} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'desktop', 'tablet (1024) and mobile (390) only');
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        if (s.api) await mock(page, s.api);
        await page.goto('about:blank');
        await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#${s.hash}`);
        await page.waitForSelector('sw-app', { state: 'attached' });
        await page.waitForTimeout(1800);
        await page.evaluate(() => document.fonts.ready);
        if (s.act) {
          await s.act(page);
          await page.waitForTimeout(800);
        }
        await expect(page).toHaveScreenshot(`${id}-${scheme}.png`, { animations: 'disabled', maxDiffPixelRatio: 1 });
      });
    }
  }
});
