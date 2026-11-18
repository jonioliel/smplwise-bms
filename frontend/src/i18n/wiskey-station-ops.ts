/**
 * Strings of a station's maintenance (WISKEY-STATION-OPS-2390): the drawer's "טכני" section block (components/wk-station-maintenance.ts)
 * and the list action over several stations (components/wk-stations-maintenance.ts). Hebrew (the product language) and English, chosen
 * like i18n/wiskey-stations.ts. UI_COPY_RULES: never the platform's name; the area is "מערכת האינטרקום"; a code the screen has no
 * words for is shown as a code, never invented.
 */
import { docLang, registerCatalogue } from './core';
import { packTable } from './lang-packs';
const he = {
  title: 'תחזוקה',
  listButton: 'תחזוקה',
  listTitle: 'תחזוקת עמדות',
  refresh: 'רענון נתונים',
  loading: 'טוען את מצב העמדה…',
  unavailable: 'מצב העמדה אינו זמין כרגע.',
  healthHidden: 'פרטי הבריאות של העמדה מוצגים רק למי שמורשה לצפות במצב המערכת.',
  actions: {
    sync: 'סנכרן עכשיו',
    rescan: 'סריקה מחדש',
    health_refresh: 'רענון בריאות',
    clock_refresh: 'בדיקת שעון',
  },
  confirm: {
    sync: { title: 'לסנכרן את העמדה עכשיו?', one: 'אנשים, כרטיסים והרשאות שממתינים יישלחו לעמדה {name}. הסנכרון נכנס לתור ומתבצע ברקע.' },
    rescan: { title: 'לסרוק את העמדה מחדש?', one: 'היכולות ורשימת המשתמשים יקראו מחדש מהעמדה {name}. שום דבר לא נכתב לעמדה.' },
    health_refresh: { title: 'לרענן את בריאות העמדה?', one: 'השעון ונתוני המדיה של העמדה {name} ייקראו מחדש מהמכשיר (עד חצי דקה).' },
    clock_refresh: { title: 'לבדוק את שעון העמדה?', one: 'השעון של העמדה {name} ייקרא מחדש. השעה בעמדה לא משתנה.' },
    many: 'הפעולה תישלח פעם אחת לכל עמדה מתוך {n} העמדות שנבחרו, אחת אחרי השנייה.',
    send: 'שלח',
    cancel: 'ביטול',
  },
  rows: {
    lastSync: 'סנכרון אחרון',
    lastScan: 'קריאה אחרונה מהעמדה',
    stream: 'זרם אירועים',
    clock: 'שעון',
    lastError: 'שגיאה אחרונה',
    auth: 'כשל הזדהות',
    polls: 'כשלי תקשורת רצופים',
  },
  stream: {
    connected: 'מחובר',
    connecting: 'מתחבר',
    disconnected: 'מנותק',
    authentication_failed: 'נכשל בהזדהות',
    unavailable: 'לא זמין',
    stopped: 'עצור',
    unknown: 'לא ידוע',
  },
  clockOk: 'תקין',
  clockSkew: 'סטייה של {n} שניות',
  clockStatus: { ready: 'נמדד', stale: 'מדידה ישנה', unavailable: 'לא נמדד' },
  never: 'אין עדיין',
  none: 'אין',
  authNone: 'לא נראה מאז שהמערכת עלתה',
  authLine: '{source} · שלב: {step} · {at}',
  authObserved: '{source} · נראה ב־{at}',
  authCount: '{n} כשלים ברשומות האחרונות',
  authNow: 'כרגע: {what}',
  authCode: 'קוד מהמכשיר {code}',
  authSources: { sync: 'סנכרון', event_stream: 'זרם האירועים', event_history: 'השלמת היסטוריית אירועים', station_sync: 'סנכרון העמדה' } as Record<string, string>,
  steps: {
    queued: 'בתור',
    identity: 'זיהוי העמדה',
    capabilities: 'קריאת יכולות',
    inventory: 'קריאת משתמשים מהעמדה',
    person_read: 'קריאת אדם',
    reconcile: 'התאמה',
    journal: 'רישום',
    create_person: 'הוספת אדם',
    update_person: 'עדכון אדם',
    delete_person: 'מחיקת אדם',
    create_card: 'הוספת כרטיס',
    update_card: 'עדכון כרטיס',
    delete_card: 'מחיקת כרטיס',
    readback: 'אימות',
    complete: 'סיום',
    other: 'שלב אחר',
  } as Record<string, string>,
  status: {
    sending: 'שולח…',
    sent: 'נשלח, ממתין לתשובה',
    acknowledged: 'התקבל - הסנכרון בתור',
    completed: 'הושלם',
    failed: 'נכשל: {reason}',
    not_sent: 'לא נשלח: {reason}',
    unknown: 'נשלח, אין תשובה ברורה - ייתכן שבוצע',
  },
  lastRun: 'פעם אחרונה: {status} · {at}',
  cooldown: 'אפשר שוב בעוד {n} שניות',
  offlineHint: 'העמדה לא מחוברת - אפשר רק לבקש סנכרון.',
  reasons: {
    authentication_failed: 'העמדה דחתה את פרטי ההתחברות',
    connection_failed: 'אין חיבור לעמדה',
    device_busy: 'העמדה עסוקה',
    device_unavailable: 'העמדה לא זמינה',
    station_offline: 'העמדה לא מחוברת',
    intercom_station_offline: 'העמדה לא מחוברת',
    station_unloaded: 'העמדה לא טעונה במערכת האינטרקום',
    station_not_found: 'העמדה לא נמצאה',
    intercom_station_not_found: 'העמדה לא נמצאה',
    manager_closed: 'מערכת האינטרקום בעצירה',
    unauthorized: 'מערכת האינטרקום לא אישרה את הפעולה',
    forbidden: 'אין הרשאה לתחזוקת העמדה',
    confirmation_required: 'חסר אישור',
    expired: 'הבקשה פגה לפני שנשלחה',
    intercom_duplicate_command: 'הפקודה כבר נשלחה',
    station_ops_cooldown: 'נשלח לפני רגע',
    station_ops_rate_limited: 'יותר מדי פקודות בזמן קצר',
    station_ops_busy: 'פקודות אחרות עדיין רצות',
    intercom_busy: 'מערכת האינטרקום עסוקה',
    intercom_rate_limited: 'הגבלת קצב',
    rate_limited: 'הגבלת קצב',
    busy: 'מערכת האינטרקום עסוקה',
    intercom_unavailable: 'מערכת האינטרקום לא זמינה',
    timeout: 'לא התקבלה תשובה בזמן',
    clock_read_failed: 'קריאת השעון נכשלה',
    operation_unsupported: 'העמדה לא תומכת בפעולה',
    capacity_exhausted: 'העמדה מלאה',
    network: 'אין חיבור לשרת',
  } as Record<string, string>,
  bulk: {
    pickAction: 'פעולה',
    pickStations: 'עמדות',
    all: 'בחר הכל',
    clear: 'נקה',
    selected: '{n} נבחרו',
    offline: 'לא מחוברת',
    next: 'המשך',
    back: 'חזרה',
    close: 'סגור',
    running: 'שולח {i} מתוך {n}…',
    summary: '{ok} הצליחו · {failed} נכשלו · {not_sent} לא נשלחו · {unknown} ללא תשובה',
    noneSelected: 'בחרו לפחות עמדה אחת.',
    offlineSkipped: 'עמדות לא מחוברות לא ייכללו בפעולה הזו.',
  },
};

export type StationOpsText = typeof he;

const en: StationOpsText = packTable<typeof import('./lang/en/i18n/wiskey-station-ops').en>('en', 'i18n/wiskey-station-ops', 'en');

export function sot(): StationOpsText {
  return docLang(['en']) === 'en' ? en : he;
}

export const heStationOpsText: StationOpsText = he;
export const enStationOpsText: StationOpsText = en;

registerCatalogue('i18n/wiskey-station-ops', { he, en });
