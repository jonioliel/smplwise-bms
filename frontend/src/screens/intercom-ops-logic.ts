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

export type OpsTab = 'overview' | 'operations' | 'investigations' | 'capacity' | 'events' | 'exports';
export const OPS_TABS: readonly OpsTab[] = ['overview', 'operations', 'investigations', 'capacity', 'events', 'exports'];
export const OPS_HREF = '#/system/intercom-operations';

export function tabOf(view: string): OpsTab {
  return (OPS_TABS as readonly string[]).includes(view) ? (view as OpsTab) : 'overview';
}

export const T = {
  title: 'תפעול האינטרקום',
  sub: 'מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים',
  tabs: { overview: 'סיכום', operations: 'פעולות ומשימות', investigations: 'חקירות', capacity: 'קיבולת ומגמות', events: 'דוח אירועים', exports: 'ייצוא' } as Record<OpsTab, string>,
  loading: 'טוען את נתוני התפעול…',
  forbiddenTitle: 'אין לכם הרשאה לתפעול האינטרקום',
  forbiddenHint: 'נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה.',
  errorTitle: 'לא ניתן לטעון את תפעול האינטרקום',
  unavailable: 'מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.',
  retry: 'נסו שוב',
  refresh: 'רענון',
  fetchedAt: 'עודכן',
  empty: 'אין מה להציג',
  kpi: { stations: 'עמדות', online: 'מחוברות', offline: 'לא מחוברות', pending_users: 'ממתינים לסנכרון', sync_problems: 'עמדות עם תקלת סנכרון', near_capacity: 'קרובות למגבלה' },
  stationsTitle: 'העמדות',
  table: { station: 'עמדה', state: 'מצב', sync: 'סנכרון', pending: 'ממתינים', users: 'משתמשים', cards: 'כרטיסים', use: 'ניצולת', error: 'שגיאה אחרונה' },
  online: 'מחוברת',
  offline: 'לא מחוברת',
  // operations and jobs
  opsTitle: 'פעולות',
  opsHint: 'סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת.',
  jobsTitle: 'משימות מרוכזות',
  jobsHint: 'משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה.',
  jobsEmpty: 'אין משימות מרוכזות.',
  filterKind: 'סוג',
  filterState: 'מצב',
  filterStation: 'עמדה',
  filterSearch: 'חיפוש',
  all: 'הכול',
  people: (n: number) => (n === 1 ? 'אדם אחד' : `${n} אנשים`),
  stationsCount: (n: number) => (n === 1 ? 'עמדה אחת' : `${n} עמדות`),
  progress: (done: number, total: number) => `${done} מתוך ${total}`,
  cancel: 'ביטול המשימה',
  cancelTitle: 'לבטל את המשימה?',
  cancelBody: 'שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת.',
  cancelConfirm: 'כן, לבטל',
  cancelKeep: 'השארת המשימה',
  cancelled: 'המשימה בוטלה.',
  errorsCsv: 'הורדת השורות שנכשלו',
  rowsFailed: (n: number) => (n === 1 ? 'שורה אחת נכשלה' : `${n} שורות נכשלו`),
  row: 'שורה',
  more: 'הבא',
  prev: 'הקודם',
  stale: 'הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני.',
  // investigations
  invTitle: 'ציר זמן לחקירה',
  invHint: 'כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים.',
  invSource: 'מקור',
  invFrom: 'מתאריך',
  invTo: 'עד תאריך',
  hiddenFields: 'חלק מהפרטים מוסתרים לפי ההרשאות שלכם.',
  storageFailed: 'שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים.',
  operator: 'מפעיל',
  // capacity
  capTitle: 'קיבולת לפי עמדה',
  capHint: 'משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה.',
  trendTitle: 'מגמה',
  trendHint: 'מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת.',
  trendNone: 'עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש.',
  days: (n: number) => `${n} ימים`,
  usersOf: (c: number | null, l: number | null) => (c === null ? '—' : l === null ? `${c}` : `${c} / ${l}`),
  daysToLimit: (d: number) => `כ־${Math.round(d)} ימים עד המגבלה`,
  growth: (g: number) => `${g > 0 ? '+' : ''}${g} ביום`,
  sampledAt: 'נדגם',
  // events report
  evTitle: 'דוח אירועים',
  evHint: 'סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים.',
  granted: 'אושרו',
  denied: 'נדחו',
  other: 'אירועים אחרים',
  total: 'סה"כ',
  byDay: 'כניסות לפי יום',
  byStation: 'לפי עמדה',
  methods: 'אמצעי זיהוי',
  anomalies: 'חריגות',
  showTable: 'הצגה כטבלה',
  hideTable: 'הסתרת הטבלה',
  // exports
  expTitle: 'ייצוא',
  expHint: 'קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות.',
  expInventory: 'מלאי העמדות',
  expInventoryHint: 'דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות).',
  expAudit: 'יומן השינויים של מערכת האינטרקום',
  expAuditHint: 'מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי.',
  download: 'הורדה',
  downloaded: (n: number | null) => (n === null ? 'הקובץ הורד.' : `הקובץ הורד (${n} שורות).`),
  adminOnly: 'הייצוא זמין למנהלי בקרת הכניסה בלבד.',
};

