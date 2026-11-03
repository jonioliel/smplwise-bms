import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-state-panel';
import '../components/wk-installer-confirm';
import type { ConfirmRequest } from '../components/wk-installer-confirm';
import { settingsStyles } from '../styles/settings';
import { ApiError } from '../api/client';
import {
  applyHostClock,
  checkStationClock,
  diffRows,
  getClock,
  hasChanges,
  ntpErrors,
  saveClockSettings,
  skewTone,
  syncStationClock,
  type ClockView,
  type StationClock,
  type StationSyncResult,
} from '../api/installer';
import { fill, installerText as T } from '../i18n/wiskey-installer';
import { formatTime } from './wiskey-format';

const LOCAL_ZONE = { kind: 'iana' as const, name: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };

const C = T.clock;

/**
 * WISKEY-INSTALLER-NATIVE-2400 phase 1 - הגדרות › התקנה ותחזוקת מערכת האינטרקום › שעון. Three blocks, in the order an installer works:
 * the saved NTP preference (edit, see the change, save), the host's clock (apply the saved server - typed phrase), and the clock of each
 * station (WisKey's last measurement; write the setting to one station - typed station name, up to ~50 s with an honest wait). A block
 * that failed to load says so and the others still work. Nothing is sent without the confirmation dialog.
 */
