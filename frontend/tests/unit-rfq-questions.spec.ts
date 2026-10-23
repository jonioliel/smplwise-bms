import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RfqDetail, RfqVendor } from '../src/api/tickets-rfq';
import { answerWire } from '../src/api/tickets-rfq';
import { mockRfq, resetDemoRfq } from '../src/api/tickets-rfq-mock';
import { ANSWER_MAX, QUESTION_SHOWN_MAX, answerBody, answerProblems, awardQuestionWarning, navCount, pendingQuestions, questionBadge } from '../src/tickets/rfq-questions';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_HE } from '../src/tickets/rfq-text';
import { TICKETS_TABS, TICKETS_VENDORS_PAGES, applyRfqQuestions, applyTicketsHidden, areaBadge } from '../src/shell/nav';
import { RFQ_TEXT } from '../src/public-ticket/rfq/rfq-text';
import { freshDraft, parseRfqDraft, quoteWire } from '../src/public-ticket/rfq/rfq-state';

// RFQQUESTIONS: the pure rules of a vendor question on the manager screens (tickets/rfq-questions.ts), the answer's wire body, the demo
// store's answer plan (privacy between vendors), the navigation badge, the vendor page's question field and the words in every language.
//   npx playwright test -c playwright.unit.config.ts tests/unit-rfq-questions.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const vendor = (id: string, pending: number, unread = 0, company = `חברה ${id}`): RfqVendor => ({
  id, contact: { id: `c-${id}`, name: `איש ${id}`, company }, channel: 'whatsapp', state: 'quoted', invited_at: '', sent_at: null, first_opened_at: null, open_count: 0,
  quoted_at: null, declined_at: null, decline_reason: null, link: null, quote: null, messages: 0, questions: { pending, unread }, revision: 1,
  can: { remove: false, remind: false, quote_on_behalf: false, decline_on_behalf: false, message: true },
});

// ---------------------------------------------------------------- negative first: no badge without data, limits, privacy

test('no badge for a missing, zero or malformed count (an older server sends no questions field)', () => {
  expect(questionBadge(undefined)).toBeNull();
  expect(questionBadge(null)).toBeNull();
  expect(questionBadge({ pending: 0, unread: 0 })).toBeNull();
  expect(questionBadge({ pending: Number.NaN, unread: 3 })).toBeNull();
  expect(questionBadge({ pending: -2, unread: 0 })).toBeNull();
  expect(navCount(null)).toBe(0);
  expect(navCount({})).toBe(0);
  expect(pendingQuestions(null)).toEqual([]);
  expect(pendingQuestions({} as RfqDetail)).toEqual([]);
  expect(awardQuestionWarning(null, ['a'])).toBeNull();
  expect(awardQuestionWarning({ questions: { pending: 0, unread: 0, items: [] }, vendors: [vendor('a', 0)] }, ['a'])).toBeNull();
});

test('the answer form refuses an empty or too long answer and, for every vendor, an empty or too long shown question', () => {
  expect(answerProblems(answerBody('  ', 'vendor', '', false, true), 'q')).toEqual(['text_required']);
  expect(answerProblems(answerBody('x'.repeat(ANSWER_MAX + 1), 'vendor', '', false, true), 'q')).toEqual(['text_too_long']);
  expect(answerProblems(answerBody('כן', 'all', '   ', false, true), 'q')).toEqual(['question_required']);
  expect(answerProblems(answerBody('כן', 'all', 'ש'.repeat(QUESTION_SHOWN_MAX + 1), false, true), 'q')).toEqual(['question_too_long']);
  expect(answerProblems(answerBody('כן', 'vendor', '', false, true), 'q')).toEqual([]);
});

test('a vendor-only answer never carries the question or the asker flag on the wire (extra = forbid on the server)', () => {
  const v = answerBody(' כן ', 'vendor', 'השאלה', true, false);
  expect(v).toEqual({ text: 'כן', scope: 'vendor', notify: false });
  expect(answerWire(v)).toEqual({ text: 'כן', scope: 'vendor', notify: false });
  const all = answerBody('כן', 'all', ' השאלה ', false, true);
  expect(answerWire(all)).toEqual({ text: 'כן', scope: 'all', notify: true, question_text: 'השאלה', name_asker: false });
});

test('the demo answer plan: the others never see the asker\'s name unless the manager chooses it; a second answer is refused', async () => {
  resetDemoRfq();
  const list = await mockRfq.list({ state: 'all' });
  const r7 = list.items.find((i) => i.ref === 'RFQ-07')!;
  expect(r7.questions?.pending).toBe(2);
  const d = await mockRfq.get(r7.id);
  const q = d.questions!.items.find((x) => x.via === 'page')!;
  const plain = await mockRfq.answerPreview(d.id, q.id, answerBody('כן, בתיאום מראש.', 'all', 'אפשר לעבוד ביום שישי?', false, true));
  const asker = plain.recipients.find((r) => r.asker)!;
  expect(asker.vendor_id).toBe(q.vendor_id);
  expect(asker.text).toBe('כן, בתיאום מראש.');
  for (const r of plain.recipients.filter((x) => !x.asker)) {
    expect(r.text).toBe('שאלה שהתקבלה מספק: אפשר לעבוד ביום שישי?\nתשובה: כן, בתיאום מראש.');
    expect(r.text).not.toContain(q.vendor.company);
  }
  const named = await mockRfq.answerPreview(d.id, q.id, answerBody('כן', 'all', 'אפשר?', true, true));
  expect(named.recipients.find((x) => !x.asker)!.text.startsWith(`שאלה מ${q.vendor.company}:`)).toBe(true);
  const vendorOnly = await mockRfq.answerPreview(d.id, q.id, answerBody('כן', 'vendor', '', false, true));
  expect(vendorOnly.recipients.map((r) => r.vendor_id)).toEqual([q.vendor_id]);
  const a = await mockRfq.answer(d.id, q.id, answerBody('כן', 'vendor', '', false, false), 'crid-00000001');
  expect(a.rfq.questions!.pending).toBe(1);
  await expect(mockRfq.answer(d.id, q.id, answerBody('שוב', 'vendor', '', false, false), 'crid-00000002')).rejects.toMatchObject({ code: 'question_answered' });
});

