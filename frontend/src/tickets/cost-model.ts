/**
 * CR-038 slice 9 (section 11A): the pure logic of the cost screens - money as INTEGER minor units, decimal strings for what is sent,
 * display formatting, the browser-side preview of a claim's totals (display only: the server recomputes every figure and its numbers are
 * the record, 11A.4), which actions a claim offers, and the per-currency grouping of the report (never summed across currencies, 11A.9).
 * No DOM, no Lit: tests/unit-tickets-costs.spec.ts runs it in node.
 */
import type {
  ClaimStatus, CostClaim, CostMode, CostStatus, LineInput, LineKind, ReportGroupRow, ReportTotal, StoredLine, TicketCostBlock, VatMode,
} from '../api/tickets-costs';
import { ct, type CostTextKey } from './cost-text';

// ---------------------------------------------------------------- minor units <-> decimal strings (string arithmetic, no float)

const AMOUNT_RE = /^(\d{1,9})(?:\.(\d{1,2}))?$/;
const HOURS_RE = /^(\d{1,3})(?:\.(\d{1,2}))?$/;
const QTY_RE = /^(\d{1,6})(?:\.(\d{1,3}))?$/;

/** Minor units -> a plain decimal string with two decimals ('1234.50', '-0.05'); the server's money.format_minor. */
export function minorToDecimal(minor: number): string {
  const neg = minor < 0;
  const digits = String(Math.abs(Math.trunc(minor))).padStart(3, '0');
  return `${neg ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** The same without a trailing '.00' (an input's prefill: '120', '120.5' stays '120.50'). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  const s = minorToDecimal(minor);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}

/** A decimal string with at most two decimals -> minor units, or null when it is not one (the server's AMOUNT_RE). */
export function decimalToMinor(value: string): number | null {
  const m = AMOUNT_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

/** Labor hours in quarter steps, 0.25..200 -> quarter hours, or null. */
export function hoursToQuarters(value: string): number | null {
  const m = HOURS_RE.exec(value.trim());
  if (!m) return null;
  const hundredths = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  if (hundredths % 25) return null;
  const q = hundredths / 25;
  return q >= 1 && q <= 800 ? q : null;
}

/** A parts quantity with at most three decimals, 0.001..100000 -> thousandths, or null. */
export function quantityToMilli(value: string): number | null {
  const m = QTY_RE.exec(value.trim());
  if (!m) return null;
  const milli = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0') || '0');
  return milli >= 1 && milli <= 100_000_000 ? milli : null;
}

/** round(n / d) with halves away from zero (n >= 0, d > 0) - BigInt, so no product ever loses a digit. */
export function halfUpDiv(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

/** Basis points -> the percent text ('18', '17.5', '0'). */
export function bpToPercent(bp: number): string {
  const s = minorToDecimal(bp); // 1800 -> '18.00' (bp have two "minor" digits of a percent)
  return s.replace(/\.?0+$/, '') || '0';
}

/** A percent text ('18', '17.5') -> basis points, or null (at most two decimals). */
export function percentToBp(value: string): number | null {
  return decimalToMinor(value);
}

// ---------------------------------------------------------------- display

const LOCALE: Record<string, string> = { he: 'he-IL', en: 'en-GB' };

/**
 * An amount for DISPLAY ONLY: Intl.NumberFormat with the claim's currency in the screen's language. The division to main units is
 * the last step before the text and never feeds anything stored or sent.
 */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined, lang: 'he' | 'en' = 'he'): string {
  if (minor === null || minor === undefined) return '';
  const cur = currency || 'ILS';
  try {
    return new Intl.NumberFormat(LOCALE[lang] ?? 'he-IL', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${minorToDecimal(minor)} ${cur}`;
  }
}

/** A byte size for a file row ('312 KB', '1.4 MB'). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A local date (YYYY-MM-DD) of today, for a date input's default and max. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export type Tone = '' | 'info' | 'warn' | 'ok' | 'bad';

export function costStatusTone(s: CostStatus | ClaimStatus): Tone {
  switch (s) {
    case 'awaiting':
      return 'warn';
    case 'submitted':
      return 'info';
    case 'rejected':
      return 'bad';
    case 'approved':
    case 'paid':
      return 'ok';
    default:
      return '';
  }
}

// ---------------------------------------------------------------- what a claim offers (the server decides; this only hides the impossible)

export interface ClaimActions {
  approve: boolean;
  adjust: boolean;
  reject: boolean;
  markPaid: boolean;
  unmarkPaid: boolean;
  reopen: boolean;
}

export function claimActions(claim: CostClaim, cost: TicketCostBlock | undefined): ClaimActions {
  const may = !!cost?.can_decide && claim.revision !== undefined;
  const submitted = claim.status === 'submitted' && !!claim.current_revision_id;
  return {
    approve: may && submitted,
    adjust: may && submitted && !claim.no_charge,
    reject: may && submitted,
    markPaid: may && claim.status === 'approved',
    unmarkPaid: may && claim.status === 'paid',
    reopen: may && (claim.status === 'awaiting' || claim.status === 'rejected') && !claim.window_open && !claim.reopen_used,
  };
}

/** "הזנת דרישה בשם הספק": a decider, an external assignment whose claim is not settled yet. */
export function onBehalfTargets(claims: readonly CostClaim[], assignments: readonly { id: string; ended_at: string | null }[], cost: TicketCostBlock | undefined): string[] {
  if (!cost?.can_decide) return [];
  const settled = new Set(claims.filter((c) => c.status === 'approved' || c.status === 'paid').map((c) => c.assignment_id));
  return assignments.filter((a) => !settled.has(a.id)).map((a) => a.id);
}

