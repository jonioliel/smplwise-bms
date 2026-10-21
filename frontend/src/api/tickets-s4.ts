/**
 * CR-038 slice 4: the outside-contact routes of the tickets API, beside api/tickets.ts (one module per slice's wire contract keeps
 * the parallel slices' edits apart):
 *   GET/POST/PATCH tickets/contacts[/{id}], POST .../erase, GET .../export   the contact / vendor directory (Settings)
 *   GET  tickets/assignees  (its `contacts` / `external` / `public_ready` part) the assign dialog's outside contacts
 *   POST tickets/{id}/assign/preview                                          the outgoing text, the link times, the refusals
 *   POST tickets/{id}/assign  {assignee: {kind: 'contact'}}                   sending a ticket outside
 *   POST tickets/{id}/link/copy|new|revoke                                    the link panel
 *   GET  tickets/health, POST tickets/address/probe, POST tickets/key/rotate  the handler page's card (system.configure)
 * Without a backend (static preview, design review) the demo store in ./tickets-s4-mock.ts answers.
 */
import { get, patch, post } from './client';
import { isApi } from './session';
import { s4Mock } from './tickets-s4-mock';
import type { Eligible, Handler, PublicSettings, TicketDetail } from './tickets';

/** 'employee' (owner request 2026-10-14, migration 0084): an employee WITHOUT an account - assigned through a handler link like a contact. */
export type ContactKind = 'person' | 'vendor' | 'employee';
export type ContactChannel = 'whatsapp' | 'email' | 'manual';
export type ContactLang = 'he' | 'en' | 'ar' | 'ru';
export const CONTACT_LANGS: readonly ContactLang[] = ['he', 'en', 'ar', 'ru'];
export const CONTACT_CHANNELS: readonly ContactChannel[] = ['whatsapp', 'email', 'manual'];

/** One directory row as the caller may see it (a masked phone / e-mail without the right to the full one). */
export interface Contact {
  id: string;
  kind: ContactKind;
  vendor_id: string | null;
  vendor_name: string | null;
  user_linked: boolean;
  display_name: string;
  company: string;
  phone: string | null;
  phone_full: boolean;
  has_phone: boolean;
  email: string | null;
  preferred_channel: ContactChannel;
  require_code: boolean;
  share_history: boolean | null;
  lang: ContactLang;
  notes: string;
  active: boolean;
  erased: boolean;
  departments: string[];
  open_tickets: number;
  last_assigned_at: string | null;
  revision: number;
  live_links?: number;
  /** slice 9 (11A.1 / 11A.2): the cost-claim defaults; the rate only for tickets.costs.view holders */
  cost_claim?: 'required' | 'optional' | 'off' | null;
  vat_exempt?: boolean;
  vat_default?: 'included' | 'excluded';
  labor_rate_minor?: number | null;
  rate_currency?: string | null;
  persons?: { id: string; display_name: string }[];
  /** TKNOTIFOTP: "verify the number with a code" - the row's switch, whether a code is required (installation OR row), the confirmation */
  phone_verify?: boolean;
  phone_verify_required?: boolean;
  phone_confirmed?: boolean;
  phone_confirmed_via?: 'user' | 'manager' | 'code' | null;
  /** one row only, for a directory editor: a code is waiting, and the token of the manager's mark (null = not offered) */
  phone_code_pending?: boolean;
  phone_confirm_token?: string | null;
  /** CR-DEPT-MANAGER-HANDLERS: a department manager may edit / erase this row (he created it and no other department uses it) */
  manager_editable?: boolean;
  /** CR-DEPT-MANAGER-HANDLERS (0111): the department a manager created the row in - named only for a directory editor and a manager of
   *  that department; `other` = created by another department (no name, no id); null / absent = created in Settings */
  created_department?: CreatedDepartment | null;
}
export interface CreatedDepartment { id: string | null; name: string | null; other: boolean }
/** `handler_departments`: the departments in which the caller manages handlers without tickets.configure (CR-DEPT-MANAGER-HANDLERS) */
/** `can_edit_staff` (TICKPERM-295): may edit handlers' rows (employees, user-linked); a directory-only holder gets false (an older server: absent) */
export interface ContactsPage { contacts: Contact[]; can_edit: boolean; can_edit_staff?: boolean; handler_departments?: string[] }
export interface ContactBody {
  kind?: ContactKind;
  display_name?: string;
  company?: string;
  vendor_id?: string | null;
  phone?: string | null;
  email?: string | null;
  preferred_channel?: ContactChannel;
  require_code?: boolean;
  share_history?: boolean | null;
  lang?: ContactLang;
  notes?: string;
  active?: boolean;
  departments?: string[];
  cost_claim?: 'required' | 'optional' | 'off' | null;
  vat_exempt?: boolean;
  vat_default?: 'included' | 'excluded';
  /** a decimal text ('120', '120.50'); null / '' clears the rate */
  labor_rate?: string | null;
  rate_currency?: string | null;
  /** TKNOTIFOTP: the row's "verify the number with a code" switch */
  phone_verify?: boolean;
  revision?: number;
}
export interface ContactExport { contact: Record<string, unknown>; departments: string[]; assignments: Record<string, unknown>[]; timeline: Record<string, unknown>[] }

