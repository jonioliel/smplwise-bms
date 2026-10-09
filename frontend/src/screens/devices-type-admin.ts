import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { get, post, put, describeError } from '../api/client';
import { parseRoute } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';
import {
  KIND_HE, KIND_ORDER, NO_TYPE_FILTERS, applyTypeFilters, bulkTargets, chunks, confirmQuestion, rangeIds, resultLine, settingLabel, typeFiltersActive,
  type DeviceTypeRow, type FixedKind, type SourceFilter, type TypeFilters, type TypeSetting,
} from './device-types-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const PAGE = 100;

/**
 * הגדרות › חשמל והתקנים › סוגי התקנים (DEVTYPE, owner 2026-10-09): the type of every switch-wired device - a boiler, a tap, a light on a
 * relay. Automatic by default: the server reads the name ("דוד", "ברז", "השקיה" ...). An administrator fixes the type of one device from its
 * row, or of many at once (checkboxes, Shift+click for a range, "בחר הכול" on the filtered list), or returns them to automatic. Search,
 * type / source / floor / area filters. system.configure; the server checks it again on every call. The operator screens say nothing about
 * it - they only show the resulting icon, wording and equipment card. A table on a wide screen, cards with a sticky action bar under 600 px.
 */
@customElement('devices-type-admin')
export class DevicesTypeAdmin extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private rows: DeviceTypeRow[] | null = null;
  @state() private error = '';
  @state() private f: TypeFilters = { ...NO_TYPE_FILTERS };
  @state() private selected = new Set<string>();
  @state() private shown = PAGE;
  @state() private bulkKind: TypeSetting = 'water_heater';
  @state() private confirm: { kind: TypeSetting; ids: string[] } | null = null;
  @state() private busy = false;
  @state() private busyId = '';
  @state() private result = '';
  private last: string | null = null;

  static styles = [css`
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
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    input[type='search'] {
      flex: 1;
      min-inline-size: 180px;
    }
    .note,
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .manual {
      font-weight: var(--sw-fw-semibold);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    td select {
      min-inline-size: 180px;
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
    .err {
      color: var(--sw-danger, #dc2626);
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
        gap: 4px 10px;
        align-items: center;
        padding: 8px 10px;
        border: 1px solid var(--sw-border);
        border-radius: 10px;
        min-block-size: 44px;
      }
      .card .sub {
        grid-column: 2;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .card select {
        grid-column: 2;
        inline-size: 100%;
      }
      .actions.bulk {
        position: sticky;
        inset-block-end: 0;
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        z-index: 1;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load().then(() => {
      if (parseRoute().params.get('section') === 'device-types') requestAnimationFrame(() => this.scrollIntoView({ block: 'start' }));
    });
  }

  private async load() {
    try {
      this.rows = (await get<{ devices: DeviceTypeRow[] }>('devices/device-types')).devices;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private setFilter(patch: Partial<TypeFilters>) {
    this.f = { ...this.f, ...patch };
    this.shown = PAGE;
  }

  /** `on` is the box's state AFTER the native toggle (as the protected-switches list: the click is never cancelled). */
  private toggle(id: string, on: boolean, shift: boolean, list: DeviceTypeRow[]) {
    const next = new Set(this.selected);
    for (const x of shift && this.last ? rangeIds(list, this.last, id) : [id]) (on ? next.add(x) : next.delete(x));
    this.last = id;
    this.selected = next;
  }

  private async chooseOne(r: DeviceTypeRow, kind: TypeSetting) {
    this.busyId = r.entity_id;
    try {
      await put(`devices/entities/${encodeURIComponent(r.entity_id)}/device-type`, { kind });
      this.result = '';
      await this.load();
    } catch (err) {
      this.result = describeError(err);
      await this.load();
    } finally {
      this.busyId = '';
    }
  }

  private async apply() {
    const c = this.confirm;
    if (!c) return;
    this.busy = true;
    try {
      let changed = 0;
      let refused = 0;
      for (const part of chunks(c.ids)) {
        const r = await post<{ changed: number; refused: number }>('devices/device-types', { entity_ids: part, kind: c.kind });
        changed += r.changed;
        refused += r.refused;
      }
      this.result = resultLine(c.kind, changed, refused);
      this.selected = new Set();
    } catch (err) {
      this.result = describeError(err);
    } finally {
      this.confirm = null;
      this.busy = false;
      await this.load();
    }
  }

  private typeSelect(r: DeviceTypeRow) {
    return html`<select data-type-select=${r.entity_id} aria-label=${`סוג ${r.name}`} ?disabled=${this.busyId === r.entity_id || this.busy}
      @change=${(e: Event) => void this.chooseOne(r, (e.target as HTMLSelectElement).value as TypeSetting)}>
      <option value="auto" ?selected=${r.set === null}>אוטומטי (${KIND_HE[r.auto]})</option>
      ${r.options.map((k) => html`<option value=${k} ?selected=${r.set === k}>${KIND_HE[k]}</option>`)}
    </select>`;
  }

  render() {
    const head = 'סוגי התקנים';
    const rows = this.rows;
    if (this.error && !rows) return html`<sw-card heading=${head}><sw-state-panel compact state="error" heading="לא ניתן לטעון את ההתקנים" hint=${this.error}></sw-state-panel></sw-card>`;
    if (!rows) return html`<sw-card heading=${head}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
    const f = this.f;
    const list = applyTypeFilters(rows, f);
    const page = list.slice(0, this.shown);
    const floors = [...new Map(rows.filter((r) => r.floor_id).map((r) => [r.floor_id!, r.floor_name ?? r.floor_id!])).entries()];
    const areas = [...new Map(rows.filter((r) => r.area_id && (!f.floor || r.floor_id === f.floor)).map((r) => [r.area_id!, r.area_name ?? r.area_id!])).entries()];
    const place = (r: DeviceTypeRow) => [r.floor_name, r.area_name].filter(Boolean).join(' › ') || 'ללא שיוך';
    const source = (r: DeviceTypeRow) => {
      if (r.set === null) return html`<span class="muted" data-type-source="auto">אוטומטי</span>`;
      const when = r.set_at ? new Date(r.set_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '';
      return html`<span class="manual" data-type-source="manual">ידני</span>${r.set_by || when ? html`<div class="muted">${[r.set_by, when].filter(Boolean).join(' · ')}</div>` : nothing}`;
    };
    const box = (r: DeviceTypeRow) =>
      html`<input type="checkbox" data-type-row=${r.entity_id} aria-label=${`בחר ${r.name}`} .checked=${this.selected.has(r.entity_id)} @click=${(e: MouseEvent) => this.toggle(r.entity_id, (e.currentTarget as HTMLInputElement).checked, e.shiftKey, list)} />`;
    const target = bulkTargets(rows, this.selected, this.bulkKind);
    const manualCount = rows.filter((r) => r.set !== null).length;
    return html`<sw-card heading=${head} subheading="הסוג של מתג נקבע לפי השם שלו, למשל 'דוד' או 'ברז'. אפשר לקבוע סוג ידנית - הוא קובע את הסמל ואת הכרטיס בחלון הפעילות." data-device-types>
      ${rows.length
        ? html`<div class="bar">
              <input type="search" data-type-search placeholder="חיפוש לפי שם, אזור או מזהה…" aria-label="חיפוש התקנים" .value=${f.q} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value })} />
              <select data-type-filter-kind aria-label="סוג" @change=${(e: Event) => this.setFilter({ kind: (e.target as HTMLSelectElement).value as '' | FixedKind })}>
                <option value="" ?selected=${!f.kind}>כל הסוגים</option>
                ${KIND_ORDER.map((k) => html`<option value=${k} ?selected=${f.kind === k}>${KIND_HE[k]}</option>`)}
              </select>
              <select data-type-filter-source aria-label="מקור" @change=${(e: Event) => this.setFilter({ source: (e.target as HTMLSelectElement).value as SourceFilter })}>
                <option value="" ?selected=${!f.source}>אוטומטי וידני</option>
                <option value="auto" ?selected=${f.source === 'auto'}>אוטומטי</option>
                <option value="manual" ?selected=${f.source === 'manual'}>ידני (${ltrNum(manualCount)})</option>
              </select>
              <select data-type-floor aria-label="קומה" @change=${(e: Event) => this.setFilter({ floor: (e.target as HTMLSelectElement).value, area: '' })}><option value="">כל הקומות</option>${floors.map(([id, n]) => html`<option value=${id} ?selected=${f.floor === id}>${n}</option>`)}</select>
              <select data-type-area aria-label="אזור" @change=${(e: Event) => this.setFilter({ area: (e.target as HTMLSelectElement).value })}><option value="">כל האזורים</option>${areas.map(([id, n]) => html`<option value=${id} ?selected=${f.area === id}>${n}</option>`)}</select>
              ${typeFiltersActive(f) ? html`<sw-button size="sm" variant="ghost" data-type-reset @click=${() => this.setFilter({ ...NO_TYPE_FILTERS })}>נקה סינון</sw-button>` : nothing}
            </div>
            <div class="note" data-type-counts>${list.length === rows.length ? `${ltrNum(rows.length)} התקנים` : `${ltrNum(list.length)} מתוך ${ltrNum(rows.length)} התקנים`}</div>`
        : nothing}
      ${list.length
        ? html`<table>
              <thead><tr><th><span class="muted">בחירה</span></th><th>שם</th><th>קומה › אזור</th><th>סוג</th><th>מקור</th></tr></thead>
              <tbody>${page.map((r) => html`<tr data-entity=${r.entity_id}><td>${box(r)}</td><td>${bidi(r.name)}<div class="muted">${r.entity_id}</div></td><td>${place(r)}</td><td>${this.typeSelect(r)}</td><td>${source(r)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${page.map((r) => html`<div class="card" data-entity=${r.entity_id}>${box(r)}<span>${bidi(r.name)}</span><span class="sub">${place(r)} · ${source(r)}</span>${this.typeSelect(r)}</div>`)}</div>`
        : html`<sw-state-panel compact state="empty" heading=${rows.length ? 'אין התקנים שמתאימים לסינון' : 'אין מתגים'} data-type-empty></sw-state-panel>`}
      ${list.length > this.shown ? html`<sw-button size="sm" data-type-more @click=${() => (this.shown += PAGE)}>הצג עוד (${ltrNum(list.length - this.shown)})</sw-button>` : nothing}
      ${rows.length
        ? html`<div class="actions bulk">
            <span data-type-selected>נבחרו ${ltrNum(this.selected.size)}</span>
            <sw-button size="sm" data-type-all ?disabled=${!list.length} @click=${() => (this.selected = new Set([...this.selected, ...list.map((r) => r.entity_id)]))}>בחר הכול (${ltrNum(list.length)})</sw-button>
            <sw-button size="sm" variant="ghost" data-type-clear ?disabled=${!this.selected.size} @click=${() => (this.selected = new Set())}>נקה בחירה</sw-button>
            <select data-type-bulk-kind aria-label="סוג לנבחרים" @change=${(e: Event) => (this.bulkKind = (e.target as HTMLSelectElement).value as TypeSetting)}>
              ${KIND_ORDER.map((k) => html`<option value=${k} ?selected=${this.bulkKind === k}>${KIND_HE[k]}</option>`)}
              <option value="auto" ?selected=${this.bulkKind === 'auto'}>החזר לאוטומטי</option>
            </select>
            <sw-button size="sm" variant="primary" data-type-bulk-apply ?disabled=${!target.ids.length || this.busy} @click=${() => (this.confirm = { kind: this.bulkKind, ids: target.ids })}>החל על הנבחרים${target.ids.length ? ` (${ltrNum(target.ids.length)})` : ''}</sw-button>
            ${target.skipped ? html`<span class="muted" data-type-skipped>${ltrNum(target.skipped)} לא יכולים לקבל את הסוג הזה</span>` : nothing}
          </div>`
        : nothing}
      ${this.result ? html`<div class="note" role="status" data-type-result>${this.result}</div>` : nothing}
      ${this.confirm ? this.renderConfirm(this.confirm) : nothing}
    </sw-card>`;
  }

  private renderConfirm(c: { kind: TypeSetting; ids: string[] }) {
    return html`<sw-dialog open ?locked=${this.busy} data-type-dialog heading="שינוי סוג" @close=${() => (this.confirm = null)}>
      <div data-type-question>${confirmQuestion(c.kind, c.ids.length)}</div>
      <div class="actions">
        <sw-button data-type-cancel autofocus @click=${() => (this.confirm = null)}>ביטול</sw-button>
        <sw-button variant="primary" data-type-confirm ?disabled=${this.busy} @click=${() => void this.apply()}>${settingLabel(c.kind)} (${ltrNum(c.ids.length)})</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-type-admin': DevicesTypeAdmin;
  }
}
