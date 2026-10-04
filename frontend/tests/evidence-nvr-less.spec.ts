import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NVR-less mode (owner request 2026-09-29, docs/operations/NVR_LESS_MODE.md): an installation for electricity control
// only - Home Assistant, the map, device control and WisKey, no NVR. Runs against tests/fixtures/nvr_less_backend.py, the
// real backend started WITHOUT any NVR (and without the NVR fake the other fixture backends use), so it is in the
// `ha_only` mode:
//
//   SW_LIVE=1 SW_NVRLESS=1 SW_API_PORT=8372 SW_BASE_URL=http://127.0.0.1:4192/ \
//     npx playwright test tests/evidence-nvr-less.spec.ts --project=desktop --project=mobile --workers=1
//
// HA floors / areas / entities are seeded through the developer endpoints (ids prefixed `nvrless_`, idempotent).

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/nvr-less');
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';

const FLOORS = [{ floor_id: 'nvrless_ground', name: 'קרקע', level: 0 }];
const AREAS = [
  { area_id: 'nvrless_lobby', name: 'לובי', floor_id: 'nvrless_ground', icon: 'mdi:sofa' },
  { area_id: 'nvrless_office', name: 'משרד', floor_id: 'nvrless_ground', icon: 'mdi:desk' },
];
const ENTITIES = [
  { entity_id: 'light.nvrless_lobby', area_id: 'nvrless_lobby' },
  { entity_id: 'switch.nvrless_boiler', area_id: 'nvrless_lobby' },
  { entity_id: 'sensor.nvrless_power', area_id: 'nvrless_lobby' },
  { entity_id: 'light.nvrless_office', area_id: 'nvrless_office' },
];
const STATES = [
  { entity_id: 'light.nvrless_lobby', state: 'on', attributes: { friendly_name: 'תאורת לובי', brightness: 200 } },
  { entity_id: 'switch.nvrless_boiler', state: 'off', attributes: { friendly_name: 'דוד חשמל' } },
  { entity_id: 'sensor.nvrless_power', state: '1450', attributes: { friendly_name: 'צריכה כוללת', unit_of_measurement: 'W', device_class: 'power' } },
  { entity_id: 'light.nvrless_office', state: 'off', attributes: { friendly_name: 'תאורת משרד' } },
];

/** What the navigation must offer - and nothing else - in the NVR-less mode. Since 2026-09-30 the alarm lives in
 * הגדרות › אבטחה (not in the security area), so with no NVR the security area has no page left and leaves the rail. */
// CR-013: ראשי (the device overview) first; מערכת lives in the user menu, not the bar
const NAV_A = ['#/devices/building', '#/explore/sites', '#/multimedia/screens', '#/wiskey/overview'];
const NVR_HREFS = ['#/live', '#/live/wall', '#/investigate/events', '#/investigate/playback'];

