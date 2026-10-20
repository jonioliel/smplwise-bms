import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url, type GenMockOptions } from './generator-mocks';

// GENALERT-295 evidence: Settings > Infrastructure > Generator > alert routing against the mock layer (fake data): the first-run "nobody is set" state,
// the default recipients per severity, the critical row note and the critical / non-critical editors. Desktop 1440 / tablet 1024 / mobile 390, light and dark.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test -c playwright.config.ts tests/evidence-genalert.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/genalert');
const R = 'sw-app gen-routing';
const ROUTING = '/system/infra/generator/routing';

test.describe('genalert evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }) => void (await page.emulateMedia({ reducedMotion: 'reduce' })));

  async function open(page: Page, opts: GenMockOptions = {}, scheme: 'light' | 'dark' = 'light') {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const mock = await installGeneratorMock(page, opts);
    await page.goto('about:blank');
    await page.goto(url(ROUTING, 'classic', scheme));
    await page.waitForSelector(`${R} [data-gen-routing]`, { timeout: 20_000 });
    return mock;
  }
  async function shoot(page: Page, name: string, scheme: 'light' | 'dark' = 'light') {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`) });
  }

  test('first run, severity defaults, critical and non-critical editors', async ({ page }) => {
    const phone = (page.viewportSize()?.width ?? 1440) < 900;
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, { level: 'typical' }, scheme);
      await expect(page.locator(`${R} [data-routing-empty]`)).toBeVisible();
      await expect(page.locator(`${R} [data-severity-defaults] [data-critical-note]`)).toHaveCount(1);
      expect(await page.locator(`${R} [data-gen-routing]`).innerText()).not.toMatch(/Home Assistant|Ingress/i);
      await shoot(page, 'routing-first-run', scheme);
    }
    await open(page, { level: 'typical' });
    // the critical default: roles, a channel, the delay
    await page.locator(`${R} [data-severity-row="critical"]`).click();
    await page.waitForSelector(`${R} [data-drawer="severity"] [data-critical-delay]`);
    await page.locator(`${R} [data-drawer="severity"] [data-roles] label`).first().click();
    await page.locator(`${R} [data-drawer="severity"] [data-channels] label`).nth(1).click();
    await shoot(page, 'routing-critical-default-editor');
    await page.locator(`${R} [data-save-severity]`).click();
    await expect(page.locator(`${R} [data-drawer="severity"] [data-critical-delay]`)).toHaveCount(0);
    await expect(page.locator(`${R} [data-routing-empty]`)).toHaveCount(0); // somebody is set now: the first-run state is gone
    await page.locator(`${R} [data-severity-row="alert"]`).click();
    await page.waitForSelector(`${R} [data-drawer="severity"] [data-roles]`);
    await page.locator(`${R} [data-drawer="severity"] [data-roles] label`).nth(1).click();
    await page.locator(`${R} [data-save-severity]`).click();
    await expect(page.locator(`${R} [data-routing-empty]`)).toHaveCount(0);
    await shoot(page, 'routing-configured');
    // a critical type: escalation is a note, quiet hours are a note; a non-critical type has the choices
    await page.locator(`${R} [data-type="fail_to_start"] >> visible=true`).first().click({ force: true });
    await page.waitForSelector(`${R} [data-escalate-critical]`);
    await expect(page.locator(`${R} [data-quiet-critical]`)).toBeVisible();
    await expect(page.locator(`${R} [data-escalate]`)).toHaveCount(0);
    await shoot(page, 'routing-critical-type-editor');
    await page.keyboard.press('Escape');
    if (!phone) {
      await page.locator(`${R} [data-type="battery_low"] >> visible=true`).first().click({ force: true });
      await page.waitForSelector(`${R} [data-escalate]`);
      await page.locator(`${R} [data-escalate]`).check();
      await expect(page.locator(`${R} [data-escalate-min]`)).toBeVisible();
      await expect(page.locator(`${R} [data-quiet] button`)).toHaveCount(3);
      await shoot(page, 'routing-alert-type-editor');
    }
  });
});
