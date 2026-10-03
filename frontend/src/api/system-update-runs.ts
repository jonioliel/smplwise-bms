/**
 * CR-021 S3: apply the update, restart the platform, follow a run (backend: routers/system_update.py). One permission,
 * `system.update`, covers both. Plain confirmation (`confirm: true`), no typed word. Texts are plain Hebrew; the platform is
 * "תשתית המערכת" (this is a settings screen, but the wording rule holds anyway).
 */
import { ApiError, api, get, post } from './client';

export type RunKind = 'update' | 'platform_restart';
export type RunState = 'requested' | 'backing_up' | 'updating' | 'restarting' | 'verifying' | 'succeeded' | 'failed' | 'abandoned';
export const TERMINAL_STATES: readonly RunState[] = ['succeeded', 'failed', 'abandoned'];

/** What `GET /runs/{id}` answers (the status screen polls it). */
export interface RunView {
  run_id: string;
  kind: RunKind;
  state: RunState;
  step: string | null;
  started_at: string;
  finished_at: string | null;
  from_version: string | null;
  to_version: string | null;
  backup: boolean;
  error_code: string | null;
  timeout_s: number;
}

/** The open run inside `GET /state` (same fields, fewer of them). */
export type RunRef = Partial<RunView> & { id?: string; run_id?: string; kind: RunKind; state: RunState };

export interface RestartReason {
  /** bridge | wiskey | release */
  code: string;
  version?: string | null;
}

export const isTerminal = (s: string | null | undefined): boolean => !!s && (TERMINAL_STATES as readonly string[]).includes(s);

/** One unique key per dialog opening: a double click or a retry of the same confirmation replays the same run. */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* an insecure context has no randomUUID */
  }
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10).padEnd(8, '0')).join('-');
}

export const applyUpdate = (body: { target_version: string; backup: boolean; idempotency_key: string }) =>
  api<RunView>('system/update/apply', { method: 'POST', body: JSON.stringify({ ...body, confirm: true }) });
export const restartPlatform = (idempotency_key: string) => api<RunView>('system/update/restart-platform', { method: 'POST', body: JSON.stringify({ confirm: true, idempotency_key }) });
export const getRun = (runId: string) => get<RunView>(`system/update/runs/${encodeURIComponent(runId)}`);
/** The Arx-only restart (the shared helper of the "הפעלות מחדש" card; the route is the add-on restart's). 202: the process ends after the answer. */
export const restartArx = () => post<{ restarting: true }>('system/restart', { confirm: true });

export type RunFailure =
  | { kind: 'in_progress' }
  | { kind: 'not_available' }
  | { kind: 'version_mismatch' }
  | { kind: 'busy' }
  | { kind: 'nvr_write' }
  | { kind: 'key_reused' }
  | { kind: 'too_soon'; wait: number | null }
  | { kind: 'not_permitted' }
  | { kind: 'unreachable' }
  | { kind: 'forbidden' }
  | { kind: 'manual' }
  | { kind: 'error'; message: string };

/** Sorts a refused apply / restart request into the states the screen words (the server's text is only the last fallback). */
export function classifyRunError(err: unknown): RunFailure {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'update_in_progress': return { kind: 'in_progress' };
      case 'update_not_available': return { kind: 'not_available' };
      case 'target_version_mismatch': return { kind: 'version_mismatch' };
      case 'platform_busy': return { kind: 'busy' };
      case 'nvr_write_in_progress': return { kind: 'nvr_write' };
      case 'idempotency_key_reused': return { kind: 'key_reused' };
      case 'platform_not_permitted': return { kind: 'not_permitted' };
      case 'infrastructure_unreachable': return { kind: 'unreachable' };
      case 'restart_manual': return { kind: 'manual' };
      case 'rate_limited': {
        const w = Number((err.body.details ?? {})['retry_after_s']);
        return { kind: 'too_soon', wait: Number.isFinite(w) && w > 0 ? w : null };
      }
      case 'forbidden':
      case 'cross_site_refused':
        return { kind: 'forbidden' };
      default:
        if (err.status === 429) return { kind: 'too_soon', wait: null };
        if (err.status === 403) return { kind: 'forbidden' };
        if (err.status === 404) return { kind: 'manual' };
        return { kind: 'error', message: err.body.user_message || '' };
    }
  }
  return { kind: 'error', message: '' };
}

/** Plain-language text of a refused request. */
export function runFailureRequestText(f: RunFailure, what: 'update' | 'restart' = 'update'): string {
  switch (f.kind) {
    case 'in_progress': return 'עדכון או הפעלה מחדש אחרת עדיין מתבצעים.';
    case 'not_available': return 'אין עדכון זמין. בדקו שוב אם יש עדכון.';
    case 'version_mismatch': return 'הגרסה האחרונה השתנתה. בדקו שוב אם יש עדכון.';
    case 'busy': return 'תשתית המערכת עסוקה כרגע. נסו שוב בעוד כמה דקות.';
    case 'nvr_write': return 'מתבצעת כעת פעולה במכשירי ההקלטה. נסו שוב כשתסתיים.';
    case 'key_reused': return 'הבקשה כבר נשלחה. רעננו את העמוד.';
    case 'too_soon': return f.wait ? `עדכון הופעל לאחרונה. נסו שוב בעוד ${Math.max(1, Math.ceil(f.wait / 60))} דקות.` : 'עדכון הופעל לאחרונה. נסו שוב בעוד כמה דקות.';
    case 'not_permitted': return what === 'update' ? 'ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.' : 'חסרה הרשאה בתשתית המערכת, ולכן אי אפשר להפעיל אותה מחדש.';
    case 'unreachable': return 'תשתית המערכת אינה זמינה כרגע.';
    case 'forbidden': return 'אין הרשאה לבצע את הפעולה.';
    case 'manual': return 'אי אפשר להפעיל מחדש מכאן. יש להפעיל את השירות ידנית.';
    default: return f.message || 'הפעולה נכשלה. נסו שוב.';
  }
}

