/**
 * CR-EMERG104: the words of the emergency readiness page (a tab of the maintenance section). Hebrew first; English follows the document
 * language; Arabic and Russian fall back to the Hebrew. Operator screens never name the home platform.
 */
import { docLang, fill, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  tab: 'מוכנות לחירום',
  title: 'מוכנות לחירום',
  sub: 'האם הבניין מוכן לאירוע חירום עכשיו',
  verdict_ready: 'מוכן',
  verdict_ready_with_gaps: 'מוכן עם פערים',
  verdict_not_ready: 'לא מוכן',
  checkedAt: 'נבדק ב־{t}',
  print: 'הדפסה',
  critical: 'קריטי',
  kpiAll: 'הכול',
  kpiRed: 'לא תקין',
  kpiAmber: 'דורש תשומת לב',
  kpiUnknown: 'לא ידוע',
  kpiNa: 'לא רלוונטי',
  filterLabel: 'סינון לפי מצב',
  st_green: 'תקין',
  st_amber: 'תשומת לב',
  st_red: 'לא תקין',
  st_unknown: 'לא ידוע',
  st_not_applicable: 'לא רלוונטי',
  st_hidden: 'מוסתר',
  grp_power: 'חשמל',
  grp_fire: 'בטיחות אש וביקורות',
  grp_elevators: 'מעליות',
  grp_doors: 'דלתות',
  grp_people: 'אנשים',
  grp_records: 'מסירה ורשומות',
  grp_cameras: 'מצלמות והקלטה',
  fix: 'לטיפול',
  age: 'גיל הנתון: {n}',
  ageMin: '{n} דק׳',
  ageHour: '{n} שע׳',
  ageDay: '{n} ימים',
  naBy: 'אושר ע״י {by} ב־{at}',
  empty: 'אין פריטים במצב הזה',
  offTitle: 'המודול כבוי',
  offBody: 'מוכנות לחירום מופעלת בהגדרות המערכת.',
  forbiddenTitle: 'המסך הזה אינו זמין לך',
  errTitle: 'לא ניתן לטעון את המוכנות לחירום',
  errHint: 'משהו השתבש. נסו שוב.',
  retry: 'ניסיון חוזר',
  loading: 'טוען',
  hidden: 'פריטים שאין לך הרשאה לראות: {n}',
  printNote: 'הדף משקף נתונים שנאספו במערכת, אינו אישור ציות רגולטורי.',
  signed: 'נבדק ע״י ____________',
  banner_fire_service: 'פיקוד כבאים פעיל - אירוע בעיצומו',
  banner_door_incident: 'אירוע חירום פתוח בדלתות',
  banner_on_load: 'הגנרטור נושא את העומס כרגע',
  banner_no_mains: 'אין חשמל מהרשת והגנרטור אינו נושא את העומס',
  setModule: 'מוכנות לחירום',
  viewList: 'רשימת בדיקה',
  viewContacts: 'אנשי קשר לחירום',
  viewSettings: 'הגדרות',
  viewHistory: 'היסטוריה',
  hRange: 'טווח', hDays: '{n} ימים', hEmpty: 'אין עדיין נקודות היסטוריה בטווח הזה', hSummary: '{n} נקודות · הגרוע בכל תקופה', hNow: 'עכשיו', hFirst: 'ראשון',
  cName: 'שם', cRole: 'תפקיד', cPhone: 'טלפון', cEmail: 'דוא״ל', cPriority: 'סדר', cVerified: 'נבדק', cNever: 'לא נבדק',
  cAdd: 'הוספת איש קשר', cSave: 'שמירה', cCancel: 'ביטול', cVerify: 'אימות קשר', cDelete: 'מחיקה', cEdit: 'עריכה', cInactive: 'לא פעיל',
  cDeleteConfirm: 'המחיקה מוחקת גם את הפרטים האישיים. להמשיך?',
  cEmpty: 'אין אנשי קשר עדיין',
  cCountOnly: 'ברשימה {n} אנשי קשר. הפרטים גלויים למנהלים בלבד.',
  cPrivacy: 'פרטי הקשר נשמרים רק לצורך חירום ונראים למנהלים בלבד.',
  cRoute: 'נדרש טלפון או דוא״ל',
  sSlots: 'קישור משימות מהפנקס',
  sBind: 'קישור', sUnbind: 'ניתוק', sPick: 'בחירת משימה', sNoSuggest: 'אין משימה מתאימה בפנקס', sNoneBound: 'לא נקשרה משימה',
  slot_fire_certificate: 'תעודת בטיחות אש', slot_extinguishers: 'מטפים', slot_hydrants_sprinklers: 'ברזים וממטרות', slot_emergency_lighting: 'תאורת חירום',
  slot_evacuation_round: 'סבב פינוי', slot_elevator_inspection: 'בדיקת מעליות',
  sThresholds: 'ספים', sReset: 'ברירת מחדל', sDefault: 'ברירת מחדל: {v}',
  sCameras: 'מצלמות חירום', sCamerasHint: 'מצלמה מסומנת שמנותקת הופכת את בדיקת המצלמות לקריטית ואדומה.',
  sNa: 'לא רלוונטי למבנה', sNaNote: 'הערה (למשל: אין גנרטור במבנה)', sNaSet: 'סימון', sNaClear: 'ביטול סימון',
  sSaved: 'נשמר', sConflict: 'ההגדרות שונו בינתיים, נטענו מחדש', sHistory: 'היסטוריית המוכנות נשמרת {n} ימים',
  files: 'קבצי אישור',
  setModuleHint: 'לשונית תצוגה בלבד בתחזוקה ובקרה, מחושבת מנתונים קיימים. כבויה כברירת מחדל ודורשת את מודול התחזוקה.',
} as const;

