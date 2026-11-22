import { html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-state-panel';
import { get, put, describeError } from '../api/client';
import { bidi } from '../i18n/bidi';
import { entityLabel, TECH_ID_ATTR } from '../i18n/entity-label';
import { DevicesOverrideAdmin, overrideTableStyles } from './devices-override-admin';
import { tr } from '../i18n/msg/devices';
import type * as Wire from '../api/generated/wire-devices';
import '../components/sw-field';

type ClimateKindSetting = 'auto' | 'ac' | 'heating';

/** GET /devices/climate-kinds (the backend's response model, api/generated/wire-devices.ts), narrowed on purpose to the two groups. */
interface ClimateKindRow extends Omit<Wire.DeviceClimateKindRow, 'kind' | 'auto' | 'set'> {
  kind: 'ac' | 'heating';
  auto: 'ac' | 'heating';
  set: 'ac' | 'heating' | null;
}

const KIND_HE: Record<'ac' | 'heating', string> = { ac: tr('מיזוג'), heating: tr('חימום') };

/**
 * הגדרות › חשמל והתקנים › מיזוג וחימום (owner 2026-09-30): every climate entity with the group it is in - "מיזוג" or
 * "חימום". Automatic by default (an entity whose own modes include none of cool / dry / fan_only cannot cool, so it is
 * heating); an administrator may fix either group per entity. The operator screens say nothing about it.
 */
@customElement('devices-climate-kind-admin')
export class DevicesClimateKindAdmin extends DevicesOverrideAdmin<ClimateKindRow> {
  @state() private busyId = '';
  protected readonly heading = tr('מיזוג וחימום');

  static styles = [overrideTableStyles, css`
    :host {
      display: block;
    }
    td:first-child {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    select {
      font: inherit;
      font-size: var(--sw-fs-base);
      min-block-size: 38px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .tech {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      user-select: all;
      overflow-wrap: anywhere;
    }
    .err {
      color: var(--sw-danger);
    }
  `];

  protected async fetchRows() {
    return (await get<{ climate: ClimateKindRow[] }>('devices/climate-kinds')).climate;
  }

  private async choose(r: ClimateKindRow, kind: ClimateKindSetting) {
    this.busyId = r.entity_id;
    try {
      await put(`devices/entities/${encodeURIComponent(r.entity_id)}/climate-kind`, { kind });
      this.error = '';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busyId = '';
    }
  }

  render() {
    const heading = this.heading;
    if (this.rows === null && this.error) return this.errorCard(tr('לא ניתן לטעון את התקני האקלים'));
    if (!this.rows) return this.loadingCard();
    if (!this.rows.length) return nothing;
    return html`<sw-card heading=${heading} subheading=${tr('התקן שאינו יכול לקרר (אין לו מצב קירור, ייבוש או מאוורר) נספר כחימום. אפשר לקבוע ידנית לכל התקן.')} data-climate-kind-admin>
      <table>
        <thead><tr><th>${tr('שם')}</th><th>${tr('אזור')}</th><th>${tr('סוג')}</th></tr></thead>
        <tbody>${this.rows.map(
          (r) => html`<tr data-entity=${r.entity_id}>
            <td>${bidi(entityLabel(r))}<div class="muted tech" ${TECH_ID_ATTR} dir="ltr" title=${tr('מזהה טכני (להעתקה)')}>${r.entity_id}</div></td>
            <td>${r.area_name ?? tr('ללא שיוך')}</td>
            <td><sw-field flow><select data-climate-kind=${r.entity_id} aria-label=${tr('סוג {name}', { name: entityLabel(r) })} ?disabled=${this.busyId === r.entity_id} @change=${(e: Event) => void this.choose(r, (e.target as HTMLSelectElement).value as ClimateKindSetting)}>
              <option value="auto" ?selected=${r.set === null}>${tr('אוטומטי ({type})', { type: KIND_HE[r.auto] })}</option>
              <option value="ac" ?selected=${r.set === 'ac'}>${tr('מיזוג')}</option>
              <option value="heating" ?selected=${r.set === 'heating'}>${tr('חימום')}</option>
            </select></sw-field></td>
          </tr>`,
        )}</tbody>
      </table>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-climate-kind-admin': DevicesClimateKindAdmin;
  }
}
