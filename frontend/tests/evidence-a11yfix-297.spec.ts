import { test, expect, type Locator, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { installTicketsMock, url } from './tickets-mocks';
import { installTemperature, units } from './temperature-mocks';

// A11YFIX-297: the three contrast defects of the design audit (docs/design/system/AUDIT_2026-10-27.md), measured on the REAL build against
// fake data, in every skin that is not frozen, light and dark:
//   1. Settings > Notifications: the label of the selected severity level (dark: near-white label on the near-white thumb, 1.0:1);
//   2. the temperature status badge (white text on the bare status colour, 1.8-3.8:1);
//   3. the "urgent" priority chip of a service-management ticket card (3.3:1).
// The ratio is the WCAG relative-luminance ratio of the element's computed text colour over its computed background, the background composited
// through the translucent ancestors (shadow hosts included) down to the first opaque one; a glass skin's canvas gradient behind the last
// translucent layer is taken as its page background colour. Text must reach 4.5:1 (AA).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-a11yfix-297.spec.ts --project=desktop
// Set A11Y_PRINT=1 to print every measurement.

const AA = 4.5;
const SCHEMES = ['light', 'dark'] as const;

/** the contrast ratio of an element's own text colour against its effective background (see the header) */
async function contrast(loc: Locator): Promise<number> {
  return loc.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top: [number, number, number, number], bottom: [number, number, number]): [number, number, number] => [
      top[0] * top[3] + bottom[0] * (1 - top[3]),
      top[1] * top[3] + bottom[1] * (1 - top[3]),
      top[2] * top[3] + bottom[2] * (1 - top[3]),
    ];
    const layers: [number, number, number, number][] = [];
    let node: Node | null = el;
    while (node) {
      if (node instanceof Element) {
        const bg = rgba(getComputedStyle(node).backgroundColor);
        if (bg[3] > 0) {
          layers.push(bg);
          if (bg[3] >= 0.999) break;
        }
      }
      node = node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode;
    }
    let base: [number, number, number] = [255, 255, 255];
    const body = rgba(getComputedStyle(document.body).backgroundColor);
    if (body[3] > 0) base = over(body, base);
    if (!layers.length || layers[layers.length - 1][3] < 0.999) layers.push([base[0], base[1], base[2], 1]);
    let bgc: [number, number, number] = [layers[layers.length - 1][0], layers[layers.length - 1][1], layers[layers.length - 1][2]];
    for (let i = layers.length - 2; i >= 0; i--) bgc = over(layers[i], bgc);
    const fg = rgba(getComputedStyle(el).color);
    const fgc = over(fg, bgc);
    const lum = (c: [number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const a = lum(fgc);
    const b = lum(bgc);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

function report(what: string, skin: string, scheme: string, ratio: number) {
  if (process.env.A11Y_PRINT) console.log(`A11Y ${what} ${skin}/${scheme}: ${ratio.toFixed(2)}`);
}

async function enter(page: Page, hash: string, skin: string, scheme: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
}

test.describe('A11YFIX-297 contrast', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a desktop probe: the colours do not depend on the width');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const skin of SKINS_UNDER_TEST) {
    for (const scheme of SCHEMES) {
      test(`notifications: the selected severity label ${skin} ${scheme}`, async ({ page }) => {
        await page.addInitScript(() => {
          try {
            sessionStorage.setItem('sw-notify-mock', JSON.stringify({ viewer: 'admin' }));
          } catch {
            /* storage unavailable */
          }
        });
        await enter(page, '/system/notifications', skin, scheme);
        const sys = page.locator('sw-app system-notifications');
        await expect(sys.locator('[data-notify-settings]')).toBeVisible();
        const sel = sys.locator('.sevseg button[aria-pressed="true"]');
        await expect(sel.first()).toBeVisible();
        const n = await sel.count();
        expect(n, 'at least one selected level').toBeGreaterThan(0);
        for (let i = 0; i < Math.min(n, 6); i++) {
          const r = await contrast(sel.nth(i));
          report('severity', skin, scheme, r);
          expect.soft(r, `selected severity label ${i} (${skin}/${scheme})`).toBeGreaterThanOrEqual(AA);
        }
      });

      test(`temperature: the status badge ${skin} ${scheme}`, async ({ page }) => {
        await installTemperature(page, units());
        await enter(page, '/infra/temperature', skin, scheme);
        const cards = page.locator('sw-app infra-temperature [data-temp-unit]');
        await expect(cards).toHaveCount(5);
        const seen = new Set<string>();
        for (const id of ['u1', 'u3', 'u4', 'u5']) {
          const card = page.locator(`sw-app infra-temperature [data-temp-unit="${id}"]`);
          const status = (await card.getAttribute('data-status')) ?? id;
          await card.click();
          const d = page.locator('sw-app infra-temperature temp-detail');
          await expect(d.locator(`[data-temp-detail="${id}"]`)).toBeVisible();
          const badge = d.locator('.badge').first();
          await expect(badge).toBeVisible();
          const r = await contrast(badge);
          seen.add(status);
          report(`badge ${status}`, skin, scheme, r);
          expect.soft(r, `${status} badge (${skin}/${scheme})`).toBeGreaterThanOrEqual(AA);
          await page.keyboard.press('Escape');
          await expect(d).toHaveCount(0);
        }
        expect(seen.size, 'at least three different statuses probed').toBeGreaterThanOrEqual(3);
      });

      test(`service management: the urgent chip ${skin} ${scheme}`, async ({ page }) => {
        await installTicketsMock(page, {});
        await page.goto('about:blank');
        await page.goto(url('/tickets/mine', skin, scheme));
        await page.waitForSelector('sw-app tickets-list ticket-card');
        const chip = page.locator('sw-app tickets-list ticket-card [data-chip="priority"].bad');
        expect(await chip.count(), 'the mock has an urgent ticket').toBeGreaterThan(0);
        await expect(chip.first()).toBeVisible();
        const r = await contrast(chip.first());
        report('urgent', skin, scheme, r);
        expect.soft(r, `urgent chip (${skin}/${scheme})`).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});
