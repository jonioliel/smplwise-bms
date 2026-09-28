/**
 * Single-entity commands for the devices area (CR-007 slice 2): optimistic UI over the existing action envelope
 * (api/ha.ts runAction / getAction, routers/ha.py POST /ha/entities/{id}/actions), with a per-domain confirmation
 * timeout and rollback - the DomusUI pattern (docs/integrations/domusui/DOMUSUI_EXTRACTION.md s7: phases
 * sending -> awaiting_confirmation -> confirmed or rollback; a new command supersedes the previous one with the
 * same key), reused here as facts only - this file is our own code, not theirs.
 *
 * A "key" identifies one control on one entity (`${entityId}:${control}` - a brightness slider and a lock button
 * on the same light are independent controls, each superseding only its own kind). Starting a new command for a
 * key bumps its generation; a superseded command's poll loop still runs to completion (so the request that already
 * left never dangles) but stops calling back once it is no longer the latest.
 */
import { ApiError, describeError } from './client';
import { ACTION_ERROR_LABEL, getAction, runAction, type HaActionRecord } from './ha';

export type CommandPhase = 'pending' | 'confirmed' | 'rolled_back';

export interface CommandState<T> {
  phase: CommandPhase;
  /** The value shown optimistically while pending, and kept on rollback so the UI can still explain what was tried. */
  optimistic: T;
  /** Set only when rolled_back: a short, honest reason in Hebrew. */
  note: string | null;
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

function settle<T>(a: HaActionRecord, optimistic: T, onUpdate: (s: CommandState<T>) => void): void {
  if (a.status === 'confirmed') onUpdate({ phase: 'confirmed', optimistic, note: null });
  else if (a.status === 'denied') onUpdate({ phase: 'rolled_back', optimistic, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'נדחה על ידי Home Assistant' });
  else if (a.status === 'failed') onUpdate({ phase: 'rolled_back', optimistic, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'הפעולה נכשלה' });
  else onUpdate({ phase: 'rolled_back', optimistic, note: 'לא אושר בזמן: Home Assistant לא דיווח על שינוי המצב' }); // pending/unknown past the domain timeout
}

/**
 * Runs one action, showing `optimistic` immediately, and calls `onUpdate` with pending -> confirmed/rolled_back.
 * A later call with the same `key` supersedes this one: its own outcome is dropped silently (the newer call already
 * told the UI what to show - "last value wins", for a debounced slider dragged past its previous value).
 */
export async function runCommand<T>(
  key: string,
  domain: string,
  entityId: string,
  actionId: string,
  args: Record<string, unknown>,
  optimistic: T,
  onUpdate: (s: CommandState<T>) => void,
): Promise<void> {
  const { isCurrent } = bump(key);
  onUpdate({ phase: 'pending', optimistic, note: null });
  const deadline = Date.now() + domainTimeoutMs(domain);
  try {
    let a = await runAction(entityId, actionId, args, false);
    if (!isCurrent()) return;
    while (a.status === 'pending' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (!isCurrent()) return;
      a = await getAction(a.id);
      if (!isCurrent()) return;
    }
    settle(a, optimistic, onUpdate);
  } catch (err) {
    if (!isCurrent()) return;
    const msg = err instanceof ApiError && err.code === 'bridge_not_paired' ? 'גשר SMPLWISE אינו מצומד ב־Home Assistant.' : describeError(err);
    onUpdate({ phase: 'rolled_back', optimistic, note: msg });
  }
}

/** A debounced runner for a control that fires many quick updates (a slider drag): only the last value in a
 * `waitMs` burst starts a command, and starting it supersedes anything already in flight for the same key. */
export function debouncedCommand<T>(waitMs = 300): (key: string, domain: string, entityId: string, actionId: string, args: Record<string, unknown>, optimistic: T, onUpdate: (s: CommandState<T>) => void) => void {
  const timers = new Map<string, number>();
  return (key, domain, entityId, actionId, args, optimistic, onUpdate) => {
    onUpdate({ phase: 'pending', optimistic, note: null }); // show the dragged value at once; only the network call is debounced
    const prev = timers.get(key);
    if (prev) window.clearTimeout(prev);
    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        void runCommand(key, domain, entityId, actionId, args, optimistic, onUpdate);
      }, waitMs),
    );
  };
}
