import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// SYNOPTIC-MOBILE-2342 (owner round 13, answer 1A + note): the phone synoptic map in its three layouts - "תצוגת המפה הסינופטית בטלפון"
// table (default) / cards / section - at 320 / 390 / 430, light and dark, 3 and 12 floors. Static demo build, no backend:
// `?xsdemo=N` makes N floors, `?xs_syn_phone_view=` picks the layout. Layout assertions: no cell of a row spills into its neighbour
// (the 2.33.0 overlap), the page never scrolls sideways, with 12 floors only the list scrolls; the lighting opens the floor lights popup,
// the floor name opens the floor (table, cards), the section selects first and its strip opens the floor; the info sheet carries the summary.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-synoptic-mobile-2342.spec.ts --project=mobile --workers=1

const OUT = join(process.cwd(), '..', 'docs', 'evidence', 'SYNOPTIC-MOBILE-2342');
mkdirSync(OUT, { recursive: true });
const SYN = '/#/devices/synoptic';
const VIEWS = ['table', 'cards', 'section'] as const;
const WIDTHS = [320, 390, 430];

async function open(page: Page, url: string, w: number, dark: boolean) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.goto(url);
  await page.reload();
  if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(500);
}

/** Every pair of side-by-side children of a floor row that overlap, and every child whose content is wider than its box. */
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
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0.5 && oy > 0.5) out.push(`${row.getAttribute('data-syn-row')}: ${i} overlaps ${j}`);
        }
      });
      // the pills of the section stay inside their floor's row
      if (grid.matches('.ppls')) {
        const box = row.getBoundingClientRect();
        for (const k of kids) if (k.getBoundingClientRect().left < box.left - 0.5 || k.getBoundingClientRect().right > box.right + 0.5) out.push(`${row.getAttribute('data-syn-row')}: a pill leaves the row`);
      }
    }
    return out;
  });
}

/** Elements that scroll inside the page. */
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

test.describe('phone synoptic map: three layouts x 320 / 390 / 430 x light / dark', () => {
  for (const view of VIEWS) {
    for (const w of WIDTHS) {
      for (const dark of [false, true]) {
        for (const n of [3, 12]) {
          test(`${view} ${w}${dark ? ' dark' : ''} ${n} floors`, async ({ page }, info) => {
            test.skip(info.project.name !== 'mobile', 'the widths are set explicitly: the phone project runs the matrix');
            await open(page, `${SYN}?xsdemo=${n}&xs_syn_phone_view=${view}`, w, dark);
            const board = page.locator(`[data-syn-board][data-syn-phone="${view}"]`);
            await expect(board).toBeVisible();
            await expect(page.locator('[data-syn-row]')).toHaveCount(n);
            // sub-answer 4C: one title (the page's), the building and its floors under it; no title inside the board
            await expect(page.locator('sw-page[data-synoptic-screen]')).toHaveAttribute('subheading', new RegExp(`· ${n} `));
            await expect(board.locator('h2')).toHaveCount(0);
            expect(await spills(page)).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
            const sc = (await scrollers(page)).filter((x) => !/^div\.(plist|pbl|cl)\b/.test(x));
            expect(sc, 'only the floor list scrolls').toEqual([]);
            await page.screenshot({ path: join(OUT, `${view}-${w}-${n}${dark ? '-dark' : ''}.png`) });
          });
        }
      }
    }
  }
});

test.describe('phone synoptic map: what a press does', () => {
  for (const view of VIEWS) {
    test(`${view}: the lighting opens the floor lights popup`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone layouts');
      await open(page, `${SYN}?xsdemo=3&xs_syn_phone_view=${view}`, 390, false);
      const hit = page.locator('[data-syn-lights]').first();
      await expect(hit).toBeVisible();
      await expect(hit).toContainText(/\d+\/\d+/);
      await hit.click();
      await expect(page.locator('devices-tiles-panel[data-floor-lights] sw-drawer[open]')).toHaveCount(1);
      await page.screenshot({ path: join(OUT, `${view}-lights-popup.png`) });
    });

    test(`${view}: the info button opens the summary sheet`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone layouts');
      await open(page, `${SYN}?xsdemo=3&xs_syn_phone_view=${view}`, 390, false);
      await page.locator('[data-syn-info]').click();
      const sheet = page.locator('sw-sheet[data-syn-info-sheet][open]');
      await expect(sheet).toHaveCount(1);
      await expect(page.locator('[data-syn-info-shown]')).not.toBeEmpty();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${view}-info-sheet.png`) });
    });
  }

  for (const view of ['table', 'cards'] as const) {
    test(`${view}: the floor name opens the floor`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone layouts');
      await open(page, `${SYN}?xsdemo=3&xs_syn_phone_view=${view}`, 390, false);
      const name = page.locator('[data-syn-open-floor]').nth(1);
      const id = await name.getAttribute('data-syn-open-floor');
      await name.click();
      await expect(page).toHaveURL(new RegExp(`/explore/floors/${id}`));
    });
  }

  test('section: a press selects the floor in the section, the strip opens it', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    await open(page, `${SYN}?xsdemo=3&xs_syn_phone_view=section`, 390, false);
    const sel = page.locator('[data-syn-sel]').nth(1);
    const id = await sel.getAttribute('data-syn-sel');
    await sel.click();
    await expect(sel).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-syn-strip] [data-syn-open]')).toBeVisible();
    await page.screenshot({ path: join(OUT, 'section-selected.png') });
    await page.locator('[data-syn-strip] [data-syn-open]').click();
    await expect(page).toHaveURL(new RegExp(`/explore/floors/${id}`));
  });

  test('hide-empty off: the empty columns come dashed at 390, never at 320', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone layouts');
    await open(page, `${SYN}?xsdemo=6&xsdata=sparse&xs_syn_hide_empty=0`, 390, false);
    await expect(page.locator('.pah [data-syn-col]')).toHaveCount(5);
    expect(await spills(page)).toEqual([]);
    await open(page, `${SYN}?xsdemo=6&xsdata=sparse&xs_syn_hide_empty=0`, 320, false);
    await expect(page.locator('.pah [data-syn-col]')).toHaveCount(2);
  });

  test('tablet width keeps the wide board', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'one project');
    await open(page, `${SYN}?xsdemo=3&xs_syn_phone_view=cards`, 768, false);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    await expect(page.locator('[data-syn-phone]')).toHaveCount(0);
    await expect(page.locator('.srow')).toHaveCount(3);
  });
});
