import { test, expect } from '@playwright/test';
import {
  SENTENCE_MAX, VIEWER_ROLES, ballOf, clip, etaText, linkOpened, sentenceFor, slaState, statusChip, stuckOf, viewerRole, warningFor,
  type SentenceTicket, type ViewerRole,
} from '../src/tickets/status-sentence';
import { DRAWER_TEXT_EN_KEYS, DRAWER_TEXT_KEYS, drawerTemplate } from '../src/tickets/drawer-text';
import { setTicketNames } from '../src/tickets/naming';
import type { TicketStatus } from '../src/api/tickets';

// TKUI1: the ONE status vocabulary (IA SERVICE_MODULE_UX_IA_2026-10-16 §3.2) - every state, sub-state and role of the status table, the
// ranked warning line, the SLA badge rule. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-status-sentence.spec.ts

const NOW = new Date(2026, 9, 16, 12, 0, 0); // local time: 16.10.2026 12:00
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const later = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();
const TOMORROW_9 = new Date(2026, 9, 17, 9, 0).toISOString();

function tk(o: Partial<SentenceTicket> = {}): SentenceTicket {
  return {
    status: 'new', assignee: null, eta_at: null, created_at: ago(180), created_by: { name: 'יוסי מ.' }, last_activity_at: ago(120),
    waiting_reason: null, ...o,
  };
}
const user = { kind: 'user' as const, id: 'u1', name: 'אלון ד.', since: ago(60), acknowledged_at: null };
const vendor = { kind: 'contact' as const, id: 'c1', name: 'מיזוג אלון', since: ago(60), acknowledged_at: null };
const contactAsg = { kind: 'contact' as const, name: 'מיזוג אלון', channel: 'whatsapp', assigned_at: ago(60), ended_at: null, end_reason: null, return_reason: null };

test.afterEach(() => setTicketNames(null));

test('the chip: one chip, "waiting for a part" is the sub-label of "in progress", never a step', () => {
  expect(statusChip({ status: 'waiting_part' })).toEqual({ label: 'בטיפול', sub: 'ממתין לחלק', text: 'בטיפול · ממתין לחלק', tone: 'info' });
  const labels: Record<TicketStatus, string> = { new: 'חדש', assigned: 'שויך', acknowledged: 'התקבל', in_progress: 'בטיפול', waiting_part: 'בטיפול', done: 'הסתיים', returned: 'הוחזר', closed: 'סגור', cancelled: 'בוטל' };
  for (const [st, label] of Object.entries(labels)) {
    const c = statusChip({ status: st as TicketStatus });
    expect(c.label, st).toBe(label);
    expect(c.text.length, `${st}: chip <= 18 characters`).toBeLessThanOrEqual(19);
    if (st !== 'waiting_part') expect(c.sub).toBe('');
  }
});

test('new: waiting for a handler, opened when and by whom; the requester reads its own words', () => {
  expect(sentenceFor(tk(), 'manager', NOW)).toBe('ממתין לשיוך מטפל · נפתחה לפני 3 שע׳ על ידי יוסי מ.');
  expect(sentenceFor(tk(), 'requester', NOW)).toBe('התקבלה · ממתין לשיוך מטפל');
  expect(ballOf(tk())).toBe('manager');
});

test('assigned to an internal user: manager / handler / requester', () => {
  const t = tk({ status: 'assigned', assignee: user });
  expect(sentenceFor(t, 'manager', NOW)).toBe('נמסר לאלון ד. · ממתין לאישור קבלה');
  expect(sentenceFor(t, 'handler', NOW)).toBe('נמסר לך · ממתין לאישור הקבלה שלך');
  expect(sentenceFor(t, 'requester', NOW)).toBe('נמסר למטפל · ממתין לאישור קבלה');
  expect(ballOf(t)).toBe('handler');
});