/** The requirement can change while no claim was submitted for the assignment (awaiting or none). */
export function requirementEditable(assignmentId: string, claims: readonly CostClaim[], cost: TicketCostBlock | undefined): boolean {
  if (!cost?.can_set_requirement) return false;
  const c = claims.find((x) => x.assignment_id === assignmentId);
  return !c || c.status === 'awaiting';
}

// ---------------------------------------------------------------- the line editor (adjustment and on-behalf entry)

/** One line as the form holds it: every number a string as typed. */
export interface EditLine { kind: LineKind; description: string; hours: string; rate: string; quantity: string; unit_price: string; amount: string }

export function blankLine(kind: LineKind = 'labor', rateMinor?: number | null): EditLine {
  return { kind, description: '', hours: '', rate: kind === 'labor' ? minorToInput(rateMinor ?? null) : '', quantity: kind === 'parts' ? '1' : '', unit_price: '', amount: '' };
}

/** A stored line back into the form (the adjustment's prefill). */
export function editLineOf(l: StoredLine): EditLine {
  const e = blankLine(l.kind);
  e.description = l.description ?? '';
  if (l.kind === 'labor') {
    e.hours = l.hours ?? '';
    e.rate = minorToInput(l.rate_minor ?? null);
  } else if (l.kind === 'parts') {
    e.quantity = l.quantity ?? '';
    e.unit_price = minorToInput(l.unit_minor ?? null);
  } else {
    e.amount = minorToInput(l.amount_minor ?? l.total_minor);
  }
  return e;
}

export type LineProblem = '' | 'description' | 'hours' | 'rate' | 'quantity' | 'unit_price' | 'amount';

/** The first problem of a line (the server's rules: parts / other need a description; quarter hours; at most two decimals). */
export function lineProblem(l: EditLine): LineProblem {
  if ([...l.description.trim()].length > 120) return 'description';
  if ((l.kind === 'parts' || l.kind === 'other') && !l.description.trim()) return 'description';
  if (l.kind === 'labor') {
    if (hoursToQuarters(l.hours) === null) return 'hours';
    if (decimalToMinor(l.rate) === null) return 'rate';
  } else if (l.kind === 'parts') {
    if (quantityToMilli(l.quantity) === null) return 'quantity';
    if (decimalToMinor(l.unit_price) === null) return 'unit_price';
  } else if (decimalToMinor(l.amount) === null) return 'amount';
  return '';
}

/** A line's total in minor units as the server rounds it (half-up per line), or null while a field is invalid. */
export function lineTotal(l: EditLine): number | null {
  if (l.kind === 'labor') {
    const q = hoursToQuarters(l.hours);
    const r = decimalToMinor(l.rate);
    return q === null || r === null ? null : Number(halfUpDiv(BigInt(q) * BigInt(r), 4n));
  }
  if (l.kind === 'parts') {
    const m = quantityToMilli(l.quantity);
    const u = decimalToMinor(l.unit_price);
    return m === null || u === null ? null : Number(halfUpDiv(BigInt(m) * BigInt(u), 1000n));
  }
  return decimalToMinor(l.amount);
}

/** The wire line (decimal strings, never numbers); the description is sent only when set. */
export function wireLine(l: EditLine): LineInput {
  const description = l.description.trim();
  if (l.kind === 'labor') return { kind: 'labor', ...(description ? { description } : {}), hours: l.hours.trim(), rate: l.rate.trim() };
  if (l.kind === 'parts') return { kind: 'parts', description, quantity: l.quantity.trim(), unit_price: l.unit_price.trim() };
  return { kind: l.kind, ...(description ? { description } : {}), amount: l.amount.trim() };
}

export interface Totals { by_kind: Record<LineKind, number>; subtotal: number; vat: number; total: number; net: number }

/** VAT of a subtotal (the server's money.vat_of): excluded adds it, included takes it out of the total, none is zero. */
export function vatOf(subtotal: number, mode: VatMode, rateBp: number): { vat: number; total: number; net: number } {
  if (mode === 'none' || rateBp === 0) return { vat: 0, total: subtotal, net: subtotal };
  const s = BigInt(subtotal);
  const r = BigInt(rateBp);
  if (mode === 'excluded') {
    const vat = Number(halfUpDiv(s * r, 10_000n));
    return { vat, total: subtotal + vat, net: subtotal };
  }
  const vat = Number(halfUpDiv(s * r, 10_000n + r));
  return { vat, total: subtotal, net: subtotal - vat };
}

