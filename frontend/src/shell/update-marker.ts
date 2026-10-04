/**
 * CR-021 S2: the "עדכון זמין" marker of the user menu. Only a holder of `system.update` ever asks the server (everyone else
 * gets `update_available: false` from it anyway, so the question is simply not sent); one cheap read each time the menu opens.
 * CR-021 S3: the same read also carries `requires_platform_restart` (holders only): the menu then shows "נדרשת הפעלה מחדש" with
 * the same dot when no update is waiting (an update row has priority; both lead to the same page).
 */
import { can, isApi } from '../api/session';
import { getUpdateState } from '../api/system-update';

export const UPDATE_HREF = '#/system/update';

let available = false;
let restart = false;
const listeners = new Set<() => void>();

export function updateAvailable(): boolean {
  return available;
}

/** CR-021 S3: the platform needs a restart (bridge / WisKey copied, a flagged release). */
export function restartRequired(): boolean {
  return restart;
}

/** The page just learned the state (a check, a load): the menu follows without another read. */
export function notifyUpdateState(v: boolean, needsRestart?: boolean): void {
  const r = needsRestart ?? restart;
  if (available === v && restart === r) return;
  available = v;
  restart = r;
  for (const fn of listeners) fn();
}

export function onUpdateState(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reads the state for a holder of the permission; any failure leaves the marker as it was (quiet, no toast). */
export async function refreshUpdateMarker(): Promise<void> {
  if (!isApi() || !can('system.update')) {
    notifyUpdateState(false, false);
    return;
  }
  try {
    const s = await getUpdateState();
    notifyUpdateState(s.update_available === true, s.requires_platform_restart === true);
  } catch {
    /* a missing marker is the quiet failure */
  }
}
