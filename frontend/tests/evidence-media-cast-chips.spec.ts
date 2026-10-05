import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-028 (prep): the "שידור" marking of הגדרות › מולטימדיה - a chip per screen and per player saying whether the device could receive a cast
// of our video (Google Cast / DLNA / AirPlay / the screen's browser / none), coloured by the server's confidence, and the sentence in the open
// form (technology, confidence, the endpoint that would answer, the reason). Read-only: there is no cast button anywhere yet. Demo mode
// (every /api/v1 call is aborted: the in-memory demo of api/media-admin.ts and the players mock answer). Desktop / tablet / mobile projects:
//   SW_BASE_URL=http://127.0.0.1:5251/ npx playwright test tests/evidence-media-cast-chips.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-028/prep');
const sys = (page: Page) => page.locator('sw-app system-multimedia');
const row = (page: Page, key: string) => sys(page).locator(`[data-mm-admin-device="${key}"]`);
const chip = (page: Page, key: string) => row(page, key).locator(`[data-mm-cast="${key}"] sw-badge`);
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;
const tablet = (page: Page) => { const w = page.viewportSize()?.width ?? 1440; return w > 860 && w <= 1280; };

async function open(page: Page) {
  await page.addInitScript(() => {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('sw.media-admin.view.')) localStorage.removeItem(k); } catch { /* storage unavailable */ }
  });
  await page.goto('/?design=a#/system/multimedia');
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('system-multimedia')?.shadowRoot?.querySelector('[data-mm-admin-device]'), null, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${page.viewportSize()?.width ?? 0}.png`) });
}

/** On a tablet width the column is folded by default (like the room): the columns control shows it. */
async function showCastColumn(page: Page) {
  await sys(page).locator('[data-mm-toolbar="screens"] [data-mm-cols]').click();
  await sys(page).locator('[data-mm-toolbar="screens"] [data-mm-col="cast"]').check();
  await page.keyboard.press('Escape');
}

test.describe('settings › מולטימדיה: the cast marking (demo mode, read-only)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('every screen row carries a chip: the technology when known, "לא ידוע" / "לא נתמך" otherwise; the confidence colours it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    if (tablet(page)) await showCastColumn(page);
    await expect(chip(page, 'md-living')).toHaveAttribute('label', 'Google Cast');
    await expect(chip(page, 'md-living')).toHaveAttribute('kind', 'live');
    await expect(chip(page, 'md-parents')).toHaveAttribute('label', 'Google Cast');
    await expect(chip(page, 'md-kids')).toHaveAttribute('label', 'DLNA · כנראה');
    await expect(chip(page, 'md-kids')).toHaveAttribute('kind', 'neutral');
    await expect(chip(page, 'md-pergola')).toHaveAttribute('label', 'דפדפן המסך · לא ידוע');
    await expect(chip(page, 'md-kitchen')).toHaveAttribute('label', 'לא ידוע');
    await expect(chip(page, 'md-kitchen')).toHaveAttribute('kind', 'unknown');
    // the title carries the reason, the row carries the method for the eye and the tests
    await expect(chip(page, 'md-living')).toHaveAttribute('title', /מאומת/);
    await expect(row(page, 'md-living').locator('[data-mm-cast]')).toHaveAttribute('data-mm-cast-method', 'cast_hls');
    // the column header exists on the table widths; the phone cards label the value inline
    if (!phone(page)) await expect(sys(page).locator('[data-mm-table="screens"] .thead')).toContainText('שידור');
    else await expect(row(page, 'md-living').locator('[data-mm-cast] .lb')).toHaveText('שידור');
    await shot(page, 'cast-chips-screens');
    expect(errors).toEqual([]);
  });

  test('the players list marks speakers "לא נתמך" and a DLNA player "DLNA · כנראה"; the form sentence says why', async ({ page }) => {
    await open(page);
    const players = sys(page).locator('[data-mm-players]');
    await expect(players).toBeVisible();
    const pl = (key: string) => players.locator(`[data-mm-admin-device="${key}"] [data-mm-cast="${key}"] sw-badge`);
    if (tablet(page)) {
      await players.locator('[data-mm-toolbar="players"] [data-mm-cols]').click();
      await players.locator('[data-mm-toolbar="players"] [data-mm-col="cast"]').check();
      await page.keyboard.press('Escape');
    }
    await expect(pl('mp-kids')).toHaveAttribute('label', 'DLNA · כנראה'); // the DLNA player
    await expect(pl('mp-per')).toHaveAttribute('label', 'לא נתמך'); // a Cast speaker: audio only
    await expect(pl('mp-ampl')).toHaveAttribute('label', 'לא נתמך'); // the receiver
    // the open form of a screen and of a player carries the sentence
    await row(page, 'md-living').locator('[data-mm-edit]').click();
    await expect(row(page, 'md-living').locator('[data-mm-cast-line="md-living"]')).toContainText('שידור למסך: Google Cast · מאומת · דרך media_player.demo_living_cast');
    await players.locator('[data-mm-admin-device="mp-per"] [data-mm-edit]').click();
    await expect(players.locator('[data-mm-cast-line="mp-per"]')).toContainText('שידור למסך: לא נתמך');
    await shot(page, 'cast-chips-form');
    // nothing on this screen casts: no button, no command
    expect(await sys(page).innerText()).not.toContain('שדר למסך');
  });

  test('without the field (an older server) the cell shows a dash and nothing breaks', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await open(page);
    const dash = await page.evaluate(() => {
      const el = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-multimedia') as (HTMLElement & { list: { devices: { cast?: unknown }[] } }) | null;
      if (!el) return null;
      el.list = { ...el.list, devices: el.list.devices.map((d) => ({ ...d, cast: undefined })) };
      return new Promise((r) => setTimeout(() => r(el.shadowRoot?.querySelector('[data-mm-cast="md-living"]')?.textContent?.trim() ?? null), 300));
    });
    expect(dash).toContain('—');
  });
});
