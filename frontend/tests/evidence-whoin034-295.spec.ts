import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WHOIN034-295 (board r034 / r035): מפה › מי במבנה (the KPI row, the floor plan with the areas' counts, the list; no page scroll on the
// three projects, day and night) and הגדרות › אפליקציה לנייד › מקומות / מסך מי במבנה (the geofence, beacon and Wi-Fi editors on one
// page, the thresholds), plus the person's own opt-out on the personal settings page. Against a MOCKED backend (page.route on api/v1).
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/WHOIN034-295');
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'system.configure', 'presence.report', 'presence.sensors.view', 'presence.view'];
const SENSORS = ['location', 'activity', 'steps', 'altitude', 'battery', 'network', 'beacon', 'app_state'];
const UUID = 'f7826da6-4fa2-4e98-8024-bc5b71e0893e';
const RECT = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const ZONE = (id: string, name: string, poly: { x: number; y: number }[]) => ({ id, floor_id: 'f-2', plan_version_id: 'pv', name, kind: 'room', polygon: poly, color: '#94a3b8', source: 'manual', searchable: true, revision: 1, created_at: '', updated_at: '' });
const ZONES = [ZONE('z-lobby', 'לובי', RECT(0.05, 0.1, 0.4, 0.4)), ZONE('z-meet', 'חדר ישיבות', RECT(0.5, 0.1, 0.45, 0.4)), ZONE('z-open', 'אופן ספייס', RECT(0.05, 0.55, 0.9, 0.38))];
const PLAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#eef2f7"/><rect x="40" y="60" width="920" height="600" fill="none" stroke="#64748b" stroke-width="6"/></svg>`;
const floorRow = (id: string, name: string, level: number) => ({ id, building_id: 'b1', name, level, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'pv', plan_width_px: 1000, plan_height_px: 700, draft_version_id: null, anchor_count: 0, updated_at: '' });
const TREE = [{ id: 's1', name: 'המשרד', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's1', name: 'מבנה א', sort_order: 0, updated_at: '', floors: [floorRow('f-2', 'קומה 2', 2), floorRow('f-3', 'קומה 3', 3)] }] }];
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const NAMES = ['דנה לוי', 'יוסי כהן', 'מיכל ברק', 'אבי שמש', 'נועה גל', 'עומר דהן', 'שירה רז', 'איתי נוי', 'הדס פרץ', 'גיל אור', 'תמר בן דוד', 'רון חיים'];

