/**
 * TKUI2 (release 2.6.0): the pure model of the request's Conversation and History tabs (IA §4.2, §4.1; mock-up v5 `tabConv` /
 * `tabHistory`). No DOM, no Lit, no API - the node unit tests (tests/unit-tickets-conversation.spec.ts) read it directly.
 *
 *   - ONE timeline model for both tabs: every ticket event becomes a `FeedItem` classified as the detail backend contract §6 does
 *     (docs/tickets/DETAIL_BACKEND_CONTRACT.md v1.3: message / internal_note / status_event / quote / demand / owner_change / photo /
 *     system), so the client can switch to `GET /tickets/{id}/timeline` later without changing a screen. The Conversation tab also folds
 *     the delivery rows of the outbox (`messages`, slice 5b) into the vendor feed in place of the event rows they duplicate.
 *   - The History filters (all / messages / notes / status / costs) with their counts.
 *   - The two sub-tabs "עם הספק" / "הצוות": which items each shows; one composer per sub-tab, never both; the drafts survive a switch.
 *   - The forward rule: "שלח לספק" on an internal note only PRE-FILLS the vendor composer (the note never changes visibility); the
 *     send then goes to `POST /tickets/{id}/notes/{event_id}/forward` with the (edited) text.
 *   - The keyboard asymmetry: Enter saves a team note (Shift+Enter = new line); the vendor composer sends only on Ctrl/Cmd+Enter.
 *   - The window of the feed: the last 20 items, "הודעות קודמות" renders the rest in place (never an inner scroll box).
 */
import type { TicketEvent } from '../api/tickets';
import type { TicketMessage } from '../api/tickets-messages';

export type FeedType = 'message' | 'internal_note' | 'status_event' | 'quote' | 'demand' | 'owner_change' | 'photo' | 'system';
export type Channel = 'page' | 'whatsapp' | 'email';
/** The delivery of an outgoing message in plain words (tickets/conversation-text.ts); `page` = a free text shown on the handler page. */
export type Delivery = 'page' | 'sent' | 'unknown' | 'failed' | 'held' | 'queued' | 'sending';

export interface FeedItem {
  /** the ticket event id, or `ob:<outbox id>` for a delivery row of the outbox */
  id: string;
  type: FeedType;
  kind: string;
  at: string;
  actor: { kind: string; name: string; me: boolean };
  body: string | null;
  external: boolean;
  direction: 'in' | 'out' | null;
  channel: Channel | null;
  delivery: Delivery | null;
  /** an outgoing message forwarded from an internal note (contract §6.1 `data.from_note_id`) */
  fromNoteId: string | null;
  /** a WhatsApp reply whose sender is not verified */
  unverified: boolean;
  event: TicketEvent | null;
  message: TicketMessage | null;
}

const STATUS_KINDS = new Set(['created', 'status', 'closed', 'cancelled', 'reopened', 'assigned', 'reassigned', 'returned', 'auto_closed']);
/** templated messages to the outside handler (the text is the template: `body` null) and their delivery as far as the event says */
const TEMPLATED: Record<string, Delivery | null> = {
  link_sent: 'sent', update_sent: 'sent', reminder: 'sent', code_sent: 'sent', cost_message: 'sent', message_unknown: 'unknown', message_failed: 'failed', message_fallback: null,
};
/** the event rows an outbox row of the same message replaces in the Conversation tab (History keeps every event) */
const OUTBOX_DUPLICATES = new Set(['link_sent', 'update_sent', 'reminder', 'code_sent', 'cost_message', 'message_unknown', 'message_failed']);

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** One ticket event as a timeline item (contract §6 classification). */
export function eventItem(e: TicketEvent): FeedItem {
  const base: FeedItem = {
    id: e.id, type: 'system', kind: e.kind, at: e.at, actor: { kind: e.actor?.kind ?? 'system', name: e.actor?.name ?? '', me: !!e.actor?.me }, body: e.body,
    external: !!e.external, direction: null, channel: null, delivery: null, fromNoteId: str(e.data?.from_note_id), unverified: false, event: e, message: null,
  };
  if (e.kind === 'note') {
    if (base.actor.kind === 'contact') return { ...base, type: 'message', direction: 'in', channel: 'page' };
    if (e.external) return { ...base, type: 'message', direction: 'out', channel: 'page', delivery: 'page' };
    return { ...base, type: 'internal_note' };
  }
  if (e.kind in TEMPLATED) return { ...base, type: 'message', direction: 'out', channel: e.via === 'email' ? 'email' : 'whatsapp', delivery: TEMPLATED[e.kind] };
  if (e.kind === 'inbound' || e.kind === 'late_reply') return { ...base, type: 'message', direction: 'in', channel: 'whatsapp', unverified: true };
  if (STATUS_KINDS.has(e.kind)) return { ...base, type: 'status_event' };
  if (e.kind === 'quote_submitted' || e.kind === 'quote_decided') return { ...base, type: 'quote' };
  if (e.kind === 'cost_submitted' || e.kind === 'cost_decision') return { ...base, type: 'demand' };
  if (e.kind === 'owner_changed') return { ...base, type: 'owner_change' };
  if (e.kind === 'photo' || e.kind === 'photo_removed') return { ...base, type: 'photo' };
  return base;
}

