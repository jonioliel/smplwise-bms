/**
 * TK258 "חשבון ספקים": the pure logic of the vendors account screen (tickets/vendor-accounts.ts) - the filter state as the server's
 * query, the per-vendor buckets (to pay = approved and not paid, paid, awaiting approval = submitted), the totals PER CURRENCY (an
 * amount is never added to an amount in another currency and nothing is converted), which rows the bulk "mark as paid" may take and
 * what the confirmation shows, the per-item answer of the bulk route, and the CSV cell guard. No DOM, no Lit:
 * tests/unit-tickets-vendor-accounts.spec.ts runs it in node.
 */
import type { AccountClaim, AccountQuery, BulkPaidAnswer, BulkPaidItem, BulkPaidResult, ReportStatus } from '../api/tickets-costs';

export type Bucket = 'due' | 'paid' | 'open';
export const BUCKETS: readonly Bucket[] = ['due', 'paid', 'open'];
const STATUS_OF: Record<Bucket, ReportStatus> = { due: 'approved', paid: 'paid', open: 'submitted' };

export function bucketOf(status: ReportStatus): Bucket {
  return status === 'approved' ? 'due' : status === 'paid' ? 'paid' : 'open';
}

/** The screen's filters (every field '' = not filtered). */
export interface AccountFilters { from: string; to: string; vendor: string; department: string; currency: string; bucket: '' | Bucket }
export const NO_FILTERS: AccountFilters = { from: '', to: '', vendor: '', department: '', currency: '', bucket: '' };

/** The filters as the claims / export query (only what is set). */
export function accountQuery(f: AccountFilters): AccountQuery {
  const q: AccountQuery = {};
  if (f.from) q.from = f.from;
  if (f.to) q.to = f.to;
  if (f.vendor) q.vendor = f.vendor;
  if (f.department) q.department = f.department;
  if (f.currency) q.currency = f.currency;
  if (f.bucket) q.status = [STATUS_OF[f.bucket]];
  return q;
}

/** A `from` after `to` is refused before asking (the server says 422 to_before_from too). */
export function periodValid(f: Pick<AccountFilters, 'from' | 'to'>): boolean {
  return !f.from || !f.to || f.from <= f.to;
}

export interface Sums { due: number; paid: number; open: number; claims: number }
export interface VendorLine extends Sums { key: string; label: string; currency: string }
export interface CurrencyBlock { currency: string; vendors: VendorLine[]; total: Sums }

const zero = (): Sums => ({ due: 0, paid: 0, open: 0, claims: 0 });

function add(s: Sums, r: AccountClaim): void {
  s[bucketOf(r.status)] += r.amount_minor;
  s.claims += 1;
}

/** The account per currency: one block per currency (sorted by code), inside it one line per vendor (most to pay first, then the
 * most awaiting, then by name) and the block's own total. A vendor with claims in two currencies has a line in each block. */
export function accountSummary(rows: readonly AccountClaim[]): CurrencyBlock[] {
  const blocks = new Map<string, { total: Sums; vendors: Map<string, VendorLine> }>();
  for (const r of rows) {
    const b = blocks.get(r.currency) ?? { total: zero(), vendors: new Map<string, VendorLine>() };
    blocks.set(r.currency, b);
    const v = b.vendors.get(r.vendor_key) ?? { key: r.vendor_key, label: r.vendor, currency: r.currency, ...zero() };
    b.vendors.set(r.vendor_key, v);
    add(v, r);
    add(b.total, r);
  }
  return [...blocks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, b]) => ({
    currency,
    total: b.total,
    vendors: [...b.vendors.values()].sort((x, y) => y.due - x.due || y.open - x.open || x.label.localeCompare(y.label) || x.key.localeCompare(y.key)),
  }));
}

/** A row the bulk action may take: approved (not paid), with a ticket, and the server said this caller may mark it. */
export function payable(r: AccountClaim): boolean {
  return r.status === 'approved' && r.can_mark_paid && !!r.ticket_id;
}

/** The selection kept to rows that are still payable (after a reload or a filter change). */
export function keepSelection(rows: readonly AccountClaim[], selected: ReadonlySet<string>): Set<string> {
  return new Set(rows.filter((r) => payable(r) && selected.has(r.claim_id)).map((r) => r.claim_id));
}

/** What the confirmation shows: per currency the count and the sum of the selected rows - never one total across currencies. */
export function selectionByCurrency(rows: readonly AccountClaim[], selected: ReadonlySet<string>): { currency: string; count: number; minor: number }[] {
  const out = new Map<string, { currency: string; count: number; minor: number }>();
  for (const r of rows) {
    if (!selected.has(r.claim_id) || !payable(r)) continue;
    const s = out.get(r.currency) ?? { currency: r.currency, count: 0, minor: 0 };
    s.count += 1;
    s.minor += r.amount_minor;
    out.set(r.currency, s);
  }
  return [...out.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** The bulk request's items: each selected payable row with its revision (a moved claim answers `stale`, never a blind write). */
export function bulkItems(rows: readonly AccountClaim[], selected: ReadonlySet<string>): BulkPaidItem[] {
  return rows.filter((r) => selected.has(r.claim_id) && payable(r)).map((r) => ({ ticket_id: r.ticket_id as string, claim_id: r.claim_id, revision: r.revision }));
}

/** The answer in two numbers and the items that were not marked (an `already_paid` counts as done: the request is idempotent). */
export function bulkOutcome(a: BulkPaidAnswer): { done: number; failed: { claim_id: string; number: number | null; result: BulkPaidResult }[] } {
  const failed = a.results.filter((r) => r.result !== 'paid' && r.result !== 'already_paid').map((r) => ({ claim_id: r.claim_id, number: r.number ?? null, result: r.result }));
  return { done: a.results.length - failed.length, failed };
}

/** A CSV cell that a spreadsheet will not run: text starting like a formula (= + - @, a tab or a carriage return, and their
 * full-width forms) gets a leading apostrophe; quotes are doubled and the cell quoted. The server's export does the same
 * (services/tickets/text_hygiene.csv_cell); the demo store uses this one. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return String(value);
  const t = /^[=+\-@\t\r＝＋－＠]/.test(value) ? `'${value}` : value;
  return `"${t.replace(/"/g, '""')}"`;
}
