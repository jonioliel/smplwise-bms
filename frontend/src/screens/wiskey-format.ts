/**
 * Ported from the owner's WisKey frontend (home-assistant-hikvision-intercom, frontend/src): the zone-aware time
 * formatting of `time.ts` (`offsetAt`, `offsetLabel`, `formatTime`, and the zone-aware `datetime-local` conversion
 * `localInput` / `fromLocalInput` / `resolveLocalInput` the activity filters use) and the Hebrew strings of `i18n.ts`
 * that the entry center, the activity log and the people directory use. Kept verbatim in behaviour so SMPLWISE shows a WisKey instant exactly
 * as WisKey does - in the station's own clock zone (a device DST rule included), never with a fixed offset.
 */
import { uiLocale } from '../i18n/locale';
import type { DisplayZone } from '../api/intercom';
import type { AcGroup, AcStationLite } from '../api/access-people';
import type { StateKind } from '../components/sw-badge';
import { tr } from '../i18n/msg/wiskey';

export const UTC_ZONE: DisplayZone = { kind: 'iana', name: 'UTC' };
const formatters = new Map<string, Intl.DateTimeFormat>();

function transition(year: number, rule: number[], offset: number) {
  const [month, week, weekday, second] = rule;
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let day = 1 + ((weekday - first + 7) % 7) + (week - 1) * 7;
  if (day > count) day -= 7;
  return Date.UTC(year, month - 1, day) + (second - offset) * 1000;
}

/** Seconds east of UTC in `zone` at the instant `ms` (WisKey time.ts `offsetAt`). */
export function offsetAt(ms: number, zone: DisplayZone): number {
  if (zone.kind === 'iana') {
    let formatter = formatters.get(zone.name);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone.name, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      formatters.set(zone.name, formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return (Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - Math.floor(ms / 1000) * 1000) / 1000;
  }
  if (zone.delta && zone.start && zone.end) {
    const y = new Date(ms).getUTCFullYear();
    for (let year = y - 1; year <= y + 1; year++) {
      const start = transition(year, zone.start, zone.standard);
      let end = transition(year, zone.end, zone.standard + zone.delta);
      if (end <= start) end = transition(year + 1, zone.end, zone.standard + zone.delta);
      if (ms >= start && ms < end) return zone.standard + zone.delta;
    }
  }
  return zone.standard;
}

export function offsetLabel(offset: number) {
  const seconds = Math.abs(offset);
  return `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}${seconds % 60 ? ':' + String(seconds % 60).padStart(2, '0') : ''}`;
}

/** AUDIT30-H (finding 15, owner Q10 = א): an operator view reads an instant in the installation's (or station's) zone WITHOUT the
 * `UTC+03:00` label - the offset is a technical detail and stays in `formatTime` (the event's technical details, installer and
 * system screens). The same zone arithmetic as `formatTime`; '—' for anything without an explicit offset. */
export function formatLocalTime(value: string | null | undefined, locale = uiLocale(), zone: DisplayZone = UTC_ZONE) {
  if (!value || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  try {
    return new Date(ms + offsetAt(ms, zone) * 1000).toLocaleString(locale, { timeZone: 'UTC' });
  } catch {
    return new Date(ms).toLocaleString(locale);
  }
}

/** An ISO instant (with an explicit offset) as local time in `zone` plus its UTC offset; '—' for anything else. */
export function formatTime(value: string | null | undefined, locale = uiLocale(), zone: DisplayZone = UTC_ZONE) {
  if (!value || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  try {
    const offset = offsetAt(ms, zone);
    return new Date(ms + offset * 1000).toLocaleString(locale, { timeZone: 'UTC' }) + ' · ' + offsetLabel(offset);
  } catch {
    return new Date(ms).toISOString() + ' · UTC';
  }
}

/** An instant as a `datetime-local` value (YYYY-MM-DDTHH:MM) in `zone` (WisKey time.ts `localInput`). */
export function localInput(value: string | null | undefined, zone: DisplayZone = UTC_ZONE): string {
  if (!value) return '';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + offsetAt(ms, zone) * 1000).toISOString().slice(0, 16);
}

/** A `datetime-local` value typed in `zone` as an absolute ISO instant (WisKey time.ts `fromLocalInput`). Throws
 * `clock_invalid_local`, `clock_ambiguous` (a wall time repeated at the end of DST) or `clock_nonexistent` (skipped at
 * its start) - the i18n keys of the message to show; nothing is guessed. */
export function fromLocalInput(value: string, zone: DisplayZone = UTC_ZONE): string | null {
  if (!value) return null;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value)) throw new Error('clock_invalid_local');
  const naive = Date.parse(value + ':00Z');
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) throw new Error('clock_invalid_local');
  const offsets = new Set([-172800, -86400, 0, 86400, 172800].map((delta) => offsetAt(naive + delta * 1000, zone)));
  const candidates = [...offsets].map((offset) => new Date(naive - offset * 1000).toISOString()).filter((candidate) => localInput(candidate, zone) === value);
  if (candidates.length !== 1) throw new Error(candidates.length ? 'clock_ambiguous' : 'clock_nonexistent');
  return candidates[0];
}

