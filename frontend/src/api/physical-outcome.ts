import { ApiError } from './client';

/**
 * PHYSICAL-CONFIRM-2540 (deep review 2520, SCR-15 / SCR-18; improvement note 2): how a screen reads a physical command that did not
 * answer with success - an NVR alarm-output pulse, a device step of the automation test. The rule of the stations screen
 * (screens/wiskey-stations-actions.ts `failure()`), for the routes that do not carry a structured `details.outcome`:
 *
 * - `refused`: the server (or the device through it) said no before anything happened - a 4xx answer (permission, validation, the
 *   recorder's writes switch, "the NVR rejected the document"), a structured `details.outcome` of `not_sent` / `refused`, or the
 *   recorder refusing the account (`source_forbidden`). Shown as a plain failure, in red.
 * - `unknown`: everything else - a dropped connection, a time-out, a proxy error, a 5xx after the command may have left. Shown in
 *   amber as "unknown, check on site before sending again"; never as "failed" and never as "done".
 *
 * Nothing here retries anything (AGENTS.md: never queue or blindly retry physical commands).
 */
export type PhysicalOutcome = 'refused' | 'unknown';

/** Error codes of a 5xx answer that still mean "refused, nothing was done" (services/nvr_write.py `_put`). */
const REFUSED_5XX = new Set(['source_forbidden']);

export function physicalOutcome(err: unknown): PhysicalOutcome {
  if (!(err instanceof ApiError)) return 'unknown'; // no answer at all (network, aborted): the command may have left
  const outcome = err.body?.details?.outcome;
  if (outcome === 'not_sent' || outcome === 'refused') return 'refused';
  if (outcome === 'unknown') return 'unknown';
  if (err.status >= 400 && err.status < 500) return 'refused';
  if (REFUSED_5XX.has(err.code)) return 'refused';
  return 'unknown';
}