/** An outside contact the assign dialog offers for one ticket. */
export interface ExternalAssignee {
  kind: 'contact';
  id: string;
  contact_kind: ContactKind;
  name: string;
  company: string;
  vendor_name: string | null;
  phone: string | null;
  has_phone: boolean;
  has_email: boolean;
  preferred_channel: ContactChannel;
  require_code: boolean;
  share_history: boolean | null;
  lang: ContactLang;
}
/** What sending outside still needs (GET tickets/readiness, and `readiness` of GET tickets/assignees): booleans and counts only. */
export interface Readiness {
  public_page: boolean;
  public_option: boolean;
  base_url: boolean;
  module_key: boolean;
  public_ready: boolean;
  public_missing: string[];
  master_switch: boolean;
  account_mapped: boolean;
  email_fallback: boolean;
  email_configured: boolean;
  contacts_count: { employee: number; vendor: number; person: number };
}
export interface AssigneesAnswer { users: Eligible[]; handlers?: Handler[]; contacts?: ExternalAssignee[]; external?: boolean; public_ready?: boolean; readiness?: Readiness }

export type Refusal = 'public_link_unavailable' | 'code_channel_unavailable' | string;
export interface AssignPreview {
  channel: ContactChannel;
  lang: ContactLang;
  text: string;
  require_code: boolean;
  require_code_locked: boolean;
  code_to_contact_phone: boolean;
  share_history: { available: boolean; default: boolean };
  link: { sliding_days: number; cap_days: number; grace_hours: number; expires_at: string; cap_at: string };
  refusals: Refusal[];
  /** CR-ORG-LOCATIONS: the navigation-link switch - `available` = the request's location has coordinates; `on` = this text carries the link */
  location_nav?: { available: boolean; on: boolean };
  /** GRANTS3-295: the "access needed" tick (the arrival step on the vendor's page) - offered only while the external-access feature is on */
  access_needed?: { available: boolean };
}
export interface AssignContactBody { contactId: string; note?: string | null; noteExternal?: boolean; requireCode?: boolean | null; shareHistory?: boolean | null; sendNow?: boolean | null;
  /** slice 9 (D32): the cost claim requirement of THIS assignment; null = the server's preselection */
  costClaim?: 'required' | 'optional' | 'off' | null;
  /** CR-ORG-LOCATIONS: add the map link to the message (default off; only where the preview says it is available) */
  locationNav?: boolean | null;
  /** GRANTS3-295: "access needed" - the vendor's page offers the arrival step (default off) */
  accessNeeded?: boolean | null; revision: number }

export type LinkState = 'live' | 'grace' | 'expired' | 'revoked';
export type LinkRevokedReason = 'closed' | 'cancelled' | 'reassigned' | 'returned' | 'not_mine' | 'manual' | 'resent' | 'module_key' | 'contact_changed' | 'contact_erased' | 'user_inactive';
/** The `link` block of a ticket (managers only; never the token or the URL - the copy route returns that once). */
export interface LinkBlock {
  /** TKSTAFF1: 'staff' = an internal employee's no-login link (WhatsApp only, never copied) */
  kind?: 'external' | 'staff';
  state: LinkState;
  current: boolean;
  generation: number;
  created_at: string;
  expires_at: string;
  cap_at: string;
  grace_until: string | null;
  revoked_at: string | null;
  revoked_reason: LinkRevokedReason | null;
  sent_via: ContactChannel | null;
  sent_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  devices: number;
  update_count: number;
  require_code: boolean;
  code_locked: boolean;
  can: { copy: boolean; new: boolean; revoke: boolean; resend: boolean };
}
export type TicketWithLink = TicketDetail & { link?: LinkBlock | null };
export interface CopyAnswer { url: string; text: string }

export type { PublicSettings } from './tickets';
export type ClientIpHeader = PublicSettings['client_ip_header'];
export type PublicMissing = 'option' | 'listener' | 'address' | 'key';
export interface TicketsHealth {
  option: boolean;
  listener: { running?: boolean; port?: number; stats?: Record<string, unknown> } | null;
  error: string | null;
  rate_limit_trips: Record<string, number>;
  module_key: { state: string; [k: string]: unknown };
  links: { live: number; grace: number; expired: number; revoked: number; locked: number; /** TKSTAFF1 */ live_staff?: number };
  address_configured: boolean;
  missing: PublicMissing[];
  attachments_bytes?: number | null;
}
export type ProbeResult = 'reachable' | 'not_configured' | 'invalid' | 'unresolved' | 'blocked_address' | 'tls_error' | 'unreachable' | 'wrong_answer' | 'not_seen';
export interface ProbeAnswer { result: ProbeResult | string; code?: string; status_class?: string; listener?: { seen: boolean; source: string | null; peer: string | null; header_ok: boolean } }

