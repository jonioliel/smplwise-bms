/**
 * The working surface of the settings lists of screens and of speakers / players (הגדרות › מולטימדיה; 0.1.161): a toolbar (free text that also
 * matches ids and integration names, integration multi-select, area, type, approval, availability, sort, group) and a compact table - one
 * dense row per device (name, type, integration, the platform's ids with a copy key, area, status, approval, connections) whose full form opens
 * on demand under the row - with a sticky header, collapsible group headers with counts, cards on a phone. The pure logic is
 * ./media-admin-list-logic.ts. Settings screens may name the platform and show its identifiers (docs/design/UI_COPY_RULES.md).
 * Both sections (`<system-multimedia>` and `<system-multimedia-players>`) draw their rows with `adminTable()` and share `mediaAdminListCss`.
 */
import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-badge';
import '../components/sw-toggle';
import type { DropdownItem } from '../components/sw-dropdown';
import type { AdminDevice } from '../api/media-admin';
import {
  DEFAULT_VIEW, NO_INTEGRATION, TYPE_LABEL, buildView, isFiltered, optionsOf,
  type AvailFilter, type ApprovalFilter, type Group, type GroupKey, type ListView, type LiveAvail, type RowFacts, type SortKey,
} from './media-admin-list-logic';

export const SORT_LABEL: Record<SortKey, string> = { name: 'שם', type: 'סוג', integration: 'אינטגרציה', area: 'חדר', id: 'מזהה', status: 'מצב' };
const GROUP_LABEL: Record<GroupKey, string> = { none: 'ללא קיבוץ', integration: 'לפי אינטגרציה', area: 'לפי חדר', type: 'לפי סוג' };

// ------------------------------------------------------------------------------------------------ the toolbar

@customElement('media-admin-toolbar')
export class MediaAdminToolbar extends LitElement {
  @property({ attribute: false }) devices: AdminDevice[] = [];
  @property({ attribute: false }) view: ListView = DEFAULT_VIEW;
  @property({ attribute: false }) live?: LiveAvail;
  @property({ type: Number }) shown = 0;
  /** `data-` scope of the two lists on one screen. */
  @property() scope = '';

  static styles = css`
    :host {
      display: block;
      --hit: var(--sw-touch-desktop, 36px);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1 1 220px;
      min-inline-size: 180px;
      max-inline-size: 360px;
      min-block-size: var(--hit);
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .search:focus-within {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .search input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-block-size: var(--hit);
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: var(--hit);
      block-size: var(--hit);
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      font: inherit;
    }
    .ib:focus-visible,
    .clear:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .clear {
      border: 0;
      background: none;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      min-block-size: var(--hit);
      padding-inline: 6px;
    }
    .ints {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding-block-start: 8px;
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-start: auto;
    }
    @media (max-width: 1100px) {
      :host {
        --hit: 44px;
      }
      .search {
        max-inline-size: none;
      }
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: var(--hit);
      padding-inline: 12px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .chip:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .chip .n {
      font-size: var(--sw-fs-xs);
      opacity: 0.75;
    }
  `;

  private emit(patch: Partial<ListView>) {
    this.dispatchEvent(new CustomEvent<ListView>('view-change', { detail: { ...this.view, ...patch }, bubbles: true, composed: true }));
  }

