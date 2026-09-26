import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { ACTION_STATUS_LABEL } from '../src/api/ha';

// Plan Studio phase 2 (T085) against the running developer backend: objects and connectors on the live map, the library
// in the editor, arrays, levels, connectors, circuits with simulated switch states (the dev-only state route), the global
// search and the custom library. The spec builds its own site / building / two floors with generated plan pictures and
// removes them at the end. Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy) in real Chrome.
const ids = { site: '', building: '', floor: '', floor2: '', version: '', version2: '', asset: '' };
const customIds: string[] = [];
let api: APIRequestContext;

const LEVEL = (id: string, name: string, elevation: number, ceiling: number, isDefault = false) => ({ id, name, elevation_m: elevation, ceiling_height_m: ceiling, is_default: isDefault, external_ids: {} });
const OBJ = (id: string, item: string, pos: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 },
  z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). Exported, like
 * dragPlan, for the later tasks' tests of this file (an unused module function fails noUnusedLocals). */
export async function clickPlan(page: Page, screen: string, x: number, y: number, modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  for (const m of modifiers) await page.keyboard.down(m); // mouse.click takes no modifiers: hold them like dragPlan
  await page.mouse.click(box.x + s.x, box.y + s.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Drag from one normalized plan point to another on the canvas of `screen`. */
export async function dragPlan(page: Page, screen: string, from: [number, number], to: [number, number], modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const conv = async (p: [number, number]) => canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  const a = await conv(from);
  const b = await conv(to);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

const draft = async (version = ids.version) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> & { objects: { id: string; item_id: string; position: [number, number]; group_id: string | null; anchor_ref: unknown }[]; groups: { id: string; member_ids: string[] }[]; connectors: { id: string; kind: string; level_to: string | null; floor_ids: string[] }[]; circuits: { id: string; member_ids: string[]; power_w: number }[]; levels: { id: string }[] } };
const saveDraft = async (patch: Record<string, unknown>, version = ids.version) => {
  const g = await draft(version);
  expect((await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
const publish = async (version = ids.version) => expect((await api.post(`api/v1/plan-versions/${version}/geometry/publish`)).status()).toBe(200);

test.describe.serial('plan studio phase 2 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סטודיו 2 ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'אולם ספורט' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'אולם', level: 0 } })).json()).id;
    ids.floor2 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'גלריה', level: 1 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const [floor, key, vkey] of [[ids.floor, 'asset', 'version'], [ids.floor2, '', 'version2']] as const) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      if (key) ids[key] = asset.id;
      ids[vkey] = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${ids[vkey]}/publish`)).status()).toBe(200);
    }
    // 1 m = 100 px: the whole 1000 px plan is 10 m wide
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 10 }] } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    // every delete is tried, even after one fails, so a single leftover does not keep the rest in the shared backend
    const failures: string[] = [];
    const remove = async (what: string, path: string) => {
      try {
        const status = (await api.delete(path)).status();
        if (status !== 204) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    };
    try {
      for (const id of customIds) await remove(`custom item ${id}`, `api/v1/catalog/objects/${id}`);
      for (const f of [ids.floor, ids.floor2]) if (f) await remove(`test floor ${f}`, `api/v1/floors/${f}?force=true`);
      if (ids.building) await remove('test building', `api/v1/buildings/${ids.building}`);
      if (ids.site) await remove('test site', `api/v1/sites/${ids.site}`);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('published objects and connectors show on the live map with their own layer switches and in the exports', async ({ page }) => {
    await saveDraft({
      levels: [LEVEL('L0', 'מפלס ראשי', 0, 2.8, true), LEVEL('L1', 'אולם תחתון', -1.2, 6)],
      objects: [OBJ('seed-chair', 'chair.basic', [0.2, 0.2]), OBJ('seed-lamp', 'light.ceiling', [0.5, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 })],
      connectors: [{ id: 'seed-stairs', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.7], [0.8, 0.7]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
    await page.waitForTimeout(1100);
    const tBefore = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.waitForTimeout(1100);
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const objects = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-object]');
    await expect(objects).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object="seed-chair"][data-item="chair.basic"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"][data-kind="stairs"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"] text')).toHaveText('↓ −1.2 מ׳');
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(2);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector]')).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    // owner form item 26 (round 9): the history map after the publish has the objects, before it none
    const tAfter = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${tAfter}`);
    await expect(page.locator('investigate-history-map sw-plan-canvas [data-object]')).toHaveCount(2, { timeout: 20000 });
    await page.goto('about:blank');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${tBefore}`);
    await expect(page.locator('investigate-history-map sw-plan-canvas')).toBeAttached({ timeout: 20000 });
    await page.waitForTimeout(2000);
    await expect(page.locator('investigate-history-map sw-plan-canvas [data-object]')).toHaveCount(0);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(objects).toHaveCount(2, { timeout: 20000 });
    await page.locator('explore-floor-map sw-button[icon="layers"]').click();
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="objects"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="connectors"]')).toHaveCount(1);
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg`)).text();
    expect(svg).toContain('data-object="seed-chair"');
    expect(svg).toContain('data-symbol="chair"');
    expect(await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg?layers=structure`)).text()).not.toContain('data-object');
    // a circuit's colour reaches the lamp's inline style only as one of the six circuit tokens: the server refuses to
    // publish any other string (a geometric error kept with the draft), and the editor's canvas drops it from the draft
    const CIRCUIT = (token: string) => ({ id: 'seed-k', name: 'מעגל בדיקה', switch_entity_id: 'light.t085_seed', member_ids: ['seed-lamp'], color_token: token, power_w: 0 });
    const kcOf = (el: Element) => (el as SVGElement).style.getPropertyValue('--kc').trim() || null;
    await saveDraft({ circuits: [CIRCUIT('circuit-1); fill: red; --x: (')] });
    const refused = await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`);
    expect(refused.status()).toBe(422);
    expect(await refused.text()).toContain('seed-k');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    const drafted = page.locator('explore-plan-editor sw-plan-canvas [data-object="seed-lamp"]');
    await expect(drafted).toHaveAttribute('data-circuit', 'seed-k', { timeout: 20000 });
    expect(await drafted.evaluate(kcOf)).toBeNull();
    await saveDraft({ circuits: [CIRCUIT('circuit-2')] });
    await publish();
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const lamp = page.locator('explore-floor-map sw-plan-canvas [data-object="seed-lamp"]');
    await expect(lamp).toHaveAttribute('data-circuit', 'seed-k', { timeout: 20000 });
    expect(await lamp.evaluate(kcOf)).toBe('var(--sw-circuit-2)');
    await saveDraft({ circuits: [] });
    await publish();
  });

  test('the library places a chair by click, the handles move, rotate and duplicate it, a lamp dropped on a light anchor is offered as its body', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // an HA light with an anchor at (0.6, 0.6): the body offer needs an anchor of a matching kind
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'light.studio2_lamp', state: 'off', attributes: { friendly_name: 'מנורת אולם' } }] } })).status()).toBe(200);
    const anchor = await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: 'light.studio2_lamp', x: 0.6, y: 0.6, rotation_degrees: 0, field_of_view_degrees: null } })).json();
    expect(anchor.id).toBeTruthy();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(2, { timeout: 20000 });
    await page.locator(`${ed} [data-tool="library"]`).click();
    await expect(page.locator(`${ed} [data-library-panel]`)).toBeVisible();
    const rows = page.locator(`${ed} [data-lib-item]`);
    const allRows = await rows.count();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await expect.poll(() => rows.count()).toBeLessThan(allRows); // the search narrows the list
    expect(await rows.count()).toBeGreaterThan(0);
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    await clickPlan(page, ed, 0.3, 0.5);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(3);
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const placedId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.keyboard.press('Escape'); // disarm the item: presses on objects now grab them
    await dragPlan(page, ed, [0.3, 0.5], [0.4, 0.5]);
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === placedId)?.position[0] ?? 0, { timeout: 10000 }).toBeGreaterThan(0.38);
    // the whole move is one undo step: one Ctrl+Z puts the chair back where it was placed, one Ctrl+Y moves it again
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === placedId)?.position[0] ?? 0, { timeout: 10000 }).toBeCloseTo(0.3, 1);
    await page.keyboard.press('Control+y');
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === placedId)?.position[0] ?? 0, { timeout: 10000 }).toBeGreaterThan(0.38);
    await clickPlan(page, ed, 0.4, 0.5); // undo / redo clear the selection: a press on the chair selects it again
    await expect(page.locator(`${ed} [data-selected-object="${placedId}"]`)).toBeVisible();
    // the right stretch handle dragged outwards makes the chair wider
    const sizeOf = async () => ((await draft()).doc.objects.find((o) => o.id === placedId) as unknown as { size: { w_m: number } }).size.w_m;
    const edge = (await page.locator(`${ed} sw-plan-canvas [data-object-stretch="1"]`).boundingBox())!;
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2 + 40, edge.y + edge.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(sizeOf, { timeout: 10000 }).toBeGreaterThan(0.5);
    const knob = (await page.locator(`${ed} sw-plan-canvas [data-object-rotate]`).boundingBox())!;
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    await page.mouse.move(knob.x + 80, knob.y + 60, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round(((await draft()).doc.objects.find((o) => o.id === placedId) as unknown as { rotation_deg: number }).rotation_deg), { timeout: 10000 }).toBeGreaterThan(0);
    await dragPlan(page, ed, [0.4, 0.5], [0.4, 0.7], ['Alt']);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(4);
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(3);
    await page.locator(`${ed} [data-lib-cat="recent"]`).click();
    await expect(page.locator(`${ed} [data-lib-item="chair.basic"]`)).toHaveCount(1);
    // a ceiling lamp dropped on the light's anchor becomes its body
    await page.locator(`${ed} [data-lib-cat="all"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('מנורת תקרה');
    await page.locator(`${ed} [data-lib-item="light.ceiling"]`).click();
    await clickPlan(page, ed, 0.6, 0.6);
    await expect(page.locator(`${ed} [data-bind-offer]`)).toBeVisible();
    await page.locator(`${ed} [data-bind-accept]`).click();
    await expect(page.locator(`${ed} [data-object-bound]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const bound = (await draft()).doc.objects.find((o) => o.item_id === 'light.ceiling' && o.anchor_ref);
    expect(bound).toBeTruthy();
    expect(bound!.position).toEqual([0.6, 0.6]);
    expect((await draft()).doc.objects.find((o) => o.id === placedId)!.item_id).toBe('chair.basic');
  });

  test('sixty chairs in one array, moved as one; deleting the array asks; a custom item is made from an object and exported', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    const before = await page.locator(`${ed} sw-plan-canvas [data-object]`).count();
    await clickPlan(page, ed, 0.15, 0.15);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const originId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.locator(`${ed} [data-object-array]`).click();
    await expect(page.locator(`${ed} [data-array-dialog] [data-array-rows]`)).toBeVisible(); // the sw-dialog host itself has no box of its own
    await page.locator(`${ed} [data-array-rows]`).fill('6');
    await page.locator(`${ed} [data-array-cols]`).fill('10');
    await expect(page.locator(`${ed} [data-array-sx]`)).toHaveValue('0.5');
    await expect(page.locator(`${ed} [data-array-sy]`)).toHaveValue('0.9');
    await expect(page.locator(`${ed} [data-array-total]`)).toContainText('60');
    await page.locator(`${ed} [data-array-create]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 60);
    await expect(page.locator(`${ed} [data-selected-group]`)).toContainText('60');
    // owner form item 30 (round 9): the whole array is one undo step - Ctrl+Z leaves the origin chair only, Ctrl+Y brings the 60 back
    await page.keyboard.press('Control+z');
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 1);
    await page.keyboard.press('Control+y');
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 60);
    // a member of an array cannot start another array; "בחר את המערך" takes the whole array again
    await clickPlan(page, ed, 0.2, 0.15);
    await expect(page.locator(`${ed} [data-object-array]`)).toHaveAttribute('disabled', '');
    await page.locator(`${ed} [data-select-group]`).click();
    await expect(page.locator(`${ed} [data-selected-group]`)).toContainText('60');
    await expect.poll(async () => (await draft()).doc.groups.find((g) => g.member_ids.includes(originId))?.member_ids.length ?? 0, { timeout: 10000 }).toBe(60);
    const group = (await draft()).doc.groups.find((g) => g.member_ids.includes(originId))!;
    const tenth = (await draft()).doc.objects.find((o) => o.id === group.member_ids[9])!;
    expect(tenth.position[0]).toBeCloseTo(0.6, 2); // column 9 x 0.5 m at 100 px/m from x = 0.15
    // the group stays selected: dragging the origin moves the whole array
    await dragPlan(page, ed, [0.15, 0.15], [0.2, 0.15]);
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === group.member_ids[9])!.position[0], { timeout: 10000 }).toBeGreaterThan(0.63);
    // Delete asks; keeping the members leaves 60 objects without a group
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} [data-group-delete-dialog] [data-group-delete-keep]`)).toBeVisible();
    await page.locator(`${ed} [data-group-delete-keep]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 60);
    await expect.poll(async () => (await draft()).doc.groups.length, { timeout: 10000 }).toBe(0);
    // a custom item from the origin chair
    await clickPlan(page, ed, 0.2, 0.15);
    await expect(page.locator(`${ed} [data-selected-object="${originId}"]`)).toBeVisible();
    await page.locator(`${ed} [data-object-custom]`).click();
    await expect(page.locator(`${ed} [data-custom-dialog] [data-custom-name]`)).toBeVisible();
    await page.locator(`${ed} [data-custom-name]`).fill('כיסא אולם');
    await page.locator(`${ed} [data-custom-w]`).fill('200'); // out of range: marked, and the item waits
    await expect(page.locator(`${ed} [data-custom-size-error]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-custom-create]`)).toHaveAttribute('disabled', '');
    await page.locator(`${ed} [data-custom-w]`).fill('0.45');
    await expect(page.locator(`${ed} [data-custom-size-error]`)).toHaveCount(0);
    await page.locator(`${ed} [data-custom-create]`).click();
    await expect(page.locator(`${ed} [data-custom-dialog]`)).toHaveCount(0);
    // registered for the cleanup at once: a failing assertion below must not leave the item in the shared library
    const exported = await (await api.get('api/v1/catalog/export')).json();
    const mine = exported.items.find((i: { names: { he: string } }) => i.names.he === 'כיסא אולם');
    if (mine) customIds.push(mine.id);
    expect(mine).toBeTruthy();
    await page.locator(`${ed} [data-lib-cat="all"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא אולם');
    await expect(page.locator(`${ed} [data-lib-item]`)).toHaveCount(1);
    expect(mine.based_on).toBe('chair.basic');
    // the library's export link is that file; importing it back replaces every custom item in it and adds none
    await expect(page.locator(`${ed} [data-lib-export]`)).toHaveAttribute('href', /api\/v1\/catalog\/export$/);
    await page.locator(`${ed} [data-lib-import]`).setInputFiles({ name: 'smplwise-catalog-custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await expect(page.locator(`${ed} .bar`)).toContainText(`0 יובאו, ${exported.items.length} הוחלפו`);
  });

  test('a third level is added from the chips; the tribune connects the hall to the level at -1.2 m and publishes its connector; the live map filters by level', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} [data-level-chips] [data-level-chip]`)).toHaveCount(3, { timeout: 20000 }); // all + the two seeded levels
    await page.locator(`${ed} [data-level-add]`).click();
    await page.locator(`${ed} [data-level-name]`).fill('גלריה');
    await page.locator(`${ed} [data-level-elevation]`).fill('3.5');
    await page.locator(`${ed} [data-level-ceiling]`).fill('3');
    await page.locator(`${ed} [data-level-create]`).click();
    await expect(page.locator(`${ed} [data-level-chips] [data-level-chip]`)).toHaveCount(4);
    await expect.poll(async () => (await draft()).doc.levels.map((l) => l.id), { timeout: 10000 }).toEqual(['L0', 'L1', 'L2']);
    // the new level is the filter now: nothing of the hall shows; back to all levels
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(0);
    await page.locator(`${ed} [data-level-chip="all"]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`).first()).toBeAttached();
    // a tribune on the hall level that descends to the lower hall
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('טריבונה');
    await page.locator(`${ed} [data-lib-item="tribune.stepped"]`).click();
    await clickPlan(page, ed, 0.5, 0.7);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const tribuneId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.locator(`${ed} [data-object-param="connects_levels"]`).selectOption('L1');
    await expect.poll(async () => (await draft()).doc.connectors.find((c) => c.id === `cx-${tribuneId}`)?.level_to ?? null, { timeout: 10000 }).toBe('L1');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="cx-${tribuneId}"][data-kind="tribune"]`)).toHaveCount(1);
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('עצמים');
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('מפלסים');
    const published = page.waitForResponse((r) => r.url().includes('/geometry/publish'));
    await page.locator(`${ed} [data-geom-publish]`).click();
    expect((await published).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-connector="cx-${tribuneId}"] text`)).toHaveText('↓ −1.2 מ׳', { timeout: 20000 });
    await expect(page.locator('explore-floor-map [data-level-chips] [data-level-chip]')).toHaveCount(4);
    await page.locator('explore-floor-map [data-level-chip="L1"]').click();
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${tribuneId}"]`)).toHaveCount(0);
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-connector="cx-${tribuneId}"]`)).toHaveCount(1); // connectors are never filtered
    await page.locator('explore-floor-map [data-level-chip="all"]').click();
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${tribuneId}"]`)).toHaveCount(1);
    // with the filter on the lower hall, a door click on a wall of the main level (hidden) places nothing; on all levels it does
    const g = await draft();
    await saveDraft({ walls: [...((g.doc.walls as unknown[]) ?? []), { id: 'lv-wall', level_id: 'L0', polyline: [[0.6, 0.1], [0.9, 0.1]], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} }] });
    const openings = async () => ((await draft()).doc.openings as unknown[]).length;
    const before = await openings();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} [data-level-chip="L1"]`)).toBeVisible({ timeout: 20000 });
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await page.locator(`${ed} [data-studio-mode="door"]`).click();
    await page.locator(`${ed} [data-level-chip="L1"]`).click();
    await clickPlan(page, ed, 0.75, 0.1);
    await expect(page.locator(`${ed} .bar`)).toContainText('לחץ על קיר כדי להציב פתח');
    await expect(page.locator(`${ed} [data-selected-opening]`)).toHaveCount(0);
    await page.locator(`${ed} [data-level-chip="all"]`).click();
    await clickPlan(page, ed, 0.75, 0.1);
    await expect(page.locator(`${ed} [data-selected-opening]`)).toBeVisible();
    await expect.poll(openings, { timeout: 10000 }).toBe(before + 1);
  });

  test('stairs are drawn with two clicks, set to reach the lower hall, and linked to the gallery floor under one id', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="connectors"]`).click();
    await expect(page.locator(`${ed} [data-connector-panel]`)).toBeVisible();
    await page.locator(`${ed} [data-conn-mode="stairs"]`).click();
    await clickPlan(page, ed, 0.75, 0.9);
    await clickPlan(page, ed, 0.9, 0.9);
    await expect(page.locator(`${ed} [data-selected-connector]`)).toBeVisible();
    const stairsId = (await page.locator(`${ed} [data-selected-connector]`).getAttribute('data-selected-connector'))!;
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"][data-kind="stairs"]`)).toHaveCount(1);
    await page.locator(`${ed} [data-conn-to]`).selectOption('L1');
    await expect.poll(async () => (await draft()).doc.connectors.find((c) => c.id === stairsId)?.level_to ?? null, { timeout: 10000 }).toBe('L1');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"] text`)).toHaveText('↓ −1.2 מ׳');
    // the link: the gallery floor gets the same connector on its draft; this draft lists both floors
    await page.locator(`${ed} [data-conn-link-floor]`).selectOption(ids.floor2);
    await page.locator(`${ed} [data-conn-link]`).click();
    await expect.poll(async () => (await draft(ids.version2)).doc.connectors.map((c) => c.id), { timeout: 15000 }).toEqual([stairsId]);
    const theirs = (await draft(ids.version2)).doc.connectors[0];
    expect(theirs.floor_ids.sort()).toEqual([ids.floor, ids.floor2].sort());
    expect(theirs.level_to).toBeNull();
    const mine = (await draft()).doc.connectors.find((c) => c.id === stairsId)!;
    expect(mine.floor_ids.sort()).toEqual([ids.floor, ids.floor2].sort());
    await expect(page.locator(`${ed} [data-selected-connector="${stairsId}"]`)).toContainText('2 קומות');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"] text`)).toHaveText('↕');
  });

  test('eight lamps on two circuits glow on the live map when their switches are on; the toggle goes through the entity action path; the editor builds a circuit from the switch catalogue', async ({ page }) => {
    const lamp = (id: string, x: number, y: number) => OBJ(id, 'light.ceiling', [x, y], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 });
    const lamps = [0, 1, 2, 3].flatMap((i) => [lamp(`la${i}`, 0.15 + i * 0.05, 0.35), lamp(`lb${i}`, 0.15 + i * 0.05, 0.45)]);
    const g = await draft();
    await saveDraft({
      objects: [...g.doc.objects.filter((o) => o.item_id !== 'light.ceiling' || o.anchor_ref), ...lamps],
      circuits: [{ id: 'k-north', name: 'אולם צפון', switch_entity_id: 'switch.studio2_a', member_ids: ['la0', 'la1', 'la2', 'la3'], color_token: 'circuit-1', power_w: 0 },
                 { id: 'k-south', name: 'אולם דרום', switch_entity_id: 'switch.studio2_b', member_ids: ['lb0', 'lb1', 'lb2', 'lb3'], color_token: 'circuit-2', power_w: 0 }],
    });
    expect((await draft()).doc.circuits.find((k) => k.id === 'k-north')!.power_w).toBe(144); // 4 x 36 W, recomputed by the server
    await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'switch.studio2_a', state: 'on', attributes: { friendly_name: 'מפסק צפון' } }, { entity_id: 'switch.studio2_b', state: 'off', attributes: { friendly_name: 'מפסק דרום' } }] } });
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(page.locator('explore-floor-map [data-circuit-strip] [data-circuit-toggle]')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object][data-glow]')).toHaveCount(4);
    await expect(page.locator('explore-floor-map [data-circuit-toggle="k-north"]')).toHaveAttribute('data-state', 'on');
    await expect(page.locator('explore-floor-map [data-circuit-toggle="k-north"]')).toContainText('4 מנורות');
    // the second switch turns on: the push updates the map without a reload
    await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'switch.studio2_b', state: 'on' }] } });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object][data-glow]')).toHaveCount(8, { timeout: 15000 });
    // the toggle is the existing action route (switch.turn_off, the switch is on). Ruling R-P2-T13-1: no request may reach
    // Home Assistant, so the route is answered in the browser with a terminal record (no awaitAction polling of the backend)
    const sent: unknown[] = [];
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      sent.push(r.request().postDataJSON());
      await r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 't13-fake', entity_id: 'switch.studio2_a', action_id: 'switch.turn_off', status: 'failed', error: 'bridge_error', requested_at: new Date().toISOString(), confirmed_at: null }) });
    });
    await page.locator('explore-floor-map [data-circuit-toggle="k-north"]').click();
    await expect(page.locator('explore-floor-map [data-circuit-status]')).toContainText(ACTION_STATUS_LABEL.failed);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ allowed_action_id: 'switch.turn_off' });
    await page.unroute('**/api/v1/ha/entities/*/actions');
    // the editor: a circuit from the switch catalogue, one lamp added by clicking it, the power sum
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="circuits"]`).click();
    await expect(page.locator(`${ed} [data-circuit-row]`)).toHaveCount(2, { timeout: 20000 });
    await page.locator(`${ed} [data-circuit-new]`).click();
    await page.locator(`${ed} [data-circuit-name]`).fill('גלריה');
    await page.locator(`${ed} [data-circuit-switch-q]`).fill('studio2_a');
    await page.locator(`${ed} [data-circuit-switch="switch.studio2_a"]`).click();
    await page.locator(`${ed} [data-circuit-create]`).click();
    await expect(page.locator(`${ed} [data-selected-circuit]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-circuit-members]`)).toHaveAttribute('aria-pressed', 'true');
    await clickPlan(page, ed, 0.15, 0.45); // lb0 moves from the south circuit to the new one
    await expect(page.locator(`${ed} [data-circuit-count]`)).toContainText('מנורה אחת');
    await expect(page.locator(`${ed} [data-circuit-power]`)).toContainText('36');
    await expect.poll(async () => (await draft()).doc.circuits.find((k) => k.id === 'k-south')?.member_ids.length, { timeout: 10000 }).toBe(3);
  });

  test('acceptance: the sports hall - tribune to -1.2 m, sixty chairs in one array, eight lamps on two circuits, "מטף" found by the global search and focused on the floor, a custom item exported', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // sixty chairs in one array, published
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    await clickPlan(page, ed, 0.2, 0.4);
    await page.keyboard.press('Escape');
    await page.locator(`${ed} [data-object-array]`).click();
    await page.locator(`${ed} [data-array-rows]`).fill('6');
    await page.locator(`${ed} [data-array-cols]`).fill('10');
    await page.locator(`${ed} [data-array-sy]`).fill('0.6');
    await page.locator(`${ed} [data-array-create]`).click();
    await expect(page.locator(`${ed} [data-selected-group]`)).toContainText('60');
    // an extinguisher with a searchable label
    await page.locator(`${ed} [data-lib-search]`).fill('מטף');
    await page.locator(`${ed} [data-lib-item="extinguisher.co2"]`).click();
    await clickPlan(page, ed, 0.92, 0.2);
    await page.keyboard.press('Escape');
    await page.locator(`${ed} [data-object-label]`).fill('מטף כניסה');
    await page.locator(`${ed} [data-object-label]`).press('Enter');
    await page.locator(`${ed} [data-object-label]`).dispatchEvent('change');
    await expect(page.locator(`${ed} [data-library-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const extId = (await draft()).doc.objects.find((o) => o.item_id === 'extinguisher.co2')!.id;
    await publish();
    // the published document carries the whole scenario
    const pub = (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json()).doc as { levels: { id: string; elevation_m: number }[]; objects: { item_id: string; group_id: string | null }[]; groups: { member_ids: string[] }[]; connectors: { kind: string; level_to: string | null }[]; circuits: { member_ids: string[] }[] };
    expect(pub.levels.find((l) => l.id === 'L1')!.elevation_m).toBe(-1.2);
    expect(pub.connectors.some((c) => c.kind === 'tribune' && c.level_to === 'L1')).toBe(true);
    expect(pub.groups.some((g) => g.member_ids.length === 60)).toBe(true);
    expect(pub.circuits.filter((k) => k.member_ids.length >= 3).length).toBe(2); // north (4) and south (3); the gallery circuit of the previous test has one lamp
    expect(pub.objects.filter((o) => o.item_id === 'light.ceiling').length).toBeGreaterThanOrEqual(8);
    // the global search finds the extinguisher and the floor opens focused on it
    const hits = (await (await api.get('api/v1/search?q=מטף')).json()).results as { kind: string; id: string; route: string; title: string }[];
    const hit = hits.find((h) => h.kind === 'object' && h.id === extId)!;
    expect(hit.title).toBe('מטף כניסה');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await page.locator('sw-app .search input').fill('מטף');
    await expect(page.locator('sw-app .results .row', { hasText: 'מטף כניסה' })).toBeVisible();
    await page.locator('sw-app .results .row', { hasText: 'מטף כניסה' }).click();
    await expect(page).toHaveURL(new RegExp(`focus=object:${extId}`));
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${extId}"].sel`)).toHaveCount(1, { timeout: 20000 });
    // the eight lamps glow by the switch states the circuit test seeded (both on; lb0 is on the gallery circuit, switch a)
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object][data-glow]')).toHaveCount(8);
    // the custom item made in the array test is in the export
    const exported = await (await api.get('api/v1/catalog/export')).json();
    expect(exported.items.some((i: { names: { he: string } }) => i.names.he === 'כיסא אולם')).toBe(true);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('viewing, placing and moving a single object work; arrays and wall drawing say they are desktop only', async ({ page }) => {
      const ed = 'explore-plan-editor';
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      await expect(page.locator('explore-floor-map sw-plan-canvas [data-object]').first()).toBeAttached({ timeout: 20000 });
      await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
      await page.locator(`${ed} [data-tool="library"]`).click();
      await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
      await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
      const before = await page.locator(`${ed} sw-plan-canvas [data-object]`).count();
      const known = new Set((await draft()).doc.objects.map((o) => o.id));
      // the phone stacks the library under the plan: picking an item scrolls the plan out of view, and a mouse click
      // at a point off the viewport reaches nothing. A free spot: the acceptance array covers (0.5, 0.5)
      await page.locator(`${ed} sw-plan-canvas`).scrollIntoViewIfNeeded();
      await clickPlan(page, ed, 0.85, 0.45);
      await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 1);
      await expect.poll(async () => (await draft()).doc.objects.filter((o) => !known.has(o.id)).length, { timeout: 10000 }).toBe(1);
      const placedId = (await draft()).doc.objects.find((o) => !known.has(o.id))!.id;
      // one placement disarms the item on a phone: a drag on the chair moves it. The chair stands on the tribune (12 x 4 m
      // around (0.5, 0.7)): the press takes the chair, never the tribune under it, whichever of the two random ids sorts first
      await expect(page.locator(`${ed} [data-library-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
      const tribune = (await draft()).doc.objects.find((o) => o.item_id === 'tribune.stepped')!;
      await page.locator(`${ed} sw-plan-canvas`).scrollIntoViewIfNeeded();
      await dragPlan(page, ed, [0.85, 0.45], [0.85, 0.3]);
      await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === placedId)!.position[1], { timeout: 10000 }).toBeLessThan(0.33);
      expect((await draft()).doc.objects.find((o) => o.id === tribune.id)!.position).toEqual(tribune.position);
      // sw-button carries the disabled attribute on its host (not a native control, so not toBeDisabled)
      await expect(page.locator(`${ed} [data-object-array]`)).toHaveAttribute('disabled', '');
      await expect(page.locator(`${ed} [data-library-panel]`)).toContainText('בטלפון');
      await page.locator(`${ed} [data-tool="structure"]`).click();
      await page.locator(`${ed} [data-studio-mode="wall"]`).click();
      await expect(page.locator(`${ed} .bar`)).toContainText('בדסקטופ בלבד');
      await expect(page.locator(`${ed} [data-studio-mode="wall"]`)).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
