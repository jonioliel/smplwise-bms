import { test } from '@playwright/test';
import type { TicketStatus } from '../src/api/tickets';
import { sentenceFor, VIEWER_ROLES, type SentenceTicket } from '../src/tickets/status-sentence';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of sentenceFor (tickets/status-sentence.ts) before its split. Every status (and an unknown one) x
// every role x ticket variants (assignee kind, link / events, channel, ETA, cost claim, return reasons, close notes, duplicates) x two
// clocks; the answers must equal the record taken from the unsplit function (tests/fixtures/cx/sentence-for.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-sentence-for-2480.spec.ts --workers=1

const NOW = new Date(2026, 10, 3, 10, 0);
const LATER = new Date(2026, 10, 9, 23, 30);
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const base = (o: Partial<SentenceTicket> = {}): SentenceTicket => ({
  status: 'new', assignee: null, eta_at: null, created_at: at(3, 8), created_by: { name: 'רינה כהן' }, last_activity_at: at(3, 9), waiting_reason: null, ...o,
});
const user = { kind: 'user', id: 'u1', name: 'אבי מנחם', since: at(3, 8, 30) } as unknown as SentenceTicket['assignee'];
const contact = { kind: 'contact', id: 'c1', name: 'חשמלאי דוד', since: at(3, 8, 40) } as unknown as SentenceTicket['assignee'];
const nameless = { kind: 'contact', id: 'c2', name: '', since: null } as unknown as SentenceTicket['assignee'];
const asg = (o: Record<string, unknown> = {}) => ({ kind: 'contact' as const, name: 'מסגר', channel: 'whatsapp', assigned_at: at(3, 8, 40), ended_at: null, end_reason: null, return_reason: null, ...o });
const LONG = 'הערה ארוכה מאוד '.repeat(12);

const VARIANTS: Array<[string, Partial<SentenceTicket>]> = [
  ['bare', {}],
  ['user', { assignee: user }],
  ['user-eta', { assignee: user, eta_at: at(3, 14) }],
  ['user-eta-tomorrow', { assignee: user, eta_at: at(4, 9, 5) }],
  ['user-eta-date', { assignee: user, eta_at: at(17, 7) }],
  ['user-eta-bad', { assignee: user, eta_at: 'not a date' }],
  ['contact', { assignee: contact }],
  ['contact-nameless', { assignee: nameless, last_assignee_name: 'קודם' }],
  ['nameless-assignments', { assignee: nameless, assignments: [asg({ name: 'מהרשימה' })] }],
  ['nameless-none', { assignee: nameless, assignments: [] }],
  ['contact-link-open', { assignee: contact, link: { first_opened_at: at(3, 9) } }],
  ['contact-link-unopened-wa', { assignee: contact, link: { first_opened_at: null, sent_via: 'whatsapp', sent_at: at(3, 9, 15) } }],
  ['contact-link-unopened-email', { assignee: contact, link: { first_opened_at: null, sent_via: 'email' } }],
  ['contact-link-unopened-sms', { assignee: contact, link: { first_opened_at: null, sent_via: 'sms' } }],
  ['contact-events-opened', { assignee: contact, events: [{ kind: 'link_opened', at: at(3, 9) }], assignments: [asg()] }],
  ['contact-events-old-open', { assignee: contact, events: [{ kind: 'link_opened', at: at(3, 7) }], assignments: [asg({ channel: 'email' })] }],
  ['contact-events-none', { assignee: contact, events: [], assignments: [asg({ ended_at: at(3, 9) }), asg({ channel: 'sms' })] }],
  ['contact-events-no-asg', { assignee: { ...contact!, since: undefined } as never, events: [{ kind: 'status', at: at(3, 9), to: 'done' }] }],
  ['done-events', { assignee: user, events: [{ kind: 'status', at: at(2, 9), to: 'done' }, { kind: 'status', at: at(3, 9, 30), to: 'done' }, { kind: 'status', at: at(3, 9, 40), to: 'in_progress' }] }],
  ['claim-mine', { assignee: contact, cost: { status: 'submitted' as never, can_decide: true } }],
  ['claim-other', { assignee: contact, cost: { status: 'submitted' as never, can_decide: false } }],
  ['claim-awaiting', { assignee: contact, cost: { status: 'awaiting' as never } }],
  ['claim-approved', { assignee: contact, cost: { status: 'approved' as never } }],
  ['returned-reason', { assignments: [asg({ end_reason: 'returned', ended_at: at(3, 9), return_reason: 'אין לי את החלק' })] }],
  ['returned-long', { assignments: [asg({ end_reason: 'returned', ended_at: at(3, 9), return_reason: LONG })] }],
  ['returned-not-mine', { assignments: [asg({ end_reason: 'returned', ended_at: at(3, 9), return_kind: 'not_mine' })] }],
  ['returned-two', { assignments: [asg({ end_reason: 'returned', ended_at: at(3, 8), return_reason: 'ראשון' }), asg({ end_reason: 'returned', ended_at: at(3, 9) })] }],
  ['waiting-not-mine', { waiting_reason: 'not_mine', last_assignee_name: 'שמעון' }],
  ['closed-by', { closed_at: at(3, 9, 50), closed_by_name: 'מנהלת', close_note: 'טופל' }],
  ['closed-long-note', { closed_at: at(2, 9), close_note: LONG }],
  ['closed-blank-note', { closed_by_name: 'מנהלת', close_note: '   ' }],
  ['dup', { duplicate_of: { number: 412 }, close_note: 'כפול' }],
  ['dup-long', { duplicate_of: { number: 7 }, closed_at: at(3, 9), close_note: LONG }],
];
const STATUSES: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled', 'archived' as TicketStatus];

test('sentenceFor: every answer equals the record of the unsplit function', () => {
  const out = STATUSES.flatMap((status) =>
    VARIANTS.flatMap(([v, o]) =>
      [NOW, LATER].flatMap((now, k) => [
        `${status} ${v} ${k} default: ${sentenceFor(base({ ...o, status }), undefined, now)}`,
        ...VIEWER_ROLES.map((role) => `${status} ${v} ${k} ${role}: ${sentenceFor(base({ ...o, status }), role, now)}`),
      ]),
    ),
  );
  expectRecorded('sentence-for', out);
});
