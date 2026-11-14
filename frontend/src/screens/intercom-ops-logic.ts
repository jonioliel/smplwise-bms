/**
 * WISKEY-OPS-VIEWS-2400: the pure part of Settings › תפעול האינטרקום - the tabs, the Hebrew words for the intercom's codes, the tones and
 * the chart geometry. No DOM, no session, no network: tests/unit-intercom-ops.spec.ts runs it in node.
 *
 * Charts follow the data-viz method: the job picks the form (a KPI row for the headline numbers; meters for one ratio against a limit;
 * a stacked column per day for granted vs denied entries; a single line for a station's trend against its limit, the limit a hairline);
 * thin marks (bars at most 24 px with a 4 px rounded data end, square at the baseline; 2 px lines; 8 px end dots with a 2 px surface ring);
 * a 2 px surface gap between stacked segments; recessive solid hairline grid; values only where they carry the story; every value also
 * in a table twin. Two categorical slots (granted = blue, denied = orange), validated with the skill's validate_palette.js in light
 * (#2a78d6 / #eb6834 on #fcfcfb) and dark (#3987e5 / #d95926 on #1a1a19): all checks pass (CVD ΔE 24.7 / 26.8, normal 33.6 / 31.8).
 */
import type { CapacityValues, JobRow, OperationRow, TrendPoint } from '../api/intercom-ops';
import { tr } from '../i18n/msg/wiskey';

export type OpsTab = 'overview' | 'operations' | 'investigations' | 'capacity' | 'events' | 'exports';
export const OPS_TABS: readonly OpsTab[] = ['overview', 'operations', 'investigations', 'capacity', 'events', 'exports'];
export const OPS_HREF = '#/system/intercom-operations';

export function tabOf(view: string): OpsTab {
  return (OPS_TABS as readonly string[]).includes(view) ? (view as OpsTab) : 'overview';
}

export const T = {
  title: tr('תפעול האינטרקום'),
  sub: tr('מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים'),
  tabs: { overview: tr('סיכום'), operations: tr('פעולות ומשימות'), investigations: tr('חקירות'), capacity: tr('קיבולת ומגמות'), events: tr('דוח אירועים'), exports: tr('ייצוא') } as Record<OpsTab, string>,
  loading: tr('טוען את נתוני התפעול…'),
  forbiddenTitle: tr('אין לכם הרשאה לתפעול האינטרקום'),
  forbiddenHint: tr('נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה.'),
  errorTitle: tr('לא ניתן לטעון את תפעול האינטרקום'),
  unavailable: tr('מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.'),
  retry: tr('נסו שוב'),
  refresh: tr('רענון'),
  fetchedAt: tr('עודכן'),
  empty: tr('אין מה להציג'),
  kpi: { stations: tr('עמדות'), online: tr('מחוברות'), offline: tr('לא מחוברות'), pending_users: tr('ממתינים לסנכרון'), sync_problems: tr('עמדות עם תקלת סנכרון'), near_capacity: tr('קרובות למגבלה') },
  stationsTitle: tr('העמדות'),
  table: { station: tr('עמדה'), state: tr('מצב'), sync: tr('סנכרון'), pending: tr('ממתינים'), users: tr('משתמשים'), cards: tr('כרטיסים'), use: tr('ניצולת'), error: tr('שגיאה אחרונה') },
  online: tr('מחוברת'),
  offline: tr('לא מחוברת'),
  // operations and jobs
  opsTitle: tr('פעולות'),
  opsHint: tr('סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת.'),
  jobsTitle: tr('משימות מרוכזות'),
  jobsHint: tr('משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה.'),
  jobsEmpty: tr('אין משימות מרוכזות.'),
  filterKind: tr('סוג'),
  filterState: tr('מצב'),
  filterStation: tr('עמדה'),
  filterSearch: tr('חיפוש'),
  all: tr('הכול'),
  people: (n: number) => (n === 1 ? tr('אדם אחד') : tr('{n} אנשים', { n })),
  stationsCount: (n: number) => (n === 1 ? tr('עמדה אחת') : tr('{n} עמדות', { n })),
  progress: (done: number, total: number) => tr('{done} מתוך {total}', { done, total }),
  cancel: tr('ביטול המשימה'),
  cancelTitle: tr('לבטל את המשימה?'),
  cancelBody: tr('שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת.'),
  cancelConfirm: tr('כן, לבטל'),
  cancelKeep: tr('השארת המשימה'),
  cancelled: tr('המשימה בוטלה.'),
  errorsCsv: tr('הורדת השורות שנכשלו'),
  rowsFailed: (n: number) => (n === 1 ? tr('שורה אחת נכשלה') : tr('{n} שורות נכשלו', { n })),
  row: tr('שורה'),
  more: tr('הבא'),
  prev: tr('הקודם'),
  stale: tr('הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני.'),
  // investigations
  invTitle: tr('ציר זמן לחקירה'),
  invHint: tr('כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים.'),
  invSource: tr('מקור'),
  invFrom: tr('מתאריך'),
  invTo: tr('עד תאריך'),
  hiddenFields: tr('חלק מהפרטים מוסתרים לפי ההרשאות שלכם.'),
  storageFailed: tr('שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים.'),
  operator: tr('מפעיל'),
  // capacity
  capTitle: tr('קיבולת לפי עמדה'),
  capHint: tr('משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה.'),
  trendTitle: tr('מגמה'),
  trendHint: tr('מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת.'),
  trendNone: tr('עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש.'),
  days: (n: number) => tr('{n} ימים', { n }),
  usersOf: (c: number | null, l: number | null) => (c === null ? '—' : l === null ? `${c}` : `${c} / ${l}`),
  daysToLimit: (d: number) => tr('כ־{n} ימים עד המגבלה', { n: Math.round(d) }),
  growth: (g: number) => tr('{g} ביום', { g: `${g > 0 ? '+' : ''}${g}` }),
  sampledAt: tr('נדגם'),
  // events report
  evTitle: tr('דוח אירועים'),
  evHint: tr('סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים.'),
  granted: tr('אושרו'),
  denied: tr('נדחו'),
  other: tr('אירועים אחרים'),
  total: tr('סה"כ'),
  byDay: tr('כניסות לפי יום'),
  byStation: tr('לפי עמדה'),
  methods: tr('אמצעי זיהוי'),
  anomalies: tr('חריגות'),
  showTable: tr('הצגה כטבלה'),
  hideTable: tr('הסתרת הטבלה'),
  // exports
  expTitle: tr('ייצוא'),
  expHint: tr('קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות.'),
  expInventory: tr('מלאי העמדות'),
  expInventoryHint: tr('דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות).'),
  expAudit: tr('יומן השינויים של מערכת האינטרקום'),
  expAuditHint: tr('מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי.'),
  download: tr('הורדה'),
  downloaded: (n: number | null) => (n === null ? tr('הקובץ הורד.') : tr('הקובץ הורד ({n} שורות).', { n })),
  adminOnly: tr('הייצוא זמין למנהלי בקרת הכניסה בלבד.'),
};

