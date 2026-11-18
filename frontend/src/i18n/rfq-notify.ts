/**
 * TKRFQ5: the words of the request-for-quotation notifications in Settings › התראות and in the notification centre - the four source
 * labels (the same Hebrew as services/tickets/notify_sources.py; a unit spec compares them), the subject kind and its "open" action.
 * Hebrew first; the English column follows the document language (a missing key falls back to the Hebrew).
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  'rfq.quote_received': 'הצעת מחיר התקבלה או עודכנה',
  'rfq.declined': 'ספק השיב שאינו מעוניין',
  'rfq.question': 'שאלת הבהרה מספק',
  'rfq.due_passed': 'המועד להגשת הצעות עבר',
  'rfq.arrival': 'ספק אישר מועד הגעה או הציע מועד אחר',
  'rfq.question_unanswered': 'שאלת ספק ממתינה לתשובה',
  'rfq.instalment_overdue': 'מועד תשלום לספק עבר',
  'rfq.vendor_postponement': 'ספק הודיע על דחיית העבודה', // CR-AWARD-NOTICE
  kind: 'בקשת הצעת מחיר',
  open: 'פתח את הבקשה',
};
type RfqNotifyKey = keyof typeof he;

const en: Partial<Record<RfqNotifyKey, string>> = packTable<typeof import('./lang/en/i18n/rfq-notify').en>('en', 'i18n/rfq-notify', 'en');

function rfqNotifyLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function rnt(key: RfqNotifyKey, lang: 'he' | 'en' = rfqNotifyLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

export const RFQ_NOTIFY_HE: Readonly<Record<RfqNotifyKey, string>> = he;
export const RFQ_NOTIFY_EN: Readonly<Partial<Record<RfqNotifyKey, string>>> = en;

registerCatalogue('i18n/rfq-notify', { he, en });
