/**
 * CR-038 slice 9: the strings of the vendor page's cost-claim step in the contact's language (D26: he and ar RTL, en and ru LTR;
 * chosen by the API's `lang`). A small catalogue inside the public bundle - no i18n library.
 *
 * OWNER RULE (2026-10-14): in Hebrew the item is "בקשת שירות" / "בקשות שירות" (feminine) and the module "ניהול השירות"; the old
 * word for a service call and its inflections never appear (tests/unit-public-claim-model.spec.ts lints this catalogue and the
 * sources). Where a string names the item it carries the D33 tokens {ticket} / {tickets} / {f:..|m:..} and is rendered with the
 * API's `labels` (one / many / gender) - the fallback names below are used only when the API sent none.
 * Placeholders: {name} - plain values (numbers, dates, amounts) filled by `ct(..., vars)`.
 */

import { FALLBACK_LANG, isLazyLang, langPack, type LazyLang } from '../lang-packs';

export type ClaimLang = 'he' | 'en' | 'ar' | 'ru';
export const CLAIM_LANGS: readonly ClaimLang[] = ['he', 'en', 'ar', 'ru'];
export const RTL_LANGS: readonly ClaimLang[] = ['he', 'ar'];

export interface ItemLabels {
  one: string;
  many: string;
  gender: string;
}

export const FALLBACK_LABELS: Readonly<Record<ClaimLang, ItemLabels>> = {
  he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
  en: { one: 'Service request', many: 'Service requests', gender: '' },
  ar: { one: 'طلب خدمة', many: 'طلبات خدمة', gender: 'm' },
  ru: { one: 'Заявка', many: 'Заявки', gender: 'f' },
};

