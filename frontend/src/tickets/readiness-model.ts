/**
 * CR-038 owner request 2026-10-14: what sending a ticket outside still needs, in words, each with the link to its exact setting - the
 * readiness strip of the "מטפלים וספקים" page and the reason line of a group of the assign dialog that cannot be used (the owner found
 * no way to send by WhatsApp, to a vendor or to an employee without an account: the dialog used to hide whatever was not ready).
 * Pure: the server's readiness object (GET tickets/readiness) in, items out.
 */
import type { Readiness } from '../api/tickets-s4';
import type { TicketTextKey } from './text';

export const HANDLERS_HREF = '#/tickets/handlers';
/** NEEDSREVIEW (2.8.0): `review` = "דורש בחינה", shown only to the directory's editors (tickets.configure) - see handlersSegments() */
export type HandlersSegment = 'handlers' | 'vendors' | 'contacts' | 'review';
export const HANDLERS_SEGMENTS: readonly HandlersSegment[] = ['handlers', 'vendors', 'contacts'];
export const REVIEW_SEGMENTS: readonly HandlersSegment[] = [...HANDLERS_SEGMENTS, 'review'];
/** The segments a viewer sees: the review report only for `tickets.configure` holders (the server refuses everyone else anyway). */
export const handlersSegments = (configure: boolean): readonly HandlersSegment[] => (configure ? REVIEW_SEGMENTS : HANDLERS_SEGMENTS);
export const handlersHref = (seg: HandlersSegment = 'handlers'): string => (seg === 'handlers' ? HANDLERS_HREF : `${HANDLERS_HREF}?seg=${seg}`);

/** The settings each missing prerequisite is fixed in. */
export const SETTINGS_HREF = {
  public: '#/system/tickets', // the handler page card (address, state) on the general tab
  channel: '#/system/tickets?tab=channel', // the WhatsApp master switch
  accounts: '#/system/messaging-accounts', // which WhatsApp account the ticket messages leave from
  permissions: '#/system/tickets?tab=permissions',
} as const;

export interface ReadyItem {
  key: string;
  text: TicketTextKey;
  href: string;
  /** the link's words: the setting ("להגדרה") or the handlers page */
  link: TicketTextKey;
}

const item = (key: string, href: string, link: TicketTextKey = 'rdyOpen'): ReadyItem => ({ key, text: `rdy_${key}` as TicketTextKey, href, link });

/** The handler page itself (blocks every outside group). */
function publicItem(r: Readiness): ReadyItem | null {
  if (!r.public_page) return item('page_off', SETTINGS_HREF.public);
  if (!r.base_url) return item('address', SETTINGS_HREF.public);
  if (!r.module_key) return item('key', SETTINGS_HREF.public);
  return null;
}

/** The WhatsApp part (does not block an assignment: without it the link is copied or e-mailed). */
function whatsappItem(r: Readiness): ReadyItem | null {
  if (!r.master_switch) return item('switch', SETTINGS_HREF.channel);
  if (!r.account_mapped) return item('account', SETTINGS_HREF.accounts);
  return null;
}

/** The page's strip: every missing prerequisite (empty = everything ready, the strip is not shown). */
export function missingItems(r: Readiness | null | undefined): ReadyItem[] {
  if (!r) return [];
  const out: ReadyItem[] = [];
  if (!r.public_page) out.push(item('page_off', SETTINGS_HREF.public));
  if (!r.base_url) out.push(item('address', SETTINGS_HREF.public));
  if (!r.module_key) out.push(item('key', SETTINGS_HREF.public));
  if (!r.master_switch) out.push(item('switch', SETTINGS_HREF.channel));
  else if (!r.account_mapped) out.push(item('account', SETTINGS_HREF.accounts));
  return out;
}

export type OutsideGroup = 'employee' | 'person';

/** Why an outside group of the assign dialog cannot be used now - the first reason only (one short line), or null. `count` is how many
 * rows of the group the dialog may offer for this ticket; `readiness` is absent on the demo store / an older server. */
export function outsideBlock(group: OutsideGroup, o: { external: boolean; readiness?: Readiness | null; publicReady: boolean; count: number }): ReadyItem | null {
  if (!o.external) return item('external', SETTINGS_HREF.permissions);
  const pub = o.readiness ? publicItem(o.readiness) : o.publicReady ? null : item('page_off', SETTINGS_HREF.public);
  if (pub) return pub;
  if (o.count === 0) return group === 'employee' ? item('no_employees', handlersHref('handlers'), 'asgManage') : item('no_contacts', handlersHref('vendors'), 'asgManage');
  return null;
}

/** TKSTAFF2: why the staff group (employees without an account) cannot be used now, or null. Staff are handlers: the outside
 * permission is not asked (services/tickets/assignees.py); their personal link still needs the handler page. `count` is how many staff
 * the server offered for this ticket. */
export function staffBlock(o: { readiness?: Readiness | null; publicReady: boolean; count: number }): ReadyItem | null {
  const pub = o.readiness ? publicItem(o.readiness) : o.publicReady ? null : item('page_off', SETTINGS_HREF.public);
  if (pub) return pub;
  return o.count === 0 ? item('no_employees', handlersHref('handlers'), 'asgManage') : null;
}

/** The note an usable outside group carries when WhatsApp cannot send (the link is then e-mailed or copied). */
export function whatsappNote(r: Readiness | null | undefined): ReadyItem | null {
  return r ? whatsappItem(r) : null;
}

/** The handlers group: nobody to assign in the department. */
export function usersBlock(count: number): ReadyItem | null {
  return count === 0 ? item('no_members', handlersHref('handlers'), 'asgManage') : null;
}
