import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Home screen "ראשי" (חשמל והתקנים), home redesign (owner decisions 2026-09-30), against the DEMO data (no backend: run the
// preview with SW_API_PORT pointing at a port nothing listens on): the control centre (direction a) is the default with the
// widgets of the demo home (clock, weather, Shabbat, alarm - the quick actions need the bulk permission, which the demo has
// not), no "ערוך פריסה" button, a clean address for a viewer who cannot edit, the floors tree beside the "אריחים" view, the
// whole screen fitting the viewport, and the widgets as a snap row on a phone.
// The edit mode itself, the three directions, the personal override and the settings block are in evidence-home-screen.spec.ts
// (the fixture backend). SW_SHOTS=<dir> also saves screenshots there.
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
  test('the control centre is the default: a wide band of widgets above the summary tiles; no "ערוך פריסה" button; a viewer who cannot edit gets no edit mode from ?edit=1 and a clean address', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the desktop band');
    await open(page, '/devices/building?edit=1');
    const b = page.locator('devices-building');
    await expect(b.locator('[data-layout-edit]')).toHaveCount(0);
    await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
    await expect(b.locator('[data-home-edit]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building'); // the parameter is dropped
    await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
    await expect(b.locator('.page-body')).toHaveAttribute('data-home-direction', 'a');
    await expect(b.locator('.page-body')).toHaveAttribute('data-home-layout', 'hero');
    await expect(b.locator('home-widgets')).toHaveAttribute('layout', 'hero');
    for (const w of ['clock', 'weather', 'shabbat', 'alarm']) await expect(b.locator(`home-widgets [data-home-widget="${w}"]`)).toBeVisible();
    await expect(b.locator('home-widgets [data-home-widget="quick"]')).toHaveCount(0); // needs devices.control_bulk
    // the band sits above the summary tiles, and the alarm is a card, not also a tile
    const band = (await b.locator('home-widgets').boundingBox())!;
    const tiles = (await b.locator('.kpis').boundingBox())!;
    expect(band.y + band.height).toBeLessThanOrEqual(tiles.y + 1);
    await expect(b.locator('sw-kpi[data-kpi="אזעקה"]')).toHaveCount(0);
    // no edit chrome on the plain screen
    await expect(b.locator('home-widgets [data-home-edit-bar]')).toHaveCount(0);
  });

  test('the demo widgets read like the mockup: the Hebrew date, the weather with its forecast, Shabbat with both times', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the desktop band');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, '/devices/building');
    const w = page.locator('devices-building home-widgets');
    await expect(w.locator('[data-home-time]')).toHaveText(/^\d\d:\d\d$/);
    await expect(w.locator('[data-home-hebrew-date]')).toHaveText('ג׳ בחשוון התשפ״ז'); // from the (demo) sensor
    await expect(w.locator('[data-home-temp]')).toHaveText('28°C');
    await expect(w.locator('[data-home-forecast] .fc')).toHaveCount(5);
    await expect(w.locator('[data-home-parsha]')).toHaveText('פרשת נח');
    await expect(w.locator('[data-home-field="candles"] b')).toHaveText(/^\u200E?\d\d:\d\d$/);
    await expect(w.locator('[data-home-field="havdalah"] b')).toHaveText(/^\u200E?\d\d:\d\d$/);
    await expect(w.locator('[data-home-alarm-state]')).toHaveText('דרוכה (חוץ)');
    await shot(page, 'home-demo-1920');
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

  test('tablet: the widgets wrap as a band above the tiles and nothing overflows sideways', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet', 'the tablet width');
    await open(page, '/devices/building');
    await expect(page.locator('devices-building home-widgets')).toHaveAttribute('layout', 'hero');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('phone: the widgets are one card under the other (the phone default), the tiles view scrolls, has no tree and no horizontal overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await open(page, '/devices/building');
    await expect(page.locator('devices-building nav.tree')).toBeHidden();
    await expect(page.locator('devices-building a.tile[data-area="lobby"]')).toBeVisible();
    const hw = page.locator('devices-building home-widgets');
    await expect(hw).toHaveAttribute('layout', 'stack');
    const boxes = await hw.locator('.wg').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })));
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].h - 2); // one under the other
    for (const b of boxes) expect(b.w).toBeGreaterThanOrEqual(340); // full width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'home-tiles-390');
  });});
