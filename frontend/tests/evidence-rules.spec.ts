import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for alarm rules with a dry run (T052) against the running developer backend: a rule built in the dialog
// (types, scope = a floor with placed cameras, cooldown) is dry-run over the day's real events and explains every
// decision without writing anything; it is saved, toggled, listed with its author, and deleted. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T052-rules-live');

test.describe('alarm rules (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('dry run over real events, save, toggle, alerts tab, delete', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
    let floorId = '';
    for (const f of floors) {
      const m = await (await request.get(`/api/v1/floors/${f.id}/map`)).json();
      if (m.anchors.some((a: { resource_type: string }) => a.resource_type === 'camera')) {
        floorId = f.id;
        break;
      }
    }
    expect(floorId, 'a floor with a placed camera').toBeTruthy();
    const alertsBefore = (await (await request.get('/api/v1/rules/alerts')).json()).unacked as number;
    const name = `ראיות T052 ${new Date().toISOString().slice(11, 19)}`;

    await page.goto('/?design=a#/investigate/rules');
    await page.waitForSelector('sw-app');
    const screen = page.locator('investigate-rules');
    await expect(screen.locator('[data-rule-new]')).toBeVisible({ timeout: 20000 });
    await screen.locator('[data-rule-new]').click();
    const dlg = screen.locator('[data-rule-dialog]');
    await expect(dlg.locator('[data-rule-name]')).toBeVisible({ timeout: 10000 });
    await dlg.locator('[data-rule-name]').fill(name);
    await dlg.locator('[data-rule-type="motion"]').click();
    await dlg.locator(`[data-rule-floor="${floorId}"]`).click();
    await dlg.locator('[data-rule-cooldown]').fill('0');
    await dlg.locator('[data-rule-message]').fill('תנועה בקומה (ראיות)');
    await dlg.locator('[data-rule-dryrun]').click();
    const result = dlg.locator('[data-dryrun-result]');
    await expect(result).toBeVisible({ timeout: 60000 });
    const text = await result.innerText();
    const evaluated = Number(/(\d+) אירועים נבדקו/.exec(text)?.[1] ?? '0');
    expect(evaluated).toBeGreaterThan(0);
    const would = Number(/(\d+)\s*התראות היו נוצרות/.exec(text.replace(/\s+/g, ' '))?.[1] ?? '0');
    testInfo.annotations.push({ type: 'dry-run', description: text });
    if (would > 0) await expect(dlg.locator('[data-dryrun-row][data-fire="true"]').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `rule-dryrun-${testInfo.project.name}.png`) });
    expect((await (await request.get('/api/v1/rules/alerts')).json()).unacked, 'the dry run wrote no alerts').toBe(alertsBefore);

    // save, then the list shows the rule with its author; toggle it off through the API-backed switch
    await dlg.locator('[data-rule-save]').click();
    const row = screen.locator('[data-rule-row]').filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row).toContainText('שונה על ידי');
    const rules = (await (await request.get('/api/v1/rules')).json()).rules as { id: string; name: string; enabled: boolean; revision: number }[];
    const mine = rules.find((r) => r.name === name)!;
    expect(mine.enabled).toBe(true);
    await row.locator('[data-rule-toggle]').click();
    await expect.poll(async () => ((await (await request.get('/api/v1/rules')).json()).rules as { id: string; enabled: boolean }[]).find((r) => r.id === mine.id)?.enabled, { timeout: 15000 }).toBe(false);
    await page.screenshot({ path: path.join(OUT, `rules-list-${testInfo.project.name}.png`) });
    // the alerts tab renders (real alerts appear only when new events match an enabled rule)
    await screen.locator('sw-tabs').getByText('התראות').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `alerts-tab-${testInfo.project.name}.png`) });
    // stale revision refused; cleanup
    const stale = await request.patch(`/api/v1/rules/${mine.id}`, { data: { name, revision: 1, trigger: { types: ['motion'], sources: [], severity_min: 'info' }, scope: { site_ids: [], building_ids: [], floor_ids: [floorId], zone_ids: [], camera_ids: [], entity_ids: [] }, window: { days: [], from: null, to: null }, cooldown_s: 0, actions: [{ kind: 'notify', message: 'x' }], enabled: true, owner: 'local', ha_automation_id: null, description: '' } });
    expect(stale.status()).toBe(409);
    expect((await request.delete(`/api/v1/rules/${mine.id}`)).status()).toBe(204);
  });
});
