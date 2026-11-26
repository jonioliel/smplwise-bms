import { html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { toggled } from '../components/sw-toggle';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { get, put, describeError } from '../api/client';
import { bidi, ltrNum } from '../i18n/bidi';
import {
  BULK_ON_SENSITIVE, KIND_HE, KIND_ORDER, NO_TYPE_FILTERS, applyTypeFilters, bulkTargets, chunks, confirmQuestion, rangeIds, resultLine, settingLabel, typeFiltersActive,
  type DeviceTypeRow, type FixedKind, type SourceFilter, type TypeFilters, type TypeSetting,
} from './device-types-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { dayTimeText } from '../api/day-format';
import { DevicesOverrideListAdmin, OVERRIDE_PAGE as PAGE, overrideListStyles, overrideTableStyles } from './devices-override-admin';
import { tr } from '../i18n/msg/devices';

/**
 * הגדרות › חשמל והתקנים › סוגי התקנים (DEVTYPE, owner 2026-10-09): the type of every switch-wired device - a boiler, a tap, a light on a
 * relay. Automatic by default: the server reads the name ("דוד", "ברז", "השקיה" ...). An administrator fixes the type of one device from its
 * row, or of many at once (checkboxes, Shift+click for a range, "בחר הכול" on the filtered list), or returns them to automatic. Search,
 * type / source / floor / area filters. system.configure; the server checks it again on every call. The operator screens say nothing about
 * it - they only show the resulting icon, wording and equipment card. A table on a wide screen, cards with a sticky action bar under 600 px.
 */
@customElement('devices-type-admin')
export class DevicesTypeAdmin extends DevicesOverrideListAdmin<DeviceTypeRow, TypeFilters> {
  readonly bubbleSkin = new SkinController(this);
  @state() protected f: TypeFilters = { ...NO_TYPE_FILTERS };
  @state() private bulkKind: TypeSetting = 'water_heater';
  @state() private confirm: { kind: TypeSetting; ids: string[] } | null = null;
  @state() private busyId = '';
  protected readonly heading = tr('סוגי התקנים');
  protected readonly sections = ['device-types'];
  protected range = rangeIds;
  protected chunk = (ids: readonly string[]) => chunks(ids);

  static styles = [overrideListStyles, overrideTableStyles, css`
    .manual {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-accent-text, var(--sw-text));
    }
    td select {
      min-inline-size: 180px;
    }
    .err {
      color: var(--sw-danger);
    }
    .bulk-on {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-block-start: 4px;
      min-block-size: 32px;
    }
    @media (max-width: 599px) {
      .card {
        gap: 4px 10px;
      }
      .card select,
      .card .bulk-on {
        grid-column: 2;
        inline-size: 100%;
      }
    }
  `, bubbleChrome];

  protected async fetchRows() {
    return (await get<{ devices: DeviceTypeRow[] }>('devices/device-types')).devices;
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
      const { changed, refused } = await this.postChunks('devices/device-types', c.ids, { kind: c.kind });
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

  /** SEC246 L2: include one typed valve / water heater in "הדלק הכל" (default off; system.configure, audited by the server). */
  private async setBulkOn(r: DeviceTypeRow, allowed: boolean) {
    this.busyId = r.entity_id;
    try {
      await put(`devices/entities/${encodeURIComponent(r.entity_id)}/bulk-on`, { allowed });
      this.result = '';
    } catch (err) {
      this.result = describeError(err);
    } finally {
      this.busyId = '';
      await this.load();
    }
  }

  private bulkOn(r: DeviceTypeRow) {
    if (!r.set || !BULK_ON_SENSITIVE.includes(r.set)) return nothing;
    return html`<label class="bulk-on muted"><sw-toggle controlled size="sm" labelHidden in-label label=${tr('לכלול בהדלק הכל')} data-type-bulk-on=${r.entity_id} .checked=${!!r.bulk_on_allowed}
        ?disabled=${this.busyId === r.entity_id || this.busy}
        @change=${(e: Event) => void this.setBulkOn(r, toggled(e))}></sw-toggle>${tr('לכלול בהדלק הכל')}</label>`;
  }

  private typeSelect(r: DeviceTypeRow) {
    return html`<select data-type-select=${r.entity_id} aria-label=${tr('סוג {name}', { name: r.name })} ?disabled=${this.busyId === r.entity_id || this.busy}
      @change=${(e: Event) => void this.chooseOne(r, (e.target as HTMLSelectElement).value as TypeSetting)}>
      <option value="auto" ?selected=${r.set === null}>${tr('אוטומטי ({type})', { type: KIND_HE[r.auto] })}</option>
      ${r.options.map((k) => html`<option value=${k} ?selected=${r.set === k}>${KIND_HE[k]}</option>`)}
    </select>`;
  }

  render() {
    const head = this.heading;
    const rows = this.rows;
    if (this.error && !rows) return this.errorCard(tr('לא ניתן לטעון את ההתקנים'));
    if (!rows) return this.loadingCard();
    const f = this.f;
    const list = applyTypeFilters(rows, f);
    const page = list.slice(0, this.shown);
    const floors = this.floorOptions(rows);
    const areas = this.areaOptions(rows);
    const place = (r: DeviceTypeRow) => this.place(r);
    const source = (r: DeviceTypeRow) => {
      if (r.set === null) return html`<span class="muted" data-type-source="auto">${tr('אוטומטי')}</span>`;
      const when = r.set_at ? dayTimeText(new Date(r.set_at)) : '';
      return html`<span class="manual" data-type-source="manual">${tr('ידני')}</span>${r.set_by || when ? html`<div class="muted">${[r.set_by, when].filter(Boolean).join(' · ')}</div>` : nothing}`;
    };
    const box = (r: DeviceTypeRow) =>
      html`<input type="checkbox" data-type-row=${r.entity_id} aria-label=${tr('בחר {name}', { name: r.name })} .checked=${this.selected.has(r.entity_id)} @click=${(e: MouseEvent) => this.toggle(r.entity_id, (e.currentTarget as HTMLInputElement).checked, e.shiftKey, list)} />`;
    const target = bulkTargets(rows, this.selected, this.bulkKind);
    const manualCount = rows.filter((r) => r.set !== null).length;
    return html`<sw-card heading=${head} subheading=${tr("הסוג של מתג נקבע לפי השם שלו, למשל 'דוד' או 'ברז'. אפשר לקבוע סוג ידנית - הוא קובע את הסמל ואת הכרטיס בחלון הפעילות.")} data-device-types>
      ${rows.length
        ? html`<div class="bar">
              <input type="search" data-type-search placeholder=${tr('חיפוש לפי שם, אזור או מזהה…')} aria-label=${tr('חיפוש התקנים')} .value=${f.q} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value })} />
              <select data-type-filter-kind aria-label=${tr('סוג')} @change=${(e: Event) => this.setFilter({ kind: (e.target as HTMLSelectElement).value as '' | FixedKind })}>
                <option value="" ?selected=${!f.kind}>${tr('כל הסוגים')}</option>
                ${KIND_ORDER.map((k) => html`<option value=${k} ?selected=${f.kind === k}>${KIND_HE[k]}</option>`)}
              </select>
              <select data-type-filter-source aria-label=${tr('מקור')} @change=${(e: Event) => this.setFilter({ source: (e.target as HTMLSelectElement).value as SourceFilter })}>
                <option value="" ?selected=${!f.source}>${tr('אוטומטי וידני')}</option>
                <option value="auto" ?selected=${f.source === 'auto'}>${tr('אוטומטי')}</option>
                <option value="manual" ?selected=${f.source === 'manual'}>${tr('ידני')} (${ltrNum(manualCount)})</option>
              </select>
              <select data-type-floor aria-label=${tr('קומה')} @change=${(e: Event) => this.setFilter({ floor: (e.target as HTMLSelectElement).value, area: '' })}><option value="">${tr('כל הקומות')}</option>${floors.map(([id, n]) => html`<option value=${id} ?selected=${f.floor === id}>${n}</option>`)}</select>
              <select data-type-area aria-label=${tr('אזור')} @change=${(e: Event) => this.setFilter({ area: (e.target as HTMLSelectElement).value })}><option value="">${tr('כל האזורים')}</option>${areas.map(([id, n]) => html`<option value=${id} ?selected=${f.area === id}>${n}</option>`)}</select>
              ${typeFiltersActive(f) ? html`<sw-button size="sm" variant="ghost" data-type-reset @click=${() => this.setFilter({ ...NO_TYPE_FILTERS })}>${tr('נקה סינון')}</sw-button>` : nothing}
            </div>
            <div class="note" data-type-counts>${list.length === rows.length ? tr('{n} התקנים', { n: ltrNum(rows.length) }) : tr('{n} מתוך {total} התקנים', { n: ltrNum(list.length), total: ltrNum(rows.length) })}</div>`
        : nothing}
      ${list.length
        ? html`<table>
              <thead><tr><th><span class="muted">${tr('בחירה')}</span></th><th>${tr('שם')}</th><th>${tr('קומה ‹ אזור')}</th><th>${tr('סוג')}</th><th>${tr('מקור')}</th></tr></thead>
              <tbody>${page.map((r) => html`<tr data-entity=${r.entity_id}><td>${box(r)}</td><td>${bidi(r.name)}<div class="muted">${r.entity_id}</div></td><td>${place(r)}</td><td>${this.typeSelect(r)}${this.bulkOn(r)}</td><td>${source(r)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${page.map((r) => html`<div class="card" data-entity=${r.entity_id}>${box(r)}<span>${bidi(r.name)}</span><span class="sub">${place(r)} · ${source(r)}</span>${this.typeSelect(r)}${this.bulkOn(r)}</div>`)}</div>`
        : html`<sw-state-panel icon=${rows.length ? 'filter' : 'sensor'} compact state="empty" heading=${rows.length ? tr('אין התקנים שמתאימים לסינון') : tr('אין מתגים')} data-type-empty></sw-state-panel>`}
      ${list.length > this.shown ? html`<sw-button size="sm" data-type-more @click=${() => (this.shown += PAGE)}>${tr('הצג עוד')} (${ltrNum(list.length - this.shown)})</sw-button>` : nothing}
      ${rows.length
        ? html`<div class="actions bulk">
            <span data-type-selected>${tr('נבחרו {n}', { n: ltrNum(this.selected.size) })}</span>
            <sw-button size="sm" data-type-all ?disabled=${!list.length} @click=${() => (this.selected = new Set([...this.selected, ...list.map((r) => r.entity_id)]))}>${tr('בחר הכול')} (${ltrNum(list.length)})</sw-button>
            <sw-button size="sm" variant="ghost" data-type-clear ?disabled=${!this.selected.size} @click=${() => (this.selected = new Set())}>${tr('נקה בחירה')}</sw-button>
            <select data-type-bulk-kind aria-label=${tr('סוג לנבחרים')} @change=${(e: Event) => (this.bulkKind = (e.target as HTMLSelectElement).value as TypeSetting)}>
              ${KIND_ORDER.map((k) => html`<option value=${k} ?selected=${this.bulkKind === k}>${KIND_HE[k]}</option>`)}
              <option value="auto" ?selected=${this.bulkKind === 'auto'}>${tr('החזר לאוטומטי')}</option>
            </select>
            <sw-button size="sm" variant="primary" data-type-bulk-apply ?disabled=${!target.ids.length || this.busy} @click=${() => (this.confirm = { kind: this.bulkKind, ids: target.ids })}>${tr('החל על הנבחרים')}${target.ids.length ? ` (${ltrNum(target.ids.length)})` : ''}</sw-button>
            ${target.skipped ? html`<span class="muted" data-type-skipped>${tr('{n} לא יכולים לקבל את הסוג הזה', { n: ltrNum(target.skipped) })}</span>` : nothing}
          </div>`
        : nothing}
      ${this.result ? html`<div class="note" role="status" data-type-result>${this.result}</div>` : nothing}
      ${this.confirm ? this.renderConfirm(this.confirm) : nothing}
    </sw-card>`;
  }

  private renderConfirm(c: { kind: TypeSetting; ids: string[] }) {
    return html`<sw-dialog open ?locked=${this.busy} data-type-dialog heading=${tr('שינוי סוג')} @close=${() => (this.confirm = null)}>
      <div data-type-question>${confirmQuestion(c.kind, c.ids.length)}</div>
      <div class="actions">
        <sw-button data-type-cancel autofocus @click=${() => (this.confirm = null)}>${tr('ביטול')}</sw-button>
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
