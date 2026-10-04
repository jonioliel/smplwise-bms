import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, fresh, install, open, type St } from './media-players-harness';
import type { AdminDevice } from '../src/api/media-admin';

// 0.1.161: the settings lists of screens and of speakers / players in הגדרות › מולטימדיה - one compact row per device with the platform's ids and
// the integration, filters (integration multi-select, area, type, approval, availability, free text over names / ids / integrations), sort,
// group with collapsible headers and counts, copy-id, the remembered view, the phone as cards. A MOCKED backend (tests/media-players-harness.ts)
// with a list that has several integrations, a device without one and an unavailable one. Desktop / tablet / mobile projects:
//   SW_BASE_URL=http://127.0.0.1:5251/ npx playwright test tests/evidence-media-admin-list.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/media-admin-list');
const sys = (page: Page) => page.locator('sw-app system-multimedia');
const screens = (page: Page) => sys(page).locator('[data-mm-devices]');
const players = (page: Page) => sys(page).locator('[data-mm-players]');
const row = (page: Page, key: string) => sys(page).locator(`[data-mm-admin-device="${key}"]`);
const shown = (scope: Locator) => scope.locator('[data-mm-admin-device]');
/** The harness sizes the viewport itself: pick the size of the project (desktop 1440, tablet 820, mobile 390). */
const go = (page: Page) => open(page, '/system/multimedia', ({ desktop: '1440', tablet: '820', mobile: '390' } as const)[test.info().project.name as 'desktop'] ?? '1440');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;

/** Gives the screens several integrations, a device without one and an unavailable one; the players get ids, too. */
function shape(st: St) {
  const ep = (id: string, platform: string, role: AdminDevice['endpoints'][number]['role'], hidden = false) => ({ endpoint_id: `ha:media_player.${id}`, platform, role, rule: '1', link_source: 'auto' as const, hidden, primary_for: [] });
  const scr = st.admin.filter((d) => d.kind === 'screen');
  scr.forEach((d, i) => {
    d.available = i !== 1;
    d.ha_device_id = `dev_${d.key}`;
  });
  scr[0].endpoints = [ep('tv_living', 'samsungtv_smart', 'vendor'), ep('tv_living_cast', 'cast', 'cast', true)];
  if (scr[2]) scr[2].endpoints = [];
  st.admin.filter((d) => d.kind !== 'screen').forEach((d, i) => {
    d.ha_device_id = `pdev_${i}`;
  });
}

