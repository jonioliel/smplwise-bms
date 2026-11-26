import type { HaActionRecord } from '../api/ha';

/**
 * PHYSICAL-CONFIRM-2540 (deep review 2520, SCR-18): the pure rules of the automation "device test" (automation-ext-dialogs.ts
 * `<kav-device-test>`), with no DOM so a Node unit spec pins them.
 *
 * A step (or the restore at the end) sends one device action per device. The 202 answer is a record that can still be `pending`; the
 * dialog follows it (api/ha `awaitAction`) and reads where it ended:
 *   confirmed            -> done     (the device reported the new state; "sent" when the device reports nothing - `confirmation: none`)
 *   failed / denied      -> error    (refused or failed: said in red, with the reason)
 *   unknown / pending    -> unknown  (no state report in the follow-up window: amber, "check on site" - never "done", never "failed")
 * A thrown error is `error` when the server refused before anything happened, else `unknown` (api/physical-outcome.ts).
 */
export type DeviceOutcome = 'done' | 'unknown' | 'error';

export function recordOutcome(r: Pick<HaActionRecord, 'status'>): DeviceOutcome {
  if (r.status === 'confirmed') return 'done';
  if (r.status === 'failed' || r.status === 'denied') return 'error';
  return 'unknown';
}

const RANK: Record<DeviceOutcome, number> = { done: 0, unknown: 1, error: 2 };

/** The outcome of a step over all its devices: the worst one (one refused device makes the step an error; one unknown, unknown). */
export function worstOutcome(all: readonly DeviceOutcome[]): DeviceOutcome {
  return all.reduce<DeviceOutcome>((w, o) => (RANK[o] > RANK[w] ? o : w), 'done');
}

/** Whether the next device of the same step is still sent: only after a device that did not refuse (an error stops the step). */
export function continueAfter(o: DeviceOutcome): boolean {
  return o !== 'error';
}

/** A step that sends a sensitive action (a lock, an alarm panel, a siren) runs only from its own confirmation - one per press. */
export function needsConfirm(step: { sensitive: boolean; entity_ids: readonly string[] }): boolean {
  return step.sensitive && step.entity_ids.length > 0;
}
