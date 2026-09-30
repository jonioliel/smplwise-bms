import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared space (CR-009 sections 13 and 14, owner decisions 2026-09-30) against the REAL SMPLWISE backend whose Home Assistant is the
 * WisKey fake of tests/fixtures/wiskey_fake_ha.py (four stations: "שער ראשי", "לובי", "משרד", "מחסן"; no real WisKey, door station
 * or Home Assistant is reached):
 *  - a WisKey station is a member of a shared space: found by the search box of the member picker, added, listed with its icon
 *    and "מוצג בכל קומות החלל" in the room panel of either floor and on the live map, removed;
 *  - deleting a shared room: on the MIRROR floor there is no "מחק אזור" - a note says where the room was made and a button
 *    jumps to that floor with the room selected ("בטל שיתוף" stays); on the HOME floor "מחק אזור" opens ONE confirmation that
 *    says what will happen and, on confirm, unshares and deletes in one server call.
 *
 *   SW_PORT=4901 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/wiskey_fake_ha.py
 *   (frontend/) npm run build; SW_LIVE=1 SW_WISKEY_FIXTURE=1 SW_API_PORT=4901 SW_BASE_URL=http://127.0.0.1:4903/ npx playwright test tests/evidence-shared-space-stations.spec.ts --project=desktop --workers=1
 *
 * The spec builds its own site / building / two floors and removes them. Screenshots (SW_SHOT_DIR, off by default) are named "ss-*".
 */
const SHOTS = process.env.SW_SHOT_DIR || '';
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `ss-${name}.png`) });
}
const ed = 'explore-plan-editor';
const HALL = [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.7 }];
const WIDE = [{ x: 0.15, y: 0.05 }, { x: 0.65, y: 0.05 }, { x: 0.65, y: 0.75 }, { x: 0.15, y: 0.75 }];
const ids = { site: '', building: '', fm1: '', f0: '', hall: '', dup: '' };
let api: APIRequestContext;

