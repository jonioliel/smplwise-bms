import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for plan version history (T038) against the running developer backend: the editor lists every
// version, publishing goes through a preview (geometry + fate of every placed item), an archived version is
// restored as a new published copy with the anchors kept, and the historical map shows the version that was
// in force at the instant. Runs only with SW_LIVE=1. The floor ends with the same picture and anchors it started
// with (one archived same-geometry version and one restored copy are added to the history).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T038-plan-versions-live');

interface Ver { id: string; status: string; asset_id: string; page: number; rotation: number; crop: unknown; notes: string; published_at: string | null; revision: number }
interface Map { plan: Ver | null; anchors: { id: string; resource_id: string; position: { x: number; y: number } }[]; needs_alignment: boolean }

test.describe('plan version history (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('history list, publish preview, rollback keeps anchors, historical map version', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
    let floorId = '';
    let map0: Map | null = null;
    for (const f of floors) {
      const m = (await (await request.get(`/api/v1/floors/${f.id}/map`)).json()) as Map;
      if (m.plan && m.plan.status === 'published' && m.anchors.length) {
        floorId = f.id;
        map0 = m;
        break;
      }
    }
    expect(floorId, 'a floor with a published plan and placed items').toBeTruthy();
    const v0 = map0!.plan!;
    const mapOf = async () => (await (await request.get(`/api/v1/floors/${floorId}/map`)).json()) as Map;

    // a draft with the same geometry as the published version (same asset, page, rotation, crop)
    const draft = (await (await request.post(`/api/v1/floors/${floorId}/plan-versions`, { data: { asset_id: v0.asset_id, page: v0.page, rotation: v0.rotation, crop: v0.crop, notes: 'evidence T038' } })).json()) as Ver;
    expect(draft.status).toBe('draft');

    // editor: the history lists the draft and the published version
    await open(page, `/explore/floors/${floorId}/edit`);
    const ed = page.locator('explore-plan-editor');
    await expect(ed.locator('[data-version-list]')).toBeVisible({ timeout: 20000 });
    const draftRow = ed.locator(`[data-version-row][data-version-id="${draft.id}"]`);
    await expect(draftRow).toHaveAttribute('data-version-status', 'draft');
    await expect(ed.locator(`[data-version-row][data-version-id="${v0.id}"]`)).toHaveAttribute('data-version-status', 'published');

    // publish preview: identical geometry, every item carried
    await draftRow.locator('[data-version-compare]').click();
    const dlg = ed.locator('[data-diff-dialog]');
    await expect(dlg.locator('[data-diff-summary]')).toContainText('גאומטריה זהה', { timeout: 15000 });
    await expect(dlg.locator('[data-diff-summary]')).toContainText(`${map0!.anchors.length} פריטים מוצבים · ${map0!.anchors.length} עוברים כמו שהם · 0 ידרשו יישור`);
    await page.screenshot({ path: path.join(OUT, `publish-preview-${testInfo.project.name}.png`) });
    await dlg.locator('[data-diff-confirm]').click();
    await expect.poll(async () => (await mapOf()).plan?.id, { timeout: 20000 }).toBe(draft.id);
    const m1 = await mapOf();
    expect(m1.needs_alignment).toBe(false);
    expect(m1.anchors.length).toBe(map0!.anchors.length);

    // the original is archived and offers a restore
    const archivedRow = ed.locator(`[data-version-row][data-version-id="${v0.id}"]`);
    await expect(archivedRow).toHaveAttribute('data-version-status', 'archived', { timeout: 15000 });
    await expect(ed.locator(`[data-version-row][data-version-id="${draft.id}"]`)).toHaveAttribute('data-version-status', 'published');
    await page.screenshot({ path: path.join(OUT, `history-list-${testInfo.project.name}.png`), fullPage: true });
    await archivedRow.locator('[data-version-rollback]').click();
    await expect(dlg.locator('[data-diff-summary]')).toContainText('גאומטריה זהה', { timeout: 15000 });
    await expect(dlg).toContainText('שחזור גרסה מהארכיון');
    await page.screenshot({ path: path.join(OUT, `rollback-preview-${testInfo.project.name}.png`) });
    await dlg.locator('[data-diff-confirm]').click();
    await expect.poll(async () => {
      const m = await mapOf();
      return m.plan && m.plan.id !== draft.id && m.plan.id !== v0.id ? 'restored' : m.plan?.id;
    }, { timeout: 20000 }).toBe('restored');
    const m2 = await mapOf();
    expect(m2.needs_alignment).toBe(false);
    expect(m2.plan!.rotation).toBe(v0.rotation);
    expect(m2.plan!.notes).toContain('שחזור');
    expect(m2.anchors.length).toBe(map0!.anchors.length);
    for (const a of map0!.anchors) {
      const b = m2.anchors.find((x) => x.resource_id === a.resource_id);
      expect(b?.position, `anchor ${a.resource_id} kept its position`).toEqual(a.position);
    }
    const vs = (await (await request.get(`/api/v1/floors/${floorId}/plan-versions`)).json()).versions as Ver[];
    expect(vs.filter((v) => v.status === 'published').length).toBe(1);
    expect(vs.find((v) => v.id === v0.id)?.status).toBe('archived');
    expect(vs.find((v) => v.id === draft.id)?.status).toBe('archived');
    // archived history is kept: it cannot be deleted; a stale revision is a clear conflict
    expect((await request.delete(`/api/v1/plan-versions/${v0.id}`)).status()).toBe(409);
    const stale = await request.post(`/api/v1/plan-versions/${v0.id}/rollback`, { data: { revision: 1 } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).code).toBe('stale_revision');
    await expect(ed.locator(`[data-version-row][data-version-id="${m2.plan!.id}"]`)).toHaveAttribute('data-version-status', 'published', { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, `after-rollback-${testInfo.project.name}.png`), fullPage: true });

    // historical map: at this instant the restored version is in force; before the floor's history began, the current map
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await open(page, `/investigate/floors/${floorId}?t=${encodeURIComponent(nowIso)}`);
    const note = page.locator('investigate-history-map [data-history-plan-version]');
    await expect(note).toHaveAttribute('data-history-mode', 'exact', { timeout: 20000 });
    await expect(note).toContainText('בתוקף באותו זמן');
    await page.screenshot({ path: path.join(OUT, `history-map-exact-${testInfo.project.name}.png`) });
    const first = vs.map((v) => v.published_at).filter((x): x is string => !!x).sort()[0];
    const early = new Date(new Date(first).getTime() - 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    await open(page, `/investigate/floors/${floorId}?t=${encodeURIComponent(early)}`);
    await expect(note).toHaveAttribute('data-history-mode', 'current', { timeout: 20000 });
    await expect(note).toContainText('היסטוריית המפה מתחילה');
    const earlyMap = (await (await request.get(`/api/v1/floors/${floorId}/map?at=${encodeURIComponent(early)}`)).json()) as Map & { history: string };
    expect(earlyMap.history).toBe('current');
    expect(earlyMap.anchors.length).toBe(map0!.anchors.length);
  });
});
