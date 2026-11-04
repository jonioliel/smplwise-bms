import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-icon';
import './wk-action-button';
import type { AccessStation } from '../api/access-stations';
import { canAnywhere } from '../api/session';
import { STATION_OPS, bulkTargets, runOnStations, statusText, statusTone, tally, type OpOutcome, type StationOp } from '../api/station-ops';
import { fill } from '../i18n/wiskey-stations';
import { sot } from '../i18n/wiskey-station-ops';

type Step = 'pick' | 'confirm' | 'run';

/**
 * The stations screen's list action for station maintenance (WISKEY-STATION-OPS-2390; mounted in the screen's toolbar with one line):
 * a button "תחזוקה" and its dialog - pick the action (sync now, rescan, health refresh, clock check) and the stations, confirm, then
 * the action is sent to each station ONCE, one after the other, with each station's honest result on its own line (accepted / done /
 * failed with the reason / not sent with the reason / sent with no clear answer). A failure never stops the rest and is never repeated;
 * the dialog cannot be closed while it is sending. Offline stations are left out of the three device reads (a sync may be queued).
 * Shown only to a caller who holds `access.stations.manage` somewhere; the server judges every station again (scope, deny, limits).
 */
@customElement('wk-stations-maintenance')
export class WkStationsMaintenance extends LitElement {
  @property({ attribute: false }) stations: AccessStation[] = [];
  @property({ type: Boolean }) live = true;

  @state() private open = false;
  @state() private step: Step = 'pick';
  @state() private action: StationOp = 'sync';
  @state() private chosen: ReadonlySet<string> = new Set();
  @state() private outcomes: Record<string, OpOutcome> = {};
  @state() private index = 0;
  @state() private busy = false;
  @state() private targets: string[] = [];

  static styles = css`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
    }
    .lbl {
      display: inline;
    }
    @media (max-width: 600px) {
      .lbl {
        display: none;
      }
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .lab {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3h, 14px);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-medium);
    }
    .chip:focus-visible,
    .row:focus-within {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-block-size: 40vh;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: 40px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .row label {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex: 1 1 auto;
      min-inline-size: 0;
      cursor: pointer;
    }
    .row input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    .row .nm {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .st {
      flex: none;
      max-inline-size: 60%;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: end;
      overflow-wrap: anywhere;
    }
    .row .st[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .row .st[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .row .st[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .row[aria-disabled='true'] {
      opacity: 0.6;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tools .sp {
      flex: 1 1 auto;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .sentence {
      margin: 0;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
    }
    .summary {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
  `;

  private allowed(): boolean {
    return canAnywhere('access.stations.manage') && this.stations.length > 0;
  }

  private openDialog(): void {
    this.open = true;
    this.step = 'pick';
    this.outcomes = {};
    this.index = 0;
    this.chosen = new Set(this.stations.map((s) => s.id));
  }

  private close(): void {
    if (this.busy) return;
    this.open = false;
  }

