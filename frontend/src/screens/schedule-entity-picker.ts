import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-button';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { CLASS_LABEL, getScheduleCatalog, type CatalogEntity, type ScheduleClass } from '../api/schedules';

/**
 * CR-014 S4: "בחירת התקנים" (mockup 08): the devices a schedule may act on, by room or by type, with multi-select. The list is
 * the server's catalogue (`GET /schedules/catalog`: what the caller may schedule, one source of classes, allow-list, bulk-safe
 * switches and the door / alarm rules); a device that cannot be scheduled is listed with the reason.
 *
 *   confirm {ids, entities}   the chosen set (the editor adds / removes the difference)
 *   close
 */

const CLASS_ICON: Record<ScheduleClass, IconName> = { light: 'light', switch: 'power', cover: 'coverOpen', climate: 'activity', fan: 'aperture', alarm: 'shield', lock: 'lock', door: 'door' };

@customElement('schedule-entity-picker')
export class ScheduleEntityPicker extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** Entity ids already on the schedule. */
  @property({ attribute: false }) selected: string[] = [];
  @state() private entities: CatalogEntity[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private picked = new Set<string>();
  @state() private q = '';
  @state() private by: 'area' | 'class' = 'area';
  private wasOpen = false;

  static styles = css`
    :host {
      display: contents;
    }
    .tools {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-block-end: 10px;
    }
    .search {
      flex: 1;
      position: relative;
    }
    .search input {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 34px;
      padding: 4px 34px 4px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      font: inherit;
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .search input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .search sw-icon {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-start: 9px;
      color: var(--sw-text-3);
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .seg button {
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 4px 12px;
      border-radius: 6px;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .chosen {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 12px;
    }
    .chosen .none {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .chip button {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    h4 {
      display: flex;
      justify-content: space-between;
      margin: 16px 0 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    h4 span {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    label.item {
      display: grid;
      grid-template-columns: 22px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
    }
    label.item.no {
      cursor: not-allowed;
      color: var(--sw-text-3);
    }
    label.item input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
      margin: 0;
    }
    .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .nm small {
      color: var(--sw-text-3);
    }
    .why {
      grid-column: 2 / -1;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .sens {
      color: #6d28d9;
    }
    .state {
      padding: 24px 0;
      text-align: center;
      color: var(--sw-text-3);
    }
    .state.err {
      color: var(--sw-danger);
    }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open && !this.wasOpen) {
      this.picked = new Set(this.selected);
      this.q = '';
      void this.load();
    }
    if (changed.has('open')) this.wasOpen = this.open;
  }

  private async load() {
    this.loading = true;
    this.error = '';
    try {
      this.entities = (await getScheduleCatalog()).entities;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'לא הצלחנו לטעון את ההתקנים.';
    }
    this.loading = false;
  }

  private toggle(id: string) {
    const next = new Set(this.picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.picked = next;
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private confirm() {
    const ids = [...this.picked];
    this.dispatchEvent(new CustomEvent('confirm', { detail: { ids, entities: this.entities.filter((e) => this.picked.has(e.entity_id)) }, bubbles: true, composed: true }));
  }

  private nameOf(id: string) {
    return this.entities.find((e) => e.entity_id === id)?.name ?? id;
  }

  render() {
    const q = this.q.trim().toLowerCase();
    const shown = this.entities.filter((e) => !q || e.name.toLowerCase().includes(q) || (e.area_name ?? '').toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q));
    const groups = new Map<string, CatalogEntity[]>();
    for (const e of shown) {
      const key = this.by === 'area' ? e.area_name ?? 'ללא אזור' : CLASS_LABEL[e.class];
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return html`<sw-drawer modal ?open=${this.open} heading="בחירת התקנים" subheading="התקנים ברשותכם בלבד. התקנים שאינם ניתנים לתזמון מסומנים עם הסיבה." data-entity-picker @close=${this.close}>
      <div class="tools">
        <div class="search"><input type="search" data-picker-search placeholder="חיפוש התקן או אזור" aria-label="חיפוש התקן" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /><sw-icon name="search" size="15"></sw-icon></div>
        <div class="seg" role="group" aria-label="קיבוץ">
          <button type="button" aria-pressed=${this.by === 'area'} @click=${() => (this.by = 'area')}>אזור</button>
          <button type="button" aria-pressed=${this.by === 'class'} data-picker-by-class @click=${() => (this.by = 'class')}>סוג</button>
        </div>
      </div>
      <div class="chosen" data-picker-chosen>
        ${this.picked.size
          ? [...this.picked].map((id) => html`<span class="chip">${this.nameOf(id)}<button type="button" aria-label="הסרת ${this.nameOf(id)}" @click=${() => this.toggle(id)}><sw-icon name="close" size="12"></sw-icon></button></span>`)
          : html`<span class="none">לא נבחר דבר</span>`}
      </div>
      ${this.loading
        ? html`<div class="state">טוען…</div>`
        : this.error
          ? html`<div class="state err">${this.error}</div>`
          : !shown.length
            ? html`<div class="state">לא נמצאו התקנים</div>`
            : [...groups.entries()].map(
                ([name, list]) => html`<h4>${name}<span>${list.length}</span></h4>
                  ${list.map((e) => {
                    const ok = e.selectable || this.picked.has(e.entity_id);
                    return html`<label class="item ${ok ? '' : 'no'}" data-picker-item=${e.entity_id}>
                      <input type="checkbox" ?disabled=${!ok} .checked=${this.picked.has(e.entity_id)} @change=${() => this.toggle(e.entity_id)} />
                      <span class="nm"><sw-icon name=${CLASS_ICON[e.class]} size="16"></sw-icon>${e.name}${this.by === 'class' && e.area_name ? html`<small>${e.area_name}</small>` : nothing}</span>
                      <small class="${e.sensitive ? 'sens' : ''}">${e.sensitive ? html`<sw-icon name="shield" size="12"></sw-icon> ` : nothing}${this.by === 'area' ? CLASS_LABEL[e.class] : ''}</small>
                      ${!e.selectable && e.reason ? html`<span class="why"><sw-icon name="lock" size="12"></sw-icon>${e.reason.message}</span>` : nothing}
                    </label>`;
                  })}`,
              )}
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;inline-size:100%">
        <sw-button data-picker-cancel @click=${this.close}>ביטול</sw-button>
        <sw-button variant="primary" data-picker-ok @click=${this.confirm}>אישור (${this.picked.size})</sw-button>
      </div>
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-entity-picker': ScheduleEntityPicker;
  }
}
