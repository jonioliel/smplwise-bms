import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installBoardMock, type BoardMock } from './tickets-board-mocks';

// MGRDASH phase 5 evidence (DASH45-290): the alerts' two rows in Settings > the module > display > "סקירת מנהל" - the morning summary's
// hour and the busy-department threshold - against the board's mock layer (invented data). Desktop 1440 and phone 390, light and dark.
// Asserts: the defaults (08:00, 10), a change is saved through PUT /tickets/settings with the document revision, a bad threshold says
// so and saves nothing, no horizontal scroll. Writes screenshots to docs/design/evidence/dash5.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-overview-p5.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/dash5');
const S = 'sw-app system-tickets';

async function go(page: Page, scheme: 'light' | 'dark' = 'light'): Promise<BoardMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installBoardMock(page, { persona: 'admin' });
  await page.goto('about:blank');
  await page.goto(url('/system/tickets?tab=display', 'classic', scheme));
  await page.waitForSelector(`${S} [data-digest-hour]`);
  return mock;
}

test.describe('manager overview alerts settings evidence (MGRDASH phase 5)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the morning summary hour and the busy-department threshold - light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, scheme);
      const card = page.locator(`${S} [data-card="display-overview"]`);
      await card.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await card.screenshot({ path: path.join(OUT, `settings-overview-alerts-${test.info().project.name}-${scheme}.png`) });
    }
    await expect(page.locator(`${S} [data-digest-hour]`)).toHaveValue('8');
    await expect(page.locator(`${S} [data-dept-stuck]`)).toHaveValue('10');
  });

  test('a change is saved with the revision; a bad threshold saves nothing', async ({ page }) => {
    const mock = await go(page);
    await page.locator(`${S} [data-digest-hour]`).selectOption('7');
    await expect.poll(() => mock.calls.find((c) => c.method === 'PUT' && c.path === 'tickets/settings')?.body).toEqual({ revision: 1, ui: { dash_digest_hour: 7 } });
    const stuck = page.locator(`${S} [data-dept-stuck]`);
    await stuck.fill('0');
    await stuck.press('Tab');
    await expect(page.locator(`${S} [data-dept-stuck-error]`)).toBeVisible();
    expect(mock.calls.filter((c) => c.method === 'PUT').length).toBe(1);
    await stuck.fill('15');
    await stuck.press('Tab');
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT').at(-1)?.body).toEqual({ revision: 2, ui: { dash_dept_stuck: 15 } });
    await expect(page.locator(`${S} [data-dept-stuck-error]`)).toHaveCount(0);
  });
});
