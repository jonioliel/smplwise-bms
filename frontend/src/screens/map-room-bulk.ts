// LOWS-FRONTEND-2550 (deep review SCR-52, owner answer Q1 a): the outcome of a room card's "all off" on the floor map - pure, no DOM.
/** LOWS-FRONTEND-2550 (review SCR-52, owner answer Q1 a): how one device of a room's "all off" ended - `false` when the command was
 * refused or failed (an error, a failed / denied record). An unknown or still pending record is not counted as "not turned off": the
 * screen does not claim what it did not see. */
export function bulkItemFailed(error: string, status: string | null | undefined): boolean {
  return !!error || status === 'failed' || status === 'denied';
}

/** The room card's line after "all off": null when every device went off (nothing is shown), else how many of how many did not. */
export function bulkResultOf(failed: number, total: number): { failed: number; total: number } | null {
  return failed > 0 && total > 0 ? { failed, total } : null;
}

/** FIX-HOME-MAPS-2570 (MH-04): an "all off" tapped while a batch is still running sends nothing (one batch at a time - the screen has one
 * action line) and says why: `same` = this room's own batch is still going, `other` = another room's batch is. No queue, no retry. */
export function bulkBusyKind(runningZone: string | null, tappedZone: string | null): 'same' | 'other' {
  return runningZone != null && runningZone === tappedZone ? 'same' : 'other';
}
