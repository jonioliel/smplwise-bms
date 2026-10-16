/**
 * TKUI1 (release 2.6.0): ONE vocabulary for the state of a request (IA document SERVICE_MODULE_UX_IA_2026-10-16 §3). The status block of
 * the drawer / page / phone sheet, the list card, the table's sentence column, the board's "waiting for me" group and push texts all call
 * the functions of this file, so a card and the drawer never disagree:
 *   - `statusChip(t)`      the ONE chip (+ the "ממתין לחלק" sub-label of `waiting_part`, never a step of the flow);
 *   - `sentenceFor(t, r)`  the one-sentence status "[who] [does what] · [what is next / since when]", role-resolved (≤ 90 characters);
 *   - `ballOf(t)`          who holds the ball (manager / handler / vendor / approver / none);
 *   - `warningFor(t)`      the ONE ranked warning line (send failed > link expired > code locked > contact changed > stuck > late reply >
 *                          reply), managers only;
 *   - `slaState(t)`        the SLA badge only when the nearest target is under 24 h or crossed; otherwise the quiet Overview row text.
 * Pure: no DOM, no Lit (tests/unit-tickets-status-sentence.spec.ts). The input is structural, so a list item (no events / link) and a full
 * detail both fit; fields that are absent make the sentence fall back to its generic form, never to "unknown".
 */
import type { Assignee, TicketStatus } from '../api/tickets';
import type { CostStatus } from '../api/tickets-costs';
import { bt, type BoardTextKey } from './board-text';
import { fmtDur } from './board-model';
import { dwt, type DrawerTextKey } from './drawer-text';
import { chipLabel, relTime, statusLabel, statusTone } from './model';

export type ViewerRole = 'manager' | 'handler' | 'approver' | 'requester';
export type Ball = 'manager' | 'handler' | 'vendor' | 'approver' | 'none';
export const VIEWER_ROLES: readonly ViewerRole[] = ['manager', 'handler', 'approver', 'requester'];
export const SENTENCE_MAX = 90;

const HANDLING: readonly TicketStatus[] = ['assigned', 'acknowledged', 'in_progress', 'waiting_part'];

/** What the sentence reads. A list item has the first block; a detail adds the optional ones. */
export interface SentenceTicket {
  status: TicketStatus;
  assignee: Assignee | null;
  eta_at: string | null;
  created_at: string;
  created_by: { name: string };
  last_activity_at: string;
  waiting_reason: string | null;
  last_assignee_name?: string | null;
  closed_at?: string | null;
  closed_by_name?: string | null;
  close_note?: string | null;
  duplicate_of?: { number: number } | null;
  sla?: { ack_due_at: string | null; stuck_due_at: string | null; resolve_due_at: string | null } | null;
  cost?: { status: CostStatus; can_decide?: boolean } | null;
  assignments?: readonly { kind: 'user' | 'contact'; name: string; channel: string; assigned_at: string; ended_at: string | null; end_reason: string | null; return_kind?: string | null; return_reason: string | null }[];
  link?: { first_opened_at: string | null; sent_via?: string | null; sent_at?: string | null; open_count?: number; state?: string } | null;
  events?: readonly { kind: string; at: string; to?: TicketStatus | null; data?: Record<string, unknown> }[];
  /** the board / table item's stuck state (detail: derived from the events) */
  stuck?: { kind: string; since: string | null } | null;
}

/** What the role resolution reads (the detail's `can`). */
export interface RoleTicket {
  can: { manage: boolean; return?: boolean; eta?: boolean };
  assignee: Assignee | null;
  cost?: { can_decide?: boolean } | null;
}

/** Who reads the block: the department manager, the internal handler, the cost approver (finance) or the requester / a limited viewer. */
export function viewerRole(t: RoleTicket): ViewerRole {
  const handler = !!t.can.return || (!!t.can.eta && !t.can.manage && t.assignee?.kind === 'user');
  if (handler) return 'handler';
  if (t.can.manage) return 'manager';
  if (t.cost?.can_decide) return 'approver';
  return 'requester';
}

// ---------------------------------------------------------------- small helpers

const s = (key: DrawerTextKey, vars?: Record<string, string | number>) => dwt(key, vars);