export const STATE_HE: Record<string, string> = {
  pending: tr('ממתין'), failed: tr('נכשל'), verified: tr('אומת בעמדה'), settled: tr('הסתיים'), saved: tr('נשמר'), unknown: tr('לא ידוע'),
  paused: tr('מושהה'), running: tr('פועל'), completed: tr('הושלם'), completed_with_errors: tr('הושלם עם שגיאות'), cancelled: tr('בוטל'),
  synced: tr('מסונכרן'), syncing: tr('מסתנכרן'), offline: tr('לא מחובר'), conflict: tr('התנגשות'), error: tr('שגיאה'), delete_pending: tr('מחיקה ממתינה'),
  granted: tr('אושר'), denied: tr('נדחה'),
};
export const KIND_HE: Record<string, string> = { sync: tr('סנכרון'), bulk: tr('עריכה מרוכזת'), csv: tr('ייבוא קובץ'), unknown: tr('לא ידוע') };
export const SOURCE_HE: Record<string, string> = { access: tr('כניסה'), change: tr('שינוי'), sync: tr('סנכרון'), unknown: tr('לא ידוע') };
export const ACTION_HE: Record<string, string> = {
  'sync/user_station': tr('סנכרון אדם לעמדה'), 'bulk/csv_import': tr('ייבוא קובץ'), 'bulk/enable': tr('הפעלה מרוכזת'), 'bulk/disable': tr('השבתה מרוכזת'),
  'bulk/assign': tr('שיוך מרוכז'), 'bulk/unassign': tr('הסרת שיוך מרוכזת'), 'bulk/delete': tr('מחיקה מרוכזת'), 'bulk/renew': tr('חידוש מרוכז'),
  'users/create': tr('יצירת אדם'), 'users/update': tr('עדכון אדם'), 'users/delete': tr('מחיקת אדם'), 'users/archive': tr('העברה לארכיון'),
  access_granted: tr('כניסה אושרה'), access_denied: tr('כניסה נדחתה'), door_open: tr('דלת נפתחה'), door_not_closed: tr('דלת לא נסגרה'), ring: tr('צלצול'),
};
export const ANOMALY_HE: Record<string, string> = { access_denied: tr('כניסות שנדחו'), attempt_limit: tr('חריגה ממספר ניסיונות'), unlock_exception: tr('פתיחה חריגה'), door_not_closed: tr('דלת לא נסגרה') };
export const METHOD_HE: Record<string, string> = { card: tr('כרטיס'), pin: tr('קוד'), unknown: tr('לא ידוע') };
export const ALERT_HE: Record<CapacityValues['alert'], string> = {
  unknown: tr('אין נתון'), stale: tr('הנתון ישן'), at_limit: tr('במגבלה'), near_limit: tr('קרוב למגבלה'), growth_to_limit: tr('יגיע למגבלה בקרוב'), observed: tr('תקין'),
};

