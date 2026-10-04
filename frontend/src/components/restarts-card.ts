import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-card';
import './sw-dialog';
import './sw-icon';
import { get } from '../api/client';
import { can } from '../api/session';
import { classifyRunError, newIdempotencyKey, restartArx, restartPlatform, runFailureRequestText, type RunView } from '../api/system-update-runs';

/** How long the screen waits for Arx to answer again before it asks for a manual start (the same two minutes as the connection banner). */
export const RESTART_WAIT_MS = 120_000;
const POLL_MS = 3_000;
/** A restart that answered too fast to be seen as an outage: the page reloads after this much time anyway. */
const SETTLE_MS = 15_000;

type Which = 'arx' | 'platform';
type Phase = 'idle' | 'confirm' | 'sending' | 'waiting' | 'manual';

/**
 * הגדרות › עדכונים › "הפעלות מחדש" (CR-021 S3 owner answer 9): one card, two buttons - "הפעל מחדש את Arx" and "הפעל מחדש את תשתית
 * המערכת" - sharing one confirmation dialog and one flow. Plain confirmation (no typed word). The platform restart starts a run
 * (the parent shows the status screen, `run-started`); the Arx restart ends this very process, so its outcome is only seen by Arx
 * answering again (the page then reloads) or, after two minutes, a line that asks to start it by hand.
 * "נדרשת הפעלה מחדש של תשתית המערכת" is a quiet row at the top while the server says a restart is needed (bridge or WisKey copied, a flagged release).
 */
@customElement('sw-restarts-card')
export class SwRestartsCard extends LitElement {
  /** The server says the platform needs a restart (holders of system.update only). */
  @property({ type: Boolean }) required = false;
  /** An update or restart run is open: both buttons wait. */
  @property({ type: Boolean }) busy = false;
  @state() private which: Which = 'platform';
  @state() private phase: Phase = 'idle';
  @state() private error = '';
  private key = '';
  private timer = 0;
  private startedAt = 0;
  private sawDown = false;

  static styles = css`
    :host {
      display: block;
    }
    .rows {
      display: grid;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .need {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      color: var(--sw-warning-text, var(--sw-text-2));
      font-weight: var(--sw-fw-semibold);
    }
    .need .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .lbl {
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .msg {
      margin: 0;
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .msg.err {
      color: var(--sw-danger);
    }
    .wait {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
      font-weight: var(--sw-fw-semibold);
    }
    .wait sw-icon {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wait sw-icon {
        animation: none;
      }
    }
    /* touch layouts: every button is a 44 px target (the inner button stretches to the host) */
    @media (max-width: 1100px) {
      sw-button {
        min-block-size: 44px;
      }
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  private ask(w: Which) {
    this.which = w;
    this.error = '';
    this.key = newIdempotencyKey();
    this.phase = 'confirm';
  }

  private cancel() {
    if (this.phase === 'confirm') this.phase = 'idle';
  }

  private async confirm() {
    if (this.phase !== 'confirm') return;
    this.phase = 'sending';
    this.error = '';
    if (this.which === 'platform') {
      try {
        const run = await restartPlatform(this.key);
        this.phase = 'idle';
        this.dispatchEvent(new CustomEvent<RunView>('run-started', { detail: run, bubbles: true, composed: true }));
      } catch (err) {
        this.phase = 'idle';
        this.error = runFailureRequestText(classifyRunError(err), 'restart');
      }
      return;
    }
    try {
      await restartArx();
    } catch (err) {
      const f = classifyRunError(err);
      this.phase = 'idle';
      this.error = runFailureRequestText(f, 'restart');
      return;
    }
    this.phase = 'waiting';
    this.startedAt = Date.now();
    this.sawDown = false;
    this.schedule();
  }

  private schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.poll(), POLL_MS);
  }

  /** Back = `me` answers after it was seen down (or after the settle time, for a restart too quick to be seen). */
  private async poll() {
    const age = Date.now() - this.startedAt;
    try {
      await get('me');
      if (this.sawDown || age > SETTLE_MS) {
        window.location.reload();
        return;
      }
    } catch {
      this.sawDown = true;
    }
    if (age > RESTART_WAIT_MS) {
      this.phase = 'manual';
      return;
    }
    this.schedule();
  }

  private again() {
    this.phase = 'waiting';
    this.startedAt = Date.now();
    this.sawDown = false;
    this.schedule();
  }

  render() {
    const arx = this.which === 'arx';
    const disabled = this.busy || this.phase === 'sending';
    return html`<sw-card heading="הפעלות מחדש" data-restarts-card>
      ${this.required
        ? html`<div class="row" data-restart-required><span class="need"><span class="dot" aria-hidden="true"></span>נדרשת הפעלה מחדש של תשתית המערכת</span></div>`
        : nothing}
      ${this.phase === 'waiting'
        ? html`<div class="wait" role="status" data-restart-phase="waiting"><sw-icon name="refresh" size=${18}></sw-icon>המערכת מופעלת מחדש…</div>`
        : this.phase === 'manual'
          ? html`<div class="row" role="alert" data-restart-phase="manual"><span class="lbl" data-restart-manual>המערכת לא חזרה. הפעילו ידנית.</span><sw-button data-restart-again @click=${() => this.again()}>בדקו שוב</sw-button></div>`
          : html`<div class="rows">
              ${can('system.configure')
                ? html`<div class="row"><span class="lbl">Arx</span><sw-button icon="power" ?disabled=${disabled} data-restart-arx @click=${() => this.ask('arx')}>הפעל מחדש את Arx</sw-button></div>`
                : nothing}
              <div class="row"><span class="lbl">תשתית המערכת</span><sw-button icon="power" variant=${this.required ? 'primary' : 'secondary'} ?disabled=${disabled} data-restart-platform @click=${() => this.ask('platform')}>הפעל מחדש את תשתית המערכת</sw-button></div>
            </div>`}
      ${this.error ? html`<p class="msg err" role="alert" data-restart-error>${this.error}</p>` : nothing}
    </sw-card>
    <sw-dialog ?open=${this.phase === 'confirm'} heading=${arx ? 'להפעיל מחדש את Arx?' : 'להפעיל מחדש את תשתית המערכת?'}
        subheading=${arx ? 'המערכת לא תהיה זמינה לרגעים אחדים' : 'Arx יישאר פעיל, אך התשתית לא תהיה זמינה לכמה דקות'} data-restart-dialog data-restart-which=${this.which} @close=${() => this.cancel()}>
        <div slot="footer">
          <sw-button variant="primary" data-restart-confirm @click=${() => void this.confirm()}>הפעל מחדש</sw-button>
          <sw-button variant="ghost" data-restart-cancel @click=${() => this.cancel()}>ביטול</sw-button>
        </div>
      </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-restarts-card': SwRestartsCard;
  }
}