export const STATE_HE: Record<string, string> = {
  pending: 'ממתין', failed: 'נכשל', verified: 'אומת בעמדה', settled: 'הסתיים', saved: 'נשמר', unknown: 'לא ידוע',
  paused: 'מושהה', running: 'פועל', completed: 'הושלם', completed_with_errors: 'הושלם עם שגיאות', cancelled: 'בוטל',
  synced: 'מסונכרן', syncing: 'מסתנכרן', offline: 'לא מחובר', conflict: 'התנגשות', error: 'שגיאה', delete_pending: 'מחיקה ממתינה',
  granted: 'אושר', denied: 'נדחה',
};
export const KIND_HE: Record<string, string> = { sync: 'סנכרון', bulk: 'עריכה מרוכזת', csv: 'ייבוא קובץ', unknown: 'לא ידוע' };
export const SOURCE_HE: Record<string, string> = { access: 'כניסה', change: 'שינוי', sync: 'סנכרון', unknown: 'לא ידוע' };
export const ACTION_HE: Record<string, string> = {
  'sync/user_station': 'סנכרון אדם לעמדה', 'bulk/csv_import': 'ייבוא קובץ', 'bulk/enable': 'הפעלה מרוכזת', 'bulk/disable': 'השבתה מרוכזת',
  'bulk/assign': 'שיוך מרוכז', 'bulk/unassign': 'הסרת שיוך מרוכזת', 'bulk/delete': 'מחיקה מרוכזת', 'bulk/renew': 'חידוש מרוכז',
  'users/create': 'יצירת אדם', 'users/update': 'עדכון אדם', 'users/delete': 'מחיקת אדם', 'users/archive': 'העברה לארכיון',
  access_granted: 'כניסה אושרה', access_denied: 'כניסה נדחתה', door_open: 'דלת נפתחה', door_not_closed: 'דלת לא נסגרה', ring: 'צלצול',
};
export const ANOMALY_HE: Record<string, string> = { access_denied: 'כניסות שנדחו', attempt_limit: 'חריגה ממספר ניסיונות', unlock_exception: 'פתיחה חריגה', door_not_closed: 'דלת לא נסגרה' };
export const METHOD_HE: Record<string, string> = { card: 'כרטיס', pin: 'קוד', unknown: 'לא ידוע' };
export const ALERT_HE: Record<CapacityValues['alert'], string> = {
  unknown: 'אין נתון', stale: 'הנתון ישן', at_limit: 'במגבלה', near_limit: 'קרוב למגבלה', growth_to_limit: 'יגיע למגבלה בקרוב', observed: 'תקין',
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

/** A clean axis maximum (1, 2, 2.5, 5 × 10^n) at or above `v`; at least 1. */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
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
