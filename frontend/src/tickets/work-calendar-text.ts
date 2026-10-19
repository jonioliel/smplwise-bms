/**
 * SLACAL (2.9.1): the texts of the working-hours calendar card. Hebrew + English, the same shape as overview-text.ts (the module's name is a
 * template: `{ticket}` / `{tickets}` of tickets/naming.ts, never written here).
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

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

const en: Record<WorkCalendarTextKey, string> = {
  card: 'Working hours',
  cardSub: 'When the timers of stuck and overdue {tickets} and reminders count',
  enabled: 'Count in working hours',
  enabledSub: 'Off: timers run around the clock',
  days: 'Working days',
  hours: 'Working hours',
  hoursSub: "In the system's local time",
  to: 'to',
  holidays: 'Holidays and days off',
  holidaysSub: 'One date per line, e.g. 2026-10-21. No time counts on these days',
  holidaysCount: '{n} days',
  note: 'Applies to stuck, overdue and reminder timers. Messages to vendors still follow their send hours',
  save: 'Save',
  d0: 'Mon',
  d1: 'Tue',
  d2: 'Wed',
  d3: 'Thu',
  d4: 'Fri',
  d5: 'Sat',
  d6: 'Sun',
  err_weekdays: 'Choose at least one working day',
  err_time: 'Invalid time',
  err_order: 'The end must be after the start (no shift across midnight)',
  err_holidays_many: 'At most 400 days off',
  err_bad_dates: 'Invalid date: {list}',
  err_dept: "Check the departments' working hours",
  holdInternal: 'Reminders and alerts outside working hours',
  holdInternalSub: 'On: an internal reminder or manager alert that falls outside working hours waits for the next opening',
  autoClose: 'Automatic close of a finished {ticket}',
  autoCloseSub: 'Calendar days (as before) or working time: each day is the length of the working day',
  ac_calendar: 'Calendar days',
  ac_working: 'Working time',
  linkClock: 'Vendor link not opened',
  linkClockSub: "The vendor's clock: by default it counts around the clock, not working hours",
  lc_wall: 'Around the clock',
  lc_working: 'Working hours',
  dayHours: 'Hours per day',
  dayHoursSub: 'Change the hours of one day, for example a short Friday',
  depts: 'Working hours per department',
  deptsSub: 'Like the general setting, around the clock, or its own hours',
  dm_inherit: 'General',
  dm_always: 'Around the clock',
  dm_own: 'Own hours',
  deptMode: 'Working hours of {name}',
};

export function workCalendarTemplate(key: WorkCalendarTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

export function wct(key: WorkCalendarTextKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(workCalendarTemplate(key, lang), lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}

export const WORK_CALENDAR_TEXT_KEYS = Object.keys(he) as WorkCalendarTextKey[];
export const WORK_CALENDAR_TEXT_EN_KEYS = Object.keys(en) as WorkCalendarTextKey[];
