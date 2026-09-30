/**
 * CR-015: one deliberate press -> one command -> an honest outcome (MEDIA_API.md §3.4, CR §5.3). Shared by the screen card
 * and the screens page (S3's remote has its own press handling on the same `sendCommand`).
 *
 * `runCommand` sends ONE command with a fresh request id (never retried, never queued), and for an `accepted` command waits for
 * the screen to confirm it (GET /ha/actions/{id}) for at most 8 s - then "המסך לא אישר את הפקודה" and the caller shows the last
 * CONFIRMED state again (the next state push or refetch decides the truth, never the press). Keys, text and steps (`sent`) have
 * nothing to confirm. Without a backend (the static demo) the mock answers at once.
 */
import { ApiError } from '../api/client';
import { getAction } from '../api/ha';
import { isApi } from '../api/session';
import { CONFIRM_TIMEOUT_MS, ERROR_LABEL, sendCommand, type MediaCommand } from '../api/media-screens';

export type Outcome = 'confirmed' | 'sent' | 'not_confirmed' | 'refused' | 'rate_limited';

export interface CommandOutcome {
  outcome: Outcome;
  /** The operator-facing sentence for anything but confirmed / sent (short, Hebrew). */
  message: string;
  code: string | null;
}

const POLL_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The sentence for an error code (client ERROR_LABEL), else the server's own message. */
export function errorText(err: unknown): { code: string | null; message: string } {
  if (err instanceof ApiError) return { code: err.code, message: ERROR_LABEL[err.code] ?? err.body.user_message ?? 'הפעולה נכשלה' };
  return { code: null, message: 'אין חיבור לשרת' };
}

export async function runCommand(key: string, cmd: MediaCommand, onSent?: () => void): Promise<CommandOutcome> {
  let result;
  try {
    result = await sendCommand(key, cmd);
  } catch (err) {
    const { code, message } = errorText(err);
    return { outcome: code === 'rate_limited' ? 'rate_limited' : 'refused', message, code };
  }
  onSent?.();
  if (result.status === 'refused') {
    return { outcome: 'refused', message: (result.error && ERROR_LABEL[result.error]) || 'המסך דחה את הפקודה', code: result.error };
  }
  if (result.status === 'sent' || result.confirm === 'none') return { outcome: 'sent', message: '', code: null };
  if (!result.action_id || !isApi()) return { outcome: 'confirmed', message: '', code: null };
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    try {
      const a = await getAction(result.action_id);
      if (a.status === 'confirmed') return { outcome: 'confirmed', message: '', code: null };
      if (a.status === 'failed' || a.status === 'denied') return { outcome: 'refused', message: a.status === 'denied' ? ERROR_LABEL.forbidden : 'המסך דחה את הפקודה', code: a.error };
      if (a.status === 'unknown') break;
    } catch {
      /* the poll itself failed: keep waiting until the deadline, then say "not confirmed" */
    }
  }
  return { outcome: 'not_confirmed', message: ERROR_LABEL.not_confirmed, code: 'not_confirmed' };
}
