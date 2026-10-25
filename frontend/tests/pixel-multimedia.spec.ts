import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { OPERATOR, fresh, install } from './media-players-harness';

// AVPIXEL-295 (board r172): pixel baselines of the audio / video screens - "מולטימדיה": the screens page (the TVs and displays), the players and
// speakers page and the groups page - light and dark, on the three standard viewports (the Playwright projects: desktop 1440, tablet 1024,
// mobile 390), against the mocked backend of tests/media-players-harness.ts (the S0 client's MOCK stores, the house with a music library:
// deterministic data) with a fixed clock and performance:full. The whole viewport is compared; nothing here depends on the real media stack.
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped (annotated) instead of failing on a missing file (the design-foundation rule).
//   ~/run_remote.sh spec <branch> tests/pixel-multimedia.spec.ts --project=desktop --project=tablet --project=mobile [--update-snapshots]
const NOW = new Date('2026-10-04T09:00:00Z'); // noon in Israel
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORT: Record<string, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 },
};
const PAGES = [
  { id: 'screens', hash: '/multimedia/screens', ready: 'sw-app multimedia-screens [data-mm-state="ready"]' },
  { id: 'players', hash: '/multimedia/players', ready: 'sw-app multimedia-players [data-mm-state="ready"] media-player-card' },
  { id: 'groups', hash: '/multimedia/groups', ready: 'sw-app multimedia-groups [data-group-card]' },
] as const;

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, info: TestInfo, hash: string, scheme: string, ready: string) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('sw.nav.order');
    } catch {
      /* storage unavailable */
    }
  });
  await install(page, fresh(OPERATOR));
  await page.setViewportSize(VIEWPORT[info.project.name] ?? VIEWPORT.desktop);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

test.describe('pixel: multimedia (audio / video) screens', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const pg of PAGES) {
    for (const scheme of SCHEMES) {
      // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
      test(`${pg.id} is pixel-stable: the multimedia ${pg.id} page, ${scheme}`, async ({ page }, info) => {
        await open(page, info, pg.hash, scheme, pg.ready);
        const file = `multimedia-${pg.id}-${scheme}-${(VIEWPORT[info.project.name] ?? VIEWPORT.desktop).width}.png`;
        if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
      });
    }
  }
});
