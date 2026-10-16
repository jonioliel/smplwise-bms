/**
 * TKUI3B (release 2.6.x): the client of the internal owner routes of the detail backend (contract v1.4 §2,
 * docs/tickets/DETAIL_BACKEND_CONTRACT.md; smplwise_vms/backend/smplwise/routers/tickets_detail.py):
 *   - `GET /tickets/{id}/owner`   {owner, history, candidates, can} - visible, full view only (a limited viewer gets `owner: null`);
 *   - `PUT /tickets/{id}/owner`   {user_id: str|null, reason?, revision} - the manager of the request; the same answer.
 *     409 `ticket_stale` (reload), 409 `owner_not_allowed` (not an eligible member of the department), 409 `owner_unchanged`.
 * The picker's people are NOT read from `candidates` here: every picker of the module reads the one assignee list
 * (`ticketsApi().assignees`, tickets/assignee-model.ts) and sends the same reference; `candidates` is the server's own check of it.
 * There is no demo store: without a backend the detail carries no `internal_owner`, so the Overview never offers the change.
 */
import { get, put } from './client';
import type { InternalOwner } from './tickets';

export interface OwnerChange { at: string; from: string | null; to: string | null; by: string; source: string; reason: string | null }
export interface OwnerAnswer {
  ticket_id: string;
  revision: number;
  owner: InternalOwner | null;
  history: OwnerChange[];
  candidates: { id: string; name: string }[];
  can: { change: boolean };
}
export interface OwnerBody { user_id: string | null; reason?: string; revision: number }

const enc = encodeURIComponent;

export const ticketOwnerApi = {
  get: (id: string) => get<OwnerAnswer>(`tickets/${enc(id)}/owner`),
  change: (id: string, body: OwnerBody) => put<OwnerAnswer>(`tickets/${enc(id)}/owner`, body),
};
