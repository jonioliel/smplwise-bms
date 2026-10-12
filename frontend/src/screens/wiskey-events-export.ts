import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import { ApiError } from '../api/client';
import { exportAccessEventsCsv, type AccessEventFilters, type AccessStationInfo } from '../api/access-events';
import type { DisplayZone } from '../api/intercom';
import { exportFailure, exportFileName, type ExportFailure } from '../access-control/events-logic';
import { UTC_ZONE } from './wiskey-format';
import { ev, type EvKey } from '../i18n/access-events';

const FAILURE_TEXT: Record<ExportFailure, EvKey> = {
  station_required: 'exStationNeeded',
  unsupported: 'exUnsupported',
  unavailable: 'exUnavailable',
  forbidden: 'exForbidden',
  invalid: 'exInvalid',
  other: 'exOther',
};

/** The browser saves `blob` as `name` (an anchor with a download attribute on a short-lived object URL). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * CR-036 S8: the export of the entry log as a CSV file, through `GET /access-control/events/export.csv` (`access.events.export`;
 * audited server-side with the filters and the row count, never a row). The dialog says what the file is, runs the export once per
 * press of its button, and ends in one of three honest states: the file was downloaded (with the server's own row count), the
 * server refused (the reason in plain words), or - for a caller who does not see every station - it asks which station to export,
 * because the server only exports one station at a time for such a caller (422 `intercom_export_station_required`).
 */
@customElement('wiskey-events-export')
export class WiskeyEventsExport extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** The filters of the list as shown (the server's keys). */
  @property({ attribute: false }) filters: AccessEventFilters = {};
  @property({ attribute: false }) stations: AccessStationInfo[] = [];
  @property({ attribute: false }) zone: DisplayZone = UTC_ZONE;
  @state() private phase: 'idle' | 'busy' | 'done' | 'error' = 'idle';
  @state() private needStation = false;
  @state() private station = '';
  @state() private rows: number | null = null;
  @state() private failure: ExportFailure | null = null;
  private ctl: AbortController | null = null;

  static styles = css`
    p {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    p.muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .result {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .result.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    select {
      min-block-size: max(var(--sw-touch-desktop), 44px);
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('open') && this.open) {
      this.phase = 'idle';
      this.needStation = false;
      this.rows = null;
      this.failure = null;
      this.station = this.filters.station_id ?? '';
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ctl?.abort();
  }

  private close() {
    this.ctl?.abort();
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private async go() {
    if (this.phase === 'busy') return;
    this.phase = 'busy';
    this.failure = null;
    this.ctl?.abort();
    const ctl = (this.ctl = new AbortController());
    const filters: AccessEventFilters = { ...this.filters, ...(this.station ? { station_id: this.station } : {}) };
    try {
      const r = await exportAccessEventsCsv(filters, ctl.signal);
      if (ctl.signal.aborted) return;
      saveBlob(r.blob, exportFileName(new Date(), this.zone));
      this.rows = r.rows;
      this.phase = 'done';
    } catch (err) {
      if (ctl.signal.aborted) return;
      const kind: ExportFailure = err instanceof ApiError ? exportFailure(err.status, err.code) : 'other';
      if (kind === 'station_required') this.needStation = true;
      this.failure = kind;
      this.phase = 'error';
    }
  }

  render() {
    const busy = this.phase === 'busy';
    const done = this.phase === 'done';
    return html`<sw-dialog ?open=${this.open} ?locked=${busy} heading=${ev('exTitle')} @close=${(e: Event) => {
      e.stopPropagation(); // the dialog's own close: this element announces it once, below
      this.close();
    }} data-ev-export>
      <p data-ev-export-body>${ev('exBody')}</p>
      <p class="muted" data-ev-export-logged>${ev('exLogged')}</p>
      ${this.needStation
        ? html`<sw-field label=${ev('exStation')}>
            <select data-ev-export-station .value=${this.station} ?disabled=${busy} @change=${(e: Event) => (this.station = (e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${!this.station}>${ev('exStationPick')}</option>
              ${this.stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.station}>${s.name}</option>`)}
            </select>
          </sw-field>`
        : nothing}
      ${done
        ? html`<div class="result ok" role="status" data-ev-export-result="done"><sw-icon name="check" size=${16}></sw-icon>${this.rows === null ? ev('exDoneNoCount') : ev('exDone', { n: this.rows.toLocaleString('he-IL') })}</div>`
        : this.phase === 'error' && this.failure
          ? html`<div class="result warn" role="alert" data-ev-export-result=${this.failure}><sw-icon name="warning" size=${16}></sw-icon>${ev(FAILURE_TEXT[this.failure])}</div>`
          : nothing}
      <div slot="footer" class="foot">
        ${done
          ? html`<sw-button size="lg" variant="primary" data-ev-export-close @click=${() => this.close()}>${ev('exClose')}</sw-button>`
          : html`<sw-button size="lg" variant="primary" icon="download" data-ev-export-go ?disabled=${busy || (this.needStation && !this.station)} @click=${() => void this.go()}>${busy ? ev('exBusy') : ev('exGo')}</sw-button>
              <sw-button size="lg" data-ev-export-cancel ?disabled=${busy} @click=${() => this.close()}>${ev('exCancel')}</sw-button>`}
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-events-export': WiskeyEventsExport;
  }
}