/** The delivery word of an outbox row (the line itself is message-lines.ts `messageLine`, reused). */
export function outboxDelivery(state: TicketMessage['state']): Delivery {
  switch (state) {
    case 'sent':
      return 'sent';
    case 'unknown':
      return 'unknown';
    case 'held':
      return 'held';
    case 'sending':
      return 'sending';
    case 'queued':
      return 'queued';
    default:
      return 'failed'; // not_sent, refused, cancelled, superseded: it did not leave
  }
}

export function outboxItem(m: TicketMessage): FeedItem {
  return {
    id: `ob:${m.id}`, type: 'message', kind: 'outbox', at: m.created_at, actor: { kind: 'system', name: '', me: false }, body: null, external: true, direction: 'out',
    channel: m.channel === 'email' ? 'email' : 'whatsapp', delivery: outboxDelivery(m.state), fromNoteId: null, unverified: false, event: null, message: m,
  };
}

/**
 * The one timeline, oldest first (a stable order for equal times). `outbox`: fold the delivery rows of the outbox in (the Conversation
 * tab, managers / tickets.external holders get `messages`) and drop the event rows they duplicate; History passes false and keeps
 * every event (its counts are the events').
 */
export function buildTimeline(t: { events: readonly TicketEvent[]; messages?: readonly TicketMessage[] }, opts: { outbox?: boolean } = {}): FeedItem[] {
  const merge = !!opts.outbox && !!t.messages?.length;
  const items = t.events.filter((e) => !(merge && OUTBOX_DUPLICATES.has(e.kind))).map(eventItem);
  if (merge) for (const m of t.messages ?? []) if (m.purpose !== 'test') items.push(outboxItem(m));
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.at < b.it.at ? -1 : a.it.at > b.it.at ? 1 : a.i - b.i))
    .map((x) => x.it);
}

// ---------------------------------------------------------------- History filters

export type HistoryFilter = 'all' | 'messages' | 'notes' | 'status' | 'costs';
export const HISTORY_FILTERS: readonly HistoryFilter[] = ['all', 'messages', 'notes', 'status', 'costs'];
const FILTER_TYPES: Record<Exclude<HistoryFilter, 'all'>, readonly FeedType[]> = {
  messages: ['message'], notes: ['internal_note'], status: ['status_event', 'owner_change'], costs: ['quote', 'demand'],
};

export function matchesFilter(it: FeedItem, f: HistoryFilter): boolean {
  return f === 'all' || FILTER_TYPES[f].includes(it.type);
}

export function filterItems(items: readonly FeedItem[], f: HistoryFilter): FeedItem[] {
  return items.filter((it) => matchesFilter(it, f));
}

export function filterCounts(items: readonly FeedItem[]): Record<HistoryFilter, number> {
  const out = { all: items.length, messages: 0, notes: 0, status: 0, costs: 0 } as Record<HistoryFilter, number>;
  for (const it of items) for (const f of ['messages', 'notes', 'status', 'costs'] as const) if (matchesFilter(it, f)) out[f] += 1;
  return out;
}