test('assigned to a vendor: link not opened (sent on WhatsApp / e-mail / by hand), link opened, unknown (a list item)', () => {
  const sent = tk({ status: 'assigned', assignee: vendor, assignments: [contactAsg], events: [] });
  expect(linkOpened(sent)).toBe(false);
  expect(sentenceFor(sent, 'manager', NOW)).toBe('נשלח למיזוג אלון בוואטסאפ לפני 1 שע׳ · הקישור טרם נפתח');
  expect(sentenceFor(tk({ ...sent, assignments: [{ ...contactAsg, channel: 'email' }] }), 'manager', NOW)).toContain('בדוא״ל');
  expect(sentenceFor(tk({ ...sent, assignments: [{ ...contactAsg, channel: 'manual' }] }), 'manager', NOW)).toBe('נשלח למיזוג אלון לפני 1 שע׳ · הקישור טרם נפתח');
  // the link block wins over the events (sent time and channel from the link)
  const viaLink = tk({ ...sent, link: { first_opened_at: null, sent_via: 'whatsapp', sent_at: ago(1440) } });
  expect(sentenceFor(viaLink, 'manager', NOW)).toBe('נשלח למיזוג אלון בוואטסאפ אתמול · הקישור טרם נפתח');
  const opened = tk({ ...sent, events: [{ kind: 'link_opened', at: ago(30) }] });
  expect(linkOpened(opened)).toBe(true);
  expect(sentenceFor(opened, 'manager', NOW)).toBe('מיזוג אלון פתח/ה את הקישור · ממתין לאישור קבלה');
  // an open of an earlier assignment does not count
  expect(linkOpened(tk({ ...sent, events: [{ kind: 'link_opened', at: ago(600) }] }))).toBe(false);
  const listItem = tk({ status: 'assigned', assignee: vendor });
  expect(linkOpened(listItem)).toBeNull();
  expect(sentenceFor(listItem, 'manager', NOW)).toBe('נמסר למיזוג אלון · ממתין לאישור קבלה');
  expect(sentenceFor(listItem, 'requester', NOW)).toBe('נמסר למטפל · ממתין לאישור קבלה');
  expect(ballOf(listItem)).toBe('vendor');
});

test('acknowledged: who acknowledged and the ETA ("לא נמסר" without one)', () => {
  const t = tk({ status: 'acknowledged', assignee: user, eta_at: TOMORROW_9 });
  expect(sentenceFor(t, 'manager', NOW)).toBe('אלון ד. אישר/ה קבלה · צפי: מחר 09:00');
  expect(sentenceFor(t, 'handler', NOW)).toBe('אישרת קבלה · צפי: מחר 09:00');
  expect(sentenceFor(t, 'requester', NOW)).toBe('המטפל אישר קבלה · צפי: מחר 09:00');
  expect(sentenceFor(tk({ ...t, eta_at: null }), 'manager', NOW)).toBe('אלון ד. אישר/ה קבלה · צפי: לא נמסר');
});

test('in progress: with an ETA, without one ("ללא עדכון מאז"), handler and requester', () => {
  const t = tk({ status: 'in_progress', assignee: vendor, eta_at: TOMORROW_9 });
  expect(sentenceFor(t, 'manager', NOW)).toBe('מיזוג אלון מטפל/ת · צפי מחר 09:00');
  expect(sentenceFor(tk({ ...t, eta_at: null }), 'manager', NOW)).toBe('מיזוג אלון מטפל/ת · ללא עדכון מאז לפני 2 שע׳');
  expect(sentenceFor(t, 'handler', NOW)).toBe('בטיפולך · צפי: מחר 09:00');
  expect(sentenceFor(t, 'requester', NOW)).toBe('בטיפול · צפי: מחר 09:00');
  expect(ballOf(t)).toBe('vendor');
});

