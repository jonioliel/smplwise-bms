import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl, TOKEN } from './notice-tv-fixtures';

// NOTICESLIDES-295: the promo slides in the rotation and the template-2 building photo, in the product TV page.
//   npx playwright test tests/notice-tv-slides-295.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

// a 2x2 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8z8Dwn4GBgYEBAAsfAgGJmhWvAAAAAElFTkSuQmCC', 'base64');
const SLIDES = [
  { id: 's1', title: 'חדר הכושר פתוח', text: 'כל יום 06:00-23:00' },
  { id: 's2', title: 'אפליקציית הבניין', text: 'הודעות ותקלות', image: 'api/v1/notices/display/lobby/slide/s2?v=abc' },
];

async function open(page: Page, feed: ReturnType<typeof lobbyFeed>) {
  const headers: string[] = [];
  await page.route('**/api/v1/notices/display/lobby/slide/**', async (route) => {
    headers.push(route.request().headers()['x-board-token'] ?? '');
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  await page.route('**/api/v1/notices/display/lobby/photo**', async (route) => {
    headers.push(route.request().headers()['x-board-token'] ?? '');
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(800);
  return headers;
}

async function pressNext(page: Page, times: number) {
  for (let i = 0; i < times; i++) await page.keyboard.press('ArrowLeft');
}

test('promo off (the default): no slide in the rotation even when the feed carries some', async ({ page }) => {
  await open(page, lobbyFeed({}, undefined, { slides: SLIDES }));
  await expect(page.locator('#cv')).toHaveAttribute('data-promo', '0');
  await expect(page.locator('.it.promo')).toHaveCount(0);
});

test('promo on: the slides follow the notices, a picture is read with the board token', async ({ page }) => {
  const tokens = await open(page, lobbyFeed({ blocks: { promo: true } as never }, undefined, { slides: SLIDES }));
  await expect(page.locator('#cv')).toHaveAttribute('data-promo', '1');
  await expect(page.locator('.it.promo')).toHaveCount(2);
  const total = await page.locator('.stage .it').count();
  expect(total).toBe(7 + 2);
  await pressNext(page, total - 2); // to the first slide
  const on = page.locator('.it.promo.on');
  await expect(on).toHaveCount(1);
  await expect(on.locator('h1')).toHaveText('חדר הכושר פתוח');
  await expect(on.locator('.pic svg')).toHaveCount(1); // no picture: the mock-up's placeholder
  await pressNext(page, 1);
  await expect(page.locator('.it.promo.on h1')).toHaveText('אפליקציית הבניין');
  const img = page.locator('.it.promo.on .pic img');
  await expect(img).toHaveCount(1);
  expect(await img.getAttribute('src')).toMatch(/^blob:/);
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(2);
  expect(tokens).toEqual([TOKEN]);
});

test('the slides are not shown in "all together"', async ({ page }) => {
  await open(page, lobbyFeed({ mode: 'all', blocks: { promo: true } as never }, undefined, { slides: SLIDES }));
  await expect(page.locator('.it.promo')).toHaveCount(0);
});

test('template 2: the building photo replaces the placeholder scene; template 1 ignores it', async ({ page }) => {
  const photo = 'api/v1/notices/display/lobby/photo?v=abc';
  const tokens = await open(page, lobbyFeed({ template: 2, photo } as never));
  await expect(page.locator('#cv')).toHaveAttribute('data-photo', '1');
  expect(await page.locator('.photo .img').evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/^url\("blob:/);
  expect(await page.locator('.photo .img').evaluate((el) => getComputedStyle(el).display)).toBe('block');
  expect(tokens).toEqual([TOKEN]);
});

test('template 2 without a photo keeps the placeholder scene; a photo on template 1 is not drawn', async ({ page }) => {
  await open(page, lobbyFeed({ template: 2 }));
  await expect(page.locator('#cv')).toHaveAttribute('data-photo', '0');
  const page2 = await page.context().newPage();
  await open(page2, lobbyFeed({ template: 1, photo: 'api/v1/notices/display/lobby/photo?v=abc' } as never));
  await expect(page2.locator('#cv')).toHaveAttribute('data-photo', '0');
});
