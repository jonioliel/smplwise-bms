/**
 * CR-036 S11: the strings of the person writes on the native people screen (the actions of a person's page, the card and photo
 * dialogs, the timing and category parts of the editor), Hebrew and English (the English when `<html lang>` is English, else the
 * Hebrew; I18N-EN-SWITCH-2438). One flat dictionary per language with a lookup, like i18n/access-people.ts:
 * an unknown key answers the key itself. No platform name and no internal code reaches a string a person reads (UI_COPY_RULES):
 * the area is "בקרת כניסה", the classic panel "חלון האינטרקום". Operator copy is short: a title, a one-line question, a one-line
 * result - "נשלח" for what is sent and not yet confirmed, never "בוצע" for it.
 *
 * `{name}` placeholders are filled by `wt(key, { name: ... })`.
 */
import { docLang, fill, registerCatalogue } from './core';
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

const en: Partial<Record<WritesKey, string>> = {
  // ---- the actions of a person's page
  'actions.open': 'Actions',
  'actions.heading': 'Actions',
  'act.edit': 'Edit details',
  'act.deactivate': 'Deactivate',
  'act.activate': 'Activate',
  'act.archive': 'Move to archive',
  'act.restore': 'Restore from archive',
  'act.temporary_cancel': 'End temporary access',
  'act.cards': 'Cards',
  'act.photo': 'Photo',
  'act.delete': 'Delete',

  // ---- one-line questions (the confirmation step)
  'confirm.deactivate': "Deactivate {name}'s access?",
  'confirm.activate': "Activate {name}'s access?",
  'confirm.archive': 'Move {name} to the archive? Their access will be deactivated.',
  'confirm.restore': 'Restore {name} from the archive? The person comes back deactivated.',
  'confirm.temporary_cancel': "End {name}'s access now?",
  'confirm.delete': 'Delete {name}? Removal from the stations is scheduled.',
  'confirm.remove_card': 'Remove the card {mask}?',
  'confirm.remove_photo': "Remove {name}'s photo?",
  'reason.label': 'Reason',
  'reason.visit_completed': 'The visit is over',
  'reason.visit_cancelled': 'The visit was cancelled',
  'reason.access_no_longer_needed': 'Access is no longer needed',

  // ---- buttons
  'btn.confirm': 'Confirm',
  'btn.cancel': 'Cancel',
  'btn.close': 'Close',
  'btn.check': 'Check again',
  'btn.add_card': 'Add a card',
  'btn.remove': 'Remove',
  'btn.read_card': 'Read at a station',
  'btn.choose_photo': 'Choose a photo',
  'btn.save_photo': 'Save',
  'btn.remove_photo': 'Remove the photo',
  'btn.working': 'Sending…',

  // ---- one-line results
  'res.saved': 'Saved · {time}',
  'res.pending': 'Sent · waiting for confirmation',
  'res.deleted': 'The person was removed',
  'res.still_pending': 'Not confirmed yet · you can check again',
  'res.unknown': 'Not known whether it was done · reload before trying again',
  'res.not_sent': 'Not sent · {reason}',
  'res.refused': 'Not done · {reason}',

  // ---- why (by the server's code)
  'err.scope': 'The person is also assigned to a station you do not manage',
  'err.field': 'Needs the sensitive-details permission',
  'err.gone': 'The person was not found',
  'err.revision': 'The person changed in the meantime · reload',
  'err.archive_state': 'The archive state has already changed',
  'err.archived': 'The person is archived · restore them before activating',
  'err.not_temporary': 'For a visitor or contractor only',
  'err.already_inactive': 'The access is already deactivated',
  'err.card_conflict': 'The card is assigned to another person',
  'err.card_gone': 'The card is no longer assigned',
  'err.card_invalid': 'Latin letters, digits, hyphen or underscore (up to 32)',
  'err.approval': 'The action needs a further approval in the intercom window',
  'err.pin_interactive': 'Creating a code is available in the browser only',
  'err.busy': 'Busy right now · try again in a moment',
  'err.unavailable': 'Access control is not available right now',
  'err.duplicate': 'The command was already sent',
  'err.expired': 'The request expired · try again',
  'err.forbidden': 'No permission for this action',
  'err.invalid': 'The data is not valid',
  'err.photo_disabled': 'Photos are not switched on',
  'err.guest': 'A visitor or contractor needs a responsible person and an end date',
  'err.generic': 'The action was not done',

  // ---- the photo
  'photo.processing': 'Preparing the photo…',
  'photo.too_big': 'The photo is too large even after resizing',
  'photo.not_image': 'The file is not an image',
  'photo.none': 'No photo',
  'photo.preview': 'Preview',

  // ---- cards
  'cards.number': 'Card number',
  'cards.label': 'Label',
  'cards.none': 'No cards',
  'cards.loading': 'Loading…',
  'cards.disabled': 'Deactivated',

  // ---- timing (the editor)
  'timing.heading': 'Access times',
  'timing.mode': 'When',
  'timing.none': 'Always',
  'timing.weekly': 'Set days of the week',
  'timing.dates': 'Dates',
  'timing.days': 'Days',
  'timing.dates_label': 'Dates',
  'timing.add_date': 'Add a date',
  'timing.periods': 'Hours',
  'timing.add_period': 'Add hours',
  'timing.from': 'From',
  'timing.to': 'To',
  'timing.zone': 'Time zone',
  'timing.enforce': 'Enforcement',
  'timing.enforce_draft': 'Proposal only',
  'timing.enforce_ha': 'Enforced by the system',
  'timing.native_locked': 'Enforced at the station · edited in the intercom window',
  'timing.err.days': 'Choose at least one day',
  'timing.err.dates': 'Choose 1-64 dates between 2000 and 2037',
  'timing.err.periods': 'Set 1-8 time ranges',
  'timing.err.order': 'The start time must be before the end time',
  'timing.err.overlap': 'The time ranges overlap',
  'timing.err.zone': 'Time zone not recognised',
  'day.Sunday': 'Sunday',
  'day.Monday': 'Monday',
  'day.Tuesday': 'Tuesday',
  'day.Wednesday': 'Wednesday',
  'day.Thursday': 'Thursday',
  'day.Friday': 'Friday',
  'day.Saturday': 'Saturday',

  // ---- the access category (the editor)
  'cat.label': 'Access type',
  'cat.field': 'Category',
  'cat.staff': 'Staff',
  'cat.visitor': 'Visitor',
  'cat.contractor': 'Contractor',
  'cat.responsible': 'Responsible person',
  'cat.purpose': 'Purpose of access',
};

export function wt(key: WritesKey, vars?: Record<string, string | number>): string {
  const text: string = (docLang(['en']) === 'en' ? en[key] : undefined) ?? he[key] ?? key;
  return fill(text, vars);
}

/** Every key, for the test that no key is unused or missing (tests/unit-people-writes-logic.spec.ts reads the sources). */
export const WRITES_KEYS = Object.keys(he) as WritesKey[];

registerCatalogue('i18n/access-writes', { he, en });
