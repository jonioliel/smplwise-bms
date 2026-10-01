/**
 * CR-016: one deliberate press -> one player command -> an honest outcome (MEDIA_PLAYERS_API.md §3, CR §6.1). The players'
 * counterpart of ./media-command.ts (which speaks the screens client): ONE command with a fresh request id (never retried, never
 * queued); an `accepted` command is followed to its confirmation (GET /ha/actions/{id}) for at most 8 s, then "not confirmed" and
 * the caller shows the last CONFIRMED state again. Without a backend (the static demo) the mock answers at once.
 */
import { ApiError } from '../api/client';
import { getAction } from '../api/ha';
import { isApi } from '../api/session';
import { CONFIRM_TIMEOUT_MS } from '../api/media-screens';
import { PLAYER_ERROR_LABEL, sendPlayerCommand, type PlayerCommand } from '../api/media-players';
import type { CommandOutcome } from './media-command';

const POLL_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function playerErrorOutcome(err: unknown): { code: string | null; message: string } {
  if (err instanceof ApiError) return { code: err.code, message: PLAYER_ERROR_LABEL[err.code] ?? err.body.user_message ?? 'הפעולה נכשלה' };
  return { code: null, message: 'אין חיבור לשרת' };
}

export async function runPlayerCommand(key: string, cmd: PlayerCommand, onSent?: () => void): Promise<CommandOutcome> {
  let result;
  try {
    result = await sendPlayerCommand(key, cmd);
  } catch (err) {
    const { code, message } = playerErrorOutcome(err);
    return { outcome: code === 'rate_limited' ? 'rate_limited' : 'refused', message, code };
  }
  onSent?.();
  if (result.status === 'refused') return { outcome: 'refused', message: (result.error && PLAYER_ERROR_LABEL[result.error]) || 'הנגן דחה את הפקודה', code: result.error };
  if (result.status === 'sent' || result.confirm === 'none') return { outcome: 'sent', message: '', code: null };
  if (!result.action_id || !isApi()) return { outcome: 'confirmed', message: '', code: null };
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    try {
      const a = await getAction(result.action_id);
      if (a.status === 'confirmed') return { outcome: 'confirmed', message: '', code: null };
      if (a.status === 'failed' || a.status === 'denied') return { outcome: 'refused', message: a.status === 'denied' ? PLAYER_ERROR_LABEL.forbidden : 'הנגן דחה את הפקודה', code: a.error };
      if (a.status === 'unknown') break;
    } catch {
      /* the poll itself failed: keep waiting until the deadline, then say "not confirmed" */
    }
  }
  return { outcome: 'not_confirmed', message: 'הנגן לא אישר את הפקודה', code: 'not_confirmed' };
}
