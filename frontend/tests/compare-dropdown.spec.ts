import { test, expect, type Page } from '@playwright/test';
import { mock, openAndPlay, type MockOptions } from './playback-stall-mock';

// 2.0.1 (owner request 2026-10-05, a phone screenshot of the recordings screen): the camera comparison picker is one multi-select
// dropdown (sw-dropdown `multiple`) instead of a chip per camera. Against the mocked backend of the stall specs (more cameras here):
// up to three extras next to the lead ("4 מתוך 4"), the remaining options disabled and a press on one refused with a short status,
// "נקה", "סיום", the search field of a long list, keys and aria, the route's `extra=` parameter, another recorder's camera disabled,
// the dropdown style of the installation (ui.dd_style) and the phone bottom sheet. Every project (desktop / tablet / mobile).
//   npm run build; npx playwright test tests/compare-dropdown.spec.ts
const MORE = [{ name: 'מחסן' }, { name: 'לובי' }, { name: 'מעלית' }, { name: 'גג' }, { name: 'חצר אחורית' }, { name: 'מסדרון' }, { name: 'שער' }]; // c3..c9: 8 options next to c1 (a search field at 8+)
const pick = (page: Page) => page.locator('investigate-playback sw-dropdown[data-compare-pick]');
const chip = (page: Page) => pick(page).locator('.chip');
const option = (page: Page, id: string) => pick(page).locator(`[role=option][data-id="${id}"]`);
const foot = (page: Page) => pick(page).locator('[data-dd-foot]');

async function open(page: Page, opts: MockOptions = { cameras: MORE }, hashQuery = '') {
  const st = await mock(page, opts);
  await openAndPlay(page, hashQuery);
  return st;
}

