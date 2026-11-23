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

let pending: Promise<boolean> | null = null;

function askStepUp(details: StepUpDetails): Promise<boolean> {
  pending ??= import('../components/sw-step-up-dialog')
    .then((m) => m.stepUpDialog(details))
    .catch(() => false)
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function installStepUp(): void {
  setStepUpHandler(askStepUp);
}
