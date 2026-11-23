import { LitElement, html, css, nothing, noChange, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Directive, directive, PartType, type ElementPart, type PartInfo } from 'lit/directive.js';
import { tr } from '../i18n/msg/components';
import { cellClassOf, cellPartOf, groupSegments, headClassOf, rowAttrMap, rowFocusStep, rowReach, type CellKind, type RowAttrs } from './table-logic';

export type { CellKind, RowAttrs } from './table-logic';

export interface TableColumn<Row = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  ltr?: boolean;
  render?: (row: Row) => TemplateResult | string | typeof nothing;
  /** POLISH4-WP1 (ACCESS-POLISH-2331 proposal): a secondary column that steps out below a width, so a screen drops it without a media
   * query of its own - `phone` below 768 px (the column's line is left out of the row card), `tablet` below 1024 px (the column and its
   * header are left out of the table too). Unset: the column always shows (every existing table is unchanged). */
  hideBelow?: 'phone' | 'tablet';
  /** AUDIT30-B-SHARED (audit round 30, finding 10; owner gate Q8, option א assumed): the column's place in the PHONE ROW TEMPLATE
   * (max-width: 599px). As soon as one column of a table sets `card`, every row there is one compact line:
   *   `title` (one column: the name, ellipsis)  +  `badge` (one column: the state, at the line's end)
   *   then ONE meta line: every `meta` column, in column order, joined with " · "
   *   `show`: kept below the meta line as the old caption / value pair;  `hide` or unset: left out on the phone.
   * A table that marks no column keeps the old label / value stack (unchanged). */
  card?: 'title' | 'badge' | 'meta' | 'show' | 'hide';
  /** CR-CMP2-TABLES-2450 (owner N10): the column's shared cell kind(s) - the vocabulary that replaces a screen's own cell classes, which
   * do not reach into this shadow root: `num` (tabular figures, a left-to-right isolate, aligned to the reading end), `muted`, `status`
   * (holds a `.chip`), `actions` (the row's buttons at the reading end), `truncate` (one line with an ellipsis). Every kind is also a
   * part (`sw-table::part(cell-num)`). Unset: the cell is drawn as before. */
  kind?: CellKind | readonly CellKind[];
  /** CR-CMP2-TABLES-2450: the column's alignment (a `num` / `actions` column already sits at the reading end) */
  align?: 'start' | 'center' | 'end';
  /** CR-CMP2-TABLES-2450: the cell's tooltip (a `truncate` column without `render` shows its own text) */
  cellTitle?: (row: Row) => string | undefined;
  /** CR-CMP2-TABLES-2450: per-cell hooks (`data-*` / `aria-*` / `title`), as `rowAttrs` does for the row - a spec that reads
   * `td[data-reads-place]` keeps finding the cell */
  cellAttrs?: (row: Row) => RowAttrs;
  /** CR-CMP2-TABLES-CONSUMPTION-2450: the column's cell in the table's foot row (a total under the rows: `<tfoot>`, bold, a strong rule
   * above it). The foot row is drawn as soon as one column sets `foot`; a column without it leaves its foot cell empty. */
  foot?: () => TemplateResult | string | typeof nothing;
}

/** CR-CMP2-TABLES-CONSUMPTION-2450: a table has a foot row when one of its columns names a foot cell. */
const hasFootRow = <R>(cols: readonly TableColumn<R>[]): boolean => cols.some((c) => !!c.foot);

/** The phone row template is on for a table as soon as one of its columns names its place in it. */
export const usesCardTemplate = <R>(cols: readonly TableColumn<R>[]): boolean => cols.some((c) => !!c.card);

/** CR-CMP2-TABLES-2450: the per-row hooks (`rowAttrs`) on a `<tr>` - set as given, and removed when a later render drops one (a row is
 * reused by position). Only `data-*`, `aria-*` and `title` pass (table-logic `rowAttrMap`). */
