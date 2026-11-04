import { test, expect, type Page } from '@playwright/test';
import { ACCESS, D, FOLDS, installCardsMock, openAccess } from './settings-cards-mocks';

// SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a, "with the ability to change to b or c in Settings") against a MOCKED backend:
//   a (default) - the tab's sections are collapsible cards: a header = the title + a one-line summary of the saved values; one card open at
//                 a time; the last open card remembered per user; `&card=<id>` opens a card; every control works and saves from its card;
//   b           - two tabs: "מתגי מסכי כניסה" and "הכרזות וקול" (the announcements with the fixed engine, and the call banner);
//   c           - the single list of 2.40.0 (+ the layout row);
//   the layout row itself (סידור הלשונית) switches between them after its save.
//   ~/run_remote.sh spec <branch> tests/evidence-settings-intercom-cards-2401.spec.ts --project=desktop --project=mobile
const head = (page: Page, id: string) => page.locator(`${FOLDS} [data-fold-toggle="${id}"]`);
const summary = (page: Page, id: string) => page.locator(`${FOLDS} [data-fold-summary="${id}"]`);
const body = (page: Page, id: string) => page.locator(`${D} .afold-body[data-access-fold="${id}"]`);

test.describe('layout a: collapsible cards (the default)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('a header per card with its summary line; the first card is open; one card open at a time', async ({ page }) => {
    await installCardsMock(page);
    await openAccess(page);
    await expect(head(page, 'screens')).toHaveAttribute('aria-expanded', 'true', { timeout: 30_000 });
    await expect(head(page, 'calls')).toBeVisible({ timeout: 20_000 });
    for (const id of ['screens', 'area', 'display', 'announce', 'calls', 'parity', 'checklist', 'pairing', 'diagnostics']) await expect(head(page, id), id).toBeVisible();
    await expect(head(page, 'validation'), 'drawn only for who may run the acceptance check').toBeHidden();
    // the summaries are the saved values (the mock: overview / events / people on Arx)
    await expect(summary(page, 'screens')).toHaveText('Arx: מרכז הכניסה, פעילות, אנשים · השאר WisKey מוטמע');
    await expect(summary(page, 'area')).toHaveText('האזור מוצג · הטמעה בטלפון: כבויה · כרטיסים מתקפלים');
    await expect(summary(page, 'display')).toHaveText('רמז שיחה: כל מי שרואה את התחנה · דיבור: מוצג · וידאו: כבוי');
    await expect(summary(page, 'announce')).toHaveText('תחנה, מקום או כל התחנות · מנוע: ברירת המחדל · משפטים מובנים');
    await expect(summary(page, 'calls')).toHaveText('לכל מי שרשאי לענות · כל העמדות · עם צלצול');
    await expect(summary(page, 'parity')).toHaveText('עוד לא הורצה');
    await expect(summary(page, 'checklist')).toHaveText('0 מתוך 10 נבדקו');
    await expect(summary(page, 'pairing')).toContainText('דיבור מוכן');
    await expect(summary(page, 'diagnostics')).toHaveText('עדיין לא נבדק');
    await expect(body(page, 'screens')).toBeVisible();
    await expect(page.locator(`${D} select[data-set-access-ui="people"]`)).toBeVisible();
    await head(page, 'display').click();
    await expect(head(page, 'display')).toHaveAttribute('aria-expanded', 'true');
    await expect(head(page, 'screens')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`${FOLDS} [aria-expanded="true"]`)).toHaveCount(1);
    await expect(body(page, 'screens')).toBeHidden();
    await expect(page.locator(`${D} system-access-display[show="display"] select[data-set-access-display="access.call_hint"]`)).toBeVisible();
    // the display half has no announcement rows; the announcements half has no display rows
    await expect(page.locator(`${D} system-access-display[show="display"] [data-access-display-tts-engine]`)).toHaveCount(0);
    await expect(page.locator(`${D} system-access-display[show="announce"] select[data-set-access-display="access.call_hint"]`)).toHaveCount(0);
    // the parity report and the checklist are each a card
    await head(page, 'checklist').click();
    await page.locator(`${D} system-access-parity[show="checklist"] input[data-parity-item="overview:item_ringing"]`).check();
    await expect(summary(page, 'checklist')).toHaveText('1 מתוך 10 נבדקו');
    await head(page, 'parity').click();
    await page.locator(`${D} system-access-parity[show="report"] sw-button[data-parity-run]`).click();
    await expect(summary(page, 'parity')).toContainText('תואמים', { timeout: 20_000 });
  });

  test('the last open card is remembered for this user after a reload; `&card=` opens a card', async ({ page }) => {
    await installCardsMock(page);
    await openAccess(page);
    await head(page, 'announce').click({ timeout: 30_000 });
    await expect(head(page, 'announce')).toHaveAttribute('aria-expanded', 'true');
    const kept = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('sw.settings.access-cards.open.')));
    expect(kept).toHaveLength(1);
    expect(kept[0][1]).toBe('announce');
    await page.reload();
    await expect(head(page, 'announce')).toHaveAttribute('aria-expanded', 'true', { timeout: 30_000 });
    await openAccess(page, `${ACCESS}&card=pairing`, { clearStorage: false });
    await expect(head(page, 'pairing')).toHaveAttribute('aria-expanded', 'true', { timeout: 30_000 });
    await expect(page.locator(`${D} system-wiskey-pairing [data-wkp-verdict]`)).toBeVisible();
    // "הכרזות וקול" (layout b's tab) lands on the announcements card in layout a
    await openAccess(page, '/system/diagnostics?tab=access-voice', { clearStorage: false });
    await expect(head(page, 'announce')).toHaveAttribute('aria-expanded', 'true', { timeout: 30_000 });
  });

  test('the controls work from their cards: a screen switch, the fixed engine, the call banner - each saved by its own button', async ({ page }) => {
    const m = await installCardsMock(page);
    await openAccess(page);
    const people = page.locator(`${D} select[data-set-access-ui="people"]`);
    await expect(people).toBeEnabled({ timeout: 30_000 });
    await people.selectOption('wiskey');
    await expect(summary(page, 'screens')).toHaveText('יש שינויים שלא נשמרו · Arx: מרכז הכניסה, פעילות, אנשים · השאר WisKey מוטמע');
    await page.locator(`${D} sw-button[data-save-access-ui] button`).click();
    await expect.poll(() => m.access.patches.length).toBe(1);
    expect(m.access.patches[0]).toEqual({ 'access.ui.people': 'wiskey' });
    await expect(summary(page, 'screens')).toHaveText('Arx: מרכז הכניסה, פעילות · השאר WisKey מוטמע');
    // the announcements card: the TTS-DEFAULT-ENGINE-2400 rows, saved with the card's own button
    await head(page, 'announce').click();
    const announce = `${D} system-access-display[show="announce"]`;
    await expect(page.locator(`${announce} [data-access-display-tts-engine]`)).toBeVisible();
    await page.locator(`${announce} select[data-set-access-display="access.announce_scope"]`).selectOption('station');
    await page.locator(`${announce} [data-save-access-display]`).click();
    await expect.poll(() => m.access.patches.length).toBe(2);
    expect(m.access.patches[1]).toEqual({ 'access.announce_scope': 'station' });
    await expect(summary(page, 'announce')).toHaveText('תחנה אחת בכל פעם · מנוע: ברירת המחדל · משפטים מובנים');
    // the incoming-call banner
    await head(page, 'calls').click();
    await page.locator(`${D} system-call-banner select[data-call-banner-mode]`).selectOption('off');
    await page.locator(`${D} system-call-banner [data-save-call-banner]`).click();
    await expect.poll(() => m.callSaves.length).toBe(1);
    await expect(summary(page, 'calls')).toHaveText('כבוי');
  });
});

