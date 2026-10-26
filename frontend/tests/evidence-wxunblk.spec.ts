import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBlocksMock, manyEntities, newBlocksMock, openSetup, siteAdminPerms, ENTITIES, type BlocksMock } from './wxunblk-mocks';
import { settlePage } from './pixel-settle';
import { skinsUnderTest } from './helpers/frozen-skins';

// WXUNBLK (owner 2026-10-13) against the mocked backend (tests/wxunblk-mocks.ts): Settings > חיבורים > "חסימות פתיחת דלתות". Nothing here
// reaches a Home Assistant, a WisKey, a station or a door. What it pins:
//   - the list: the virtual devices with their state and the items that use them, the saved items the door path refuses with the reason;
//   - a release is a switch, then a short question that ASKS WHY (checked before anything is sent), then one write with the note and the
//     confirmation; the row then says who, when and why and the items it frees leave the blocked state; blocking again is the same;
//   - an item that opens an intercom door has no switch of its own and stays blocked whatever is released; a device mapped to a door has none;
//   - search, the status filter and "show more" on a long list; the states (loading, nothing to block, failure, refused write).
// Evidence screenshots: docs/design/evidence/WX-small/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-wxunblk.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WX-small');
const CARD = 'sw-door-blocks sw-card[data-door-blocks-card]';
const row = (id: string) => `sw-door-blocks [data-door-block="${id}"]`;
const item = (key: string) => `sw-door-blocks [data-door-block-item="${key}"]`;
// a modal dialog's host has no box of its own (its layer is fixed): `open` says it is up, `.box` is what is drawn
const DIALOG = 'sw-door-blocks sw-dialog[data-door-block-dialog]';

async function boot(page: Page, m: BlocksMock, o: { skin?: string; scheme?: 'light' | 'dark'; ready?: boolean } = {}): Promise<string[]> {
  await installBlocksMock(page, m);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openSetup(page, o);
  if (o.ready !== false) await expect(page.locator(CARD)).toBeVisible({ timeout: 30_000 });
  return errors;
}

async function shot(page: Page, info: TestInfo, name: string, target: string, width = 1440, suffix = info.project.name, settle = true) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  // the card is taller than a laptop screen and the page scrolls inside the shell: a tall window shows it whole
  if (target === CARD) await page.setViewportSize({ width, height: 2600 });
  if (settle) await settlePage(page); // a state that is waiting for an answer must not wait for the network to go quiet
  await page.locator(target).first().screenshot({ path: path.join(EVIDENCE, `${name}-${suffix}.png`) });
}

const toggle = (page: Page, id: string) => page.locator(`${row(id)} sw-toggle[data-door-block-toggle]`);
const checked = (page: Page, id: string) => toggle(page, id).evaluate((el) => (el as HTMLElement & { checked: boolean }).checked);

