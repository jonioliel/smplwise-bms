import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the stylized-rendering choices (owner: "give options") and the remembered layer state:
// the editor's form (strength / room fill / thin lines) produces a preview of the owner's real plan with one
// tint per room and the furniture lines kept; the viewer remembers which layers were switched off for the
// floor across a reload. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-editor-live');

test.describe('stylize options and layer memory (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('tint per room with lines; layers remembered', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();

    // 1) editor: choose "גוון לכל חדר" + thin lines and render the preview
    await open(page, `/explore/floors/${floor.id}/edit`);
    const editor = page.locator('explore-plan-editor');
    const opts = editor.locator('[data-stylize-opts]');
    await expect(opts).toBeVisible();
    await opts.locator('select[aria-label="מילוי חדרים"]').selectOption('tint');
    await editor.locator('label.chk input[type=checkbox]').last().check();
    await editor.getByRole('button', { name: 'עבד תצוגה מקדימה' }).click();
    await expect(editor.locator('[data-stylize-caption]')).toContainText('גוון לכל חדר', { timeout: 60000 });
    await expect(editor.locator('[data-stylize-caption]')).toContainText('עם קווים דקים');
    await expect(editor.locator('.compare img').nth(1)).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `stylize-options-${testInfo.project.name}.png`), fullPage: true });

    // 2) viewer: switch cameras off, reload, still off; then restore
    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    const canvas = viewer.locator('sw-plan-canvas');
    const before = await canvas.locator('g.marker').count();
    await viewer.locator('.layers button[aria-label="מצלמות"]').click();
    const off = await canvas.locator('g.marker').count();
    expect(off).toBeLessThan(before);
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
    await expect(page.locator('explore-floor-map sw-plan-canvas g.marker')).toHaveCount(off);
    await expect(page.locator('explore-floor-map .layers button[aria-label="מצלמות"]')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('explore-floor-map .layers button[aria-label="מצלמות"]').click();
    await expect(page.locator('explore-floor-map sw-plan-canvas g.marker')).toHaveCount(before);
  });
});