/** The link's audit rows of the History tab (who opened / copied / renewed / revoked the handler link), newest first. */
export function linkAuditRows(items: readonly FeedItem[]): FeedItem[] {
  return items.filter((it) => it.kind.startsWith('link_') && it.kind !== 'link_sent').reverse();
}

// ---------------------------------------------------------------- the two sub-tabs

export type ConvSub = 'vendor' | 'team';

/**
 * Which sub-tabs the Conversation tab offers (vendor photos show in "עם הספק", internal photos in "הצוות"). `vendorMode` = an outside contact was ever assigned (`marksInternal`): then "עם הספק" and
 * "הצוות"; otherwise one feed "הערות" with the team composer only (IA §4.2).
 */
export function convSubs(vendorMode: boolean): ConvSub[] {
  return vendorMode ? ['vendor', 'team'] : ['team'];
}

/**
 * The items of a sub-tab. Vendor: the messages both ways, the quote / demand rows and the status rows the handler also sees. Team: the
 * internal notes and internal photos. Without a vendor (one "הערות" feed) every note is a team note - a note marked external was
 * written for an internal handler, who sees everything anyway.
 */
export function inSub(it: FeedItem, sub: ConvSub, vendorMode: boolean): boolean {
  if (!vendorMode) return it.type === 'internal_note' || (it.type === 'message' && it.kind === 'note') || it.kind === 'inbound' || it.kind === 'late_reply' || (it.type === 'photo' && it.kind === 'photo');
  if (sub === 'vendor') return it.type === 'message' || it.type === 'quote' || it.type === 'demand' || ((it.type === 'status_event' || (it.type === 'photo' && it.kind === 'photo')) && it.external);
  return it.type === 'internal_note' || (it.type === 'photo' && it.kind === 'photo' && !it.external);
}

export function subItems(items: readonly FeedItem[], sub: ConvSub, vendorMode: boolean): FeedItem[] {
  return items.filter((it) => inSub(it, sub, vendorMode));
}

/** Incoming messages after the viewer's own last action (no read receipts exist) - the "עם הספק" badge, as the tab badge counts. */
export function unreadIn(items: readonly FeedItem[]): number {
  const mine = items.filter((it) => it.actor.me).at(-1)?.at ?? '';
  return items.filter((it) => it.direction === 'in' && it.at > mine).length;
}

/** Internal notes already forwarded: note id -> the outgoing message made from it. */
export function forwardedNotes(items: readonly FeedItem[]): Map<string, FeedItem> {
  const out = new Map<string, FeedItem>();
  for (const it of items) if (it.fromNoteId && it.direction === 'out') out.set(it.fromNoteId, it);
  return out;
}

/** "שלח לספק" is offered on an internal note that was not forwarded yet, to a viewer who may write to the vendor. */
export function canForward(it: FeedItem, ctx: { canVendor: boolean; forwarded: ReadonlyMap<string, FeedItem> }): boolean {
  return it.type === 'internal_note' && !!it.body?.trim() && ctx.canVendor && !ctx.forwarded.has(it.id);
}

/** A free text shown on the handler page, and the handler link was opened after it (the only receipt that exists - D14). */
export function openedAfter(it: FeedItem, items: readonly FeedItem[]): boolean {
  return it.delivery === 'page' && items.some((x) => x.kind === 'link_opened' && x.at > it.at);
}

// ---------------------------------------------------------------- the composers

export interface ConvState {
  sub: ConvSub;
  vendorDraft: string;
  teamDraft: string;
  /** the internal note the vendor draft was pre-filled from (the send becomes a forward of it) */
  sourceNote: string | null;
  /** "הודעות קודמות" pressed, per sub-tab */
  expanded: Record<ConvSub, boolean>;
}

export function initialConv(vendorMode: boolean): ConvState {
  return { sub: vendorMode ? 'vendor' : 'team', vendorDraft: '', teamDraft: '', sourceNote: null, expanded: { vendor: false, team: false } };
}