  private toggle(id: string): void {
    const next = new Set(this.chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.chosen = next;
  }

  private async send(): Promise<void> {
    if (this.busy) return;
    this.targets = bulkTargets(this.stations, this.chosen, this.action);
    if (!this.targets.length) return;
    this.step = 'run';
    this.busy = true;
    this.outcomes = Object.fromEntries(this.targets.map((id) => [id, { station_id: id, action: this.action, status: 'sending', code: null, retry_after_s: null, data: null } as OpOutcome]));
    await runOnStations(this.targets, this.action, (o, i) => {
      this.outcomes = { ...this.outcomes, [o.station_id]: o };
      this.index = i + 1;
    });
    this.busy = false;
    this.dispatchEvent(new CustomEvent('stations-op', { detail: Object.values(this.outcomes), bubbles: true, composed: true }));
  }

  protected willUpdate(): void {
    this.hidden = !this.allowed(); // no empty item in the toolbar's flex gap for a caller without the permission
  }

  render() {
    if (!this.allowed()) return nothing;
    const t = sot();
    return html`<wk-action-button icon="wrench" data-wk-maint-list ?disabled=${!this.live} label=${t.listButton} @click=${() => this.openDialog()}><span class="lbl">${t.listButton}</span></wk-action-button>
      ${this.open ? this.renderDialog() : nothing}`;
  }

  private renderDialog() {
    const t = sot();
    const targets = bulkTargets(this.stations, this.chosen, this.action);
    const skipped = this.action !== 'sync' && this.stations.some((s) => this.chosen.has(s.id) && !s.online);
    return html`<sw-dialog open ?locked=${this.busy} heading=${this.step === 'confirm' ? t.confirm[this.action].title : t.listTitle} data-wk-maint-dialog data-step=${this.step}
      @close=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <div class="body">
        ${this.step === 'pick' ? this.renderPick(skipped) : this.step === 'confirm' ? html`<p class="sentence" data-wk-maint-many>${t.actions[this.action]} · ${fill(t.confirm.many, { n: targets.length })}</p>${skipped ? html`<div class="note">${t.bulk.offlineSkipped}</div>` : nothing}` : this.renderRun()}
      </div>
      <div slot="footer">
        ${this.step === 'pick'
          ? html`<wk-action-button data-wk-maint-dialog-cancel @click=${() => this.close()}>${t.confirm.cancel}</wk-action-button>
              <wk-action-button tone="primary" data-wk-maint-next ?disabled=${!targets.length} @click=${() => (this.step = 'confirm')}>${t.bulk.next}</wk-action-button>`
          : this.step === 'confirm'
            ? html`<wk-action-button data-wk-maint-back @click=${() => (this.step = 'pick')}>${t.bulk.back}</wk-action-button>
                <wk-action-button tone="primary" icon="wrench" data-wk-maint-send-many ?disabled=${!this.live || !targets.length} @click=${() => void this.send()}>${t.confirm.send}</wk-action-button>`
            : html`<wk-action-button data-wk-maint-done ?disabled=${this.busy} @click=${() => this.close()}>${t.bulk.close}</wk-action-button>`}
      </div>
    </sw-dialog>`;
  }

  private renderPick(skipped: boolean) {
    const t = sot();
    return html`<div class="lab">${t.bulk.pickAction}</div>
      <div class="chips" role="radiogroup" aria-label=${t.bulk.pickAction}>
        ${STATION_OPS.map(
          (op) => html`<button type="button" class="chip" role="radio" aria-checked=${String(this.action === op)} aria-pressed=${String(this.action === op)} data-wk-maint-action=${op} @click=${() => (this.action = op)}>
            ${t.actions[op]}
          </button>`,
        )}
      </div>
      <div class="tools">
        <span class="lab">${t.bulk.pickStations}</span><span class="sp"></span>
        <span data-wk-maint-count>${fill(t.bulk.selected, { n: this.chosen.size })}</span>
        <wk-action-button tone="quiet" data-wk-maint-all @click=${() => (this.chosen = new Set(this.stations.map((s) => s.id)))}>${t.bulk.all}</wk-action-button>
        <wk-action-button tone="quiet" data-wk-maint-clear @click=${() => (this.chosen = new Set())}>${t.bulk.clear}</wk-action-button>
      </div>
      <div class="list" data-wk-maint-stations>
        ${this.stations.map((s) => {
          const off = !s.online && this.action !== 'sync';
          return html`<div class="row" aria-disabled=${String(off)} data-wk-maint-station=${s.id}>
            <label><input type="checkbox" .checked=${this.chosen.has(s.id)} ?disabled=${off} @change=${() => this.toggle(s.id)} /><span class="nm">${s.name}</span></label>
            ${!s.online ? html`<span class="st">${t.bulk.offline}</span>` : nothing}
          </div>`;
        })}
      </div>
      ${!this.chosen.size ? html`<div class="note" role="status">${t.bulk.noneSelected}</div>` : skipped ? html`<div class="note">${t.bulk.offlineSkipped}</div>` : nothing}`;
  }

  private renderRun() {
    const t = sot();
    const names = new Map(this.stations.map((s) => [s.id, s.name]));
    const list = this.targets.map((id) => this.outcomes[id]).filter(Boolean) as OpOutcome[];
    const done = list.filter((o) => o.status !== 'sending');
    const c = tally(done);
    return html`<div class="summary" role="status" data-wk-maint-progress>
        ${this.busy ? fill(t.bulk.running, { i: Math.min(this.index + 1, this.targets.length), n: this.targets.length }) : fill(t.bulk.summary, { ...c })}
      </div>
      <div class="list" data-wk-maint-results>
        ${list.map(
          (o) => html`<div class="row" data-wk-maint-row=${o.station_id} data-status=${o.status}>
            <span class="nm">${names.get(o.station_id) ?? o.station_id}</span>
            <span class="st" data-tone=${statusTone(o.status)}>${statusText(o.status, o.code, t)}</span>
          </div>`,
        )}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-stations-maintenance': WkStationsMaintenance;
  }
}
