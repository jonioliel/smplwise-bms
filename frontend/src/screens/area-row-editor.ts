import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { getDevicesTree, type ClimateSummary } from '../api/devices';
import { isApi } from '../api/session';
import {
  ACTIVE_ITEMS, AREA_ITEM_LABEL, AREA_ITEMS, CLIMATE_DISPLAYS, CLIMATE_DISPLAY_LABEL, CLIMATE_MODES, CLIMATE_MODE_LABEL, FLOOR_ITEM_LABEL, FLOOR_ITEMS, moveItem, ROW_MAX_PHONE,
  type AreaItem, type AreaRow, type ClimateDisplay, type ClimateMode, type FloorItem, type FloorRow,
} from '../api/area-row';

export interface AreaRowChange {
  area: AreaRow;
  floor: FloorRow;
}

/**
 * "מה מוצג ליד שם האזור" (release 0.1.149): the editor of the two lists of the home screen - what sits after an area's name
 * (each item on / off, in an order; what the A/C indicator says; whether empty counters show) and what the floor's header
 * chips are. One component for both places that edit it: הגדרות › חשמל והתקנים (the installation's default) and החשבון שלי ›
 * המסך שלי (a holder of screen.personalize, their own). It holds no state of its own: every change is an `area-row-change`
 * event with the whole new value, and the owner of the component saves it.
 */
