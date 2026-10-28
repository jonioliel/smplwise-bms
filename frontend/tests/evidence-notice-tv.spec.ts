import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOBBY_NOTICES, TOKEN, lobbyFeed, serveFeed, settled, tvUrl } from './notice-tv-fixtures';

// CR-NOTICE106: the TV board page (notice-tv.html -> src/notice-tv/main.ts) against a mocked display feed. Checks what the mock-up's
// shots.mjs checked: no page error, no console error, no document scroll, nothing outside the canvas, Heebo loaded, the token sent
// in the header (never in the URL), the templates in both orientations, the urgent takeover, the modes, the remote keys and the
// empty / gone states. Screenshots go to test-results/notice-tv/ for review.
//   npx playwright test tests/evidence-notice-tv.spec.ts --project=desktop

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/notice-tv');
test.describe.configure({ mode: 'serial' });
test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'the TV page is checked on desktop Chromium at its own viewports'));

function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`);
  });
  return errors;
}

async function checks(page: Page, name: string): Promise<void> {
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement as HTMLElement;
    const cv = document.getElementById('cv') as HTMLElement;
    const z = parseFloat(getComputedStyle(cv).zoom || '1') || 1;
    const box = cv.getBoundingClientRect();
    const outside: string[] = [];
    // a visible text box that leaves the canvas (the mock-up's clip check, by real element boxes)
    cv.querySelectorAll<HTMLElement>('.pg h1, .pg h2, .pg p, .welcome b, .clock .t, .ft .live, .cell, .it.on').forEach((el) => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || el.closest('[hidden]')) return;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1) outside.push(el.className || el.tagName);
    });
    return {
      scroll: doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1,
      heebo: document.fonts.check('500 40px Heebo', 'שלום'),
      zoom: z,
      outside,
    };
  });
  expect(r.scroll, `${name}: the document scrolls`).toBe(false);
  expect(r.heebo, `${name}: Heebo is not loaded`).toBe(true);
  expect(r.outside, `${name}: boxes outside the canvas`).toEqual([]);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test('lobby, template 1, day: the feed is read with the token header, and the page draws the approved composition', async ({ page }) => {
  const errors = watch(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const tokens = await serveFeed(page, lobbyFeed());
  await page.goto(tvUrl());
  await settled(page);
  expect(tokens[0]).toBe(TOKEN);
  await expect(page.locator('#cv')).toHaveAttribute('data-tpl', '1');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await expect(page.locator('.clock .t')).toHaveText('09:12');
  await expect(page.locator('.welcome b')).toHaveText('מגדל הים');
  await expect(page.locator('.stage .it.on h1')).toContainText('הפסקת מים מחר');
  await expect(page.locator('.stage .dots > span:not(.pz)')).toHaveCount(7);
  await expect(page.locator('.ft .live')).toHaveText('עודכן · הכניסה הראשית 09:12'); // TVNOTICE2-297: the place wording is the default
  expect(page.url()).toContain('#t='); // the token stays in the fragment (the TV reloads with it)
  await checks(page, 't1-lobby-day-1920');
  expect(errors).toEqual([]);
});

test('the remote: ArrowLeft = next, ArrowRight = previous, Space pauses', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed());
  await page.goto(tvUrl());
  await settled(page);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.stage .it.on h1')).toHaveText(LOBBY_NOTICES[1].title);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.stage .it.on h1')).toContainText('הפסקת מים');
  await page.keyboard.press(' ');
  await expect(page.locator('#cv')).toHaveAttribute('data-paused', '1');
  await expect(page.locator('.dots .pz')).toBeVisible();
});

for (const [tpl, w, h, theme] of [[1, 1080, 1920, 'night'], [2, 1920, 1080, 'night'], [2, 1080, 1920, 'day'], [3, 1920, 1080, 'day'], [3, 1080, 1920, 'night'], [1, 3840, 2160, 'night'], [1, 1280, 720, 'day']] as const) {
  test(`template ${tpl} at ${w}x${h}, ${theme}`, async ({ page }) => {
    const errors = watch(page);
    await page.setViewportSize({ width: w, height: h });
    await serveFeed(page, lobbyFeed({ template: tpl, theme }));
    await page.goto(tvUrl());
    await settled(page);
    await expect(page.locator('#cv')).toHaveAttribute('data-tpl', String(tpl));
    await expect(page.locator('#cv')).toHaveClass(h > w ? /portrait/ : /^(?!.*portrait)/);
    await checks(page, `t${tpl}-${theme}-${w}x${h}`);
    expect(errors).toEqual([]);
  });
}

for (const mode of ['all', 'focus'] as const) {
  test(`mode ${mode}: every notice together, nothing scrolls`, async ({ page }) => {
    const errors = watch(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await serveFeed(page, lobbyFeed({ mode }));
    await page.goto(tvUrl());
    await settled(page);
    if (mode === 'all') {
      await expect(page.locator('.stage.all .cell')).toHaveCount(6); // 7 notices -> 3x2 + a second page
      expect(await page.locator('.stage.all').evaluate((el) => (el as HTMLElement).style.getPropertyValue('--cols'))).toBe('3');
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('.stage.all .cell')).toHaveCount(1);
    } else {
      await expect(page.locator('.stage.focus .others .cell')).toHaveCount(3);
      await expect(page.locator('.stage.focus .others .more')).toContainText('ועוד 3');
    }
    await checks(page, `mode-${mode}`);
    expect(errors).toEqual([]);
  });
}

test('urgent takeover in the first minute after publication', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const u = { ...LOBBY_NOTICES[0], published_at: '2026-10-23T06:11:40Z' };
  await serveFeed(page, lobbyFeed({ theme: 'night' }, [u, ...LOBBY_NOTICES.slice(1)]));
  await page.goto(tvUrl('now=2026-10-23T06:12:00Z'));
  await settled(page);
  await expect(page.locator('#cv')).toHaveAttribute('data-urgent', 'full');
  await expect(page.locator('.take h1')).toContainText('הפסקת מים');
  await expect(page.locator('.take .tag')).toHaveText('הודעה דחופה');
  await checks(page, 'urgent-takeover-night');
});

test('a hold keeps the screen on that notice and shows the pause mark', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({ hold: 'n4' }));
  await page.goto(tvUrl());
  await settled(page);
  await expect(page.locator('.stage .it.on h1')).toHaveText('אסיפת דיירים שנתית');
  await expect(page.locator('#cv')).toHaveAttribute('data-paused', '1');
});

test('empty board and a revoked link', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({}, []));
  await page.goto(tvUrl());
  await settled(page);
  await expect(page.locator('#cv')).toHaveAttribute('data-empty', '1');
  await expect(page.locator('.empty p')).toHaveText('אין הודעות כרגע');
  await checks(page, 'empty');
  const p2 = await page.context().newPage();
  await serveFeed(p2, 404);
  await p2.goto(tvUrl());
  await p2.waitForSelector('#cv[data-net="gone"]');
  await expect(p2.locator('.gone p')).toHaveText('הלוח אינו פעיל');
});

test('no token in the link: nothing is fetched and the board says it is not active', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const tokens = await serveFeed(page, lobbyFeed());
  await page.goto('notice-tv.html?board=lobby&clock=fixed');
  await page.waitForSelector('#cv[data-net="gone"]');
  expect(tokens).toEqual([]);
});
