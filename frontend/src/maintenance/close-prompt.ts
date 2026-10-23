import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { maintApi, type ClosePlan } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import { maintAccess } from './access';
import { fmtDate } from './model';

/** Fired by the tickets API after a request was closed (`api/tickets.ts`); the detail carries the request id. */
export const TICKET_CLOSED_EVENT = 'sw:ticket-closed';

/**
 * Closing the request a plan opened (owner review 24.10): the system ASKS the person who closed it whether to mark the plan done -
 * neither a silent change nor a manual-only flow. Mounted once in the shell; it listens for the closing of a request, asks the server
 * whether that request belongs to a plan the person may mark done (the installation's setting must be "ask" - otherwise the answer is
 * empty and nothing is shown), and shows one dialog. "Yes" marks the plan done for its due date with him as the performer.
 */
@customElement('maint-close-prompt')
export class MaintClosePrompt extends LitElement {
  @state() private ticketId = '';
  @state() private plan: ClosePlan | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private toast = '';

  static styles = css`
    :host { display: contents; }
    .acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; inline-size: 100%; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--sw-r-pill); padding: 8px 16px; min-block-size: 40px; border: 1px solid var(--sw-border); background: var(--sw-surface);
      color: var(--sw-text); font: inherit; font-weight: var(--sw-fw-semibold); cursor: pointer; }
    .btn.pri { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-accent-on, #fff); }
    .btn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .err { color: var(--sw-danger-text); margin-block-start: 8px; }
    .toast { position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 20px); inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw; background: var(--sw-toast-bg);
      color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2); }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(TICKET_CLOSED_EVENT, this.onClosed as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener(TICKET_CLOSED_EVENT, this.onClosed as EventListener);
    super.disconnectedCallback();
  }

  private onClosed = (e: CustomEvent<{ id: string }>) => {
    const a = maintAccess();
    if (!a.enabled || !(a.perform || a.manage)) return; // the module is off or the person may mark nothing: no request is made
    void this.ask(e.detail?.id ?? '');
  };

  private async ask(id: string) {
    if (!id) return;
    try {
      const r = await maintApi.closeProposal(id);
      if (r.proposal) {
        this.ticketId = id;
        this.plan = r.proposal;
        this.error = '';
      }
    } catch {
      /* the question is a courtesy: a failure never disturbs the closing */
    }
  }

  private async yes() {
    this.busy = true;
    this.error = '';
    try {
      await maintApi.confirmClose(this.ticketId);
      this.plan = null;
      this.toast = mt('closeDoneToast');
      window.setTimeout(() => { this.toast = ''; }, 2600);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const p = this.plan;
    return html`${p ? html`<sw-dialog open heading=${mt('closeAskTitle')} data-maint-close-prompt @close=${() => { this.plan = null; }}>
        <p>${mt(p.kind === 'preventive' ? 'closeAskBody' : 'closeAskBodyDoc', { t: p.title, d: p.next_due ? fmtDate(p.next_due) : '' })}</p>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
        <div class="acts" slot="footer"><button type="button" class="btn" data-maint-close-no @click=${() => { this.plan = null; }}>${mt('closeAskNo')}</button>
          <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-close-yes @click=${() => void this.yes()}>${mt('closeAskYes')}</button></div>
      </sw-dialog>` : nothing}
      ${this.toast ? html`<div class="toast" role="status" aria-live="polite">${this.toast}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-close-prompt': MaintClosePrompt;
  }
}
