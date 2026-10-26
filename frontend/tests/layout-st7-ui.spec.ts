import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { freshMock, mockSt7Backend, openSt7, settle, waitEditor } from './st7-ui-mocks';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// CR-029 ST7 UI: the layout guard (tests/layout-guard.ts) over the new Studio 6 cards, in every registered skin (SKIN_IDS; crystal since 2.4.7)
// x light / dark x widths 320..1440, over the mocked backend (tests/st7-ui-mocks.ts): the realistic-3D settings card (both targets)
// and, from 768 px (the plan editor is desktop-only), the editor's material field (wall, object, room), the north card and the
// walk positions card. FAILS on escape / overflow / floating / clipped / target. Every new control is sized by the desktop touch
// dial (--sw-touch-desktop, 44 px), so no target finding is filtered here, unlike the older settings screens.
//   npm run build && npx playwright test tests/layout-st7-ui.spec.ts --project=desktop --workers=1     (LAYOUT_QUICK=1: 320/768/1440)
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 768, 1440] : [320, 390, 768, 1024, 1280, 1440];
const SKINS = SKIN_IDS; // 2.4.7 integration: the five-skin sweep (pilot/SPECS-five-skins) covers the Studio 6 cards too
const SCHEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const ED = 'explore-plan-editor';
// the shell's own rows and the host screens' chrome are measured by their own specs
const SKIP = '.vh, nav.sections, nav.sectabs, .subnav, .tabpair, sw-tabs, header sw-button, sw-plan-canvas, .rail, .bar, .legend, .levelbar, .floorchip';
const BUBBLE = '.row, .seg, .range, .swatch, .matreset, .walkrow, .northrow, .matf, .site';

function report(name: string, runs: number, results: Finding[], errors: string[]) {
  const { byCls, lines } = summarize(results);
  console.log(`${name}: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
  for (const l of lines) console.log('  ' + l);
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
}

async function at(page: Page, p: [number, number]): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  return { x: box.x + s.x, y: box.y + s.y };
}

async function sweep(page: Page, results: Finding[], widths: number[], ctx: string, within: string): Promise<number> {
  let runs = 0;
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: height(w) });
    await settle(page);
    runs++;
    results.push(...(await page.evaluate(inPageCheck, { ctx: `${ctx} ${w}`, bubble: BUBBLE, skip: SKIP, within })));
  }
  return runs;
}

test.describe('ST7 UI: the layout guard', () => {
  test.describe.configure({ timeout: 20 * 60_000 });
  for (const skin of SKINS) for (const scheme of SCHEMES) test(`${skin} / ${scheme}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep (it resizes the viewport itself)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    const q = `&skin=${skin}&scheme=${scheme}`;

    // the settings card, my own choices and the installation's defaults
    const mock = freshMock();
    await mockSt7Backend(page, mock);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSt7(page, '/system/diagnostics?tab=map', q);
    const card = page.locator('system-diagnostics system-plan-view [data-plan-view-card]');
    await card.waitFor({ timeout: 20_000 });
    runs += await sweep(page, results, WIDTHS, `settings-own ${skin} ${scheme}`, 'system-plan-view');
    await card.locator('[data-view-target="installation"]').click();
    runs += await sweep(page, results, WIDTHS, `settings-installation ${skin} ${scheme}`, 'system-plan-view');

    // the editor's cards (desktop only: the phone shows "במחשב בלבד")
    const wide = WIDTHS.filter((w) => w >= 768);
    const docWithPositions = { walk_positions: [{ id: 'p1', name: 'כניסה ראשית', x: 0.3, y: 0.6, level_id: 'L0', heading_deg: 0, is_default: true }, { id: 'p2', name: 'פינת האוכל ליד החלון הגדול', x: 0.7, y: 0.4, level_id: 'L0', heading_deg: 270 }], north_deg: 35 };
    Object.assign(mock, freshMock({ doc: { ...mock.doc, ...docWithPositions } }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSt7(page, '/explore/floors/f-st7/edit', q);
    await waitEditor(page);
    const wall = await at(page, [0.15, 0.5]);
    await page.mouse.click(wall.x, wall.y);
    await page.locator(`${ED} [data-material-field="walls:w-w"]`).waitFor({ timeout: 10_000 });
    runs += await sweep(page, results, wide, `editor-wall ${skin} ${scheme}`, '[data-material-field]');
    await page.setViewportSize({ width: 1440, height: 900 });
    const sofa = await at(page, [0.3, 0.45]);
    await page.mouse.click(sofa.x, sofa.y);
    await page.locator(`${ED} [data-material-field="objects:ob-sofa"]`).waitFor({ timeout: 10_000 });
    runs += await sweep(page, results, wide, `editor-object ${skin} ${scheme}`, '[data-material-field]');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(`${ED} [data-tool="zones"]`).click();
    await page.locator(`${ED} [data-zone-row]`).first().click();
    await page.locator(`${ED} [data-material-field="rooms:z-living"]`).waitFor({ timeout: 10_000 });
    runs += await sweep(page, results, wide, `editor-room ${skin} ${scheme}`, '[data-material-field]');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(`${ED} [data-tool="calibrate"]`).click();
    await page.locator(`${ED} [data-north-card]`).waitFor({ timeout: 10_000 });
    runs += await sweep(page, results, wide, `editor-north ${skin} ${scheme}`, '[data-north-card]');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(`${ED} [data-tool="walk"]`).click();
    await page.locator(`${ED} [data-walk-row]`).first().waitFor({ timeout: 10_000 });
    await page.locator(`${ED} [data-walk-add]`).click(); // the armed note shows too
    runs += await sweep(page, results, wide, `editor-walk ${skin} ${scheme}`, '[data-walk-card]');
    report(`layout-st7-ui ${skin}/${scheme}`, runs, results, errors);
  });
});
