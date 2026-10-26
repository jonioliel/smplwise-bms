import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { band, install, newMock, open, stills, live } from './wall-plan-mocks';
import { skinsUnderTest } from './helpers/frozen-skins';

// Plan Studio 6, slice S5-B pixel baselines (docs/changes/CR-029-ST7-S5B-NOTES.md): the NEW states only - the plan in the map band of a portrait
// wall display (the baked stills in the five skins on a dark wall, two on a light wall; the live schematic view on SwiftShader) and the
// settings drawer's map section - against the mocked backend (deterministic data, fixed clock, performance:full). The band and the section are
// compared as elements: the camera tiles, the clock and the rest of the wall are not part of what this slice drew. Baselines are per OS (fonts
// and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is
// skipped instead of failing on a missing file (the design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-wall-plan.spec.ts --project=desktop [--update-snapshots]
const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
const NOW = new Date('2026-10-04T09:00:00Z'); // noon in Israel: the day still of every style

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function check(target: Locator, info: Parameters<typeof noBaseline>[0] & { annotations: { type: string; description?: string }[] }, name: string) {
  if (noBaseline(info, name)) info.annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
  else await expect(target).toHaveScreenshot(name, { maxDiffPixels: 40, animations: 'disabled' });
}

/** The still is in the band with its lit room drawn through the mask (the picture is complete), and nothing moves. */
async function stillReady(page: Page) {
  await expect(stills(page).locator('svg[data-stills]')).toBeVisible({ timeout: 30_000 });
  await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1, { timeout: 30_000 });
  await settlePage(page);
}

test.describe('pixel: the plan in the map band of a portrait wall', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  for (const skin of SKINS) {
    for (const theme of skin === 'classic' || skin === 'bubble' ? (['dark', 'light'] as const) : (['dark'] as const)) {
      // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
      test(`${skin} is pixel-stable: the baked stills in the map band, ${theme} wall`, async ({ page }, info) => {
        await page.clock.setFixedTime(NOW);
        await open(page, newMock({ skin, scheme: theme === 'dark' ? 'light' : 'dark', theme, plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }), undefined, '?design=a&look=performance:full');
        await stillReady(page);
        await check(band(page), info, `wall-plan-band-${skin}-${theme}.png`);
      });
    }
  }

  test('classic is pixel-stable: the live schematic view in the map band, dark wall', async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.clock.setFixedTime(NOW);
    await open(page, newMock({ scheme: 'light', theme: 'dark', plan: { mode: 'live', quality: 'schematic', idle_s: 0 } }), undefined, '?design=a&look=performance:full');
    const el = live(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    // the on-demand loop is quiet: the frame counter stopped (the idle-still spec asserts the same of a paused view)
    let last = -1;
    for (let i = 0; i < 40; i++) {
      const f = Number((await el.getAttribute('data-frames')) ?? 0);
      if (f > 0 && f === last) break;
      last = f;
      await page.waitForTimeout(900);
    }
    await settlePage(page);
    await check(band(page), info, 'wall-plan-band-live-classic-dark.png');
  });
});

test.describe('pixel: the settings drawer\'s map section', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the drawer');
  });

  for (const skin of skinsUnderTest(['classic', 'bubble', 'crystal'] as const)) {
    test(`${skin} is pixel-stable: the map section of the wall drawer`, async ({ page }, info) => {
      await page.clock.setFixedTime(NOW);
      const st = newMock({ admin: true, skin, scheme: 'light', plan: { mode: 'stills', quality: 'schematic', idle_s: 120 } });
      await install(page, st);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/system/wall`);
      await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
      const section = page.locator('sw-drawer[data-wall-drawer] [data-wall-section="map"]');
      await expect(section.locator('select[data-wall-field="plan-idle"]')).toHaveValue('120');
      await section.scrollIntoViewIfNeeded();
      await settlePage(page);
      await check(section, info, `wall-settings-map-${skin}.png`);
    });
  }
});