const he = {
  heading: 'דרישת תשלום',
  heading_item: 'דרישת תשלום - {ticket} {number}',
  card_hint: 'אפשר להגיש פירוט עלות לעבודה שבוצעה',
  required_hint: 'נדרש פירוט עלות לעבודה שבוצעה',
  open_form: 'הגשת דרישת תשלום',
  later: 'אשלים אחר כך',
  loading: 'טוען…',
  claim_until: 'אפשר להגיש עד {date}',
  lines_title: 'פירוט',
  line_add: 'הוספת שורה',
  line_remove: 'הסרת שורה',
  line_kind: 'סוג',
  kind_labor: 'עבודה',
  kind_parts: 'חלקים',
  kind_travel: 'נסיעה',
  kind_other: 'אחר',
  f_hours: 'שעות',
  f_rate: 'מחיר לשעה',
  f_description: 'תיאור',
  f_quantity: 'כמות',
  f_unit_price: 'מחיר ליחידה',
  f_amount: 'סכום',
  vat_included: 'הסכומים כוללים מע"מ',
  vat_excluded: 'לפני מע"מ',
  vat_none: 'ללא מע"מ (עוסק פטור)',
  no_charge: 'ללא חיוב',
  no_charge_hint: 'למשל עבודה באחריות',
  currency: 'מטבע',
  net: 'סכום לפני מע"מ',
  vat: 'מע"מ {rate}%',
  total: 'סה"כ',
  estimate_note: 'החישוב להצגה בלבד - הסכום הקובע יחושב במערכת',
  vendor_ref: 'מספר חשבונית / אסמכתה',
  notes: 'הערות',
  optional: '(רשות)',
  docs_title: 'חשבונית / קבלה',
  docs_hint: 'עד {docs} מסמכים. מסמך הוא קובץ PDF אחד או עד {pages} עמודים מצולמים.',
  capture: 'צילום חשבונית',
  gallery: 'בחירה מהגלריה / מקובץ',
  pdf: 'קובץ PDF',
  camera_fallback: 'לא ניתן לפתוח את המצלמה - אפשר לבחור תמונה מהגלריה או מקובץ',
  inapp_hint: 'אם המצלמה לא נפתחת, פתחו את הקישור בדפדפן (פתיחה בדפדפן)',
  iphone_hint: 'באייפון: אם התמונה לא מתקבלת, בחרו "הכי תואם" בהגדרות המצלמה',
  editor_title: 'עמוד {n}',
  retake: 'צילום מחדש',
  rotate: 'סיבוב',
  crop: 'חיתוך',
  crop_apply: 'אישור חיתוך',
  crop_cancel: 'ביטול',
  crop_hint: 'גררו מלבן על החלק שרוצים לשמור',
  contrast: 'שיפור ניגודיות',
  use_page: 'שמירת העמוד',
  add_page: 'הוספת עמוד',
  finish_doc: 'סיום מסמך',
  discard: 'ביטול',
  processing: 'מעבד…',
  doc_n: 'מסמך {n}',
  doc_pdf: 'מסמך {n} (PDF)',
  page_n: 'עמוד {n}',
  move_up: 'הזזה למעלה',
  move_down: 'הזזה למטה',
  delete_page: 'מחיקת עמוד',
  delete_doc: 'מחיקת מסמך',
  up_local: 'ממתין לשליחה',
  up_uploading: 'נשלח…',
  up_uploaded: 'נשלח',
  up_failed: 'לא נשלח עדיין',
  up_refused: 'לא התקבל',
  retry: 'ניסיון חוזר',
  submit: 'שליחה',
  submitting: 'שולח…',
  waiting_uploads: 'ממתין לשליחת הקבצים…',
  saved_offline: 'נשמר במכשיר, יישלח כשתהיה קליטה',
  busy: 'יש עומס. נסו שוב בעוד דקה.',
  error_generic: 'משהו השתבש. נסו שוב.',
  submitted_title: 'דרישת התשלום הוגשה',
  submitted_hint: 'אפשר להגיש תיקון עד להחלטת המנהל',
  revise: 'תיקון והגשה מחדש',
  cancel_revise: 'ביטול התיקון',
  rejected_title: 'דרישת התשלום נדחתה',
  rejected_reason: 'סיבת הדחייה',
  rejected_hint: 'אפשר לתקן ולהגיש שוב',
  approved_title: 'דרישת התשלום אושרה',
  paid_title: 'דרישת התשלום אושרה וסומנה כשולמה',
  approved_total: 'הסכום שאושר',
  adjusted_reason: 'סיבת התיקון',
  window_closed: 'זמן ההגשה הסתיים. לשאלות אפשר לפנות למנהל.',
  code_required: 'נדרש קוד אימות כדי להמשיך',
  unavailable: 'הקישור אינו זמין',
  no_charge_summary: 'הוגש ללא חיוב',
  submission_n: 'הגשה {n}',
  your_submission: 'ההגשה שלך',
  files_n: '{n} קבצים',
  e_required: 'שדה חובה',
  e_format: 'מספר לא תקין',
  e_quarter_hours: 'שעות ברבעי שעה (0.25, 0.5, 0.75)',
  e_range: 'מחוץ לטווח המותר',
  e_too_long: 'הטקסט ארוך מדי',
  e_unknown: 'ערך לא מוכר',
  e_claim_too_large: 'הסכום גבוה מהמותר',
  e_lines_required: 'יש להוסיף לפחות שורה אחת או לסמן "ללא חיוב"',
  e_too_many_lines: 'עד {n} שורות',
  e_invoice_required: 'יש לצרף חשבונית',
  e_no_charge_with_lines: '"ללא חיוב" לא יכול לכלול שורות',
  e_too_many_documents: 'עד {n} מסמכים',
  e_too_many_pages: 'עד {n} עמודים במסמך',
  e_too_many_files: 'עד {n} קבצים',
  e_mixed_document: 'קובץ PDF הוא מסמך בפני עצמו',
  e_file_gone: 'הקובץ אינו זמין עוד - יש לצרף אותו מחדש',
  e_duplicate_file: 'הקובץ הזה כבר צורף',
  e_too_large: 'הקובץ גדול מדי',
  e_unsupported_format: 'סוג קובץ לא נתמך - JPEG, PNG או PDF',
  e_image_invalid: 'לא ניתן לקרוא את התמונה',
  e_pdf_invalid: 'קובץ ה-PDF פגום',
  e_pdf_refused: 'קובץ PDF זה אינו מתקבל (תוכן פעיל או קובץ מוצפן)',
  e_file_limit: 'הגעתם למספר הקבצים המרבי. נסו שוב מאוחר יותר',
  e_storage_full: 'אין מקום לקבצים כרגע. פנו למנהל',
  e_claim_closed: 'דרישת התשלום כבר טופלה',
  e_claim_not_open: 'אין דרישת תשלום פתוחה',
  e_refused_page: 'יש עמוד שלא התקבל - יש למחוק אותו או לצלם מחדש',
  e_request_id_reused: 'משהו השתבש. נסו שוב.',
};

export type ClaimTextKey = keyof typeof he;

