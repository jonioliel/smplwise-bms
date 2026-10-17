import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { fmtWhen } from '../api/access';
import { isApi, onRemote } from '../api/session';
import { checkRotation, getTrust, rotateTrustKey, type RotationResult, type RotationRow, type TrustView } from '../api/bridge-trust';
import {
  bridgeLine, canCheck, codeText, openKind, openText, rotateBlockedText, rowLine, seenLine, shortId, stateLabel, stateTone, type Line,
} from '../access-control/bridge-trust-logic';
import { statusStyles } from '../access-control/status-css';
import { failurePanel, skeletonRows } from '../access-control/status-panel';
import { bubbleChrome } from '../styles/bubble-chrome';
import { tt } from '../i18n/bridge-trust';

const when = (iso: string | null): string => fmtWhen(iso);

/** The static preview (no backend): an installation two rotations in, nothing real. */
const DEMO: TrustView = {
  epoch: 3,
  bridge: { paired: true, version: '0.9.1', required: '0.9.1', supported: true, epoch_seen: 3, seen_at: '2026-10-13T09:30:00Z' },
  open: null,
  history: [
    { request_id: '7c0e5a52-6b8f-4f6e-9d1a-2b3c4d5e6f70', initiator: 'מנהל המערכת', epoch_from: 2, epoch_to: 3, state: 'rotated', code: 'rotated', requested_at: '2026-10-13T09:29:58Z', resolved_at: '2026-10-13T09:29:59Z', status_checks: 0 },
    { request_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', initiator: 'מנהל המערכת', epoch_from: 1, epoch_to: 2, state: 'rotated', code: 'status_applied', requested_at: '2026-10-01T07:10:00Z', resolved_at: '2026-10-01T07:11:05Z', status_checks: 1 },
  ],
  can_rotate: true,
  blocked: null,
};

/**
 * CR-040 (WXROT): "מפתח הגשר" - a segment of the Settings page "בקרת כניסה" for holders of `access.trust.rotate` (installation scope). It
 * shows the current key generation (the trust epoch the bridge owns), whether the bridge can rotate and when it last confirmed the
 * generation, the open request if there is one (unknown: "בדיקת מצב"; a bridge that accepts neither key: re-pair), one guarded action
 * "החלפת מפתח…" behind a confirmation that states the atomic switch, the pause and the UNKNOWN rule (an explicit "הבנתי" first), and the
 * last results. Never a key, a salt, a proof or a signature - the server sends none. Local channel only (the remote one answers 404).
 */
@customElement('system-access-trust')
export class SystemAccessTrust extends LitElement {
  /** The page's refresh counter: a change reads the state again. */
  @property({ type: Number }) rev = 0;
  @state() private view: TrustView | null = null;
  @state() private loading = true;
  @state() private failure: 'forbidden' | 'network' | 'error' | null = null;
  @state() private failMessage = '';
  @state() private asking = false;
  @state() private ack = false;
  @state() private busy = '';
  @state() private outcome: { tone: 'info' | 'err' | 'stale'; text: string } | null = null;
  private lastRev = 0;
  private gen = 0;

  static styles = [
    statusStyles,
    css`
      .facts .row {
        min-block-size: max(52px, var(--_t));
      }
      .facts .main .t {
        white-space: normal;
      }
      .note .act {
        flex: none;
      }
      .q {
        margin: 0 0 10px;
        line-height: 1.55;
        color: var(--sw-text);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .q.muted {
        color: var(--sw-text-3);
      }
      label.ack {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: var(--_t);
        cursor: pointer;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      label.ack input {
        inline-size: 20px;
        block-size: 20px;
        margin: 0;
        accent-color: var(--sw-accent);
      }
      .why {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .side .ref {
        color: var(--sw-text-3);
      }
      @media (max-width: 767px) {
        .hist .row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-areas: 'dot main' '. side';
          column-gap: 12px;
          row-gap: 4px;
        }
        .hist .row > .dot {
          grid-area: dot;
        }
        .hist .row > .main {
          grid-area: main;
        }
        .hist .row > .side {
          grid-area: side;
          flex-wrap: wrap;
        }
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('rev') && this.rev !== this.lastRev) {
      this.lastRev = this.rev;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    if (!isApi()) {
      this.view = DEMO;
      this.loading = false;
      return;
    }
    if (onRemote()) {
      this.loading = false;
      return;
    }
    try {
      const v = await getTrust();
      if (gen !== this.gen) return;
      this.view = v;
      this.failure = null;
    } catch (err) {
      if (gen !== this.gen) return;
      this.failure = err instanceof ApiError && err.status === 403 ? 'forbidden' : err instanceof TypeError ? 'network' : 'error';
      this.failMessage = describeError(err);
    } finally {
      if (gen === this.gen) this.loading = false;
    }
  }

  private show(result: RotationResult): void {
    this.view = result.trust;
    if (result.state === 'unknown') {
      this.outcome = null; // the open request's banner says it, with the reason - never twice
      return;
    }
    const tone = result.state === 'not_rotated' ? 'err' : 'info';
    const why = codeText(result.code);
    this.outcome = { tone, text: why && result.state !== 'rotated' ? `${result.message} (${why})` : result.message };
  }

  private open(): void {
    this.ack = false;
    this.outcome = null;
    this.asking = true;
  }

  private async rotate(): Promise<void> {
    if (!this.ack || this.busy) return;
    this.busy = 'rotate';
    try {
      if (!isApi()) {
        this.outcome = { tone: 'info', text: tt('stRotated') };
      } else {
        this.show(await rotateTrustKey());
      }
      this.asking = false;
    } catch (err) {
      this.asking = false;
      this.outcome = { tone: 'err', text: describeError(err) };
      void this.load();
    } finally {
      this.busy = '';
    }
  }

  private async check(row: RotationRow): Promise<void> {
    if (this.busy) return;
    this.busy = 'check';
    this.outcome = null;
    try {
      this.show(await checkRotation(row.request_id));
    } catch (err) {
      this.outcome = { tone: 'err', text: describeError(err) };
      void this.load();
    } finally {
      this.busy = '';
    }
  }

  private fact(label: string, line: Line, attr: string) {
    return html`<div class="row" data-trust-fact=${attr} data-tone=${line.tone}>
      <span class=${`dot ${line.tone}`} aria-hidden="true"></span>
      <div class="main"><span class="s">${label}</span><span class="t">${line.text}</span></div>
    </div>`;
  }

  private historyRow(r: RotationRow) {
    const why = codeText(r.code);
    return html`<div class="row" data-trust-row=${r.request_id} data-state=${r.state}>
      <span class=${`dot ${stateTone(r.state)}`} aria-hidden="true"></span>
      <div class="main">
        <span class="t">${stateLabel(r.state)}${why ? html` <span class="why">· ${why}</span>` : nothing}</span>
        <span class="s wrap">${rowLine(r, when)}</span>
      </div>
      <div class="side">
        ${r.status_checks ? html`<span>${r.status_checks === 1 ? tt('checksOne') : tt('checks', { n: r.status_checks })}</span>` : nothing}
        <span class="ref">${tt('ref', { id: '' })}<span class="ltr mono" data-trust-ref>${shortId(r.request_id)}</span></span>
      </div>
    </div>`;
  }

  private dialog(v: TrustView) {
    if (!this.asking) return nothing;
    return html`<sw-dialog open heading=${tt('confirmTitle')} data-trust-dialog @close=${() => { if (!this.busy) this.asking = false; }}>
      <p class="q">${tt('confirmSwitch', { next: v.epoch + 1 })}</p>
      <p class="q">${tt('confirmPause')}</p>
      <p class="q">${tt('confirmUnknown')}</p>
      <p class="q muted">${tt('confirmRepair')}</p>
      <label class="ack"><input type="checkbox" data-trust-ack .checked=${this.ack} ?disabled=${!!this.busy} @change=${(e: Event) => (this.ack = (e.target as HTMLInputElement).checked)} />${tt('confirmAck')}</label>
      <sw-button slot="footer" variant="ghost" data-trust-cancel ?disabled=${!!this.busy} @click=${() => (this.asking = false)}>${tt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" icon="refresh" data-trust-go ?disabled=${!this.ack || !!this.busy} @click=${() => void this.rotate()}>${this.busy === 'rotate' ? tt('working') : tt('confirmGo')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (isApi() && onRemote()) {
      return html`<div class="stack" data-trust-state="local_only"><sw-state-panel quiet state="forbidden" heading=${tt('localOnly')}></sw-state-panel></div>`;
    }
    if (this.loading) return html`<div class="stack" data-trust-state="loading"><sw-card flush>${skeletonRows(3)}</sw-card></div>`;
    if (!this.view) {
      if (this.failure === 'forbidden') {
        return html`<div class="stack" data-trust-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${tt('forbidden')}></sw-state-panel></div>`;
      }
      return html`<div class="stack" data-trust-state="error">${failurePanel(this.failure === 'network' ? 'network' : 'error', this.failMessage || tt('loadFailed'), () => void this.load())}</div>`;
    }
    const v = this.view;
    const blocked = rotateBlockedText(v);
    const kind = openKind(v.open);
    return html`<div class="stack" data-trust-state="ready">
      <sw-card flush data-trust-card>
        <div class="ch">
          <div><h3>${tt('title')}</h3><div class="sub">${tt('sub')}</div></div>
          <div class="ctl">
            <sw-button variant="primary" icon="refresh" data-trust-rotate ?disabled=${!v.can_rotate || !!this.busy} @click=${() => this.open()}>${tt('rotate')}</sw-button>
          </div>
        </div>
        <div class="list facts">
          ${this.fact(tt('epoch'), { tone: 'ok', text: tt('epochValue', { n: v.epoch }) }, 'epoch')}
          ${this.fact(tt('bridge'), bridgeLine(v), 'bridge')}
          ${this.fact(tt('seen'), seenLine(v, when), 'seen')}
        </div>
        ${blocked && !kind ? html`<div class="empty" data-trust-blocked=${v.blocked ?? ''}><sw-icon name="warning" size=${16}></sw-icon><span>${blocked}</span></div>` : nothing}
      </sw-card>
      ${kind && v.open
        ? html`<div class=${`note ${kind === 'neither' ? 'err' : 'stale'}`} role="status" data-trust-open=${kind}>
            <sw-icon name="warning" size=${16}></sw-icon><span>${openText(kind)}${kind === 'unknown' && codeText(v.open.code) ? ` (${codeText(v.open.code)})` : ''}</span>
            ${canCheck(v.open) ? html`<sw-button class="act" size="sm" icon="refresh" data-trust-check ?disabled=${!!this.busy} @click=${() => void this.check(v.open!)}>${this.busy === 'check' ? tt('checking') : tt('check')}</sw-button>` : nothing}
          </div>`
        : nothing}
      ${this.outcome ? html`<div class=${`note ${this.outcome.tone}`} role="status" data-trust-outcome=${this.outcome.tone}><span>${this.outcome.text}</span></div>` : nothing}
      <sw-card flush data-trust-results>
        <div class="ch"><div><h3>${tt('results')}</h3>${v.history.length ? html`<div class="sub">${tt('resultsSub', { n: v.history.length })}</div>` : nothing}</div></div>
        ${v.history.length
          ? html`<div class="list hist">${v.history.map((r) => this.historyRow(r))}</div>`
          : html`<div class="empty" data-trust-empty><sw-icon name="clock" size=${16}></sw-icon><span>${tt('none')}</span></div>`}
      </sw-card>
      ${this.dialog(v)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-access-trust': SystemAccessTrust;
  }
}
