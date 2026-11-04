import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-dialog';
import './sw-icon';
import './wk-action-button';
import type { AccessStation } from '../api/access-stations';
import { ApiError } from '../api/client';
import { canAnywhere } from '../api/session';
import {
  STATION_OPS,
  authNow,
  authToShow,
  getMaintenance,
  reasonText,
  runOp,
  statusText,
  statusTone,
  stepText,
  type MaintenanceView,
  type OpOutcome,
  type StationOp,
} from '../api/station-ops';
import { fill, ws } from '../i18n/wiskey-stations';
import { sot } from '../i18n/wiskey-station-ops';
import { seenText } from '../screens/wiskey-stations-logic';

const ICON: Record<StationOp, string> = { sync: 'refresh', rescan: 'search', health_refresh: 'activity', clock_refresh: 'clock' };

/**
 * A station's maintenance inside the stations drawer's "טכני" section (WISKEY-STATION-OPS-2390; mounted there with one line): the
 * read-only health detail - last sync, last read from the station, event stream, clock, last error and the sign-in failure
 * (`authentication_failed`: its step and time, also what fails right now) - shown without any confirmation, and four actions - sync
 * now, rescan, health refresh, clock check - each behind a confirmation, run ONCE per click and reported honestly: sending, accepted
 * (the sync is queued), done, failed with the reason, not sent with the reason, or "sent, no clear answer". Nothing runs by itself:
 * the view is read when the drawer opens a station and when the operator asks ("רענון נתונים"), and after an action has answered.
 *
 * What is offered follows the server: an action the caller may not run on this station is not drawn (absence, not greying); a device
 * read on an offline station, a running action and a station in its cool-down are disabled with the reason next to them.
 */
@customElement('wk-station-maintenance')
export class WkStationMaintenance extends LitElement {
  @property({ attribute: false }) station: AccessStation | null = null;
  /** The screen's feed is live (a write is never offered on a stale copy). */
  @property({ type: Boolean }) live = true;

  @state() private view: MaintenanceView | null = null;
  @state() private phase: 'idle' | 'loading' | 'ready' | 'error' | 'hidden' = 'idle';
  @state() private running: StationOp | null = null;
  @state() private asking: StationOp | null = null;
  @state() private results: Partial<Record<StationOp, OpOutcome>> = {};
  @state() private now = Date.now();
  private loadedFor = '';
  private loadedAt = Date.now();
  private seq = 0;
  private timer = 0;

