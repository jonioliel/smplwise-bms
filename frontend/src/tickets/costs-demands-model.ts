/**
 * HARDEN271 + COSTINST (2.9.1): the pure rules of the "instalment payments" list in a work order's Costs tab - the rows in instalment
 * order, the status / kind / timing words, the due day and the "mark paid" plan. Kept free of Lit so the node-only unit spec reads it.
 * The server sends the list only to a caller who may see the costs tab's amounts (tickets.costs.view) and flags `can_pay` only for a
 * caller who may act (the dashboard payments card's rule); an empty or missing list is no section at all. The client never widens that:
 * without `can_pay === true` there is no action.
 */
import type { InstalmentDemandRow } from '../api/tickets-costs';

export type DemandsLang = 'he' | 'en';

const TEXT = {
  he: { title: 'תשלומים לפי שלבים', none: 'טרם נדרש', open: 'ממתין לתשלום', paid: 'שולם', cancelled: 'בוטל', advance: 'מקדמה', progress: 'תשלום ביניים',
        final: 'תשלום סופי', due: 'מועד', onCompletion: 'בסיום העבודה', n: 'תשלום {n}',
        late: 'באיחור', soon: 'בקרוב', later: 'טרם הגיע המועד', markPaid: 'סמן כשולם', confirm: 'לאשר שהתשלום בוצע?', yes: 'כן, שולם', no: 'ביטול',
        failed: 'סימון התשלום נכשל. נסו שוב.', done: 'התשלום סומן כשולם' },
  en: { title: 'Instalment payments', none: 'Not demanded yet', open: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled', advance: 'Advance',
        progress: 'Progress payment', final: 'Final payment', due: 'Due', onCompletion: 'On completion', n: 'Instalment {n}',
        late: 'Late', soon: 'Due soon', later: 'Not due yet', markPaid: 'Mark paid', confirm: 'Confirm the payment was made?', yes: 'Yes, paid', no: 'Cancel',
        failed: 'Marking the payment failed. Try again.', done: 'Payment marked as paid' },
} as const;

export function demandsText(lang: DemandsLang, key: keyof (typeof TEXT)['he']): string {
  return (TEXT[lang] ?? TEXT.he)[key];
}

export type Timing = 'paid' | 'late' | 'soon' | 'later';
export type PayStep = 'create' | 'paid';
export interface DemandLine {
  id: string; label: string; kind: string; status: InstalmentDemandRow['status']; statusText: string; due: string; amount_minor: number | null; currency: string | null;
  timing: Timing; timingText: string; awardId: string; rfqId: string; index: number; canPay: boolean;
}

/** `YYYY-MM-DD` -> `DD.MM.YYYY` (no time zone: it is a calendar day); null -> "on completion". */
export function dueText(day: string | null, lang: DemandsLang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : demandsText(lang, 'onCompletion');
}

/** The server's timing when it sent one; else (an older server) derived from the status alone - never a guess about dates. */
function timingOf(d: InstalmentDemandRow): Timing {
  if (d.status === 'paid') return 'paid';
  return d.timing === 'late' || d.timing === 'soon' || d.timing === 'later' || d.timing === 'paid' ? d.timing : 'later';
}

/** The rows to show, in instalment order; anything malformed is left out (never a guess). `canPay` needs the server's flag AND the ids. */
export function demandLines(items: readonly InstalmentDemandRow[] | null | undefined, lang: DemandsLang): DemandLine[] {
  return [...(items ?? [])]
    .filter((d) => d && typeof d.id === 'string' && Number.isInteger(d.index) && (d.status === 'none' || d.status === 'open' || d.status === 'paid' || d.status === 'cancelled'))
    .sort((a, b) => a.index - b.index)
    .map((d) => {
      const timing = timingOf(d);
      return {
        id: d.id, label: demandsText(lang, 'n').replace('{n}', String(d.index + 1)),
        kind: d.kind === 'advance' || d.kind === 'progress' || d.kind === 'final' ? demandsText(lang, d.kind) : '',
        status: d.status, statusText: demandsText(lang, d.status), due: dueText(d.due_date, lang), amount_minor: typeof d.amount_minor === 'number' ? d.amount_minor : null, currency: d.currency ?? null,
        timing, timingText: demandsText(lang, timing === 'paid' ? 'paid' : timing), index: d.index, awardId: d.award_id ?? '', rfqId: d.rfq_id ?? '',
        canPay: d.can_pay === true && typeof d.amount_minor === 'number' && d.status !== 'paid' && !!d.award_id && !!d.rfq_id,
      };
    });
}

/** The server calls "mark paid" takes for a row: an open demand is marked directly; with none (or a cancelled one) the demand is made first. */
export function payPlan(l: Pick<DemandLine, 'status' | 'canPay'>): PayStep[] {
  if (!l.canPay || l.status === 'paid') return [];
  return l.status === 'open' ? ['paid'] : ['create', 'paid'];
}
