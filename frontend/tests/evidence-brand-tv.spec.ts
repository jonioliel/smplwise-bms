import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, settled, tvUrl } from './notice-tv-fixtures';

// CR-LOGOS295 P7: the notice-board TV page draws the installation's company logo and the SmplWise logo - the light file by day, the
// administrator's dark-background choice at night (plate / dark file / invert), the size scale, the take-over screen - and keeps the
// header slot (no shift) without a logo. Mocked feed and logo files; desktop Chromium.
//   npx playwright test tests/evidence-brand-tv.spec.ts --project=desktop
test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'the TV page is checked on desktop Chromium'));

const SVG = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="${fill}"/></svg>`;

type Brand = { size: 's' | 'm' | 'l' | 'xl'; dark_mode: 'plate' | 'file' | 'invert'; name: string };

async function open(page: Page, q: string, opts: { light?: boolean; dark?: boolean; brand?: Partial<Brand>; urgent?: boolean }) {
  const { light = true, dark = false, brand = {}, urgent = false } = opts;
  const feed = lobbyFeed(urgent ? { urgent: 'full' } : {});
  if (!urgent) feed.notices = feed.notices.filter((n) => n.severity !== 'critical');
  const logos: Record<string, string> = {};
  if (light) logos.company = 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa';
  if (dark) logos.company_dark = 'api/v1/notices/display/lobby/logo/company?variant=dark&v=bbbbbbbbbbbbbbbb';
  feed.board.logos = logos;
  if (light || dark) feed.board.brand = { size: 'm', dark_mode: 'plate', name: 'נווה הירדן', ...brand };
  await serveFeed(page, feed);
  const seen: string[] = [];
  await page.route('**/api/v1/notices/display/lobby/logo/company**', async (route) => {
    const u = route.request().url();
    seen.push(u.includes('variant=dark') ? 'dark' : 'light');
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG(u.includes('variant=dark') ? '#0f766e' : '#1e2e47') });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(tvUrl(q));
  await settled(page);
  return seen;
}

const co = (p: Page) => p.locator('#cv .pg .hd .lg.company');
const tr = (p: Page) => co(p).getAttribute('data-tr');

test('day: the light file as uploaded, no plate; the SmplWise logo is a picture in the footer', async ({ page }) => {
  await open(page, 'theme=day', { dark: true });
  await expect(co(page).locator('img')).toHaveAttribute('alt', 'נווה הירדן');
  expect(await tr(page)).toBe('plain');
  await expect(page.locator('#cv .pg .ft .lg.product img')).toBeVisible();
  expect(await page.locator('#cv .pg .ft .lg.product img').evaluate((i: HTMLImageElement) => i.src.startsWith('data:image/png'))).toBe(true);
});

test('night x mode x dark file: plate (default), the dark file in file mode, the chosen invert, plate fallback without a dark file', async ({ page }) => {
  await open(page, 'theme=night', { brand: { dark_mode: 'plate' }, dark: true });
  expect(await tr(page)).toBe('plate');
  await open(page, 'theme=night', { brand: { dark_mode: 'file' }, dark: true });
  expect(await tr(page)).toBe('plain');
  await open(page, 'theme=night', { brand: { dark_mode: 'file' }, dark: false });
  expect(await tr(page)).toBe('plate');
  await open(page, 'theme=night', { brand: { dark_mode: 'invert' } });
  expect(await tr(page)).toBe('invert');
  const filter = await co(page).locator('img').evaluate((i) => getComputedStyle(i).filter);
  expect(filter).toContain('invert');
});

test('the dark file is fetched only when there is one; the light one is always fetched', async ({ page }) => {
  const seen = await open(page, 'theme=night', { dark: false });
  expect(new Set(seen)).toEqual(new Set(['light']));
});

test('the size scale multiplies both logos', async ({ page }) => {
  await open(page, 'theme=day', { brand: { size: 'm' } });
  const m = (await co(page).boundingBox())!.height;
  const mp = (await page.locator('#cv .pg .ft .lg.product').boundingBox())!.height;
  await open(page, 'theme=day', { brand: { size: 'xl' } });
  const xl = (await co(page).boundingBox())!.height;
  const xp = (await page.locator('#cv .pg .ft .lg.product').boundingBox())!.height;
  expect(xl / m).toBeCloseTo(1.5, 1);
  expect(xp / mp).toBeCloseTo(1.5, 1);
});

test('without a company logo the header slot keeps its place and nothing shows', async ({ page }) => {
  await open(page, 'theme=day', { light: false });
  expect(await tr(page)).toBeNull();
  await expect(co(page).locator('img')).toHaveCount(0);
  await expect(page.locator('#cv .pg .ft .lg.product img')).toBeVisible(); // the SmplWise logo stays
});

test('the take-over screen carries both logos on its own (always dark) surface', async ({ page }) => {
  await open(page, 'theme=day', { urgent: true, brand: { dark_mode: 'plate' } });
  const top = page.locator('#cv .take .top .lg.company');
  await expect(top.locator('img')).toBeVisible();
  await expect(page.locator('#cv .take .bot .lg.product img')).toBeVisible();
});
