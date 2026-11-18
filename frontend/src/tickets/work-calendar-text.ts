/**
 * SLACAL (2.9.1): the texts of the working-hours calendar card. Hebrew + English, the same shape as overview-text.ts (the module's name is a
 * template: `{ticket}` / `{tickets}` of tickets/naming.ts, never written here).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  card: 'שעות עבודה',
  cardSub: 'מתי נספרים הזמנים של {tickets} תקועות, איחורים ותזכורות',
  enabled: 'ספירה לפי שעות עבודה',
  enabledSub: 'כבוי: הזמנים נספרים ברציפות, בכל שעה ביממה',
  days: 'ימי עבודה',
  hours: 'שעות עבודה',
  hoursSub: 'בשעון המקומי של המערכת',
  to: 'עד',
  holidays: 'ימי חופש וחגים',
  holidaysSub: 'תאריך בכל שורה, למשל 21.10.2026. בימים האלה לא נספר זמן',
  holidaysCount: '{n} ימים',
  note: 'הספירה חלה על זמני תקועה, איחור ותזכורות. שליחת הודעות לספקים ממשיכה לפי שעות השליחה שלהם',
  save: 'שמירה',
  d0: 'שני',
  d1: 'שלישי',
  d2: 'רביעי',
  d3: 'חמישי',
  d4: 'שישי',
  d5: 'שבת',
  d6: 'ראשון',
  err_weekdays: 'יש לבחור לפחות יום עבודה אחד',
  err_time: 'שעה לא תקינה',
  err_order: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה (אין משמרת חוצת חצות)',
  err_holidays_many: 'עד 400 ימי חופש',
  err_bad_dates: 'תאריך לא תקין: {list}',
  err_dept: 'בדקו את שעות העבודה של המחלקות',
  holdInternal: 'תזכורות והתראות מחוץ לשעות העבודה',
  holdInternalSub: 'מופעל: תזכורת פנימית או התראה למנהלים שמגיעה מחוץ לשעות העבודה מחכה לפתיחה הבאה',
  autoClose: 'סגירה אוטומטית של {ticket} שבוצעה',
  autoCloseSub: 'ימים רגילים (כמו עד היום) או זמן עבודה: כל יום הוא אורך יום העבודה',
  ac_calendar: 'ימים רגילים',
  ac_working: 'זמן עבודה',
  linkClock: 'קישור שלא נפתח אצל הספק',
  linkClockSub: 'השעון של הספק: ברירת המחדל סופרת ברציפות ולא לפי שעות העבודה',
  lc_wall: 'ברציפות',
  lc_working: 'שעות עבודה',
  dayHours: 'שעות לכל יום',
  dayHoursSub: 'שנו את השעות של יום מסוים, למשל שישי קצר',
  depts: 'שעות עבודה לפי מחלקה',
  deptsSub: 'כמו ההגדרה הכללית, ברציפות, או שעות משלה',
  dm_inherit: 'כללי',
  dm_always: 'ברציפות',
  dm_own: 'שעות משלה',
  deptMode: 'שעות עבודה של {name}',
};

export type WorkCalendarTextKey = keyof typeof he;

const en: Record<WorkCalendarTextKey, string> = packTable<typeof import('../i18n/lang/en/tickets/work-calendar-text').en>('en', 'tickets/work-calendar-text', 'en');

const catalogue = makeCatalogue<WorkCalendarTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const workCalendarTemplate = catalogue.template;

export const wct = catalogue.t;

export const WORK_CALENDAR_TEXT_KEYS = catalogue.KEYS;
export const WORK_CALENDAR_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/work-calendar-text', { he, en });
