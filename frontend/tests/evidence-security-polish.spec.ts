import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// SEC screens polish (2026-10-10): the evidence matrix of the security area - the alarm (state card, zones, the keypad), the live
// overview, the wall, one camera, the saved views, the events centre (table + drawer), camera health, the notification centre
// (list, detail, the door confirmation) and the recorder health cards - in demo mode (no backend; the notification centre on its
// in-memory mock, the recorder health on a page.route mock). Classic light + dark at 1440 and 390; Domus, Tesla and Bubble light +
// dark at 1440 on the four key screens. The shots land in docs/design/evidence/security-polish/<phase>/ (SW_SEC_PHASE=before|after,
// default after); the "before" set is taken from the untouched build of the branch base.
//   npm run build   (in frontend/)
//   SW_BASE_URL=http://127.0.0.1:4811/ SW_SEC_PHASE=after npx playwright test tests/evidence-security-polish.spec.ts --project=desktop --project=mobile --workers=1
// Besides the pictures: no horizontal overflow at 390, the demo keypad is reachable from the keyboard, and a triggered-looking hero
// never runs an infinite animation under reduced motion.

const PHASE = process.env.SW_SEC_PHASE === 'before' ? 'before' : 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../docs/design/evidence/security-polish/${PHASE}`);
const SKINS = SKIN_IDS;
const SCHEMES = ['light', 'dark'] as const;
/** The four screens every skin is shot on; the rest are classic only. */
const KEY = new Set(['alarm', 'wall', 'events', 'notify']);
type Info = { project: { name: string } };
const phone = (info: Info) => info.project.name === 'mobile';
const vp = (info: Info) => (phone(info) ? '390' : '1440');

const RECORDERS = [
  { id: 'nvr-1', name: 'מקליט ראשי', status: 'ok', checked_at: '2026-10-10T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 180 },
    disks: { state: 'ok', items: [{ ref: '1', state: 'ok', text: 'תקין', total_mb: 953869, free_mb: 847872 }], free_pct: 88.9, full: false, fill_days: null, alarms: [] },
    recording: { state: 'ok', recording: 16, watched: 16, stopped: [], exception: [] }, channels: { state: 'ok', total: 16, connected: 16, disconnected: [] },
    clock: { state: 'ok', drift_s: 1.2 }, certificate: { state: 'ok', days_left: 2900 } },
  { id: 'nvr-2', name: 'מקליט חניון', status: 'error', checked_at: '2026-10-10T08:00:00Z', detail_supported: true, api: { state: 'warn', latency_ms: 2400 },
    disks: { state: 'error', items: [{ ref: '1', state: 'locked', text: 'נעול', total_mb: 1000, free_mb: 0 }], free_pct: 0, full: true, fill_days: null, alarms: ['diskFullAlarm'] },
    recording: { state: 'warn', recording: 3, watched: 6, stopped: [{ channel: 2, name: 'כניסה' }, { channel: 3, name: 'רמפה' }], exception: [] },
    channels: { state: 'warn', total: 8, connected: 6, disconnected: [{ channel: 7, name: 'גג' }, { channel: 8, name: 'מחסן' }] },
    clock: { state: 'warn', drift_s: -340 }, certificate: { state: 'warn', days_left: 9 } },
  { id: 'nvr-3', name: 'מקליט משרדים', status: 'warn', checked_at: '2026-10-10T08:00:00Z', detail_supported: true, api: { state: 'ok', latency_ms: 90 },
    disks: { state: 'warn', items: [{ ref: '2', state: 'ok', text: 'תקין', total_mb: 1907729, free_mb: 90000 }], free_pct: 4.7, full: false, fill_days: 3, alarms: [] },
    recording: { state: 'ok', recording: 5, watched: 5, stopped: [], exception: [] }, channels: { state: 'ok', total: 5, connected: 5, disconnected: [] }, clock: { state: 'ok', drift_s: 0 }, certificate: null },
];
const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign'];
const RANGES = { interval_s: [60, 30, 900], latency_ms: [1500, 200, 10000], recording_gap_min: [30, 5, 1440], clock_drift_s: [60, 5, 3600], disk_fill_days: [0, 0, 60], cert_days: [30, 1, 365], recover_s: [120, 0, 3600] };

/** The recorder health cards need a backend answer: a mocked api/v1 with an administrator and three recorders. */
async function mockRecorders(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-10T08:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full' });
    if (p.startsWith('health/report')) return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: '2026-10-10T08:00:00Z', probe_ttl_s: 20, checks: [{ id: 'db', label: 'מסד נתונים', status: 'ok', detail: 'תקין', meta: {} }] });
    if (p === 'recorder-health') return json({ recorders: RECORDERS, interval_s: 60, can_manage: true });
    if (p === 'recorder-health/settings') return json({ values: { ...Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, v[0]])), continuous_recorders: ['nvr-2'], camera_recording: {} }, ranges: Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, { default: v[0], min: v[1], max: v[2] }])), cameras: [] });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function open(page: Page, hash: string, skin: string, scheme: string) {
  await page.clock.setFixedTime(new Date('2026-10-10T10:24:00Z'));
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('sw-notify-mock', JSON.stringify({ viewer: 'door' }));
      localStorage.removeItem('sw.nav.order');
      localStorage.removeItem('sw.alarm.zones.view'); // the alarm's card / list choice is per browser: every shot starts from the default
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await settlePage(page);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await settlePage(page, { quietMs: 250 });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function openCenter(page: Page, info: Info) {
  await page.locator(phone(info) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
  await expect(page.locator('sw-app notify-center [data-center-state="ready"]')).toBeVisible();
}

const SCREENS: { id: string; hash: string; after?: (page: Page, info: Info) => Promise<void> }[] = [
  { id: 'alarm', hash: '/security/alarm' },
  { id: 'alarm-list', hash: '/security/alarm', after: async (page) => {
    await page.locator('security-alarm [data-alarm-view-list]').click();
    await expect(page.locator('security-alarm [data-alarm-zones="list"]').first()).toBeVisible();
    await expect(page.locator('security-alarm article.zrow')).toHaveCount(6);
  } },
  { id: 'alarm-keypad', hash: '/security/alarm', after: async (page) => {
    await page.locator('security-alarm [data-bypass="binary_sensor.demo_zone_2"]').click();
    await expect(page.locator('security-alarm input[data-code]')).toBeVisible();
    for (const k of ['1', '2', '3']) await page.locator(`security-alarm [data-key="${k}"]`).click();
  } },
  { id: 'live', hash: '/live' },
  { id: 'wall', hash: '/live/wall' },
  { id: 'camera', hash: '/live/cameras/cam-4' },
  { id: 'views', hash: '/live/views' },
  { id: 'events', hash: '/investigate/events' },
  { id: 'events-drawer', hash: '/investigate/events', after: async (page) => {
    await page.locator('investigate-events sw-table tbody tr').first().click();
    await expect(page.locator('investigate-events sw-drawer')).toBeVisible();
  } },
  { id: 'health', hash: '/investigate/health' },
  { id: 'notify', hash: '/live', after: async (page, info) => openCenter(page, info) },
  { id: 'notify-detail', hash: '/live', after: async (page, info) => {
    await openCenter(page, info);
    await page.locator('sw-app notify-center notify-row [data-notify-row="ntf-002"] [data-row-open]').click();
    await expect(page.locator('sw-app notify-center notify-detail [data-notify-detail]')).toHaveAttribute('data-notify-detail', 'ntf-002');
  } },
  { id: 'notify-door', hash: '/live', after: async (page, info) => {
    await openCenter(page, info);
    await page.locator('sw-app notify-center notify-row [data-notify-row="ntf-002"] [data-row-open]').click();
    await page.locator('sw-app notify-center notify-detail [data-detail-act="door"]').click();
    await expect(page.locator('sw-app notify-center [data-door-dialog]')).toHaveAttribute('data-door-dialog', 'confirm');
  } },
];

test.describe('security screens polish - evidence', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.setTimeout(240_000); // twelve screens settle in one test; the 60 s default is for a single screen

  for (const skin of SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'two widths are enough');
        test.skip(skin !== 'classic' && phone(info), 'the other skins are shot at 1440 only');
        for (const s of SCREENS) {
          if (skin !== 'classic' && !KEY.has(s.id)) continue;
          await open(page, s.hash, skin, scheme);
          await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          if (s.after) await s.after(page, info);
          await shot(page, `${s.id}-${skin}-${scheme}-${vp(info)}`);
          if (phone(info)) await noOverflow(page);
        }
      });
    }
  }

  test('recorder health cards (mocked backend): classic light + dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await mockRecorders(page);
    for (const scheme of SCHEMES) {
      await open(page, '/system/diagnostics?tab=health', 'classic', scheme);
      await page.waitForSelector('sw-app system-diagnostics recorder-health-panel [data-rh-card="nvr-2"]', { timeout: 20_000 });
      await page.locator('recorder-health-panel [data-rh-panel]').scrollIntoViewIfNeeded();
      await shot(page, `recorders-classic-${scheme}-${vp(info)}`);
      if (phone(info)) await noOverflow(page);
    }
  });

  test('the keypad is reachable from the keyboard and the dialog keeps focus inside', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a keyboard check');
    await open(page, '/security/alarm', 'classic', 'light');
    await page.locator('security-alarm [data-bypass="binary_sensor.demo_zone_2"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('security-alarm input[data-code]')).toBeVisible();
    // The dialog moves keyboard focus into its first field one animation frame after it opens (sw-dialog.updated): the field is
    // visible before it holds focus, and keys typed in between went to the button behind it. Type once focus has arrived.
    await expect(page.locator('security-alarm input[data-code]')).toBeFocused();
    await page.keyboard.type('12');
    await expect(page.locator('security-alarm input[data-code]')).toHaveValue('12');
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const deep = (n: Document | ShadowRoot): Element | null => {
        const a = n.activeElement;
        return a?.shadowRoot ? deep(a.shadowRoot) : a;
      };
      const el = deep(document);
      return !!el && el.tagName === 'BUTTON' && el.hasAttribute('data-key');
    });
    expect(inside).toBe(true);
  });

  test('reduced motion: nothing on the alarm screen keeps animating', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/security/alarm', 'classic', 'light');
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && !Number.isFinite(a.effect?.getTiming().iterations ?? 1)).length);
    expect(running).toBe(0);
  });
});
