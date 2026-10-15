import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { ApiError, describeError } from '../api/client';
import { saveBoardPrefs, tableApi, type ColumnKey, type SavedView, type ViewDoc } from '../api/tickets-table';
import type { Meta } from '../api/tickets';
import { activeExtraCount, chooserOrder, columnLabel, DEFAULT_COLUMNS, moveColumn, NO_TABLE_FILTERS, PRIORITY_KEYS, toggleColumn, type ExtraFilters, type TableLayout } from './table-model';
import { tbt, type TableTextKey } from './table-text';
import { tbIcon } from './table-icons';
import { tIcon } from './icons';
import { ticketTableStyles } from './table-styles';
import { fromLocalInput, toLocalInput } from './model';
import { costColumnsOn } from './table-model';
import { COST_FILTER_STATUSES } from './cost-model';
import { ct, type CostTextKey } from './cost-text';

type Pop = 'columns' | 'views' | 'filters' | null;

/**
 * CR-038 slice 6b `<tickets-table-toolbar>`: the row above the board table - the count, the column chooser (show / hide / reorder /
 * reset), the saved filters (apply, save the current view, mark one as the default, delete - private to the user, at most 20), the
 * table's own filters (priority, handler, waiting for a manager, stuck, opened between), the density toggle and the CSV export.
 * Every popover is OPAQUE (`--sw-menu-surface`). Events (bubble, composed): `layout-change` {layout}, `extra-change` {extra},
 * `view-apply` {view: SavedView}, `export-csv`. The saved views are read and written here; the default one is the user's
 * `tickets.board.default_view` preference.
 */
