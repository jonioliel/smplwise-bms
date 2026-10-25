import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { getListenCapability, listenSocketUrl, newListenRequestId, startListen, stopListen, type ListenCapability } from '../api/station-listen';
import { clock, fill } from '../i18n/wiskey-station-media';
import { slt } from '../i18n/wiskey-station-listen';
import { ListenSession, type ListenDeps } from '../wiskey/listen-session';
import { openSpeaker } from '../wiskey/listen-player';

/**
 * Listening to a station (WKAUDIN-295) in the stations drawer: one button to start and stop, a mute toggle and a level meter. Nothing is
 * offered unless the server says so (`access.station_listen` on, the call permission, a station that can be listened to): while the
 * setting is off the drawer shows no trace of it. The operator can always stop (the button, or leaving the drawer). Read-only toward the
 * station - nothing is sent to it and nothing is recorded (wiskey/listen-session.ts).
 */
@customElement('wk-listen-button')
export class WkListenButton extends LitElement {
  @property() stationId = '';
  /** The feed is live and the station online: nothing is offered on a last-known copy. */
  @property({ type: Boolean }) live = true;
  /** Test seam: replaces the browser effects (api, socket, speaker) and the capability read. */
  @property({ attribute: false }) deps: Partial<ListenDeps> | null = null;
  @property({ attribute: false }) capability: ListenCapability | null = null;

  @state() private tick = 0;
  private session: ListenSession | null = null;
  private timer = 0;
  private loadedFor = '';

  static styles = css`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    /* nothing offered: no box at all, so the drawer's grid keeps no empty row and no gap for it */
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: max(44px, var(--sw-ctl-h, 0px));
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    button.main {
      flex: 1;
    }
    button[aria-pressed='true'] {
      border-color: var(--sw-accent);
    }
    button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .meter {
      block-size: 8px;
      border-radius: 4px;
      background: var(--sw-surface-sunken, var(--sw-border));
      overflow: hidden;
      direction: ltr;
    }
    .meter > i {
      display: block;
      block-size: 100%;
      inline-size: 0;
      background: var(--sw-accent);
    }
    .meter.muted > i {
      opacity: 0.35;
    }
    .msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-muted);
    }
    .msg.problem {
      color: var(--sw-warn, var(--sw-text));
    }
  `;

  private realDeps(): ListenDeps {
    const o = this.deps ?? {};
    return {
      start: o.start ?? ((id, rid) => startListen(id, rid)),
      stop: o.stop ?? ((s) => stopListen(s)),
      socket: o.socket ?? ((p) => new WebSocket(listenSocketUrl(p)) as unknown as ReturnType<ListenDeps['socket']>),
      sink: o.sink ?? (() => openSpeaker()),
      requestId: o.requestId ?? (() => newListenRequestId()),
      now: o.now ?? (() => Date.now()),
      changed: () => {
        this.tick += 1;
        this.syncTimer();
      },
    };
  }

  private ensureSession(): ListenSession {
    if (!this.session || this.session.stationId !== this.stationId) {
      this.session?.dispose();
      this.session = new ListenSession(this.stationId, this.realDeps());
    }
    return this.session;
  }

  private syncTimer(): void {
    const on = this.session?.phase === 'listening';
    if (on && !this.timer) this.timer = window.setInterval(() => (this.tick += 1), 150);
    else if (!on && this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has('stationId') || changed.has('live')) && this.stationId && this.live && !this.deps?.start && this.loadedFor !== this.stationId && !this.capability) {
      this.loadedFor = this.stationId;
      void getListenCapability(this.stationId)
        .then((c) => {
          if (this.loadedFor === this.stationId) this.capability = c;
        })
        .catch(() => undefined); // the drawer simply shows nothing
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.session?.dispose();
    this.session = null;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
  }

  /** Whether anything is shown (the render below); while nothing is, the host is hidden and takes no row or gap in the drawer. */
  private get offered(): boolean {
    const s = this.session;
    const active = s !== null && s.phase !== 'idle';
    return this.live && (active || !!s?.problem || !!this.capability?.available);
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleAttribute('hidden', !this.offered);
  }

  private toggle(): void {
    const s = this.ensureSession();
    if (s.phase === 'idle') void s.start();
    else s.stop();
  }

  render() {
    const s = this.session;
    if (!this.offered) return nothing;
    const t = slt();
    const phase = s?.phase ?? 'idle';
    const left = s?.secondsLeft();
    const level = Math.round((s?.levelNow() ?? 0) * 100);
    const text = phase === 'starting' ? t.starting : phase === 'listening' ? `${t.listening}${left !== null && left !== undefined ? ` · ${fill(t.left, { t: clock(left) })}` : ''}` : '';
    return html`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(phase !== 'idle')} @click=${() => this.toggle()}>
          <sw-icon name=${phase === 'idle' ? 'volume' : 'hangup'} size=${18}></sw-icon>
          ${phase === 'idle' ? t.start : t.stop}
        </button>
        ${phase === 'listening'
          ? html`<button type="button" data-wk-listen-mute aria-pressed=${String(s!.muted)} aria-label=${s!.muted ? t.unmute : t.mute} @click=${() => s!.setMuted(!s!.muted)}>
              ${s!.muted ? t.unmute : t.mute}
            </button>`
          : nothing}
      </div>
      ${phase === 'listening'
        ? html`<div class="meter ${s!.muted ? 'muted' : ''}" role="meter" aria-label=${t.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${level} data-wk-listen-level>
            <i style=${`inline-size:${level}%`}></i>
          </div>`
        : nothing}
      ${text ? html`<div class="msg" data-wk-listen-state>${text}${s?.muted ? ` · ${t.muted}` : ''}</div>` : nothing}
      ${phase === 'idle' && s?.problem ? html`<div class="msg problem" data-wk-listen-problem role="status">${t.problems[s.problem]}</div>` : nothing}
      ${phase === 'idle' && !s?.problem && s?.outcome ? html`<div class="msg" data-wk-listen-ended>${t.ended}</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-listen-button': WkListenButton;
  }
}