export interface TicketsS4Backend {
  contacts(q?: { q?: string; kind?: ContactKind; department_id?: string }): Promise<ContactsPage>;
  contact(id: string): Promise<Contact>;
  createContact(body: ContactBody): Promise<Contact>;
  patchContact(id: string, body: ContactBody): Promise<Contact>;
  eraseContact(id: string, history: boolean): Promise<{ id: string; erased: boolean; links_revoked: number }>;
  exportContact(id: string): Promise<ContactExport>;
  /** the assign dialog's outside contacts when the users' answer did not carry them (the demo store) */
  externalAssignees(departmentId: string, ticketId: string): Promise<AssigneesAnswer>;
  preview(ticketId: string, contactId: string, requireCode: boolean, locationNav?: boolean): Promise<AssignPreview>;
  assignContact(ticketId: string, body: AssignContactBody): Promise<TicketWithLink>;
  copyLink(ticketId: string): Promise<CopyAnswer>;
  linkAction(ticketId: string, action: 'new' | 'revoke'): Promise<TicketWithLink>;
  health(): Promise<TicketsHealth>;
  probe(baseUrl?: string): Promise<ProbeAnswer>;
  rotateKey(): Promise<{ rotated: boolean; links_revoked: number; contacts_rekeyed: number }>;
  readiness(departmentId?: string): Promise<Readiness>;
}

const T = 'tickets';
const enc = encodeURIComponent;
const qs = (o: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

const rest: TicketsS4Backend = {
  contacts: (q = {}) => get<ContactsPage>(`${T}/contacts${qs({ q: q.q?.trim(), kind: q.kind, department_id: q.department_id })}`),
  contact: (id) => get<Contact>(`${T}/contacts/${enc(id)}`),
  createContact: (body) => post<Contact>(`${T}/contacts`, body),
  patchContact: (id, body) => patch<Contact>(`${T}/contacts/${enc(id)}`, body),
  eraseContact: (id, history) => post<{ id: string; erased: boolean; links_revoked: number }>(`${T}/contacts/${enc(id)}/erase`, { confirm: true, history }),
  exportContact: (id) => get<ContactExport>(`${T}/contacts/${enc(id)}/export`),
  externalAssignees: (departmentId, ticketId) => get<AssigneesAnswer>(`${T}/assignees${qs({ department_id: departmentId, ticket_id: ticketId })}`),
  preview: (ticketId, contactId, requireCode, locationNav) => post<AssignPreview>(`${T}/${enc(ticketId)}/assign/preview`, { contact_id: contactId, require_code: requireCode, ...(locationNav ? { location_nav: true } : {}) }),
  assignContact: (ticketId, b) => post<TicketWithLink>(`${T}/${enc(ticketId)}/assign`, {
    assignee: { kind: 'contact', id: b.contactId }, note: b.note ?? null, note_external: b.noteExternal ?? true, revision: b.revision,
    ...(b.requireCode !== undefined && b.requireCode !== null ? { require_code: b.requireCode } : {}),
    ...(b.shareHistory !== undefined && b.shareHistory !== null ? { share_history: b.shareHistory } : {}),
    ...(b.costClaim ? { cost_claim: b.costClaim } : {}),
    ...(b.sendNow ? { send_now: true } : {}), // slice 5b (D29): the message leaves outside the send hours
    ...(b.locationNav ? { location_nav: true } : {}), // CR-ORG-LOCATIONS: default off
    ...(b.accessNeeded ? { access_needed: true } : {}), // GRANTS3-295: default off
  }),
  copyLink: (ticketId) => post<CopyAnswer>(`${T}/${enc(ticketId)}/link/copy`, {}),
  linkAction: (ticketId, action) => post<TicketWithLink>(`${T}/${enc(ticketId)}/link/${action}`, {}),
  health: () => get<TicketsHealth>(`${T}/health`),
  probe: (baseUrl) => post<ProbeAnswer>(`${T}/address/probe`, baseUrl === undefined ? {} : { base_url: baseUrl }),
  rotateKey: () => post<{ rotated: boolean; links_revoked: number; contacts_rekeyed: number }>(`${T}/key/rotate`, { confirm: true }),
  readiness: (departmentId) => get<Readiness>(`${T}/readiness${qs({ department_id: departmentId })}`),
};

/** The backend in force: REST with a server, the demo store without one. */
export function ticketsS4Api(): TicketsS4Backend {
  return isApi() ? rest : s4Mock;
}
