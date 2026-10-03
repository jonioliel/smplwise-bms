import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME_SCREENS, openChrome } from './bubble-chrome-screens';

// 0.1.157 (TASK_QUEUE item 4): the bubble CHROME on the security, device-list, automations-list and settings screens.
//   1. evidence shots of every screen in tests/bubble-chrome-screens.ts at 390 / 820 / 1440, light and dark, demo mode
//      -> docs/design/evidence/bubble-lists/<id>-<width>-<scheme>.png
//   2. what the chrome promises: the security sections are a pill track with a solid thumb in bubble and keep their 12 px track in
//      classic (the classic skin is untouched), the phone's section row no longer sticks in bubble, a local segmented control
//      (the live wall's layouts) is a pill track, every screen host carries data-skin, no backdrop-filter on the list rows and
//      cards (the performance rule), and the operator screens carry no platform brand word.
// Needs the Vite DEV server like the other bubble specs:
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/evidence-bubble-lists.spec.ts --project=desktop --project=mobile --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/bubble-lists');
const BRANDS = /Home Assistant|\bHA\b|Ingress|Supervisor|Companion/;

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const app = (page: Page, sel: string) => page.locator(`sw-app ${sel}`);

test.describe('bubble lists and chrome', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo spec');
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
        localStorage.removeItem('sw.demo.automations');
      } catch {
        /* storage unavailable */
      }
    });
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.clock.setFixedTime(new Date('2026-10-03T13:00:00Z'));
  });

  test('evidence shots: every chrome screen, light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    test.setTimeout(12 * 60_000);
    const widths = info.project.name === 'mobile' ? [390] : [1440, 820];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const scheme of ['light', 'dark'] as const) {
        for (const s of CHROME_SCREENS) {
          await openChrome(page, s, scheme);
          await expect(page.locator('html')).toHaveAttribute('data-skin', 'bubble');
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          await expect(app(page, s.outer)).toHaveAttribute('data-skin', 'bubble');
          await shot(page, `${s.id}-${w}-${scheme}`);
        }
      }
    }
  });

  test('the security sections: a pill track in bubble, the classic track untouched', async ({ page }, info) => {
    const events = CHROME_SCREENS.find((s) => s.id === 'events')!;
    await openChrome(page, events, 'light');
    if (info.project.name === 'mobile') {
      // the phone's copy of the sections (the sticky row of 0.1.1xx) is static in bubble: nothing floats over the rows
      const row = app(page, 'nav[data-security-row]');
      await expect(row).toBeVisible();
      expect(await row.evaluate((el) => getComputedStyle(el).position)).toBe('static');
      await openChrome(page, events, 'light', '', 'classic');
      expect(await app(page, 'nav[data-security-row]').evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
      return;
    }
    const nav = app(page, 'nav[data-security-sections]');
    await expect(nav).toBeVisible();
    expect(await nav.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');
    const on = nav.locator('a.on');
    expect(await on.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');
    expect(await on.evaluate((el) => parseFloat(getComputedStyle(el).minHeight))).toBeGreaterThanOrEqual(38);
    await openChrome(page, events, 'light', '', 'classic');
    expect(await app(page, 'nav[data-security-sections]').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('12px');
  });

  test('a local segmented control is a pill track; the rows carry no blur; no brand words', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough');
    const wall = CHROME_SCREENS.find((s) => s.id === 'wall')!;
    await openChrome(page, wall, 'dark');
    const layouts = app(page, 'live-wall .layouts');
    await expect(layouts).toBeVisible();
    expect(await layouts.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');
    const first = layouts.locator('button').first();
    expect(await first.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(38);
    for (const s of CHROME_SCREENS.filter((x) => x.group !== 'settings')) {
      await openChrome(page, s, 'light');
      const blurred = await app(page, s.outer).evaluate((host) => {
        const out: string[] = [];
        const walk = (root: ShadowRoot | Element) => {
          for (const el of root.querySelectorAll('*')) {
            const s = getComputedStyle(el);
            const bf = s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none';
            if (bf !== 'none' && /(^|\s)(wrow|item|card|acard|scard|pcard|kpi|hcard|zone|tr|li|row)(\s|$)/.test(el.className?.toString() ?? '')) out.push(el.tagName.toLowerCase() + '.' + el.className);
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        if (host.shadowRoot) walk(host.shadowRoot);
        return out;
      });
      expect(blurred, `${s.id}: blurred rows`).toEqual([]);
      const text = await app(page, s.outer).evaluate((host) => host.shadowRoot?.textContent ?? '');
      expect(text, `${s.id}: brand words`).not.toMatch(BRANDS);
    }
  });
});
