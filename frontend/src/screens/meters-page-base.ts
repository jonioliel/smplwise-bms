import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-place-tree';
import '../components/sw-state-panel';
import type { PlaceRow } from './wiskey-stations-logic';
import { describeError } from '../api/client';
import { navigate } from '../router';
import { SkinController } from '../design/skin';

/**
 * CR-DUP-METERS-2440 (code review 06:DUP-2): the meters page of a metered utility, written once. `screens/electricity/page-meters.ts` and
 * `screens/water/page-meters.ts` were the same page twice - the head row (search, cards / table, the phone's area select, the add button), the
 * floors and areas tree, the 60-second poll, the address-bar filters (`?area=`, `?meter=`, `?add=1`), the loading / error / empty / ready frame
 * and the layout rules. This base owns those; a module supplies its API, its words, its tiles, its table / cards / phone rows, its add dialog and
 * its meter card.
 */

export type MetersView = 'table' | 'cards';
export type MetersPhase = 'loading' | 'ready' | 'error';
/** The frame's state (the `data-state` of the page's outer box); `forbidden` is the module's own panel. */
export type MetersFrameState = 'loading' | 'error' | 'empty' | 'ready';
type Slot = TemplateResult | typeof nothing;

/** Reads a stored view choice (per-viewer convenience; storage may be unavailable). */
export function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
}

/** A floor of the areas tree with its areas (the shape both `buildAreaTree` and `buildWaterAreaTree` give). */
export interface MetersFloorNode {
  floor_id: string;
  name: string;
  count: number;
  areas: { area_id: string; name: string; count: number }[];
}

export interface MetersAccess {
  view: boolean;
  manage: boolean;
}

/** What a module fixes once: where its choices are stored, its route, and its permissions. */
export interface MetersPageConfig<A extends MetersAccess> {
  viewKey: string;
  collapseKey: string;
  /** the page's route (`/infra/<module>/meters`): the filters live in its query */
  route: string;
  access: () => A;
  onAccess: (fn: (a: A) => void) => () => void;
}

/** The words of the shared parts (read at render time: a module may translate them). */
export interface MetersPageTexts {
  search: string;
  view: string;
  cards: string;
  table: string;
  area: string;
  areas: string;
  allAreas: string;
  fold: string;
  unfold: string;
  addMeter: string;
  loadError: string;
  retry: string;
}

export const POLL_MS = 60_000;

/** The grid of the page and the meter cards (first in a module's styles, before its own rules). */
export const metersGridCss = css`
  .cols {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 12px;
  }
  .mcard {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: start;
    font: inherit;
    color: inherit;
    cursor: pointer;
    min-block-size: var(--elec-touch);
  }
  /* R5-MEDIA-ENERGY-297 (WKWATER-POLISH-2331 for water): today's figure is the card's display numeral; the card answers the press */
  .mcard .big {
    font-size: var(--sw-fs-4xl);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
    color: var(--sw-heading, var(--sw-text));
  }
  .mcard {
    transition: transform var(--sw-t-press) var(--sw-ease-out), box-shadow var(--sw-t-fast) var(--sw-ease);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .mcard:active {
    transform: scale(var(--sw-press-scale));
    box-shadow: var(--sw-shadow-1);
  }
`;

/** The phone and desktop rules of the page (after a module's own base rules, before its own responsive rules: the order is the cascade). */
export const metersResponsiveCss = css`
  @media (max-width: 899px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
    .tree-card {
      display: none;
    }
    .head .inp {
      flex: 1 1 200px;
    }
    /* the phone's area select fills the row beside the add button (one tidy row instead of a short select and a shorter button) */
    .head .inp.phone-only {
      flex: 1 1 160px;
    }
  }
  /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): the tree and the meters list take the height left
     under the head and the tiles; the table (its header row stays in place), the cards and the tree each scroll inside their own
     box, never the page. Below 240 px of room the row keeps that height and the page scrolls (a very short window). */
  @media (min-width: 900px) {
    [data-elec='meters'][data-state='ready'],
    [data-water='meters'][data-state='ready'] {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .cols {
      flex: 1 1 auto;
      min-block-size: 240px;
      grid-template-rows: minmax(0, 1fr);
    }
    .cols > .tree-card {
      max-block-size: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    .cols > .mlist {
      display: flex;
      flex-direction: column;
      max-block-size: 100%;
      min-block-size: 0;
      min-inline-size: 0;
    }
    .mlist > .scrollx,
    .mlist > .cards {
      min-block-size: 0;
      overflow: auto;
      scrollbar-width: thin;
    }
    /* GATEFIX2240-297: in a box of fixed height the grid shared that height out among its rows (the cards are overflow-clipped, so
       their automatic minimum is 0): at 1024 px the meter cards were squeezed and their reading row spilled below the card, at 1440 px
       they were stretched. Rows keep their content height and start at the top; the box scrolls. */
    .mlist > .cards {
      padding: 2px;
      grid-auto-rows: max-content;
      align-content: start;
    }
    .mlist table.t thead th {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
    }
  }
`;

