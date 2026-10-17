/**
 * CR-RFQ-PAYMENT-SCHEDULE (RFQ contract section 20): the managers' side of the payment schedule and the arrival confirmation - pure
 * functions (tests/unit-tickets-rfq-terms.spec.ts runs them in node). The award dialog edits the vendor's proposal (percent or a fixed
 * amount per instalment, a date each; the final instalment is the remainder: on completion, on a date, or N days after completion); the
 * server converts percents to exact amounts of the APPROVED total (floor each, the final takes the remainder - the sum is exact) and
 * stores the approved schedule with the award. Nothing here computes an amount the server would trust: the wire carries decimal strings.
 */
import type { RfqAwardTerms, RfqInstalment, RfqPaymentProposal } from '../api/tickets-rfq';

export type MgrDue = 'completion' | 'date' | 'after_completion';
export interface MgrPayItem { kind: 'advance' | 'progress'; mode: 'percent' | 'amount'; value: string; date: string }
export interface MgrPay { items: MgrPayItem[]; due: MgrDue; date: string; days: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PCT_RE = /^(\d{1,3})(?:\.(\d{1,2}))?$/;
const AMT_RE = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

const minorText = (m: number): string => {
  const s = `${Math.floor(m / 100)}.${String(m % 100).padStart(2, '0')}`;
  return s.endsWith('.00') ? s.slice(0, -3) : s;
};

/** The editor's start: the vendor's proposal as he sent it, else one final instalment on completion. */
export function payFromProposal(p: RfqPaymentProposal | null | undefined): MgrPay {
  const out: MgrPay = { items: [], due: 'completion', date: '', days: '30' };
  for (const it of p?.items ?? []) {
    if (it.kind === 'final') {
      out.due = (['completion', 'date', 'after_completion'].includes(it.due) ? it.due : 'completion') as MgrDue;
      out.date = it.date ?? '';
      out.days = it.days === null || it.days === undefined ? '30' : String(it.days);
    } else {
      out.items.push({ kind: it.kind, mode: it.percent ? 'percent' : 'amount', value: it.percent ?? minorText(it.amount_minor ?? 0), date: it.date ?? '' });
    }
  }
  return out;
}

/** The checks the dialog can make (the server repeats every one): shares, dates (not past, in order), percents <= 100, the final rule. */
export function payProblems(p: MgrPay, today: string): string[] {
  const out: string[] = [];
  let last = '';
  let bp = 0;
  p.items.forEach((it, i) => {
    const m = (it.mode === 'percent' ? PCT_RE : AMT_RE).exec(it.value.trim());
    const n = m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : 0;
    if (!m || n <= 0 || (it.mode === 'percent' && n > 10000)) out.push(`items.${i}.value`);
    if (it.mode === 'percent' && m) bp += n;
    if (!DAY_RE.test(it.date) || it.date < today || (last && it.date < last)) out.push(`items.${i}.date`);
    else last = it.date;
  });
  if (bp > 10000) out.push('items.sum');
  if (p.due === 'date' && (!DAY_RE.test(p.date) || p.date < (last || today))) out.push('final.date');
  if (p.due === 'after_completion' && (!/^\d{1,3}$/.test(p.days.trim()) || Number(p.days) > 180)) out.push('final.days');
  return out;
}

/** The award body's `payment` (contract 20.3): decimal strings and plain dates only. */
export function payWire(p: MgrPay): { items: Record<string, unknown>[] } {
  const items: Record<string, unknown>[] = p.items.map((it) => ({ kind: it.kind, [it.mode]: it.value.trim(), due: 'date', date: it.date }));
  const final: Record<string, unknown> = { kind: 'final', due: p.due };
  if (p.due === 'date') final.date = p.date;
  if (p.due === 'after_completion') final.days = Number(p.days);
  items.push(final);
  return { items };
}

/** The words of one instalment's due rule (`date` as dd.mm.yyyy, "on completion", "N days after completion"). */
export function dueWords(it: Pick<RfqInstalment, 'due' | 'date' | 'days'>, t: { done: string; after: string }): string {
  if (it.due === 'date') return it.date ? it.date.split('-').reverse().join('.') : '';
  if (it.due === 'after_completion') return t.after.replace('{n}', String(it.days ?? 0));
  return t.done;
}

/** One line per proposed instalment for the comparison row: "<kind> <30% | amount> · <due>". */
export function proposalLines(p: RfqPaymentProposal | null | undefined, money: (minor: number) => string, t: { done: string; after: string; kinds: Record<string, string> }): string[] {
  return (p?.items ?? []).map((it) => {
    const share = it.kind === 'final' ? '' : it.percent ? ` ${it.percent}%` : it.amount_minor !== null ? ` ${money(it.amount_minor)}` : '';
    return `${t.kinds[it.kind] ?? it.kind}${share} · ${dueWords({ due: it.due as RfqInstalment['due'], date: it.date, days: it.days }, t)}`;
  });
}

/** The arrival's state chip key (`trm_*` of rfq-text.ts): confirmed / proposed (waiting for a decision) / rejected / waiting. */
export function arrivalKey(t: RfqAwardTerms): 'trm_confirmed' | 'trm_proposed' | 'trm_rejected' | 'trm_waiting' | 'trm_not_asked' {
  const a = t.arrival;
  if (a.state === 'confirmed') return 'trm_confirmed';
  if (a.state === 'proposed') return 'trm_proposed';
  if (a.rejected_at) return 'trm_rejected';
  return a.requested_at ? 'trm_waiting' : 'trm_not_asked';
}

/** RFQPAY2: an instant as the browser-local plain day (`YYYY-MM-DD`) for a date field; '' for none or an unreadable value. */
export function isoLocalDay(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whether a schedule's amounts add up to its total (the server guarantees it; the card shows a warning if a stale copy did not). */
export function scheduleExact(t: RfqAwardTerms): boolean {
  const s = t.schedule;
  if (s.total_minor === null || s.items.some((i) => i.amount_minor === null)) return true;
  return s.items.reduce((n, i) => n + (i.amount_minor ?? 0), 0) === s.total_minor;
}