  private toggleInt(id: string) {
    const cur = this.view.integrations;
    this.emit({ integrations: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  }

  render() {
    const v = this.view;
    const o = optionsOf(this.devices, this.live);
    const areaItems: DropdownItem[] = [{ id: '', label: 'כל החדרים' }, ...o.areas.map((a) => ({ id: a.id, label: a.label, count: a.count }))];
    const typeItems: DropdownItem[] = [{ id: '', label: 'כל הסוגים' }, ...o.types.map((t) => ({ id: t, label: TYPE_LABEL[t] }))];
    const apprItems: DropdownItem[] = [{ id: 'all', label: 'כל האישורים' }, { id: 'approved', label: 'מאושרים' }, { id: 'pending', label: 'ממתינים לאישור' }];
    const availItems: DropdownItem[] = [{ id: 'all', label: 'כל המצבים' }, { id: 'available', label: 'זמינים' }, { id: 'unavailable', label: 'לא זמינים' }];
    const sortItems: DropdownItem[] = (Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ id: k, label: `מיון: ${SORT_LABEL[k]}` }));
    const groupItems: DropdownItem[] = (Object.keys(GROUP_LABEL) as GroupKey[]).map((k) => ({ id: k, label: GROUP_LABEL[k] }));
    const pick = (key: keyof ListView) => (e: CustomEvent<{ id: string }>) => this.emit({ [key]: e.detail.id } as Partial<ListView>);
    return html`<div class="bar" role="search" data-mm-toolbar=${this.scope}>
      <label class="search"><sw-icon name="search" size="16"></sw-icon>
        <input type="search" .value=${v.q} placeholder="חיפוש שם, מזהה או אינטגרציה" aria-label="חיפוש שם, מזהה או אינטגרציה" data-mm-search
          @input=${(e: Event) => this.emit({ q: (e.target as HTMLInputElement).value })} /></label>
      ${o.areas.length > 1 ? html`<sw-dropdown label="סינון לפי חדר" data-mm-f-area .items=${areaItems} .value=${v.area} @change=${pick('area')}></sw-dropdown>` : nothing}
      ${o.types.length > 1 ? html`<sw-dropdown label="סינון לפי סוג" data-mm-f-type .items=${typeItems} .value=${v.type} @change=${pick('type')}></sw-dropdown>` : nothing}
      <sw-dropdown label="סינון לפי אישור" data-mm-f-approval .items=${apprItems} .value=${v.approval} @change=${(e: CustomEvent<{ id: string }>) => this.emit({ approval: e.detail.id as ApprovalFilter })}></sw-dropdown>
      <sw-dropdown label="סינון לפי מצב" data-mm-f-avail .items=${availItems} .value=${v.avail} @change=${(e: CustomEvent<{ id: string }>) => this.emit({ avail: e.detail.id as AvailFilter })}></sw-dropdown>
      <sw-dropdown label="מיון" data-mm-sort .items=${sortItems} .value=${v.sort} @change=${(e: CustomEvent<{ id: string }>) => this.emit({ sort: e.detail.id as SortKey })}></sw-dropdown>
      <button type="button" class="ib" data-mm-dir aria-label=${v.dir === 'asc' ? 'סדר עולה, לחץ להיפוך' : 'סדר יורד, לחץ להיפוך'} @click=${() => this.emit({ dir: v.dir === 'asc' ? 'desc' : 'asc' })}>
        <sw-icon name=${v.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size="16"></sw-icon></button>
      <sw-dropdown label="קיבוץ" data-mm-group .items=${groupItems} .value=${v.group} @change=${(e: CustomEvent<{ id: string }>) => this.emit({ group: e.detail.id as GroupKey, collapsed: [] })}></sw-dropdown>
      ${isFiltered(v) ? html`<button type="button" class="clear" data-mm-clear @click=${() => this.emit({ q: '', integrations: [], area: '', type: '', approval: 'all', avail: 'all' })}>נקה סינון</button>` : nothing}
      <span class="count" data-mm-shown role="status">${this.shown === this.devices.length ? `${this.devices.length}` : `${this.shown} מתוך ${this.devices.length}`}</span>
    </div>
    ${o.integrations.length > 1 ? html`<div class="ints" role="group" aria-label="סינון לפי אינטגרציה" data-mm-f-int>
      ${o.integrations.map((i) => html`<button type="button" class="chip" data-mm-int=${i.id} aria-pressed=${String(v.integrations.includes(i.id))}
        @click=${() => this.toggleInt(i.id)}>${i.id === NO_INTEGRATION ? 'ללא אינטגרציה' : i.id}<span class="n">${i.count}</span></button>`)}
    </div>` : nothing}`;
  }
}

// ------------------------------------------------------------------------------------------------ the table

