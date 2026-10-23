/**
 * CR-LIVEEVENT100: the open-incident state the shell draws on every screen (the "אירוע פעיל" pill beside the corner, the red dots on the
 * security icon and on the "אירוע חי" tab). One small read (GET /incidents/summary) every POLL_MS while the module is on and the tab is
 * visible; nothing at all while it is off. Navigation only: the page itself and every route check the permissions.
 */
import { incidentSummary, type IncidentSummary } from '../api/incidents';
import { applyIncidents } from '../shell/nav';

export const POLL_MS = 15_000;

let timer = 0;
let running = false;
let current: IncidentSummary = { enabled: false, open: 0, latest_id: null, red_dot: 'active' };
const listeners = new Set<(s: IncidentSummary) => void>();

export function incidentState(): IncidentSummary {
  return current;
}

export function onIncidentState(fn: (s: IncidentSummary) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

function publish(s: IncidentSummary) {
  current = s;
  applyIncidents(s.enabled, s.open, s.red_dot);
  listeners.forEach((fn) => fn(s));
}

/** Read the summary now (after an open / close on the page, or when the module was switched in Settings). */
export async function refreshIncidents(): Promise<void> {
  if (!running) return;
  try {
    publish(await incidentSummary());
  } catch {
    /* a failed read keeps the last answer; the next poll tries again */
  }
}

function tick() {
  window.clearTimeout(timer);
  if (!running) return;
  if (document.visibilityState === 'visible') void refreshIncidents();
  timer = window.setTimeout(tick, POLL_MS);
}

/** Start (module on) or stop (module off) the poll. `on` comes from `/me` modules.incidents. */
export function startIncidents(on: boolean): void {
  if (!on) {
    running = false;
    window.clearTimeout(timer);
    publish({ enabled: false, open: 0, latest_id: null, red_dot: current.red_dot });
    return;
  }
  applyIncidents(true, current.open, current.red_dot);
  if (running) return;
  running = true;
  tick();
}
