/**
 * CR-038 slice 4 (spec 10.7, D26): the handler page's words in its four languages - Hebrew and Arabic right to left, English and
 * Russian left to right. The page has no other text source: the server answers codes (`{"code": ...}`), never sentences.
 *
 * D33: the module's user-facing name is configurable. A text that names it is a template with the tokens `{ticket}` / `{tickets}`
 * and `{f:..|m:..}` (`|n:..` for Russian) for a word that agrees with the name's gender; the names come with the ticket
 * (`labels`, the contact's language). The default name is never written here (tests/unit-public-ticket.spec.ts fails when it is).
 * The Arabic and Russian strings need a native speaker's review before the release (spec 9.7, slice 8).
 * LAZYLANG-295: the Arabic and Russian words live in lazy chunks (lang/lang-ar.ts, lang/lang-ru.ts, see lang-packs.ts); only their
 * own names (the language picker) are here.
 */

import { FALLBACK_LANG, isLazyLang, langPack, type LazyLang } from './lang-packs';

export type Lang = 'he' | 'en' | 'ar' | 'ru';
export const LANGS: readonly Lang[] = ['he', 'en', 'ar', 'ru'];
export const RTL: ReadonlySet<Lang> = new Set<Lang>(['he', 'ar']);
export interface Labels { one: string; many: string; gender: string; module?: string }

