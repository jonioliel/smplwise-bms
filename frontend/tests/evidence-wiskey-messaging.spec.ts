import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, newMock, type PeopleMock } from './wiskey-people-mock';
import { settlePage } from './pixel-settle';
import { skinsUnderTest } from './helpers/frozen-skins';

// CR-036 WA: the people screen's WhatsApp - the real dialog (bulk with ONE confirmation, a stop button, a per-recipient result table, the
// rate and error states, the uncertain outcome) and the person's page "הודעות" tab (the message history and the "asked not to be messaged"
// switch) - against the mocked backend (tests/wiskey-people-mock.ts: the reply shapes of the message routes from
// tests/fixtures/messaging_wire.json, which the backend tests check against the real routes). No Home Assistant, no WisKey, no phone: the WisKey
// side of the messaging (ask W11) is unanswered and has only run against a fake. Desktop for the behaviour, then the skins x light / dark.
// Evidence screenshots go to docs/design/evidence/CR-036-WA/.
//   npx playwright test tests/evidence-wiskey-messaging.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-WA');
const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
const SCREEN = 'wiskey-people';
const NOW = '2026-10-12T10:00:00Z';

async function open(page: Page, st: PeopleMock, o: { skin?: string; scheme?: string } = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await install(page, st);
  await page.goto(`/?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const dialog = (page: Page) => page.locator('wiskey-message-dialog');
const drawer = (page: Page) => page.locator('wiskey-person-drawer');
const tab = (page: Page) => drawer(page).locator('wiskey-person-messages');
const sends = (st: PeopleMock) => st.writes.filter((w) => /\/messages$/.test(w.path));
const disabled = (l: Locator) => expect(l).toHaveAttribute('disabled', '');
const enabled = (l: Locator) => expect(l).not.toHaveAttribute('disabled', '');
const mock = (): PeopleMock => {
  const st = newMock('admin');
  st.messaging = true;
  return st;
};

async function selectAndOpen(page: Page, ids: string[]) {
  await page.locator(`${SCREEN} [data-people-select-mode]`).click();
  for (const id of ids) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
  await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
  await expect(dialog(page).locator('[data-msg-preview]')).toBeVisible();
}

test.describe('bulk send: one confirmation, a stop button, a result table', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
  });

  test('nothing is sent before the confirmation; "back" returns to the form with the text kept', async ({ page }) => {
    const st = mock();
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2', 'p3']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="confirm"]')).toContainText('לשלוח ל־3 אנשים?');
    await expect(d.locator('[data-msg-text]')).toBeDisabled(); // no edit between the confirmation and the run
    await expect(d.locator('[data-msg-template="closure"]')).toBeDisabled();
    expect(sends(st)).toEqual([]);
    await d.locator('[data-msg-back]').click();
    await expect(d.locator('[data-msg-line="confirm"]')).toHaveCount(0);
    await expect(d.locator('[data-msg-template="closure"]')).toHaveAttribute('aria-pressed', 'true');
    await enabled(d.locator('[data-msg-send]'));
    expect(sends(st)).toEqual([]);
  });

  test('the run goes one person at a time under one run id; the table lists everyone in the order picked', async ({ page }, info) => {
    const st = mock();
    st.msg.failFor = { p2: 'not_registered' };
    await open(page, st);
    await selectAndOpen(page, ['p2', 'p1', 'p3', 'p4', 'p5']);
    const d = dialog(page);
    await d.locator('[data-msg-template="card_ready"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible();
    // p4 asked not to be messaged, p5 has no phone: skipped at the preview; p2 is refused by the service; p1 and p3 are sent
    expect(sends(st).map((w) => w.path)).toEqual(['access-control/people/p2/messages', 'access-control/people/p1/messages', 'access-control/people/p3/messages']);
    const bodies = sends(st).map((w) => w.body as { bulk_id: string; bulk_total: number; template_id: string });
    expect(new Set(bodies.map((b) => b.bulk_id)).size).toBe(1);
    expect(bodies.every((b) => b.bulk_total === 3 && b.template_id === 'card_ready')).toBe(true);
    const rows = d.locator('[data-msg-result]');
    expect(await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-msg-result')}:${e.getAttribute('data-msg-outcome')}`))).toEqual(['p2:failed', 'p1:sent', 'p3:sent', 'p4:failed', 'p5:failed']);
    await expect(d.locator('[data-msg-result="p2"]')).toContainText('המספר אינו רשום בוואטסאפ');
    await expect(d.locator('[data-msg-result="p4"]')).toContainText('האדם ביקש לא לקבל הודעות');
    await expect(d.locator('[data-msg-line="bulk-done"]')).toContainText('נשלח ל־2');
    await expect(d.locator('[data-msg-line="bulk-done"]')).toContainText('3 לא נשלחו');
    await expect(d.locator('[data-msg-line="bulk-done"]')).toHaveAttribute('data-msg-tone', 'warn');
    await shot(page, info, 'bulk-result-partial');
    await d.locator('[data-msg-cancel]').click();
    await expect(page.locator(`${SCREEN} [data-people-bulk-count]`)).toHaveAttribute('data-people-bulk-count', '0'); // a run that sent something clears the selection
  });

  test('the progress is said, and the stop button ends the run after the message in flight', async ({ page }, info) => {
    const st = mock();
    st.msg.delayMs = 120_000; // the first message is held in flight (released below), so the run cannot end while the screenshot settles
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2', 'p3', 'p7']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="sending"]')).toContainText('שולח');
    await expect(d.locator('[data-msg-stop]')).toBeVisible();
    await shot(page, info, 'bulk-running');
    await d.locator('[data-msg-stop]').click();
    await expect(d.locator('[data-msg-line="sending"]')).toContainText('עוצר אחרי ההודעה הנוכחית');
    st.msg.delayMs = 0; // the message in flight goes; the run ends after it
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible({ timeout: 15_000 });
    expect(sends(st).length).toBe(1); // exactly the one that was in flight: nobody after it was tried
    const stopped = d.locator('[data-msg-result][data-msg-outcome="failed"]');
    await expect(stopped.first()).toContainText('הופסק לפני השליחה');
    await shot(page, info, 'bulk-stopped');
  });

  test('the hour\'s allowance ends the run for everyone after it; nobody after it is tried', async ({ page }, info) => {
    const st = mock();
    st.msg.quota = { limit: 9, used: 0 };
    st.msg.failFor = { p2: 'rate' };
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2', 'p3', 'p7']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible();
    expect(sends(st).map((w) => w.path)).toEqual(['access-control/people/p1/messages', 'access-control/people/p2/messages']);
    for (const id of ['p2', 'p3', 'p7']) await expect(d.locator(`[data-msg-result="${id}"]`)).toContainText('מכסת ההודעות מלאה');
    await expect(d.locator('[data-msg-result="p1"]')).toHaveAttribute('data-msg-outcome', 'sent');
    await shot(page, info, 'bulk-allowance');
  });

  test('a burst refusal (a moment of too many) is waited out and the same person tried again; the run completes', async ({ page }) => {
    const st = mock();
    st.msg.burst = 1;
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible({ timeout: 15_000 });
    await expect(d.locator('[data-msg-line="bulk-done"]')).toHaveAttribute('data-msg-tone', 'ok');
    // p1 was refused once (nothing sent), then went; p2 went: three requests, two messages
    expect(sends(st).map((w) => w.path)).toEqual(['access-control/people/p1/messages', 'access-control/people/p1/messages', 'access-control/people/p2/messages']);
    expect(st.msg.history.p1).toHaveLength(1);
  });

  test('an unknown outcome is said as unknown (never "not sent", never retried)', async ({ page }, info) => {
    const st = mock();
    st.msg.failFor = { p1: 'uncertain' };
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible();
    await expect(d.locator('[data-msg-result="p1"]')).toHaveAttribute('data-msg-outcome', 'unknown');
    await expect(d.locator('[data-msg-result="p1"]')).toContainText('בדקו עם הנמען');
    await expect(d.locator('[data-msg-result="p2"]')).toHaveAttribute('data-msg-outcome', 'sent');
    await expect(d.locator('[data-msg-line="bulk-done"]')).toContainText('1 לא ידוע');
    expect(sends(st).filter((w) => w.path.includes('/p1/'))).toHaveLength(1);
    await shot(page, info, 'bulk-unknown');
  });

  test('the service goes down in the middle: the rest are not sent for that reason, one line says so', async ({ page }) => {
    const st = mock();
    st.msg.failFor = { p2: 'service_down' };
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2', 'p3']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible();
    expect(sends(st).map((w) => w.path)).toEqual(['access-control/people/p1/messages', 'access-control/people/p2/messages']);
    await expect(d.locator('[data-msg-result="p3"]')).toContainText('שירות ההודעות אינו מחובר');
  });

  test('a person only the server knows is not eligible (the caller may not message them): skipped with the reason, nothing sent for them', async ({ page }) => {
    const st = mock();
    st.msg.failFor = { p3: 'forbidden' };
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p3']);
    const d = dialog(page);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible();
    await expect(d.locator('[data-msg-result="p3"]')).toContainText('אין לכם הרשאה');
    await expect(d.locator('[data-msg-result="p1"]')).toHaveAttribute('data-msg-outcome', 'sent');
  });

  test('past the first six the preview does not know: they are tried as the run reaches them, and a missing phone is said in the table', async ({ page }) => {
    const st = mock();
    st.msg.bulkMax = 12;
    st.msg.quota = { limit: 20, used: 0 };
    await open(page, st);
    // eight people; p5 has no phone and is the seventh in the selection - the preview looked at six
    await selectAndOpen(page, ['p1', 'p2', 'p3', 'p6', 'p7', 'p8', 'p5', 'p9']);
    const d = dialog(page);
    await expect(d.locator('[data-msg-preview]')).toContainText('יישלח ל־8'); // p5 is not known to lack a phone yet - the list row says it (sensitive level), so it is skipped here
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await d.locator('[data-msg-confirm]').click();
    await expect(d.locator('[data-msg-line="bulk-done"]')).toBeVisible({ timeout: 20_000 });
    await expect(d.locator('[data-msg-result="p5"]')).toContainText('אין מספר טלפון');
    expect(sends(st).some((w) => w.path.includes('/p5/'))).toBe(true); // it WAS tried: the server said no phone
  });

  test('Ctrl+Enter in a bulk dialog starts the confirmation, never the run', async ({ page }) => {
    const st = mock();
    await open(page, st);
    await selectAndOpen(page, ['p1', 'p2']);
    const d = dialog(page);
    await d.locator('[data-msg-free]').click();
    await d.locator('[data-msg-text]').fill('שלום לכולם');
    await d.locator('[data-msg-text]').press('Control+Enter');
    await expect(d.locator('[data-msg-line="confirm"]')).toBeVisible();
    expect(sends(st)).toEqual([]);
  });
});