/** The preview of a claim's figures (DISPLAY ONLY), or null while any line is invalid. */
export function previewTotals(lines: readonly EditLine[], mode: VatMode, rateBp: number): Totals | null {
  const by_kind: Record<LineKind, number> = { labor: 0, parts: 0, travel: 0, other: 0 };
  for (const l of lines) {
    const t = lineTotal(l);
    if (t === null) return null;
    by_kind[l.kind] += t;
  }
  const subtotal = by_kind.labor + by_kind.parts + by_kind.travel + by_kind.other;
  return { by_kind, subtotal, ...vatOf(subtotal, mode, rateBp) };
}

export function vatModeFor(vatExempt: boolean, include: boolean, noCharge: boolean): VatMode {
  if (vatExempt || noCharge) return 'none';
  return include ? 'included' : 'excluded';
}

// ---------------------------------------------------------------- the report: per currency, never across

export interface CurrencySection { currency: string; total: ReportTotal | null; rows: ReportGroupRow[] }

/** The report's groups split by currency (the server's order inside each), with that currency's totals row. A currency only in the
 * totals (no group rows) still gets its section. Sums are never added across currencies. */
export function sectionsByCurrency(groups: readonly ReportGroupRow[], totals: readonly ReportTotal[]): CurrencySection[] {
  const out = new Map<string, CurrencySection>();
  for (const t of totals) out.set(t.currency, { currency: t.currency, total: t, rows: [] });
  for (const g of groups) {
    const s = out.get(g.currency) ?? { currency: g.currency, total: null, rows: [] };
    s.rows.push(g);
    out.set(g.currency, s);
  }
  return [...out.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Totals computed from group rows per currency (when the server's totals are missing, e.g. a filtered client view). */
export function totalsByCurrency(rows: readonly Pick<ReportGroupRow, 'currency' | 'approved_minor' | 'pending_minor' | 'claims'>[]): Map<string, { approved_minor: number; pending_minor: number; claims: number }> {
  const out = new Map<string, { approved_minor: number; pending_minor: number; claims: number }>();
  for (const r of rows) {
    const t = out.get(r.currency) ?? { approved_minor: 0, pending_minor: 0, claims: 0 };
    t.approved_minor += r.approved_minor;
    t.pending_minor += r.pending_minor;
    t.claims += r.claims;
    out.set(r.currency, t);
  }
  return out;
}

// ---------------------------------------------------------------- the board table's cost columns (slice 6b wires them)

/** The table's "עלות" cell (11A.9; GET tickets/table › `cost`): the approved total, else the submitted total in grey (`muted`); ''
 * without an amount (no claim, or no tickets.costs.view on that row). */
export function costCell(cost: { total_minor: number | null; currency: string | null; approved: boolean } | null | undefined, lang: 'he' | 'en' = 'he'): { text: string; muted: boolean } {
  if (!cost || cost.total_minor === null || cost.total_minor === undefined) return { text: '', muted: false };
  return { text: formatMoney(cost.total_minor, cost.currency, lang), muted: !cost.approved };
}

/** The cost statuses a table filter offers (the report's and the board's; `not_required` is not a claim). */
export const COST_FILTER_STATUSES: readonly CostStatus[] = ['awaiting', 'submitted', 'rejected', 'approved', 'paid'];

// ---------------------------------------------------------------- timeline rows of the cost events (no amount: every member reads the timeline)

const DECISION_KEYS: Record<string, CostTextKey> = {
  approve: 'd_approve', adjust: 'd_adjust', reject: 'd_reject', mark_paid: 'd_mark_paid', unmark_paid: 'd_unmark_paid', reopen_window: 'd_reopen_window',
};

/** The line of a `cost_*` timeline event, or null for any other kind (the detail then uses the slice-1 eventLine). */
export function costEventText(kind: string, data: Record<string, unknown>): string | null {
  switch (kind) {
    case 'cost_submitted':
      return ct(data.on_behalf ? 'e_cost_on_behalf' : 'e_cost_submitted');
    case 'cost_decision': {
      const key = DECISION_KEYS[String(data.action ?? '')];
      return key ? ct('e_cost_decision', { action: ct(key) }) : ct('sCost');
    }
    case 'cost_message':
      return ct(data.queued === false ? 'e_cost_message_unsent' : 'e_cost_message');
    default:
      return null;
  }
}

/** The mode a per-assignment selector shows: the assignment's own, else the preselection. */
export function effectiveMode(own: CostMode | null | undefined, preselected: CostMode): CostMode {
  return own ?? preselected;
}
