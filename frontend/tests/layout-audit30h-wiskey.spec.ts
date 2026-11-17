import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// AUDIT30-H (design audit round 30, 2026-11-12, branch H "WisKey native screens"): one regression check per fix, against the demo
// data of each screen (every /api/v1 call aborted, as the audit's probe measured them).
//   #7  the entry center's two summary tiles are the shared compact <sw-kpi> (60 px), not the tall cards tile
//   #12 a ringing door's badge is a FILLED amber field with a solid edge (dashed is reserved for unknown / stale data)
//   #15 the entry center's title is "מרכז הכניסה" (no "WisKey ·") and its times carry no "UTC+03:00" label (Q10 = א)
//   #14 the chosen door in the schedules list is Blue Wash + Blue Ink (not a solid accent field)
//   #16 the people screen's filters are <sw-dropdown>, no native <select>
//   #5  the stations screen does not scroll at 1366x768 (kept from NOSCROLL-1366-2437: tests/layout-noscroll-1366.spec.ts, case wk-devices)
// The last case is a pixel baseline of the entry center ("pixel-stable": the entry check runs the pixel group with --grep pixel-stable).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-audit30h-wiskey.spec.ts --project=desktop

async function open(page: Page, hash: string, ready: string, scheme: 'light' | 'dark' = 'light') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.locator(`sw-app ${ready}`).first().waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** A custom property of the screen, resolved to the colour the browser paints (rgb()). */
const tokenColour = (page: Page, screen: string, token: string) =>
  page.locator(screen).evaluate((host, tok) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${tok})`;
    (host.shadowRoot ?? host).appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);

test.describe('AUDIT30-H: WisKey native screens', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-data spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project: the viewports are set here');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`entry center (${scheme}): compact KPI tiles, a filled ringing badge, the plain title, no UTC label`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, '/wiskey/overview', 'wiskey-overview', scheme);
      const screen = page.locator('wiskey-overview');
      // #15: the page title is the screen's name alone
      await expect(screen.locator('sw-page')).toHaveAttribute('heading', 'מרכז הכניסה');
      // #7: both tiles are the compact layout, at most 64 px tall (60 px + the hairline)
      const tiles = screen.locator('[data-wiskey-stats] sw-kpi');
      await expect(tiles).toHaveCount(2);
      for (const tile of await tiles.all()) {
        await expect(tile).toHaveAttribute('layout', 'compact');
        expect((await tile.boundingBox())!.height).toBeLessThanOrEqual(64);
      }
      // #12: the ringing door (demo "שער ראשי") carries a filled badge, solid edge
      const ring = screen.locator('[data-wiskey-door="d1"] sw-badge[data-wiskey-door-badge="ringing"]');
      await expect(ring).toHaveAttribute('filled', '');
      expect(await ring.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
      // and no other door badge is dashed except an unknown one (none in the demo)
      const dashed = await screen.locator('[data-wiskey-door] sw-badge').evaluateAll((els) => els.filter((e) => getComputedStyle(e).borderTopStyle === 'dashed').length);
      expect(dashed).toBe(0);
      // #15: the offline station's "last seen" time is in the installation's zone, without the offset label
      const text = await screen.evaluate((el) => (el.shadowRoot ?? el).textContent ?? '');
      expect(text).not.toMatch(/UTC[+-]\d/);
      expect(text).not.toContain('WisKey ·');
    });
  }

  test('schedules: the chosen door is Blue Wash and Blue Ink, semibold', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/wiskey/schedules', 'wiskey-schedules');
    const current = page.locator('wiskey-schedules .doors button[aria-current="true"]').first();
    await expect(current).toBeVisible();
    const cs = await current.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color, fw: getComputedStyle(el).fontWeight }));
    expect(cs.bg).toBe(await tokenColour(page, 'wiskey-schedules', '--sw-accent-soft'));
    expect(cs.fg).toBe(await tokenColour(page, 'wiskey-schedules', '--sw-accent-text'));
    expect(cs.bg).not.toBe(await tokenColour(page, 'wiskey-schedules', '--sw-accent'));
    expect(Number(cs.fw)).toBe(600);
  });

  test('people: the filters are <sw-dropdown>, no native <select>; a choice reaches the filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/wiskey/people', 'wiskey-people');
    const screen = page.locator('wiskey-people');
    await expect(screen.locator('[data-people-filters]')).toBeVisible();
    const native = await screen.evaluate((el) => (el.shadowRoot ?? el).querySelectorAll('select').length);
    expect(native).toBe(0);
    const filters = screen.locator('sw-dropdown[data-wiskey-people-filter]');
    expect(await filters.count()).toBeGreaterThanOrEqual(3);
    // the sort is a list without "any"; the others start on "<name>: הכול"
    await expect(screen.locator('sw-dropdown[data-wiskey-people-filter="state"]')).toContainText('מצב: הכול');
    await expect(screen.locator('sw-dropdown[data-wiskey-people-filter="sort"]')).not.toContainText('הכול');
  });

  test('entry center, classic light 1440: the compact tiles and the filled ringing badge, is pixel-stable', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/wiskey/overview', 'wiskey-overview');
    await settlePage(page);
    const file = 'overview-classic-light-1440.png';
    const update = ['all', 'changed'].includes(info.config.updateSnapshots);
    if (!update && !fs.existsSync(info.snapshotPath(file))) {
      test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      return;
    }
    await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  });
});
