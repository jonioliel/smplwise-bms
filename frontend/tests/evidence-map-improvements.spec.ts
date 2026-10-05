import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Evidence for the three investigation / map improvements (M043 suggested adjacent cameras + Back to the selection,
// M047 review spotlights + manual grouping, M064 route ranking through floor connectors + one-click confirm into a
// case) against a THROWAWAY developer backend (SW_API_PORT) whose database is SW_DB_PATH: the spec seeds two floors
// with plans, rooms, cameras, stairs linked between the floors, and writes the day's events into the database
// directly (a throwaway instance has no NVR). SW_SHOTS=<dir> saves screenshots there (docs/evidence/
// investigate-map-improvements/<before|after>); SW_SHOT_TAG=before runs the baseline build: screenshots only, the
// assertions of the new behaviour are skipped. Runs only with SW_LIVE=1 and SW_MAPIMP=1.
//
//   SW_PORT=8372 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> -m smplwise   (in smplwise_vms/backend)
//   SW_LIVE=1 SW_MAPIMP=1 SW_API_PORT=8372 SW_DB_PATH=<dir>/smplwise.db SW_BASE_URL=http://127.0.0.1:4190/ SW_SHOTS=... \
//     npx playwright test tests/evidence-map-improvements.spec.ts --workers=1
const SHOTS = process.env.SW_SHOTS ?? '';
const AFTER = process.env.SW_SHOT_TAG !== 'before';
const TAG = `mapimp-${Date.now().toString(36)}`;
// a 480x300 synthetic plan (two rooms), so the throwaway floors have a published map
const PLAN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAeAAAAEsCAIAAACUnPcNAAADhElEQVR42u3asQmAMBBA0VMyatqskMIVbJ1TwcrWKo0RI7zXa3GEzxGd9uMMAMYzGwGAQAMg0AACDYBAAwg0AAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAAAg2AQAPQlp48nEs1QYC2bV1s0ADhigMAgQYQaAAEGoB49y+O6PexEp67/1bkKDLCObRBA4QrDgAEGkCgjQBAoAEQaACBBkCgAQQaAIEGQKABBBoAgQYQaAAEGgCBBhBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGQKABBBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAIEGQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAIEGQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBpAoAEQaAAEGkCgARBoAIEGQKABEGiAf0h9X5dLNVMAGzSAQAMg0ADEG3fQ27qYKV/xCQQbNAACDSDQAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADCLQRAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADINAAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAACDTA6FLf1+VSzZQROIrYoAEQaACBBkCgARBogL+Z9uM0BQAbNAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAANF7ysGBzW5CXVAAAAAElFTkSuQmCC',
  'base64',
);

interface Seed {
  floor0: string;
  floor1: string;
  lobbyAnchor: string;
  lobbyCam: string;
  hallCam: string;
  routeEvent: string;
}

const SQ = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function ok<T = Record<string, unknown>>(p: Promise<{ ok(): boolean; json(): Promise<unknown>; status(): number; text(): Promise<string> }>): Promise<T> {
  const r = await p;
  if (!r.ok()) throw new Error(`${r.status()} ${await r.text()}`);
  return (await r.json()) as T;
}

