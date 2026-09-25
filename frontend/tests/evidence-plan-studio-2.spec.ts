import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

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
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
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
    try {
      for (const id of customIds) expect((await api.delete(`api/v1/catalog/objects/${id}`)).status(), 'custom item removed').toBe(204);
      for (const f of [ids.floor, ids.floor2]) if (f) expect((await api.delete(`api/v1/floors/${f}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('published objects and connectors show on the live map with their own layer switches and in the exports', async ({ page }) => {
    await saveDraft({
      levels: [LEVEL('L0', 'מפלס ראשי', 0, 2.8, true), LEVEL('L1', 'אולם תחתון', -1.2, 6)],
      objects: [OBJ('seed-chair', 'chair.basic', [0.2, 0.2]), OBJ('seed-lamp', 'light.ceiling', [0.5, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 })],
      connectors: [{ id: 'seed-stairs', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.7], [0.8, 0.7]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
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
    await page.locator('explore-floor-map sw-button[icon="layers"]').click();
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="objects"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="connectors"]')).toHaveCount(1);
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg`)).text();
    expect(svg).toContain('data-object="seed-chair"');
    expect(svg).toContain('data-symbol="chair"');
    expect(await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg?layers=structure`)).text()).not.toContain('data-object');
    // a circuit's colour reaches the lamp's inline style only as one of the six circuit tokens: any other document string is dropped
    const CIRCUIT = (token: string) => ({ id: 'seed-k', name: 'מעגל בדיקה', switch_entity_id: 'light.t085_seed', member_ids: ['seed-lamp'], color_token: token, power_w: 0 });
    const lamp = page.locator('explore-floor-map sw-plan-canvas [data-object="seed-lamp"]');
    for (const [token, kc] of [['circuit-1); fill: red; --x: (', null], ['circuit-2', 'var(--sw-circuit-2)']] as const) {
      await saveDraft({ circuits: [CIRCUIT(token)] });
      await publish();
      await page.reload();
      await expect(lamp).toHaveAttribute('data-circuit', 'seed-k', { timeout: 20000 });
      expect(await lamp.evaluate((el) => (el as SVGElement).style.getPropertyValue('--kc').trim() || null)).toBe(kc);
    }
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
});
