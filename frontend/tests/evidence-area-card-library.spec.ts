import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import path from 'node:path';

// Owner request 2026-09-30 - the area screen's layout editor: the device picker (select all / none / invert over the
// filtered results, group headers, a live count, no nested scroll), "מחק כרטיס" with an undo toast (the devices go to the
// unplaced pool, nothing leaves the platform), and "הוסף כרטיס" from the card library (only sensible types, all on request,
// several cards of one type, each with its own name, devices and appearance, placed automatically), persisted in layout
// v 3. Against the devices fixture backend (tests/fixtures/devices_fake_ha.py) - SW_LIVE=1 SW_DEVICES_FIXTURE=1 - the edit
// mode is entered with the screen's existing edit toggle (the "ערוך פריסה" entry point itself moves to the user menu).
// Every seeded id carries `lib1_`. SW_SHOTS=<dir> saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';
const AREA = 'lib1_hall';

const FLOORS = [{ floor_id: 'lib1_ground', name: 'קרקע', level: 0 }];
const AREAS = [
  { area_id: AREA, name: 'אולם ספורט', floor_id: 'lib1_ground' },
  { area_id: 'lib1_store', name: 'מחסן', floor_id: 'lib1_ground' },
];
const ENTITIES: { entity_id: string; area_id: string }[] = [];
const STATES: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
function add(entity_id: string, area_id: string, state: string, attributes: Record<string, unknown>) {
  ENTITIES.push({ entity_id, area_id });
  STATES.push({ entity_id, state, attributes });
}
for (let i = 1; i <= 3; i++) add(`light.lib1_l${i}`, AREA, i === 1 ? 'on' : 'off', { friendly_name: `תאורה ${i}`, brightness: 150 });
for (let i = 1; i <= 2; i++) add(`switch.lib1_s${i}`, AREA, 'off', { friendly_name: `מתג ${i}` });
add('climate.lib1_ac', AREA, 'cool', { friendly_name: 'מזגן אולם', current_temperature: 24, temperature: 22, hvac_modes: ['off', 'cool'] });
add('cover.lib1_blind', AREA, 'open', { friendly_name: 'תריס אולם', current_position: 80, device_class: 'blind' });
add('lock.lib1_front', AREA, 'locked', { friendly_name: 'דלת אולם', device_class: 'lock' });
add('binary_sensor.lib1_door', AREA, 'off', { friendly_name: 'מגע דלת', device_class: 'door' });
add('media_player.lib1_tv', AREA, 'playing', { friendly_name: 'מסך אולם' });
for (let i = 1; i <= 4; i++) add(`sensor.lib1_t${i}`, AREA, String(20 + i), { friendly_name: `טמפרטורה ${i}`, unit_of_measurement: '°C', device_class: 'temperature' });
for (let i = 1; i <= 3; i++) add(`sensor.lib1_p${i}`, AREA, String(100 * i), { friendly_name: `הספק ${i}`, unit_of_measurement: 'W', device_class: 'power' });
add('sensor.lib1_h1', AREA, '55', { friendly_name: 'לחות אולם', unit_of_measurement: '%', device_class: 'humidity' });
// the second area has lights and sensors only: the library must not offer it a covers / climate / media card
add('light.lib1_store', 'lib1_store', 'off', { friendly_name: 'תאורת מחסן' });
add('sensor.lib1_store_t', 'lib1_store', '18', { friendly_name: 'טמפרטורת מחסן', unit_of_measurement: '°C', device_class: 'temperature' });

