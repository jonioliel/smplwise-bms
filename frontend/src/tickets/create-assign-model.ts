/**
 * TKUI1 (owner requirement 16.10): the handler choice of the new-request sheet ("בקשת שירות חדשה"), as a pure option model
 * (tests/unit-tickets-create-assign.spec.ts). Three groups under headings - with an account / without an account (staff contacts, 2.5.8:
 * the create route accepts them) / vendors and outside contacts - with "assign later" always first and a search field once there are more
 * than six entries.
 *
 * Vendors are never assigned by the create route (by design: an outside assignment needs the message preview, the code option and the
 * cost-claim choice). Choosing one is a TWO-STEP flow: the request is created UNASSIGNED and the drawer opens on it with the existing
 * external-assign dialog prefilled with that vendor (`?assign=contact:<id>`); cancelling the dialog leaves the request unassigned.
 * The vendor group is offered only to a holder of `tickets.external` with the handler page ready; otherwise it is shown disabled with the
 * reason (tickets/readiness-model.ts `outsideBlock`, the same words and link as the assign dialog).
 */
import type { Handler } from '../api/tickets';
import type { ExternalAssignee, Readiness } from '../api/tickets-s4';
import { outsideBlock, type ReadyItem } from './readiness-model';

export type CreateGroupKey = 'later' | 'account' | 'staff' | 'vendor';
export const CREATE_GROUPS: readonly CreateGroupKey[] = ['later', 'account', 'staff', 'vendor'];
/** More than this many entries (handlers + vendors) shows the search field. */
export const SEARCH_ABOVE = 6;
export const LATER = 'later';

export interface CreateOption {
  /** the radio value: 'later', `h:<handler key>` or `v:<contact id>` */
  value: string;
  label: string;
  sub: string;
}
export interface CreateGroup {
  key: CreateGroupKey;
  options: CreateOption[];
  /** how many entries the group has before the search */
  total: number;
  /** why the group cannot be used now (vendors only), or null */
  blocked: ReadyItem | null;
}
export interface CreatePick {
  kind: 'later' | 'handler' | 'vendor';
  id: string;
}

export const handlerValue = (h: Pick<Handler, 'key'>) => `h:${h.key}`;
export const vendorValue = (c: Pick<ExternalAssignee, 'id'>) => `v:${c.id}`;

/** What a radio value means. */
export function parsePick(value: string): CreatePick {
  if (value.startsWith('h:')) return { kind: 'handler', id: value.slice(2) };
  if (value.startsWith('v:')) return { kind: 'vendor', id: value.slice(2) };
  return { kind: 'later', id: '' };
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export interface CreateAssignInput {
  handlers: readonly Handler[];
  /** the outside contacts of GET tickets/assignees (staff contacts are handlers and are dropped here); null = still loading */
  contacts: readonly ExternalAssignee[] | null;
  external: boolean;
  publicReady: boolean;
  readiness?: Readiness | null;
  query?: string;
}

export function createAssignGroups(o: CreateAssignInput): { groups: CreateGroup[]; searchable: boolean } {
  const q = norm(o.query);
  const hit = (...xs: (string | null | undefined)[]) => !q || xs.some((x) => norm(x).includes(q));
  const account = o.handlers.filter((h) => h.account);
  const staff = o.handlers.filter((h) => !h.account);
  const outside = (o.contacts ?? []).filter((c) => c.contact_kind !== 'employee');
  const blocked = o.contacts === null && o.external ? null : outsideBlock('person', { external: o.external, readiness: o.readiness, publicReady: o.publicReady, count: outside.length });
  const hOpt = (h: Handler): CreateOption => ({ value: handlerValue(h), label: h.name, sub: h.phone ?? '' });
  const groups: CreateGroup[] = [
    { key: 'later', options: [{ value: LATER, label: '', sub: '' }], total: 1, blocked: null },
    { key: 'account', options: account.filter((h) => hit(h.name)).map(hOpt), total: account.length, blocked: null },
    { key: 'staff', options: staff.filter((h) => hit(h.name, h.phone)).map(hOpt), total: staff.length, blocked: null },
    {
      key: 'vendor',
      options: blocked ? [] : outside.filter((c) => hit(c.name, c.company, c.vendor_name)).map((c) => ({ value: vendorValue(c), label: c.name, sub: [c.vendor_name ?? c.company, c.phone].filter(Boolean).join(' · ') })),
      total: outside.length,
      blocked,
    },
  ];
  const entries = account.length + staff.length + (blocked ? 0 : outside.length);
  return { groups, searchable: entries > SEARCH_ABOVE };
}

/** The list href that opens the new request in the drawer with the external-assign dialog prefilled (step two of the vendor flow). */
export function assignParam(contactId: string): string {
  return `contact:${contactId}`;
}
export function parseAssignParam(raw: string | null | undefined): string {
  const m = /^contact:([A-Za-z0-9_-]{1,64})$/.exec(raw ?? '');
  return m ? m[1] : '';
}

/** A ticket address (list with `?t=`, the board, or `#/tickets/<id>`) with the vendor-flow parameter added. */
export function withAssign(href: string, contactId: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}assign=${encodeURIComponent(assignParam(contactId))}`;
}
