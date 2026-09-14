import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface TableColumn<Row = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  ltr?: boolean;
  render?: (row: Row) => TemplateResult | string | typeof nothing;
}

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
      font-size: var(--sw-fs-sm);
      min-inline-size: 560px;
    }
    th,
    td {
      padding: 9px 14px;
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    :host([dense]) th,
    :host([dense]) td {
      padding: 7px 12px;
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
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    tbody tr:hover {
      background: var(--sw-surface-2);
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
    td.ltr {
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
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

  render() {
    if (!this.rows.length) return html`<div class="empty">${this.emptyText}</div>`;
    return html`
      <table>
        <thead>
          <tr>${this.columns.map((c) => html`<th style=${c.width ? `width:${c.width}` : ''}>${c.label}</th>`)}</tr>
        </thead>
        <tbody>
          ${this.rows.map(
            (row) => html`<tr class="clickable ${this.selected === String(row[this.rowKey]) ? 'selected' : ''}" @click=${() => this.pick(row)}>
              ${this.columns.map((c) => html`<td class=${c.ltr ? 'ltr' : ''}>${c.render ? c.render(row) : String(row[c.key] ?? '')}</td>`)}
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
