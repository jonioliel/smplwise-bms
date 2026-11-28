// FIX-TICKETS2-2570 (TK2-02 / TK2-03 / TK2-04): small pure helpers so a screen never lets an answer that arrived late overwrite what the
// viewer looks at now (another ticket, another department, a newer list read). No DOM, no network: the screens pass their own reads.

/** True while the scope an answer was asked for (a ticket id, a department key) is still the scope on screen. */
export function stillOn<T>(asked: T, shown: T): boolean {
  return asked === shown;
}

/** A sequence counter: `begin()` for each read; only the answer of the newest read is `current`. */
export class Latest {
  private n = 0;
  begin(): number {
    this.n += 1;
    return this.n;
  }
  current(token: number): boolean {
    return token === this.n;
  }
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

/**
 * Read `pages` pages in order (the first without a cursor, each next with the cursor of the one before) and stop early when the
 * list ends. A quiet refresh of a list the viewer paged through with "load more" reads as many pages as are on screen, so the
 * refresh keeps them instead of falling back to page 1. `alive()` is checked after every page: a stale read stops and returns null.
 */
export async function readPages<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>,
  pages: number,
  alive: () => boolean = () => true,
): Promise<{ items: T[]; next: string | null; pages: number } | null> {
  const items: T[] = [];
  let cursor: string | null = null;
  let got = 0;
  const want = Math.max(1, Math.floor(pages));
  while (got < want) {
    const page: CursorPage<T> = await fetchPage(cursor);
    if (!alive()) return null;
    items.push(...page.items);
    got += 1;
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  return { items, next: cursor, pages: got };
}
