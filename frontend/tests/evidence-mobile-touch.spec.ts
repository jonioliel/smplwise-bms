import { test, expect, type Page } from '@playwright/test';

// Mobile audit 2026-09-30: touch targets. Measured at 390 and 360 px, sw-button was 26-36 px high, page-level sw-tabs 29-37 px and
// sw-field inputs / selects 30-33 px. Under (max-width: 767px) and (pointer: coarse) they are now sw-button 40 (sm 36, lg 44),
// tabs 44 and fields 40. Demo data, no backend; runs in the "mobile" project (Pixel 7: touch, 390 px). npm run build first.
test.skip(({ hasTouch }) => !hasTouch, 'the phone project (touch)');

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

const h = async (loc: import('@playwright/test').Locator) => Math.round((await loc.boundingBox())!.height);

test('page tab strips are 44 px, buttons 40 px, and a shared field 40 px on a phone', async ({ page }) => {
  await open(page, '/explore/sites');
  for (const b of await page.locator('explore-sites sw-tabs button').all()) expect(await h(b), 'tab').toBeGreaterThanOrEqual(44);
  await open(page, '/explore/buildings/bld-a/floors');
  const open1 = page.locator('explore-floors [data-floor-actions] sw-button').last();
  expect(await open1.evaluate((el) => el.shadowRoot!.querySelector('button')!.getBoundingClientRect().height), 'sw-button').toBeGreaterThanOrEqual(40);
  await open(page, '/live/wall');
  const q = page.locator('live-wall [data-wall-quality]');
  expect(await h(q), 'select in a field').toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

// UIPOLISH-2320 (owner 1B, 31.10): the switch draws 42 x 24; on a phone its hit box is >= 44 px tall (a block-axis-only ::before), and
// never wider than the track (a wider one was horizontal overflow at 320 px - layout-devices-break-297).
test('the switch (sw-toggle) has a >= 44 px tall touch target on a phone, no wider than its track', async ({ page }) => {
  await open(page, '/explore/sites');
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 });
    const r = await page.evaluate(async () => {
      const host = document.createElement('sw-toggle') as HTMLElement & { label: string; updateComplete: Promise<unknown> };
      host.label = 'בדיקה';
      host.style.cssText = 'position:fixed;inset-block-start:400px;inset-inline-start:120px;z-index:99999';
      document.body.appendChild(host);
      await host.updateComplete;
      const b = host.shadowRoot!.querySelector('button')!;
      const box = b.getBoundingClientRect();
      const before = getComputedStyle(b, '::before');
      const cx = box.left + box.width / 2;
      // a real hit test 9 px above and below the drawn track: the press lands on the switch
      const hit = (y: number) => host.shadowRoot!.elementFromPoint(cx, y) === b;
      const out = {
        track: [Math.round(box.width), Math.round(box.height)],
        hitH: parseFloat(before.height),
        hitW: parseFloat(before.width),
        above: hit(box.top - 9),
        below: hit(box.bottom + 9),
        overflowX: document.documentElement.scrollWidth - innerWidth,
      };
      host.remove();
      return out;
    });
    expect(r.track, `${w}: the drawn switch is unchanged`).toEqual([42, 24]);
    expect(r.hitH, `${w}: hit box height`).toBeGreaterThanOrEqual(44);
    expect(r.hitW, `${w}: hit box width = the track`).toBeLessThanOrEqual(42);
    expect(r.above && r.below, `${w}: a press 9 px above / below the track hits the switch`).toBe(true);
    expect(r.overflowX, `${w}: no sideways scroll`).toBeLessThanOrEqual(0);
  }
});
