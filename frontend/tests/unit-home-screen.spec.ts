import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Home screen "ראשי" (חשמל והתקנים), owner notes 2026-09-30, against the DEMO data (no backend: run the preview with
// SW_API_PORT pointing at a port nothing listens on): no "ערוך פריסה" button, no widgets by default, a clean address for
// a viewer who cannot edit, the floors tree beside the "אריחים" view, and the whole screen fitting the viewport.
// The edit mode itself (title, widgets, floor order, saving) is in evidence-home-screen.spec.ts (the fixture backend).
// SW_SHOTS=<dir> also saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(page: Page, hash: string, layout: 'cards' | 'tiles' = 'tiles') {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('sw.devices.layout', l);
      localStorage.removeItem('sw.tiles.override');
    } catch {
      /* storage unavailable */
    }
  }, layout);
  await page.goto('about:blank'); // a second goto that only changes the hash is not a navigation
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('devices-building sw-kpi');
  await page.waitForTimeout(800);
}

/** Every element that scrolls vertically and has something to scroll (through shadow roots). */
async function scrolls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) out.push(`${el.tagName.toLowerCase()} ${el.scrollHeight}/${el.clientHeight}`);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  });
}

test.describe('home screen (demo data)', () => {
  test('no "ערוך פריסה" button and no widgets by default; a viewer who cannot edit gets no edit mode from ?edit=1 and a clean address', async ({ page }) => {
    await open(page, '/devices/building?edit=1');
    const b = page.locator('devices-building');
    await expect(b.locator('[data-layout-edit]')).toHaveCount(0);
    await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
    await expect(b.locator('[data-home-edit]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building'); // the parameter is dropped
    // the default title; the widgets take no room (the host is collapsed)
    await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
    await expect(b.locator('home-widgets')).toBeHidden();
  });

  test('"אריחים" shows the floors tree too, and the whole screen fits the viewport without a vertical scroll (1440x900 and 1920x1080)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
    for (const [w, h] of [[1440, 900], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await open(page, '/devices/building');
      const b = page.locator('devices-building');
      await expect(b.locator('.split[data-layout-view="tiles"] nav.tree')).toBeVisible();
      await expect(b.locator('a.tile[data-area="lobby"]')).toBeVisible();
      expect(await scrolls(page), `${w}x${h}`).toEqual([]);
      await shot(page, `home-tiles-${w}`);
    }
  });

  test('cards view: also fits the viewport at 1440x900 and 1920x1080', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
    for (const [w, h] of [[1440, 900], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await open(page, '/devices/building', 'cards');
      await expect(page.locator('devices-building .split[data-layout-view="cards"] nav.tree')).toBeVisible();
      expect(await scrolls(page), `${w}x${h}`).toEqual([]);
    }
  });

  test('phone: the tiles view scrolls, has no tree and no horizontal overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await open(page, '/devices/building');
    await expect(page.locator('devices-building nav.tree')).toBeHidden();
    await expect(page.locator('devices-building a.tile[data-area="lobby"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'home-tiles-390');
  });
});
