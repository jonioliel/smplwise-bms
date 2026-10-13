import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type AdminDepartment, type SlaPatch, type SlaRow } from '../api/tickets';
import { SLA_COUNTERS, SLA_THRESHOLDS, slaRowChanges, splitMinutes, type DurationUnit, type SlaCounter, type SlaThreshold } from './durations';
import { ticketSettingsCss } from './settings-styles';
import { tt, type TicketTextKey } from './text';

type Draft = Partial<Record<SlaThreshold, { raw: string; unit: DurationUnit }> & Record<SlaCounter, string>>;
const UNITS: DurationUnit[] = ['min', 'h', 'd'];

/**
 * CR-038 slice 2: the SLA grid of one department (section 13.1, D11) - every threshold of every priority, in minutes on the wire and a
 * value + unit here (an empty cell = the threshold is off), plus the two reminder counters. One save sends the changed rows; the server
 * takes all or nothing (422 field problems / 409 `sla_stale` when another editor saved first, then the grid reloads). A table on a wide
 * screen, one card per priority on a phone. Emits `dept-changed` with the department the server returned.
 */
@customElement('tickets-sla-grid')
export class TicketsSlaGrid extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) dept!: AdminDepartment;
  @property({ type: Boolean }) readonly = false;
  @state() private drafts: Record<string, Draft> = {};
  @state() private busy = false;
  @state() private error = '';

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
  `, bubbleChrome];

  private stored(r: SlaRow): Record<SlaThreshold | SlaCounter, number | null> {
    return Object.fromEntries([...SLA_THRESHOLDS, ...SLA_COUNTERS].map((k) => [k, r[k]])) as Record<SlaThreshold | SlaCounter, number | null>;
  }

  private cell(r: SlaRow, k: SlaThreshold): { raw: string; unit: DurationUnit } {
    const d = this.drafts[r.priority_id]?.[k];
    if (d) return d;
    const split = splitMinutes(r[k]);
    return split ? { raw: String(split.value), unit: split.unit } : { raw: '', unit: k === 'link_unopened_min' || k === 'resolve_within_min' ? 'h' : 'min' };
  }

  private set(r: SlaRow, k: SlaThreshold, patch: Partial<{ raw: string; unit: DurationUnit }>): void {
    const cur = this.cell(r, k);
    this.drafts = { ...this.drafts, [r.priority_id]: { ...this.drafts[r.priority_id], [k]: { ...cur, ...patch } } };
  }

  private setCounter(r: SlaRow, k: SlaCounter, raw: string): void {
    this.drafts = { ...this.drafts, [r.priority_id]: { ...this.drafts[r.priority_id], [k]: raw } };
  }

  private analysis(): { rows: SlaPatch[]; invalid: Set<string> } {
    const rows: SlaPatch[] = [];
    const invalid = new Set<string>();
    for (const r of this.dept.sla) {
      const d = this.drafts[r.priority_id];
      if (!d) continue;
      const { changes, invalid: bad } = slaRowChanges(this.stored(r), d);
      for (const k of bad) invalid.add(`${r.priority_id}:${k}`);
      if (Object.keys(changes).length) rows.push({ priority_id: r.priority_id, revision: r.revision, ...changes });
    }
    return { rows, invalid };
  }

  private async save(): Promise<void> {
    const { rows, invalid } = this.analysis();
    if (invalid.size) {
      this.error = tt('slaInvalid');
      return;
    }
    if (!rows.length || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const dept = await ticketsApi().saveSla(this.dept.id, rows);
      this.drafts = {};
      this.dispatchEvent(new CustomEvent('dept-changed', { detail: { dept, saved: true }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof ApiError && e.status === 409 ? tt('slaStale') : describeError(e);
      if (e instanceof ApiError && e.status === 409) {
        this.drafts = {};
        this.dispatchEvent(new CustomEvent('dept-reload', { bubbles: true, composed: true }));
      }
    } finally {
      this.busy = false;
    }
  }

  private durationInput(r: SlaRow, k: SlaThreshold, invalid: Set<string>): TemplateResult {
    const c = this.cell(r, k);
    const bad = invalid.has(`${r.priority_id}:${k}`);
    const label = `${tt(`sla_${k}` as TicketTextKey)} · ${r.priority_name}`;
    return html`<span class="cell">
      <input class="in" inputmode="numeric" maxlength="6" aria-label=${label} placeholder=${tt('slaOff')} aria-invalid=${String(bad)} ?disabled=${this.readonly || this.busy}
        data-sla=${`${r.priority_key}:${k}`} .value=${c.raw} @input=${(e: Event) => this.set(r, k, { raw: (e.target as HTMLInputElement).value })} />
      <select class="in" aria-label=${`${label} · ${tt('unit_h')}`} ?disabled=${this.readonly || this.busy} data-sla-unit=${`${r.priority_key}:${k}`}
        @change=${(e: Event) => this.set(r, k, { unit: (e.target as HTMLSelectElement).value as DurationUnit })}>
        ${UNITS.map((u) => html`<option value=${u} ?selected=${c.unit === u}>${tt(`unit_${u}` as TicketTextKey)}</option>`)}
      </select></span>`;
  }

  private counterInput(r: SlaRow, k: SlaCounter, invalid: Set<string>): TemplateResult {
    const raw = this.drafts[r.priority_id]?.[k] ?? String(r[k]);
    return html`<input class="in num" inputmode="numeric" maxlength="2" aria-label=${`${tt(`sla_${k}` as TicketTextKey)} · ${r.priority_name}`}
      aria-invalid=${String(invalid.has(`${r.priority_id}:${k}`))} ?disabled=${this.readonly || this.busy} data-sla=${`${r.priority_key}:${k}`} .value=${raw}
      @input=${(e: Event) => this.setCounter(r, k, (e.target as HTMLInputElement).value)} />`;
  }

  render() {
    const { rows, invalid } = this.analysis();
    const dirty = rows.length > 0 || invalid.size > 0;
    const cols = [...SLA_THRESHOLDS, ...SLA_COUNTERS];
    return html`
      <div class="gridwrap" data-sla-grid>
        <table class="sla">
          <thead><tr><th></th>${this.dept.sla.map((r) => html`<th data-sla-col=${r.priority_key}>${r.priority_name}</th>`)}</tr></thead>
          <tbody>${cols.map((k) => html`<tr data-sla-row=${k}>
            <td class="pn">${tt(`sla_${k}` as TicketTextKey)}</td>
            ${this.dept.sla.map((r) => html`<td>${(SLA_COUNTERS as readonly string[]).includes(k) ? this.counterInput(r, k as SlaCounter, invalid) : this.durationInput(r, k as SlaThreshold, invalid)}</td>`)}
          </tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards" data-sla-cards>${this.dept.sla.map((r) => html`<div class="pcard" data-sla-card=${r.priority_key}>
        <h4>${r.priority_name}</h4>
        ${SLA_THRESHOLDS.map((k) => html`<div class="pr"><span>${tt(`sla_${k}` as TicketTextKey)}</span>${this.durationInput(r, k, invalid)}</div>`)}
        ${SLA_COUNTERS.map((k) => html`<div class="pr"><span>${tt(`sla_${k}` as TicketTextKey)}</span>${this.counterInput(r, k, invalid)}</div>`)}
      </div>`)}</div>
      ${this.readonly ? nothing : html`<div class="foot">
        <sw-button variant="primary" size="sm" data-sla-save ?disabled=${!dirty || this.busy} @click=${() => void this.save()}>${tt('save')}</sw-button>
        ${dirty ? html`<sw-button size="sm" variant="ghost" data-sla-cancel ?disabled=${this.busy} @click=${() => { this.drafts = {}; this.error = ''; }}>${tt('cancel')}</sw-button>` : nothing}
        <span class="grow"></span>
        ${this.error ? html`<span class="msg err" role="alert" data-sla-error>${this.error}</span>` : html`<span class="muted">${dirty ? tt('unsaved') : tt('slaEmptyIsOff')}</span>`}
      </div>`}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-sla-grid': TicketsSlaGrid;
  }
}
