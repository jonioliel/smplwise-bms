import { test, expect, type Page } from '@playwright/test';
import { settlePage } from './pixel-settle';

// WHITELABEL097-295: the installer branding in the shell strip and the Settings card (הגדרות › כללי › מראה המערכת › מיתוג מתקין). Demo mode
// (no backend); the installer logo file is mocked at the network edge, the installation's choice is injected through the cache the shell reads
// first (`sw.ui.brandlogo`).
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/evidence-white-label.spec.ts --workers=1
const INST = 'dddddddddddddddd.svg';
const SVG = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" rx="14" fill="${fill}"/><text x="150" y="62" font-size="40" text-anchor="middle" fill="#fff">INST</text></svg>`;

async function boot(page: Page, installer: Record<string, unknown> | null) {
  await page.route('**/api/v1/brand/white-label/logo/**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG('#7c3aed') }) : r.fallback()));
  const cache = { company: { name: '', kind: 'developer', logo: {}, logo_file: { light: null, dark: null } }, size: 'm', dark_mode: 'plate', title: { prefix: 'Smplwise Arx', mode: 'both' }, project: { name: '' }, ...(installer ? { installer } : {}) };
  await page.addInitScript((c) => {
    try {
      // a boot is a fresh visitor: the colour cache of the previous boot in the same context (`sw.ui.brand`, written when the installer accent applied) must not leak into the next one
      localStorage.removeItem('sw.ui.brand');
      localStorage.setItem('sw.ui.brandlogo', JSON.stringify(c));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, cache);
  await page.goto('about:blank');
  await page.goto('/?design=a&look=performance:full#/system/diagnostics');
  await page.waitForSelector('sw-app');
  await settlePage(page);
}

const card = (p: Page) => p.locator('sw-app system-brand-installer');

test.describe('WHITELABEL-097 shell strip', () => {
  test('ON: the installer logo sits in the strip beside the company slot, SmplWise stays; OFF: nothing', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the strip is desktop / tablet only');
    await boot(page, { enabled: true, name: 'מתקין', contact: '03-1234567', accent: 'default', logo_file: { light: INST, dark: null } });
    const logo = page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="installer"] img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', 'מתקין');
    await expect(page.locator('sw-app [data-brand-strip] sw-brand[kind="product"] [data-brand-img="product"]')).toBeVisible();
    await boot(page, { enabled: false });
    await expect(page.locator('sw-app :is([data-brand-strip], [data-lead-brand]) sw-brand[kind="installer"] img')).toHaveCount(0);
    await expect(page.locator('sw-app [data-brand-strip] sw-brand[kind="product"] [data-brand-img="product"]')).toBeVisible();
  });

  test('ON with a preset accent: the installation accent token follows it', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    await boot(page, { enabled: true, name: 'מתקין', accent: 'orange', logo_file: { light: null, dark: null } });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-accent').trim().toLowerCase())).toBe('#ea580c');
    await boot(page, { enabled: false, accent: 'orange' });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-accent').trim().toLowerCase())).not.toBe('#ea580c');
  });
});

test.describe('WHITELABEL-097 settings card', () => {
  test('default OFF; no tab scrolls; the draft saves and the logo tab says the server is needed in demo mode', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    await boot(page, null);
    await expect(card(page)).toBeVisible();
    await expect(card(page).locator('[data-wl-state]')).toHaveText('כבוי');
    await expect(card(page).locator('[data-wl-enabled]')).toHaveAttribute('aria-checked', 'false');
    await expect(card(page).locator('[data-wl-save]')).toHaveAttribute('disabled', '');
    for (const tab of ['profile', 'logos', 'pack']) {
      await card(page).locator(`[data-wl-tab="${tab}"]`).click();
      const overflow = await card(page).evaluate((el, id) => {
        const panel = el.shadowRoot!.querySelector(`[data-wl-panel="${id}"]`) as HTMLElement;
        return { y: panel.scrollHeight - panel.clientHeight, x: panel.scrollWidth - panel.clientWidth, card: el.scrollWidth - el.clientWidth };
      }, tab);
      expect(overflow.y, tab).toBeLessThanOrEqual(1);
      expect(overflow.x, tab).toBeLessThanOrEqual(1);
      expect(overflow.card, tab).toBeLessThanOrEqual(1);
    }
    await expect(card(page).locator('[data-wl-panel="pack"] [data-wl-export]')).toHaveAttribute('disabled', '');
    await card(page).locator('[data-wl-tab="logos"]').click();
    await expect(card(page).locator('[data-wl-needserver]').first()).toBeVisible();
    await card(page).locator('[data-wl-tab="profile"]').click();
    await card(page).locator('[data-wl-name]').fill('מתקין בע"מ');
    await card(page).locator('[data-wl-contact]').fill('03-1234567');
    await card(page).locator('[data-accent="teal"]').click();
    await card(page).locator('[data-wl-enabled]').click();
    await expect(card(page).locator('[data-wl-state]')).toHaveText('פעיל');
    await expect(card(page).locator('[data-wl-save]')).not.toHaveAttribute('disabled', '');
    await card(page).locator('[data-wl-save]').click();
    await expect(card(page).locator('[data-wl-message]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sw.ui.brandlogo') ?? '{}').installer?.enabled)).toBe(true);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-accent').trim().toLowerCase())).toBe('#0d9488');
  });

  test('the free-colour field does not exist: the accent is a preset or none', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    await boot(page, null);
    await expect(card(page).locator('[data-wl-accent] input')).toHaveCount(0);
    await expect(card(page).locator('[data-wl-accent] button')).toHaveCount(8); // none + 7 presets
  });
});
