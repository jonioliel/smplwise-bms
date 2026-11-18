import { LitElement, html, css, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-state-panel';
import { post, describeError } from '../api/client';
import { parseRoute } from '../router';
import { tr } from '../i18n/msg/devices';

/**
 * CR-DUP-ADMIN-CARDS-2440 (06:DUP-6): the base of the "list the entities, set an override per entity" administrator cards under
 * הגדרות › חשמל והתקנים - "מתגים מוגנים" (devices-protected-switches-admin.ts), "סוגי התקנים" (devices-type-admin.ts) and "מיזוג
 * וחימום" (devices-climate-kind-admin.ts). Each card was a copy of the same read, the same table and, for the two long lists, the
 * same search / floor / area filters, selection with Shift+click, paging and "one call per 500 ids" save.
 *
 * `DevicesOverrideAdmin` is the read and the loading / error card (all three); `DevicesOverrideListAdmin` adds what the two long
 * lists share. Every card keeps its own render, wording, data attributes and its own order of steps around a save.
 */

/** The table of all three cards (R5-DEVICES-297: base size, a heading row, roomy cells). The bold name cell is each family's own. */
export const overrideTableStyles = css`
  table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--sw-fs-base);
  }
  th,
  td {
    text-align: start;
    padding: 10px 10px;
    border-block-end: 1px solid var(--sw-border);
    vertical-align: middle;
  }
  th {
    background: var(--sw-surface-2);
    color: var(--sw-heading, var(--sw-text));
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  th:first-child {
    border-start-start-radius: var(--sw-r-md);
  }
  th:last-child {
    border-start-end-radius: var(--sw-r-md);
  }
`;

/** The two long lists: filter bar, selection column (the name is the second cell), action row, and cards with a sticky action bar under 600 px. */
export const overrideListStyles = css`
  :host {
    display: block;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-block-end: 8px;
  }
  input[type='search'],
  select {
    font: inherit;
    font-size: var(--sw-fs-sm);
    min-block-size: 36px;
    padding: 0 10px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  input[type='search'] {
    flex: 1;
    min-inline-size: 180px;
  }
  .note,
  .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  td:nth-child(2) {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading, var(--sw-text));
  }
  input[type='checkbox'] {
    inline-size: 18px;
    block-size: 18px;
  }
  .cards {
    display: none;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-block: 8px;
  }
  @media (max-width: 599px) {
    table {
      display: none;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 2px 10px;
      align-items: center;
      padding: 10px 12px;
      border: 0;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      min-block-size: 48px;
      font-weight: var(--sw-fw-semibold);
    }
    .card .sub {
      grid-column: 2;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-2);
    }
    .actions.bulk {
      position: sticky;
      inset-block-end: 0;
      background: var(--sw-surface);
      border-block-start: 1px solid var(--sw-border);
      z-index: 1;
    }
  }
`;

/** The rows a card shows at first and adds per "הצג עוד". */
export const OVERRIDE_PAGE = 100;

/** The read every card does, and its loading / error card. */
export abstract class DevicesOverrideAdmin<Row extends { entity_id: string }> extends LitElement {
  @state() protected rows: Row[] | null = null;
  @state() protected error = '';

  /** The card's heading (also on the loading / error card). */
  protected abstract readonly heading: string;
  /** The Settings `?section=` values that scroll this card into view once it has loaded. */
  protected readonly sections: readonly string[] = [];

  /** One read of the list. A card that reads more than the rows stores the rest here. */
  protected abstract fetchRows(): Promise<Row[]>;

  connectedCallback() {
    super.connectedCallback();
    void this.load().then(() => {
      const section = parseRoute().params.get('section');
      if (section !== null && this.sections.includes(section)) requestAnimationFrame(() => this.scrollIntoView({ block: 'start' }));
    });
  }

  protected async load() {
    try {
      this.rows = await this.fetchRows();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  protected errorCard(heading: string): TemplateResult {
    return html`<sw-card heading=${this.heading}><sw-state-panel compact state="error" heading=${heading} hint=${this.error}></sw-state-panel></sw-card>`;
  }

  protected loadingCard(): TemplateResult {
    return html`<sw-card heading=${this.heading}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
  }
}

/** A row of a long list: where the entity is. */
interface PlacedRow {
  entity_id: string;
  floor_id?: string | null;
  floor_name?: string | null;
  area_id?: string | null;
  area_name?: string | null;
}

/** What the two long lists share: filters that reset the paging, selection with a Shift+click range, floor / area options, chunked save. */
export abstract class DevicesOverrideListAdmin<Row extends PlacedRow, F extends { floor: string }> extends DevicesOverrideAdmin<Row> {
  @state() protected selected = new Set<string>();
  @state() protected shown = OVERRIDE_PAGE;
  @state() protected busy = false;
  @state() protected result = '';
  protected last: string | null = null;

  protected abstract f: F;
  /** The ids a Shift+click selects between the last clicked row and this one (the card's own rule for rows that cannot be selected). */
  protected abstract range: (list: readonly Row[], last: string | null, id: string) => string[];
  /** The save batches (the card's own logic module; 500 ids a call). */
  protected abstract chunk: (ids: readonly string[]) => string[][];

  protected setFilter(patch: Partial<F>) {
    this.f = { ...this.f, ...patch };
    this.shown = OVERRIDE_PAGE;
  }

  /** `on` is the box's state AFTER the native toggle (the click is not cancelled: cancelling a checkbox click makes the browser
   * restore the old `checked` after Lit re-rendered, so a selected row showed an empty box). */
  protected toggle(id: string, on: boolean, shift: boolean, list: Row[]) {
    const next = new Set(this.selected);
    const ids = shift && this.last ? this.range(list, this.last, id) : [id];
    for (const x of ids) (on ? next.add(x) : next.delete(x));
    this.last = id;
    this.selected = next;
  }

  protected floorOptions(rows: Row[]): [string, string][] {
    return [...new Map(rows.filter((r) => r.floor_id).map((r) => [r.floor_id!, r.floor_name ?? r.floor_id!])).entries()];
  }

  /** The areas of the chosen floor (every area while no floor is chosen). */
  protected areaOptions(rows: Row[]): [string, string][] {
    const floor = this.f.floor;
    return [...new Map(rows.filter((r) => r.area_id && (!floor || r.floor_id === floor)).map((r) => [r.area_id!, r.area_name ?? r.area_id!])).entries()];
  }

  protected place(r: Row): string {
    return [r.floor_name, r.area_name].filter(Boolean).join(` ${tr('‹')} `) || tr('ללא שיוך');
  }

  /** One call per batch, in order; the first failure stops the rest (the caller says so and reads the list again). */
  protected async postChunks(path: string, ids: readonly string[], body: Record<string, unknown>): Promise<{ changed: number; refused: number }> {
    let changed = 0;
    let refused = 0;
    for (const part of this.chunk(ids)) {
      const r = await post<{ changed: number; refused: number }>(path, { entity_ids: part, ...body });
      changed += r.changed;
      refused += r.refused;
    }
    return { changed, refused };
  }
}
