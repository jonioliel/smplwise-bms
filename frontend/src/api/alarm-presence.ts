/**
 * Is there an alarm panel on this platform? (2026-09-30, owner request.) The alarm tab of the security area and the alarm
 * pages of הגדרות › אבטחה exist only when there is one - but the owner's rule is "if there IS an alarm it MUST show", so
 * the answer fails toward showing: only a positive "no panel" (`false`) ever hides them; loading, an error, a timeout or
 * "unknown" (`null`) never do, and a negative answer never sticks (see below).
 *
 * "There is a panel" = the alarm endpoints list at least one `alarm_control_panel` of the platform's mirror, whatever it
 * has (no zones, no bypass switches, no features, no code format: services/alarm.py `discover` lists every enabled panel).
 * The answer comes from the endpoints that exist today (no new API): the panels list for a holder of alarm.view, the
 * discovery config for a system administrator without it - each already permission-scoped by the server. A holder of only
 * alarm.arm / disarm / bypass cannot list panels, so for them the answer is "yes" without a request.
 *
 * Caching: a positive answer is kept 10 minutes, a negative one 60 seconds, an error 30 seconds; screens that load the
 * panels anyway refresh it for free (`noteAlarmPanels`). While the answer is not "yes", one Home Assistant push listener
 * re-asks at once when the platform mirror changes (`structure_changed`, the sync reconnecting, an alarm panel entity
 * appearing), and the shell re-asks when the security area is entered. Nothing here grants anything - the pages, their
 * controls and every endpoint keep their own permission checks.
 */
import { alarmConfig, alarmPanels } from './alarm';
import { subscribeHa } from './ha';
import { canAnywhere, can, isApi } from './session';

const TTL_POSITIVE_MS = 10 * 60_000;
const TTL_NEGATIVE_MS = 60_000;
const TTL_ERROR_MS = 30_000;
/** Entering the security area re-asks a not-yet-positive answer, but not more often than this (a push always re-asks;
 * a burst of pushes coalesces into the probe already in flight). */
export const ENTER_GAP_MS = 5_000;

let present: boolean | null = null;
let checkedAt = 0;
let ttl = TTL_POSITIVE_MS;
let inflight: Promise<void> | null = null;
let stopWatch: (() => void) | null = null;
const listeners = new Set<(present: boolean | null) => void>();

function set(v: boolean | null, keepMs = v === false ? TTL_NEGATIVE_MS : TTL_POSITIVE_MS): void {
  const changed = v !== present;
  present = v;
  checkedAt = Date.now();
  ttl = keepMs;
  // only a not-yet-positive answer needs the mirror watch; a positive one is re-asked by its TTL
  if (v === true) {
    stopWatch?.();
    stopWatch = null;
  } else if (!stopWatch && isApi() && (canAnywhere('alarm.view') || can('system.configure'))) {
    stopWatch = subscribeHa((m) => {
      if (m.type === 'structure_changed' || (m.type === 'ha_sync_state' && m.connected) || (m.type === 'entity_state_changed' && String(m.entity?.entity_id ?? '').startsWith('alarm_control_panel.'))) {
        void refreshAlarmPresence(true);
      }
    });
  }
  if (changed) listeners.forEach((fn) => fn(present));
}

/** The last known answer: true / false, or null before the first answer (null never hides anything). */
export const alarmPresence = (): boolean | null => present;

export function onAlarmPresence(fn: (present: boolean | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A screen that has just loaded the panels (or the config) tells the count for free. */
export function noteAlarmPanels(count: number): void {
  set(count > 0);
}

/** Forget the answer (a new session / changed permissions): the next `refreshAlarmPresence` asks again. */
export function resetAlarmPresence(): void {
  checkedAt = 0;
  stopWatch?.();
  stopWatch = null;
  set(null);
}

/** Ask the server if the answer is missing or older than its TTL, or `force` (a mirror push, entering the security area
 * while the answer is not "yes"). */
export function refreshAlarmPresence(force = false, minGapMs = 0): Promise<void> {
  if (!isApi()) return Promise.resolve();
  if (inflight) return inflight;
  const age = Date.now() - checkedAt;
  if (present !== null && (force ? age < minGapMs : age < ttl)) return Promise.resolve();
  const view = canAnywhere('alarm.view');
  const configure = can('system.configure');
  if (!view && !configure) {
    // arm / disarm / bypass without view cannot list panels: they see the tab (the screen reports what the server allows);
    // someone with none of the alarm permissions has no tab whatever the answer is
    set(canAnywhere('alarm.arm') || canAnywhere('alarm.disarm') || canAnywhere('alarm.bypass'), TTL_POSITIVE_MS);
    return Promise.resolve();
  }
  const ask = view ? alarmPanels().then((r) => (r.panels ?? []).length) : alarmConfig().then((r) => (r.panels ?? []).length);
  inflight = ask
    .then((n) => set(n > 0))
    .catch(() => set(true, TTL_ERROR_MS)) // unknown: the pages stay, the screen reports the error itself; asked again soon
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
