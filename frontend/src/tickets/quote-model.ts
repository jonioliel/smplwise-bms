/**
 * TKUI3 (release 2.6.0): the pure logic of the request's Costs tab (IA §4.1 / §6.3, contract v1.3 §3-§7). No DOM, no Lit:
 * tests/unit-tickets-quotes.spec.ts runs it in node.
 *   - the stage chip and the read-only stepper from the server's `flow.stage` (contract 4.3);
 *   - staff have NO money surface: an assignment the server marks `quote_capable: false` (a staff contact without an account, TKSTAFF1)
 *     never gets a quote, a payment demand, a requirement row or a cost action - whatever else the answer carries;
 *   - which quote counts, which decisions a quote offers (the server's `can` decides; this only hides the impossible), the partial
 *     approval's selection and its DISPLAY-ONLY totals (the server recomputes every figure);
 *   - the allowed line kinds editor (labour is always allowed);
 *   - the "לשלוח הודעה לספק?" dialog: built from the decision's `message_draft`, its default is NOT sending - closing it, Esc, or
 *     "לא עכשיו" never writes; only the explicit send produces a vendor message (with the draft's `source`).
 */
import type { CostClaim, CostMode, ExternalAssignment, LineKind, TicketCostBlock } from '../api/tickets-costs';
import type { CostFlow, FlowStage, MessageDraft, Quote, QuoteLine, QuoteState } from '../api/tickets-quotes';
import { vatOf, type Tone } from './cost-model';
import type { QuoteTextKey } from './quote-text';

export const KIND_ORDER: readonly LineKind[] = ['labor', 'parts', 'travel', 'other'];
export const QUOTE_APPROVED: readonly QuoteState[] = ['approved', 'partially_approved'];
const NOT_LIVE: readonly QuoteState[] = ['superseded', 'withdrawn', 'not_awarded'];

// ---------------------------------------------------------------- staff: no money surface

/** An assignment that may carry money: everything the server did not mark `quote_capable: false` (an older server sends no flag). */
export function isMoneyAssignment(a: Pick<ExternalAssignment, 'quote_capable'> | null | undefined): boolean {
  return !!a && a.quote_capable !== false;
}

/** The ids of the assignments that may carry money. */
export function moneyAssignmentIds(assignments: readonly ExternalAssignment[] | undefined): Set<string> {
  return new Set((assignments ?? []).filter(isMoneyAssignment).map((a) => a.id));
}

/** The assignment the flow describes is a staff one (no money surface at all for the tab). */
export function flowIsStaff(flow: CostFlow | undefined, assignments: readonly ExternalAssignment[] | undefined): boolean {
  if (!flow?.assignment_id) return false;
  const a = (assignments ?? []).find((x) => x.id === flow.assignment_id);
  return !!a && !isMoneyAssignment(a);
}

/** Claims and quotes of money assignments only (a staff assignment's rows are never rendered, even if a server sent any). */
export function moneyClaims(claims: readonly CostClaim[], assignments: readonly ExternalAssignment[] | undefined): CostClaim[] {
  const staff = new Set((assignments ?? []).filter((a) => !isMoneyAssignment(a)).map((a) => a.id));
  return claims.filter((c) => !staff.has(c.assignment_id));
}
export function moneyQuotes(quotes: readonly Quote[], assignments: readonly ExternalAssignment[] | undefined): Quote[] {
  const staff = new Set((assignments ?? []).filter((a) => !isMoneyAssignment(a)).map((a) => a.id));
  return quotes.filter((q) => !q.assignment_id || !staff.has(q.assignment_id));
}

// ---------------------------------------------------------------- the stage chip and the stepper

export type StepId = 'quote' | 'work' | 'demand' | 'paid';
export interface StageView { key: QuoteTextKey; tone: Tone; steps: { id: StepId; state: 'done' | 'cur' | '' }[] }

const STAGE: Record<FlowStage, { tone: Tone; at: number }> = {
  none: { tone: '', at: -1 },
  quote_optional: { tone: '', at: 0 },
  quote_requested: { tone: 'info', at: 0 },
  quote_submitted: { tone: 'warn', at: 0 },
  quote_fix_requested: { tone: 'info', at: 0 },
  quote_rejected: { tone: 'bad', at: 0 },
  quote_approved: { tone: 'ok', at: 1 },
  work: { tone: 'info', at: 1 },
  demand_awaiting: { tone: 'info', at: 2 },
  demand_submitted: { tone: 'warn', at: 2 },
  demand_rejected: { tone: 'bad', at: 2 },
  demand_approved: { tone: 'ok', at: 3 },
  paid: { tone: 'ok', at: 4 },
};

