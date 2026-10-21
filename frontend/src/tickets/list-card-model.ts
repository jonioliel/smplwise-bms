/**
 * TKUI4 (release 2.6.0): the pure model of one request in a LIST - the card of the cards view and of the manager board, and the sentence
 * cell of the table. The sentence is THE status (tickets/status-sentence.ts `sentenceFor`, the same function as the drawer's status block);
 * the chip only classifies; a card holds at most three chips (IA §5: the priority, the department, and ONE of "to approve" / stuck /
 * reopened) and a vendor / owner avatar pair; on the board the single ranked warning line replaces the chips row ("never both").
 * No DOM, no Lit: tests/unit-tickets-list.spec.ts reads it directly.
 */
import type { Meta, TicketItem } from '../api/tickets';
import type { BoardItem } from '../api/tickets-board';
import type { TableRow } from '../api/tickets-table';
import type { CostStatus } from '../api/tickets-costs';
import { autoCloseLine, waitingLabel } from './board-model';
import { lt } from './list-text';
import { priorityTone, runLine } from './model';
import { SENTENCE_MAX, sentenceFor, statusChip, warningFor, type StatusChip, type ViewerRole } from './status-sentence';
import { tt } from './text';

/** A list item with the optional fields the cards read when the server sends them (the board's, a later cost / owner field of the list). */
export type CardItem = TicketItem & Partial<Pick<BoardItem, 'group' | 'stuck' | 'auto_close_at' | 'manager'>> & {
  /** the cost claim of the row, when the list carries it (the table does; the cards then show "to approve") */
  cost?: { status: CostStatus; can_decide?: boolean } | null;
  /** the internal owner ("אחראי בארגון"): not in the backend yet (IA §2) - rendered only when present */
  owner?: { name: string } | null;
};

export const CARD_CHIP_MAX = 3;
const FINAL = ['closed', 'cancelled'];
const isOpen = (t: Pick<TicketItem, 'status'>) => !FINAL.includes(t.status);

/** Who reads a list: the department manager, the internal handler (a plain member), or a requester / limited viewer. */
export type RoleSubject = Pick<CardItem, 'view' | 'department'> & { manager?: boolean; can?: { manage: boolean } };
export function roleFor(item: RoleSubject, meta: Pick<Meta, 'departments' | 'can'> | null): ViewerRole {
  if (item.view === 'limited') return 'requester';
  if (item.manager || item.can?.manage) return 'manager';
  const dept = item.department ? meta?.departments.find((d) => d.id === item.department?.id) : undefined;
  if (dept?.my_role === 'manager' || (meta?.can.all_departments && meta.can.manage)) return 'manager';
  if (dept?.my_role === 'member') return 'handler';
  return meta?.can.manage ? 'manager' : 'requester';
}

// ---------------------------------------------------------------- the chips (budget 3)

export interface CardChip {
  key: 'priority' | 'department' | 'cost' | 'stuck' | 'reopened';
  text: string;
  tone: '' | 'info' | 'warn' | 'ok' | 'bad';
  icon?: 'coin' | 'warning' | 'refresh';
}

/** priority, department, then ONE of cost-to-approve / stuck / reopened (that order of importance); never more than three. */
export function cardChips(item: CardItem, role: ViewerRole): CardChip[] {
  const out: CardChip[] = [];
  if (item.priority) out.push({ key: 'priority', text: item.priority.name, tone: priorityTone(item.priority) });
  if (item.department) out.push({ key: 'department', text: item.department.name, tone: '' });
  const managerial = role === 'manager' || role === 'approver';
  if (managerial && item.cost?.status === 'submitted' && item.cost.can_decide !== false && isOpen(item)) out.push({ key: 'cost', text: lt('lcCostMine'), tone: 'warn', icon: 'coin' });
  else if (managerial && item.stuck && isOpen(item)) out.push({ key: 'stuck', text: lt('lcStuck'), tone: 'bad', icon: 'warning' });
  else if (item.reopen_count > 0) out.push({ key: 'reopened', text: tt('reopenedChip'), tone: 'warn', icon: 'refresh' });
  return out.slice(0, CARD_CHIP_MAX);
}

// ---------------------------------------------------------------- the avatar pair

export interface Avatar {
  ini: string;
  name: string;
  /** an outside handler (a vendor / staff contact with a link) or an internal person */
  kind: 'ext' | 'int';
  /** what the title says for a screen reader */
  label: string;
}

