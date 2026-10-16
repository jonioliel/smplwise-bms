/**
 * TKCAL: the words of the weekly calendar of the request list. A catalogue of its own (the list-text.ts / board-text.ts pattern):
 * Hebrew first, the English column falls back to the Hebrew, module-name tokens rendered with the configured name (D33).
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

const he = {
  calGroup: 'יומן שבועי',
  calPrev: 'השבוע הקודם',
  calNext: 'השבוע הבא',
  calPrevDay: 'היום הקודם',
  calNextDay: 'היום הבא',
  calToday: 'היום',
  calTodayJump: 'מעבר להיום',
  calWeekOf: '{from}–{to}',
  calWeekAria: 'שבוע {from} עד {to}',
  calCount: '{n} אירועים בשבוע',
  calCountOne: 'אירוע אחד בשבוע',
  calCountNone: 'אין אירועים בשבוע זה',
  calDayCount: '{n} אירועים',
  calDayEmpty: 'אין אירועים',
  calDayLabel: '{day}, {date}',
  calDaysStrip: 'ימי השבוע',
  calUnscheduled: '{n} {tickets} ללא מועד',
  calUnscheduledOne: '{ticket} {f:אחת|m:אחד} ללא מועד',
  calMore: 'עוד {n}',
  calLoadMore: 'טעינת עוד {tickets} לרשימה',
  calJumpNearest: 'מעבר לשבוע הקרוב עם אירועים',
  calLegend: 'מקרא',
  calSwipeHint: 'החלקה ימינה או שמאלה מחליפה יום',
  // ---- the kinds
  calK_visit: 'ביקור',
  calK_ack: 'יעד אישור קבלה',
  calK_stuck: 'יעד ללא עדכון',
  calK_resolve: 'יעד סיום',
  calOpen: 'פתיחת {the_ticket} {n}',
  // ---- the states
  calEmptyTitle: 'אין ביקורים או יעדים בשבוע הזה',
  calEmptyAll: 'אין ביקורים או יעדים ברשימה הזו',
  calLoadFailed: 'היומן לא נטען',
  calRetry: 'ניסיון חוזר',
  days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  daysShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
};

type Plain = Exclude<keyof typeof he, 'days' | 'daysShort' | 'months'>;
export type CalTextKey = Plain;

const enPlain: Partial<Record<Plain, string>> = {
  calGroup: 'Weekly calendar',
  calPrev: 'Previous week',
  calNext: 'Next week',
  calPrevDay: 'Previous day',
  calNextDay: 'Next day',
  calToday: 'Today',
  calTodayJump: 'Jump to today',
  calWeekOf: '{from} - {to}',
  calWeekAria: 'Week {from} to {to}',
  calCount: '{n} events this week',
  calCountOne: '1 event this week',
  calCountNone: 'No events this week',
  calDayCount: '{n} events',
  calDayEmpty: 'No events',
  calDayLabel: '{day}, {date}',
  calDaysStrip: 'Days of the week',
  calUnscheduled: '{n} {tickets} without a time',
  calUnscheduledOne: '1 {ticket} without a time',
  calMore: '{n} more',
  calLoadMore: 'Load more {tickets} into the list',
  calJumpNearest: 'Go to the nearest week with events',
  calLegend: 'Legend',
  calSwipeHint: 'Swipe sideways to change the day',
  calK_visit: 'Visit',
  calK_ack: 'Acknowledge target',
  calK_stuck: 'No-update target',
  calK_resolve: 'Resolve target',
  calOpen: 'Open {the_ticket} {n}',
  calEmptyTitle: 'No visits or targets this week',
  calEmptyAll: 'No visits or targets in this list',
  calLoadFailed: 'The calendar did not load',
  calRetry: 'Try again',
};
const enNames = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export const CAL_TEXT_KEYS = Object.keys(he).filter((k) => !['days', 'daysShort', 'months'].includes(k)) as CalTextKey[];
export const CAL_TEXT_EN_KEYS = Object.keys(enPlain) as CalTextKey[];

/** The raw template of a key (the unit tests read it). */
export function calTemplate(key: CalTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? enPlain[key] : undefined) ?? (he[key] as string);
}

export function ct(key: CalTextKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(calTemplate(key, lang), lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}

type NameList = 'days' | 'daysShort' | 'months';
/** A weekday / month name (index 0 = Sunday / January). */
export function calName(list: NameList, i: number, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? enNames : he)[list][i] ?? '';
}