/** The chip and the stepper of a flow. Without a quote (`quote_mode: off` and none was sent) the stepper starts at the work. */
export function stageView(flow: Pick<CostFlow, 'stage' | 'quote_mode'> | undefined, hasQuote = false): StageView {
  const stage = flow?.stage ?? 'none';
  const s = STAGE[stage] ?? STAGE.none;
  const ids: StepId[] = flow?.quote_mode === 'off' && !hasQuote ? ['work', 'demand', 'paid'] : ['quote', 'work', 'demand', 'paid'];
  const at = stage === 'none' ? -1 : ids.length === 3 ? Math.max(0, s.at - 1) : s.at;
  return { key: `st_${stage}` as QuoteTextKey, tone: s.tone, steps: ids.map((id, i) => ({ id, state: at < 0 ? '' : i < at ? 'done' : i === at ? 'cur' : '' })) };
}

/** Whether the viewer is asked to decide now (the tab badge / the warn tone): a quote or a demand waits for an approver. */
export function waitsForApprover(stage: FlowStage | undefined): boolean {
  return stage === 'quote_submitted' || stage === 'demand_submitted';
}

// ---------------------------------------------------------------- which quote counts

/** The quote the card shows for an assignment: the approved one, else the newest live one, else the newest of all. */
export function currentQuote(quotes: readonly Quote[], assignmentId: string | null | undefined): Quote | undefined {
  const mine = quotes.filter((q) => !assignmentId || q.assignment_id === assignmentId);
  const approved = mine.filter((q) => QUOTE_APPROVED.includes(q.state));
  if (approved.length) return approved.at(-1);
  const live = mine.filter((q) => !NOT_LIVE.includes(q.state));
  return live.at(-1) ?? mine.at(-1);
}

/** The other versions of the same assignment, newest first (the "גרסאות קודמות" fold). */
export function olderQuotes(quotes: readonly Quote[], shown: Quote | undefined): Quote[] {
  if (!shown) return [];
  return quotes.filter((q) => q.id !== shown.id && q.assignment_id === shown.assignment_id).sort((a, b) => b.version - a.version);
}

export function quoteTone(state: QuoteState): Tone {
  switch (state) {
    case 'submitted':
      return 'warn';
    case 'approved':
    case 'partially_approved':
      return 'ok';
    case 'rejected':
      return 'bad';
    case 'fix_requested':
      return 'info';
    default:
      return '';
  }
}

// ---------------------------------------------------------------- what a quote offers

export interface QuoteActions { approve: boolean; partial: boolean; fix: boolean; reject: boolean }

/** The decisions a quote offers the viewer: the server's `can` (decide / reject) on a money assignment, a revision to send back, and
 *  a partial approval only when there is more than one line to choose from. */
export function quoteActions(q: Quote | undefined, assignments: readonly ExternalAssignment[] | undefined): QuoteActions {
  const none = { approve: false, partial: false, fix: false, reject: false };
  if (!q || q.revision === undefined) return none;
  const a = (assignments ?? []).find((x) => x.id === q.assignment_id);
  if (a && !isMoneyAssignment(a)) return none;
  const decide = !!q.can?.decide && q.state === 'submitted';
  return { approve: decide, partial: decide && (q.lines?.length ?? 0) > 1, fix: decide, reject: !!q.can?.reject && (q.state === 'submitted' || q.state === 'fix_requested') };
}

/** A partial approval's selection is valid when it keeps at least one line and leaves at least one out (all = a full approval). */
export function partialValid(q: Pick<Quote, 'lines'>, selected: ReadonlySet<number>): boolean {
  const n = q.lines?.length ?? 0;
  const picked = (q.lines ?? []).filter((l) => selected.has(l.index)).length;
  return picked > 0 && picked < n;
}

/** The DISPLAY-ONLY totals of a selection (same VAT mode and rate as the quote; the server's figures are the record). */
export function selectionTotals(q: Pick<Quote, 'lines' | 'vat_mode' | 'vat_rate_bp'>, selected: ReadonlySet<number>): { subtotal: number; vat: number; total: number } {
  const subtotal = (q.lines ?? []).filter((l) => selected.has(l.index)).reduce((n, l) => n + l.total_minor, 0);
  const v = vatOf(subtotal, q.vat_mode ?? 'excluded', q.vat_rate_bp ?? 0);
  return { subtotal, vat: v.vat, total: v.total };
}

/** The approved part of a quote for the card: the approved total once decided, else the full total. */
export function quoteShownTotal(q: Quote): number | null {
  if (QUOTE_APPROVED.includes(q.state) && q.approved?.total_minor !== null && q.approved?.total_minor !== undefined) return q.approved.total_minor;
  return q.total_minor ?? null;
}

/** A line's approval mark (only once the quote is decided). */
export function lineMark(l: QuoteLine): 'approved' | 'not' | '' {
  if (l.approved === undefined) return '';
  return l.approved ? 'approved' : 'not';
}

// ---------------------------------------------------------------- the payment demand against the baseline

