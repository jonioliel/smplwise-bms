/**
 * CR-SHELL-LAZY-2436 (review 08:F02): the two words of "בקשות הצעת מחיר" the shell shows without opening the module - the tab's name
 * and the aria label of the vendor-questions badge. They were read from tickets/rfq-text.ts (the whole RFQ dictionary, 1,300+ lines),
 * which put that dictionary into the entry chunk for two strings. They are written here only; rfq-text.ts reads them from this module,
 * so `rt('navTitle')` and `nt('navTitle')` are the same text in both languages.
 *
 * A leaf on purpose: only tickets/naming.ts (the module's configurable names) and i18n/nav-labels.ts (the document language), both of
 * which import no dictionary.
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from '../i18n/nav-labels';

export type NavRfqKey = 'navTitle' | 'navQuestionsAria';

export const NAV_RFQ_HE: Readonly<Record<NavRfqKey, string>> = {
  navTitle: 'בקשות הצעת מחיר',
  navQuestionsAria: '{n} שאלות של ספקים ממתינות',
};

export const NAV_RFQ_EN: Readonly<Record<NavRfqKey, string>> = {
  navTitle: 'Requests for quotation',
  navQuestionsAria: '{n} vendor questions waiting',
};

/** One of the two shell words, rendered exactly as rfq-text's `rt()` renders it: the document's language, the module's names, `{var}`s. */
export function nt(key: NavRfqKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(lang === 'en' ? NAV_RFQ_EN[key] : NAV_RFQ_HE[key], lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}