test.describe('settings lists: filter, sort, group, copy, remember (mocked backend)', () => {
  let st: St;
  test.beforeEach(async ({ page }) => {
    st = fresh(ADMIN);
    await page.addInitScript(() => {
      try {
        if (sessionStorage.getItem('sw.test.cleared')) return;
        sessionStorage.setItem('sw.test.cleared', '1');
        localStorage.removeItem('sw.nav.order');
        for (const k of Object.keys(localStorage)) if (k.startsWith('sw.media-admin.view.')) localStorage.removeItem(k);
      } catch {
        /* storage unavailable */
      }
    });
    await install(page, st);
    shape(st);
  });

  test('a row shows the equipment ids and the integration; the toolbar and the sticky header are there', async ({ page }) => {
    await go(page);
    const r = row(page, st.admin.find((d) => d.kind === 'screen')!.key);
    await expect(r.locator('[data-mm-entity-id]')).toHaveText(/media_player\./);
    await expect(r.locator('[data-mm-device-id]')).toContainText('dev_');
    await expect(r.locator('[data-mm-int-cell]')).toContainText('samsungtv_smart');
    await expect(r.locator('[data-mm-int-cell]')).toContainText('+1');
    await expect(screens(page).locator('[data-mm-toolbar]')).toBeVisible();
    await expect(players(page).locator('[data-mm-toolbar]')).toBeVisible();
    if (!phone(page)) {
      const pos = await screens(page).locator('.thead').evaluate((el) => getComputedStyle(el).position);
      expect(pos).toBe('sticky');
    }
    // no hint paragraphs beyond the existing one: the toolbar holds controls and one count
    await expect(screens(page).locator('[data-mm-shown]')).toHaveText(String(st.admin.filter((d) => d.kind === 'screen').length));
  });

  test('integration (multi-select), type, approval and availability filter; the count says how many are shown; "נקה סינון" resets', async ({ page }) => {
    await go(page);
    const list = players(page);
    const total = await shown(list).count();
    expect(total).toBeGreaterThan(5);
    const chips = list.locator('[data-mm-f-int] [data-mm-int]');
    expect(await chips.count()).toBeGreaterThan(1);
    const first = chips.first();
    await first.click();
    const n1 = await shown(list).count();
    expect(n1).toBeLessThan(total);
    await expect(list.locator('[data-mm-shown]')).toHaveText(`${n1} מתוך ${total}`);
    await chips.nth(1).click(); // multi-select: both integrations now
    expect(await shown(list).count()).toBeGreaterThanOrEqual(n1);
    await list.locator('[data-mm-clear]').click();
    await expect(shown(list)).toHaveCount(total);
    await list.locator('[data-mm-f-approval]').click();
    await page.getByRole('option', { name: 'ממתינים לאישור' }).click();
    await expect(shown(list)).toHaveCount(2); // mp-new1, mp-new2
    await list.locator('[data-mm-clear]').click();
    await list.locator('[data-mm-f-avail]').click();
    await page.getByRole('option', { name: 'לא זמינים' }).click();
    const unav = await shown(list).count();
    expect(unav).toBeLessThan(total);
  });

  test('free text finds a device by its entity id, its device id and its integration; no match says so', async ({ page }) => {
    await go(page);
    const list = screens(page);
    const box = list.locator('[data-mm-search]');
    const target = st.admin.find((d) => d.kind === 'screen')!;
    await box.fill('media_player.tv_living');
    await expect(shown(list)).toHaveCount(1);
    await box.fill(`dev_${st.admin.filter((d) => d.kind === 'screen')[1].key}`);
    await expect(shown(list)).toHaveCount(1);
    await box.fill('samsungtv');
    await expect(shown(list).first()).toBeVisible();
    await expect(row(page, target.key)).toHaveCount(1);
    await box.fill('zzz-nothing');
    await expect(list.locator('[data-mm-no-match]')).toBeVisible();
    await expect(shown(list)).toHaveCount(0);
    await list.locator('[data-mm-clear]').click();
    await expect(box).toHaveValue('');
  });

  test('sort from the header and the toolbar; group by integration with a collapsible header and its count', async ({ page }) => {
    await go(page);
    const list = players(page);
    const names = async () => list.locator('[data-mm-row-name]').allInnerTexts();
    const a = await names();
    await list.locator('[data-mm-dir]').click();
    expect(await names()).toEqual([...a].reverse());
    if (!phone(page)) {
      await list.locator('[data-mm-th="id"]').click();
      await expect(list.locator('[role="columnheader"][aria-sort="ascending"]')).toContainText('מזהה');
      await list.locator('[data-mm-th="id"]').click();
      await expect(list.locator('[role="columnheader"][aria-sort="descending"]')).toContainText('מזהה');
    }
    await list.locator('[data-mm-group]').click();
    await page.getByRole('option', { name: 'לפי אינטגרציה' }).click();
    const heads = list.locator('[data-mm-group-head]');
    expect(await heads.count()).toBeGreaterThan(1);
    const counts = (await list.locator('[data-mm-group-count]').allInnerTexts()).map(Number);
    expect(counts.reduce((x, y) => x + y, 0)).toBe(await shown(list).count());
    const h = heads.first();
    const inGroup = counts[0];
    await h.click();
    await expect(h).toHaveAttribute('aria-expanded', 'false');
    await expect(shown(list)).toHaveCount(counts.slice(1).reduce((x, y) => x + y, 0));
    await h.click();
    await expect(shown(list)).toHaveCount(counts.reduce((x, y) => x + y, 0));
    expect(inGroup).toBeGreaterThan(0);
    await list.locator('[data-mm-group]').click();
    await page.getByRole('option', { name: 'לפי חדר' }).click();
    await expect(list.locator('[data-mm-group-head]').first()).toBeVisible();
  });

  test('copy-id puts the entity id and the device id on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await go(page);
    const d = st.admin.find((x) => x.kind === 'screen')!;
    await row(page, d.key).locator(`[data-mm-copy="${d.key}"]`).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(d.anchor_entity_id);
    await row(page, d.key).locator(`[data-mm-copy-device="${d.key}"]`).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`dev_${d.key}`);
    await expect(sys(page).locator('[data-mm-note]')).toHaveText('הועתק');
  });

  test('an open form stays open and in place while filtering; the keyboard opens rows and group headers', async ({ page }) => {
    await go(page);
    const list = screens(page);
    const k = st.admin.find((d) => d.kind === 'screen')!.key;
    await row(page, k).locator(`[data-mm-edit="${k}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(row(page, k).locator(`[data-mm-name="${k}"]`)).toBeVisible();
    await list.locator('[data-mm-search]').fill(st.admin.find((d) => d.key === k)!.name.slice(0, 4));
    await expect(row(page, k).locator(`[data-mm-name="${k}"]`)).toBeVisible();
    await list.locator('[data-mm-clear]').click();
    await expect(row(page, k).locator(`[data-mm-name="${k}"]`)).toBeVisible();
    // the existing writes still work from the opened form (one field, one write)
    await row(page, k).locator(`[data-mm-volmax="${k}"]`).fill('40');
    await row(page, k).locator(`[data-mm-volmax="${k}"]`).press('Enter');
    await row(page, k).locator(`[data-mm-name="${k}"]`).focus();
    await expect.poll(() => st.calls.filter((c) => c.path === `multimedia/admin/devices/${k}`).map((c) => c.body)).toContainEqual({ volume_max: 40 });
    // the approval toggle of the row is one write
    const was = st.admin.find((d) => d.key === k)!.approved;
    await row(page, k).locator(`sw-toggle[data-mm-approved="${k}"]`).click();
    await expect.poll(() => st.calls.filter((c) => c.path === `multimedia/admin/devices/${k}`).map((c) => c.body)).toContainEqual({ approved: !was });
    await list.locator('[data-mm-group] button').first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'לפי אינטגרציה' }).click();
    const head = list.locator('[data-mm-group-head]').first();
    await head.focus();
    await page.keyboard.press('Enter');
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(head).toHaveAttribute('aria-expanded', 'true');
  });

  test('the last view is remembered per section (not the free text); a blocked storage changes nothing', async ({ page }) => {
    await go(page);
    const list = players(page);
    await list.locator('[data-mm-group]').click();
    await page.getByRole('option', { name: 'לפי אינטגרציה' }).click();
    await list.locator('[data-mm-dir]').click();
    await list.locator('[data-mm-search]').fill('abc');
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect(players(page).locator('[data-mm-group-head]').first()).toBeVisible();
    await expect(players(page).locator('[data-mm-search]')).toHaveValue('');
    await expect(players(page).locator('[data-mm-dir]')).toHaveAttribute('aria-label', /יורד/);
    await expect(screens(page).locator('[data-mm-group-head]')).toHaveCount(0); // the screens list has its own memory
    // storage that throws: the page still renders and filters
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    });
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect(screens(page).locator('[data-mm-admin-device]').first()).toBeVisible();
  });

  test('the phone shows cards; nothing leaves the page; screenshots', async ({ page }) => {
    await go(page);
    await expect(screens(page).locator('[data-mm-admin-device]').first()).toBeVisible();
    const w = page.viewportSize()!.width;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (w <= 860) await expect(screens(page).locator('.thead')).toBeHidden();
    else await expect(screens(page).locator('.thead')).toBeVisible();
    fs.mkdirSync(OUT, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await screens(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `settings-list-${w}-${test.info().project.name}.png`) });
  });
});
