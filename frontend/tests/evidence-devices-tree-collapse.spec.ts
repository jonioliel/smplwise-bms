import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Owner 2026-10-01: the building screen's tree panel folds per floor. Demo mode (no backend): the demo tree has the floors
// "קרקע" (areas lobby, kitchen) and "קומה 1" (area office). SW_SHOTS=<dir> saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';
const KEY = 'sw.devices.treeCollapsed';

async function open(page: Page, init: Record<string, string> = {}) {
  await page.addInitScript((entries) => {
    try {
      // seed once per browser context: a reload must keep what the screen itself stored
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('sw.devices.layout', 'cards');
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      }
    } catch {
      /* storage unavailable */
    }
  }, init);
  await page.goto('about:blank');
  await page.goto('/?design=a#/devices/building');
  await page.waitForSelector('sw-app');
  await expect(page.locator('devices-building nav.tree')).toBeVisible({ timeout: 15000 });
}

const tree = (page: Page) => page.locator('devices-building nav.tree');
const group = (page: Page, floor: string) => tree(page).locator(`.tree-group[data-tree-floor="${floor}"]`);
const fold = (page: Page, floor: string) => tree(page).locator(`button[data-tree-fold="${floor}"]`);

test.describe('the devices tree folds per floor', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec: the demo tree is only served without a backend');

  test('collapse hides that floor\'s area rows only, expand shows them again; the floor name still selects', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the tree panel is folded away below 900 px (the floor cards carry the rows)');
    await open(page);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `tree-expanded-${testInfo.project.name}.png`) });
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(2);
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(1);
    await expect(fold(page, 'ground')).toHaveAttribute('aria-expanded', 'true');
    await expect(fold(page, 'ground')).toHaveAttribute('aria-label', 'כווץ קומה');

    await fold(page, 'ground').click();
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(0);
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(1); // the other floor is untouched
    await expect(fold(page, 'ground')).toHaveAttribute('aria-expanded', 'false');
    await expect(fold(page, 'ground')).toHaveAttribute('aria-label', 'הרחב קומה');
    // the fold does not select: the building stays selected, both floor cards stay on the board
    await expect(tree(page).locator('[data-tree="all"]')).toHaveAttribute('aria-current', 'true');
    // the floor's own row (name + lit count) is still there
    await expect(group(page, 'ground').locator('[data-tree-select="ground"]')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `tree-collapsed-${testInfo.project.name}.png`) });

    await fold(page, 'ground').click();
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(2);

    // the name selects the floor (existing behaviour), whether or not it is folded
    await fold(page, 'first').click();
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(0);
    await group(page, 'ground').locator('[data-tree-select="ground"]').click();
    await expect(group(page, 'ground').locator('[data-tree-select="ground"]')).toHaveAttribute('aria-current', 'true');
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(0); // selecting another floor leaves this fold alone
  });

  test('the choice survives a reload (localStorage, per device); default is every floor open', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'no tree panel on a phone');
    await open(page);
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(2);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    await fold(page, 'ground').click();
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null')).toEqual(['ground']);
    await page.reload();
    await expect(tree(page)).toBeVisible({ timeout: 15000 });
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(0);
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(1);
    await expect(fold(page, 'ground')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a selected floor is never left folded: selecting it opens it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'no tree panel on a phone');
    await open(page, { [KEY]: JSON.stringify(['ground', 'first']) });
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(0);
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(0);
    // the floor card's title selects the floor from outside the tree: its rows come back in the tree
    await page.locator('devices-building [data-floor-title="first"]').click();
    await expect(group(page, 'first').locator('[data-area-row]')).toHaveCount(1);
    await expect(group(page, 'first').locator('[data-tree-select="first"]')).toHaveAttribute('aria-current', 'true');
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(0);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null')).toEqual(['ground']);
    // and a click on a folded floor's name opens it too
    await group(page, 'ground').locator('[data-tree-select="ground"]').click();
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(2);
  });

  test('the fold-all toggle beside "כל המבנה"; the chevron is a labelled button, apart from the name', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'no tree panel on a phone');
    await open(page);
    const all = tree(page).locator('button[data-tree-fold-all]');
    await expect(all).toHaveAttribute('aria-label', 'כווץ הכל');
    await all.click();
    await expect(tree(page).locator('[data-area-row]')).toHaveCount(0);
    await expect(all).toHaveAttribute('aria-label', 'הרחב הכל');
    await all.click();
    await expect(tree(page).locator('[data-area-row]')).toHaveCount(3);
    // the chevron is its own button: not inside the select button
    expect(await fold(page, 'ground').evaluate((b) => !!b.closest('[data-tree-select]'))).toBe(false);
  });

  test('a broken stored value falls back to everything open', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'no tree panel on a phone');
    await open(page, { [KEY]: '{not json' });
    await expect(group(page, 'ground').locator('[data-area-row]')).toHaveCount(2);
  });

  test('the chevron stays visible and compact in the glass style, dark scheme', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the look');
    await open(page, { [KEY]: JSON.stringify(['first']) });
    await page.locator('devices-building').evaluate((h) => {
      h.setAttribute('data-devices-style', 'glass');
      h.setAttribute('data-devices-scheme', 'dark');
    });
    await expect(fold(page, 'ground')).toBeVisible();
    await expect(fold(page, 'first')).toBeVisible();
    const box = await fold(page, 'ground').boundingBox();
    expect(box && box.width >= 20 && box.height >= 24).toBe(true);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'tree-dark-desktop.png') });
  });
});