/** Shorten a free text (a close note, a return reason) so the whole sentence stays inside its budget. */
export function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (max <= 1) return '';
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}

/** "היום 09:00" / "מחר 09:00" / "17/10 09:00" - an ETA in the reader's words (local time). */
export function etaText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return s('eta_none');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s('eta_none');
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff === 0) return s('eta_today', { time });
  if (diff === 1) return s('eta_tomorrow', { time });
  return s('eta_date', { date: `${p(d.getDate())}/${p(d.getMonth() + 1)}`, time });
}

/** The handler's display name: the current assignee, else the last one, else the role word. */
function handlerName(t: SentenceTicket): string {
  if (t.assignee?.name) return t.assignee.name;
  if (t.last_assignee_name) return t.last_assignee_name;
  const last = t.assignments?.length ? t.assignments[t.assignments.length - 1] : undefined;
  return last?.name || s('handlerWord');
}

/** The current (open) assignment, when the detail carries them. */
function currentAssignment(t: SentenceTicket) {
  return t.assignments?.filter((a) => !a.ended_at).at(-1);
}

/** Whether the outside handler opened the current link: true / false, or null when this input cannot tell (a list item). */
export function linkOpened(t: SentenceTicket): boolean | null {
  if (t.link) return !!t.link.first_opened_at;
  if (!t.events) return null;
  const since = currentAssignment(t)?.assigned_at ?? t.assignee?.since ?? '';
  return t.events.some((e) => e.kind === 'link_opened' && e.at >= since);
}

/** When the handler marked "done": the last status row to `done`, else the last activity. */
function doneAt(t: SentenceTicket): string {
  const ev = t.events?.filter((e) => e.kind === 'status' && e.to === 'done').at(-1);
  return ev?.at ?? t.last_activity_at;
}

/** The return reason of the last returned assignment ("לא בתחומי" for not-mine without a reason). */
function returnReason(t: SentenceTicket): string {
  const a = t.assignments?.filter((x) => x.end_reason === 'returned').at(-1);
  if (a?.return_reason) return a.return_reason;
  if (a?.return_kind === 'not_mine' || t.waiting_reason === 'not_mine') return s('reason_not_mine');
  return '';
}

/** Fill a template whose free text goes last, keeping the whole under SENTENCE_MAX. */
function withTail(head: string, tail: string): string {
  if (!tail) return head;
  const room = SENTENCE_MAX - head.length - 3;
  const t = clip(tail, room);
  return t ? `${head} · ${t}` : head;
}

// ---------------------------------------------------------------- the chip, the ball, the sentence

export interface StatusChip {
  /** the main word ("בטיפול") */
  label: string;
  /** the sub-state shown inside the chip ("ממתין לחלק"), or '' */
  sub: string;
  /** the plain text of the chip ("בטיפול · ממתין לחלק") - the same as cards and the table */
  text: string;
  tone: '' | 'info' | 'warn' | 'ok' | 'bad';
}

/** The ONE status chip: `waiting_part` is "בטיפול" with the sub-label, never a step of its own. */
export function statusChip(t: Pick<SentenceTicket, 'status'>): StatusChip {
  const part = t.status === 'waiting_part';
  return {
    label: part ? statusLabel('in_progress') : statusLabel(t.status),
    sub: part ? statusLabel('waiting_part') : '',
    text: chipLabel(t.status),
    tone: part ? 'info' : statusTone(t.status),
  };
}

/** Who holds the ball now (IA §3.2 "Ball" column). */
export function ballOf(t: SentenceTicket): Ball {
  if (t.cost?.status === 'submitted' && (t.status === 'done' || HANDLING.includes(t.status))) return 'approver';
  switch (t.status) {
    case 'new':
    case 'returned':
      return 'manager';
    case 'assigned':
    case 'acknowledged':
    case 'in_progress':
    case 'waiting_part':
      return t.assignee?.kind === 'contact' ? 'vendor' : 'handler';
    case 'done':
      return t.cost?.status === 'awaiting' ? 'vendor' : 'manager';
    default:
      return 'none';
  }
}

