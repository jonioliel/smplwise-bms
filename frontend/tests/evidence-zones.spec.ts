import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend (M13 rooms & zones, design SW A): the editor detects
// rooms on the owner's real plan, the editor names and saves them, draws one more zone with the mouse,
// and the viewer shows the named zones under the pins. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-zones-live');

test.describe('rooms & zones (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('detect, name, save, draw; viewer shows names', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();

    await open(page, `/explore/floors/${floor.id}/edit`);
    const editor = page.locator('explore-plan-editor');
    const canvas = editor.locator('sw-plan-canvas');
    await expect(canvas).toBeVisible();

    // 1) rooms tool → detect → candidates appear as dashed polygons and as rows with name inputs
    await editor.getByRole('button', { name: 'חדרים ואזורים' }).click();
    await editor.getByRole('button', { name: 'זהה חדרים' }).click();
    await expect(editor.locator('[data-candidate]').first()).toBeVisible({ timeout: 60000 });
    const nCand = await editor.locator('[data-candidate]').count();
    expect(nCand).toBeGreaterThanOrEqual(1);
    await expect(canvas.locator('g.zone.candidate')).toHaveCount(nCand);
    await page.screenshot({ path: path.join(OUT, `zones-candidates-${testInfo.project.name}.png`) });

    // 2) name the first candidate and save
    const first = editor.locator('[data-candidate] input.name').first();
    await first.fill('לובי ראשי');
    await editor.getByRole('button', { name: /שמור \d+ חדרים/ }).click();
    await expect(editor.locator('[data-zone-row]').first()).toBeVisible({ timeout: 15000 });
    await expect(canvas.locator('g.zone.candidate')).toHaveCount(0);
    await expect(canvas.locator('g.zone text.zl', { hasText: 'לובי ראשי' })).toHaveCount(1);
    const savedRows = await editor.locator('[data-zone-row]').count();
    expect(savedRows).toBeGreaterThanOrEqual(nCand);
    await page.screenshot({ path: path.join(OUT, `zones-saved-${testInfo.project.name}.png`) });

    // 3) draw a zone with four clicks in an empty corner of the plan and close it with Enter
    await editor.getByRole('button', { name: 'צייר אזור' }).click();
    const box = (await canvas.boundingBox())!;
    const pt = await canvas.evaluate((el) => (el as unknown as { toScreen: (x: number, y: number) => { x: number; y: number } }).toScreen(0.04, 0.04));
    const x0 = box.x + pt.x;
    const y0 = box.y + pt.y;
    for (const [dx, dy] of [[0, 0], [70, 0], [70, 50], [0, 50]]) {
      await page.mouse.click(x0 + dx, y0 + dy);
      await page.waitForTimeout(120);
    }
    await expect(canvas.locator('g.draft circle')).toHaveCount(4);
    await page.keyboard.press('Enter');
    await expect(editor.locator('[data-zone-row]')).toHaveCount(savedRows + 1, { timeout: 15000 });
    await expect(editor.locator('[data-zone-inspector]')).toBeVisible();
    // rename through the inspector (change event on blur)
    const nameInput = editor.locator('[data-zone-inspector] input').first();
    await nameInput.fill('פינת בדיקה');
    await nameInput.press('Tab');
    await expect(canvas.locator('g.zone text.zl', { hasText: 'פינת בדיקה' })).toHaveCount(1, { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, `zones-drawn-${testInfo.project.name}.png`) });

    // 4) the viewer shows the named zones under the pins (and the legend counts them)
    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    await expect(viewer.locator('sw-plan-canvas g.zone').first()).toBeVisible({ timeout: 15000 });
    await expect(viewer.locator('sw-plan-canvas g.zone text.zl', { hasText: 'לובי ראשי' })).toHaveCount(1);
    await expect(viewer.locator('.legend', { hasText: 'אזורים' })).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `zones-viewer-${testInfo.project.name}.png`) });

    // 5) the zones layer toggle hides them
    await viewer.getByRole('button', { name: 'חדרים ואזורים' }).click();
    await expect(viewer.locator('sw-plan-canvas g.zone')).toHaveCount(0);

    // API cross-check: the zones are persisted with the names typed in the editor
    const zones = await (await request.get(`/api/v1/floors/${floor.id}/zones`)).json();
    expect(zones.zones.map((z: { name: string }) => z.name)).toEqual(expect.arrayContaining(['לובי ראשי', 'פינת בדיקה']));
  });
});
