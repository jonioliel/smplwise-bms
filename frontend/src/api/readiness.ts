/** CR-READY96 slice 1: installation readiness (GET /readiness, POST /readiness/check, PUT /readiness/attest/{id}, GET/PUT /readiness/settings;
 * system.configure) and demo mode (GET /demo, POST /demo/start|extend|stop; demo.run, sensitive and in no built-in role). Without a backend (the
 * static preview) the same shapes come from the fixture at the bottom. */
import { get, post, put } from './client';

export type ReadinessStatus = 'ok' | 'attention' | 'blocked' | 'pending' | 'not_applicable';
export type ReadinessLevel = 'building' | 'almost' | 'ready';

export interface ReadinessFact {
  label: string;
  value: string;
  ok: boolean | null;
}

export interface ReadinessCheck {
  id: string;
  group: string;
  source: 'computed' | 'configured';
  title: string;
  weight: number;
  critical: boolean;
  status: ReadinessStatus;
  /** 0..1; null = not applicable. */
  fraction: number | null;
  summary: string;
  facts: ReadinessFact[];
  next: { label: string; href: string } | null;
  applicable: boolean;
  /** Points of the whole score this check would still add. */
  gain: number;
  checked_at: string;
}

export interface ReadinessNextStep {
  id: string;
  title: string;
  label: string;
  href: string;
  gain: number;
}

export interface ReadinessReport {
  score: number;
  level: ReadinessLevel;
  level_text: string;
  checks: ReadinessCheck[];
  checked_at: string;
  /** The hand-over threshold is ADVICE only (owner decision 24.10): `may_hand_over` is always true. */
  handover: { advice_score: number; advice_met: boolean; blockers: string[]; may_hand_over: boolean; done: boolean };
  next_steps: ReadinessNextStep[];
  bands: { almost_min: number; advice: number };
  history: { at: string; score: number; level: ReadinessLevel; blockers: string[] }[];
  settings: Record<string, string>;
  check_every_s: number;
}

export const getReadiness = () => get<ReadinessReport>('readiness');
export const runReadinessCheck = () => post<ReadinessReport>('readiness/check');
export const attestHandover = (done: boolean, customerName: string, note: string, printedGuide: boolean) =>
  put<ReadinessReport>('readiness/attest/handover', { done, customer_name: customerName, note, printed_guide: printedGuide });
export const saveReadinessSettings = (changes: Record<string, string>) =>
  put<{ settings: Record<string, string>; changed: string[] }>('readiness/settings', { changes, confirmed: true });

// ---------------------------------------------------------------- demo mode

export type DemoDataset = 'residential' | 'office' | 'retail';
export type DemoScenario = 'normal' | 'cameras_offline' | 'new_installation';

export interface DemoState {
  active: boolean;
  dataset?: DemoDataset;
  scenario?: DemoScenario;
  started_at?: string;
  expires_at?: string;
  started_by_name?: string;
}

export interface DemoInfo extends DemoState {
  can_run: boolean;
  datasets: DemoDataset[];
  scenarios: DemoScenario[];
  max_hours: number;
  allow_remote?: boolean;
}

export const getDemo = () => get<DemoInfo>('demo');
export const startDemo = (dataset: DemoDataset, scenario: DemoScenario, hours: number) => post<DemoState>('demo/start', { dataset, scenario, hours });
export const extendDemo = (hours: number) => post<DemoState>('demo/extend', { hours });
export const stopDemo = () => post<DemoState>('demo/stop');

export const DATASET_TEXT: Record<DemoDataset, string> = { residential: 'בית פרטי', office: 'משרד', retail: 'חנות' };
export const SCENARIO_TEXT: Record<DemoScenario, string> = { normal: 'יום רגיל', cameras_offline: 'מצלמות מנותקות', new_installation: 'התקנה חדשה' };
export const DEMO_HOURS = [1, 4, 8, 24] as const;

// ---------------------------------------------------------------- presentation helpers (pure, unit-tested)

export const STATUS_TEXT: Record<ReadinessStatus, string> = { ok: 'תקין', attention: 'דורש השלמה', blocked: 'חסם', pending: 'ממתין לאישור', not_applicable: 'לא רלוונטי' };
export const LEVEL_TEXT: Record<ReadinessLevel, string> = { building: 'בהקמה', almost: 'כמעט מוכן למסירה', ready: 'מוכן למסירה' };

