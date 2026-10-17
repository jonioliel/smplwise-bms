/**
 * HARDEN271 (owner 2026-10-17, RFQPAY2 follow-up): the pure rules of the read-only "instalment demands" list in a work order's Costs tab -
 * the rows in the server's order, the status / kind words and the due day. Kept free of Lit so the node-only unit spec reads it.
 * The server sends the list only to a caller who may see the costs tab's amounts (tickets.costs.view); an empty or missing list is no
 * section at all.
 */
import type { InstalmentDemandRow } from '../api/tickets-costs';

export type DemandsLang = 'he' | 'en';

const TEXT = {
  he: { title: 'דרישות תשלום לפי שלבים', open: 'ממתין לתשלום', paid: 'שולם', cancelled: 'בוטל', advance: 'מקדמה', progress: 'תשלום ביניים',
        final: 'תשלום סופי', due: 'מועד', onCompletion: 'בסיום העבודה', n: 'תשלום {n}' },
  en: { title: 'Instalment payment demands', open: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled', advance: 'Advance',
        progress: 'Progress payment', final: 'Final payment', due: 'Due', onCompletion: 'On completion', n: 'Instalment {n}' },
} as const;

export function demandsText(lang: DemandsLang, key: keyof (typeof TEXT)['he']): string {
  return (TEXT[lang] ?? TEXT.he)[key];
}

export interface DemandLine { id: string; label: string; kind: string; status: InstalmentDemandRow['status']; statusText: string; due: string; amount_minor: number; currency: string }

/** `YYYY-MM-DD` -> `DD.MM.YYYY` (no time zone: it is a calendar day); null -> "on completion". */
export function dueText(day: string | null, lang: DemandsLang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : demandsText(lang, 'onCompletion');
}

/** The rows to show, in instalment order; anything malformed is left out (never a guess). */
export function demandLines(items: readonly InstalmentDemandRow[] | null | undefined, lang: DemandsLang): DemandLine[] {
  return [...(items ?? [])]
    .filter((d) => d && typeof d.id === 'string' && Number.isInteger(d.index) && (d.status === 'open' || d.status === 'paid' || d.status === 'cancelled'))
    .sort((a, b) => a.index - b.index)
    .map((d) => ({
      id: d.id, label: demandsText(lang, 'n').replace('{n}', String(d.index + 1)),
      kind: d.kind === 'advance' || d.kind === 'progress' || d.kind === 'final' ? demandsText(lang, d.kind) : '',
      status: d.status, statusText: demandsText(lang, d.status), due: dueText(d.due_date, lang), amount_minor: d.amount_minor, currency: d.currency,
    }));
}
