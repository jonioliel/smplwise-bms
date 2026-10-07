import { test, expect, type APIRequestContext, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plan Studio 5 (T088, ST5): DXF export, the signed plan package and its re-import.
//
// Fixture part (no backend; vite dev server): tests/harness/plan-package-harness.ts mounts the import dialog with the real
// render code, styles and API helpers; page.route answers the preview / import routes. Checks: the dry run is shown
// (source, trust, per-collection changes, missing entities, warnings), the mode switch re-runs the dry run, a package of
// another system cannot be imported until trusted, a refusal is shown, the import sends the revision and the result hash
// the preview showed, RTL, no horizontal overflow, the English strings when the document is English.
//   npx vite --port 4870 & SW_BASE_URL=http://127.0.0.1:4870/ npx playwright test tests/evidence-plan-package.spec.ts --project=desktop --project=mobile
//
// Live part (SW_LIVE=1, a running backend): builds its own site / building / floor with a published structure, opens the
// editor's structure tool, downloads the DXF and the package from the export row, changes the draft, imports the package
// through the dialog (replace) and checks the draft is back on the exported hash; removes its data at the end.
// PLN2: the plan has two levels and stairs between them - the DXF has a layer family per level, the "DXF + picture"
// package carries assets/plan.dxf beside the plan picture, and that package is the one imported back (walls on both
// levels and the stairs restored). On the mobile project the guard itself is asserted (no structure editor on a phone).
// Runner: run_smart.py fixture <branch> evidence-plan-package --project=desktop (group `devices`).
// Screenshots: docs/design/evidence/plan-package/.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'plan-package');
const ED = 'explore-plan-editor';
const PLAN = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
/** The evidence screenshot, also kept in the test's output folder (the runner restores docs/ after a job). */
const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.screenshot({ path: path.join(OUT, name) });
  fs.copyFileSync(path.join(OUT, name), info.outputPath(name));
};

function preview(over: Record<string, unknown> = {}) {
  return {
    origin: { floor_name: 'קומה 2', plan_version_id: 'v-src', stage: 'published', generated_at: '2026-10-06T08:00:00Z', generated_by: 'dana', app_version: '2.1.1',
      installation_id: 'inst-a', same_installation: true, trust: 'installation', kid: 'k1', retired_key: false, doc_hash: 'a'.repeat(64), geometry_hash: 'b'.repeat(64), package_sha256: 'c'.repeat(64) },
    mode: 'replace', result_hash: 'd'.repeat(64), result_geometry_hash: 'e'.repeat(64), base_revision: 7, current_hash: 'f'.repeat(64),
    diff: { collections: { walls: { added: ['w9'], removed: ['w1', 'w2'], changed: [] }, objects: { added: [], removed: [], changed: ['o1'] } }, total: 4, calibration_changed: false, same: false },
    counts: { walls: 3 }, current_counts: { walls: 4 }, same_drawing: true, same_version: true, issues: [], issue_count: 0,
    entities: { anchors_missing: [{ resource_type: 'camera', resource_id: 'cam-9', name: 'מצלמת חניה' }], anchors_unplaced: [], switches_missing: [], items_missing: [], items_added: ['bench.wood'], items_differ: [], rooms_missing: ['חדר ישיבות'] },
    warnings: [],
    ...over,
  };
}

type Calls = { preview: string[]; import: string[] };

async function mount(page: Page, answer: (mode: string, route: Route, url: URL) => Promise<void> | void, calls: Calls, lang = 'he') {
  await page.route('**/api/v1/plan-versions/*/package/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/package/preview')) {
      calls.preview.push(u.search);
      return answer(u.searchParams.get('mode') ?? '', route, u);
    }
    calls.import.push(u.search);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ geometry: { revision: 8 }, result_hash: 'd'.repeat(64) }) });
  });
  await page.goto('/');
  await page.waitForSelector('sw-app');
  const ok = await page.evaluate(async (l) => {
    try {
      await import('/tests/harness/plan-package-harness.ts' as string);
    } catch {
      return false;
    }
    document.documentElement.lang = l;
    document.body.innerHTML = '<pkg-harness dir="rtl" style="display:block;padding:16px"></pkg-harness>';
    return true;
  }, lang);
  test.skip(!ok, 'the harness is served by the vite dev server only (not by vite preview)');
}