class RowAttrsDirective extends Directive {
  private last = new Set<string>();
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT) throw new Error('rowHooks() belongs on an element (a row or a cell)');
  }
  render(_attrs: RowAttrs | null | undefined) {
    return noChange;
  }
  update(part: ElementPart, [attrs]: [RowAttrs | null | undefined]) {
    const el = part.element;
    const want = rowAttrMap(attrs);
    for (const name of this.last) if (!(name in want)) el.removeAttribute(name);
    for (const [name, v] of Object.entries(want)) if (el.getAttribute(name) !== v) el.setAttribute(name, v);
    this.last = new Set(Object.keys(want));
    return noChange;
  }
}
const rowHooks = directive(RowAttrsDirective);

/**
 * Data table in the boards' language: white card, quiet grey header, 40px rows with thumbnails /
 * avatars rendered by the column's `render`, hover tint, selected row in soft blue.
 * Wide tables scroll horizontally inside the host (allowed by the contract).
 */
@customElement('sw-table')
export class SwTable extends LitElement {
  @property({ attribute: false }) columns: TableColumn[] = [];
  @property({ attribute: false }) rows: Record<string, unknown>[] = [];
  @property() rowKey = 'id';
  @property() selected: string | null = null;
  @property() emptyText = tr('אין שורות להצגה');
  @property({ type: Boolean, reflect: true }) dense = false;
  /** SHARED-POLISH-2342 (INVREST-POLISH-2331 proposal): every row is a tab stop and Enter / Space on it fires the same `row-select` a
   * click does - for a list whose rows open something and that has no link of its own in a cell. Opt-in, so the tab order of every
   * existing table is unchanged; a key pressed on a control inside a cell is left to that control. */
  @property({ type: Boolean, reflect: true, attribute: 'focus-rows' }) focusRows = false;
  /** CR-UI-CONTROLLERS-2440 (review finding 07:F17, D14 component half): 28 of the 29 tables never set `focus-rows`, so their rows opened
   * something on a click and nothing from the keyboard. A table whose host listens for `row-select` (`@row-select=${...}` in a template,
   * or `addEventListener('row-select', ...)` on the element) now gets the same tab stops and Enter / Space as `focus-rows` on its own;
   * a table nobody listens to gains no dead tab stop. `no-focus-rows` is the opt-out for a table whose cells already carry the row's
   * link or button (it wins over the listener, not over an explicit `focus-rows`). Mouse behaviour and the look are unchanged: the
   * focus ring is `:focus-visible` only. */
  @property({ type: Boolean, reflect: true, attribute: 'no-focus-rows' }) noFocusRows = false;
  /** CR-CMP2-TABLES-2450 (owner N10): per-row hooks - `data-*` / `aria-*` / `title` attributes on each `<tr>`, so a screen's specs keep
   * finding its rows (`tr[data-board="..."]`; Playwright's CSS reaches into the shadow root). */
  @property({ attribute: false }) rowAttrs?: (row: Record<string, unknown>) => RowAttrs;
  /** CR-CMP2-TABLES-2450: no card of its own (no border, radius, shadow, background) - for a table that already sits in a card */
  @property({ type: Boolean, reflect: true }) bare = false;
  /** CR-CMP2-TABLES-2450: a read-only list - the rows show no pointer, no press tint and never fire `row-select` (it wins over
   * `focus-rows` and a listener) */
  @property({ type: Boolean, reflect: true, attribute: 'static-rows' }) staticRows = false;
  /** CR-CMP2-GEN-REST-2460 (owner N10): group heading rows (opt-in) - a row for which this returns a heading is drawn as one band across
   * the table (`<th scope="rowgroup">` opening its own `<tbody>`), not as a data row: no cells, no pointer, no tab stop, never
   * `row-select`; its `rowAttrs` hooks still apply. The rows after it, up to the next heading, are its group. Unset (or `null` /
   * `undefined` for every row): no band, the table is unchanged. */
  @property({ attribute: false }) groupHeading?: (row: Record<string, unknown>) => TemplateResult | string | null | undefined;
  /** CR-CMP2-GEN-REST-2460: a small grid of figures that fits a phone keeps its columns there (no card stack below 768 px); a column
   * still steps out with `hideBelow`. For a table of a few short columns only (the generator phases): a wide table would overflow. */
  @property({ type: Boolean, reflect: true, attribute: 'keep-columns' }) keepColumns = false;
  /** CR-CMP2-POLISH-2470 (open question of CR-CMP2-TABLES-CONSUMPTION-2450 / CR-CMP2-GEN-REST-2460): per-row reach (opt-in). A row for
   * which this returns false does nothing: no tab stop, no Enter / Space, left out of the row walk, no pointer or press tint, a click
   * fires no `row-select` (part `row still`) - a closed water alert, a generator alert type without its sensor. Its `rowAttrs` hooks
   * and its cells (a control inside one stays a control) are unchanged. Unset: every row as the table says (table-logic `rowReach`). */
  @property({ attribute: false }) rowFocusable?: (row: Record<string, unknown>) => boolean;
  /** how many `row-select` listeners are registered on this element itself */
  private rowSelectListeners = 0;