export interface TableCtx {
  scope: string;
  devices: AdminDevice[];
  view: ListView;
  live?: LiveAvail;
  /** keys whose form is open / whose connections are open */
  editing: Set<string>;
  endpoints: Set<string>;
  saved: string;
  status?: (d: AdminDevice, f: RowFacts) => { kind: 'ok' | 'stale' | 'neutral'; label: string } | null;
  form: (d: AdminDevice) => TemplateResult;
  connections: (d: AdminDevice) => TemplateResult | typeof nothing;
  typeLabel: (d: AdminDevice) => string;
  onView: (v: ListView) => void;
  onEdit: (key: string) => void;
  onEndpoints: (key: string) => void;
  onApprove: (d: AdminDevice, on: boolean) => void;
  onCopy: (text: string) => void;
  /** the text of the empty state */
  none: string;
}

const COLS: { key: SortKey | 'x'; label: string; cls: string }[] = [
  { key: 'x', label: '', cls: 'c-x' }, { key: 'name', label: 'שם', cls: 'c-name' }, { key: 'type', label: 'סוג', cls: 'c-type' },
  { key: 'integration', label: 'אינטגרציה', cls: 'c-int' }, { key: 'id', label: 'מזהה', cls: 'c-id' }, { key: 'area', label: 'חדר', cls: 'c-area' },
  { key: 'status', label: 'מצב', cls: 'c-st' }, { key: 'x', label: 'מאושר', cls: 'c-ap' }, { key: 'x', label: 'חיבורים', cls: 'c-cn' },
];