test.describe('NVR-less mode (Home Assistant only)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_NVRLESS !== '1', 'needs tests/fixtures/nvr_less_backend.py (SW_LIVE=1 SW_NVRLESS=1)');

  test.beforeAll(async ({ request }) => {
    const me = await (await request.get('/api/v1/me')).json();
    expect(me.mode, 'the fixture backend must run without an NVR').toBe('ha_only');
    const reg = await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } });
    expect(reg.status()).toBe(200);
    expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES } })).status()).toBe(200);
    // a project backup, so the only item a fresh install shows in the status pill is gone and the pill can be green
    const backups = await (await request.get('/api/v1/backups')).json();
    if (!(backups.backups ?? []).length) expect((await request.post('/api/v1/backups', { data: { note: 'nvr-less spec' } })).status()).toBe(201);
    fs.mkdirSync(EVIDENCE, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'tiles');
      } catch {
        /* storage unavailable */
      }
    });
  });

  async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
    await page.goto('about:blank');
    await page.goto(`/?design=${design}#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
  }

  async function shot(page: Page, name: string, project: string) {
    await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
  }

  async function navHrefs(page: Page, sel: string): Promise<string[]> {
    return page.locator(`${sel} a`).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? '').filter((h) => h !== '#/screens' && h !== '#/styleguide'));
  }

  test('the API reports the mode and the health stays green: no NVR error, no system banner', async ({ request, page }, testInfo) => {
    const h = await (await request.get('/api/v1/health')).json();
    expect(h.mode).toBe('ha_only');
    expect(h.nvr.state).toBe('not_configured');
    // Home Assistant is the product here: green once the (fake) HA is connected, red while it is not
    await expect.poll(async () => (await (await request.get('/api/v1/health/summary')).json()).status, { timeout: 30000 }).toBe('ok');
    const s = await (await request.get('/api/v1/health/summary')).json();
    expect(s.items.map((i: { id: string }) => i.id)).not.toContain('nvr');
    await open(page, '/explore/sites');
    await expect(page.locator('sw-app [data-sys-pill]')).toHaveAttribute('data-status', 'ok', { timeout: 30000 });
    await expect(page.locator('sw-app [data-sys-banner]')).toHaveCount(0);
    await open(page, '/system/diagnostics?tab=health');
    const nvrCard = page.locator('system-diagnostics [data-health-card="nvr"]');
    await expect(nvrCard).toBeVisible({ timeout: 30000 });
    await expect(nvrCard).toContainText('לא מוגדר');
    await expect(page.locator('system-diagnostics [data-health-card="discovery"]')).toHaveCount(0);
    await shot(page, 'health', testInfo.project.name);
  });

  test('the rail (and the phone bottom nav) offer only ראשי (devices), map, multimedia and WisKey (no security area without an NVR); settings in the user menu', async ({ page }, testInfo) => {
    await open(page, '/explore/sites', 'a');
    const phone = testInfo.project.name === 'mobile';
    const sel = phone ? BOTTOM : RAIL;
    await expect(page.locator(`${sel} a[href="#/devices/building"]`)).toBeVisible({ timeout: 30000 });
    const hrefs = await navHrefs(page, sel);
    expect(hrefs.filter((h) => h !== '#/explore/floors/f0'), `nav: ${hrefs.join(', ')}`).toEqual(NAV_A);
    for (const h of NVR_HREFS) await expect(page.locator(`${sel} a[href="${h}"]`)).toHaveCount(0);
    await page.locator(phone ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-settings]')).toHaveAttribute('href', '#/system/diagnostics');
    await page.keyboard.press('Escape');
    if (phone) expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await shot(page, 'nav-a', testInfo.project.name);
  });

  test('a direct URL to an NVR area answers with the "מצב ללא NVR" panel, pointing at the options', async ({ page }, testInfo) => {
    for (const hash of ['/live/wall', '/live', '/investigate/events', '/investigate/playback', '/investigate/cases', '/investigate/exports', '/system/devices']) {
      await open(page, hash);
      const panel = page.locator('sw-app sw-state-panel[data-nvr-less]');
      await expect(panel, hash).toBeVisible({ timeout: 30000 });
      await expect(panel).not.toHaveAttribute('hint', /nvr_host|Add-on|Home Assistant/); // CR-022: the connection is entered in Arx, the panel says nothing about options
      await expect(page.locator('live-wall, investigate-events, investigate-playback, live-overview')).toHaveCount(0);
    }
    await open(page, '/live/wall');
    await shot(page, 'cameras-url', testInfo.project.name);
    await page.locator('sw-app sw-state-panel[data-nvr-less] sw-button').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/setup');
    await expect(page.locator('system-setup [data-nvr-less-connections]')).toBeVisible({ timeout: 30000 });
  });

  test('the Lovelace card degrades to the map: an NVR view inside embed=1 shows the floor map', async ({ page }) => {
    await open(page, '/investigate/events?embed=1');
    await expect(page.locator('sw-app explore-floor-map')).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('sw-app sw-state-panel[data-nvr-less]')).toHaveCount(0);
    await expect(page.locator('sw-app nav.rail')).toHaveCount(0);
  });

  test('the setup wizard asks for the NVR choice (nothing is chosen for the installer), skips the camera step on purpose and counts the rest', async ({ page }, testInfo) => {
    await open(page, '/system/wizard');
    const cam = page.locator('system-wizard section[data-step="camera"]');
    await expect(cam).toHaveAttribute('data-status', 'not_applicable', { timeout: 30000 });
    await expect(cam.locator('[data-step-status]')).toHaveText('דילוג - מצב ללא NVR');
    await expect(cam.locator('[data-check]')).toHaveCount(0);
    await expect(cam.locator('[data-step-link]')).toHaveAttribute('href', '#/system/setup');
    // CR-022: the NVR step is a real step again - "todo" until an explicit choice (a type, or "ללא NVR"), with the form inside
    const nvr = page.locator('system-wizard section[data-step="nvr"]');
    await expect(nvr).toHaveAttribute('data-status', 'todo');
    await expect(nvr.locator('nvr-connection-form [data-conn-vendor]')).toBeVisible();
    await expect(page.locator('system-wizard [data-wizard-progress]')).toContainText('מתוך 4');
    await expect(page.locator('system-wizard [data-wizard-progress]')).toContainText('מצב ללא NVR');
    await expect(page.locator('system-wizard section[data-status="failed"][data-step="nvr"]')).toHaveCount(0);
    await shot(page, 'wizard', testInfo.project.name);
  });

  test('the device screens work: the building tree, then an area with its controls', async ({ page }, testInfo) => {
    await open(page, '/devices/building');
    const lobby = page.locator('devices-building a.tile[data-area="nvrless_lobby"]');
    await expect(lobby).toBeVisible({ timeout: 30000 });
    await shot(page, 'devices', testInfo.project.name);
    await lobby.click();
    await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('settings: the storage page shows only the local disk and the video tab a neutral notice', async ({ page }, testInfo) => {
    await open(page, '/system/storage');
    await expect(page.locator('system-storage [data-storage-nvr-less]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('system-storage [data-storage-disk-guard]')).toBeVisible();
    await expect(page.locator('system-storage [data-storage-kpis]')).toHaveCount(0);
    await shot(page, 'storage', testInfo.project.name);
    await open(page, '/system/diagnostics?tab=media');
    await expect(page.locator('system-diagnostics [data-nvr-less-settings]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('system-diagnostics [data-set-wall-count]')).toHaveCount(0);
    await expect(page.locator('system-diagnostics [data-set-start-route] option')).toHaveText(['ראשי (ברירת מחדל)', 'מפת קומה']); // CR-013: ראשי (the device overview) is the default start screen
  });

  test('the map keeps working without cameras: sites, floors and the entity catalogue open, no camera layer', async ({ page, request }) => {
    const sites = await (await request.get('/api/v1/sites')).json();
    let floorId: string | null = sites.sites?.[0]?.buildings?.[0]?.floors?.[0]?.id ?? null;
    if (!floorId) {
      const site = await (await request.post('/api/v1/sites', { data: { name: 'בית (NVR-less)', address: '' } })).json();
      const b = await (await request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'מבנה' } })).json();
      floorId = (await (await request.post(`/api/v1/buildings/${b.id}/floors`, { data: { name: 'קרקע', level: 0 } })).json()).id as string;
    }
    await open(page, '/explore/sites');
    await expect(page.locator('explore-sites')).toBeVisible({ timeout: 30000 });
    await open(page, `/explore/floors/${floorId}`);
    await expect(page.locator('explore-floor-map')).toHaveCount(1);
    await expect(page.locator('sw-app sw-state-panel[data-nvr-less]')).toHaveCount(0);
    await expect(page.locator('explore-floor-map [data-multi-toggle]')).toHaveCount(0);
  });
});
