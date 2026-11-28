import { needsConfirmation, runNeedsConfirm, type Item } from './automations';
import { commandId } from './request-id';

/**
 * FIX-FE2-2570 (deep review 2.57, FE2-01): one way to start a scene or a script that may touch something sensitive (a lock, the alarm,
 * a siren, a WisKey door step). The server refuses such a run without `confirm: true` (409 `confirmation_required`,
 * services/automation_ops.py `apply_scene` / `_door_plan`); before this helper the scenes panel, the home launcher and the area quick
 * sheet had no way to confirm, so exactly those scenes could never be started there.
 *
 * The rule (the scripts panel's): an item the list marks sensitive / with unknown effects is asked about BEFORE anything is sent; any
 * other item is sent once, and when the server still answers `confirmation_required` (a door step the list does not show) the same
 * question is asked and, on yes, the request is sent ONE more time with `confirm: true` and the same request id. A "no" sends nothing.
 * Nothing else is ever re-sent: every other failure is thrown to the caller as it came (AGENTS.md: never retry a physical command).
 */
export type RunTarget = Pick<Item, 'id' | 'name' | 'sensitive' | 'unknown_effects' | 'targets'>;
export type RunSend<T> = (opts: { confirm?: boolean; client_request_id: string }) => Promise<T>;
/** Shows the confirmation (what will happen) and answers true only on an explicit yes. */
export type RunAsk = (item: RunTarget) => Promise<boolean>;
type RunConfirmed<T> = { sent: true; result: T } | { sent: false };

export async function runConfirmed<T>(item: RunTarget, send: RunSend<T>, ask: RunAsk): Promise<RunConfirmed<T>> {
  const client_request_id = commandId();
  if (runNeedsConfirm(item)) {
    if (!(await ask(item))) return { sent: false };
    return { sent: true, result: await send({ confirm: true, client_request_id }) };
  }
  try {
    return { sent: true, result: await send({ client_request_id }) };
  } catch (err) {
    if (!needsConfirmation(err)) throw err;
    if (!(await ask(item))) return { sent: false };
    return { sent: true, result: await send({ confirm: true, client_request_id }) };
  }
}