const he = {
  langName: 'עברית',
  pageTitle: '{ticket} לטיפול',
  sentBy: '{f:נשלחה|m:נשלח} על ידי {who}',
  number: '{ticket} {number}',
  openedAt: '{f:נפתחה|m:נפתח} {when}',
  priority_urgent: 'דחופה',
  priority_high: 'גבוהה',
  priority_normal: 'רגילה',
  priority_low: 'נמוכה',
  s_new: 'חדש',
  s_assigned: 'נשלח',
  s_acknowledged: 'התקבל',
  s_in_progress: 'בטיפול',
  s_waiting_part: 'ממתין לחלק',
  s_done: 'בוצע',
  s_returned: 'הוחזר',
  s_closed: 'סגור',
  s_cancelled: 'בוטל',
  btn_acknowledged: 'התקבל',
  btn_acknowledged_sub: 'ראיתי, אגיע',
  btn_in_progress: 'בטיפול',
  btn_in_progress_sub: 'עובדים על זה',
  wait_mark: 'סמן: ממתין לחלק',
  wait_back: 'חזרה לטיפול',
  btn_done: 'בוצע',
  btn_done_sub: 'המנהל יאשר ויסגור',
  updateStatus: 'עדכון מצב',
  eta: 'צפי סיום',
  etaToday: 'היום',
  etaTomorrow: 'מחר',
  etaTwoDays: 'בעוד יומיים',
  etaOther: 'תאריך אחר',
  etaSet: 'צפי: {when}',
  etaClear: 'ניקוי',
  note: 'הערה',
  notePlaceholder: 'מה נמצא, מה צריך, מתי תחזרו',
  photos: 'תמונות',
  takePhoto: 'צילום',
  pickPhoto: 'בחירה מהגלריה',
  photoUploading: 'מעלה תמונה…',
  photoAdded: 'התמונה נוספה',
  send: 'שליחת העדכון',
  sending: 'שולח…',
  sent: 'העדכון נשלח',
  nothingToSend: 'בחרו מצב, צפי או הערה',
  savedOffline: 'נשמר במכשיר, יישלח כשתהיה קליטה',
  history: 'היסטוריית ההתקן (24 שעות)',
  mapTitle: 'מיקום במפה',
  mapAlt: 'מפת הקומה, הרכיב מסומן בעיגול ובחץ',
  mapNoImage: 'אין תמונת מפה - זה התיאור שנשמר.',
  h_automation: 'אוטומציה',
  h_schedule: 'תזמון',
  h_system: 'מערכת',
  h_device: 'ההתקן',
  h_user: 'ידני',
  h_manual: 'ידני',
  h_unknown: '',
  timeline: 'עדכונים',
  you: 'אתם',
  t_status: 'מצב: {status}',
  t_note: 'הערה',
  t_photo: 'תמונה',
  t_eta: 'צפי: {when}',
  t_question: 'שאלה למנהל',
  askManager: 'שאלה למנהל',
  askHint: 'המנהל יקבל התראה וישיב כאן',
  t_returned: 'הוחזר למנהל',
  notMineLink: 'לא בתחומי - להחזיר למנהל',
  returnTitle: 'להחזיר למנהל',
  returnAsk: 'למה זה לא בתחומכם? המנהל יראה את הסיבה וישייך מחדש.',
  returnNotMine: 'לא בתחומי',
  returnCannot: 'לא אוכל לטפל',
  returnReason: 'סיבה',
  returnReasonRequired: 'נא לכתוב סיבה',
  returnSend: 'החזרה למנהל',
  cancel: 'ביטול',
  returnedTitle: '{f:הוחזרה|m:הוחזר} למנהל',
  returnedBody: 'תודה. הקישור הזה כבר אינו פעיל.',
  closedTitle: '{ticket} {f:נסגרה|m:נסגר}, תודה',
  closedBody: 'אפשר לראות כאן את העדכונים שלכם עד {when}.',
  unavailableTitle: 'הקישור אינו זמין עוד',
  unavailableBody: 'לפרטים פנו למי ששלח לכם אותו.',
  busyTitle: 'יש עומס',
  busyBody: 'יש עומס. נסו שוב בעוד דקה.',
  errorTitle: 'משהו השתבש',
  errorBody: 'לא הצלחנו לטעון את הדף.',
  retry: 'נסו שוב',
  loading: 'טוען…',
  codeTitle: 'קוד אימות',
  codeBody: 'כדי לעדכן יש להזין קוד בן 6 ספרות שיישלח לטלפון שלכם.',
  codeSend: 'שלחו לי קוד',
  codeResend: 'שליחת קוד חדש',
  codeSent: 'הקוד נשלח. הוא בתוקף {n} דקות.',
  codeSentWa: 'הקוד נשלח ב-WhatsApp. הוא בתוקף {n} דקות.',
  codeInput: 'הקוד',
  codeVerify: 'אישור',
  codeWrong: 'הקוד שגוי. נותרו {n} ניסיונות.',
  codeExpired: 'הקוד פג. בקשו קוד חדש.',
  codeMissing: 'בקשו קוד קודם.',
  codeLocked: 'יותר מדי ניסיונות. נסו שוב בעוד {n} דקות או פנו למנהל.',
  codeUnavailable: 'לא ניתן לשלוח קוד כרגע. פנו למנהל.',
  codeMalformed: 'יש להזין 6 ספרות.',
  redeemTitle: 'פתיחת {ticket}',
  redeemBody: 'הקישור הזה מגיע ממייל. לחצו כדי להמשיך.',
  redeemButton: 'פתיחה',
  finish: 'סיום',
  backToList: 'חזרה לרשימה',
  finishedTitle: 'הסתיים',
  finishedBody: 'הקישור נשכח בדפדפן הזה. כדי לחזור, פתחו שוב את ההודעה.',
  linkFooter: 'הקישור אישי · בתוקף עד {when}',
  e_invalid_transition: 'המצב הזה אינו אפשרי עכשיו.',
  e_invalid_state: 'אפשר לעדכן צפי רק בזמן הטיפול.',
  e_read_only: 'הטיפול הסתיים. לא ניתן לעדכן.',
  e_too_large: 'הקובץ גדול מדי (עד 8 MB).',
  e_unsupported_format: 'יש להעלות תמונת JPEG או PNG.',
  e_webp_refused: 'תמונות WebP אינן נתמכות. יש להעלות JPEG.',
  e_heic_refused: 'תמונות HEIC אינן נתמכות. בהגדרות המצלמה בחרו "התואם ביותר".',
  e_image_invalid: 'התמונה פגומה.',
  e_too_many_pixels: 'רזולוציית התמונה גבוהה מדי.',
  e_photo_limit: 'הגעתם למספר התמונות המרבי.',
  e_storage_full: 'אין מקום לתמונות נוספות. פנו למנהל.',
  e_busy: 'העלאה אחרת מתבצעת. נסו שוב בעוד רגע.',
  e_rate_limited: 'יש עומס. נסו שוב בעוד דקה.',
  e_invalid: 'ערך לא תקין.',
  e_generic: 'הפעולה לא הצליחה. נסו שוב.',
  timeZone: 'שעון {zone}',
  language: 'שפה',
  themeToDark: 'מעבר למצב כהה',
  themeToLight: 'מעבר למצב בהיר',
  line_ack: 'הארגון ממתין לאישור הקבלה שלכם',
  line_received: 'אישרתם קבלה · עדכנו כשמתחילים',
  line_working: 'בטיפול',
  line_part: 'בטיפול · ממתין לחלק',
  line_done: 'הטיפול הסתיים · ממתינים לאישור הארגון',
  line_closed: 'הטיפול הסתיים',
  line_quote_wait: 'הצעת המחיר אצל הארגון לאישור',
  line_quote_fix: 'נדרש תיקון בהצעת המחיר',
  line_quote_ok: 'הצעת המחיר אושרה · אפשר להתחיל',
  line_demand_ask: 'ממתינים לדרישת התשלום שלכם',
  line_demand_wait: 'דרישת התשלום אצל הארגון לאישור',
  line_demand_fix: 'נדרש תיקון בדרישת התשלום',
  line_demand_ok: 'דרישת התשלום אושרה · לתשלום',
  line_paid: 'שולם · תודה',
  btn_ack: 'קיבלתי',
  btn_quote_fix: 'תיקון הצעת המחיר',
  btn_demand: 'שליחת דרישת תשלום',
  cardWhen: 'מתי תגיעו / תסיימו?',
  cardDone: 'מה נעשה / מה נשאר',
  prelim: 'תרגום ראשוני לבדיקה',
};

