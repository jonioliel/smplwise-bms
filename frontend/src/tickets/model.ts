/**
 * CR-038 slice 1: the pure logic of the tickets screens - routes, filters in the address, status and priority presentation, relative
 * times, timeline lines. No DOM, no Lit: the node unit tests (tests/unit-tickets-model.spec.ts) read it directly.
 */
import type { ListScope, Severity, StatusFilter, TicketDetail, TicketEvent, TicketItem, TicketStatus } from '../api/tickets';
import { tt, type TicketTextKey } from './text';
import { bt, type BoardTextKey } from './board-text';

const BOARD_REASONS = ['unassigned', 'overdue', 'unopened', 'ack', 'stuck', 'waiting'];
import { dt } from './device-text';

export const TICKETS_ROOT = '#/tickets';
export const SCOPES: readonly Exclude<ListScope, 'visible'>[] = ['mine', 'department', 'all'];
export const STATUS_FILTERS: readonly StatusFilter[] = ['open', 'unassigned', 'handling', 'done', 'closed', 'all'];
/** The main line of a ticket's life, as the detail's state strip shows it (returned / cancelled are side states). */
export const STATUS_LINE: readonly TicketStatus[] = ['new', 'assigned', 'acknowledged', 'in_progress', 'done', 'closed'];
export const FINAL: readonly TicketStatus[] = ['closed', 'cancelled'];
export const HANDLING: readonly TicketStatus[] = ['assigned', 'acknowledged', 'in_progress', 'waiting_part'];

/** A ticket id as the server makes them (16 hex characters): `#/tickets/<id>` is the full-screen detail, never a scope. */
export function isTicketId(s: string | undefined): boolean {
  return !!s && /^[0-9a-f]{16}$/.test(s);
}

export interface ListFilters {
  status: StatusFilter;
  department: string;
  q: string;
}
export const NO_FILTERS: ListFilters = { status: 'open', department: '', q: '' };

export interface TicketsRoute {
  /** the list (with an optional drawer) or the full-screen detail */
  kind: 'list' | 'detail';
  scope: Exclude<ListScope, 'visible'>;
  filters: ListFilters;
  /** the ticket open in the drawer (list) or on the full screen (detail) */
  ticketId: string;
  /** `?new=1`: the create form is open */
  creating: boolean;
}

/** `#/tickets/<scope>[?status=&dept=&q=&t=<id>&new=1]` or `#/tickets/<id>`. An unknown scope reads as `mine`. */
export function parseTicketsRoute(segments: readonly string[], params: URLSearchParams): TicketsRoute {
  const s1 = segments[1];
  const status = params.get('status') as StatusFilter | null;
  const filters: ListFilters = {
    status: status && STATUS_FILTERS.includes(status) ? status : 'open',
    department: (params.get('dept') ?? '').slice(0, 64),
    q: (params.get('q') ?? '').slice(0, 80),
  };
  if (isTicketId(s1)) return { kind: 'detail', scope: 'mine', filters, ticketId: s1 as string, creating: false };
  const scope = (SCOPES as readonly string[]).includes(s1 ?? '') ? (s1 as TicketsRoute['scope']) : 'mine';
  const t = params.get('t') ?? '';
  return { kind: 'list', scope, filters, ticketId: isTicketId(t) ? t : '', creating: params.get('new') === '1' };
}

/** The address of a list (its filters, the open drawer, the create form). Default filters are left out. */
export function listHref(scope: TicketsRoute['scope'], f: ListFilters = NO_FILTERS, extra: { t?: string; create?: boolean } = {}): string {
  const p = new URLSearchParams();
  if (f.status !== 'open') p.set('status', f.status);
  if (f.department) p.set('dept', f.department);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (extra.t) p.set('t', extra.t);
  if (extra.create) p.set('new', '1');
  const s = p.toString();
  return `${TICKETS_ROOT}/${scope}${s ? `?${s}` : ''}`;
}

let LAST_SCOPE: TicketsRoute['scope'] = 'mine';
/** The list the user came from (the full screen's back link returns to it); per tab, in memory. */
export function rememberScope(s: TicketsRoute['scope']): void {
  LAST_SCOPE = s;
}
export function lastScope(): TicketsRoute['scope'] {
  return LAST_SCOPE;
}

/** The full-screen detail (D18): `#/tickets/<id>`. */
export function ticketHref(id: string): string {
  return `${TICKETS_ROOT}/${id}`;
}

export function statusLabel(s: TicketStatus): string {
  return tt(`s_${s}` as TicketTextKey);
}

/** 2.5.6: "waiting for a part" is a sub-state of "in progress" (the stored status stays `waiting_part`), never a step of the flow. */
export function isWaitingPart(s: TicketStatus): boolean {
  return s === 'waiting_part';
}

/** The step of the flow a status shows as: `waiting_part` is the "in progress" step. */
export function lineStatus(s: TicketStatus): TicketStatus {
  return isWaitingPart(s) ? 'in_progress' : s;
}

