import { runConfirmed, type RunAsk, type RunSend, type RunTarget } from '../api/run-confirm';
import { physicalOutcome } from '../api/physical-outcome';

/**
 * RELEASE-2570-TRAIN (lead 28.11; FIX-FE2-2570 FE2-01 / FE2-04 / VD2-05 brought to the simple home screen's scene buttons): one scene
 * press through the shared `api/run-confirm.ts` rule and the shared unknown-outcome reading (`api/physical-outcome.ts`):
 *
 * - a scene the list marks sensitive / with unknown effects is asked about before anything is sent; any other scene is sent once, and a
 *   409 `confirmation_required` (FIX-AUTOMATION-2570: a member the list did not show as sensitive) asks and sends ONE more time with
 *   `confirm: true` and the same request id; "no" sends nothing (`sent: false`);
 * - a lost answer (no answer at all, 504 `config_timeout` with `details.outcome = "unknown"`, a 5xx after the request may have left) is
 *   `unknown` - the screen says so in amber, never "did not run", and nothing is sent again;
 * - a refusal (403 `grant_required` / `forbidden` / `step_up_required` after the dialog, 409, 422 ...) is `ok: false` with the server's
 *   sentence (`describe`).
 * `ok: true` means the server accepted the request (202): the devices' outcome is not known, so the screen says "request sent".
 */
export type SceneOutcome = { ok: boolean; sent: boolean; unknown: boolean; note: string | null };

export async function runHomeScene(item: RunTarget, send: RunSend<unknown>, ask: RunAsk, describe: (err: unknown) => string): Promise<SceneOutcome> {
  try {
    const r = await runConfirmed(item, send, ask);
    return r.sent ? { ok: true, sent: true, unknown: false, note: null } : { ok: false, sent: false, unknown: false, note: null };
  } catch (err) {
    if (physicalOutcome(err) === 'unknown') return { ok: false, sent: true, unknown: true, note: null };
    return { ok: false, sent: true, unknown: false, note: describe(err) };
  }
}
