/**
 * Single-entity commands for the devices area (CR-007 slice 2): optimistic UI over the existing action envelope
 * (api/ha.ts runAction / getAction, routers/ha.py POST /ha/entities/{id}/actions), with a per-domain confirmation
 * timeout and rollback - the DomusUI pattern (docs/integrations/domusui/DOMUSUI_EXTRACTION.md s7: phases
 * sending -> awaiting_confirmation -> confirmed or rollback; a new command supersedes the previous one with the
 * same key), reused here as facts only - this file is our own code, not theirs.
 *
 * A "key" identifies one control on one entity (`${entityId}:${control}` - a brightness slider and a power toggle
 * on the same light are independent controls, each superseding only its own kind). Starting a new command for a
 * key - or merely moving a debounced slider again (`supersede`) - bumps its generation; a superseded command's poll
 * loop still runs to completion (so the request that already left never dangles) but never calls back again, so a
 * late confirmation of an older value cannot overwrite the newer one.
 *
 * Honesty (slice-2 review): "confirmed" only when the add-on saw Home Assistant report the effect (the state, or the
 * attribute that carries it - routers/ha.py `confirmation`). An action with nothing observable (`confirmation:
 * "none"`: stop, a target temperature the entity does not report, mute on a player without that attribute) ends
 * "sent": Home Assistant accepted the call, and nothing more is claimed.
 */
import { ApiError, describeError } from './client';
import { ACTION_ERROR_LABEL, getAction, runAction, type HaActionRecord } from './ha';

export type CommandPhase = 'pending' | 'confirmed' | 'sent' | 'rolled_back';

export interface CommandState<T> {
  phase: CommandPhase;
  /** The value the control shows while pending (the target - never shown as the row's fact), kept on rollback. */
  optimistic: T;
  /** What was asked, in words ("הדלקה", "בהירות 40%"), for the visible pending / sent line. */
  label: string;
  /** Set only when rolled_back: a short, honest reason in Hebrew. */
  note: string | null;
}

export interface CommandOptions {
  /** The explicit confirmation an "attention" action needs (cover movement): sent as confirmation_grant. */
  confirmed?: boolean;
  label?: string;
}

/** DomusUI's own per-domain optimistic timeouts (extraction s7), recorded here in code as the task asks. */
const DOMAIN_TIMEOUT_MS: Record<string, number> = {
  light: 5000,
  switch: 5000,
  input_boolean: 5000,
  cover: 7000,
  climate: 15000,
  fan: 15000,
  media_player: 8000,
};
const DEFAULT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 500;

export function domainTimeoutMs(domain: string): number {
  return DOMAIN_TIMEOUT_MS[domain] ?? DEFAULT_TIMEOUT_MS;
}

const generations = new Map<string, number>();

function bump(key: string): { gen: number; isCurrent: () => boolean } {
  const gen = (generations.get(key) ?? 0) + 1;
  generations.set(key, gen);
  return { gen, isCurrent: () => generations.get(key) === gen };
}

/** Makes whatever is in flight for `key` stale at once: its outcome, whenever it arrives, is dropped. */
export function supersede(key: string): void {
  bump(key);
}

function settle<T>(a: HaActionRecord, optimistic: T, label: string, onUpdate: (s: CommandState<T>) => void): void {
  if (a.status === 'confirmed') onUpdate({ phase: a.confirmation === 'none' ? 'sent' : 'confirmed', optimistic, label, note: null });
  else if (a.status === 'denied') onUpdate({ phase: 'rolled_back', optimistic, label, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'נדחה על ידי Home Assistant' });
  else if (a.status === 'failed') onUpdate({ phase: 'rolled_back', optimistic, label, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'הפעולה נכשלה' });
  else onUpdate({ phase: 'rolled_back', optimistic, label, note: 'לא אושר בזמן: Home Assistant לא דיווח על שינוי המצב' }); // pending/unknown past the domain timeout
}

/**
 * Runs one action, showing `optimistic` on the control immediately, and calls `onUpdate` with pending ->
 * confirmed / sent / rolled_back. A later call (or `supersede`) with the same `key` makes this one stale: its own
 * outcome is dropped silently (the newer call already told the UI what to show - "last value wins").
 */
export async function runCommand<T>(
  key: string,
  domain: string,
  entityId: string,
  actionId: string,
  args: Record<string, unknown>,
  optimistic: T,
  onUpdate: (s: CommandState<T>) => void,
  opts: CommandOptions = {},
): Promise<void> {
  const { isCurrent } = bump(key);
  const label = opts.label ?? '';
  onUpdate({ phase: 'pending', optimistic, label, note: null });
  const deadline = Date.now() + domainTimeoutMs(domain);
  try {
    let a = await runAction(entityId, actionId, args, opts.confirmed === true);
    if (!isCurrent()) return;
    if (a.status === 'pending' && a.confirmation === 'none') {
      onUpdate({ phase: 'sent', optimistic, label, note: null }); // accepted, and there is nothing to wait for
      return;
    }
    while (a.status === 'pending' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (!isCurrent()) return;
      a = await getAction(a.id);
      if (!isCurrent()) return;
    }
    settle(a, optimistic, label, onUpdate);
  } catch (err) {
    if (!isCurrent()) return;
    const msg = err instanceof ApiError && err.code === 'bridge_not_paired' ? 'גשר SMPLWISE אינו מצומד ב־Home Assistant.' : describeError(err);
    onUpdate({ phase: 'rolled_back', optimistic, label, note: msg });
  }
}

/** A debounced runner for a control that fires many quick updates (a slider drag): only the last value in a
 * `waitMs` burst starts a command. Every update supersedes what is in flight for the same key AT ONCE (not only
 * when the debounced call fires), so an older command confirming inside the debounce window cannot overwrite the
 * value the slider now shows. */
export function debouncedCommand<T>(waitMs = 300): (key: string, domain: string, entityId: string, actionId: string, args: Record<string, unknown>, optimistic: T, onUpdate: (s: CommandState<T>) => void, opts?: CommandOptions) => void {
  const timers = new Map<string, number>();
  return (key, domain, entityId, actionId, args, optimistic, onUpdate, opts = {}) => {
    supersede(key);
    onUpdate({ phase: 'pending', optimistic, label: opts.label ?? '', note: null }); // show the dragged value at once; only the network call is debounced
    const prev = timers.get(key);
    if (prev) window.clearTimeout(prev);
    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        void runCommand(key, domain, entityId, actionId, args, optimistic, onUpdate, opts);
      }, waitMs),
    );
  };
}
