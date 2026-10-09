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
 * Honesty (slice-2 review): "confirmed" only when Home Assistant reported the effect (the state, or the attribute that
 * carries it - routers/ha.py `confirmation`). An action with nothing observable (`confirmation: "none"`: stop, a target
 * temperature the entity does not report, mute on a player without that attribute) ends "sent": Home Assistant accepted
 * the call, and nothing more is claimed.
 *
 * LAT1 (owner, 2026-10-08: "a switch takes a thinking time"): nothing between the tap and the confirmation waits for
 * a clock any more.
 * - The command confirms the moment the entity's own state push lands (`reached`: the pushed state is the target) - the
 *   push socket every open screen already holds feeds it (api/ha.ts onEntityPush); before, the first look came only
 *   after a fixed 500 ms sleep following the add-on's answer.
 * - The poll that remains (actions without a push-readable target, a lost socket) is woken by the entity's push and
 *   looks at once after the answer, never after a fixed sleep first.
 * - The controls show the target at once; the "awaiting confirmation" line and the dimmed state appear only when a
 *   command is still pending after PENDING_VISIBLE_MS (a slow device) - an instant switch never flashes them.
 */
import { ApiError, describeError } from './client';
import { ACTION_ERROR_LABEL, getAction, haPushLive, onEntityPush, runAction, subscribeHa, waitEntityPush, type HaActionRecord, type HaEntity } from './ha';
import { isApi } from './session';

export type CommandPhase = 'pending' | 'confirmed' | 'sent' | 'rolled_back';

export interface CommandState<T> {
  phase: CommandPhase;
  /** The value the control shows while pending (the target), kept on rollback. */
  optimistic: T;
  /** What was asked, in words ("הדלקה", "בהירות 40%"), for the visible pending / sent line. */
  label: string;
  /** Set only when rolled_back: a short, honest reason in Hebrew. */
  note: string | null;
  /** Date.now() when the command started (LAT1: the pending line shows only after PENDING_VISIBLE_MS). */
  since?: number;
}