test.describe('recordings: the comparison picker', () => {
  test('one dropdown, not a chip row: picks up to three extras, refuses the fourth, every toggle re-opens the group, "נקה" goes back to one camera', async ({ page }) => {
    const st = await open(page);
    expect(st.creates).toBe(1);
    await expect(page.locator('investigate-playback [data-compare] sw-chip')).toHaveCount(0);
    await expect(chip(page)).toContainText('השוואה (עד 4)');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveCount(0);
    // the chip is a 44 px target
    const box = (await chip(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    await chip(page).click();
    const lb = pick(page).locator('[role=listbox]');
    await expect(lb).toBeVisible();
    await expect(lb).toHaveAttribute('aria-multiselectable', 'true');
    await expect(pick(page).locator('[role=option]')).toHaveCount(8); // every camera but the lead
    await expect(pick(page).locator('[data-dd-search]')).toBeVisible(); // 8+ options: the search field
    await expect(foot(page).locator('.st')).toHaveText('1 מתוך 4');
    await expect(foot(page).locator('[data-dd-clear]')).toBeDisabled();
    // the first extra: a group of two opens at the same instant, the list stays open
    await option(page, 'c2').click();
    await expect.poll(() => st.groups.length).toBe(1);
    expect(st.groups[0]).toEqual(['c1', 'c2']);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('2 מתוך 4');
    await expect(option(page, 'c2')).toHaveAttribute('aria-selected', 'true');
    await option(page, 'c3').click();
    await option(page, 'c4').click();
    await expect.poll(() => st.groups.length).toBe(3);
    expect(st.groups[2]).toEqual(['c1', 'c2', 'c3', 'c4']);
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('4 מתוך 4');
    await expect(chip(page).locator('.txt')).toHaveText('חניה, מחסן, לובי');
    await expect(foot(page).locator('.st')).toHaveText('4 מתוך 4');
    // at the limit: the rest are disabled, a press on one is refused with the short status and nothing changes
    await expect(pick(page).locator('[role=option][aria-disabled="true"]')).toHaveCount(5);
    await expect(option(page, 'c2')).not.toHaveAttribute('aria-disabled', 'true');
    await option(page, 'c5').click({ force: true }); // Playwright refuses an aria-disabled target by itself; a finger does not
    await expect(foot(page).locator('.st')).toHaveText('אפשר לבחור עד 4');
    await page.waitForTimeout(400);
    expect(st.groups.length).toBe(3);
    await expect(option(page, 'c5')).toHaveAttribute('aria-selected', 'false');
    // an un-pick frees a place
    await option(page, 'c2').click();
    await expect.poll(() => st.groups.length).toBe(4);
    expect(st.groups[3]).toEqual(['c1', 'c3', 'c4']);
    await expect(option(page, 'c5')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(foot(page).locator('.st')).toHaveText('3 מתוך 4');
    // "נקה": one camera again (a single session, not a group), the chip back to its placeholder
    await foot(page).locator('[data-dd-clear]').click();
    await expect.poll(() => st.creates).toBe(2);
    expect(st.groups.length).toBe(4);
    await expect(chip(page)).toContainText('השוואה (עד 4)');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveCount(0);
    await expect(foot(page).locator('[data-dd-clear]')).toBeDisabled();
    // "סיום" closes
    await foot(page).locator('[data-dd-done]').click();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(lb).toBeHidden();
  });

  test('keys: Arrow Down opens, Enter toggles without closing, Esc closes and returns the focus to the chip', async ({ page }) => {
    const st = await open(page);
    await chip(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(pick(page).locator('[role=listbox]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => st.groups.length).toBe(1);
    expect(st.groups[0]).toEqual(['c1', 'c3']);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('2 מתוך 4');
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await pick(page).evaluate((el) => el.shadowRoot!.activeElement?.classList.contains('chip'))).toBe(true);
    // the accessible name carries the picks and the count
    await expect(chip(page)).toHaveAttribute('aria-label', 'השוואה: מחסן, 2 מתוך 4');
  });

  test('the search field narrows the list; Tab cycles through the field, the list and the foot (never out of the picker)', async ({ page }) => {
    await open(page);
    await chip(page).click();
    const q = pick(page).locator('[data-dd-search]');
    await q.fill('מ');
    await expect(pick(page).locator('[role=option]')).toHaveCount(3); // מחסן, מעלית, מסדרון
    await q.fill('אין כזה');
    await expect(pick(page).locator('[data-dd-none]')).toBeVisible();
    await q.fill('');
    await expect(pick(page).locator('[role=option]')).toHaveCount(8);
    await q.focus();
    await page.keyboard.press('Tab');
    expect(await pick(page).evaluate((el) => el.shadowRoot!.activeElement?.getAttribute('role'))).toBe('listbox');
    await page.keyboard.press('Tab');
    expect(await pick(page).evaluate((el) => el.shadowRoot!.activeElement?.hasAttribute('data-dd-done'))).toBe(true); // "נקה" is disabled (nothing picked): skipped
    await page.keyboard.press('Enter');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('the route parameter extra= preselects the same comparison as the chips did (known ids, the lead dropped, at most three)', async ({ page }) => {
    const st = await open(page, { cameras: MORE }, '&extra=c3,c1,zz,c4,c5,c6');
    await expect.poll(() => st.groups.length).toBe(1);
    expect(st.groups[0]).toEqual(['c1', 'c3', 'c4', 'c5']);
    await expect(chip(page).locator('.txt')).toHaveText('מחסן, לובי, מעלית');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('4 מתוך 4');
  });

  test('a camera of another recorder is listed disabled while the cross-recorder setting is off', async ({ page }) => {
    await open(page, { cameras: [{ name: 'אחר', recorder: 'r2' }, { name: 'מחסן' }] });
    await chip(page).click();
    await expect(option(page, 'c3')).toHaveAttribute('aria-disabled', 'true');
    await expect(option(page, 'c4')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(option(page, 'c2')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the installation\'s dropdown style and the phone bottom sheet apply to the picker', async ({ page }, info) => {
    const st = await open(page, { cameras: MORE, settings: { 'ui.dd_style': 'field', 'ui.dd_phone': 'sheet' } });
    await expect(pick(page)).toHaveAttribute('dd-style', 'field');
    await chip(page).click();
    const pop = pick(page).locator('.pop');
    await expect(pop).toHaveAttribute('data-present', info.project.name === 'mobile' ? 'sheet' : 'pop');
    await option(page, 'c2').click();
    await expect.poll(() => st.groups.length).toBe(1);
    await foot(page).locator('[data-dd-done]').click();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('2 מתוך 4');
  });
});
