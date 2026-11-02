import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';

// Mobile audit 2026-09-30: touch targets. Measured at 390 and 360 px, sw-button was 26-36 px high, page-level sw-tabs 29-37 px and
// sw-field inputs / selects 30-33 px. Under (max-width: 767px) and (pointer: coarse) they are now sw-button 44 (sm 44, lg 44: PHONE-BUTTONS-44-2342, drawn - was 40 / 36),
// tabs 44 and fields 40. Demo data, no backend; runs in the "mobile" project (Pixel 7: touch, 390 px). npm run build first.
test.skip(({ hasTouch }) => !hasTouch, 'the phone project (touch)');

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

const h = async (loc: import('@playwright/test').Locator) => Math.round((await loc.boundingBox())!.height);

test('page tab strips are 44 px, buttons 44 px, and a shared field 40 px on a phone', async ({ page }) => {
  await open(page, '/explore/sites');
  for (const b of await page.locator('explore-sites sw-tabs button').all()) expect(await h(b), 'tab').toBeGreaterThanOrEqual(44);
  await open(page, '/explore/buildings/bld-a/floors');
  const open1 = page.locator('explore-floors [data-floor-actions] sw-button').last();
  expect(await open1.evaluate((el) => el.shadowRoot!.querySelector('button')!.getBoundingClientRect().height), 'sw-button').toBeGreaterThanOrEqual(44);
  await open(page, '/live/wall');
  const q = page.locator('live-wall [data-wall-quality]');
  expect(await h(q), 'select in a field').toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

// PHONE-BUTTONS-44-2342 (owner 02.11, answer 2A): the shared button is DRAWN 44 px high on a phone in every size, in every skin (the phone
// layer repeats the rule after the skin sheet: crystal draws 34 / 30 px at rest), with an icon-only button 44 x 44 and no invisible slop.
test('sw-button is drawn 44 px high on a phone (sm, default, icon-only), in every skin', async ({ page }) => {
  for (const skin of SKINS_UNDER_TEST) {
    await page.goto('about:blank');
    await page.goto(`/?design=a&skin=${skin}#/explore/sites`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const mk = (attrs: Record<string, string>) => {
        const b = document.createElement('sw-button') as HTMLElement & { updateComplete: Promise<unknown> };
        for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
        b.textContent = attrs.icononly !== undefined ? '' : 'בדיקה';
        b.style.cssText = 'position:fixed;inset-block-start:300px;inset-inline-start:40px;z-index:99999';
        document.body.appendChild(b);
        return b;
      };
      const out: Record<string, { w: number; h: number; after: string }> = {};
      for (const [name, attrs] of [['md', {}], ['sm', { size: 'sm' }], ['icon', { icononly: '', icon: 'search', label: 'x' }], ['icon-sm', { icononly: '', icon: 'search', label: 'x', size: 'sm' }]] as const) {
        const b = mk(attrs as Record<string, string>);
        await b.updateComplete;
        const inner = b.shadowRoot!.querySelector('button')!;
        const rect = inner.getBoundingClientRect();
        out[name] = { w: Math.round(rect.width), h: Math.round(rect.height), after: getComputedStyle(inner, '::after').content };
        b.remove();
      }
      return out;
    });
    for (const [name, m] of Object.entries(r)) {
      expect(m.h, `${skin} ${name} height`).toBeGreaterThanOrEqual(44);
      expect(m.after, `${skin} ${name}: no invisible slop`).toBe('none');
      if (name.startsWith('icon')) expect(m.w, `${skin} ${name} width`).toBeGreaterThanOrEqual(44);
    }
  }
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
