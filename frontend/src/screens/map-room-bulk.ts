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