const en: Record<ClaimTextKey, string> = {
  heading: 'Cost claim',
  heading_item: 'Cost claim - {ticket} {number}',
  card_hint: 'You can submit the cost of the work you did',
  required_hint: 'A cost breakdown of the work is required',
  open_form: 'Submit a cost claim',
  later: "I'll finish later",
  loading: 'Loading…',
  claim_until: 'You can submit until {date}',
  lines_title: 'Breakdown',
  line_add: 'Add line',
  line_remove: 'Remove line',
  line_kind: 'Type',
  kind_labor: 'Labor',
  kind_parts: 'Parts',
  kind_travel: 'Travel',
  kind_other: 'Other',
  f_hours: 'Hours',
  f_rate: 'Hourly rate',
  f_description: 'Description',
  f_quantity: 'Quantity',
  f_unit_price: 'Unit price',
  f_amount: 'Amount',
  vat_included: 'Amounts include VAT',
  vat_excluded: 'Before VAT',
  vat_none: 'No VAT (exempt)',
  no_charge: 'No charge',
  no_charge_hint: 'For example, warranty work',
  currency: 'Currency',
  net: 'Amount before VAT',
  vat: 'VAT {rate}%',
  total: 'Total',
  estimate_note: 'For display only - the final amount is computed by the system',
  vendor_ref: 'Invoice / reference number',
  notes: 'Notes',
  optional: '(optional)',
  docs_title: 'Invoice / receipt',
  docs_hint: 'Up to {docs} documents. A document is one PDF file or up to {pages} photographed pages.',
  capture: 'Photograph invoice',
  gallery: 'Choose from gallery / file',
  pdf: 'PDF file',
  camera_fallback: 'The camera could not be opened - you can choose a picture from the gallery or a file',
  inapp_hint: 'If the camera does not open, open the link in your browser (Open in browser)',
  iphone_hint: 'On iPhone: if the picture is not accepted, choose "Most Compatible" in the camera settings',
  editor_title: 'Page {n}',
  retake: 'Retake',
  rotate: 'Rotate',
  crop: 'Crop',
  crop_apply: 'Apply crop',
  crop_cancel: 'Cancel',
  crop_hint: 'Drag a rectangle over the part to keep',
  contrast: 'Enhance contrast',
  use_page: 'Keep page',
  add_page: 'Add page',
  finish_doc: 'Finish document',
  discard: 'Cancel',
  processing: 'Processing…',
  doc_n: 'Document {n}',
  doc_pdf: 'Document {n} (PDF)',
  page_n: 'Page {n}',
  move_up: 'Move up',
  move_down: 'Move down',
  delete_page: 'Delete page',
  delete_doc: 'Delete document',
  up_local: 'Waiting to send',
  up_uploading: 'Sending…',
  up_uploaded: 'Sent',
  up_failed: 'Not sent yet',
  up_refused: 'Not accepted',
  retry: 'Try again',
  submit: 'Send',
  submitting: 'Sending…',
  waiting_uploads: 'Waiting for the files to be sent…',
  saved_offline: 'Saved on this device, will be sent when there is reception',
  busy: 'The system is busy. Try again in a minute.',
  error_generic: 'Something went wrong. Try again.',
  submitted_title: 'Cost claim submitted',
  submitted_hint: 'You can submit a correction until the manager decides',
  revise: 'Correct and resubmit',
  cancel_revise: 'Cancel correction',
  rejected_title: 'Cost claim rejected',
  rejected_reason: 'Reason',
  rejected_hint: 'You can correct it and submit again',
  approved_title: 'Cost claim approved',
  paid_title: 'Cost claim approved and marked as paid',
  approved_total: 'Approved amount',
  adjusted_reason: 'Reason for the change',
  window_closed: 'The submission period has ended. For questions, contact the manager.',
  code_required: 'A verification code is required to continue',
  unavailable: 'This link is not available',
  no_charge_summary: 'Submitted as no charge',
  submission_n: 'Submission {n}',
  your_submission: 'Your submission',
  files_n: '{n} files',
  e_required: 'Required',
  e_format: 'Invalid number',
  e_quarter_hours: 'Hours in quarter hours (0.25, 0.5, 0.75)',
  e_range: 'Out of range',
  e_too_long: 'Text is too long',
  e_unknown: 'Unknown value',
  e_claim_too_large: 'The amount is above the limit',
  e_lines_required: 'Add at least one line or select "No charge"',
  e_too_many_lines: 'Up to {n} lines',
  e_invoice_required: 'An invoice is required',
  e_no_charge_with_lines: '"No charge" cannot have lines',
  e_too_many_documents: 'Up to {n} documents',
  e_too_many_pages: 'Up to {n} pages per document',
  e_too_many_files: 'Up to {n} files',
  e_mixed_document: 'A PDF file is a document of its own',
  e_file_gone: 'The file is no longer available - attach it again',
  e_duplicate_file: 'This file was already attached',
  e_too_large: 'The file is too large',
  e_unsupported_format: 'Unsupported file type - JPEG, PNG or PDF',
  e_image_invalid: 'The picture could not be read',
  e_pdf_invalid: 'The PDF file is damaged',
  e_pdf_refused: 'This PDF is not accepted (active content or encrypted)',
  e_file_limit: 'You reached the maximum number of files. Try again later',
  e_storage_full: 'There is no room for files right now. Contact the manager',
  e_claim_closed: 'The cost claim was already handled',
  e_claim_not_open: 'There is no open cost claim',
  e_refused_page: 'A page was not accepted - delete it or retake it',
  e_request_id_reused: 'Something went wrong. Try again.',
};

