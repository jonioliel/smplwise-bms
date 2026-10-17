/**
 * VPORTALRFQ: the company technician requests vendors send from the portal - the directory editors' side (`tickets.configure`).
 *   GET  tickets/portal-requests?state=pending        the requests (full number: the editors hold the directory's write permission)
 *   POST tickets/portal-requests/{id}/approve|reject  {revision}
 * Approve creates the technician row through the directory's own create path (its number NOT confirmed - the editor confirms it by
 * code from the contact card) and, for a replacement, sets the old row inactive. Without a backend (static preview): an empty list.
 */
import { get, post } from './client';
import { isApi } from './session';

export interface PortalTechRequest {
  id: string;
  vendor: { id: string; name: string };
  action: 'add' | 'replace';
  display_name: string;
  phone: string | null;
  replaces: { id: string; name: string } | null;
  phone_known: boolean;
  state: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  decided_at: string | null;
  result_contact_id: string | null;
  revision: number;
}

const T = 'tickets/portal-requests';
const enc = encodeURIComponent;

export const portalRequestsApi = {
  list: (): Promise<{ requests: PortalTechRequest[]; enabled: boolean }> =>
    (isApi() ? get(`${T}?state=pending`) : Promise.resolve({ requests: [], enabled: false })),
  approve: (r: PortalTechRequest): Promise<{ ok: boolean; contact_id: string }> => post(`${T}/${enc(r.id)}/approve`, { revision: r.revision }),
  reject: (r: PortalTechRequest): Promise<{ ok: boolean }> => post(`${T}/${enc(r.id)}/reject`, { revision: r.revision }),
};
