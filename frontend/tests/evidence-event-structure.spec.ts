import { test, expect, type APIRequestContext } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

// Owner form items 11 and 26 (round 9, 2026-09-26): the map card of an event page draws the floor's structure and
// objects; its "continue on the map" link opens the history map at the event instant with the structure in force then;
// the card's 3D opens from the event camera. The developer backend holds events only when the NVR delivers them, so
// this spec runs ONLY against a throwaway second instance (no NVR, its own data directory): SW_THROWAWAY_DB names that
// instance's smplwise.db, and the one synthetic event row is written there and removed at the end. The spec refuses a
// backend with an NVR configured. Run: SW_LIVE=1 SW_CHROME=1 SW_BASE_URL=http://127.0.0.1:4178/ SW_API_PORT=8098
// SW_THROWAWAY_DB=<data dir>/smplwise.db npx playwright test tests/evidence-event-structure.spec.ts --project=desktop
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const DB = process.env.SW_THROWAWAY_DB || '';
const ids = { site: '', building: '', floor: '', version: '', camera: '', anchor: '', event: '' };
let api: APIRequestContext;
const iso = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });

test.describe.serial('event page: the structure in force at the event (throwaway instance only)', () => {
  test.skip(process.env.SW_LIVE !== '1' || !DB, 'runs only against a throwaway instance: set SW_LIVE=1 and SW_THROWAWAY_DB');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    const health = await (await api.get('api/v1/health')).json();
    expect(health.nvr_configured, 'a throwaway instance has no NVR: this spec never runs against the developer backend').toBe(false);
    const stamp = iso();
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת אירוע ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה אירוע' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת אירוע', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    ids.camera = (await (await api.post('api/v1/cameras', { data: { channel: 41, alias: 'מצלמת אירוע' } })).json()).id;
    ids.anchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: ids.camera, x: 0.5, y: 0.5, rotation_degrees: 0, field_of_view_degrees: 90 } })).json()).id;
    expect(ids.camera && ids.anchor).toBeTruthy();
  });

  test.afterAll(async () => {
    if (ids.event && DB) {
      const db = new DatabaseSync(DB);
      try { db.prepare('DELETE FROM events WHERE id = ?').run(ids.event); } finally { db.close(); }
    }
    if (!api) return;
    try {
      if (ids.floor) await api.delete(`api/v1/floors/${ids.floor}?force=true`);
      if (ids.building) await api.delete(`api/v1/buildings/${ids.building}`);
      if (ids.site) await api.delete(`api/v1/sites/${ids.site}`);
      if (ids.camera) await api.delete(`api/v1/cameras/${ids.camera}`);
    } finally {
      await api.dispose();
    }
  });

  test('the event map draws the structure of the event instant; the history link and the 3D follow the event', async ({ page }) => {
    test.setTimeout(120_000);
    // with a chair (owner item 26: the objects show on the event page too)
    const chair = { id: 'echair', item_id: 'chair.basic', level_id: 'L0', position: [0.3, 0.5], rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} };
    const put = async (walls: ReturnType<typeof WALL>[], openings: unknown[] = []) => {
      const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
      expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, walls, openings, objects: [chair] }, base_revision: g.geometry.revision } })).status()).toBe(200);
      expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    };
    const door = { id: 'ed1', wall_id: 'ew1', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} };
    const first = [WALL('ew1', [[0.1, 0.2], [0.9, 0.2]]), WALL('ew2', [[0.1, 0.2], [0.1, 0.8]])];
    await put(first, [door]);
    await page.waitForTimeout(1100);
    // the event, a second after the first structure and a second before the second one
    const at = new Date();
    ids.event = randomBytes(8).toString('hex');
    const db = new DatabaseSync(DB);
    try {
      db.prepare('INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(ids.event, 'alertstream', 'VMD', 'motion', ids.camera, 41, iso(at), iso(at), iso(at), 'inactive', 1, 'info', 'measured', '{}', `r9-${ids.event}`, iso(at));
    } finally {
      db.close();
    }
    await page.waitForTimeout(1100);
    await put([...first, WALL('later', [[0.3, 0.7], [0.8, 0.7]])], [door]);

    const detail = await (await api.get(`api/v1/events/${ids.event}`)).json();
    expect(detail.location).toMatchObject({ floor_id: ids.floor, anchor_id: ids.anchor, has_plan: true });
    await page.goto(`/?design=a#/investigate/events/${ids.event}`);
    const host = page.locator('investigate-event-detail');
    const walls = host.locator('sw-plan-canvas [data-structure] [data-wall]');
    await expect(walls.first()).toBeAttached({ timeout: 30000 });
    // the card is the floor as it is now (the camera's current anchor, the current structure - round 9 finding: the later
    // wall is drawn here too); the structure of the event instant is the history map's, below
    await expect(host.locator('sw-plan-canvas [data-wall="ew1"]')).toHaveCount(2); // cut by its door
    await expect(host.locator('sw-plan-canvas [data-wall="ew2"]')).toHaveCount(1);
    await expect(host.locator('sw-plan-canvas [data-opening="ed1"][data-kind="door"]')).toHaveCount(1);
    await expect(host.locator('sw-plan-canvas [data-object="echair"]')).toHaveCount(1);
    await expect(host.locator(`sw-plan-canvas g.marker[data-id="${ids.anchor}"]`)).toHaveCount(1);

    // the 3D of the card opens from the event camera (owner item 68's mechanics; the real NVR event stays the owner's)
    const toggle = host.locator('sw-button[data-event-3d-toggle]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 15000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-event-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).toHaveAttribute('data-preset', 'camera');
    await expect(el).toHaveAttribute('data-selected', ids.anchor);
    await toggle.click();
    await expect(host.locator('sw-plan-canvas')).toBeAttached();

    // "continue on the map": the history map at the event instant, with the structure in force then (item 17's mechanics)
    await host.locator('[data-history-map]').first().click();
    await expect(page).toHaveURL(new RegExp(`/investigate/floors/${ids.floor}\\?t=`)); // the floor's history map at t
    const hist = page.locator('investigate-history-map sw-plan-canvas');
    await expect(hist.locator('[data-wall]').first()).toBeAttached({ timeout: 30000 });
    await expect(hist.locator('[data-wall]')).toHaveCount(3);
    await expect(hist.locator('[data-wall="later"]')).toHaveCount(0);
  });
});
