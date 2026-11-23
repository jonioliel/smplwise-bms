/**
 * CR-038 slice 6b (D24): the text catalogue of the board TABLE (the tickets/text.ts pattern and contract: Hebrew first, the English
 * column falls back to the Hebrew, every text naming the module is a template with the tokens of tickets/naming.ts - `{ticket}`,
 * `{tickets}`, `{f:..|m:..}` - rendered with the configured name by `tbt()`; variables are `{name}`-style and filled after the
 * name tokens). A separate file so slice 6b never edits slice 1's catalogue; tests/unit-tickets-table.spec.ts checks completeness
 * and the D33 lint covers it (it lives in src/tickets/).
 */
import { makeCatalogue } from './catalogue'; // CR-TK-CATALOGUE-2440: the shared template / text / key-list lines
import { registerCatalogue } from '../i18n/core';
import { packTable } from '../i18n/lang-packs';

const he = {
  // the view switch (D24: cards / table / kanban, remembered per user)
  viewsGroup: 'תצוגה',
  view_cards: 'כרטיסים',
  view_table: 'טבלה',
  view_kanban: 'קנבן',

  // columns (13.6)
  col_number: 'מס׳',
  col_title: 'כותרת',
  col_department: 'מחלקה',
  col_priority: 'עדיפות',
  col_status: 'מצב',
  col_assignee: 'מטפל',
  col_place: 'מיקום',
  col_device: 'התקן',
  col_created: 'פתוחה',
  col_activity: 'עדכון אחרון',
  col_stuck: 'תקיעה',
  col_sla: 'יעד',

  // the toolbar
  columns: 'עמודות',
  columnsReset: 'איפוס',
  columnsFitted: 'חלק מהעמודות הוסתרו כדי שהטבלה תתאים לרוחב המסך. סמנו עמודה כדי להציג אותה.',
  moveUp: 'הזזה למעלה: {col}',
  moveDown: 'הזזה למטה: {col}',
  density: 'צפיפות',
  density_comfortable: 'רגיל',
  density_compact: 'צפוף',
  savedViews: 'מסננים שמורים',
  saveCurrent: 'שמירת התצוגה הנוכחית',
  viewName: 'שם התצוגה',
  save: 'שמירה',
  cancel: 'ביטול',
  makeDefault: 'קביעה כברירת מחדל: {name}',
  unsetDefault: 'ביטול ברירת המחדל: {name}',
  deleteView: 'מחיקה: {name}',
  deleteConfirm: 'למחוק את {name}?',
  noViews: 'אין מסננים שמורים',
  viewsFull: 'נשמרו 20 תצוגות',
  viewSaved: 'התצוגה נשמרה',
  viewNameTaken: 'כבר יש תצוגה בשם הזה',
  filters: 'סינון',
  filtersCount: 'סינון · {n}',
  fPriority: 'עדיפות',
  fAssignee: 'מטפל',
  fAssigneeAny: 'כולם',
  fAssigneeNone: 'ללא מטפל',
  fAssigneeMe: 'אצלי',
  fWaiting: 'ממתין למנהל',
  fStuck: '{f:תקועות|m:תקועים}',
  fCreatedFrom: 'נפתח מ־',
  fCreatedTo: 'עד',
  fClear: 'ניקוי הסינון',
  csv: 'CSV',
  exportTitle: 'ייצוא לקובץ CSV',
  exported: 'הקובץ ירד · {n} שורות',
  exportTooLarge: 'יותר מ־5,000 שורות. צמצמו את הסינון',
  exportRate: 'אפשר לייצא פעם בדקה',
  monthly: 'דוח חודשי',
  monthlyTitle: 'ספירה חודשית לפי מחלקה או ספק (CSV)',
  monthlyFrom: 'מתאריך',
  monthlyTo: 'עד תאריך',
  monthlyByDepartment: 'לפי מחלקה',
  monthlyByVendor: 'לפי ספק',
  monthlyDownload: 'הורדה',
  monthlyRequired: 'יש לבחור תאריך התחלה ותאריך סיום',
  monthlyOrder: 'תאריך הסיום לפני תאריך ההתחלה',
  monthlyTooLong: 'הטווח ארוך משנה',
  monthlyDone: 'הדוח ירד · {n} שורות',
  count: '{n} {tickets}',
  countOne: '{ticket} {f:אחת|m:אחד}',
  countMore: '{n}+ {tickets}',
  keyboardHelp: 'חצים למעלה ולמטה עוברים בין השורות, Enter פותח, רווח בוחר, Ctrl+A בוחר את העמוד, Esc מבטל את הבחירה',

  // the table
  tableLabel: 'טבלת {the_tickets}',
  selectRow: 'בחירת {ticket} {n}',
  selectPage: 'בחירת כל העמוד',
  sortBy: 'מיון לפי {col}',
  loadMore: 'טעינת עוד',
  unassigned: 'ללא מטפל',
  statusMenu: 'שינוי מצב · {status}',
  assigneeMenu: 'שינוי מטפל · {name}',
  noMoves: 'אין מעברים זמינים',
  noAssignees: 'אין במחלקה מי שאפשר לשייך',
  moveTitle: 'מעבר ל{status}',
  moveReason: 'סיבה',
  confirm: 'אישור',
  required: 'חובה',
  changed: 'נשמר',
  staleReloaded: '{the_ticket} {f:השתנתה|m:השתנה} בינתיים ונטענ{f:ה|m:} מחדש',
  failed: 'הפעולה לא בוצעה',
  empty: 'אין {tickets} להצגה',
  emptyFiltered: 'לא נמצאו {tickets}',
  loadFailed: 'לא ניתן לטעון את {the_tickets}',
  retry: 'נסו שוב',
  compactList: 'רשימת {the_tickets}',

  // relative times of the age and SLA columns
  t_now: 'עכשיו',
  t_min: '{n} דק׳',
  t_hours: '{n} ש׳',
  t_days: '{n} ימים',
  t_day: 'יום',
  sla_in: 'בעוד {t}',
  sla_over: 'חריגה {t}',
  stuck_unassigned: 'ללא מטפל',
  stuck_unopened: 'הקישור לא נפתח',
  stuck_ack: 'לא אושרה קבלה',
  stuck_stuck: 'אין עדכון',
  stuck_waiting: 'ממתין לחלק',
  stuck_overdue: 'חריגה מהיעד',
  stuckSince: '{kind} · {t}',

  // bulk actions (13.6)
  selected: '{n} {f:נבחרו|m:נבחרו}',
  selectedOff: '{n} {f:מהן|m:מהם} בעמודים אחרים',
  selectAllLoaded: 'בחירת כל {n} {the_tickets}',
  clearSelection: 'ביטול הבחירה',
  bulkAssign: 'שיוך',
  bulkRemind: 'תזכורת',
  bulkPriority: 'עדיפות',
  bulkClose: 'סגירה',
  bulkActions: 'פעולות על הנבחרים',
  bulkAssignTitle: 'שיוך {n} {tickets}',
  bulkRemindTitle: 'תזכורת למטפלים',
  bulkRemindText: 'תישלח תזכורת למטפל של כל {ticket} {f:שנבחרה|m:שנבחר} ({n})',
  bulkPriorityTitle: 'עדיפות ל־{n} {tickets}',
  bulkCloseTitle: 'סגירת {n} {tickets}',
  bulkCloseNote: 'סיבת הסגירה',
  bulkGo: 'ביצוע',
  bulkDone: 'בוצע ב־{done} מתוך {total}',
  r_ok: 'בוצע',
  r_unchanged: 'ללא שינוי',
  r_stale: 'השתנו בינתיים',
  r_forbidden: 'אין הרשאה',
  r_invalid_transition: 'לא במצב שמאפשר',
  r_not_found: 'לא {f:נמצאו|m:נמצאו}',
  r_cost_claim_approved: 'עם עלות מאושרת (נדרשת הרשאת עלויות)', // owner 14.10: bulk deletion's cost guard
  r_assignee_not_allowed: 'המטפל לא שייך למחלקה',
  r_unavailable: 'לא זמין עדיין',
  r_too_soon: 'כבר נשלחה תזכורת בשעה האחרונה',
  r_invalid: 'ערך לא תקין',
  prio_urgent: 'דחופה',
  prio_high: 'גבוהה',
  prio_normal: 'רגילה',
  prio_low: 'נמוכה',
} as const;

export type TableTextKey = keyof typeof he;

const en: Partial<Record<TableTextKey, string>> = packTable<typeof import('../i18n/lang/en/tickets/table-text').en>('en', 'tickets/table-text', 'en');

const catalogue = makeCatalogue<TableTextKey>(he, en);

/** The raw template of a key in a language; English falls back to Hebrew (the unit tests and the completeness spec read it). */
export const tableTemplate = catalogue.template;

/** A text of the table: the template in the document's language, the module's name rendered (D33), then `{var}`s. */
export const tbt = catalogue.t;

export const TABLE_TEXT_KEYS = catalogue.KEYS;
export const TABLE_TEXT_EN_KEYS = catalogue.EN_KEYS;

registerCatalogue('tickets/table-text', { he, en });
