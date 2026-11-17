/**
 * CR-FLEET215: the pure model of Settings › דיווח בריאות (no DOM; unit-tested in tests/unit-fleet-report.spec.ts): which of the four
 * pages the state stands for, the plain words of the answer card, the time wording, the log lines and the 52 listed fields.
 */
import type { FleetLogRow, FleetResult, FleetStatus } from '../api/fleet-report';
import { ft, type FleetTextKey } from '../i18n/fleet-report';
import { tr } from '../i18n/msg/misc';

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
  const day = dayWordOf(d, now);
  if (day === 'today') return tr('היום {time}', { time: clock(d) });
  if (day === 'yesterday') return tr('אתמול {time}', { time: clock(d) });
  if (day === 'tomorrow') return tr('מחר {time}', { time: clock(d) });
  return `${dateOf(d, now)} · ${clock(d)}`;
}

function dayWordOf(d: Date, now: Date): 'today' | 'yesterday' | 'tomorrow' | null {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return dayKey(d) === dayKey(now) ? 'today' : dayKey(d) === dayKey(y) ? 'yesterday' : dayKey(d) === dayKey(t) ? 'tomorrow' : null;
}

const dateOf = (d: Date, now: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}${d.getFullYear() === now.getFullYear() ? '' : `.${d.getFullYear()}`}`;

/** Inside a sentence: "היום בשעה 03:12" / "אתמול בשעה 03:11" / "ב-21.10 בשעה 03:11". */
export function whenInSentence(iso: string | null | undefined, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const day = dayWordOf(d, now);
  if (day === 'today') return tr('היום בשעה {time}', { time: clock(d) });
  if (day === 'yesterday') return tr('אתמול בשעה {time}', { time: clock(d) });
  if (day === 'tomorrow') return tr('מחר בשעה {time}', { time: clock(d) });
  return tr('ב-{date} בשעה {time}', { date: dateOf(d, now), time: clock(d) });
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
  return n ? whenInSentence(n.toISOString(), now) : tr('בקרוב');
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
  const seq = s.last_seq > 0 ? ` · ${tr('דוח מספר {n}', { n: s.last_seq })}` : '';
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
      lastLine: `${last} · ${resultText(s.last_result as FleetResult)}${s.retry_h ? ` · ${tr('הניסיון הבא {when}', { when: nextText(s, now) })}` : ''}`, techLine: ft('techReady'),
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
    [tr('גרסת מבנה הדוח'), 'schema', 'const'], [tr('מספר ההתקנה (אקראי)'), 'installation_id', 'id'], [tr('מספר רץ של הדוח'), 'seq', 'num'],
    [tr('מתי נוצר, לדקה'), 'generated_at', 'time'], [tr('מערכת אמיתית או הדגמה'), 'mode', 'enum'], [tr('נתוני דוגמה פועלים'), 'demo_mode', 'bool'],
    [tr('מצב כללי'), 'overall', 'enum'], [tr('שעות מאז ההדלקה'), 'uptime_h', 'num'],
  ] },
  { id: 'versions', title: 'g_versions', sub: 'g_versions_x', fields: [
    ['Arx', 'versions.addon', 'version'], [tr('גשר'), 'versions.bridge', 'version'], [tr('גשר נדרש'), 'versions.bridge_required', 'version'],
    [tr('תשתית המערכת'), 'versions.ha', 'version'], [tr('שרת מדיה'), 'versions.go2rtc', 'version'], [tr('מסד נתונים'), 'versions.db_schema', 'num'],
  ] },
  { id: 'components', title: 'g_components', sub: 'g_components_x', fields: [
    [tr('מסד נתונים'), 'components.db', 'enum'], [tr('תיקיית נתונים'), 'components.storage', 'enum'], [tr('מקליט'), 'components.nvr', 'enum'],
    [tr('שרת מדיה'), 'components.go2rtc', 'enum'], [tr('סנכרון עם תשתית המערכת'), 'components.ha_sync', 'enum'], [tr('גשר'), 'components.bridge', 'enum'],
    [tr('קליטת אירועים'), 'components.events_ingest', 'enum'], [tr('עיבוד אירועים'), 'components.events_derive', 'enum'],
    [tr('איתור התקנים'), 'components.discovery', 'enum'], [tr('תמונות ממוזערות'), 'components.thumbnails', 'enum'], [tr('ייצוא'), 'components.exports', 'enum'],
    [tr('גיבויים'), 'components.backups', 'enum'], ['Frigate', 'components.frigate', 'enum'],
  ] },
  { id: 'counts', title: 'g_counts', sub: 'g_counts_x', fields: [
    [tr('מצלמות'), 'counts.cameras', 'num'], [tr('מקליטים'), 'counts.recorders', 'num'], [tr('מקליטי Hikvision'), 'counts.recorders_by_vendor.hikvision', 'num'],
    [tr('מקליטי Provision-ISR'), 'counts.recorders_by_vendor.provision_isr', 'num'], [tr('שרתי Frigate'), 'counts.recorders_by_vendor.frigate', 'num'],
    [tr('מצלמות בלי מקליט'), 'counts.recorders_by_vendor.none', 'num'], [tr('התקנים בקטלוג'), 'counts.ha_entities', 'num'],
    [tr('תוכניות קומה שפורסמו'), 'counts.floors_published', 'num'], [tr('משתמשים פעילים'), 'counts.users_active', 'num'], [tr('מנהלי מערכת'), 'counts.system_admins', 'num'],
  ] },
  { id: 'alerts', title: 'g_alerts', sub: 'g_alerts_x', fields: [
    [tr('מידע'), 'alerts_open.info', 'num'], [tr('רגילות'), 'alerts_open.alert', 'num'], [tr('קריטיות'), 'alerts_open.critical', 'num'],
  ] },
  { id: 'disk', title: 'g_disk', fields: [[tr('אחוז פנוי'), 'disk.free_pct', 'num'], [tr('GB פנויים'), 'disk.free_gb', 'num'], [tr('GB בסך הכול'), 'disk.total_gb', 'num']] },
  { id: 'backup', title: 'g_backup', fields: [
    [tr('כמה גיבויים'), 'backup.count', 'num'], [tr('גיל הגיבוי האחרון, בשעות'), 'backup.last_age_h', 'num'], [tr('כמה יעדים מחוץ לשרת'), 'backup.offbox_targets', 'num'],
  ] },
  { id: 'update', title: 'g_update', fields: [[tr('תוצאת בדיקת העדכון'), 'update.check', 'enum'], [tr('יש עדכון'), 'update.available', 'bool'], [tr('הגרסה החדשה ביותר'), 'update.latest', 'version']] },
  { id: 'readiness', title: 'g_readiness', sub: 'g_readiness_x', fields: [
    [tr('ציון'), 'readiness.score', 'num'], [tr('מוכנה למסירה'), 'readiness.ready', 'bool'], [tr('מה חסר (מרשימה קבועה)'), 'readiness.missing', 'list'],
  ] },
];

export const FIELD_COUNT = FIELD_GROUPS.reduce((n, g) => n + g.fields.length, 0);

export const FIELD_TYPE_KEY: Record<FieldType, FleetTextKey> = {
  const: 'ty_const', id: 'ty_id', num: 'ty_num', time: 'ty_time', enum: 'ty_enum', bool: 'ty_bool', version: 'ty_version', list: 'ty_list',
};

/** What the report never carries - the plain list the owner approved (one line of chips). */
export const NEVER_SENT: readonly string[] = [
  tr('שמות אנשים'), tr('שמות מצלמות וחדרים'), tr('כתובת הנכס'), tr('כתובות רשת'), tr('מספרים סידוריים'), tr('סיסמאות ומפתחות'), tr('קישורים'), tr('דוא״ל'), tr('טלפון'),
  tr('אירועים'), tr('תמונות ווידאו'), tr('יומנים'), tr('טקסט שגיאה'), tr('מזהי התקנים'), tr('ערכי הגדרות'),
];

/** The enrollment code shortened for a line of text ("arx-fleet-1.8c41…"), the full code stays in the copy button. */
export function shortCode(code: string): string {
  return code.length > 24 ? `${code.slice(0, 20)}…` : code;
}

/** The installation id as the page shows it: "8c41…e07b". */
export function shortId(id: string | null): string {
  return id && id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id ?? '';
}