test.describe('WXUNBLK: the blocks card in Settings', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the widths are the layout guard\'s');
  });

  test('lists the virtual devices and the items the door path refuses, by name, with the reason', async ({ page }, info) => {
    const m = newBlocksMock();
    const errors = await boot(page, m);
    await expect(page.locator('sw-door-blocks [data-door-blocks-summary]')).toHaveText('5 חסומים · 0 משוחררים · 5 פריטים חסומים');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(6);
    const gate = row('switch.gate');
    await expect(page.locator(gate)).toContainText('שער חצר');
    await expect(page.locator(gate)).toContainText('מתג · חצר');
    await expect(page.locator(gate)).toHaveAttribute('data-door-block-state', 'blocked');
    await expect(page.locator(`${gate} [data-door-block-used]`)).toHaveText('בשימוש: כניסה ושער, מבואה בערב, פתיחת שער');
    await expect(page.locator(`${gate} sw-badge`)).toHaveAttribute('label', 'חסום');
    expect(await checked(page, 'switch.gate')).toBe(false);
    // a device mapped to an intercom door has no switch
    await expect(page.locator(row('lock.mapped'))).toHaveAttribute('data-door-block-state', 'door');
    await expect(page.locator(`${row('lock.mapped')} sw-toggle`)).toHaveCount(0);
    await expect(page.locator(`${row('lock.mapped')} sw-badge`)).toHaveAttribute('label', 'משויך לדלת');
    // the items: a real door step says what the guard does and why it stays; a device item names its devices
    await expect(page.locator('sw-door-blocks [data-door-block-item]')).toHaveCount(5);
    await expect(page.locator(`${item('automation:entrance')} [data-door-block-door]`)).toHaveText('הרצה מ-Arx נחסמת: יש בפריט פתיחת דלת שלא הוסבה · פתיחת דלתות מאוטומציה עדיין לא נתמכת');
    await expect(page.locator(`${item('script:open_gate')} [data-door-block-devices]`)).toHaveText('התקנים וירטואליים: שער חצר');
    await expect(page.locator(`${item('automation:evening')} [data-door-block-devices]`)).toHaveText('התקנים וירטואליים: מנורת מבואה, שער חצר');
    await expect(page.locator(`${item('script:open_gate')} sw-badge`)).toHaveAttribute('label', 'חסום');
    // names only: no entity id is drawn
    const text = await page.locator(CARD).innerText();
    for (const e of ENTITIES) expect(text, e.entity_id).not.toContain(e.entity_id);
    expect(m.puts).toEqual([]);
    await shot(page, info, 'door-blocks-list', CARD);
    expect(errors).toEqual([]);
  });

  test('releasing a device asks WHY first, then sends one write with the reason; the row says who, when and why; the items it frees leave the list of blocked', async ({ page }, info) => {
    const m = newBlocksMock();
    const errors = await boot(page, m);
    await toggle(page, 'switch.gate').click();
    const dialog = page.locator(DIALOG);
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog).toHaveAttribute('heading', 'שחרור התקן וירטואלי');
    await expect(dialog).toContainText('שער חצר');
    await expect(dialog).toContainText('גם אם הוא פותח דלת אינטרקום');
    // the reason is required: nothing is sent until it is a reason
    const ok = page.locator('sw-door-blocks sw-button[data-door-block-ok]');
    await ok.click();
    await expect(page.locator('sw-door-blocks [data-door-block-problem]')).toHaveText('נדרשת סיבה (לפחות 3 תווים)');
    await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill('  מתג   רגיל\nשל הדייר  ');
    await expect(page.locator('sw-door-blocks [data-door-block-problem]')).toHaveCount(0);
    expect(m.puts).toEqual([]);
    await shot(page, info, 'door-blocks-release-dialog', `${DIALOG} .box`);
    await ok.click();
    await expect(dialog).toHaveCount(0);
    expect(m.puts).toEqual([{ entity_id: 'switch.gate', body: { unblocked: true, note: 'מתג רגיל של הדייר', confirmed: true } }]);
    // the list is read again and shows the release
    await expect(page.locator(row('switch.gate'))).toHaveAttribute('data-door-block-state', 'unblocked');
    await expect(page.locator(`${row('switch.gate')} [data-door-block-why]`)).toHaveText('מתג רגיל של הדייר');
    await expect(page.locator(`${row('switch.gate')} [data-door-block-when]`)).toContainText('שוחרר בידי יוני');
    await expect(page.locator(`${row('switch.gate')} sw-badge`)).toHaveAttribute('label', 'משוחרר');
    expect(await checked(page, 'switch.gate')).toBe(true);
    await expect(page.locator('sw-door-blocks [data-door-blocks-summary]')).toHaveText('4 חסומים · 1 משוחררים · 4 פריטים חסומים');
    // the script that only used this switch is freed; the automation that uses it AND the light is not; the door ones stay
    await expect(page.locator(item('script:open_gate'))).toHaveAttribute('data-blocked', 'false');
    await expect(page.locator(`${item('script:open_gate')} sw-badge`)).toHaveAttribute('label', 'אינו חסום עוד');
    await expect(page.locator(item('automation:evening'))).toHaveAttribute('data-blocked', 'true');
    await expect(page.locator(item('automation:entrance_and_gate'))).toHaveAttribute('data-blocked', 'true');
    await expect(page.locator(`${item('automation:entrance_and_gate')} [data-door-block-devices]`)).toHaveText('התקנים וירטואליים: שער חצר (משוחרר)');
    await shot(page, info, 'door-blocks-released', CARD);
    expect(errors).toEqual([]);
  });

  test('cancelling the question sends nothing and the switch goes back to where the server has it', async ({ page }) => {
    const m = newBlocksMock();
    await boot(page, m);
    await toggle(page, 'light.hall').click();
    await expect(page.locator(DIALOG)).toHaveAttribute('open', '');
    await page.locator('sw-door-blocks sw-button[data-door-block-cancel]').click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await checked(page, 'light.hall')).toBe(false);
    // Escape closes it too
    await toggle(page, 'light.hall').click();
    await expect(page.locator(DIALOG)).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await checked(page, 'light.hall')).toBe(false);
    expect(m.puts).toEqual([]);
  });

  test('blocking a released device again: the question (a reason is optional), one write, and the items are blocked as before', async ({ page }, info) => {
    const m = newBlocksMock({ released: { 'switch.gate': { note: 'מתג רגיל של הדייר', by: 'יוני', at: '2026-10-12T07:00:00Z' } } });
    await boot(page, m);
    await expect(page.locator(item('script:open_gate'))).toHaveAttribute('data-blocked', 'false');
    await toggle(page, 'switch.gate').click();
    const dialog = page.locator(DIALOG);
    await expect(dialog).toHaveAttribute('heading', 'החזרת חסימה להתקן');
    await shot(page, info, 'door-blocks-reblock-dialog', `${DIALOG} .box`);
    await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
    await expect(dialog).toHaveCount(0);
    expect(m.puts).toEqual([{ entity_id: 'switch.gate', body: { unblocked: false, confirmed: true } }]);
    await expect(page.locator(row('switch.gate'))).toHaveAttribute('data-door-block-state', 'blocked');
    await expect(page.locator(`${row('switch.gate')} [data-door-block-why]`)).toHaveCount(0);
    expect(await checked(page, 'switch.gate')).toBe(false);
    await expect(page.locator(item('script:open_gate'))).toHaveAttribute('data-blocked', 'true');
    // with a reason, when the administrator gives one
    await toggle(page, 'light.hall').click();
    await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill('שחרור בטעות');
    await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(m.puts.at(-1)).toEqual({ entity_id: 'light.hall', body: { unblocked: true, note: 'שחרור בטעות', confirmed: true } });
  });

  test('an item that opens an intercom door has no switch and stays blocked even when every device is released', async ({ page }) => {
    const m = newBlocksMock();
    await boot(page, m);
    for (const id of ['switch.gate', 'light.hall', 'lock.virtual', 'cover.shutter', 'media_player.uni']) {
      await toggle(page, id).click();
      await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill(`שחרור ${id}`);
      await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
      await expect(page.locator(DIALOG)).toHaveCount(0);
      await expect(page.locator(row(id))).toHaveAttribute('data-door-block-state', 'unblocked');
    }
    await expect(page.locator('sw-door-blocks [data-door-block-item] sw-toggle')).toHaveCount(0);
    for (const key of ['automation:entrance', 'automation:entrance_and_gate']) {
      await expect(page.locator(item(key))).toHaveAttribute('data-blocked', 'true');
      await expect(page.locator(item(key))).toHaveAttribute('data-opens-door', 'true');
      await expect(page.locator(`${item(key)} [data-door-block-door]`)).toContainText('פתיחת דלתות מאוטומציה עדיין לא נתמכת');
    }
    await expect(page.locator(`${item('automation:entrance_and_gate')}`)).toContainText('נשאר חסום גם אחרי שחרור ההתקנים');
    for (const key of ['script:open_gate', 'automation:evening', 'script:virtual_door']) await expect(page.locator(item(key))).toHaveAttribute('data-blocked', 'false');
    await expect(page.locator('sw-door-blocks [data-door-blocks-summary]')).toHaveText('0 חסומים · 5 משוחררים · 2 פריטים חסומים');
  });

  test('a refusal of the server is said in the question and nothing changes; a failed read has a retry', async ({ page }) => {
    const m = newBlocksMock({ putFail: { status: 409, code: 'not_overridable', message: 'ההתקן אינו חסום.' } });
    await boot(page, m);
    await toggle(page, 'lock.virtual').click();
    await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill('ניסיון שנדחה');
    await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
    await expect(page.locator('sw-door-blocks [data-door-block-problem]')).toContainText('ההתקן אינו חסום');
    await expect(page.locator(DIALOG)).toHaveAttribute('open', '');
    await page.locator('sw-door-blocks sw-button[data-door-block-cancel]').click();
    await expect(page.locator(row('lock.virtual'))).toHaveAttribute('data-door-block-state', 'blocked');
    expect(await checked(page, 'lock.virtual')).toBe(false);
    // the list read fails: the error with a retry, and the retry reads again
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const failing = newBlocksMock({ getStatus: 500 });
    await boot(page, failing, { ready: false });
    await expect(page.locator('sw-door-blocks sw-state-panel[data-door-blocks-state="error"]')).toBeVisible({ timeout: 30_000 });
    failing.getStatus = null;
    await page.locator('sw-door-blocks sw-state-panel[data-door-blocks-state="error"]').getByRole('button').click();
    await expect(page.locator(CARD)).toBeVisible();
  });

  test('a write that went through shows the row as the server holds it even when the re-read of the list fails', async ({ page }) => {
    const m = newBlocksMock();
    await boot(page, m);
    await toggle(page, 'switch.gate').click();
    await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill('שחרור לפני תקלת קריאה');
    m.getStatus = 500; // the write below succeeds; the list read right after it does not
    await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(m.puts).toEqual([{ entity_id: 'switch.gate', body: { unblocked: true, note: 'שחרור לפני תקלת קריאה', confirmed: true } }]);
    await expect(page.locator(row('switch.gate'))).toHaveAttribute('data-door-block-state', 'unblocked');
    expect(await checked(page, 'switch.gate')).toBe(true);
    await expect(page.locator(`${CARD} .err[role="alert"]`)).toBeVisible();
  });

  test('without a door in the installation nothing is blocked and the card says so', async ({ page }) => {
    await boot(page, newBlocksMock({ present: false }));
    await expect(page.locator('sw-door-blocks [data-door-blocks-none]')).toBeVisible();
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(0);
    await expect(page.locator('sw-door-blocks [data-door-blocks-summary]')).toHaveText('אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום');
  });

  test('search, the status filter and "show more" keep a long list usable', async ({ page }, info) => {
    const m = newBlocksMock({ entities: [...ENTITIES.map((e) => ({ ...e })), ...manyEntities(120)] });
    await boot(page, m);
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(50);
    await expect(page.locator('sw-door-blocks sw-button[data-door-blocks-more]')).toContainText('הצג עוד (76)');
    await page.locator('sw-door-blocks sw-button[data-door-blocks-more]').click();
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(100);
    await page.locator('sw-door-blocks sw-button[data-door-blocks-more]').click();
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(126);
    await expect(page.locator('sw-door-blocks sw-button[data-door-blocks-more]')).toHaveCount(0);
    // a search narrows the whole list (not only the page shown) and starts again from the first page
    const search = page.locator('sw-door-blocks input[data-door-blocks-search]');
    await search.fill('תאורה 07');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(12); // 007, 070 .. 079 and 107: every word must appear
    await search.fill('living');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(1);
    await expect(page.locator(row('cover.shutter'))).toBeVisible();
    await search.fill('light.tpl_120');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(1);
    await search.fill('zzz');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(0);
    await expect(page.locator('sw-door-blocks sw-state-panel').filter({ hasText: 'אין התאמות לחיפוש' })).toBeVisible();
    await search.fill('');
    // the status filter: released ones only
    await toggle(page, 'switch.gate').click();
    await page.locator('sw-door-blocks textarea[data-door-block-note-input]').fill('שחרור לבדיקה');
    await page.locator('sw-door-blocks sw-button[data-door-block-ok]').click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    await page.locator('sw-door-blocks sw-chip[data-door-blocks-filter="released"]').click();
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(1);
    await expect(page.locator(row('switch.gate'))).toBeVisible();
    await search.fill('לבדיקה');
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(1); // the reason of a release is searched too
    await page.locator('sw-door-blocks sw-chip[data-door-blocks-filter="blocked"]').click();
    await expect(page.locator('sw-door-blocks [data-door-block]')).toHaveCount(0);
    await shot(page, info, 'door-blocks-filtered', CARD);
  });

  test('the states of the card - nothing to block, a failed read, loading - and the card and its question on a phone (390 px)', async ({ page }, info) => {
    // nothing to block
    await boot(page, newBlocksMock({ present: false }));
    await shot(page, info, 'door-blocks-empty', CARD);
    // a failed read
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, newBlocksMock({ getStatus: 500 }), { ready: false });
    await expect(page.locator('sw-door-blocks sw-state-panel[data-door-blocks-state="error"]')).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'door-blocks-error', 'sw-door-blocks sw-state-panel[data-door-blocks-state="error"]');
    // the phone: the list, and the question of a release
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, newBlocksMock({ released: { 'light.hall': { note: 'מנורה רגילה של הדייר', by: 'יוני', at: '2026-10-12T07:00:00Z' } } }));
    await shot(page, info, 'door-blocks-list', CARD, 390, '390');
    await toggle(page, 'switch.gate').click();
    await expect(page.locator(DIALOG)).toHaveAttribute('open', '');
    await shot(page, info, 'door-blocks-release-dialog', `${DIALOG} .box`, 390, '390');
    // loading: the list read is held (last, the held read is never answered)
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, newBlocksMock({ getDelay: 120_000 }), { ready: false });
    const loading = 'sw-door-blocks sw-state-panel[data-door-blocks-state="loading"]';
    await expect(page.locator(loading)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'door-blocks-loading', loading, 1440, info.project.name, false);
  });

  test('only a system administrator is offered the card', async ({ page }) => {
    await boot(page, newBlocksMock({ perms: siteAdminPerms }), { ready: false });
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
    await expect(page.locator('sw-door-blocks')).toHaveCount(0);
  });

  test('every skin and both schemes draw the card: no page error, no sideways scroll', async ({ page }, info) => {
    const m = newBlocksMock({ released: { 'light.hall': { note: 'מנורה רגילה של הדייר', by: 'יוני', at: '2026-10-12T07:00:00Z' } } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await installBlocksMock(page, m);
    for (const skin of skinsUnderTest(['classic', 'bubble'])) {
      for (const scheme of ['light', 'dark'] as const) {
        await openSetup(page, { skin, scheme });
        await expect(page.locator(CARD)).toBeVisible({ timeout: 30_000 });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over, `${skin} ${scheme}: horizontal overflow of the page`).toBeLessThanOrEqual(1);
        if (skin === 'classic') await shot(page, info, `door-blocks-${skin}-${scheme}`, CARD);
      }
    }
    expect(errors).toEqual([]);
  });
});