function peopleFixture(over: Record<string, unknown> = {}) {
  const people = NAMES.map((name, i) => {
    const zone = i < 5 ? ['z-lobby', 'לובי'] : i < 8 ? ['z-meet', 'חדר ישיבות'] : i < 10 ? ['z-open', 'אופן ספייס'] : null;
    const onF3 = i === 10;
    const site = i === 11;
    return {
      user_id: `u${i}`, name, source: site ? 'geofence' : onF3 ? 'wifi' : 'beacon', at: ago(i), site_id: 'site_main', site_name: 'המשרד',
      floor_id: site ? null : onF3 ? 'f-3' : 'f-2', floor_name: site ? '' : onF3 ? 'קומה 3' : 'קומה 2', zone_id: zone && !onF3 && !site ? zone[0] : null, zone_name: zone && !onF3 && !site ? zone[1] : '',
    };
  });
  return {
    enabled: true, generated_at: new Date().toISOString(), configured: { sites: 1, beacons: 3, wifi_sites: 1 },
    settings: { show_names: true, refresh_seconds: 30, stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near' },
    people,
    floors: [
      { floor_id: 'f-3', name: 'קומה 3', level: 3, building: 'מבנה א', count: 1, zones: [] },
      { floor_id: 'f-2', name: 'קומה 2', level: 2, building: 'מבנה א', count: 10, zones: [{ zone_id: 'z-lobby', name: 'לובי', count: 5 }, { zone_id: 'z-meet', name: 'חדר ישיבות', count: 3 }, { zone_id: 'z-open', name: 'אופן ספייס', count: 2 }] },
    ],
    sites: [{ site_id: 'site_main', name: 'המשרד', count: 1 }],
    totals: { inside: 14, named: 12, hidden: 2, on_floors: 11, site_only: 1 },
    ...over,
  };
}

const SETTINGS = {
  enabled: true, mode: 'continuous', interval_s: 60, distance_filter_m: 50, notice_text: 'הודעה', notice_version: 2, sensors_allowed: SENSORS, intervals_s: {},
  sites: [{ id: 'site_main', name: 'המשרד', lat: 32.0853, lon: 34.7818, radius_m: 150 }],
  beacons: [{ id: 'bcn_lobby', name: 'לובי', uuid: UUID, major: 1, minor: 2, site_id: 'site_main', floor_id: 'f-2', zone_id: 'z-lobby' }],
  wifi_sites: [{ id: 'wifi_f3', name: 'קומה 3', site_id: 'site_main', floor_id: 'f-3', ssid_hash_salt: 'abcdef0123456789', ssid_hashes: ['a'.repeat(64)] }],
  retention_days: 30, required_sensors: { enabled: false, sensors: [], apply_to_web: false, max_stale_hours: 48, roles: [], users: [], exempt_users: [] }, break_glass: { until: null, reason: '', by: null },
  people: { stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near', show_names: true, refresh_seconds: 30 }, people_opt_out_count: 2,
};

async function mock(page: Page, opts: { people?: Record<string, unknown>; perms?: string[] } = {}) {
  const st = { settings: structuredClone(SETTINGS) as Record<string, unknown>, puts: [] as Record<string, unknown>[], optOut: false, optPuts: [] as unknown[], peopleCalls: 0 };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = opts.perms ?? PERMS;
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'presence/people') {
      st.peopleCalls += 1;
      return json(peopleFixture(opts.people));
    }
    if (p === 'presence/people/me' && req.method() === 'PUT') {
      const b = req.postDataJSON() as { opted_out: boolean };
      st.optPuts.push(b);
      st.optOut = b.opted_out;
      return json({ opted_out: st.optOut });
    }
    if (p === 'presence/people/me') return json({ opted_out: st.optOut, enabled: true });
    if (p === 'presence/settings' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      st.puts.push(b);
      const next = { ...st.settings, ...b } as Record<string, unknown>;
      if (b.wifi_sites) next.wifi_sites = (b.wifi_sites as Record<string, unknown>[]).map((w) => { const { add_ssids, ...rest } = w; return { ...rest, ssid_hash_salt: rest.ssid_hash_salt || 'salt0000salt0000', ssid_hashes: [...((rest.ssid_hashes as string[]) ?? []), ...((add_ssids as string[]) ?? []).map(() => 'b'.repeat(64))] }; });
      if (b.people) next.people = { ...(st.settings.people as object), ...(b.people as object) };
      st.settings = next;
      return json({ settings: st.settings, sensors: [], devices: 3 });
    }
    if (p === 'presence/settings') return json({ settings: st.settings, sensors: [], devices: 3 });
    if (p === 'presence/devices') return json({ devices: [] });
    if (p.startsWith('floors/') && p.endsWith('/zones')) return json({ zones: p.includes('f-2') ? ZONES : [] });
    if (p.startsWith('floors/') && p.endsWith('/map')) {
      const fid = p.split('/')[1];
      return json({
        floor: { id: fid, name: fid === 'f-2' ? 'קומה 2' : 'קומה 3', level: fid === 'f-2' ? 2 : 3 }, building: { id: 'b1', name: 'מבנה א' }, site: { id: 's1', name: 'המשרד' },
        plan: { id: 'pv', status: 'published', width_px: 1000, height_px: 700, image_url: `/api/v1/test-plan-${fid}.svg`, render_mode: 'source' },
        needs_alignment: false, anchors: [], zones: fid === 'f-2' ? ZONES : [], cameras: [], permissions: { edit: false, publish: false, import: false, structure: false },
      });
    }
    if (p.startsWith('test-plan-')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLAN_SVG });
    if (p === 'sites') return json({ sites: TREE, can_create_site: false });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return st;
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

/** The owner's rule (24.10): a control screen never scrolls - neither the page nor the shell's main area. */
async function noPageScroll(page: Page) {
  const r = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    return { main: main ? main.scrollHeight - main.clientHeight : 0, doc: document.documentElement.scrollHeight - innerHeight, w: document.documentElement.scrollWidth - innerWidth };
  });
  expect(r.main, 'main scrolls').toBeLessThanOrEqual(1);
  expect(r.doc, 'page scrolls').toBeLessThanOrEqual(1);
  expect(r.w, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

test.describe('מפה › מי במבנה (WHOIN034-295)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the screen: KPIs, the floor plan with the areas' counts, the list, no page scroll (${scheme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme });
      await mock(page);
      await open(page, '/explore/presence');
      const scr = page.locator('sw-app explore-presence');
      await expect(scr.locator('[data-presence-kpi="all"] b')).toHaveText('14', { timeout: 15000 });
      await expect(scr.locator('[data-presence-kpi="floors"] b')).toHaveText('11');
      await expect(scr.locator('[data-presence-kpi="site"] b')).toHaveText('1');
      await expect(scr.locator('[data-presence-kpi="hidden"] b')).toHaveText('2');
      await expect(scr.locator('[data-presence-floor="f-2"]')).toHaveAttribute('aria-pressed', 'true'); // the busiest floor first
      await expect(page.locator('sw-app sw-tabs').first()).toContainText('מי במבנה');
      if (info.project.name === 'mobile') {
        await expect(scr.locator('[data-presence-seg]')).toBeVisible();
        await expect(scr.locator('[data-presence-list]')).toBeHidden();
      } else {
        await expect(scr.locator('[data-presence-person]')).toHaveCount(12);
        await expect(scr.locator('[data-presence-person="u0"]')).toContainText('לובי');
        await expect(scr.locator('[data-presence-hidden-note]')).toContainText('2');
      }
      await expect(scr.locator('sw-plan-canvas')).toBeVisible();
      await expect(scr.locator('[data-presence-floor-note]')).toContainText('10');
      await page.waitForTimeout(400);
      await noPageScroll(page);
      await shot(page, `who-is-in-${scheme}`);
      if (info.project.name === 'mobile') {
        await scr.locator('[data-presence-seg] button').nth(1).click();
        await expect(scr.locator('[data-presence-person]')).toHaveCount(12);
        await expect(scr.locator('[data-presence-map]')).toBeHidden();
        await noPageScroll(page);
        await shot(page, `who-is-in-list-${scheme}`);
      }
    });
  }

  test('the KPI and the search filter the list; another floor loads its own plan', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the list is the second view on a phone; the filter logic is the same');
    await mock(page);
    await open(page, '/explore/presence');
    const scr = page.locator('sw-app explore-presence');
    await expect(scr.locator('[data-presence-person]')).toHaveCount(12, { timeout: 15000 });
    await scr.locator('[data-presence-kpi="site"]').click();
    await expect(scr.locator('[data-presence-person]')).toHaveCount(1);
    await expect(scr.locator('[data-presence-person="u11"]')).toBeVisible();
    await scr.locator('[data-presence-kpi="all"]').click();
    await scr.locator('[data-presence-search]').fill('ישיבות');
    await expect(scr.locator('[data-presence-person]')).toHaveCount(3);
    await scr.locator('[data-presence-floor="f-3"]').click();
    await expect(scr.locator('[data-presence-floor-note]')).toContainText('1');
  });

  test('off, counts only, and no permission', async ({ page }) => {
    await mock(page, { people: { enabled: false, people: [], totals: { inside: 0, named: 0, hidden: 0, on_floors: 0, site_only: 0 } } });
    await open(page, '/explore/presence');
    const scr = page.locator('sw-app explore-presence');
    await expect(scr.locator('[data-state="off"]')).toBeVisible({ timeout: 15000 });
    await expect(scr.locator('[data-presence-settings]')).toHaveAttribute('href', '#/system/diagnostics?tab=mobile');
    await noPageScroll(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { people: { settings: { show_names: false, refresh_seconds: 30, stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near' }, people: [] } });
    await open(page, '/explore/presence');
    await expect(page.locator('sw-app explore-presence [data-presence-kpi="all"]')).toBeVisible({ timeout: 15000 });
    if (await page.locator('sw-app explore-presence [data-presence-seg]').isVisible()) await page.locator('sw-app explore-presence [data-presence-seg] button').nth(1).click();
    await expect(page.locator('sw-app explore-presence [data-presence-counts]')).toContainText('קומה 2');
    await expect(page.locator('sw-app explore-presence [data-presence-person]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const st = await mock(page, { perms: PERMS.filter((x) => x !== 'presence.view') });
    await open(page, '/explore/presence');
    await expect(page.locator('sw-app explore-presence [data-state="forbidden"]')).toBeVisible({ timeout: 15000 });
    expect(st.peopleCalls).toBe(0);
  });
});

test.describe('הגדרות › אפליקציה לנייד › מקומות ומסך מי במבנה (WHOIN034-295)', () => {
  test('the three editors on one page: add a geofence, a beacon on a floor and an area, a Wi-Fi site with a network name; one save', async ({ page }) => {
    const st = await mock(page);
    await open(page, '/system/diagnostics?tab=mobile&page=places');
    const ed = page.locator('system-presence system-presence-places');
    await expect(ed.locator('[data-presence-sites]')).toBeVisible({ timeout: 15000 });
    await expect(ed.locator('[data-presence-beacons]')).toBeVisible();
    await expect(ed.locator('[data-presence-wifi]')).toBeVisible();
    await expect(ed.locator('[data-presence-place="beacon:bcn_lobby"]')).toContainText('קומה 2');
    await shot(page, 'places-editors');
    // a geofence
    await ed.locator('[data-presence-add="site"]').click();
    const siteForm = ed.locator('[data-presence-form="site"]');
    await siteForm.locator('[data-presence-f="name"]').fill('מחסן');
    await siteForm.locator('[data-presence-f="radius"]').fill('80');
    await siteForm.locator('[data-presence-done]').click();
    // a beacon: a bad UUID keeps the save disabled until it is fixed
    await ed.locator('[data-presence-add="beacon"]').click();
    const bf = ed.locator('[data-presence-form="beacon"]');
    await bf.locator('[data-presence-f="name"]').fill('חדר ישיבות');
    await bf.locator('[data-presence-f="uuid"]').fill('not-a-uuid');
    await expect(ed.locator('[data-presence-places-save] button')).toBeDisabled();
    await bf.locator('[data-presence-f="uuid"]').fill(UUID.toUpperCase());
    await bf.locator('[data-presence-f="major"]').fill('1');
    await bf.locator('[data-presence-f="minor"]').fill('7');
    await bf.locator('[data-presence-f="floor"]').selectOption('f-2');
    await expect(bf.locator('[data-presence-f="zone"] option[value="z-meet"]')).toHaveCount(1);
    await bf.locator('[data-presence-f="zone"]').selectOption('z-meet');
    await bf.locator('[data-presence-done]').click();
    // a network name on the existing Wi-Fi site
    await ed.locator('[data-presence-edit="wifi_f3"]').click();
    await ed.locator('[data-presence-form="wifi"] [data-presence-f="ssids"]').fill('Office-5G');
    await shot(page, 'places-editing');
    await ed.locator('[data-presence-places-save]').click();
    await expect(ed.locator('[data-presence-places-message]')).toBeVisible();
    expect(st.puts).toHaveLength(1);
    const body = st.puts[0] as { sites: { name: string; radius_m: number }[]; beacons: Record<string, unknown>[]; wifi_sites: Record<string, unknown>[] };
    expect(Object.keys(body).sort()).toEqual(['beacons', 'sites', 'wifi_sites']);
    expect(body.sites.map((s) => s.name)).toEqual(['המשרד', 'מחסן']);
    expect(body.sites[1].radius_m).toBe(80);
    expect(body.beacons[1]).toMatchObject({ name: 'חדר ישיבות', uuid: UUID, major: 1, minor: 7, site_id: 'site_main', floor_id: 'f-2', zone_id: 'z-meet' });
    expect(body.wifi_sites[0]).toMatchObject({ id: 'wifi_f3', add_ssids: ['Office-5G'], ssid_hashes: ['a'.repeat(64)] });
    // the stored names never come back: the editor shows a count only
    await expect(ed.locator('[data-presence-place="wifi:wifi_f3"]')).toContainText('2');
    await expect(ed).not.toContainText('Office-5G');
  });

  test('the thresholds: each a bounded number, the proximity, names on/off; a partial save', async ({ page }) => {
    const st = await mock(page);
    await open(page, '/system/diagnostics?tab=mobile&page=screen');
    const card = page.locator('system-presence system-presence-screen [data-presence-screen]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-presence-optout-count]')).toContainText('2');
    await card.locator('[data-presence-people="stale_minutes"]').fill('2');
    await expect(card.locator('[data-presence-screen-save] button')).toBeDisabled(); // below the range
    await card.locator('[data-presence-people="stale_minutes"]').fill('45');
    await card.locator('[data-presence-people="min_proximity"]').selectOption('immediate');
    await card.locator('[data-presence-people="show_names"]').click();
    await shot(page, 'screen-thresholds');
    await card.locator('[data-presence-screen-save]').click();
    await expect.poll(() => st.puts.length).toBe(1);
    expect(st.puts[0]).toEqual({ people: { stale_minutes: 45, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'immediate', show_names: false, refresh_seconds: 30 } });
    // the pages are a deep link: back to the general page
    await page.locator('system-presence [data-presence-page="general"]').click();
    await expect(page.locator('system-presence [data-presence-card]')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#/system/diagnostics?tab=mobile');
  });

  test('the person\'s own opt-out on the personal settings page', async ({ page }) => {
    const st = await mock(page);
    await open(page, '/system/notifications');
    const card = page.locator('presence-opt-out [data-presence-optout-card]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.locator('[data-presence-optout]').click();
    await expect.poll(() => st.optPuts).toEqual([{ opted_out: true }]);
    await shot(page, 'opt-out');
  });
});
