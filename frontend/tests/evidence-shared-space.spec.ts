import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared space (CR-009, T093, owner 2026-09-29), the owner's flow against a running developer backend: the sports hall is
// drawn twice today - on floor -1 (the court) and on floor 0 (the tribunes' top, WIDER than the court) - as two unrelated
// rooms. From floor 0's editor "הפוך לחלל משותף" converts them (two-outline model): floor 0 keeps its own wider outline
// and its walls, only the duplicate content leaves it; the court's content shows on both floors with the chip "רצפה
// בקומה -1"; floor -1 draws the upper level's outline ("מפלס עליון") with the upper rows inside it, floor 0 the court's
// ("מפלס תחתון"). The tribune moved from floor 0 lands in floor -1's draft, and publishing floor 0 publishes it there
// (owner answer 1). The 3D of both floors, and הגדרות › מפה opening the map in 3D. The spec builds its own site /
// building / two floors and removes them. Runs only with SW_LIVE=1 (backend behind the preview proxy). Screenshots go
// to SW_SHOT_DIR (default private-evidence), named "wide-*".
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.SW_SHOT_DIR || path.resolve(HERE, '..', '..', 'private-evidence', 'shared-space');
const ids = { site: '', building: '', fm1: '', f0: '', vm1: '', v0: '', hall: '', dup: '' };
let api: APIRequestContext;
let defaultView = '2d';
const ed = 'explore-plan-editor';
/** The court (floor -1) and the upper level (floor 0): the hall is 2 m wider on each side upstairs. */
const HALL = [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.7 }];
const WIDE = [{ x: 0.15, y: 0.15 }, { x: 0.65, y: 0.15 }, { x: 0.65, y: 0.75 }, { x: 0.15, y: 0.75 }];

type Obj = { id: string; position: [number, number]; shared?: { home_floor_id: string } };
type Draft = { geometry: { revision: number }; doc: Record<string, unknown> & { walls: { id: string; shared?: unknown }[]; objects: Obj[]; shared_spaces?: { role: string; label: string; other_label?: string }[] } };
const draft = async (version: string) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as Draft;
const published = async (version: string) => (await (await api.get(`api/v1/plan-versions/${version}/geometry`)).json()) as Draft;
const wall = (id: string, a: [number, number], b: [number, number], kind = 'interior') => ({ id, level_id: 'L0', polyline: [a, b], thickness_m: 0.2, height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false });
const ring = (prefix: string, poly: { x: number; y: number }[]) => poly.map((p, i) => wall(`${prefix}${i + 1}`, [p.x, p.y], [poly[(i + 1) % poly.length].x, poly[(i + 1) % poly.length].y], 'exterior'));
const obj = (id: string, pos: [number, number], item = 'chair.basic', extra: Record<string, unknown> = {}) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.5, d_m: 0.5, h_m: 0.9 }, z_m: 0,
  params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, ...extra });

async function save(version: string, fields: Record<string, unknown>) {
  const g = await draft(version);
  const r = await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc: { ...g.doc, ...fields }, base_revision: g.geometry.revision } });
  expect(r.status(), await r.text()).toBe(200);
}

