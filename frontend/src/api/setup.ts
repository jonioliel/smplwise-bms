/** Setup wizard (T071): GET /setup/state and POST /setup/check/{step} (system.configure). Without a backend (demo mode)
 * the same shapes come from the fixture below: five steps pass, the camera step waits for a placement, and "בדוק שוב"
 * on it finds the camera placed - so the design review sees both an explanation and the "ready" summary. */
import { get, path, post } from './client';
import type { InstallationBlock } from './health';
import { summarizeSetup } from '../shell/setup-hint';
import { tr } from '../i18n/msg/api-system';

export type StepId = 'install' | 'nvr' | 'ha' | 'go2rtc' | 'floor' | 'camera';
/** not_applicable: skipped on purpose (NVR-less mode) - neither done nor failed, and not counted in `total`. */
export type StepStatus = 'done' | 'todo' | 'failed' | 'skipped' | 'not_applicable';

interface SetupLink {
  href: string;
  label: string;
}

export interface SetupStep {
  id: StepId;
  index: number;
  title: string;
  /** TKWIZHINT: the installation works without this step - shown in the wizard (labelled optional), never counted by the shell hint. Absent from an older backend (shell/setup-hint.ts falls back to floor + camera). */
  optional?: boolean;
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
  /** TKWIZHINT: the same counts over the REQUIRED steps only; `ready` and `next` follow the required steps too. */
  required_done?: number;
  required_total?: number;
  required_failed?: StepId[];
  ready: boolean;
  next: StepId | null;
  thresholds: { drift_ok_s: number; drift_fail_s: number };
  check_every_s: number;
  live_ttl_s: number;
  checked?: StepId;
  /** NN1: an NVR without a media server is not a supported installation - the wizard never reaches "ready" and says why. */
  installation?: InstallationBlock;
}

export const setupState = () => get<SetupState>('setup/state');
export const setupCheck = (step: StepId) => post<SetupState>(path`setup/check/${step}`);

export const STATUS_TEXT: Record<StepStatus, string> = { done: tr('הושלם'), todo: tr('לביצוע'), failed: tr('נכשל'), skipped: tr('ממתין לשלב קודם'), not_applicable: tr('דילוג') };

// ---------------------------------------------------------------- demo fixture (no backend)

const AT = '2026-09-29T08:30:00Z';
const f = (label: string, value: string, tone: '' | 'ok' | 'warn' | 'err' = '') => ({ label, value, tone });

