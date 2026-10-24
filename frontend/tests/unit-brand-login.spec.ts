import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// CR-LOGOS295 (mockup v3.1, owner review 24.10 item 1): the sign-in card shows BOTH logos - the company's on top, the SmplWise logo below;
// SmplWise alone (larger) without a company logo; a failed brand request draws the SmplWise-only layout, never an empty box.
// LOGOFIT-295: the SmplWise logo is inline SVG (data-brand-img="product"), no longer an <img>.
// The element is bundled as it is and run on a mocked same-origin page (no backend).
//   npx playwright test tests/unit-brand-login.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const FILE = 'aaaaaaaaaaaaaaaa.svg';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="#1e2e47"/></svg>';
const LOGO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test.use({ serviceWorkers: 'block' });

let bundled = '';
async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: { contents: "import '../design/boot';\nimport './arx-login';\n", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/arx/"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

async function mount(page: Page, brand: { status: number; body?: unknown }) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/arx/' || url.pathname === '/arx/index.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    if (url.pathname === '/arx/api/v1/brand/public') return route.fulfill({ status: brand.status, contentType: 'application/json', body: JSON.stringify(brand.body ?? {}) });
    if (url.pathname.startsWith('/arx/api/v1/brand/company-logo/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    if (url.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
  });
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle() });
  await page.evaluate(() => document.body.appendChild(document.createElement('arx-login')));
  await page.waitForSelector('arx-login [data-arx-brand]');
}

const rect = (page: Page, sel: string) => page.locator(sel).first().boundingBox();

test('both logos on the sign-in card, the company on top', async ({ page }) => {
  await mount(page, { status: 200, body: { company: { name: 'נווה הירדן', logo: {}, logo_file: { light: FILE, dark: null } }, size: 'm', dark_mode: 'plate' } });
  const company = page.locator('arx-login [data-arx-company-logo] img');
  const product = page.locator('arx-login [data-arx-product-logo] [data-brand-img="product"]');
  await expect(company).toBeVisible();
  await expect(company).toHaveAttribute('alt', 'נווה הירדן');
  await expect(product).toBeVisible();
  const c = await rect(page, 'arx-login [data-arx-company-logo] img');
  const p = await rect(page, 'arx-login [data-arx-product-logo] [data-brand-img="product"]');
  expect(c!.y + c!.height).toBeLessThanOrEqual(p!.y + 1);
  await expect(page.locator('arx-login')).toContainText('SmplWise Arx'); // the name stays as text for a screen reader
});

test('no company logo: the SmplWise logo alone and larger', async ({ page }) => {
  await mount(page, { status: 200, body: { company: { name: '', logo: {}, logo_file: { light: null, dark: null } }, size: 'm', dark_mode: 'plate' } });
  await expect(page.locator('arx-login [data-arx-company-logo] img')).toHaveCount(0);
  const p = await rect(page, 'arx-login [data-arx-product-logo] [data-brand-img="product"]');
  expect(p!.height).toBeGreaterThanOrEqual(60);
});

test('the brand request fails: the SmplWise-only layout, no empty box', async ({ page }) => {
  await mount(page, { status: 500 });
  await expect(page.locator('arx-login [data-arx-company-logo] img')).toHaveCount(0);
  await expect(page.locator('arx-login [data-arx-product-logo] [data-brand-img="product"]')).toBeVisible();
});