const en: Record<keyof typeof he, string> = packTable<typeof import('./lang/en/i18n/emergency').en>('en', 'i18n/emergency', 'en');

export type EmKey = keyof typeof he;
export const EM_KEYS = Object.keys(he) as EmKey[];
export const EM_TABLES = { he, en } as const;

export function emLang(): 'he' | 'en' {
  return docLang(['en']);
}

export function em(key: EmKey, vars?: Record<string, string | number>, lang: 'he' | 'en' = emLang()): string {
  const raw: string = EM_TABLES[lang][key] ?? he[key] ?? key;
  return fill(raw, vars);
}

/** Item titles are Hebrew from the server; English titles by id (the page and the print follow the document language). */
export const EN_TITLES: Record<string, string> = packTable<typeof import('./lang/en/i18n/emergency').EN_TITLES>('en', 'i18n/emergency', 'EN_TITLES');

/** English sentence for an item `code` (the server sends Hebrew in `summary`); the Hebrew page shows `summary` as is. */
export const EN_SUMMARY: Record<string, string> = packTable<typeof import('./lang/en/i18n/emergency').EN_SUMMARY>('en', 'i18n/emergency', 'EN_SUMMARY');

/** Labels of the editable thresholds (key = backend `THRESHOLDS`). */
export const TH_LABEL: Record<string, { he: string; en: string; unit: string }> = {
  generator_test_green_days: { he: 'בדיקת גנרטור: תקין עד', en: 'Generator test: OK up to', unit: 'd' },
  generator_test_amber_days: { he: 'בדיקת גנרטור: תשומת לב עד', en: 'Generator test: attention up to', unit: 'd' },
  fuel_green_pct: { he: 'דלק: תקין מ־', en: 'Fuel: OK from', unit: '%' },
  fuel_amber_pct: { he: 'דלק: תשומת לב מ־', en: 'Fuel: attention from', unit: '%' },
  battery_min_v: { he: 'מתח מצבר מינימלי', en: 'Minimum battery voltage', unit: 'V' },
  backup_green_days: { he: 'גיבוי: תקין עד', en: 'Backup: OK up to', unit: 'd' },
  backup_amber_days: { he: 'גיבוי: תשומת לב עד', en: 'Backup: attention up to', unit: 'd' },
  drill_green_days: { he: 'תרגיל שחזור: תקין עד', en: 'Restore drill: OK up to', unit: 'd' },
  offbox_green_days: { he: 'יעד גיבוי חיצוני נבדק עד', en: 'Off-box target tested within', unit: 'd' },
  door_drill_green_days: { he: 'תרגיל חירום בדלתות עד', en: 'Door emergency drill within', unit: 'd' },
  delivery_fail_amber_pct: { he: 'כשלי מסירה: תשומת לב מ־', en: 'Delivery failures: attention from', unit: '%' },
  delivery_fail_red_pct: { he: 'כשלי מסירה: אדום מעל', en: 'Delivery failures: red above', unit: '%' },
  backlog_green_min: { he: 'תור הודעות: תקין עד', en: 'Message backlog: OK up to', unit: 'min' },
  backlog_red_min: { he: 'תור הודעות: אדום מעל', en: 'Message backlog: red above', unit: 'min' },
  cameras_green_pct: { he: 'מצלמות מחוברות: תקין מ־', en: 'Cameras online: OK from', unit: '%' },
  cameras_amber_pct: { he: 'מצלמות מחוברות: תשומת לב מ־', en: 'Cameras online: attention from', unit: '%' },
  contact_verify_days: { he: 'אימות איש קשר תקף', en: 'Contact verification valid for', unit: 'd' },
  contacts_min: { he: 'מינימום אנשי קשר', en: 'Minimum contacts', unit: '' },
  recorder_stale_s: { he: 'קריאת מקליט ישנה אחרי', en: 'Recorder reading stale after', unit: 's' },
  history_keep_days: { he: 'שמירת היסטוריה', en: 'History kept', unit: 'd' },
};

registerCatalogue('i18n/emergency', { he, en });