/** Keep a known instant (including a DST fold) when its displayed input is unchanged (WisKey `resolveLocalInput`). */
export function resolveLocalInput(value: string, zone: DisplayZone, known?: unknown): string | null {
  if (typeof known === 'string' && localInput(known, zone) === value) return known;
  return fromLocalInput(value, zone);
}

/** WisKey's Hebrew strings for the entry center, the activity log and the people directory (i18n.ts `he`), keyed as in
 * WisKey. */
const HE: Record<string, string> = {
  wk4_entry_center: tr('מרכז הכניסה'),
  wk4_entry_intro: tr('דלתות, אנשים ופעולות שדורשות תשומת לב'),
  wk4_door_filter: tr('סינון דלתות'),
  wk4_filter_all: tr('כל הדלתות'),
  wk4_filter_online: tr('מחוברות'),
  wk4_filter_attention: tr('דורשות טיפול'),
  online_stations: tr('תחנות מחוברות'),
  ringing_now: tr('מצלצלים כעת'),
  pending_sync: tr('ממתינים לסנכרון'),
  wall_search: tr('חיפוש כניסות'),
  wall_previous: tr('הקודם'),
  wall_next: tr('הבא'),
  devices: tr('אינטרקומים'),
  access_attention: tr('דורש תשומת לב'),
  access_by_permissions: tr('גישה לפי הרשאות'),
  lock_enabled: tr('דלת מנוהלת'),
  camera_only: tr('מצלמה בלבד'),
  unknown_person: tr('משתמש לא מזוהה'),
  identity_unavailable: tr('ברשומה זו אין זהות משתמש זמינה. אין שיוך לפי הקוד או שעת האירוע.'),
  receipt_time: tr('זמן קבלה'),
  historical_record: tr('רשומה היסטורית'),
  last_seen: tr('קשר מוצלח אחרון'),
  not_observed: tr('טרם נצפה מאז הטעינה'),
  managed_users: tr('משתמשים מנוהלים בציוד'),
  no_events: tr('אין אירועים תואמים'),
  no_stations: tr('הוסף אינטרקום ראשון בהגדרות תשתית המערכת.'),
  // call states (coordinator `normalized`)
  online: tr('מחובר'),
  offline: tr('מנותק'),
  ringing: tr('מצלצל'),
  in_call: tr('תפוס / בשיחה'),
  ending: tr('סיום'),
  idle: tr('ממתין'),
  unknown: tr('לא ידוע'),
  unavailable: tr('לא זמין'),
  // sync states (access/models.py SYNC_STATES)
  pending: tr('ממתין'),
  syncing: tr('מסנכרן'),
  synced: tr('מסונכרן'),
  conflict: tr('התנגשות'),
  error: tr('שגיאה'),
  delete_pending: tr('ממתין להסרה'),
  // event types and authentication (events.py)
  access_granted: tr('אימות אושר'),
  access_denied: tr('אימות נדחה'),
  attempt_limit: tr('הגעה למגבלת ניסיונות PIN'),
  unlock_record: tr('דיווח פתיחה מהמכשיר'),
  door_unlocked: tr('המכשיר מדווח שהמנעול שוחרר'),
  door_locked: tr('המכשיר מדווח שהמנעול נעול'),
  contact_open: tr('המגע מדווח פתוח'),
  contact_closed: tr('המגע מדווח סגור'),
  unlock_exception: tr('תקלה בפתיחה'),
  door_not_opened: tr('התראת דלת שלא נפתחה'),
  door_not_closed: tr('התראת דלת שלא נסגרה'),
  ring: tr('צלצול בפעמון'),
  sync: tr('סנכרון'),
  card: tr('כרטיס'),
  pin: tr('קוד PIN'),
  granted: tr('אושר'),
  denied: tr('נדחה'),
  // activity log (events.ts)
  wk4_nav_events: tr('פעילות'),
  events_intro: tr('איתור פעילות גישה לפי אדם, תחנה וזמן.'),
  refresh: tr('רענון'),
  event_filters: tr('סינון אירועים'),
  event_filters_active: tr('מסננים שהוחלו'),
  event_filters_all: tr('כל האירועים'),
  event_investigation_quick: tr('חקירה מהירה'),
  event_quick_denied: tr('כניסות שנדחו'),
  station: tr('תחנה'),
  person: tr('אדם / מזהה עובד'),
  result: tr('תוצאה'),
  authentication: tr('אמצעי זיהוי'),
  door: tr('דלת'),
  all: tr('הכול'),
  from_time: tr('מתאריך'),
  until_time: tr('עד תאריך'),
  filter: tr('סינון'),
  clear_user_filters: tr('ניקוי חיפוש ומסננים'),
  filters_not_applied: tr('המסננים נערכו. יש להחיל אותם לעדכון התוצאות.'),
  clock_filter_basis: tr('תאריכי הסינון לפי אזור זה'),
  loaded_records: tr('רשומות שנטענו'),
  loading: tr('טוען…'),
  load_more: tr('טען עוד'),
  report_date: tr('תאריך'),
  event_detail: tr('פירוט האירוע'),
  event_type: tr('סוג אירוע'),
  employee_no: tr('מספר עובד'),
  removed_station: tr('תחנה שהוסרה'),
  history_incomplete: tr('שחזור ההיסטוריה אינו מלא. ייתכן שחסרות רשומות.'),
  audit_save_failed: tr('לא ניתן לשמור היסטוריה. הרשומות החדשות נמצאות כרגע בזיכרון בלבד.'),
  events_load_failed: tr('רענון האירועים לא הושלם. ייתכן שהרשומות שהוצגו קודם אינן מעודכנות; ניתן לרענן לאחר חידוש החיבור.'),
  clock_invalid_local: tr('הזינו תאריך ושעה מקומיים תקינים.'),
  clock_ambiguous: tr('השעה המקומית מופיעה פעמיים בסיום שעון הקיץ. בחרו שעה חד־משמעית.'),
  clock_nonexistent: tr('השעה המקומית אינה קיימת בתחילת שעון הקיץ. בחרו שעה לפני שינוי השעון או אחריו.'),
  filter_start_before_end: tr('תאריך ההתחלה חייב להיות לפני תאריך הסיום.'),
  filter_zone_changed_invalid: tr('אזור הזמן של הסינון השתנה והזמן בטיוטה אינו חד־משמעי או תקין. יש להזין מחדש את טווח התאריכים.'),
  // people directory (panel.ts usersView, user-details.ts)
  wk4_nav_users: tr('אנשים'),
  users: tr('משתמשים'),
  user_filter_controls: tr('סינון ומיון'),
  user_filter_station: tr('סינון לפי תחנה'),
  user_filter_rights: tr('סינון לפי הרשאה'),
  user_filter_state: tr('סינון לפי מצב משתמש'),
  user_sort: tr('מיון משתמשים'),
  filter_any: tr('הכול'),
  filter_assigned: tr('הרשאה פעילה'),
  filter_unassigned: tr('ללא שיוך'),
  filter_disabled: tr('שיוך כבוי'),
  filter_active: tr('משתמשים פעילים'),
  filter_inactive: tr('משתמשים מושבתים'),
  filter_expired: tr('תוקף שהסתיים'),
  filter_upcoming: tr('תוקף שטרם התחיל'),
  sort_name: tr('שם בסדר עולה'),
  sort_name_desc: tr('שם בסדר יורד'),
  sort_employee: tr('מזהה עובד'),
  user_results: tr('משתמשים בתוצאות'),
  user_pagination: tr('עמודי מאגר המשתמשים'),
  users_per_page: tr('משתמשים בעמוד'),
  user_page_loading: tr('מרענן את העמוד…'),
  no_users: tr('רשימת המשתמשים המרכזית ריקה.'),
  no_results: tr('לא נמצאו משתמשים תואמים.'),
  name: tr('שם'),
  employee_id: tr('מזהה עובד'),
  active: tr('פעיל'),
  inactive: tr('לא פעיל'),
  assignments: tr('הרשאות לאינטרקומים'),
  status: tr('מצב'),
  person_details: tr('פרטים אישיים'),
  profile_groups: tr('קבוצות'),
  validity: tr('תוקף'),
  permanent: tr('ללא תאריך תפוגה'),
  validity_future: tr('טרם התחיל'),
  validity_expired: tr('פג תוקף'),
  validity_current: tr('בתקופת התוקף'),
  validity_unknown: tr('תוקף לא מאומת'),
  validity_summary_hint: tr('התוקף לפי ההגדרה המרכזית; מצב הסנכרון לציוד מוצג בנפרד.'),
  valid_from: tr('התחלה'),
  valid_until: tr('סיום'),
  clock_ha_zone: tr('אזור הזמן של תשתית המערכת'),
  user_sync_hint: tr('מצב הסנכרון לפי גרסת המשתמש האחרונה שאומתה. תקשורת התחנה מוצגת בנפרד; שינויים שטרם הוחלו נשארים בהמתנה.'),
  panel_data_stale: tr('ייתכן שהנתונים המוצגים אינם עדכניים. הרענון נכשל; ניתן לנסות שוב באמצעות רענון.'),
  // person editor (panel.ts editorBody, i18n.ts he) - CR-005 phase 2 slice A1
  add_user: tr('הוספת משתמש'),
  edit_user: tr('עריכת משתמש'),
  edit: tr('עריכה'),
  delete: tr('מחיקה'),
  save: tr('שמירה'),
  save_sync: tr('שמירה וסנכרון'),
  save_hint: tr('שמירה שומרת את השינויים לסנכרון האוטומטי. שמירה וסנכרון מבקשת לסנכרן גם עכשיו. סנכרון אוטומטי או שכבר החל ממשיך בשתי האפשרויות.'),
  cancel: tr('ביטול'),
  remove: tr('הסרה'),
  wait: tr('רגע…'),
  new_person_heading: tr('משתמש חדש'),
  editor_intro: tr('פרטי המשתמש, אמצעי הזיהוי והגישה לתחנות.'),
  phone: tr('טלפון נייד'),
  employee_locked: tr('מזהה זה כבר שימש בתחנה ולא ניתן לשנותו כאן.'),
  user_timing_mode: tr('מתי מותר למשתמש להיכנס?'),
  period: tr('מועד התחלה וסיום'),
  validity_hint: tr('השעות לפי אזור הזמן הנבחר ונשמרות ב־UTC. שינוי אזור התצוגה אינו משנה את רגע הזמן השמור.'),
  configured: tr('מוגדר'),
  not_configured: tr('לא מוגדר'),
  new_pin: tr('קוד PIN חדש'),
  confirm_pin: tr('אימות הקוד'),
  remove_pin: tr('הסרת הקוד'),
  keep_pin: tr('שמירת הקוד הקיים'),
  generate_unique_pin: tr('יצירת PIN ייחודי אוטומטית'),
  pin_generation_failed: tr('לא ניתן ליצור קוד ייחודי. נסה שוב.'),
  pin_private: tr('הקוד השמור אינו מוצג. הזן ערך רק כדי לשנות אותו.'),
  pin_mode_blocked: tr('ניהול PIN אינו זמין באחת התחנות שנבחרו. בדוק את מצב ה־PIN שלה.'),
  pin_physical: tr('מסונכרן מציין שההגדרה נקראה מהמכשיר. תקינות הקוד בלוח המקשים עדיין דורשת בדיקה.'),
  pin_mismatch: tr('הקודים שהוזנו אינם תואמים.'),
  pin_conflict: tr('קוד זה כבר משויך למשתמש מרכזי.'),
  cards: tr('כרטיסים'),
  card_number: tr('מספר כרטיס'),
  card_label: tr('תווית הכרטיס'),
  normal_card: tr('כרטיס רגיל'),
  add_card: tr('הוספת כרטיס'),
  masked: tr('ממוסך'),
  card_conflict: tr('כרטיס זה כבר משויך למשתמש מרכזי.'),
  employee_conflict: tr('מזהה עובד זה כבר קיים במאגר המרכזי.'),
  revision_conflict: tr('המשתמש השתנה בזמן העריכה. סגור את העורך ובדוק את הגרסה העדכנית.'),
  invalid_validity: tr('יש לבחור מועדי התחלה וסיום תקינים.'),
  field_required: tr('יש למלא את השדות הנדרשים.'),
  select_all_stations: tr('בחר את כל התחנות הזמינות לניהול'),
  clear_stations: tr('נקה בחירה'),
  selected_stations: tr('תחנות שנבחרו'),
  station_access: tr('גישה לממסר הפעיל שהוגדר'),
  physical_lock: tr('מנעול פיזי'),
  user_more_actions: tr('פעולות נוספות'),
  profile_save_first: tr('שמור או בטל את השינויים לפני ביצוע הפעולה.'),
  confirm_delete: tr('למחוק משתמש זה? ההסרה תתוזמן ב־{count} תחנות, כולל תחנות מנותקות.'),
  saved: tr('נשמר. הסנכרון האוטומטי ממשיך לפעול.'),
  saved_sync: tr('נשמר. נשלחה בקשה לסנכרון לתחנות.'),
  deleted: tr('ההסרה תוזמנה. תחנות שטרם אישרו הסרה מוצגות בהמשך.'),
  // card capture dialog (panel.ts captureBody / captureFooter, i18n.ts he) - CR-005 phase 2 slice A2
  capture_card: tr('קריאת כרטיס מהאינטרקום'),
  capture_reader: tr('קורא'),
  capture_default_reader: tr('קורא ברירת המחדל בתחנה'),
  capture_hint: tr('בחר אינטרקום, התחל קריאה והצמד כרטיס אחד כאשר תופיע ההנחיה. הקריאה לבדה אינה מוסיפה כרטיס למשתמש. כרטיס מורשה קיים עדיין עשוי להפעיל את המנעול לפי הגדרות התחנה.'),
  capture_start: tr('התחלת קריאת כרטיס'),
  capture_save: tr('הוספת הכרטיס וסנכרון'),
  capture_again: tr('קריאת כרטיס נוסף'),
  capture_confirm_prompt: tr('להוסיף את הכרטיס שנקרא למשתמש {name} ולסנכרן את השיוכים הקיימים שלו?'),
  capture_targets: tr('שיוכים קיימים לאינטרקומים'),
  capture_limits: tr('קריאה אחת בכל תחנה. הבקשה ממתינה עד 30 שניות; התצוגה הפרטית פגה לאחר שתי דקות. סגירה מפסיקה את הקריאה; זמן ההמתנה בקורא נקבע בקושחה. קריאה פיזית עדיין דורשת אימות.'),
  capture_revision_changed: tr('המשתמש השתנה או נמחק. סגור את החלון והתחל קריאה חדשה מהרשומה העדכנית.'),
  capture_from_editor_hint: tr('בחר אינטרקום, הצמד את הכרטיס לקורא שלו ואשר את הוספתו. יש לשמור שינויים במשתמש לפני תחילת הקריאה.'),
  capture_save_user_first: tr('יש לשמור תחילה את המשתמש החדש, ואז לפתוח עריכה כדי לקרוא כרטיס מהאינטרקום.'),
  capture_state_choose: tr('אפשר להתחיל לאחר בדיקת היכולות.'),
  capture_state_preparing: tr('נבדקות יכולות האינטרקום העדכניות…'),
  capture_state_waiting: tr('הצמד כעת כרטיס אחד לאינטרקום שנבחר.'),
  capture_state_captured: tr('הכרטיס נקרא. יש לבדוק ולאשר לפני שמירה.'),
  capture_state_unconfirmed: tr('תוצאת השמירה אינה מאומתת. סגור את החלון ובדוק את המשתמש ואת הסנכרון לפני ניסיון נוסף.'),
  capture_state_error: tr('הקריאה לא נשמרה. לניסיון נוסף יש להתחיל קריאה חדשה.'),
  capture_unsupported: tr('האינטרקום אינו מפרסם יכולת נתמכת לקריאת כרטיס.'),
  capture_reader_invalid: tr('הקורא שנבחר אינו מפורסם עוד ביכולות. יש לקרוא אותן מחדש.'),
  capture_not_found: tr('הקריאה פגה או אינה זמינה למנהל הנוכחי. יש להתחיל מחדש.'),
  capture_not_ready: tr('אין כרטיס שנקרא וממתין לאישור.'),
  capture_station_busy: tr('בתחנה זו כבר קיימת קריאה שממתינה לסיום או לאישור.'),
  capture_limit: tr('שלוש קריאות כבר פעילות. יש לסיים או לבטל אחת מהן.'),
  capture_timeout: tr('לא התקבלה תשובה לפני תום זמן ההמתנה. לא נשמר כרטיס.'),
  capture_failed: tr('הקריאה נכשלה או החזירה נתונים שאינם נתמכים. לא נשמר כרטיס.'),
  capture_applying: tr('הכרטיס נמצא בשמירה. יש להמתין לתוצאה לפני פעולה נוספת.'),
  csv_no_stations: tr('ללא שיוך לאינטרקומים'),
  select_station: tr('בחירת אינטרקום'),
  station_offline: tr('התחנה מנותקת.'),
  close: tr('סגירה'),
  // not in WisKey's i18n (brief A.7: states WisKey's panel has no text for) - SMPLWISE's own wording
  capture_state_applying: tr('הכרטיס נשמר…'),
  capture_state_expired: tr('זמן הקריאה (שתי דקות) הסתיים. לא נשמר כרטיס.'),
  capture_state_cancelled: tr('נשלח ביטול לקריאה. לא נשמר כרטיס.'),
  capture_state_abandoned: tr('הקריאה נסגרה כי החלון הפסיק לעקוב אחריה (למשל כרטיסייה מוקפאת או מחשב שנכנס למצב שינה). לא נשמר כרטיס.'),
  capture_state_lost: tr('בקרת הכניסה אינה מכירה עוד את הקריאה (למשל אחרי הפעלה מחדש של תשתית המערכת). לא נשמר כרטיס.'),
  capture_state_closed: tr('בקרת הכניסה דחתה את הוספת הכרטיס וסגרה את הקריאה. לא נשמר כרטיס.'),
  capture_state_confirmed: tr('הכרטיס נוסף למשתמש ונשלחה בקשה לסנכרון לתחנות.'),
  // CR-WISKEY-LEASE-REVOCATION-EVENT L5 (the capture-lease route, OFF by default): the one stop message - never a code or a reason
  capture_state_revoked: tr('קריאת הכרטיס הופסקה. לא נשמר כרטיס.'),
  manager_closed: tr('מנהל הגישה של בקרת הכניסה נסגר (ייתכן שתשתית המערכת נטענה מחדש). נסה שוב בעוד רגע.'),
};

