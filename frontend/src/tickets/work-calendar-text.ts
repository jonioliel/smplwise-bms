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
  overrides: '{n} מחלקות עם שעות משלהן (נקבע דרך ה-API)',
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
  overrides: '{n} departments have their own hours (set through the API)',
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