async function pick(page: Page) {
  await page.locator('pkg-harness [data-import-package]').setInputFiles({ name: 'plan-v1.swplan.zip', mimeType: 'application/zip', buffer: Buffer.from('PK\x03\x04fake') });
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('fixture: the import dialog', () => {
  test.skip(process.env.SW_LIVE === '1', 'the fixture part runs without a backend');

  test('dry run shown, mode switch, import with the previewed revision and hash', async ({ page }, info) => {
    const calls: Calls = { preview: [], import: [] };
    await mount(page, (mode, route) => json(route, preview(mode === 'merge'
      ? { mode: 'merge', result_hash: '9'.repeat(64), diff: { collections: { walls: { added: ['w9'], removed: [], changed: [] } }, total: 1, calibration_changed: false, same: false } }
      : {})), calls);
    await pick(page);
    const dlg = page.locator('pkg-harness sw-dialog[data-pkg-dialog]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg.locator('[data-pkg-trust="installation"]')).toHaveText('חתומה במערכת הזו');
    await expect(dlg.locator('[data-pkg-coll="walls"]')).toContainText('קירות');
    await expect(dlg.locator('[data-pkg-coll="walls"]')).toContainText('נוספו 1 · הוסרו 2');
    await expect(dlg.locator('[data-pkg-coll="objects"]')).toContainText('השתנו 1');
    await expect(dlg.locator('[data-pkg-missing-kind="cameras"]')).toContainText('מצלמת חניה');
    await expect(dlg.locator('[data-pkg-missing-kind="rooms"]')).toContainText('חדר ישיבות');
    await expect(dlg.locator('[data-pkg-items-added]')).toContainText('bench.wood');
    await expect(dlg.locator('[data-pkg-mode="replace"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('pkg-harness').evaluate((e) => getComputedStyle(e).direction)).toBe('rtl');
    await noOverflow(page);
    await page.screenshot({ path: path.join(OUT, `dialog-replace-${info.project.name}.png`) });
    await dlg.locator('[data-pkg-mode="merge"]').click();
    await expect(dlg.locator('[data-pkg-mode="merge"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.locator('[data-pkg-coll="walls"]')).toHaveText(/נוספו 1$/);
    expect(calls.preview).toEqual(['?mode=replace', '?mode=merge']);
    await dlg.locator('[data-pkg-confirm] button').click();
    await expect(page.locator('pkg-harness [data-harness-imported="1"]')).toHaveCount(1);
    await expect(page.locator('pkg-harness sw-dialog[data-pkg-dialog]')).toHaveCount(0);
    expect(calls.import).toEqual([`?mode=merge&base_revision=7&expect_hash=${'9'.repeat(64)}`]);
  });

  test('another system: the dry run and the import wait for the trust box; a refusal is shown', async ({ page }, info) => {
    const calls: Calls = { preview: [], import: [] };
    let refuse = false;
    const foreignOrigin = { ...preview().origin, trust: 'embedded_key_only', same_installation: false };
    await mount(page, (_mode, route, u) => (refuse
      ? json(route, { code: 'package_tampered', user_message: 'תוכן החבילה אינו תואם את הרשימה החתומה.', retryable: false, correlation_id: '', details: {} }, 422)
      // security review 2.2.0: the server checks a foreign package only after the person trusted it
      : u.searchParams.get('accept_foreign') !== 'true'
        ? json(route, { code: 'package_foreign', user_message: 'החבילה חתומה במפתח של מערכת אחרת; אשר את המקור כדי לייבא.', retryable: false, correlation_id: '',
            details: { reason: 'foreign_key', kid: 'k9', origin: foreignOrigin } }, 409)
        : json(route, preview({ origin: foreignOrigin, warnings: ['other_drawing'], same_drawing: false }))), calls);
    await pick(page);
    const dlg = page.locator('pkg-harness sw-dialog[data-pkg-dialog]');
    await expect(dlg.locator('[data-pkg-gate] [data-pkg-trust="embedded_key_only"]')).toHaveText('חתומה במערכת אחרת');
    await expect(dlg.locator('[data-pkg-diff]')).toHaveCount(0);
    await expect(dlg.locator('[data-pkg-error]')).toHaveCount(0);
    const confirm = dlg.locator('[data-pkg-confirm] button');
    await expect(confirm).toBeDisabled();
    await page.screenshot({ path: path.join(OUT, `dialog-foreign-gate-${info.project.name}.png`) });
    await dlg.locator('[data-pkg-accept-foreign]').check();
    await expect(dlg.locator('[data-pkg-other-drawing]')).toBeVisible();
    await expect(dlg.locator('[data-pkg-accept-foreign]')).toBeChecked();
    expect(calls.preview).toEqual(['?mode=replace', '?mode=replace&accept_foreign=true']);
    await expect(confirm).toBeEnabled();
    await noOverflow(page);
    await page.screenshot({ path: path.join(OUT, `dialog-foreign-${info.project.name}.png`) });
    await confirm.click();
    await expect(page.locator('pkg-harness [data-harness-imported="1"]')).toHaveCount(1);
    await expect(page.locator('pkg-harness sw-dialog[data-pkg-dialog]')).toHaveCount(0);
    expect(calls.import[0]).toContain('accept_foreign=true');
    // a refused package: the message, no import button
    refuse = true;
    await pick(page);
    const again = page.locator('pkg-harness sw-dialog[data-pkg-dialog]');
    await expect(again.locator('[data-pkg-error]')).toHaveText('תוכן החבילה אינו תואם את הרשימה החתומה.');
    await expect(again.locator('[data-pkg-confirm] button')).toBeDisabled();
    await page.screenshot({ path: path.join(OUT, `dialog-refused-${info.project.name}.png`) });
  });

  test('English strings follow the document language', async ({ page }) => {
    const calls: Calls = { preview: [], import: [] };
    await mount(page, (_m, route) => json(route, preview({ diff: { collections: {}, total: 0, calibration_changed: false, same: true }, entities: { anchors_missing: [], anchors_unplaced: [], switches_missing: [], items_missing: [], items_added: [], items_differ: [], rooms_missing: [] } })), calls, 'en');
    await expect(page.locator('pkg-harness [data-harness-exports]')).toContainText('Import package');
    await expect(page.locator('pkg-harness [data-harness-exports]')).toContainText('DXF + picture');
    await pick(page);
    const dlg = page.locator('pkg-harness sw-dialog[data-pkg-dialog]');
    await expect(dlg).toHaveAttribute('heading', 'Import plan package');
    await expect(dlg.locator('[data-pkg-nochange]')).toHaveText('No changes');
    await expect(dlg.locator('[data-pkg-missing]')).toHaveCount(0);
    await expect(dlg.locator('[data-pkg-confirm]')).toHaveText('Import to draft');
  });
});

// ---------------------------------------------------------------------------------------------------- live

const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;
const WALL = (id: string, polyline: number[][], level = 'L0') => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
// PLN2: a second level and stairs between the two, so the DXF has a layer family per level and the package round trip
// carries levels and a connector
const UPPER = { id: 'L1', name: 'גלריה', elevation_m: 3, ceiling_height_m: 2.8, is_default: false, external_ids: {} };
const STAIRS = { id: 'pst', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.5, 0.6], [0.62, 0.6]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} };
/** The local file names of a ZIP (its local headers store them uncompressed). */
const zipNames = (buf: Buffer) => {
  const out: string[] = [];
  for (let i = buf.indexOf('PK\x03\x04', 0, 'latin1'); i >= 0 && i + 30 <= buf.length; i = buf.indexOf('PK\x03\x04', i + 4, 'latin1')) {
    const n = buf.readUInt16LE(i + 26);
    out.push(buf.subarray(i + 30, i + 30 + n).toString('utf8'));
  }
  return out;
};
const DOOR = (id: string, wallId: string) => ({ id, wall_id: wallId, t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
type Draft = { geometry: { revision: number; doc_hash: string }; doc: Record<string, unknown> & { walls: { id: string }[] } };
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;

test.describe.serial('live: export and re-import from the editor', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת חבילה ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת חבילה', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(PLAN) } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    const g = await draft();
    const levels = [...((g.doc.levels as unknown[]) ?? []), UPPER];
    const doc = { ...g.doc, levels, walls: [WALL('pw1', [[0.2, 0.3], [0.7, 0.3]]), WALL('pw2', [[0.2, 0.3], [0.2, 0.8]]), WALL('pw3', [[0.3, 0.7], [0.8, 0.7]], 'L1')],
      openings: [DOOR('pd1', 'pw1')], connectors: [STAIRS],
      labels: [{ id: 'pl1', text: 'לובי', position: [0.45, 0.55], level_id: 'L0', size: 14 }, { id: 'pl2', text: 'גלריה', position: [0.5, 0.75], level_id: 'L1', size: 14 }] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
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
      if (ids.floor) await step('floor', async () => (await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 204);
      if (ids.building) await step('building', async () => (await api.delete(`api/v1/buildings/${ids.building}`)).status(), 204);
      if (ids.site) await step('site', async () => (await api.delete(`api/v1/sites/${ids.site}`)).status(), 204);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('DXF and package from the export row; the package brings the draft back', async ({ page }, info) => {
    test.setTimeout(120_000);
    if (info.project.name === 'mobile') {
      // Why the walls never showed on the phone (2.2.0 gap, root cause): this is the owner's mobile option hide_structure (default ON,
      // decision 2026-09-30, shell/phone.ts): at phone width the plan editor route is replaced by the desktop-only notice, so the canvas
      // (and its walls, and the export row) is never mounted. Not a product bug; the old test expected walls on a screen the phone is not
      // offered. The phone is covered by the fixture part (the dialog) and here by the guard itself.
      await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
      await expect(page.locator('sw-app [data-desktop-only="structure"]')).toContainText('עריכת מבנה וקומות זמינה במחשב בלבד', { timeout: 20000 });
      await expect(page.locator('sw-app sw-plan-canvas')).toHaveCount(0);
      await expect(page.locator('sw-app [data-export-dxf], sw-app [data-export-dxf-package], sw-app [data-import-package]')).toHaveCount(0);
      await noOverflow(page);
      await shot(page, info, 'editor-guard-mobile.png');
      return;
    }
    // the structure tool's export row is a desktop editor panel (wall drawing is desktop-only); the tablet shares the desktop layout
    test.skip(info.project.name !== 'desktop', 'desktop editor only');
    const published = (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json()).geometry.doc_hash as string;
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall]`)).not.toHaveCount(0, { timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    const dxf = page.locator(`${ED} [data-export-dxf]`);
    await expect(dxf).toHaveText('DXF');
    const dxfRes = await api.get(new URL(String(await dxf.getAttribute('href'))).pathname.replace(/^\//, ''));
    expect(dxfRes.status()).toBe(200);
    const dxfText = await dxfRes.text();
    // PLN2: two levels - a layer family per level, the stairs on both levels' connector layers
    for (const layer of ['SW_WALLS-L0', 'SW_WALLS-L1', 'SW_LABELS-L1', 'SW_CONNECTORS-L0', 'SW_CONNECTORS-L1']) expect(dxfText).toContain(layer);
    expect(dxfText).toContain('לובי');
    expect(dxfText).toContain('גלריה');
    expect(dxfText).not.toContain('SW_BACKGROUND');
    await noOverflow(page);
    await page.locator(`${ED} [data-export-package]`).scrollIntoViewIfNeeded();
    await expect(page.locator(`${ED} [data-export-dxf-package]`)).toHaveText('DXF + תמונה');
    await shot(page, info, `editor-exports-${info.project.name}.png`);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`${ED} [data-export-package]`).click()]);
    expect(download.suggestedFilename()).toMatch(/\.swplan\.zip$/);
    const plain = info.outputPath('plan.swplan.zip');
    await download.saveAs(plain);
    expect(fs.readFileSync(plain).subarray(0, 2).toString('latin1')).toBe('PK');
    expect(zipNames(fs.readFileSync(plain))).not.toContain('assets/plan.dxf');
    // the package with the DXF and the plan picture beside it
    await expect(page.locator(`${ED} [data-export-dxf-package]`)).toBeEnabled({ timeout: 20000 });
    const [download2] = await Promise.all([page.waitForEvent('download'), page.locator(`${ED} [data-export-dxf-package]`).click()]);
    expect(download2.suggestedFilename()).toMatch(/\.swplan\.zip$/);
    const file = info.outputPath('plan-dxf.swplan.zip');
    await download2.saveAs(file);
    const names = zipNames(fs.readFileSync(file));
    expect(names).toContain('assets/plan.dxf');
    expect(names.some((n) => /^assets\/background\.[a-z0-9]+$/.test(n))).toBe(true);
    // the draft drifts (a wall on each level and the stairs removed, through the API), then the DXF package brings it back
    const g = await draft();
    const drifted = { ...g.doc, walls: g.doc.walls.filter((w) => w.id !== 'pw2' && w.id !== 'pw3'), connectors: [] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: drifted, base_revision: g.geometry.revision } })).status()).toBe(200);
    await page.locator(`${ED} [data-tool="layers"]`).click();
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-import-package]`).setInputFiles(file);
    const dlg = page.locator(`${ED} sw-dialog[data-pkg-dialog]`);
    await expect(dlg.locator('[data-pkg-trust="installation"]')).toBeVisible({ timeout: 20000 });
    await expect(dlg.locator('[data-pkg-coll="walls"]')).toContainText('נוספו 2');
    await expect(dlg.locator('[data-pkg-coll="connectors"]')).toContainText('נוספו 1');
    await noOverflow(page);
    await shot(page, info, `editor-import-${info.project.name}.png`);
    await dlg.locator('[data-pkg-confirm] button').click();
    await expect(page.locator(`${ED} sw-dialog[data-pkg-dialog]`)).toHaveCount(0, { timeout: 20000 });
    await expect.poll(async () => (await draft()).geometry.doc_hash, { timeout: 10000 }).toBe(published);
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall="pw2"]`).first()).toBeAttached();
    const back = await draft();
    expect(back.doc.walls.map((w) => w.id).sort()).toEqual(['pw1', 'pw2', 'pw3']);
    expect((back.doc.connectors as { id: string }[]).map((c) => c.id)).toEqual(['pst']);
    expect((back.doc.levels as { id: string }[]).map((l) => l.id).sort()).toEqual(['L0', 'L1']);
  });
});
