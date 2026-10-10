import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { groupPicker, pickerEntities, type CatalogEntity, type PickerFilter } from '../api/automations';
import { icon } from './automation-builder-icons';
import { editorShared } from './automation-editor-css';
import { entityIcon, sensitiveLabel, type EditorEnv } from './automation-editor-logic';

/**
 * CR-017 S4: "בחירת מכשירים" - the picker of the builder (floor -> area -> device, search), scoped to what the caller may use. The list is the
 * server's catalogue filtered again by the client helpers (`pickerEntities`, `groupPicker`: the same scope rule as CR-014's picker); the server
 * re-checks every target on save.
 *
 *   .env .filter .where .selected .multi
 *   picker-change {ids}   every toggle (the editor applies it at once)
 *   picker-done           "סיום"
 *
 * A popover under the sentence on a desktop, a bottom sheet on a phone (the editor positions the host; this element is the panel).
 */
@customElement('automation-entity-picker')
export class AutomationEntityPicker extends LitElement {
  @property({ attribute: false }) env: EditorEnv | null = null;
  @property({ attribute: false }) filter: PickerFilter = {};
  /** An extra predicate on the entities (numeric triggers: only entities with a numeric state). */
  @property({ attribute: false }) where: ((e: CatalogEntity) => boolean) | null = null;
  @property({ attribute: false }) selected: string[] = [];
  @property({ type: Boolean }) multi = true;
  @state() private q = '';

  static styles = [
    editorShared,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        max-block-size: inherit;
        background: var(--ab-sheet, var(--dv-surface-solid));
        -webkit-backdrop-filter: blur(40px) saturate(1.8);
        backdrop-filter: blur(40px) saturate(1.8);
        border: 1px solid var(--dv-border);
        border-radius: var(--sw-r-2xl);
        box-shadow: var(--dv-shadow-3);
        overflow: hidden;
      }
      .ph {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 12px 12px 8px;
        flex: none;
      }
      .search {
        position: relative;
        flex: 1;
        min-inline-size: 0;
      }
      .search input {
        inline-size: 100%;
        block-size: 42px;
        padding-inline: 38px 12px;
        border-radius: 999px;
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-solid);
        color: var(--dv-text);
        font: inherit;
        font-size: var(--sw-fs-base);
      }
      .search .ic {
        position: absolute;
        inset-inline-start: 13px;
        inset-block-start: 13px;
        color: var(--dv-text-3);
        font-size: var(--sw-fs-lg);
      }
      .pb {
        flex: 1;
        overflow: auto;
        padding: 4px 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-block-size: 0;
        scrollbar-width: thin;
      }
      h5 {
        margin: 6px 6px 2px;
        font-size: var(--sw-fs-sm);
        font-weight: 700;
        color: var(--dv-text-2);
        display: flex;
        gap: 6px;
        align-items: center;
      }
      h5.floor {
        color: var(--dv-text);
        font-size: var(--sw-fs-base);
      }
      .prow {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 10px;
        min-block-size: 46px;
        border-radius: var(--sw-r-md);
        inline-size: 100%;
        border: 0;
        background: transparent;
        text-align: start;
        color: var(--dv-text);
        font-size: var(--sw-fs-base);
      }
      .prow:hover {
        background: var(--dv-surface-3);
      }
      .prow .rg {
        display: grid;
        place-items: center;
        inline-size: 30px;
        block-size: 30px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .nm {
        flex: 1;
        min-inline-size: 0;
      }
      .nm small {
        display: block;
        font-size: var(--sw-fs-xs);
        color: var(--dv-text-2);
      }
      .ck {
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 1.5px solid var(--dv-border-strong);
        display: grid;
        place-items: center;
        color: var(--sw-text-inverse);
        flex: none;
        font-size: var(--sw-fs-base);
      }
      .prow[aria-checked='true'] .ck {
        background: var(--dv-accent);
        border-color: var(--dv-accent);
      }
      .pf {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--dv-border);
      }
      .pf .cnt {
        flex: 1;
        font-size: var(--sw-fs-base);
        color: var(--dv-text-2);
      }
      .pf .cnt em {
        font-style: normal;
        font-weight: 700;
        color: var(--dv-text);
      }
      .none {
        padding: 30px 10px;
        text-align: center;
        color: var(--dv-text-2);
        font-weight: 600;
      }
    `,
  ];

  private pick(e: CatalogEntity) {
    const has = this.selected.includes(e.entity_id);
    const ids = this.multi ? (has ? this.selected.filter((x) => x !== e.entity_id) : [...this.selected, e.entity_id]) : [e.entity_id];
    this.selected = ids;
    this.dispatchEvent(new CustomEvent('picker-change', { detail: { ids }, bubbles: true, composed: true }));
    if (!this.multi) this.done();
  }

  private done() {
    this.dispatchEvent(new CustomEvent('picker-done', { bubbles: true, composed: true }));
  }

  protected firstUpdated() {
    requestAnimationFrame(() => this.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }));
  }

  private row(e: CatalogEntity) {
    const on = this.selected.includes(e.entity_id);
    return html`<button class="prow" type="button" role="menuitemcheckbox" aria-checked=${on} data-picker-item=${e.entity_id} @click=${() => this.pick(e)}>
      <span class="rg">${icon(entityIcon(e.entity_id))}</span>
      <span class="nm">${e.name}${e.state ? html`<small>${e.state}</small>` : nothing}</span>
      ${e.class ? html`<span class="tag sens">${icon('alarm')}${sensitiveLabel(e.class)}</span>` : nothing}
      ${e.missing ? html`<span class="tag bad">${icon('warning')}חסר</span>` : nothing}
      <span class="ck">${on ? icon('check') : nothing}</span>
    </button>`;
  }

  render() {
    const env = this.env;
    if (!env) return nothing;
    let list = pickerEntities(env.catalog.entities, env.scope, { purpose: 'target', ...this.filter, q: this.q });
    if (this.where) list = list.filter(this.where);
    const groups = groupPicker(list);
    const manyFloors = groups.filter((g) => g.floor).length > 1;
    return html`<div class="ph">
        <label class="search">${icon('search')}<input type="search" data-picker-search placeholder="חיפוש מכשיר" aria-label="חיפוש מכשיר" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
        ${env.scoped ? html`<span class="tag acc">${icon('layers')}${env.catalog.floors[0]?.name ?? ''}</span>` : nothing}
      </div>
      <div class="pb" role="menu" aria-label="בחירת מכשירים">
        ${groups.map((g) => html`${manyFloors && g.floor ? html`<h5 class="floor">${icon('layers')}${g.floor.name}</h5>` : nothing}
          ${g.areas.map((a) => html`<div><h5>${a.area ? a.area.name : html`${icon('home')}כל הבית`}</h5>${a.entities.map((e) => this.row(e))}</div>`)}`)}
        ${list.length ? nothing : html`<div class="none">לא נמצאו מכשירים</div>`}
      </div>
      <div class="pf"><span class="cnt"><em>${this.selected.length}</em> נבחרו</span><button class="btn primary sm" type="button" data-picker-done @click=${this.done}>${icon('check')}סיום</button></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'automation-entity-picker': AutomationEntityPicker;
  }
}
