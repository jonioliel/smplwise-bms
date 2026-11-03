import { test, expect, type Locator, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { BANNER, GATE_CALL, LOBBY_CALL, installCallsMock, openApp } from './incoming-call-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-INBOUND-CALLS-2382 pixel baselines: the incoming-call banner (ringing, the door question, two calls, quiet hours) and the station
// drawer's recent calls, against the mocked backend (tests/incoming-call-mocks.ts: fixed clock, drawn stills, performance:full). The
// ELEMENT is compared, not the page behind it. Desktop 1440 and phone 390 (the bottom sheet).
// "pixel-stable" in every title: the release gate runs its pixel group with --grep pixel-stable.
// Baselines are per OS: the Linux ones are generated on the runner; on an OS without a baseline the check is skipped, not failed:
//   run_smart.py linux-pixel <branch> tests/pixel-incoming-call.spec.ts --project=desktop --project=mobile --update-snapshots

const wide = (info: TestInfo) => (info.project.name === 'mobile' ? '390' : '1440');
const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(el: Locator, info: TestInfo, name: string) {
  await settlePage(el.page());
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(el).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('incoming call banner pixels', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('classic is pixel-stable: the ringing banner and the door question', async ({ page }, info) => {
    await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    const b = page.locator(BANNER);
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b.locator('[data-call-picture="still"] img')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await compare(b, info, 'call-ringing');
    await b.locator('[data-call-door="1"]').click();
    await expect(b.locator('[data-call-door-ask="1"]')).toBeVisible();
    await compare(b, info, 'call-door-ask');
  });

  test('classic is pixel-stable: two calls, two named doors, quiet hours', async ({ page }, info) => {
    await installCallsMock(page, { active: { enabled: true, mode: 'everyone', sound: 'silent', sound_reason: 'quiet_hours', calls: [{ ...GATE_CALL }, { ...LOBBY_CALL }] } });
    await openApp(page, '#/explore/floors/f0');
    const b = page.locator(BANNER);
    await expect(b).toHaveAttribute('data-station', 'lobby', { timeout: 30_000 });
    await expect(b.locator('[data-call-picture="still"] img')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await compare(b, info, 'call-two-quiet');
  });

  test('dark is pixel-stable: the ringing banner', async ({ page }, info) => {
    await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0', { scheme: 'dark' });
    const b = page.locator(BANNER);
    await expect(b).toBeVisible({ timeout: 30_000 });
    await expect(b.locator('[data-call-picture="still"] img')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await compare(b, info, 'call-ringing-dark');
  });

  test('classic is pixel-stable: the recent calls in the station drawer', async ({ page }, info) => {
    await installCallsMock(page, { active: { enabled: false, mode: 'off', sound: 'ring', sound_reason: null, calls: [] } });
    await openApp(page, '#/wiskey/devices?station=gate');
    const log = page.locator('sw-app wiskey-stations wk-call-history [data-call-log="ready"]');
    await expect(log).toBeVisible({ timeout: 30_000 });
    await log.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await compare(log, info, 'call-log');
  });
});
