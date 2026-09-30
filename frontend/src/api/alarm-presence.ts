/**
 * Is there an alarm panel on this platform? (2026-09-30, owner request.) הגדרות › אבטחה shows its alarm pages only when
 * there is one - with none, the tab is absent rather than an empty state. The answer comes from the alarm endpoints that
 * exist today (no new API): the panels list for a holder of alarm.view, the discovery config for a system administrator
 * who lacks it - each already permission-scoped by the server, so a floor-scoped holder counts only the panels they may
 * see. It is asked once per session and kept for TTL_MS (screens that load the panels anyway refresh it for free through
 * `noteAlarmPanels`), never once per screen. A failed request leaves the pages visible: the screen then shows the error.
 * Nothing here grants anything - the pages, their controls and every endpoint keep their own permission checks.
 */
import { alarmConfig, alarmPanels } from './alarm';
import { canAnywhere, can, isApi } from './session';

const TTL_MS = 10 * 60_000;

let present: boolean | null = null;
let checkedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<(present: boolean | null) => void>();

function set(v: boolean | null): void {
  const changed = v !== present;
  present = v;
  checkedAt = Date.now();
  if (changed) listeners.forEach((fn) => fn(present));
}

/** The last known answer: true / false, or null before the first answer. */
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
  set(null);
}

/** Ask the server if the last answer is missing or older than TTL_MS (or `force`). Holders of neither alarm.view nor
 * system.configure get `false` without a request: they could not open an alarm page anyway. */
export function refreshAlarmPresence(force = false): Promise<void> {
  if (!isApi()) return Promise.resolve();
  if (inflight) return inflight;
  if (!force && present !== null && Date.now() - checkedAt < TTL_MS) return Promise.resolve();
  const view = canAnywhere('alarm.view');
  const configure = can('system.configure');
  if (!view && !configure) {
    set(false);
    return Promise.resolve();
  }
  const ask = view ? alarmPanels().then((r) => r.panels.length) : alarmConfig().then((r) => r.panels.length);
  inflight = ask
    .then((n) => set(n > 0))
    .catch(() => set(true)) // unknown: leave the pages in place, the screen reports the error itself
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
