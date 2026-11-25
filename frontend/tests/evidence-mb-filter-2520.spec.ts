import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { A, B, RES, appOverflow, homeOf, homeOverflow, openHomeList, openResident } from './mb-filter-2520-mocks';

// MULTI-BUILDING-FILTER-2520 (2.52, T119 MB-HOME-IFACE step 7): the building filter of the home interface's notice board and shared rooms,
// and of the resident's phone calendar, against the REAL build with the mock layer (tests/mb-filter-2520-mocks.ts: an invented site).
// "before" = the answers of a site whose switch / filter setting is off (the answers of the previous version: nothing new is drawn);
// "after" = the same lists with the server's `building_filter`. Every screen: no page scroll, no sideways overflow.
//   SW_BASE_URL=http://127.0.0.1:<port>/ SW_SHOTS=<dir> npx playwright test tests/evidence-mb-filter-2520.spec.ts --project=desktop --workers=2
// SW_SHOTS: where the captures go (default test-results/mb-filter-2520). SW_MBF_BEFORE=1 runs only the "before" captures (against a build of
// the base, which has no filter yet: the shots of the previous version).

const OUT = process.env.SW_SHOTS || 'test-results/mb-filter-2520';
const BEFORE_ONLY = process.env.SW_MBF_BEFORE === '1';
const SIZES = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }];
const SCHEMES = ['light', 'dark'] as const;

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

const titles = (page: Page) => homeOf(page).locator('[data-act="p2Notice"] .nt').allTextContents();
const roomNames = (page: Page) => homeOf(page).locator('.door-list .arow b').allTextContents();

test.describe('MULTI-BUILDING-FILTER-2520 the building filter of the home lists and the resident calendar', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`home notice board: nothing new before; after, it opens on the home's tower A and switches to tower B (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const scheme of SCHEMES) {
        await openHomeList(page, 'notices', { after: false, scheme });
        await expect(homeOf(page).locator('[data-act="p2NtBld"]')).toHaveCount(0);
        await homeOf(page).locator('[data-act="p2NtTab"][data-v="all"]').click();
        expect(await homeOverflow(page)).toEqual([]);
        await shot(page, `home-notices-before-${size.id}-${scheme}`);
        if (BEFORE_ONLY) continue;

        await openHomeList(page, 'notices', { after: true, scheme });
        const keys = homeOf(page).locator('[data-act="p2NtBld"]');
        await expect(keys).toHaveCount(4); // every building, A, B, the shared car park
        await expect(homeOf(page).locator(`[data-act="p2NtBld"][data-v="${A}"]`)).toHaveAttribute('aria-pressed', 'true');
        await homeOf(page).locator('[data-act="p2NtTab"][data-v="all"]').click();
        expect(await titles(page)).not.toContain('צביעת הלובי במגדל ב');
        expect(await homeOverflow(page)).toEqual([]);
        await shot(page, `home-notices-after-A-${size.id}-${scheme}`);
        await homeOf(page).locator(`[data-act="p2NtBld"][data-v="${B}"]`).click();
        await expect(homeOf(page).locator(`[data-act="p2NtBld"][data-v="${B}"]`)).toHaveAttribute('aria-pressed', 'true');
        const b = await titles(page);
        expect(b).not.toContain('החלפת מעלית במגדל א');
        expect(b).toContain('צביעת הלובי במגדל ב');
        await expect(homeOf(page).locator('[data-act="p2Notice"]', { hasText: 'ניקוי חלונות' }).locator('.nh')).toContainText('גם במגדל א');
        expect(await homeOverflow(page)).toEqual([]);
        await shot(page, `home-notices-after-B-${size.id}-${scheme}`);
      }
    });

    test(`home shared rooms: nothing new before; after, tower B keeps its gym and the shared roof (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const scheme of SCHEMES) {
        await openHomeList(page, 'calendar/book', { after: false, scheme });
        await expect(homeOf(page).locator('[data-act="p2CalBld"]')).toHaveCount(0);
        expect(await homeOverflow(page)).toEqual([]);
        await shot(page, `home-rooms-before-${size.id}-${scheme}`);
        if (BEFORE_ONLY) continue;

        await openHomeList(page, 'calendar/book', { after: true, scheme });
        await expect(homeOf(page).locator(`[data-act="p2CalBld"][data-v="${A}"]`)).toHaveAttribute('aria-pressed', 'true');
        await homeOf(page).locator(`[data-act="p2CalBld"][data-v="${B}"]`).click();
        await expect(homeOf(page).locator(`[data-act="p2CalBld"][data-v="${B}"]`)).toHaveAttribute('aria-pressed', 'true');
        const names = await roomNames(page);
        expect(names).toContain('חדר כושר');
        expect(names).not.toContain('מועדון דיירים');
        if (size.id === 'desktop') expect(names).toContain('פינת מנגל בגג'); // the phone pages two rooms at a time
        expect(await homeOverflow(page)).toEqual([]);
        await shot(page, `home-rooms-after-B-${size.id}-${scheme}`);
      }
    });
  }

  test('a wall panel locked to its room draws no control and shows its own tower\'s notices', async ({ page }) => {
    test.skip(BEFORE_ONLY, 'after only');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomeList(page, 'notices', { after: true, scheme: 'light', kiosk: true });
    await expect(homeOf(page).locator('[data-act="p2NtBld"]')).toHaveCount(0);
    await homeOf(page).locator('[data-act="p2NtTab"][data-v="all"]').click();
    const t = await titles(page);
    expect(t).toContain('החלפת מעלית במגדל א');
    expect(t).toContain('מסיבת חנוכה לכל הדיירים');
    expect(t).not.toContain('צביעת הלובי במגדל ב');
    expect(await homeOverflow(page)).toEqual([]);
    await shot(page, 'home-notices-wall-desktop-light');
  });

  test('the resident phone calendar: nothing new before; after, one row of buildings on the room list and the day grid', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const scheme of SCHEMES) {
      await openResident(page, false, scheme);
      await expect(page.locator(`${RES} sw-building-filter`)).toHaveCount(0);
      expect(await appOverflow(page)).toEqual([]);
      await shot(page, `res-rooms-before-phone-${scheme}`);
      if (BEFORE_ONLY) continue;

      await openResident(page, true, scheme);
      const f = page.locator(`${RES} sw-building-filter`);
      await expect(f).toBeVisible();
      await f.locator(`[data-building="${B}"]`).click();
      await expect(f.locator(`[data-building="${B}"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(`${RES} [data-res-room="room-gym"]`)).toBeVisible();
      await expect(page.locator(`${RES} [data-res-room="room-club"]`)).toHaveCount(0);
      await expect(page.locator(`${RES} [data-res-room="room-roof"]`)).toBeVisible();
      expect(await appOverflow(page)).toEqual([]);
      await shot(page, `res-rooms-after-B-phone-${scheme}`);
      // the day grid keeps the choice: tower B's gym and the shared roof, never tower A's club
      await page.locator(`${RES} [data-res-tab="grid"]`).click();
      const grid = page.locator(`${RES} cal-view-calendar`);
      await expect(grid.locator('[data-cal-col="room-gym"]')).toHaveCount(1);
      await expect(grid.locator('[data-cal-col="room-club"]')).toHaveCount(0);
      expect(await appOverflow(page)).toEqual([]);
      await shot(page, `res-grid-after-B-phone-${scheme}`);
      // inside one room and in "my bookings" the row is gone
      await page.locator(`${RES} [data-res-tab="mine"]`).click();
      await expect(f).toHaveCount(0);
    }
  });
});
