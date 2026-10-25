import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import './wk-action-button';
import { newRequestId, startTalk, stopTalk, talkSocketUrl, type StationMediaTalk } from '../api/station-media';
import { clock, fill, smt } from '../i18n/wiskey-station-media';
import { micPermission, openMic } from '../wiskey/talk-mic';
import { TalkSession, type TalkDeps, type TalkProblem } from '../wiskey/talk-session';

/**
 * Two-way talk with a station (CR-036 slice S18; WKF01F02-295, owner 25.10: full duplex, the microphone open for the whole session,
 * not push-to-talk), the native replacement of "talk in the classic panel" when the station's media descriptor offers a talk
 * transport. One click starts the talk: the microphone is asked for and the session opens (wiskey/talk-session.ts: one start request,
 * never retried); the microphone then stays open and the station's sound plays. The same button mutes / unmutes the microphone
 * (visible state, `data-muted`); "end" closes the session explicitly. The live view mutes its own sound for the whole talk (the
 * `talk-floor` event, {held}), so the station is heard once and the video's sound never feeds the microphone.
 *
 * States shown (a short line, no paragraphs): start / opening / microphone open or muted with the time left; a headset hint when the
 * browser did not apply echo cancellation; the microphone blocked, missing, busy, or unavailable on a plain-HTTP page; another
 * operator talking (who is never said); every way a session ends.
 */
@customElement('wk-talk-button')
export class WkTalkButton extends LitElement {
  @property() stationId = '';
  @property({ attribute: false }) talk: StationMediaTalk | null = null;
  /** The feed is live and the station online: nothing is offered on a last-known copy. */
  @property({ type: Boolean }) live = true;
  /** Test seam: replaces the browser effects (api, socket, microphone). */
  @property({ attribute: false }) deps: Partial<TalkDeps> | null = null;

  @state() private tick = 0;
  @state() private mic: 'granted' | 'denied' | 'prompt' | 'unknown' | 'insecure' = 'unknown';
  private session: TalkSession | null = null;
  private timer = 0;

