import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { skinsUnderTest } from './helpers/frozen-skins';

// CAMHEALTH091 camera image health: the compact card + picture column on בריאות מצלמות (#/investigate/health) and the settings card in
// הגדרות › בריאות ועבודות. Against a MOCKED backend (page.route on api/v1); every value is fake. The layout guard (tests/layout-guard.ts)
// FAILS on escape / overflow / floating / clipped / target. Run with the preview:
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-camera-image-health.spec.ts --project=desktop --workers=1
const WIDTHS = [320, 390, 820, 1440];
const SKINS = skinsUnderTest(['classic', 'bubble']);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign', 'sources.configure', 'notify.manage'];
const SKIP = '.skl, sw-icon, svg';
const BUBBLE = '.tile, .card, .li, .chip, .seg, .inp, .tree button, .chk';

const cam = (id: string, channel: number, name: string) => ({ id, recorder_id: 'nvr-1', channel, name, alias: name, name_source: `Camera ${channel}`, status: 'online', enabled: true,
  stream: null, last_seen_at: '2026-10-23T08:00:00Z', main_track: channel * 100 + 1, sub_track: channel * 100 + 2, can_view_live: true, recorder_enabled: true });
const CAMS = [cam('cam-a', 1, 'לובי'), cam('cam-b', 2, 'כניסה ראשית לחניון התחתון עם שם ארוך מאוד'), cam('cam-c', 3, 'רמפה'), cam('cam-d', 4, 'גג')];
const img = (id: string, name: string, state: string, issues: string[] = [], extra: Record<string, unknown> = {}) => ({ id, name, state, issues, texts: [], sampled_at: '2026-10-23T08:00:00Z',
  attempted_at: '2026-10-23T08:00:00Z', source: 'stream', error: null, error_text: null, metrics: { brightness: 112.4, sharpness: 840.2, diff: 3.1, shift_pct: 0, corr: 0.97 },
  reference: { set_at: '2026-10-22T08:00:00Z', auto: true }, ...extra });
const HEALTH = {
  enabled: true, interval_s: 900, checked_at: '2026-10-23T08:00:00Z', can_manage: true,
  counts: { ok: 1, warn: 2, unknown: 1, excluded: 0, off: 0, dark: 1, blurred: 0, frozen: 1, shifted: 1 },
  cameras: [img('cam-a', 'לובי', 'ok'), img('cam-b', 'כניסה ראשית לחניון התחתון עם שם ארוך מאוד', 'warn', ['dark']), img('cam-c', 'רמפה', 'warn', ['frozen', 'shifted']),
    img('cam-d', 'גג', 'unknown', [], { error: 'no_source', error_text: 'אין זרם משנה פעיל', sampled_at: null, metrics: {} })],
};
const RANGES: Record<string, [number, number, number]> = { interval_s: [900, 300, 86400], per_pass_max: [6, 1, 50], dark_level: [20, 0, 128], blur_min: [25, 0.5, 5000], freeze_diff: [0.4, 0, 20],
  freeze_samples: [3, 2, 20], shift_pct: [8, 1, 25], shift_corr_min: [0.45, 0.05, 0.95], confirm_samples: [2, 1, 10], recover_s: [1800, 0, 86400] };
const VALUES = { ...Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, v[0]])), enabled: false, passive_only: false, check_dark: true, check_blur: true, check_freeze: true, check_shift: true, excluded: [] };
const RANGE_ANSWER = Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, { default: v[0], min: v[1], max: v[2] }]));
const POLICY = { source: 'camera.image', enabled: true, severity: 'alert', category: 'device_faults', after_s: 0, dedupe_window_s: 0, resolve_notice: false, recipients: { rule: 'managers' },
  channels: { inbox: true, webpush: false, email: false, app: false, announce: false, ha_mobile: false, whatsapp: false }, revision: 3, label: 'תמונת מצלמה לא תקינה', subject_kind: 'camera', resolves: true };
const USERS = [{ id: 'u-admin', username: 'u-admin', name: 'יוני', active: true }, { id: 'u-ops', username: 'ops', name: 'מפעיל לילה', active: true }];
let saved: { path: string; body: Record<string, unknown> }[] = [];

