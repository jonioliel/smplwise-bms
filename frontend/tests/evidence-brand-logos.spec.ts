import { test, expect, type Page } from '@playwright/test';
import { settlePage } from './pixel-settle';

// CR-LOGOS295 (mockup v3.1): the logos in the shell strip, the phone home head, the sign-in card, and the Settings card
// (הגדרות › כללי › מראה המערכת › לוגו ושם המערכת). Demo mode (no backend); the company logo files and the upload answers are mocked at the
// network edge, the installation's choices are injected through the cache the shell reads first (`sw.ui.brandlogo`).
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/evidence-brand-logos.spec.ts --workers=1
const LIGHT = 'aaaaaaaaaaaaaaaa.svg';
const DARK = 'bbbbbbbbbbbbbbbb.svg';
const SVG = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="${fill}"/><text x="150" y="62" font-size="40" text-anchor="middle" fill="#fff">NAVE</text></svg>`;

interface Cfg {
  company?: boolean;
  dark?: boolean;
  size?: 's' | 'm' | 'l' | 'xl';
  mode?: 'plate' | 'file' | 'invert';
  name?: string;
  project?: string;
  titleMode?: 'both' | 'dev' | 'project';
}

async function boot(page: Page, hash: string, cfg: Cfg = {}, query = '') {
  const { company = true, dark = false, size = 'm', mode = 'plate', name = 'נווה הירדן', project = 'Tower A', titleMode = 'both' } = cfg;
  await page.route('**/api/v1/brand/company-logo/**', (r) => {
    const url = r.request().url();
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG(url.includes('/dark/') ? '#0f766e' : '#1e2e47') });
  });
  const cache = { company: { name, kind: 'management', logo: {}, logo_file: { light: company ? LIGHT : null, dark: company && dark ? DARK : null } }, size, dark_mode: mode, title: { prefix: 'Smplwise Arx', mode: titleMode }, project: { name: project } };
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, cache);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await settlePage(page);
}

const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  expect(b, sel).not.toBeNull();
  return b!;
};

test.describe('LOGOS-295 placements', () => {
  test('desktop shell: company logo at the inline start, the SmplWise logo at the far left PAST the search; tab title composed', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the strip is desktop / tablet only');
    await boot(page, '/system/diagnostics');
    const strip = page.locator('sw-app [data-brand-strip]');
    await expect(strip).toBeVisible();
    const company = page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img');
    const product = page.locator('sw-app [data-brand-strip] sw-brand[kind="product"] [data-brand-img="product"]');
    await expect(company).toBeVisible();
    await expect(company).toHaveAttribute('alt', 'נווה הירדן');
    await expect(product).toBeVisible();
    const c = await box(page, 'sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img');
    const p = await box(page, 'sw-app [data-brand-strip] sw-brand[kind="product"] [data-brand-img="product"]');
    const search = await box(page, 'sw-app [data-search-open]');
    expect(c.x).toBeGreaterThan(p.x); // RTL: the company logo is on the right (inline start), SmplWise on the far left
    expect(p.x + p.width).toBeLessThanOrEqual(search.x + 1); // "to the left of the search"
    expect(p.height).toBeGreaterThan(28); // enlarged compared with the earlier 24 px mark
    expect(await page.title()).toBe('Smplwise Arx - ⁨נווה הירדן⁩ · ⁨Tower A⁩');
    // the rail carries the SmplWise mark, not the "S" tile
    // LOGOKIT-295: the approved developer-kit artwork (the SW symbol on the rail, the horizontal logo in the strip), not the mint PNG
    await expect(page.locator('sw-app [data-brand-tile] sw-brand [data-brand-img="product"]')).toHaveAttribute('data-brand-art', 'kit-symbol-brand');
    await expect(product).toHaveAttribute('data-brand-art', 'kit-horizontal-brand');
  });

  test('without a company logo the company slot collapses and nothing else moves', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop / tablet');
    await boot(page, '/system/diagnostics', { company: false });
    await expect(page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img')).toHaveCount(0);
    await expect(page.locator('sw-app [data-brand-strip] sw-brand[kind="product"] [data-brand-img="product"]')).toBeVisible();
  });

  test('the size scale multiplies the strip: very large is taller than medium', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop / tablet');
    await boot(page, '/system/diagnostics', { size: 'm' });
    const m = (await box(page, 'sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img')).height;
    await boot(page, '/system/diagnostics', { size: 'xl' });
    const xl = (await box(page, 'sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img')).height;
    expect(xl / m).toBeGreaterThan(1.4);
    expect(xl / m).toBeLessThan(1.6);
  });

  test('dark scheme: plate (default), the dark file in file mode, the chosen invert; a dark surface never shows an empty slot', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop / tablet');
    const treatment = () => page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] [data-brand-treatment]').getAttribute('data-brand-treatment');
    const variant = () => page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img').getAttribute('data-brand-variant');
    await boot(page, '/system/diagnostics', { mode: 'plate', dark: true }, '&scheme=dark');
    expect(await treatment()).toBe('plate');
    await boot(page, '/system/diagnostics', { mode: 'file', dark: true }, '&scheme=dark');
    expect(await treatment()).toBe('plain');
    expect(await variant()).toBe('dark');
    await boot(page, '/system/diagnostics', { mode: 'file', dark: false }, '&scheme=dark'); // no dark file: falls back to the plate
    expect(await treatment()).toBe('plate');
    await boot(page, '/system/diagnostics', { mode: 'invert' }, '&scheme=dark');
    expect(await treatment()).toBe('invert');
    await boot(page, '/system/diagnostics', { mode: 'invert' }); // light scheme: never a plate or a filter
    expect(await treatment()).toBe('plain');
  });

  test('phone: no strip on an inner screen; the home screen head carries the company logo and the SmplWise logo', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await boot(page, '/system/diagnostics');
    await expect(page.locator('sw-app [data-brand-strip]')).toHaveCount(0);
    await expect(page.locator('sw-app [data-home-brand]')).toHaveCount(0);
    await boot(page, '/devices');
    const head = page.locator('sw-app [data-home-brand]');
    await expect(head).toBeVisible();
    await expect(head.locator('sw-brand[kind="company"] img')).toBeVisible();
    await expect(head.locator('sw-brand[kind="product"] [data-brand-img="product"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('LOGOS-295 settings card', () => {
  const card = (p: Page) => p.locator('sw-app system-brand-logos');

  test('opens on "size and dark background"; no tab scrolls; size and dark mode are drafts until saved; the title demo follows the names', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await boot(page, '/system/diagnostics', { company: true, dark: false });
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator('[data-logo-panel="look"]')).toBeVisible(); // the landing of mockup v3.1
    await expect(card(page).locator('[data-logo-panel="files"]')).toBeHidden();
    // every tab fits: nothing inside the card scrolls
    for (const tab of ['files', 'look', 'title']) {
      await card(page).locator(`[data-logo-tab="${tab}"]`).click();
      const overflow = await card(page).evaluate((el, id) => {
        const panel = el.shadowRoot!.querySelector(`[data-logo-panel="${id}"]`) as HTMLElement;
        return { y: panel.scrollHeight - panel.clientHeight, x: panel.scrollWidth - panel.clientWidth, card: el.scrollWidth - el.clientWidth };
      }, tab);
      expect(overflow.y, tab).toBeLessThanOrEqual(1);
      expect(overflow.x, tab).toBeLessThanOrEqual(1);
      expect(overflow.card, tab).toBeLessThanOrEqual(1);
    }
    await card(page).locator('[data-logo-tab="look"]').click();
    await expect(card(page).locator('[data-logo-save]')).toHaveAttribute('disabled', '');
    await card(page).locator('[data-size="xl"]').click();
    await card(page).locator('[data-dark-mode="invert"]').click();
    await expect(card(page).locator('[data-size="xl"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page).locator('[data-dark-mode="invert"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page).locator('[data-logo-size-px]')).toContainText('54px');
    await expect(card(page).locator('[data-logo-save]')).not.toHaveAttribute('disabled', '');
    // a draft: the shell strip has not changed yet
    // LOGOFIT-295: the logos sit in the corner's row (no strip height any more): the company logo is 34 px at the medium size; the phone has no strip
    const coH = () => page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img').first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
    if (info.project.name !== 'mobile') expect(await coH()).toBe(34);
    await card(page).locator('[data-logo-save]').click();
    await expect(card(page).locator('[data-logo-message]')).toBeVisible();
    if (info.project.name !== 'mobile') await expect.poll(coH).toBe(51); // 34 x 1.5
    // names and the title
    await card(page).locator('[data-logo-tab="title"]').click();
    await card(page).locator('[data-brand-name]').fill('חברת ניהול');
    await card(page).locator('[data-brand-project]').fill('Beach');
    await expect(card(page).locator('[data-logo-panel="title"] [data-brand-title]')).toHaveText('Smplwise Arx - ⁨חברת ניהול⁩ · ⁨Beach⁩');
    await card(page).locator('[data-title-mode="project"]').click();
    await expect(card(page).locator('[data-logo-panel="title"] [data-brand-title]')).toHaveText('Smplwise Arx - ⁨Beach⁩');
    await card(page).locator('[data-logo-save]').click();
    await expect.poll(() => page.title()).toBe('Smplwise Arx - ⁨Beach⁩');
  });

  test('upload: the answer shows the preview and the warning; a refusal shows the server message and keeps the card usable', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await boot(page, '/system/diagnostics', { company: false });
    let mode: 'ok' | 'bad' = 'bad';
    await page.route('**/api/v1/brand/company-logo/light', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      if (mode === 'bad') return r.fulfill({ status: 415, contentType: 'application/json', body: JSON.stringify({ code: 'unsupported_format', user_message: 'אפשר להעלות PNG, SVG, WebP או JPEG', retryable: false, correlation_id: 'x', details: {} }) });
      return r.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ stamp: 'cccccccccccccccc', warnings: [{ code: 'odd_aspect', message: 'יחס התמונה חריג - מומלץ לוגו רוחבי' }], view: { company: { name: 'נווה', kind: 'developer', logo: {}, logo_file: { light: 'cccccccccccccccc.svg', dark: null } }, size: 'm', dark_mode: 'plate' },
          files: { light: { stamp: 'cccccccccccccccc', mime: 'image/svg+xml', width: 300, height: 100, bytes: 2048, uploaded_by: 'joni', uploaded_at: '2026-10-24T00:00:00Z' }, dark: null } }),
      });
    });
    await card(page).locator('[data-logo-tab="files"]').click();
    const input = card(page).locator('input[data-file="light"]');
    await input.setInputFiles({ name: 'bad.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(card(page).locator('[data-logo-error]')).toContainText('PNG, SVG, WebP או JPEG');
    mode = 'ok';
    await input.setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG('#1e2e47')) });
    await expect(card(page).locator('[data-logo-preview="light"] img')).toBeVisible();
    await expect(card(page).locator('[data-logo-warning]')).toContainText('יחס התמונה חריג');
    await expect(card(page).locator('[data-logo-replace="light"]')).toBeVisible();
    await expect(card(page).locator('[data-logo-remove="light"]')).toBeVisible();
    // the shell strip shows it at once (LOGOFIT-295: the corner's logos hide while the page is scrolled - back to the top first)
    await page.evaluate(() => {
      const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main');
      if (main) main.scrollTop = 0;
    });
    if (info.project.name !== 'mobile') await expect(page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="company"] img')).toBeVisible();
  });

  test('"file" without a dark file warns and offers the upload tab', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await boot(page, '/system/diagnostics', { company: true, dark: false });
    await card(page).locator('[data-dark-mode="file"]').click();
    await expect(card(page).locator('[data-logo-nodark]')).toBeVisible();
    await card(page).locator('[data-logo-nodark] sw-button').click();
    await expect(card(page).locator('[data-logo-panel="files"]')).toBeVisible();
  });
});
