import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The "סמן דלת" tool (T087) against a running backend: in the editor's structure tool a click on a door symbol of the
// committed apartment fixture (tests/fixtures/plan_detect, 1600 x 1200 px, calibrated here at 0.01 m / px) asks the
// server for a proposal, the ghost shows with its note and handles, the person flips the swing and drags the width, Enter
// accepts - an ordinary opening (with the wall piece it brought: nothing is drawn on this plan yet) - consecutive clicks
// add the next doors, Esc cancels, undo / redo take a door (and its piece) as one step, the draft publishes and the 3D
// view shows the doors. The spec builds its own site / building / floor and removes them at the end. Runs only with
// SW_LIVE=1 (a throwaway backend behind the preview proxy: SW_API_PORT, SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APARTMENT = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
const ED = 'explore-plan-editor';
const W = 1600;
const H = 1200;
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;

type Opening = { id: string; wall_id: string; kind: string; width_m: number; swing: string; hinge: string; t: number; source: string };
type Wall = { id: string; polyline: [number, number][]; thickness_m: number; external_ids?: Record<string, string> };
type Draft = { geometry: { revision: number }; doc: { walls: Wall[]; openings: Opening[] } };
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;

async function clickPlan(page: Page, px: number, py: number) {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [px / W, py / H] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

/** Click a door symbol and wait for the server's proposal and its ghost. */
async function propose(page: Page, px: number, py: number) {
  const answered = page.waitForResponse((r) => r.url().endsWith('/door-proposal') && r.request().method() === 'POST', { timeout: 15000 });
  await clickPlan(page, px, py);
  const r = await answered;
  expect(r.status(), await r.text()).toBe(200);
  await expect(page.locator(`${ED} sw-plan-canvas [data-door-ghost]`)).toBeAttached();
  return (await r.json()) as { found: string; note: string; width_px: number; swing: string; hinge: string; elapsed_ms: number };
}

const ghostState = (page: Page) => page.locator(ED).evaluate((el) => (el as unknown as { doorGhost: { width_m: number; swing: string; hinge: string; found: string } | null }).doorGhost);

test.describe.serial('plan studio: the mark-door tool (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סמן דלת ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת דלתות', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(APARTMENT) } } })).json();
    const v = await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json();
    ids.version = v.id;
    expect(v.width_px, 'the version keeps the fixture at 1600 px').toBe(W);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 16 }] } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
    const step = async (what: string, run: () => Promise<number>, ok: number) => {
      try {
        const status = await run();
        if (status !== ok) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    };
    try {
      if (ids.floor) await step('test floor removed', async () => (await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 204);
      if (ids.building) await step('test building removed', async () => (await api.delete(`api/v1/buildings/${ids.building}`)).status(), 204);
      if (ids.site) await step('test site removed', async () => (await api.delete(`api/v1/sites/${ids.site}`)).status(), 204);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('click a door symbol, adjust the ghost, accept; consecutive clicks; Esc; undo; publish; the 3D shows the doors', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ED} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    const mode = page.locator(`${ED} [data-studio-mode="markdoor"]`);
    await expect(mode).toHaveText('סמן דלת');
    await expect(mode).toHaveAttribute('title', /סמן דלת \(D\)/);
    await expect(mode).toHaveAttribute('aria-keyshortcuts', 'D');
    // the keyboard shortcut picks it (from another mode)
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    await page.keyboard.press('d');
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${ED} [data-mark-door-hint="idle"]`)).toBeVisible();

    // 1. the door in the partition x 800 (hinged at y 355, the leaf to the right, its arc down to y 445)
    const p1 = await propose(page, 830, 385);
    expect(p1.found).toBe('arc');
    expect(Math.abs(p1.width_px - 90)).toBeLessThanOrEqual(9);
    await expect(page.locator(`${ED} sw-plan-canvas [data-ghost-note]`)).toHaveText('נמצאה קשת');
    await expect(page.locator(`${ED} sw-plan-canvas [data-door-ghost]`)).toHaveAttribute('data-ghost-new-wall', 'yes'); // nothing drawn yet: a wall piece comes with it
    await expect(page.locator(`${ED} [data-mark-door-hint="ghost"] [data-ghost-warning]`)).toBeVisible();
    await expect(page.locator(`${ED} sw-plan-canvas [data-ghost-leaf]`)).toHaveCount(1);
    let g = (await ghostState(page))!;
    const swing0 = g.swing;
    // adjust: the swing flips and back, the hinge flips, the width is dragged out
    await page.locator(`${ED} sw-plan-canvas [data-ghost-handle="swing"] circle`).click();
    expect((await ghostState(page))!.swing).not.toBe(swing0);
    await page.locator(`${ED} sw-plan-canvas [data-ghost-handle="swing"] circle`).click();
    expect((await ghostState(page))!.swing).toBe(swing0);
    const hinge0 = g.hinge;
    await page.locator(`${ED} sw-plan-canvas [data-ghost-handle="hinge"] circle`).click();
    expect((await ghostState(page))!.hinge).not.toBe(hinge0);
    await page.locator(`${ED} sw-plan-canvas [data-ghost-handle="hinge"] circle`).click();
    const handle = page.locator(`${ED} sw-plan-canvas [data-ghost-handle="width"]`);
    const hb = (await handle.boundingBox())!;
    const zoom = await page.locator(`${ED} sw-plan-canvas`).evaluate((el) => (el as unknown as { zoom: number }).zoom);
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 10 * zoom, { steps: 4 }); // 10 plan px further along the wall (it runs down the page)
    await page.mouse.up();
    g = (await ghostState(page))!;
    expect(g.width_m).toBeGreaterThan(0.9);
    const width1 = g.width_m;
    await page.keyboard.press('Enter');
    await expect(page.locator(`${ED} sw-plan-canvas [data-door-ghost]`)).toHaveCount(0);
    // the same symbol clicked again: that door is selected, no second one is stacked on it
    const again = page.waitForResponse((r) => r.url().endsWith('/door-proposal'));
    await clickPlan(page, 830, 385);
    expect((await again).status()).toBe(200);
    await expect(page.locator(ED).getByText('כאן כבר יש דלת: היא נבחרה')).toBeVisible();
    await expect(page.locator(`${ED} sw-plan-canvas [data-door-ghost]`)).toHaveCount(0);

    // 2. and 3. consecutive clicks: the second door's ghost is accepted by the click on the third door, Esc cancels the third
    const p2 = await propose(page, 480, 630); // the door in the wall y 600, hinged at its end (x 505), opening down
    expect(p2.found).toBe('arc');
    await propose(page, 1120, 730); // the door in the wall y 700, hinged at its start (x 1095), opening down
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ED} sw-plan-canvas [data-door-ghost]`)).toHaveCount(0);

    // a click with no symbol and no wall near it is refused in words
    const refused = page.waitForResponse((r) => r.url().endsWith('/door-proposal'));
    await clickPlan(page, 330, 380);
    expect((await refused).status()).toBe(422);
    await expect(page.locator(ED).getByText('לא נמצאו סמל דלת או קיר ליד הלחיצה')).toBeVisible();

    // saved: two doors, each on the wall piece it brought, ordinary openings
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await draft()).doc.openings.length, { timeout: 15000 }).toBe(2);
    let d = await draft();
    expect(d.doc.walls.length).toBe(2);
    const [o1, o2] = d.doc.openings;
    expect(o1).toMatchObject({ kind: 'door', source: 'manual', swing: 'left', hinge: 'start' });
    expect(o1.width_m).toBeCloseTo(width1, 2);
    expect(o2).toMatchObject({ kind: 'door', source: 'manual', swing: 'right', hinge: 'end' });
    expect(Math.abs(o2.width_m - 0.9)).toBeLessThanOrEqual(0.09);
    expect(new Set(d.doc.openings.map((o) => o.wall_id))).toEqual(new Set(d.doc.walls.map((w) => w.id)));
    expect(d.doc.walls.every((w) => w.external_ids?.origin === 'door_tool')).toBe(true); // the pieces say where they came from

    // undo takes the last door and its wall piece in one step; redo brings both back
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await draft()).doc.openings.length, { timeout: 15000 }).toBe(1);
    expect((await draft()).doc.walls.length).toBe(1);
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await draft()).doc.openings.length, { timeout: 15000 }).toBe(2);
    d = await draft();
    expect(d.doc.walls.length).toBe(2);

    // publish, then the live map's 3D shows both doors
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator('explore-floor-map');
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 20000 });
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 15000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const parts = await el.evaluate((node) => (node as unknown as { description: { parts: { id: string; kind: string }[] } }).description.parts.map((p) => p.id));
    for (const o of d.doc.openings) expect(parts, `door ${o.id} in 3D`).toContain(`door:${o.id}`);
    test.info().annotations.push({ type: 'proposal-ms', description: `${p1.elapsed_ms}, ${p2.elapsed_ms}` });
  });

  test('D while a wall is being drawn keeps the wall and says so', async ({ page }) => {
    const before = (await draft()).doc.walls.length;
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ED} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-studio-mode="wall"]`).click();
    await clickPlan(page, 1250, 950);
    await clickPlan(page, 1400, 950);
    await page.keyboard.press('d');
    await expect(page.locator(`${ED} [data-studio-mode="markdoor"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(ED).getByText('הקיר שבציור נשמר; סמן דלת פעיל')).toBeVisible();
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await draft()).doc.walls.length, { timeout: 15000 }).toBe(before + 1);
  });
});
