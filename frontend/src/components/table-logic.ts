/**
 * CR-CMP2-TABLES-2450 (owner N10): the DOM-free rules of `sw-table` - which per-row attributes a screen may set on a row (the spec hooks
 * of the hand-built tables, `tr[data-board=...]`), the class / part list of one cell from its column's shared cell kind, and the keyboard
 * walk between focusable rows. Kept apart from the element so the node unit specs read them without a browser.
 */

/** A row hook value: `null` / `undefined` / `false` leave the attribute off, `true` sets it empty, anything else is its string. */
type RowAttrValue = string | number | boolean | null | undefined;
export type RowAttrs = Readonly<Record<string, RowAttrValue>>;

/** Only hooks and accessible names reach a row: `data-*`, `aria-*` and `title`. The row's own wiring (class, tabindex, role, style,
 * event handlers, `data-row-id`) stays the table's, so a screen cannot break the keyboard or the look through its hooks. */
const ROW_ATTR = /^(data-[a-z0-9][a-z0-9._-]*|aria-[a-z]+|title)$/;
const OWN = new Set(['data-row-id']);

export const rowAttrAllowed = (name: string): boolean => ROW_ATTR.test(name) && !OWN.has(name);

/** The attributes to set on a row, as strings, from a screen's `rowAttrs(row)` result (names lower-cased; disallowed and off values
 * dropped). */
export function rowAttrMap(raw: RowAttrs | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const name = k.toLowerCase();
    if (!rowAttrAllowed(name) || v === null || v === undefined || v === false) continue;
    out[name] = v === true ? '' : String(v);
  }
  return out;
}

/** The shared cell kinds (the vocabulary that replaces the screens' own `.num` / `.mut` / chip / actions / ellipsis cell classes):
 *  - `num`: tabular figures, the value its own left-to-right isolate, aligned to the reading end;
 *  - `muted`: the secondary ink and the small size;
 *  - `status`: a cell that holds a status chip (no wrap, a little tighter);
 *  - `actions`: the row's buttons, packed at the reading end, never wrapped;
 *  - `truncate`: one line, cut with an ellipsis at `--sw-table-trunc` (default 260 px); the full text is the cell's title. */
export type CellKind = 'num' | 'muted' | 'status' | 'actions' | 'truncate';
const CELL_KINDS: readonly CellKind[] = ['num', 'muted', 'status', 'actions', 'truncate'];

interface CellShape {
  ltr?: boolean;
  hideBelow?: 'phone' | 'tablet';
  card?: 'title' | 'badge' | 'meta' | 'show' | 'hide';
  kind?: CellKind | readonly CellKind[];
  align?: 'start' | 'center' | 'end';
}

const kindsOf = (c: CellShape): CellKind[] => (c.kind === undefined ? [] : typeof c.kind === 'string' ? [c.kind] : [...c.kind]).filter((k) => CELL_KINDS.includes(k));

/** the class list of one body cell: ltr, hideBelow, its place in the phone row template, its shared kinds and alignment */
export function cellClassOf(c: CellShape): string {
  return [
    c.ltr ? 'ltr' : '',
    c.hideBelow ? `hb-${c.hideBelow}` : '',
    c.card && c.card !== 'hide' ? `c-${c.card}` : '',
    ...kindsOf(c).map((k) => `k-${k}`),
    c.align && c.align !== 'start' ? `a-${c.align}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** the part list of one body cell: `cell` plus `cell-<kind>` per kind, so a host can reach one family (`sw-table::part(cell-num)`) */
export const cellPartOf = (c: CellShape): string => ['cell', ...kindsOf(c).map((k) => `cell-${k}`)].join(' ');

/** the class list of a header cell: hideBelow and the alignment (a number column's header sits over its figures) */
export function headClassOf(c: CellShape): string {
  const kinds = kindsOf(c);
  const align = c.align ?? (kinds.includes('num') || kinds.includes('actions') ? 'end' : 'start');
  return [c.hideBelow ? `hb-${c.hideBelow}` : '', align !== 'start' ? `a-${align}` : ''].filter(Boolean).join(' ');
}

/** The row the keyboard moves to among `count` focusable rows: ArrowDown / ArrowUp step (no wrap: a list has a top and a bottom),
 * Home / End jump. Block-direction keys, so the reading direction (RTL) does not change them. -1 = not a row key. */
export function rowFocusStep(key: string, from: number, count: number): number {
  if (count <= 0) return -1;
  switch (key) {
    case 'ArrowDown':
      return Math.min(count - 1, from + 1);
    case 'ArrowUp':
      return Math.max(0, from - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return -1;
  }
}
