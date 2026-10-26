import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';

// WXSCH: the layout guard (tests/layout-guard.ts) over the stations drawer's quiet links - the entry log and the schedules of the station,
// both offered at once (the widest the row gets) - in every skin the build has x light / dark x widths 320-1440, against the MOCKED backend.
// FAILS on escape / overflow / clipped (the two links wrap inside the drawer, never leave it), and when a link is under the hit area
// (44 px in touch layouts, the look dial on a desktop) or the page scrolls sideways.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-wxsch.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = QUICK ? SKIN_IDS.filter((s) => s === 'classic' || s === 'bubble') : SKIN_IDS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg';
const SCREEN = 'wiskey-stations';
const LINKS = `${SCREEN} sw-drawer[data-wk-drawer] .evlink wk-action-button`;

async function settle(page: Page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(120);
}

test.describe('WXSCH layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.describe.configure({ timeout: 30 * 60_000 });

  test('the drawer with both quiet links: skins x themes x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installStationsMock(page, newMock({ settings: { 'access.ui.schedules': 'smplwise', 'access.ui.events': 'smplwise' } }));
    const results: Finding[] = [];
    const small: string[] = [];
    const outside: string[] = [];
    let runs = 0;
    for (const skin of SKINS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openStations(page, { skin, scheme: theme });
        await page.waitForSelector(`${SCREEN} [data-wk-station]`, { timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await settle(page);
          const ctx = `${skin} ${theme} ${w}`;
          await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`).first().click();
          await page.waitForSelector(`${LINKS}[data-wk-station-schedules="lobby"]`);
          await settle(page);
          runs++;
          const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, within: SCREEN, roots: [SCREEN] });
          results.push(...found.filter((f) => f.cls === 'escape' || f.cls === 'overflow' || f.cls === 'clipped'));
          const boxes = await page.locator(LINKS).evaluateAll((els) => {
            const drawer = document.querySelector('sw-app')?.shadowRoot?.querySelector('wiskey-stations')?.shadowRoot?.querySelector('sw-drawer[data-wk-drawer]');
            const panel = drawer?.shadowRoot?.querySelector('.panel') as HTMLElement | null; // the dialog (modal) or the aside (inline)
            const edge = panel?.getBoundingClientRect();
            const min = innerWidth <= 1100 ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
            return els.map((el) => {
              const r = el.getBoundingClientRect();
              return { name: el.getAttribute('data-wk-station-schedules') !== null ? 'schedules' : 'events', w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), edgeLeft: edge ? Math.round(edge.left) : 0, edgeRight: edge ? Math.round(edge.right) : innerWidth, min };
            });
          });
          expect(boxes.map((b) => b.name).sort(), `${ctx}: both links are drawn`).toEqual(['events', 'schedules']);
          expect(boxes.every((b) => b.edgeRight - b.edgeLeft > 100), `${ctx}: the drawer's panel was found`).toBe(true);
          for (const b of boxes) {
            if (b.h < b.min - 0.5 || b.w < b.min - 0.5) small.push(`${ctx}: ${b.name} ${b.w}x${b.h} < ${b.min}`);
            if (b.left < b.edgeLeft - 1 || b.right > b.edgeRight + 1) outside.push(`${ctx}: ${b.name} ${b.left}..${b.right} outside the drawer ${b.edgeLeft}..${b.edgeRight}`);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${ctx}: the page scrolls sideways`).toBeLessThanOrEqual(1);
          await page.keyboard.press('Escape');
          await settle(page);
        }
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-wxsch: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), links under the hit area ${small.length}, outside the drawer ${outside.length}, page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
    expect([...new Set(small)], 'links below the hit area').toEqual([]);
    expect([...new Set(outside)], 'links outside the drawer').toEqual([]);
  });
});