/** The chip text of cards and the table: "בטיפול · ממתין לחלק" for the sub-state, the plain label otherwise. */
export function chipLabel(s: TicketStatus): string {
  return isWaitingPart(s) ? `${statusLabel('in_progress')} · ${statusLabel('waiting_part')}` : statusLabel(s);
}

/** The strip's toggle: mark the part wait (from a handled step that may move there) or return to treatment. null = not offered. */
export function waitingToggle(t: Pick<TicketDetail, 'transitions' | 'status'>): { to: TicketStatus; label: string } | null {
  if (isWaitingPart(t.status)) return t.transitions.some((x) => x.to === 'in_progress') ? { to: 'in_progress', label: tt('waitingBack') } : null;
  if (t.status !== 'in_progress' && t.status !== 'acknowledged') return null;
  return t.transitions.some((x) => x.to === 'waiting_part') ? { to: 'waiting_part', label: tt('waitingMark') } : null;
}

/** The moves a status menu offers: the sub-state is not a separate status there (the toggle sets it); leaving it reads "back to in progress". */
export function menuMoves<T extends { to: TicketStatus }>(status: TicketStatus, moves: readonly T[]): { move: T; label: string }[] {
  return moves.filter((m) => m.to !== 'waiting_part').map((m) => ({ move: m, label: isWaitingPart(status) && m.to === 'in_progress' ? tt('waitingBack') : statusLabel(m.to) }));
}

/** The chip tone of a status (styles: '' grey, info, warn, ok, bad). */
export function statusTone(s: TicketStatus): '' | 'info' | 'warn' | 'ok' | 'bad' {
  switch (s) {
    case 'assigned':
    case 'acknowledged':
    case 'in_progress':
      return 'info';
    case 'waiting_part':
    case 'returned':
      return 'warn';
    case 'done':
      return 'ok';
    default:
      return '';
  }
}

/** The chip tone of a priority: by its key (the four seeded ones) else by its notification severity. */
export function priorityTone(p: { key: string; severity: Severity } | null): '' | 'info' | 'warn' | 'bad' {
  if (!p) return '';
  if (p.key === 'urgent' || p.severity === 'critical') return 'bad';
  if (p.key === 'high') return 'warn';
  if (p.key === 'low' || p.severity === 'info') return '';
  return 'info';
}

export function filterLabel(f: StatusFilter): string {
  const keys: Record<StatusFilter, TicketTextKey> = { open: 'fOpen', unassigned: 'fUnassigned', handling: 'fHandling', done: 'fDone', closed: 'fClosed', all: 'fAll' };
  return tt(keys[f]);
}

export function scopeLabel(s: TicketsRoute['scope']): string {
  return tt(s === 'mine' ? 'tabMine' : s === 'department' ? 'tabDepartment' : 'tabAll');
}

/** "עכשיו" / "לפני 5 דק׳" / "לפני 3 שע׳" / "אתמול" / "לפני 4 ימים" - for the card and the timeline. */
export function relTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const min = Math.floor((now.getTime() - t) / 60_000);
  if (min < 1) return tt('justNow');
  if (min < 60) return tt('minutesAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return tt('hoursAgo', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? tt('yesterday') : tt('daysAgo', { n: d });
}

/** "07:42 11/10" - the mock-up's compact date and time (the installation's time zone is the browser's). */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/** `datetime-local` value of an ISO time (local), and back to an ISO (UTC) for the API; '' when empty or invalid. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d+Z$/, 'Z');
}

/** The card's "where" line: the place when the ticket has one (slice 3), else the department and the category. */
export function whereLine(t: Pick<TicketItem, 'place_text' | 'department' | 'category' | 'device_name'>): { strong: string; rest: string } {
  if (t.place_text) return { strong: t.place_text, rest: t.device_name };
  return { strong: t.department?.name ?? '', rest: t.category?.name ?? '' };
}

/** The card's footer line: when it moved last and who has it. */
export function runLine(t: Pick<TicketItem, 'last_activity_at' | 'assignee'>, now: Date = new Date()): { text: string; tone: 'ok' | 'run' | 'bad' | '' } {
  const when = tt('updated', { when: relTime(t.last_activity_at, now) });
  const who = t.assignee?.name || tt('noAssignee');
  return { text: `${when} · ${who}`, tone: t.assignee ? 'run' : 'bad' };
}

export interface EventLine {
  icon: 'plus' | 'edit' | 'check' | 'user' | 'refresh' | 'note' | 'clock' | 'image' | 'trash' | 'copy' | 'lock' | 'x' | 'link' | 'eye' | 'warning';
  text: string;
}

const FIELD_KEYS: Record<string, TicketTextKey> = {
  title: 'fld_title', description: 'fld_description', category_id: 'fld_category_id', priority_id: 'fld_priority_id', department_id: 'fld_department_id',
};

