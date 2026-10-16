import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS, installTicketsMock, url } from './tickets-mocks';
import { installConvMock, VID, type ConvMock } from './tickets-conv-mocks';

// TKUI2 (2.6.0) evidence: the request's Conversation and History tabs from the REAL build against the mock layer (fake data only) - the
// sub-tabs "עם הספק" / "הצוות", the two composers (never both, different colour / icon / verb, no visibility checkbox), the forward =
// pre-fill rule and the routes it calls (contract v1.3 §6.1), Enter vs Ctrl+Enter, the delivery words, "הודעות קודמות", the one "הערות"
// feed without a vendor, and History's filters, files and audit card. Desktop 1440 and phone 390, light and dark, the five skins (the
// vendor feed). Screenshots: docs/design/evidence/tickets-ui2/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-conversation.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui2');
const L = 'sw-app tickets-list ticket-detail';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;
const d = (page: Page) => page.locator(L);

async function go(page: Page, hash: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', o: Parameters<typeof installConvMock>[1] = {}): Promise<ConvMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installConvMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  await d(page).locator('[data-status-block]').waitFor();
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

const last = (m: ConvMock, re: RegExp) => [...m.calls].reverse().find((c) => re.test(c.path));
const CONV = `/tickets/all?t=${VID}&tab=conv`;

test.describe('TKUI2 conversation / history evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390 (the tablet runs the layout guard)');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('"עם הספק": the vendor feed, the delivery words, the vendor composer only - five skins, light and dark', async ({ page }) => {
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, CONV, scheme, skin);
        await d(page).locator('[data-conv-feed="vendor"]').waitFor();
        if (skin === 'classic' || skin === 'domus' || scheme === 'light') await shot(page, 'conv-vendor', scheme, skin);
      }
    const c = d(page).locator('[data-conv]');
    await expect(c.locator('[data-conv-sub]')).toHaveCount(2);
    await expect(c.locator('[data-conv-sub="vendor"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(c.locator('[data-conv-caption]')).toHaveText('הספק רואה את ההודעות כאן · WhatsApp ודף הקישור');
    // ONE composer: the vendor's - its verb, its icon, the vendor's name and channel; no visibility checkbox anywhere in the tab
    await expect(c.locator('[data-composer]')).toHaveCount(1);
    await expect(c.locator('[data-composer="vendor"]')).toBeVisible();
    await expect(c.locator('[data-composer-send="vendor"]')).toHaveText('שליחה למשה');
    await expect(c.locator('[data-composer-text]')).toHaveAttribute('placeholder', 'הודעה למשה ב-WhatsApp ובדף הקישור');
    await expect(c.locator('input[type="checkbox"]')).toHaveCount(0);
    // the feed: the last 20, incoming on one side, outgoing with their delivery words, internal notes never here
    await expect(c.locator('[data-conv-log] [data-item]')).toHaveCount(20);
    await expect(c.locator('[data-type="internal_note"]')).toHaveCount(0);
    await expect(c.locator('[data-dir="in"]').last()).toContainText('בדרך, 20 דקות.');
    await expect(c.locator('[data-dir="in"]').last()).toContainText('תשובה בוואטסאפ (שולח לא מאומת)');
    await expect(c.locator('[data-dir="out"]').last().locator('[data-delivery-line]')).toHaveText('הקישור נפתח אחרי ההודעה');
    await expect(c.locator('[data-message="ob-2"] [data-message-line]')).toContainText('ייתכן שנשלח');
    for (const word of ['נמסר', 'נקרא']) await expect(c.locator('[data-conv-feed]')).not.toContainText(word); // D14
    // "הודעות קודמות" renders the rest in place (no inner scroll box)
    await c.locator('[data-conv-older]').click();
    await expect(c.locator('[data-conv-older]')).toHaveCount(0);
    await expect(c.locator('[data-conv-log] [data-item]')).toHaveCount(25);
    await expect(c.locator('[data-conv-log] [data-item]').first()).toHaveAttribute('data-message', 'ob-1'); // the first message: the assignment
    await expect(c.locator('[data-conv-log]')).toContainText('ראיתי, אגיע היום');
  });

  test('"הצוות": the yellow notes, the team composer only; "שלח לספק" pre-fills the vendor composer and the send is a forward', async ({ page }) => {
    await go(page, CONV);
    const c = d(page).locator('[data-conv]');
    await c.locator('[data-conv-sub="team"]').click();
    await expect(c.locator('[data-conv-sub="team"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(c.locator('[data-conv-caption]')).toHaveText('הצוות בלבד · הספק לא רואה');
    await expect(c.locator('[data-composer]')).toHaveCount(1);
    await expect(c.locator('[data-composer-send="team"]')).toHaveText('שמירה');
    await expect(c.locator('[data-composer-text]')).toHaveAttribute('placeholder', 'הערה לצוות');
    await expect(c.locator('[data-type="internal_note"]')).toHaveCount(3);
    await expect(c.locator('[data-type="internal_note"]').first()).toContainText('הערה פנימית');
    await expect(c.locator('[data-dir]')).toHaveCount(0);
    await shot(page, 'conv-team');
    for (const scheme of ['dark'] as const) {
      await go(page, CONV, scheme);
      await d(page).locator('[data-conv-sub="team"]').click();
      await shot(page, 'conv-team', scheme);
    }
    // the forward: switches to "עם הספק", pre-fills and focuses the vendor composer - nothing is sent yet
    const mock = await go(page, CONV);
    await c.locator('[data-conv-sub="team"]').click();
    const note = c.locator('[data-type="internal_note"]').last();
    const noteId = await note.getAttribute('data-item');
    await note.locator('[data-note-forward]').click();
    await expect(c.locator('[data-conv-sub="vendor"]')).toHaveAttribute('aria-pressed', 'true');
    const ta = c.locator('[data-composer="vendor"] [data-composer-text]');
    await expect(ta).toHaveValue('דרישת התשלום גבוהה ב-30 ש״ח מההצעה - לבדוק לפני אישור.');
    await expect(ta).toBeFocused();
    await expect(c.locator('[data-composer-source]')).toContainText('מהערה פנימית · עוד לא נשלח');
    expect(mock.calls.filter((x) => x.method === 'POST')).toHaveLength(0);
    await shot(page, 'conv-forward-prefilled');
    // the user edits; Enter is a new line in the vendor composer, the button sends - the forward route with the edited text
    await ta.press('End');
    await ta.press('Enter');
    expect(mock.calls.filter((x) => x.method === 'POST')).toHaveLength(0);
    await ta.pressSequentially('נא לאשר את ההפרש.');
    await c.locator('[data-composer-send="vendor"]').click();
    await expect.poll(() => last(mock, /forward$/)?.path).toBe(`tickets/${VID}/notes/${noteId}/forward`);
    expect((last(mock, /forward$/)?.body as { text: string }).text).toBe('דרישת התשלום גבוהה ב-30 ש״ח מההצעה - לבדוק לפני אישור.\nנא לאשר את ההפרש.');
    await expect(ta).toHaveValue('');
    await expect(c.locator('[data-dir="out"]').last()).toContainText('מהערה פנימית');
    await c.locator('[data-conv-sub="team"]').click();
    await expect(c.locator(`[data-item="${noteId}"] [data-note-forwarded]`)).toContainText('נשלחה לספק');
    await expect(c.locator(`[data-item="${noteId}"] [data-note-forward]`)).toHaveCount(0);
  });

  test('the keyboard asymmetry: Enter saves a team note (internal), Ctrl+Enter sends to the vendor', async ({ page }) => {
    const mock = await go(page, CONV);
    const c = d(page).locator('[data-conv]');
    await c.locator('[data-conv-sub="team"]').click();
    const team = c.locator('[data-composer="team"] [data-composer-text]');
    await team.fill('לבדוק את המפתח לחדר המכונות');
    await team.press('Enter');
    await expect.poll(() => last(mock, /\/notes$/)?.body).toEqual({ text: 'לבדוק את המפתח לחדר המכונות', external: false });
    await expect(team).toHaveValue('');
    await expect(c.locator('[data-type="internal_note"]').last()).toContainText('לבדוק את המפתח לחדר המכונות');
    await c.locator('[data-conv-sub="vendor"]').click();
    const vend = c.locator('[data-composer="vendor"] [data-composer-text]');
    await vend.fill('מחר ב-09:00 החדר פנוי');
    await vend.press('Enter');
    expect(last(mock, /vendor-message$/)).toBeUndefined();
    await vend.press('Control+Enter');
    await expect.poll(() => last(mock, /vendor-message$/)?.body).toEqual({ text: 'מחר ב-09:00 החדר פנוי', notify: true });
    await expect(c.locator('[data-dir="out"]').last()).toContainText('מחר ב-09:00 החדר פנוי');
  });

  test('a server before the detail backend: the vendor message falls back to the external note', async ({ page }) => {
    const mock = await go(page, CONV, 'light', 'classic', { vendorMessage: false });
    const c = d(page).locator('[data-conv]');
    await expect(c.locator('[data-composer="vendor"]')).toBeVisible(); // can.note_external + an outside handler now
    await c.locator('[data-composer-text]').fill('עדכון דרך השרת הישן');
    await c.locator('[data-composer-send="vendor"]').click();
    await expect.poll(() => last(mock, /\/notes$/)?.body).toEqual({ text: 'עדכון דרך השרת הישן', external: true });
  });

  test('a closed request: the feed stays readable, no composer', async ({ page }) => {
    await go(page, CONV, 'light', 'classic', { closed: true });
    const c = d(page).locator('[data-conv]');
    await expect(c.locator('[data-conv-feed="vendor"]')).toBeVisible();
    await expect(c.locator('[data-conv-caption]')).toHaveText('אין כרגע ספק משויך · ההודעות הקודמות נשמרות כאן');
    await expect(c.locator('[data-composer]')).toHaveCount(0);
    await c.locator('[data-conv-sub="team"]').click();
    await expect(c.locator('[data-composer]')).toHaveCount(0);
    await expect(c.locator('[data-note-forward]')).toHaveCount(0);
  });

  test('no outside contact ever: one "הערות" feed with the team composer', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installTicketsMock(page, {});
      await page.goto('about:blank');
      await page.goto(url('/tickets/all?t=0000000000000a01&tab=conv', 'classic', scheme));
      await d(page).locator('[data-conv]').waitFor();
      await shot(page, 'conv-notes', scheme);
    }
    const c = d(page).locator('[data-conv]');
    await expect(c).toHaveAttribute('data-conv-mode', 'notes');
    await expect(c.locator('[data-conv-subs]')).toHaveCount(0);
    await expect(c.locator('[data-conv-caption]')).toHaveText('רק הצוות רואה כאן');
    await expect(c.locator('[data-composer="team"]')).toBeVisible();
    await expect(c.locator('[data-composer-send="team"]')).toHaveText('שמירה');
    await expect(c.locator('[data-conv-log]')).toContainText('הקבל של המדחס שרוף');
  });

  test('History: the timeline with its filter chips, the files, the audit card', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/all?t=${VID}&tab=history`, scheme);
      await d(page).locator('[data-history-filters]').waitFor();
      await shot(page, 'history', scheme);
    }
    const h = d(page).locator('[data-tab-content="history"]');
    await expect(h.locator('[data-history-filter]')).toHaveCount(5);
    await expect(h.locator('[data-history-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    const total = await h.locator('[data-timeline] li').count();
    expect(total).toBe(33); // every event, newest first (History keeps the event rows the Conversation folds into the outbox rows)
    await h.locator('[data-history-filter="notes"]').click();
    await expect(h.locator('[data-timeline] li')).toHaveCount(3);
    await expect(h.locator('[data-timeline] li[data-type="internal_note"]')).toHaveCount(3);
    await h.locator('[data-history-filter="status"]').click();
    await expect(h.locator('[data-timeline] li')).toHaveCount(4);
    await h.locator('[data-history-filter="costs"]').click();
    await expect(h.locator('[data-timeline] li')).toHaveCount(1);
    await h.locator('[data-history-filter="messages"]').click();
    await expect(h.locator('[data-timeline] li[data-type="message"]')).toHaveCount(await h.locator('[data-timeline] li').count());
    await shot(page, 'history-messages');
    await expect(h.locator('[data-sect="files"] [data-file]')).toHaveCount(2);
    await expect(h.locator('[data-file="att-1"] [data-file-scope]')).toHaveText('פנימי');
    await expect(h.locator('[data-file="att-2"] [data-file-scope]')).toHaveText('גלוי לספק');
    await expect(h.locator('[data-sect="audit"] [data-link-panel]')).toBeVisible();
    await expect(h.locator('[data-link-audit] [data-audit]')).toHaveCount(3);
    await expect(h.locator('[data-link-audit] [data-audit]').first()).toHaveAttribute('data-audit', 'link_copied');
    await h.locator('[data-sect="audit"]').scrollIntoViewIfNeeded();
    await shot(page, 'history-audit');
  });

  test('the status block\'s "עדכון ל…" opens the vendor composer, focused', async ({ page }) => {
    test.skip(isPhone(page), 'desktop (the same action on the phone)');
    await go(page, `/tickets/all?t=${VID}`);
    const b = d(page).locator('[data-status-block]');
    const update = b.locator('button', { hasText: 'עדכון למשה' });
    test.skip((await update.count()) === 0, 'the role-resolved primary of this state is not the update');
    await update.first().click();
    await expect(d(page).locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'conv');
    await expect(d(page).locator('[data-composer="vendor"] [data-composer-text]')).toBeFocused();
  });
});