@customElement('area-row-editor')
export class AreaRowEditor extends LitElement {
  @property({ attribute: false }) area!: AreaRow;
  @property({ attribute: false }) floor!: FloorRow;
  @property({ type: Boolean }) disabled = false;
  /** The areas that have several A/C (for choosing which one leads), read from the devices tree when "מוביל" is chosen. */
  @state() private multi: { area_id: string; name: string; climate: ClimateSummary[] }[] | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .hd {
      font-weight: var(--sw-fw-semibold);
      margin-block: 10px 4px;
    }
    .hd:first-child {
      margin-block-start: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 2px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 34px;
      padding-inline: 4px;
      border-radius: 8px;
    }
    li:hover {
      background: var(--sw-surface-2);
    }
    li label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }
    li.off {
      color: var(--sw-text-3);
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px 12px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    select {
      font: inherit;
      min-block-size: 34px;
      padding-inline: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .cut {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .cut::before,
    .cut::after {
      content: '';
      flex: 1;
      border-block-start: 1px dashed var(--sw-border-strong);
    }
    .only {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
  `;

  private emit(area: AreaRow, floor: FloorRow) {
    this.dispatchEvent(new CustomEvent<AreaRowChange>('area-row-change', { detail: { area, floor }, bubbles: true, composed: true }));
  }

  /** The enabled items in their order, then the rest in the canonical order. */
  private order<T extends string>(on: T[], all: readonly T[]): T[] {
    return [...on, ...all.filter((x) => !on.includes(x))];
  }

  protected updated() {
    if (this.area?.climate_mode === 'lead' && this.multi === null && isApi()) {
      this.multi = [];
      void getDevicesTree()
        .then((t) => {
          this.multi = t.floors.flatMap((f) => f.areas).filter((a) => (a.climate?.length ?? 0) > 1).map((a) => ({ area_id: a.area_id, name: a.name, climate: a.climate ?? [] }));
        })
        .catch(() => undefined);
    }
  }

  private setLead(areaId: string, entity: string) {
    const lead = { ...this.area.climate_lead };
    if (entity) lead[areaId] = entity;
    else delete lead[areaId];
    this.emit({ ...this.area, climate_lead: lead }, this.floor);
  }

  private toggleOnly(id: AreaItem, on: boolean) {
    const only = on ? [...this.area.only_active, id] : this.area.only_active.filter((x) => x !== id);
    this.emit({ ...this.area, only_active: only }, this.floor);
  }

  private toggleArea(id: AreaItem, on: boolean) {
    const items = on ? [...this.area.items, id] : this.area.items.filter((x) => x !== id);
    this.emit({ ...this.area, items }, this.floor);
  }

  private toggleFloor(id: FloorItem, on: boolean) {
    const items = on ? [...this.floor.items, id] : this.floor.items.filter((x) => x !== id);
    this.emit(this.area, { items });
  }

  render() {
    if (!this.area || !this.floor) return nothing;
    const dis = this.disabled;
    return html`
      <div class="hd" id="are-area">מה מוצג ליד שם האזור</div>
      <ul aria-labelledby="are-area" data-area-row-items>
        ${this.order(this.area.items, AREA_ITEMS).map((id) => {
          const on = this.area.items.includes(id);
          const i = this.area.items.indexOf(id);
          const cut = on && i === ROW_MAX_PHONE && this.area.items.length > ROW_MAX_PHONE;
          return html`${cut ? html`<li class="cut" data-phone-cut role="presentation">בטלפון: רק הפריטים שמעל הקו</li>` : nothing}<li class=${on ? '' : 'off'} data-area-item=${id}>
            <label><input type="checkbox" data-area-item-on=${id} .checked=${on} ?disabled=${dis} @change=${(e: Event) => this.toggleArea(id, (e.target as HTMLInputElement).checked)} />${AREA_ITEM_LABEL[id]}</label>
            ${on && ACTIVE_ITEMS.includes(id)
              ? html`<label class="only"><input type="checkbox" data-area-item-only=${id} .checked=${this.area.only_active.includes(id)} ?disabled=${dis} @change=${(e: Event) => this.toggleOnly(id, (e.target as HTMLInputElement).checked)} />${id === 'openings' || id === 'locks' ? 'רק כשפתוח' : 'רק כשפעיל'}</label>`
              : nothing}
            ${on
              ? html`<button type="button" class="ib" data-area-item-earlier=${id} aria-label=${`הקדם: ${AREA_ITEM_LABEL[id]}`} ?disabled=${dis || i === 0} @click=${() => this.emit({ ...this.area, items: moveItem(this.area.items, id, -1) }, this.floor)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
                <button type="button" class="ib" data-area-item-later=${id} aria-label=${`אחר: ${AREA_ITEM_LABEL[id]}`} ?disabled=${dis || i === this.area.items.length - 1} @click=${() => this.emit({ ...this.area, items: moveItem(this.area.items, id, 1) }, this.floor)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`
              : nothing}
          </li>`;
        })}
      </ul>
      <div class="row">
        <label for="are-climate">המזגן מציג</label>
        <select id="are-climate" data-area-climate ?disabled=${dis} @change=${(e: Event) => this.emit({ ...this.area, climate: (e.target as HTMLSelectElement).value as ClimateDisplay }, this.floor)}>
          ${CLIMATE_DISPLAYS.map((d) => html`<option value=${d} ?selected=${this.area.climate === d}>${CLIMATE_DISPLAY_LABEL[d]}</option>`)}
        </select>
      </div>
      <div class="row">
        <label for="are-cmode">כמה מזגנים באזור</label>
        <select id="are-cmode" data-area-climate-mode ?disabled=${dis} @change=${(e: Event) => this.emit({ ...this.area, climate_mode: (e.target as HTMLSelectElement).value as ClimateMode }, this.floor)}>
          ${CLIMATE_MODES.map((m) => html`<option value=${m} ?selected=${this.area.climate_mode === m}>${CLIMATE_MODE_LABEL[m]}</option>`)}
        </select>
      </div>
      ${this.area.climate_mode === 'lead' && this.multi?.length
        ? html`<ul aria-label="המזגן המוביל" data-climate-leads>
            ${this.multi.map((a) => html`<li data-climate-lead-area=${a.area_id}>
              <label for=${`lead-${a.area_id}`} style="flex:1">${a.name}</label>
              <select id=${`lead-${a.area_id}`} data-climate-lead=${a.area_id} ?disabled=${dis} @change=${(e: Event) => this.setLead(a.area_id, (e.target as HTMLSelectElement).value)}>
                <option value="" ?selected=${!this.area.climate_lead[a.area_id]}>הפועל הראשון</option>
                ${a.climate.map((c) => html`<option value=${c.entity_id} ?selected=${this.area.climate_lead[a.area_id] === c.entity_id}>${c.name}</option>`)}
              </select>
            </li>`)}
          </ul>`
        : nothing}
      <div class="row">
        <label><input type="checkbox" data-area-show-empty .checked=${this.area.show_empty} ?disabled=${dis} @change=${(e: Event) => this.emit({ ...this.area, show_empty: (e.target as HTMLInputElement).checked }, this.floor)} /> הצג גם מונים שערכם אפס</label>
      </div>
      <div class="hd" id="are-floor">בכותרת הקומה</div>
      <ul aria-labelledby="are-floor" data-floor-row-items>
        ${this.order(this.floor.items, FLOOR_ITEMS).map((id) => {
          const on = this.floor.items.includes(id);
          const i = this.floor.items.indexOf(id);
          return html`<li class=${on ? '' : 'off'} data-floor-item=${id}>
            <label><input type="checkbox" data-floor-item-on=${id} .checked=${on} ?disabled=${dis} @change=${(e: Event) => this.toggleFloor(id, (e.target as HTMLInputElement).checked)} />${FLOOR_ITEM_LABEL[id]}</label>
            ${on
              ? html`<button type="button" class="ib" data-floor-item-earlier=${id} aria-label=${`הקדם: ${FLOOR_ITEM_LABEL[id]}`} ?disabled=${dis || i === 0} @click=${() => this.emit(this.area, { items: moveItem(this.floor.items, id, -1) })}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
                <button type="button" class="ib" data-floor-item-later=${id} aria-label=${`אחר: ${FLOOR_ITEM_LABEL[id]}`} ?disabled=${dis || i === this.floor.items.length - 1} @click=${() => this.emit(this.area, { items: moveItem(this.floor.items, id, 1) })}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`
              : nothing}
          </li>`;
        })}
      </ul>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'area-row-editor': AreaRowEditor;
  }
}
