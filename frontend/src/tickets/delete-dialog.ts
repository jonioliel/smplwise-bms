import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { describeError } from '../api/client';
import { newRequestId } from '../api/tickets';
import { deleteApi } from '../api/tickets-delete';
import { BULK_DELETE_MAX, DELETE_REASON_MAX, deleteConfirmValue, deleteReady, type DeleteTarget } from './delete-model';
import { dlt } from './delete-text';
import { tIcon } from './icons';
import { ticketDetailStyles, ticketFormStyles } from './styles';

/**
 * Owner 14.10 `<tickets-delete-dialog .targets open>`: the confirmation of a full deletion - one ticket (its drawer / page) or the
 * table's selection (the bulk bar). It names what goes in one line (notes, photos, links, costs), asks to type the ticket's number (or,
 * for several, how many are selected) and a reason (required, at most 300 characters), and sends ONE request; the server checks every
 * ticket again (tickets.delete + manager rights, the cost guard, the hourly rate) and its refusal is shown as it comes. Events (bubble,
 * composed): `ticket-deleted` {id, number} (one), `bulk-done` {answer} (several), `delete-close`.
 */
@customElement('tickets-delete-dialog')
export class TicketsDeleteDialog extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) targets: DeleteTarget[] = [];
  @property({ type: Boolean }) open = false;
  @state() private typed = '';
  @state() private reason = '';
  @state() private error = '';
  @state() private busy = false;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, css`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .warn {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--dv-bad, #d93a3a) 10%, transparent);
      color: var(--dv-text);
      overflow-wrap: anywhere;
    }
    .warn b {
      display: block;
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .hint {
      color: var(--dv-text-dim);
      font-size: var(--sw-fs-sm);
    }
    .inp.code {
      max-inline-size: 180px;
      direction: ltr;
      text-align: start;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      this.typed = '';
      this.reason = '';
      this.error = '';
    }
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private close(): void {
    if (this.busy) return;
    this.emit('delete-close', {});
  }

  private async go(): Promise<void> {
    const targets = this.targets;
    if (!deleteReady(targets, this.typed, this.reason) || this.busy) {
      if (!this.reason.trim()) this.error = dlt('required');
      else if (this.typed.trim() !== String(deleteConfirmValue(targets))) this.error = dlt('mismatch');
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const reason = this.reason.trim();
      if (targets.length === 1) {
        const t = targets[0];
        const out = await deleteApi().remove(t.id, { reason, confirm_number: t.number, client_request_id: newRequestId() });
        this.emit('ticket-deleted', { id: out.id, number: out.number });
      } else {
        const answer = await deleteApi().bulkRemove({ ids: targets.map((t) => t.id), reason, confirm_count: targets.length, client_request_id: newRequestId() });
        this.emit('bulk-done', { answer });
      }
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!this.open) return nothing;
    const targets = this.targets;
    const one = targets.length === 1;
    const value = deleteConfirmValue(targets);
    const heading = one ? dlt('title', { n: targets[0].number }) : dlt('bulkTitle', { n: targets.length });
    const tooMany = targets.length > BULK_DELETE_MAX;
    return html`<sw-dialog open heading=${heading} data-delete-dialog=${one ? 'one' : 'bulk'} @close=${() => this.close()}>
      <div class="form">
        <div class="warn" role="note" data-delete-warn>${tIcon('warning')}<div><b>${dlt('warn')}</b><span data-delete-goes>${one ? dlt('goes') : dlt('bulkGoes')}</span></div></div>
        ${tooMany ? html`<div class="err" role="alert" data-delete-too-many>${dlt('tooMany', { max: BULK_DELETE_MAX })}</div>` : nothing}
        <label class="fld"><span>${one ? dlt('typeNumber', { n: value }) : dlt('typeCount', { n: value })} <b class="req">*</b></span>
          <input class="inp code num" inputmode="numeric" autocomplete="off" maxlength="10" data-delete-confirm .value=${this.typed}
            @input=${(e: Event) => { this.typed = (e.target as HTMLInputElement).value; this.error = ''; }} /></label>
        <label class="fld"><span>${dlt('reason')} <b class="req">*</b></span>
          <textarea class="inp" maxlength=${DELETE_REASON_MAX} data-delete-reason .value=${this.reason}
            @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; this.error = ''; }}></textarea>
          <small class="hint">${dlt('reasonHint', { max: DELETE_REASON_MAX })} <span class="num" data-delete-left>${this.reason.trim().length}/${DELETE_REASON_MAX}</span></small></label>
        ${this.error ? html`<div class="err" role="alert" data-delete-error>${this.error}</div>` : nothing}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn danger" data-delete-go ?disabled=${this.busy || tooMany || !deleteReady(targets, this.typed, this.reason)} @click=${() => void this.go()}>${tIcon('trash')}${dlt('go')}</button>
        <button type="button" class="btn" data-delete-cancel ?disabled=${this.busy} @click=${() => this.close()}>${dlt('cancel')}</button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-delete-dialog': TicketsDeleteDialog;
  }
}
