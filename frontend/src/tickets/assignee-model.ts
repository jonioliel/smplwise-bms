/**
 * TKSTAFF2 (owner 2026-10-16): the ONE assignee model of the screens - every place a handler is picked (the assign dialog, the create
 * sheet, the table's handler menu and filter, the bulk bar) reads the same list and sends the same reference. A handler is an account
 * holder (`kind: 'user'`) or a staff contact without an account (`kind: 'contact'`, an employee of the directory who gets the personal
 * handler link); the server decides everything else (services/tickets/assignees.py). Pure: no rendering here.
 */
import type { AssigneesList, Handler, TicketItem } from '../api/tickets';

/** The picker list of an assignees answer; an older server / the demo store without `handlers` -> its account holders. */
export function handlersOf(r: AssigneesList | null | undefined): Handler[] {
  if (!r) return [];
  if (r.handlers) return r.handlers;
  return (r.users ?? []).map((u) => ({ key: `user:${u.id}`, kind: 'user' as const, id: u.id, name: u.name, account: true, member_role: u.member_role,
    phone: null, has_phone: false, preferred_channel: 'inapp' }));
}

/** What the assign / bulk / create routes take: `{kind, id}`. */
export function assigneeRef(h: Pick<Handler, 'kind' | 'id'>): { kind: 'user' | 'contact'; id: string } {
  return { kind: h.kind, id: h.id };
}

/** The board / table filter key of a ticket's current handler ('' = nobody). */
export function assigneeKey(a: TicketItem['assignee'] | null | undefined): string {
  return a && a.id ? `${a.kind === 'contact' ? 'contact' : 'user'}:${a.id}` : '';
}

/** Whether this handler holds the ticket now. */
export function holds(a: TicketItem['assignee'] | null | undefined, h: Pick<Handler, 'key'>): boolean {
  return !!a && assigneeKey(a) === h.key;
}

/** The handlers of several departments as one list (the bulk bar): each once, by key, sorted by name with account holders first. */
export function mergeHandlers(lists: Handler[][]): Handler[] {
  const byKey = new Map<string, Handler>();
  for (const l of lists) for (const h of l) if (!byKey.has(h.key)) byKey.set(h.key, h);
  return [...byKey.values()].sort((a, b) => Number(b.account) - Number(a.account) || a.name.localeCompare(b.name));
}

/** The assignee filter's choices from the rows a screen already holds: everyone who holds one of them, each once, by name. */
export function holdersOf(rows: readonly Pick<TicketItem, 'assignee'>[]): { key: string; name: string; account: boolean }[] {
  const byKey = new Map<string, { key: string; name: string; account: boolean }>();
  for (const r of rows) {
    const k = assigneeKey(r.assignee);
    if (k && r.assignee && !byKey.has(k)) byKey.set(k, { key: k, name: r.assignee.name, account: r.assignee.kind !== 'contact' });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
