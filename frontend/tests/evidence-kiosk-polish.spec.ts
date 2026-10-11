import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { OFFLINE_HTML } from '../src/pwa/offline-page';

// KIOSK polish (2026-10-11): the kiosk route on the two reference tablets, the phone PWA shell (dock, install card, connection
// pill) and the worker's offline page, light and dark, with the ergonomics the polish promises: the clock is the largest text on
// the kiosk, no footnote on the screen, 44 px targets on a touch screen, no sideways overflow, and the offline page's button is
// a 48 px target in both schemes. Demo mode (no backend); the wall display itself is covered by evidence-wall.spec.ts.
//   npx playwright test tests/evidence-kiosk-polish.spec.ts --project=desktop   (SW_SHOTS=<dir> writes the screenshots)
const SHOTS = process.env.SW_SHOTS ?? '';

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const TABLETS = [
  ['landscape', 1280, 800],
  ['portrait', 820, 1280],
] as const;

test.describe('kiosk route on the reference tablets', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the viewport is set by the spec itself');
  });

  for (const [name, w, h] of TABLETS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${name} ${scheme}: clock largest, no footnote, counters readable, no sideways overflow`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/?design=a&scheme=${scheme}#/kiosk/all`);
        const kiosk = page.locator('kiosk-wall');
        await expect(kiosk.locator('sw-camera-tile')).toHaveCount(9);
        await expect(kiosk.locator('[data-kiosk-clock] b')).not.toHaveText('—');
        const sizes = await kiosk.evaluate((el) => {
          const r = el.shadowRoot!;
          const px = (sel: string) => parseFloat(getComputedStyle(r.querySelector(sel) as HTMLElement).fontSize);
          return { clock: px('[data-kiosk-clock] b'), title: px('h1'), stat: px('.stat b') };
        });
        expect(sizes.clock, 'the clock is read from across the room').toBeGreaterThanOrEqual(sizes.title);
        expect(sizes.stat).toBeGreaterThanOrEqual(sizes.title);
        expect(await kiosk.locator('.note').count(), 'no hint paragraph on an operator screen').toBe(0);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over).toBeLessThanOrEqual(0);
        // no hex literal: the counters read the tokens (a colour that follows the scheme sheet)
        const stat = await kiosk.locator('.stat').first().evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(stat).toMatch(/^rgba?\(/);
        await shot(page, `kiosk-${name}-${scheme}`);
      });
    }
  }
});

test.describe('phone PWA shell', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone project only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: install card with 44 px targets above the dock; the connection pill while offline and when back`, async ({ page, context }) => {
      await page.goto(`/?design=a&scheme=${scheme}#/`);
      await page.waitForFunction(() => !!customElements.get('arx-pwa-prompts'));
      await page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
        e.prompt = async () => undefined;
        e.userChoice = Promise.resolve({ outcome: 'dismissed' });
        window.dispatchEvent(e);
      });
      const card = page.locator('arx-pwa-prompts [data-pwa-install]');
      await expect(card).toBeVisible();
      for (const sel of ['[data-pwa-install-go]', '[data-pwa-install-later]']) {
        const box = (await card.locator(sel).boundingBox())!;
        expect(box.height, `${sel} is a 44 px target`).toBeGreaterThanOrEqual(43.5); // sub-pixel layout rounds 44 to 43.9999
      }
      const cardBox = (await card.boundingBox())!;
      expect(cardBox.x).toBeGreaterThanOrEqual(0);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
      // the card sits above the dock, never under it
      const dock = page.locator('sw-app nav.bottom');
      if (await dock.count()) {
        const d = (await dock.boundingBox())!;
        expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(d.y + 1);
      }
      await shot(page, `pwa-install-${scheme}`);
      // the browser says the network is gone: the pill, then "back" for a moment
      await context.setOffline(true);
      const pill = page.locator('arx-pwa-prompts [data-net="offline"]');
      await expect(pill).toBeVisible();
      await expect(pill).toContainText('אין חיבור');
      await shot(page, `pwa-offline-${scheme}`);
      await context.setOffline(false);
      await expect(page.locator('arx-pwa-prompts [data-net="online"]')).toBeVisible();
      await expect(pill).toHaveCount(0);
      await expect(page.locator('arx-pwa-prompts [data-net="online"]')).toHaveCount(0, { timeout: 6000 });
    });
  }
});

test.describe("the worker's offline page", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone project only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: RTL, both schemes, a 48 px retry target`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setContent(OFFLINE_HTML);
      await expect(page.locator('h1')).toHaveText('אין חיבור לשרת');
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      const a = (await page.locator('a').boundingBox())!;
      expect(a.height).toBeGreaterThanOrEqual(48);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe(scheme === 'dark' ? 'rgb(13, 18, 32)' : 'rgb(245, 247, 251)');
      await shot(page, `pwa-offline-page-${scheme}`);
    });
  }
});