export type KpiKey = 'all' | 'blocked' | 'attention' | 'ok' | 'pending' | 'not_applicable';
export const KPI_ORDER: KpiKey[] = ['all', 'blocked', 'attention', 'ok', 'pending', 'not_applicable'];
export const KPI_TEXT: Record<KpiKey, string> = { all: 'בדיקות', blocked: 'חסמים', attention: 'דורש השלמה', ok: 'תקין', pending: 'ממתין לאישור', not_applicable: 'לא רלוונטי' };

export function kpiCounts(checks: ReadinessCheck[]): Record<KpiKey, number> {
  const out: Record<KpiKey, number> = { all: checks.length, blocked: 0, attention: 0, ok: 0, pending: 0, not_applicable: 0 };
  for (const c of checks) out[c.status] += 1;
  return out;
}

export function filterChecks(checks: ReadinessCheck[], key: KpiKey): ReadinessCheck[] {
  return key === 'all' ? checks : checks.filter((c) => c.status === key);
}

/** The points this check contributes now / of how many (rounded to one decimal, as the page prints them). */
export function points(c: ReadinessCheck): { got: number; of: number } {
  const of = c.weight;
  const got = c.fraction === null ? 0 : Math.round(c.weight * c.fraction * 10) / 10;
  return { got, of };
}

/** The tone of the score ring and the hero: follows the level. */
export function levelTone(level: ReadinessLevel): 'danger' | 'warning' | 'success' {
  return level === 'ready' ? 'success' : level === 'almost' ? 'warning' : 'danger';
}

/** "+8" labels of the next steps; zero gains print nothing. */
export function gainText(gain: number): string {
  return gain > 0 ? `+${gain}` : '';
}

/** The time left of a demo, "3:42" (h:mm) or "0:09" under a minute is "0:00"; null once it is over. */
export function demoLeft(expiresAt: string | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

/** The editable thresholds the settings dialog lists, in order, with their Hebrew names and units. Weights are listed after them. */
export const THRESHOLD_FIELDS: { key: string; label: string; unit: string; min: number; max: number }[] = [
  { key: 'readiness.advice_score', label: 'ציון מסירה מומלץ', unit: 'נק׳', min: 1, max: 100 },
  { key: 'readiness.band_almost_min', label: 'מציון זה: כמעט מוכן', unit: 'נק׳', min: 1, max: 99 },
  { key: 'readiness.cameras_seen_hours', label: 'מצלמה נחשבת מאומתת אם נראתה ב־', unit: 'שעות', min: 1, max: 720 },
  { key: 'readiness.backup_max_age_days', label: 'גיל מרבי של גיבוי מקומי', unit: 'ימים', min: 1, max: 365 },
  { key: 'readiness.notify_days', label: 'ערוץ התראות נחשב מגיע אם נשלח ב־', unit: 'ימים', min: 1, max: 365 },
];

export function weightKey(checkId: string): string {
  return `readiness.weight.${checkId}`;
}

/** Which of the dialog's draft values differ from the saved ones (the PUT body). */
export function changedSettings(saved: Record<string, string>, draft: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft)) if (saved[k] !== v) out[k] = v;
  return out;
}

/** A draft value is valid when it is a whole number inside the range the server enforces (weights 0-100). */
export function validSetting(key: string, value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const n = Number(value);
  const f = THRESHOLD_FIELDS.find((x) => x.key === key);
  return f ? n >= f.min && n <= f.max : n >= 0 && n <= 100;
}

// ---------------------------------------------------------------- demo fixture (no backend)

const AT = '2026-10-24T08:30:00Z';
const fact = (label: string, value: string, ok: boolean | null): ReadinessFact => ({ label, value, ok });