export type Catalogue = typeof he;
export type Key = keyof Catalogue;

const en: Catalogue = {
  langName: 'English',
  pageTitle: '{ticket} to handle',
  sentBy: 'Sent by {who}',
  number: '{ticket} {number}',
  openedAt: 'Opened {when}',
  priority_urgent: 'Urgent',
  priority_high: 'High',
  priority_normal: 'Normal',
  priority_low: 'Low',
  s_new: 'New',
  s_assigned: 'Sent',
  s_acknowledged: 'Received',
  s_in_progress: 'In progress',
  s_waiting_part: 'Waiting for a part',
  s_done: 'Done',
  s_returned: 'Returned',
  s_closed: 'Closed',
  s_cancelled: 'Cancelled',
  btn_acknowledged: 'Received',
  btn_acknowledged_sub: 'Seen, on my way',
  btn_in_progress: 'In progress',
  btn_in_progress_sub: 'Working on it',
  wait_mark: 'Mark: waiting for a part',
  wait_back: 'Back to in progress',
  btn_done: 'Done',
  btn_done_sub: 'The manager will confirm and close',
  updateStatus: 'Update the status',
  eta: 'Expected completion',
  etaToday: 'Today',
  etaTomorrow: 'Tomorrow',
  etaTwoDays: 'In two days',
  etaOther: 'Other date',
  etaSet: 'Expected: {when}',
  etaClear: 'Clear',
  note: 'Note',
  notePlaceholder: 'What you found, what is needed, when you will be back',
  photos: 'Photos',
  takePhoto: 'Take a photo',
  pickPhoto: 'From the gallery',
  photoUploading: 'Uploading the photo…',
  photoAdded: 'Photo added',
  send: 'Send the update',
  sending: 'Sending…',
  sent: 'Update sent',
  nothingToSend: 'Choose a status, a date or write a note',
  savedOffline: 'Saved on this device, it will be sent when there is reception',
  history: 'Device history (24 hours)',
  mapTitle: 'Location on the map',
  mapAlt: 'Floor map with the item circled and pointed at',
  mapNoImage: 'No map picture - this is the saved description.',
  h_automation: 'Automation',
  h_schedule: 'Schedule',
  h_system: 'System',
  h_device: 'The device',
  h_user: 'Manual',
  h_manual: 'Manual',
  h_unknown: '',
  timeline: 'Updates',
  you: 'You',
  t_status: 'Status: {status}',
  t_note: 'Note',
  t_photo: 'Photo',
  t_eta: 'Expected: {when}',
  t_question: 'Question for the manager',
  askManager: 'Ask the manager',
  askHint: 'The manager is notified and will answer here',
  t_returned: 'Returned to the manager',
  notMineLink: 'Not my field - return it to the manager',
  returnTitle: 'Return to the manager',
  returnAsk: 'Why is this not for you? The manager will see the reason and assign it again.',
  returnNotMine: 'Not my field',
  returnCannot: 'I cannot handle it',
  returnReason: 'Reason',
  returnReasonRequired: 'Please write a reason',
  returnSend: 'Return to the manager',
  cancel: 'Cancel',
  returnedTitle: 'Returned to the manager',
  returnedBody: 'Thank you. This link is no longer active.',
  closedTitle: 'Closed - thank you',
  closedBody: 'Your updates stay visible here until {when}.',
  unavailableTitle: 'This link is no longer available',
  unavailableBody: 'For details, contact whoever sent it to you.',
  busyTitle: 'Busy',
  busyBody: 'Too many requests. Please try again in a minute.',
  errorTitle: 'Something went wrong',
  errorBody: 'The page could not be loaded.',
  retry: 'Try again',
  loading: 'Loading…',
  codeTitle: 'Verification code',
  codeBody: 'To update this {ticket}, enter the 6-digit code that will be sent to your phone.',
  codeSend: 'Send me a code',
  codeResend: 'Send a new code',
  codeSent: 'The code was sent. It is valid for {n} minutes.',
  codeSentWa: 'The code was sent by WhatsApp. It is valid for {n} minutes.',
  codeInput: 'Code',
  codeVerify: 'Confirm',
  codeWrong: 'Wrong code. {n} attempts left.',
  codeExpired: 'The code expired. Ask for a new one.',
  codeMissing: 'Ask for a code first.',
  codeLocked: 'Too many attempts. Try again in {n} minutes or contact the manager.',
  codeUnavailable: 'A code cannot be sent right now. Contact the manager.',
  codeMalformed: 'Enter 6 digits.',
  redeemTitle: 'Open the {ticket}',
  redeemBody: 'This link comes from an e-mail. Press to continue.',
  redeemButton: 'Open',
  finish: 'Finish',
  backToList: 'Back to the list',
  finishedTitle: 'Finished',
  finishedBody: 'The link was forgotten in this browser. To come back, open the message again.',
  linkFooter: 'Personal link · valid until {when}',
  e_invalid_transition: 'This status is not possible now.',
  e_invalid_state: 'A completion date can only be set while handling.',
  e_read_only: 'This {ticket} is closed and cannot be updated.',
  e_too_large: 'The file is too large (8 MB at most).',
  e_unsupported_format: 'Please upload a JPEG or PNG picture.',
  e_webp_refused: 'WebP pictures are not supported. Please upload a JPEG.',
  e_heic_refused: 'HEIC pictures are not supported. In the camera settings choose "Most compatible".',
  e_image_invalid: 'The picture is damaged.',
  e_too_many_pixels: 'The picture resolution is too high.',
  e_photo_limit: 'The maximum number of photos was reached.',
  e_storage_full: 'There is no room for more photos. Contact the manager.',
  e_busy: 'Another upload is running. Try again in a moment.',
  e_rate_limited: 'Too many requests. Please try again in a minute.',
  e_invalid: 'Invalid value.',
  e_generic: 'That did not work. Please try again.',
  timeZone: '{zone} time',
  language: 'Language',
  themeToDark: 'Switch to dark mode',
  themeToLight: 'Switch to light mode',
  line_ack: 'The organisation is waiting for you to confirm receipt',
  line_received: 'Receipt confirmed · update us when you start',
  line_working: 'In progress',
  line_part: 'In progress · waiting for a part',
  line_done: 'Work finished · waiting for the organisation',
  line_closed: 'Handling finished',
  line_quote_wait: 'Your quote is with the organisation for approval',
  line_quote_fix: 'The quote needs a correction',
  line_quote_ok: 'Quote approved · you can start',
  line_demand_ask: 'Waiting for your payment request',
  line_demand_wait: 'Your payment request is with the organisation',
  line_demand_fix: 'The payment request needs a correction',
  line_demand_ok: 'Payment request approved · for payment',
  line_paid: 'Paid · thank you',
  btn_ack: 'I received it',
  btn_quote_fix: 'Correct the quote',
  btn_demand: 'Send a payment request',
  cardWhen: 'When will you arrive / finish?',
  cardDone: 'What was done / what is left',
  prelim: 'Preliminary translation, under review',
};

