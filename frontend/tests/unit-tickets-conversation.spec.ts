import { test, expect } from '@playwright/test';
import {
  activeSub, afterSend, buildTimeline, canForward, convSubs, dayLabel, editDraft, enterSends, eventItem, filterCounts, filterItems, forwardedNotes,
  initialConv, inSub, linkAuditRows, openedAfter, outboxDelivery, prefillFromNote, sendPlan, subItems, switchSub, unreadIn, windowLast, withDays, CONV_WINDOW,
} from '../src/tickets/conversation-model';
import { CONV_TEXT_EN_KEYS, CONV_TEXT_KEYS, convTemplate } from '../src/tickets/conversation-text';
import type { TicketEvent } from '../src/api/tickets';
import type { TicketMessage } from '../src/api/tickets-messages';

// TKUI2 (2.6.0): the pure model of the Conversation and History tabs - the contract §6 classification, the History filters and counts,
// the two sub-tabs and their composers, the forward = pre-fill rule, the keyboard asymmetry, the "last 20" window, the day pills. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-conversation.spec.ts

const me = { kind: 'user', name: 'רונית לוי', me: true };
const avi = { kind: 'user', name: 'אבי כהן', me: false };
const vendor = { kind: 'contact', name: 'משה', me: false };
const sys = { kind: 'system', name: '', me: false };
let n = 0;
const ev = (kind: string, at: string, extra: Partial<TicketEvent> = {}): TicketEvent => ({
  id: `e${++n}`, at, kind, actor: avi, from: null, to: null, body: null, data: {}, via: 'ui', external: false, ...extra,
});
const msg = (id: string, at: string, state: TicketMessage['state'], purpose: TicketMessage['purpose'] = 'assign'): TicketMessage => ({
  id, purpose, channel: 'whatsapp', state, held_reason: state === 'held' ? 'send_hours' : null, not_before: null, created_at: at, sent_at: state === 'sent' ? at : null,
  attempts: 1, code: null, account: null, fallback_of: null, resend_of: null, current: true, can: { send_now: state === 'held', resend: state === 'unknown' },
});

test('the contract §6 classification of every event kind', () => {
  expect(eventItem(ev('note', '2026-10-16T08:00:00Z', { actor: me })).type).toBe('internal_note');
  const out = eventItem(ev('note', '2026-10-16T08:00:00Z', { actor: me, external: true, body: 'x' }));
  expect([out.type, out.direction, out.channel, out.delivery]).toEqual(['message', 'out', 'page', 'page']);
  const page = eventItem(ev('note', '2026-10-16T08:00:00Z', { actor: vendor, external: true, body: 'x' }));
  expect([page.type, page.direction, page.channel]).toEqual(['message', 'in', 'page']);
  const wa = eventItem(ev('inbound', '2026-10-16T08:00:00Z', { actor: { kind: 'inbound', name: 'משה', me: false }, external: true }));
  expect([wa.type, wa.direction, wa.channel, wa.unverified]).toEqual(['message', 'in', 'whatsapp', true]);
  expect(eventItem(ev('late_reply', '2026-10-16T08:00:00Z')).direction).toBe('in');
  expect(eventItem(ev('link_sent', '2026-10-16T08:00:00Z', { actor: sys, via: 'whatsapp' })).delivery).toBe('sent');
  expect(eventItem(ev('link_sent', '2026-10-16T08:00:00Z', { actor: sys, via: 'email' })).channel).toBe('email');
  expect(eventItem(ev('message_unknown', '2026-10-16T08:00:00Z')).delivery).toBe('unknown');
  expect(eventItem(ev('message_failed', '2026-10-16T08:00:00Z')).delivery).toBe('failed');
  for (const k of ['created', 'status', 'closed', 'cancelled', 'reopened', 'assigned', 'reassigned', 'returned', 'auto_closed']) expect(eventItem(ev(k, '2026-10-16T08:00:00Z')).type, k).toBe('status_event');
  expect(eventItem(ev('quote_submitted', '2026-10-16T08:00:00Z')).type).toBe('quote');
  expect(eventItem(ev('cost_decision', '2026-10-16T08:00:00Z')).type).toBe('demand');
  expect(eventItem(ev('owner_changed', '2026-10-16T08:00:00Z')).type).toBe('owner_change');
  expect(eventItem(ev('photo', '2026-10-16T08:00:00Z')).type).toBe('photo');
  expect(eventItem(ev('eta', '2026-10-16T08:00:00Z')).type).toBe('system');
  expect(eventItem(ev('note', '2026-10-16T08:00:00Z', { actor: me, external: true, data: { from_note_id: 'e1' } })).fromNoteId).toBe('e1');
  expect(outboxDelivery('not_sent')).toBe('failed');
  expect(outboxDelivery('refused')).toBe('failed');
  expect(outboxDelivery('held')).toBe('held');
});