/** The one-sentence status, as the viewer reads it (manager wording unless the role has its own). */
export function sentenceFor(t: SentenceTicket, role: ViewerRole = 'manager', now: Date = new Date()): string {
  const name = handlerName(t);
  const req = role === 'requester';
  const hd = role === 'handler';
  const eta = etaText(t.eta_at, now);
  switch (t.status) {
    case 'new':
      return req ? s('sn_new_requester') : s('sn_new', { when: relTime(t.created_at, now), who: t.created_by.name });
    case 'assigned': {
      if (req) return s('sn_assigned_requester');
      if (t.assignee?.kind !== 'contact') return hd ? s('sn_assigned_user_handler') : s('sn_assigned_user', { name });
      const opened = linkOpened(t);
      if (opened === true) return s('sn_assigned_opened', { name });
      if (opened === false) {
        const ch = t.link?.sent_via ?? currentAssignment(t)?.channel ?? '';
        const via = ch === 'whatsapp' ? s('via_whatsapp') : ch === 'email' ? s('via_email') : '';
        const when = relTime(t.link?.sent_at ?? t.assignee?.since ?? t.last_activity_at, now);
        return s('sn_assigned_sent', { name, via, when });
      }
      return s('sn_assigned_contact', { name });
    }
    case 'acknowledged':
      return req ? s('sn_ack_requester', { eta }) : hd ? s('sn_ack_handler', { eta }) : s('sn_ack', { name, eta });
    case 'in_progress':
      if (req) return s('sn_progress_requester', { eta });
      if (hd) return s('sn_progress_handler', { eta });
      return t.eta_at ? s('sn_progress_eta', { name, eta }) : s('sn_progress_quiet', { name, when: relTime(t.last_activity_at, now) });
    case 'waiting_part':
      return req ? s('sn_part_requester') : hd ? s('sn_part_handler', { eta }) : s('sn_part', { name, eta });
    case 'done': {
      const when = relTime(doneAt(t), now);
      if (req) return s('sn_done_requester');
      if (hd) return s('sn_done_handler', { when });
      const claim = t.cost?.status;
      if (claim === 'submitted') return t.cost?.can_decide ? s('sn_done_claim_mine', { name, when }) : s('sn_done_claim_other', { name, when });
      if (claim === 'awaiting') return s('sn_done_claim_awaiting', { name, when });
      return role === 'manager' ? s('sn_done', { name, when }) : s('sn_done_other', { name, when });
    }
    case 'returned': {
      if (req) return s('sn_returned_requester');
      const reason = returnReason(t);
      if (!reason) return s('sn_returned_plain');
      const head = s('sn_returned', { name, reason: '\u0000' });
      const room = SENTENCE_MAX - (head.length - 1);
      return head.replace('\u0000', clip(reason, room));
    }
    case 'closed': {
      const when = relTime(t.closed_at ?? t.last_activity_at, now);
      const head = t.closed_by_name ? s('sn_closed', { when, who: t.closed_by_name }) : s('sn_closed_plain', { when });
      return req ? head : withTail(head, t.close_note ?? '');
    }
    case 'cancelled': {
      const head = s('sn_cancelled', { when: relTime(t.closed_at ?? t.last_activity_at, now) });
      const dup = t.duplicate_of ? s('sn_duplicate', { n: t.duplicate_of.number }) : '';
      const withDup = dup ? `${head} · ${dup}` : head;
      return req ? withDup : withTail(withDup, t.close_note ?? '');
    }
    default:
      return statusLabel(t.status);
  }
}

// ---------------------------------------------------------------- the warning line

export type WarningKey = 'send_failed' | 'link_expired' | 'code_locked' | 'contact_changed' | 'user_inactive' | 'stuck' | 'late_reply' | 'reply';
export interface Warning {
  key: WarningKey;
  text: string;
  tone: 'warn' | 'bad';
}
/** The rank of the warning reasons (IA §3.3 rule 5); `user_inactive` sits with the contact problems. */
export const WARNING_RANK: readonly WarningKey[] = ['send_failed', 'link_expired', 'code_locked', 'contact_changed', 'user_inactive', 'stuck', 'late_reply', 'reply'];
const STUCK_KINDS = ['unassigned', 'overdue', 'unopened', 'ack', 'stuck', 'waiting'];

