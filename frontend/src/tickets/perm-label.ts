/**
 * The words of a ticket permission (`tickets.view` ... `tickets.costs.view`, `tickets.costs`) for the "הרשאות" tab. Owner 2.5.0 (14.10):
 * the tab stayed on "טוען..." forever - the holders answer carries the cost permissions of slice 9 (`tickets.costs.view`,
 * `tickets.costs`), whose words live in the cost catalogue (`p_costs_view`, `p_costs`); `tt('p_costs.view')` found no template and the
 * render threw. Every permission now has words: the module's catalogue, the cost catalogue, else the permission's own name.
 */
import { COST_TEXT_KEYS, ct, type CostTextKey } from './cost-text';
import { DELETE_TEXT_KEYS, dlt, type DeleteTextKey } from './delete-text';
import { TICKET_TEXT_KEYS, tt, type TicketTextKey } from './text';

export function ticketPermLabel(perm: string): string {
  const short = String(perm ?? '').replace(/^tickets\./, '').replace(/\./g, '_');
  const key = `p_${short}`;
  if ((TICKET_TEXT_KEYS as readonly string[]).includes(key)) return tt(key as TicketTextKey);
  if ((COST_TEXT_KEYS as readonly string[]).includes(key)) return ct(key as CostTextKey);
  if ((DELETE_TEXT_KEYS as readonly string[]).includes(key)) return dlt(key as DeleteTextKey); // owner 14.10: tickets.delete
  return String(perm ?? '');
}