export abstract class MetersPageBase<M extends { id: string }, A extends MetersAccess> extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** Set by the shell: the route segments after `meters` and the query. */
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();

  @state() protected meters: M[] = [];
  @state() protected phase: MetersPhase = 'loading';
  @state() protected error = '';
  @state() protected q = '';
  @state() protected view: MetersView = 'table';
  @state() protected collapsed: string[] = [];
  @state() protected access: A;
  @state() protected notice = '';
  private stopAccess?: () => void;
  private poll = 0;

  protected constructor(private readonly cfg: MetersPageConfig<A>) {
    super();
    this.view = stored<MetersView>(cfg.viewKey, 'table');
    this.collapsed = stored<string[]>(cfg.collapseKey, []);
    this.access = cfg.access();
  }

  // ---------------------------------------------------------------- what a module supplies
  protected abstract texts(): MetersPageTexts;
  /** The meters of the list (a module may read its companions - open alerts - in the same step). */
  protected abstract fetchMeters(): Promise<M[]>;
  /** After the list is on screen (optional): slower companions of the first load. A failure of the first load is the page's error state. */
  protected afterLoad?(initial: boolean, meters: M[]): Promise<void>;
  protected abstract areaTree(): MetersFloorNode[];
  /** `area` is the tree's key: an area id or `floor:<id>`. */
  protected abstract inArea(m: M, area: string): boolean;
  /** `needle` is trimmed and lower-case. */
  protected abstract matchesSearch(m: M, needle: string): boolean;
  protected abstract openMeter(m: M): void;
  protected abstract openAdd(): void;
  /** The page's outer box (it carries the module's `data-<module>="meters"` and the state). */
  protected abstract frame(state: MetersFrameState, body: TemplateResult): TemplateResult;
  protected abstract renderForbidden(): TemplateResult;
  /** One row of the loading skeleton around the shared cells. */
  protected abstract skeletonRow(cells: TemplateResult): TemplateResult;
  /** The "no meters yet" panel with the add button in it. */
  protected abstract renderEmpty(addButton: Slot): TemplateResult;
  protected abstract renderNoResults(): TemplateResult;
  protected abstract renderTiles(): TemplateResult;
  protected abstract renderTable(list: M[]): TemplateResult;
  protected abstract renderCards(list: M[]): TemplateResult;
  /** The phone's list (the same rows as the table, one line of context). */
  protected abstract renderRows(list: M[]): TemplateResult;
  protected abstract renderAdd(): Slot;
  protected abstract renderCard(meterId: string): TemplateResult;

  // ---------------------------------------------------------------- shared behaviour
  connectedCallback() {
    super.connectedCallback();
    this.stopAccess = this.cfg.onAccess((a) => (this.access = a));
    void this.load(true);
    this.poll = window.setInterval(() => void this.load(false), POLL_MS);
  }

  disconnectedCallback() {
    this.stopAccess?.();
    window.clearInterval(this.poll);
    super.disconnectedCallback();
  }

  /** `initial`: show the loading state; a later refresh keeps the rows and only an error on the first load is a screen state. */
  protected async load(initial: boolean) {
    if (initial) this.phase = 'loading';
    try {
      const meters = await this.fetchMeters();
      this.meters = meters;
      this.phase = 'ready';
      this.error = '';
      if (this.afterLoad) await this.afterLoad(initial, meters);
    } catch (err) {
      if (initial || this.phase !== 'ready') {
        this.error = describeError(err);
        this.phase = 'error';
      }
    }
  }

  protected get areaFilter(): string {
    return this.params.get('area') ?? '';
  }

  protected setParams(patch: Record<string, string | null>) {
    const p = new URLSearchParams(this.params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const rec: Record<string, string> = {};
    p.forEach((v, k) => (rec[k] = v));
    navigate(this.cfg.route, rec);
  }

  private setView(v: MetersView) {
    this.view = v;
    store(this.cfg.viewKey, v);
  }

  private toggleFloor(id: string) {
    this.collapsed = this.collapsed.includes(id) ? this.collapsed.filter((x) => x !== id) : [...this.collapsed, id];
    store(this.cfg.collapseKey, this.collapsed);
  }

  protected visible(): M[] {
    const needle = this.q.trim().toLowerCase();
    const area = this.areaFilter;
    // AUDIT30-E5: the shared places tree also picks a whole floor (`floor:<id>`, the key the module's tree gives the floor)
    return this.meters.filter((m) => (!area || this.inArea(m, area)) && (!needle || this.matchesSearch(m, needle)));
  }

  protected onKey(e: KeyboardEvent, m: M) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.openMeter(m);
    }
  }

  /** AUDIT30-E5 (round-30 audit #14): the areas list is the shared places tree (sw-place-tree): "all", the floors (fold + pick) and their
   * areas; the chosen row is the soft accent wash of every other tree, not a filled accent key. */
  private placeRows(): PlaceRow[] {
    const rows: PlaceRow[] = [{ id: 'all', kind: 'all', name: this.texts().allAreas, depth: 0, count: this.meters.length, dot: null }];
    for (const f of this.areaTree()) {
      const open = !this.collapsed.includes(f.floor_id);
      rows.push({ id: `floor:${f.floor_id}`, kind: 'floor', name: f.name, depth: 0, count: f.count, dot: null, open });
      if (open) for (const a of f.areas) rows.push({ id: a.area_id, kind: 'area', name: a.name, depth: 1, count: a.count, dot: null });
    }
    return rows;
  }

  private renderTree() {
    const t = this.texts();
    return html`<sw-place-tree data-area-tree heading=${t.areas} foldLabel=${t.fold} unfoldLabel=${t.unfold} .rows=${this.placeRows()} .selected=${this.areaFilter || 'all'}
      @place-select=${(e: CustomEvent<string>) => this.setParams({ area: e.detail === 'all' ? null : e.detail })}
      @place-toggle=${(e: CustomEvent<string>) => this.toggleFloor(e.detail.slice(6))}></sw-place-tree>`;
  }

  private addButton(): Slot {
    return this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => this.openAdd()}>${this.texts().addMeter}</sw-button>` : nothing;
  }

  private renderHead() {
    const t = this.texts();
    const tree = this.areaTree();
    return html`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-meters-search placeholder=${t.search} aria-label=${t.search} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      <div class="seg desk-only" role="group" aria-label=${t.view}><button type="button" aria-pressed=${this.view === 'cards' ? 'true' : 'false'} data-view="cards" @click=${() => this.setView('cards')}>${t.cards}</button><button type="button" aria-pressed=${this.view === 'table' ? 'true' : 'false'} data-view="table" @click=${() => this.setView('table')}>${t.table}</button></div>
      <span class="sp"></span>
      <label class="inp phone-only"><select data-area-select aria-label=${t.area} @change=${(e: Event) => this.setParams({ area: (e.target as HTMLSelectElement).value || null })}>
        <option value="" ?selected=${!this.areaFilter}>${t.allAreas}</option>
        ${tree.flatMap((f) => f.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.areaFilter}>${a.name}</option>`))}</select></label>
      ${this.addButton()}
    </div>`;
  }

  render() {
    if (!this.access.view) return this.renderForbidden();
    const meterId = this.params.get('meter') ?? '';
    const card = meterId ? this.renderCard(meterId) : nothing;
    if (this.phase === 'loading') {
      return this.frame('loading', html`<div class="card">${Array.from({ length: 7 }, () => this.skeletonRow(html`<div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div>`))}</div>`);
    }
    if (this.phase === 'error') {
      const t = this.texts();
      return this.frame('error', html`<sw-state-panel state="error" heading=${t.loadError} hint=${this.error} actionLabel=${t.retry} @action=${() => void this.load(true)}></sw-state-panel>`);
    }
    if (!this.meters.length) {
      return this.frame('empty', html`${this.renderEmpty(this.addButton())}${this.renderAdd()}`);
    }
    const list = this.visible();
    const body = !list.length ? this.renderNoResults() : html`${this.view === 'cards' ? this.renderCards(list) : this.renderTable(list)}${this.renderRows(list)}`;
    return this.frame('ready', html`
      ${this.renderHead()}
      ${this.notice ? html`<div class="notice" role="status" data-notice>${this.notice}</div>` : nothing}
      ${this.renderTiles()}
      <div class="cols"><div class="card tree-card">${this.renderTree()}</div><div class="mlist">${body}</div></div>
      ${this.renderAdd()}${card}
    `);
  }
}
