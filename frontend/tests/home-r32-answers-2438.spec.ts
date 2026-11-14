import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockGaps, type GapOpts } from './home-v3-gaps-mocks';
import { mockP2 } from './home-v3-p2-mocks';

// HOME-R32-ANSWERS-2438: the owner's round-32 answers for the home interface (private/planning/OWNER_ANSWERS_ROUND32_2026-11-14_HE.md,
// docs/changes/HOME-R32-ANSWERS-2438.md). Mocked backend (the v3 mock layers; the prefs mock keeps what was PUT, so a reload sees it).
// Screenshots: test-results/home-r32-answers/.

const SHOTS = 'test-results/home-r32-answers';
const home = (page: Page) => page.locator('sw-home');
const ready = (page: Page) => expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);

async function open(page: Page, route: string, size: { width: number; height: number }, o: GapOpts = {}, calendar = false) {
  await page.setViewportSize(size);
  await page.goto('about:blank');
  const mock = calendar ? await mockP2(page) : await mockGaps(page, o); // the calendar's routes live in the phase-2 layer
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await ready(page);
  await settle(page);
  return mock;
}

async function go(page: Page, route: string) {
  await page.evaluate((r) => { location.hash = `#/home/${r}`; }, route);
  await settle(page);
}

/** No scroll anywhere (page, shell, main area). */
async function noScroll(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.hs-main']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    return out;
  });
}

const mainClass = (page: Page) => home(page).locator('main.hs-main').getAttribute('class');
const firstAnim = (page: Page) => home(page).locator('main.hs-main > *').first().evaluate((e) => getComputedStyle(e).animationName);