export interface RunStep {
  id: 'backup' | 'install' | 'restart' | 'verify' | 'config' | 'platform';
  label: string;
}
const UPDATE_STEPS: RunStep[] = [
  { id: 'backup', label: 'גיבוי' },
  { id: 'install', label: 'הורדה והתקנה' },
  { id: 'restart', label: 'הפעלה מחדש' },
  { id: 'verify', label: 'בדיקת תקינות' },
];
const PLATFORM_STEPS: RunStep[] = [
  { id: 'config', label: 'בדיקת תצורה' },
  { id: 'platform', label: 'הפעלה מחדש של תשתית המערכת' },
  { id: 'verify', label: 'בדיקת תקינות' },
];

/** The steps of a run (no backup step when none was taken) and the index of the one in progress (steps.length once all are done). */
export function runSteps(run: Pick<RunView, 'kind' | 'state' | 'backup'>): { steps: RunStep[]; current: number } {
  if (run.kind === 'platform_restart') {
    const current = run.state === 'succeeded' ? 3 : run.state === 'verifying' ? 2 : run.state === 'restarting' ? 1 : 0;
    return { steps: PLATFORM_STEPS, current };
  }
  const steps = run.backup ? UPDATE_STEPS : UPDATE_STEPS.filter((s) => s.id !== 'backup');
  const id = run.state === 'backing_up' ? 'backup' : run.state === 'verifying' ? 'verify' : run.state === 'restarting' ? 'restart' : 'install';
  const current = run.state === 'succeeded' ? steps.length : Math.max(0, steps.findIndex((s) => s.id === id));
  return { steps, current };
}

/** Why a finished run did not succeed, in plain Hebrew (the codes are the backend's fixed vocabulary). */
export function runFailureText(run: Pick<RunView, 'kind' | 'state' | 'error_code'>): string {
  if (run.state === 'abandoned') return run.kind === 'update' ? 'העדכון לא הסתיים בזמן. ייתכן שהוא עדיין מתבצע או שנעצר באמצע.' : 'ההפעלה מחדש לא הסתיימה בזמן.';
  switch (run.error_code) {
    case 'platform_not_permitted': return 'ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.';
    case 'infrastructure_unreachable': return 'תשתית המערכת אינה זמינה, ולכן הפעולה לא בוצעה.';
    case 'infrastructure_busy': return 'תשתית המערכת עסוקה. הפעולה לא בוצעה. נסו שוב בעוד כמה דקות.';
    case 'infrastructure_error': return 'תשתית המערכת החזירה שגיאה, והפעולה לא הושלמה.';
    case 'update_job_failed': return 'ההורדה או ההתקנה נכשלו. הגרסה הקודמת נשארה במקומה.';
    case 'version_unchanged': return 'העדכון לא הוחל: המערכת חזרה באותה גרסה.';
    case 'version_unexpected': return 'המערכת חזרה בגרסה לא צפויה.';
    case 'interrupted': return 'הפעולה נקטעה לפני שהסתיימה.';
    case 'restart_loop': return 'הגרסה החדשה לא עולה כראוי והמערכת מופעלת מחדש שוב ושוב.';
    case 'health_check_failed': return 'המערכת התעדכנה אך בדיקת התקינות נכשלה.';
    case 'timeout': return 'הפעולה לא הסתיימה בזמן.';
    case 'platform_config_invalid': return 'בדיקת התצורה של תשתית המערכת נכשלה, ולכן לא בוצעה הפעלה מחדש. תקנו את התצורה ונסו שוב.';
    case 'platform_not_back': return 'תשתית המערכת לא חזרה לפעולה בזמן.';
    case 'bridge_not_loaded': return 'תשתית המערכת חזרה, אך הגשר שלה לא נטען.';
    default: return 'הפעולה נכשלה.';
  }
}

/** The outcomes that leave the platform or the add-on in a state the rollback guidance applies to (an update that may have changed the version). */
export const needsRollbackGuidance = (run: Pick<RunView, 'kind' | 'state' | 'error_code'>): boolean =>
  run.kind === 'update' && (run.state === 'abandoned' || ['version_unchanged', 'version_unexpected', 'interrupted', 'restart_loop', 'health_check_failed', 'timeout', 'update_job_failed'].includes(run.error_code ?? ''));

/** The rollback guidance (CR-021 section 3.3 / design section 6): text only, no restore button (owner decision). */
export const ROLLBACK_STEPS: string[] = [
  'בדפי הגיבויים של תשתית המערכת, בחרו את הגיבוי "לפני העדכון" ושחזרו ממנו את התוסף SmplWise Arx. השחזור מחזיר יחד את הגרסה והנתונים.',
  'לחלופין, התקינו מחדש את הגרסה הקודמת ושחזרו ב-Arx, בהגדרות › גיבוי, את הקובץ האחרון שנקרא "auto-pre-upgrade".',
  'אם Arx אינו עולה: בדפי התוספים של תשתית המערכת הפעילו אותו, או שחזרו את הגיבוי.',
];
