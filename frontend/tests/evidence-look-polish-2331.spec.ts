import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settlePage } from './pixel-settle';

// LOOK-POLISH-2331: before / after evidence of the look and branding settings, wave 2 part A - the logo and name card
// (הגדרות › כללי › מראה המערכת), the wall display users (הגדרות › מסכי קיר), and the look dials with the palette editor (the dials card is
// hidden while the bubble skin is frozen, BUBBLECLEAN-297; the spec mounts the registered element by hand to review it).
// Shots only when SW_SHOTS is set; the assertions run either way (layout guards: no horizontal overflow, the drawer's actions stay visible).
//   SW_BASE_URL=http://127.0.0.1:4207/ SW_SHOTS=../docs/evidence/LOOK-POLISH-2331/after npx playwright test tests/evidence-look-polish-2331.spec.ts --workers=1
const SHOTS = process.env.SW_SHOTS ?? '';

const WIDTHS: [string, number, number][] = [
  ['desktop1920', 1920, 1080],
  ['desktop1440', 1440, 900],
  ['tablet1180', 1180, 820],
  ['tablet1024', 1024, 768],
  ['phone390', 390, 844],
];

async function shot(page: Page, name: string, target?: ReturnType<Page['locator']>) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}.png`);
  if (target) await target.screenshot({ path: file, animations: 'disabled' });
  else await page.screenshot({ path: file, animations: 'disabled' });
}

/** The page never scrolls sideways (a settings page may scroll down, never across). */
async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

// ---- the wall settings against a mocked backend (the same shapes as evidence-wall.spec.ts)
const CAMS = Array.from({ length: 8 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
const BASE_CFG = {
  cameras: [], scope: 'cameras', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: false, theme: 'dark',
  alerts: { enabled: true, categories: ['safety', 'doors'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 10, interval_s: 30, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1 },
  schedule: { windows: [{ days: [0, 1, 2, 3, 4], from: '07:00', to: '20:00' }], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};
function profile(user: string, title: string, over: Record<string, unknown> = {}) {
  return {
    user_id: `u-${user}`, username: user, display_name: title, title, area_id: null, floor_id: null, enabled: true, remote_allowed: false, version: 1,
    config: { ...BASE_CFG, cameras: ['cam-1', 'cam-2', 'cam-3'] }, status: 'connected', connections: 1, last_seen_at: new Date(Date.now() - 4 * 60_000).toISOString(), last_channel: 'local',
    created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z', camera_names: ['מצלמה 1', 'מצלמה 2', 'מצלמה 3'], ...over,
  };
}
const PROFILES = [
  profile('reception', 'קבלה'),
  profile('lobby-north', 'לובי צפוני - מגדל A', { status: 'stale', connections: 0, last_seen_at: new Date(Date.now() - 3 * 3600_000).toISOString(), last_channel: 'remote' }),
  profile('hall', 'מסדרון', { enabled: false, status: 'disabled', connections: 0, camera_names: [], config: { ...BASE_CFG, cameras: [], alerts: { ...BASE_CFG.alerts, enabled: false } } }),
];

async function installWall(page: Page, profiles: Record<string, unknown>[] | 'error') {
  await page.routeWebSocket(/\/api\/v1\/.*ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = ['system.configure', 'rbac.assign', 'map.read', 'video.live', 'entity.state.read', 'devices.read'];
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'x', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: null,
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': 'classic', 'ui.scheme': 'light', 'ui.start_route': 'devices', 'ui.tabs': {} }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/profiles') return profiles === 'error' ? json({ code: 'unavailable', user_message: 'השרת לא זמין כרגע' }, 503) : json({ profiles, max_profiles: 20 });
    if (p === 'wall/candidates') return json({ users: [{ id: 'u-lobby', username: 'lobby', display_name: 'לובי' }, { id: 'u-gate', username: 'gate', display_name: 'שער' }] });
    if (p === 'wall/photo-sets') return json({ sets: [{ id: 'ps1', name: 'נוף', count: 12 }] });
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) return json({ sites: [] });
    return json({}, 200);
  });
}

test.describe('LOOK-POLISH-2331 wall users (הגדרות › מסכי קיר)', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the widths are set by the spec itself'));

  for (const [name, w, h] of WIDTHS) {
    test(`list, add dialog and drawer at ${name}`, async ({ page }) => {
      await installWall(page, PROFILES);
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/?design=a&look=performance:full#/system/wall');
      await expect(page.locator(w <= 720 ? 'system-wall [data-wall-card]' : 'system-wall [data-wall-row]')).toHaveCount(3);
      await settlePage(page);
      await noSideScroll(page);
      await shot(page, `wall-list-${name}`);
      await page.locator('system-wall [data-wall-add-open]').click();
      await expect(page.locator('sw-dialog[data-wall-add] [data-wall-add-submit]')).toBeVisible(); // the dialog host has no box of its own
      await settlePage(page);
      await shot(page, `wall-add-${name}`);
      await page.keyboard.press('Escape');
      await page.locator('system-wall [data-wall-edit="u-reception"]:visible').first().click();
      const drawer = page.locator('sw-drawer[data-wall-drawer]');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('[data-wall-save]')).toBeInViewport();
      await settlePage(page);
      await shot(page, `wall-drawer-${name}`);
      await drawer.locator('[data-wall-section="alerts"]').scrollIntoViewIfNeeded();
      await expect(drawer.locator('[data-wall-save]')).toBeInViewport();
      await settlePage(page);
      await shot(page, `wall-drawer-alerts-${name}`);
    });
  }

  test('empty and error states', async ({ page }) => {
    await installWall(page, []);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a&look=performance:full#/system/wall');
    await expect(page.locator('system-wall [data-wall-empty]')).toBeVisible();
    await settlePage(page);
    await shot(page, 'wall-empty-desktop1440');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installWall(page, 'error');
    await page.goto('about:blank');
    await page.goto('/?design=a&look=performance:full#/system/wall');
    await expect(page.locator('system-wall sw-state-panel[state="error"]')).toBeVisible();
    await settlePage(page);
    await shot(page, 'wall-error-desktop1440');
  });
});

// ---- the logo and name card (demo mode: no backend; the cached brand view is what the card starts from)
async function bootBrand(page: Page, w: number, h: number) {
  await page.route('**/api/v1/brand/company-logo/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="#1e2e47"/></svg>' }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify({ company: { name: 'נווה הירדן', kind: 'management', logo: {}, logo_file: { light: 'aaaaaaaaaaaaaaaa.svg', dark: null } }, size: 'm', dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: 'Tower A' } }));
    } catch {
      /* storage unavailable */
    }
  });
  await page.setViewportSize({ width: w, height: h });
  await page.goto('about:blank');
  await page.goto('/?design=a&look=performance:full#/system/diagnostics');
  const card = page.locator('system-brand-logos');
  await expect(card.locator('[data-brand-logos-card]')).toBeVisible();
  return card;
}

test.describe('LOOK-POLISH-2331 logo and name card', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the widths are set by the spec itself'));

  for (const [name, w, h] of WIDTHS) {
    test(`every tab at ${name}`, async ({ page }) => {
      const card = await bootBrand(page, w, h);
      await card.scrollIntoViewIfNeeded();
      const tabs = w < 900 ? ['look', 'files', 'title', 'preview'] : ['look', 'files', 'title'];
      for (const tab of tabs) {
        await card.locator(`[data-logo-tab="${tab}"]`).click();
        await expect(card.locator(`[data-logo-panel="${tab}"]`)).toBeVisible();
        await settlePage(page);
        await noSideScroll(page);
        await shot(page, `brand-${tab}-${name}`, card);
      }
      // an unsaved change: the footer says so
      await card.locator('[data-logo-tab="look"]').click();
      await card.locator('[data-logo-size] button[data-size="l"]').click();
      await expect(card.locator('[data-logo-save]')).toBeEnabled();
      await settlePage(page);
      await shot(page, `brand-dirty-${name}`, card);
    });
  }

  test('the tab strip is a keyboard tablist (arrows move and select)', async ({ page }) => {
    const card = await bootBrand(page, 1440, 900);
    await card.locator('[data-logo-tab="look"]').focus();
    await page.keyboard.press('ArrowLeft'); // RTL: the next tab is to the left
    await expect(card.locator('[data-logo-tab="title"]')).toHaveAttribute('aria-selected', 'true');
    await expect(card.locator('[data-logo-tab="title"]')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(card.locator('[data-logo-tab="files"]')).toHaveAttribute('aria-selected', 'true');
  });
});

// ---- the look dials and the palette editor (hidden while the bubble skin is frozen: mounted by hand for review only)
test.describe('LOOK-POLISH-2331 look dials (review mount)', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'the widths are set by the spec itself'));

  for (const [name, w, h] of WIDTHS.filter(([n]) => n === 'desktop1440' || n === 'tablet1024' || n === 'phone390')) {
    test(`own and installation targets, palette editor at ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('about:blank');
      await page.goto('/?design=a&look=performance:full#/system/diagnostics');
      await expect(page.locator('system-brand-logos')).toBeVisible();
      await page.evaluate(() => {
        const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-diagnostics')?.shadowRoot?.querySelector('system-brand-logos')?.parentElement;
        const el = document.createElement('system-look');
        el.setAttribute('data-review-mount', '');
        (host ?? document.body).prepend(el);
      });
      const look = page.locator('system-look[data-review-mount]');
      await expect(look.locator('[data-look-card]')).toBeVisible();
      await look.scrollIntoViewIfNeeded();
      await settlePage(page);
      await noSideScroll(page);
      await shot(page, `look-own-${name}`, look);
      await look.locator('[data-look-target="installation"]').click();
      await look.locator('system-palette-editor [data-palette-new]').click();
      await expect(look.locator('system-palette-editor [data-palette-editor]')).toBeVisible();
      await settlePage(page);
      await noSideScroll(page);
      await shot(page, `look-installation-palette-${name}`, look);
    });
  }
});
