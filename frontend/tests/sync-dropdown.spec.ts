import { test, expect, type Page } from '@playwright/test';
import { mock, type MockOptions } from './playback-stall-mock';

// 2.0.1 (owner approval 2026-10-05, after the recordings screen's comparison picker): the synchronized-playback screen's camera picker
// is the same multi-select dropdown (sw-dropdown `multiple`, max 4, no base: the first pick is the lead) instead of a chip per camera.
// Against the mocked backend of the stall specs (more cameras here): up to four picks, the fifth refused with the short status, the
// snapshot cards and the "מובילה" badge follow the picks, "נקה", the launch button and the route it opens (camera= the first pick,
// extra= the rest, unchanged), another recorder's camera disabled / allowed by the experimental setting, the installation's dropdown
// style and the phone bottom sheet. Every project (desktop / tablet / mobile).
//   npm run build; npx playwright test tests/sync-dropdown.spec.ts
const MORE = [{ name: 'מחסן' }, { name: 'לובי' }, { name: 'מעלית' }, { name: 'גג' }, { name: 'חצר אחורית' }, { name: 'מסדרון' }, { name: 'שער' }]; // c3..c9: 9 options (a search field at 8+)
const sy = (page: Page) => page.locator('investigate-sync');
const pick = (page: Page) => sy(page).locator('sw-dropdown[data-sync-pick-cameras]');
const chip = (page: Page) => pick(page).locator('.chip');
const option = (page: Page, id: string) => pick(page).locator(`[role=option][data-id="${id}"]`);
const foot = (page: Page) => pick(page).locator('[data-dd-foot]');
const launch = (page: Page) => sy(page).locator('[data-sync-launch]');

async function open(page: Page, opts: MockOptions = { cameras: MORE }, urlQuery = 'design=a') {
  const st = await mock(page, opts);
  await page.goto('about:blank');
  await page.goto(`/?${urlQuery}#/investigate/playback/sync`);
  // the dropdown's chip, or (2.0.2, `ui.dd_picker` = chips) the first camera button
  await expect(opts.settings?.['ui.dd_picker'] === 'chips' ? sy(page).locator('sw-chip[data-sync-camera]').first() : chip(page)).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500); // the shell recreates the screen once after the session settles
  return st;
}