test('one timeline, oldest first; the outbox replaces the event rows it duplicates only when asked (Conversation, not History)', () => {
  const events = [
    ev('created', '2026-10-16T07:00:00Z', { actor: me }),
    ev('link_sent', '2026-10-16T08:00:00Z', { actor: sys, via: 'whatsapp' }),
    ev('note', '2026-10-16T07:30:00Z', { actor: me, body: 'פנימי' }),
    ev('message_unknown', '2026-10-16T09:00:00Z', { actor: sys }),
  ];
  const messages = [msg('ob-1', '2026-10-16T08:00:00Z', 'sent'), msg('ob-2', '2026-10-16T09:00:00Z', 'unknown', 'update'), msg('ob-t', '2026-10-16T09:30:00Z', 'sent', 'test')];
  const hist = buildTimeline({ events, messages });
  expect(hist.map((i) => i.kind)).toEqual(['created', 'note', 'link_sent', 'message_unknown']);
  const conv = buildTimeline({ events, messages }, { outbox: true });
  expect(conv.map((i) => i.id)).toEqual([events[0].id, events[2].id, 'ob:ob-1', 'ob:ob-2']); // no test send, no duplicate event rows
  expect(conv[2].message?.id).toBe('ob-1');
  // no delivery rows (a member without the block): the event rows stay
  expect(buildTimeline({ events }, { outbox: true }).map((i) => i.kind)).toEqual(['created', 'note', 'link_sent', 'message_unknown']);
});

test('the History filters and counts (all / messages / notes / status / costs) and the link audit rows', () => {
  const items = buildTimeline({ events: [
    ev('created', '2026-10-16T07:00:00Z'), ev('assigned', '2026-10-16T07:01:00Z'), ev('note', '2026-10-16T07:02:00Z', { actor: me }),
    ev('note', '2026-10-16T07:03:00Z', { actor: me, external: true }), ev('inbound', '2026-10-16T07:04:00Z'), ev('cost_submitted', '2026-10-16T07:05:00Z'),
    ev('quote_decided', '2026-10-16T07:06:00Z'), ev('owner_changed', '2026-10-16T07:07:00Z'), ev('link_opened', '2026-10-16T07:08:00Z'), ev('link_copied', '2026-10-16T07:09:00Z'),
    ev('link_sent', '2026-10-16T07:10:00Z'),
  ] });
  expect(filterCounts(items)).toEqual({ all: 11, messages: 3, notes: 1, status: 3, costs: 2 });
  expect(filterItems(items, 'status').map((i) => i.kind)).toEqual(['created', 'assigned', 'owner_changed']);
  expect(filterItems(items, 'costs').map((i) => i.kind)).toEqual(['cost_submitted', 'quote_decided']);
  expect(filterItems(items, 'all')).toHaveLength(11);
  expect(linkAuditRows(items).map((i) => i.kind)).toEqual(['link_copied', 'link_opened']); // newest first, the send itself is a message
});

