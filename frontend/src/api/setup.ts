/** Setup wizard (T071): GET /setup/state and POST /setup/check/{step} (system.configure). Without a backend (demo mode)
 * the same shapes come from the fixture below: five steps pass, the camera step waits for a placement, and "בדוק שוב"
 * on it finds the camera placed - so the design review sees both an explanation and the "ready" summary. */
import { get, post } from './client';

export type StepId = 'install' | 'nvr' | 'ha' | 'go2rtc' | 'floor' | 'camera';
/** not_applicable: skipped on purpose (NVR-less mode) - neither done nor failed, and not counted in `total`. */
export type StepStatus = 'done' | 'todo' | 'failed' | 'skipped' | 'not_applicable';

export interface SetupLink {
  href: string;
  label: string;
}

export interface SetupStep {
  id: StepId;
  index: number;
  title: string;
  status: StepStatus;
  summary: string;
  facts: { label: string; value: string; tone: '' | 'ok' | 'warn' | 'err' }[];
  evidence: Record<string, unknown>;
  problem: { code: string; message: string; action: string; link: SetupLink | null } | null;
  warnings: { code: string; message: string; link: SetupLink | null }[];
  settings_link: SetupLink;
  /** live = probed on demand; background = what the add-on's own jobs know; local = the add-on's database */
  source: 'live' | 'background' | 'local';
  checked_at: string;
  /** The pill text of a not_applicable step ("דילוג - מצב ללא NVR"). */
  status_label?: string;
}

export interface SetupState {
  version: string;
  /** NVR-less mode: the NVR and camera steps are not_applicable and `total` counts the remaining steps only. */
  mode?: 'full' | 'ha_only';
  checked_at: string;
  steps: SetupStep[];
  done: number;
  total: number;
  ready: boolean;
  next: StepId | null;
  thresholds: { drift_ok_s: number; drift_fail_s: number };
  check_every_s: number;
  live_ttl_s: number;
  checked?: StepId;
}

export const setupState = () => get<SetupState>('setup/state');
export const setupCheck = (step: StepId) => post<SetupState>(`setup/check/${step}`);

export const STATUS_TEXT: Record<StepStatus, string> = { done: 'הושלם', todo: 'לביצוע', failed: 'נכשל', skipped: 'ממתין לשלב קודם', not_applicable: 'דילוג' };

// ---------------------------------------------------------------- demo fixture (no backend)

const AT = '2026-09-29T08:30:00Z';
const f = (label: string, value: string, tone: '' | 'ok' | 'warn' | 'err' = '') => ({ label, value, tone });

