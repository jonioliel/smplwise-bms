/**
 * CR-038 slice 6: the text catalogue of the manager board, its display settings and the notification labels of the `ticket` subject
 * (a catalogue of its own beside tickets/text.ts, so the board slice and the other slices never edit the same lines). The same rules as
 * text.ts (D33): every text that names the module is a template with the tokens of tickets/naming.ts - `{ticket}`, `{tickets}`, and
 * `{f:..|m:..}` for a word that agrees with the name's gender - read through `bt()`; the default name is never written here
 * (tests/unit-tickets-board.spec.ts fails when it is). Variables are `{name}`-style and are filled after the name tokens.
 */
import { tn, type TicketLang } from './naming';
import { ticketsLang } from './text';

const he = {
  tabBoard: 'לוח מנהל',
  kindTicket: '{ticket}',
  openTicket: 'פתיחת {the_ticket}',

  // the state strip (D21)
  stAll: 'הכול',
  stWaiting: '{f:ממתינות|m:ממתינים} לי',
  stStuck: '{f:תקועות|m:תקועים}',
  stUnassigned: 'ללא מטפל',
  stClosedWeek: 'נסגרו השבוע',
  stClosedAll: '{f:סגורות|m:סגורים} (הכול)',
  stateStrip: 'סינון לפי מצב',

  // the sections (13.5)
  grpWaiting: 'ממתין לי',
  grpWaitingSub: 'דורש פעולה שלך',
  grpStuck: '{f:תקועות|m:תקועים}',
  grpStuckSub: 'לפי ספי המחלקה והעדיפות',
  grpHandling: 'בטיפול',
  grpHandlingSub: 'מתקדם כצפוי',
  grpClosed: 'נסגרו לאחרונה',
  showClosed: 'הצגה',
  hideClosed: 'הסתרה',
  banner: '{n} {f:תקועות|m:תקועים}',
  bannerGo: 'למעבר',
  handlingBy: '{n} · {age}',
  noAssigneeGroup: 'ללא מטפל',

  // the floors (D19 / D30)
  floors: 'קומות ואזורים',
  allFloors: 'כל הקומות',
  noPlace: 'ללא מיקום',
  treeHide: 'הסתרת העץ',
  treeShow: 'עץ האזורים',
  filter: 'סינון',
  expand: 'פתיחת {name}',
  collapse: 'סגירת {name}',

  // a card's extra chips
  stuckChip: '{f:תקועה|m:תקוע} · {reason} {dur}',
  autoClose: '{f:תיסגר|m:ייסגר} אוטומטית {when}',
  slaIn: 'יעד בעוד {dur}',
  r_unassigned: 'אין מטפל',
  r_overdue: 'חריגה מזמן הטיפול',
  r_unopened: 'הקישור לא נפתח',
  r_ack: 'לא אושרה קבלה',
  r_stuck: 'ללא עדכון',
  r_waiting: 'ממתין לחלק',
  w_unassigned: 'ללא מטפל',
  w_returned: 'הוחזר',
  w_not_mine: 'לא שלי',
  w_done: 'ממתין לסגירה',
  w_reply: 'תשובה ממתינה',
  w_late_reply: 'תשובה באיחור',
  w_send_failed: 'ההודעה לא נשלחה',
  w_link_expired: 'הקישור פג',
  w_contact_changed: 'איש הקשר השתנה',
  w_user_inactive: 'העובד אינו זמין',
  w_code_locked: 'נעילת קוד',
  durMin: '{n} ד׳',
  durHours: '{h} ש׳ {m} ד׳',
  durDays: '{d} ימ׳ {h} ש׳',

  // states of the screen
  emptyBoard: 'אין {tickets} {f:פתוחות|m:פתוחים} במחלקות שלך',
  emptyState: 'אין {tickets} במצב הזה',
  notManager: 'הלוח פתוח למנהלי מחלקות',
  truncated: 'מוצגות 500 הראשונות',
  refreshing: 'מתעדכן',

  // the timeline rows the monitor writes
  e_stuck: '{f:נתקעה|m:נתקע}: {reason}',
  e_reminder: 'נשלחה תזכורת למטפל ({n})',
  e_manager_alerted: 'המנהלים קיבלו התראה',
  e_auto_closed: '{f:נסגרה|m:נסגר} אוטומטית',
  e_link_expired: 'קישור הטיפול פג',

  // Settings > the module > display (D19-D21) and D28
  setBoardFloors: 'קומות בלוח',
  setBoardFloorsSub: 'שבבים, עץ צד, או שניהם',
  bf_chips: 'שבבים',
  bf_tree: 'עץ צד',
  bf_chips_tree: 'שבבים + עץ',
  setGrouping: 'קיבוץ בלוח',
  setGroupingSub: 'ממתין לי · תקועות · בטיפול',
  g_always: 'תמיד',
  g_no_status_filter: 'בלי סינון מצב',
  g_never: 'אף פעם',
  setClosedStrip: 'פס המצבים',
  setClosedStripSub: 'הפריט האחרון',
  cs_week: 'נסגרו השבוע',
  cs_all: 'כל הסגורות',
  cs_hidden: 'בלי',
  setUrgent: 'דחופות עוקפות שעות שקט',
  setUrgentSub: 'התראה קריטית למנהלים',
};

