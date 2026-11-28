import { setStepUpHandler, type StepUpDetails } from '../api/client';

/**
 * MFA-STEPUP-TRAIN-2490 slice 2: the shell's answer to the server's step-up gate. Every API call goes through api/client.ts; a 403
 * `step_up_required` from the central gate lands here, the code dialog (components/sw-step-up-dialog.ts, a lazy chunk - most sessions
 * never need it) asks for the current authenticator code, and a true answer makes the client send the original request once more.
 * Several requests refused at the same moment share ONE dialog and its answer. Installed once at boot, on both channels (the gate
 * also covers the local channel when `security.step_up_local` is on).
 */
/** Fired on window after a proof was recorded (the settings line "confirmed until ..." reads it again). */
export const STEP_UP_VERIFIED = 'sw-step-up-verified';

/**
 * CLIENT-RESILIENCE-2540 (review SCR-23 / FC-12): requests refused at the same moment share one dialog only when they were refused for
 * the SAME action (two saves of settings: one confirmation). A refusal for another action - or any once-action, whose proof is good
 * for exactly one call - waits for the open dialog to finish and then gets its own, worded for it; it is never answered by a dialog
 * that named something else.
 */
const open = new Map<string, Promise<boolean>>();
let queue: Promise<unknown> = Promise.resolve();
let onceSeq = 0;

function keyOf(details: StepUpDetails): string {
  return details.once ? `once:${++onceSeq}` : `action:${typeof details.action === 'string' ? details.action : ''}`;
}

/** The address the request was refused on ('' without a page - unit specs under node). */
function here(): string {
  try {
    return location.hash;
  } catch {
    return '';
  }
}

function askStepUp(details: StepUpDetails): Promise<boolean> {
  const key = keyOf(details);
  const known = open.get(key);
  if (known) return known;
  const at = here();
  const answer: Promise<boolean> = queue
    // FIX-FE2-2570 (review FE2-03): a refusal that waited behind another dialog belongs to the screen it came from - when the address
    // changed meanwhile, its dialog never opens and nothing is sent (as the open dialog's own SCR-23 route cancel)
    .then(() => (here() === at ? import('../components/sw-step-up-dialog').then((m) => m.stepUpDialog(details)) : false))
    .catch(() => false)
    .finally(() => {
      open.delete(key);
    });
  open.set(key, answer);
  queue = answer.catch(() => false);
  return answer;
}

export function installStepUp(): void {
  setStepUpHandler(askStepUp);
}
