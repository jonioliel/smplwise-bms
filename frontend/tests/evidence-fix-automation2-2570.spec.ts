import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { appReady } from './helpers/app-ready';
import { settle } from './helpers/settle';

// FIX-AUTOMATION2-2570: after copying an automation (now written switched off, CD2-04) the toast offers "turn on now", which takes the list
// switch's own enable path. Demo mode (api/automations-mock.ts), installer, 1440 and 390, light and dark. Pictures for the compare page go to
// FA2_SHOTS (default: test-results/fa2-2570); the desktop project only.
//   SW_BASE_URL=http://127.0.0.1:4711/ npx playwright test tests/evidence-fix-automation2-2570.spec.ts --project=desktop --workers=1

const OUT = process.env.FA2_SHOTS || path.resolve('test-results/fa2-2570');
const SIZES = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const;
const scr = (page: Page) => page.locator('sw-app devices-automations');
const drawer = (page: Page) => scr(page).locator('automation-drawer');

async function open(page: Page, hash: string, size: keyof typeof SIZES, scheme: 'light' | 'dark') {
  await page.setViewportSize(SIZES[size]);
  await page.emulateMedia({ colorScheme: scheme });
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify(c));
      localStorage.setItem('sw.automations.view', 'cards');
    } catch {
      /* storage unavailable */
    }
  }, { scheme });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off#${hash}`);
  await appReady(page);
}

async function copyHall(page: Page) {
  const d = drawer(page);
  await d.locator('[data-drawer-copy]').click();
  await d.locator('[data-dialog="copy"] [data-dialog-ok]').click();
  await expect(scr(page).locator('[data-auto-note]')).toContainText('שוכפל');
}

test.describe('copy of an automation: "turn on now"', () => {
  for (const size of ['1440', '390'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`the toast after a copy (${size}, ${scheme})`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'desktop project only (it sets its own sizes)');
        await open(page, '/devices/automations/1727700000002', size, scheme);
        await copyHall(page);
        await settle(page);
        fs.mkdirSync(OUT, { recursive: true });
        await page.screenshot({ path: path.join(OUT, `copy-toast-${size}-${scheme}.png`) });
        const note = scr(page).locator('[data-auto-note]');
        await expect(note).toContainText('העותק כבוי עד שתפעילו אותו');
        await expect(note.locator('[data-note-action]')).toHaveText('הפעל עכשיו');
      });
    }
  }

  test('"turn on now" switches the copy on through the enable path', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project only (it sets its own sizes)');
    await open(page, '/devices/automations/1727700000002', '1440', 'light');
    await copyHall(page);
    await scr(page).locator('[data-auto-note] [data-note-action]').click();
    await expect(scr(page).locator('[data-auto-note]')).toHaveCount(0); // no error toast: the enable went through
    // the copy (its name ends with "(עותק)") is on in the list now (an in-app address change: the demo store keeps its state)
    await page.evaluate(() => { location.hash = '#/devices/automations?q=' + encodeURIComponent('(עותק)'); });
    const copyCard = scr(page).locator('automation-card', { hasText: '(עותק)' });
    await expect(copyCard).toHaveCount(1);
    await expect(copyCard.locator('[data-card-toggle] [role="switch"]')).toHaveAttribute('aria-checked', 'true');
  });
});
