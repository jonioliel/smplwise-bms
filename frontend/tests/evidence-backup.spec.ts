import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for project backups (T026 / T036) against the running developer backend: a backup is created from
// the settings screen, listed with its counts, downloadable as a zip, and restored in merge mode after typing
// RESTORE. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T026-backup-live');
const FIXTURE = path.join(HERE, 'fixtures', 'quadrant.png');

test.describe('project backups (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('create, list, download, restore (merge)', async ({ page, request }, testInfo) => {
    await open(page, '/system/diagnostics');
    const screen = page.locator('system-diagnostics');
    await screen.getByText('גיבוי ושחזור').first().click();
    await expect(screen.locator('[data-backup-create]')).toBeVisible();
    const before = await request.get('/api/v1/backups');
    expect(before.status()).toBe(200);
    const nBefore = (await before.json()).backups.length;

    await screen.locator('input.note-in').fill('ראיות T026');
    await screen.locator('[data-backup-create]').click();
    await expect(screen.locator('[data-backup-msg]')).toContainText('נוצר', { timeout: 30000 });
    await expect.poll(async () => (await (await request.get('/api/v1/backups')).json()).backups.length, { timeout: 10000 }).toBe(nBefore + 1);
    const rows = screen.locator('[data-backup-row]');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText('ראיות T026');
    await expect(rows.first()).toContainText('קומות');
    await page.screenshot({ path: path.join(OUT, `backups-${testInfo.project.name}.png`), fullPage: true });

    // download is a real zip
    const href = await rows.first().locator('[data-backup-download]').getAttribute('href');
    expect(href).toBeTruthy();
    const dl = await request.get(href!);
    expect(dl.status()).toBe(200);
    expect(dl.headers()['content-type']).toContain('application/zip');
    expect((await dl.body()).length).toBeGreaterThan(1000);

    // restore in merge mode needs the typed confirmation
    await rows.first().locator('[data-backup-restore]').click();
    const dialog = screen.locator('sw-dialog');
    await expect(dialog.locator('[data-restore-mode]')).toBeVisible(); // the host itself has no box; its content does
    await dialog.locator('[data-restore-mode]').selectOption('merge');
    await expect(dialog.locator('[data-restore-go]')).toHaveAttribute('disabled', ''); // custom element: the attribute is the contract
    await dialog.locator('[data-restore-confirm]').fill('RESTORE');
    await expect(dialog.locator('[data-restore-go]')).not.toHaveAttribute('disabled', '');
    await page.screenshot({ path: path.join(OUT, `restore-dialog-${testInfo.project.name}.png`) });
    await dialog.locator('[data-restore-go]').click();
    await expect(screen.locator('[data-backup-msg]')).toContainText('שוחזר', { timeout: 30000 });
    // the map data is intact after the merge (same floors, still a published plan)
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    expect(floors.some((f: { has_plan: boolean }) => f.has_plan)).toBeTruthy();
  });

  // Owner form item 15 (round 9): the Plan Studio rows travel through a backup. A floor with a published structure (walls, a
  // door, an object), a newer draft of it, a draft plan version with a structure of its own, a zone, an anchor and a custom
  // library item. Floors, anchors and zones are soft-deleted (a tombstone row stays), so a merge restore - which only adds
  // rows that are missing - cannot bring them back; the replace restore (the dialog's default) does.
  type Seed = { site: string; building: string; floor: string; version: string; draftVersion: string; item: string; zone: string; anchor: string };
  const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior',
    confidence: 1, source: 'manual', locked: false, external_ids: {} });
  async function seedStudioFloor(request: APIRequestContext): Promise<Seed> {
    const stamp = new Date().toISOString().slice(0, 19);
    const s = { site: '', building: '', floor: '', version: '', draftVersion: '', item: '', zone: '', anchor: '' };
    s.site = (await (await request.post('/api/v1/sites', { data: { name: `בדיקת גיבוי ${stamp}`, address: '' } })).json()).id;
    s.building = (await (await request.post(`/api/v1/sites/${s.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    s.floor = (await (await request.post(`/api/v1/buildings/${s.building}/floors`, { data: { name: 'קומת גיבוי', level: 0 } })).json()).id;
    const asset = await (await request.post(`/api/v1/floors/${s.floor}/plan-assets`, { multipart: { file: { name: 'quadrant.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    s.version = (await (await request.post(`/api/v1/floors/${s.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await request.post(`/api/v1/plan-versions/${s.version}/publish`)).status()).toBe(200);
    const g = await (await request.get(`/api/v1/plan-versions/${s.version}/geometry?draft=true`)).json();
    const doc = { ...g.doc, walls: [WALL('bw1', [[0.1, 0.2], [0.8, 0.2]]), WALL('bw2', [[0.1, 0.2], [0.1, 0.8]])],
      openings: [{ id: 'bd1', wall_id: 'bw1', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} }],
      objects: [{ id: 'bo1', item_id: 'chair.basic', level_id: 'L0', position: [0.5, 0.5], rotation_deg: 30, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: 'כיסא',
        anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} }] };
    expect((await request.put(`/api/v1/plan-versions/${s.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await request.post(`/api/v1/plan-versions/${s.version}/geometry/publish`)).status()).toBe(200);
    const g2 = await (await request.get(`/api/v1/plan-versions/${s.version}/geometry?draft=true`)).json();
    expect((await request.put(`/api/v1/plan-versions/${s.version}/geometry`, { data: { doc: { ...g2.doc, walls: [...g2.doc.walls, WALL('bw3', [[0.3, 0.6], [0.7, 0.6]])] }, base_revision: g2.geometry.revision } })).status()).toBe(200);
    const item = await request.post('/api/v1/catalog/objects', { data: { based_on: 'chair.basic', names: { he: `כיסא גיבוי ${stamp}`, en: 'Backup chair' } } });
    expect(item.status()).toBe(201);
    s.item = (await item.json()).id;
    s.zone = (await (await request.post(`/api/v1/floors/${s.floor}/zones`, { data: { name: 'חדר גיבוי', polygon: [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.7 }] } })).json()).id;
    expect((await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: 'light.r9_backup_lamp', state: 'off', attributes: { friendly_name: 'מנורת גיבוי' } }] } })).status()).toBe(200);
    s.anchor = (await (await request.post(`/api/v1/floors/${s.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: 'light.r9_backup_lamp', x: 0.3, y: 0.3, rotation_degrees: 0, field_of_view_degrees: null } })).json()).id;
    expect(s.zone && s.anchor).toBeTruthy();
    // after the anchor (a draft version holding an anchor cannot be deleted): a draft plan version (another crop of the drawing) that carries the published structure into a draft of its own
    const dv = await (await request.post(`/api/v1/floors/${s.floor}/plan-versions`, { data: { asset_id: asset.id, crop: { x: 0, y: 0, w: 0.9, h: 1 } } })).json();
    expect(dv.geometry_carry).toBe('transformed');
    s.draftVersion = dv.id;
    return s;
  }
  /** What the round trip must bring back: both documents of the published version (hash and revision), the draft
   * version's document, the map's anchors and zones, the custom item. */
  async function studioState(request: APIRequestContext, s: Seed) {
    const pub = await (await request.get(`/api/v1/plan-versions/${s.version}/geometry`)).json();
    const dr = await (await request.get(`/api/v1/plan-versions/${s.version}/geometry?draft=true`)).json();
    const dv = await request.get(`/api/v1/plan-versions/${s.draftVersion}/geometry?draft=true`);
    const dvBody = dv.status() === 200 ? await dv.json() : null;
    const map = await request.get(`/api/v1/floors/${s.floor}/map`);
    const mapBody = map.status() === 200 ? await map.json() : null;
    const items = (await (await request.get('/api/v1/catalog/export')).json()).items as { id: string }[];
    return { published: pub.geometry?.doc_hash ?? null, draft: dr.geometry?.doc_hash ?? null, revision: dr.geometry?.revision ?? null,
      walls: ((pub.doc?.walls ?? []) as { id: string }[]).map((w) => w.id), draftWalls: ((dr.doc?.walls ?? []) as { id: string }[]).map((w) => w.id),
      objects: ((pub.doc?.objects ?? []) as { id: string }[]).map((o) => o.id),
      draftVersion: dvBody ? { hash: dvBody.geometry.doc_hash as string, revision: dvBody.geometry.revision as number, walls: (dvBody.doc.walls as unknown[]).length } : null,
      plan: mapBody?.plan?.id ?? null, anchors: ((mapBody?.anchors ?? []) as { id: string }[]).map((a) => a.id), zones: ((mapBody?.zones ?? []) as { id: string }[]).map((z) => z.id),
      item: items.find((i) => i.id === s.item) ?? null };
  }
  async function removeSeed(request: APIRequestContext, s: Partial<Seed>, backup: string) {
    if (backup) await request.delete(`/api/v1/backups/${backup}`);
    if (s.floor) await request.delete(`/api/v1/floors/${s.floor}?force=true`);
    if (s.item) await request.delete(`/api/v1/catalog/objects/${s.item}`);
    if (s.building) await request.delete(`/api/v1/buildings/${s.building}`);
    if (s.site) await request.delete(`/api/v1/sites/${s.site}`);
  }

  test('merge restore (safe on the developer backend): a deleted draft version with its structure and a deleted custom item come back with the same hashes; nothing else moves', async ({ request }) => {
    test.setTimeout(180_000);
    let s: Partial<Seed> = {};
    let backup = '';
    try {
      s = await seedStudioFloor(request);
      const seed = s as Seed;
      const before = await studioState(request, seed);
      expect(before.published).not.toBe(before.draft);
      expect(before).toMatchObject({ walls: ['bw1', 'bw2'], draftWalls: ['bw1', 'bw2', 'bw3'], objects: ['bo1'], plan: seed.version, anchors: [seed.anchor], zones: [seed.zone] });
      expect(before.draftVersion?.walls).toBeGreaterThan(0);
      expect(before.item).toBeTruthy();
      const made = await request.post('/api/v1/backups', { data: { note: 'round 9 item 15 (merge)' } });
      expect(made.status()).toBe(201);
      backup = (await made.json()).name;
      // the change: the draft plan version (a hard delete, its structure rows with it) and the custom item are gone
      expect((await request.delete(`/api/v1/plan-versions/${seed.draftVersion}`)).status()).toBe(204);
      expect((await request.delete(`/api/v1/catalog/objects/${seed.item}`)).status()).toBe(204);
      expect((await studioState(request, seed)).draftVersion).toBeNull();
      const restored = await request.post(`/api/v1/backups/${backup}/restore`, { data: { mode: 'merge', scope: 'project', confirm: 'RESTORE' } });
      expect(restored.status()).toBe(200);
      expect(await studioState(request, seed)).toEqual(before);
    } finally {
      await removeSeed(request, s, backup);
    }
  });

  test('replace restore (throwaway instance only): a deleted floor comes back whole - structure, draft, draft version, objects, zone, anchor, custom item - and the live map draws it', async ({ page, request }) => {
    test.skip(!process.env.SW_THROWAWAY_DB, 'a replace restore rewrites every project table: run it only against a throwaway instance (SW_THROWAWAY_DB)');
    test.setTimeout(180_000);
    expect((await (await request.get('/api/v1/health')).json()).nvr_configured, 'never against the developer backend').toBe(false);
    let s: Partial<Seed> = {};
    let backup = '';
    try {
      s = await seedStudioFloor(request);
      const seed = s as Seed;
      const before = await studioState(request, seed);
      const made = await request.post('/api/v1/backups', { data: { note: 'round 9 item 15 (replace)' } });
      expect(made.status()).toBe(201);
      backup = (await made.json()).name;
      expect((await made.json()).tables.plan_geometry).toBeGreaterThanOrEqual(3);
      // the change: the floor (anchors tombstoned, versions archived) and the custom item are gone
      expect((await request.delete(`/api/v1/floors/${seed.floor}?force=true`)).status()).toBe(204);
      expect((await request.delete(`/api/v1/catalog/objects/${seed.item}`)).status()).toBe(204);
      expect((await request.get(`/api/v1/floors/${seed.floor}/map`)).status()).toBe(404);
      const restored = await request.post(`/api/v1/backups/${backup}/restore`, { data: { mode: 'replace', scope: 'project', confirm: 'RESTORE' } });
      expect(restored.status()).toBe(200);
      expect(await studioState(request, seed)).toEqual(before);
      expect((await request.get(`/api/v1/plan-versions/${seed.version}/image.png`)).status()).toBe(200);
      await open(page, `/explore/floors/${seed.floor}`);
      await expect(page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-wall]')).toHaveCount(3, { timeout: 20000 }); // bw1 is cut by its door
      await expect(page.locator('explore-floor-map sw-plan-canvas [data-object="bo1"]')).toHaveCount(1);
    } finally {
      await removeSeed(request, s, backup);
    }
  });
});
