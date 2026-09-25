import { test, expect, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plan Studio phase 3 (T086) against the running developer backend: the detect tool on the synthetic apartment plan
// (the committed fixture of the backend baseline test), the door-width calibration hint, the refusals the editor handles
// (stubbed with page.route: nothing is really refused), the phone, and the DXF mapping screen on a committed synthetic
// drawing (tests/fixtures/plan-map.dxf, written by gen_plan_map_dxf.py). The spec builds its own site / building / floor
// and removes them at the end. Nothing here reaches Home Assistant. Runs only with SW_LIVE=1, in real Chrome with
// SW_CHROME=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APARTMENT = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
const DXF_M = path.resolve(HERE, 'fixtures', 'plan-map.dxf');
const DXF_MM = path.resolve(HERE, 'fixtures', 'plan-map-mm.dxf');
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;
let estimatesBefore: string | null | undefined;
const ED = 'explore-plan-editor';

type Wall = { id: string; source: string };
type Opening = { id: string; kind: string; width_m: number; wall_id: string };
type Obj = { id: string; item_id: string; external_ids: Record<string, string> };
type Draft = { geometry: { revision: number }; doc: { walls: Wall[]; openings: Opening[]; objects: Obj[]; meta: { last_detection?: { accepted: Record<string, number> } }; dimensions: { calibration: { status: string } | null } } };
const draftOf = async (version = ids.version) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as Draft;

/** The error body every refused route answers with (smplwise/errors.py). */
const refusal = (status: number, code: string, details: Record<string, unknown> = {}, retryable = false) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, user_message: `סירוב מדומה (${code})`, retryable, details }) });
const isDetect = (u: URL) => u.pathname.endsWith('/detect');
const isAccept = (u: URL) => u.pathname.endsWith('/detect/accept');
const isImport = (u: URL) => u.pathname.endsWith('/import-dxf-geometry');

/** The page coordinates of a normalized plan point on the canvas of `screen`. */
async function planPoint(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  return { x: box.x + s.x, y: box.y + s.y };
}

/** Click a normalized plan point on the canvas of `screen`. */
async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const p = await planPoint(page, screen, x, y);
  await page.mouse.click(p.x, p.y);
}

/** Candidates of one kind on the canvas, counted by id: a wall cut by its openings is drawn once per piece. */
const distinct = (loc: Locator) => loc.evaluateAll((els) => new Set(els.map((e) => e.getAttribute('data-candidate'))).size);
const cands = (kind: string) => `${ED} sw-plan-canvas [data-candidates] [data-candidate][data-kind="${kind}"]`;

