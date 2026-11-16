import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';
import { NOW } from './access-control-mocks';
import { installDiagMock } from './wiskey-access-diag-mocks';

// AUDIT30-H2 (design audit round 30, follow-up of branch H, owner/lead answers Q1 = ב, Q2 = ב):
//   #16 no native <select> left in any WisKey screen (screens/wiskey-*.ts): every choice list is the shared <sw-dropdown>
//   #7  no local class="kpi" tiles: the access diagnostics' summaries are the shared compact <sw-kpi> (60 px)
//   #12 the entry center's "דורש תשומת לב" count badge is a filled amber field with a solid edge, like "מצלצל"
// The last case is a pixel baseline of the entry center's attention card ("pixel-stable" for the entry check).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-audit30h2-wiskey.spec.ts --project=desktop

const SCREENS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens');
const wiskeySources = () => fs.readdirSync(SCREENS).filter((f) => /^wiskey-.*\.ts$/.test(f));
/** The source without comments, so a comment that names "<select>" does not count. */
const code = (f: string) => fs.readFileSync(path.join(SCREENS, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

async function openOverview(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00Z'));
  await page.goto('about:blank');
  await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/overview');
  await page.waitForSelector('sw-app');
  await page.locator('sw-app wiskey-overview [data-wiskey-attention]').waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

test.describe('AUDIT30-H2: WisKey screens, shared controls only', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo / mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project');
  });

  test('no native <select> and no local class="kpi" in any WisKey screen source', () => {
    const files = wiskeySources();
    expect(files.length).toBeGreaterThan(20);
    const selects = files.filter((f) => /<select[\s>]/.test(code(f)));
    const kpis = files.filter((f) => /class="kpi"/.test(code(f)));
    expect(selects, 'screens with a native <select>').toEqual([]);
    expect(kpis, 'screens with a local class="kpi" tile').toEqual([]);
  });

  test('entry center: the attention count badge is filled with a solid edge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);
    const badge = page.locator('sw-app wiskey-overview [data-wiskey-attention] sw-badge[data-wiskey-attention-count]');
    await expect(badge).toHaveAttribute('filled', '');
    expect(await badge.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
  });

  test('access diagnostics: compact <sw-kpi> summaries and <sw-dropdown> choices, no native control', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installDiagMock(page, {});
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/wiskey/access-diag?view=quality');
    const screen = page.locator('sw-app wiskey-access-diag');
    await expect(screen.locator('[data-diag-quality-row]')).toHaveCount(3, { timeout: 30_000 });
    const tiles = screen.locator('[data-diag-quality-kpis] sw-kpi');
    await expect(tiles).toHaveCount(4);
    for (const tile of await tiles.all()) {
      await expect(tile).toHaveAttribute('layout', 'compact');
      expect((await tile.boundingBox())!.height).toBeLessThanOrEqual(64);
    }
    await screen.locator('[data-diag-tab="audit"]').click();
    await expect(screen.locator('sw-dropdown[data-diag-audit-station]')).toBeVisible();
    const native = await screen.evaluate((el) => (el.shadowRoot ?? el).querySelectorAll('select, .kpi').length);
    expect(native).toBe(0);
  });

  test('entry center attention card, classic light 1440, is pixel-stable', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openOverview(page);
    await settlePage(page);
    const file = 'attention-classic-light-1440.png';
    const update = ['all', 'changed'].includes(info.config.updateSnapshots);
    if (!update && !fs.existsSync(info.snapshotPath(file))) {
      test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      return;
    }
    await expect(page.locator('sw-app wiskey-overview [data-wiskey-attention]')).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  });
});
