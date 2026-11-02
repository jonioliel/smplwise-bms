import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// SYNOPTIC-PHONE-SETTINGS-2360 (owner 02.11 round 14): "תאורה בטלפון" (ui.xs syn_phone_light: bar - default / segments / number) and
// "שורת סיכום בטלפון" (ui.xs syn_phone_summary: button - default / line / off) on the three phone layouts. Static demo build, no backend:
// `?xs_syn_phone_light=` / `?xs_syn_phone_summary=` / `?xs_syn_phone_view=` override the options, `?xsdemo=N` makes N floors.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-synoptic-phone-settings-2360.spec.ts --project=mobile --workers=1
// The defaults draw exactly what 2.34.2 drew (the bar, the info button): evidence-synoptic-mobile-2342 keeps covering them.

const OUT = join(process.cwd(), '..', 'docs', 'evidence', 'SYNOPTIC-PHONE-SETTINGS-2360');
mkdirSync(OUT, { recursive: true });
const SYN = '/#/devices/synoptic';
const VIEWS = ['table', 'cards', 'section'] as const;
const LIGHTS = ['bar', 'segments', 'number'] as const;
const SUMMARIES = ['button', 'line', 'off'] as const;

async function open(page: Page, query: string, w: number, dark = false) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.goto(`${SYN}?${query}`);
  await page.reload();
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(500);
}

/** Side-by-side children of a floor row that overlap, or whose content is wider than their box (the 2.33.0 overlap, for every gauge). */
async function spills(page: Page) {
  return page.locator('[data-syn-row]').evaluateAll((rows) => {
    const out: string[] = [];
    for (const row of rows) {
      const grid = row.matches('.par') ? row : row.querySelector('.pfr, .pfm, .ppls');
      if (!grid) continue;
      const kids = [...grid.children].filter((k) => (k as HTMLElement).getBoundingClientRect().width > 0) as HTMLElement[];
      kids.forEach((k, i) => {
        if (k.scrollWidth > k.clientWidth + 1 && !k.matches('.pan, .pfh')) out.push(`${row.getAttribute('data-syn-row')}: child ${i} content ${k.scrollWidth} > box ${k.clientWidth}`);
        for (let j = i + 1; j < kids.length; j++) {
          const a = k.getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) out.push(`${row.getAttribute('data-syn-row')}: ${i} overlaps ${j}`);
        }
      });
    }
    return out;
  });
}

async function scrollers(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll('*').forEach((el) => {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
        const h = el as HTMLElement;
        if (el.matches('html,body') || h.clientHeight < 1) return;
        if (/auto|scroll/.test(getComputedStyle(el).overflowY) && h.scrollHeight > h.clientHeight + 1) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      });
    };
    walk(document);
    return out;
  });
}

