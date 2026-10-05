import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { mockWall, openWall, R1, VISIBLE } from './wall-count-mock';
import { pickCols } from './wall-count-helpers';

// LV1 (owner request 2026-10-05): the live wall chooses HOW MANY cameras it shows - a ladder cut off at the cameras the user may see
// (all recorders; a disabled camera and a disabled recorder's cameras do not count) plus "הכול" - and the columns picker is the shared
// compact sw-dropdown. Mock layer, no backend. The stream budget is untouched (snapshots only here: can_view_live=false).
//   ~/run_remote.sh spec <branch> tests/wall-live-count.spec.ts            (all three projects)
// SW_SHOTS=<dir> saves the after screenshots (outside docs/: run_remote resets docs/ at the end).
const SHOTS = process.env.SW_SHOTS ?? '';
const LADDER = ['1', '2', '4', '6', '8', '9', '12', '16', '20', 'all'];
const tiles = (page: Page) => page.locator('live-wall sw-camera-tile[data-cam]');
const isPhone = (page: Page) => page.viewportSize()!.width < 768;

/** The ids offered by the count control of this width (a native select on a phone, the button row elsewhere). */
async function offered(page: Page): Promise<string[]> {
  if (isPhone(page)) return page.locator('live-wall [data-wall-count-select] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  return page.locator('live-wall [data-wall-count] button').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-count') ?? ''));
}

async function chooseCount(page: Page, id: string) {
  if (isPhone(page)) await page.locator('live-wall [data-wall-count-select]').selectOption(id);
  else await page.locator(`live-wall [data-wall-count] button[data-count="${id}"]`).click();
}

test('the ladder stops below the visible total and ends with "all"; the count is remembered', async ({ page }, info) => {
  await mockWall(page, { count: '6' });
  await openWall(page, 6);
  expect(await offered(page), 'steps below 24 (the disabled camera and the disabled recorder are not counted) + all').toEqual(LADDER);
  if (!isPhone(page)) await expect(page.locator('live-wall [data-wall-count] button.on')).toHaveAttribute('data-count', '6');
  await chooseCount(page, '12');
  await expect(tiles(page)).toHaveCount(12);
  expect(await page.evaluate(() => localStorage.getItem('sw.wall.count'))).toBe('12');
  await chooseCount(page, 'all');
  await expect(tiles(page)).toHaveCount(VISIBLE);
  expect(await page.evaluate(() => localStorage.getItem('sw.wall.count'))).toBe('all');
  await page.reload();
  await expect(tiles(page)).toHaveCount(VISIBLE);
  // nothing sideways; the rows beyond the screen scroll vertically instead of being squeezed away
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  if (isPhone(page)) {
    const first = (await tiles(page).first().boundingBox())!;
    expect(first.width, 'phone tiles stay readable').toBeGreaterThanOrEqual(140);
    const last = tiles(page).last();
    await last.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY + document.documentElement.scrollTop), 'a phone scrolls to reach the last tile').toBeGreaterThan(0);
  }
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `after-${info.project.name}-all.png`) });
  }
});

test('a stored count above the total means "all"', async ({ page }) => {
  await mockWall(page, { count: '40' });
  await openWall(page, VISIBLE);
  if (isPhone(page)) await expect(page.locator('live-wall [data-wall-count-select]')).toHaveValue('all');
  else await expect(page.locator('live-wall [data-wall-count] button.on')).toHaveAttribute('data-count', 'all');
});

test('the recorder filter re-cuts the ladder to that recorder', async ({ page }) => {
  await mockWall(page, { count: 'all' });
  await openWall(page, VISIBLE);
  await page.locator('live-wall [data-wall-recorder]').selectOption('r1');
  await expect(tiles(page)).toHaveCount(R1);
  expect(await offered(page)).toEqual(['1', '2', '4', '6', '8', '9', 'all']);
});

test('the columns picker is one compact dropdown at the top; the old chip row is gone', async ({ page }, info) => {
  await mockWall(page, { count: '12' });
  await openWall(page, 12);
  await expect(page.locator('live-wall .colbtn')).toHaveCount(0);
  await expect(page.locator('live-wall [data-wall-cols-row]')).toHaveCount(0);
  const dd = page.locator('live-wall sw-dropdown[data-wall-cols-dd]');
  await expect(dd).toHaveCount(1);
  const box = (await dd.locator('[data-dropdown-chip]').boundingBox())!;
  expect(box.height, 'a compact chip').toBeLessThanOrEqual(48);
  expect(box.width, 'a small chip').toBeLessThanOrEqual(200);
  const grid = (await page.locator('live-wall .grid').boundingBox())!;
  expect(box.y, 'in the header, above the grid').toBeLessThan(grid.y);
  await pickCols(page, 3);
  await expect(page.locator('live-wall .grid')).toHaveAttribute('data-wall-cols', '3');
  await expect(page.locator('live-wall .grid')).toHaveAttribute('data-wall-cols-manual', '');
  expect(await page.evaluate(() => localStorage.getItem('sw.wall.cols'))).toBe('3');
  await page.reload();
  await expect(tiles(page)).toHaveCount(12);
  await expect(page.locator('live-wall .grid')).toHaveAttribute('data-wall-cols', '3');
  await pickCols(page, 0);
  await expect(page.locator('live-wall .grid')).not.toHaveAttribute('data-wall-cols-manual', '');
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `after-${info.project.name}-cols.png`) });
    await dd.locator('[data-dropdown-chip]').click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS, `after-${info.project.name}-cols-open.png`) });
  }
});

test('the phone presents the open dropdown as the user chose (ui.dd_phone: list)', async ({ page }) => {
  test.skip(!isPhone(page), 'phone only');
  await mockWall(page, { count: '12' });
  await openWall(page, 12);
  await page.evaluate(() => document.documentElement.setAttribute('data-dd-phone', 'list'));
  const dd = page.locator('live-wall sw-dropdown[data-wall-cols-dd]');
  await dd.locator('[data-dropdown-chip]').click();
  await expect(dd.locator('[role=listbox]')).toBeVisible();
  const lb = (await dd.locator('[role=listbox]').boundingBox())!;
  expect(lb.height, 'the small list, not a full-height sheet').toBeLessThan(page.viewportSize()!.height * 0.7);
});

// the layout guard at 320 / 390 / 1440 over the wall (toolbar and grid), closed and with the columns list open
test('layout guard: 320 / 390 / 1440, closed and open', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sets its own widths');
  await mockWall(page, { count: 'all' });
  await openWall(page, VISIBLE);
  const out: Finding[] = [];
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
    await page.waitForTimeout(500);
    out.push(...(await page.evaluate(inPageCheck, { ctx: `wall ${w} closed`, roots: ['live-wall'] })).filter((f) => ['escape', 'overflow', 'target'].includes(f.cls)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${w}: no sideways scroll`).toBeLessThanOrEqual(0);
    await page.locator('live-wall sw-dropdown[data-wall-cols-dd] [data-dropdown-chip]').click();
    await page.waitForTimeout(350);
    out.push(...(await page.evaluate(inPageCheck, { ctx: `wall ${w} open`, roots: ['live-wall'], skip: '.grab' })).filter((f) => ['escape', 'overflow'].includes(f.cls)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  const s = summarize(out);
  expect(s.lines, JSON.stringify(s.byCls)).toEqual([]);
});
