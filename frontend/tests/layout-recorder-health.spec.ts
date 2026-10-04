import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// CR-026 recorder health: the layout guard (tests/layout-guard.ts) over הגדרות › בריאות ועבודות with the per-recorder health cards
// (one healthy, one with every kind of fault, one not answering, one Hikvision with reachability only) and the thresholds card, in
// the four skins at widths 320-1440. Against a MOCKED backend (page.route on api/v1); every value is fake. FAILS on escape /
// overflow / floating / clipped / target. Run with the Vite dev server or the preview:
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-recorder-health.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign'];
const SKIP = '.skl, sw-icon, svg';
const BUBBLE = '.tile, .card, .li, .chip, .seg, .inp, .tree button';
const ROOTS = ['system-diagnostics'];

const ok = (s = 'ok') => ({ state: s });
const CARDS = [
  { id: 'nvr-1', name: 'מקליט ראשי', status: 'ok', checked_at: '2026-10-04T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 180 },
    disks: { state: 'ok', items: [{ ref: '1', state: 'ok', text: 'תקין', total_mb: 953869, free_mb: 847872 }], free_pct: 88.9, full: false, fill_days: null, alarms: [] },
    recording: { state: 'ok', recording: 16, watched: 16, stopped: [], exception: [] }, channels: { state: 'ok', total: 16, connected: 16, disconnected: [] },
    clock: { state: 'ok', drift_s: 1.2 }, certificate: { state: 'ok', days_left: 2900 } },
  { id: 'nvr-2', name: 'מקליט חניון עם שם ארוך מאוד שלא נגמר', status: 'error', checked_at: '2026-10-04T08:00:00Z', detail_supported: true, api: { state: 'warn', latency_ms: 2400 },
    disks: { state: 'error', items: [{ ref: '1', state: 'locked', text: 'נעול', total_mb: 1000, free_mb: 0 }], free_pct: 0, full: true, fill_days: null, alarms: ['diskFullAlarm'] },
    recording: { state: 'warn', recording: 3, watched: 6, stopped: [{ channel: 2, name: 'כניסה ראשית לחניון התחתון' }, { channel: 3, name: 'רמפה' }, { channel: 4, name: 'מעלית' }], exception: [] },
    channels: { state: 'warn', total: 8, connected: 6, disconnected: [{ channel: 7, name: 'גג' }, { channel: 8, name: 'מחסן' }] },
    clock: { state: 'warn', drift_s: -340 }, certificate: { state: 'warn', days_left: 9 } },
  { id: 'nvr-3', name: 'מקליט משרדים', status: 'error', checked_at: '2026-10-04T08:00:00Z', detail_supported: true, api: { state: 'error', latency_ms: null, text: 'אין תקשורת' },
    disks: ok('unknown'), recording: ok('unknown'), channels: ok('unknown'), clock: ok('unknown'), certificate: null },
  { id: 'nvr-4', name: 'Hikvision', status: 'ok', checked_at: '2026-10-04T08:00:00Z', detail_supported: false, api: { state: 'ok', latency_ms: 90 },
    disks: ok('off'), recording: ok('off'), channels: ok('off'), clock: ok('off'), certificate: ok('off') },
];
const RANGES = { interval_s: [60, 30, 900], latency_ms: [1500, 200, 10000], recording_gap_min: [30, 5, 1440], clock_drift_s: [60, 5, 3600], disk_fill_days: [3, 0, 60], cert_days: [30, 1, 365], recover_s: [120, 0, 3600] };
const VALUES = { ...Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, v[0]])), recording_mode: 'continuous' };

async function mock(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-04T08:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full' });
    if (p.startsWith('health/report')) return json({ status: 'warn', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-10-04T08:00:00Z', probe_ttl_s: 20, checks: [{ id: 'db', label: 'מסד נתונים', status: 'ok', detail: 'תקין', meta: {} }] });
    if (p === 'recorder-health') return json({ recorders: CARDS, interval_s: 60, can_manage: true });
    if (p === 'recorder-health/settings') return json({ values: VALUES, ranges: Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, { default: v[0], min: v[1], max: v[2] }])), recording_modes: ['continuous', 'exceptions'] });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe('recorder health layout guard', () => {
  test.describe.configure({ timeout: 30 * 60_000 });

  test('health cards and thresholds: skins x themes x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mock(page);
    const results: Finding[] = [];
    let runs = 0;
    for (const skin of SKINS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${theme}#/system/diagnostics?tab=health`);
        await page.waitForSelector('sw-app system-diagnostics recorder-health-panel [data-rh-card="nvr-2"]', { timeout: 20_000 });
        await page.waitForSelector('sw-app system-diagnostics recorder-health-panel [data-rh-settings]', { timeout: 20_000 });
        await page.evaluate(() => document.fonts.ready);
        const panel = page.locator('recorder-health-panel');
        await expect(panel.locator('[data-rh-card]')).toHaveCount(4);
        await expect(panel.locator('[data-rh-card="nvr-4"] [data-rh-row]')).toHaveCount(1); // reachability only
        await expect(panel.locator('[data-rh-card="nvr-1"] [data-rh-row]')).toHaveCount(6);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await page.waitForTimeout(150);
          await settle(page);
          runs++;
          if (process.env.SW_SHOTS && (w === 390 || w === 1440) && (skin === 'classic' || skin === 'bubble')) {
            await page.locator('recorder-health-panel [data-rh-panel]').scrollIntoViewIfNeeded();
            await page.screenshot({ path: `../docs/design/evidence/cr026/recorder-health-${skin}-${theme}-${w}.png`, fullPage: false });
          }
          const found = await page.evaluate(inPageCheck, { ctx: `${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: ROOTS });
          results.push(...found.filter((f) => skin === 'bubble' || (f.cls !== 'target' && f.cls !== 'floating')));
        }
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-recorder-health: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
