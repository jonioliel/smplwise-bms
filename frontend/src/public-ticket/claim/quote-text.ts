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

// Arabic - initial, needs native review
const ar: Record<QuoteTextKey, string> = {
  cost_title: 'عرض السعر / طلب الدفع',
  step_quote: 'عرض',
  step_approval: 'موافقة',
  step_work: 'عمل',
  step_demand: 'طلب',
  step_demand_ok: 'موافقة',
  step_paid: 'دفع',
  q_title: 'عرض سعر',
  q_when: 'قبل العمل',
  d_title: 'طلب دفع',
  d_when: 'بعد العمل',
  pill_open: 'يمكنك الإرسال',
  pill_sent: 'أُرسل',
  pill_ok: 'معتمد',
  pill_fix: 'مطلوب تصحيح',
  pill_none: 'لم يُرسل',
  pill_later: 'بعد "تم"',
  intro_now: 'يمكنك الآن إرسال عرض سعر. يُرسل طلب الدفع بعد أن تحدد العمل "تم".',
  intro_sent: 'أُرسل عرض السعر وهو بانتظار الموافقة. يُرسل طلب الدفع بعد أن تحدد العمل "تم".',
  intro_ok: 'تمت الموافقة على عرض السعر. يُرسل طلب الدفع بعد أن تحدد العمل "تم"، مقابل العرض المعتمد.',
  intro_fix: 'طُلب تصحيح في عرض السعر. يُرسل طلب الدفع بعد أن تحدد العمل "تم".',
  q_sent_text: 'أُرسل وهو بانتظار الموافقة. يمكنك تعديله حتى تتم الموافقة.',
  q_on_behalf: 'أدخله المدير',
  q_valid_until: 'عرض السعر ساري حتى {date}',
  q_ok_text: 'تمت الموافقة على عرض السعر.',
  q_fix_text: 'طُلب تصحيح:',
  q_none_after: 'لم يُرسل عرض سعر قبل العمل.',
  q_send: 'إرسال عرض السعر',
  q_resend: 'إرسال عرض السعر المحدّث',
  q_edit: 'تعديل عرض السعر',
  q_cancel_edit: 'إلغاء التعديل',
  q_sending: 'جارٍ الإرسال…',
  q_ref: 'العرض المعتمد: {amount}',
  q_loading: 'جارٍ التحميل…',
  q_error: 'تعذّر تحميل عرض السعر الآن.',
  e_kind_not_allowed: 'نوع البند هذا غير معتمد لهذا الطلب',
  e_quote_closed: 'لا يمكن إرسال عرض سعر الآن',
  tr_note: 'ترجمة أولية قيد المراجعة',
};

// Russian - initial, needs native review
const ru: Record<QuoteTextKey, string> = {
  cost_title: 'Предложение / запрос на оплату',
  step_quote: 'Предл.',
  step_approval: 'Одобр.',
  step_work: 'Работа',
  step_demand: 'Запрос',
  step_demand_ok: 'Одобр.',
  step_paid: 'Оплата',
  q_title: 'Ценовое предложение',
  q_when: 'до работы',
  d_title: 'Запрос на оплату',
  d_when: 'после работы',
  pill_open: 'Можно отправить',
  pill_sent: 'Отправлено',
  pill_ok: 'Одобрено',
  pill_fix: 'Нужна правка',
  pill_none: 'Не отправлено',
  pill_later: 'После «Готово»',
  intro_now: 'Сейчас можно отправить ценовое предложение. Запрос на оплату отправляется после того, как вы отметите работу «Готово».',
  intro_sent: 'Предложение отправлено и ждёт одобрения. Запрос на оплату отправляется после отметки «Готово».',
  intro_ok: 'Предложение одобрено. Запрос на оплату отправляется после отметки «Готово», по одобренному предложению.',
  intro_fix: 'По предложению запрошена правка. Запрос на оплату отправляется после отметки «Готово».',
  q_sent_text: 'Отправлено, ждёт одобрения. Можно изменить до одобрения.',
  q_on_behalf: 'Внесено менеджером',
  q_valid_until: 'Предложение действует до {date}',
  q_ok_text: 'Предложение одобрено.',
  q_fix_text: 'Запрошена правка:',
  q_none_after: 'Ценовое предложение до работы не отправлялось.',
  q_send: 'Отправить предложение',
  q_resend: 'Отправить обновлённое предложение',
  q_edit: 'Изменить предложение',
  q_cancel_edit: 'Отменить изменение',
  q_sending: 'Отправка…',
  q_ref: 'Одобренное предложение: {amount}',
  q_loading: 'Загрузка…',
  q_error: 'Сейчас не удаётся загрузить предложение.',
  e_kind_not_allowed: 'Этот тип строки не одобрен для этой заявки',
  e_quote_closed: 'Сейчас нельзя отправить предложение',
  tr_note: 'Предварительный перевод, на проверке',
};

export const QUOTE_TEXT: Readonly<Record<ClaimLang, Record<QuoteTextKey, string>>> = { he, en, ar, ru };
export const QUOTE_TEXT_KEYS = Object.keys(he) as QuoteTextKey[];

/** One string of the card: the language's text (Hebrew when missing), the item tokens, then the {name} placeholders. */
export function qt(lang: ClaimLang, key: QuoteTextKey, vars?: Record<string, string | number>, labels?: ItemLabels): string {
  const raw = QUOTE_TEXT[lang]?.[key] ?? he[key] ?? key;
  const withItem = renderItem(raw, labels ?? FALLBACK_LABELS[lang]);
  if (!vars) return withItem;
  return withItem.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