test.describe('HOME-R32-ANSWERS-2438', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  test('Q-HOME-6: a screen change fades in place; the rise only from "עוד"; the setting brings the rise back everywhere', async ({ page }) => {
    const mock = await open(page, 'r/home', { width: 1280, height: 800 });
    await go(page, 'scenes');
    expect(await mainClass(page)).toMatch(/\benter fade\b/);
    expect(await firstAnim(page)).toBe('hs-fade');
    await go(page, 'more');
    await home(page).locator('a.hubt[data-mod="calendar"]').click();
    await settle(page);
    expect(await mainClass(page)).toMatch(/\benter rise\b/);
    expect(await firstAnim(page)).toBe('hs-rise');
    // the setting ("הגדרות › תצוגה"): default "מהיר"; "עם תנועה" = the mockup's rise on every change, kept in the person's layout
    await go(page, 'settings/view');
    const row = home(page).locator('[data-set-motion]');
    await expect(row.locator('button[data-v="fade"]')).toHaveAttribute('aria-pressed', 'true');
    await row.locator('button[data-v="rise"]').click();
    await expect.poll(() => mock.calls.some((c) => c.path === 'home/prefs' && (c.body as { layout?: { motion?: string } })?.layout?.motion === 'rise')).toBe(true);
    await go(page, 'scenes');
    expect(await mainClass(page)).toMatch(/\benter rise\b/);
    await go(page, 'active');
    expect(await firstAnim(page)).toBe('hs-rise');
  });

  test('Q-HOME-6: reduced motion turns either one into the short fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'more', { width: 1280, height: 800 });
    await home(page).locator('a.hubt[data-mod="calendar"]').click();
    await settle(page);
    expect(await mainClass(page)).toMatch(/\benter rise\b/);
    expect(await firstAnim(page)).toBe('hs-fade');
  });

  for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
    test(`Q-HOME-2: the week strip at ${size.width} - seven days from today, "השבוע" from Sunday, the choice is remembered`, async ({ page }) => {
      const mock = await open(page, 'calendar', size, {}, true);
      const strip = home(page).locator('.week[aria-label="ימי השבוע"] .wd');
      await expect(strip).toHaveCount(7);
      await expect(strip.first()).toHaveAttribute('data-today', '1');
      const sw = home(page).locator('[data-act="p2CalWeek"]');
      await expect(sw).toHaveCount(2);
      await expect(home(page).locator('[data-act="p2CalWeek"][data-v="next"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await noScroll(page)).toEqual([]);
      await home(page).locator('[data-act="p2CalWeek"][data-v="week"]').click();
      await expect.poll(() => mock.calls.some((c) => c.path === 'home/prefs' && (c.body as { layout?: { cal_week?: string } })?.layout?.cal_week === 'week')).toBe(true);
      await expect(strip.first().locator('.wdl')).toHaveText('א׳');
      await expect(strip.last().locator('.wdl')).toHaveText('ש׳');
      await expect(home(page).locator('.week .wd[data-today="1"]')).toHaveAttribute('aria-pressed', 'true');
      const todayIx = await strip.evaluateAll((els) => els.findIndex((e) => e.getAttribute('data-today') === '1'));
      expect(await home(page).locator('.week .wd[data-past="1"]').count()).toBe(todayIx);
      // the switch shares the row without cutting or wrapping, and nothing scrolls
      const cutBtns = await home(page).locator('[data-act="p2CalWeek"], [data-act="p2CalTab"]').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(cutBtns).toEqual([]);
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/calendar-week-${size.width}.png` });
      // remembered: a reload opens on "השבוע"
      await page.reload();
      await home(page).waitFor();
      await ready(page);
      await settle(page);
      await expect(home(page).locator('[data-act="p2CalWeek"][data-v="week"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(strip.first().locator('.wdl')).toHaveText('א׳');
    });
  }

  for (const size of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
    test(`Q-HOME-1: a portrait tablet ${size.width}x${size.height} - phone layout, bottom bar, four tiles per row`, async ({ page }) => {
      await open(page, 'r/living', size);
      const nav = (await home(page).locator('.hs-nav').boundingBox())!;
      expect(nav.y + nav.height).toBeGreaterThan(size.height - 4);
      expect(await home(page).locator('.wgrid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
      // every small tile is a quarter of the row, a wide one half
      const spans = await home(page).locator('.wgrid > .wdg').evaluateAll((els) => {
        const g = els[0]?.parentElement?.getBoundingClientRect().width ?? 1;
        return els.map((e) => Math.round((e.getBoundingClientRect().width / g) * 4));
      });
      expect(spans.length).toBeGreaterThan(0);
      expect(spans.every((n) => n === 1 || n === 2)).toBe(true);
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/tablet-room-${size.width}.png` });
      await go(page, 'more');
      expect(await home(page).locator('.hub').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(4);
    });
  }

  test('Q-HOME-1: a phone keeps three per row', async ({ page }) => {
    await open(page, 'r/living', { width: 375, height: 812 });
    expect(await home(page).locator('.wgrid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(3);
  });

  test('Q-HOME-3: a still camera says "תמונה" with the grey dot and how often it refreshes (the real interval)', async ({ page }) => {
    await open(page, 'cameras', { width: 1280, height: 800 });
    const t = home(page).locator('.cam-t:not(.off)').first();
    await expect(t.locator('.cap [data-cam-mode="still"]')).toHaveText('תמונה');
    const dot = await t.locator('.cap .live.still .dot').evaluate((e) => getComputedStyle(e).backgroundColor);
    const offline = await home(page).locator('.hs').evaluate((e) => {
      const probe = document.createElement('i');
      probe.style.backgroundColor = getComputedStyle(e).getPropertyValue('--hs-offline');
      e.appendChild(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    expect(dot).toBe(offline);
    const every = t.locator('.cap .lv-d');
    await expect(every).toBeVisible();
    await expect(every).toHaveText('מתעדכנת כל 30 שנ׳');
    await expect(every).toHaveAttribute('data-cam-every', '30');
    await page.screenshot({ path: `${SHOTS}/cameras-1280.png` });
  });

  test('Q-HOME-3: a phone tile (one column) says it too, and the caption stays inside its tile', async ({ page }) => {
    await open(page, 'cameras', { width: 375, height: 812 });
    const t = home(page).locator('.cam-t:not(.off)').first();
    await expect(t.locator('.cap [data-cam-mode="still"]')).toHaveText('תמונה');
    await expect(t.locator('.cap [data-cam-mode="still"]')).toHaveAttribute('title', 'מתעדכנת כל 30 שנ׳');
    await expect(t.locator('.cap .lv-d')).toHaveText('מתעדכנת כל 30 שנ׳');
    const spill = await t.locator('.cap').evaluate((c) => {
      const cr = c.getBoundingClientRect();
      return Array.from(c.querySelectorAll('*')).filter((k) => { const r = k.getBoundingClientRect(); return r.width && (r.left < cr.left - 0.5 || r.right > cr.right + 0.5); }).length;
    });
    expect(spill).toBe(0);
    await page.screenshot({ path: `${SHOTS}/cameras-375.png` });
  });

  test('Q-HOME-3: a narrow tile keeps only the word (the interval in its title)', async ({ page }) => {
    await open(page, 'cameras', { width: 1280, height: 800 });
    await home(page).locator('.cam-t:not(.off)').first().evaluate((e) => { (e as HTMLElement).style.inlineSize = '260px'; (e as HTMLElement).style.flex = 'none'; });
    const t = home(page).locator('.cam-t:not(.off)').first();
    await expect(t.locator('.cap [data-cam-mode="still"]')).toHaveText('תמונה');
    await expect(t.locator('.cap .lv-d')).toBeHidden();
  });

  test('Q-HOME-4: the line under "הבית שלי" is the person\'s name', async ({ page }) => {
    await open(page, 'r/home', { width: 1280, height: 800 });
    await expect(home(page).locator('.tb-t h1')).toHaveText('הבית שלי');
    await expect(home(page).locator('.tb-t .tb-c')).toHaveText('נועה לביא');
  });
});