test.describe('one person: the outcomes the sender must understand', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
  });

  async function single(page: Page, st: PeopleMock, id = 'p1') {
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="${id}"] [data-person-message-row]`).first().click();
    await expect(dialog(page).locator('[data-msg-recipient]')).toBeVisible();
    return dialog(page);
  }

  test('an uncertain outcome: said as such, the button says "send anyway", nothing is retried by itself', async ({ page }, info) => {
    const st = mock();
    st.msg.mode = 'uncertain';
    const d = await single(page, st);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="failed"]')).toContainText('לא ידוע אם ההודעה נשלחה');
    await expect(d.locator('[data-msg-line="failed"]')).toContainText('בדקו עם הנמען');
    await expect(d.locator('[data-msg-send]')).toContainText('שלח שוב בכל זאת');
    expect(sends(st)).toHaveLength(1);
    await shot(page, info, 'single-uncertain');
    // the history keeps it as unknown
    await d.locator('[data-msg-cancel]').click();
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await expect(tab(page).locator('[data-msg-history-item]')).toHaveAttribute('data-msg-outcome', 'unknown');
  });

  test('the catalogue changed while the dialog was open: said, the templates are read again, the next send carries the new revision', async ({ page }) => {
    const st = mock();
    st.msg.mode = 'template_changed';
    const d = await single(page, st);
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="failed"]')).toContainText('התבניות עודכנו');
    await expect(d.locator('[data-msg-text]')).toHaveValue(''); // the text the sender saw is not sent: they choose again
    st.msg.mode = 'ok';
    await d.locator('[data-msg-template="closure"]').click();
    await d.locator('[data-msg-send]').click();
    await expect(d.locator('[data-msg-line="sent"]')).toBeVisible();
    expect((sends(st).at(-1)!.body as { templates_revision: number }).templates_revision).toBe(4);
  });

  test('refusals about the person: not allowed, not found, the feature switched off meanwhile - one calm line each, one request each', async ({ page }, info) => {
    for (const [mode, expected] of [['forbidden', 'אין לכם הרשאה לשלוח לאדם הזה'], ['gone', 'האדם לא נמצא'], ['expired', 'ההודעה פגה']] as const) {
      const st = mock();
      st.msg.mode = mode;
      const ctx = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
      const p = await ctx.newPage();
      await open(p, st);
      await p.locator(`${SCREEN} [data-person-row="p1"] [data-person-message-row]`).first().click();
      const d = dialog(p);
      await d.locator('[data-msg-template="closure"]').click();
      await d.locator('[data-msg-send]').click();
      await expect(d.locator('[data-msg-line="failed"]')).toContainText(expected);
      expect(sends(st), mode).toHaveLength(1);
      await ctx.close();
    }
  });

  test('Ctrl+Enter sends a single message; the free text is checked before it goes', async ({ page }) => {
    const st = mock();
    const d = await single(page, st);
    await d.locator('[data-msg-free]').click();
    await d.locator('[data-msg-text]').fill('הקוד שלך 1234');
    await disabled(d.locator('[data-msg-send]'));
    await d.locator('[data-msg-text]').press('Control+Enter');
    expect(sends(st)).toEqual([]);
    await d.locator('[data-msg-text]').fill('שלום, נפגש מחר');
    await d.locator('[data-msg-text]').press('Control+Enter');
    await expect(d.locator('[data-msg-line="sent"]')).toBeVisible();
    expect(sends(st)).toHaveLength(1);
  });
});

test.describe("the person's page: the messages tab", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
  });

  test('the tab exists for a caller who may message (even for a person with no phone); an empty history says so', async ({ page }, info) => {
    const st = mock();
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p5"]`).click(); // no phone: no "send" button, but the history and the switch stay
    await expect(drawer(page).locator('[data-person-tab="messages"]')).toBeVisible();
    await expect(drawer(page).locator('[data-person-message]')).toHaveCount(0);
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await expect(tab(page).locator('[data-msg-history-empty]')).toBeVisible();
    await expect(tab(page).locator('[data-msg-optout]')).toHaveAttribute('aria-checked', 'false');
    await shot(page, info, 'history-empty');
  });

  test('a message sent from the page appears in the history at once: who, which template, when, "sent" - and never the text', async ({ page }, info) => {
    const st = mock();
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await expect(tab(page).locator('[data-msg-history-empty]')).toBeVisible();
    await drawer(page).locator('[data-person-message]').click();
    await dialog(page).locator('[data-msg-template="card_ready"]').click();
    await dialog(page).locator('[data-msg-send]').click();
    await expect(dialog(page).locator('[data-msg-line="sent"]')).toBeVisible();
    await dialog(page).locator('[data-msg-send]').click(); // "send again": a free text this time would need the free chip - here the same template again
    await expect(dialog(page).locator('[data-msg-line="sent"]')).toBeVisible();
    await dialog(page).locator('[data-msg-cancel]').click();
    const items = tab(page).locator('[data-msg-history-item]');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('כרטיס מוכן');
    await expect(items.first()).toContainText('נשלח ע״י בודק');
    await expect(items.first().locator('sw-badge')).toHaveAttribute('label', 'נשלח');
    expect(await tab(page).innerText()).not.toContain('כרטיס הכניסה שלך מוכן'); // the text is not kept anywhere, so it is not shown
    await shot(page, info, 'history-list');
  });

  test('the outcomes in the history: a free text, a refusal, an unknown outcome, a bulk run', async ({ page }, info) => {
    const st = mock();
    const at = '2026-10-12T08:21:00Z';
    st.msg.history.p1 = [
      { id: 'a', at, by: 'מנהל אתר', kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה', outcome: 'unknown', reason: 'uncertain', bulk: true },
      { id: 'b', at: '2026-10-11T16:02:00Z', by: 'בודק', kind: 'free', template_id: null, template_label: null, outcome: 'refused', reason: 'not_registered', bulk: false },
      { id: 'c', at: '2026-10-10T09:00:00Z', by: 'בודק', kind: 'template', template_id: 'old', template_label: null, outcome: 'sent', reason: null, bulk: false },
      { id: 'd', at: '2026-10-12T10:00:00Z', by: null, kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה', outcome: 'pending', reason: null, bulk: false },
    ];
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    const items = tab(page).locator('[data-msg-history-item]');
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText('שליחה לרבים');
    await expect(items.nth(0).locator('sw-badge')).toHaveAttribute('label', 'לא ידוע');
    await expect(items.nth(1)).toContainText('הודעה חופשית');
    await expect(items.nth(1).locator('sw-badge')).toHaveAttribute('label', 'לא נשלח');
    await expect(items.nth(2)).toContainText('תבנית שנמחקה'); // a template removed later still reads
    await expect(items.nth(3).locator('sw-badge')).toHaveAttribute('label', 'בשליחה');
    await shot(page, info, 'history-outcomes');
  });

  test('the "asked not to be messaged" switch: on -> the person cannot be messaged, off -> they can; each change is one request', async ({ page }, info) => {
    const st = mock();
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    const sw = tab(page).locator('[data-msg-optout]');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(tab(page).locator('[data-msg-optout-by]')).toContainText('סומן ע״י בודק');
    expect(st.writes.filter((w) => /optout$/.test(w.path))).toEqual([{ path: 'access-control/people/p1/messages/optout', body: { opted_out: true } }]);
    await shot(page, info, 'optout-on');
    await drawer(page).locator('[data-person-message]').click();
    await expect(dialog(page).locator('[data-msg-consent="declined"]')).toBeVisible();
    await expect(dialog(page).locator('[data-msg-line="cant"]')).toContainText('האדם ביקש לא לקבל הודעות');
    await disabled(dialog(page).locator('[data-msg-send]'));
    await dialog(page).locator('[data-msg-cancel]').click();
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await drawer(page).locator('[data-person-message]').click();
    await dialog(page).locator('[data-msg-template="closure"]').click();
    await enabled(dialog(page).locator('[data-msg-send]'));
    // the person WisKey says declined stays declined whatever the list says
    await dialog(page).locator('[data-msg-cancel]').click();
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} [data-person-row="p4"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await expect(tab(page).locator('[data-msg-optout]')).toHaveAttribute('aria-checked', 'false'); // Arx's own list is empty for p4 ...
    await drawer(page).locator('[data-person-message]').click();
    await expect(dialog(page).locator('[data-msg-consent="declined"]')).toBeVisible(); // ... and the service's "declined" still blocks
  });

  test('a failed change puts the switch back and says so; a failed read says so with a retry', async ({ page }) => {
    const st = mock();
    await open(page, st);
    await page.route('**/api/v1/access-control/people/p1/messages/optout', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'x', user_message: 'x', retryable: false, correlation_id: '', details: {} }) }));
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await tab(page).locator('[data-msg-optout]').click();
    await expect(tab(page).locator('[data-msg-optout-error]')).toContainText('השינוי לא נשמר');
    await expect(tab(page).locator('[data-msg-optout]')).toHaveAttribute('aria-checked', 'false');
    st.msg.historyFails = 503;
    await drawer(page).locator('[data-person-tab="details"]').click();
    await drawer(page).locator('[data-person-tab="messages"]').click(); // the tab reads again when it is opened again
    await expect(tab(page).locator('[data-msg-history-state="error"]')).toBeVisible();
    st.msg.historyFails = 0;
    await tab(page).locator('sw-state-panel').locator('button, sw-button').first().click();
    await expect(tab(page).locator('[data-msg-history-state="ready"]')).toBeVisible();
  });

  test('no permission, no tab; the switch off, no tab; a names-level sender still sees it', async ({ page }, info) => {
    const none = newMock('admin');
    await open(page, none);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(page).locator('[data-person-tab]')).toHaveCount(3);
    expect(none.hits.filter((h) => /messages|messaging/.test(h))).toEqual([]);
    const ctx = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
    const p2 = await ctx.newPage();
    const op = newMock('operator');
    op.messaging = true;
    await open(p2, op);
    await p2.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await expect(drawer(p2).locator('[data-person-tab]')).toHaveCount(4);
    await drawer(p2).locator('[data-person-tab="messages"]').click();
    await expect(drawer(p2).locator('wiskey-person-messages [data-msg-history-state="ready"]')).toBeVisible();
    await ctx.close();
  });

  test('copy hygiene: no platform name, no internal code, no permission id in the dialog or the tab', async ({ page }) => {
    const st = mock();
    await open(page, st);
    await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
    await drawer(page).locator('[data-person-tab="messages"]').click();
    await expect(tab(page).locator('[data-msg-history-state="ready"]')).toBeVisible();
    await drawer(page).locator('[data-person-message]').click();
    await dialog(page).locator('[data-msg-template="closure"]').click();
    const text = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (n: Node) => {
        if (n instanceof Element) for (const a of ['aria-label', 'title', 'placeholder', 'heading', 'label']) n.getAttribute(a) && out.push(n.getAttribute(a)!);
        if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) out.push(n.textContent.trim());
        if (n instanceof Element && n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
        n.childNodes.forEach(walk);
      };
      const find = (root: Document | ShadowRoot, tag: string): Element | null => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === tag) return el;
          const inner = el.shadowRoot && find(el.shadowRoot, tag);
          if (inner) return inner;
        }
        return null;
      };
      for (const tag of ['WISKEY-MESSAGE-DIALOG', 'WISKEY-PERSON-MESSAGES']) walk(find(document, tag)!);
      return out.join('\n');
    });
    expect(text).not.toMatch(/WisKey|Home Assistant|Ingress|hikvision|add-on|תוסף|\bHA\b/i);
    expect(text).not.toMatch(/\bCR-\d+|\bS\d+\b|access\.[a-z]+\.[a-z]+|message_[a-z_]+|whatsapp\//);
  });
});