export type BoardTextKey = keyof typeof he;

const en: Partial<Record<BoardTextKey, string>> = {
  tabBoard: 'Board',
  kindTicket: '{ticket}',
  openTicket: 'Open the {ticket}',
  stAll: 'All',
  stWaiting: 'Waiting for me',
  stStuck: 'Stuck',
  stUnassigned: 'Unassigned',
  stClosedWeek: 'Closed this week',
  stClosedAll: 'Closed (all)',
  stateStrip: 'Filter by state',
  grpWaiting: 'Waiting for me',
  grpWaitingSub: 'Needs your action',
  grpStuck: 'Stuck',
  grpStuckSub: 'By the department and priority thresholds',
  grpHandling: 'In handling',
  grpHandlingSub: 'On track',
  grpClosed: 'Recently closed',
  showClosed: 'Show',
  hideClosed: 'Hide',
  banner: '{n} stuck',
  bannerGo: 'Show',
  handlingBy: '{n} · {age}',
  noAssigneeGroup: 'Unassigned',
  floors: 'Floors and areas',
  allFloors: 'All floors',
  noPlace: 'No place',
  treeHide: 'Hide the tree',
  treeShow: 'Area tree',
  filter: 'Filter',
  expand: 'Expand {name}',
  collapse: 'Collapse {name}',
  stuckChip: 'Stuck · {reason} {dur}',
  autoClose: 'Closes automatically {when}',
  slaIn: 'Due in {dur}',
  r_unassigned: 'no handler',
  r_overdue: 'past the resolve time',
  r_unopened: 'link not opened',
  r_ack: 'not acknowledged',
  r_stuck: 'no update',
  r_waiting: 'waiting for a part',
  w_unassigned: 'Unassigned',
  w_returned: 'Returned',
  w_not_mine: 'Not mine',
  w_done: 'Awaiting close',
  w_reply: 'Reply waiting',
  w_late_reply: 'Late reply',
  w_send_failed: 'Message not sent',
  w_link_expired: 'Link expired',
  w_contact_changed: 'Contact changed',
  w_user_inactive: 'Employee unavailable',
  w_code_locked: 'Code locked',
  durMin: '{n} min',
  durHours: '{h} h {m} min',
  durDays: '{d} d {h} h',
  emptyBoard: 'No open {tickets} in your departments',
  emptyState: 'No {tickets} in this state',
  notManager: 'The board is for department managers',
  truncated: 'Showing the first 500',
  refreshing: 'Updating',
  e_stuck: 'Stuck: {reason}',
  e_reminder: 'Reminder sent to the handler ({n})',
  e_manager_alerted: 'Managers alerted',
  e_auto_closed: 'Closed automatically',
  e_link_expired: 'Handler link expired',
  setBoardFloors: 'Floors on the board',
  setBoardFloorsSub: 'Chips, a side tree, or both',
  bf_chips: 'Chips',
  bf_tree: 'Side tree',
  bf_chips_tree: 'Chips + tree',
  setGrouping: 'Board grouping',
  setGroupingSub: 'Waiting · stuck · in handling',
  g_always: 'Always',
  g_no_status_filter: 'Without a state filter',
  g_never: 'Never',
  setClosedStrip: 'State strip',
  setClosedStripSub: 'The last item',
  cs_week: 'Closed this week',
  cs_all: 'All closed',
  cs_hidden: 'None',
  setUrgent: 'Urgent passes quiet hours',
  setUrgentSub: 'A critical alert to the managers',
};

/** The raw template of a key (the unit tests read it). */
export function boardTemplate(key: BoardTextKey, lang: 'he' | 'en' = ticketsLang()): string {
  return (lang === 'en' ? en[key] : undefined) ?? he[key];
}

/** A text of the board: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export function bt(key: BoardTextKey, vars?: Record<string, string | number>): string {
  const lang = ticketsLang();
  const named = tn(boardTemplate(key, lang), lang as TicketLang);
  return vars ? named.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : named;
}

export const BOARD_TEXT_KEYS = Object.keys(he) as BoardTextKey[];
export const BOARD_TEXT_EN_KEYS = Object.keys(en) as BoardTextKey[];