/** The active sub-tab of a state for a ticket: a vendor sub-tab never shows without a vendor. */
export function activeSub(s: ConvState, vendorMode: boolean): ConvSub {
  return vendorMode ? s.sub : 'team';
}

/** Switch the sub-tab: the active sub-tab owns the composer; both drafts are kept. */
export function switchSub(s: ConvState, sub: ConvSub): ConvState {
  return s.sub === sub ? s : { ...s, sub };
}

/** A draft typed: emptying the vendor draft forgets the note it came from. */
export function editDraft(s: ConvState, sub: ConvSub, text: string): ConvState {
  if (sub === 'team') return { ...s, teamDraft: text };
  return { ...s, vendorDraft: text, sourceNote: text.trim() ? s.sourceNote : null };
}

/**
 * "שלח לספק" on an internal note: switch to "עם הספק" and PRE-FILL the vendor composer - nothing is sent. An empty draft takes the
 * note's text; a draft in progress keeps its text and the note is appended after a blank line. The note stays internal.
 */
export function prefillFromNote(s: ConvState, note: { id: string; body: string | null }): ConvState {
  const text = (note.body ?? '').trim();
  const draft = s.vendorDraft.trim() ? `${s.vendorDraft.trimEnd()}\n\n${text}` : text;
  return { ...s, sub: 'vendor', vendorDraft: draft, sourceNote: note.id };
}

export type SendPlan = { route: 'note'; text: string } | { route: 'vendor'; text: string } | { route: 'forward'; noteId: string; text: string } | null;

/** What the active composer's button does: a team note (POST /notes, internal), a vendor message, or the forward of a pre-filled note. */
export function sendPlan(s: ConvState, sub: ConvSub = s.sub): SendPlan {
  const text = (sub === 'team' ? s.teamDraft : s.vendorDraft).trim();
  if (!text) return null;
  if (sub === 'team') return { route: 'note', text };
  return s.sourceNote ? { route: 'forward', noteId: s.sourceNote, text } : { route: 'vendor', text };
}

/** After a successful send the composer of that sub-tab is empty again (a failed send keeps the draft). */
export function afterSend(s: ConvState, sub: ConvSub): ConvState {
  return sub === 'team' ? { ...s, teamDraft: '' } : { ...s, vendorDraft: '', sourceNote: null };
}

/** The keyboard asymmetry (IA §4.2): true when this key press sends. */
export function enterSends(sub: ConvSub, e: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean }): boolean {
  if (e.key !== 'Enter' || e.isComposing) return false;
  if (sub === 'team') return !e.shiftKey;
  return !!(e.ctrlKey || e.metaKey);
}

// ---------------------------------------------------------------- the window and the day pills

export const CONV_WINDOW = 20;

/** The last `n` items unless expanded; `hidden` = how many older items "הודעות קודמות" would add. */
export function windowLast<T>(items: readonly T[], expanded: boolean, n: number = CONV_WINDOW): { shown: T[]; hidden: number } {
  if (expanded || items.length <= n) return { shown: [...items], hidden: 0 };
  return { shown: items.slice(items.length - n), hidden: items.length - n };
}

/** The local calendar day of an instant (`yyyy-mm-dd`), '' when invalid. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type FeedRow<T> = { day: string } | { item: T };

/** The feed with a day pill before the first item of each day. */
export function withDays<T extends { at: string }>(items: readonly T[]): FeedRow<T>[] {
  const out: FeedRow<T>[] = [];
  let last = '';
  for (const it of items) {
    const k = dayKey(it.at);
    if (k && k !== last) out.push({ day: k });
    last = k || last;
    out.push({ item: it });
  }
  return out;
}

/** "היום" / "אתמול" / dd/mm (the year when not this year) - the words come from the caller. */
export function dayLabel(key: string, now: Date, words: { today: string; yesterday: string }): string {
  if (key === dayKey(now.toISOString())) return words.today;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y.toISOString())) return words.yesterday;
  const [yy, mm, dd] = key.split('-');
  return yy === String(now.getFullYear()) ? `${dd}/${mm}` : `${dd}/${mm}/${yy}`;
}