test.describe('the layout row switches the tab between a, b and c', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
  });

  test('a -> b: two tabs; b -> c: the single list; c -> a: the cards again', async ({ page }) => {
    const m = await installCardsMock(page);
    await openAccess(page);
    await head(page, 'area').click({ timeout: 30_000 });
    const layout = page.locator(`${D} select[data-set-access-layout]`);
    await expect(layout.locator('option')).toHaveText(['כרטיסים מתקפלים', 'שתי לשוניות', 'רשימה אחת']);
    await expect(layout).toHaveValue('cards');
    await layout.selectOption('tabs');
    await page.locator(`${D} sw-button[data-save-access-area] button`).click();
    await expect.poll(() => m.access.patches.at(-1)).toEqual({ 'access.settings_layout': 'tabs' });
    // b: the tab row holds "הכרזות וקול" right after "מתגי מסכי כניסה"; the display card stays here without the announcement rows
    const tabs = page.locator(`${D} sw-tabs[data-settings-tabs]`);
    await expect(tabs).toContainText('הכרזות וקול');
    await expect(page.locator(`${D} [data-access-layout="tabs"] system-access-display[show="display"] select[data-set-access-display="access.call_hint"]`)).toBeVisible();
    await expect(page.locator(`${D} system-access-display [data-access-display-tts-engine]`)).toHaveCount(0);
    await expect(page.locator(`${D} system-call-banner`)).toHaveCount(0);
    await openAccess(page, '/system/diagnostics?tab=access-voice', { clearStorage: false });
    const voice = `${D} [data-access-voice]`;
    await expect(page.locator(`${voice} system-access-display[show="announce"] [data-access-display-tts-engine]`)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${voice} system-call-banner sw-card[data-call-banner-setting="ready"]`)).toBeVisible();
    await expect(page.locator(`${D} sw-page`).first()).toHaveAttribute('heading', 'הכרזות וקול');
    // a card link in b opens the card's tab
    await openAccess(page, `${ACCESS}&card=calls`, { clearStorage: false });
    await expect(page.locator(`${voice} system-call-banner`)).toHaveCount(1, { timeout: 30_000 });
    // b -> c
    await openAccess(page, ACCESS, { clearStorage: false });
    await page.locator(`${D} select[data-set-access-layout]`).selectOption('list');
    await page.locator(`${D} sw-button[data-save-access-ui] button`).click();
    await expect.poll(() => m.access.patches.at(-1)).toEqual({ 'access.settings_layout': 'list' });
    const list = `${D} [data-access-layout="list"]`;
    await expect(page.locator(`${list} system-access-display[show="all"] [data-access-display-tts-engine]`)).toBeVisible();
    await expect(page.locator(`${list} system-access-display[show="all"] select[data-set-access-display="access.call_hint"]`)).toBeVisible();
    await expect(page.locator(`${list} system-call-banner`)).toHaveCount(1);
    await expect(page.locator(`${D} sw-fold-cards`)).toHaveCount(0);
    await expect(page.locator(`${D} sw-tabs[data-settings-tabs]`)).not.toContainText('הכרזות וקול');
    // c -> a
    await page.locator(`${D} select[data-set-access-layout]`).selectOption('cards');
    await page.locator(`${D} sw-button[data-save-access-ui] button`).click();
    await expect(head(page, 'screens')).toBeVisible({ timeout: 20_000 });
  });

  test('a viewer without system.configure sees the layout row read-only', async ({ page }) => {
    await installCardsMock(page, { persona: 'siteAdmin' });
    await openAccess(page);
    await head(page, 'area').click({ timeout: 30_000 });
    await expect(page.locator(`${D} select[data-set-access-layout]`)).toBeDisabled();
  });
});
