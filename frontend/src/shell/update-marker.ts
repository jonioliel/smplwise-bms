/**
 * CR-021 S2: the "עדכון זמין" marker of the user menu. Only a holder of `system.update` ever asks the server (everyone else
 * gets `update_available: false` from it anyway, so the question is simply not sent); one cheap read each time the menu opens.
 */
import { can, isApi } from '../api/session';
import { getUpdateState } from '../api/system-update';

export const UPDATE_HREF = '#/system/update';

let available = false;
const listeners = new Set<() => void>();

export function updateAvailable(): boolean {
  return available;
}

/** The page just learned the state (a check, a load): the menu follows without another read. */
export function notifyUpdateState(v: boolean): void {
  if (available === v) return;
  available = v;
  for (const fn of listeners) fn();
}

export function onUpdateState(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reads the state for a holder of the permission; any failure leaves the marker as it was (quiet, no toast). */
export async function refreshUpdateMarker(): Promise<void> {
  if (!isApi() || !can('system.update')) {
    notifyUpdateState(false);
    return;
  }
  try {
    notifyUpdateState((await getUpdateState()).update_available === true);
  } catch {
    /* a missing marker is the quiet failure */
  }
}
