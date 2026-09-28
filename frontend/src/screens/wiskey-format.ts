/**
 * Ported from the owner's WisKey frontend (home-assistant-hikvision-intercom, frontend/src): the zone-aware time
 * formatting of `time.ts` (`offsetAt`, `offsetLabel`, `formatTime`, and the zone-aware `datetime-local` conversion
 * `localInput` / `fromLocalInput` / `resolveLocalInput` the activity filters use) and the Hebrew strings of `i18n.ts`
 * that the entry center and the activity log use. Kept verbatim in behaviour so SMPLWISE shows a WisKey instant exactly
 * as WisKey does - in the station's own clock zone (a device DST rule included), never with a fixed offset.
 */
import type { DisplayZone } from '../api/intercom';

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

/** An ISO instant (with an explicit offset) as local time in `zone` plus its UTC offset; '—' for anything else. */
export function formatTime(value: string | null | undefined, locale = 'he-IL', zone: DisplayZone = UTC_ZONE) {
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

/** WisKey's Hebrew strings for the entry center and the activity log (i18n.ts `he`), keyed as in WisKey. */
const HE: Record<string, string> = {
  wk4_entry_center: 'מרכז הכניסה',
  wk4_entry_intro: 'דלתות, אנשים ופעולות שדורשות תשומת לב',
  wk4_door_filter: 'סינון דלתות',
  wk4_filter_all: 'כל הדלתות',
  wk4_filter_online: 'מחוברות',
  wk4_filter_attention: 'דורשות טיפול',
  online_stations: 'תחנות מחוברות',
  total_users: 'משתמשים',
  ringing_now: 'מצלצלים כעת',
  pending_sync: 'ממתינים לסנכרון',
  wall_search: 'חיפוש כניסות',
  wall_previous: 'הקודם',
  wall_next: 'הבא',
  devices: 'אינטרקומים',
  access_recent_activity: 'אירוע הגישה האחרון בכל תחנה',
  access_attention: 'דורש תשומת לב',
  access_by_permissions: 'גישה לפי הרשאות',
  lock_enabled: 'דלת מנוהלת',
  camera_only: 'מצלמה בלבד',
  last_access: 'אירוע גישה אחרון',
  no_access_recorded: 'אין אירוע גישה בהיסטוריה השמורה',
  unknown_person: 'משתמש לא מזוהה',
  identity_unavailable: 'ברשומה זו אין זהות משתמש זמינה. אין שיוך לפי הקוד או שעת האירוע.',
  receipt_time: 'זמן קבלה',
  historical_record: 'רשומה היסטורית',
  last_seen: 'קשר מוצלח אחרון',
  not_observed: 'טרם נצפה מאז הטעינה',
  managed_users: 'משתמשים מנוהלים בציוד',
  pending_users: 'ממתינים לסנכרון',
  no_events: 'אין אירועים תואמים',
  no_stations: 'הוסף אינטרקום ראשון בהגדרות תשתית המערכת.',
  // call states (coordinator `normalized`)
  online: 'מחובר',
  offline: 'מנותק',
  ringing: 'מצלצל',
  in_call: 'תפוס / בשיחה',
  ending: 'סיום',
  idle: 'ממתין',
  unknown: 'לא ידוע',
  unavailable: 'לא זמין',
  // sync states (access/models.py SYNC_STATES)
  pending: 'ממתין',
  syncing: 'מסנכרן',
  synced: 'מסונכרן',
  conflict: 'התנגשות',
  error: 'שגיאה',
  delete_pending: 'ממתין להסרה',
  // event types and authentication (events.py)
  access_granted: 'אימות אושר',
  access_denied: 'אימות נדחה',
  attempt_limit: 'הגעה למגבלת ניסיונות PIN',
  unlock_record: 'דיווח פתיחה מהמכשיר',
  door_unlocked: 'המכשיר מדווח שהמנעול שוחרר',
  door_locked: 'המכשיר מדווח שהמנעול נעול',
  contact_open: 'המגע מדווח פתוח',
  contact_closed: 'המגע מדווח סגור',
  unlock_exception: 'תקלה בפתיחה',
  door_not_opened: 'התראת דלת שלא נפתחה',
  door_not_closed: 'התראת דלת שלא נסגרה',
  ring: 'צלצול בפעמון',
  sync: 'סנכרון',
  card: 'כרטיס',
  pin: 'קוד PIN',
  granted: 'אושר',
  denied: 'נדחה',
  // activity log (events.ts)
  wk4_nav_events: 'פעילות',
  events_intro: 'איתור פעילות גישה לפי אדם, תחנה וזמן.',
  refresh: 'רענון',
  event_filters: 'סינון אירועים',
  event_filters_active: 'מסננים שהוחלו',
  event_filters_all: 'כל האירועים',
  event_investigation_quick: 'חקירה מהירה',
  event_quick_denied: 'כניסות שנדחו',
  station: 'תחנה',
  person: 'אדם / מזהה עובד',
  result: 'תוצאה',
  authentication: 'אמצעי זיהוי',
  door: 'דלת',
  all: 'הכול',
  from_time: 'מתאריך',
  until_time: 'עד תאריך',
  filter: 'סינון',
  clear_user_filters: 'ניקוי חיפוש ומסננים',
  filters_not_applied: 'המסננים נערכו. יש להחיל אותם לעדכון התוצאות.',
  clock_filter_basis: 'תאריכי הסינון לפי אזור זה',
  loaded_records: 'רשומות שנטענו',
  loading: 'טוען…',
  load_more: 'טען עוד',
  report_date: 'תאריך',
  event_detail: 'פירוט האירוע',
  event_type: 'סוג אירוע',
  employee_no: 'מספר עובד',
  removed_station: 'תחנה שהוסרה',
  history_incomplete: 'שחזור ההיסטוריה אינו מלא. ייתכן שחסרות רשומות.',
  audit_save_failed: 'לא ניתן לשמור היסטוריה. הרשומות החדשות נמצאות כרגע בזיכרון בלבד.',
  events_load_failed: 'רענון האירועים לא הושלם. ייתכן שהרשומות שהוצגו קודם אינן מעודכנות; ניתן לרענן לאחר חידוש החיבור.',
  clock_invalid_local: 'הזינו תאריך ושעה מקומיים תקינים.',
  clock_ambiguous: 'השעה המקומית מופיעה פעמיים בסיום שעון הקיץ. בחרו שעה חד־משמעית.',
  clock_nonexistent: 'השעה המקומית אינה קיימת בתחילת שעון הקיץ. בחרו שעה לפני שינוי השעון או אחריו.',
  filter_start_before_end: 'תאריך ההתחלה חייב להיות לפני תאריך הסיום.',
  filter_zone_changed_invalid: 'אזור הזמן של הסינון השתנה והזמן בטיוטה אינו חד־משמעי או תקין. יש להזין מחדש את טווח התאריכים.',
};

/** WisKey's `translate`: a known key, else the key itself with underscores as spaces. */
export function t(key: string): string {
  return HE[key] ?? key.replaceAll('_', ' ');
}