function demoSteps(placed: boolean): SetupStep[] {
  const base = { warnings: [], problem: null, checked_at: AT };
  return [
    { ...base, id: 'install', index: 1, title: tr('התקנת ה־Add-on'), status: 'done', source: 'local', summary: tr('גרסה 0.1.132 · בסיס הנתונים ו־/data תקינים'),
      facts: [f(tr('גרסה'), '0.1.132'), f(tr('מסד נתונים'), tr('תקין'), 'ok'), f(tr('תיקיית הנתונים (/data)'), tr('ניתנת לכתיבה · פנוי 41.2 GB מתוך 62.0 GB'), 'ok'), f(tr('מנהלי מערכת'), '1', 'ok'), f(tr('מקור הזהות'), 'Home Assistant Ingress'), f(tr('אזור הזמן של ההתקנה'), 'Asia/Jerusalem')],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=health', label: tr('הגדרות ‹ כללי ‹ בריאות ועבודות') } },
    { ...base, id: 'nvr', index: 2, title: tr('חיבור ל־NVR'), status: 'done', source: 'live', summary: tr('DS-7616NI-Q2 · קושחה V4.84.000 · 10 ערוצים'),
      facts: [f(tr('דגם · קושחה'), 'DS-7616NI-Q2 · V4.84.000', 'ok'), f(tr('ערוצים'), tr('10 · 10 מקוונים'), 'ok'), f(tr('ערוצים עם זרם ראשי ומשני'), tr('10 מתוך 10'), 'ok'), f(tr('פרופילי וידאו שנמצאו'), 'H.265 2560x1440 25fps · H.264 1920x1080 25fps'), f(tr('שעון ה־NVR מול ה־Add-on'), tr('+1 שנ׳'), 'ok'), f(tr('אזור זמן (היסט)'), tr('+03:00 · צפוי +03:00 (Asia/Jerusalem)'), 'ok')],
      evidence: {}, settings_link: { href: '#/system/setup', label: tr('הגדרות ‹ חיבורים') } },
    { ...base, id: 'ha', index: 3, title: tr('Home Assistant והגשר'), status: 'done', source: 'live', summary: tr('Home Assistant 2026.9.3 · הגשר פעיל ומצומד · 412 ישויות'),
      facts: [f(tr('חיבור (WebSocket)'), tr('מחובר'), 'ok'), f(tr('גרסת Home Assistant'), '2026.9.3'), f(tr('ישויות בקטלוג'), '412'), f(tr('אינטגרציית הגשר'), tr('פעיל · גרסה 0.3.0')), f(tr('צימוד הגשר'), tr('מצומד'), 'ok'), f(tr('ממתין להפעלה מחדש של HA'), tr('לא'), 'ok'), f(tr('שעון HA מול ה־Add-on'), tr('0 שנ׳'), 'ok'), f(tr('שעון ה־NVR מול HA'), tr('+1 שנ׳'), 'ok')],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=ha', label: tr('הגדרות ‹ כללי ‹ גשר Arx') } },
    { ...base, id: 'go2rtc', index: 4, title: tr('go2rtc (וידאו חי)'), status: 'done', source: 'live', summary: tr('go2rtc 1.9.9 · 20 זרמים שלנו (4 פעילים)'),
      facts: [f(tr('גרסה'), '1.9.9', 'ok'), f(tr('זרמי smplwise_ ב־go2rtc'), tr('20 · 4 פעילים כרגע'), 'ok'), f(tr('זרמים צפויים (2 לכל מצלמה פעילה)'), tr('20 · חסרים 0'), 'ok'), f(tr('זרמים של מוצרים אחרים'), tr('6 · לא נוגעים בהם'))],
      evidence: {}, settings_link: { href: '#/system/diagnostics?tab=media', label: tr('הגדרות ‹ כללי ‹ וידאו ומדיה') } },
    { ...base, id: 'floor', index: 5, title: tr('קומה ותוכנית'), status: 'done', source: 'local', summary: tr('2 קומות עם תוכנית מפורסמת'),
      // i18n-keep-start: demo data: invented names, as the api demo stores
      facts: [f(tr('אתרים · מבנים · קומות'), '1 · 1 · 3', 'ok'), f(tr('קומות עם תוכנית מפורסמת'), tr('2 מתוך 3'), 'ok'), f(tr('לדוגמה'), 'מבנה א / קומת קרקע · מבנה א / קומה 1')],
      warnings: [{ code: 'floors_without_plan', message: tr('ל־{n} קומות אין עדיין תוכנית מפורסמת (למשל "{name}").', { n: 1, name: 'מרתף' }), link: { href: '#/explore/floors/f-2/import', label: tr('ייבוא תוכנית') } }],
      // i18n-keep-end
      evidence: {}, settings_link: { href: '#/explore/sites', label: tr('מפה ‹ אתרים ומבנים') } },
    placed
      ? { ...base, id: 'camera', index: 6, title: tr('מצלמה על המפה'), status: 'done', source: 'local', summary: tr('1 מצלמות מוצבות על המפה'),
          facts: [f(tr('מצלמות רשומות (פעילות)'), '10 (10)', 'ok'), f(tr('מוצבות על מפה'), tr('1 מתוך 10'), 'ok'), f(tr('עם פרופיל זרם ידוע מה־NVR'), tr('10 מתוך 10'), 'ok')],
          // i18n-keep: demo data: invented names, as the api demo stores
          warnings: [{ code: 'cameras_unplaced', message: tr('{n} מצלמות עוד לא מוצבות (למשל "{name}").', { n: 9, name: 'חניה' }), link: { href: '#/explore/floors/f0/edit', label: tr('עורך התוכנית (הצבת מצלמות)') } }],
          evidence: {}, settings_link: { href: '#/explore/floors/f0/edit', label: tr('עורך התוכנית (הצבת מצלמות)') } }
      : { ...base, id: 'camera', index: 6, title: tr('מצלמה על המפה'), status: 'todo', source: 'local', summary: tr('אף מצלמה עוד לא מוצבת על מפה.'),
          facts: [f(tr('מצלמות רשומות (פעילות)'), '10 (10)', 'ok'), f(tr('מוצבות על מפה'), tr('0 מתוך 10'), 'warn'), f(tr('עם פרופיל זרם ידוע מה־NVR'), tr('10 מתוך 10'), 'ok')],
          problem: { code: 'no_camera_placed', message: tr('אף מצלמה עוד לא מוצבת על מפה.'), action: tr('פתחו את עורך התוכנית, גררו מצלמה מהרשימה אל מקומה וכוונו את קונוס הראייה. ההצבה נשמרת ב־Arx בלבד.'), link: { href: '#/explore/floors/f0/edit', label: tr('עורך התוכנית (הצבת מצלמות)') } },
          evidence: {}, settings_link: { href: '#/explore/floors/f0/edit', label: tr('עורך התוכנית (הצבת מצלמות)') } },
  ];
}

export function demoSetupState(placed = false, checked?: StepId): SetupState {
  const steps = demoSteps(placed);
  const done = steps.filter((s) => s.status === 'done').length;
  return {
    version: '0.1.132', checked_at: AT, steps, done, total: steps.length, ready: summarizeSetup({ steps }).ready, next: steps.find((s) => s.status !== 'done')?.id ?? null,
    thresholds: { drift_ok_s: 2, drift_fail_s: 30 }, check_every_s: 5, live_ttl_s: 600, ...(checked ? { checked } : {}),
  };
}