@customElement('tickets-table-toolbar')
export class TicketsTableToolbar extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) layout!: TableLayout;
  @property({ attribute: false }) extra: ExtraFilters = { ...NO_TABLE_FILTERS };
  @property({ attribute: false }) meta: Meta | null = null;
  /** TKSTAFF2: the handler filter's people - whoever holds a loaded row (account holders and staff contacts alike; assignee-model.ts) */
  @property({ attribute: false }) holders: { key: string; name: string }[] = [];
  /** what "save the current view" stores */
  @property({ attribute: false }) current: ViewDoc | null = null;
  @property({ type: Number }) count: number | null = null;
  @property({ type: Boolean }) more = false;
  @property({ type: Boolean }) phone = false;
  @property({ type: Boolean }) canExport = false;
  @property({ type: Boolean }) exporting = false;
  @property() defaultView = '';
  @state() private pop: Pop = null;
  @state() private views: SavedView[] | null = null;
  @state() private naming = false;
  @state() private name = '';
  @state() private viewError = '';
  @state() private confirmDelete = '';

  static styles = [bubbleChrome, ...automationsStyles, ticketTableStyles];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
  }

  private onOutside = (e: PointerEvent) => {
    if (!this.pop) return;
    const pop = this.renderRoot.querySelector(`[data-pop="${this.pop}"]`);
    if (pop && !e.composedPath().includes(pop)) this.close();
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.pop && e.key === 'Escape') {
      e.stopPropagation();
      const btn = this.renderRoot.querySelector(`[data-open="${this.pop}"]`) as HTMLElement | null;
      this.close();
      btn?.focus();
    }
  };

  private close(): void {
    this.pop = null;
    this.naming = false;
    this.viewError = '';
    this.confirmDelete = '';
  }

  private open(p: Exclude<Pop, null>): void {
    if (this.pop === p) {
      this.close();
      return;
    }
    this.close();
    this.pop = p;
    if (p === 'views') void this.loadViews();
    void this.updateComplete.then(() => (this.renderRoot.querySelector(`[data-pop="${p}"] input, [data-pop="${p}"] button`) as HTMLElement | null)?.focus());
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private setLayout(patch: Partial<TableLayout>): void {
    const layout = { ...this.layout, ...patch };
    this.emit('layout-change', { layout });
  }

  private setExtra(patch: Partial<ExtraFilters>): void {
    this.emit('extra-change', { extra: { ...this.extra, ...patch } });
  }

  // ---------------------------------------------------------------- saved views

  private async loadViews(): Promise<void> {
    try {
      this.views = (await tableApi().views()).items;
    } catch (e) {
      this.views = [];
      this.viewError = describeError(e);
    }
  }

  private async saveView(): Promise<void> {
    const name = this.name.trim();
    if (!name || !this.current) {
      this.viewError = tbt('required');
      return;
    }
    try {
      const v = await tableApi().createView(name, this.current);
      this.views = [...(this.views ?? []), v].sort((a, b) => a.name.localeCompare(b.name));
      this.naming = false;
      this.name = '';
      this.viewError = '';
    } catch (e) {
      this.viewError = e instanceof ApiError && e.body.code === 'view_name_taken' ? tbt('viewNameTaken') : e instanceof ApiError && e.body.code === 'too_many_views' ? tbt('viewsFull') : describeError(e);
    }
  }

  private async deleteView(v: SavedView): Promise<void> {
    if (this.confirmDelete !== v.id) {
      this.confirmDelete = v.id;
      return;
    }
    try {
      await tableApi().deleteView(v.id);
      this.views = (this.views ?? []).filter((x) => x.id !== v.id);
      if (this.defaultView === v.id) await this.setDefault(null);
    } catch (e) {
      this.viewError = describeError(e);
    }
    this.confirmDelete = '';
  }

  private async setDefault(id: string | null): Promise<void> {
    await saveBoardPrefs({ default_view: id ?? undefined });
    this.defaultView = id ?? '';
    this.emit('default-view', { id });
  }

  // ---------------------------------------------------------------- render

  private columnsPop(): TemplateResult {
    const list = chooserOrder(this.layout.columns);
    const shown = this.layout.columns;
    return html`<div class="pop lst" role="dialog" aria-label=${tbt('columns')} data-pop="columns">
      <div class="hd">${tbt('columns')}</div>
      <div class="plist">${list.map((c) => {
        const i = shown.indexOf(c.key);
        return html`<div class="crow" data-col=${c.key}>
          <label class="opt"><input type="checkbox" .checked=${c.shown} ?disabled=${c.required} data-col-toggle=${c.key}
            @change=${() => this.setLayout({ columns: toggleColumn(shown, c.key) })} />${columnLabel(c.key)}</label>
          ${c.shown ? html`<button type="button" class="btn quiet sm mv" aria-label=${tbt('moveUp', { col: columnLabel(c.key) })} ?disabled=${i <= 0} data-col-up=${c.key}
              @click=${() => this.setLayout({ columns: moveColumn(shown, c.key, -1) })}>${tbIcon('up')}</button>
            <button type="button" class="btn quiet sm mv" aria-label=${tbt('moveDown', { col: columnLabel(c.key) })} ?disabled=${i >= shown.length - 1} data-col-down=${c.key}
              @click=${() => this.setLayout({ columns: moveColumn(shown, c.key, 1) })}>${tbIcon('down')}</button>` : nothing}
        </div>`;
      })}</div>
      <hr />
      <button type="button" data-col-reset @click=${() => this.setLayout({ columns: [...DEFAULT_COLUMNS] as ColumnKey[] })}>${tIcon('refresh')}${tbt('columnsReset')}</button>
    </div>`;
  }

  private viewsPop(): TemplateResult {
    const views = this.views;
    return html`<div class="pop wide lst" role="dialog" aria-label=${tbt('savedViews')} data-pop="views">
      <div class="hd">${tbt('savedViews')}</div>
      <div class="plist">${views === null ? html`<span class="skl" style="block-size:44px"></span>` : views.length ? views.map((v) => html`<div class="vrow" data-view=${v.id}>
          <button type="button" data-view-apply=${v.id} @click=${() => { this.close(); this.emit('view-apply', { view: v }); }}>${tbIcon('bookmark')}<span>${v.name}</span></button>
          <button type="button" class="icon" aria-pressed=${String(this.defaultView === v.id)} data-view-default=${v.id}
            aria-label=${this.defaultView === v.id ? tbt('unsetDefault', { name: v.name }) : tbt('makeDefault', { name: v.name })}
            @click=${() => void this.setDefault(this.defaultView === v.id ? null : v.id)}>${tbIcon('star')}</button>
          <button type="button" class="icon" data-view-delete=${v.id} aria-label=${this.confirmDelete === v.id ? tbt('deleteConfirm', { name: v.name }) : tbt('deleteView', { name: v.name })}
            @click=${() => void this.deleteView(v)}>${this.confirmDelete === v.id ? tIcon('check') : tIcon('trash')}</button>
        </div>`) : html`<div class="note" data-views-empty>${tbt('noViews')}</div>`}</div>
      <hr />
      ${this.naming ? html`<div class="save">
          <label class="vh" for="vname">${tbt('viewName')}</label>
          <input id="vname" class="inp" maxlength="60" data-view-name .value=${this.name} placeholder=${tbt('viewName')}
            @input=${(e: Event) => { this.name = (e.target as HTMLInputElement).value; this.viewError = ''; }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.saveView(); }} />
          <button type="button" class="btn primary sm" data-view-save @click=${() => void this.saveView()}>${tbt('save')}</button>
        </div>` : html`<button type="button" data-view-new ?disabled=${(views?.length ?? 0) >= 20} @click=${() => { this.naming = true; void this.updateComplete.then(() => (this.renderRoot.querySelector('[data-view-name]') as HTMLInputElement | null)?.focus()); }}>${tIcon('plus')}${tbt('saveCurrent')}</button>`}
      ${this.viewError ? html`<div class="note err" role="alert" data-view-error>${this.viewError}</div>` : nothing}
    </div>`;
  }

  private filtersPop(): TemplateResult {
    const e = this.extra;
    const prioName = (k: string) => this.meta?.departments[0]?.priorities.find((p) => p.key === k)?.name ?? tbt(`prio_${k}` as TableTextKey);
    const radio = (value: string, label: string) => html`<button type="button" class="rc" aria-pressed=${String(e.assignee === value)} data-f-assignee=${value || 'any'} @click=${() => this.setExtra({ assignee: value })}>${label}</button>`;
    return html`<div class="pop wide lst" role="dialog" aria-label=${tbt('filters')} data-pop="filters">
      <div class="plist">
      <div class="hd">${tbt('fPriority')}</div>
      <div class="fgrp">${PRIORITY_KEYS.map((k) => html`<button type="button" class="rc" aria-pressed=${String(e.priority.includes(k))} data-f-priority=${k}
        @click=${() => this.setExtra({ priority: e.priority.includes(k) ? e.priority.filter((x) => x !== k) : [...e.priority, k] })}>${prioName(k)}</button>`)}</div>
      <div class="hd">${tbt('fAssignee')}</div>
      <div class="fgrp">${radio('', tbt('fAssigneeAny'))}${radio('none', tbt('fAssigneeNone'))}${radio('me', tbt('fAssigneeMe'))}</div>
      ${this.holders.length ? html`<div class="fgrp" data-f-holders>${this.holders.map((h) => radio(h.key, h.name))}</div>` : nothing}
      <div class="fgrp">
        <button type="button" class="rc" aria-pressed=${String(e.waiting === 'manager')} data-f-waiting @click=${() => this.setExtra({ waiting: e.waiting ? '' : 'manager' })}>${tbt('fWaiting')}</button>
        <button type="button" class="rc" aria-pressed=${String(e.stuck === 'any')} data-f-stuck @click=${() => this.setExtra({ stuck: e.stuck ? '' : 'any' })}>${tbt('fStuck')}</button>
      </div>
      ${costColumnsOn() ? html`<div class="hd">${ct('colCostStatus')}</div>
      <div class="fgrp">${COST_FILTER_STATUSES.map((k) => html`<button type="button" class="rc" aria-pressed=${String(e.cost_status.includes(k))} data-f-cost-status=${k}
        @click=${() => this.setExtra({ cost_status: e.cost_status.includes(k) ? e.cost_status.filter((x) => x !== k) : [...e.cost_status, k] })}>${ct(`cs_${k}` as CostTextKey)}</button>`)}</div>` : nothing}
      <div class="dates">
        <label>${tbt('fCreatedFrom')}<input class="inp" type="datetime-local" data-f-from .value=${toLocalInput(e.created_from)} @change=${(ev: Event) => this.setExtra({ created_from: fromLocalInput((ev.target as HTMLInputElement).value) })} /></label>
        <label>${tbt('fCreatedTo')}<input class="inp" type="datetime-local" data-f-to .value=${toLocalInput(e.created_to)} @change=${(ev: Event) => this.setExtra({ created_to: fromLocalInput((ev.target as HTMLInputElement).value) })} /></label>
      </div>
      </div>
      <hr />
      <button type="button" data-f-clear ?disabled=${!activeExtraCount(e)} @click=${() => this.setExtra({ ...NO_TABLE_FILTERS })}>${tIcon('x')}${tbt('fClear')}</button>
    </div>`;
  }

  render() {
    if (!this.layout) return nothing;
    const n = activeExtraCount(this.extra);
    const compact = this.layout.density === 'compact';
    return html`<div class="tbar" role="toolbar" aria-label=${tbt('tableLabel')} data-table-toolbar>
      ${this.phone ? nothing : html`<span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop === 'columns')} data-open="columns" @click=${() => this.open('columns')}>${tbIcon('columns')}${tbt('columns')}</button>
        ${this.pop === 'columns' ? this.columnsPop() : nothing}
      </span>`}
      <span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop === 'views')} data-open="views" @click=${() => this.open('views')}>${tbIcon('bookmark')}${tbt('savedViews')}${tbIcon('chevron')}</button>
        ${this.pop === 'views' ? this.viewsPop() : nothing}
      </span>
      <span class="anchor">
        <button type="button" class="btn sm" aria-haspopup="dialog" aria-expanded=${String(this.pop === 'filters')} data-open="filters" @click=${() => this.open('filters')}>${tbIcon('filter')}${n ? tbt('filtersCount', { n }) : tbt('filters')}</button>
        ${this.pop === 'filters' ? this.filtersPop() : nothing}
      </span>
      <button type="button" class="btn sm" aria-pressed=${String(compact)} data-density=${this.layout.density} aria-label=${`${tbt('density')}: ${tbt(compact ? 'density_compact' : 'density_comfortable')}`}
        @click=${() => this.setLayout({ density: compact ? 'comfortable' : 'compact' })}>${tbIcon('density')}${tbt(compact ? 'density_compact' : 'density_comfortable')}</button>
      <span class="grow"></span>
      ${this.count !== null ? html`<span class="count" data-table-count>${tbt(this.more ? 'countMore' : this.count === 1 ? 'countOne' : 'count', { n: this.count })}</span>` : nothing}
      ${this.canExport ? html`<button type="button" class="btn sm" data-export ?disabled=${this.exporting} aria-label=${tbt('exportTitle')} @click=${() => this.emit('export-csv', {})}>${tbIcon('download')}${tbt('csv')}</button>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-table-toolbar': TicketsTableToolbar;
  }
}
