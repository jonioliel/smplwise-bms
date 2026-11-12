import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// AUDIT30-A-GLASS-BRIDGE pixel baselines (design audit round 30, finding 13): the service-calls board in dark, classic skin, demo
// fixtures - the glass panels are the product's navy and the ink is the product's (they were neutral black-grey with an ink of their
// own). The other glass screens in dark (schedules, multimedia, notification settings) are pinned by tests/visual-matrix.spec.ts.
// Titles carry "pixel-stable" (the gate's pixel lane). Baselines are per OS: the Linux ones are generated on the runner with
// --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   run_smart.py preview <branch> tests/pixel-audit30a-glass-bridge.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, hash: string, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript((sch) => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify({ user: 'installer', scheme: sch }));
    } catch {
      /* private window */
    }
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  // the demo board's "today" strip and its "updated N h ago" lines are relative to now: a fixed clock keeps the picture still
  await page.clock.setFixedTime(new Date('2026-11-12T10:30:00+02:00'));
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=classic&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector('tickets-board[data-devices-style="glass"]', { timeout: 30_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

test.describe('pixel: AUDIT30-A-GLASS-BRIDGE', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  test('tickets board dark is pixel-stable: navy glass panels and the product ink', async ({ page }, info) => {
    const file = `tickets-board-dark.png`; // Playwright adds -<project>-<platform>
    if (noBaseline(info, file)) {
      info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      test.skip(true, `${file}: no baseline on ${process.platform}`);
    }
    await open(page, '/tickets/board', 'dark');
    await page.mouse.move(0, 0);
    await settlePage(page, { timeout: 8_000 }).catch(() => undefined);
    await expect(page).toHaveScreenshot(file, { maxDiffPixelRatio: 0.004, animations: 'disabled' });
  });
});