/** Two floors with plans, rooms, cameras and stairs linked between them; the day's events written into the database. */
async function seed(request: APIRequestContext): Promise<Seed> {
  await request.get('/api/v1/me');
  const site = await ok(request.post('/api/v1/sites', { data: { name: `אתר ${TAG}` } }));
  const bld = await ok(request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'מבנה ראשי' } }));
  const f0 = await ok(request.post(`/api/v1/buildings/${bld.id}/floors`, { data: { name: 'קומת קרקע', level: 0 } }));
  const f1 = await ok(request.post(`/api/v1/buildings/${bld.id}/floors`, { data: { name: 'קומה 1', level: 1 } }));
  const plan = async (floor: string) => {
    const asset = await ok(request.post(`/api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: PLAN_PNG } } }));
    const version = await ok(request.post(`/api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } }));
    await ok(request.post(`/api/v1/plan-versions/${version.id}/publish`));
    return version.id as string;
  };
  const v0 = await plan(f0.id as string);
  const v1 = await plan(f1.id as string);
  const cam = async (channel: number, alias: string) => (await ok(request.post('/api/v1/cameras', { data: { channel, alias } }))).id as string;
  const lobby = await cam(31, 'לובי');
  const lobby2 = await cam(32, 'דלפק');
  const hall = await cam(33, 'מסדרון');
  const yard = await cam(34, 'חצר');
  const store = await cam(35, 'מחסן');
  const up = await cam(36, 'חדר מדרגות 1');
  const upFar = await cam(37, 'אגף מזרחי 1');
  const place = async (floor: string, id: string, x: number, y: number, rot = 90) =>
    (await ok(request.post(`/api/v1/floors/${floor}/anchors`, { data: { resource_type: 'camera', resource_id: id, x, y, rotation_degrees: rot, field_of_view_degrees: 70 } }))).id as string;
  const lobbyAnchor = await place(f0.id as string, lobby, 0.2, 0.3);
  await place(f0.id as string, lobby2, 0.4, 0.4, 200);
  await place(f0.id as string, hall, 0.65, 0.3, 180);
  await place(f0.id as string, yard, 0.06, 0.42, 0); // outside every room (the lobby starts at 0.1), 0.184 from the lobby camera: "nearby"
  await place(f0.id as string, store, 0.88, 0.85, 270);
  await place(f1.id as string, up, 0.42, 0.5, 120);
  await place(f1.id as string, upFar, 0.9, 0.2, 180);
  const zone = async (floor: string, name: string, polygon: { x: number; y: number }[], kind = 'room') => ok(request.post(`/api/v1/floors/${floor}/zones`, { data: { name, kind, polygon } }));
  await zone(f0.id as string, 'לובי', SQ(0.1, 0.1, 0.5, 0.55));
  await zone(f0.id as string, 'מסדרון', SQ(0.5, 0.1, 0.8, 0.55), 'corridor');
  await zone(f0.id as string, 'מחסן', SQ(0.75, 0.7, 0.98, 0.98));
  await zone(f1.id as string, 'חדר מדרגות', SQ(0.3, 0.4, 0.55, 0.65));
  // stairs in the lobby, linked to floor 1, published on both floors
  const g = await ok(request.get(`/api/v1/plan-versions/${v0}/geometry?draft=true`));
  const stairs = { id: 'st-main', kind: 'stairs', level_from: 'L0', level_to: null, floor_ids: [], polyline: [[0.3, 0.47], [0.4, 0.47]], width_m: 1.2, label: 'מדרגות ראשיות', object_id: null, source: 'manual', external_ids: {} };
  await ok(request.put(`/api/v1/plan-versions/${v0}/geometry`, { data: { doc: { ...(g.doc as Record<string, unknown>), connectors: [stairs] }, base_revision: (g.geometry as { revision: number }).revision } }));
  await ok(request.post(`/api/v1/plan-versions/${v0}/geometry/link`, { data: { connector_id: 'st-main', floor_id: f1.id } }));
  await ok(request.post(`/api/v1/plan-versions/${v0}/geometry/publish`));
  await ok(request.post(`/api/v1/plan-versions/${v1}/geometry/publish`));
  // the day's events (a throwaway instance has no NVR to produce them)
  const db = new DatabaseSync(process.env.SW_DB_PATH as string);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?, 'alertstream', ?, ?, ?, ?, ?, NULL, ?, 'inactive', 1, ?, 'measured', '{}', ?, ?)",
  );
  const now = Date.now();
  const ev = (id: string, camId: string, channel: number, minutesAgo: number, type = 'motion', severity = 'info', raw = 'VMD') => {
    const at = iso(new Date(now - minutesAgo * 60_000));
    ins.run(`${TAG}-${id}`, raw, type, camId, channel, at, at, severity, `${TAG}:${id}`, at);
    return `${TAG}-${id}`;
  };
  // the lobby: three adjacent events (motion, motion, person) = one window lit by "זיהוי חכם"; a quieter pair later
  ev('l1', lobby, 31, 48);
  ev('l2', lobby, 31, 47);
  ev('l3', lobby, 31, 46, 'person', 'alert', 'fielddetection');
  ev('l4', lobby, 31, 20);
  ev('l5', lobby, 31, 19);
  ev('h1', hall, 33, 45);
  ev('y1', yard, 34, 30);
  ev('s1', store, 35, 12, 'offline', 'critical', 'videoloss');
  const routeEvent = ev('r0', lobby, 31, 10, 'person', 'alert', 'fielddetection');
  ev('u1', up, 36, 9.3);
  db.close();
  return { floor0: f0.id as string, floor1: f1.id as string, lobbyAnchor, lobbyCam: lobby, hallCam: hall, routeEvent };
}

