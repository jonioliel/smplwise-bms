/**
 * TKUI4 (release 2.6.0): the counts of the list's page frame (mock-up v5: "שלי 3 · המחלקה 9 · כל המחלקות 10" and "פתוחות 9 · ללא מטפל 1 ...").
 * Read from `GET tickets/facets` (the server's single visibility rule decides every number); a count that could not be read is simply
 * absent and the segment shows no number. Pure: tests/unit-tickets-list.spec.ts.
 */
import type { Facets } from '../api/tickets-board';
import type { StatusFilter } from '../api/tickets';
import { SCOPES, STATUS_FILTERS, type TicketsRoute } from './model';

export type ScopeKey = TicketsRoute['scope'];
export interface ListCounts {
  scopes: Partial<Record<ScopeKey, number>>;
  states: Partial<Record<StatusFilter, number>>;
  /** per department id, over the current scope (the department chips) */
  departments: Record<string, number>;
}
export const NO_COUNTS: ListCounts = { scopes: {}, states: {}, departments: {} };

/** The state segment's numbers from one facets answer taken over every state (`status: all`). */
export function stateCountsOf(f: Pick<Facets, 'groups' | 'total'>): Partial<Record<StatusFilter, number>> {
  const out: Partial<Record<StatusFilter, number>> = {};
  for (const s of STATUS_FILTERS) out[s] = s === 'all' ? f.total : f.groups[s] ?? 0;
  return out;
}

/** Folds the answers of the (up to) three scope reads, the state read and the department read into one `ListCounts`; failures are `null`. */
export function foldCounts(parts: { scopes: Partial<Record<ScopeKey, Pick<Facets, 'total'> | null>>; states: Pick<Facets, 'groups' | 'total'> | null; departments: Pick<Facets, 'departments'> | null }): ListCounts {
  const scopes: ListCounts['scopes'] = {};
  for (const s of SCOPES) {
    const v = parts.scopes[s];
    if (v) scopes[s] = v.total;
  }
  return { scopes, states: parts.states ? stateCountsOf(parts.states) : {}, departments: parts.departments?.departments ?? {} };
}

/** "9" or '' - the number a segment shows (the 2000+ scan cap is the server's, shown as it comes). */
export function countText(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}
