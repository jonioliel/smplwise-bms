/**
 * TKRFQ5: the words of the request-for-quotation notifications in Settings › התראות and in the notification centre - the four source
 * labels (the same Hebrew as services/tickets/notify_sources.py; a unit spec compares them), the subject kind and its "open" action.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew).
 */
const he = {
  'rfq.quote_received': 'הצעת מחיר התקבלה או עודכנה',
  'rfq.declined': 'ספק השיב שאינו מעוניין',
  'rfq.question': 'שאלת הבהרה מספק',
  'rfq.due_passed': 'המועד להגשת הצעות עבר',
  kind: 'בקשת הצעת מחיר',
  open: 'פתח את הבקשה',
};
export type RfqNotifyKey = keyof typeof he;

const en: Partial<Record<RfqNotifyKey, string>> = {
  'rfq.quote_received': 'Quote received or updated',
  'rfq.declined': 'Vendor declined',
  'rfq.question': 'Clarification question from a vendor',
  'rfq.due_passed': 'Quote deadline passed',
  kind: 'Request for quotation',
  open: 'Open the request',
};

export function rfqNotifyLang(): 'he' | 'en' {
  return typeof document !== 'undefined' && (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'he';
}

export function rnt(key: RfqNotifyKey, lang: 'he' | 'en' = rfqNotifyLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

export const RFQ_NOTIFY_HE: Readonly<Record<RfqNotifyKey, string>> = he;
export const RFQ_NOTIFY_EN: Readonly<Partial<Record<RfqNotifyKey, string>>> = en;
