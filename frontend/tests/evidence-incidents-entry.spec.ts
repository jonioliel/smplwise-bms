import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { DEMO_ALARM } from '../src/fixtures/alarm-demo';

// CR-LIVEEVENT100 entry points (T1 manual / T4 / F-03 quota): the alarm screen's "פתח אירוע חי", the map card's "פתח אירוע חי כאן", and
// the tile's quota-full state. The REAL build against mocked routes (fake data only); nothing is armed, opened or moved anywhere.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-incidents-entry.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/liveevent-100');
const NOW = '2026-10-24T10:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const INCIDENT = {
  id: 'i7', status: 'open', source: 'manual', source_ref: null, source_label: 'פתיחה ידנית', title: 'אירוע ידני · חניון', building_id: 'b1', building_name: 'בניין א',
  floor_id: 'f1', floor_name: 'קומה 1', anchor_id: 'a1', x: 0.4, y: 0.4, zone: null, opened_at: NOW, opened_by: 'gen', opened_by_name: 'דנה', acked_at: null, acked_by: null,
  closed_at: null, closed_by: null, close_note: null, event_label: null, steps: [], pending: [], can_ack: true, can_case: false, can_audit: false, can_configure: false,
  settings: { 'incident.max_live': 4, 'incident.max_live_phone': 1, 'incident.refresh_s': 60, 'incident.snapshot_refresh_s': 10, 'incident.hidden_stop_s': 30, 'incident.header_clock': true }, policy: 'x',
};

async function install(page: Page, perms: string[], module = true) {
  const opened: unknown[] = [];
  await installGeneratorMock(page, { perms, count: 0, modules: { tickets: false, incidents: module } as unknown as { tickets: boolean } });
  await page.route('**/api/v1/alarm/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'alarm/panels') return json(route, DEMO_ALARM);
    if (p === 'alarm/me') return json(route, { arm_policy: 'none', disarm_policy: 'none', pin_set: false, pin_set_at: null, code_mode: 'panel' });
    return json(route, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'm', details: {} }, 404);
  });
  await page.route('**/api/v1/incidents**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'incidents/summary') return json(route, { enabled: module, open: 0, latest_id: null, red_dot: 'active' });
    if (p === 'incidents' && req.method() === 'POST') {
      opened.push(req.postDataJSON());
      return json(route, { incident: INCIDENT, merged: false }, 201);
    }
    if (p === 'incidents/i7') return json(route, INCIDENT);
    if (p === 'incidents/i7/cameras') return json(route, { cameras: [{ camera_id: 'c1', name: 'חניון', relation: 'same_zone', relation_label: 'אותו חדר', distance: 0 }, { camera_id: 'c2', name: 'מסדרון', relation: 'nearby', relation_label: 'בקרבת מקום', distance: 0.1 }], withheld: false, max_live: 4, max_live_phone: 1, snapshot_refresh_s: 10 });
    if (p === 'incidents/i7/doors') return json(route, { doors: [], state_visible: true, window: { from: NOW, to: NOW }, window_s: 600 });
    return json(route, { code: 'incident_not_found', user_message: 'x', retryable: false, correlation_id: 'm', details: {} }, 404);
  });
  return opened;
}

