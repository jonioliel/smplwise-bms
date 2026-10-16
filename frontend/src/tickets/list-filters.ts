/**
 * TKUI4 (release 2.6.0): the filter row of the cards and the board (mock-up v5 "סינון": priority, handler, stuck / waiting for me / cost to
 * approve). The server already narrows by scope, state, department and text; this row narrows the rows a screen HOLDS by what each row
 * carries, so it never asks the server for more and never widens what the server's visibility rule allowed. The table keeps its own
 * server-side filters (tables/table-toolbar.ts). Pure: tests/unit-tickets-list.spec.ts.
 */
import type { TicketItem } from '../api/tickets';
import { assigneeKey, holdersOf } from './assignee-model';
import type { CardItem } from './list-card-model';

export type CardFlag = 'stuck' | 'waiting' | 'cost';
export const CARD_FLAGS: readonly CardFlag[] = ['stuck', 'waiting', 'cost'];

export interface CardFilters {
  /** priority keys; empty = any */
  priority: string[];
  /** '' = anyone, 'none' = no handler, else the assignee key (`user:<id>` / `contact:<id>`) */
  handler: string;
  /** every chosen flag must hold */
  flags: CardFlag[];
}

export const NO_CARD_FILTERS: CardFilters = { priority: [], handler: '', flags: [] };

export function activeCardFilters(f: CardFilters): number {
  return f.priority.length + (f.handler ? 1 : 0) + f.flags.length;
}

function flagHolds(item: CardItem, flag: CardFlag): boolean {
  switch (flag) {
    case 'stuck':
      return !!item.stuck;
    case 'waiting':
      return item.waiting_on === 'manager' && !['closed', 'cancelled'].includes(item.status);
    case 'cost':
      return item.cost?.status === 'submitted';
  }
}

export function matchesCardFilters(item: CardItem, f: CardFilters): boolean {
  if (f.priority.length && !(item.priority && f.priority.includes(item.priority.key))) return false;
  if (f.handler === 'none' ? !!assigneeKey(item.assignee) : f.handler && assigneeKey(item.assignee) !== f.handler) return false;
  return f.flags.every((flag) => flagHolds(item, flag));
}

export function applyCardFilters<T extends CardItem>(items: readonly T[], f: CardFilters): T[] {
  return activeCardFilters(f) ? items.filter((x) => matchesCardFilters(x, f)) : [...items];
}

/** Which flags this screen can offer: a flag nobody can satisfy (the list item does not carry it) is not offered. */
export function offeredFlags(items: readonly CardItem[]): CardFlag[] {
  const has = (flag: CardFlag) => {
    if (flag === 'waiting') return true;
    if (flag === 'stuck') return items.some((x) => 'stuck' in x);
    return items.some((x) => !!x.cost);
  };
  return CARD_FLAGS.filter(has);
}

/** The priorities the held rows use, most urgent first (rank 0 is the most urgent). */
export function priorityChoices(items: readonly Pick<TicketItem, 'priority'>[]): { key: string; name: string }[] {
  const seen = new Map<string, { key: string; name: string; rank: number }>();
  for (const x of items) if (x.priority && !seen.has(x.priority.key)) seen.set(x.priority.key, { key: x.priority.key, name: x.priority.name, rank: x.priority.rank });
  return [...seen.values()].sort((a, b) => a.rank - b.rank).map(({ key, name }) => ({ key, name }));
}

/** The handlers of the held rows (each once, by name). */
export function handlerChoices(items: readonly Pick<TicketItem, 'assignee'>[]): { key: string; name: string }[] {
  return holdersOf(items).map(({ key, name }) => ({ key, name }));
}

export function toggleIn<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