export function demoReadiness(): ReadinessReport {
  const mk = (id: string, group: string, source: 'computed' | 'configured', title: string, weight: number, critical: boolean, fraction: number | null, status: ReadinessStatus, summary: string, facts: ReadinessFact[], next: ReadinessCheck['next'], gain: number): ReadinessCheck => ({
    id, group, source, title, weight, critical, status, fraction, summary, facts, next, applicable: fraction !== null, gain, checked_at: AT,
  });
  const checks: ReadinessCheck[] = [
    mk('cameras_connected', 'video', 'computed', 'מצלמות מחוברות', 12, true, 1, 'ok', '8 מתוך 8 מצלמות מחוברות.', [fact('מחוברות', '8/8', true)], null, 0),
    mk('cameras_verified', 'video', 'computed', 'מצלמות מאומתות', 12, false, 0.75, 'attention', '6 מתוך 8 מצלמות נראו ב-24 השעות האחרונות.', [fact('נראו לאחרונה', '6/8', false)], { label: 'בדיקת מצלמות באשף', href: '#/system/wizard' }, 3),
    mk('places', 'map', 'computed', 'קומות ומיקומים', 8, false, 1, 'ok', '2 מתוך 2 קומות עם תוכנית · 8/8 מצלמות ממוקמות.', [fact('קומות עם תוכנית מפורסמת', '2/2', true), fact('מצלמות על המפה', '8/8', true)], null, 0),
    mk('people', 'people', 'computed', 'אנשים והרשאות', 10, true, 1, 'ok', '1 מנהלי מערכת · 5 משתמשים עם תפקיד.', [fact('מנהל מערכת', '1', true), fact('משתמשים עם תפקיד', '5', true)], null, 0),
    mk('notifications', 'notify', 'computed', 'התראות', 10, false, 0.5, 'attention', '1 מתוך 2 ערוצים הגיעו ליעד ב-30 הימים האחרונים.', [fact('ערוצים שהוגדרו', '2', true), fact('הגיעו ליעד', '1', false)], { label: 'הגדרות התראות', href: '#/system/notifications' }, 5),
    mk('backup', 'data', 'computed', 'גיבוי', 12, true, 0.5, 'blocked', '2 מתוך 4 תנאי הגיבוי מתקיימים.', [fact('גיבוי מקומי מהימים האחרונים', 'כן', true), fact('גיבוי עם סיסמת גיבוי', 'כן', true), fact('תרגיל שחזור עבר', 'לא', false), fact('גיבוי מחוץ למכשיר נבדק', 'לא', false)], { label: 'גיבוי ושחזור', href: '#/system/diagnostics?tab=backup' }, 6),
    mk('remote', 'access', 'computed', 'גישה מרחוק', 8, false, null, 'not_applicable', 'הגישה מרחוק כבויה בהחלטה.', [], null, 0),
    mk('time', 'system', 'computed', 'שעון ואזור זמן', 4, false, 1, 'ok', 'אזור הזמן: Asia/Jerusalem.', [fact('אזור זמן', 'Asia/Jerusalem', true)], null, 0),
    mk('integrations', 'system', 'computed', 'חיבורים לתשתית', 10, false, 1, 'ok', '3 מתוך 3 חיבורים תקינים.', [], null, 0),
    mk('modules', 'modules', 'computed', 'מודולים פעילים', 8, false, null, 'not_applicable', 'אין מודולים אופציונליים פעילים.', [], null, 0),
    mk('handover', 'handover', 'configured', 'מסירה ללקוח', 6, false, 0, 'pending', 'המסירה ללקוח עדיין לא נרשמה.', [], null, 0),
  ];
  return {
    score: 84, level: 'almost', level_text: LEVEL_TEXT.almost, checks, checked_at: AT,
    handover: { advice_score: 90, advice_met: false, blockers: ['backup'], may_hand_over: true, done: false },
    next_steps: [{ id: 'backup', title: 'גיבוי', label: 'גיבוי ושחזור', href: '#/system/diagnostics?tab=backup', gain: 6 }, { id: 'notifications', title: 'התראות', label: 'הגדרות התראות', href: '#/system/notifications', gain: 5 }, { id: 'cameras_verified', title: 'מצלמות מאומתות', label: 'בדיקת מצלמות באשף', href: '#/system/wizard', gain: 3 }],
    bands: { almost_min: 50, advice: 90 },
    history: [{ at: '2026-10-24T08:30:00Z', score: 84, level: 'almost', blockers: ['backup'] }, { at: '2026-10-21T10:00:00Z', score: 71, level: 'almost', blockers: ['backup', 'people'] }],
    settings: { 'readiness.advice_score': '90', 'readiness.band_almost_min': '50', 'readiness.cameras_seen_hours': '24', 'readiness.backup_max_age_days': '7', 'readiness.notify_days': '30', ...Object.fromEntries(checks.map((c) => [weightKey(c.id), String(c.weight)])) },
    check_every_s: 30,
  };
}
