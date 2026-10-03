import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-icon';
import { ApiError, describeError, get } from '../api/client';
import { nvrConnection, restartSystem } from '../api/nvr-connection';
import { can, isApi, onSession, session } from '../api/session';
import type { Me } from '../api/types';

/** The connection form tells the banner that a save / removal just made a restart necessary (it does not wait for the next /me). */
export function announceRestartPending(pending = true) {
  window.dispatchEvent(new CustomEvent('sw-restart-pending', { detail: { pending } }));
}

/** How long the screen waits for the system to come back before it asks for a manual start. */
export const RESTART_WAIT_MS = 120_000;
const POLL_MS = 3_000;

type Phase = 'idle' | 'confirm' | 'waiting' | 'manual';

/**
 * CR-022 section 8 / 11: "נדרשת הפעלה מחדש כדי להחיל את השינוי" + "הפעל מחדש" (a confirmation dialog first). It follows the
 * server's flag (`/me.connection_pending_restart`, system.configure holders only), so it survives a reload and a second
 * administrator sees it. There is no automatic restart. The restart route answers 202 and the process ends, so the outcome
 * is only seen by the system coming back with the flag cleared; when it does not come back in two minutes the line says to
 * start it by hand ("הפעילו ידנית"). Outside the platform's supervision the server answers `restart_manual`: the line then
 * says to restart the service and offers no button.
 */
@customElement('nvr-restart-banner')
export class NvrRestartBanner extends LitElement {
  @state() private pending = false;
  @state() private phase: Phase = 'idle';
  @state() private manualOnly = false;
  @state() private error = '';
  private timer = 0;
  private startedAt = 0;
  private stopSession: (() => void) | null = null;
  private asked = false;

  private readonly onAnnounce = (e: Event) => {
    this.pending = !!(e as CustomEvent<{ pending: boolean }>).detail?.pending && can('system.configure');
    if (this.pending) void this.learnMode();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('sw-restart-pending', this.onAnnounce);
    this.stopSession = onSession(() => {
      const me: Me | null = session.me;
      const next = isApi() && !!me && me.connection_pending_restart === true && can('system.configure');
      if (next !== this.pending && this.phase === 'idle') this.pending = next;
      if (this.pending) void this.learnMode();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('sw-restart-pending', this.onAnnounce);
    this.stopSession?.();
    window.clearTimeout(this.timer);
  }

  /** Whether the restart button can work here (the connection view says `restart: addon | manual`). */
  private async learnMode() {
    if (this.asked) return;
    this.asked = true;
    try {
      this.manualOnly = (await nvrConnection()).restart === 'manual';
    } catch {
      /* the button stays; a refusal on press shows the manual line */
    }
  }

  private async run() {
    this.error = '';
    try {
      await restartSystem();
    } catch (err) {
      this.phase = 'idle';
      if (err instanceof ApiError && err.code === 'restart_manual') this.manualOnly = true;
      else this.error = describeError(err);
      return;
    }
    this.phase = 'waiting';
    this.startedAt = Date.now();
    this.schedule();
  }

  private schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.poll(), POLL_MS);
  }

  /** Back = /me answers and the pending flag is gone (the new process loaded the saved revision). */
  private async poll() {
    try {
      const me = await get<Me>('me');
      if (me.connection_pending_restart !== true) {
        window.location.reload();
        return;
      }
    } catch {
      /* down: the restart is under way */
    }
    if (Date.now() - this.startedAt > RESTART_WAIT_MS) {
      this.phase = 'manual';
      return;
    }
    this.schedule();
  }

  private again() {
    this.phase = 'waiting';
    this.startedAt = Date.now();
    this.schedule();
  }

  render() {
    if (!this.pending && this.phase === 'idle') return nothing;
    if (this.phase === 'waiting') {
      return html`<div class="bar" role="status" data-restart-banner data-restart-phase="waiting"><sw-icon name="refresh" size=${16}></sw-icon><span>המערכת מופעלת מחדש…</span></div>`;
    }
    if (this.phase === 'manual') {
      return html`<div class="bar" role="alert" data-restart-banner data-restart-phase="manual"><sw-icon name="warning" size=${16}></sw-icon><span data-restart-manual>המערכת לא חזרה. הפעילו ידנית.</span>
        <sw-button size="sm" data-restart-again @click=${() => this.again()}>בדקו שוב</sw-button></div>`;
    }
    return html`<div class="bar" role="status" data-restart-banner data-restart-phase="idle"><sw-icon name="warning" size=${16}></sw-icon>
        <span data-restart-text>${this.manualOnly ? 'יש להפעיל מחדש את השירות כדי להחיל את השינוי' : 'נדרשת הפעלה מחדש כדי להחיל את השינוי'}</span>
        ${this.manualOnly ? nothing : html`<sw-button size="sm" variant="primary" data-restart-open @click=${() => (this.phase = 'confirm')}>הפעל מחדש</sw-button>`}
        ${this.error ? html`<span class="err" data-restart-error>${this.error}</span>` : nothing}</div>
      <sw-dialog ?open=${this.phase === 'confirm'} heading="הפעלה מחדש" subheading="המערכת לא תהיה זמינה לרגעים אחדים" data-restart-dialog @close=${() => (this.phase = 'idle')}>
        <div slot="footer"><sw-button variant="primary" data-restart-confirm @click=${() => { this.phase = 'idle'; void this.run(); }}>הפעל מחדש</sw-button><sw-button variant="ghost" @click=${() => (this.phase = 'idle')}>ביטול</sw-button></div>
      </sw-dialog>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin: 12px 24px 0;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .bar span {
      min-inline-size: 0;
    }
    .bar sw-button {
      margin-inline-start: auto;
    }
    .err {
      flex-basis: 100%;
      color: var(--sw-danger-text);
    }
    @media (max-width: 767px) {
      .bar {
        margin: 8px 12px 0;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-restart-banner': NvrRestartBanner;
  }
}