/** The catalogues that are in: Hebrew and English always, Arabic / Russian once their chunk arrived (lang-packs.ts). */
export const CATALOGUES: Readonly<Record<'he' | 'en', Catalogue> & Partial<Record<LazyLang, Catalogue>>> = {
  he,
  en,
  get ar() {
    return langPack('ar')?.strings as Catalogue | undefined;
  },
  get ru() {
    return langPack('ru')?.strings as Catalogue | undefined;
  },
};

/** Each language's own name and the picker's label, always in the bundle (the picker lists all four before any chunk arrives). */
export const LANG_SELF: Readonly<Record<Lang, { langName: string; language: string }>> = {
  he: { langName: he.langName, language: he.language },
  en: { langName: en.langName, language: en.language },
  ar: { langName: 'العربية', language: 'اللغة' },
  ru: { langName: 'Русский', language: 'Язык' },
};

/** The catalogue a language reads now: its own, or (a lazy language not in yet / failed) the fallback of the same direction. */
function catalogueOf(lang: Lang): Catalogue {
  return CATALOGUES[lang] ?? (isLazyLang(lang) ? CATALOGUES[FALLBACK_LANG[lang]] : undefined) ?? he;
}

const TOKEN = /\{(the_tickets|the_ticket|tickets|ticket|module)\}|\{f:([^{}|]*)\|m:([^{}|]*)(?:\|n:([^{}|]*))?\}/g;

