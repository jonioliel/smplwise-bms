import { test, expect, type Page } from '@playwright/test';

// MOTIONSETTING-297 (owner 2026-10-27): the motion setting in הגדרות › כללי › מראה המערכת. Demo mode (no backend; "the installation" is
// this browser). Pick a value, save, and read what the page does: <html data-motion>, the duration / press tokens, a reload. Light and
// dark, no page error and no console error. No pixel baselines.
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/smoke-motionsetting-297.spec.ts --project=desktop --project=mobile --workers=1

const TOKENS = ['--sw-t-fast', '--sw-t-med', '--sw-press-scale'];

function listen(page: Page) {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().replace(/\s+/g, ' ').slice(0, 300));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  return { errors, pageErrors };
}

async function open(page: Page, scheme: string, skin = 'classic') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector('system-design', { state: 'attached', timeout: 20_000 });
}

const tokens = (page: Page) =>
  page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    return names.map((n) => cs.getPropertyValue(n).trim());
  }, TOKENS);

async function pick(page: Page, mode: string) {
  const card = page.locator('sw-app system-design');
  await card.locator(`[data-motion-option="${mode}"]`).click();
  await card.locator('[data-design-save]').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', mode);
}

test.describe('MOTIONSETTING-297: ui.motion', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  test('the control is next to the skin picker with the three Hebrew options; auto is the default', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough');
    const { errors, pageErrors } = listen(page);
    for (const scheme of ['light', 'dark']) {
      await open(page, scheme);
      const card = page.locator('sw-app system-design');
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'auto');
      const labels = await card.locator('[data-motion-option]').allTextContents();
      expect(labels.map((s) => s.trim())).toEqual(['אוטומטי', 'מלא', 'מופחת']);
      await expect(card.locator('[data-motion-option="auto"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(card.locator('[data-skin-option="classic"]')).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
    expect(errors.filter((e) => !/Failed to load resource|404|net::/i.test(e))).toEqual([]);
  });

  test('reduced: zero durations and press scale 1 without any OS preference, in every skin, light and dark, and after a reload', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    const { pageErrors } = listen(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, 'light', 'infra');
    expect(await tokens(page)).toEqual(['160ms', '220ms', '0.97']); // the Arx round-2 motion is on
    await pick(page, 'reduced');
    expect(await tokens(page)).toEqual(['0ms', '0ms', '1']);
    for (const scheme of ['dark', 'light']) {
      for (const skin of ['classic', 'infra', 'soft']) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/devices/building`);
        await page.waitForSelector('sw-app');
        await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
        expect(await tokens(page), `${skin}/${scheme}`).toEqual(['0ms', '0ms', '1']);
      }
    }
    expect(pageErrors).toEqual([]);
  });

  test('full ignores the OS reduction and auto follows it', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'light', 'infra');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'auto');
    expect(await tokens(page)).toEqual(['0ms', '0ms', '1']); // auto: the OS reduction, as before this setting existed
    await pick(page, 'full');
    expect(await tokens(page)).toEqual(['160ms', '220ms', '0.97']); // full: the OS reduction does not zero the durations
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    expect(await tokens(page)).toEqual(['160ms', '220ms', '0.97']);
    await pick(page, 'auto');
    expect(await tokens(page)).toEqual(['0ms', '0ms', '1']);
  });
});