function head(ctx: TableCtx): TemplateResult {
  const v = ctx.view;
  return html`<div class="thead" role="row">${COLS.map((c) => c.key === 'x'
    ? html`<div role="columnheader" class=${`th ${c.cls}`}>${c.label}</div>`
    : html`<div role="columnheader" class=${`th ${c.cls}`} aria-sort=${v.sort === c.key ? (v.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" class="sortb" data-mm-th=${c.key} @click=${() => ctx.onView({ ...v, sort: c.key as SortKey, dir: v.sort === c.key && v.dir === 'asc' ? 'desc' : 'asc' })}>${c.label}${v.sort === c.key ? html`<sw-icon name=${v.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size="12"></sw-icon>` : nothing}</button></div>`)}</div>`;
}

function row(ctx: TableCtx, d: AdminDevice, f: RowFacts): TemplateResult {
  const editing = ctx.editing.has(d.key);
  const conn = ctx.endpoints.has(d.key);
  const st = ctx.status ? ctx.status(d, f) : f.available === null ? null : f.available ? { kind: 'ok' as const, label: 'זמין' } : { kind: 'stale' as const, label: 'לא זמין' };
  const extra = f.integrations.length - 1;
  return html`<div class=${`item${editing ? ' sel' : ''}`} role="rowgroup" data-mm-admin-device=${d.key}>
    <div class="tr" role="row">
      <div role="cell" class="c c-x"><button type="button" class="eb" data-mm-edit=${d.key} aria-expanded=${String(editing)} aria-label=${`${editing ? 'סגור עריכה' : 'עריכה'}: ${d.name}`} @click=${() => ctx.onEdit(d.key)}>
        <sw-icon name=${editing ? 'chevronDown' : 'chevronBack'} size="14"></sw-icon></button></div>
      <div role="cell" class="c c-name"><span class="nm" title=${d.name} data-mm-row-name=${d.key}>${d.name}</span>${ctx.saved === d.key ? html`<span class="ok" role="status">נשמר</span>` : nothing}</div>
      <div role="cell" class="c c-type"><span class="lb">סוג</span>${ctx.typeLabel(d)}</div>
      <div role="cell" class="c c-int" data-mm-int-cell=${d.key}><span class="lb">אינטגרציה</span>${f.integrations.length
        ? html`<span class="mono" title=${f.integrations.join(', ')}>${f.primary}</span>${extra > 0 ? html`<span class="more">+${extra}</span>` : nothing}` : html`<span class="muted">—</span>`}</div>
      <div role="cell" class="c c-id" data-mm-id-cell=${d.key}>
        ${f.entityId ? html`<span class="idl"><span class="mono" title=${f.entityId} data-mm-entity-id>${f.entityId}</span>
          <button type="button" class="cp" data-mm-copy=${d.key} aria-label=${`העתק מזהה: ${f.entityId}`} @click=${() => ctx.onCopy(f.entityId)}><sw-icon name="copy" size="14"></sw-icon></button></span>` : nothing}
        ${f.deviceId ? html`<span class="idl"><span class="mono dim" title=${f.deviceId} data-mm-device-id>${f.deviceId}</span>
          <button type="button" class="cp" data-mm-copy-device=${d.key} aria-label=${`העתק מזהה התקן: ${f.deviceId}`} @click=${() => ctx.onCopy(f.deviceId)}><sw-icon name="copy" size="14"></sw-icon></button></span>` : nothing}
        ${!f.entityId && !f.deviceId ? html`<span class="muted">—</span>` : nothing}</div>
      <div role="cell" class="c c-area"><span class="lb">חדר</span>${f.area ? [d.floor_name, f.area].filter(Boolean).join(' › ') : html`<span class="muted">—</span>`}</div>
      <div role="cell" class="c c-st" data-mm-status=${d.key}>${st ? html`<sw-badge kind=${st.kind} label=${st.label}></sw-badge>` : html`<span class="muted">—</span>`}</div>
      <div role="cell" class="c c-ap"><sw-toggle label=${`מאושר: ${d.name}`} labelHidden .checked=${d.approved} data-mm-approved=${d.key} @change=${(e: CustomEvent<{ checked: boolean }>) => ctx.onApprove(d, e.detail.checked)}></sw-toggle></div>
      <div role="cell" class="c c-cn"><button type="button" class="cnb" data-mm-toggle-endpoints=${d.key} aria-expanded=${String(conn)} @click=${() => ctx.onEndpoints(d.key)}>חיבורים (${d.endpoints.length}) ${conn ? '▴' : '◂'}</button></div>
    </div>
    ${editing || conn ? html`<div class="detail" role="row"><div role="cell" class="dcell">
      ${editing ? ctx.form(d) : nothing}${conn ? ctx.connections(d) : nothing}</div></div>` : nothing}
  </div>`;
}

function groupHead(ctx: TableCtx, g: Group): TemplateResult {
  const v = ctx.view;
  const folded = v.collapsed.includes(g.id);
  return html`<div class="ghead" role="row"><button type="button" class="gb" data-mm-group-head=${g.id} aria-expanded=${String(!folded)}
    @click=${() => ctx.onView({ ...v, collapsed: folded ? v.collapsed.filter((x) => x !== g.id) : [...v.collapsed, g.id] })}>
    <sw-icon name=${folded ? 'chevronBack' : 'chevronDown'} size="14"></sw-icon><span class="gl">${g.label}</span><span class="gc" data-mm-group-count>${g.rows.length}</span></button></div>`;
}

/** The list: the toolbar, the sticky header and the rows (grouped), or the empty / no-match state. */
export function adminTable(ctx: TableCtx): TemplateResult {
  const { groups, shown } = buildView(ctx.devices, ctx.view, ctx.live);
  return html`<media-admin-toolbar scope=${ctx.scope} .devices=${ctx.devices} .view=${ctx.view} .live=${ctx.live} .shown=${shown} @view-change=${(e: CustomEvent<ListView>) => ctx.onView(e.detail)}></media-admin-toolbar>
    <div class="tbl" role="table" aria-label=${ctx.scope === 'screens' ? 'מסכים' : 'נגנים ורמקולים'} data-mm-table=${ctx.scope}>
      ${head(ctx)}
      ${shown === 0 ? html`<div class="none muted" data-mm-no-match>${ctx.devices.length ? 'אין התאמות לסינון' : ctx.none}</div>` : nothing}
      ${ctx.view.group === 'none'
        ? repeat(groups[0].rows, (r) => r.d.key, (r) => row(ctx, r.d, r.f))
        : groups.map((g) => html`<div role="rowgroup" class="grp" data-mm-grp=${g.id}>${groupHead(ctx, g)}
            ${ctx.view.collapsed.includes(g.id) ? nothing : repeat(g.rows, (r) => r.d.key, (r) => row(ctx, r.d, r.f))}</div>`)}
    </div>`;
}

export const mediaAdminListCss = css`
  .tbl {
    --hit: var(--sw-touch-desktop, 36px);
    display: block;
    margin-block-start: 10px;
    --cols: var(--hit) minmax(150px, 1.5fr) 96px 130px minmax(200px, 1.9fr) minmax(110px, 1fr) 90px 64px 110px;
  }
  .thead,
  .tr {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
    column-gap: 10px;
    padding-inline: 6px;
  }
  .thead {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    background: var(--sw-surface);
    border-block-end: 1px solid var(--sw-border-strong);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    min-block-size: 34px;
  }
  .sortb {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    background: none;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
    min-block-size: var(--hit);
    min-inline-size: var(--hit);
    justify-content: center;
  }
  .sortb:focus-visible,
  .gb:focus-visible,
  .cp:focus-visible,
  .cnb:focus-visible,
  .eb:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  .item {
    border-block-end: 1px solid var(--sw-border);
  }
  .item.sel {
    background: var(--sw-surface-2);
  }
  .tr {
    min-block-size: 52px;
    font-size: var(--sw-fs-sm);
  }
  .c {
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .c .lb {
    display: none;
  }
  .nm {
    font-weight: var(--sw-fw-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  .c-int .mono {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c-id {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  .idl {
    display: flex;
    align-items: center;
    gap: 2px;
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  .idl .mono {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mono.dim {
    color: var(--sw-text-3);
  }
  .more {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .cp {
    flex: none;
    display: inline-grid;
    place-items: center;
    inline-size: var(--hit);
    block-size: var(--hit);
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--sw-text-3);
    cursor: pointer;
  }
  .cp:hover {
    background: var(--sw-surface-2);
    color: var(--sw-text);
  }
  .cnb {
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    background: none;
    border: 0;
    padding: 0 6px;
    min-block-size: var(--hit);
    min-inline-size: var(--hit);
  }
  .ghead {
    display: block;
    background: var(--sw-surface-2);
    border-block-end: 1px solid var(--sw-border);
  }
  .grp + .grp .ghead {
    border-block-start: 1px solid var(--sw-border);
  }
  .gb {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    min-block-size: var(--hit);
    padding-inline: 8px;
    border: 0;
    background: none;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
    text-align: start;
  }
  .gc {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  .detail {
    display: block;
    padding: 4px 12px 12px;
    border-block-start: 1px dashed var(--sw-border);
  }
  .dcell {
    display: block;
  }
  .none {
    padding: 16px 6px;
  }
  .eb {
    display: inline-grid;
    place-items: center;
    inline-size: var(--hit);
    block-size: var(--hit);
    padding: 0;
    border: 1px solid var(--sw-border-strong);
    border-radius: 8px;
    background: var(--sw-surface);
    color: var(--sw-text);
    cursor: pointer;
  }
  @media (max-width: 1280px) {
    .tbl {
      --cols: var(--hit) minmax(130px, 1.4fr) 84px 110px minmax(170px, 1.7fr) 80px 60px 104px;
    }
    .c-area,
    .th.c-area {
      display: none;
    }
  }
  @media (max-width: 1100px) {
    .tbl {
      --hit: 44px;
    }
  }
  @media (max-width: 860px) {
    .thead {
      display: none;
    }
    .tr {
      grid-template-columns: 44px minmax(0, 1fr) auto;
      grid-template-areas: 'x name ap' 'x type st' 'x int int' 'x id id' 'x area area' 'x cn cn';
      row-gap: 4px;
      padding: 8px 6px;
    }
    .c-x {
      grid-area: x;
      align-self: start;
    }
    .c-name {
      grid-area: name;
    }
    .c-ap {
      grid-area: ap;
      justify-self: end;
    }
    .c-type {
      grid-area: type;
    }
    .c-st {
      grid-area: st;
      justify-self: end;
    }
    .c-int {
      grid-area: int;
    }
    .c-id {
      grid-area: id;
    }
    .c-area {
      grid-area: area;
      display: flex;
    }
    .c-cn {
      grid-area: cn;
    }
    .c .lb {
      display: inline;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  }
`;