/** The one line a timeline row says (the body - a note, a reason - is shown under it). */
export function eventLine(e: TicketEvent, depts: Record<string, string> = {}): EventLine {
  const d = e.data ?? {};
  switch (e.kind) {
    case 'created':
      return { icon: 'plus', text: tt('e_created') };
    case 'edited': {
      if (typeof d.to_department === 'string') return { icon: 'edit', text: tt('e_moved', { dept: depts[d.to_department] ?? '' }).trim() };
      const fields = Array.isArray(d.fields) ? (d.fields as string[]).map((f) => (FIELD_KEYS[f] ? tt(FIELD_KEYS[f]) : f)).join(', ') : '';
      return { icon: 'edit', text: tt('e_edited', { fields }) };
    }
    case 'status':
      return { icon: 'check', text: `${tt('e_status', { status: e.to ? statusLabel(e.to) : '' })}${d.on_behalf ? ` (${tt('onBehalf')})` : ''}` };
    case 'closed':
      return { icon: 'lock', text: tt('e_closed') };
    case 'cancelled': {
      const dup = d.duplicate_of as { number?: number } | undefined;
      return { icon: 'x', text: dup?.number ? `${tt('e_cancelled')} · ${tt('duplicateOfLine', { n: dup.number })}` : tt('e_cancelled') };
    }
    case 'reopened':
      return { icon: 'refresh', text: tt('e_reopened') };
    case 'assigned':
      return { icon: 'user', text: tt('e_assigned', { name: String(d.assignee ?? '') }) };
    case 'reassigned':
      return { icon: 'user', text: tt('e_reassigned', { name: String(d.assignee ?? '') }) };
    case 'returned':
      return { icon: 'refresh', text: tt(d.kind === 'not_mine' ? 'e_returned_not_mine' : 'e_returned_cannot_handle') };
    case 'note':
      return { icon: 'note', text: d.absorbed ? tt('e_absorbed') : d.question ? tt('e_question') : tt('e_note') };
    case 'eta':
      return { icon: 'clock', text: d.eta_at ? tt('e_eta', { when: shortDateTime(String(d.eta_at)) }) : tt('e_etaCleared') };
    case 'photo':
      return { icon: 'image', text: tt('e_photo') };
    case 'photo_removed':
      return { icon: 'trash', text: tt('e_photoRemoved') };
    case 'duplicate':
      return { icon: 'copy', text: tt('e_duplicate', { n: Number(d.number ?? 0) }) };
    // slice 4: the handler link
    case 'link_opened':
      return { icon: 'eye', text: tt('ev_link_opened') };
    case 'link_copied':
      return { icon: 'copy', text: tt('ev_link_copied') };
    case 'link_new':
      return { icon: 'link', text: tt('ev_link_new') };
    case 'link_revoked':
      return { icon: 'x', text: tt('ev_link_revoked') };
    case 'contact_changed':
      return { icon: 'warning', text: tt('ev_contact_changed') };
    case 'user_inactive': // TKSTAFF1: the employee's no-login staff link died with their membership / account
      return { icon: 'warning', text: tt('ev_user_inactive') };
    // slice 6: the rows the SLA monitor writes (actor: the system)
    case 'stuck':
      return { icon: 'clock', text: bt('e_stuck', { reason: BOARD_REASONS.includes(String(d.kind)) ? bt(`r_${String(d.kind)}` as BoardTextKey) : '' }) };
    case 'reminder':
      return { icon: 'clock', text: bt('e_reminder', { n: Number(d.n ?? 1) }) };
    case 'manager_alerted':
      return { icon: 'user', text: bt('e_manager_alerted') };
    case 'auto_closed':
      return { icon: 'lock', text: bt('e_auto_closed') };
    case 'link_expired':
      return { icon: 'x', text: bt('e_link_expired') };
    case 'device_context': // slice 3: the 24 h history frozen at creation (counts only)
      return { icon: 'clock', text: d.withheld || d.source === 'none' ? dt('historyNotAttached') : dt('historyAttached', { n: Number(d.count ?? 0) }) };
    default:
      return { icon: 'note', text: e.kind };
  }
}

/** The actor's name of a timeline row ("המערכת" for the system). */
export function actorName(e: TicketEvent): string {
  return e.actor.kind === 'system' ? tt('e_system') : e.actor.name;
}

/** Whether the strip offers a move to this state now (POST /status), and whether that move needs a note. */
export function moveTo(t: Pick<TicketDetail, 'transitions'>, to: TicketStatus): { allowed: boolean; noteRequired: boolean } {
  const m = t.transitions.find((x) => x.to === to);
  return { allowed: !!m, noteRequired: !!m?.note_required };
}

/** The moves the strip does not show: cancel and the reopen from closed (footer buttons of the detail). */
export function sideMoves(t: Pick<TicketDetail, 'transitions' | 'status'>): { cancel: boolean; reopen: boolean } {
  return { cancel: t.transitions.some((x) => x.to === 'cancelled'), reopen: t.status === 'closed' && t.transitions.some((x) => x.to === 'new') };
}

/** Internal content is marked only once the ticket ever went to an outside handler (slice 4) - before that every row is internal. */
export function marksInternal(t: Pick<TicketDetail, 'assignments'>): boolean {
  return t.assignments.some((a) => a.kind === 'contact');
}
