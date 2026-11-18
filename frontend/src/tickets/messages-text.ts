/**
 * CR-038 slice 5b: the texts of the message channel's screens - the delivery lines of a ticket (D14), the timeline lines of messages and
 * WhatsApp replies, the settings tabs "ערוץ הודעות" and "תבניות הודעה" and the unmatched-reply queue. The tickets/text.ts rules apply
 * (D33): a text that names the module uses the `{ticket}` / `{tickets}` / `{f:..|m:..}` tokens of tickets/naming.ts and is rendered by
 * `mtt()`; the default name is never written here (tests/unit-tickets-naming.spec.ts scans this file). Hebrew first, an English column.
 * The product never says "delivered" or "read" - only that a message was handed over ("מסירה לא ידועה", D14).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  // the ticket's delivery block (D14) and its actions (D29)
  msgSection: 'הודעות',
  p_assign: 'הודעת שיוך',
  p_reminder: 'תזכורת',
  p_code: 'קוד אימות',
  p_closed: 'הודעת סגירה',
  p_reassigned: 'הודעת העברה',
  p_reopened: 'פתיחה מחדש',
  p_update: 'עדכון',
  p_test: 'בדיקה',
  p_cost_rejected: 'דרישת תשלום הוחזרה',
  p_cost_approved: 'דרישת תשלום אושרה',
  p_cost_reopened: 'הגשת עלות נפתחה שוב',
  p_rfq_order: 'הזמנת עבודה',
  st_sent_whatsapp: 'נשלח בוואטסאפ - מסירה לא ידועה · {when}',
  st_sent_email: 'נשלח במייל - מסירה לא ידועה · {when}',
  st_unknown: 'ייתכן שנשלח · {when}',
  st_failed: 'לא נשלח',
  st_held_hours: 'ממתין לשעות השליחה · יישלח ב-{when}',
  st_held_down: 'וואטסאפ לא מחובר - ממתין',
  st_held_unmapped: 'לא נבחר חשבון וואטסאפ - ממתין',
  st_held_off: 'ממתין',
  st_queued: 'בתור לשליחה',
  st_sending: 'בשליחה',
  ch_email: 'במייל',
  sendNow: 'שלח עכשיו',
  resend: 'שלח שוב',
  sendUpdate: 'שלח עדכון',
  staleLine: 'נשלח לפני השינוי',
  queuedNow: 'ההודעה בדרך',
  lkResend: 'שלח קישור שוב',

  // the assign dialog's lines for an outside contact (slice 4's dialog; the preview's slice-5b fields)
  asgWhatsapp: 'יישלח בוואטסאפ · {account}',
  asgWhatsappPlain: 'יישלח בוואטסאפ',
  asgEmail: 'יישלח במייל',
  asgDownEmail: 'וואטסאפ לא זמין כרגע - אם לא יחזור, ההודעה תישלח במייל',
  asgDownManual: 'וואטסאפ לא זמין כרגע - אם לא יחזור, יהיה צריך להעתיק את הקישור',
  asgHours: 'מחוץ לשעות השליחה · יישלח ב-{when}',

  // timeline lines (ticket_events kinds of slices 4 / 5b)
  e_sent_whatsapp: 'נשלח בוואטסאפ - מסירה לא ידועה',
  e_sent_email: 'נשלח במייל - מסירה לא ידועה',
  e_update_sent: 'עדכון נשלח - מסירה לא ידועה',
  e_reminder_sent: 'תזכורת נשלחה - מסירה לא ידועה',
  e_code_sent: 'קוד אימות נשלח',
  e_message_unknown: 'ייתכן שנשלח',
  e_message_failed: 'ההודעה לא נשלחה',
  e_fallback_email: 'וואטסאפ לא זמין - ההודעה תישלח במייל',
  e_fallback_nobody: 'לא היה ערוץ לשליחה - יש להעתיק את הקישור',
  e_fallback_code: 'לא היה ערוץ לשליחת הקוד',
  e_inbound: 'תשובה בוואטסאפ (שולח לא מאומת)',
  e_late_reply: 'תשובה שהגיעה באיחור (שולח לא מאומת)',
  e_inbound_status: '{status} - דרך וואטסאפ (שולח לא מאומת)',
  e_link_opened: 'הקישור נפתח',
  e_link_copied: 'הקישור הועתק',
  e_link_new: 'נוצר קישור חדש',
  e_link_revoked: 'הקישור בוטל',
  e_rfq_order: 'נפתח מהזמנת עבודה של בקשת הצעת מחיר RFQ-{number}',
  e_rfq_order_sent: 'הזמנת העבודה נשלחה לספק',
  e_via_account: 'מחשבון {account}',

  // Settings › the module › ערוץ הודעות
  tabChannel: 'ערוץ הודעות',
  tabTemplates: 'תבניות הודעה',
  chCard: 'וואטסאפ',
  chEnabled: 'שליחה בוואטסאפ',
  chEnabledSub: 'כבוי: הקישור יוצא במייל או מועתק ידנית',
  chButtons: 'כפתורי תשובה',
  chButtonsSub: 'בחלק מהמכשירים יוצגו כטקסט',
  chWindow: 'חלון שיוך תשובות',
  chWindowUnit: 'שעות',
  chEmail: 'גיבוי במייל',
  chEmailSub: 'כשאין וואטסאפ - למי שיש כתובת',
  chMailServer: 'שרת דואר',
  chMailOk: 'מוגדר',
  chMailMissing: 'לא מוגדר',
  chUsesCard: 'החשבונות השולחים',
  chManage: 'ניהול חשבונות',
  chUseNone: 'לא נבחר',
  chUseInherit: 'כמו {label}',
  chDepartments: 'מחלקות ({n})',
  chAccountsCard: 'מצב החשבונות',
  chLastOk: 'שליחה אחרונה {when}',
  chNeverOk: 'עוד לא נשלח',
  chToday: '24 שעות: {n}/{max}',
  chHealthCard: 'תור ההודעות',
  chWaiting: 'ממתינות',
  chOldest: 'הוותיקה',
  chReplies: 'תשובות ב-24 שעות',
  chReplyListen: 'האזנה לתשובות',
  chOn: 'פעילה',
  chOff: 'כבויה',
  state_connected: 'מחובר',
  state_disconnected: 'מנותק',
  state_unknown: 'לא ידוע',
  state_missing: 'לא נמצא',
  warn_required_unmapped: 'לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ',
  warn_account_down: 'החשבון {state}',
  warn_shared_outside: 'המספר משמש גם מחוץ למערכת',
  warn_shared_module: 'המספר משותף גם ל{module} - קצב שליחה משותף',
  saved: 'נשמר',
  save: 'שמירה',

  // Settings › the module › תבניות הודעה (D26)
  tplPurpose: 'מטרה',
  tplLang: 'שפה',
  tplDept: 'מחלקה',
  tplAllDepts: 'כל המחלקות',
  tplStarter: 'נוסח ברירת מחדל',
  tplCustom: 'נוסח מותאם',
  tplInactive: 'מושבת',
  tplEdit: 'עריכה',
  tplNew: 'נוסח משלי',
  tplDelete: 'חזרה לברירת המחדל',
  tplPreview: 'תצוגה מקדימה',
  tplFields: 'שדות',
  tplLength: '{n}/{max} תווים',
  tplCancel: 'ביטול',
  lang_he: 'עברית',
  lang_en: 'אנגלית',
  lang_ar: 'ערבית',
  lang_ru: 'רוסית',
  tp_link_required: 'חובה לכלול {link}',
  tp_code_required: 'חובה לכלול {code}',
  tp_code_not_allowed: '{code} רק בתבנית קוד האימות',
  tp_code_discloses: 'בהודעת קוד אין קישור, כותרת, מקום או התקן',
  tp_placeholder_unknown: 'שדה לא מוכר',
  tp_url_not_link: 'כתובת אינטרנט רק דרך {link}',
  tp_control_chars: 'תווים לא חוקיים',
  tp_too_long: 'ארוך מדי',
  tp_brace_unbalanced: 'סוגריים מסולסלים לא מאוזנים',
  tp_gender_malformed: 'צורת התאמה לא תקינה',
  tp_empty: 'הנוסח ריק',

  // the unmatched-reply queue (9.6, review T13-2)
  inbTitle: 'תשובות לא משויכות',
  inbChip: 'תשובות לא משויכות ({n})',
  inbClaim: 'זה שלי',
  inbAttach: 'שיוך ל{ticket} {number}',
  inbDismiss: 'התעלמות',
  inbClaimedBy: 'בטיפול של {name}',
  inbEmpty: 'אין תשובות ממתינות',
  inbFrom: '{sender} · {when}',
  inbClose: 'סגירה',
};

const en: Partial<Record<keyof typeof he, string>> = packTable<typeof import('../i18n/lang/en/tickets/messages-text').en>('en', 'tickets/messages-text', 'en');

export type MessageTextKey = keyof typeof he;
const catalogue = makeCatalogue<MessageTextKey>(he, en);
export const MESSAGE_TEXT_KEYS = catalogue.KEYS;
export const MESSAGE_TEXT_EN_KEYS = catalogue.EN_KEYS;

/** A text of the message screens: the document's language, the module's name rendered (D33), then `{var}`s (a typed value is never
 * read as a token: the variables are filled after the name). `{link}` / `{code}` in the template texts are literal placeholders. */
export const mtt = catalogue.t;

registerCatalogue('tickets/messages-text', { he, en });
