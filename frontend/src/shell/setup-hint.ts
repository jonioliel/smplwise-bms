/**
 * 2.6.0 TKWIZHINT - the shell's "complete the installation" hint (the row under the tab row, the pill in the phone's user menu).
 *
 * Pure rules, no DOM and no network:
 *  - the hint counts REQUIRED steps only. A step the installation works without (floors and plan, a camera on the map) is
 *    `optional` (the server marks it, services/setup_wizard.py OPTIONAL_STEPS) and never keeps the hint alive;
 *  - once every required step is done there is no hint, whatever the optional steps say;
 *  - the dismissal is the user's own (/me/prefs `setup.hint`, api/setup-hint.ts) and survives refresh and login. It remembers which
 *    REQUIRED steps were failing at that moment: a required step that fails afterwards and was not in that set shows the hint again.
 */
import type { SetupState, SetupStep, StepId } from '../api/setup';

/** The same ids the backend marks optional - the fallback for a backend that does not send the `optional` field yet. */
export const OPTIONAL_STEP_IDS: readonly StepId[] = ['floor', 'camera'];

export const isOptionalStep = (s: Pick<SetupStep, 'id'> & { optional?: boolean }): boolean => s.optional ?? OPTIONAL_STEP_IDS.includes(s.id);

/** What the shell keeps of the wizard's state (also the payload of the `sw-setup-state` event). */
export interface SetupSummary {
  /** Every REQUIRED step done (and the installation supported). */
  ready: boolean;
  /** Required steps done / required steps in total (a step skipped on purpose, `not_applicable`, is in neither). */
  done: number;
  total: number;
  /** Required steps that are failing right now. */
  failed: StepId[];
  next: StepId | null;
}

/** The stored dismissal: the user hid the hint while `failed` required steps were failing. */
export interface SetupDismissal {
  dismissed: true;
  failed: StepId[];
}

/** Counts from the steps of a state (not from the server's `done` / `total`, which still count the optional steps too). */
export function summarizeSetup(s: Pick<SetupState, 'steps'> & { installation?: { supported?: boolean } | null }): SetupSummary {
  const required = s.steps.filter((x) => x.status !== 'not_applicable' && !isOptionalStep(x));
  const done = required.filter((x) => x.status === 'done').length;
  return {
    ready: done === required.length && s.installation?.supported !== false,
    done,
    total: required.length,
    failed: required.filter((x) => x.status === 'failed').map((x) => x.id),
    next: required.find((x) => x.status !== 'done')?.id ?? null,
  };
}

/** Whether the hint is drawn for this summary: something required is open, and the user has not hidden exactly this situation. */
export function hintVisible(sum: SetupSummary | null, dismissal: SetupDismissal | null): boolean {
  if (!sum || sum.ready || sum.total === 0) return false;
  if (!dismissal) return true;
  return sum.failed.some((id) => !dismissal.failed.includes(id)); // a newly failed required step brings it back
}

/** The dismissal to store now: the hint is hidden while these required steps fail. */
export function dismissalFor(sum: SetupSummary | null): SetupDismissal {
  return { dismissed: true, failed: sum ? [...sum.failed] : [] };
}

/** Reads the wire value of /me/prefs `setup.hint` (anything else = not dismissed). */
export function parseDismissal(v: unknown): SetupDismissal | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { dismissed?: unknown; failed?: unknown };
  if (o.dismissed !== true) return null;
  return { dismissed: true, failed: Array.isArray(o.failed) ? (o.failed.filter((x) => typeof x === 'string') as StepId[]) : [] };
}

export const SETUP_HINT_TEXT = {
  title: 'השלם את ההתקנה',
  progress: (done: number, total: number) => `${done} מתוך ${total} שלבים הושלמו`,
  toWizard: 'לאשף ההתקנה',
  dismiss: 'הסתר את ההתראה',
  show: 'הצג שוב את ההתראה',
  optional: 'אופציונלי',
} as const;