/** "אלון ד." -> "אד"; one word -> its first two letters; empty -> ''. Digits and punctuation never make an initial. */
export function initials(name: string): string {
  const words = name.replace(/["'׳״.,()\-]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = (w: string) => [...w].filter((c) => /\p{L}/u.test(c));
  if (words.length >= 2) {
    const a = letters(words[0])[0] ?? '';
    const b = letters(words[1])[0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return letters(words[0] ?? '').slice(0, 2).join('').toUpperCase();
}

/** The vendor / handler first, the internal owner second (≤ 2); an unassigned request has no handler avatar. */
export function avatarPair(item: CardItem): Avatar[] {
  const out: Avatar[] = [];
  if (item.assignee?.name) {
    const ext = item.assignee.kind === 'contact';
    out.push({ ini: initials(item.assignee.name), name: item.assignee.name, kind: ext ? 'ext' : 'int', label: lt(ext ? 'lcWhoVendor' : 'lcWhoStaff', { name: item.assignee.name }) });
  }
  if (item.owner?.name) out.push({ ini: initials(item.owner.name), name: item.owner.name, kind: 'int', label: lt('lcWhoOwner', { name: item.owner.name }) });
  return out.filter((a) => a.ini).slice(0, 2);
}

// ---------------------------------------------------------------- the board's one warning line

export interface CardWarning {
  key: string;
  text: string;
  tone: 'warn' | 'bad';
  icon: 'warning' | 'user';
}

/**
 * The ONE line a board card shows instead of its chips: the ranked warning of `warningFor` (message failed, link expired, code locked,
 * contact changed, stuck, late / waiting reply); else, for a request that waits for the manager, why it waits ("ללא מטפל", "ממתין לסגירה").
 * Null when nothing needs a human - the card then shows its chips.
 */
export function boardWarning(item: CardItem, role: ViewerRole): CardWarning | null {
  if (!isOpen(item)) return null;
  const w = warningFor(item, role);
  if (w) {
    const urgent = w.key === 'stuck' && (item.stuck?.level ?? 0) >= 2;
    return { key: w.key, text: w.text, tone: urgent ? 'bad' : w.tone, icon: 'warning' };
  }
  if (item.group === 'waiting') {
    const text = waitingLabel(item.waiting_reason);
    if (text) return { key: 'wait', text, tone: 'warn', icon: 'user' };
  }
  return null;
}

// ---------------------------------------------------------------- the card

export interface CardModel {
  sentence: string;
  chip: StatusChip;
  chips: CardChip[];
  warning: CardWarning | null;
  avatars: Avatar[];
  /** the "updated 2 h ago" footer text and its dot */
  run: { text: string; tone: 'ok' | 'run' | 'bad' | '' };
  urgent: boolean;
  stuck: boolean;
}

/** One request as a card reads it. `board`: the warning line replaces the chips row (never both). */
export function cardModel(item: CardItem, ctx: { role: ViewerRole; now?: Date; board?: boolean }): CardModel {
  const now = ctx.now ?? new Date();
  let sentence = sentenceFor(item, ctx.role, now);
  // the board's done request tells when it closes by itself ("תיסגר אוטומטית ...") while the sentence still fits its budget
  if (ctx.board && item.status === 'done' && item.auto_close_at) {
    const tail = autoCloseLine(item.auto_close_at);
    if (tail && sentence.length + 3 + tail.length <= SENTENCE_MAX) sentence = `${sentence} · ${tail}`;
  }
  const warning = ctx.board ? boardWarning(item, ctx.role) : null;
  // UXFIX-NAV-295: a request still waiting for its handler says so in the sentence; the footer then does not repeat "ללא מטפל"
  const run = runLine(item, now, { omitUnassigned: !item.assignee && (item.status === 'new' || /שיוך|assign/i.test(sentence)) });
  return {
    sentence,
    chip: statusChip(item),
    chips: warning ? [] : cardChips(item, ctx.role),
    warning,
    avatars: avatarPair(item),
    run: { text: run.text, tone: run.tone },
    urgent: priorityTone(item.priority) === 'bad' && isOpen(item),
    stuck: !!item.stuck && isOpen(item),
  };
}

// ---------------------------------------------------------------- the table's sentence cell

/** The table's row as the sentence reads it: the row's own SLA shape differs from the list item's (the table has its own SLA column), so it is left out. */
export function rowSentence(r: TableRow, role: ViewerRole, now: Date, canDecide: boolean): string {
  const { sla: _sla, cost: _cost, ...rest } = r;
  return sentenceFor({ ...rest, cost: r.cost_status && r.cost_status !== 'not_required' ? { status: r.cost_status, can_decide: canDecide } : null }, role, now);
}
