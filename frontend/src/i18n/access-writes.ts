/**
 * CR-036 S11: the strings of the person writes on the native people screen (the actions of a person's page, the card and photo
 * dialogs, the timing and category parts of the editor), Hebrew. One flat dictionary with a lookup, like i18n/access-people.ts:
 * an unknown key answers the key itself. No platform name and no internal code reaches a string a person reads (UI_COPY_RULES):
 * the area is "בקרת כניסה", the classic panel "חלון האינטרקום". Operator copy is short: a title, a one-line question, a one-line
 * result - "נשלח" for what is sent and not yet confirmed, never "בוצע" for it.
 *
 * `{name}` placeholders are filled by `wt(key, { name: ... })`.
 */
const he = {
  // ---- the actions of a person's page
  'actions.open': 'פעולות',
  'actions.heading': 'פעולות',
  'act.edit': 'עריכת פרטים',
  'act.deactivate': 'השבתה',
  'act.activate': 'הפעלה',
  'act.archive': 'העברה לארכיון',
  'act.restore': 'שחזור מהארכיון',
  'act.temporary_cancel': 'סיום גישה זמנית',
  'act.cards': 'כרטיסים',
  'act.photo': 'תמונה',
  'act.delete': 'מחיקה',

  // ---- one-line questions (the confirmation step)
  'confirm.deactivate': 'להשבית את הגישה של {name}?',
  'confirm.activate': 'להפעיל את הגישה של {name}?',
  'confirm.archive': 'להעביר את {name} לארכיון? הגישה תושבת.',
  'confirm.restore': 'לשחזר את {name} מהארכיון? האדם יחזור מושבת.',
  'confirm.temporary_cancel': 'לסיים עכשיו את הגישה של {name}?',
  'confirm.delete': 'למחוק את {name}? ההסרה מהעמדות מתוזמנת.',
  'confirm.remove_card': 'להסיר את הכרטיס {mask}?',
  'confirm.remove_photo': 'להסיר את התמונה של {name}?',
  'reason.label': 'סיבה',
  'reason.visit_completed': 'הביקור הסתיים',
  'reason.visit_cancelled': 'הביקור בוטל',
  'reason.access_no_longer_needed': 'הגישה אינה נחוצה עוד',

  // ---- buttons
  'btn.confirm': 'אישור',
  'btn.cancel': 'ביטול',
  'btn.close': 'סגירה',
  'btn.check': 'בדיקה חוזרת',
  'btn.add_card': 'הוספת כרטיס',
  'btn.remove': 'הסרה',
  'btn.read_card': 'קריאה מעמדה',
  'btn.choose_photo': 'בחירת תמונה',
  'btn.save_photo': 'שמירה',
  'btn.remove_photo': 'הסרת התמונה',
  'btn.working': 'שולח…',

  // ---- one-line results
  'res.saved': 'נשמר · {time}',
  'res.pending': 'נשלח · ממתין לאישור',
  'res.deleted': 'האדם הוסר',
  'res.still_pending': 'עדיין לא אושר · אפשר לבדוק שוב',
  'res.unknown': 'לא ידוע אם בוצע · טענו מחדש לפני ניסיון נוסף',
  'res.not_sent': 'לא נשלח · {reason}',
  'res.refused': 'לא בוצע · {reason}',

  // ---- why (by the server's code)
  'err.scope': 'האדם משויך גם לעמדה שאינה בניהולך',
  'err.field': 'נדרשת הרשאה לפרטים רגישים',
  'err.gone': 'האדם לא נמצא',
  'err.revision': 'האדם השתנה בינתיים · טענו מחדש',
  'err.archive_state': 'מצב הארכיון כבר השתנה',
  'err.archived': 'האדם בארכיון · יש לשחזר לפני הפעלה',
  'err.not_temporary': 'רק לאורח או לקבלן',
  'err.already_inactive': 'הגישה כבר מושבתת',
  'err.card_conflict': 'הכרטיס משויך לאדם אחר',
  'err.card_gone': 'הכרטיס כבר אינו משויך',
  'err.card_invalid': 'אותיות לטיניות, ספרות, מקף או קו תחתון (עד 32)',
  'err.approval': 'הפעולה דורשת אישור נוסף בחלון האינטרקום',
  'err.pin_interactive': 'יצירת קוד זמינה רק בדפדפן',
  'err.busy': 'עמוס כרגע · נסו שוב בעוד רגע',
  'err.unavailable': 'בקרת הכניסה אינה זמינה כרגע',
  'err.duplicate': 'הפקודה כבר נשלחה',
  'err.expired': 'הבקשה פגה · נסו שוב',
  'err.forbidden': 'אין הרשאה לפעולה',
  'err.invalid': 'הנתונים אינם תקינים',
  'err.photo_disabled': 'תמונות אינן מופעלות',
  'err.guest': 'לאורח או לקבלן נדרשים אחראי ותאריך סיום',
  'err.generic': 'הפעולה לא בוצעה',

  // ---- the photo
  'photo.processing': 'מכין תמונה…',
  'photo.too_big': 'התמונה גדולה מדי גם אחרי הקטנה',
  'photo.not_image': 'הקובץ אינו תמונה',
  'photo.none': 'אין תמונה',
  'photo.preview': 'תצוגה מקדימה',

  // ---- cards
  'cards.number': 'מספר כרטיס',
  'cards.label': 'תווית',
  'cards.none': 'אין כרטיסים',
  'cards.loading': 'טוען…',
  'cards.disabled': 'מושבת',

  // ---- timing (the editor)
  'timing.heading': 'מועדי כניסה',
  'timing.mode': 'מתי',
  'timing.none': 'תמיד',
  'timing.weekly': 'ימים קבועים בשבוע',
  'timing.dates': 'תאריכים',
  'timing.days': 'ימים',
  'timing.dates_label': 'תאריכים',
  'timing.add_date': 'הוספת תאריך',
  'timing.periods': 'שעות',
  'timing.add_period': 'הוספת שעות',
  'timing.from': 'משעה',
  'timing.to': 'עד שעה',
  'timing.zone': 'אזור זמן',
  'timing.enforce': 'אכיפה',
  'timing.enforce_draft': 'הצעה בלבד',
  'timing.enforce_ha': 'נאכף במערכת',
  'timing.native_locked': 'נאכף בעמדה · נערך בחלון האינטרקום',
  'timing.err.days': 'יש לבחור לפחות יום אחד',
  'timing.err.dates': 'יש לבחור 1-64 תאריכים בין 2000 ל־2037',
  'timing.err.periods': 'יש להגדיר 1-8 טווחי שעות',
  'timing.err.order': 'שעת ההתחלה חייבת להיות לפני שעת הסיום',
  'timing.err.overlap': 'טווחי השעות חופפים',
  'timing.err.zone': 'אזור זמן לא מוכר',
  'day.Sunday': 'ראשון',
  'day.Monday': 'שני',
  'day.Tuesday': 'שלישי',
  'day.Wednesday': 'רביעי',
  'day.Thursday': 'חמישי',
  'day.Friday': 'שישי',
  'day.Saturday': 'שבת',

  // ---- the access category (the editor)
  'cat.label': 'סוג גישה',
  'cat.field': 'קטגוריה',
  'cat.staff': 'עובד',
  'cat.visitor': 'אורח',
  'cat.contractor': 'קבלן',
  'cat.responsible': 'אחראי',
  'cat.purpose': 'מטרת הגישה',
} as const;

export type WritesKey = keyof typeof he;

export function wt(key: WritesKey, vars?: Record<string, string | number>): string {
  const text: string = he[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Every key, for the test that no key is unused or missing (tests/unit-people-writes-logic.spec.ts reads the sources). */
export const WRITES_KEYS = Object.keys(he) as WritesKey[];