  static styles = css`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-block-start: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      min-block-size: 32px;
    }
    h5 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .kv {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--sw-s-2) var(--sw-s-4);
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .kv dt {
      color: var(--sw-text-3);
    }
    .kv dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .auth {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .auth.bad {
      color: var(--sw-danger-text);
    }
    .sub {
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    code {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .ops {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2);
    }
    .op {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .line {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-block-size: 1.2em;
      overflow-wrap: anywhere;
    }
    .line[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .line[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
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
    @media (max-width: 420px) {
      .ops {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  private mayRead(): boolean {
    return canAnywhere('access.admin.read') || canAnywhere('access.stations.manage');
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.timer = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('station') && this.station && this.station.id !== this.loadedFor) {
      this.loadedFor = this.station.id;
      this.view = null;
      this.results = {};
      this.asking = null;
      if (this.mayRead()) void this.load();
    }
    // an empty block takes no room in the section's flex gap (the section looks exactly as before until there is something to show)
    this.hidden = !this.shown();
  }

  private shown(): boolean {
    return !!this.station && this.mayRead() && (this.phase === 'ready' || this.phase === 'error' || (this.phase === 'loading' && !!this.view));
  }

  private async load(): Promise<void> {
    const id = this.station?.id;
    if (!id) return;
    const mine = ++this.seq;
    this.phase = 'loading';
    try {
      const v = await getMaintenance(id);
      if (mine !== this.seq) return;
      this.view = v;
      this.loadedAt = Date.now();
      this.now = this.loadedAt;
      this.phase = 'ready';
    } catch (err) {
      if (mine !== this.seq) return;
      // a station this caller may not maintain or see (403 / 404): the block is absent, not an error; anything else says so
      this.phase = err instanceof ApiError && (err.status === 403 || err.status === 404) ? 'hidden' : 'error';
    }
  }

  private async run(op: StationOp): Promise<void> {
    const s = this.station;
    if (!s || this.running) return;
    this.asking = null;
    this.running = op;
    this.results = { ...this.results, [op]: { station_id: s.id, action: op, status: 'sending', code: null, retry_after_s: null, data: null } };
    const out = await runOp(s.id, op);
    if (this.station?.id !== s.id) return;
    this.running = null;
    this.results = { ...this.results, [op]: out };
    this.dispatchEvent(new CustomEvent('station-op', { detail: out, bubbles: true, composed: true }));
    await this.load(); // a READ: what the station looks like after the answer (no command is repeated)
  }

  /** Seconds left of the server's cool-down for `op` (as of the last read), counted down with the screen's clock. */
  private cooldownLeft(op: StationOp): number {
    const fromView = this.view?.actions?.[op]?.cooldown_s ?? 0;
    return Math.max(0, Math.ceil(fromView - (this.now - this.loadedAt) / 1000));
  }

  render() {
    const s = this.station;
    // nothing is drawn before the first answer, nor for a station the server keeps from this caller (the section stays as it was)
    if (!s || !this.shown()) return nothing;
    const t = sot();
    return html`<div class="wrap" data-wk-maint=${s.id} data-wk-maint-state=${this.phase}>
      <div class="head">
        <h5><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</h5>
        <wk-action-button tone="quiet" icon="refresh" data-wk-maint-reload ?busy=${this.phase === 'loading'} ?disabled=${this.phase === 'loading'} @click=${() => void this.load()}>${t.refresh}</wk-action-button>
      </div>
      ${this.phase === 'error' && !this.view ? html`<div class="note" role="status" data-wk-maint-error>${t.unavailable}</div>` : nothing}
      ${this.view ? this.renderHealth(s) : nothing} ${this.view ? this.renderOps(s) : nothing} ${this.renderConfirm(s)}
    </div>`;
  }

  private renderHealth(s: AccessStation) {
    const v = this.view!;
    const t = sot();
    if (v.health_hidden) return html`<div class="note" data-wk-maint-hidden>${t.healthHidden}</div>`;
    const zone = s.zone;
    const tech = v.technical;
    const card = v.report?.health ?? null;
    const lastSync = tech?.reconciled_at ?? v.report?.auth?.last_sync_ok_at ?? null;
    const stream = card?.events?.stream ?? tech?.event_status?.stream ?? null;
    const clock = card?.clock ?? tech?.clock ?? null;
    const skew = clock?.skew_seconds;
    const lastError = card?.access?.last_error ?? tech?.last_error ?? null;
    const auth = authToShow(v);
    const now = authNow(v, t);
    const retained = v.report?.auth?.retained ?? 0;
    const when = (iso: string | null | undefined) => seenText(iso, this.now, zone, ws());
    return html`<dl class="kv" data-wk-maint-health>
      <dt>${t.rows.lastSync}</dt>
      <dd data-wk-maint-last-sync><bdi>${lastSync ? when(lastSync) : t.never}</bdi></dd>
      ${tech?.scanned_at ? html`<dt>${t.rows.lastScan}</dt><dd><bdi>${when(tech.scanned_at)}</bdi></dd>` : nothing}
      ${stream ? html`<dt>${t.rows.stream}</dt><dd data-wk-maint-stream=${stream}>${(t.stream as Record<string, string>)[stream] ?? t.stream.unknown}</dd>` : nothing}
      ${clock
        ? html`<dt>${t.rows.clock}</dt><dd data-wk-maint-clock>${skew === null || skew === undefined ? (t.clockStatus as Record<string, string>)[clock.status ?? ''] ?? t.clockStatus.unavailable : Math.abs(skew) <= 2 ? t.clockOk : fill(t.clockSkew, { n: Math.round(skew) })}${clock.checked_at ? html` <span class="sub">· <bdi>${when(clock.checked_at)}</bdi></span>` : nothing}</dd>`
        : nothing}
      ${card && (card.consecutive_poll_failures ?? 0) > 0 ? html`<dt>${t.rows.polls}</dt><dd>${card.consecutive_poll_failures}</dd>` : nothing}
      <dt>${t.rows.lastError}</dt>
      <dd data-wk-maint-last-error>${lastError ? html`${reasonText(lastError, t)}${reasonText(lastError, t) !== lastError ? html` <code>${lastError}</code>` : nothing}` : html`<span class="sub">${t.none}</span>`}</dd>
      <dt>${t.rows.auth}</dt>
      <dd>
        <div class="auth ${auth || now.length ? 'bad' : ''}" data-wk-maint-auth=${auth ? auth.source : 'none'}>
          ${auth
            ? html`<span data-wk-maint-auth-line>${auth.step
                ? fill(t.authLine, { source: t.authSources[auth.source] ?? auth.source, step: stepText(auth.step, t), at: auth.at ? when(auth.at) : t.never })
                : fill(t.authObserved, { source: t.authSources[auth.source] ?? auth.source, at: auth.at ? when(auth.at) : t.never })}</span>${auth.status_code !== null && auth.status_code !== undefined
                ? html`<span class="sub">${fill(t.authCode, { code: `${auth.status_code}${auth.sub_status ? ` / ${auth.sub_status}` : ''}` })}</span>`
                : nothing}`
            : html`<span class="sub">${t.authNone}</span>`}
          ${now.length ? html`<span data-wk-maint-auth-now>${fill(t.authNow, { what: now.join(' · ') })}</span>` : nothing}
          ${retained > 0 ? html`<span class="sub" data-wk-maint-auth-count>${fill(t.authCount, { n: retained })}</span>` : nothing}
        </div>
      </dd>
    </dl>`;
  }

  private renderOps(s: AccessStation) {
    const v = this.view!;
    const t = sot();
    const ops = STATION_OPS.filter((op) => v.actions?.[op]?.allowed);
    if (!ops.length) return nothing;
    const online = v.online ?? s.online;
    return html`${!online ? html`<div class="note" data-wk-maint-offline>${t.offlineHint}</div>` : nothing}
      <div class="ops" data-wk-maint-ops>
        ${ops.map((op) => {
          const needsOnline = v.actions[op].needs_online;
          const cool = this.cooldownLeft(op);
          const busy = this.running === op;
          const disabled = !this.live || !!this.running || (needsOnline && !online) || cool > 0;
          const r = this.results[op];
          const last = v.last_runs?.[op] ?? null;
          const line = r
            ? statusText(r.status, r.code, t)
            : cool > 0
              ? fill(t.cooldown, { n: cool })
              : last
                ? fill(t.lastRun, { status: statusText(last.status, last.code, t), at: seenText(last.at, this.now, s.zone, ws()) })
                : '';
          const tone = r ? statusTone(r.status) : last ? statusTone(last.status) : 'busy';
          return html`<div class="op">
            <wk-action-button icon=${ICON[op]} data-wk-maint-op=${op} ?busy=${busy} ?disabled=${disabled} @click=${() => (this.asking = op)}>${t.actions[op]}</wk-action-button>
            <span class="line" role="status" data-wk-maint-result=${op} data-status=${r?.status ?? last?.status ?? ''} data-tone=${r || last ? tone : ''}>${line}</span>
          </div>`;
        })}
      </div>`;
  }

  private renderConfirm(s: AccessStation) {
    const op = this.asking;
    if (!op) return nothing;
    const t = sot();
    const c = t.confirm[op];
    return html`<sw-dialog open heading=${c.title} data-wk-maint-confirm=${op} @close=${(e: Event) => e.target === e.currentTarget && (this.asking = null)}>
      <p class="sentence" data-wk-maint-sentence>${fill(c.one, { name: s.name })}</p>
      <div slot="footer">
        <wk-action-button data-wk-maint-cancel @click=${() => (this.asking = null)}>${t.confirm.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon=${ICON[op]} data-wk-maint-send ?disabled=${!this.live} @click=${() => void this.run(op)}>${t.confirm.send}</wk-action-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-station-maintenance': WkStationMaintenance;
  }
}
