import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Design-review evidence for every skeleton screen (T007 follow-up): one screenshot per screen and
// viewport, plus the no-horizontal-overflow rule. Output: docs/evidence/T007/screens/<sc>-<project>.png
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'T007', 'screens');

const SCREENS: { sc: string; route: string; full?: boolean }[] = [
  { sc: 'sc01-overview', route: '/live', full: true },
  { sc: 'sc07-live-wall', route: '/live/wall' },
  { sc: 'sc08-live-camera', route: '/live/cameras/cam-1' },
  { sc: 'sc09-saved-views', route: '/live/views' },
  { sc: 'sc31-kiosk', route: '/kiosk/all' },
  { sc: 'sc02-sites', route: '/explore/sites' },
  { sc: 'sc03-floors', route: '/explore/buildings/bld-a/floors' },
  { sc: 'sc05-plan-import', route: '/explore/floors/f-2/import' },
  { sc: 'sc06-plan-editor', route: '/explore/floors/f0/edit' },
  { sc: 'sc10-entities', route: '/explore/entities' },
  { sc: 'sc23-access', route: '/explore/access/d1' },
  { sc: 'sc12-playback', route: '/investigate/playback', full: true },
  { sc: 'sc13-sync', route: '/investigate/playback/sync', full: true },
  { sc: 'sc11-history-map', route: '/investigate/floors/f0/history' },
  { sc: 'sc14-events', route: '/investigate/events' },
  { sc: 'sc15-reviews', route: '/investigate/reviews' },
  { sc: 'sc16-cases', route: '/investigate/cases' },
  { sc: 'sc17-case-detail', route: '/investigate/cases/case-1', full: true },
  { sc: 'sc18-exports', route: '/investigate/exports' },
  { sc: 'sc19-search', route: '/investigate/search' },
  { sc: 'sc21-rules', route: '/investigate/rules' },
  { sc: 'sc22-rule-editor', route: '/investigate/rules/r-1', full: true },
  { sc: 'sc24-access', route: '/system/access' },
  { sc: 'sc25-audit', route: '/system/audit' },
  { sc: 'sc26-setup', route: '/system/setup' },
  { sc: 'sc27-devices', route: '/system/devices' },
  { sc: 'sc28-diagnostics', route: '/system/diagnostics', full: true },
  { sc: 'sc20-storage', route: '/system/storage', full: true },
  { sc: 'index', route: '/screens', full: true },
];

async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(300);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('all screen skeletons', () => {
  for (const s of SCREENS) {
    test(s.sc, async ({ page }, testInfo) => {
      await open(page, s.route);
      await page.screenshot({ path: path.join(OUT, `${s.sc}-${testInfo.project.name}.png`), fullPage: !!s.full && testInfo.project.name !== 'mobile' });
      await noHorizontalOverflow(page);
    });
  }

  test('users drawer and assignment preview', async ({ page }, testInfo) => {
    await open(page, '/system/access');
    await page.getByRole('row', { name: /דנה/ }).click();
    await expect(page.getByRole('dialog', { name: 'דנה' })).toBeVisible();
    await page.getByRole('button', { name: 'שיוך תפקיד' }).click();
    // Slotted drawer content is light DOM of <sw-drawer>, not a descendant of the shadow <aside role=dialog>.
    await expect(page.getByText('שום דבר לא נכתב ל־HA')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc24-assign-${testInfo.project.name}.png`) });
  });

  test('events drawer', async ({ page }, testInfo) => {
    await open(page, '/investigate/events');
    await page.getByRole('row', { name: /מסדרון מזרחי/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc14-events-drawer-${testInfo.project.name}.png`) });
  });
});