test('waiting for a part (the sub-state): manager / handler / requester', () => {
  const t = tk({ status: 'waiting_part', assignee: vendor, eta_at: TOMORROW_9 });
  expect(sentenceFor(t, 'manager', NOW)).toBe('מיזוג אלון ממתין/ה לחלק · צפי מחר 09:00');
  expect(sentenceFor(t, 'handler', NOW)).toBe('ממתין לחלק · צפי: מחר 09:00');
  expect(sentenceFor(t, 'requester', NOW)).toBe('בטיפול · ממתין לחלק');
});

test('done: no claim / a submitted claim (mine or not) / an awaited claim; the vendor\'s word "בוצע" is quoted', () => {
  const ev = [{ kind: 'status', at: ago(60), to: 'done' as TicketStatus }];
  const t = tk({ status: 'done', assignee: vendor, events: ev });
  expect(sentenceFor(t, 'manager', NOW)).toBe('מיזוג אלון סימן/ה "בוצע" לפני 1 שע׳ · ממתין לאישורך ולסגירה');
  expect(sentenceFor(t, 'approver', NOW)).toBe('מיזוג אלון סימן/ה "בוצע" לפני 1 שע׳ · ממתין לאישור המנהל ולסגירה');
  expect(sentenceFor(t, 'handler', NOW)).toBe('סימנת "בוצע" לפני 1 שע׳ · ממתין לאישור המנהל ולסגירה');
  expect(sentenceFor(t, 'requester', NOW)).toBe('הטיפול הסתיים · ממתין לסגירה');
  expect(ballOf(t)).toBe('manager');
  const claim = tk({ ...t, cost: { status: 'submitted', can_decide: true } });
  expect(sentenceFor(claim, 'manager', NOW)).toBe('מיזוג אלון סימן/ה "בוצע" לפני 1 שע׳ · דרישת תשלום ממתינה לאישורך');
  expect(sentenceFor(tk({ ...t, cost: { status: 'submitted', can_decide: false } }), 'manager', NOW)).toBe('מיזוג אלון סימן/ה "בוצע" לפני 1 שע׳ · דרישת תשלום ממתינה לאישור');
  expect(ballOf(claim)).toBe('approver');
  const awaiting = tk({ ...t, cost: { status: 'awaiting', can_decide: true } });
  expect(sentenceFor(awaiting, 'manager', NOW)).toBe('מיזוג אלון סימן/ה "בוצע" לפני 1 שע׳ · ממתין לדרישת תשלום מהספק');
  expect(ballOf(awaiting)).toBe('vendor');
  // without the status row the last activity is the time
  expect(sentenceFor(tk({ status: 'done', assignee: user }), 'manager', NOW)).toContain('לפני 2 שע׳');
});

test('returned: the handler, the reason ("לא בתחומי" for not-mine), the plain form; the requester', () => {
  const asg = [{ kind: 'user' as const, name: 'אלון ד.', channel: 'inapp', assigned_at: ago(300), ended_at: ago(60), end_reason: 'returned', return_kind: 'cannot_handle', return_reason: 'חסר חלק במלאי' }];
  const t = tk({ status: 'returned', last_assignee_name: 'אלון ד.', assignments: asg, waiting_reason: 'returned' });
  expect(sentenceFor(t, 'manager', NOW)).toBe('אלון ד. החזיר/ה: חסר חלק במלאי · ממתין לשיוך מחדש');
  const notMine = tk({ ...t, assignments: [{ ...asg[0], return_kind: 'not_mine', return_reason: null }] });
  expect(sentenceFor(notMine, 'manager', NOW)).toBe('אלון ד. החזיר/ה: לא בתחומי · ממתין לשיוך מחדש');
  expect(sentenceFor(tk({ status: 'returned', waiting_reason: 'not_mine', last_assignee_name: 'דנה' }), 'manager', NOW)).toBe('דנה החזיר/ה: לא בתחומי · ממתין לשיוך מחדש');
  expect(sentenceFor(tk({ status: 'returned' }), 'manager', NOW)).toBe('הוחזרה · ממתין לשיוך מחדש');
  expect(sentenceFor(t, 'requester', NOW)).toBe('הוחזרה למנהל · ממתין לשיוך מחדש');
  expect(ballOf(t)).toBe('manager');
  const long = tk({ ...t, assignments: [{ ...asg[0], return_reason: 'א'.repeat(200) }] });
  expect(sentenceFor(long, 'manager', NOW).length).toBeLessThanOrEqual(SENTENCE_MAX);
});

