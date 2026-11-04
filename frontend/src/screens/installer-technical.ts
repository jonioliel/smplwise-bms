import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-state-panel';
import '../components/wk-installer-confirm';
import type { ConfirmRequest } from '../components/wk-installer-confirm';
import { settingsStyles } from '../styles/settings';
import { installerStyles } from './installer-styles';
import { ApiError } from '../api/client';
import {
  DOOR_FIELDS,
  diffRows,
  doorChanges,
  doorErrors,
  getTechnical,
  needsTyped,
  updateDoor,
  type DoorField,
  type DoorValues,
  type TechnicalDoor,
  type TechnicalView,
} from '../api/installer';
import { fill, installerText as T, technicalText as X } from '../i18n/wiskey-installer';
import { formatTime } from './wiskey-format';

const LOCAL_ZONE = { kind: 'iana' as const, name: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
const showValue = (k: string) => (v: unknown) =>
  v === undefined || v === null ? T.none : k === 'relayReverseEnabled' ? (v ? X.relayOn : X.relayOff) : String(v);

/**
 * WISKEY-INSTALLER-NATIVE-2400 phase 2 - הגדרות › התקנה ותחזוקת מערכת האינטרקום › הגדרות עמדה. Pick a station, read its technical
 * settings from the device (through WisKey), edit a door of its confirmed relay mapping and save: the confirmation shows the change
 * field by field (before / after); a relay-inversion change needs the typed station name; the result is WisKey's readback. The device's
 * capability flags and the PRESENCE of its privilege passwords (never the values) are shown read-only.
 */
@customElement('installer-technical')
export class InstallerTechnical extends LitElement {
  @property({ attribute: false }) stations: { id: string; name: string; online: boolean }[] = [];
  @state() private stationId = '';
  @state() private view: TechnicalView | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private drafts: Record<number, DoorValues> = {};
  @state() private confirm: ConfirmRequest | null = null;
  @state() private flash: { tone: 'ok' | 'warn'; text: string } | null = null;

  static styles = [
    settingsStyles,
    installerStyles,
    css`
      :host {
        display: block;
      }
      .door-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .relay {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
    `,
  ];

  private async load(fresh = false): Promise<void> {
    if (!this.stationId) return;
    this.loading = true;
    this.error = '';
    try {
      this.view = await getTechnical(this.stationId, fresh);
      this.drafts = Object.fromEntries(this.view.report.doors.filter((d) => d.door !== null && d.values).map((d) => [d.door as number, { ...d.values! }]));
    } catch (err) {
      this.view = null;
      this.error = err instanceof ApiError ? err.body.user_message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private pick(id: string): void {
    this.stationId = id;
    this.view = null;
    this.flash = null;
    void this.load();
  }

  private setDraft(door: number, key: DoorField, value: unknown): void {
    this.drafts = { ...this.drafts, [door]: { ...this.drafts[door], [key]: value } };
  }

  private askSave(d: TechnicalDoor): void {
    const v = this.view;
    if (!v || d.door === null || !d.values) return;
    const door = d.door;
    const before = d.values;
    const changes = doorChanges(before, this.drafts[door] ?? {});
    const typed = needsTyped(changes, v.dangerous_fields);
    const name = v.name ?? v.station_id;
    this.confirm = {
      heading: fill(X.saveHeading, { door: fill(X.door, { n: door }), name }),
      body: typed ? `${X.saveBody} ${X.relayWarn}` : X.saveBody,
      diff: diffRows(before as Record<string, unknown>, { ...before, ...changes } as Record<string, unknown>, DOOR_FIELDS).map((r) => ({ ...r, label: X.fields[r.key], show: showValue(r.key) })),
      typed: typed ? v.typed_phrase ?? name : undefined,
      danger: typed,
      maxSeconds: 40,
      send: (t) => updateDoor(v.station_id, door, before, changes, t),
      done: (reply) => {
        const back = (reply as { data: TechnicalDoor }).data;
        const doors = v.report.doors.map((x) => (x.door === door ? back : x));
        this.view = { ...v, report: { ...v.report, doors } };
        this.drafts = { ...this.drafts, [door]: { ...(back.values ?? {}) } };
        this.flash = { tone: 'ok', text: X.saved };
      },
    };
  }

  private doorCard(d: TechnicalDoor): TemplateResult {
    const v = this.view!;
    const n = d.door ?? 0;
    if (d.error || !d.values) {
      return html`<sw-card heading=${fill(X.door, { n })} data-door=${n}><div class="msg err" role="alert">${fill(X.doorError, { code: d.error ?? '' })}</div></sw-card>`;
    }
    const editable = v.editable_doors.includes(n) && v.online !== false;
    const draft = this.drafts[n] ?? d.values;
    const errors = doorErrors(draft, d.constraints);
    const changes = doorChanges(d.values, draft);
    const bound = (k: DoorField) => {
      const c = d.constraints?.[k];
      if (!c || c.type === 'boolean') return '';
      return fill(k === 'doorName' ? X.lengthBounds : X.bounds, { min: c.min, max: c.max });
    };
    return html`<sw-card heading=${fill(X.door, { n })} data-door=${n} data-editable=${editable ? 'true' : 'false'}>
      ${!v.editable_doors.includes(n) ? html`<div class="hint">${X.notMapped}</div>` : nothing}
      <div class="grid2">
        ${d.values.doorName !== undefined
          ? html`<label class="f"><span>${X.fields.doorName}</span>
              <input dir="auto" .value=${String(draft.doorName ?? '')} ?disabled=${!editable} aria-invalid=${errors.includes('doorName') ? 'true' : 'false'} data-field="doorName"
                @input=${(e: Event) => this.setDraft(n, 'doorName', (e.target as HTMLInputElement).value)} />
              <span class="muted">${bound('doorName')}</span>${errors.includes('doorName') ? html`<span class="field-error">${X.invalid}</span>` : nothing}</label>`
          : nothing}
        ${d.values.openDuration !== undefined
          ? html`<label class="f"><span>${X.fields.openDuration}</span>
              <input inputmode="numeric" dir="ltr" .value=${String(draft.openDuration ?? '')} ?disabled=${!editable} aria-invalid=${errors.includes('openDuration') ? 'true' : 'false'} data-field="openDuration"
                @input=${(e: Event) => {
                  const raw = (e.target as HTMLInputElement).value.trim();
                  this.setDraft(n, 'openDuration', raw === '' ? NaN : Number(raw));
                }} />
              <span class="muted">${bound('openDuration')}</span>${errors.includes('openDuration') ? html`<span class="field-error">${X.invalid}</span>` : nothing}</label>`
          : nothing}
      </div>
      ${d.values.relayReverseEnabled !== undefined
        ? html`<div class="relay">
            <label class="opt"><input type="checkbox" .checked=${!!draft.relayReverseEnabled} ?disabled=${!editable} data-field="relayReverseEnabled"
              @change=${(e: Event) => this.setDraft(n, 'relayReverseEnabled', (e.target as HTMLInputElement).checked)} />
              <span>${X.fields.relayReverseEnabled}: <b>${draft.relayReverseEnabled ? X.relayOn : X.relayOff}</b></span></label>
            ${draft.relayReverseEnabled !== d.values.relayReverseEnabled ? html`<div class="msg warn" role="status">${X.relayWarn}</div>` : nothing}
          </div>`
        : nothing}
      ${editable
        ? html`<div class="foot"><sw-button variant="primary" ?disabled=${Object.keys(changes).length === 0 || errors.length > 0} @click=${() => this.askSave(d)} data-door-save>${X.save}</sw-button></div>`
        : nothing}
    </sw-card>`;
  }

  private factsCard(): TemplateResult {
    const r = this.view!.report;
    const pw = r.passwords;
    return html`<sw-card heading=${X.relays} data-relays>
        ${r.relay_selection.length
          ? html`<div class="list">${r.relay_selection.map((x) => html`<div class="item"><span>${fill(X.relayRow, { physical: x.physical_index, api: x.api_id })}${x.name ? html` · <b dir="auto">${x.name}</b>` : nothing}</span></div>`)}</div>`
          : html`<div class="hint">${X.noRelays}</div>`}
      </sw-card>
      <sw-card heading=${X.passwords} data-passwords>
        ${pw
          ? html`<div class="check"><span>${X.pinState[pw.public_pin_state ?? 'unknown'] ?? pw.public_pin_state}</span></div>
              ${Object.entries(X.passwordNames).map(([k, label]) =>
                pw.states[k] === null || pw.states[k] === undefined ? nothing : html`<div class="check"><span>${label}</span><span class="val">${pw.states[k] ? X.set : X.unset}</span></div>`,
              )}`
          : html`<div class="hint">${r.password_error ? fill(X.doorError, { code: r.password_error }) : T.none}</div>`}
      </sw-card>
      <sw-card heading=${X.features} data-features>
        <details><summary>${r.features.filter((f) => f.supported).length} / ${r.features.length}</summary>
          <div class="facts">${r.features.map((f) => html`<sw-badge kind=${f.supported ? 'live' : 'neutral'} label=${f.name}></sw-badge>`)}</div>
        </details>
      </sw-card>`;
  }

  render(): TemplateResult {
    const v = this.view;
    return html`<div class="sections" data-technical=${this.loading ? 'loading' : v ? 'ready' : this.error ? 'error' : 'empty'}>
      <sw-card>
        <div class="pickrow">
          <label class="f"><span>${X.pick}</span>
            <select class="pick" .value=${this.stationId} @change=${(e: Event) => this.pick((e.target as HTMLSelectElement).value)} data-station-pick>
              <option value="" ?selected=${!this.stationId}>—</option>
              ${this.stations.map((s) => html`<option value=${s.id} ?selected=${s.id === this.stationId}>${s.name}${s.online ? '' : ` (${T.offline})`}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.stationId || this.loading} @click=${() => void this.load(true)} data-reread>${v ? X.reread : X.read}</sw-button>
        </div>
        <div class="hint">${v?.fetched_at ? fill(X.readAt, { at: formatTime(v.report.checked_at ?? v.fetched_at, 'he-IL', LOCAL_ZONE) }) : X.pickHint}</div>
      </sw-card>
      ${this.flash ? html`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>` : nothing}
      ${this.loading ? html`<sw-state-panel state="loading" heading=${T.loading} compact></sw-state-panel>` : nothing}
      ${!this.loading && this.error
        ? html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${this.error} actionLabel=${T.retry} @action=${() => void this.load(true)} compact></sw-state-panel>`
        : nothing}
      ${!this.loading && !v && !this.error ? html`<sw-state-panel state="empty" heading=${X.empty} compact></sw-state-panel>` : nothing}
      ${!this.loading && v
        ? html`${v.online === false ? html`<div class="msg warn" role="status">${X.offline}</div>` : nothing}
            ${v.report.doors.map((d) => this.doorCard(d))}${this.factsCard()}`
        : nothing}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${() => (this.confirm = null)}></wk-installer-confirm>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'installer-technical': InstallerTechnical;
  }
}