async function open(page: Page, hash: string, query = '') {
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string, project: string, fullPage = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${project}.png`), fullPage });
}

test.describe('investigation / map improvements (M043, M047, M064)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_MAPIMP !== '1' || !process.env.SW_DB_PATH, 'set SW_LIVE=1 SW_MAPIMP=1 SW_DB_PATH against a throwaway backend');
  test.describe.configure({ mode: 'serial' });
  let seeded: Seed;

  test.beforeAll(async ({ request }) => {
    const seedFile = path.join(path.dirname(process.env.SW_DB_PATH as string), 'mapimp-seed.json');
    // one seed per throwaway database: the three projects (desktop / tablet / mobile) reuse it
    if (fs.existsSync(seedFile)) seeded = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as Seed;
    else {
      seeded = await seed(request);
      fs.writeFileSync(seedFile, JSON.stringify(seeded));
    }
  });

  test('M043: suggested adjacent cameras on the map and Back to the same selection', async ({ page }, testInfo) => {
    const p = testInfo.project.name;
    await open(page, `/explore/floors/${seeded.floor0}`);
    const viewer = page.locator('explore-floor-map');
    await expect(viewer.locator('[data-multi-toggle]')).toBeVisible({ timeout: 20000 });
    await viewer.locator('[data-multi-toggle]').click();
    const bar = viewer.locator('[data-pickbar]');
    await expect(bar).toBeVisible();
    await viewer.locator(`sw-plan-canvas g.marker[data-id="${seeded.lobbyAnchor}"]`).dispatchEvent('click');
    await expect(bar.locator('sw-chip[selected]:not([data-room-chip])')).toHaveCount(1);
    if (AFTER) {
      // the lobby pick suggests the desk (same room), the corridor (shares a wall) and the yard (within reach); never the store
      const chips = bar.locator('[data-pick-suggest-chip]');
      await expect(chips).toHaveCount(3);
      await expect(chips.nth(0)).toHaveAttribute('data-relation', 'same_zone');
      await expect(chips.nth(1)).toHaveAttribute('data-relation', 'adjacent_zone');
      await expect(chips.nth(2)).toHaveAttribute('data-relation', 'nearby');
      await expect(bar.locator('[data-pick-suggest]')).toContainText('מוצע בסמוך');
    }
    await shot(page, 'm043-01-suggestions', p);
    if (AFTER) {
      await bar.locator('[data-pick-suggest-chip]').nth(1).click(); // the corridor joins the selection
      await expect(bar.locator('sw-chip[selected]:not([data-room-chip])')).toHaveCount(2);
      await expect(page).toHaveURL(/picks=/);
      await expect(bar.locator('[data-pick-suggest-chip]')).toHaveCount(2, { timeout: 5000 }); // the corridor is picked now: no longer offered
    }
    await shot(page, 'm043-02-picked', p);
    // synchronized playback with the picks, then Back: the same floor, the same picks, the mode still on
    await viewer.locator('[data-pick-sync]').click();
    await expect(page).toHaveURL(/#\/investigate\/playback\?camera=/);
    await expect(page.locator('investigate-playback')).toBeVisible();
    if (AFTER) await expect(page.locator('investigate-playback [data-back-to-map]')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot(page, 'm043-03-playback', p);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#/explore/floors/${seeded.floor0}`));
    await page.waitForTimeout(1500);
    if (AFTER) {
      await expect(viewer.locator('[data-pickbar]')).toBeVisible({ timeout: 15000 });
      await expect(viewer.locator('[data-pickbar] sw-chip[selected]:not([data-room-chip])')).toHaveCount(2);
      await expect(viewer.locator('sw-plan-canvas g.marker.selected')).toHaveCount(2);
    }
    await shot(page, 'm043-04-back', p);
    if (p === 'desktop') {
      await open(page, `/explore/floors/${seeded.floor0}`, '&skin=bubble&scheme=dark');
      await viewer.locator('[data-multi-toggle]').click();
      await viewer.locator(`sw-plan-canvas g.marker[data-id="${seeded.lobbyAnchor}"]`).dispatchEvent('click');
      await expect(viewer.locator('[data-pickbar] sw-chip[selected]:not([data-room-chip])')).toHaveCount(1);
      await shot(page, 'm043-05-suggestions-bubble-dark', p);
    }
  });

  test('M047: spotlights over the review windows, raw events behind the summary, a split and its undo', async ({ page }, testInfo) => {
    const p = testInfo.project.name;
    await open(page, '/investigate/reviews');
    const centre = page.locator('investigate-events');
    await expect(centre.locator('sw-table')).toBeVisible({ timeout: 20000 });
    const rows = centre.locator('sw-table tbody tr');
    await expect.poll(async () => rows.count(), { timeout: 15000 }).toBeGreaterThan(2);
    if (AFTER) {
      await expect(centre.locator('[data-window-spotlight]').first()).toBeVisible();
      await expect(centre.locator('[data-window-spotlight-only]')).toBeVisible();
    }
    await shot(page, 'm047-01-windows', p);
    // the lit lobby window (×3): rules explained, the raw events behind the summary
    const lit = centre.locator('sw-table tbody tr', { hasText: '×3' }).first();
    await lit.click();
    const drawer = centre.locator('sw-drawer');
    await expect(drawer).toBeVisible();
    if (AFTER) {
      await expect(drawer.locator('[data-spotlight-rules]')).toContainText('זיהוי חכם');
      await expect(drawer.locator('[data-window-events]')).toHaveCount(0);
      await shot(page, 'm047-02-drawer-summary', p);
      await drawer.locator('[data-window-raw-toggle]').click();
      await expect(drawer.locator('[data-window-events] .wrow')).toHaveCount(3);
    }
    await shot(page, 'm047-03-drawer-events', p);
    if (AFTER && p === 'desktop') {
      // split the person event off: its own window, marked manual; then undo
      const ticks = drawer.locator('[data-window-tick]');
      await ticks.last().check();
      await drawer.locator('[data-window-split]').click();
      await expect(centre.locator('sw-drawer')).toHaveCount(0);
      await expect(centre.locator('[data-window-manual]').first()).toBeVisible({ timeout: 15000 });
      await shot(page, 'm047-04-split', p);
      await centre.locator('sw-table tbody tr', { hasText: 'קיבוץ ידני' }).first().click();
      await expect(centre.locator('sw-drawer [data-window-manual-badge]')).toBeVisible();
      if (!(await centre.locator('sw-drawer [data-window-events]').count())) await centre.locator('sw-drawer [data-window-raw-toggle]').click();
      await expect(centre.locator('sw-drawer [data-window-ungroup]')).toBeVisible();
      await centre.locator('sw-drawer [data-window-ungroup]').click();
      await expect(centre.locator('[data-window-manual]')).toHaveCount(0, { timeout: 15000 });
      await expect(centre.locator('sw-table tbody tr', { hasText: '×3' }).first()).toBeVisible();
      // the spotlight filter leaves the lit windows only
      await centre.locator('[data-window-spotlight-only]').click();
      await expect.poll(async () => rows.count(), { timeout: 15000 }).toBe(3); // the lobby trio, the route's person event, the store's video loss
      await shot(page, 'm047-05-spotlights-only', p);
      await open(page, '/investigate/reviews', '&skin=bubble&scheme=dark');
      await expect(centre.locator('sw-table')).toBeVisible({ timeout: 20000 });
      await expect.poll(async () => rows.count(), { timeout: 15000 }).toBeGreaterThan(2);
      await shot(page, 'm047-06-windows-bubble-dark', p);
    }
  });

  test('M064: the route ranks a camera reached through the stairs and one click puts the route into a case', async ({ page, request }, testInfo) => {
    const p = testInfo.project.name;
    const route = (await (await request.get(`/api/v1/events/${seeded.routeEvent}/route`)).json()) as { suggestions: { name: string; relation: string }[] };
    if (AFTER) {
      expect(route.suggestions.map((s) => [s.name, s.relation])).toEqual([['דלפק', 'same_zone'], ['מסדרון', 'adjacent_zone'], ['חצר', 'nearby'], ['חדר מדרגות 1', 'via_connector']]);
    }
    await open(page, `/investigate/events/${seeded.routeEvent}`);
    const card = page.locator('investigate-event-detail [data-route]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.locator('[data-route-item]')).toHaveCount(4);
    await card.scrollIntoViewIfNeeded();
    if (AFTER) {
      await expect(card.locator('[data-route-item][data-relation="via_connector"]')).toContainText('מדרגות');
      await expect(card.locator('[data-route-confirm]')).toBeVisible();
    }
    await shot(page, 'm064-01-route', p, true);
    if (AFTER) {
      const select = card.locator('[data-route-case]');
      const options = await select.locator('option').count();
      if (options > 1) await select.selectOption({ index: 1 }); // the case the desktop run created: no case per viewport
      await card.locator('[data-route-confirm-button]').click();
      await expect(card.locator('[data-route-done]')).toContainText('נוסף לתיק', { timeout: 15000 });
      await shot(page, 'm064-02-confirmed', p, true);
      const cases = (await (await request.get('/api/v1/cases?q=מסלול')).json()) as { cases: { id: string; counts: { events: number; clips: number } }[] };
      expect(cases.cases.length).toBeGreaterThan(0);
      expect(cases.cases[0].counts.events).toBe(1);
      expect(cases.cases[0].counts.clips).toBeGreaterThanOrEqual(4);
      if (p === 'desktop') {
        await open(page, `/investigate/events/${seeded.routeEvent}`, '&skin=bubble&scheme=dark');
        await expect(card.locator('[data-route-item]')).toHaveCount(4, { timeout: 20000 });
        await card.scrollIntoViewIfNeeded();
        await shot(page, 'm064-03-route-bubble-dark', p, true);
      }
    }
  });
});
