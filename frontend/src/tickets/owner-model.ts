/**
 * TKUI3B (release 2.6.x): the pure rules of the internal owner ("אחראי בארגון", contract v1.4 §2) on the request's Overview. No DOM, no
 * Lit: tests/unit-tickets-owner.spec.ts runs it in node.
 *   - the owner is for the members' FULL view only: a limited viewer, or an older server that sends no `internal_owner`, shows nothing -
 *     never "unknown";
 *   - only the manager of an OPEN request may change it (the server's `can.change_owner` decides; a closed request never offers it);
 *   - the picker reads the ONE assignee list of the module (tickets/assignee-model.ts `handlersOf`): account holders only - an owner is
 *     a person with an account, never a staff contact or a vendor - and sends the same `{user_id}` reference every picker sends;
 *   - nothing is sent when the choice is the current owner (the server answers 409 `owner_unchanged`).
 */
import type { Handler, InternalOwner, TicketDetail } from '../api/tickets';
import type { OwnerBody } from '../api/tickets-owner';

export type OwnerView = 'hidden' | 'set' | 'none';

export interface OwnerTicket { view: TicketDetail['view']; status: TicketDetail['status']; internal_owner?: InternalOwner | null; can: { change_owner?: boolean } }

/** What the People section shows: the owner card (`set`), the "nobody yet" line (`none`, only for who may set one), or nothing. */
export function ownerView(t: OwnerTicket): OwnerView {
  if (t.view !== 'full' || t.internal_owner === undefined) return 'hidden';
  if (t.internal_owner) return 'set';
  return canChangeOwner(t) ? 'none' : 'hidden';
}

/** Whether the viewer may change the owner now: the server's flag on an open request. */
export function canChangeOwner(t: OwnerTicket): boolean {
  return t.view === 'full' && !!t.can.change_owner && t.status !== 'closed' && t.status !== 'cancelled';
}

/** The picker's people: account holders of the one assignee list, the current owner first, then by name. */
export function ownerChoices(handlers: readonly Handler[], owner: Pick<InternalOwner, 'id'> | null | undefined): Handler[] {
  return handlers
    .filter((h) => h.kind === 'user' && h.account)
    .sort((a, b) => Number(b.id === owner?.id) - Number(a.id === owner?.id) || a.name.localeCompare(b.name));
}

/** The choice of the dialog: a user id, '' = nobody (clears the owner), or null = nothing picked yet. */
export type OwnerPick = string | null;

/** The request body of the choice, or null when there is nothing to send (nothing picked, or the owner stays). */
export function ownerPlan(pick: OwnerPick, owner: Pick<InternalOwner, 'id'> | null | undefined, reason: string, revision: number): OwnerBody | null {
  if (pick === null) return null;
  const id = pick || null;
  if ((owner?.id ?? null) === id) return null;
  const why = reason.trim();
  return { user_id: id, ...(why ? { reason: why } : {}), revision };
}