test.describe('phone synoptic map: lights gauge x summary x layout', () => {
  for (const view of VIEWS) {
    for (const light of LIGHTS) {
      for (const summary of SUMMARIES) {
        for (const w of [320, 390]) {
          test(`${view} ${light} ${summary} ${w}`, async ({ page }, info) => {
            test.skip(info.project.name !== 'mobile', 'the widths are set explicitly: the phone project runs the matrix');
            await open(page, `xsdemo=12&xs_syn_phone_view=${view}&xs_syn_phone_light=${light}&xs_syn_phone_summary=${summary}`, w);
            const board = page.locator(`[data-syn-board][data-syn-phone="${view}"]`);
            await expect(board).toBeVisible();
            await expect(board).toHaveAttribute('data-sum', summary);
            await expect(page.locator('[data-syn-row]')).toHaveCount(12);

            // the gauge: table and cards follow the setting; the cross-section draws none of them
            const gauge = (kind: string) => board.locator(`[data-syn-gauge="${kind}"]`);
            if (view === 'section') {
              await expect(board.locator('[data-syn-gauge]')).toHaveCount(0);
            } else {
              if (light === 'bar') expect(await gauge('bar').count()).toBeGreaterThan(0);
              else await expect(gauge('bar')).toHaveCount(0);
              if (light !== 'segments') await expect(gauge('segments')).toHaveCount(0);
              else {
                expect(await gauge('segments').count()).toBeGreaterThan(0);
                expect(await gauge('segments').first().locator('i').count()).toBeGreaterThan(0);
              }
              if (light === 'number') await expect(board.locator('.mb')).toHaveCount(0);
            }

            // the summary: the info button (and its sheet) only by default; the line only for "line"; "off" shows neither
            await expect(page.locator('[data-syn-info]')).toHaveCount(summary === 'button' ? 1 : 0);
            if (summary !== 'button') await expect(page.locator('sw-sheet[data-syn-info-sheet]')).toHaveCount(0);
            if (summary === 'line' && view !== 'section') await expect(page.locator('[data-syn-summary="line"]')).toHaveCount(1);
            if (summary !== 'line') await expect(page.locator('[data-syn-summary="line"]')).toHaveCount(0);
            // "off" keeps a small settings button (the demo has no sign-in, so it is allowed); the other two values do not draw it
            await expect(page.locator('[data-syn-map-settings]')).toHaveCount(summary === 'off' ? 1 : 0);

            expect(await spills(page)).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
            expect((await scrollers(page)).filter((x) => !/^div\.(plist|pbl|cl)\b/.test(x)), 'only the floor list scrolls').toEqual([]);
            if (w === 390) await page.screenshot({ path: join(OUT, `${view}-${light}-${summary}.png`) });
          });
        }
      }
    }
  }

  test('dark: the segment strip and the line read on the table and the cards', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    for (const view of ['table', 'cards'] as const) {
      await open(page, `xsdemo=3&xs_syn_phone_view=${view}&xs_syn_phone_light=segments&xs_syn_phone_summary=line`, 390, true);
      await expect(page.locator('[data-syn-gauge="segments"]').first()).toBeVisible();
      await page.screenshot({ path: join(OUT, `${view}-segments-line-dark.png`) });
    }
  });

  test('"off" keeps a 44 px settings button that opens the map settings', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    for (const view of VIEWS) {
      await open(page, `xsdemo=3&xs_syn_phone_view=${view}&xs_syn_phone_summary=off`, 390);
      const btn = page.locator('[data-syn-map-settings]');
      await expect(btn).toHaveCount(1);
      const box = (await btn.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      await expect(btn).toHaveAttribute('aria-label', 'הגדרות המפה');
      if (view === 'table') await page.screenshot({ path: join(OUT, 'off-settings-button.png') });
    }
    await page.locator('[data-syn-map-settings]').click();
    await expect(page).toHaveURL(/\/system\/diagnostics/);
    await expect(page).toHaveURL(/focus=xs/);
  });

  test('the default keeps the bar and the info button, which opens its sheet', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    await open(page, 'xsdemo=3', 390);
    await expect(page.locator('[data-syn-gauge="bar"]').first()).toBeVisible();
    await expect(page.locator('[data-syn-gauge="segments"]')).toHaveCount(0);
    await page.locator('[data-syn-info]').click();
    await expect(page.locator('sw-sheet[data-syn-info-sheet][open]')).toHaveCount(1);
  });

  test('the lights popup still opens from a segment strip', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    await open(page, 'xsdemo=3&xs_syn_phone_light=segments', 390);
    await page.locator('[data-syn-lights]').first().click();
    await expect(page.locator('devices-tiles-panel[data-floor-lights] sw-drawer[open]')).toHaveCount(1);
  });
});

test.describe('the settings card', () => {
  test('both rows sit under the phone layout row, with their hints (390 and desktop)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the card is the same on every project');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/system/diagnostics?focus=xs');
    await page.reload();
    await page.waitForTimeout(700);
    const card = page.locator('system-xs-options');
    await expect(card).toContainText('תאורה בטלפון');
    await expect(card).toContainText('שורת סיכום בטלפון');
    await expect(card).toContainText('פס מקטעים');
    await expect(card).toContainText('כפתור מידע');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, 'settings-card-390.png') });
  });
});