test.describe('synchronized playback: the camera picker', () => {
  test('one dropdown, not a chip row: picks up to four, refuses the fifth, the cards and the lead badge follow, "נקה" empties the set', async ({ page }) => {
    await open(page);
    await expect(sy(page).locator('[data-sync-cameras] sw-chip')).toHaveCount(0);
    await expect(sy(page).locator('[data-sync-camera]')).toHaveCount(0);
    await expect(chip(page)).toContainText('בחר מצלמות (עד 4)');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveCount(0);
    await expect(launch(page).locator('button')).toBeDisabled();
    // the chip is a 44 px target
    const box = (await chip(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    await chip(page).click();
    const lb = pick(page).locator('[role=listbox]');
    await expect(lb).toBeVisible();
    await expect(lb).toHaveAttribute('aria-multiselectable', 'true');
    await expect(pick(page).locator('[role=option]')).toHaveCount(9); // every camera (no lead chosen elsewhere)
    await expect(pick(page).locator('[data-dd-search]')).toBeVisible(); // 8+ options: the search field
    await expect(foot(page).locator('.st')).toHaveText('0 מתוך 4');
    await expect(foot(page).locator('[data-dd-clear]')).toBeDisabled();
    // the first pick is the lead; the list stays open; the snapshot card appears
    await option(page, 'c2').click();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('1 מתוך 4');
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(1);
    await expect(sy(page).locator('[data-sync-pick="c2"] sw-badge')).toHaveAttribute('label', 'מובילה');
    await expect(launch(page).locator('button')).toBeDisabled(); // two are needed
    await option(page, 'c1').click();
    await expect(launch(page).locator('button')).toBeEnabled();
    await expect(launch(page)).toContainText('פתח השוואה (2)');
    await option(page, 'c3').click();
    await option(page, 'c4').click();
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('4 מתוך 4');
    await expect(chip(page).locator('.txt')).toHaveText('חניה, כניסה, מחסן, לובי');
    await expect(foot(page).locator('.st')).toHaveText('4 מתוך 4');
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(4);
    await expect(sy(page).locator('[data-sync-pick]').first()).toHaveAttribute('data-sync-pick', 'c2'); // pick order: the first picked leads
    // at the limit: the rest are disabled, a press on one is refused with the short status and nothing changes
    await expect(pick(page).locator('[role=option][aria-disabled="true"]')).toHaveCount(5);
    await expect(option(page, 'c2')).not.toHaveAttribute('aria-disabled', 'true');
    await option(page, 'c5').click({ force: true }); // Playwright refuses an aria-disabled target by itself; a finger does not
    await expect(foot(page).locator('.st')).toHaveText('אפשר לבחור עד 4');
    await page.waitForTimeout(300);
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(4);
    await expect(option(page, 'c5')).toHaveAttribute('aria-selected', 'false');
    // an un-pick of the lead: the next one leads
    await option(page, 'c2').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(3);
    await expect(sy(page).locator('[data-sync-pick="c1"] sw-badge')).toHaveAttribute('label', 'מובילה');
    await expect(option(page, 'c5')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(foot(page).locator('.st')).toHaveText('3 מתוך 4');
    // "נקה": nothing picked, the launch button disabled again
    await foot(page).locator('[data-dd-clear]').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(0);
    await expect(chip(page)).toContainText('בחר מצלמות (עד 4)');
    await expect(launch(page).locator('button')).toBeDisabled();
    // "סיום" closes
    await foot(page).locator('[data-dd-done]').click();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(lb).toBeHidden();
  });

  test('the launch opens the recordings screen with the same route as the chips did: camera= the first pick, extra= the rest', async ({ page }) => {
    const st = await open(page);
    await chip(page).click();
    await option(page, 'c3').click();
    await option(page, 'c1').click();
    await option(page, 'c4').click();
    await foot(page).locator('[data-dd-done]').click();
    await launch(page).click();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 15000 }).toMatch(/^#\/investigate\/playback\?camera=c3&extra=c1(,|%2C)c4&t=/);
    await expect(page.locator('investigate-playback')).toBeVisible({ timeout: 20000 });
    await expect.poll(() => st.groups.length).toBe(1);
    expect(st.groups[0]).toEqual(['c3', 'c1', 'c4']);
  });

  test('keys: Arrow Down opens, Enter toggles without closing, Esc closes and returns the focus to the chip', async ({ page }) => {
    await open(page);
    await chip(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(pick(page).locator('[role=listbox]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(1);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('1 מתוך 4');
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await pick(page).evaluate((el) => el.shadowRoot!.activeElement?.classList.contains('chip'))).toBe(true);
    await expect(chip(page)).toHaveAttribute('aria-label', 'מצלמות: כניסה, 1 מתוך 4');
  });

  test('a camera of another recorder is listed disabled once the set has a lead, with the short reason; the experimental setting lets it join', async ({ page }) => {
    await open(page, { cameras: [{ name: 'אחר', recorder: 'r2' }, { name: 'מחסן' }] });
    await chip(page).click();
    await expect(option(page, 'c3')).not.toHaveAttribute('aria-disabled', 'true'); // nothing picked yet: any camera may lead
    await expect(option(page, 'c3').locator('[data-dd-note]')).toHaveCount(0);
    await option(page, 'c1').click();
    await expect(option(page, 'c3')).toHaveAttribute('aria-disabled', 'true');
    await expect(option(page, 'c3').locator('[data-dd-note]')).toHaveText('מקליט אחר'); // 2.0.2
    await expect(option(page, 'c3')).toHaveAttribute('title', 'מקליט אחר');
    await expect(option(page, 'c4')).not.toHaveAttribute('aria-disabled', 'true');
    await option(page, 'c3').click({ force: true });
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(1);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { cameras: [{ name: 'אחר', recorder: 'r2' }, { name: 'מחסן' }], settings: { 'playback.cross_recorder_sync': 'true' } });
    await chip(page).click();
    await option(page, 'c1').click();
    await expect(option(page, 'c3')).not.toHaveAttribute('aria-disabled', 'true');
    await option(page, 'c3').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(2);
  });

  // 2.0.2 (owner feedback 2026-10-05): the card shows the four places of a set, no explanatory sentence, the lead on the first place
  test('the card: four numbered places (the first is the lead), a pick fills its place, the remove button empties it, no paragraph', async ({ page }) => {
    await open(page);
    const card = sy(page).locator('sw-card').first();
    await expect(sy(page).locator('[data-sync-slots] .slot')).toHaveCount(4);
    await expect(sy(page).locator('[data-sync-slot]')).toHaveCount(4);
    await expect(sy(page).locator('[data-sync-slot="1"]')).toContainText('מובילה');
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(0);
    // the start-time note and the subheadings are gone: no .note on the screen, the card has no subheading
    await expect(sy(page).locator('.note')).toHaveCount(0);
    await expect(card).not.toHaveAttribute('subheading', /./);
    await chip(page).click();
    await option(page, 'c3').click();
    await option(page, 'c1').click();
    await foot(page).locator('[data-dd-done]').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(2);
    await expect(sy(page).locator('[data-sync-slot]')).toHaveCount(2);
    await expect(sy(page).locator('[data-sync-pick="c3"] sw-badge.lead')).toHaveAttribute('label', 'מובילה');
    await expect(sy(page).locator('[data-sync-pick="c1"] .num')).toHaveText('2');
    await expect(sy(page).locator('[data-sync-pick="c3"] .cap')).toContainText('מחסן');
    // the remove button on a place
    await sy(page).locator('[data-sync-pick="c3"] .rm').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(1);
    await expect(sy(page).locator('[data-sync-pick="c1"] sw-badge.lead')).toHaveAttribute('label', 'מובילה'); // the next one leads
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('1 מתוך 4');
    await expect(launch(page).locator('button')).toBeDisabled();
  });

  // 2.0.2: the search field from 4 cameras by default (`ui.dd_search`)
  test('the search field appears from 4 cameras by default; `never` hides it', async ({ page }) => {
    await open(page, { cameras: [{ name: 'מחסן' }, { name: 'לובי' }] }); // four cameras
    await chip(page).click();
    await expect(pick(page).locator('[role=option]')).toHaveCount(4);
    await expect(pick(page).locator('[data-dd-search]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { cameras: [{ name: 'מחסן' }] }); // three
    await chip(page).click();
    await expect(pick(page).locator('[role=option]')).toHaveCount(3);
    await expect(pick(page).locator('[data-dd-search]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { cameras: MORE, settings: { 'ui.dd_search': 'never' } });
    await chip(page).click();
    await expect(pick(page).locator('[role=option]')).toHaveCount(9);
    await expect(pick(page).locator('[data-dd-search]')).toHaveCount(0);
  });

  // 2.0.2: the picker as buttons by the installation's choice (`ui.dd_picker`)
  test('ui.dd_picker = chips: a button per camera with the status dot; the limit and another recorder disable with a reason; the places follow', async ({ page }) => {
    await open(page, { cameras: [{ name: 'מחסן' }, { name: 'לובי' }, { name: 'אחר', recorder: 'r2' }], settings: { 'ui.dd_picker': 'chips' } });
    const row = sy(page).locator('[data-sync-cameras]');
    await expect(row).toHaveAttribute('data-picker', 'chips');
    await expect(pick(page)).toHaveCount(0);
    const chips = row.locator('sw-chip[data-sync-camera]');
    await expect(chips).toHaveCount(5);
    await expect(row).toContainText('מצלמות (עד 4):');
    await expect(row.locator('sw-chip[disabled]')).toHaveCount(0); // nothing picked: any camera may lead
    await row.locator('sw-chip[data-sync-camera="c2"]').click();
    await expect(sy(page).locator('[data-sync-pick="c2"] sw-badge.lead')).toHaveAttribute('label', 'מובילה');
    const other = row.locator('sw-chip[data-sync-camera="c5"]');
    await expect(other).toHaveAttribute('disabled', '');
    await expect(other).toHaveAttribute('title', 'מקליט אחר');
    await row.locator('sw-chip[data-sync-camera="c1"]').click();
    await row.locator('sw-chip[data-sync-camera="c3"]').click();
    await row.locator('sw-chip[data-sync-camera="c4"]').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(4);
    await expect(row.locator('sw-chip[selected]')).toHaveCount(4);
    await expect(other).toHaveAttribute('title', 'מקליט אחר'); // the recorder reason wins over the limit
    await expect(launch(page)).toContainText('פתח השוואה (4)');
    // an un-pick of the lead: the next leads, the chip is free again
    await row.locator('sw-chip[data-sync-camera="c2"]').click();
    await expect(sy(page).locator('[data-sync-pick]')).toHaveCount(3);
    await expect(sy(page).locator('[data-sync-pick="c1"] sw-badge.lead')).toHaveAttribute('label', 'מובילה');
    await expect(row.locator('sw-chip[data-sync-camera="c2"]')).not.toHaveAttribute('disabled', '');
  });

  test('the installation\'s dropdown style and the phone bottom sheet apply to the picker', async ({ page }, info) => {
    await open(page, { cameras: MORE, settings: { 'ui.dd_style': 'field', 'ui.dd_phone': 'sheet' } });
    await expect(pick(page)).toHaveAttribute('dd-style', 'field');
    await chip(page).click();
    const pop = pick(page).locator('.pop');
    await expect(pop).toHaveAttribute('data-present', info.project.name === 'mobile' ? 'sheet' : 'pop');
    await option(page, 'c2').click();
    await foot(page).locator('[data-dd-done]').click();
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(chip(page).locator('[data-dd-chip-count]')).toHaveText('1 מתוך 4');
  });
});