/** The tone of the difference from the approved quote: more than the quote is a warning, less or equal is neutral. */
export function deltaTone(delta: number | null | undefined): Tone {
  return delta !== null && delta !== undefined && delta > 0 ? 'warn' : '';
}

/** A signed amount text ('+80.00 ₪' / '-12.00 ₪'), formatted by the caller's money function. */
export function signed(delta: number, money: (minor: number) => string): string {
  return delta > 0 ? `+${money(delta)}` : delta < 0 ? `-${money(-delta)}` : money(0);
}

// ---------------------------------------------------------------- allowed line kinds (labour always)

/** Toggle a kind in a set of allowed kinds: labour never leaves; the result keeps the canonical order. */
export function toggleKind(kinds: readonly LineKind[], kind: LineKind): LineKind[] {
  if (kind === 'labor') return KIND_ORDER.filter((k) => k === 'labor' || kinds.includes(k));
  const has = kinds.includes(kind);
  return KIND_ORDER.filter((k) => k === 'labor' || (k === kind ? !has : kinds.includes(k)));
}

export function sameKinds(a: readonly LineKind[] | null | undefined, b: readonly LineKind[] | null | undefined): boolean {
  if (!a || !b) return a === b;
  return KIND_ORDER.every((k) => a.includes(k) === b.includes(k));
}

// ---------------------------------------------------------------- requirements (manager of the request)

/** The money assignments whose requirement a manager may set now: open, money-capable. */
export function requirementTargets(assignments: readonly ExternalAssignment[] | undefined, cost: TicketCostBlock | undefined): ExternalAssignment[] {
  if (!cost?.can_set_requirement) return [];
  return (assignments ?? []).filter((a) => !a.ended_at && isMoneyAssignment(a));
}

/** "בקשת הצעת מחיר" (the empty state's quiet action): a manager, an open money assignment whose quote mode is not required yet. */
export function askQuoteTarget(assignments: readonly ExternalAssignment[] | undefined, cost: TicketCostBlock | undefined, flow: CostFlow | undefined): string | null {
  const open = requirementTargets(assignments, cost);
  const a = open.find((x) => x.id === flow?.assignment_id) ?? open.at(-1);
  if (!a) return null;
  return (a.quote_mode ?? 'optional') === 'required' ? null : a.id;
}

export const MODES: readonly CostMode[] = ['required', 'optional', 'off'];

// ---------------------------------------------------------------- "לשלוח הודעה לספק?" (approvals never send a message by themselves)

export type DraftSubject = 'quote' | 'claim';
export interface SendDialog {
  subject: DraftSubject;
  /** the decision the dialog follows (its title) - quote: approved / partially_approved / fix_requested / rejected; claim: approved / rejected */
  decision: string;
  text: string;
  notify: boolean;
  source: { kind: DraftSubject; id: string };
  vendor: string;
}

export const VENDOR_TEXT_MAX = 2000;

/** The dialog of a decision answer, or null: no draft, no outside contact to write to, or the viewer may not write to the vendor. */
export function sendDialogOf(draft: MessageDraft | undefined, decision: string, o: { canWrite: boolean; vendor: string | null }): SendDialog | null {
  if (!draft || !o.canWrite || !o.vendor) return null;
  const kind = draft.send?.source?.kind === 'claim' ? 'claim' : 'quote';
  return { subject: kind, decision, text: draft.text ?? '', notify: draft.notify_default !== false, source: { kind, id: draft.send?.source?.id ?? '' }, vendor: o.vendor };
}

/** The title key of the dialog (`sendTitle_<subject>_<decision>`); an unknown decision falls back to the approval's. */
export function sendTitleKey(d: Pick<SendDialog, 'subject' | 'decision'>): QuoteTextKey {
  const known: Record<string, readonly string[]> = { quote: ['approved', 'partially_approved', 'fix_requested', 'rejected'], claim: ['approved', 'rejected'] };
  const dec = known[d.subject].includes(d.decision) ? d.decision : 'approved';
  return `sendTitle_${d.subject}_${dec}` as QuoteTextKey;
}

/** What the explicit "שלח לספק" sends, or null when there is nothing to send (an empty or too long text). Nothing else ever sends. */
export function sendPlanOf(d: SendDialog | null): { text: string; notify: boolean; source: SendDialog['source'] } | null {
  if (!d) return null;
  const text = d.text.trim();
  if (!text || [...text].length > VENDOR_TEXT_MAX || !d.source.id) return null;
  return { text, notify: d.notify, source: d.source };
}

/** The claim decision's draft key: an exclusion of the exceptional lines is still an approval in the dialog's title. */
export function claimDecisionOf(action: 'approve' | 'adjust' | 'reject'): 'approved' | 'rejected' {
  return action === 'reject' ? 'rejected' : 'approved';
}
