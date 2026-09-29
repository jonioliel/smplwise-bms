import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared space (CR-009, T093, owner 2026-09-29), the owner's flow against a running developer backend: the sports hall is
// drawn twice today - on floor -1 (the court) and on floor 0 (the tribunes' top) - as two unrelated rooms. From floor 0's
// editor "הפוך לחלל משותף" converts them (the court's floor keeps the room by default), the preview says what leaves
// floor 0; after it the hall is whole on both floors' maps with the chip "רצפה בקומה -1"; the tribune moved from floor 0
// lands in floor -1's structure and shows there. The spec builds its own site / building / two floors and removes them.
// Runs only with SW_LIVE=1 (backend behind the preview proxy). Screenshots go to SW_SHOT_DIR (default private-evidence).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.SW_SHOT_DIR || path.resolve(HERE, '..', '..', 'private-evidence', 'shared-space');
const ids = { site: '', building: '', fm1: '', f0: '', vm1: '', v0: '', hall: '', dup: '' };
let api: APIRequestContext;
const ed = 'explore-plan-editor';
const HALL = [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.7 }];

type Obj = { id: string; position: [number, number]; shared?: { home_floor_id: string } };
type Draft = { geometry: { revision: number }; doc: Record<string, unknown> & { walls: { id: string; shared?: unknown }[]; objects: Obj[]; shared_spaces?: { role: string; label: string }[] } };
const draft = async (version: string) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as Draft;
const wall = (id: string, a: [number, number], b: [number, number]) => ({ id, level_id: 'L0', polyline: [a, b], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false });
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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe.serial('shared space: the hall on two floors (CR-009)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
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
    // floor -1: the court with its walls and a tribune; floor 0: the same hall drawn again, unrelated
    ids.hall = (await (await api.post(`api/v1/floors/${ids.fm1}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: HALL } })).json()).id;
    ids.dup = (await (await api.post(`api/v1/floors/${ids.f0}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: HALL } })).json()).id;
    await save(ids.vm1, {
      walls: [wall('h1', [0.2, 0.2], [0.6, 0.2]), wall('h2', [0.6, 0.2], [0.6, 0.7]), wall('h3', [0.6, 0.7], [0.2, 0.7]), wall('h4', [0.2, 0.7], [0.2, 0.2]), wall('corr', [0.8, 0.1], [0.8, 0.9])],
      objects: [obj('trib', [0.4, 0.3], 'tribune.stepped', { size: { w_m: 10, d_m: 3, h_m: 2.5 }, params: { rows: 6 } })],
    });
    expect((await api.post(`api/v1/plan-versions/${ids.vm1}/geometry/publish`)).status()).toBe(200);
    await save(ids.v0, { walls: [wall('d1', [0.2, 0.2], [0.6, 0.2]), wall('d2', [0.2, 0.7], [0.2, 0.2]), wall('lobby', [0.7, 0.1], [0.7, 0.9])], objects: [obj('dup-seat', [0.3, 0.6])] });
    expect((await api.post(`api/v1/plan-versions/${ids.v0}/geometry/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
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

  test('convert the duplicate hall from floor 0, see it whole on both floors, move the tribune from floor 0 and see it on floor -1', async ({ page }) => {
    // 1. floor 0's editor: the duplicate room, "הפוך לחלל משותף"
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-tool="zones"]`).click();
    await page.locator(`${ed} [data-zone-row]`, { hasText: 'אולם ספורט' }).click();
    await page.locator(`${ed} [data-zone-share]`).click();
    const dlg = page.locator(`${ed} [data-share-dialog]`);
    await expect(dlg.locator('[data-share-floor]')).toBeVisible({ timeout: 15000 });
    // the court's floor keeps the room by default (owner decision 4): floor 0 is the higher one
    await expect(dlg.locator('[data-share-home]')).toHaveValue('there');
    await expect(dlg.locator('[data-share-removed]')).toContainText('2 קירות', { timeout: 15000 });
    await expect(dlg.locator('[data-share-removed]')).toContainText('החדר הכפול');
    await shot(page, '01-share-preview-floor0');
    await dlg.locator('[data-share-apply]').click();
    await expect(dlg).toHaveCount(0, { timeout: 15000 });
    const d0 = await draft(ids.v0);
    expect(d0.doc.walls.filter((w) => !w.shared).map((w) => w.id)).toEqual(['lobby']);
    expect(d0.doc.walls.filter((w) => w.shared).length).toBe(4);
    expect(d0.doc.shared_spaces?.[0]).toMatchObject({ role: 'mirror', label: 'רצפה בקומה -1' });
    // 2. the hall whole on floor 0's editor, with its chip
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall="${ids.fm1}:h2"]`)).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator(`${ed} sw-plan-canvas [data-object="${ids.fm1}:trib"]`)).toHaveCount(1);
    await expect(page.locator(`${ed} sw-plan-canvas [data-zone-chip="${ids.hall}"]`)).toContainText('רצפה בקומה');
    await shot(page, '02-floor0-editor-hall-whole');
    // 3. move the tribune from floor 0: the select tool, a press on it, the arrow keys (Shift = 10 cm)
    await page.locator(`${ed} [data-tool="select"]`).click();
    await clickPlan(page, 0.4, 0.3);
    await expect(page.locator(`${ed} [data-shared-hint]`)).toContainText('השינוי יופיע גם בקומה', { timeout: 10000 });
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => (await draft(ids.vm1)).doc.objects.find((o) => o.id === 'trib')?.position[0] ?? 0, { timeout: 20000 }).toBeGreaterThan(0.41);
    await shot(page, '03-floor0-tribune-moved');
    // 4. floor -1: the same hall (its own), the moved tribune, the chip
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.fm1}/edit`);
    const trib = page.locator(`${ed} sw-plan-canvas [data-object="trib"]`);
    await expect(trib).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator(`${ed} sw-plan-canvas [data-zone-chip="${ids.hall}"]`)).toContainText('רצפה בקומה');
    const moved = (await draft(ids.vm1)).doc.objects.find((o) => o.id === 'trib')!.position;
    expect(moved[0]).toBeGreaterThan(0.41);
    await shot(page, '04-floor-1-editor-tribune-there');
    // 5. publish floor -1: floor 0's live map shows the moved tribune in the hall
    expect((await api.post(`api/v1/plan-versions/${ids.vm1}/geometry/publish`)).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.v0}/geometry/publish`)).status()).toBe(200);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}`);
    await expect(page.locator(`sw-plan-canvas [data-object="${ids.fm1}:trib"]`)).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator(`sw-plan-canvas [data-zone-chip="${ids.hall}"]`)).toContainText('רצפה בקומה');
    await shot(page, '05-floor0-live-map');
  });
});