/** WisKey's `translate`: a known key, else the key itself with underscores as spaces. */
export function t(key: string): string {
  return HE[key] ?? key.replaceAll('_', ' ');
}

/**
 * The sync status as a badge for the person editor's station rows (WisKey `badge(status)`): the editor's own contract, unchanged.
 * CR-WISKEY-NOTIF-2443 (review 06:WK-1): moved here from screens/wiskey-people.ts - the editor imported it back from the screen that
 * imports the editor (a cycle). Not the same function as `syncBadge` of access-control/station-permissions-logic.ts (that one takes a
 * station-permission sync state and returns null for "applied").
 */
export function syncBadge(status: string): { kind: StateKind; label: string } {
  if (status === 'synced') return { kind: 'recorded', label: t('synced') };
  if (status === 'pending' || status === 'syncing' || status === 'delete_pending') return { kind: 'stale', label: t(status) };
  if (status === 'conflict' || status === 'error') return { kind: 'error', label: t(status) };
  if (status === 'offline') return { kind: 'offline', label: t('offline') };
  if (status === 'unassigned') return { kind: 'unknown', label: t('filter_unassigned') };
  return { kind: 'neutral', label: t(status) };
}

/** The name lookups the people screen hands its drawer and its bulk dialog, built from the station and group lists. */
export interface PeopleLookups {
  stationNames: Record<string, string>;
  groupLabels: Record<string, string>;
  groupStations: Record<string, number | null>;
  bulkStations: { id: string; name: string; locks: number[] }[];
  bulkGroups: { id: string; label: string }[];
}

