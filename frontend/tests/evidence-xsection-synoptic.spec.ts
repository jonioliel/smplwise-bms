import { test, expect, type Page } from '@playwright/test';

// Release 2.29.0 (owner decisions 2026-10-29): the building cross-section on the floors screen, the synoptic map tab and the (off by default) fire-alarm UI.
// Static demo build, no backend: `?xsdemo=N` makes N floors, `?xs_<option>=value` overrides an option, `?firemock=alarm` is the labelled demo fire source.
// Nothing here claims fire detection exists. No pixel baselines.

const FLOORS = '/#/explore/buildings/b1/floors';
const SYN = '/#/devices/synoptic';

async function noScroll(page: Page, sel: string) {
  const bad = await page.evaluate((s) => {
    const out: string[] = [];
    const seen = new Set<Element>();
    const walk = (root: Document | ShadowRoot | Element) => {
      root.querySelectorAll('*').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
        const css = getComputedStyle(el);
        if (!/auto|scroll/.test(css.overflowY) || (el as HTMLElement).scrollHeight <= (el as HTMLElement).clientHeight + 1) return;
        if (el.matches('html,body')) return;
        if ((el as HTMLElement).clientHeight < 1) return;
        out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      });
    };
    walk(document);
    void s;
    return out;
  }, sel);
  return bad;
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.reload();
}

test.describe('cross-section on the floors screen', () => {
  test('a floor card, its tile or section row and the section stay in sync: first click selects, second opens', async ({ page }, info) => {
    const phone = info.project.name === 'mobile';
    await open(page, `${FLOORS}?xsdemo=5`);
    const cards = page.locator('[data-floor-card]');
    await expect(cards.first()).toBeVisible();
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-floor-card')));
    expect(ids.length).toBe(5);
    const target = ids[2]!;
    await page.locator(`[data-floor-card="${target}"]`).click();
    await expect(page.locator(`[data-floor-card="${target}"]`)).toHaveAttribute('aria-pressed', 'true');
    if (phone) await expect(page.locator(`[data-xs-tile="${target}"]`)).toBeVisible();
    else await expect(page.locator(`[data-xs-row="${target}"]`)).toHaveAttribute('aria-pressed', 'true');
    // the section selects the same floor as a card: another floor, one click, selection moves, the page does not
    const other = ids[0]!;
    if (phone) await page.locator(`[data-xs-tile="${other}"]`).click();
    else await page.locator(`[data-xs-row="${other}"]`).click();
    await expect(page.locator(`[data-floor-card="${other}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-floor-card="${target}"]`)).toHaveAttribute('aria-pressed', 'false');
    expect(page.url()).toContain('/floors');
    // the second click opens
    if (phone) await page.locator(`[data-xs-tile="${other}"]`).click();
    else await page.locator(`[data-xs-row="${other}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/explore/floors/${other}`));
  });

  test('click=open (setting) opens at once from the section', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the section is a tile on the phone: the same rule, covered above');
    await open(page, `${FLOORS}?xsdemo=4&xs_click=open`);
    const row = page.locator('[data-xs-row]').first();
    const id = await row.getAttribute('data-xs-row');
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/explore/floors/${id}`));
  });

  test('desktop_place=off draws no section; right keeps it', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop setting');
    await open(page, `${FLOORS}?xsdemo=4&xs_desktop_place=off`);
    await expect(page.locator('[data-floor-card]').first()).toBeVisible();
    await expect(page.locator('[data-xsection]')).toHaveCount(0);
    await open(page, `${FLOORS}?xsdemo=4&xs_desktop_place=right`);
    await expect(page.locator('[data-xsection]')).toBeVisible();
  });

  test('phone options: sheet button, compact card, tiles (above 12 floors the compact card)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone settings');
    await open(page, `${FLOORS}?xsdemo=4`);
    await expect(page.locator('[data-xs-tile]').first()).toBeVisible();
    await open(page, `${FLOORS}?xsdemo=14`);
    await expect(page.locator('[data-xs-compact]')).toBeVisible();
    await open(page, `${FLOORS}?xsdemo=4&xs_phone_place=card`);
    await expect(page.locator('[data-xs-compact]')).toBeVisible();
    await open(page, `${FLOORS}?xsdemo=4&xs_phone_place=sheet`);
    await expect(page.locator('[data-xs-sheet-btn]')).toBeVisible();
    await expect(page.locator('[data-xs-tile]')).toHaveCount(0);
  });

  test('many floors: the list steps down and never scrolls; near shows the selected floor with neighbours', async ({ page }) => {
    await open(page, `${FLOORS}?xsdemo=16`);
    await expect(page.locator('[data-floor-card]').first()).toBeVisible();
    await expect(page.locator('[data-floor-list]')).toHaveAttribute('data-many', 'steps');
    await open(page, `${FLOORS}?xsdemo=16&xs_many=near`);
    const n = await page.locator('[data-floor-card]').count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(16);
  });

  for (const w of [375, 768, 1440, 2000]) {
    for (const n of [3, 16, 24]) {
      test(`no scrolling at ${w}px with ${n} floors`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'sizes are set explicitly: one project runs the matrix');
        await page.setViewportSize({ width: w, height: w <= 768 ? 900 : 900 });
        await open(page, `${FLOORS}?xsdemo=${n}`);
        await expect(page.locator('[data-floor-card]').first()).toBeVisible();
        await page.waitForTimeout(500);
        expect(await noScroll(page, 'floors')).toEqual([]);
        const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(doc).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe('synoptic map tab', () => {
  test('sits between מבט על and קברניט', async ({ page }) => {
    await open(page, SYN);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'מפה סינופטית', 'קברניט']);
    await expect(page.locator('[data-synoptic-screen]')).toBeVisible();
  });

  test('columns: the fire column is hidden by default, dashed "not connected" only when set; no fire is claimed', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=6`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    await expect(page.locator('[data-syn-col]').first()).toBeVisible();
    await expect(page.locator('[data-syn-col="fire"]')).toHaveCount(0);
    await expect(page.locator('[data-fire-bar]')).toHaveCount(0);
    await open(page, `${SYN}?xsdemo=6&xs_fire_column=dashed`);
    await expect(page.locator('[data-fire-nc]')).toBeVisible();
  });

  test('a row selects, and the detail line offers to open the floor', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=6`);
    const row = page.locator('[data-syn-row]').first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator('[data-syn-detail]')).toBeVisible();
  });

  for (const w of [375, 768, 1440, 2000]) {
    test(`no scrolling at ${w}px (24 floors)`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'sizes are set explicitly');
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, `${SYN}?xsdemo=24`);
      await expect(page.locator('[data-syn-board]')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await noScroll(page, 'syn')).toEqual([]);
      const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(doc).toBeLessThanOrEqual(1);
    });
  }

  test('the wall screen has its own address', async ({ page }) => {
    await open(page, `/#/kiosk/synoptic?xsdemo=5`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
  });
});

