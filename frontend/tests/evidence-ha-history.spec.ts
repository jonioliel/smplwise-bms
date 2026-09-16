import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for HA history on the historical map (T041) against the running developer backend and the lab HA: the
// map at "now" reports entity states known from the local history (recorded since the backend connected), the map at
// an instant before the history began reports unknown with the reason, and the panel shows both. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T041-ha-history-live');

interface Ent { resource_type: string; resource_id: string; entity: { state: string | null; state_at?: { known: boolean; reason: string | null; state: string | null } } | null }

test.describe('HA history on the map (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('known now from the local history, unknown before it began', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
    let floorId = '';
    let nowMap: { anchors: Ent[]; ha_history: { from: string | null; rows: number } } | null = null;
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    for (const f of floors) {
      const m = await (await request.get(`/api/v1/floors/${f.id}/map?at=${encodeURIComponent(nowIso)}`)).json();
      if (m.anchors.some((a: Ent) => a.resource_type === 'ha_entity')) {
        floorId = f.id;
        nowMap = m;
        break;
      }
    }
    expect(floorId, 'a floor with a placed HA entity').toBeTruthy();
    const ents = nowMap!.anchors.filter((a) => a.resource_type === 'ha_entity');
    expect(nowMap!.ha_history.rows).toBeGreaterThan(0);
    for (const e of ents) {
      expect(e.entity?.state).toBeNull();
      expect(e.entity?.state_at).toBeTruthy();
    }
    const known = ents.filter((e) => e.entity?.state_at?.known);
    expect(known.length, 'at least one entity known now (recorded since the backend connected to HA)').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'history', description: `${known.length}/${ents.length} known now; history from ${nowMap!.ha_history.from}, ${nowMap!.ha_history.rows} rows` });
    const early = new Date(new Date(nowMap!.ha_history.from!).getTime() - 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const earlyMap = await (await request.get(`/api/v1/floors/${floorId}/map?at=${encodeURIComponent(early)}`)).json();
    for (const e of earlyMap.anchors.filter((a: Ent) => a.resource_type === 'ha_entity') as Ent[]) {
      expect(e.entity?.state_at?.known).toBe(false);
      expect(e.entity?.state_at?.reason).toContain('לפני תחילת');
    }
    // the panel
    await page.goto(`/?design=a#/investigate/floors/${floorId}?t=${encodeURIComponent(nowIso)}`);
    await page.waitForSelector('sw-app');
    const panel = page.locator('investigate-history-map [data-history-entities]');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel).toContainText(`${known.length} מתוך ${ents.length} ידועות`);
    await expect(panel.locator('[data-history-entity][data-known="true"]')).toHaveCount(Math.min(known.length, 8));
    await page.screenshot({ path: path.join(OUT, `history-entities-${testInfo.project.name}.png`), fullPage: true });
    await page.goto(`/?design=a#/investigate/floors/${floorId}?t=${encodeURIComponent(early)}`);
    await page.waitForTimeout(1500);
    await expect(panel).toContainText('0 מתוך', { timeout: 20000 });
    await expect(panel).toContainText('לפני תחילת');
    await page.screenshot({ path: path.join(OUT, `history-entities-before-${testInfo.project.name}.png`), fullPage: true });
  });
});
