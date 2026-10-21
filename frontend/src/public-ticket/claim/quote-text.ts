/**
 * TK257: the strings of the vendor page's permanent "quote / payment demand" card (quote-card.ts), in the contact's language
 * (he and ar right to left, en and ru left to right). A small catalogue inside the public bundle, beside claim-text.ts (the line
 * kinds, field labels, VAT words and error texts of the claim form are reused from there).
 *
 * OWNER RULE (2026-10-14): the module is "ניהול השירות" and the item "בקשת שירות" - the old word for a service call never appears.
 * Where a string names the item it uses the D33 tokens and is rendered with the API's `labels`.
 *
 * ARABIC AND RUSSIAN: written by the developer, NOT yet checked by a native speaker (owner decision 2026-10-15: the page shows
 * the "preliminary translation" line until a speaker reviews the payment and quote wording). Initial, needs native review.
 */
import { FALLBACK_LANG, isLazyLang, langPack, type LazyLang } from '../lang-packs';
import { type ClaimLang, type ItemLabels, FALLBACK_LABELS, renderItem } from './claim-text';

const he = {
  cost_title: 'הצעת מחיר / דרישת תשלום',
  step_quote: 'הצעה',
  step_approval: 'אישור',
  step_work: 'עבודה',
  step_demand: 'דרישה',
  step_demand_ok: 'אישור',
  step_paid: 'תשלום',
  q_title: 'הצעת מחיר',
  q_when: 'לפני העבודה',
  d_title: 'דרישת תשלום',
  d_when: 'אחרי העבודה',
  pill_open: 'אפשר לשלוח',
  pill_sent: 'נשלחה',
  pill_ok: 'אושרה',
  pill_fix: 'נדרש תיקון',
  pill_none: 'לא נשלחה',
  pill_later: 'אחרי "בוצע"',
  intro_now: 'עכשיו אפשר לשלוח הצעת מחיר. דרישת תשלום תישלח אחרי שתסמנו "בוצע".',
  intro_sent: 'ההצעה נשלחה וממתינה לאישור. דרישת תשלום תישלח אחרי שתסמנו "בוצע".',
  intro_ok: 'ההצעה אושרה. דרישת תשלום תישלח אחרי שתסמנו "בוצע", מול ההצעה המאושרת.',
  intro_fix: 'התבקש תיקון בהצעה. דרישת תשלום תישלח אחרי שתסמנו "בוצע".',
  q_sent_text: 'נשלחה וממתינה לאישור. אפשר לעדכן אותה עד שתאושר.',
  q_on_behalf: 'הוזן על ידי המנהל',
  q_valid_until: 'תוקף ההצעה עד {date}',
  q_work_from: 'תחילת העבודה',
  q_work_to: 'סיום העבודה',
  q_ok_text: 'ההצעה אושרה.',
  q_fix_text: 'התבקש תיקון:',
  q_none_after: 'לא נשלחה הצעת מחיר לפני העבודה.',
  q_send: 'שליחת ההצעה',
  q_resend: 'שליחת הצעה מעודכנת',
  q_edit: 'עדכון ההצעה',
  q_cancel_edit: 'ביטול העדכון',
  q_sending: 'שולח…',
  q_ref: 'ההצעה המאושרת: {amount}',
  q_loading: 'טוען…',
  q_error: 'לא ניתן לטעון את ההצעה כרגע.',
  e_kind_not_allowed: 'סוג הסעיף הזה לא אושר לבקשה',
  e_quote_closed: 'אי אפשר לשלוח הצעה כרגע',
  tr_note: '',
};

export type QuoteTextKey = keyof typeof he;

const en: Record<QuoteTextKey, string> = {
  cost_title: 'Quote / payment request',
  step_quote: 'Quote',
  step_approval: 'Approval',
  step_work: 'Work',
  step_demand: 'Request',
  step_demand_ok: 'Approval',
  step_paid: 'Payment',
  q_title: 'Quote',
  q_when: 'before the work',
  d_title: 'Payment request',
  d_when: 'after the work',
  pill_open: 'You can send',
  pill_sent: 'Sent',
  pill_ok: 'Approved',
  pill_fix: 'Fix requested',
  pill_none: 'Not sent',
  pill_later: 'After "Done"',
  intro_now: 'You can send a quote now. The payment request is sent after you mark the work "Done".',
  intro_sent: 'The quote was sent and is waiting for approval. The payment request is sent after you mark the work "Done".',
  intro_ok: 'The quote is approved. The payment request is sent after you mark the work "Done", against the approved quote.',
  intro_fix: 'A correction was requested on the quote. The payment request is sent after you mark the work "Done".',
  q_sent_text: 'Sent and waiting for approval. You can edit it until it is approved.',
  q_on_behalf: 'Entered by the manager',
  q_valid_until: 'Quote valid until {date}',
  q_work_from: 'Work starts',
  q_work_to: 'Work ends',
  q_ok_text: 'The quote is approved.',
  q_fix_text: 'A correction was requested:',
  q_none_after: 'No quote was sent before the work.',
  q_send: 'Send the quote',
  q_resend: 'Send the updated quote',
  q_edit: 'Edit the quote',
  q_cancel_edit: 'Cancel the edit',
  q_sending: 'Sending…',
  q_ref: 'Approved quote: {amount}',
  q_loading: 'Loading…',
  q_error: 'The quote cannot be loaded right now.',
  e_kind_not_allowed: 'This kind of line is not approved for this request',
  e_quote_closed: 'A quote cannot be sent right now',
  tr_note: '',
};

/** LAZYLANG-295: Arabic / Russian arrive with their language chunk (lang-packs.ts); until then a key reads the same-direction fallback. */
export const QUOTE_TEXT: Readonly<Record<'he' | 'en', Record<QuoteTextKey, string>> & Partial<Record<LazyLang, Record<QuoteTextKey, string>>>> = {
  he,
  en,
  get ar() {
    return langPack('ar')?.quote as Record<QuoteTextKey, string> | undefined;
  },
  get ru() {
    return langPack('ru')?.quote as Record<QuoteTextKey, string> | undefined;
  },
};
export const QUOTE_TEXT_KEYS = Object.keys(he) as QuoteTextKey[];

/** One string of the card: the language's text (Hebrew when missing), the item tokens, then the {name} placeholders. */
export function qt(lang: ClaimLang, key: QuoteTextKey, vars?: Record<string, string | number>, labels?: ItemLabels): string {
  const raw = (QUOTE_TEXT[lang] ?? (isLazyLang(lang) ? QUOTE_TEXT[FALLBACK_LANG[lang]] : undefined))?.[key] ?? he[key] ?? key;
  const withItem = renderItem(raw, labels ?? FALLBACK_LABELS[lang]);
  if (!vars) return withItem;
  return withItem.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