/** LAZYLANG-295: Arabic / Russian arrive with their language chunk (lang-packs.ts); until then a key reads the same-direction fallback. */
export const CLAIM_TEXT: Readonly<Record<'he' | 'en', Record<ClaimTextKey, string>> & Partial<Record<LazyLang, Record<ClaimTextKey, string>>>> = {
  he,
  en,
  get ar() {
    return langPack('ar')?.claim as Record<ClaimTextKey, string> | undefined;
  },
  get ru() {
    return langPack('ru')?.claim as Record<ClaimTextKey, string> | undefined;
  },
};
export const CLAIM_TEXT_KEYS = Object.keys(he) as ClaimTextKey[];

export function claimLang(lang: string | null | undefined): ClaimLang {
  return (CLAIM_LANGS as readonly string[]).includes(lang ?? '') ? (lang as ClaimLang) : 'he';
}

export function claimDir(lang: ClaimLang): 'rtl' | 'ltr' {
  return RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
}

const ITEM_TOKEN = /\{(tickets|ticket)\}|\{f:([^{}|]*)\|m:([^{}|]*)(?:\|n:([^{}|]*))?\}/g;

/** The D33 tokens with the API's labels (or the fallback names of the language). */
export function renderItem(text: string, labels: ItemLabels): string {
  return text.replace(ITEM_TOKEN, (_m, word: string | undefined, f: string | undefined, m: string | undefined, n: string | undefined) => {
    if (word === 'tickets') return labels.many;
    if (word === 'ticket') return labels.one;
    if (labels.gender === 'm') return m ?? '';
    if (labels.gender === 'n' && n !== undefined) return n;
    return f ?? '';
  });
}

/** The labels to use: the API's when complete, else the language's fallback. */
export function itemLabels(lang: ClaimLang, api?: Partial<ItemLabels> | null): ItemLabels {
  const fb = FALLBACK_LABELS[lang];
  if (api && typeof api.one === 'string' && api.one && typeof api.many === 'string' && api.many) {
    return { one: api.one, many: api.many, gender: typeof api.gender === 'string' ? api.gender : fb.gender };
  }
  return fb;
}

/** One string: the language's text (Hebrew when a key is missing), the item tokens, then the {name} placeholders. */
export function ct(lang: ClaimLang, key: ClaimTextKey, vars?: Record<string, string | number>, labels?: ItemLabels): string {
  const raw = (CLAIM_TEXT[lang] ?? (isLazyLang(lang) ? CLAIM_TEXT[FALLBACK_LANG[lang]] : undefined))?.[key] ?? he[key] ?? key;
  const withItem = renderItem(raw, labels ?? FALLBACK_LABELS[lang]);
  if (!vars) return withItem;
  return withItem.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The text of an error code (server or local); unknown codes read as the generic message. */
export function errorText(lang: ClaimLang, code: string, vars?: Record<string, string | number>): string {
  const map: Record<string, ClaimTextKey> = {
    required: 'e_required',
    format: 'e_format',
    type: 'e_format',
    quarter_hours: 'e_quarter_hours',
    range: 'e_range',
    too_long: 'e_too_long',
    unknown: 'e_unknown',
    claim_too_large: 'e_claim_too_large',
    too_many: 'e_too_many_lines',
    invoice_required: 'e_invoice_required',
    no_charge_with_lines: 'e_no_charge_with_lines',
    too_many_documents: 'e_too_many_documents',
    too_many_pages: 'e_too_many_pages',
    too_many_files: 'e_too_many_files',
    mixed_document: 'e_mixed_document',
    empty_document: 'e_file_gone',
    unknown_file: 'e_file_gone',
    expired_file: 'e_file_gone',
    file_reused: 'e_duplicate_file',
    duplicate_file: 'e_duplicate_file',
    too_large: 'e_too_large',
    unsupported_format: 'e_unsupported_format',
    image_invalid: 'e_image_invalid',
    pdf_invalid: 'e_pdf_invalid',
    pdf_refused: 'e_pdf_refused',
    file_limit: 'e_file_limit',
    storage_full: 'e_storage_full',
    claim_closed: 'e_claim_closed',
    claim_not_open: 'e_claim_not_open',
    claim_window_closed: 'window_closed',
    refused_page: 'e_refused_page',
    request_id_reused: 'e_request_id_reused',
    busy: 'busy',
    offline: 'saved_offline',
    code_required: 'code_required',
    unavailable: 'unavailable',
    link_unavailable: 'unavailable',
  };
  return ct(lang, map[code] ?? 'error_generic', vars);
}