test.describe('the messaging in every skin (light and dark, one project each)', () => {
  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: the person's tab, the single dialog, the bulk result`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'one project');
        const st = mock();
        st.msg.failFor = { p2: 'not_registered' };
        st.msg.history.p1 = [
          { id: 'a', at: '2026-10-12T08:21:00Z', by: 'מנהל אתר', kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה', outcome: 'sent', reason: null, bulk: true },
          { id: 'b', at: '2026-10-11T16:02:00Z', by: 'בודק', kind: 'free', template_id: null, template_label: null, outcome: 'refused', reason: 'not_registered', bulk: false },
        ];
        await open(page, st, { skin, scheme });
        await page.locator(`${SCREEN} [data-person-row="p1"]`).click();
        await drawer(page).locator('[data-person-tab="messages"]').click();
        await expect(tab(page).locator('[data-msg-history-item]')).toHaveCount(2);
        await shot(page, info, `tab-${skin}-${scheme}`);
        await drawer(page).locator('[data-person-message]').click();
        await dialog(page).locator('[data-msg-template="card_ready"]').click();
        await shot(page, info, `dialog-${skin}-${scheme}`);
        await dialog(page).locator('[data-msg-cancel]').click();
        await page.keyboard.press('Escape');
        await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0);
        await selectAndOpen(page, ['p1', 'p2', 'p3', 'p4']);
        await dialog(page).locator('[data-msg-template="closure"]').click();
        await dialog(page).locator('[data-msg-send]').click();
        await expect(dialog(page).locator('[data-msg-line="confirm"]')).toBeVisible();
        await shot(page, info, `confirm-${skin}-${scheme}`);
        await dialog(page).locator('[data-msg-confirm]').click();
        await expect(dialog(page).locator('[data-msg-results]')).toBeVisible();
        await shot(page, info, `result-${skin}-${scheme}`);
      });
    }
  }
});