// ---------------------------------------------------------------- the rules

test('the badge reads the pending count and stays "new" while one question was not opened', () => {
  expect(questionBadge({ pending: 2, unread: 1 })).toEqual({ n: 2, fresh: true });
  expect(questionBadge({ pending: 2, unread: 0 })).toEqual({ n: 2, fresh: false });
  expect(navCount({ pending: 4 })).toBe(4);
});

test('the award warning counts every pending question and names the selected vendors that asked', () => {
  const d = { questions: { pending: 3, unread: 1, items: [] }, vendors: [vendor('a', 2), vendor('b', 1), vendor('c', 0)] };
  expect(awardQuestionWarning(d, ['a', 'c'])).toEqual({ total: 3, vendors: ['חברה a'] });
  expect(awardQuestionWarning(d, ['c'])).toEqual({ total: 3, vendors: [] });
});

// nav.ts keeps the module switch and the question count as module state: a spec that turns them on puts them back, or the next spec of the
// same worker (unit-tabs-config's rail: the tickets area is off by default) sees a rail it did not ask for.
test.afterEach(() => {
  applyTicketsHidden(null);
  applyRfqQuestions(0);
});

test('the navigation: the RFQ page entry carries a badge, its section a dot and the tickets area a count while the module is on', () => {
  // SERVICEIA1-295 (owner 24.10, item 57): the number on the page entry, a dot on the "ספקים וכספים" section
  const tab = TICKETS_VENDORS_PAGES.find((t) => t.id === 'rfqs')!;
  const sec = TICKETS_TABS.find((t) => t.id === 'vendors')!;
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  applyRfqQuestions(3);
  expect(tab.badge).toBe(3);
  expect(tab.alert).toBe(true);
  expect(sec.dot).toBe(true);
  expect(sec.badge, 'no number on the section').toBeUndefined();
  expect(areaBadge('tickets')).toBe(3);
  expect(areaBadge('devices')).toBe(0);
  applyTicketsHidden({ 'tickets.enabled': 'false' });
  expect(areaBadge('tickets')).toBe(0);
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  applyRfqQuestions(0);
  expect(tab.badge).toBeUndefined();
  expect(sec.dot).toBeUndefined();
  expect(areaBadge('tickets')).toBe(0);
});

test('the vendor page: the question has its own field on the wire, never mixed into the note, and survives a reload of the tab', () => {
  const v = { form: null, rfq: null, quote: null, time_zone: 'Asia/Jerusalem' } as unknown as Parameters<typeof quoteWire>[1];
  const d = freshDraft({ form: undefined, rfq: undefined });
  d.form.notes = 'המחיר לא כולל מנוף';
  d.question = '  האם יש מעלית משא?  ';
  const body = quoteWire(d, v, 'crid-00000003');
  expect(body.question).toBe('האם יש מעלית משא?');
  expect(body.note).toBe('המחיר לא כולל מנוף');
  d.question = '   ';
  expect('question' in quoteWire(d, v, 'crid-00000004')).toBe(false);
  const kept = parseRfqDraft(JSON.stringify({ ...d, question: 'שאלה' }));
  expect(kept?.question).toBe('שאלה');
});

test('words: every manager key has an English column; the vendor page has the question words in he / en / ar / ru', () => {
  const keys = Object.keys(RFQ_TEXT_HE).filter((k) => k.startsWith('q') && ['qBadge', 'qSection', 'qAnswer', 'qScopeAll', 'qSendAsk', 'qAwardWarn', 'qVendorNote'].includes(k));
  expect(keys.length).toBe(7);
  for (const k of ['qBadge', 'qBadgeOne', 'qSection', 'qResolve', 'qScopeVendor', 'qScopeAll', 'qSendAsk', 'qSendAskAll', 'qAwardWarn', 'navQuestionsAria',
    'err_question_answered', 'err_message_not_found', 'ev_question_answered']) {
    expect(RFQ_TEXT_EN_KEYS, k).toContain(k);
  }
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of ['qField', 'qFieldHint', 'qAnswered', 'qWaiting', 'sentAsked'] as const) expect(RFQ_TEXT[lang][k], `${lang}.${k}`).toBeTruthy();
  }
  // the vocabulary rule of the RFQ words: no retired cost word, no module branding
  const src = readFileSync(path.join(SRC, 'tickets/rfq-questions.ts'), 'utf8') + readFileSync(path.join(SRC, 'tickets/rfq-question-dialog.ts'), 'utf8');
  expect(src).not.toMatch(/Home Assistant|innerHTML|unsafeHTML/);
});
