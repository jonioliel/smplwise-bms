/**
 * CR-038 slice 6: the text catalogue of the manager board, its display settings and the notification labels of the `ticket` subject
 * (a catalogue of its own beside tickets/text.ts, so the board slice and the other slices never edit the same lines). The same rules as
 * text.ts (D33): every text that names the module is a template with the tokens of tickets/naming.ts - `{ticket}`, `{tickets}`, and
 * `{f:..|m:..}` for a word that agrees with the name's gender - read through `bt()`; the default name is never written here
 * (tests/unit-tickets-board.spec.ts fails when it is). Variables are `{name}`-style and are filled after the name tokens.
 */
import { registerCatalogue } from '../i18n/core';
import { NAV_BT } from '../i18n/nav-labels'; // CR-NAV-LABELS-2436: the shell's tab label lives there
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { packTable, withEntries } from '../i18n/lang-packs';

const he = {
  tabBoard: NAV_BT.he.tabBoard,
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
  w_question: 'שאלה מהמטפל',
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
  setHandledDays: 'תקופת "טופלו" בכרטיסי המטפלים',
  setHandledDaysSub: 'ברירת המחדל · כל משתמש יכול לבחור אחרת',
  hd_1: 'היום',
  hd_7: '7 ימים',
  hd_30: 'חודש',
  cs_week: 'נסגרו השבוע',
  cs_all: 'כל הסגורות',
  cs_hidden: 'בלי',
  setUrgent: 'דחופות עוקפות שעות שקט',
  setUrgentSub: 'התראה קריטית למנהלים',
};

export type BoardTextKey = keyof typeof he;

const en: Partial<Record<BoardTextKey, string>> = withEntries(packTable<typeof import('../i18n/lang/en/tickets/board-text').en>('en', 'tickets/board-text', 'en'), {
  tabBoard: NAV_BT.en.tabBoard,
});

/** The raw template of a key (the unit tests read it). */
const catalogue = makeCatalogue<BoardTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const boardTemplate = catalogue.template;

/** A text of the board: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export const bt = catalogue.t;

export const BOARD_TEXT_KEYS = catalogue.KEYS;
export const BOARD_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/board-text', { he, en });