test('the two sub-tabs: what each shows; without a vendor one "notes" feed', () => {
  expect(convSubs(true)).toEqual(['vendor', 'team']);
  expect(convSubs(false)).toEqual(['team']);
  const items = buildTimeline({ events: [
    ev('note', '2026-10-16T07:00:00Z', { actor: me }), // internal
    ev('note', '2026-10-16T07:01:00Z', { actor: me, external: true, body: 'לספק' }), // to the vendor
    ev('note', '2026-10-16T07:02:00Z', { actor: vendor, external: true, body: 'מהספק' }), // from the handler page
    ev('status', '2026-10-16T07:03:00Z', { external: true }), // a status the vendor sees
    ev('status', '2026-10-16T07:04:00Z', { external: false }),
    ev('photo', '2026-10-16T07:05:00Z', { external: false }),
    ev('photo', '2026-10-16T07:06:00Z', { external: true }),
    ev('cost_submitted', '2026-10-16T07:07:00Z'),
    ev('eta', '2026-10-16T07:08:00Z'),
  ] });
  const ids = (sub: 'vendor' | 'team', vm: boolean) => subItems(items, sub, vm).map((i) => `${i.kind}:${i.external ? 'x' : 'i'}`);
  expect(ids('vendor', true)).toEqual(['note:x', 'note:x', 'status:x', 'photo:x', 'cost_submitted:i']);
  expect(ids('team', true)).toEqual(['note:i', 'photo:i']);
  // an internal note never lands in the vendor feed, a vendor message never in the team feed
  for (const it of items) if (it.type === 'internal_note') expect(inSub(it, 'vendor', true)).toBe(false);
  for (const it of items) if (it.direction) expect(inSub(it, 'team', true)).toBe(false);
  expect(ids('team', false)).toEqual(['note:i', 'note:x', 'note:x', 'photo:i', 'photo:x']);
  expect(unreadIn(items)).toBe(1); // the vendor page note after my last action (07:01)
});

test('the composers: the active sub-tab owns the composer, drafts survive a switch, a vendor sub-tab never shows without a vendor', () => {
  let s = initialConv(true);
  expect(s.sub).toBe('vendor');
  expect(initialConv(false).sub).toBe('team');
  s = editDraft(s, 'vendor', 'שלום');
  s = switchSub(s, 'team');
  s = editDraft(s, 'team', 'פנימי');
  expect([s.sub, s.vendorDraft, s.teamDraft]).toEqual(['team', 'שלום', 'פנימי']);
  expect(activeSub(switchSub(s, 'vendor'), false)).toBe('team');
  expect(sendPlan(s)).toEqual({ route: 'note', text: 'פנימי' });
  expect(sendPlan(switchSub(s, 'vendor'))).toEqual({ route: 'vendor', text: 'שלום' });
  expect(sendPlan(editDraft(s, 'team', '   '))).toBeNull();
  s = afterSend(s, 'team');
  expect([s.teamDraft, s.vendorDraft]).toEqual(['', 'שלום']);
});

test('"שלח לספק" only pre-fills the vendor composer; the send is a forward of that note; emptying the draft forgets it', () => {
  const note = { id: 'e9', body: '  לוודא שהחדר פנוי  ' };
  let s = switchSub(initialConv(true), 'team');
  s = prefillFromNote(s, note);
  expect([s.sub, s.vendorDraft, s.sourceNote]).toEqual(['vendor', 'לוודא שהחדר פנוי', 'e9']);
  s = editDraft(s, 'vendor', 'לוודא שהחדר פנוי אחרי 14:00');
  expect(sendPlan(s)).toEqual({ route: 'forward', noteId: 'e9', text: 'לוודא שהחדר פנוי אחרי 14:00' });
  expect(afterSend(s, 'vendor')).toMatchObject({ vendorDraft: '', sourceNote: null });
  expect(editDraft(s, 'vendor', '').sourceNote).toBeNull();
  // a draft in progress is kept: the note is appended after a blank line
  const kept = prefillFromNote(editDraft(initialConv(true), 'vendor', 'שלום משה'), note);
  expect(kept.vendorDraft).toBe('שלום משה\n\nלוודא שהחדר פנוי');
  // the forward is offered once per note, on internal notes only, to a viewer who may write to the vendor
  const items = buildTimeline({ events: [
    ev('note', '2026-10-16T07:00:00Z', { id: 'n1', actor: me, body: 'א' }), ev('note', '2026-10-16T07:01:00Z', { id: 'n2', actor: me, body: 'ב' }),
    ev('note', '2026-10-16T07:02:00Z', { id: 'm1', actor: me, external: true, body: 'ב', data: { from_note_id: 'n2' } }),
  ] });
  const forwarded = forwardedNotes(items);
  expect([...forwarded.keys()]).toEqual(['n2']);
  expect(items.map((it) => canForward(it, { canVendor: true, forwarded }))).toEqual([true, false, false]);
  expect(canForward(items[0], { canVendor: false, forwarded })).toBe(false);
});