async function openDetect(page: Page) {
  await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
  await expect(page.locator(`${ED} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
  await page.locator(`${ED} [data-tool="detect"]`).click();
  await expect(page.locator(`${ED} [data-detect-panel][data-detect-state="idle"]`)).toBeAttached();
}

async function runDetect(page: Page) {
  const detected = page.waitForResponse((r) => isDetect(new URL(r.url())) && r.request().method() === 'POST', { timeout: 65000 });
  await page.locator(`${ED} [data-detect-run]`).click();
  const r = await detected;
  expect(r.status()).toBe(200);
  await expect(page.locator(`${ED} [data-detect-panel][data-detect-state="candidates"]`)).toBeAttached();
  return (await r.json()) as { walls: Wall[]; openings: (Opening & { confidence: number })[]; elapsed_ms: number };
}

test.describe.serial('plan studio phase 3 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    estimatesBefore = (await (await api.get('api/v1/settings')).json()).settings['plan.estimates'];
    expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': 'true' } })).status(), 'plan.estimates pinned').toBe(200);
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת זיהוי ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת בדיקה', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(APARTMENT) } } })).json();
    ids.asset = asset.id;
    const v = await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json();
    ids.version = v.id;
    expect(v.width_px, 'the version keeps the fixture at 1600 px (max_render_px >= 1600)').toBe(1600);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    // every step is tried, even after one fails, so a single leftover does not keep the rest in the shared backend
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
      if (estimatesBefore !== undefined && estimatesBefore !== null && estimatesBefore !== 'true')
        await step('plan.estimates restored', async () => (await api.patch('api/v1/settings', { data: { 'plan.estimates': estimatesBefore } })).status(), 200);
      if (ids.floor) await step('test floor removed', async () => (await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 204);
      if (ids.building) await step('test building removed', async () => (await api.delete(`api/v1/buildings/${ids.building}`)).status(), 204);
      if (ids.site) await step('test site removed', async () => (await api.delete(`api/v1/sites/${ids.site}`)).status(), 204);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('detect candidates, accept by confidence, toggle, confirm, undo and redo: the draft gains automatic walls and viewers see nothing until a publish', async ({ page }) => {
    test.setTimeout(180_000);
    await openDetect(page);
    const result = await runDetect(page);
    await expect(page.locator(`${ED} [data-detect-summary]`)).toContainText('קירות');
    await expect(page.locator(`${ED} [data-detect-summary]`)).toContainText('זוהו ב־');
    await expect.poll(() => distinct(page.locator(cands('wall')))).toBe(7); // the apartment fixture: four outer walls and three partitions
    await expect(page.locator(cands('door'))).toHaveCount(4);
    await expect(page.locator(cands('window'))).toHaveCount(3);
    // the hit strokes are transparent (and a horizontal one has an empty box for Playwright): hover by coordinates
    const [a, b] = (result.walls[0] as Wall & { polyline: [number, number][] }).polyline;
    const mid = await planPoint(page, ED, a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4); // off the windows and the T at the middle
    await page.mouse.move(mid.x, mid.y);
    await expect(page.locator(`${ED} sw-plan-canvas [data-cand-score]`)).toHaveAttribute('data-cand-score-for', result.walls[0].id);
    await expect(page.locator(`${ED} sw-plan-canvas [data-cand-score] text`)).toContainText('ביטחון');
    const rows = page.locator(`${ED} [data-cand-row]`);
    const rejected = page.locator(`${ED} [data-cand-row][data-cand-state="rejected"]`);
    await expect(rows).toHaveCount(14);
    await page.locator(`${ED} [data-detect-accept-conf]`).click();
    const low = result.openings.filter((o) => o.confidence < 0.8).map((o) => o.id);
    expect(low.length, 'the two-line window scores 0.75').toBe(1);
    await expect(rejected).toHaveCount(1);
    await expect(page.locator(`${ED} [data-cand-row="${low[0]}"]`)).toHaveAttribute('data-cand-state', 'rejected');
    await expect(page.locator(`${ED} [data-detect-accepted]`)).toHaveText('13');
    await page.locator(`${ED} [data-detect-accept-all]`).click();
    await expect(rejected).toHaveCount(0);
    const first = rows.first(); // the first row is a wall: its openings go with it
    const onFirst = result.openings.filter((o) => o.wall_id === result.walls[0].id).length;
    await first.locator('input').click();
    await expect(first).toHaveAttribute('data-cand-state', 'rejected');
    await expect(rejected).toHaveCount(1 + onFirst);
    await first.locator('input').click(); // the wall comes back; its openings stay rejected until chosen
    await expect(first).toHaveAttribute('data-cand-state', 'accepted');
    await expect(rejected).toHaveCount(onFirst);
    await page.locator(`${ED} [data-detect-accept-all]`).click();
    const before = (await draftOf()).geometry.revision;
    const accepted = page.waitForResponse((r) => isAccept(new URL(r.url())));
    await page.locator(`${ED} [data-detect-confirm]`).click();
    expect((await accepted).status()).toBe(200);
    await expect(page.locator(`${ED} sw-plan-canvas [data-candidates]`)).toHaveCount(0);
    await expect(page.locator(`${ED} sw-plan-canvas [data-structure] [data-wall]`).first()).toBeAttached({ timeout: 10000 });
    expect(await page.locator(`${ED} sw-plan-canvas [data-structure] [data-wall]`).count()).toBeGreaterThanOrEqual(10); // seven walls cut by their openings
    const d = await draftOf();
    expect(d.geometry.revision, 'one accept, one revision').toBe(before + 1);
    expect(d.doc.walls.length).toBe(7);
    expect(d.doc.walls.every((w) => w.source === 'auto')).toBe(true);
    expect(d.doc.openings.length).toBe(7);
    expect(d.doc.meta.last_detection?.accepted).toEqual({ walls: 7, openings: 7, objects: 0 });
    expect((await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).status(), 'nothing published').toBe(404);
    // the accept is one undo step, saved like any edit
    await page.locator(`${ED} button[aria-label="ביטול"]`).click();
    await expect.poll(async () => (await draftOf()).doc.walls.length, { timeout: 15000 }).toBe(0);
    await page.locator(`${ED} button[aria-label="בצע שוב"]`).click();
    await expect.poll(async () => (await draftOf()).doc.walls.length, { timeout: 15000 }).toBe(7);
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await expect(page.locator(`${ED} [data-studio-auto-count]`)).toContainText('14');
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    await clickPlan(page, ED, 0.4, 0.1); // the top wall of the apartment (y = 120 / 1200), between a window and the partition
    await expect(page.locator(`${ED} [data-selected-wall]`)).toBeAttached();
    await expect(page.locator(`${ED} [data-auto-badge="auto"]`)).toContainText('זוהה אוטומטית');
  });

  test('the door-width hint becomes an estimated calibration: metres show with the approximate sign', async ({ page }) => {
    test.setTimeout(180_000);
    await openDetect(page);
    await expect(page.locator(`${ED} [data-detect-replace]`), 'the draft holds automatic walls: replace is offered').toBeAttached();
    await runDetect(page);
    await expect(page.locator(`${ED} [data-calib-hint]`)).toContainText('משוער');
    const patched = page.waitForResponse((r) => r.url().includes('/calibration') && r.request().method() === 'PATCH');
    await page.locator(`${ED} [data-calib-hint-apply]`).click();
    expect((await patched).status()).toBe(200);
    await expect(page.locator(`${ED} [data-calib-hint-applied]`)).toContainText('≈');
    await expect(page.locator(`${ED} [data-calib-hint]`)).toHaveCount(0);
    const v = await (await api.get(`api/v1/plan-versions/${ids.version}`)).json();
    expect(v.calibration.status).toBe('estimated');
    expect(v.calibration.method).toBe('door_width');
    expect(Math.abs(v.scale_m_per_px / 0.01 - 1)).toBeLessThan(0.06); // the fixture draws 90 px doors: 0.9 m / 90 px
    expect((await draftOf()).doc.dimensions.calibration?.status).toBe('estimated');
    await page.locator(`${ED} [data-detect-discard]`).click();
    await expect(page.locator(`${ED} [data-detect-run]`)).toBeAttached();
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await expect(page.locator(`${ED} [data-studio-scale]`)).toContainText('(הערכה, לא מדוד)');
    await page.locator(`${ED} [data-tool="measure"]`).click();
    await clickPlan(page, ED, 0.075, 0.1);
    await clickPlan(page, ED, 0.925, 0.1);
    await expect(page.locator(`${ED} [data-measure-distance]`)).toContainText('≈'); // estimated, not measured
    await expect(page.locator(`${ED} [data-measure-distance]`)).toContainText('13.'); // 0.85 x 1600 px x ~0.0099 m/px
  });

  test('refusals: a timed-out run offers a lighter retry, the replace step names what goes, a stale or refused accept is explained', async ({ page }) => {
    test.setTimeout(180_000);
    await openDetect(page);
    // 504 detect_timeout (stubbed): the error and a retry at a lighter strength
    await page.route(isDetect, refusal(504, 'detect_timeout', { timeout_s: 60 }, true));
    await page.locator(`${ED} [data-detect-run]`).click();
    await expect(page.locator(`${ED} [data-detect-error="detect_timeout"]`)).toContainText('60 שניות');
    await expect(page.locator(`${ED} [data-detect-retry]`)).toContainText('0.40');
    await page.unroute(isDetect);
    const detected = page.waitForResponse((r) => isDetect(new URL(r.url())) && r.request().method() === 'POST', { timeout: 65000 });
    await page.locator(`${ED} [data-detect-retry]`).click();
    const run = await detected;
    expect(run.status()).toBe(200);
    expect(JSON.parse(run.request().postData() ?? '{}').strength).toBe(0.4);
    await expect(page.locator(`${ED} [data-detect-panel][data-detect-state="candidates"]`)).toBeAttached();
    const set = (await run.json()) as { walls: Wall[]; openings: Opening[] };
    expect(set.walls.length).toBeGreaterThan(0);
    // the draft holds 14 automatic items: "אשר" first names what the replace removes
    await page.locator(`${ED} [data-detect-confirm]`).click();
    await expect(page.locator(`${ED} [data-detect-replace-counts]`)).toContainText('7 קירות');
    await expect(page.locator(`${ED} [data-detect-replace-counts]`)).toContainText('7 פתחים');
    // 409 stale_revision (stubbed): explained, with a reload that keeps the candidates
    await page.route(isAccept, refusal(409, 'stale_revision', { current_revision: 99, sent_revision: 1 }));
    await page.locator(`${ED} [data-detect-replace-go]`).click();
    await expect(page.locator(`${ED} [data-detect-accept-error="stale_revision"]`)).toBeAttached();
    await expect(page.locator(`${ED} [data-detect-reload]`)).toBeAttached();
    await page.locator(`${ED} [data-detect-reload]`).click();
    await expect(page.locator(`${ED} [data-detect-accept-error]`)).toHaveCount(0);
    await expect(page.locator(`${ED} [data-detect-panel][data-detect-state="candidates"]`)).toBeAttached();
    await page.unroute(isAccept);
    // 422 candidate_shape naming one candidate (stubbed): its row is marked
    const marked = set.openings[0].id;
    await page.route(isAccept, refusal(422, 'candidate_shape', { ids: [marked] }));
    await page.locator(`${ED} [data-detect-confirm]`).click();
    await page.locator(`${ED} [data-detect-replace-go]`).click();
    await expect(page.locator(`${ED} [data-detect-accept-error="candidate_shape"]`)).toBeAttached();
    await expect(page.locator(`${ED} [data-cand-row="${marked}"][data-cand-bad]`)).toBeAttached();
    await page.unroute(isAccept);
    // 422 geometry_structure (stubbed): the issues list, one button per issue
    await page.route(isAccept, refusal(422, 'geometry_structure', { issues: [{ id: set.walls[0].id, message: 'קיר קצר מדי (מדומה)', severity: 'error' }] }));
    await page.locator(`${ED} [data-detect-confirm]`).click();
    await page.locator(`${ED} [data-detect-replace-go]`).click();
    await expect(page.locator(`${ED} [data-detect-issues]`)).toContainText('קיר קצר מדי (מדומה)');
    await page.unroute(isAccept);
    // the real replace: the 14 earlier automatic items go, the new ones come in, one revision
    const accepted = page.waitForResponse((r) => isAccept(new URL(r.url())));
    await page.locator(`${ED} [data-detect-confirm]`).click();
    await page.locator(`${ED} [data-detect-replace-go]`).click();
    const acc = await accepted;
    expect(acc.status()).toBe(200);
    const merge = (await acc.json()).merge as { removed_auto: number; accepted: { walls: number } };
    expect(merge.removed_auto).toBe(14);
    expect(merge.accepted.walls).toBe(set.walls.length);
    await expect(page.locator(`${ED} sw-plan-canvas [data-candidates]`)).toHaveCount(0);
    expect((await draftOf()).doc.walls.every((w) => w.source === 'auto')).toBe(true);
  });

  test('phone: detection is available, candidate editing is not', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openDetect(page);
    await runDetect(page);
    await expect(page.locator(`${ED} [data-detect-phone-note]`)).toContainText('במסך רחב');
    const canvasBox = (await page.locator(`${ED} sw-plan-canvas`).boundingBox())!;
    const panelBox = (await page.locator(`${ED} [data-detect-panel]`).boundingBox())!;
    expect(panelBox.y, 'the panel sits below the plan').toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBe(390);
    const firstWall = page.locator(`${ED} [data-cand-row]`).first();
    const id = await firstWall.getAttribute('data-cand-row');
    await firstWall.locator('.linkbtn').click(); // select the first candidate (a wall)
    await expect(page.locator(`${ED} [data-cand-selected="${id}"]`)).toContainText('≈');
    await expect(page.locator(`${ED} sw-plan-canvas [data-cand-vertex]`)).toHaveCount(0); // no end handles on a phone
    await page.locator(`${ED} [data-detect-discard]`).click();
    await expect(page.locator(`${ED} [data-detect-panel][data-detect-state="idle"]`)).toBeAttached();
  });

  test('DXF: the import screen maps the layers and blocks, a refused import can be retried, and the candidates reach the editor', async ({ page }) => {
    test.setTimeout(240_000);
    const im = 'explore-plan-import';
    const dxf = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan-map.dxf', mimeType: 'application/octet-stream', buffer: fs.readFileSync(DXF_M) } } })).json();
    expect(dxf.kind).toBe('dxf');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/import`);
    await page.locator(`${im} .assets button`, { hasText: 'plan-map.dxf' }).click();
    await expect(page.locator(`${im} [data-dxf]`)).toBeAttached({ timeout: 20000 });
    await expect(page.locator(`${im} [data-dxf-units]`)).toHaveText('m');
    await page.locator(`${im} sw-button`, { hasText: 'הבא' }).click();
    await page.locator(`${im} sw-button`, { hasText: 'הבא' }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith('/plan-versions') && r.request().method() === 'POST');
    await page.locator(`${im} sw-button`, { hasText: 'שמור כטיוטה' }).click();
    const savedR = await saved;
    expect(savedR.status()).toBe(201);
    const dxfVersion = (await savedR.json()).id as string;
    const card = page.locator(`${im} [data-dxf-map][aria-busy="false"]`);
    await expect(card.locator('[data-dxf-map-row="A-WALL"]')).toBeAttached({ timeout: 20000 });
    for (const [layer, target] of [['A-WALL', 'walls'], ['A-DOOR', 'openings'], ['A-GLAZ', 'windows'], ['A-FURN', 'objects'], ['A-AREA', 'rooms'], ['TEXT', 'ignore']])
      await expect(card.locator(`[data-dxf-map-row="${layer}"] select[data-dxf-map-target]`), layer).toHaveValue(target);
    await expect(card.locator('[data-dxf-block-row="CHAIR"] select[data-dxf-block-target]')).toHaveValue('chair.basic');
    await expect(card.locator('[data-dxf-block-row="WIDGET"] select[data-dxf-block-target]')).toHaveValue('object.generic');
    await expect(card.locator('[data-dxf-block-row="DOOR90"] select[data-dxf-block-target]'), 'a door block is no object').toHaveValue('');
    await expect(card.locator('[data-dxf-block-row="DOOR90"] [data-dxf-block-none]')).toBeAttached();
    await expect(card.locator('[data-dxf-block-size-unit="m"]')).toBeAttached();
    await card.locator('[data-dxf-block-row="WIDGET"] select[data-dxf-block-target]').selectOption('chair.basic'); // an override
    await expect(card.locator('[data-dxf-map-count]')).toContainText('5 שכבות ממופות');
    // 504 dxf_timeout (stubbed): the refusal and a retry
    await page.route(isImport, refusal(504, 'dxf_timeout', { timeout_s: 60 }, true));
    await card.locator('[data-dxf-import]').click();
    await expect(page.locator(`${im} [data-dxf-map-error="dxf_timeout"]`)).toBeAttached();
    await page.unroute(isImport);
    const imported = page.waitForResponse((r) => r.url().endsWith('/import-dxf-geometry'), { timeout: 65000 });
    await page.locator(`${im} [data-dxf-retry]`).click();
    const imp = await imported;
    expect(imp.status()).toBe(200);
    const sent = JSON.parse(imp.request().postData() ?? '{}') as { layer_map: Record<string, string>; block_map: Record<string, string | null> };
    expect(sent.block_map, 'only the override is sent; the door block stays out').toEqual({ WIDGET: 'chair.basic' });
    await expect(page.locator(`${im} [data-dxf-imported]`)).toContainText('קירות 7');
    await expect(page.locator(`${im} [data-dxf-imported]`)).toContainText('פתחים 3');
    await expect(page.locator(`${im} [data-dxf-imported]`)).toContainText('עצמים 5');
    await expect(page.locator(`${im} [data-dxf-imported-rooms]`)).toContainText('חדרים: 1');
    await page.locator(`${im} [data-dxf-open-editor]`).click();
    await expect(page).toHaveURL(/candidates=dxf/);
    await expect(page.locator(`${ED} [data-detect-summary]`)).toContainText('DXF', { timeout: 20000 });
    await expect(page.locator(`${ED} [data-detect-summary]`)).toContainText('5 עצמים');
    await expect.poll(() => distinct(page.locator(cands('wall')))).toBe(7); // six paired walls and the single-line partition
    await expect(page.locator(cands('door'))).toHaveCount(2); // the loose arc and the DOOR90 block on the door layer
    await expect(page.locator(cands('window'))).toHaveCount(1);
    await expect(page.locator(`${ED} [data-detect-objects]`)).toBeChecked();
    await expect(page.locator(`${ED} [data-detect-rooms]`)).toContainText('חדר אחד');
    const accepted = page.waitForResponse((r) => isAccept(new URL(r.url())));
    await page.locator(`${ED} [data-detect-confirm]`).click();
    expect((await accepted).status()).toBe(200);
    await expect(page.locator(`${ED} [data-detect-accept-error]`)).toHaveCount(0);
    await expect(page.locator(`${ED} sw-plan-canvas [data-candidates]`)).toHaveCount(0);
    const g = await draftOf(dxfVersion);
    expect(g.doc.walls.length).toBe(7);
    expect(g.doc.walls.every((w) => w.source === 'imported')).toBe(true);
    const doors = g.doc.openings.filter((o) => o.kind === 'door');
    expect(doors.length).toBe(2);
    for (const o of doors) expect(Math.abs(o.width_m - 0.9)).toBeLessThan(0.02);
    expect(g.doc.openings.filter((o) => o.kind === 'window').length).toBe(1);
    const objs = g.doc.objects.map((o) => `${o.external_ids.dxf_block}:${o.item_id}`).sort();
    expect(objs, 'the override reached the draft; the door block on the furniture layer is no object').toEqual(['CHAIR:chair.basic', 'DESK:table.desk', 'DESK:table.desk', 'DESK:table.desk', 'WIDGET:chair.basic']);
    expect(g.doc.dimensions.calibration?.status).toBe('measured'); // the DXF units gave the version its scale
    // the millimetre copy of the drawing maps the same (API only)
    const mm = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan-map-mm.dxf', mimeType: 'application/octet-stream', buffer: fs.readFileSync(DXF_MM) } } })).json();
    const mmV = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: mm.id } })).json()).id as string;
    const mmR = await api.post(`api/v1/plan-versions/${mmV}/import-dxf-geometry`, { data: { layer_map: sent.layer_map, block_map: {} } });
    expect(mmR.status()).toBe(200);
    const mmSet = (await mmR.json()) as { walls: Wall[]; openings: Opening[]; objects: Obj[] };
    expect([mmSet.walls.length, mmSet.openings.length, mmSet.objects.length]).toEqual([7, 3, 5]);
    for (const o of mmSet.openings.filter((x) => x.kind === 'door')) expect(Math.abs(o.width_m - 0.9)).toBeLessThan(0.02);
  });
});