async function mock(page: Page, health = HEALTH) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-23T08:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full', discovery: { cameras_last_ok: '2026-10-23T08:00:00Z', cameras_last_error: null, streams_last_error: null, interval_s: 300 } });
    if (p.startsWith('health/report')) return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-10-23T08:00:00Z', probe_ttl_s: 20, checks: [{ id: 'db', label: 'מסד נתונים', status: 'ok', detail: 'תקין', meta: {} }] });
    if (p === 'recorder-health') return json({ recorders: [], interval_s: 60, can_manage: true });
    if (p === 'cameras') return json({ cameras: CAMS, recorders: [{ id: 'nvr-1', name: 'מקליט ראשי', vendor: 'hikvision' }], recorder: { id: 'nvr-1', name: 'מקליט ראשי', model: 'DS-7616', firmware: 'V4', last_seen_at: '2026-10-23T08:00:00Z' }, can_sync: true, media: {} });
    if (p === 'camera-image-health') return json(health);
    if (p === 'camera-image-health/check') return json({ ...health, checked: true, checked_at: '2026-10-23T08:30:00Z' });
    if (p.endsWith('/reference')) { saved.push({ path: p, body: req.postDataJSON() }); return json(health); }
    if (p === 'camera-image-health/settings') {
      if (req.method() === 'PUT') {
        const body = req.postDataJSON() as Record<string, unknown>;
        saved.push({ path: p, body });
        return json({ values: { ...VALUES, ...body }, ranges: RANGE_ANSWER, cameras: CAMS.map((c) => ({ id: c.id, name: c.name, recorder_id: 'nvr-1' })), source: 'camera.image' });
      }
      return json({ values: VALUES, ranges: RANGE_ANSWER, cameras: CAMS.map((c) => ({ id: c.id, name: c.name, recorder_id: 'nvr-1' })), source: 'camera.image' });
    }
    if (p === 'notify/policies/camera.image') {
      if (req.method() === 'PUT') { const body = req.postDataJSON() as Record<string, unknown>; saved.push({ path: p, body }); return json({ ...POLICY, ...body, revision: 4 }); }
      return json(POLICY);
    }
    if (p === 'identity/users') return json({ users: USERS });
    if (p.startsWith('cameras/') && p.endsWith('snapshot.jpg')) return route.fulfill({ status: 404, body: '' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('camera image health', () => {
  test.describe.configure({ timeout: 10 * 60_000 });

  test('camera health: compact card, picture column, chip filter, check now, reference', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mock(page);
    saved = [];
    await page.goto('/?design=a&skin=classic&scheme=light#/investigate/health');
    const card = page.locator('camera-image-health-card [data-cih-card]');
    await expect(card).toHaveAttribute('data-state', 'on', { timeout: 20_000 });
    await expect(page.locator('camera-image-health-card [data-cih-count="dark"]')).toBeVisible();
    await expect(page.locator('camera-image-health-card [data-cih-count="frozen"]')).toBeVisible();
    await expect(page.locator('camera-image-health-card [data-cih-count="blurred"]')).toHaveCount(0); // a zero count is not shown
    await expect(page.locator('system-devices [data-cih-cell]')).toHaveCount(4);
    await expect(page.locator('system-devices [data-cih-cell="warn"]').first()).toContainText('חשוכה');
    await page.locator('camera-image-health-card [data-cih-count="frozen"]').click();
    await expect(page.locator('system-devices [data-cih-cell]')).toHaveCount(1);
    await page.locator('camera-image-health-card [data-cih-count="frozen"]').click();
    await expect(page.locator('system-devices [data-cih-cell]')).toHaveCount(4);
    await page.locator('camera-image-health-card [data-cih-check] button').click();
    await expect(page.locator('camera-image-health-card [data-cih-checked]')).toBeVisible();
    await page.locator('system-devices [data-cih-cell="ok"]').click();
    await expect(page.locator('system-devices [data-cih-ref]')).toHaveText('ייחוס אוטומטי');
    await page.locator('system-devices [data-cih-ref-actions] sw-button').first().locator('button').click();
    await expect.poll(() => saved.filter((s) => s.path.endsWith('/reference')).map((s) => s.body)).toEqual([{ action: 'set' }]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'no sideways page scroll').toBeLessThanOrEqual(0);
    expect(errors, 'page errors').toEqual([]);
  });

  test('settings: switch, every threshold, checks, recipients through the notification policy', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mock(page);
    saved = [];
    await page.goto('/?design=a&skin=classic&scheme=light#/system/diagnostics?tab=health');
    const s = page.locator('camera-image-health-settings');
    await expect(s.locator('[data-cih-settings]')).toBeVisible({ timeout: 20_000 });
    await expect(s.locator('[data-cih-field]')).toHaveCount(10);
    await expect(s.locator('[data-cih-recipients]')).toBeVisible();
    await s.locator('[data-cih-switch="enabled"]').click();
    await expect(s.locator('[data-cih-switch="enabled"]')).toHaveAttribute('aria-checked', 'true');
    await s.locator('[data-cih-field="blur_min"]').fill('12.5');
    await s.locator('[data-cih-chip="check_shift"]').click();
    await s.locator('[data-cih-rule]').selectOption('users');
    await s.locator('[data-cih-chip="user:u-ops"]').click();
    await s.locator('[data-cih-save] button').click();
    await expect(s.locator('[data-cih-msg]')).toHaveText('נשמר');
    expect(saved).toEqual([
      { path: 'camera-image-health/settings', body: { enabled: true, blur_min: 12.5, check_shift: false } },
      { path: 'notify/policies/camera.image', body: { recipients: { rule: 'users', user_ids: ['u-ops'] }, base_revision: 3 } },
    ]);
    expect(errors, 'page errors').toEqual([]);
  });

  test('layout guard: both screens, two skins, widths 320-1440', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the sweep');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mock(page);
    const results: Finding[] = [];
    for (const skin of SKINS) {
      for (const [hash, root, ready] of [['#/investigate/health', 'system-devices', 'camera-image-health-card [data-cih-card]'], ['#/system/diagnostics?tab=health', 'system-diagnostics', 'camera-image-health-settings [data-cih-settings]']] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=light${hash}`);
        await page.waitForSelector(ready, { timeout: 20_000 });
        await page.evaluate(() => document.fonts.ready);
        if (root === 'system-diagnostics') {
          await page.locator('camera-image-health-settings [data-cih-excluded] summary').click(); // the excluded-camera chips are checked open
          await expect(page.locator('camera-image-health-settings [data-cih-chip^="exclude:"]')).toHaveCount(4);
        }
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await page.waitForTimeout(150);
          await settle(page);
          if (process.env.SW_SHOTS) await page.screenshot({ path: `${process.env.SW_SHOTS_DIR ?? '../docs/design/evidence/camhealth091'}/${root}-${skin}-${w}.png`, fullPage: false });
          const found = await page.evaluate(inPageCheck, { ctx: `${root} ${skin} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [root] });
          results.push(...found.filter((f) => skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating')));
        }
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-camera-image-health: findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
