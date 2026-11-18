/**
 * CR-BULKPEOPLE-295: the words of bulk edit and CSV import / export of access-control people. Hebrew first; English, Arabic and
 * Russian follow the document language. Every key exists in all four tables (tests/unit-bulk-people.spec.ts holds the parity); the
 * Arabic and Russian columns are an INITIAL translation that needs a native review (dev-marked). Operator texts never name the home
 * platform. `{name}` placeholders are filled by `bt(key, { name })`.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  open: 'ייבוא וייצוא',
  title: 'ייבוא, ייצוא ושינוי מרוכז',
  tab_import: 'ייבוא מקובץ',
  tab_export: 'ייצוא',
  edit_open: 'שינוי מרוכז',
  no_secrets: 'קודים, כרטיסים ותמונות אינם נטענים מקובץ ואינם מיוצאים לקובץ.',
  off_title: 'שינוי מרוכז כבוי',
  off_text: 'מנהל מערכת יכול להפעיל ייבוא, ייצוא ושינוי מרוכז של אנשים.',
  off_enable: 'הפעלה',
  permit_missing: 'הכתיבה לבקרת הכניסה דורשת אישור הפעלה נפרד מבעל המערכת. עד אז אפשר לבדוק קבצים ולראות תצוגה מקדימה בלבד.',
  template: 'הורדת תבנית',
  export_btn: 'ייצוא לקובץ',
  export_hint: 'רק האנשים שמותר לך לראות. הטלפון מוסתר חלקית. אפשר לייצא פעם בדקה.',
  export_done: 'יוצאו {n} אנשים',
  choose_file: 'בחירת קובץ CSV',
  file_hint: 'עד {rows} שורות ועד {kb} ק״ב. שורה בלי מזהה יוצרת אדם חדש; שורה עם מזהה מעדכנת רק את האדם הזה.',
  uploading: 'בודק את הקובץ…',
  report_title: 'בדיקת הקובץ',
  report_ok: '{n} תקינות',
  report_skip: '{n} ללא שינוי',
  report_error: '{n} עם שגיאה',
  row: 'שורה {n}',
  dry_run: 'תצוגה מקדימה',
  dry_running: 'משווה מול בקרת הכניסה…',
  dry_title: 'מה ישתנה',
  will_create: '{n} חדשים',
  will_update: '{n} עדכונים',
  unchanged: '{n} ללא שינוי',
  errors: '{n} לא ייכתבו',
  before: 'לפני',
  after: 'אחרי',
  hidden: 'מוסתר',
  confirm_title: 'אישור כתיבה',
  confirm_text: 'ייכתבו {n} שורות לבקרת הכניסה. להמשך הקלידו את המספר {n}.',
  confirm_label: 'מספר השורות',
  confirm_btn: 'אישור',
  confirm_admin_only: 'האישור שמור למנהל מערכת. שלחו לו את הקישור למשימה.',
  apply: 'כתיבה',
  applying: 'נכתבו {done} מתוך {total}',
  paused: 'הכתיבה נעצרה באמצע. אפשר להמשיך.',
  stalled: 'בקרת הכניסה לא זמינה כרגע. נסו להמשיך מאוחר יותר.',
  resume: 'המשך',
  done_title: 'הכתיבה הסתיימה',
  cancel: 'ביטול המשימה',
  close: 'סגירה',
  back: 'חזרה',
  outcome_ok: 'נכתב',
  outcome_failed: 'לא נכתב',
  outcome_unknown: 'לא ידוע',
  outcome_not_sent: 'לא נשלח',
  unknown_hint: 'שורה שתוצאתה לא ידועה לא נשלחת שוב. בדקו את האדם ברשימה לפני כל שינוי נוסף.',
  edit_title: 'שינוי מרוכז · {n} אנשים',
  edit_validity: 'תוקף',
  edit_from: 'מתאריך',
  edit_until: 'עד תאריך',
  edit_doors_add: 'הוספת עמדה',
  edit_doors_remove: 'הסרת עמדה',
  edit_relays: 'דלתות',
  edit_groups_add: 'הוספה לקבוצה',
  edit_groups_remove: 'הסרה מקבוצה',
  edit_active: 'מצב',
  edit_keep: 'ללא שינוי',
  edit_activate: 'הפעלה',
  edit_deactivate: 'השבתה',
  edit_stage: 'המשך לתצוגה מקדימה',
  edit_nochange: 'לא נבחר שינוי.',
  field_person_id: 'מזהה',
  field_revision: 'גרסה',
  field_employee_no: 'מספר עובד',
  field_display_name: 'שם',
  field_phone: 'טלפון',
  field_access_category: 'סוג',
  field_responsible_person: 'אחראי',
  field_access_purpose: 'מטרה',
  field_active: 'פעיל',
  field_valid_from: 'מתאריך',
  field_valid_until: 'עד',
  field_doors: 'דלתות',
  field_groups: 'קבוצות',
  field_group_ids: 'קבוצות',
  field_door_permissions: 'דלתות',
  code_formula_like: 'ערך שנראה כנוסחה',
  code_invalid: 'ערך לא תקין',
  code_validity_pair: 'יש למלא גם התחלה וגם סוף',
  code_validity: 'תאריך לא תקין',
  code_required: 'שדה חובה',
  code_duplicate_person: 'האדם מופיע יותר מפעם אחת',
  code_duplicate_employee_no: 'מספר עובד כפול בקובץ',
  code_guest_responsible_required: 'למבקר או לקבלן נדרש אחראי',
  code_invalid_validity: 'למבקר או לקבלן נדרש תאריך סיום',
  code_doors: 'דלתות לא תקינות',
  code_groups: 'קבוצות לא תקינות',
  code_active: 'ערך פעיל לא תקין',
  code_access_category: 'סוג לא מוכר',
  code_person_id: 'מזהה לא תקין',
  code_revision: 'גרסה לא תקינה',
  code_revision_without_person: 'גרסה בלי מזהה',
  code_cell_too_long: 'ערך ארוך מדי',
  code_control_character: 'תו לא חוקי',
  code_too_many_cells: 'יותר מדי עמודות בשורה',
  code_nothing_to_change: 'אין מה לשנות',
  code_unchanged: 'ללא שינוי',
  code_not_found: 'האדם לא נמצא',
  code_scope: 'האדם או העמדה אינם בניהולך',
  code_field_level: 'נדרשת הרשאה לפרטים רגישים',
  code_revision_conflict: 'האדם השתנה מאז הייצוא',
  code_employee_conflict: 'מספר העובד כבר קיים',
  code_projection_restricted: 'הרשאות האדם אינן גלויות במלואן',
  code_unknown_group: 'קבוצה לא מוכרת',
  code_group_stations_unknown: 'עמדות הקבוצה לא ידועות',
  code_plan_changed: 'הנתונים השתנו מאז התצוגה המקדימה',
  code_refused: 'בקרת הכניסה דחתה את השורה',
  code_generic: 'שגיאה',
  v_title: 'אימות מול בקרת הכניסה',
  v_enable: 'הפעלת אימות הקובץ',
  v_btn: 'אימות הקובץ',
  v_running: 'מאמת…',
  v_will_write: '{n} ייכתבו',
  v_line: 'שורה {n} בקובץ',
  v_op_create: 'אדם חדש',
  v_op_update: 'עדכון',
  v_expires: 'בתוקף עד {t}',
  v_confirm_btn: 'אישור וכתיבה',
  v_sent: 'נשלח',
  v_result_running: 'בביצוע…',
  v_result_finished: 'נכתבו {n}',
  v_result_done: 'הושלם',
  v_result_unknown: 'התוצאה לא ידועה. לא נשלח שוב.',
  v_result_cancelled: 'בוטל',
  v_check: 'בדיקת תוצאה',
  v_prev: 'הקודם',
  v_next: 'הבא',
  v_page: '{a} מתוך {b}',
  v_admin_only: 'רק מנהל מערכת יכול לאשר.',
  v_blocker_switch_off: 'האימות כבוי',
  v_blocker_bulk_people_off: 'שינוי מרוכז כבוי',
  v_blocker_binding_not_configured: 'חסרה הגדרת סמכות',
  v_blocker_direct_not_installed: 'אין חיבור ישיר',
  v_blocker_direct_not_selected: 'החיבור הישיר אינו זמין',
  v_none: 'אין שורות לכתיבה',
  v_mode_note: 'רק אנשים חדשים',
};

export type BtKey = keyof typeof he;
export type BtLang = 'he' | 'en' | 'ar' | 'ru';

const en: Record<BtKey, string> = packTable<typeof import('./lang/en/i18n/bulk-people').en>('en', 'i18n/bulk-people', 'en');

const ar: Record<BtKey, string> = packTable<typeof import('./lang/ar/i18n/bulk-people').ar>('ar', 'i18n/bulk-people', 'ar');

const ru: Record<BtKey, string> = packTable<typeof import('./lang/ru/i18n/bulk-people').ru>('ru', 'i18n/bulk-people', 'ru');

const TABLES: Record<BtLang, Record<BtKey, string>> = { he, en, ar, ru };
/** The columns that are an initial, unreviewed translation. */
export const BT_DEV_MARKED: readonly BtLang[] = ['ar', 'ru'];
export const BT_KEYS = Object.keys(he) as BtKey[];
export const BT_TABLES = TABLES;

export function btLang(): BtLang {
  return docLang(['en', 'ar', 'ru']);
}

/** The text of `key` in the document's language, with `{name}` placeholders filled. */
export function bt(key: BtKey, vars?: Record<string, string | number>, lang: BtLang = btLang()): string {
  const raw = TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** A run-time key (`code_<code>`, `field_<name>`, `outcome_<outcome>`), or the fallback when there is none. */
export function btDynamic(key: string, fallback: BtKey, vars?: Record<string, string | number>, lang: BtLang = btLang()): string {
  return key in he ? bt(key as BtKey, vars, lang) : bt(fallback, vars, lang);
}

registerCatalogue('i18n/bulk-people', { he, en, ar, ru }, BT_DEV_MARKED);
