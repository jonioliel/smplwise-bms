import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';

// CRY (2026-10-10): the Crystal skin with its built-in day / night artwork - the evidence matrix (light | dark) x (home with the
// building tree, an area, security live, schedules, settings with the background card) at 1440 and 390, demo mode, fixed clock,
// into docs/design/evidence/cry/. `?skin=crystal&scheme=` and `?bg=` are the page-view overrides design/apply.ts and
// design/background.ts read; nothing is stored.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-cry.spec.ts --workers=1 --project=desktop --project=mobile
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cry');
const SCHEMES = ['light', 'dark'] as const;
const SCREENS = [
  { id: 'home', hash: '/devices/building' },
  { id: 'devices', hash: '/devices/areas/living' },
  { id: 'security', hash: '/live' },
  { id: 'schedules', hash: '/devices/schedules' },
  { id: 'settings', hash: '/system/diagnostics' },
] as const;

async function open(page: Page, hash: string, scheme: 'light' | 'dark', query = '') {
  await page.clock.setFixedTime(new Date('2026-10-10T13:00:00Z'));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=crystal&scheme=${scheme}&look=performance:full${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await settlePage(page);
}

const view = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

test.describe('crystal skin evidence', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeAll(() => fs.mkdirSync(EVIDENCE, { recursive: true }));

  for (const scheme of SCHEMES) {
    for (const s of SCREENS) {
      test(`${s.id} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'two widths are enough');
        await open(page, s.hash, scheme);
        // the artwork of the scheme is on the page: day under light, night under dark
        const img = await page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-bg-image'));
        expect(img).toContain(scheme === 'dark' ? 'crystal-night.webp' : 'crystal-day.webp');
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-skin'))).toBe('crystal');
        await page.screenshot({ path: path.join(EVIDENCE, `${s.id}-crystal-${scheme}-${view(info)}.png`), fullPage: false, animations: 'disabled' });
      });
    }
  }

  test('the background setting: none paints nothing, the settings card shows the three choices and the personal override', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the logic runs once');
    await open(page, '/devices/building', 'light', '&bg=none');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-bg-image'))).toBe('none');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-bg'))).toBe('none');
    await page.screenshot({ path: path.join(EVIDENCE, 'home-crystal-light-none-1440.png'), fullPage: false, animations: 'disabled' });
    await open(page, '/system/diagnostics', 'light');
    const card = page.locator('system-design');
    await expect(card.locator('[data-bg-option="builtin"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-bg-option]')).toHaveCount(3);
    await expect(card.locator('[data-own-bg]')).toHaveCount(4);
    // the custom choice opens the two slots (demo: uploads are server-only)
    await card.locator('[data-bg-option="custom"]').click();
    await expect(card.locator('[data-bg-slot]')).toHaveCount(2);
    await card.locator('[data-design-card]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(EVIDENCE, 'settings-background-custom-1440.png'), fullPage: false, animations: 'disabled' });
    // the personal override applies at once (demo: this browser only)
    await card.locator('[data-own-bg="none"]').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-bg'))).toBe('none');
    await card.locator('[data-own-bg="system"]').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-bg'))).toBe('builtin');
  });
});