test.describe('live event entry points', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('alarm screen: "פתח אירוע חי" opens an incident for the panel and goes there (module on + events.ack)', async ({ page }) => {
    const opened = await install(page, ['alarm.view', 'events.read', 'events.ack']);
    await page.goto('about:blank');
    await page.goto(url('/security/alarm'));
    const btn = page.locator('sw-app security-alarm [data-alarm-incident]');
    await expect(btn).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `alarm-button-${test.info().project.name}.png`) });
    await btn.click();
    await expect.poll(() => opened.length).toBe(1);
    expect((opened[0] as { alarm_panel?: string }).alarm_panel).toBe(DEMO_ALARM.panels[0].entity_id);
    await expect(page).toHaveURL(/#\/investigate\/incidents\/i7/);
    await expect(page.locator('sw-app investigate-incidents [data-incident="i7"]')).toBeVisible();
  });

  test('alarm screen: no button while the module is off, or without events.ack', async ({ page }) => {
    await install(page, ['alarm.view', 'events.read', 'events.ack'], false);
    await page.goto('about:blank');
    await page.goto(url('/security/alarm'));
    await expect(page.locator('sw-app security-alarm [data-alarm-pin]')).toBeVisible();
    await expect(page.locator('sw-app security-alarm [data-alarm-incident]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await install(page, ['alarm.view', 'events.read']);
    await page.goto('about:blank');
    await page.goto(url('/security/alarm'));
    await expect(page.locator('sw-app security-alarm [data-alarm-pin]')).toBeVisible();
    await expect(page.locator('sw-app security-alarm [data-alarm-incident]')).toHaveCount(0);
  });

  test('map card: "פתח אירוע חי כאן" opens a manual incident at the marker and goes there', async ({ page }) => {
    const opened = await install(page, ['map.read', 'events.read', 'events.ack', 'video.live']);
    const floor = { id: 'f1', building_id: 'b1', name: 'קומה 1', level: 1, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'pv1', plan_width_px: 1000,
      plan_height_px: 700, draft_version_id: null, anchor_count: 1, camera_count: 1, updated_at: NOW };
    const building = { id: 'b1', site_id: 's1', name: 'בניין א', sort_order: 0, updated_at: NOW, floors: [floor] };
    const site = { id: 's1', name: 'אתר', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: NOW, buildings: [building] };
    const camera = { id: 'c1', recorder_id: 'r1', channel: 1, name: 'חניון', name_source: 'חניון', alias: null, enabled: true, status: 'online', recorder_enabled: true };
    await page.route('**/api/v1/sites**', (route) => json(route, { sites: [site], can_create_site: false }));
    await page.route('**/api/v1/floors/f1/map**', (route) => json(route, {
      floor, building, site, needs_alignment: false, zones: [], cameras: [camera], permissions: { edit: false, publish: false, import: false, structure: false },
      plan: { id: 'pv1', floor_id: 'f1', asset_id: 'x', page: 1, rotation: 0, crop: null, width_px: 1000, height_px: 700, scale_m_per_px: null, status: 'published', revision: 1, notes: '', created_at: NOW, published_at: NOW, image_url: 'api/v1/none.png', render_mode: 'source' },
      anchors: [{ id: 'a1', floor_id: 'f1', plan_version_id: 'pv1', resource_type: 'camera', resource_id: 'c1', position: { x: 0.4, y: 0.4 }, rotation_degrees: 0, field_of_view_degrees: 90,
        layer_id: 'cameras', label: null, revision: 1, effective_from: NOW, effective_to: null, updated_at: NOW, camera }],
    }));
    await page.goto('about:blank');
    await page.goto(url('/explore/floors/f1'));
    const map = page.locator('sw-app explore-floor-map');
    await expect(map.locator('sw-plan-canvas')).toBeAttached();
    await map.locator('sw-plan-canvas').evaluate((el) => el.dispatchEvent(new CustomEvent('marker-select', { detail: { id: 'a1' }, bubbles: true, composed: true })));
    const btn = map.locator('[data-map-incident]');
    await expect(btn).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `map-open-here-${test.info().project.name}.png`) });
    await btn.click();
    await expect.poll(() => opened.length).toBe(1);
    expect(opened[0]).toEqual({ anchor_id: 'a1' });
    await expect(page).toHaveURL(/#\/investigate\/incidents\/i7/);
  });

  test('quota full: a tile the relay refuses (4429) shows "המכסה מלאה" and its snapshot; the other tiles are untouched', async ({ page }) => {
    await install(page, ['events.read', 'events.ack', 'video.live']);
    await page.goto('about:blank');
    await page.goto(url('/investigate/incidents/i7'));
    const scr = page.locator('sw-app investigate-incidents');
    await expect(scr.locator('[data-incident-tile="c1"]')).toHaveAttribute('data-live', 'true');
    // the player's own event for the relay's `remote_live_cap` (sw-live-player capRefused)
    await scr.locator('[data-incident-tile="c1"] sw-camera-tile').evaluate((el) => el.dispatchEvent(new CustomEvent('player-status', {
      detail: { status: 'error', code: 'remote_live_cap', max: 2 }, bubbles: true, composed: true })));
    await expect(scr.locator('[data-incident-cap="c1"]')).toBeVisible();
    await expect(scr.locator('[data-incident-cap="c1"]')).toHaveAttribute('title', /מכסת הזרמים/);
    await expect(scr.locator('[data-incident-tile="c1"]')).toHaveAttribute('data-live', 'false');
    if ((page.viewportSize()?.width ?? 0) >= 1200) await expect(scr.locator('[data-incident-tile="c2"]')).toHaveAttribute('data-live', 'true'); // the phone budget is 1
    await page.screenshot({ path: path.join(OUT, `quota-${test.info().project.name}.png`) });
    // tried again after REFUSED_MS (10 s)
    await expect(scr.locator('[data-incident-cap="c1"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(scr.locator('[data-incident-tile="c1"]')).toHaveAttribute('data-live', 'true');
  });
});