test('closed: when, by whom, the close note (clipped to the budget); the requester does not read the note', () => {
  const t = tk({ status: 'closed', closed_at: ago(60), closed_by_name: 'דני כ.', close_note: 'הוחלפה משאבת ניקוז' });
  expect(sentenceFor(t, 'manager', NOW)).toBe('נסגרה לפני 1 שע׳ על ידי דני כ. · הוחלפה משאבת ניקוז');
  expect(sentenceFor(t, 'requester', NOW)).toBe('נסגרה לפני 1 שע׳ על ידי דני כ.');
  expect(sentenceFor(tk({ status: 'closed', closed_at: ago(60) }), 'manager', NOW)).toBe('נסגרה לפני 1 שע׳');
  const long = sentenceFor(tk({ ...t, close_note: 'מילה '.repeat(60) }), 'manager', NOW);
  expect(long.length).toBeLessThanOrEqual(SENTENCE_MAX);
  expect(long.endsWith('…')).toBe(true);
  expect(ballOf(t)).toBe('none');
});

test('cancelled: when, the reason, the duplicate', () => {
  const t = tk({ status: 'cancelled', closed_at: ago(60), close_note: 'נפתחה בטעות', duplicate_of: { number: 1033 } });
  expect(sentenceFor(t, 'manager', NOW)).toBe('בוטלה לפני 1 שע׳ · כפילות של #1033 · נפתחה בטעות');
  expect(sentenceFor(tk({ status: 'cancelled', closed_at: ago(60) }), 'manager', NOW)).toBe('בוטלה לפני 1 שע׳');
  expect(sentenceFor(t, 'requester', NOW)).toBe('בוטלה לפני 1 שע׳ · כפילות של #1033');
  expect(ballOf(t)).toBe('none');
});

test('every state x every role: a non-empty sentence within 90 characters, no retired words', () => {
  const states: TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'returned', 'closed', 'cancelled'];
  for (const st of states)
    for (const role of VIEWER_ROLES) {
      for (const a of [null, user, vendor]) {
        const s = sentenceFor(tk({ status: st, assignee: a, close_note: 'x'.repeat(120), closed_by_name: 'ש'.repeat(30) }), role, NOW);
        expect(s.length, `${st}/${role}`).toBeGreaterThan(0);
        expect(s.length, `${st}/${role}: ${s}`).toBeLessThanOrEqual(SENTENCE_MAX);
        expect(s, `${st}/${role}`).not.toMatch(/קריא(ה|ות|ת)|דרישת עלות|\{/);
      }
    }
});

test('D33: a renamed module changes the gendered words of the sentence', () => {
  setTicketNames({ he: { one: 'תקלה', many: 'תקלות', gender: 'f' } });
  expect(sentenceFor(tk({ status: 'closed', closed_at: ago(60) }), 'manager', NOW)).toBe('נסגרה לפני 1 שע׳');
  setTicketNames({ he: { one: 'פנייה לטיפול', many: 'פניות', gender: 'm' } });
  expect(sentenceFor(tk({ status: 'closed', closed_at: ago(60) }), 'manager', NOW)).toBe('נסגר לפני 1 שע׳');
  expect(sentenceFor(tk(), 'manager', NOW)).toContain('נפתח לפני');
});

