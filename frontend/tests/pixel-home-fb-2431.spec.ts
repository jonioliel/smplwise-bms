import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockP2, type P2Opts } from './home-v3-p2-mocks';

// HOME-V3-FOLLOWUP-B-2431 pixel baselines: the two home sheets this branch changed - the wall panel's "new event" sheet (now offered on a
// wall panel locked to its room) and the new-ticket sheet with attached photos (the mockup's "צרף תמונה") - desktop 1440 and phone 390,
// light and dark, against the mocked backend with no list data behind the sheet and a fixed clock. Baselines are per OS: the Linux ones
// are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   private/runner/run_smart.py preview <branch> tests/pixel-home-fb-2431.spec.ts --project=desktop --project=mobile -u --workers=1

const NOW = new Date('2026-11-03T10:00:00+02:00');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGklEQVR42mP8sMWGAQb0bvTA2UwMOMDglAAAntADghJ4On4AAAAASUVORK5CYII=', 'base64');
const home = (page: Page) => page.locator('sw-home');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, route: string, o: P2Opts, scheme: 'light' | 'dark') {
  await mockP2(page, { empty: true, ...o });
  // the scheme comes from the person's own layout (sw-home applyLayout re-applies it on every render)
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }) : r.fallback()));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await expect(home(page)).toHaveAttribute('data-hs-scheme', scheme);
  await settle(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, sel: string, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(home(page).locator(sel)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel-stable: home follow-up B (wall event, ticket photos)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`wall panel new event ${scheme}`, async ({ page }, info) => {
      await open(page, 'calendar', { kiosk: true }, scheme);
      await home(page).locator('[data-act="p2CalNew"]').click();
      await home(page).locator('[data-sheet="calNew"] input.inp').fill('ארוחת ערב משפחתית');
      await compare(page, info, '[data-sheet="calNew"]', `home-fb-wall-event-${scheme}`);
    });

    test(`new ticket with photos ${scheme}`, async ({ page }, info) => {
      await open(page, 'tickets', {}, scheme);
      await home(page).locator('[data-act="p2TkNew"]').click();
      const sheet = home(page).locator('[data-sheet="tkNew"]');
      await sheet.locator('.tkpick input[type="file"]').setInputFiles([1, 2].map((i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: PNG })));
      await expect(sheet.locator('.tkph .ph')).toHaveCount(2);
      await sheet.locator('input.inp').first().fill('מטבח');
      await compare(page, info, '[data-sheet="tkNew"]', `home-fb-ticket-photos-${scheme}`);
    });
  }
});
