import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-state-panel';
import { get, put, describeError } from '../api/client';
import { bidi } from '../i18n/bidi';
import { entityLabel, TECH_ID_ATTR } from '../i18n/entity-label';

export type ClimateKindSetting = 'auto' | 'ac' | 'heating';

interface ClimateKindRow {
  entity_id: string;
  name: string;
  area_name: string | null;
  state: string | null;
  available: boolean;
  hvac_modes: string[] | null;
  kind: 'ac' | 'heating';
  auto: 'ac' | 'heating';
  set: 'ac' | 'heating' | null;
}

const KIND_HE: Record<'ac' | 'heating', string> = { ac: 'מיזוג', heating: 'חימום' };

/**
 * הגדרות › חשמל והתקנים › מיזוג וחימום (owner 2026-09-30): every climate entity with the group it is in - "מיזוג" or
 * "חימום". Automatic by default (an entity whose own modes include none of cool / dry / fan_only cannot cool, so it is
 * heating); an administrator may fix either group per entity. The operator screens say nothing about it.
 */
@customElement('devices-climate-kind-admin')
export class DevicesClimateKindAdmin extends LitElement {
  @state() private rows: ClimateKindRow[] | null = null;
  @state() private error = '';
  @state() private busyId = '';

  static styles = css`
    :host {
      display: block;
    }
    /* R5-DEVICES-297: the table reads at the base size with a heading row and roomy cells; the name is bold */
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
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.rows = (await get<{ climate: ClimateKindRow[] }>('devices/climate-kinds')).climate;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
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
    const heading = 'מיזוג וחימום';
    if (this.rows === null && this.error) return html`<sw-card heading=${heading}><sw-state-panel compact state="error" heading="לא ניתן לטעון את התקני האקלים" hint=${this.error}></sw-state-panel></sw-card>`;
    if (!this.rows) return html`<sw-card heading=${heading}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
    if (!this.rows.length) return nothing;
    return html`<sw-card heading=${heading} subheading="התקן שאינו יכול לקרר (אין לו מצב קירור, ייבוש או מאוורר) נספר כחימום. אפשר לקבוע ידנית לכל התקן." data-climate-kind-admin>
      <table>
        <thead><tr><th>שם</th><th>אזור</th><th>סוג</th></tr></thead>
        <tbody>${this.rows.map(
          (r) => html`<tr data-entity=${r.entity_id}>
            <td>${bidi(entityLabel(r))}<div class="muted tech" ${TECH_ID_ATTR} dir="ltr" title="מזהה טכני (להעתקה)">${r.entity_id}</div></td>
            <td>${r.area_name ?? 'ללא שיוך'}</td>
            <td><select data-climate-kind=${r.entity_id} aria-label=${`סוג ${entityLabel(r)}`} ?disabled=${this.busyId === r.entity_id} @change=${(e: Event) => void this.choose(r, (e.target as HTMLSelectElement).value as ClimateKindSetting)}>
              <option value="auto" ?selected=${r.set === null}>אוטומטי (${KIND_HE[r.auto]})</option>
              <option value="ac" ?selected=${r.set === 'ac'}>מיזוג</option>
              <option value="heating" ?selected=${r.set === 'heating'}>חימום</option>
            </select></td>
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