  /** The rows are tab stops (and answer Enter / Space). */
  get rowsFocusable(): boolean {
    if (this.staticRows) return false;
    return this.focusRows || (!this.noFocusRows && this.rowSelectListeners > 0);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    if (!listener) return; // a null listener registers nothing (as the platform does)
    super.addEventListener(type, listener, options);
    if (type === 'row-select' && this.rowSelectListeners++ === 0) this.requestUpdate();
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    if (!listener) return;
    super.removeEventListener(type, listener, options);
    if (type === 'row-select' && this.rowSelectListeners > 0 && --this.rowSelectListeners === 0) this.requestUpdate();
  }

  static styles = css`
    :host {
      display: block;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-table-fs, var(--sw-fs-sm));
      min-inline-size: var(--sw-table-min, 560px);
    }
    /* R5-INVESTIGATE-297 (size hooks): a host may ask for taller rows and a larger reading size (the investigation lists do); the defaults
       are exactly the old values, every other table is unchanged */
    th,
    td {
      padding: var(--sw-table-cell-pad, 9px 14px);
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    :host([dense]) th,
    :host([dense]) td {
      padding: 7px 12px;
    }
    /* Phones (M45): each row is a card — cells stack, the column label becomes a small caption, the first
       column (picture / avatar) sits beside the text. Nothing scrolls sideways. */
    @media (max-width: 767px) {
      :host {
        overflow: visible;
      }
      table {
        min-inline-size: 0;
        display: block;
      }
      thead {
        display: none;
      }
      tbody {
        display: block;
      }
      tr {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 2px 12px;
        padding: 10px 12px;
        border-block-end: 1px solid var(--sw-border);
      }
      tr > td:first-child {
        grid-row: span 6;
        align-self: start;
      }
      tr > td:first-child:not([data-label='']) {
        grid-row: auto;
        grid-column: 1 / -1;
      }
      td {
        display: block;
        padding: 0;
        border: 0;
        white-space: normal;
        grid-column: 2;
        /* full-system sweep: an audit "details" cell (a JSON-ish string with no spaces) or a long entity id
           has no break opportunity, so it ran off the card's edge and widened the whole page sideways */
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      td:not([data-label=''])::before {
        content: attr(data-label);
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.3;
      }
      tr.selected {
        /* CR-CMP2-TABLES-2450: the mark sits on the row's START edge (the right one in Hebrew) */
        box-shadow: inset var(--_sel-mark, 3px) 0 0 var(--sw-accent);
      }
      :host(:dir(rtl)) tr.selected {
        --_sel-mark: -3px;
      }
    }
    th {
      position: sticky;
      top: 0;
      background: var(--sw-table-head-bg, var(--sw-surface));
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      z-index: 1;
    }
    tbody tr {
      transition: background var(--sw-t-hover) var(--sw-ease-color);
    }
    /* POLISH-CLASSIC-DOMUS-297 (mobile-native): the row tint follows a hovering pointer only; on touch a tapped row stayed tinted */
    @media (hover: hover) and (pointer: fine) {
      tbody tr:hover {
        background: var(--sw-surface-2);
      }
    }
    tbody tr.clickable:active {
      background: var(--sw-surface-3);
    }
    tbody tr.selected {
      background: var(--sw-accent-soft);
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tr.clickable {
      cursor: pointer;
    }
    /* SHARED-POLISH-2342: the focused row draws the focus ring inside its own box (a table cell clips an outer outline) */
    tbody tr:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: calc(-1 * var(--sw-focus-w));
    }
    /* UXFIX-RTL: a span.ltr inside any cell (a raw JSON payload, a code, an id) is its own left-to-right isolate; the braces no longer
       mirror and a "{" never lands at the line end of an RTL row. */
    td .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
    }
    td.ltr {
      unicode-bidi: isolate;
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* POLISH4-WP1: TableColumn.hideBelow */
    @media (max-width: 1023px) {
      .hb-tablet {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .hb-phone {
        display: none;
      }
    }
    /* ---- AUDIT30-B-SHARED (finding 10, Q8 = א assumed): TableColumn.card - the phone row template (opt-in per table) ----
       one line "title · badge", one meta line; about 60 px a row (was ~160 px of caption / value pairs) */
    .cmeta {
      display: none;
    }
    @media (max-width: 599px) {
      :host([card-template]) tr {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 2px 10px;
        padding: 9px 12px;
      }
      :host([card-template]) tr > td {
        display: none;
        grid-row: auto;
        grid-column: 1 / -1;
      }
      :host([card-template]) tr > td.c-title,
      :host([card-template]) tr > td.c-badge,
      :host([card-template]) tr > td.c-show,
      :host([card-template]) tr > td.cmeta {
        display: block;
      }
      :host([card-template]) tr > td.c-title {
        grid-row: 1;
        grid-column: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-wrap: normal;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      :host([card-template]) tr > td.c-badge {
        grid-row: 1;
        grid-column: 2;
        justify-self: end;
        white-space: nowrap;
      }
      :host([card-template]:not([has-card-badge])) tr > td.c-title {
        grid-column: 1 / -1;
      }
      :host([card-template]) tr > td.cmeta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow-wrap: normal;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
      }
      :host([card-template]) tr > td.c-title::before,
      :host([card-template]) tr > td.c-badge::before,
      :host([card-template]) tr > td.cmeta::before {
        content: none;
      }
      :host([card-template]) .cmeta .sep {
        color: var(--sw-text-3);
      }
    }
    .empty {
      padding: var(--sw-s-6);
      text-align: center;
      color: var(--sw-text-3);
    }
    /* ---- CR-CMP2-TABLES-2450 (owner N10): what the hand-built tables need to move in ----
       a table inside a card draws no second card */
    :host([bare]) {
      background: none;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    /* a read-only list: no pointer and no press tint */
    :host([static-rows]) tr.clickable {
      cursor: default;
    }
    :host([static-rows]) tbody tr.clickable:active {
      background: transparent;
    }
    /* CR-CMP2-POLISH-2470: a still row (rowFocusable false) - no pointer and no press tint, as a static-rows table */
    tr.clickable.still {
      cursor: default;
    }
    tbody tr.clickable.still:active {
      background: transparent;
    }
    /* the shared cell vocabulary - classes a column's render may use (the screen's own classes do not reach this shadow root) */
    .t1 {
      display: block;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .t2 {
      display: block;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .mut {
      color: var(--sw-text-3);
    }
    .num {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      line-height: 20px;
      white-space: nowrap;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .chip::before {
      content: '';
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .chip[data-nodot]::before {
      display: none;
    }
    .chip[data-tone='ok'] {
      background: color-mix(in srgb, var(--sw-success) 24%, var(--sw-surface));
      color: var(--sw-success-text);
    }
    .chip[data-tone='warn'] {
      background: color-mix(in srgb, var(--sw-warning) 26%, var(--sw-surface));
      color: var(--sw-warning-text);
    }
    .chip[data-tone='bad'] {
      background: color-mix(in srgb, var(--sw-danger) 22%, var(--sw-surface));
      color: var(--sw-danger-text);
    }
    .chip[data-tone='info'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    td.k-num {
      font-variant-numeric: tabular-nums;
      text-align: end;
    }
    td.k-muted {
      color: var(--sw-text-3);
    }
    td.k-status {
      white-space: nowrap;
    }
    td.k-actions {
      text-align: end;
      white-space: nowrap;
    }
    td.k-actions .acts {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    /* a table cell ignores max-inline-size in the auto layout: the cut is on an inner block */
    td.k-truncate .trunc {
      display: block;
      max-inline-size: var(--sw-table-trunc, 260px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .a-end {
      text-align: end;
    }
    .a-center {
      text-align: center;
    }
    /* ---- CR-CMP2-TABLES-CONSUMPTION-2450: what the module tables (electricity, water) need on top ----
       links in a cell: a.t1 names the row (it opens the row's page), a.lnk is a link in the accent ink; no underline until hovered; the
       hit area is --sw-table-link-h (a module's touch dial; none by default) */
    a.t1,
    a.lnk {
      display: inline-flex;
      align-items: center;
      min-block-size: var(--sw-table-link-h, auto);
      min-inline-size: var(--sw-table-link-h, auto);
      text-decoration: none;
      border-radius: var(--sw-r-sm);
    }
    a.lnk {
      color: var(--sw-accent-text);
    }
    @media (hover: hover) and (pointer: fine) {
      a.t1:hover,
      a.lnk:hover {
        text-decoration: underline;
      }
    }
    a.t1:focus-visible,
    a.lnk:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* a truncated cell of two lines (t1 over t2): each line takes its own ellipsis */
    td.k-truncate .trunc > .t1,
    td.k-truncate .trunc > .t2 {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* the foot row (TableColumn.foot): a total under the rows */
    tfoot td {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      border-block-start: 1px solid var(--sw-border-strong);
      border-block-end: 0;
    }
    @media (max-width: 767px) {
      tfoot {
        display: block;
      }
      tfoot td:empty {
        display: none;
      }
    }
    /* the phone card stack reads top to bottom: every cell starts at the reading start again */
    @media (max-width: 767px) {
      td.k-num,
      td.k-actions,
      td.a-end,
      td.a-center {
        text-align: start;
      }
      td.k-actions .acts {
        justify-content: flex-start;
      }
      td.k-truncate .trunc {
        max-inline-size: 100%;
      }
    }
    /* ---- CR-CMP2-GEN-REST-2460 (owner N10): group heading rows (groupHeading) - one quiet band across the table, the group's name in the
       heading ink; it never sticks (only the column header does) */
    th.grp {
      position: static;
      z-index: auto;
      background: var(--sw-table-group-bg, var(--sw-surface-2));
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      padding: var(--sw-table-group-pad, 7px 14px);
      text-align: start;
    }
    @media (max-width: 767px) {
      :host tr.group {
        display: block;
        padding: 0;
      }
      th.grp {
        display: block;
        grid-column: 1 / -1;
      }
    }
    /* keep-columns: the phone keeps the table (a small grid of figures); the columns that step out stay out */
    @media (max-width: 767px) {
      :host([keep-columns]) table {
        display: table;
      }
      :host([keep-columns]) thead {
        display: table-header-group;
      }
      :host([keep-columns]) tbody {
        display: table-row-group;
      }
      :host([keep-columns]) tfoot {
        display: table-footer-group;
      }
      :host([keep-columns]) tr {
        display: table-row;
        padding: 0;
        border: 0;
      }
      :host([keep-columns]) td {
        display: table-cell;
        padding: var(--sw-table-cell-pad, 9px 14px);
        border-block-end: 1px solid var(--sw-border);
        white-space: nowrap;
      }
      :host([keep-columns]) th.grp {
        display: table-cell;
      }
      :host([keep-columns]) td::before {
        content: none;
      }
      :host([keep-columns]) tbody tr:last-child td,
      :host([keep-columns]) tfoot td {
        border-block-end: 0;
      }
      :host([keep-columns]) tfoot td:empty {
        display: table-cell;
      }
      :host([keep-columns]) td.k-num,
      :host([keep-columns]) td.k-actions,
      :host([keep-columns]) td.a-end {
        text-align: end;
      }
      :host([keep-columns]) td.a-center {
        text-align: center;
      }
      :host([keep-columns]) .hb-phone,
      :host([keep-columns]) .hb-tablet,
      :host([keep-columns]) tfoot td.hb-phone,
      :host([keep-columns]) tfoot td.hb-tablet {
        display: none;
      }
    }
  `;