/** The stuck state: the item's own (board / table), else the last `stuck` row after the last state change, assignment or status. */
export function stuckOf(t: SentenceTicket): { kind: string; since: string | null; reminders: number } | null {
  const evs = t.events ?? [];
  const reset = evs.filter((e) => ['status', 'assigned', 'reassigned', 'returned', 'reopened', 'closed', 'cancelled'].includes(e.kind)).at(-1)?.at ?? '';
  const reminders = evs.filter((e) => e.kind === 'reminder' && e.at >= reset).length;
  if (t.stuck) return { kind: t.stuck.kind, since: t.stuck.since, reminders };
  const ev = evs.filter((e) => e.kind === 'stuck' && e.at >= reset).at(-1);
  if (!ev) return null;
  return { kind: String(ev.data?.kind ?? 'stuck'), since: ev.at, reminders };
}

/** The ONE warning line a manager reads under the sentence; null when nothing needs a human (and always for the other roles). */
export function warningFor(t: SentenceTicket, role: ViewerRole = 'manager'): Warning | null {
  if (role !== 'manager' && role !== 'approver') return null;
  if (t.status === 'closed' || t.status === 'cancelled') return null;
  const found: Warning[] = [];
  const r = t.waiting_reason;
  const bad = (key: WarningKey, k: DrawerTextKey) => found.push({ key, text: s(k), tone: 'bad' });
  if (r === 'send_failed') bad('send_failed', 'w_send_failed');
  if (r === 'link_expired') bad('link_expired', 'w_link_expired');
  if (r === 'code_locked') bad('code_locked', 'w_code_locked');
  if (r === 'contact_changed') found.push({ key: 'contact_changed', text: s('w_contact_changed'), tone: 'warn' });
  if (r === 'user_inactive') bad('user_inactive', 'w_user_inactive');
  const st = stuckOf(t);
  if (st) {
    const reason = STUCK_KINDS.includes(st.kind) ? bt(`r_${st.kind}` as BoardTextKey) : bt('r_stuck');
    const cap = reason.charAt(0).toUpperCase() + reason.slice(1);
    const text = st.reminders > 1 ? s('w_stuck_reminders', { reason: cap, n: st.reminders }) : st.reminders === 1 ? s('w_stuck_reminder', { reason: cap }) : s('w_stuck', { reason: cap });
    found.push({ key: 'stuck', text, tone: 'warn' });
  }
  if (r === 'late_reply') found.push({ key: 'late_reply', text: s('w_late_reply'), tone: 'warn' });
  if (r === 'reply') found.push({ key: 'reply', text: s('w_reply'), tone: 'warn' });
  found.sort((a, b) => WARNING_RANK.indexOf(a.key) - WARNING_RANK.indexOf(b.key));
  return found[0] ?? null;
}

// ---------------------------------------------------------------- SLA

export interface SlaState {
  /** the badge of the status block: only near (< 24 h) or crossed */
  badge: { text: string; tone: 'warn' | 'bad' } | null;
  /** the quiet Overview row while the target is far; '' otherwise */
  row: string;
}
export const SLA_NEAR_MS = 24 * 3_600_000;

/** The nearest SLA target and how it reads. No SLA for done / final tickets or a viewer without the dues (null `sla`). */
export function slaState(t: Pick<SentenceTicket, 'status' | 'sla'>, now: Date = new Date()): SlaState {
  const none = { badge: null, row: '' };
  if (!t.sla || t.status === 'done' || t.status === 'closed' || t.status === 'cancelled') return none;
  const dues = [t.sla.ack_due_at, t.sla.stuck_due_at, t.sla.resolve_due_at].map((x) => (x ? Date.parse(x) : NaN)).filter((x) => !Number.isNaN(x));
  if (!dues.length) return none;
  const left = Math.min(...dues) - now.getTime();
  if (left < 0) return { badge: { text: s('slaOver', { dur: fmtDur(-left) }), tone: 'bad' }, row: '' };
  if (left < SLA_NEAR_MS) return { badge: { text: s('slaNear', { dur: fmtDur(left) }), tone: 'warn' }, row: '' };
  return { badge: null, row: s('slaFar', { dur: fmtDur(left) }) };
}