async function clickPlan(page: Page, x: number, y: number) {
  const canvas = page.locator(`${ed} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `wide-${name}.png`) });
}

async function open3d(page: Page, floor: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/${floor}`);
  await expect(page.locator('sw-plan-canvas')).toHaveCount(1, { timeout: 20000 });
  await page.locator('explore-floor-map').getByRole('button', { name: /3D/ }).first().click();
  await expect(page.locator('[data-floor-3d]')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(4000); // the first frames of the scene
}

test.describe.serial('shared space: the hall on two floors, wider upstairs (CR-009)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    defaultView = (await (await api.get('api/v1/settings')).json()).settings['map.default_view'] ?? '2d';
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת חלל משותף ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'בניין ספורט' } })).json()).id;
    ids.fm1 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה -1', level: -1 } })).json()).id;
    ids.f0 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה 0', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const [floor, key] of [[ids.fm1, 'vm1'], [ids.f0, 'v0']] as const) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      ids[key] = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${ids[key]}/publish`)).status()).toBe(200);
      expect((await api.patch(`api/v1/plan-versions/${ids[key]}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 40 }] } })).status()).toBe(200);
    }
    // floor -1: the court with its walls, a tribune on it and the top rows that stand in the upper level's ring
    ids.hall = (await (await api.post(`api/v1/floors/${ids.fm1}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: HALL } })).json()).id;
    ids.dup = (await (await api.post(`api/v1/floors/${ids.f0}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: WIDE } })).json()).id;
    await save(ids.vm1, {
      walls: [...ring('h', HALL), wall('corr', [0.8, 0.1], [0.8, 0.9])],
      objects: [obj('trib', [0.4, 0.3], 'tribune.stepped', { size: { w_m: 10, d_m: 3, h_m: 2.5 }, params: { rows: 6 } }), obj('rows-up', [0.625, 0.45], 'chair.basic', { size: { w_m: 0.8, d_m: 6, h_m: 0.9 } })],
    });
    expect((await api.post(`api/v1/plan-versions/${ids.vm1}/geometry/publish`)).status()).toBe(200);
    // floor 0: its own wider outline and walls, the court drawn again inside it (a duplicate line and a seat)
    await save(ids.v0, { walls: [...ring('u', WIDE), wall('d-in', [0.3, 0.45], [0.5, 0.45]), wall('lobby', [0.8, 0.1], [0.8, 0.9])], objects: [obj('dup-seat', [0.3, 0.6])] });
    expect((await api.post(`api/v1/plan-versions/${ids.v0}/geometry/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
    if ((await api.patch('api/v1/settings', { data: { 'map.default_view': defaultView } })).status() !== 200) failures.push('map.default_view restore');
    for (const [what, p] of [['floor -1', `api/v1/floors/${ids.fm1}?force=true`], ['floor 0', `api/v1/floors/${ids.f0}?force=true`], ['building', `api/v1/buildings/${ids.building}`], ['site', `api/v1/sites/${ids.site}`]] as const) {
      try {
        const status = (await api.delete(p)).status();
        if (status !== 204) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    }
    await api.dispose();
    expect(failures, 'test data removed').toEqual([]);
  });

  test('convert from floor 0: its outline and walls stay, the court\'s content shows on both floors, each floor draws the other\'s outline', async ({ page }) => {
    // 1. floor 0's editor: the duplicate room, "הפוך לחלל משותף"; the preview keeps floor 0's outline
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-tool="zones"]`).click();
    await page.locator(`${ed} [data-zone-row]`, { hasText: 'אולם ספורט' }).click();
    await page.locator(`${ed} [data-zone-share]`).click();
    const dlg = page.locator(`${ed} [data-share-dialog]`);
    await expect(dlg.locator('[data-share-floor]')).toBeVisible({ timeout: 15000 });
    await expect(dlg.locator('[data-share-home]')).toHaveValue('there'); // the court's floor keeps the room (decision 4)
    await expect(dlg.locator('[data-share-outline]')).toContainText('נשאר', { timeout: 15000 });
    await expect(dlg.locator('[data-share-removed]')).toContainText('עצם אחד');
    await expect(dlg.locator('[data-share-alignment]')).toHaveCount(0);
    await shot(page, '01-share-preview-floor0');
    await dlg.locator('[data-share-apply]').click();
    await expect(dlg).toHaveCount(0, { timeout: 15000 });
    const d0 = await draft(ids.v0);
    expect(d0.doc.walls.filter((w) => !w.shared).map((w) => w.id).sort()).toEqual(['lobby', 'u1', 'u2', 'u3', 'u4']);
    expect(d0.doc.walls.some((w) => w.shared)).toBe(false); // walls are each floor's own
    expect(d0.doc.objects.some((o) => o.id === 'dup-seat')).toBe(false);
    expect(d0.doc.shared_spaces?.[0]).toMatchObject({ role: 'mirror', label: 'רצפה בקומה -1', other_label: 'מפלס תחתון' });
    // 2. floor 0's editor: the court's content, its chip, the court's outline dashed
    await expect(page.locator(`${ed} sw-plan-canvas [data-object="${ids.fm1}:trib"]`)).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator(`${ed} sw-plan-canvas [data-object="${ids.fm1}:rows-up"]`)).toHaveCount(1);
    // floor 0 keeps its own room (the outline): the chip is on it
    await expect(page.locator(`${ed} sw-plan-canvas [data-zone-chip="${ids.dup}"]`)).toContainText('רצפה בקומה');
    await expect(page.locator(`${ed} sw-plan-canvas [data-shared-outline="${ids.hall}"][data-shared-level="lower"]`)).toContainText('מפלס תחתון');
    await shot(page, '02-floor0-editor');
    // 3. move the tribune from floor 0: the select tool, a press on it, the arrow keys (Shift = 10 cm)
    await page.locator(`${ed} [data-tool="select"]`).click();
    await clickPlan(page, 0.4, 0.3);
    await expect(page.locator(`${ed} [data-shared-hint]`)).toContainText('השינוי יופיע גם בקומה', { timeout: 10000 });
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => (await draft(ids.vm1)).doc.objects.find((o) => o.id === 'trib')?.position[0] ?? 0, { timeout: 20000 }).toBeGreaterThan(0.41);
    // 4. owner answer 1: floor 0's publish dialog counts the hall's change on floor -1 and publishes it there
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-publish]`).click({ timeout: 20000 });
    await expect(page.locator(`${ed} [data-geom-shared-pending]`)).toContainText('כולל שינויים בחלל המשותף', { timeout: 15000 });
    await expect(page.locator(`${ed} [data-geom-shared-pending]`)).toContainText('שינוי אחד');
    await shot(page, '03-floor0-publish-dialog');
    await page.locator(`${ed} [data-geom-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff]`)).toHaveCount(0, { timeout: 15000 });
    expect((await published(ids.vm1)).doc.objects.find((o) => o.id === 'trib')!.position[0]).toBeGreaterThan(0.41);
    // 5. floor -1's map: the wider upper level dashed and tinted, the upper rows inside it, the chip
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.fm1}`);
    await expect(page.locator(`sw-plan-canvas [data-shared-outline="${ids.hall}"][data-shared-level="upper"]`)).toContainText('מפלס עליון', { timeout: 20000 });
    await expect(page.locator('sw-plan-canvas [data-object="rows-up"]')).toHaveCount(1);
    await expect(page.locator(`sw-plan-canvas [data-zone-chip="${ids.hall}"]`)).toContainText('רצפה בקומה');
    await shot(page, '04-floor-1-map');
    // 6. floor 0's map: the hall's content, the court's outline dashed
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}`);
    await expect(page.locator(`sw-plan-canvas [data-object="${ids.fm1}:trib"]`)).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator(`sw-plan-canvas [data-shared-outline="${ids.hall}"][data-shared-level="lower"]`)).toHaveCount(1);
    await expect(page.locator(`sw-plan-canvas [data-zone-chip="${ids.dup}"]`)).toContainText('רצפה בקומה');
    await shot(page, '05-floor0-map');
  });

  test('3D of both floors from the two outlines, and הגדרות › מפה opens the map in 3D', async ({ page }) => {
    await open3d(page, ids.f0);
    await shot(page, '06-floor0-3d');
    await open3d(page, ids.fm1);
    await shot(page, '07-floor-1-3d');
    expect((await api.patch('api/v1/settings', { data: { 'map.default_view': '3d' } })).status()).toBe(200);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}`);
    await expect(page.locator('[data-floor-3d]')).toHaveCount(1, { timeout: 30000 });
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics?tab=map');
    await expect(page.locator('[data-settings-map] select[data-set="map-default-view"]')).toHaveValue('3d', { timeout: 15000 });
    await expect(page.locator('[data-settings-map] select[data-set="map-shared-levels"]')).toHaveValue('show');
    await shot(page, '08-settings-map');
  });
});