  static styles = css`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    .ptt {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      inline-size: 100%;
      min-block-size: max(56px, var(--sw-ctl-h-lg, 0px)); /* a big press target on every skin and width */
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: none;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .ptt[data-phase='idle']:hover:not(:disabled) {
      background: var(--sw-hover-wash, var(--sw-surface-2));
    }
    .ptt:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .ptt[data-phase='open'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
    }
    .ptt[data-phase='talking'] {
      border-color: var(--sw-danger);
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .ptt[data-phase='starting'] {
      opacity: 0.85;
      cursor: progress;
    }
    .ptt:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .ptt span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: currentColor;
      flex: none;
    }
    .ptt[data-phase='talking'] .dot {
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ptt[data-phase='talking'] .dot {
        animation: none;
      }
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-inline-size: 0;
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    .line {
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .line[data-tone='error'] {
      color: var(--sw-danger-text);
    }
    .left {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void micPermission().then((m) => (this.mic = m));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.session?.dispose();
    this.session = null;
    window.clearInterval(this.timer);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('stationId') && changed.get('stationId') !== undefined) {
      this.session?.dispose();
      this.session = null;
    }
  }

  /** The session of this station (created on first use, with the codec the descriptor offered). */
  private ensure(): TalkSession {
    if (this.session && this.session.stationId === this.stationId) return this.session;
    const t = this.talk;
    const frameBytes = Math.max(80, Math.round(((t?.sample_rate ?? 8000) * (t?.frame_ms ?? 20)) / 1000));
    const base: TalkDeps = {
      start: (id, rid) => startTalk(id, rid),
      stop: (s) => stopTalk(s),
      socket: (path) => new WebSocket(talkSocketUrl(path)) as unknown as ReturnType<TalkDeps['socket']>,
      mic: (codec, bytes, onFrame) => openMic(codec, bytes, onFrame),
      requestId: () => newRequestId(),
      now: () => Date.now(),
      after: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (id) => window.clearTimeout(id),
      changed: () => this.onChange(),
      floor: (held) => this.dispatchEvent(new CustomEvent('talk-floor', { detail: { held, stationId: this.stationId }, bubbles: true, composed: true })),
    };
    this.session = new TalkSession(this.stationId, t?.codec === 'pcma' ? 'pcma' : 'pcmu', frameBytes, { ...base, ...(this.deps ?? {}) });
    return this.session;
  }

  private onChange(): void {
    this.tick += 1;
    const s = this.session;
    window.clearInterval(this.timer);
    if (s && (s.phase === 'open' || s.phase === 'talking')) this.timer = window.setInterval(() => (this.tick += 1), 1000);
    this.dispatchEvent(new CustomEvent('talk-state', { detail: { phase: s?.phase ?? 'idle', problem: s?.problem ?? null, outcome: s?.outcome ?? null }, bubbles: true, composed: true }));
  }

  private blocked(): TalkProblem | null {
    if (this.mic === 'insecure') return 'insecure';
    if (this.mic === 'denied') return 'denied';
    return null;
  }

  /** One button: idle -> start the talk; open session -> mute / unmute the microphone (click, Enter or Space). */
  private activate = (): void => {
    const s = this.ensure();
    if (s.phase === 'idle') void s.start();
    else if (s.phase === 'open' || s.phase === 'talking') s.toggleMute();
  };

  private end(): void {
    this.session?.end();
  }

  render() {
    const t = smt().talk;
    const s = this.session;
    const phase = s?.phase ?? 'idle';
    const busy = !!this.talk?.busy && phase === 'idle';
    const blocked = this.blocked();
    const disabled = !this.live || (phase === 'idle' && (busy || !!blocked));
    const left = s?.secondsLeft() ?? null;
    void this.tick;
    const active = phase === 'open' || phase === 'talking';
    const label = phase === 'talking' ? t.talking : phase === 'starting' ? t.starting : phase === 'open' ? t.muted : t.start;
    const aria = phase === 'talking' ? t.mute : phase === 'open' ? t.unmute : t.start;
    const problem = s?.problem ?? (phase === 'idle' ? blocked : null);
    const line = problem
      ? { tone: problem === 'busy' || problem === 'expired' ? 'warn' : 'error', text: t.problems[problem] }
      : busy
        ? { tone: 'warn', text: t.busy }
        : phase === 'idle' && s?.outcome
          ? { tone: '', text: t.ended }
          : active && s?.echoCancelled === false
            ? { tone: 'warn', text: t.headset }
            : null;
    return html`<button
        type="button"
        class="ptt"
        data-wk-ptt
        data-phase=${phase}
        data-muted=${active ? String(phase === 'open') : nothing}
        aria-pressed=${active ? String(phase === 'open') : nothing}
        aria-label=${aria}
        ?disabled=${disabled}
        @click=${this.activate}
      >
        ${phase === 'talking' ? html`<i class="dot" aria-hidden="true"></i>` : html`<sw-icon name=${phase === 'open' ? 'micOff' : 'mic'} size=${18}></sw-icon>`}<span>${label}</span>
      </button>
      ${line || phase === 'open' || phase === 'talking'
        ? html`<div class="row">
            <span class="line" role="status" aria-live="polite" data-wk-talk-line data-tone=${line?.tone ?? ''} data-problem=${problem ?? ''}
              >${line ? line.text : left !== null ? html`<span class="left" data-wk-talk-left>${fill(t.left, { t: clock(left) })}</span>` : nothing}</span
            >
            ${phase === 'open' || phase === 'talking' ? html`<wk-action-button tone="danger" icon="hangup" data-wk-talk-end @click=${() => this.end()}>${t.end}</wk-action-button>` : nothing}
          </div>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-talk-button': WkTalkButton;
  }
}
