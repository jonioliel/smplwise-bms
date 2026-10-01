import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Design foundation (owner 2026-10-01): one shared structure, skins = tokens + a bounded rule set, light / dark for the whole shell.
//   1. `classic` (the default, today's look) is pixel-stable: toHaveScreenshot against the baselines captured from the build
//      BEFORE the foundation (tests/evidence-design-foundation.spec.ts-snapshots/), 0 differing pixels allowed.
//   2. the evidence matrix: skin (classic | domus | tesla) x scheme (light | dark) on four key screens (home with the building tree
//      screen with its tree panel, a settings screen, a dialog) at 1440 and 390 -> docs/design/evidence/design-foundation/.
// Demo mode (no backend). `?skin=` / `?scheme=` are the session override the app reads (design/skin.ts); nothing is stored.
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/evidence-design-foundation.spec.ts --workers=1 --project=desktop --project=mobile
//   SW_SHOTS_OFF=1 skips the evidence matrix (only the classic baseline check runs).
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/design-foundation');

const SKINS = ['classic', 'domus', 'tesla'] as const;
const SCHEMES = ['light', 'dark'] as const;

const SCREENS = [
  { id: 'home', hash: '/devices' },
  { id: 'map', hash: '/explore/floors/f0' },
  { id: 'settings', hash: '/system/diagnostics' },
] as const;

async function open(page: Page, hash: string, query = '') {
  await page.clock.setFixedTime(new Date('2026-10-01T13:00:00Z')); // the home clock and the weather strip must not move between runs
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

/** A representative dialog: heading, a field, the footer buttons (what every confirmation looks like). */
async function openDialog(page: Page) {
  await page.evaluate(() => {
    const d = document.createElement('sw-dialog') as HTMLElement & { open: boolean; heading: string };
    d.heading = 'לכבות 3 מסכים בקומת קרקע?';
    d.setAttribute('data-evidence-dialog', '');
    d.innerHTML =
      '<p style="margin:0 0 10px">הפעולה תכבה את המסכים שדולקים כרגע. מסכים שכבר כבויים לא נספרים.</p>' +
      '<sw-field label="הערה"><input value="בדיקת עיצוב" /></sw-field>' +
      '<sw-button slot="footer" variant="ghost">ביטול</sw-button><sw-button slot="footer" variant="primary">כבה</sw-button>';
    document.body.appendChild(d);
    d.open = true;
  });
  await page.waitForTimeout(400);
}

const view = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

test.describe('design foundation', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const s of SCREENS) {
    test(`classic is pixel-stable: ${s.id}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'two widths are enough for the regression check');
      await open(page, s.hash);
      await expect(page).toHaveScreenshot(`classic-${s.id}-${view(info)}.png`, { maxDiffPixels: 0, animations: 'disabled', fullPage: false });
    });
  }

  test('classic is pixel-stable: dialog', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'two widths are enough for the regression check');
    await open(page, '/devices');
    await openDialog(page);
    await expect(page).toHaveScreenshot(`classic-dialog-${view(info)}.png`, { maxDiffPixels: 0, animations: 'disabled' });
  });

  test.describe('evidence matrix', () => {
    test.skip(!!process.env.SW_SHOTS_OFF, 'SW_SHOTS_OFF=1');
    for (const skin of SKINS) {
      for (const scheme of SCHEMES) {
        test(`${skin} ${scheme}`, async ({ page }, info) => {
          test.skip(info.project.name === 'tablet', 'two widths are enough');
          fs.mkdirSync(EVIDENCE, { recursive: true });
          const q = `&skin=${skin}&scheme=${scheme}`;
          for (const s of SCREENS) {
            await open(page, s.hash, q);
            if (skin !== 'classic' || scheme === 'dark') {
              await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
              await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
            }
            await page.screenshot({ path: path.join(EVIDENCE, `${skin}-${scheme}-${s.id}-${view(info)}.png`) });
          }
          await open(page, '/devices', q);
          await openDialog(page);
          await page.screenshot({ path: path.join(EVIDENCE, `${skin}-${scheme}-dialog-${view(info)}.png`) });
        });
      }
    }
  });
});