test('the keyboard asymmetry: Enter saves a team note, the vendor composer sends on Ctrl/Cmd+Enter only', () => {
  expect(enterSends('team', { key: 'Enter' })).toBe(true);
  expect(enterSends('team', { key: 'Enter', shiftKey: true })).toBe(false);
  expect(enterSends('team', { key: 'Enter', isComposing: true })).toBe(false);
  expect(enterSends('vendor', { key: 'Enter' })).toBe(false);
  expect(enterSends('vendor', { key: 'Enter', ctrlKey: true })).toBe(true);
  expect(enterSends('vendor', { key: 'Enter', metaKey: true })).toBe(true);
  expect(enterSends('vendor', { key: 'a', ctrlKey: true })).toBe(false);
});

test('the last 20 items, "הודעות קודמות" renders the rest in place; the day pills; the only receipt is "opened after"', () => {
  const list = Array.from({ length: 27 }, (_, i) => i);
  expect(CONV_WINDOW).toBe(20);
  expect(windowLast(list, false)).toEqual({ shown: list.slice(7), hidden: 7 });
  expect(windowLast(list, true)).toEqual({ shown: list, hidden: 0 });
  expect(windowLast(list.slice(0, 20), false).hidden).toBe(0);
  const rows = withDays([{ at: '2026-10-15T10:00:00' }, { at: '2026-10-15T12:00:00' }, { at: '2026-10-16T09:00:00' }]);
  expect(rows.map((r) => ('day' in r ? r.day : 'item'))).toEqual(['2026-10-15', 'item', 'item', '2026-10-16', 'item']);
  const now = new Date('2026-10-16T12:00:00');
  const w = { today: 'היום', yesterday: 'אתמול' };
  expect(dayLabel('2026-10-16', now, w)).toBe('היום');
  expect(dayLabel('2026-10-15', now, w)).toBe('אתמול');
  expect(dayLabel('2026-10-02', now, w)).toBe('02/10');
  expect(dayLabel('2025-12-31', now, w)).toBe('31/12/2025');
  const items = buildTimeline({ events: [ev('note', '2026-10-16T07:00:00Z', { actor: me, external: true, body: 'x' }), ev('link_opened', '2026-10-16T08:00:00Z', { actor: vendor })] });
  expect(openedAfter(items[0], items)).toBe(true);
  expect(openedAfter(items[0], items.slice(0, 1))).toBe(false);
});

test('the catalogue: every Hebrew text has an English one; the verbs and captions of IA §4.2; no retired word, no default name', () => {
  const en = new Set(CONV_TEXT_EN_KEYS);
  expect(CONV_TEXT_KEYS.filter((k) => !en.has(k))).toEqual([]);
  for (const k of CONV_TEXT_KEYS)
    for (const lang of ['he', 'en'] as const) {
      const s = convTemplate(k, lang);
      expect(s.trim(), `${lang}.${k}`).not.toBe('');
      expect(s, `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b|Home Assistant/);
    }
  expect(convTemplate('save_team', 'he')).toBe('שמירה');
  expect(convTemplate('send_vendor', 'he')).toBe('שליחה ל{name}');
  expect(convTemplate('cap_team', 'he')).toBe('הצוות בלבד · הספק לא רואה');
  // the placeholders stay within the IA §5 budget (≤ 40 characters with a short name)
  for (const k of ['ph_vendor_whatsapp', 'ph_vendor_email', 'ph_vendor_page', 'ph_team'] as const) expect(convTemplate(k, 'he').replace('{name}', 'משה').length, k).toBeLessThanOrEqual(40);
});
