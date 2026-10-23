/**
 * CR-FLEET215: the pure model of Settings › דיווח בריאות (no DOM; unit-tested in tests/unit-fleet-report.spec.ts): which of the four
 * pages the state stands for, the plain words of the answer card, the time wording, the log lines and the 52 listed fields.
 */
import type { FleetLogRow, FleetResult, FleetStatus } from '../api/fleet-report';
import { ft, type FleetTextKey } from '../i18n/fleet-report';

export type FleetView = 'off' | 'on' | 'nourl' | 'failed';
export type Tone = 'ok' | 'warn' | 'bad' | 'mute';

export function viewOf(s: FleetStatus): FleetView {
  if (!s.enabled) return 'off';
  if (!s.receiver_configured) return 'nourl';
  if (s.last_result && s.last_result !== 'ok') return 'failed';
  return 'on';
}

// ---------------------------------------------------------------- time wording: "היום 03:12", "אתמול 03:11", "21.10 · 03:11"

const p2 = (n: number) => String(n).padStart(2, '0');

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const clock = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** "היום 03:12" / "אתמול 03:11" / "21.10 · 03:11" (the year only when it is not this year). */
export function whenText(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  if (dayKey(d) === dayKey(now)) return `היום ${clock(d)}`;
  if (dayKey(d) === dayKey(y)) return `אתמול ${clock(d)}`;
  if (dayKey(d) === dayKey(t)) return `מחר ${clock(d)}`;
  const date = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}${d.getFullYear() === now.getFullYear() ? '' : `.${d.getFullYear()}`}`;
  return `${date} · ${clock(d)}`;
}

/** Inside a sentence: "היום בשעה 03:12" / "אתמול בשעה 03:11" / "ב-21.10 בשעה 03:11". */
export function whenInSentence(iso: string | null | undefined, now: Date = new Date()): string {
  const w = whenText(iso, now);
  if (!w) return '';
  const m = w.match(/^(היום|אתמול|מחר) (\d\d:\d\d)$/);
  if (m) return `${m[1]} בשעה ${m[2]}`;
  const [date, time] = w.split(' · ');
  return `ב-${date} בשעה ${time}`;
}

/** When the next attempt happens: a day after the last good one, three hours after a failed one; none yet = "soon". */
export function nextAttemptAt(s: FleetStatus, now: Date = new Date()): Date | null {
  const last = parse(s.last_attempt_at);
  if (!last) return null;
  const hours = s.last_result === 'ok' ? s.period_h : s.retry_h;
  const next = new Date(last.getTime() + hours * 3600_000);
  return next.getTime() <= now.getTime() ? null : next;
}

function nextText(s: FleetStatus, now: Date): string {
  const n = nextAttemptAt(s, now);
  return n ? whenInSentence(n.toISOString(), now) : 'בקרוב';
}

// ---------------------------------------------------------------- the answer card

export interface Answer {
  view: FleetView;
  tone: Tone;
  icon: 'check' | 'power' | 'warning' | 'info';
  title: string;
  sub: string;
  doText: string;
  /** the last-reports card's one-line summary */
  lastLine: string;
  /** the technician card's one-line summary */
  techLine: string;
  canSend: boolean;
}

export function answerOf(s: FleetStatus, now: Date = new Date()): Answer {
  const view = viewOf(s);
  const last = whenText(s.last_attempt_at, now);
  const lastOk = whenInSentence(s.last_ok_at, now);
  const seq = s.last_seq > 0 ? ` · דוח מספר ${s.last_seq}` : '';
  if (view === 'off') {
    return {
      view, tone: 'mute', icon: 'power', title: ft('offTitle'), sub: ft('offSub'), doText: ft('offDo'), canSend: false,
      lastLine: s.last_ok_at ? ft('offLast', { when: whenText(s.last_ok_at, now) }) : ft('offLastNone'),
      techLine: s.receiver_configured ? ft('techAllSet') : ft('techMissing'),
    };
  }
  if (view === 'nourl') {
    return {
      view, tone: 'warn', icon: 'warning', title: ft('nourlTitle'), sub: ft('nourlSub'),
      doText: s.receiver_problem === 'receiver_url_invalid' ? ft('nourlBad') : ft('nourlDo'), canSend: false,
      lastLine: ft('nourlLast'), techLine: ft('techMissing'),
    };
  }
  if (view === 'failed') {
    return {
      view, tone: 'bad', icon: 'warning', title: ft('failTitle'), sub: ft('failSub', { when: whenInSentence(s.last_attempt_at, now), next: nextText(s, now) }),
      doText: ft('failDo'), canSend: true,
      lastLine: `${last} · ${resultText(s.last_result as FleetResult)}${s.retry_h ? ` · הניסיון הבא ${nextText(s, now)}` : ''}`, techLine: ft('techReady'),
    };
  }
  if (!s.last_ok_at) {
    return {
      view, tone: 'ok', icon: 'info', title: ft('onFirstTitle'), sub: ft('onFirstSub'), doText: ft('onFirstDo'), canSend: true,
      lastLine: ft('nourlLast'), techLine: ft('techReady'),
    };
  }
  return {
    view, tone: 'ok', icon: 'check', title: ft('onTitle'), sub: ft('onSub', { when: lastOk, next: nextText(s, now) }), doText: ft('onDo'), canSend: true,
    lastLine: `${last} · ${ft('logOk')}${seq}`, techLine: ft('techReady'),
  };
}

export function resultText(r: FleetResult | null): string {
  switch (r) {
    case 'ok': return ft('logOk');
    case 'rejected': return ft('logRejected');
    case 'unreachable': return ft('logUnreachable');
    case 'schema_refused': return ft('logRefused');
    default: return '';
  }
}

export function resultTone(r: FleetResult): Tone {
  return r === 'ok' ? 'ok' : r === 'rejected' ? 'warn' : 'bad';
}

export interface LogLine { id: number; when: string; text: string; tone: Tone; seq: string }

export function logLines(rows: FleetLogRow[], now: Date = new Date()): LogLine[] {
  return rows.map((r) => ({
    id: r.id, when: whenText(r.at, now), tone: resultTone(r.result), seq: r.seq == null ? '' : String(r.seq),
    text: r.trigger === 'stop' ? `${ft('logStop')} · ${resultText(r.result)}` : resultText(r.result),
  }));
}

// ---------------------------------------------------------------- readiness

export function readyTitle(missing: number): string {
  return missing === 0 ? ft('readyTitleNone') : missing === 1 ? ft('readyTitleOne') : ft('readyTitle', { n: missing });
}

// ---------------------------------------------------------------- the silence threshold

export function silentProblem(value: string, range: [number, number]): string | null {
  const n = Number(value);
  if (value.trim() === '' || !Number.isInteger(n)) return ft('silentRange', { min: range[0], max: range[1] });
  return n < range[0] || n > range[1] ? ft('silentRange', { min: range[0], max: range[1] }) : null;
}

// ---------------------------------------------------------------- the 52 fields (CR-FLEET215 section 3, nothing more)

export type FieldType = 'const' | 'id' | 'num' | 'time' | 'enum' | 'bool' | 'version' | 'list';
export type FieldDef = readonly [label: string, path: string, type: FieldType];
export interface FieldGroup { id: string; title: FleetTextKey; sub?: FleetTextKey; fields: readonly FieldDef[] }

export const FIELD_GROUPS: readonly FieldGroup[] = [
  { id: 'report', title: 'g_report', sub: 'g_report_x', fields: [
    ['גרסת מבנה הדוח', 'schema', 'const'], ['מספר ההתקנה (אקראי)', 'installation_id', 'id'], ['מספר רץ של הדוח', 'seq', 'num'],
    ['מתי נוצר, לדקה', 'generated_at', 'time'], ['מערכת אמיתית או הדגמה', 'mode', 'enum'], ['נתוני דוגמה פועלים', 'demo_mode', 'bool'],
    ['מצב כללי', 'overall', 'enum'], ['שעות מאז ההדלקה', 'uptime_h', 'num'],
  ] },
  { id: 'versions', title: 'g_versions', sub: 'g_versions_x', fields: [
    ['Arx', 'versions.addon', 'version'], ['גשר', 'versions.bridge', 'version'], ['גשר נדרש', 'versions.bridge_required', 'version'],
    ['תשתית המערכת', 'versions.ha', 'version'], ['שרת מדיה', 'versions.go2rtc', 'version'], ['מסד נתונים', 'versions.db_schema', 'num'],
  ] },
  { id: 'components', title: 'g_components', sub: 'g_components_x', fields: [
    ['מסד נתונים', 'components.db', 'enum'], ['תיקיית נתונים', 'components.storage', 'enum'], ['מקליט', 'components.nvr', 'enum'],
    ['שרת מדיה', 'components.go2rtc', 'enum'], ['סנכרון עם תשתית המערכת', 'components.ha_sync', 'enum'], ['גשר', 'components.bridge', 'enum'],
    ['קליטת אירועים', 'components.events_ingest', 'enum'], ['עיבוד אירועים', 'components.events_derive', 'enum'],
    ['איתור התקנים', 'components.discovery', 'enum'], ['תמונות ממוזערות', 'components.thumbnails', 'enum'], ['ייצוא', 'components.exports', 'enum'],
    ['גיבויים', 'components.backups', 'enum'], ['Frigate', 'components.frigate', 'enum'],
  ] },
  { id: 'counts', title: 'g_counts', sub: 'g_counts_x', fields: [
    ['מצלמות', 'counts.cameras', 'num'], ['מקליטים', 'counts.recorders', 'num'], ['מקליטי Hikvision', 'counts.recorders_by_vendor.hikvision', 'num'],
    ['מקליטי Provision-ISR', 'counts.recorders_by_vendor.provision_isr', 'num'], ['שרתי Frigate', 'counts.recorders_by_vendor.frigate', 'num'],
    ['מצלמות בלי מקליט', 'counts.recorders_by_vendor.none', 'num'], ['התקנים בקטלוג', 'counts.ha_entities', 'num'],
    ['תוכניות קומה שפורסמו', 'counts.floors_published', 'num'], ['משתמשים פעילים', 'counts.users_active', 'num'], ['מנהלי מערכת', 'counts.system_admins', 'num'],
  ] },
  { id: 'alerts', title: 'g_alerts', sub: 'g_alerts_x', fields: [
    ['מידע', 'alerts_open.info', 'num'], ['רגילות', 'alerts_open.alert', 'num'], ['קריטיות', 'alerts_open.critical', 'num'],
  ] },
  { id: 'disk', title: 'g_disk', fields: [['אחוז פנוי', 'disk.free_pct', 'num'], ['GB פנויים', 'disk.free_gb', 'num'], ['GB בסך הכול', 'disk.total_gb', 'num']] },
  { id: 'backup', title: 'g_backup', fields: [
    ['כמה גיבויים', 'backup.count', 'num'], ['גיל הגיבוי האחרון, בשעות', 'backup.last_age_h', 'num'], ['כמה יעדים מחוץ לשרת', 'backup.offbox_targets', 'num'],
  ] },
  { id: 'update', title: 'g_update', fields: [['תוצאת בדיקת העדכון', 'update.check', 'enum'], ['יש עדכון', 'update.available', 'bool'], ['הגרסה החדשה ביותר', 'update.latest', 'version']] },
  { id: 'readiness', title: 'g_readiness', sub: 'g_readiness_x', fields: [
    ['ציון', 'readiness.score', 'num'], ['מוכנה למסירה', 'readiness.ready', 'bool'], ['מה חסר (מרשימה קבועה)', 'readiness.missing', 'list'],
  ] },
];

export const FIELD_COUNT = FIELD_GROUPS.reduce((n, g) => n + g.fields.length, 0);

export const FIELD_TYPE_KEY: Record<FieldType, FleetTextKey> = {
  const: 'ty_const', id: 'ty_id', num: 'ty_num', time: 'ty_time', enum: 'ty_enum', bool: 'ty_bool', version: 'ty_version', list: 'ty_list',
};

/** What the report never carries - the plain list the owner approved (one line of chips). */
export const NEVER_SENT: readonly string[] = [
  'שמות אנשים', 'שמות מצלמות וחדרים', 'כתובת הנכס', 'כתובות רשת', 'מספרים סידוריים', 'סיסמאות ומפתחות', 'קישורים', 'דוא״ל', 'טלפון',
  'אירועים', 'תמונות ווידאו', 'יומנים', 'טקסט שגיאה', 'מזהי התקנים', 'ערכי הגדרות',
];

/** The enrollment code shortened for a line of text ("arx-fleet-1.8c41…"), the full code stays in the copy button. */
export function shortCode(code: string): string {
  return code.length > 24 ? `${code.slice(0, 20)}…` : code;
}

/** The installation id as the page shows it: "8c41…e07b". */
export function shortId(id: string | null): string {
  return id && id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id ?? '';
}
