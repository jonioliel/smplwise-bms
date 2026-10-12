import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import { getStationHealth, getStationHealthHistory, type StationHealth, type StationHealthHistory, type StationHealthHistoryReply, type StationHealthReply, type StatusStation } from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { Resource } from '../access-control/status-feed';
import { failurePanel } from '../access-control/status-panel';
import { age, clockTone, dailyHealth, driftTone, historyTone, streamTone, syncPill, type Tone } from '../access-control/status-logic';
import { ageText, clockText, countsText, driftText, errorText, historyText, modelLine, msText, secondsText, streamText, syncText, timeModeText, yesNo } from '../access-control/status-text';
import { st } from '../i18n/access-status';
import { dateLabel } from '../access-control/events-logic';

const DOT_OF: Record<Tone, string> = { ok: 'ok', warn: 'warn', err: 'err', off: 'off', unk: 'unk' };

/**
 * CR-036 S10: the body of the station-health drawer of the Settings status page - one station's health card (`GET stations/{id}/health`:
 * polling, request times, the access sync worker, the event stream, the clock) and its last seven days (`.../health/history`, one cell
 * per local day: how much of the day it was online). Mounted by `system-access-status` inside a modal `sw-drawer` only while a station
 * is open, so closing the drawer aborts what is in flight. View only: nothing here asks the device (the integration's own health
 * refresh is a device poll and is not offered in this stage).
 * What the card says is what the server sent: a section the integration has nothing for (no event stream, a clock never read) says so
 * in one line; an unknown word is "unknown", never a green dot.
 */
@customElement('system-access-health')
export class SystemAccessHealth extends LitElement {
  @property({ attribute: false }) station: StatusStation | null = null;
  @property({ attribute: false }) zone: DisplayZone = { kind: 'iana', name: 'UTC' };
  /** The page's refresh counter: a change reads both again. */
  @property({ type: Number }) rev = 0;
  /** The page's "now" (a property so the screen and the tests agree on it). */
  @property({ attribute: false }) now: Date = new Date();

