import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshMock, mockSt7Backend, openSt7, settle, waitEditor } from './st7-ui-mocks';

// CR-029 ST7 UI: before / after evidence of the Plan Studio 6 editor UI (materials, north, saved walk positions) and the plan.view
// settings card, over the mocked backend (tests/st7-ui-mocks.ts) - no live server. ST7_PREFIX=before runs on the base build and
// skips the controls that do not exist there yet; the default `after` asserts them. Screenshots: docs/design/evidence/st7-ui/.
//   npm run build && npx playwright test tests/evidence-st7-ui.spec.ts --project=desktop --project=mobile --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'st7-ui');
const PREFIX = process.env.ST7_PREFIX || 'after';
const AFTER = PREFIX === 'after';
const ED = 'explore-plan-editor';

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}-${PREFIX}-${test.info().project.name}.png`) });
}

/** Page pixels of a normalized plan point (the canvas converts plan to host pixels itself). */
async function at(page: Page, p: [number, number]): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  return { x: box.x + s.x, y: box.y + s.y };
}

/** The plan editor is desktop-only (shell/phone.ts STRUCTURE_DESKTOP_ONLY): its shots come from the desktop and tablet projects. */
const editorOnly = () => test.skip(test.info().project.name === 'mobile', 'the plan editor is desktop-only');

test.describe('ST7 UI evidence', () => {
  test('editor: the wall inspector with its material field', async ({ page }) => {
    editorOnly();
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await openSt7(page, `/explore/floors/f-st7/edit`);
    await waitEditor(page);
    const q = await at(page, [0.15, 0.5]);
    await page.mouse.click(q.x, q.y);
    await expect(page.locator(`${ED} [data-selected-wall="w-w"]`)).toHaveCount(1, { timeout: 10_000 });
    if (AFTER) {
      const field = page.locator(`${ED} [data-material-field="walls:w-w"]`);
      await expect(field).toHaveCount(1);
      await field.locator('[data-material-pick="plaster_exterior"]').click();
      await expect(field.locator('[data-material-pick="plaster_exterior"]')).toHaveAttribute('aria-pressed', 'true');
    }
    await shot(page, 'editor-wall');
    if (AFTER) {
      await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
      const saved = mock.puts.at(-1)!;
      expect((saved.walls as { id: string; material_id?: string }[]).find((w) => w.id === 'w-w')?.material_id).toBe('plaster_exterior');
      expect(saved.schema_version).toBe('2.2');
      // reset to the default removes the field again
      await page.locator(`${ED} [data-material-field="walls:w-w"] [data-material-reset]`).click();
      await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(1);
      expect((mock.puts.at(-1)!.walls as { id: string; material_id?: string }[]).find((w) => w.id === 'w-w')?.material_id).toBeUndefined();
    }
  });

  test('editor: the object inspector with its material field', async ({ page }) => {
    editorOnly();
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await openSt7(page, `/explore/floors/f-st7/edit`);
    await waitEditor(page);
    const q = await at(page, [0.3, 0.45]);
    await page.mouse.click(q.x, q.y);
    await expect(page.locator(`${ED} [data-selected-object="ob-sofa"]`)).toHaveCount(1, { timeout: 10_000 });
    if (AFTER) {
      const field = page.locator(`${ED} [data-material-field="objects:ob-sofa"]`);
      await expect(field).toHaveCount(1);
      await field.locator('[data-material-pick="leather"]').click();
    }
    await shot(page, 'editor-object');
    if (AFTER) {
      await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
      expect((mock.puts.at(-1)!.objects as { id: string; material_id?: string }[]).find((o) => o.id === 'ob-sofa')?.material_id).toBe('leather');
    }
  });

  test('editor: the room floor material (the zone inspector)', async ({ page }) => {
    editorOnly();
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await openSt7(page, `/explore/floors/f-st7/edit`);
    await waitEditor(page);
    await page.locator(`${ED} [data-tool="zones"]`).click();
    await page.locator(`${ED} [data-zone-row]`).first().click();
    await expect(page.locator(`${ED} [data-zone-inspector]`)).toHaveCount(1, { timeout: 10_000 });
    if (AFTER) {
      const field = page.locator(`${ED} [data-material-field="rooms:z-living"]`);
      await expect(field).toHaveCount(1);
      await field.locator('[data-material-pick="oak"]').click();
    }
    await shot(page, 'editor-room');
    if (AFTER) {
      await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
      const rooms = mock.puts.at(-1)!.rooms as { id: string; level_id?: string | null; floor_material_id?: string }[];
      expect(rooms.find((r) => r.id === 'z-living')?.floor_material_id).toBe('oak');
    }
  });

  test('editor: the north compass on the calibration card', async ({ page }) => {
    editorOnly();
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await openSt7(page, `/explore/floors/f-st7/edit`);
    await waitEditor(page);
    await page.locator(`${ED} [data-tool="calibrate"]`).click();
    await expect(page.locator(`${ED} [data-calib-panel]`)).toHaveCount(1, { timeout: 10_000 });
    if (AFTER) {
      const north = page.locator(`${ED} [data-north-card]`);
      await expect(north).toHaveCount(1);
      await north.locator('[data-north-deg]').fill('135');
      await north.locator('[data-north-deg]').press('Enter');
      await expect(north.locator('[data-north-deg]')).toHaveValue('135');
    }
    await shot(page, 'editor-north');
    if (AFTER) {
      await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
      expect(mock.puts.at(-1)!.north_deg).toBe(135);
      // the keyboard turns the dial: ArrowRight = +1 degree
      await page.locator(`${ED} [data-north-dial]`).focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator(`${ED} [data-north-deg]`)).toHaveValue('136');
    }
  });

  test('editor: the saved walk positions', async ({ page }) => {
    editorOnly();
    test.skip(!AFTER, 'the walk positions tool does not exist on the base build');
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await openSt7(page, `/explore/floors/f-st7/edit`);
    await waitEditor(page);
    await page.locator(`${ED} [data-tool="walk"]`).click();
    const card = page.locator(`${ED} [data-walk-card]`);
    await expect(card).toHaveCount(1, { timeout: 10_000 });
    await card.locator('[data-walk-add]').click(); // armed: the next click on the plan places it
    const q = await at(page, [0.32, 0.6]);
    await page.mouse.click(q.x, q.y);
    await expect(card.locator('[data-walk-row]')).toHaveCount(1);
    await card.locator('[data-walk-add]').click();
    const q2 = await at(page, [0.7, 0.4]);
    await page.mouse.click(q2.x, q2.y);
    await expect(card.locator('[data-walk-row]')).toHaveCount(2);
    await card.locator('[data-walk-row]').nth(1).locator('[data-walk-name]').fill('פינת האוכל');
    await card.locator('[data-walk-row]').nth(1).locator('[data-walk-name]').press('Enter');
    await card.locator('[data-walk-row]').nth(1).locator('[data-walk-up]').click();
    await expect(card.locator('[data-walk-row]').nth(0).locator('[data-walk-name]')).toHaveValue('פינת האוכל');
    await shot(page, 'editor-walk');
    await expect.poll(() => mock.puts.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const positions = mock.puts.at(-1)!.walk_positions as { name: string; x: number; y: number; level_id: string }[];
    expect(positions.map((p) => p.name)).toEqual(['פינת האוכל', 'עמדה 1']);
    expect(positions[0].x).toBeCloseTo(0.7, 1);
    expect(positions[0].level_id).toBe('L0');
    await card.locator('[data-walk-row]').nth(1).locator('[data-walk-delete]').click();
    await expect(card.locator('[data-walk-row]')).toHaveCount(1);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`settings: the realistic 3D card (${scheme})`, async ({ page }) => {
      const mock = freshMock();
      await mockSt7Backend(page, mock);
      await openSt7(page, `/system/diagnostics?tab=map`, `&scheme=${scheme}`);
      await page.locator('system-diagnostics [data-settings-map]').waitFor({ timeout: 20_000 });
      if (AFTER) {
        const card = page.locator('system-diagnostics system-plan-view [data-plan-view-card]');
        await expect(card).toHaveCount(1);
        await card.scrollIntoViewIfNeeded();
        // my own choice saves at once; the installation default saves with the button
        await card.locator('[data-view-option="style:dark"]').click();
        await expect.poll(() => mock.prefPuts.length, { timeout: 10_000 }).toBe(1);
        expect(mock.prefPuts[0]).toEqual({ style: 'dark' });
        await card.locator('[data-view-target="installation"]').click();
        await card.locator('[data-view-option="furniture:procedural"]').click();
        await card.locator('[data-site-lat]').fill('32.08');
        await card.locator('[data-site-lon]').fill('34.78');
        await card.locator('[data-view-save]').click();
        await expect.poll(() => mock.patches.length, { timeout: 10_000 }).toBe(1);
        expect(mock.patches[0]).toEqual({ 'plan.view': { furniture: 'procedural' }, 'site.latitude': '32.08', 'site.longitude': '34.78' });
      }
      await shot(page, `settings-${scheme}`);
    });
  }
});