function demoSteps(placed: boolean): SetupStep[] {
  const base = { warnings: [], problem: null, checked_at: AT };
  return [
    { ...base, id: 'install', index: 1, title: 'התקנת ה־Add-on', status: 'done', source: 'local', summary: 'גרסה 0.1.132 · בסיס הנתונים ו־/data תקינים',
      facts: [f('גרסה', '0.1.132'), f('מסד נתונים', 'תקין', 'ok'), f('תיקיית הנתונים (/data)', 'ניתנת לכתיבה · פנוי 41.2 GB מתוך 62.0 GB', 'ok'), f('מנהלי מערכת', '1', 'ok'), f('מקור הזהות', 'Home Assistant Ingress'), f('אזור הזמן של ההתקנה', 'Asia/Jerusalem')],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=health', label: 'הגדרות › כללי › בריאות ועבודות' } },
    { ...base, id: 'nvr', index: 2, title: 'חיבור ל־NVR', status: 'done', source: 'live', summary: 'DS-7616NI-Q2 · קושחה V4.84.000 · 10 ערוצים',
      facts: [f('דגם · קושחה', 'DS-7616NI-Q2 · V4.84.000', 'ok'), f('ערוצים', '10 · 10 מקוונים', 'ok'), f('ערוצים עם זרם ראשי ומשני', '10 מתוך 10', 'ok'), f('פרופילי וידאו שנמצאו', 'H.265 2560x1440 25fps · H.264 1920x1080 25fps'), f('שעון ה־NVR מול ה־Add-on', '+1 שנ׳', 'ok'), f('אזור זמן (היסט)', '+03:00 · צפוי +03:00 (Asia/Jerusalem)', 'ok')],
      evidence: {}, settings_link: { href: '#/system/setup', label: 'הגדרות › חיבורים' } },
    { ...base, id: 'ha', index: 3, title: 'Home Assistant והגשר', status: 'done', source: 'live', summary: 'Home Assistant 2026.9.3 · הגשר פעיל ומצומד · 412 ישויות',
      facts: [f('חיבור (WebSocket)', 'מחובר', 'ok'), f('גרסת Home Assistant', '2026.9.3'), f('ישויות בקטלוג', '412'), f('אינטגרציית הגשר', 'פעיל · גרסה 0.3.0'), f('צימוד הגשר', 'מצומד', 'ok'), f('ממתין להפעלה מחדש של HA', 'לא', 'ok'), f('שעון HA מול ה־Add-on', '0 שנ׳', 'ok'), f('שעון ה־NVR מול HA', '+1 שנ׳', 'ok')],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=ha', label: 'הגדרות › כללי › גשר Home Assistant' } },
    { ...base, id: 'go2rtc', index: 4, title: 'go2rtc (וידאו חי)', status: 'done', source: 'live', summary: 'go2rtc 1.9.9 · 20 זרמים שלנו (4 פעילים)',
      facts: [f('גרסה', '1.9.9', 'ok'), f('זרמי smplwise_ ב־go2rtc', '20 · 4 פעילים כרגע', 'ok'), f('זרמים צפויים (2 לכל מצלמה פעילה)', '20 · חסרים 0', 'ok'), f('זרמים של מוצרים אחרים', '6 · לא נוגעים בהם')],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=media', label: 'הגדרות › כללי › וידאו ומדיה' } },
    { ...base, id: 'floor', index: 5, title: 'קומה ותוכנית', status: 'done', source: 'local', summary: '2 קומות עם תוכנית מפורסמת',
      facts: [f('אתרים · מבנים · קומות', '1 · 1 · 3', 'ok'), f('קומות עם תוכנית מפורסמת', '2 מתוך 3', 'ok'), f('לדוגמה', 'מבנה א / קומת קרקע · מבנה א / קומה 1')],
      warnings: [{ code: 'floors_without_plan', message: 'ל־1 קומות אין עדיין תוכנית מפורסמת (למשל "מרתף").', link: { href: '#/explore/floors/f-2/import', label: 'ייבוא תוכנית' } }],
      evidence: {}, settings_link: { href: '#/explore/sites', label: 'מפה › אתרים ומבנים' } },
    placed
      ? { ...base, id: 'camera', index: 6, title: 'מצלמה על המפה', status: 'done', source: 'local', summary: '1 מצלמות מוצבות על המפה',
          facts: [f('מצלמות רשומות (פעילות)', '10 (10)', 'ok'), f('מוצבות על מפה', '1 מתוך 10', 'ok'), f('עם פרופיל זרם ידוע מה־NVR', '10 מתוך 10', 'ok')],
          warnings: [{ code: 'cameras_unplaced', message: '9 מצלמות עוד לא מוצבות (למשל "חניה").', link: { href: '#/explore/floors/f0/edit', label: 'עורך התוכנית (הצבת מצלמות)' } }],
          evidence: {}, settings_link: { href: '#/explore/floors/f0/edit', label: 'עורך התוכנית (הצבת מצלמות)' } }
      : { ...base, id: 'camera', index: 6, title: 'מצלמה על המפה', status: 'todo', source: 'local', summary: 'אף מצלמה עוד לא מוצבת על מפה.',
          facts: [f('מצלמות רשומות (פעילות)', '10 (10)', 'ok'), f('מוצבות על מפה', '0 מתוך 10', 'warn'), f('עם פרופיל זרם ידוע מה־NVR', '10 מתוך 10', 'ok')],
          problem: { code: 'no_camera_placed', message: 'אף מצלמה עוד לא מוצבת על מפה.', action: 'פתחו את עורך התוכנית, גררו מצלמה מהרשימה אל מקומה וכוונו את קונוס הראייה. ההצבה נשמרת ב־Arx בלבד.', link: { href: '#/explore/floors/f0/edit', label: 'עורך התוכנית (הצבת מצלמות)' } },
          evidence: {}, settings_link: { href: '#/explore/floors/f0/edit', label: 'עורך התוכנית (הצבת מצלמות)' } },
  ];
}

export function demoSetupState(placed = false, checked?: StepId): SetupState {
  const steps = demoSteps(placed);
  const done = steps.filter((s) => s.status === 'done').length;
  return {
    version: '0.1.132', checked_at: AT, steps, done, total: steps.length, ready: done === steps.length, next: steps.find((s) => s.status !== 'done')?.id ?? null,
    thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600, ...(checked ? { checked } : {}),
  };
}
