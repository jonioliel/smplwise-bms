/**
 * TKUI4 (release 2.6.0, the v5 list): the words of the request LIST in its three modes - the page frame (scope and state counts, the filter
 * row), the card (its chips, the avatar pair), the table's sentence column and the manager board (the "today" row, the load meter). A
 * catalogue of its own beside tickets/text.ts (the drawer-text.ts / board-text.ts pattern), so the sibling tasks never edit the same lines.
 *
 * The tickets/text.ts contract (D33): Hebrew first, the English column falls back to the Hebrew, every text that names the module is a
 * template with the tokens of tickets/naming.ts (`{ticket}`, `{tickets}`, `{the_ticket}`, `{f:..|m:..}`) rendered with the configured
 * name, and the `{var}`s are filled after the name tokens. The default name is never written here and the retired word of the old module
 * name is never used (tests/unit-tickets-list.spec.ts reads this file).
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

const he = {
  // ---- the page frame
  lsScopeGroup: 'היקף הרשימה',
  lsStateGroup: 'סינון לפי מצב',
  lsSearchLong: 'חיפוש לפי מספר, כותרת או התקן',
  lsViewsGroup: 'תצוגת הרשימה',
  lsView_cards: 'כרטיסים',
  lsView_table: 'טבלה',
  lsView_board: 'לוח מנהל',

  // ---- the filter row ("סינון" opens it; hidden until asked for)
  lfBtn: 'סינון',
  lfBtnCount: 'סינון · {n}',
  lfGroup: 'סינון {tickets}',
  lfPriority: 'עדיפות',
  lfHandler: 'מטפל',
  lfAnyHandler: 'כולם',
  lfNoHandler: 'ללא מטפל',
  lfStuck: '{f:תקועות|m:תקועים}',
  lfWaiting: '{f:ממתינות|m:ממתינים} לי',
  lfCost: 'עלות לאישור',
  lfClear: 'ניקוי',
  lfShown: 'מוצגות {n} מתוך {m}',
  lfNoMatch: 'אין {tickets} {f:שמתאימות|m:שמתאימים} למסנן',

  // ---- the card
  lcCostMine: 'לאישורך',
  lcStuck: '{f:תקועה|m:תקוע}',
  lcNoHandler: 'ללא מטפל',
  lcWhoVendor: 'גורם חיצוני: {name}',
  lcWhoStaff: 'מטפל: {name}',
  lcWhoOwner: 'אחראי בארגון: {name}',
  lcSentence: 'מצב: {text}',

  // ---- the table
  ltSentence: 'מה קורה',

  // ---- the manager board
  bdTodayGroup: 'מה קורה היום',
  bdToday: 'היום',
  bdVisit: 'ביקור',
  bdSla: 'יעד תגובה',
  bdWaitingMine: '{f:ממתינות|m:ממתינים} לאישורך: {n}',
  bdWaitingMineOne: '{f:ממתינה|m:ממתין} לאישורך: 1',
  bdHandlingBy: '{n} בטיפול · {f:הוותיקה|m:הוותיק} {age}',
  bdLoad: 'עומס',
  bdLoadLabel: 'עומס: {n} {tickets} בטיפול',
  bdClosedRows: 'נסגרו לאחרונה',
  bdOpenRow: 'פתיחת {the_ticket} {n}',
  // ---- the running clock (owner 2026-10-16): open time, frozen as the total handling time once closed
  elLessMinute: 'פחות מדקה',
  elMin: '{m} ד׳',
  elHour: '{h} ש׳',
  elHourMin: '{h} ש׳ {m} ד׳',
  elDayOne: '1 יום',
  elDays: '{d} ימים',
  elOpen: '{f:פתוחה|m:פתוח} {dur}',
  elHandled: '{f:טופלה|m:טופל} תוך {dur}',
  elCancelled: '{f:בוטלה|m:בוטל} אחרי {dur}',
  elOldest: '{f:הוותיקה|m:הוותיק} {f:פתוחה|m:פתוח} {dur}',
  elTitle: 'משך הזמן מפתיחת {the_ticket}',
} as const;

export type ListTextKey = keyof typeof he;

const en: Partial<Record<ListTextKey, string>> = {
  lsScopeGroup: 'List scope',
  lsStateGroup: 'Filter by state',
  lsSearchLong: 'Search by number, title or device',
  lsViewsGroup: 'List view',
  lsView_cards: 'Cards',
  lsView_table: 'Table',
  lsView_board: 'Manager board',
  lfBtn: 'Filter',
  lfBtnCount: 'Filter · {n}',
  lfGroup: 'Filter {tickets}',
  lfPriority: 'Priority',
  lfHandler: 'Handler',
  lfAnyHandler: 'Everyone',
  lfNoHandler: 'No handler',
  lfStuck: 'Stuck',
  lfWaiting: 'Waiting for me',
  lfCost: 'Cost to approve',
  lfClear: 'Clear',
  lfShown: 'Showing {n} of {m}',
  lfNoMatch: 'No {tickets} match the filter',
  lcCostMine: 'To approve',
  lcStuck: 'Stuck',
  lcNoHandler: 'No handler',
  lcWhoVendor: 'Outside handler: {name}',
  lcWhoStaff: 'Handler: {name}',
  lcWhoOwner: 'Owner: {name}',
  lcSentence: 'Status: {text}',
  ltSentence: 'What is happening',
  bdTodayGroup: 'What is happening today',
  bdToday: 'Today',
  bdVisit: 'Visit',
  bdSla: 'Response target',
  bdWaitingMine: 'Waiting for your approval: {n}',
  bdWaitingMineOne: 'Waiting for your approval: 1',
  bdHandlingBy: '{n} in progress · oldest {age}',
  bdLoad: 'Load',
  bdLoadLabel: 'Load: {n} {tickets} in progress',
  bdClosedRows: 'Closed lately',
  bdOpenRow: 'Open {the_ticket} {n}',
  elLessMinute: 'Under a minute',
  elMin: '{m} min',
  elHour: '{h} h',
  elHourMin: '{h} h {m} min',
  elDayOne: '1 day',
  elDays: '{d} days',
  elOpen: 'Open {dur}',
  elHandled: 'Handled in {dur}',
  elCancelled: 'Cancelled after {dur}',
  elOldest: 'Oldest open {dur}',
  elTitle: 'Time since the {ticket} was opened',
};

/** The raw template of a key (the unit tests read it). */
export function listTemplate(key: ListTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

/** A text of the list: the template in the document's language, the module's name rendered (D33), then the `{var}`s. */
export function lt(key: ListTextKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(listTemplate(key, lang), lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}

export const LIST_TEXT_KEYS = Object.keys(he) as ListTextKey[];
export const LIST_TEXT_EN_KEYS = Object.keys(en) as ListTextKey[];