test.describe('fire-alarm UI (demo source only - no fire detection exists)', () => {
  test('off by default: a demo alarm draws nothing until fire_ui is on', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=4&firemock=alarm`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    await expect(page.locator('[data-fire-bar]')).toHaveCount(0);
    await expect(page.locator('[data-alarm-panel]')).toHaveCount(0);
  });

  test('on: the red bar is labelled demo data and appears on every screen; hold 1.2 s acknowledges, a short press does not', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=4&firemock=alarm&xs_fire_ui=1`);
    const bar = page.locator('[data-fire-bar]');
    await expect(bar).toBeVisible();
    await expect(page.locator('[data-fire-demo]')).toBeVisible();
    await expect(page.locator('[data-alarm-panel]')).toBeVisible();
    const btn = bar.locator('[data-ack-hold]');
    const box = (await btn.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    await expect(btn).toBeVisible(); // a short press changes nothing
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await expect(bar.locator('[data-ack-hold]')).toHaveCount(0);
    await expect(bar).toHaveClass(/ackd/);
  });

  test('alarm_bar=home draws the bar only on the home screens', async ({ page }) => {
    await open(page, `/#/system/diagnostics?xsdemo=4&firemock=alarm&xs_fire_ui=1&xs_alarm_bar=home`);
    await expect(page.locator('sw-app')).toBeVisible();
    await expect(page.locator('[data-fire-bar]')).toHaveCount(0);
  });

  test('ack=confirm asks for "yes, received" after a press', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=4&firemock=alarm&xs_fire_ui=1&xs_ack=confirm`);
    await page.locator('[data-fire-bar] [data-ack-btn]').click();
    await page.locator('[data-fire-bar] [data-ack-yes]').click();
    await expect(page.locator('[data-fire-bar]')).toHaveClass(/ackd/);
  });
});