test('the role: handler (return / own ETA), manager, approver (finance), requester', () => {
  const r = (can: { manage: boolean; return?: boolean; eta?: boolean }, assignee: SentenceTicket['assignee'] = null, decide = false): ViewerRole => viewerRole({ can, assignee, cost: { can_decide: decide } });
  expect(r({ manage: false, return: true }, user)).toBe('handler');
  expect(r({ manage: false, eta: true }, user)).toBe('handler');
  expect(r({ manage: true, eta: true }, user)).toBe('manager'); // a manager's ETA right is not the assignee's
  expect(r({ manage: true, return: true }, user)).toBe('handler'); // a manager who is the assignee moves the flow
  expect(r({ manage: false }, null, true)).toBe('approver');
  expect(r({ manage: false })).toBe('requester');
});

test('the warning line: exactly one item, ranked; managers and approvers only; never on a final ticket', () => {
  const base = tk({ status: 'in_progress', assignee: vendor });
  for (const [reason, text] of [['send_failed', 'ההודעה לא נשלחה · שלחו שוב'], ['link_expired', 'הקישור פג · שלחו קישור חדש'], ['code_locked', 'נעילת קוד · שלחו קישור חדש'],
    ['contact_changed', 'פרטי איש הקשר השתנו · שלחו קישור חדש'], ['user_inactive', 'העובד אינו זמין · יש לשייך מחדש'], ['late_reply', 'תשובה מהמטפל הגיעה באיחור · לבדיקה'], ['reply', 'תשובה מהמטפל ממתינה לבדיקה'], ['question', 'המטפל שואל אותך שאלה · השיבו בשיחה']] as const) {
    expect(warningFor(tk({ ...base, waiting_reason: reason }))?.text, reason).toBe(text);
  }
  expect(warningFor(base)).toBeNull();
  // stuck from the events: after the last state change, with the reminders since then
  const stuckEvents = [
    { kind: 'status', at: ago(3000), to: 'in_progress' as TicketStatus },
    { kind: 'stuck', at: ago(2000), data: { kind: 'stuck' } },
    { kind: 'reminder', at: ago(1500) },
    { kind: 'reminder', at: ago(900) },
  ];
  const stuck = tk({ ...base, events: stuckEvents });
  expect(stuckOf(stuck)).toEqual({ kind: 'stuck', since: ago(2000), reminders: 2 });
  expect(warningFor(stuck)?.text).toBe('ללא עדכון · נשלחו 2 תזכורות');
  expect(warningFor(tk({ ...base, events: stuckEvents.slice(0, 3) }))?.text).toBe('ללא עדכון · נשלחה תזכורת');
  expect(warningFor(tk({ ...base, events: stuckEvents.slice(0, 2) }))?.text).toBe('ללא עדכון');
  // a status move after the stuck row clears it
  expect(warningFor(tk({ ...base, events: [...stuckEvents, { kind: 'status', at: ago(10), to: 'in_progress' as TicketStatus }] }))).toBeNull();
  // the board item's own stuck state
  expect(warningFor(tk({ ...base, stuck: { kind: 'unopened', since: ago(600) } }))?.text).toBe('הקישור לא נפתח');
  // ranking: a message problem outranks stuck, stuck outranks a late reply
  expect(warningFor(tk({ ...stuck, waiting_reason: 'send_failed' }))?.key).toBe('send_failed');
  expect(warningFor(tk({ ...stuck, waiting_reason: 'late_reply' }))?.key).toBe('stuck');
  expect(warningFor(tk({ ...base, waiting_reason: 'late_reply' }))?.key).toBe('late_reply');
  expect(warningFor(tk({ ...stuck, waiting_reason: 'send_failed' }))?.tone).toBe('bad');
  // other roles and final tickets
  expect(warningFor(tk({ ...base, waiting_reason: 'send_failed' }), 'handler')).toBeNull();
  expect(warningFor(tk({ ...base, waiting_reason: 'send_failed' }), 'requester')).toBeNull();
  expect(warningFor(tk({ ...base, waiting_reason: 'send_failed' }), 'approver')?.key).toBe('send_failed');
  expect(warningFor(tk({ ...base, status: 'closed', waiting_reason: 'send_failed' }))).toBeNull();
  for (const w of ['w_send_failed', 'w_link_expired', 'w_code_locked', 'w_contact_changed', 'w_late_reply'] as const) expect(drawerTemplate(w).length, w).toBeLessThanOrEqual(70);
});