export interface CommandOptions {
  /** The explicit confirmation an "attention" action needs (cover movement): sent as confirmation_grant. */
  confirmed?: boolean;
  label?: string;
  /** LAT1: true when a pushed state of the entity shows the command's effect - the command confirms on that push. */
  reached?: (e: HaEntity) => boolean;
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
/** The fallback poll interval: a pending record is looked at again after this long when no push woke it first. */
const POLL_INTERVAL_MS = 500;
/** LAT1: a command still pending after this long shows the "awaiting confirmation" line and the dimmed control. The
 * lab floor of a relay is ~60 ms tap-to-state (lead, 2026-10-08); a device that takes longer than this is slow, and
 * the line then tells the truth about it. */
export const PENDING_VISIBLE_MS = 700;

export function domainTimeoutMs(domain: string): number {
  return DOMAIN_TIMEOUT_MS[domain] ?? DEFAULT_TIMEOUT_MS;
}

/** The domain's own "on" - the same rules as the server's (services/devices.py is_active). */
export function activeOf(domain: string, s: string | null): boolean {
  if (['light', 'switch', 'input_boolean', 'fan', 'humidifier'].includes(domain)) return s === 'on';
  if (domain === 'cover') return s === 'open' || s === 'opening';
  if (domain === 'climate') return !['off', 'unavailable', 'unknown', '', null].includes(s);
  if (domain === 'media_player') return !['off', 'standby', 'unavailable', 'unknown', '', null].includes(s);
  if (domain === 'lock') return s === 'locked';
  return false;
}

/** `reached` for a power command: the pushed state is the requested on / off (never an unavailable entity). */
export function powerReached(domain: string, next: boolean): (e: HaEntity) => boolean {
  return (e) => e.state !== 'unavailable' && e.state !== 'unknown' && e.state !== null && activeOf(domain, e.state) === next;
}

/** True while the command started at `since` has been pending long enough to be shown as such. */
export function pendingVisible(s: CommandState<unknown> | undefined, now = Date.now()): boolean {
  return !!s && s.phase === 'pending' && now - (s.since ?? 0) >= PENDING_VISIBLE_MS;
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

// ---------------------------------------------------------------- the push channel a command listens on
// A screen with controls normally holds its own /ha/ws socket (devices area, panels, the map); only when none is open does
// a command open one of its own, kept for a minute after the last command so a run of taps reuses it.
let ownStop: (() => void) | null = null;
let ownIdle = 0;
let inFlight = 0;

function ensurePushChannel(): void {
  if (!isApi()) return;
  window.clearTimeout(ownIdle);
  if (ownStop || haPushLive()) return;
  ownStop = subscribeHa(() => undefined);
}

function releasePushChannel(): void {
  if (inFlight > 0 || !ownStop) return;
  window.clearTimeout(ownIdle);
  ownIdle = window.setTimeout(() => {
    if (inFlight === 0 && ownStop) {
      ownStop();
      ownStop = null;
    }
  }, 60_000);
}

/** Open the push channel ahead of the first tap (a screen with controls calls this when it connects). */
export function warmCommandChannel(): void {
  ensurePushChannel();
  releasePushChannel();
}

/** LAT1 instrumentation: the last commands' tap -> outcome times (ms), readable in the browser console as
 * `__swCommandTimings` and as `sw:cmd` entries in DevTools -> Performance. */
export interface CommandTiming {
  entity_id: string;
  action_id: string;
  outcome: CommandPhase;
  /** tap -> the add-on's answer (the POST round trip), null when the push came first. */
  answer_ms: number | null;
  /** tap -> the outcome (confirmed / sent / rolled back). */
  outcome_ms: number;
  /** what settled it: the entity's push, a poll, the answer itself, or the timeout. */
  via: 'push' | 'poll' | 'answer' | 'timeout' | 'error';
}
const TIMINGS_KEEP = 20;
function noteTiming(t: CommandTiming): void {
  try {
    const w = window as unknown as { __swCommandTimings?: CommandTiming[] };
    w.__swCommandTimings = [...(w.__swCommandTimings ?? []), t].slice(-TIMINGS_KEEP);
    performance.measure?.(`sw:cmd ${t.entity_id} ${t.action_id} ${t.outcome} via ${t.via}`, { start: performance.now() - t.outcome_ms, duration: t.outcome_ms });
  } catch {
    /* instrumentation never breaks a command */
  }
}

function settled<T>(a: HaActionRecord, optimistic: T, label: string, since: number): CommandState<T> {
  if (a.status === 'confirmed') return { phase: a.confirmation === 'none' ? 'sent' : 'confirmed', optimistic, label, note: null, since };
  if (a.status === 'denied') return { phase: 'rolled_back', optimistic, label, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'נדחה על ידי תשתית המערכת', since };
  if (a.status === 'failed') return { phase: 'rolled_back', optimistic, label, note: ACTION_ERROR_LABEL[a.error ?? ''] ?? 'הפעולה נכשלה', since };
  return { phase: 'rolled_back', optimistic, label, note: 'לא אושר בזמן: תשתית המערכת לא דיווחה על שינוי המצב', since }; // pending/unknown past the domain timeout
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
  const since = Date.now();
  const t0 = performance.now();
  let answerMs: number | null = null;
  let done = false;
  const finish = (s: CommandState<T>, via: CommandTiming['via']) => {
    if (done) return;
    done = true;
    if (!isCurrent()) return;
    noteTiming({ entity_id: entityId, action_id: actionId, outcome: s.phase, answer_ms: answerMs, outcome_ms: Math.round(performance.now() - t0), via });
    onUpdate(s);
  };
  onUpdate({ phase: 'pending', optimistic, label, note: null, since });
  inFlight++;
  ensurePushChannel();
  // the entity's own push confirms at once when it shows the effect - even before the add-on's answer arrived
  const stopPush = opts.reached
    ? onEntityPush((e) => {
        if (e.entity_id === entityId && opts.reached!(e)) finish({ phase: 'confirmed', optimistic, label, note: null, since }, 'push');
      })
    : () => undefined;
  const deadline = Date.now() + domainTimeoutMs(domain);
  try {
    let a = await runAction(entityId, actionId, args, opts.confirmed === true);
    answerMs = Math.round(performance.now() - t0);
    if (done) {
      // confirmed by the push already: one look lets the add-on record its own confirmation (ha_actions), result unused
      if (a.status === 'pending') void getAction(a.id).catch(() => undefined);
      return;
    }
    if (!isCurrent()) return;
    if (a.status === 'pending' && a.confirmation === 'none') {
      finish({ phase: 'sent', optimistic, label, note: null, since }, 'answer'); // accepted, and there is nothing to wait for
      return;
    }
    let pollSince = t0;
    while (a.status === 'pending' && Date.now() < deadline && !done) {
      // woken by the entity's push (one that already landed counts), else after the fallback interval
      await waitEntityPush(entityId, Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())), pollSince);
      pollSince = performance.now();
      if (!isCurrent() || done) return;
      a = await getAction(a.id);
      if (!isCurrent()) return;
    }
    if (done) return;
    finish(settled(a, optimistic, label, since), a.status === 'pending' || a.status === 'unknown' ? 'timeout' : a.status === 'confirmed' ? 'poll' : 'answer');
  } catch (err) {
    if (done || !isCurrent()) return;
    const msg = err instanceof ApiError && err.code === 'bridge_not_paired' ? 'הגשר אינו מצומד.' : describeError(err);
    finish({ phase: 'rolled_back', optimistic, label, note: msg, since }, 'error');
  } finally {
    stopPush();
    inFlight--;
    releasePushChannel();
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
    onUpdate({ phase: 'pending', optimistic, label: opts.label ?? '', note: null, since: Date.now() }); // show the dragged value at once; only the network call is debounced
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