  /** `key` is set when the row was picked from the keyboard ('Enter' or ' '): a screen whose open row has a next step on Enter (the
   * event centre: Enter on the open event goes to its full review) tells it from a click. */
  private pick(row: Record<string, unknown>, key?: string) {
    const id = String(row[this.rowKey] ?? '');
    this.dispatchEvent(new CustomEvent('row-select', { detail: key ? { id, row, key } : { id, row }, bubbles: true, composed: true }));
  }

  private onRowKey(e: KeyboardEvent, row: Record<string, unknown>) {
    if (e.target !== e.currentTarget) return; // a key on a control inside a cell is that control's
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.pick(row, e.key);
      return;
    }
    // CR-CMP2-TABLES-2450: ArrowDown / ArrowUp / Home / End walk the rows (block keys: the same in Hebrew and English); no motion
    const rows = [...this.renderRoot.querySelectorAll<HTMLTableRowElement>('tbody tr[tabindex="0"]')];
    const to = rowFocusStep(e.key, rows.indexOf(e.currentTarget as HTMLTableRowElement), rows.length);
    if (to < 0) return;
    e.preventDefault();
    rows[to].focus();
  }

  protected willUpdate() {
    const card = usesCardTemplate(this.columns);
    this.toggleAttribute('card-template', card);
    this.toggleAttribute('has-card-badge', card && this.columns.some((c) => c.card === 'badge'));
  }

  /** the class list of one cell: ltr, hideBelow, its place in the phone row template, its shared kinds (table-logic `cellClassOf`) */
  private cellClass(c: TableColumn): string {
    return cellClassOf(c);
  }

  /** one body cell: a `num` value is its own left-to-right isolate, `actions` are packed in one line, `truncate` is cut on an inner
   * block and carries its title */
  private cell(c: TableColumn, row: Record<string, unknown>) {
    const v = c.render ? c.render(row) : String(row[c.key] ?? '');
    const kinds = c.kind === undefined ? [] : typeof c.kind === 'string' ? [c.kind] : c.kind;
    const title = c.cellTitle ? c.cellTitle(row) : kinds.includes('truncate') && !c.render ? String(row[c.key] ?? '') : undefined;
    const body = kinds.includes('num')
      ? html`<span class="num">${v}</span>`
      : kinds.includes('actions')
        ? html`<span class="acts">${v}</span>`
        : kinds.includes('truncate')
          ? html`<span class="trunc">${v}</span>`
          : v;
    return html`<td class=${this.cellClass(c)} part=${cellPartOf(c)} data-label=${c.label} title=${title || nothing} ${rowHooks(c.cellAttrs ? c.cellAttrs(row) : null)}>${body}</td>`;
  }

  /** CR-CMP2-TABLES-CONSUMPTION-2450: one cell of the foot row - the column's classes (a total sits under its figures), a `num` value its
   * own LTR isolate; empty when the column names no foot cell (left out of the phone stack) */
  private footCell(c: TableColumn) {
    const v = c.foot ? c.foot() : nothing;
    const kinds = c.kind === undefined ? [] : typeof c.kind === 'string' ? [c.kind] : c.kind;
    const body = v === nothing || v === '' ? nothing : kinds.includes('num') ? html`<span class="num">${v}</span>` : v;
    return html`<td class=${this.cellClass(c)} part="foot-cell" data-label=${body === nothing ? '' : c.label}>${body}</td>`;
  }

  /** the phone meta line: every `meta` column of the row in column order, " · " between them (an empty value is left out); each part
   * is its own bidi isolate, so "10 fps" stays "10 fps" in the RTL line */
  private metaCell(row: Record<string, unknown>) {
    const parts = this.columns
      .filter((c) => c.card === 'meta')
      .map((c) => (c.render ? c.render(row) : String(row[c.key] ?? '')))
      .filter((v) => v !== '' && v !== nothing);
    if (!parts.length) return nothing;
    return html`<td class="cmeta" data-card-meta data-label="">${parts.map((v, i) => html`${i ? html`<span class="sep"> · </span>` : nothing}<bdi>${v}</bdi>`)}</td>`;
  }

  /** CR-CMP2-GEN-REST-2460: the heading a row draws as a group band, or null for a data row */
  private headingOf(row: Record<string, unknown>): TemplateResult | string | null {
    const h = this.groupHeading ? this.groupHeading(row) : null;
    return h === null || h === undefined ? null : h;
  }

  /** CR-CMP2-GEN-REST-2460: a group heading row - one band across every column; the row's hooks, no pointer, no tab stop, never picked */
  private groupRow(row: Record<string, unknown>) {
    const hooks = this.rowAttrs;
    return html`<tr class="group" part="group-row" data-row-id=${String(row[this.rowKey] ?? '')} ${rowHooks(hooks ? hooks(row) : null)}><th class="grp" part="group" scope="rowgroup" colspan=${this.columns.length || 1}>${this.headingOf(row)}</th></tr>`;
  }

  /** one data row: its hooks, the pick (a click, or Enter / Space when the rows are tab stops), the hover events */
  private dataRow(row: Record<string, unknown>, card: boolean, focusable: boolean) {
    const hooks = this.rowAttrs;
    const { live, tab } = rowReach(row, focusable, this.staticRows, this.rowFocusable);
    return html`<tr class="clickable ${this.selected === String(row[this.rowKey]) ? 'selected' : ''}${live ? '' : ' still'}" part=${live ? 'row' : 'row still'} data-row-id=${String(row[this.rowKey] ?? '')} ${rowHooks(hooks ? hooks(row) : null)} @click=${() => live && this.pick(row)}
              tabindex=${tab ? '0' : nothing} @keydown=${tab ? (e: KeyboardEvent) => this.onRowKey(e, row) : nothing}
              @pointerenter=${(e: PointerEvent) => this.dispatchEvent(new CustomEvent('row-hover', { detail: { id: String(row[this.rowKey] ?? ''), row, clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType }, bubbles: true, composed: true }))}
              @pointerleave=${() => this.dispatchEvent(new CustomEvent('row-leave', { detail: { id: String(row[this.rowKey] ?? '') }, bubbles: true, composed: true }))}>
              ${this.columns.map((c) => this.cell(c, row))}${card ? this.metaCell(row) : nothing}
            </tr>`;
  }

  render() {
    // CR-CMP2-TABLES-2450: a screen may slot its own empty state (its data hooks and copy); the default line otherwise
    if (!this.rows.length) return html`<slot name="empty"><div class="empty" part="empty">${this.emptyText}</div></slot>`;
    const card = usesCardTemplate(this.columns);
    const focusable = this.rowsFocusable;
    const groups = !!this.groupHeading && this.rows.some((r) => this.headingOf(r) !== null);
    return html`
      <table part="table">
        <thead>
          <tr part="head-row">${this.columns.map((c) => html`<th class=${c.hideBelow || c.align || c.kind ? headClassOf(c) : nothing} part="head" style=${c.width ? `width:${c.width}` : ''}>${c.label}</th>`)}</tr>
        </thead>
        ${groups
          ? groupSegments(this.rows, (r) => this.headingOf(r) !== null).map(
              (seg) => html`<tbody>${seg.head ? this.groupRow(seg.head) : nothing}${seg.rows.map((row) => this.dataRow(row, card, focusable))}</tbody>`,
            )
          : html`<tbody>
              ${this.rows.map((row) => this.dataRow(row, card, focusable))}
            </tbody>`}
        ${hasFootRow(this.columns) ? html`<tfoot><tr part="foot-row">${this.columns.map((c) => this.footCell(c))}</tr></tfoot>` : nothing}
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-table': SwTable;
  }
}