/** The Hebrew definite form of a name (the twin of tickets/naming.ts `definite`; the page bundle stays separate from the app). */
function definite(name: string): string {
  if (!/[א-ת]/.test(name)) return name;
  const words = name.split(' ');
  if (words.length > 1 && words[words.length - 1].startsWith('ה')) return name;
  words[words.length - 1] = `ה${words[words.length - 1]}`;
  return words.join(' ');
}

/** D33: the module-name tokens rendered with the names the server sent for the contact's language (`labels`). */
export function renderName(template: string, n: Labels | null): string {
  return template.replace(TOKEN, (_m, word: string | undefined, f: string | undefined, m: string | undefined, neuter: string | undefined) => {
    if (word === 'tickets') return n?.many ?? '';
    if (word === 'ticket') return n?.one ?? '';
    if (word === 'the_tickets') return definite(n?.many ?? '');
    if (word === 'the_ticket') return definite(n?.one ?? '');
    if (word === 'module') return n?.module || (n?.many ?? '');
    const g = n?.gender ?? 'f';
    if (g === 'm') return m ?? '';
    if (g === 'n' && neuter !== undefined) return neuter;
    return f ?? '';
  });
}

/** A text of the page: the name tokens first, then the `{name}` variables (a value someone typed is never read as a token). */
export function text(lang: Lang, key: Key, vars: Record<string, string | number> = {}, labels: Labels | null = null): string {
  const raw = catalogueOf(lang)[key] ?? he[key] ?? '';
  const named = renderName(raw, labels);
  return named.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** The browser's first language the page speaks (`navigator.languages`), for the screens shown before any ticket answered - the
 * "unavailable" screen of an expired link, the e-mail redeem screen. A ticket's answer (the contact's language) wins over it. */
export function preferredLang(tags: readonly string[] | null | undefined): Lang | null {
  for (const tag of tags ?? []) {
    const primary = String(tag).toLowerCase().split(/[-_]/)[0];
    const lang = primary === 'iw' ? 'he' : primary;
    if (isLang(lang)) return lang;
  }
  return null;
}
