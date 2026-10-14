/**
 * Owner 14.10: the pure rules of the deletion dialog (tickets/delete-dialog.ts) - the same limits the server enforces
 * (services/tickets/deletion.py: a reason of at most 300 characters after trimming, at most 50 tickets in one request, the typed
 * confirmation equal to the ticket's number or, for several, to how many are selected). Node-testable (no DOM).
 */
export const DELETE_REASON_MAX = 300;
export const BULK_DELETE_MAX = 50;

export interface DeleteTarget { id: string; number: number }

/** What the typed confirmation must equal: the ticket's number (one) or how many are selected (several). */
export function deleteConfirmValue(targets: readonly DeleteTarget[]): number {
  return targets.length === 1 ? targets[0].number : targets.length;
}

/** Whether the dialog may send: the typed value matches, a reason (trimmed, 1..300), between 1 and 50 tickets. */
export function deleteReady(targets: readonly DeleteTarget[], typed: string, reason: string): boolean {
  const r = reason.trim();
  return targets.length > 0 && targets.length <= BULK_DELETE_MAX && typed.trim() === String(deleteConfirmValue(targets)) && r.length > 0 && r.length <= DELETE_REASON_MAX;
}