  private health: Resource<StationHealth, StationHealthReply> | null = null;
  private history: Resource<StationHealthHistory, StationHealthHistoryReply> | null = null;
  private ctl: AbortController | null = null;
  private loadedFor = '';
  private lastRev = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .sect {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: 0.04em;
      color: var(--sw-text-3);
    }
    dl {
      display: grid;
      grid-template-columns: minmax(96px, 128px) minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .with {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      flex: none;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--sw-unknown);
    }
    .dot.ok {
      background: var(--sw-live);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .dot.err {
      background: var(--sw-danger);
    }
    .dot.off {
      background: var(--sw-offline);
    }
    .none {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 160px;
    }
    .strip {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-inline-size: 0;
    }
    .bar {
      inline-size: 100%;
      block-size: 36px;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
    }
    .day.ok .bar {
      background: var(--sw-live);
    }
    .day.warn .bar {
      background: var(--sw-warning);
    }
    .day.err .bar {
      background: var(--sw-danger);
    }
    .pct {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .dt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
      block-size: 12px;
    }
    .sect.sk-box {
      gap: 10px;
    }
  `;

  protected willUpdate(changed: PropertyValues): void {
    const id = this.station?.id ?? '';
    if (id && (id !== this.loadedFor || (changed.has('rev') && this.rev !== this.lastRev))) {
      const same = id === this.loadedFor;
      this.lastRev = this.rev;
      if (same) {
        void this.health?.reload();
        void this.history?.reload();
      } else {
        this.start(id);
      }
    }
  }

  disconnectedCallback(): void {
    this.stop();
    super.disconnectedCallback();
  }

  private start(id: string): void {
    this.stop();
    this.loadedFor = id;
    this.ctl = new AbortController();
    const signal = this.ctl.signal;
    this.health = new Resource({ fetch: () => getStationHealth(id, signal), pick: (r: StationHealthReply) => r.health, onChange: () => this.requestUpdate() });
    this.history = new Resource({ fetch: () => getStationHealthHistory(id, signal), pick: (r: StationHealthHistoryReply) => r.history, onChange: () => this.requestUpdate() });
    void this.health.reload();
    void this.history.reload();
  }

  private stop(): void {
    this.ctl?.abort();
    this.health?.dispose();
    this.history?.dispose();
    this.health = null;
    this.history = null;
    this.loadedFor = '';
  }

  private row(label: string, value: TemplateResult | string): TemplateResult {
    return html`<dt>${label}</dt><dd>${value}</dd>`;
  }

  private tone(tone: Tone, text: string): TemplateResult {
    return html`<span class="with"><span class="dot ${DOT_OF[tone]}" aria-hidden="true"></span>${text}</span>`;
  }

  private connection(h: StationHealth): TemplateResult {
    const p = h.requests;
    const online = h.online;
    return html`<section class="sect" data-health-section="connection">
      <h4>${st('hdConnection')}</h4>
      <dl>
        ${this.row(st('hdState'), online === null ? '—' : this.tone(online ? 'ok' : 'off', online ? st('hdOnline') : st('hdOffline')))}
        ${this.row(st('hdFirmware'), html`<bdi class="ltr">${modelLine(null, h.firmware) || '—'}</bdi>`)}
        ${this.row(st('hdPollFailures'), h.consecutive_poll_failures === null ? '—' : String(h.consecutive_poll_failures))}
        ${this.row(st('hdRequests'), p.requests === null ? '—' : st('hdRequestsVal', { n: p.requests, f: p.failures ?? 0 }))}
        ${this.row(st('hdLastMs'), msText(p.last_ms))}
        ${this.row(st('hdP95'), msText(p.p95_ms))}
      </dl>
    </section>`;
  }

  private access(h: StationHealth): TemplateResult {
    const a = h.access;
    const pill = syncPill(a.sync_state, true);
    const states = countsText(a.assignment_states, (k) => syncText(syncPill(k, true).word));
    const errors = countsText(a.errors, (k) => errorText(k));
    return html`<section class="sect" data-health-section="sync">
      <h4>${st('hdSync')}</h4>
      <dl>
        ${this.row(st('hdSyncState'), html`<sw-badge kind=${pill.kind} label=${syncText(pill.word)}></sw-badge>`)}
        ${a.last_error ? this.row(st('colError'), errorText(a.last_error)) : nothing}
        ${this.row(st('hdQueue'), a.queue_depth === null ? '—' : String(a.queue_depth))}
        ${this.row(st('hdWorker'), yesNo(a.worker_active))}
        ${this.row(st('hdPendingRequest'), yesNo(a.pending_request))}
        ${states ? this.row(st('hdAssignments'), states) : nothing}
        ${errors ? this.row(st('hdErrors'), errors) : nothing}
      </dl>
    </section>`;
  }

  private events(h: StationHealth): TemplateResult {
    const e = h.events;
    if (!e) return html`<section class="sect" data-health-section="events"><h4>${st('hdEvents')}</h4><div class="none">${st('hdNoEvents')}</div></section>`;
    return html`<section class="sect" data-health-section="events">
      <h4>${st('hdEvents')}</h4>
      <dl>
        ${this.row(st('hdStream'), this.tone(streamTone(e.stream), streamText(e.stream)))}
        ${this.row(st('hdHistoryState'), this.tone(historyTone(e.history), historyText(e.history)))}
        ${this.row(st('hdReconnects'), e.reconnects === null ? '—' : String(e.reconnects))}
        ${this.row(st('hdLastFrame'), ageText(age(e.last_frame_at, this.now, this.zone)))}
        ${e.storage_failed ? this.row(st('hdStorageFailed'), st('hdYes')) : nothing}
      </dl>
    </section>`;
  }

  private clock(h: StationHealth): TemplateResult {
    const c = h.clock;
    if (!c) return html`<section class="sect" data-health-section="clock"><h4>${st('hdClock')}</h4><div class="none">${st('hdNoClock')}</div></section>`;
    return html`<section class="sect" data-health-section="clock">
      <h4>${st('hdClock')}</h4>
      <dl>
        ${this.row(st('hdClockStatus'), this.tone(clockTone(c.status), clockText(c.status)))}
        ${this.row(st('hdSkew'), secondsText(c.skew_seconds))}
        ${this.row(st('hdDrift'), this.tone(driftTone(c.drift_state), driftText(c.drift_state)))}
        ${this.row(st('hdTimeMode'), timeModeText(c.time_mode))}
        ${this.row(st('hdChecked'), ageText(age(c.checked_at, this.now, this.zone)))}
        ${c.error ? this.row(st('hdClockError'), errorText(c.error)) : nothing}
      </dl>
    </section>`;
  }

  private strip(): TemplateResult {
    const r = this.history;
    const s = r?.snap;
    if (!r || !s || (s.busy && !s.data)) return html`<section class="sect sk-box" data-health-section="history"><h4>${st('hdHistory')}</h4><span class="sk"></span></section>`;
    if (!s.data) return html`<section class="sect" data-health-section="history"><h4>${st('hdHistory')}</h4>${s.failure && s.failure !== 'forbidden' ? failurePanel(s.failure, s.message, () => void r.reload(), true) : nothing}</section>`;
    const days = dailyHealth(s.data.records, this.zone, this.now);
    const any = days.some((d) => d.samples > 0);
    return html`<section class="sect" data-health-section="history">
      <h4>${st('hdHistory')}</h4>
      ${any
        ? html`<div class="strip" data-health-strip>
            ${days.map((d) => {
              const label = `${dateLabel(d.date).replace(/\.\d{4}$/, '')}${d.onlinePct === null ? '' : ` · ${st('hdHistoryPct', { p: d.onlinePct })}`}${d.pollMs === null ? '' : ` · ${msText(d.pollMs)}`}`;
              return html`<div class="day ${d.tone}" role="img" aria-label=${label} title=${label} data-health-day=${d.date}><span class="bar"></span><span class="pct">${d.onlinePct === null ? '—' : `${d.onlinePct}%`}</span><span class="dt">${dateLabel(d.date).replace(/\.\d{4}$/, '')}</span></div>`;
            })}
          </div>`
        : html`<div class="none">${st('hdHistoryNone')}</div>`}
      ${s.data.storage_failed ? html`<div class="none">${st('hdHistoryStorage')}</div>` : nothing}
    </section>`;
  }

  render() {
    const station = this.station;
    if (!station) return nothing;
    const h = this.health;
    const s = h?.snap;
    if (!h || !s || (s.busy && !s.data)) {
      return html`<section class="sect sk-box" data-health-loading aria-busy="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;
    }
    if (!s.data) return html`${s.failure ? failurePanel(s.failure, s.message, () => void h.reload(), true) : nothing}`;
    const stale = h.stale;
    return html`
      ${stale ? html`<div class="note" role="status" data-health-stale><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt ? st('stale', { t: ageText(age(s.fetchedAt, this.now, this.zone)) }) : st('staleNever')}</span></div>` : nothing}
      ${this.connection(s.data)}${this.access(s.data)}${this.events(s.data)}${this.clock(s.data)}${this.strip()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-health': SystemAccessHealth;
  }
}