async function clickPlan(page: Page, x: number, y: number) {
  const canvas = page.locator('sw-plan-canvas');
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

async function selectRoom(page: Page, floor: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/${floor}/edit`);
  await page.locator(`${ed} [data-tool="zones"]`).click({ timeout: 30000 });
  await page.locator(`${ed} [data-zone-row]`, { hasText: 'אולם ספורט' }).click();
}

test.describe.serial('shared space: WisKey stations as members, and deleting a shared room in one step (CR-009 13 / 14)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 with the WisKey fixture backend running');
  // 0.1.148 (ui.mobile): the plan editor (structure management) is hidden on a phone by default; the header names the desktop project only.
  test.skip(({ hasTouch }) => hasTouch, 'the plan editor is not offered on a phone (אפשרויות נייד) - desktop project only');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת עמדות בחלל ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'בניין ספורט' } })).json()).id;
    ids.fm1 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה -1', level: -1 } })).json()).id;
    ids.f0 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה 0', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const floor of [ids.fm1, ids.f0]) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      const v = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${v}/publish`)).status()).toBe(200);
      expect((await api.patch(`api/v1/plan-versions/${v}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 40 }] } })).status()).toBe(200);
    }
    ids.hall = (await (await api.post(`api/v1/floors/${ids.fm1}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: HALL } })).json()).id;
    ids.dup = (await (await api.post(`api/v1/floors/${ids.f0}/zones`, { data: { name: 'אולם ספורט', kind: 'room', polygon: WIDE } })).json()).id;
    const shared = await api.post(`api/v1/zones/${ids.hall}/share`, { data: { floor_id: ids.f0, duplicate_zone_id: ids.dup } });
    expect(shared.status(), await shared.text()).toBe(200);
    // the WisKey feed connects when someone looks at the entry center: look, and wait for the served copy
    await expect.poll(async () => (await (await api.get('api/v1/intercom/overview')).json()).state, { timeout: 40000 }).toBe('ready');
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

  test('a station is found, added, listed with its icon on both screens, and removed', async ({ page }) => {
    await selectRoom(page, ids.f0);
    const list = page.locator(`${ed} sw-share-members`);
    await expect(list.locator('[data-members-list]')).toBeVisible({ timeout: 20000 });
    await expect(list.locator('[data-member-pick] option')).toHaveCount(5); // the placeholder and the four stations
    await list.locator('[data-member-search]').fill('שער');
    await expect(list.locator('[data-member-pick] option')).toHaveCount(2);
    await list.locator('[data-member-pick]').selectOption('wiskey_station|gate');
    await list.locator('[data-member-add]').click();
    const row = list.locator('[data-member="wiskey_station:gate"]');
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('שער ראשי');
    await expect(row).toContainText('עמדת WisKey');
    await expect(row).toContainText('מוצג בכל קומות החלל');
    await expect(row.locator('[data-member-icon="station"]')).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await shot(page, '01-station-member-editor');
    // added: no longer a candidate; a second one, then removed again from the list
    await expect(list.locator('[data-member-pick] option[value="wiskey_station|gate"]')).toHaveCount(0);
    await list.locator('[data-member-pick]').selectOption('wiskey_station|lobby');
    await list.locator('[data-member-add]').click();
    await expect(list.locator('[data-member="wiskey_station:lobby"]')).toBeVisible({ timeout: 15000 });
    await list.locator('[data-member="wiskey_station:lobby"] [data-member-remove]').click();
    await expect(list.locator('[data-member="wiskey_station:lobby"]')).toHaveCount(0, { timeout: 15000 });
    // the API agrees: a member by name only - no state, no door data
    const body = await (await api.get(`api/v1/zones/${ids.hall}/share/members`)).json();
    const m = body.members.find((x: { resource_id: string }) => x.resource_id === 'gate');
    expect(m).toMatchObject({ resource_type: 'wiskey_station', kind: 'station', name: 'שער ראשי', floors: [] });
    expect(Object.keys(m).sort()).toEqual(['added_at', 'floors', 'kind', 'name', 'resource_id', 'resource_type']);
    // the live map of the other floor lists it when the room is selected
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}`);
    await expect(page.locator('sw-plan-canvas')).toHaveCount(1, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await clickPlan(page, 0.62, 0.7);
    const onMap = page.locator('[data-shared-members] sw-share-members');
    await expect(onMap.locator('[data-member="wiskey_station:gate"] [data-member-icon="station"]')).toBeVisible({ timeout: 15000 });
    await shot(page, '02-station-member-live-map');
  });

  test('the mirror floor has no "מחק אזור": a note and a jump to the floor that owns the room', async ({ page }) => {
    await selectRoom(page, ids.f0);
    const insp = page.locator(`${ed} [data-zone-inspector]`);
    await expect(insp.locator('[data-zone-shared="mirror"]')).toBeVisible({ timeout: 20000 });
    await expect(insp.locator('[data-zone-created-on]')).toContainText('האזור נוצר בקומה');
    await expect(insp.locator('[data-zone-created-on]')).toContainText('מחק אותו שם, או בטל שיתוף כאן');
    await expect(insp.getByRole('button', { name: 'מחק אזור' })).toHaveCount(0);
    await expect(insp.locator('[data-zone-unshare]')).toHaveCount(1); // "בטל שיתוף" stays
    await insp.locator('[data-zone-created-on]').scrollIntoViewIfNeeded();
    await shot(page, '03-mirror-floor-note');
    await insp.locator('[data-zone-goto-home]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain(`/explore/floors/${ids.fm1}/edit`);
    expect(await page.evaluate(() => location.hash)).toContain(`zone=${ids.hall}`);
    // the room is selected on the home floor, where the delete is
    const home = page.locator(`${ed} [data-zone-inspector]`);
    await expect(home.locator('[data-zone-shared="home"]')).toBeVisible({ timeout: 20000 });
    await expect(home.getByRole('button', { name: 'מחק אזור' })).toBeVisible();
  });

  test('on the home floor one confirmation lists what will happen, and confirming unshares and deletes at once', async ({ page }) => {
    await selectRoom(page, ids.fm1);
    const insp = page.locator(`${ed} [data-zone-inspector]`);
    await expect(insp.locator('[data-zone-shared="home"]')).toBeVisible({ timeout: 20000 });
    // 1. refused: nothing changes
    const seen: string[] = [];
    page.once('dialog', (d) => {
      seen.push(d.message());
      void d.dismiss();
    });
    await insp.getByRole('button', { name: 'מחק אזור' }).click();
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]).toContain('החדר משותף עם');
    expect(seen[0]).toContain('המחיקה תבטל את השיתוף, תסיר את חברי החלל ותמחק את האזור. המצלמות והישויות לא נמחקות.');
    expect((await api.get(`api/v1/zones/${ids.hall}/share/members`)).status()).toBe(200);
    // 2. confirmed: the share, the members and the room go in one call
    page.once('dialog', (d) => void d.accept());
    const del = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes(`/zones/${ids.hall}`));
    await insp.getByRole('button', { name: 'מחק אזור' }).click();
    const res = await del;
    expect(res.url()).toContain('with_unshare=true');
    expect(res.status()).toBe(204);
    await expect(page.locator(`${ed} [data-zone-row]`, { hasText: 'אולם ספורט' })).toHaveCount(0, { timeout: 15000 });
    const zones = (await (await api.get(`api/v1/floors/${ids.fm1}/zones`)).json()).zones as { id: string }[];
    expect(zones.some((z) => z.id === ids.hall)).toBe(false);
    expect((await api.get(`api/v1/zones/${ids.hall}/share/members`)).status()).toBe(404);
    const other = (await (await api.get(`api/v1/floors/${ids.f0}/zones`)).json()).zones as { id: string; shared?: unknown }[];
    expect(other.find((z) => z.id === ids.dup)).toBeTruthy(); // the other floor keeps its outline, now an ordinary room
    expect(other.find((z) => z.id === ids.dup)?.shared).toBeFalsy();
  });
});
