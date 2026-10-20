import { ticketsModuleOn } from '../shell/nav';

/**
 * Owner rule 2026-10-20: while the tickets (service requests) module is not enabled for the organization, NO action that opens, links to
 * or lists a ticket / service request / RFQ may be offered anywhere in the UI. This is the ONE switch every such entry point asks first
 * (the same `/me` modules.tickets -> tickets.enabled flag the navigation reads); off means render nothing - no disabled button, no hint.
 * Pass `held` + a permission to also require the permission (e.g. `ticketsEnabled('tickets.create')`).
 */
export function ticketsEnabled(permission?: string, held?: (p: string) => boolean): boolean {
  if (!ticketsModuleOn()) return false;
  return !permission || !held || held(permission);
}