test('SLA: the badge only near (< 24 h) or crossed; far = the quiet Overview row; none when done / final / hidden', () => {
  const sla = (min: number) => ({ ack_due_at: null, stuck_due_at: null, resolve_due_at: later(min) });
  expect(slaState(tk({ status: 'in_progress', sla: sla(31 * 60) }), NOW)).toEqual({ badge: null, row: 'יעד בעוד 1 ימ׳ 7 ש׳ · בתוך היעד' });
  expect(slaState(tk({ status: 'in_progress', sla: sla(180) }), NOW).badge).toEqual({ text: 'יעד בעוד 3 ש׳ 0 ד׳', tone: 'warn' });
  expect(slaState(tk({ status: 'in_progress', sla: sla(-45) }), NOW).badge).toEqual({ text: 'חריגה מהיעד · 45 ד׳', tone: 'bad' });
  // the nearest of the three targets
  expect(slaState(tk({ status: 'assigned', sla: { ack_due_at: later(30), stuck_due_at: null, resolve_due_at: later(3000) } }), NOW).badge?.text).toBe('יעד בעוד 30 ד׳');
  for (const st of ['done', 'closed', 'cancelled'] as TicketStatus[]) expect(slaState(tk({ status: st, sla: sla(-45) }), NOW)).toEqual({ badge: null, row: '' });
  expect(slaState(tk({ status: 'in_progress', sla: null }), NOW)).toEqual({ badge: null, row: '' });
  expect(slaState(tk({ status: 'in_progress', sla: { ack_due_at: null, stuck_due_at: null, resolve_due_at: null } }), NOW)).toEqual({ badge: null, row: '' });
});

test('small helpers: clip, the ETA words', () => {
  expect(clip('  a   b  ', 10)).toBe('a b');
  expect(clip('abcdefghij', 5)).toBe('abcd…');
  expect(clip('abc', 1)).toBe('');
  expect(etaText(null, NOW)).toBe('לא נמסר');
  expect(etaText('bogus', NOW)).toBe('לא נמסר');
  expect(etaText(new Date(2026, 9, 16, 15, 30).toISOString(), NOW)).toBe('היום 15:30');
  expect(etaText(TOMORROW_9, NOW)).toBe('מחר 09:00');
  expect(etaText(new Date(2026, 9, 20, 8, 5).toISOString(), NOW)).toBe('20/10 08:05');
});

test('the catalogue: no default module name, no retired words, every English key exists in Hebrew', () => {
  for (const k of DRAWER_TEXT_KEYS) {
    const he = drawerTemplate(k, 'he');
    expect(he, k).not.toMatch(/קריא(ה|ות|ת)|בקש(ת|ות) ה?שירות|ניהול השירות|דרישת עלות/);
  }
  for (const k of DRAWER_TEXT_EN_KEYS) {
    expect(DRAWER_TEXT_KEYS, k).toContain(k);
    expect(drawerTemplate(k, 'en'), k).not.toMatch(/\bTickets?\b/);
  }
  for (const k of DRAWER_TEXT_KEYS.filter((x) => x.startsWith('a_'))) expect(drawerTemplate(k, 'he').length, `${k}: button <= 22`).toBeLessThanOrEqual(22);
  for (const k of DRAWER_TEXT_KEYS.filter((x) => x.startsWith('tab_'))) expect(drawerTemplate(k, 'he').length, `${k}: tab <= 10`).toBeLessThanOrEqual(10);
});