@customElement('installer-clock')
export class InstallerClock extends LitElement {
  @state() private view: ClockView | null = null;
  @state() private loadState: 'loading' | 'ready' | 'error' = 'loading';
  @state() private loadError = '';
  @state() private draft: { server: string; port: string; interval: string } | null = null;
  @state() private confirm: ConfirmRequest | null = null;
  @state() private flash: { tone: 'ok' | 'err' | 'warn'; text: string } | null = null;
  @state() private checks: Record<string, { busy: boolean; clock: StationClock | null; at: string | null; error: string }> = {};
  @state() private copySystem = false;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
      }
      .form {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
      }
      @media (max-width: 640px) {
        .form {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
        .form label:first-child {
          grid-column: 1 / -1;
        }
      }
      label.f {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      label.f input {
        font: inherit;
        font-size: var(--sw-fs-md);
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
        direction: ltr;
        text-align: start;
      }
      label.f input[aria-invalid='true'] {
        border-color: var(--sw-danger, var(--sw-err));
      }
      .field-error {
        color: var(--sw-danger-text, var(--sw-err));
        font-size: var(--sw-fs-xs, var(--sw-fs-sm));
      }
      .stations {
        display: flex;
        flex-direction: column;
      }
      .st {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        padding: 10px 0;
        border-block-end: 1px solid var(--sw-border);
        font-variant-numeric: tabular-nums;
      }
      .st:last-child {
        border-block-end: 0;
      }
      .st.head {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        padding-block: 4px;
      }
      .st .name {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .st .name b {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--sw-fw-semibold);
      }
      .st .acts {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
      .tone-ok {
        color: var(--sw-ok-text, var(--sw-text));
      }
      .tone-warn {
        color: var(--sw-warn-text, var(--sw-text));
      }
      .tone-err {
        color: var(--sw-danger-text, var(--sw-text));
      }
      .muted {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .mlabel {
        display: none;
      }
      @media (max-width: 640px) {
        .st.head {
          display: none;
        }
        .st {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          row-gap: 6px;
        }
        .st .name {
          grid-column: 1 / -1;
        }
        .st .acts {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }
        .mlabel {
          display: inline;
          color: var(--sw-text-3);
          font-size: var(--sw-fs-sm);
          margin-inline-end: 4px;
        }
      }
      .opt {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .opt input {
        margin-block-start: 4px;
        inline-size: 18px;
        block-size: 18px;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.view = await getClock();
      const s = this.view.settings.data;
      this.draft = s ? { server: s.server ?? '', port: String(s.port ?? ''), interval: String(s.interval ?? '') } : null;
      this.loadState = 'ready';
    } catch (err) {
      this.loadState = 'error';
      this.loadError = err instanceof ApiError ? err.body.user_message : String(err);
    }
  }

  private values(): { server: string; port: number; interval: number } | null {
    if (!this.draft) return null;
    return { server: this.draft.server.trim().toLowerCase(), port: Number(this.draft.port), interval: Number(this.draft.interval) };
  }

  private askSave(): void {
    const s = this.view?.settings.data;
    const v = this.values();
    if (!s || !v || ntpErrors(v).length) return;
    const labels: Record<string, string> = { server: C.server, port: C.port, interval: C.interval };
    const diff = diffRows({ server: s.server, port: s.port, interval: s.interval }, v, ['server', 'port', 'interval']).map((d) => ({ ...d, label: labels[d.key] }));
    this.confirm = {
      heading: C.saveHeading,
      body: C.settingsHint,
      diff,
      maxSeconds: 10,
      send: () => saveClockSettings(s.revision, v),
      done: () => {
        this.flash = { tone: 'ok', text: T.result.completed };
        void this.load();
      },
    };
  }

  private askHost(): void {
    const s = this.view?.settings.data;
    if (!s || !this.view) return;
    this.confirm = {
      heading: C.hostApplyHeading,
      body: fill(C.hostApplyBody, { server: s.server ?? '' }),
      typed: this.view.host_typed_phrase,
      danger: true,
      maxSeconds: 45,
      send: (typed) => applyHostClock(s.revision, typed ?? ''),
      done: () => {
        this.flash = { tone: 'ok', text: fill(C.hostApplied, { server: s.server ?? '' }) };
        void this.load();
      },
    };
  }

  private async check(id: string): Promise<void> {
    this.checks = { ...this.checks, [id]: { busy: true, clock: this.checks[id]?.clock ?? null, at: null, error: '' } };
    try {
      const r = await checkStationClock(id);
      this.checks = { ...this.checks, [id]: { busy: false, clock: r.clock, at: r.fetched_at, error: '' } };
    } catch (err) {
      this.checks = { ...this.checks, [id]: { busy: false, clock: null, at: null, error: err instanceof ApiError ? err.body.user_message : String(err) } };
    }
  }

  private askSync(st: { id: string; name: string }): void {
    const s = this.view?.settings.data;
    if (!s) return;
    this.copySystem = false;
    this.confirm = {
      heading: fill(C.syncHeading, { name: st.name }),
      body: fill(C.syncBody, { server: s.server ?? '', port: s.port ?? '', interval: s.interval ?? '' }),
      typed: st.name,
      danger: true,
      maxSeconds: 55,
      extra: () => html`<label class="opt"><input type="checkbox" .checked=${this.copySystem} @change=${(e: Event) => (this.copySystem = (e.target as HTMLInputElement).checked)} data-copy-system />
        <span>${C.copySystem}</span></label>`,
      send: (typed) => syncStationClock(st.id, s.revision, this.copySystem, typed ?? ''),
      done: (reply) => {
        const d = (reply as { data: StationSyncResult }).data;
        const skew = d.clock?.measurement.estimated_skew_seconds;
        this.flash = {
          tone: d.clock_verified ? 'ok' : 'warn',
          text: fill(C.syncResult, { verified: d.clock_verified ? C.verified : C.notVerified, skew: skew === null || skew === undefined ? T.none : fill(C.skew, { s: skew }) }),
        };
        void this.check(st.id);
      },
    };
  }

  private settingsCard(): TemplateResult {
    const part = this.view!.settings;
    const s = part.data;
    if (!s || !this.draft) {
      return html`<sw-card heading=${C.settingsTitle} data-clock-settings="error"><div class="msg err" role="alert">${fill(C.sectionUnavailable, { message: part.error?.message ?? '' })}</div></sw-card>`;
    }
    const v = this.values()!;
    const bad = ntpErrors(v);
    const changed = hasChanges(diffRows({ server: s.server, port: s.port, interval: s.interval }, v));
    const d = this.view!.defaults;
    const field = (key: 'server' | 'port' | 'interval', label: string, mode: 'text' | 'numeric') =>
      html`<label class="f"><span>${label}</span>
        <input inputmode=${mode} dir="ltr" .value=${this.draft![key]} aria-invalid=${bad.includes(key) ? 'true' : 'false'} data-ntp=${key}
          @input=${(e: Event) => (this.draft = { ...this.draft!, [key]: (e.target as HTMLInputElement).value })} />
        ${bad.includes(key) ? html`<span class="field-error">${C.invalid[key]}</span>` : nothing}</label>`;
    return html`<sw-card heading=${C.settingsTitle} subheading=${fill(C.revision, { r: s.revision })} data-clock-settings="ready">
      <div class="hint">${C.settingsHint}</div>
      <div class="form">${field('server', C.server, 'text')}${field('port', C.port, 'numeric')}${field('interval', C.interval, 'numeric')}</div>
      <div class="hint">${fill(C.defaults, d)}</div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!changed || bad.length > 0} @click=${() => this.askSave()} data-clock-save>${C.save}</sw-button></div>
    </sw-card>`;
  }

  private hostCard(): TemplateResult {
    const part = this.view!.host;
    const h = part.data;
    const s = this.view!.settings.data;
    if (!h) {
      return html`<sw-card heading=${C.hostTitle} data-clock-host="error"><div class="msg err" role="alert">${fill(C.sectionUnavailable, { message: part.error?.message ?? '' })}</div></sw-card>`;
    }
    const portOk = s?.port === 123;
    return html`<sw-card heading=${C.hostTitle} data-clock-host="ready">
      <div class="check"><span>${h.supported ? C.hostSupported : C.hostUnsupported}</span>
        <sw-badge kind=${h.supported ? 'live' : 'offline'} label=${h.supported ? T.yes : T.no}></sw-badge></div>
      ${h.supported
        ? html`<div class="check"><span>${h.synchronized ? C.hostSynced : C.hostNotSynced}</span>
              <sw-badge kind=${h.synchronized ? 'live' : 'stale'} label=${h.synchronized ? T.yes : T.no}></sw-badge></div>
            <div class="check"><span>${C.hostServers}</span><span class="val" dir="ltr">${h.config?.servers.join(', ') || T.none}</span></div>`
        : nothing}
      ${h.supported && !portOk ? html`<div class="hint">${C.hostApplyPort}</div>` : nothing}
      <div class="foot"><sw-button variant="secondary" ?disabled=${!h.supported || !portOk || !s} @click=${() => this.askHost()} data-clock-host-apply>${C.hostApply}</sw-button></div>
    </sw-card>`;
  }

  private stationRow(st: { id: string; name: string; online: boolean; clock: StationClock | null }): TemplateResult {
    const chk = this.checks[st.id];
    const clock = chk?.clock ?? st.clock;
    const skew = clock?.skew_seconds ?? null;
    const tone = skewTone(skew);
    const s = this.view!.settings.data;
    return html`<div class="st" data-station=${st.id} data-tone=${tone}>
      <div class="name"><b dir="auto">${st.name}</b><span class="muted">${st.online ? T.online : T.offline}</span></div>
      <div><span class="mlabel">${C.colSkew}</span><span class="tone-${tone}">${skew === null ? C.noClock : fill(C.skew, { s: skew })}</span></div>
      <div><span class="mlabel">${C.colMode}</span>${clock?.time_mode ? C.modes[clock.time_mode] ?? clock.time_mode : T.none}</div>
      <div><span class="mlabel">${C.colChecked}</span><span class="muted">${clock?.checked_at ? formatTime(clock.checked_at, 'he-IL', LOCAL_ZONE) : T.none}</span>
        ${chk?.error ? html`<div class="field-error" role="alert">${chk.error}</div>` : nothing}</div>
      <div class="acts">
        <sw-button size="sm" variant="ghost" ?disabled=${chk?.busy} @click=${() => void this.check(st.id)} data-clock-check>${C.check}</sw-button>
        <sw-button size="sm" variant="secondary" ?disabled=${!st.online || !s} @click=${() => this.askSync(st)} data-clock-sync>${C.sync}</sw-button>
      </div>
    </div>`;
  }

  private stationsCard(): TemplateResult {
    const list = this.view!.stations;
    return html`<sw-card heading=${C.stationsTitle} data-clock-stations>
      <div class="hint">${C.stationsHint}</div>
      ${!list || list.length === 0
        ? html`<div class="hint">${C.noStations}</div>`
        : html`<div class="stations">
            <div class="st head" aria-hidden="true"><span>${C.colStation}</span><span>${C.colSkew}</span><span>${C.colMode}</span><span>${C.colChecked}</span><span></span></div>
            ${list.map((st) => this.stationRow(st))}
          </div>`}
    </sw-card>`;
  }

  render(): TemplateResult {
    if (this.loadState === 'loading') return html`<sw-state-panel state="loading" heading=${T.loading} compact data-clock="loading"></sw-state-panel>`;
    if (this.loadState === 'error' || !this.view) {
      return html`<sw-state-panel state="error" heading=${T.errorTitle} hint=${this.loadError} actionLabel=${T.retry} @action=${() => void this.load()} data-clock="error"></sw-state-panel>`;
    }
    return html`<div class="sections" data-clock="ready">
      ${this.view.feed !== 'ready' ? html`<div class="msg warn" role="status">${T.feedDown}</div>` : nothing}
      ${this.flash ? html`<div class="msg ${this.flash.tone}" role=${this.flash.tone === 'err' ? 'alert' : 'status'} data-flash>${this.flash.text}</div>` : nothing}
      ${this.settingsCard()}${this.hostCard()}${this.stationsCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${() => (this.confirm = null)}></wk-installer-confirm>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'installer-clock': InstallerClock;
  }
}