/**
 * CR-WISKEY-NOTIF-2443 (review 06:WK-1): the lookups were rebuilt on every render (each search keystroke made three maps and two
 * arrays, and the drawer and the bulk dialog saw "new" properties every time). The returned function rebuilds them only when the
 * station list or the group list is a different array (the screen replaces them, never mutates them); otherwise it returns the same
 * objects.
 */
export function peopleLookupsMemo(): (stations: readonly AcStationLite[], groups: readonly AcGroup[]) => PeopleLookups {
  let lastStations: readonly AcStationLite[] | null = null;
  let lastGroups: readonly AcGroup[] | null = null;
  let last: PeopleLookups | null = null;
  return (stations, groups) => {
    if (last && stations === lastStations && groups === lastGroups) return last;
    lastStations = stations;
    lastGroups = groups;
    last = {
      stationNames: Object.fromEntries(stations.map((s): [string, string] => [s.id, s.name])),
      groupLabels: Object.fromEntries(groups.map((g): [string, string] => [g.id, g.label])),
      groupStations: Object.fromEntries(groups.map((g): [string, number | null] => [g.id, g.station_ids ? g.station_ids.length : null])),
      bulkStations: stations.map((st) => ({ id: st.id, name: st.name, locks: [1, 2] })),
      bulkGroups: groups.map((g) => ({ id: g.id, label: g.label })),
    };
    return last;
  };
}