test.describe('the area layout editor: device picker, delete card, card library', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < STATES.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES.slice(i, i + 50) } })).status()).toBe(200);
    for (const a of [AREA, 'lib1_store']) await request.delete(`/api/v1/devices/layouts/area/${a}`);
  }

  async function open(page: Page, areaId = AREA) {
    await page.goto('about:blank');
    await page.goto(`/?design=a#/devices/areas/${areaId}`);
    await page.waitForSelector('devices-area');
    await page.waitForTimeout(800);
  }

  async function shot(page: Page, name: string, testInfo: { project: { name: string } }) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${testInfo.project.name}.png`) });
  }

  const area = (page: Page) => page.locator('devices-area');

  async function editMode(page: Page) {
    await area(page).locator('[data-layout-edit]').click();
    await expect(area(page).locator('[data-layout-bar]')).toBeVisible();
  }

  async function selectCard(page: Page, key: string) {
    // a click on the card's handle selects it (keyboard focus would do the same)
    await area(page).locator(`.lay-item[data-lay-key="${key}"]`).focus();
    await expect(area(page).locator(`[data-layout-panel="${key}"]`)).toBeVisible();
  }

  const record = async (request: APIRequestContext, id = AREA) => (await (await request.get(`/api/v1/devices/layouts/area/${id}`)).json()).desktop?.layout;

  const boxes = (page: Page) =>
    area(page).locator('.lay-grid > [data-lay-key]').evaluateAll((els) => els.map((e) => ({ key: e.getAttribute('data-lay-key'), r: e.getBoundingClientRect() })));

  function overlaps(list: { key: string | null; r: DOMRect }[]) {
    const out: string[] = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i].r;
        const b = list[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${list[i].key}/${list[j].key}`);
      }
    return out;
  }

  test('device picker: select all / none / invert, the filter scopes them, group headers, a live count, no nested scroll; saved and applied for everyone', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    try {
      await open(page);
      const a = area(page);
      await expect(a.locator('sw-card[data-card="sensors"]')).toBeVisible({ timeout: 30000 });
      await expect(a.locator('sw-card[data-card="sensors"] .tile')).toHaveCount(8);
      await editMode(page);
      await selectCard(page, 'card:sensors');
      const picker = a.locator('[data-layout-panel="card:sensors"] [data-layout-picker]');
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('8 מתוך 8');
      // grouped under the sensors card's own type headers, each with its select box and count
      await expect(picker.locator('[data-layout-group]')).toHaveCount(3);
      await expect(picker.locator('input[data-layout-ent-group="טמפרטורה"]')).toBeChecked();
      // the list itself never scrolls; the search row sticks to the panel
      const nested = await picker.locator('[data-layout-entities]').evaluate((e) => ({ overflow: getComputedStyle(e).overflowY, fits: e.scrollHeight <= e.clientHeight + 1 }));
      expect(nested.overflow).toBe('visible');
      expect(nested.fits).toBe(true);
      // "הסר הכל": nothing shown, the count follows live, the card says so
      await picker.locator('[data-layout-ent-none]').click();
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('0 מתוך 8');
      await expect(picker.locator('input[data-layout-entity]:checked')).toHaveCount(0);
      // a filter scopes the bulk buttons to the results
      await picker.locator('[data-layout-ent-filter]').fill('הספק');
      await expect(picker.locator('input[data-layout-entity]')).toHaveCount(3);
      await expect(picker.locator('[data-layout-ent-scope]')).toContainText('3');
      await picker.locator('[data-layout-ent-all]').click();
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('3 מתוך 8');
      await picker.locator('[data-layout-ent-filter]').fill('');
      await expect(picker.locator('input[data-layout-entity]:checked')).toHaveCount(3);
      // invert the whole list: the other five are shown, the three are hidden
      await picker.locator('[data-layout-ent-invert]').click();
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('5 מתוך 8');
      // a group's own box selects / clears just that group
      await picker.locator('input[data-layout-ent-group="טמפרטורה"]').uncheck();
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('1 מתוך 8');
      await picker.locator('input[data-layout-ent-group="טמפרטורה"]').check();
      await expect(picker.locator('[data-layout-ent-count]')).toContainText('5 מתוך 8');
      await shot(page, 'area-picker', testInfo);
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      const saved = await record(request);
      expect(saved.items['card:sensors'].hidden_entities).toEqual(['sensor.lib1_p1', 'sensor.lib1_p2', 'sensor.lib1_p3']);
      await page.reload();
      await expect(a.locator('sw-card[data-card="sensors"] .tile')).toHaveCount(5, { timeout: 30000 });
    } finally {
      await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
    }
  });

  test('"מחק כרטיס": the card leaves the screen, its devices are not deleted (they join the unplaced pool), "בטל מחיקה" brings it back; saved, it stays gone', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    try {
      await open(page);
      const a = area(page);
      await expect(a.locator('sw-card[data-card="media"]')).toBeVisible({ timeout: 30000 });
      await editMode(page);
      await selectCard(page, 'card:media');
      await a.locator('[data-layout-delete-card]').click();
      await expect(a.locator('sw-card[data-card="media"]')).toHaveCount(0);
      await expect(a.locator('[data-layout-undo-msg]')).toContainText('נמחק');
      // nothing left the platform
      expect((await (await request.get('/api/v1/devices/areas/lib1_hall')).json()).cards.media.count).toBe(1);
      // undo: the card is back, in place
      await a.locator('[data-layout-undo]').click();
      await expect(a.locator('sw-card[data-card="media"]')).toBeVisible();
      await expect(a.locator('[data-layout-undo-msg]')).toHaveCount(0);
      // delete for real, another card too; the rows below move up (no hole)
      const before = await boxes(page);
      await selectCard(page, 'card:media');
      await a.locator('[data-layout-delete-card]').click();
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      const saved = await record(request);
      expect(saved.v).toBe(3);
      expect(saved.items['card:media'].removed).toBe(true);
      await page.reload();
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(a.locator('sw-card[data-card="media"]')).toHaveCount(0);
      expect(before.length).toBeGreaterThan((await boxes(page)).length);
      // its device is still in the area, and free for another card: a new free card starts with the unplaced devices
      await editMode(page);
      await a.locator('[data-layout-add-card]').click();
      const dlg = a.locator('[data-layout-library="open"]');
      await expect(dlg).toContainText('1 התקנים לא ממוקמים');
      await dlg.locator('[data-layout-add="free"]').click();
      const free = a.locator('sw-card[data-card-type="free"]');
      await expect(free).toContainText('מסך אולם');
      await shot(page, 'area-deleted-free', testInfo);
    } finally {
      await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
    }
  });

  test('card library: only the types that make sense for the area (all on request); several cards of one type, each with its own name, devices and colours; placed without overlap; saved as layout v 3 and shown to a viewer after a reload', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    test.setTimeout(120_000);
    await seed(request);
    let binding = '';
    try {
      // the store has no climate / covers / media / security device: those types are not offered there
      await open(page, 'lib1_store');
      await editMode(page);
      await area(page).locator('[data-layout-add-card]').click();
      const store = area(page).locator('[data-layout-library="open"]');
      await expect(store.locator('[data-layout-add="lighting"]')).toBeVisible();
      await expect(store.locator('[data-layout-add="sensors"]')).toBeVisible();
      await expect(store.locator('[data-layout-add="free"]')).toBeVisible();
      for (const t of ['climate', 'covers', 'media', 'locks', 'energy', 'security']) await expect(store.locator(`[data-layout-add="${t}"]`)).toHaveCount(0);
      await store.locator('input[data-layout-library-all]').check();
      for (const t of ['climate', 'covers', 'media', 'locks', 'energy', 'security', 'switches']) await expect(store.locator(`[data-layout-add="${t}"]`)).toHaveCount(1);
      await store.locator('[data-layout-library-close]').click();
      await area(page).locator('sw-button[data-layout-cancel]').click();

      // the hall has everything
      await open(page);
      const a = area(page);
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await editMode(page);
      await a.locator('[data-layout-add-card]').click();
      const lib = a.locator('[data-layout-library="open"]');
      for (const t of ['lighting', 'switches', 'climate', 'covers', 'security', 'media', 'sensors', 'locks', 'energy', 'free']) await expect(lib.locator(`[data-layout-add="${t}"]`)).toBeVisible();
      await expect(lib.locator('[data-layout-add="energy"]')).toContainText('הספק 1'); // a one-line description and a small preview
      await shot(page, 'area-library', testInfo);
      // two sensors cards and an energy card, each named
      await lib.locator('[data-layout-add="sensors"]').click();
      const panel = (key: string) => a.locator(`[data-layout-panel="${key}"]`);
      const first = await a.locator('.lay-item[data-lay-key^="card:c-"]').first().getAttribute('data-lay-key');
      expect(first).toBeTruthy();
      await expect(panel(first!)).toBeVisible();
      await panel(first!).locator('[data-layout-title]').fill('חיישני כניסה');
      // its own devices: only the four temperatures
      const pick = panel(first!).locator('[data-layout-picker]');
      await pick.locator('[data-layout-ent-none]').click();
      await pick.locator('[data-layout-ent-filter]').fill('טמפרטורה');
      await pick.locator('[data-layout-ent-all]').click();
      await pick.locator('[data-layout-ent-filter]').fill('');
      await expect(pick.locator('[data-layout-ent-count]')).toContainText('4 מתוך');
      await panel(first!).locator('[data-layout-bg="warm"]').click();
      await a.locator('[data-layout-add-card]').click();
      await a.locator('[data-layout-library="open"] [data-layout-add="sensors"]').click();
      const keys = await a.locator('.lay-item[data-lay-key^="card:c-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-lay-key')!));
      expect(keys).toHaveLength(2);
      const second = keys.find((k) => k !== first)!;
      await expect(panel(second)).toBeVisible();
      await panel(second).locator('[data-layout-title]').fill('חיישני הספק');
      const pick2 = panel(second).locator('[data-layout-picker]');
      await pick2.locator('[data-layout-ent-none]').click();
      await pick2.locator('[data-layout-ent-filter]').fill('הספק');
      await pick2.locator('[data-layout-ent-all]').click();
      await panel(second).locator('[data-layout-border="danger"]').click();
      await a.locator('[data-layout-add-card]').click();
      await a.locator('[data-layout-library="open"] [data-layout-add="energy"]').click();
      // placed automatically: nothing overlaps, every card inside the 12 columns
      const list = await boxes(page);
      expect(list.length).toBe(10);
      expect(overlaps(list)).toEqual([]);
      const grid = (await a.locator('.lay-grid').boundingBox())!;
      for (const b of list) expect(b.r.right).toBeLessThanOrEqual(grid.x + grid.width + 1);
      await expect(a.locator('sw-card[data-custom-card][data-card-type="sensors"]')).toHaveCount(2);
      await shot(page, 'area-added-cards', testInfo);
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      const saved = await record(request);
      expect(saved.v).toBe(3);
      const customs = Object.entries(saved.items as Record<string, { custom?: { type: string; entities: string[] }; title: string | null; bg: string | null; border: string | null }>).filter(([, it]) => it.custom);
      expect(customs.map(([, it]) => it.title).sort()).toEqual(['אנרגיה', 'חיישני הספק', 'חיישני כניסה'].sort());
      const byTitle = Object.fromEntries(customs.map(([, it]) => [it.title, it]));
      expect(byTitle['חיישני כניסה'].custom!.entities).toEqual(['sensor.lib1_t1', 'sensor.lib1_t2', 'sensor.lib1_t3', 'sensor.lib1_t4']);
      expect(byTitle['חיישני כניסה'].bg).toBe('warm');
      expect(byTitle['חיישני הספק'].custom!.entities).toEqual(['sensor.lib1_p1', 'sensor.lib1_p2', 'sensor.lib1_p3']);
      expect(byTitle['חיישני הספק'].border).toBe('danger');
      expect(byTitle['אנרגיה'].custom!.type).toBe('energy');
      // a reload keeps them; another user (a viewer) sees the same cards and gets no editor
      await page.reload();
      await expect(a.locator('sw-card[data-custom-card]')).toHaveCount(3, { timeout: 30000 });
      await expect(a.locator('sw-card[heading="חיישני כניסה"] .tile')).toHaveCount(4);
      await expect(a.locator('sw-card[heading="חיישני הספק"] .tile')).toHaveCount(3);
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': 'lib1viewer' } })).json();
      const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'installation', scope_id: '*' } });
      binding = ((await b.json()) as { id: string }).id;
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'lib1viewer' } });
      const p = await ctx.newPage();
      await open(p);
      await expect(p.locator('devices-area sw-card[data-custom-card]')).toHaveCount(3, { timeout: 30000 });
      await expect(p.locator('devices-area [data-layout-edit], devices-area [data-layout-add-card]')).toHaveCount(0);
      await ctx.close();
      // editing again: the cards can be deleted with the built-in ones, and the record follows
      await open(page);
      await editMode(page);
      await selectCard(page, keys[0]);
      await a.locator('[data-layout-delete-card]').click();
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      expect(Object.keys((await record(request)).items).filter((k) => k.startsWith('card:c-'))).toHaveLength(2);
    } finally {
      if (binding) await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
      for (const id of [AREA, 'lib1_store']) await request.delete(`/api/v1/devices/layouts/area/${id}`);
    }
  });

  test('phone: the editor keeps the card set on the desktop layout - no add / delete / device picker for a custom card there', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    try {
      expect((await request.put(`/api/v1/devices/layouts/area/${AREA}`, {
        data: { variant: 'desktop', revision: 0, layout: { v: 3, cols: 12, items: { 'card:c-phone123': { x: 0, y: 0, w: 12, h: 12, title: 'כרטיס אישי', custom: { type: 'free', entities: ['light.lib1_l1'] } } } } },
      })).status()).toBe(200);
      await open(page);
      await expect(area(page).locator('sw-card[data-custom-card]')).toBeVisible({ timeout: 30000 });
      await editMode(page);
      await expect(area(page).locator('[data-layout-add-card]')).toHaveCount(0);
      await selectCard(page, 'card:c-phone123');
      await expect(area(page).locator('[data-layout-picker-desktop-only]')).toBeVisible();
      await expect(area(page).locator('[data-layout-delete-card]')).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await shot(page, 'area-phone-editor', testInfo);
    } finally {
      await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
    }
  });
});

export type { Locator };
