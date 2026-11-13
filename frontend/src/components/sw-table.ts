import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
}

/** The phone row template is on for a table as soon as one of its columns names its place in it. */
export const usesCardTemplate = <R>(cols: readonly TableColumn<R>[]): boolean => cols.some((c) => !!c.card);

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
  @property() emptyText = 'אין שורות להצגה';
  @property({ type: Boolean, reflect: true }) dense = false;
  /** SHARED-POLISH-2342 (INVREST-POLISH-2331 proposal): every row is a tab stop and Enter / Space on it fires the same `row-select` a
   * click does - for a list whose rows open something and that has no link of its own in a cell. Opt-in, so the tab order of every
   * existing table is unchanged; a key pressed on a control inside a cell is left to that control. */
  @property({ type: Boolean, reflect: true, attribute: 'focus-rows' }) focusRows = false;

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
      min-inline-size: 560px;
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
        box-shadow: inset 3px 0 0 var(--sw-accent);
      }
    }
    th {
      position: sticky;
      top: 0;
      background: var(--sw-surface);
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
  `;

  private pick(row: Record<string, unknown>) {
    const id = String(row[this.rowKey] ?? '');
    this.dispatchEvent(new CustomEvent('row-select', { detail: { id, row }, bubbles: true, composed: true }));
  }

  private onRowKey(e: KeyboardEvent, row: Record<string, unknown>) {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    this.pick(row);
  }

  protected willUpdate() {
    const card = usesCardTemplate(this.columns);
    this.toggleAttribute('card-template', card);
    this.toggleAttribute('has-card-badge', card && this.columns.some((c) => c.card === 'badge'));
  }

  /** the class list of one cell: ltr, hideBelow, and its place in the phone row template */
  private cellClass(c: TableColumn): string {
    return [c.ltr ? 'ltr' : '', c.hideBelow ? `hb-${c.hideBelow}` : '', c.card && c.card !== 'hide' ? `c-${c.card}` : ''].filter(Boolean).join(' ');
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

  render() {
    if (!this.rows.length) return html`<div class="empty">${this.emptyText}</div>`;
    const card = usesCardTemplate(this.columns);
    return html`
      <table>
        <thead>
          <tr>${this.columns.map((c) => html`<th class=${c.hideBelow ? `hb-${c.hideBelow}` : nothing} style=${c.width ? `width:${c.width}` : ''}>${c.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(
            (row) => html`<tr class="clickable ${this.selected === String(row[this.rowKey]) ? 'selected' : ''}" data-row-id=${String(row[this.rowKey] ?? '')} @click=${() => this.pick(row)}
              tabindex=${this.focusRows ? '0' : nothing} @keydown=${this.focusRows ? (e: KeyboardEvent) => this.onRowKey(e, row) : nothing}
              @pointerenter=${(e: PointerEvent) => this.dispatchEvent(new CustomEvent('row-hover', { detail: { id: String(row[this.rowKey] ?? ''), row, clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType }, bubbles: true, composed: true }))}
              @pointerleave=${() => this.dispatchEvent(new CustomEvent('row-leave', { detail: { id: String(row[this.rowKey] ?? '') }, bubbles: true, composed: true }))}>
              ${this.columns.map((c) => html`<td class=${this.cellClass(c)} data-label=${c.label}>${c.render ? c.render(row) : String(row[c.key] ?? '')}</td>`)}${card ? this.metaCell(row) : nothing}
            </tr>`,
          )}
        </tbody>
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-table': SwTable;
  }
}