export const he = (map: Record<string, string>, code: string | null | undefined): string => (code ? map[code] ?? code : '—');

export type Tone = 'ok' | 'warn' | 'err' | 'neutral';

export function alertTone(alert: CapacityValues['alert']): Tone {
  if (alert === 'at_limit') return 'err';
  if (alert === 'near_limit' || alert === 'growth_to_limit') return 'warn';
  if (alert === 'observed') return 'ok';
  return 'neutral';
}

export function stateTone(state: string): Tone {
  if (state === 'failed' || state === 'error' || state === 'conflict' || state === 'completed_with_errors') return 'err';
  if (state === 'pending' || state === 'syncing' || state === 'paused' || state === 'running' || state === 'offline') return 'warn';
  if (state === 'verified' || state === 'synced' || state === 'completed' || state === 'settled' || state === 'saved') return 'ok';
  return 'neutral';
}

export function meterTone(percent: number | null): Tone {
  if (percent === null) return 'neutral';
  if (percent >= 95) return 'err';
  if (percent >= 80) return 'warn';
  return 'ok';
}

export function opDone(op: OperationRow): number {
  return op.progress.verified + op.progress.settled;
}

/** Offered only where the intercom would take it, and only to an access-control administrator. */
export function canCancel(job: JobRow, admin: boolean): boolean {
  return admin && job.cancellable && job.revision !== null;
}

// ---------------------------------------------------------------- chart geometry

/** A clean axis maximum (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^n) at or above `v`; at least 1 - close enough that the data fills the plot. */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (Math.round(m * p * 1000) / 1000 >= v) return Math.round(m * p * 1000) / 1000;
  return 10 * p;
}

/** Four clean ticks 0..max. */
export function ticks(max: number): number[] {
  return [0, max / 4, max / 2, (3 * max) / 4, max].map((t) => Math.round(t * 100) / 100);
}

/** Compact axis label: 1,200 -> 1.2K. */
export function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n * 10) / 10);
}

export const BAR_MAX = 24;
export const GAP = 2;

export interface StackBar {
  key: string;
  x: number;
  w: number;
  /** granted (bottom) and denied (on top), each `{y, h}`; h 0 = no segment */
  granted: { y: number; h: number };
  denied: { y: number; h: number };
  values: { granted: number; denied: number };
}

/**
 * Stacked columns, one per day. Time runs the way the page reads (as the electricity chart does): the oldest day at the inline START
 * (right in Hebrew), the newest at the inline END. `rtl` places the slots only; the marks themselves are never mirrored.
 */
export function stackBars(days: { day: string; granted: number; denied: number }[], width: number, height: number, max: number, rtl = true): StackBar[] {
  const n = days.length;
  if (!n || width <= 0 || height <= 0) return [];
  const band = width / n;
  const w = Math.max(2, Math.min(BAR_MAX, band * 0.6));
  return days.map((d, i) => {
    const slot = rtl ? n - 1 - i : i;
    const x = slot * band + (band - w) / 2;
    const gh = max > 0 ? (d.granted / max) * height : 0;
    const dh = max > 0 ? (d.denied / max) * height : 0;
    const gy = height - gh;
    // the denied segment sits on top, separated by the 2 px surface gap when both exist
    const deniedH = d.denied > 0 ? Math.max(0, dh - (d.granted > 0 ? GAP : 0)) : 0;
    return { key: d.day, x, w, granted: { y: gy, h: gh }, denied: { y: gy - (d.granted > 0 && d.denied > 0 ? GAP : 0) - deniedH, h: deniedH }, values: { granted: d.granted, denied: d.denied } };
  });
}

/** SVG path of a bar with a rounded data end (radius r) and a square baseline: y = top, h = height. */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** The trend of one station: `{x, y}` points of the user count over time, x by instant (newest at the inline end: left in RTL). */
export function trendPoints(points: TrendPoint[], width: number, height: number, max: number, rtl = true): { x: number; y: number; at: string; v: number }[] {
  const usable = points.filter((p) => p.users !== null && Number.isFinite(Date.parse(p.at)));
  if (!usable.length) return [];
  const t0 = Date.parse(usable[0].at);
  const t1 = Date.parse(usable[usable.length - 1].at);
  const span = Math.max(1, t1 - t0);
  return usable.map((p) => {
    const f = usable.length === 1 ? 1 : (Date.parse(p.at) - t0) / span;
    const x = rtl ? width - f * width : f * width;
    const y = max > 0 ? height - ((p.users as number) / max) * height : height;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, at: p.at, v: p.users as number };
  });
}

export function linePath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
}

/** Index of the nearest point to pointer x (the crosshair snaps to it). */
export function nearest(pts: { x: number }[], x: number): number {
  let best = -1;
  let d = Infinity;
  pts.forEach((p, i) => {
    const e = Math.abs(p.x - x);
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}

/** `YYYY-MM-DD` as a short Hebrew day label (no time zone math: WisKey already bucketed the day in the station's zone). */
export function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${Number(m[3])}.${Number(m[2])}` : day;
}
